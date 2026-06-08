import React, { useState, useRef, useEffect } from 'react';
import { useWizard } from '@/contexts/WizardContext';
import { SendProgress } from '@/services/campaignSender';
import { CampaignScheduler } from '../CampaignScheduler';
import { campaignService } from '@/services/campaignService';
import {
  Users,
  MessageSquare,
  Smartphone,
  Clock,
  Sparkles,
  CheckCircle2,
  Send,
  Loader2,
  StopCircle,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

interface StepConfirmationProps {
  onCampaignStarted?: () => void;
}

export function StepConfirmation({ onCampaignStarted }: StepConfirmationProps = {}) {
  const {
    data, messages, instances, selectedInstances, settings,
    getValidCount,
    followUpConfig, scheduledCampaigns, addScheduledCampaign,
    addActiveCampaign, updateActiveCampaign, clearWizard,
  } = useWizard();
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [serverCampaignId, setServerCampaignId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const validContacts = getValidCount();
  const validData = Array.isArray(data) ? data.filter(r => r.isValid) : [];
  const selectedInstancesData = Array.isArray(instances) ? instances.filter(i => selectedInstances.includes(i.id)) : [];

  useEffect(() => {
    if (serverCampaignId && isSending) {
      pollRef.current = setInterval(async () => {
        try {
          const c = await campaignService.getById(serverCampaignId);
          setProgress(prev => ({
            ...prev || { current: 0, total: c.totalContacts, percent: 0, status: 'sending', sent: 0, failed: 0, replied: 0, errors: [], log: [] },
            current: c.sentCount + c.failedCount,
            total: c.totalContacts,
            percent: c.totalContacts > 0 ? Math.round(((c.sentCount + c.failedCount) / c.totalContacts) * 100) : 0,
            sent: c.sentCount,
            failed: c.failedCount,
            replied: c.repliedCount,
            status: c.status === 'COMPLETED' ? 'completed' : c.status === 'FAILED' ? 'error' : c.status === 'PAUSED' ? 'paused' : 'sending',
          }));
          if (c.status === 'COMPLETED' || c.status === 'CANCELLED' || c.status === 'FAILED') {
            if (pollRef.current) clearInterval(pollRef.current);
            setIsSending(false);
          }
        } catch { /* ignore polling errors */ }
      }, 2000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [serverCampaignId, isSending]);

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
    if (selectedInstances.length === 0) { toast.error('Selecione ao menos um número remetente!'); return; }
    if (validContacts === 0) { toast.error('Nenhum contato válido para envio'); return; }
    if (messages.length === 0) { toast.error('Configure ao menos uma mensagem'); return; }

    const campaignName = `Campanha ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    setIsSending(true);
    setProgress({
      current: 0, total: validContacts, percent: 0, status: 'sending',
      sent: 0, failed: 0, replied: 0, errors: [], log: [],
    });

    const contactsData = validData.map(row => {
      const obj: Record<string, any> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'id' && key !== 'isValid' && key !== 'errorMessage') obj[key] = row[key];
      });
      return obj;
    });

    try {
      const response = await campaignService.create({
        name: campaignName,
        contacts: contactsData.map(c => ({
          phone: String(c.numero || c.phone || '').replace(/\D/g, ''),
          name: c.nome || c.name || '',
        })),
        config: {
          content: messages[0]?.content || '',
          messageType: (messages[0] as any)?.mediaType || 'TEXT',
          mediaUrl: (messages[0] as any)?.mediaUrl,
          mediaCaption: (messages[0] as any)?.mediaCaption,
          mediaFilename: (messages[0] as any)?.mediaFilename,
          delayBetween: settings.intervalType === 'fixed' ? settings.fixedInterval * 1000 : settings.minInterval * 1000,
          maxRetries: 3,
        },
      });

      setServerCampaignId(response.id);

      addActiveCampaign({
        id: response.id,
        name: campaignName,
        status: 'running',
        totalContacts: validContacts,
        sentCount: 0, failedCount: 0, repliedCount: 0,
        createdAt: new Date(),
        snapshot: {
          contacts: contactsData,
          messages: messages.map(m => ({
            content: m.content,
            mediaType: (m as any).mediaType,
            mediaUrl: (m as any).mediaUrl,
            mediaCaption: (m as any).mediaCaption,
            mediaFilename: (m as any).mediaFilename,
          })),
          settings: { ...settings },
          selectedInstances: [...selectedInstances],
          followUpConfig: JSON.parse(JSON.stringify(followUpConfig)),
        },
      });

      toast.success('Campanha iniciada no servidor');
    } catch (err: any) {
      setIsSending(false);
      toast.error(`Erro ao iniciar campanha: ${err.message}`);
      return;
    }

    clearWizard();
    onCampaignStarted?.();
  };

  const handleStop = async () => {
    if (serverCampaignId) {
      try {
        await campaignService.pause(serverCampaignId);
        toast.warning('Campanha pausada no servidor');
      } catch { toast.error('Erro ao pausar'); }
    }
    abortRef.current?.abort();
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
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-muted-foreground">Mensagem {i + 1}</p>
                    {(msg as any).mediaType && (msg as any).mediaType !== 'text' && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {(msg as any).mediaType === 'image' ? '🖼️' : (msg as any).mediaType === 'audio' ? '🎵' : (msg as any).mediaType === 'video' ? '📹' : '📄'} {(msg as any).mediaType}
                      </span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap line-clamp-3">{msg.content}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">Nenhuma mensagem configurada</p>}
            </div>
          </div>



          {/* Live Progress */}
          {progress && (isSending || progress.status === 'completed') && (
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
                  <p className="text-sm text-muted-foreground">{progress.sent} enviadas, {progress.failed} falhas</p>
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
              <>
                <button onClick={handleStartSending}
                  disabled={validContacts === 0 || messages.length === 0 || selectedInstances.length === 0}
                  className={`flex-1 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${
                    validContacts === 0 || messages.length === 0 || selectedInstances.length === 0
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90 glow-effect'
                  }`}>
                  <Send className="w-5 h-5" /> Enviar Agora
                </button>
                <button onClick={() => setIsScheduling(true)}
                  disabled={validContacts === 0 || messages.length === 0 || selectedInstances.length === 0}
                  className={`flex-1 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${
                    validContacts === 0 || messages.length === 0 || selectedInstances.length === 0
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-muted text-foreground hover:bg-muted/80 border border-border'
                  }`}>
                  <Calendar className="w-5 h-5" /> Agendar
                </button>
              </>
            )}
          </div>

          {/* Scheduling Form */}
          {isScheduling && (
            <div className="space-y-4">
              <CampaignScheduler
                scheduledCampaigns={scheduledCampaigns}
                onSchedule={(c) => {
                  addScheduledCampaign({ ...c, id: crypto.randomUUID(), status: 'scheduled' });
                  setIsScheduling(false);
                  clearWizard();
                  onCampaignStarted?.();
                }}
                onCancel={(id) => {}}
                contactCount={validContacts}
                messageCount={messages.length}
              />
            </div>
          )}

          {selectedInstances.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">Volte e selecione ao menos um número remetente</p>
          )}
    </div>
  );
}
