import React, { useState, useCallback, useEffect } from 'react';
import { useWizard, DataRow } from '@/contexts/WizardContext';
import { validatePhoneNumber, parseCSVLine, detectDelimiter } from '@/utils/phoneValidation';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Table, FileText, ListOrdered, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SpreadsheetPasteArea } from '../SpreadsheetPasteArea';

export function StepDataEntry() {
  const { setData, setColumns, data, columns, settings, setSettings, nextStep } = useWizard();
  const [pasteData, setPasteData] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(false);

  // NÃO auto-ocultar - área só fecha quando usuário clica em Processar ou Fechar

  // Listen for Ctrl+V globally when paste area is shown
  useEffect(() => {
    if (!showPasteArea) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData.getData('text');
      if (text && text.trim()) {
        processData(text, settings.hasHeader);
        // NÃO fecha automaticamente - mantém aberto para adicionar mais
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [showPasteArea, settings.hasHeader]);

  const processData = useCallback((text: string, hasHeader: boolean = true) => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      toast.error('Nenhum dado encontrado');
      return;
    }

    const delimiter = detectDelimiter(text);
    const isAppending = Array.isArray(data) && data.length > 0;
    
    let cols = columns;
    let dataLines = lines;

    if (!isAppending) {
      const headerLine = parseCSVLine(lines[0], delimiter);
      // Se só há uma linha, trata como dados sem cabeçalho
      const shouldHaveHeader = hasHeader && lines.length > 1;
      
      // Normalize column names
      cols = shouldHaveHeader
        ? headerLine.map(col => col.toLowerCase().replace(/\s+/g, '_'))
        : headerLine.map((_, i) => i === 0 ? 'numero' : `coluna_${i + 1}`);

      // Ensure 'numero' column exists
      if (!cols.includes('numero')) {
        // Try to find a column that looks like phone numbers
        const phoneColIndex = headerLine.findIndex(col => 
          /phone|telefone|numero|number|celular|whatsapp/i.test(col)
        );
        
        if (phoneColIndex >= 0) {
          cols[phoneColIndex] = 'numero';
        } else {
          cols[0] = 'numero';
        }
      }

      setColumns(cols);
      dataLines = shouldHaveHeader && Array.isArray(lines) ? lines.slice(1) : lines;
    } else {
      // If appending, we might still have a header in the new text if it's a full paste
      // We'll try to skip it if the first line matches our columns
      const parsedFirstLine = parseCSVLine(lines[0], delimiter);
      if (!Array.isArray(parsedFirstLine)) {
        dataLines = lines;
      } else {
        const firstLine = parsedFirstLine.map((c: string) => c.toLowerCase().replace(/\s+/g, '_'));
        const isHeader = Array.isArray(columns) && firstLine.some((c: string) => columns.includes(c));
        dataLines = isHeader && Array.isArray(lines) ? lines.slice(1) : lines;
      }
    }
    
    if (dataLines.length === 0) {
      toast.error('Nenhum registro de dados novo encontrado.');
      return;
    }
    
    const rows: DataRow[] = dataLines
      .filter(line => {
        const values = parseCSVLine(line, delimiter);
        return Array.isArray(values) && values.some(v => v.trim() !== '');
      })
      .map((line) => {
        const values = parseCSVLine(line, delimiter);
        if (!Array.isArray(values)) {
          return null;
        }
        const row: DataRow = {
          id: crypto.randomUUID(),
          numero: '',
          isValid: false,
        };

        cols.forEach((col, i) => {
          row[col] = values[i] || '';
        });

        const phoneValue = row.numero as string;
        const validation = validatePhoneNumber(phoneValue, true);
        row.isValid = validation.isValid;
        row.numero = validation.formatted;
        row.errorMessage = validation.errorMessage;

        return row;
      });

    const validRows = rows.filter(r => r !== null) as DataRow[];
    
    setData(prev => isAppending ? [...prev, ...validRows] : validRows);
    const validCount = validRows.filter(r => r && r.isValid).length;
    toast.success(`${validRows.length} registros ${isAppending ? 'adicionados' : 'importados'} (${validCount} válidos)`);
    
    // Auto-avançar para próximo passo
    nextStep();
  }, [setData, setColumns, data.length, columns, nextStep]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (text) {
      setPasteData(text);
      processData(text);
      // NÃO fecha a área após colar - mantém aberta para adicionar mais
    }
  }, [processData]);

