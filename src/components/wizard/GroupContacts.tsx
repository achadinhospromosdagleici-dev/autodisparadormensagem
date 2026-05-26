import React, { useState, useEffect } from 'react';
import {
  Users,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  loadWuzapiSettings,
  loadWuzapiInstances,
  listGroups,
  getGroupInfo,
  WuzapiGroup,
  WuzapiInstance,
} from '@/services/wuzapi';

export function GroupContacts() {
  const [instances, setInstances] = useState<WuzapiInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [groups, setGroups] = useState<WuzapiGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadInstances();
  }, []);

  async function loadInstances() {
    setLoading(true);
    const insts = await loadWuzapiInstances();
    setInstances(insts.filter(i => i.status === 'connected'));
    setLoading(false);
    if (insts.length > 0) setSelectedInstance(insts[0].id);
  }

  async function handleLoadGroups() {
    if (!selectedInstance) return;
    setLoadingGroups(true);
    setGroups([]);
    try {
      const creds = await getInstanceCreds(selectedInstance);
      if (!creds) {
        toast.error('Credenciais da instância não encontradas');
        return;
      }
      const result = await listGroups(creds.baseUrl, creds.userToken);
      setGroups(result);

      if (result.length === 0) {
        toast.info('Nenhum grupo encontrado nesta instância');
      } else {
        toast.success(`${result.length} grupo(s) carregado(s)`);
      }
    } catch (err: any) {
      toast.error('Erro ao carregar grupos: ' + (err.message || ''));
    } finally {
      setLoadingGroups(false);
    }
  }

  async function getInstanceCreds(instanceId: string) {
    const settings = await loadWuzapiSettings();
    if (!settings) return null;
    const inst = instances.find(i => i.id === instanceId);
    if (!inst) return null;
    return { baseUrl: settings.baseUrl, userToken: inst.user_token };
  }

  async function toggleGroup(group: WuzapiGroup) {
    if (expandedGroup === group.jid) {
      setExpandedGroup(null);
      return;
    }
    if (group.participants.length === 0) {
      const creds = await getInstanceCreds(selectedInstance);
      if (creds) {
        const info = await getGroupInfo(creds.baseUrl, creds.userToken, group.jid);
        if (info) group.participants = info.participants;
      }
    }
    setExpandedGroup(group.jid);
  }

  function exportAllPhones() {
    const phones = groups.flatMap(g =>
      g.participants.map(p => p.phone).filter(Boolean)
    );
    copyToClipboard(phones.join('\n'));
  }

  function exportGroupPhones(group: WuzapiGroup) {
    const phones = group.participants.map(p => p.phone).filter(Boolean);
    copyToClipboard(phones.join('\n'));
  }

  function exportAllContacts() {
    const lines = ['nome,telefone'];
    groups.forEach(g => {
      g.participants.forEach(p => {
        lines.push(`${g.name},${p.phone}`);
      });
    });
    downloadCsv(lines.join('\n'), 'contatos-grupos.csv');
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success(`${text.split('\n').length} número(s) copiado(s)!`);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadCsv(content: string, filename: string) {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo CSV baixado!');
  }

  const filteredGroups = search
    ? groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    : groups;

  const allPhonesCount = groups.reduce((acc, g) => acc + g.participants.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Contatos de Grupos
        </h2>
        <p className="text-sm text-muted-foreground">
          Liste os grupos do WhatsApp conectado e exporte os números dos participantes
        </p>
      </div>

      {instances.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <AlertTriangle className="h-10 w-10" />
          <p className="text-sm">Nenhuma instância WuzAPI conectada.</p>
          <p className="text-xs">Conecte uma instância na aba WuzAPI primeiro.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Instância</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedInstance}
                onChange={e => setSelectedInstance(e.target.value)}
              >
                {instances.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name} {i.phone ? `(${i.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              onClick={handleLoadGroups}
              disabled={loadingGroups || !selectedInstance}
            >
              {loadingGroups ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Carregar Grupos
            </button>
          </div>

          {groups.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input text-sm hover:bg-accent"
                onClick={exportAllPhones}
              >
                <Copy className="h-4 w-4" />
                Copiar {allPhonesCount} números
              </button>
              <button
                className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input text-sm hover:bg-accent"
                onClick={exportAllContacts}
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </button>
            </div>
          )}

          {filteredGroups.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
                placeholder="Filtrar grupos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            {filteredGroups.map(group => {
              const isOpen = expandedGroup === group.jid;
              const count = group.participants.length;

              return (
                <div key={group.jid} className="rounded-lg border">
                  <button
                    className="flex w-full items-center gap-3 p-4 text-left hover:bg-accent/50 transition-colors"
                    onClick={() => toggleGroup(group)}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {count} participante{count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {count > 0 && (
                      <button
                        className="inline-flex items-center gap-1 h-8 px-2 rounded-md border text-xs hover:bg-accent shrink-0"
                        onClick={e => { e.stopPropagation(); exportGroupPhones(group); }}
                        title="Copiar números do grupo"
                      >
                        <Copy className="h-3 w-3" />
                        {count}
                      </button>
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t px-4 py-3 space-y-1 max-h-64 overflow-y-auto">
                      {count === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          Nenhum participante encontrado
                        </p>
                      ) : (
                        group.participants.map((p, idx) => (
                          <div
                            key={p.jid || idx}
                            className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/30 text-sm"
                          >
                            <span className="font-mono text-xs">{p.phone}</span>
                            {p.isAdmin && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                admin
                              </span>
                            )}
                            <button
                              className="ml-auto text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                navigator.clipboard.writeText(p.phone);
                                toast.success(`Número ${p.phone} copiado!`);
                              }}
                              title="Copiar número"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!loadingGroups && groups.length === 0 && selectedInstance && (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Users className="h-8 w-8" />
              <p className="text-sm">Clique em "Carregar Grupos" para buscar os grupos</p>
            </div>
          )}

          {copied && (
            <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm animate-in fade-in slide-in-from-bottom-2">
              <CheckCircle2 className="h-4 w-4" />
              Números copiados!
            </div>
          )}
        </>
      )}
    </div>
  );
}
