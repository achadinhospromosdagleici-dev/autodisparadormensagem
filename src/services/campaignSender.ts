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
  mediaType?: 'text' | 'image' | 'audio' | 'video' | 'document';
  mediaUrl?: string;
  mediaCaption?: string;
  mediaFilename?: string;
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

  // Determine API source from first selected instance
  const source = getInstanceSource(selectedPhoneNumbers[0]);
  const unoCreds = loadUnoApiCredentials();
  const evoCreds = loadEvolutionCredentials();

  if (source === 'unoapi' && !unoCreds) throw new Error('Credenciais da UnoAPI não configuradas');
  if (source === 'evolution' && !evoCreds) throw new Error('Credenciais da Evolution API não configuradas');

  addLog(`🚀 Iniciando campanha via ${source === 'evolution' ? 'Evolution API' : 'UnoAPI'}...`, 'info');

  // For Evolution: validate all instances are connected before starting
  if (source === 'evolution' && evoCreds) {
    for (const instId of selectedPhoneNumbers) {
      const instName = getInstanceName(instId);
      try {
        const status = await getInstanceStatus(evoCreds, instName);
        if (!status.connected) {
          addLog(`⚠️ Instância "${instName}" não está conectada. Reconecte antes de enviar.`, 'warning');
          progress.status = 'error';
          onProgress({ ...progress });
          throw new Error(`Instância "${instName}" offline. Reconecte antes de disparar.`);
        }
        addLog(`✅ Instância "${instName}" validada — conectada`, 'success');
      } catch (err: any) {
        if (err.message.includes('offline')) throw err;
        addLog(`⚠️ Erro ao validar "${instName}": ${err.message}`, 'warning');
      }
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

    const senderInstId = selectedPhoneNumbers[phoneIndex % selectedPhoneNumbers.length];
    const senderName = getInstanceName(senderInstId);
    phoneIndex++;

    progress.current = i + 1;
    progress.percent = Math.round(((i + 1) / contacts.length) * 100);
    progress.currentContact = contactName;

    addLog(`📤 Enviando para ${contactName} (${phoneNumber}) via ${senderName}...`);

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
          };
          await sendEvoMessage(evoCreds, senderName, phoneNumber, evoMsg);
        } else if (unoCreds) {
          // UnoAPI sending
          const unoMsg: UnoApiMessage = { content: personalizedContent };
          if (msg.mediaType && msg.mediaType !== 'text' && msg.mediaUrl) {
            unoMsg.media = {
              type: msg.mediaType,
              url: msg.mediaUrl,
              caption: personalizedCaption || personalizedContent,
              filename: msg.mediaFilename,
            };
          }
          await sendUnoApiMessage(unoCreds, senderName, phoneNumber, unoMsg);
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
