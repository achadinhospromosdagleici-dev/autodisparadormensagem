import {
  sendText as wuzapiSendText,
  sendImage as wuzapiSendImage,
  sendAudio as wuzapiSendAudio,
  sendVideo as wuzapiSendVideo,
  sendDocument as wuzapiSendDocument,
  sendTemplate as wuzapiSendTemplate,
  sendContact as wuzapiSendContact,
  getWuzapiInstanceCredentials,
  WuzapiButton,
} from './wuzapi';
import { downloadMediaAsBase64 } from './mediaHandler';

interface MessageButton {
  id: string;
  type: 'reply' | 'url' | 'phone' | 'copy';
  label: string;
  value?: string;
}

interface Contact {
  nome?: string;
  phone?: string;
  [key: string]: string | undefined;
}

interface CampaignMessage {
  content: string;
  mediaType?: 'text' | 'image' | 'audio' | 'video' | 'document' | 'buttons' | 'link' | 'list' | 'carousel' | 'contact';
  mediaUrl?: string;
  mediaCaption?: string;
  mediaFilename?: string;
  linkUrl?: string;
  btnTitle?: string;
  btnFooter?: string;
  title?: string;
  footer?: string;
  buttons?: MessageButton[];
}

function replaceVariables(text: string, contact: Contact): string {
  if (!text || !contact) return text;
  
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key === 'primeiro_nome' && contact.nome) {
      return contact.nome.split(' ')[0];
    }
    return contact[key] !== undefined ? String(contact[key]) : match;
  });
}

function convertToWuzapiButtons(buttons: MessageButton[], contact?: Contact): WuzapiButton[] {
  return buttons.map(b => {
    const label = contact ? replaceVariables(b.label, contact) : b.label;
    const value = b.value ? (contact ? replaceVariables(b.value, contact) : b.value) : '';
    
    switch (b.type) {
      case 'url':
        return { DisplayText: label, Type: 'url' as const, Url: value };
      case 'phone':
        return { DisplayText: label, Type: 'call' as const, PhoneNumber: value.replace(/\D/g, '') };
      case 'copy':
        return { DisplayText: label, Type: 'quickreply' as const };
      case 'reply':
      default:
        return { DisplayText: label, Type: 'quickreply' as const };
    }
  });
}

function generateVcard(name: string, contact: Contact): string {
  const phone = contact.phone?.replace(/\D/g, '') || '';
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${name};;;`,
    `FN:${name}`,
    phone ? `TEL;TYPE=CELL:${phone}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\n');
  
  return vcard;
}

export async function sendWuzapiMessage(
  senderName: string,
  to: string,
  msg: CampaignMessage,
  contact: Contact
): Promise<void> {
  const instanceId = senderName.replace(/^wuz_/, '');
  const creds = await getWuzapiInstanceCredentials(instanceId);
  if (!creds) {
    throw new Error(`WuzAPI instance not found: ${senderName}`);
  }
  
  const { baseUrl, userToken } = creds;
  const personalizedContent = replaceVariables(msg.content, contact);
  const personalizedCaption = msg.mediaCaption 
    ? replaceVariables(msg.mediaCaption, contact) 
    : undefined;
  
  switch (msg.mediaType) {
    case 'text':
    case undefined:
    case 'link':
      if (msg.mediaType === 'link' && msg.linkUrl) {
        await wuzapiSendText(
          baseUrl,
          userToken,
          to,
          `${personalizedContent}\n\n${msg.linkUrl}`
        );
      } else {
        await wuzapiSendText(baseUrl, userToken, to, personalizedContent);
      }
      break;
      
    case 'image':
      if (msg.mediaUrl) {
        const imageData = await downloadMediaAsBase64(msg.mediaUrl);
        await wuzapiSendImage(baseUrl, userToken, to, imageData, personalizedCaption);
      }
      break;
      
    case 'audio':
      if (msg.mediaUrl) {
        const audioData = await downloadMediaAsBase64(msg.mediaUrl);
        await wuzapiSendAudio(baseUrl, userToken, to, audioData);
      }
      break;
      
    case 'video':
      if (msg.mediaUrl) {
        const videoData = await downloadMediaAsBase64(msg.mediaUrl);
        await wuzapiSendVideo(baseUrl, userToken, to, videoData, personalizedCaption);
      }
      break;
      
    case 'document':
      if (msg.mediaUrl) {
        const docData = await downloadMediaAsBase64(msg.mediaUrl);
        await wuzapiSendDocument(
          baseUrl,
          userToken,
          to,
          docData,
          msg.mediaFilename || 'documento',
          personalizedCaption
        );
      }
      break;
      
    case 'buttons':
      if (msg.buttons && msg.buttons.length > 0) {
        const wuzapiButtons = convertToWuzapiButtons(msg.buttons, contact);
        await wuzapiSendTemplate(
          baseUrl,
          userToken,
          to,
          personalizedContent,
          wuzapiButtons,
          msg.footer,
          msg.title
        );
      }
      break;
      
    case 'contact':
      if (msg.btnTitle) {
        const vcard = generateVcard(replaceVariables(msg.btnTitle, contact), contact);
        await wuzapiSendContact(baseUrl, userToken, to, msg.btnTitle, vcard);
      }
      break;
      
    default:
      console.warn('[wuzapi-sender] Unsupported message type:', msg.mediaType);
  }
}