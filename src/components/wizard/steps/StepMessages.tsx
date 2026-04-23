import React, { useState } from 'react';
import { useWizard, MessageButton } from '@/contexts/WizardContext';
import {
  MessageSquare,
  Plus,
  Trash2,
  Eye,
  Sparkles,
  Copy,
  Hash,
  Image,
  FileAudio,
  Video,
  FileText,
  Link,
  MousePointerClick,
  Phone,
  ExternalLink,
  X,
  Upload,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type EditorMediaType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'buttons' | 'link';

export function StepMessages() {
  const { messages, columns, addMessage, addRichMessage, updateMessage, deleteMessage, settings, data } =
    useWizard();
  const [newMessage, setNewMessage] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [mediaType, setMediaType] = useState<EditorMediaType>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFilename, setMediaFilename] = useState('');
  const [uploading, setUploading] = useState(false);
  // Buttons editor state
  const [btnTitle, setBtnTitle] = useState('');
  const [btnFooter, setBtnFooter] = useState('');
  const [buttons, setButtons] = useState<MessageButton[]>([]);
  // Link editor state
  const [linkUrl, setLinkUrl] = useState('');

  const variables = columns.map((col) => `{{${col}}}`);
  // Add dynamic {{primeiro_nome}} variable if 'nome' column exists
  const hasNome = columns.some((col) => col.toLowerCase() === 'nome');
  if (hasNome && !variables.includes('{{primeiro_nome}}')) {
    variables.push('{{primeiro_nome}}');
  }

  const insertVariable = (variable: string) => {
    setNewMessage((prev) => prev + variable);
  };

  const handleAddMessage = () => {
    // Validações por tipo
    if (mediaType === 'text' && !newMessage.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }
    if (['image', 'audio', 'video', 'document'].includes(mediaType) && !mediaUrl.trim()) {
      toast.error('Informe a URL da mídia');
      return;
    }
    if (mediaType === 'buttons') {
      if (!newMessage.trim()) { toast.error('Digite o texto da mensagem'); return; }
      if (buttons.length === 0) { toast.error('Adicione pelo menos um botão'); return; }
      const invalid = buttons.find(b => !b.label.trim() || (b.type !== 'reply' && !b.value.trim()));
      if (invalid) { toast.error('Preencha o texto e o valor de todos os botões'); return; }
    }
    if (mediaType === 'link') {
      if (!newMessage.trim()) { toast.error('Digite o texto da mensagem'); return; }
      if (!linkUrl.trim()) { toast.error('Informe a URL do link'); return; }
    }
    // Validação de botões opcionais em mídia (image/video/document)
    if (['image', 'video', 'document'].includes(mediaType) && buttons.length > 0) {
      const invalid = buttons.find(b => !b.label.trim() || (b.type !== 'reply' && !b.value.trim()));
      if (invalid) { toast.error('Preencha o texto e o valor de todos os botões da mídia'); return; }
    }

    if (mediaType === 'buttons') {
      addRichMessage({
        content: newMessage.trim(),
        mediaType: 'buttons',
        buttons: buttons.map(b => ({ ...b, label: b.label.trim(), value: b.value.trim() })),
        mediaCaption: btnTitle.trim() || undefined,
        mediaFilename: btnFooter.trim() || undefined,
      });
    } else if (mediaType === 'link') {
      addRichMessage({
        content: newMessage.trim(),
        mediaType: 'link',
        linkUrl: linkUrl.trim(),
      });
    } else if (['image', 'video', 'document'].includes(mediaType) && buttons.length > 0) {
      // Mídia + botões anexados (será enviado como interactive com header de mídia)
      addRichMessage({
        content: newMessage.trim(),
        mediaType,
        mediaUrl: mediaUrl.trim(),
        mediaCaption: newMessage.trim(),
        mediaFilename: mediaType === 'document' ? mediaFilename.trim() || undefined : undefined,
        buttons: buttons.map(b => ({ ...b, label: b.label.trim(), value: b.value.trim() })),
      });
    } else {
      addMessage(newMessage.trim(), {
        mediaType,
        mediaUrl: mediaType !== 'text' ? mediaUrl.trim() : undefined,
        mediaCaption: mediaType !== 'text' ? newMessage.trim() : undefined,
        mediaFilename: mediaType === 'document' ? mediaFilename.trim() || undefined : undefined,
      });
    }
    setNewMessage('');
    setMediaUrl('');
    setMediaFilename('');
    setBtnTitle('');
    setBtnFooter('');
    setButtons([]);
    setLinkUrl('');
    setMediaType('text');
    toast.success('Mensagem adicionada');
  };

  const replaceVariables = (text: string, rowIndex: number) => {
    let result = text;
    const row = data[rowIndex];
    if (!row) return text;

    columns.forEach((col) => {
      const regex = new RegExp(`\\{\\{${col}\\}\\}`, 'gi');
      result = result.replace(regex, (row[col] as string) || `[${col}]`);
    });

    // Handle {{primeiro_nome}} - extract first name from 'nome' column
    const nomeKey = columns.find((col) => col.toLowerCase() === 'nome');
    if (nomeKey) {
      const nomeValue = (row[nomeKey] as string) || '';
      const primeiroNome = nomeValue.trim().split(/\s+/)[0] || '[primeiro_nome]';
      result = result.replace(/\{\{primeiro_nome\}\}/gi, primeiroNome);
    }

    return result;
  };

  const mediaTypeConfig = [
    { type: 'text' as EditorMediaType, icon: MessageSquare, label: 'Texto' },
    { type: 'image' as EditorMediaType, icon: Image, label: 'Imagem' },
    { type: 'audio' as EditorMediaType, icon: FileAudio, label: 'Áudio' },
    { type: 'video' as EditorMediaType, icon: Video, label: 'Vídeo' },
    { type: 'document' as EditorMediaType, icon: FileText, label: 'Documento' },
    { type: 'link' as EditorMediaType, icon: ExternalLink, label: 'Link' },
    { type: 'buttons' as EditorMediaType, icon: MousePointerClick, label: 'Botões' },
  ];

  const mediaIcon = (type?: string) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'audio': return '🎵';
      case 'video': return '📹';
      case 'document': return '📄';
      case 'buttons': return '🔘';
      case 'link': return '🔗';
      default: return '📝';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      {/* Variables Panel */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Hash className="w-4 h-4" />
            Variáveis disponíveis:
          </span>
          {variables.map((variable) => (
            <button
              key={variable}
              onClick={() => insertVariable(variable)}
              className="variable-tag hover:bg-primary/30 transition-colors cursor-pointer"
            >
              {variable}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Message Editor */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Criar Nova Mensagem
          </h3>

          <div className="glass-card p-4 space-y-4">
            {/* Media Type Selector */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Tipo de mensagem</label>
              <div className="flex flex-wrap gap-1.5">
                {mediaTypeConfig.map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => setMediaType(type)}
                    className={`flex-1 min-w-[80px] py-2 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                      mediaType === type
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Media URL Input — only for image/audio/video/document */}
            {['image', 'audio', 'video', 'document'].includes(mediaType) && (
              <div className="space-y-3 animate-fade-in">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Link className="w-3.5 h-3.5" />
                    URL da {mediaType === 'image' ? 'imagem' : mediaType === 'audio' ? 'áudio' : mediaType === 'video' ? 'vídeo' : 'documento'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder={`https://exemplo.com/${mediaType === 'image' ? 'foto.jpg' : mediaType === 'audio' ? 'audio.mp3' : mediaType === 'video' ? 'video.mp4' : 'arquivo.pdf'}`}
                      className="flex-1 px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <label
                      className={`shrink-0 px-3 py-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
                      title="Enviar arquivo do computador"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="hidden sm:inline">Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Upload</span>
                        </>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept={
                          mediaType === 'image' ? 'image/*'
                          : mediaType === 'audio' ? 'audio/*'
                          : mediaType === 'video' ? 'video/*'
                          : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip'
                        }
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          // 25MB safety cap
                          if (file.size > 25 * 1024 * 1024) {
                            toast.error('Arquivo muito grande (máx. 25MB)');
                            return;
                          }
                          setUploading(true);
                          try {
                            const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
                            const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
                            const path = `${mediaType}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeBase}`;
                            const { error: upErr } = await supabase.storage
                              .from('campaign-media')
                              .upload(path, file, { contentType: file.type, upsert: false });
                            if (upErr) throw upErr;
                            const { data: pub } = supabase.storage.from('campaign-media').getPublicUrl(path);
                            setMediaUrl(pub.publicUrl);
                            if (mediaType === 'document' && !mediaFilename) {
                              setMediaFilename(file.name);
                            }
                            toast.success('Arquivo enviado! URL preenchida.');
                          } catch (err: any) {
                            console.error('[upload]', err);
                            toast.error(`Falha no upload: ${err.message || 'erro desconhecido'}`);
                          } finally {
                            setUploading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70">
                    Cole uma URL ou clique em <strong>Upload</strong> para enviar do seu computador (máx. 25MB).
                  </p>
                </div>
                {mediaType === 'document' && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Nome do arquivo (opcional)</label>
                    <input
                      type="text"
                      value={mediaFilename}
                      onChange={(e) => setMediaFilename(e.target.value)}
                      placeholder="documento.pdf"
                      className="w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                )}

                {/* Botão opcional anexado à mídia (image/video/document) */}
                {(mediaType === 'image' || mediaType === 'video' || mediaType === 'document') && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <MousePointerClick className="w-3.5 h-3.5" />
                        Botão de ação (opcional) — {buttons.length}/3
                      </label>
                      {buttons.length < 3 && (
                        <button
                          type="button"
                          onClick={() => setButtons([...buttons, { id: crypto.randomUUID(), type: 'url', label: '', value: '' }])}
                          className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Adicionar botão
                        </button>
                      )}
                    </div>
                    {buttons.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        💡 Adicione um botão (ex: "CLIQUE AQUI") com link, telefone ou resposta rápida — igual ao exemplo do BemCash.
                      </p>
                    )}
                    {buttons.map((btn, idx) => (
                      <div key={btn.id} className="p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={btn.type}
                            onChange={(e) => {
                              const next = [...buttons];
                              next[idx] = { ...btn, type: e.target.value as MessageButton['type'], value: '' };
                              setButtons(next);
                            }}
                            className="px-2 py-1.5 rounded-md bg-background border border-border/50 text-xs focus:outline-none"
                          >
                            <option value="url">🔗 URL</option>
                            <option value="phone">📞 Telefone</option>
                            <option value="reply">💬 Resposta</option>
                          </select>
                          <input
                            type="text"
                            value={btn.label}
                            onChange={(e) => {
                              const next = [...buttons];
                              next[idx] = { ...btn, label: e.target.value };
                              setButtons(next);
                            }}
                            placeholder="Ex: CLIQUE AQUI"
                            maxLength={20}
                            className="flex-1 px-2 py-1.5 rounded-md bg-background border border-border/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                          <button
                            type="button"
                            onClick={() => setButtons(buttons.filter((_, i) => i !== idx))}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {btn.type !== 'reply' && (
                          <input
                            type={btn.type === 'phone' ? 'tel' : 'url'}
                            value={btn.value}
                            onChange={(e) => {
                              const next = [...buttons];
                              next[idx] = { ...btn, value: e.target.value };
                              setButtons(next);
                            }}
                            placeholder={btn.type === 'url' ? 'https://seusite.com/oferta' : '+5511999999999'}
                            className="w-full px-2 py-1.5 rounded-md bg-background border border-border/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Link editor */}
            {mediaType === 'link' && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" />
                  URL do link (será adicionada ao final da mensagem)
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://seusite.com/oferta"
                  className="w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-[11px] text-muted-foreground">
                  💡 O WhatsApp gera automaticamente uma prévia clicável da página.
                </p>
              </div>
            )}

            {/* Buttons editor */}
            {mediaType === 'buttons' && (
              <div className="space-y-3 animate-fade-in">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Título (opcional)</label>
                    <input
                      type="text"
                      value={btnTitle}
                      onChange={(e) => setBtnTitle(e.target.value)}
                      placeholder="Ex: INÍCIO DE FLUXO"
                      className="w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Rodapé (opcional)</label>
                    <input
                      type="text"
                      value={btnFooter}
                      onChange={(e) => setBtnFooter(e.target.value)}
                      placeholder="Ex: Oferta válida hoje"
                      className="w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground font-medium">
                      Botões ({buttons.length}/3)
                    </label>
                    {buttons.length < 3 && (
                      <button
                        type="button"
                        onClick={() => setButtons([...buttons, { id: crypto.randomUUID(), type: 'url', label: '', value: '' }])}
                        className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Adicionar botão
                      </button>
                    )}
                  </div>

                  {buttons.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-3 border border-dashed border-border/50 rounded-lg">
                      Adicione até 3 botões (URL, telefone ou resposta rápida)
                    </p>
                  )}

                  {buttons.map((btn, idx) => (
                    <div key={btn.id} className="p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={btn.type}
                          onChange={(e) => {
                            const next = [...buttons];
                            next[idx] = { ...btn, type: e.target.value as MessageButton['type'], value: '' };
                            setButtons(next);
                          }}
                          className="px-2 py-1.5 rounded-md bg-background border border-border/50 text-xs focus:outline-none"
                        >
                          <option value="url">🔗 URL</option>
                          <option value="phone">📞 Telefone</option>
                          <option value="reply">💬 Resposta</option>
                        </select>
                        <input
                          type="text"
                          value={btn.label}
                          onChange={(e) => {
                            const next = [...buttons];
                            next[idx] = { ...btn, label: e.target.value };
                            setButtons(next);
                          }}
                          placeholder="Texto do botão"
                          maxLength={20}
                          className="flex-1 px-2 py-1.5 rounded-md bg-background border border-border/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                        <button
                          type="button"
                          onClick={() => setButtons(buttons.filter((_, i) => i !== idx))}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {btn.type !== 'reply' && (
                        <input
                          type={btn.type === 'phone' ? 'tel' : 'url'}
                          value={btn.value}
                          onChange={(e) => {
                            const next = [...buttons];
                            next[idx] = { ...btn, value: e.target.value };
                            setButtons(next);
                          }}
                          placeholder={btn.type === 'url' ? 'https://seusite.com/...' : '+5511999999999'}
                          className="w-full px-2 py-1.5 rounded-md bg-background border border-border/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground bg-warning/5 border border-warning/20 rounded-md p-2">
                  ⚠️ Botões interativos funcionam melhor em contas WhatsApp Business API. Em contas comuns (Baileys), podem aparecer como texto simples em alguns dispositivos.
                </p>
              </div>
            )}

            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                mediaType === 'text'
                  ? `Olá {{nome}}! \n\nTemos uma oferta especial do {{produto}} para você.\n\nEntre em contato para saber mais!`
                  : mediaType === 'buttons'
                    ? `Olá {{primeiro_nome}}, escolha uma opção abaixo:`
                    : mediaType === 'link'
                      ? `Olá {{primeiro_nome}}! Clique no link abaixo e finalize sua compra com 10% OFF 👇`
                      : `Legenda da ${mediaType === 'image' ? 'imagem' : mediaType === 'audio' ? 'áudio' : mediaType === 'video' ? 'vídeo' : 'documento'} (opcional)`
              }
              className="w-full h-36 p-4 rounded-xl bg-muted/50 border border-border/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 scrollbar-thin"
            />

            <button
              onClick={handleAddMessage}
              disabled={!newMessage.trim() && mediaType === 'text'}
              className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                (newMessage.trim() || mediaType !== 'text')
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 glow-effect'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              Adicionar {mediaType === 'text' ? 'Mensagem' : `Mensagem com ${mediaType === 'image' ? 'Imagem' : mediaType === 'audio' ? 'Áudio' : mediaType === 'video' ? 'Vídeo' : 'Documento'}`}
            </button>
          </div>

          {/* Message List */}
          {messages.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Mensagens Configuradas ({messages.length})
              </h4>
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className="glass-card p-4 space-y-3 animate-fade-in"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium">Mensagem {index + 1}</span>
                      {msg.mediaType && msg.mediaType !== 'text' && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          {mediaIcon(msg.mediaType)} {msg.mediaType}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          toast.success('Mensagem copiada');
                        }}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          deleteMessage(msg.id);
                          toast.success('Mensagem removida');
                        }}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {msg.mediaUrl && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Link className="w-3 h-3 shrink-0" /> {msg.mediaUrl}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                    {msg.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Prévia da Mensagem
          </h3>

          {data.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Contato:</span>
              <select
                value={previewIndex}
                onChange={(e) => setPreviewIndex(parseInt(e.target.value))}
                className="flex-1 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {data.slice(0, 10).map((row, index) => (
                  <option key={row.id} value={index}>
                    {row.numero} {row.nome ? `- ${row.nome}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="glass-card p-4 min-h-[300px] space-y-4">
            {messages.length === 0 && !newMessage ? (
              <div className="h-full flex items-center justify-center text-center py-12">
                <div className="text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Crie uma mensagem para ver a prévia</p>
                </div>
              </div>
            ) : (
              <>
                {/* Preview current input */}
                {newMessage && (
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <p className="text-xs text-primary mb-2 font-medium">
                      Nova mensagem (prévia) {mediaType !== 'text' && `• ${mediaIcon(mediaType)} ${mediaType}`}
                    </p>
                    {['image','audio','video','document'].includes(mediaType) && mediaUrl && (
                      <div className="mb-2 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground flex items-center gap-1">
                        <Link className="w-3 h-3" /> {mediaUrl}
                      </div>
                    )}
                    {mediaType === 'buttons' && btnTitle && (
                      <p className="text-xs font-bold uppercase tracking-wide mb-1">{btnTitle}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">
                      {replaceVariables(newMessage, previewIndex)}
                    </p>
                    {mediaType === 'link' && linkUrl && (
                      <a href={linkUrl} target="_blank" rel="noreferrer" className="block mt-2 text-xs text-primary underline break-all">
                        {linkUrl}
                      </a>
                    )}
                    {mediaType === 'buttons' && buttons.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                        {buttons.map((b) => (
                          <div key={b.id} className="w-full py-2 px-3 rounded-md bg-background border border-border/50 text-xs text-center font-medium text-primary flex items-center justify-center gap-1.5">
                            {b.type === 'url' && <ExternalLink className="w-3 h-3" />}
                            {b.type === 'phone' && <Phone className="w-3 h-3" />}
                            {b.type === 'reply' && <MessageSquare className="w-3 h-3" />}
                            {b.label || `Botão ${b.type}`}
                          </div>
                        ))}
                        {btnFooter && <p className="text-[10px] text-muted-foreground text-center mt-2">{btnFooter}</p>}
                      </div>
                    )}
                    {(mediaType === 'image' || mediaType === 'video' || mediaType === 'document') && buttons.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                        {buttons.map((b) => (
                          <div key={b.id} className="w-full py-2 px-3 rounded-md bg-background border border-border/50 text-xs text-center font-medium text-primary flex items-center justify-center gap-1.5">
                            {b.type === 'url' && <ExternalLink className="w-3 h-3" />}
                            {b.type === 'phone' && <Phone className="w-3 h-3" />}
                            {b.type === 'reply' && <MessageSquare className="w-3 h-3" />}
                            {b.label || `Botão ${b.type}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Preview saved messages */}
                {messages.map((msg, index) => (
                  <div
                    key={msg.id}
                    className="p-4 rounded-xl bg-muted/50 border border-border/50"
                  >
                    <p className="text-xs text-muted-foreground mb-2">
                      Mensagem {index + 1} {msg.mediaType && msg.mediaType !== 'text' && `• ${mediaIcon(msg.mediaType)} ${msg.mediaType}`}
                    </p>
                    {msg.mediaUrl && (
                      <div className="mb-2 p-2 rounded-lg bg-muted/30 text-xs text-muted-foreground flex items-center gap-1">
                        <Link className="w-3 h-3 shrink-0" /> {msg.mediaUrl}
                      </div>
                    )}
                    {msg.mediaType === 'buttons' && msg.mediaCaption && (
                      <p className="text-xs font-bold uppercase tracking-wide mb-1">{msg.mediaCaption}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">
                      {replaceVariables(msg.content, previewIndex)}
                    </p>
                    {msg.mediaType === 'link' && msg.linkUrl && (
                      <a href={msg.linkUrl} target="_blank" rel="noreferrer" className="block mt-2 text-xs text-primary underline break-all">
                        {msg.linkUrl}
                      </a>
                    )}
                    {msg.mediaType === 'buttons' && msg.buttons && msg.buttons.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                        {msg.buttons.map((b) => (
                          <div key={b.id} className="w-full py-2 px-3 rounded-md bg-background border border-border/50 text-xs text-center font-medium text-primary flex items-center justify-center gap-1.5">
                            {b.type === 'url' && <ExternalLink className="w-3 h-3" />}
                            {b.type === 'phone' && <Phone className="w-3 h-3" />}
                            {b.type === 'reply' && <MessageSquare className="w-3 h-3" />}
                            {b.label}
                          </div>
                        ))}
                        {msg.mediaFilename && <p className="text-[10px] text-muted-foreground text-center mt-2">{msg.mediaFilename}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {settings.useAI && messages.length > 0 && (
            <div className="glass-card p-4 border-primary/20 animate-fade-in">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">Variação com IA ativada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    As mensagens serão automaticamente variadas para cada contato,
                    mantendo o mesmo sentido mas com palavras diferentes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
