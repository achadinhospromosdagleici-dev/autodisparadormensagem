import React, { useState } from 'react';
import { useWizard } from '@/contexts/WizardContext';
import {
  MessageSquare,
  Plus,
  Trash2,
  Eye,
  Sparkles,
  Copy,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';

export function StepMessages() {
  const { messages, columns, addMessage, updateMessage, deleteMessage, settings, data } =
    useWizard();
  const [newMessage, setNewMessage] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);

  const variables = columns.map((col) => `{{${col}}}`);

  const insertVariable = (variable: string) => {
    setNewMessage((prev) => prev + variable);
  };

  const handleAddMessage = () => {
    if (!newMessage.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }
    addMessage(newMessage.trim());
    setNewMessage('');
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

    return result;
  };

  const previewRow = data[previewIndex] || data[0];

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
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Olá {{nome}}! 

Temos uma oferta especial do {{produto}} para você.

Entre em contato para saber mais!`}
              className="w-full h-48 p-4 rounded-xl bg-muted/50 border border-border/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 scrollbar-thin"
            />

            <button
              onClick={handleAddMessage}
              disabled={!newMessage.trim()}
              className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                newMessage.trim()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 glow-effect'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              Adicionar Mensagem
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
                      Nova mensagem (prévia)
                    </p>
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
                      Mensagem {index + 1}
                    </p>
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
