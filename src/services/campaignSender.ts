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
  // Match variables with special characters (like ç, ã, etc)
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const keyLower = key.toLowerCase().trim();
    
    // Handle special {{primeiro_nome}} variable - extract first name from 'nome'
    if (keyLower === 'primeiro_nome') {
      let nomeValue = '';
      for (const k of Object.keys(contact)) {
        if (k.toLowerCase().includes('nome') && !k.toLowerCase().includes('primeiro')) {
          nomeValue = contact[k];
          break;
        }
      }
      if (nomeValue) {
        const primeiro = String(nomeValue).trim().split(/\s+/)[0];
        return primeiro || `{{${key}}`;
      }
      return `{{${key}}`;
    }
    
    // Case-insensitive and accent-insensitive search for the key
    for (const k of Object.keys(contact)) {
      const kNormalized = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const keyNormalized = keyLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (kNormalized === keyNormalized || k.toLowerCase() === keyLower) {
        return contact[k];
      }
    }
    
    // Try partial match - if key is contained in column name
    for (const k of Object.keys(contact)) {
      const kNormalized = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const keyNormalized = keyLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (kNormalized.includes(keyNormalized) || keyNormalized.includes(kNormalized)) {
        return contact[k];
      }
    }
    
    return `{{${key}}`;
  });
}

// Replace button values with contact data
function replaceButtonValue(value: string, contact: Record<string, any>): string {
  // If value contains a variable, replace it
  if (value.includes('{{')) {
    return replaceVariables(value, contact);
  }
  // If value is exactly a variable name, try to find it with accent-insensitive match
  const valueNormalized = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const k of Object.keys(contact)) {
    const kNormalized = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (kNormalized === valueNormalized) {
      return contact[k];
    }
  }
  return value;
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
            // Check if any button is URL - for Baileys, send as text with link instead of buttons
            const urlButtons = msg.buttons?.filter(b => b.type === 'url') || [];
            const phoneButtons = msg.buttons?.filter(b => b.type === 'phone') || [];
            const replyButtons = msg.buttons?.filter(b => b.type === 'reply') || [];
            
            // If has URL buttons, include link in message text (works better with Baileys)
            if (urlButtons.length > 0) {
              const linksText = urlButtons.map(b => {
                const linkUrl = replaceButtonValue(b.value, contact);
                return `🔗 ${b.label}: ${linkUrl}`;
              }).join('\n');
              unoMsg.content = `${personalizedContent}\n\n${linksText}`;
            }
            
            // Only send interactive buttons for phone and reply (URL buttons as text above)
            const interactiveButtons = msg.buttons?.map(b => {
              if (b.type === 'url') {
                return null; // Skip URL buttons, sent as text above
              } else if (b.type === 'phone') {
                const phoneValue = replaceButtonValue(b.value, contact);
                // For contact button, use button label as contact name
                const contactName = b.label || 'Contato';
                console.log('[campaignSender] Contact button:', { label: b.label, contactName, phone: phoneValue });
                return {
                  id: b.id,
                  title: b.label,
                  phone: phoneValue,
                  contactName: contactName,
                };
              } else {
                return {
                  id: b.id,
                  title: b.label,
                };
              }
            }).filter(b => b !== null) || [];
            
            if (interactiveButtons.length > 0) {
              unoMsg.buttons = interactiveButtons as Array<{ id: string; title: string; url?: string; phone?: string }>;
              if (msg.title) unoMsg.header = msg.title;
              if (msg.footer) unoMsg.footer = msg.footer;
            }
            
            await sendUnoApiMessage(unoCreds, senderName, phoneNumber, unoMsg);
          } else if (msg.mediaType === 'link' && msg.linkUrl) {
            // Link message - send as text with URL
            const linkText = msg.linkUrl
              ? `${personalizedContent}\n\n🔗 Link: ${msg.linkUrl}`
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
                  url: b.type === 'url' ? replaceButtonValue(b.value, contact) : undefined,
                  phone: b.type === 'phone' ? replaceButtonValue(b.value, contact) : undefined,
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
