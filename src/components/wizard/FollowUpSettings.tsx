import React, { useState, useEffect } from 'react';
import { useWizard } from '@/contexts/WizardContext';
import {
  GitBranch,
  MessageSquare,
  Reply,
  Clock,
  ArrowRight,
  CheckCircle2,
  Zap,
  Layers,
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  setWebhook,
  removeWebhook,
  getWebhook,
  loadEvolutionCredentials,
} from '@/services/evolution';
import { getWebhookUrl } from '@/services/messages';

export type FollowUpMode = 'greeting-then-all' | 'greeting-then-one-by-one';

export interface FollowUpConfig {
  enabled: boolean;
  mode: FollowUpMode;
  greetingMessageIndex: number; // index of greeting message (usually 0)
  waitForReplyTimeout: number; // minutes to wait for reply
  maxRetries: number;
  retryInterval: number; // minutes between retries
}

interface FollowUpSettingsProps {
  config: FollowUpConfig;
  onChange: (config: FollowUpConfig) => void;
}

export function FollowUpSettings({ config, onChange }: FollowUpSettingsProps) {
  const { messages, selectedInstances } = useWizard();
  const [webhookStatus, setWebhookStatus] = useState<'checking' | 'enabled' | 'disabled' | 'error'>('checking');
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    setWebhookUrl(getWebhookUrl());
    checkWebhookStatus();
  }, []);

  const checkWebhookStatus = async () => {
    const creds = loadEvolutionCredentials();
    if (!creds || selectedInstances.length === 0) {
      setWebhookStatus('disabled');
      return;
    }

    try {
      const webhookInfo = await getWebhook(creds, selectedInstances[0]);
      setWebhookStatus(webhookInfo.enabled && webhookInfo.url ? 'enabled' : 'disabled');
    } catch {
      setWebhookStatus('error');
    }
  };

  const handleToggle = async (enabled: boolean) => {
    const creds = loadEvolutionCredentials();
    if (!creds) {
      toast.error('Conecte a Evolution API primeiro nas Configurações');
      return;
    }

    if (selectedInstances.length === 0) {
      toast.error('Selecione pelo menos uma instância para enviar mensagens');
      return;
    }

    const url = getWebhookUrl();

    try {
      if (enabled) {
        for (const instanceName of selectedInstances) {
          await setWebhook(creds, instanceName, url);
        }
        toast.success('Webhook configurado! Mensagens serão recebidas.');
      } else {
        for (const instanceName of selectedInstances) {
          await removeWebhook(creds, instanceName);
        }
        toast.info('Webhook removido.');
      }
      setWebhookStatus(enabled ? 'enabled' : 'disabled');
    } catch (error: any) {
      toast.error(`Erro ao configurar webhook: ${error.message}`);
      setWebhookStatus('error');
      return;
    }

    onChange({ ...config, enabled });
  };

  const update = (partial: Partial<FollowUpConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <div className="space-y-4">
      {/* Enable Toggle */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between gap-4">
<div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Follow-up Inteligente</p>
                <p className="text-sm text-muted-foreground">
                  Envie saudação primeiro e aguarde resposta antes de continuar
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {webhookStatus === 'checking' && (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              )}
              {webhookStatus === 'enabled' && (
                <span className="text-xs text-success flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> Webhook ativo
                </span>
              )}
              {webhookStatus === 'error' && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <WifiOff className="w-3 h-3" /> Erro webhook
                </span>
              )}
              <button
                onClick={() => handleToggle(!config.enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  config.enabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${config.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
        </div>
      </div>

      {config.enabled && (
        <div className="space-y-4 animate-fade-in">
          {/* Mode Selection */}
          <div className="glass-card p-6 space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Modo de Follow-up
            </h4>

            <div className="grid gap-3">
              <button
                onClick={() => update({ mode: 'greeting-then-all' })}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  config.mode === 'greeting-then-all'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Zap className={`w-5 h-5 shrink-0 mt-0.5 ${config.mode === 'greeting-then-all' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium">Saudação → Resposta → Enviar Tudo</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Envia a saudação, aguarda resposta do contato, depois envia todas as mensagens restantes automaticamente.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => update({ mode: 'greeting-then-one-by-one' })}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  config.mode === 'greeting-then-one-by-one'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Reply className={`w-5 h-5 shrink-0 mt-0.5 ${config.mode === 'greeting-then-one-by-one' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium">Saudação → Resposta → Uma por Vez</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Envia a saudação, aguarda resposta, envia a próxima, aguarda resposta novamente, e assim por diante.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Greeting Message Selection */}
          {messages.length > 1 && (
            <div className="glass-card p-6 space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Mensagem de Saudação
              </h4>
              <select
                value={config.greetingMessageIndex}
                onChange={(e) => update({ greetingMessageIndex: parseInt(e.target.value) })}
                className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {messages.map((msg, i) => (
                  <option key={msg.id} value={i}>
                    Mensagem {i + 1}: {msg.content.substring(0, 60)}...
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Timeout & Retries */}
          <div className="glass-card p-6 space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Tempo de Espera
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Aguardar resposta (minutos)</label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={config.waitForReplyTimeout}
                  onChange={(e) => update({ waitForReplyTimeout: parseInt(e.target.value) || 30 })}
                  className="w-full px-4 py-2 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Tentativas de reenvio</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={config.maxRetries}
                  onChange={(e) => update({ maxRetries: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {config.maxRetries > 0 && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Intervalo entre tentativas (minutos)</label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={config.retryInterval}
                  onChange={(e) => update({ retryInterval: parseInt(e.target.value) || 60 })}
                  className="w-full px-4 py-2 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            )}
          </div>

          {/* Flow Preview */}
          <div className="glass-card p-6 space-y-3">
            <h4 className="text-sm font-medium">Fluxo Visual</h4>
            <div className="flex flex-col gap-2">
              <FlowStep icon={<MessageSquare className="w-4 h-4" />} label="Enviar Saudação" color="text-primary" />
              <FlowArrow />
              <FlowStep icon={<Clock className="w-4 h-4" />} label={`Aguardar resposta (até ${config.waitForReplyTimeout}min)`} color="text-warning" />
              <FlowArrow />
              <FlowStep icon={<CheckCircle2 className="w-4 h-4" />} label="Resposta recebida" color="text-success" />
              <FlowArrow />
              <FlowStep
                icon={<MessageSquare className="w-4 h-4" />}
                label={config.mode === 'greeting-then-all' ? 'Enviar todas as mensagens restantes' : 'Enviar próxima mensagem e aguardar'}
                color="text-primary"
              />
              {config.maxRetries > 0 && (
                <>
                  <FlowArrow dashed />
                  <FlowStep icon={<Reply className="w-4 h-4" />} label={`Sem resposta? Retentar ${config.maxRetries}x`} color="text-destructive" />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FlowStep({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30 ${color}`}>
      {icon}
      <span className="text-sm">{label}</span>
    </div>
  );
}

function FlowArrow({ dashed }: { dashed?: boolean }) {
  return (
    <div className="flex justify-center">
      <div className={`w-px h-6 ${dashed ? 'border-l-2 border-dashed border-muted-foreground/30' : 'bg-border'}`} />
    </div>
  );
}
