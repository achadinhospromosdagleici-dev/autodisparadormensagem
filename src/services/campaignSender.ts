// Campaign Sender Service
// Supports both UnoAPI and Evolution API with progress tracking

import {
  loadUnoApiCredentials,
  sendUnoApiMessage,
  UnoApiMessage,
} from './unoapi';
import {
  loadEvolutionCredentials,
  sendMessage as sendEvoMessage,
  getInstanceStatus,
  EvolutionMessage,
} from './evolution';
import { FollowUpConfig } from '@/components/wizard/FollowUpSettings';

export interface SendProgress {
  current: number;
  total: number;
  percent: number;
  status: 'idle' | 'sending' | 'waiting_reply' | 'follow_up' | 'completed' | 'error' | 'paused';
  currentContact?: string;
  sent: number;
  failed: number;
  replied: number;
  errors: { contact: string; error: string }[];
  log: { time: Date; message: string; type: 'info' | 'success' | 'error' | 'warning' }[];
}

export type ProgressCallback = (progress: SendProgress) => void;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomInterval(min: number, max: number): number {
  return (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
}

function replaceVariables(template: string, contact: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    // Handle special {{primeiro_nome}} variable - extract first name from 'nome'
    if (key.toLowerCase() === 'primeiro_nome') {
      const nome = contact.nome || contact.Nome || contact.NOME || '';
      const primeiro = String(nome).trim().split(/\s+/)[0];
      return primeiro || `{{${key}}}`;
    }
    return contact[key] || contact[key.toLowerCase()] || `{{${key}}}`;
  });
}

export interface CampaignMessage {
  content: string;
  mediaType?: 'text' | 'image' | 'audio' | 'video' | 'document' | 'buttons' | 'link';
  mediaUrl?: string;
  mediaCaption?: string;
  mediaFilename?: string;
  // Para tipo 'buttons'
  title?: string;
  footer?: string;
  buttons?: { id: string; type: 'url' | 'phone' | 'reply'; label: string; value: string }[];
  // Para tipo 'link'
  linkUrl?: string;
}

// Detect which API to use based on selected instance ID prefix
function getInstanceSource(instanceId: string): 'evolution' | 'unoapi' | 'default' {
  if (instanceId.startsWith('evo_')) return 'evolution';
  if (instanceId.startsWith('uno_')) return 'unoapi';
  return 'default';
}

function getInstanceName(instanceId: string): string {
  if (instanceId.startsWith('evo_')) return instanceId.slice(4);
  if (instanceId.startsWith('uno_')) return instanceId.slice(4);
  return instanceId;
}