const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPasteData(text);
        processData(text, settings.hasHeader);
        // NÃO fecha a área após carregar arquivo - mantém abierta
      }
    };
    reader.readAsText(file);
    
    // Limpar o input para poder seleccionar o mesmo arquivo novamente
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
          // NÃO fecha após drag and drop - mantém aberta
        }
      };
      reader.readAsText(file);
    }
  }, [processData, settings.hasHeader]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPasteData(e.target.value);
  };

  const handleProcessClick = () => {
    if (pasteData.trim()) {
      processData(pasteData);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      {/* Upload Area */}
      <div
        className={`glass-card p-8 transition-all duration-300 ${
          isDragging ? 'border-primary bg-primary/5' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-6">
          {/* File Upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">Arraste um arquivo aqui</p>
              <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
            </div>
            <input
              type="file"
              accept=".csv,.xls,.xlsx,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <button
              onClick={() => {
                console.log('[StepDataEntry] CLICK: Selecionar Arquivo');
                const input = document.getElementById('file-upload');
                console.log('[StepDataEntry] Input element:', input);
                if (input) {
                  input.click();
                } else {
                  console.log('[StepDataEntry] ERROR: Input not found');
                }
              }}
              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground cursor-pointer hover:bg-secondary/80 transition-colors"
              style={{ pointerEvents: 'all' }}
            >
              <FileSpreadsheet className="w-4 h-4 inline-block mr-2" />
              Selecionar Arquivo
            </button>
            <button
              onClick={() => {
                console.log('[StepDataEntry] CLICK: Planilha button, current showPasteArea:', showPasteArea);
                setShowPasteArea(true);
                console.log('[StepDataEntry] After setShowPasteArea(true)');
              }}
              className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              style={{ pointerEvents: 'all' }}
            >
              <Table className="w-4 h-4 inline-block mr-2" />
              Planilha
            </button>
            <button
              onClick={() => {
                console.log('[StepDataEntry] CLICK: Adicionar Mais button, current showPasteArea:', showPasteArea);
                setShowPasteArea(true);
              }}
              className="px-4 py-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
              style={{ pointerEvents: 'all' }}
            >
              <Plus className="w-4 h-4 inline-block mr-2" />
              Adicionar Mais
            </button>
          </div>

          <div className="flex items-center gap-4 w-full">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Header Option Toggle */}
          <div className="w-full glass-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  {settings.hasHeader ? <FileText className="w-5 h-5 text-primary" /> : <ListOrdered className="w-5 h-5 text-primary" />}
                </div>
                <div>
                  <p className="font-medium">Primeira linha é cabeçalho?</p>
                  <p className="text-xs text-muted-foreground">
                    {settings.hasHeader 
                      ? 'Ex: numero, nome, empresa (usará como nomes das colunas)' 
                      : 'Dados começam na primeira linha (colunas serão nomeadas automaticamente)'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSettings({ hasHeader: true });
                    if (pasteData) processData(pasteData, true);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settings.hasHeader 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Sim
                </button>
                <button
                  onClick={() => {
                    setSettings({ hasHeader: false });
                    if (pasteData) processData(pasteData, false);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !settings.hasHeader 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Não
                </button>
              </div>
            </div>
          </div>

          {/* Spreadsheet-style Paste Area - Only shown when activated */}
          {showPasteArea && (
            <div className="w-full space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    Cole dados da planilha (Ctrl+V)
                  </span>
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
              />

              {data.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-success bg-success/10 px-4 py-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Dados carregados! Clique em <strong>Avançar</strong> para continuar.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats - Simple summary after data is loaded */}
      {data.length > 0 && (
        <div className="glass-card p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">{Array.isArray(data) ? data.filter(r => r.isValid).length : 0} válidos</span>
              </div>
              {Array.isArray(data) && data.filter(r => !r.isValid).length > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">{data.filter(r => !r.isValid).length} com erro</span>
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {Array.isArray(data) ? data.length : 0} contatos • {Array.isArray(columns) ? columns.length : 0} colunas
            </div>
          </div>
        </div>
      )}

      {/* Instructions - Collapsible */}
      {(!Array.isArray(data) || data.length === 0) && (
        <div className="glass-card p-4">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
            <div>
              <span className="font-medium text-foreground">Dica: </span>
              A coluna <code className="variable-tag">numero</code> é obrigatória. 
              Colunas como <code className="variable-tag">nome</code> podem ser usadas como variáveis nas mensagens.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
