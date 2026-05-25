import {
  sendText as wuzapiSendText,
  sendImage as wuzapiSendImage,
  sendAudio as wuzapiSendAudio,
  sendVideo as wuzapiSendVideo,
  sendDocument as wuzapiSendDocument,
  sendContact as wuzapiSendContact,
  sendButtons as wuzapiSendButtons,
  sendList as wuzapiSendList,
  sendSticker as wuzapiSendSticker,
  sendLocation as wuzapiSendLocation,
  sendPoll as wuzapiSendPoll,
  getWuzapiInstanceCredentials,
} from './wuzapi';
import { downloadMediaAsBase64 } from './mediaHandler';

interface MessageButton {
  id: string;
  type: 'reply' | 'url' | 'phone' | 'copy';
  label: string;
  value?: string;
}

interface ListSection {
  title: string;
  rows: { id?: string; title: string; description: string }[];
}

interface Contact {
  nome?: string;
  phone?: string;
  [key: string]: string | undefined;
}

interface CampaignMessage {
  content: string;
  mediaType?: 'text' | 'image' | 'audio' | 'video' | 'document' | 'buttons' | 'link' | 'list' | 'carousel' | 'contact' | 'sticker' | 'location' | 'poll';
  mediaUrl?: string;
  mediaCaption?: string;
  mediaFilename?: string;
  linkUrl?: string;
  btnTitle?: string;
  btnFooter?: string;
  title?: string;
  footer?: string;
  buttons?: MessageButton[];
  sections?: ListSection[];
  latitude?: number;
  longitude?: number;
  pollHeader?: string;
  pollOptions?: string[];
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
        await wuzapiSendText(baseUrl, userToken, to, `${personalizedContent}\n\n${msg.linkUrl}`);
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
        await wuzapiSendDocument(baseUrl, userToken, to, docData, msg.mediaFilename || 'documento', personalizedCaption);
      }
      break;

    case 'sticker':
      if (msg.mediaUrl) {
        const stickerData = await downloadMediaAsBase64(msg.mediaUrl);
        await wuzapiSendSticker(baseUrl, userToken, to, stickerData);
      }
      break;

    case 'location':
      if (msg.latitude && msg.longitude) {
        await wuzapiSendLocation(baseUrl, userToken, to, msg.latitude, msg.longitude, msg.btnTitle || undefined);
      }
      break;

    case 'poll':
      if (msg.pollHeader && msg.pollOptions && msg.pollOptions.length >= 2) {
        await wuzapiSendPoll(baseUrl, userToken, to, msg.pollHeader, msg.pollOptions);
      }
      break;

    case 'buttons':
      if (msg.buttons && msg.buttons.length > 0) {
        const buttons = msg.buttons.map(b => ({
          DisplayText: replaceVariables(b.label, contact),
          Type: (b.type === 'phone' ? 'call' : b.type === 'url' ? 'url' : 'reply') as 'reply' | 'url' | 'call',
          ...(b.type === 'url' && b.value ? { Url: replaceVariables(b.value, contact) } : {}),
          ...(b.type === 'phone' && b.value ? { PhoneNumber: b.value.replace(/\D/g, '') } : {}),
        }));
        const body = msg.title ? `${personalizedContent}` : personalizedContent;
        await wuzapiSendButtons(baseUrl, userToken, to, body, buttons, undefined);
      }
      break;

    case 'list':
      if (msg.sections && msg.sections.length > 0) {
        await wuzapiSendList(baseUrl, userToken, to, {
          topText: msg.title || '',
          desc: personalizedContent,
          buttonText: msg.btnTitle || 'Opções',
          footerText: msg.btnFooter || '',
          sections: msg.sections.map(s => ({
            title: s.title,
            rows: s.rows.map(r => ({
              title: r.title,
              description: r.description,
              rowId: r.id || r.title,
            })),
          })),
        });
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