export async function sendCampaign(
  contacts: Record<string, any>[],
  messages: CampaignMessage[],
  settings: {
    intervalType: 'fixed' | 'random';
    fixedInterval: number;
    minInterval: number;
    maxInterval: number;
    sendType: 'single' | 'multiple';
  },
  selectedPhoneNumbers: string[],
  followUpConfig: FollowUpConfig,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal,
): Promise<SendProgress> {
  if (selectedPhoneNumbers.length === 0) throw new Error('Nenhum número remetente selecionado');

  const unoCredsEarly = loadUnoApiCredentials();
  const evoCredsEarly = loadEvolutionCredentials();

  // Filter out instances that have no matching API credentials.
  // Instances without prefix ('default') are kept ONLY if creds for the resolved API exist.
  const validInstances = selectedPhoneNumbers.filter(id => {
    const src = getInstanceSource(id);
    if (src === 'evolution') return !!evoCredsEarly;
    if (src === 'unoapi') return !!unoCredsEarly;
    // default → use whichever API is configured
    return !!evoCredsEarly || !!unoCredsEarly;
  });

  if (validInstances.length === 0) {
    throw new Error('Nenhuma instância válida com credenciais de API configuradas');
  }

  const progress: SendProgress = {
    current: 0,
    total: contacts.length,
    percent: 0,
    status: 'sending',
    sent: 0,
    failed: 0,
    replied: 0,
    errors: [],
    log: [],
  };

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    progress.log.push({ time: new Date(), message, type });
    onProgress({ ...progress });
  };

  const unoCreds = unoCredsEarly;
  const evoCreds = evoCredsEarly;

  // Resolve API source per-instance (default → evolution if available, else unoapi)
  const resolveSource = (id: string): 'evolution' | 'unoapi' => {
    const s = getInstanceSource(id);
    if (s === 'evolution') return 'evolution';
    if (s === 'unoapi') return 'unoapi';
    return evoCreds ? 'evolution' : 'unoapi';
  };

  if (validInstances.length < selectedPhoneNumbers.length) {
    addLog(`⚠️ ${selectedPhoneNumbers.length - validInstances.length} instância(s) ignorada(s) (sem credenciais)`, 'warning');
  }

  const primarySource = resolveSource(validInstances[0]);
  addLog(`🚀 Iniciando campanha via ${primarySource === 'evolution' ? 'Evolution API' : 'UnoAPI'}...`, 'info');

  // For Evolution: validate all instances (non-blocking — warn but continue)
  if (evoCreds) {
    let anyConnected = false;
    const evoInstances = validInstances.filter(id => resolveSource(id) === 'evolution');
    for (const instId of evoInstances) {
      const instName = getInstanceName(instId);
      try {
        const status = await getInstanceStatus(evoCreds, instName);
        if (status.connected) {
          anyConnected = true;
          addLog(`✅ Instância "${instName}" conectada (status: ${status.status})`, 'success');
        } else {
          addLog(`⚠️ Instância "${instName}" status: ${status.status} — tentaremos enviar mesmo assim`, 'warning');
        }
      } catch (err: any) {
        addLog(`⚠️ Não foi possível validar "${instName}": ${err.message}`, 'warning');
        anyConnected = true; // assume ok if validation itself failed
      }
    }
    if (evoInstances.length > 0 && !anyConnected) {
      addLog('⚠️ Nenhuma instância confirmada como conectada. Continuando, mas envios podem falhar.', 'warning');
    }
  }

  let phoneIndex = 0;

  for (let i = 0; i < contacts.length; i++) {
    if (abortSignal?.aborted) {
      progress.status = 'paused';
      addLog('⏸️ Campanha pausada pelo usuário', 'warning');
      return progress;
    }

    const contact = contacts[i];
    const phoneNumber = contact.numero || contact.phone || '';
    const contactName = contact.nome || contact.name || phoneNumber;

    const senderInstId = validInstances[phoneIndex % validInstances.length];
    const senderName = getInstanceName(senderInstId);
    const source = resolveSource(senderInstId);
    phoneIndex++;

    progress.current = i + 1;
    progress.percent = Math.round(((i + 1) / contacts.length) * 100);
    progress.currentContact = contactName;

    addLog(`📤 Enviando para ${contactName} (${phoneNumber}) via ${senderName} [${source}]...`);

    try {
      const messagesToSend = settings.sendType === 'single' ? [messages[0]] : messages;

      for (const msg of messagesToSend) {
        const personalizedContent = replaceVariables(msg.content, contact);
        const personalizedCaption = msg.mediaCaption ? replaceVariables(msg.mediaCaption, contact) : undefined;

        if (source === 'evolution' && evoCreds) {
          // Evolution API sending
          const evoMsg: EvolutionMessage = {
            type: msg.mediaType || 'text',
            content: personalizedContent,
            mediaUrl: msg.mediaUrl,
            caption: personalizedCaption || personalizedContent,
            filename: msg.mediaFilename,
            title: msg.title,
            footer: msg.footer,
            buttons: msg.buttons?.map(b => ({ type: b.type, label: b.label, value: b.value })),
            linkUrl: msg.linkUrl,
          };
          const result = await sendEvoMessage(evoCreds, senderName, phoneNumber, evoMsg);
          console.log('[campaignSender] Evolution send result:', result);
        } else if (source === 'unoapi' && unoCreds) {
          // UnoAPI sending
          console.log('[campaignSender] Sending via UnoAPI:', {
            senderName,
            phoneNumber,
            unoApiUrl: unoCreds.baseUrl
          });
          const unoMsg: UnoApiMessage = { content: personalizedContent };
          
          if (msg.mediaType === 'buttons') {
            // UnoAPI interactive buttons (texto puro com botões)
            const buttonsToSend = msg.buttons?.map(b => ({
              id: b.id,
              title: b.label,
              url: b.type === 'url' ? b.value : undefined
            })) || [];
            unoMsg.buttons = buttonsToSend;
            if (msg.title) unoMsg.header = msg.title;
            if (msg.footer) unoMsg.footer = msg.footer;
            await sendUnoApiMessage(unoCreds, senderName, phoneNumber, unoMsg);
          } else if (msg.mediaType === 'link' && msg.linkUrl) {
            // Link message - send as text with URL
            const linkText = msg.linkUrl
              ? `${personalizedContent}\n\n${msg.linkUrl}`
              : personalizedContent;
            await sendUnoApiMessage(unoCreds, senderName, phoneNumber, { content: linkText });
          } else if (msg.mediaType && msg.mediaType !== 'text' && msg.mediaUrl) {
            const mt = msg.mediaType as 'image' | 'audio' | 'video' | 'document';
            const hasButtons = msg.buttons && msg.buttons.length > 0;

            if (hasButtons && (mt === 'image' || mt === 'video' || mt === 'document')) {
              // Mídia + botões → interactive com header de mídia
              const { sendInteractiveButtons } = await import('./unoapi');
              await sendInteractiveButtons(
                unoCreds,
                senderName,
                phoneNumber,
                personalizedCaption || personalizedContent,
                msg.buttons!.map(b => ({
                  id: b.id,
                  title: b.label,
                  url: b.type === 'url' ? b.value : undefined
                })),
                undefined,
                msg.footer,
                { type: mt, url: msg.mediaUrl, filename: msg.mediaFilename },
              );
            } else {
              // Mídia simples (sem botões) ou áudio
              unoMsg.media = {
                type: mt,
                url: msg.mediaUrl,
                caption: personalizedCaption || personalizedContent,
                filename: msg.mediaFilename,
              };
              await sendUnoApiMessage(unoCreds, senderName, phoneNumber, unoMsg);
            }
          } else {
            // Text only
            await sendUnoApiMessage(unoCreds, senderName, phoneNumber, unoMsg);
          }
        } else {
          throw new Error(`Nenhuma API disponível para a instância "${senderName}"`);
        }

        progress.sent++;
        const mediaLabel = msg.mediaType && msg.mediaType !== 'text' ? ` (${msg.mediaType})` : '';
        addLog(`✅ Mensagem${mediaLabel} enviada para ${contactName}`, 'success');

        if (messagesToSend.length > 1) await delay(2000);
      }

      onProgress({ ...progress });
    } catch (err: any) {
      progress.failed++;
      const errorMsg = err.message || 'Erro desconhecido';
      progress.errors.push({ contact: contactName, error: errorMsg });

      // Handle Evolution reconnect suggestion
      if (errorMsg.includes('não está conectada') || errorMsg.includes('reconnect')) {
        addLog(`🔌 ${contactName}: Instância offline — sugerindo reconexão`, 'error');
      } else {
        addLog(`❌ Erro com ${contactName}: ${errorMsg}`, 'error');
      }
      onProgress({ ...progress });
    }

    // Interval
    if (i < contacts.length - 1) {
      const waitTime = settings.intervalType === 'fixed'
        ? settings.fixedInterval * 1000
        : getRandomInterval(settings.minInterval, settings.maxInterval);
      addLog(`⏱️ Aguardando ${Math.round(waitTime / 1000)}s antes do próximo...`, 'info');
      await delay(waitTime);
    }
  }

  progress.status = 'completed';
  addLog(`🎉 Campanha finalizada! ${progress.sent} enviadas, ${progress.failed} falhas`, 'success');
  onProgress({ ...progress });
  return progress;
}
