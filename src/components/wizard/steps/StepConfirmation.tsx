import React, { useState, useRef } from 'react';
import { useWizard } from '@/contexts/WizardContext';
import { CampaignHistory, Campaign } from '../CampaignHistory';
import { sendCampaign, SendProgress } from '@/services/campaignSender';
import { loadChatwootCredentials } from '@/services/chatwoot';
import {
  Users,
  MessageSquare,
  Smartphone,
  Clock,
  Sparkles,
  Shuffle,
  CheckCircle2,
  Send,
  Loader2,
  AlertTriangle,
  History,
  StopCircle,
  MessageCircle,
  XCircle,
  Reply,
} from 'lucide-react';
import { toast } from 'sonner';

export function StepConfirmation() {
  const {
    data, messages, instances, selectedInstances, settings,
    getValidCount, campaignHistory, addCampaign, reuseCampaign,
    chatwootConnected, selectedInboxId, followUpConfig, updateMetrics,
  } = useWizard();
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const validContacts = getValidCount();
  const validData = data.filter(r => r.isValid);
  const selectedInstancesData = instances.filter(i => selectedInstances.includes(i.id));

  const calculateTotalTime = () => {
    const messageCount = settings.sendType === 'multiple' ? messages.length : 1;
    const totalMessages = validContacts * messageCount;
    let avgInterval = settings.intervalType === 'fixed' ? settings.fixedInterval : (settings.minInterval + settings.maxInterval) / 2;
    const totalSeconds = totalMessages * avgInterval;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return hours > 0 ? `~${hours}h ${minutes}min` : `~${minutes} minutos`;
  };

  const handleStartSending = async () => {
    if (!chatwootConnected || !selectedInboxId) {
      toast.error('Configure a conexão com o Chatwoot primeiro!');
      return;
    }

    const creds = loadChatwootCredentials();
    if (!creds) {
      toast.error('Credenciais do Chatwoot não encontradas');
      return;
    }

    setIsSending(true);
    abortRef.current = new AbortController();

    try {
      const contactsData = validData.map(row => {
        const obj: Record<string, any> = {};
        Object.keys(row).forEach(key => {
          if (key !== 'id' && key !== 'isValid' && key !== 'errorMessage') {
            obj[key] = row[key];
          }
        });
        return obj;
      });

      const result = await sendCampaign(
        contactsData,
        messages.map(m => m.content),
        selectedInboxId,
        settings,
        followUpConfig,
        (p) => setProgress({ ...p }),
        abortRef.current.signal,
      );

      // Save to history
      const newCampaign: Campaign = {
        id: crypto.randomUUID(),
        name: `Campanha ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        date: new Date(),
        totalContacts: validContacts,
        sentCount: result.sent,
        successCount: result.sent - result.failed,
        failedCount: result.failed,
        messages: messages.map(m => m.content),
        status: result.failed === 0 ? 'completed' : 'partial',
      };
      addCampaign(newCampaign);

      // Update metrics
      updateMetrics({
        totalSent: result.sent,
        totalFailed: result.failed,
        totalReplied: result.replied,
        deliveryRate: result.sent > 0 ? Math.round(((result.sent - result.failed) / result.sent) * 1000) / 10 : 0,
        replyRate: result.sent > 0 ? Math.round((result.replied / result.sent) * 1000) / 10 : 0,
        failRate: result.sent > 0 ? Math.round((result.failed / result.sent) * 1000) / 10 : 0,
      });

      toast.success(`Campanha finalizada! ${result.sent} enviadas, ${result.replied} respostas.`);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setIsSending(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    toast.warning('Campanha pausada');
  };

  const handleReuseCampaign = (campaign: Campaign) => {
    reuseCampaign(campaign);
    toast.success('Mensagens restauradas!');
    setShowHistory(false);
  };

  const summaryItems = [
    { icon: Users, label: 'Contatos Válidos', value: validContacts, color: 'text-success' },
    { icon: MessageSquare, label: 'Mensagens', value: messages.length, color: 'text-primary' },
    { icon: Smartphone, label: 'Instâncias', value: selectedInstances.length, color: 'text-primary' },
    { icon: Clock, label: 'Tempo Estimado', value: calculateTotalTime(), color: 'text-muted-foreground' },
  ];

  const statusLabels: Record<string, string> = {
    idle: 'Aguardando',
    sending: 'Enviando...',
    waiting_reply: 'Aguardando resposta...',
    follow_up: 'Enviando follow-up...',
    completed: 'Concluído!',
    error: 'Erro',
    paused: 'Pausado',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Toggle */}
      <div className="flex gap-2">
        <button onClick={() => setShowHistory(false)}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${!showHistory ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>
          <Send className="w-4 h-4" /> Nova Campanha
        </button>
        <button onClick={() => setShowHistory(true)}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${showHistory ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>
          <History className="w-4 h-4" /> Histórico ({campaignHistory.length})
        </button>
      </div>

      {showHistory ? (
        <CampaignHistory campaigns={campaignHistory} onReuse={handleReuseCampaign} />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryItems.map(item => (
              <div key={item.label} className="glass-card p-4 text-center">
                <item.icon className={`w-6 h-6 mx-auto mb-2 ${item.color}`} />
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Chatwoot Status */}
          <div className={`glass-card p-4 flex items-center gap-3 ${chatwootConnected ? 'border-success/30' : 'border-destructive/30'}`}>
            <MessageCircle className={`w-5 h-5 ${chatwootConnected ? 'text-success' : 'text-destructive'}`} />
            <div className="flex-1">
              <p className="text-sm font-medium">{chatwootConnected ? 'Chatwoot conectado' : 'Chatwoot não conectado'}</p>
              <p className="text-xs text-muted-foreground">
                {chatwootConnected ? `Inbox ID: ${selectedInboxId}` : 'Configure nas Configurações'}
              </p>
            </div>
            {followUpConfig.enabled && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">
                Follow-up: {followUpConfig.mode === 'greeting-then-all' ? 'Saudação → Tudo' : 'Um a um'}
              </span>
            )}
          </div>

          {/* Config Details */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-semibold">Configurações de Envio</h3>
            <div className="grid gap-3">
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Intervalo</span>
                <span className="font-medium">
                  {settings.intervalType === 'fixed' ? `${settings.fixedInterval}s` : `${settings.minInterval}-${settings.maxInterval}s`}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-medium">{settings.sendType === 'single' ? 'Mensagem única' : 'Múltiplas'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground flex items-center gap-2"><Sparkles className="w-4 h-4" /> IA</span>
                <span className={`font-medium ${settings.useAI ? 'text-success' : 'text-muted-foreground'}`}>{settings.useAI ? 'Ativada' : 'Desativada'}</span>
              </div>
            </div>
          </div>

          {/* Messages Preview */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-semibold">Mensagens</h3>
            <div className="space-y-3 max-h-48 overflow-y-auto scrollbar-thin">
              {messages.length > 0 ? messages.map((msg, i) => (
                <div key={msg.id} className="p-3 rounded-lg bg-muted/50 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">
                    {followUpConfig.enabled && i === (followUpConfig.greetingMessageIndex || 0) ? '👋 Saudação' : `Mensagem ${i + 1}`}
                  </p>
                  <p className="text-sm whitespace-pre-wrap line-clamp-3">{msg.content}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">Nenhuma mensagem configurada</p>}
            </div>
          </div>

          {/* Warning */}
          {!chatwootConnected && (
            <div className="glass-card p-4 border-destructive/30 bg-destructive/5">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-destructive shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Chatwoot não conectado</p>
                  <p className="text-sm text-muted-foreground mt-1">Vá em Configurações e conecte o Chatwoot para habilitar o envio real.</p>
                </div>
              </div>
            </div>
          )}

          {/* Live Progress */}
          {progress && isSending && (
            <div className="glass-card p-6 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="font-medium">{statusLabels[progress.status]}</span>
                </div>
                <span className="text-primary font-bold">{progress.percent}%</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress.percent}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><p className="text-lg font-bold text-success">{progress.sent}</p><p className="text-[10px] text-muted-foreground">Enviadas</p></div>
                <div><p className="text-lg font-bold text-destructive">{progress.failed}</p><p className="text-[10px] text-muted-foreground">Falhas</p></div>
                <div><p className="text-lg font-bold text-primary">{progress.replied}</p><p className="text-[10px] text-muted-foreground">Respostas</p></div>
                <div><p className="text-lg font-bold">{progress.current}/{progress.total}</p><p className="text-[10px] text-muted-foreground">Processados</p></div>
              </div>
              {progress.currentContact && (
                <p className="text-xs text-muted-foreground text-center">Atual: {progress.currentContact}</p>
              )}

              {/* Live Log */}
              <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-1 bg-muted/30 rounded-lg p-3">
                {progress.log.slice(-20).map((entry, i) => (
                  <p key={i} className={`text-xs font-mono ${
                    entry.type === 'success' ? 'text-success' :
                    entry.type === 'error' ? 'text-destructive' :
                    entry.type === 'warning' ? 'text-warning' : 'text-muted-foreground'
                  }`}>
                    <span className="opacity-50">{entry.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>{' '}
                    {entry.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Completed Summary */}
          {progress && progress.status === 'completed' && !isSending && (
            <div className="glass-card p-6 space-y-3 border-success/30 animate-fade-in">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-success" />
                <div>
                  <h3 className="font-semibold">Campanha Finalizada!</h3>
                  <p className="text-sm text-muted-foreground">{progress.sent} enviadas, {progress.failed} falhas, {progress.replied} respostas</p>
                </div>
              </div>
              {progress.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">Erros ({progress.errors.length}):</p>
                  {progress.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{e.contact}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            {isSending ? (
              <button onClick={handleStop}
                className="flex-1 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all">
                <StopCircle className="w-5 h-5" /> Parar Envio
              </button>
            ) : (
              <button onClick={handleStartSending}
                disabled={validContacts === 0 || messages.length === 0 || !chatwootConnected}
                className={`flex-1 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${
                  validContacts === 0 || messages.length === 0 || !chatwootConnected
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 glow-effect'
                }`}>
                <Send className="w-5 h-5" /> Iniciar Envio Real
              </button>
            )}
          </div>

          {!chatwootConnected && (
            <p className="text-center text-sm text-muted-foreground">Conecte o Chatwoot nas Configurações para habilitar o envio</p>
          )}
        </>
      )}
    </div>
  );
}
