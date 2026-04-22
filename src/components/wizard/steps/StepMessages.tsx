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
} from 'lucide-react';
import { toast } from 'sonner';

type EditorMediaType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'buttons' | 'link';

export function StepMessages() {
  const { messages, columns, addMessage, updateMessage, deleteMessage, settings, data } =
    useWizard();
  const [newMessage, setNewMessage] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [mediaType, setMediaType] = useState<MediaType>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFilename, setMediaFilename] = useState('');

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
    if (!newMessage.trim() && mediaType === 'text') {
      toast.error('Digite uma mensagem');
      return;
    }
    if (mediaType !== 'text' && !mediaUrl.trim()) {
      toast.error('Informe a URL da mídia');
      return;
    }

    addMessage(newMessage.trim(), {
      mediaType,
      mediaUrl: mediaType !== 'text' ? mediaUrl.trim() : undefined,
      mediaCaption: mediaType !== 'text' ? newMessage.trim() : undefined,
      mediaFilename: mediaType === 'document' ? mediaFilename.trim() || undefined : undefined,
    });
    setNewMessage('');
    setMediaUrl('');
    setMediaFilename('');
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
    { type: 'text' as MediaType, icon: MessageSquare, label: 'Texto' },
    { type: 'image' as MediaType, icon: Image, label: 'Imagem' },
    { type: 'audio' as MediaType, icon: FileAudio, label: 'Áudio' },
    { type: 'video' as MediaType, icon: Video, label: 'Vídeo' },
    { type: 'document' as MediaType, icon: FileText, label: 'Documento' },
  ];

  const mediaIcon = (type?: string) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'audio': return '🎵';
      case 'video': return '📹';
      case 'document': return '📄';
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
              <div className="flex gap-1.5">
                {mediaTypeConfig.map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => setMediaType(type)}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
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

            {/* Media URL Input */}
            {mediaType !== 'text' && (
              <div className="space-y-3 animate-fade-in">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Link className="w-3.5 h-3.5" />
                    URL da {mediaType === 'image' ? 'imagem' : mediaType === 'audio' ? 'áudio' : mediaType === 'video' ? 'vídeo' : 'documento'}
                  </label>
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder={`https://exemplo.com/${mediaType === 'image' ? 'foto.jpg' : mediaType === 'audio' ? 'audio.mp3' : mediaType === 'video' ? 'video.mp4' : 'arquivo.pdf'}`}
                    className="w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
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
              </div>
            )}

            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={mediaType === 'text'
                ? `Olá {{nome}}! \n\nTemos uma oferta especial do {{produto}} para você.\n\nEntre em contato para saber mais!`
                : `Legenda da ${mediaType === 'image' ? 'imagem' : mediaType === 'audio' ? '' : mediaType === 'video' ? 'vídeo' : 'documento'} (opcional)`
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
                    {mediaType !== 'text' && mediaUrl && (
                      <div className="mb-2 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground flex items-center gap-1">
                        <Link className="w-3 h-3" /> {mediaUrl}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">
                      {replaceVariables(newMessage, previewIndex)}
                    </p>
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
                    <p className="text-sm whitespace-pre-wrap">
                      {replaceVariables(msg.content, previewIndex)}
                    </p>
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
