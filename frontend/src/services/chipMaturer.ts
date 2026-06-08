import { sendTextMessage, loadUnoApiCredentialsWithFallback } from './unoapi';
import { sendText, loadWuzapiSettings, loadWuzapiInstances } from './wuzapi';
import { sendMessage, loadEvolutionCredentialsWithFallback } from './evolution';
import { sendEvolutionGoMessage, loadEvolutionGoCredentialsWithFallback } from './evolutionGo';

export interface MaturerInstance {
  id: string;
  phone: string;
  api: 'unoapi' | 'wuzapi' | 'evolution' | 'evolution-go';
  label: string;
}

interface SendResult {
  success: boolean;
  phrase: string;
  from: string;
  to: string;
  error?: string;
}

export type MaturerProgress = {
  sent: number;
  total: number;
  currentPhrase: string;
  from: string;
  to: string;
  lastResult?: string;
};

async function sendSingleText(inst: MaturerInstance, to: string, text: string): Promise<boolean> {
  try {
    switch (inst.api) {
      case 'unoapi': {
        const creds = await loadUnoApiCredentialsWithFallback();
        if (!creds) throw new Error('UnoAPI sem credenciais');
        await sendTextMessage(creds, inst.phone, to, text);
        return true;
      }
      case 'wuzapi': {
        const settings = await loadWuzapiSettings();
        if (!settings?.baseUrl) throw new Error('WuzAPI sem URL');
        const instances = await loadWuzapiInstances();
        const match = instances.find(i => i.phone === inst.phone || i.id === inst.id);
        if (!match?.user_token) throw new Error('WuzAPI sem token');
        const result = await sendText(settings.baseUrl, match.user_token, to, text);
        return result.success;
      }
      case 'evolution': {
        const creds = await loadEvolutionCredentialsWithFallback();
        if (!creds) throw new Error('Evolution sem credenciais');
        await sendMessage(creds, inst.id, to, { type: 'text', content: text });
        return true;
      }
      case 'evolution-go': {
        const creds = await loadEvolutionGoCredentialsWithFallback();
        if (!creds) throw new Error('Evolution Go sem credenciais');
        await sendEvolutionGoMessage(creds, inst.id, to, { content: text });
        return true;
      }
      default:
        throw new Error(`API desconhecida: ${inst.api}`);
    }
  } catch (err) {
    console.error(`[ChipMaturer] Erro ao enviar de ${inst.phone} para ${to}:`, err);
    return false;
  }
}

export async function startMaturation(
  instances: MaturerInstance[],
  targetPhones: string[],
  phrases: string[],
  durationMinutes: number,
  onProgress: (p: MaturerProgress) => void,
  abortSignal?: AbortSignal,
): Promise<void> {
  const startTime = Date.now();
  const maxTime = durationMinutes * 60 * 1000;
  let totalSent = 0;
  const total = phrases.length;

  for (let i = 0; i < phrases.length; i++) {
    if (abortSignal?.aborted) break;
    if (Date.now() - startTime >= maxTime) break;

    const phrase = phrases[i].trim();
    if (!phrase) continue;

    const fromInst = instances[i % instances.length];
    const toPhone = targetPhones[i % targetPhones.length];

    onProgress({
      sent: totalSent,
      total,
      currentPhrase: phrase.substring(0, 60),
      from: fromInst.phone,
      to: toPhone,
      lastResult: undefined,
    });

    const ok = await sendSingleText(fromInst, toPhone, phrase);
    if (ok) totalSent++;

    onProgress({
      sent: totalSent,
      total,
      currentPhrase: phrase.substring(0, 60),
      from: fromInst.phone,
      to: toPhone,
      lastResult: ok ? 'OK' : 'Falhou',
    });

    const delay = 3000 + Math.random() * 4000;
    await new Promise(r => setTimeout(r, delay));
    if (abortSignal?.aborted) break;
  }
}
