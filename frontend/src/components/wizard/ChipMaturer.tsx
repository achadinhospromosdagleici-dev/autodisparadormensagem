import React, { useState, useEffect } from 'react';
import { Phone, Play, Square, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { loadWuzapiInstances, loadWuzapiSettings } from '@/services/wuzapi';
import { loadUnoApiCredentialsWithFallback, fetchInstances as fetchUnoInstances } from '@/services/unoapi';
import { loadEvolutionCredentialsWithFallback, fetchInstances as fetchEvolutionInstances } from '@/services/evolution';
import { loadEvolutionGoCredentialsWithFallback, fetchEvolutionGoInstances } from '@/services/evolutionGo';
import { startMaturation, MaturerInstance, MaturerProgress } from '@/services/chipMaturer';

export function ChipMaturer() {
  const [instances, setInstances] = useState<MaturerInstance[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetPhonesText, setTargetPhonesText] = useState('');
  const [text, setText] = useState('');
  const [duration, setDuration] = useState(30);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<MaturerProgress | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const abortRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    loadAllInstances();
  }, []);

  async function loadAllInstances() {
    const list: MaturerInstance[] = [];
    const seen = new Set<string>();

    try {
      const unoCreds = await loadUnoApiCredentialsWithFallback();
      if (unoCreds) {
        const result = await fetchUnoInstances(unoCreds);
        for (const inst of result.instances || []) {
          if (inst.status !== 'connected') continue;
          if (!seen.has(inst.phone)) {
            seen.add(inst.phone);
            list.push({ id: inst.phone, phone: inst.phone, api: 'unoapi', label: `${inst.phone} (UnoAPI)` });
          }
        }
      }
    } catch { console.warn('[ChipMaturer] UnoAPI erro'); }

    try {
      const wuzSettings = await loadWuzapiSettings();
      if (wuzSettings?.baseUrl) {
        const wuzInsts = await loadWuzapiInstances();
        for (const inst of wuzInsts) {
          if (inst.status !== 'connected') continue;
          const phone = inst.phone || inst.id;
          if (!phone || seen.has(phone)) continue;
          seen.add(phone);
          list.push({ id: inst.id, phone, api: 'wuzapi', label: `${phone} (WuzAPI)` });
        }
      }
    } catch { console.warn('[ChipMaturer] WuzAPI erro'); }

    try {
      const evoCreds = await loadEvolutionCredentialsWithFallback();
      if (evoCreds) {
        const evoInsts = await fetchEvolutionInstances(evoCreds);
        for (const inst of evoInsts) {
          if (inst.status !== 'connected' && inst.status !== 'open') continue;
          if (!seen.has(inst.phone)) {
            seen.add(inst.phone);
            list.push({ id: inst.instanceName, phone: inst.phone, api: 'evolution', label: `${inst.phone} (Evolution)` });
          }
        }
      }
    } catch { console.warn('[ChipMaturer] Evolution erro'); }

    try {
      const evoGoCreds = await loadEvolutionGoCredentialsWithFallback();
      if (evoGoCreds) {
        const evoGoInsts = await fetchEvolutionGoInstances(evoGoCreds);
        for (const inst of evoGoInsts) {
          if (inst.status !== 'connected' && inst.status !== 'open') continue;
          if (!seen.has(inst.phone)) {
            seen.add(inst.phone);
            list.push({ id: inst.instanceName, phone: inst.phone, api: 'evolution-go', label: `${inst.phone} (Evolution Go)` });
          }
        }
      }
    } catch { console.warn('[ChipMaturer] Evolution Go erro'); }

    list.sort((a, b) => a.label.localeCompare(b.label));
    setInstances(list);
  }

  function toggle(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function splitPhrases(text: string): string[] {
    return text
      .split(/[.?!;\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 3);
  }

  async function handleStart() {
    const selected = instances.filter(i => selectedIds.has(i.id));
    if (selected.length === 0) { toast.error('Selecione pelo menos um número'); return; }

    let targets: string[] = [];
    if (selected.length >= 2) {
      targets = selected.map(i => i.phone);
    } else {
      targets = targetPhonesText.split('\n').map(t => t.trim()).filter(t => t);
      if (targets.length === 0) { toast.error('Com apenas 1 número, informe os telefones de destino'); return; }
    }

    const phrases = splitPhrases(text);
    if (phrases.length < 2) { toast.error('Texto muito curto. Escreva pelo menos 2 frases.'); return; }

    setRunning(true);
    setLog([]);
    setProgress({ sent: 0, total: phrases.length, currentPhrase: '', from: '', to: '' });
    const abort = new AbortController();
    abortRef.current = abort;

    addLog(`Iniciando maturação com ${selected.length} número(s), ${phrases.length} frases, ${duration}min`);

    await startMaturation(selected, targets, phrases, duration, (p) => {
      setProgress(p);
      if (p.lastResult) {
        addLog(`${p.lastResult === 'OK' ? '✓' : '✗'} ${p.from} → ${p.to}: "${p.currentPhrase.substring(0, 40)}..."`);
      }
    }, abort.signal);

    setRunning(false);
    abortRef.current = null;
    addLog('Maturação finalizada');
    toast.success('Maturação concluída!');
  }

  function handleStop() {
    abortRef.current?.abort();
    setRunning(false);
    addLog('Maturação interrompida pelo usuário');
  }

  function addLog(msg: string) {
    const time = new Date().toLocaleTimeString();
    setLog(prev => [...prev, `[${time}] ${msg}`]);
  }

  const selected = instances.filter(i => selectedIds.has(i.id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Maturador de Chip
        </h2>
        <p className="text-sm text-muted-foreground">
          Simule conversa entre números para evitar banimento por inatividade
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Números disponíveis</label>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {instances.map(inst => (
                <label key={inst.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedIds.has(inst.id) ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50 border border-transparent'
                }`}>
                  <input type="checkbox" checked={selectedIds.has(inst.id)} onChange={() => toggle(inst.id)} className="rounded border-border" />
                  <span className="text-sm">{inst.label}</span>
                </label>
              ))}
              {instances.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">Nenhum número conectado. Conecte em Configurações.</p>
              )}
            </div>
            {selected.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selected.length} selecionado(s). {selected.length >= 2
                  ? 'Eles vão se enviar mensagens entre si.'
                  : 'Com 1 número, informe os destinos abaixo.'}
              </p>
            )}
          </div>

          {selected.length === 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefones de destino (um por linha)</label>
              <textarea
                value={targetPhonesText}
                onChange={e => setTargetPhonesText(e.target.value)}
                rows={3}
                placeholder="5511999999999&#10;5521999999999"
                className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none text-sm"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Texto para maturação (poema, letra de música, história)</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={6}
              placeholder="Cole um poema, letra de música ou texto qualquer.&#10;Cada frase será enviada como uma mensagem separada."
              className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {splitPhrases(text).length} frase(s) detectada(s)
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duração: {duration} minuto(s)
            </label>
            <input
              type="range"
              min={1}
              max={120}
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 min</span>
              <span>2h máx</span>
            </div>
          </div>

          <button
            onClick={running ? handleStop : handleStart}
            disabled={!running && (selected.length === 0 || !text.trim())}
            className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${
              running ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
            }`}
          >
            {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? 'Parar' : 'Iniciar Maturação'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
              Status
            </h3>
            {progress ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Progresso</span>
                  <span className="font-medium">{progress.sent} / {progress.total}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${progress.total > 0 ? (progress.sent / progress.total) * 100 : 0}%` }} />
                </div>
                {progress.currentPhrase && (
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="font-medium text-foreground">{progress.from}</span>
                    {' → '}
                    <span className="font-medium text-foreground">{progress.to}</span>
                    : "{progress.currentPhrase}..."
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Configure e inicie a maturação</p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Log</h3>
            <div className="h-64 overflow-y-auto border border-border rounded-lg p-3 space-y-1 bg-muted/20">
              {log.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento ainda</p>
              ) : (
                log.map((entry, i) => (
                  <p key={i} className="text-xs font-mono text-muted-foreground">{entry}</p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
