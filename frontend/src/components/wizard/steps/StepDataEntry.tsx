import React, { useState, useCallback, useEffect } from 'react';
import { useWizard, DataRow } from '@/contexts/WizardContext';
import { validatePhoneNumber, parseCSVLine, detectDelimiter } from '@/utils/phoneValidation';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Table, FileText, ListOrdered, Plus, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SpreadsheetPasteArea } from '../SpreadsheetPasteArea';
import {
  loadWuzapiInstances,
  loadWuzapiSettings,
  listGroups as wuzapiListGroups,
} from '@/services/wuzapi';
import {
  loadUnoApiCredentialsWithFallback,
  fetchInstances as fetchUnoInstances,
  listUnoGroups,
  getUnoGroupParticipants,
} from '@/services/unoapi';

export function StepDataEntry() {
  const { setData, setColumns, data, columns, settings, setSettings, nextStep } = useWizard();
  const [pasteData, setPasteData] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(false);

  const [showGroupImport, setShowGroupImport] = useState(false);
  const [phones, setPhones] = useState<{ id: string; label: string; hasUno: boolean; wuzId?: string; wuzUrl?: string; wuzToken?: string }[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [groups, setGroups] = useState<{ id: string; name: string; participants?: { name: string; phone: string }[] }[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [importingGroups, setImportingGroups] = useState(false);

  const processData = useCallback((text: string, hasHeader: boolean = true) => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      toast.error('Nenhum dado encontrado');
      return;
    }

    const delimiter = detectDelimiter(text);
    const headerLine = parseCSVLine(lines[0], delimiter);
    
    const dataLines = hasHeader ? lines.slice(1) : lines;
    
    const rows: any[] = dataLines.map(line => {
      const values = parseCSVLine(line, delimiter);
      const row: any = {
        id: crypto.randomUUID(),
        numero: '',
        isValid: false
      };
      headerLine.forEach((col, i) => {
        row[col] = values[i] || '';
      });

      if (row.numero) {
        const validation = validatePhoneNumber(row.numero, true);
        row.isValid = validation.isValid;
        row.numero = validation.formatted;
        row.errorMessage = validation.errorMessage;
      }

      return row;
    });

    setData(rows);
    setColumns(headerLine);
    toast.success(`${rows.length} registros processados.`);
  }, [setData, setColumns]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPasteData(text);
        processData(text, settings.hasHeader);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [processData, settings.hasHeader]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setPasteData(text);
          processData(text, settings.hasHeader);
        }
      };
      reader.readAsText(file);
    }
  }, [processData, settings.hasHeader]);

  const loadPhones = useCallback(async () => {
    const list: typeof phones = [];
    const seen = new Set<string>();

    const unoCreds = await loadUnoApiCredentialsWithFallback();
    if (unoCreds) {
      const result = await fetchUnoInstances(unoCreds);
      for (const inst of result.instances || []) {
        if (inst.status !== 'connected') continue;
        if (!seen.has(inst.phone)) {
          seen.add(inst.phone);
          list.push({ id: inst.phone, label: `${inst.name || inst.phone} (UnoAPI)`, hasUno: true });
        }
      }
    }

    const wuzSettings = await loadWuzapiSettings();
    if (wuzSettings?.url) {
      const wuzInsts = await loadWuzapiInstances();
      for (const inst of wuzInsts) {
        if (inst.status !== 'connected') continue;
        const phone = inst.phone || inst.id;
        if (!phone) continue;
        const existing = list.find(e => e.id === phone);
        if (existing) {
          existing.hasUno = existing.hasUno || false;
          existing.wuzId = inst.id;
          existing.wuzUrl = wuzSettings.url;
          existing.wuzToken = inst.user_token;
          existing.label = `${phone} (UnoAPI/WuzAPI)`;
        } else if (!seen.has(phone)) {
          seen.add(phone);
          list.push({
            id: phone,
            label: `${phone} (WuzAPI)`,
            hasUno: false,
            wuzId: inst.id,
            wuzUrl: wuzSettings.url,
            wuzToken: inst.user_token,
          });
        }
      }
    }

    setPhones(list);
  }, []);

  useEffect(() => {
    if (showGroupImport) loadPhones();
  }, [showGroupImport, loadPhones]);

  const handleLoadGroups = useCallback(async () => {
    if (!selectedPhone) return;
    setLoadingGroups(true);
    const entry = phones.find(p => p.id === selectedPhone);
    const allGroups: typeof groups = [];

    if (entry?.hasUno) {
      const creds = await loadUnoApiCredentialsWithFallback();
      if (creds) {
        const unoGroups = await listUnoGroups(creds, entry.id);
        for (const g of unoGroups) {
          const participants = await getUnoGroupParticipants(creds, entry.id, g.jid);
          allGroups.push({
            id: g.jid,
            name: g.subject || g.jid,
            participants: participants.map(p => ({
              name: p.name || '',
              phone: p.phone || '',
            })),
          });
        }
      }
    }

    if (allGroups.length === 0 && entry?.wuzUrl && entry?.wuzToken) {
      const wuzGroups = await wuzapiListGroups(entry.wuzUrl, entry.wuzToken);
      for (const g of wuzGroups) {
        allGroups.push({
          id: g.jid,
          name: g.name || g.jid,
          participants: g.participants.map(p => ({
            name: '',
            phone: p.phone || '',
          })),
        });
      }
    }

    setGroups(allGroups);
    setLoadingGroups(false);
  }, [selectedPhone, phones]);

  const handleImportSelectedGroups = useCallback(async () => {
    if (selectedGroups.size === 0) return;
    setImportingGroups(true);

    const rows: any[] = [];
    const seen = new Set<string>();

    for (const g of groups) {
      if (!selectedGroups.has(g.id)) continue;
      for (const p of g.participants || []) {
        const cleanPhone = p.phone.replace(/\D/g, '');
        if (!cleanPhone || seen.has(cleanPhone)) continue;
        seen.add(cleanPhone);
        rows.push({
          id: crypto.randomUUID(),
          nome: p.name || `Grupo: ${g.name}`,
          numero: cleanPhone,
          isValid: cleanPhone.length >= 10,
        });
      }
    }

    if (rows.length > 0) {
      setData(rows);
      setColumns(['nome', 'numero']);
      toast.success(`${rows.length} contatos importados de ${selectedGroups.size} grupo(s)`);
      setShowGroupImport(false);
      setSelectedGroups(new Set());
      setGroups([]);
      setSelectedPhone('');
    } else {
      toast.error('Nenhum contato encontrado nos grupos selecionados');
    }

    setImportingGroups(false);
  }, [selectedGroups, groups, setData, setColumns]);

  const toggleGroup = (id: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {!showPasteArea && !showGroupImport && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div 
            className={`relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => setShowPasteArea(true)}
          >
            <div className="text-center space-y-2">
              <Table className="w-8 h-8 mx-auto text-muted-foreground" />
              <div className="font-medium">Planilha</div>
              <p className="text-xs text-muted-foreground">Cole ou arraste dados no formato de planilha</p>
            </div>
          </div>

          <div 
            className="relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer border-border hover:border-primary/50"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file && (file.type === 'text/plain' || file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const text = event.target?.result as string;
                  if (text) {
                    setPasteData(text);
                    processData(text);
                  }
                };
                reader.readAsText(file);
              }
            }}
          >
            <div className="text-center space-y-2">
              <FileText className="w-8 h-8 mx-auto text-muted-foreground" />
              <div className="font-medium">Texto simples</div>
              <p className="text-xs text-muted-foreground">Cole dados de texto delimitados</p>
            </div>
          </div>

          <label className="relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer hover:border-primary/50 block">
            <input 
              type="file" 
              accept=".csv,.txt,.xls,.xlsx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="text-center space-y-2">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
              <div className="font-medium">Upload</div>
              <p className="text-xs text-muted-foreground">Envie um arquivo CSV ou TXT</p>
            </div>
          </label>

          <div 
            className="relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer border-border hover:border-primary/50"
            onClick={() => setShowGroupImport(true)}
          >
            <div className="text-center space-y-2">
              <Users className="w-8 h-8 mx-auto text-muted-foreground" />
              <div className="font-medium">Grupos</div>
              <p className="text-xs text-muted-foreground">Importar contatos de grupos do WhatsApp</p>
            </div>
          </div>
        </div>
      )}

      {showPasteArea && (
        <div className="relative">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm">Cole dados da planilha (Ctrl+V)</span>
            </div>
            <button
              onClick={() => setShowPasteArea(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ✕ Fechar
            </button>
          </div>
          
          <SpreadsheetPasteArea 
            onDataPaste={(text) => {
              setPasteData(text);
              processData(text, settings.hasHeader);
            }}
            onProcess={() => {
              if (typeof nextStep === 'function') {
                nextStep();
              } else {
                console.error('[StepDataEntry] nextStep is not a function from useWizard');
                toast.error('Erro ao avançar de etapa. Tente novamente.');
              }
            }}
          />

          {data.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-success bg-success/10 px-4 py-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
              <span>Dados carregados! Clique em <strong>Processar Dados</strong> para mapear.</span>
            </div>
          )}
        </div>
      )}

      {showGroupImport && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Importar de Grupos
            </h3>
            <button
              onClick={() => { setShowGroupImport(false); setGroups([]); setSelectedGroups(new Set()); }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ✕ Fechar
            </button>
          </div>

          {phones.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando números...
            </div>
          )}

          {phones.length > 0 && (
            <div className="flex gap-2">
              <select
                value={selectedPhone}
                onChange={(e) => setSelectedPhone(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="">Selecione um número</option>
                {phones.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <button
                onClick={handleLoadGroups}
                disabled={!selectedPhone || loadingGroups}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {loadingGroups ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Carregar Grupos'
                )}
              </button>
            </div>
          )}

          {groups.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {groups.length} grupos encontrados
                </span>
                <button
                  onClick={handleImportSelectedGroups}
                  disabled={selectedGroups.size === 0 || importingGroups}
                  className="px-3 py-1.5 bg-success text-white rounded-lg text-sm hover:bg-success/90 disabled:opacity-50 flex items-center gap-1"
                >
                  {importingGroups ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Importar {selectedGroups.size} grupo(s)
                    </>
                  )}
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {groups.map(g => {
                  const total = g.participants?.length || 0;
                  return (
                    <label
                      key={g.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedGroups.has(g.id) ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroups.has(g.id)}
                        onChange={() => toggleGroup(g.id)}
                        className="rounded border-border"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{g.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {total} {total === 1 ? 'participante' : 'participantes'}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {!loadingGroups && groups.length === 0 && selectedPhone && (
            <p className="text-sm text-muted-foreground">
              Nenhum grupo encontrado para este número.
            </p>
          )}
        </div>
      )}

      {data.length === 0 && !showPasteArea && !showGroupImport && (
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Como importar dados:
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
            <li>Escolha uma das opções acima (Planilha, Texto Simples, Upload ou Grupos)</li>
            <li>Cole ou arraste dados no formato: <strong>telefone, nome, empresa...</strong></li>
            <li>A primeira linha será usada como cabeçalho</li>
            <li>O sistema detectará automaticamente números de telefone</li>
          </ul>
        </div>
      )}

      {(data.length > 0 && !showPasteArea && !showGroupImport) && (
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{data.length} contatos</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {columns.length} colunas
            </div>
          </div>
          <button
            onClick={() => setShowPasteArea(true)}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
          >
            <Plus className="w-4 h-4" />
            Adicionar mais
          </button>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.hasHeader}
            onChange={(e) => setSettings({ hasHeader: e.target.checked })}
            className="rounded border-border"
          />
          Primeira linha é cabeçalho
        </label>
      </div>
    </div>
  );
}
