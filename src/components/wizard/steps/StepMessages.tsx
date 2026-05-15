import React, { useState } from 'react';
import { useWizard, Message, MessageButton } from '@/contexts/WizardContext';
import { FollowUpSettings } from '../FollowUpSettings';
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
  ArrowUp,
  ArrowDown,
  Pencil,
  GitBranch,
  List,
  LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { loadUnoApiCredentials, uploadToS3, DEFAULT_S3_CONFIG } from '@/services/unoapi';
import { MessageComposerExtras } from '../MessageComposerExtras';

type EditorMediaType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'buttons' | 'link' | 'list' | 'carousel' | 'contact';

export function StepMessages() {
  const { messages, columns, addMessage, addRichMessage, updateMessage, updateRichMessage, deleteMessage, moveMessage, settings, data, followUpConfig, setFollowUpConfig, selectedApi } =
    useWizard();

  const [newMessage, setNewMessage] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [mediaType, setMediaType] = useState<EditorMediaType>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFilename, setMediaFilename] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  // Buttons editor state
  const [btnTitle, setBtnTitle] = useState('');
  const [btnFooter, setBtnFooter] = useState('');
  const [buttons, setButtons] = useState<MessageButton[]>([]);
  // Link editor state
  const [linkUrl, setLinkUrl] = useState('');
  // List editor state
  const [listSections, setListSections] = useState<{ title: string; rows: { title: string; description: string }[] }[]>([]);
  // Carousel editor state
  const [carouselCards, setCarouselCards] = useState<{ image?: string; title: string; description: string; footer?: string; buttons: MessageButton[] }[]>([]);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const variables = columns.map((c) => `{{${c}}}`);
  if (columns.find((c) => c.toLowerCase() === 'nome')) {
    variables.push('{{primeiro_nome}}');
  }

  const insertVariable = (variable: string) => {
    const v = variable.startsWith('{{') ? variable : `{{${variable}}}`;
    setNewMessage((prev) => prev + v);
  };

  const isApiUno = selectedApi === 'unoapi';
  const isApiEvo = selectedApi === 'evolution';
  const isApiEvoGo = selectedApi === 'evolution-go';
  const showAllOptions = !selectedApi;

  const handleAddMessage = () => {
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
    if (mediaType === 'contact') {
      if (!btnTitle.trim()) { toast.error('Digite o nome do contato'); return; }
      if (!btnFooter.trim()) { toast.error('Digite o número do contato'); return; }
    }
    if (mediaType === 'list') {
      if (!newMessage.trim()) { toast.error('Digite a descrição da lista'); return; }
      if (!btnTitle.trim()) { toast.error('Digite o título da lista'); return; }
      if (listSections.length === 0) { toast.error('Adicione pelo menos uma seção com itens'); return; }
      const invalidSection = listSections.find(s => !s.title.trim() || s.rows.length === 0);
      if (invalidSection) { toast.error('Cada seção precisa de título e pelo menos um item'); return; }
    }
    if (mediaType === 'carousel') {
      if (carouselCards.length === 0) { toast.error('Adicione pelo menos um card'); return; }
      const invalidCard = carouselCards.find(c => !c.title.trim());
      if (invalidCard) { toast.error('Cada card precisa de um título'); return; }
    }
    if (['image', 'video', 'document'].includes(mediaType) && buttons.length > 0) {
      const invalid = buttons.find(b => !b.label.trim() || (b.type !== 'reply' && !b.value.trim()));
      if (invalid) { toast.error('Preencha o texto e o valor de todos os botões da mídia'); return; }
    }

    const isEditing = !!editingMessageId;
    const baseData = {
      content: newMessage.trim(),
      mediaType: mediaType as Message['mediaType'],
      mediaUrl: mediaType !== 'text' ? mediaUrl.trim() : undefined,
      mediaCaption: mediaType !== 'text' ? newMessage.trim() : undefined,
      mediaFilename: mediaType === 'document' ? mediaFilename.trim() || undefined : undefined,
    };

    if (isEditing) {
      const cleanButtons = buttons.map(b => {
        let val = b.value.trim();
        if (b.type === 'phone') {
          val = val.replace(/\D/g, '');
        } else if (b.type === 'url' && (val.includes('wa.me/') || val.includes('api.whatsapp.com'))) {
          val = val.replace(/(wa\.me\/|phone=)\+?(\d+)/g, '$1$2');
        }
        return { ...b, label: b.label.trim(), value: val };
      });

      updateRichMessage(editingMessageId, {
        ...baseData,
        buttons: buttons.length > 0 ? cleanButtons : undefined,
        btnTitle: mediaType === 'buttons' || mediaType === 'contact' ? btnTitle.trim() : undefined,
        btnFooter: mediaType === 'buttons' || mediaType === 'contact' ? btnFooter.trim() : undefined,
        linkUrl: mediaType === 'link' ? linkUrl.trim() : undefined,
      });
      toast.success('Mensagem atualizada');
    } else {
        const cleanButtons = buttons.map(b => {
          let val = b.value.trim();
          if (b.type === 'phone') {
            val = val.replace(/\D/g, '');
          } else if (b.type === 'url' && (val.includes('wa.me/') || val.includes('api.whatsapp.com'))) {
            val = val.replace(/(wa\.me\/|phone=)\+?(\d+)/g, '$1$2');
          }
          return { ...b, label: b.label.trim(), value: val };
        });

        if (mediaType === 'buttons') {
          addRichMessage({
            content: newMessage.trim(),
            mediaType: 'buttons',
            buttons: cleanButtons,
            mediaCaption: btnTitle.trim() || undefined,
            mediaFilename: btnFooter.trim() || undefined,
          });
        } else if (mediaType === 'link') {
          addRichMessage({
            content: newMessage.trim(),
            mediaType: 'link',
            linkUrl: linkUrl.trim(),
          });
        } else if (mediaType === 'contact') {
          addRichMessage({
            content: newMessage.trim(),
            mediaType: 'contact',
            btnTitle: btnTitle.trim(),
            btnFooter: btnFooter.trim(),
          });
        } else if (mediaType === 'list' && isApiEvoGo) {
          addRichMessage({
            content: newMessage.trim(),
            mediaType: 'list',
            title: btnTitle.trim(),
            btnTitle: 'Selecionar',
            btnFooter: btnFooter.trim(),
            buttons: listSections as unknown as Message['buttons'],
          });
        } else if (mediaType === 'carousel' && isApiEvoGo) {
          addRichMessage({
            content: newMessage.trim(),
            mediaType: 'carousel',
            buttons: carouselCards as unknown as Message['buttons'],
          });
        } else if (['image', 'video', 'document'].includes(mediaType) && buttons.length > 0) {
          addRichMessage({
            content: newMessage.trim(),
            mediaType,
            mediaUrl: mediaUrl.trim(),
            mediaCaption: newMessage.trim(),
            mediaFilename: mediaType === 'document' ? mediaFilename.trim() || undefined : undefined,
            buttons: cleanButtons,
          });
        } else {
          addMessage(newMessage.trim(), {
            mediaType,
            mediaUrl: mediaType !== 'text' ? mediaUrl.trim() : undefined,
            mediaCaption: mediaType !== 'text' ? newMessage.trim() : undefined,
            mediaFilename: mediaType === 'document' ? mediaFilename.trim() || undefined : undefined,
          });
        }
      toast.success('Mensagem adicionada');
    }

    setNewMessage('');
    setMediaUrl('');
    setMediaFilename('');
    setBtnTitle('');
    setBtnFooter('');
    setButtons([]);
    setLinkUrl('');
    setListSections([]);
    setCarouselCards([]);
    setMediaType('text');
    setEditingMessageId(null);
  };

  const replaceVariables = (text: string, rowIndex: number) => {
    let result = text;
    const row = data[rowIndex];
    if (!row) return text;

    columns.forEach((col) => {
      const regex = new RegExp(`\\{\\{${col}\\}\\}`, 'gi');
      result = result.replace(regex, (row[col] as string) || `[${col}]`);
    });

    const nomeKey = columns.find((col) => col.toLowerCase() === 'nome');
    if (nomeKey) {
      const nomeValue = (row[nomeKey] as string) || '';
      const primeiroNome = nomeValue.trim().split(/\s+/)[0] || '[primeiro_nome]';
      result = result.replace(/\{\{primeiro_nome\}\}/gi, primeiroNome);
    }

return result;
  };

  // Check if feature is supported by current API
  const isFeatureSupported = (type: EditorMediaType) => {
    // Se não há API seleccionada, permitir todas as opções
    if (showAllOptions) return true;
    // Buttons - UNOAPI and Evolution Go only (NOT Evolution API Node)
    if (type === 'buttons') return isApiUno || isApiEvoGo;
    // List - Evolution Go and UNOAPI
    if (type === 'list') return isApiEvoGo || isApiUno;
    // Carousel - Evolution Go and UNOAPI
    if (type === 'carousel') return isApiEvoGo || isApiUno;
    // Contact (vCard) - only UNOAPI
    if (type === 'contact') return isApiUno;
    // Link - supported by all
    if (type === 'link') return true;
    // Media - supported by all
    return true;
  };

  // Media type config - show based on API (mostrar todas se não há API seleccionada)
  const mediaTypeConfig = [
    { type: 'text' as EditorMediaType, icon: MessageSquare, label: 'Texto' },
    { type: 'image' as EditorMediaType, icon: Image, label: 'Imagem' },
    { type: 'audio' as EditorMediaType, icon: FileAudio, label: 'Áudio' },
    { type: 'video' as EditorMediaType, icon: Video, label: 'Vídeo' },
    { type: 'document' as EditorMediaType, icon: FileText, label: 'Documento' },
    { type: 'link' as EditorMediaType, icon: ExternalLink, label: 'Link' },
    // Botões - UNOAPI e Evolution Go (ou todas se não hay API)
    ...((showAllOptions || isApiUno || isApiEvoGo) ? [
      { type: 'buttons' as EditorMediaType, icon: MousePointerClick, label: 'Botões' },
    ] : []),
    // Contato (vCard) - só UNOAPI (ou todas se não hay API)
    ...(showAllOptions || isApiUno ? [
      { type: 'contact' as EditorMediaType, icon: Phone, label: 'Contato' },
    ] : []),
    // Lista e Carrossel - Evolution Go e UNOAPI (ou todas se não hay API)
    ...(showAllOptions || isApiEvoGo || isApiUno ? [
      { type: 'list' as EditorMediaType, icon: List, label: 'Lista' },
      { type: 'carousel' as EditorMediaType, icon: LayoutGrid, label: 'Carrossel' },
    ] : []),
  ];

  const mediaIcon = (type?: string) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'audio': return '🎵';
      case 'video': return '📹';
      case 'document': return '📄';
      case 'buttons': return '🔘';
      case 'link': return '🔗';
      case 'list': return '📋';
      case 'carousel': return '🎠';
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
                {mediaTypeConfig.map(({ type, icon: Icon, label }) => {
                  const supported = isFeatureSupported(type);
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        if (!supported) {
                          const apiName = isApiUno ? 'UnoAPI' : isApiEvoGo ? 'Evolution Go' : 'Evolution API';
                          toast.warning(`${label} não disponível com ${apiName}`);
                          return;
                        }
                        setMediaType(type);
                      }}
                      disabled={!supported}
                      className={`flex-1 min-w-[80px] py-2 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                        mediaType === type
                          ? 'bg-primary text-primary-foreground'
                          : supported
                            ? 'bg-muted/50 text-muted-foreground hover:bg-muted'
                            : 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  );
                })}
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
                            // Check if UnoAPI is connected with S3 enabled
                            const unoCreds = loadUnoApiCredentials();
                            const useS3 = unoCreds?.s3Enabled;
                            
                            if (useS3) {
                              // Upload to S3 (via Edge Function)
                              const s3Config = {
                                endpoint: unoCreds.s3Endpoint || DEFAULT_S3_CONFIG.endpoint,
                                accessKey: unoCreds.s3AccessKey || DEFAULT_S3_CONFIG.accessKey,
                                secretKey: unoCreds.s3SecretKey || DEFAULT_S3_CONFIG.secretKey,
                                bucket: unoCreds.s3Bucket || DEFAULT_S3_CONFIG.bucket,
                                region: unoCreds.s3Region || DEFAULT_S3_CONFIG.region,
                              };
                              console.log('[upload] Using S3 upload for UnoAPI');
                              const s3Url = await uploadToS3(file, s3Config);
                              setMediaUrl(s3Url);
                              toast.success('Arquivo enviado para S3! URL preenchida.');
                            } else {
                              // Upload to Supabase Storage (default - works with UnoAPI too!)
                              console.log('[upload] Using Supabase Storage (default)');
                              const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
                              const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
                              const path = `${mediaType}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeBase}`;
                              
                              const { error: upErr } = await supabase.storage
                                .from('campaign-media')
                                .upload(path, file, { contentType: file.type, upsert: false });
                                
                              if (upErr) {
                                if (upErr.message.includes('bucket not found') || upErr.message.includes('Bucket not found')) {
                                  throw new Error('O bucket "campaign-media" não foi encontrado no Supabase. Por favor, execute o SQL de criação ou desative o S3.');
                                }
                                throw upErr;
                              }
                              
                              const { data: pub } = supabase.storage.from('campaign-media').getPublicUrl(path);
                              setMediaUrl(pub.publicUrl);
                              toast.success('Arquivo enviado com sucesso!');
                            }
                            
                            if (mediaType === 'document' && !mediaFilename) {
                              setMediaFilename(file.name);
                            }
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
                            <option value="copy">📋 Copiar Texto</option>
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
                            type={btn.type === 'phone' ? 'tel' : btn.type === 'url' ? 'url' : 'text'}
                            value={btn.value}
                            onChange={(e) => {
                              const next = [...buttons];
                              next[idx] = { ...btn, value: e.target.value };
                              setButtons(next);
                            }}
                            placeholder={btn.type === 'url' ? 'https://seusite.com/oferta' : btn.type === 'copy' ? 'Texto para copiar' : '+5511999999999'}
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
                          type={btn.type === 'phone' ? 'text' : 'url'}
                          value={btn.value}
                          onChange={(e) => {
                            const next = [...buttons];
                            next[idx] = { ...btn, value: e.target.value };
                            setButtons(next);
                          }}
                          placeholder={btn.type === 'url' ? 'https://seusite.com/...' : '{{contato}} ou +5511999999999'}
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

            {/* List editor - only for Evolution Go */}
            {mediaType === 'list' && isApiEvoGo && (
              <div className="space-y-3 animate-fade-in">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Título da Lista</label>
                    <input
                      type="text"
                      value={btnTitle}
                      onChange={(e) => setBtnTitle(e.target.value)}
                      placeholder="Ex: Nossos Produtos"
                      className="w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Botão</label>
                    <input
                      type="text"
                      value={btnFooter}
                      onChange={(e) => setBtnFooter(e.target.value)}
                      placeholder="Ex: Ver opções"
                      className="w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground font-medium">
                      Seções ({listSections.length})
                    </label>
                    {listSections.length < 2 && (
                      <button
                        type="button"
                        onClick={() => setListSections([...listSections, { title: '', rows: [] }])}
                        className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Adicionar seção
                      </button>
                    )}
                  </div>

                  {listSections.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-3 border border-dashed border-border/50 rounded-lg">
                      Adicione seções para organizar os itens da lista
                    </p>
                  )}

                  {listSections.map((section, sIdx) => (
                    <div key={sIdx} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => {
                            const next = [...listSections];
                            next[sIdx] = { ...section, title: e.target.value };
                            setListSections(next);
                          }}
                          placeholder={`Título da seção ${sIdx + 1}`}
                          className="flex-1 px-2 py-1.5 rounded-md bg-background border border-border/50 text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = listSections.filter((_, i) => i !== sIdx);
                            setListSections(next);
                          }}
                          className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1.5 pl-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-muted-foreground">Itens ({section.rows.length})</label>
                          {section.rows.length < 10 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...listSections];
                                next[sIdx].rows = [...section.rows, { title: '', description: '' }];
                                setListSections(next);
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                            >
                              <Plus className="w-3 h-3 inline" /> Item
                            </button>
                          )}
                        </div>
                        {section.rows.map((row, rIdx) => (
                          <div key={rIdx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={row.title}
                              onChange={(e) => {
                                const next = [...listSections];
                                next[sIdx].rows[rIdx].title = e.target.value;
                                setListSections(next);
                              }}
                              placeholder="Título do item"
                              className="flex-1 px-2 py-1 rounded-md bg-background border border-border/50 text-xs"
                            />
                            <input
                              type="text"
                              value={row.description}
                              onChange={(e) => {
                                const next = [...listSections];
                                next[sIdx].rows[rIdx].description = e.target.value;
                                setListSections(next);
                              }}
                              placeholder="Descrição"
                              className="flex-1 px-2 py-1 rounded-md bg-background border border-border/50 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...listSections];
                                next[sIdx].rows = section.rows.filter((_, i) => i !== rIdx);
                                setListSections(next);
                              }}
                              className="p-1 rounded text-destructive hover:bg-destructive/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground bg-purple-500/5 border border-purple-500/20 rounded-md p-2">
                  📋 Lista interativa - o usuário vê um menu com as opções organizadas em seções.
                </p>
              </div>
            )}

            {/* Carousel editor - only for Evolution Go */}
            {(mediaType === 'carousel') && (isApiEvoGo || isApiUno) && (
              <div className="space-y-3 animate-fade-in">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground font-medium">
                      Cards ({carouselCards.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => setCarouselCards([...carouselCards, { image: '', title: '', description: '', footer: '', buttons: [] }])}
                      className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Adicionar card
                    </button>
                  </div>

                  {carouselCards.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-3 border border-dashed border-border/50 rounded-lg">
                      Adicione cards com imagens e botões
                    </p>
                  )}

                  {carouselCards.map((card, cIdx) => (
                    <div key={cIdx} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Card {cIdx + 1}</span>
                        <button
                          type="button"
                          onClick={() => setCarouselCards(carouselCards.filter((_, i) => i !== cIdx))}
                          className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <input
                        type="url"
                        value={card.image || ''}
                        onChange={(e) => {
                          const next = [...carouselCards];
                          next[cIdx].image = e.target.value;
                          setCarouselCards(next);
                        }}
                        placeholder="URL da imagem (opcional)"
                        className="w-full px-2 py-1.5 rounded-md bg-background border border-border/50 text-xs"
                      />

                      <input
                        type="text"
                        value={card.title}
                        onChange={(e) => {
                          const next = [...carouselCards];
                          next[cIdx].title = e.target.value;
                          setCarouselCards(next);
                        }}
                        placeholder="Título do card"
                        className="w-full px-2 py-1.5 rounded-md bg-background border border-border/50 text-xs"
                      />

                      <input
                        type="text"
                        value={card.description}
                        onChange={(e) => {
                          const next = [...carouselCards];
                          next[cIdx].description = e.target.value;
                          setCarouselCards(next);
                        }}
                        placeholder="Descrição (opcional)"
                        className="w-full px-2 py-1.5 rounded-md bg-background border border-border/50 text-xs"
                      />

                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-muted-foreground">Botões:</label>
                        {(card.buttons || []).length < 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...carouselCards];
                              next[cIdx].buttons = [...(card.buttons || []), { id: crypto.randomUUID(), type: 'reply', label: '', value: '' }];
                              setCarouselCards(next);
                            }}
                            className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary"
                          >
                            <Plus className="w-2 h-2 inline" />
                          </button>
                        )}
                      </div>

                      {(card.buttons || []).map((btn, bIdx) => (
                        <div key={btn.id} className="flex items-center gap-1 pl-2">
                          <select
                            value={btn.type}
                            onChange={(e) => {
                              const next = [...carouselCards];
                              next[cIdx].buttons[bIdx].type = e.target.value as MessageButton['type'];
                              setCarouselCards(next);
                            }}
                            className="px-1 py-0.5 rounded bg-background border border-border/50 text-[10px]"
                          >
                            <option value="reply">Resposta</option>
                            <option value="url">URL</option>
                            <option value="phone">Telefone</option>
                            <option value="copy">Copiar Texto</option>
                          </select>
                          <input
                            type="text"
                            value={btn.label}
                            onChange={(e) => {
                              const next = [...carouselCards];
                              next[cIdx].buttons[bIdx].label = e.target.value;
                              setCarouselCards(next);
                            }}
                            placeholder="Label"
                            className="flex-1 px-1 py-0.5 rounded bg-background border border-border/50 text-[10px]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...carouselCards];
                              next[cIdx].buttons = card.buttons.filter((_, i) => i !== bIdx);
                              setCarouselCards(next);
                            }}
                            className="p-0.5 text-destructive"
                          >
                            <X className="w-2 h-2" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground bg-purple-500/5 border border-purple-500/20 rounded-md p-2">
                  🎠 Carrossel - vários cards em sequência com imagem e botões.
                </p>
              </div>
            )}

            {/* Contact editor */}
            {mediaType === 'contact' && (
              <div className="space-y-3 animate-fade-in">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Nome do Contato</label>
                    <input
                      type="text"
                      value={btnTitle}
                      onChange={(e) => setBtnTitle(e.target.value)}
                      placeholder="Ex: Suporte BemCash"
                      className="w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Número do Contato</label>
                    <input
                      type="text"
                      value={btnFooter}
                      onChange={(e) => setBtnFooter(e.target.value)}
                      placeholder="Ex: {{numero}} ou +5511999999999"
                      className="w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  💡 Envia um cartão de contato (vCard) que o usuário pode salvar facilmente.
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
                      : mediaType === 'contact'
                        ? `Olá {{primeiro_nome}}, segue o contato que você solicitou:`
                        : `Legenda da ${mediaType === 'image' ? 'imagem' : mediaType === 'audio' ? 'áudio' : mediaType === 'video' ? 'vídeo' : 'documento'} (opcional)`
              }
              className="w-full h-36 p-4 rounded-xl bg-muted/50 border border-border/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 scrollbar-thin"
            />

            <MessageComposerExtras
              onInsertText={(t) => setNewMessage((prev) => prev + t)}
              onMediaReady={({ url, type, filename }) => {
                setMediaType(type);
                setMediaUrl(url);
                if (filename) setMediaFilename(filename);
              }}
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
              {editingMessageId ? 'Atualizar' : 'Adicionar'} {mediaType === 'text' ? 'Mensagem' : `Mensagem com ${mediaType === 'image' ? 'Imagem' : mediaType === 'audio' ? 'Áudio' : mediaType === 'video' ? 'Vídeo' : 'Documento'}`}
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
                        onClick={() => moveMessage(index, index - 1)}
                        disabled={index === 0}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Mover para cima"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveMessage(index, index + 1)}
                        disabled={index === messages.length - 1}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Mover para baixo"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingMessageId(msg.id);
                          setNewMessage(msg.content);
                          setMediaType(msg.mediaType || 'text');
                          setMediaUrl(msg.mediaUrl || '');
                          setMediaFilename(msg.mediaFilename || '');
                          setBtnTitle(msg.btnTitle || '');
                          setBtnFooter(msg.btnFooter || '');
                          setButtons(msg.buttons || []);
                          setLinkUrl(msg.linkUrl || '');
                          toast.info('Modo de edição ativado');
                        }}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Editar mensagem"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
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
                    {mediaType === 'image' && mediaUrl && (
                      <div className="mb-3">
                        <img
                          src={mediaUrl}
                          alt="Prévia da imagem"
                          className="w-full max-h-64 object-contain rounded-lg border border-border/50 bg-muted/30"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    {mediaType === 'video' && mediaUrl && (
                      <div className="mb-3">
                        <video
                          src={mediaUrl}
                          controls
                          className="w-full max-h-48 rounded-lg border border-border/50 bg-muted/30"
                        />
                      </div>
                    )}
                    {mediaType === 'audio' && mediaUrl && (
                      <div className="mb-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                        <audio src={mediaUrl} controls className="w-full" />
                      </div>
                    )}
                    {mediaType === 'document' && mediaUrl && (
                      <div className="mb-2 p-3 rounded-lg bg-muted/50 border border-border/50 flex items-center gap-3">
                        <FileText className="w-8 h-8 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{mediaFilename || 'documento'}</p>
                          <p className="text-xs text-muted-foreground truncate">{mediaUrl}</p>
                        </div>
                      </div>
                    )}
                    {mediaType === 'buttons' && btnTitle && (
                      <p className="text-xs font-bold uppercase tracking-wide mb-1">{btnTitle}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">
                      {replaceVariables(newMessage, previewIndex)}
                    </p>
                    {mediaType === 'contact' && (
                      <div className="mb-3 p-3 rounded-lg bg-muted/50 border border-border/50 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Phone className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{replaceVariables(btnTitle || 'Nome do Contato', previewIndex)}</p>
                          <p className="text-xs text-muted-foreground truncate">{replaceVariables(btnFooter || 'Número', previewIndex)}</p>
                        </div>
                        <div className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">vCard</div>
                      </div>
                    )}

                    {mediaType === 'link' && linkUrl && (
                      <a href={linkUrl} target="_blank" rel="noreferrer" className="block mt-2 text-xs text-primary underline break-all">
                        {linkUrl}
                      </a>
                    )}
                    {mediaType === 'buttons' && buttons.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                        {buttons.map((b) => (
                          b.type === 'url' ? (
                            <a
                              key={b.id}
                              href={b.value || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-2 px-3 rounded-md bg-background border border-border/50 text-xs text-center font-medium text-primary flex items-center justify-center gap-1.5 hover:bg-primary/10 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {b.label || `Abrir link`}
                            </a>
                          ) : (
                          <div key={b.id} className="w-full py-2 px-3 rounded-md bg-background border border-border/50 text-xs text-center font-medium text-primary flex items-center justify-center gap-1.5">
                            {b.type === 'phone' && <Phone className="w-3 h-3" />}
                            {b.type === 'reply' && <MessageSquare className="w-3 h-3" />}
                            {b.label || `Botão ${b.type}`}
                          </div>
                          )
                        ))}
                        {btnFooter && <p className="text-[10px] text-muted-foreground text-center mt-2">{btnFooter}</p>}
                      </div>
                    )}
                    {(mediaType === 'image' || mediaType === 'video' || mediaType === 'document') && buttons.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                        {buttons.map((b) => (
                          b.type === 'url' ? (
                            <a
                              key={b.id}
                              href={b.value || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-2 px-3 rounded-md bg-background border border-border/50 text-xs text-center font-medium text-primary flex items-center justify-center gap-1.5 hover:bg-primary/10 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {b.label || `Abrir link`}
                            </a>
                          ) : (
                          <div key={b.id} className="w-full py-2 px-3 rounded-md bg-background border border-border/50 text-xs text-center font-medium text-primary flex items-center justify-center gap-1.5">
                            {b.type === 'phone' && <Phone className="w-3 h-3" />}
                            {b.type === 'reply' && <MessageSquare className="w-3 h-3" />}
                            {b.label || `Botão ${b.type}`}
                          </div>
                          )
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
                    {msg.mediaType === 'contact' && (
                      <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Phone className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{replaceVariables(msg.btnTitle || 'Contato', previewIndex)}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{replaceVariables(msg.btnFooter || '', previewIndex)}</p>
                        </div>
                        <div className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded font-medium uppercase">vCard</div>
                      </div>
                    )}

                    {msg.mediaType === 'link' && msg.linkUrl && (
                      <a href={msg.linkUrl} target="_blank" rel="noreferrer" className="block mt-2 text-xs text-primary underline break-all">
                        {msg.linkUrl}
                      </a>
                    )}
                    {msg.mediaType === 'buttons' && msg.buttons && msg.buttons.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                        {msg.buttons.map((b) => (
                          b.type === 'url' ? (
                            <a
                              key={b.id}
                              href={b.value || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-2 px-3 rounded-md bg-background border border-border/50 text-xs text-center font-medium text-primary flex items-center justify-center gap-1.5 hover:bg-primary/10 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {b.label || `Abrir link`}
                            </a>
                          ) : (
                          <div key={b.id} className="w-full py-2 px-3 rounded-md bg-background border border-border/50 text-xs text-center font-medium text-primary flex items-center justify-center gap-1.5">
                            {b.type === 'phone' && <Phone className="w-3 h-3" />}
                            {b.type === 'reply' && <MessageSquare className="w-3 h-3" />}
                            {b.label}
                          </div>
                          )
                        ))}
                        {msg.mediaFilename && <p className="text-[10px] text-muted-foreground text-center mt-2">{msg.mediaFilename}</p>}
                      </div>
                    )}

                    {msg.mediaType === 'list' && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-[10px] text-purple-600 font-medium mb-1">📋 Lista Interativa</p>
                        <div className="text-xs text-muted-foreground">
                          {msg.title && <p className="font-bold">{msg.title}</p>}
                          {msg.buttons && Array.isArray(msg.buttons) && msg.buttons.map((section: any, sIdx: number) => (
                            <div key={sIdx} className="mt-2">
                              <p className="font-medium text-purple-600">{section.title}</p>
                              {section.rows?.map((row: any, rIdx: number) => (
                                <p key={rIdx} className="pl-2 text-muted-foreground">• {row.title}</p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.mediaType === 'carousel' && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-[10px] text-purple-600 font-medium mb-1">🎠 Carrossel ({msg.buttons?.length || 0} cards)</p>
                        <div className="text-xs text-muted-foreground">
                          {msg.buttons && Array.isArray(msg.buttons) && msg.buttons.map((card: any, cIdx: number) => (
                            <div key={cIdx} className="mt-1 p-2 rounded bg-muted/30">
                              <p className="font-medium">{card.title || `Card ${cIdx + 1}`}</p>
                              {card.description && <p className="text-muted-foreground">{card.description}</p>}
                              {card.buttons?.length > 0 && (
                                <p className="text-[10px] mt-1">{card.buttons.length} botão(ões)</p>
                              )}
                            </div>
                          ))}
                        </div>
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

        {/* Floating Follow-up Button */}
        {messages.length > 1 && (
          <button
            onClick={() => setShowFollowUp(true)}
            className="fixed right-6 bottom-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-50"
            title="Follow-up Inteligente"
          >
            <GitBranch className="w-6 h-6" />
          </button>
        )}

        {/* Follow-up Modal */}
        {showFollowUp && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-primary" />
                  Follow-up Inteligente
                </h3>
                <button onClick={() => setShowFollowUp(false)} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <FollowUpSettings
                  config={followUpConfig}
                  onChange={setFollowUpConfig}
                  messages={messages}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
