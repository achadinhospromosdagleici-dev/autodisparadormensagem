import React, { useRef, useState, useEffect } from 'react';
import { Smile, Sticker, Mic, Square, Trash2, Loader2 } from 'lucide-react';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  onInsertText: (text: string) => void;
  onMediaReady: (opts: { url: string; type: 'image' | 'audio'; filename?: string }) => void;
}

export function MessageComposerExtras({ onInsertText, onMediaReady }: Props) {
  const [showEmoji, setShowEmoji] = useState(false);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }
  }, []);

  const uploadFile = async (file: File | Blob, folder: string, filename: string, contentType: string) => {
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${filename}`;
    const { error } = await supabase.storage
      .from('campaign-media')
      .upload(path, file, { contentType, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('campaign-media').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSticker = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Figurinha muito grande (máx. 5MB)');
      return;
    }
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
      const url = await uploadFile(file, 'stickers', safe, file.type || 'image/webp');
      onMediaReady({ url, type: 'image', filename: safe });
      toast.success('Figurinha enviada!');
    } catch (err: any) {
      toast.error(`Falha: ${err.message || 'erro'}`);
    } finally {
      e.target.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      cancelRef.current = false;
      mr.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setRecording(false);
        if (cancelRef.current) { setSeconds(0); return; }
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1000) { toast.error('Áudio muito curto'); setSeconds(0); return; }
        setUploadingAudio(true);
        try {
          const url = await uploadFile(blob, 'audio', `voice_${Date.now()}.webm`, mime);
          onMediaReady({ url, type: 'audio' });
          toast.success('Áudio enviado!');
        } catch (err: any) {
          toast.error(`Falha: ${err.message || 'erro'}`);
        } finally {
          setUploadingAudio(false);
          setSeconds(0);
        }
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err: any) {
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = (cancel = false) => {
    cancelRef.current = cancel;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="relative flex items-center gap-2 px-1">
      {/* Emoji */}
      <button
        type="button"
        onClick={() => setShowEmoji(v => !v)}
        className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
        title="Emojis"
      >
        <Smile className="w-5 h-5" />
      </button>

      {/* Sticker */}
      <button
        type="button"
        onClick={() => stickerInputRef.current?.click()}
        className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
        title="Enviar figurinha (.webp)"
      >
        <Sticker className="w-5 h-5" />
      </button>
      <input
        ref={stickerInputRef}
        type="file"
        className="hidden"
        accept="image/webp,image/png,image/gif"
        onChange={handleSticker}
      />

      {/* Audio */}
      {!recording && !uploadingAudio && (
        <button
          type="button"
          onClick={startRecording}
          className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
          title="Gravar áudio"
        >
          <Mic className="w-5 h-5" />
        </button>
      )}
      {uploadingAudio && (
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Enviando áudio...
        </div>
      )}
      {recording && (
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-destructive/10 border border-destructive/30">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-xs font-mono text-destructive">{fmt(seconds)}</span>
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="p-1 rounded hover:bg-destructive/20 text-destructive"
            title="Cancelar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="p-1 rounded hover:bg-destructive/20 text-destructive"
            title="Parar e enviar"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>
      )}

      {showEmoji && (
        <div className="absolute bottom-12 left-0 z-50 shadow-2xl rounded-lg overflow-hidden">
          <EmojiPicker
            theme={Theme.DARK}
            emojiStyle={EmojiStyle.NATIVE}
            onEmojiClick={(e) => {
              onInsertText(e.emoji);
              setShowEmoji(false);
            }}
            width={320}
            height={380}
          />
        </div>
      )}
    </div>
  );
}
