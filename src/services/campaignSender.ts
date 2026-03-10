// Campaign Sender Service
// Real message sending via Chatwoot API with progress tracking and response detection

import {
  ChatwootCredentials,
  loadChatwootCredentials,
  searchContact,
  createContact,
  createConversation,
  sendMessage,
  getContactConversations,
  checkForReply,
} from './chatwoot';
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
    return contact[key] || contact[key.toLowerCase()] || `{{${key}}}`;
  });
}

export async function sendCampaign(
  contacts: Record<string, any>[],
  messages: string[],
  inboxId: number,
  settings: {
    intervalType: 'fixed' | 'random';
    fixedInterval: number;
    minInterval: number;
    maxInterval: number;
    sendType: 'single' | 'multiple';
  },
  followUpConfig: FollowUpConfig,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal,
): Promise<SendProgress> {
  const creds = loadChatwootCredentials();
  if (!creds) throw new Error('Credenciais do Chatwoot não configuradas');

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

  addLog('🚀 Iniciando campanha de envio...', 'info');

  for (let i = 0; i < contacts.length; i++) {
    if (abortSignal?.aborted) {
      progress.status = 'paused';
      addLog('⏸️ Campanha pausada pelo usuário', 'warning');
      return progress;
    }

    const contact = contacts[i];
    const phoneNumber = contact.numero || contact.phone || '';
    const contactName = contact.nome || contact.name || phoneNumber;
    progress.current = i + 1;
    progress.percent = Math.round(((i + 1) / contacts.length) * 100);
    progress.currentContact = contactName;

    addLog(`📤 Processando ${contactName} (${phoneNumber})...`);

    try {
      // 1. Search or create contact
      let chatwootContact = await searchContact(creds, phoneNumber);
      if (!chatwootContact) {
        chatwootContact = await createContact(creds, contactName, phoneNumber, inboxId);
        addLog(`👤 Contato criado: ${contactName}`, 'info');
      }

      // 2. Find or create conversation
      let conversationId: number;
      const existingConversations = await getContactConversations(creds, chatwootContact.id);
      const inboxConversation = existingConversations.find(c => c.inbox_id === inboxId);
      
      if (inboxConversation) {
        conversationId = inboxConversation.id;
      } else {
        const newConversation = await createConversation(creds, chatwootContact.id, inboxId);
        conversationId = newConversation.id;
      }

      // 3. Determine which messages to send
      if (followUpConfig.enabled) {
        // Follow-up mode: send greeting first
        const greetingIndex = followUpConfig.greetingMessageIndex || 0;
        const greetingMsg = messages[greetingIndex] || messages[0];
        const personalizedGreeting = replaceVariables(greetingMsg, contact);

        await sendMessage(creds, conversationId, personalizedGreeting);
        addLog(`✅ Saudação enviada para ${contactName}`, 'success');
        progress.sent++;
        onProgress({ ...progress });

        // Wait for reply
        if (messages.length > 1) {
          progress.status = 'waiting_reply';
          addLog(`⏳ Aguardando resposta de ${contactName}...`, 'info');
          onProgress({ ...progress });

          const sentTimestamp = Math.floor(Date.now() / 1000);
          let hasReply = false;
          let retries = 0;

          // Poll for reply
          const checkInterval = 10000; // 10 seconds
          const maxWaitMs = followUpConfig.waitForReplyTimeout * 60 * 1000;
          const startWait = Date.now();

          while (!hasReply && (Date.now() - startWait) < maxWaitMs) {
            if (abortSignal?.aborted) break;
            await delay(checkInterval);
            hasReply = await checkForReply(creds, conversationId, sentTimestamp);
          }

          if (hasReply) {
            progress.replied++;
            addLog(`💬 ${contactName} respondeu!`, 'success');
            progress.status = 'follow_up';
            onProgress({ ...progress });

            // Send follow-up messages
            const followUpMessages = messages.filter((_, idx) => idx !== greetingIndex);
            
            if (followUpConfig.mode === 'greeting-then-all') {
              // Send all remaining messages
              for (const msg of followUpMessages) {
                const personalized = replaceVariables(msg, contact);
                await sendMessage(creds, conversationId, personalized);
                progress.sent++;
                addLog(`✅ Follow-up enviado para ${contactName}`, 'success');
                await delay(2000);
              }
            } else {
              // One-by-one mode: send next, wait for reply, repeat
              for (const msg of followUpMessages) {
                const personalized = replaceVariables(msg, contact);
                await sendMessage(creds, conversationId, personalized);
                progress.sent++;
                addLog(`✅ Follow-up enviado para ${contactName}`, 'success');
                
                // Wait for reply before next
                const msgTimestamp = Math.floor(Date.now() / 1000);
                let replied = false;
                const startMsgWait = Date.now();
                while (!replied && (Date.now() - startMsgWait) < maxWaitMs) {
                  if (abortSignal?.aborted) break;
                  await delay(checkInterval);
                  replied = await checkForReply(creds, conversationId, msgTimestamp);
                }
                if (!replied) {
                  addLog(`⏰ Timeout: ${contactName} não respondeu ao follow-up`, 'warning');
                  break;
                }
                progress.replied++;
              }
            }
          } else if (retries < followUpConfig.maxRetries) {
            addLog(`⏰ Timeout: ${contactName} não respondeu. Tentativa ${retries + 1}/${followUpConfig.maxRetries}`, 'warning');
          } else {
            addLog(`⏰ ${contactName} não respondeu após timeout`, 'warning');
          }
        }

        progress.status = 'sending';
      } else {
        // Normal mode: send all messages
        const messagesToSend = settings.sendType === 'single' ? [messages[0]] : messages;
        
        for (const msg of messagesToSend) {
          const personalized = replaceVariables(msg, contact);
          await sendMessage(creds, conversationId, personalized);
          progress.sent++;
          addLog(`✅ Mensagem enviada para ${contactName}`, 'success');
          
          if (messagesToSend.length > 1) await delay(2000);
        }
      }

      onProgress({ ...progress });
    } catch (err: any) {
      progress.failed++;
      const errorMsg = err.message || 'Erro desconhecido';
      progress.errors.push({ contact: contactName, error: errorMsg });
      addLog(`❌ Erro com ${contactName}: ${errorMsg}`, 'error');
      onProgress({ ...progress });
    }

    // Wait interval before next contact
    if (i < contacts.length - 1) {
      const waitTime = settings.intervalType === 'fixed'
        ? settings.fixedInterval * 1000
        : getRandomInterval(settings.minInterval, settings.maxInterval);
      
      addLog(`⏱️ Aguardando ${Math.round(waitTime / 1000)}s antes do próximo...`, 'info');
      await delay(waitTime);
    }
  }

  progress.status = 'completed';
  addLog(`🎉 Campanha finalizada! ${progress.sent} enviadas, ${progress.failed} falhas, ${progress.replied} respostas`, 'success');
  onProgress({ ...progress });
  return progress;
}
