import React, { useState, useEffect } from 'react';
import {
  Users,
  Loader2,
  Send,
  CheckCircle2,
  AlertTriangle,
  Search,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  loadWuzapiSettings,
  loadWuzapiInstances,
  listGroups,
} from '@/services/wuzapi';
import { sendText as wuzapiSendText } from '@/services/wuzapi';
import {
  loadUnoApiCredentialsWithFallback,
  fetchInstances as fetchUnoInstances,
  listUnoGroups,
} from '@/services/unoapi';
import { sendTextMessage } from '@/services/unoapi';

interface PhoneEntry {
  phone: string;
  label: string;
  hasWuzapi: boolean;
  hasUnoapi: boolean;
  wuzapiInstanceId?: string;
}

interface GroupEntry {
  jid: string;
  name: string;
  participants: number;
  selected: boolean;
}

export function GroupSender() {
  const [loading, setLoading] = useState(true);
  const [phoneEntries, setPhoneEntries] = useState<PhoneEntry[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [sendErrors, setSendErrors] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadPhones();
  }, []);

  async function loadPhones() {
    setLoading(true);
    const entries: PhoneEntry[] = [];
    const seen = new Set<string>();

    const wuzapiInsts = (await loadWuzapiInstances()).filter(i => i.status === 'connected');
    for (const inst of wuzapiInsts) {
      if (inst.phone && !seen.has(inst.phone)) {
        seen.add(inst.phone);
        entries.push({ phone: inst.phone, label: `${inst.name} (${inst.phone})`, hasWuzapi: true, hasUnoapi: false, wuzapiInstanceId: inst.id });
      } else if (inst.phone) {
        const existing = entries.find(e => e.phone === inst.phone);
        if (existing) { existing.hasWuzapi = true; existing.wuzapiInstanceId = inst.id; }
      }
    }

    const unoCreds = await loadUnoApiCredentialsWithFallback();
    if (unoCreds) {
      const { instances: unoInsts } = await fetchUnoInstances(unoCreds);
      for (const inst of unoInsts.filter(i => i.status === 'connected')) {
        if (seen.has(inst.phone)) {
          const existing = entries.find(e => e.phone === inst.phone);
          if (existing) existing.hasUnoapi = true;
        } else {
          seen.add(inst.phone);
          entries.push({ phone: inst.phone, label: `${inst.name || inst.phone} (${inst.phone})`, hasWuzapi: false, hasUnoapi: true });
        }
      }
    }

    for (const e of entries) {
      const badges: string[] = [];
      if (e.hasWuzapi) badges.push('W');
      if (e.hasUnoapi) badges.push('U');
      if (badges.length > 0) e.label += ` [${badges.join('/')}]`;
    }

    entries.sort((a, b) => a.label.localeCompare(b.label));
    setPhoneEntries(entries);
    setLoading(false);
    if (entries.length > 0) setSelectedPhone(entries[0].phone);
  }

  async function handleLoadGroups() {
    if (!selectedPhone) return;
    setLoadingGroups(true);
    setGroups([]);
    const entry = phoneEntries.find(e => e.phone === selectedPhone);
    if (!entry) { setLoadingGroups(false); return; }

    try {
      if (entry.hasUnoapi) {
        const creds = await loadUnoApiCredentialsWithFallback();
        if (creds) {
          const result = await listUnoGroups(creds, entry.phone);
          if (result.length > 0) {
            setGroups(result.map(g => ({ jid: g.jid, name: g.subject, participants: g.participantsCount, selected: false })));
            setLoadingGroups(false);
            return;
          }
        }
      }

      if (entry.hasWuzapi && entry.wuzapiInstanceId) {
        const settings = await loadWuzapiSettings();
        const insts = await loadWuzapiInstances();
        const inst = insts.find(i => i.id === entry.wuzapiInstanceId);
        if (settings && inst) {
          const result = await listGroups(settings.baseUrl, inst.user_token);
          if (result.length > 0) {
            setGroups(result.map(g => ({ jid: g.jid, name: g.name, participants: g.participants.length, selected: false })));
          }
        }
      }
    } catch (err: any) {
      toast.error('Erro ao carregar grupos: ' + (err.message || ''));
    } finally {
      setLoadingGroups(false);
    }
  }

  function toggleGroup(jid: string) {
    setGroups(prev => prev.map(g => g.jid === jid ? { ...g, selected: !g.selected } : g));
  }

  function selectAll() {
    const allSelected = groups.every(g => g.selected);
    setGroups(prev => prev.map(g => ({ ...g, selected: !allSelected })));
  }

  async function handleSend() {
    const selected = groups.filter(g => g.selected);
    if (selected.length === 0) { toast.error('Selecione ao menos um grupo'); return; }
    if (!message.trim()) { toast.error('Digite uma mensagem'); return; }

    setSending(true);
    setSentCount(0);
    setSendErrors([]);

    const entry = phoneEntries.find(e => e.phone === selectedPhone);
    if (!entry) { setSending(false); return; }

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < selected.length; i++) {
      const group = selected[i];
      try {
        if (entry.hasUnoapi) {
          const creds = await loadUnoApiCredentialsWithFallback();
          if (creds) {
            await sendTextMessage(creds, entry.phone, group.jid, message.trim());
          }
        } else if (entry.hasWuzapi && entry.wuzapiInstanceId) {
          const settings = await loadWuzapiSettings();
          const insts = await loadWuzapiInstances();
          const inst = insts.find(i => i.id === entry.wuzapiInstanceId);
          if (settings && inst) {
            await wuzapiSendText(settings.baseUrl, inst.user_token, group.jid, message.trim());
          }
        }
        successCount++;
      } catch (err: any) {
        errors.push(`${group.name}: ${err.message || 'Erro desconhecido'}`);
      }
    }

    setSentCount(successCount);
    setSendErrors(errors);
    setSending(false);

    if (errors.length === 0) {
      toast.success(`Mensagem enviada para ${successCount} grupo(s)!`);
    } else if (successCount > 0) {
      toast.warning(`${successCount} enviada(s), ${errors.length} falha(s)`);
    } else {
      toast.error('Nenhuma mensagem enviada. Verifique os erros.');
    }
  }

  const filteredGroups = search
    ? groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    : groups;

  const selectedCount = groups.filter(g => g.selected).length;

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
          <MessageSquare className="h-5 w-5" />
          Enviar para Grupos
        </h2>
        <p className="text-sm text-muted-foreground">
          Selecione grupos e envie mensagens de texto
        </p>
      </div>

      {phoneEntries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <AlertTriangle className="h-10 w-10" />
          <p className="text-sm">Nenhum número conectado.</p>
          <p className="text-xs">Conecte uma instância WuzAPI ou UnoAPI primeiro.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Número</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedPhone}
                onChange={e => setSelectedPhone(e.target.value)}
              >
                {phoneEntries.map(e => (
                  <option key={e.phone} value={e.phone}>{e.label}</option>
                ))}
              </select>
            </div>
            <button
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              onClick={handleLoadGroups}
              disabled={loadingGroups || !selectedPhone}
            >
              {loadingGroups ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Carregar Grupos
            </button>
          </div>

          {groups.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
                    placeholder="Filtrar grupos..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <button
                  onClick={selectAll}
                  className="h-10 px-3 rounded-md border border-input text-sm hover:bg-accent"
                >
                  {groups.every(g => g.selected) ? 'Limpar' : 'Selecionar Todos'}
                </button>
              </div>

              <div className="space-y-1 max-h-80 overflow-y-auto border rounded-lg p-2">
                {filteredGroups.map(group => (
                  <label
                    key={group.jid}
                    className="flex items-center gap-3 p-3 rounded-md hover:bg-accent/30 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={group.selected}
                      onChange={() => toggleGroup(group.jid)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.participants} participantes</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Mensagem</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Digite a mensagem que será enviada para os grupos selecionados..."
                    className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSend}
                    disabled={sending || selectedCount === 0 || !message.trim()}
                    className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {sending ? `Enviando... ${sentCount}/${selectedCount}` : `Enviar para ${selectedCount} grupo(s)`}
                  </button>
                </div>
              </div>

              {sendErrors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Erros:</p>
                  {sendErrors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive/80">{err}</p>
                  ))}
                </div>
              )}

              {sentCount > 0 && sendErrors.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Mensagem enviada para {sentCount} grupo(s) com sucesso!
                </div>
              )}
            </>
          )}

          {!loadingGroups && groups.length === 0 && selectedPhone && (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Users className="h-8 w-8" />
              <p className="text-sm">Clique em "Carregar Grupos" para buscar os grupos</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
