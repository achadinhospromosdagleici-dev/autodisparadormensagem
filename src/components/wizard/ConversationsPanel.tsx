import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Send,
  Image,
  Video,
  Audio,
  FileText,
  Phone,
  MoreVertical,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getConversations,
  getMessages,
  markConversationAsRead,
  subscribeToMessages,
  subscribeToConversations,
  Conversation,
  Message,
} from '@/services/messages';
import { loadEvolutionCredentials } from '@/services/evolution';
import { cn } from '@/lib/utils';

interface ConversationsPanelProps {
  instanceName: string;
  onClose: () => void;
}

export function ConversationsPanel({ instanceName, onClose }: ConversationsPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConversations();
    
    const unsubscribeConversations = subscribeToConversations(instanceName, (conv) => {
      setConversations(prev => {
        const exists = prev.find(c => c.id === conv.id);
        if (exists) {
          return prev.map(c => c.id === conv.id ? conv : c);
        }
        return [conv, ...prev];
      });
    });

    return () => {
      unsubscribeConversations();
    };
  }, [instanceName]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      markConversationAsRead(selectedConversation.id);
      
      const unsubscribe = subscribeToMessages(selectedConversation.id, (msg) => {
        setMessages(prev => [...prev, msg]);
        setConversations(prev => prev.map(c => 
          c.id === selectedConversation.id 
            ? { ...c, last_message_preview: msg.content, last_message_at: msg.timestamp }
            : c
        ));
      });

      return () => unsubscribe();
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    setLoading(true);
    const convs = await getConversations(instanceName);
    setConversations(convs);
    setLoading(false);
  };

  const loadMessages = async (conversationId: string) => {
    const msgs = await getMessages(conversationId);
    setMessages(msgs);
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.contact_name?.toLowerCase().includes(query) ||
      conv.phone_number.includes(query)
    );
  });

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Ontem';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('pt-BR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  const getMessageIcon = (type: string | null) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Audio className="w-4 h-4" />;
      case 'document': return <FileText className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl h-[80vh] bg-background rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/80">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">Conversas</h3>
              <p className="text-xs text-muted-foreground">{instanceName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={loadConversations}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Conversations List */}
          <div className={cn(
            "w-80 border-r border-border/50 flex flex-col",
            selectedConversation && "hidden md:flex"
          )}>
            {/* Search */}
            <div className="p-3 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar conversa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma mensagem recebida ainda'}
                  </p>
                </div>
              ) : (
                filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={cn(
                      "w-full p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors border-b border-border/30",
                      selectedConversation?.id === conv.id && "bg-primary/10"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">
                          {conv.contact_name || conv.phone_number}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.last_message_preview || 'Inicie uma conversa'}
                      </p>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Messages */}
          <div className={cn(
            "flex-1 flex flex-col",
            !selectedConversation && "hidden md:flex"
          )}>
            {!selectedConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Selecione uma conversa para ver as mensagens</p>
              </div>
            ) : (
              <>
                {/* Message Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="md:hidden p-2 rounded-lg hover:bg-muted/50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {selectedConversation.contact_name || selectedConversation.phone_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedConversation.phone_number}
                      </p>
                    </div>
                  </div>
                  <button className="p-2 rounded-lg hover:bg-muted/50">
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg, index) => {
                    const showAvatar = index === 0 || messages[index - 1]?.from_me !== msg.from_me;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.from_me ? "justify-end" : "justify-start"
                        )}
                      >
                        <div className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2",
                          msg.from_me 
                            ? "bg-primary text-primary-foreground rounded-br-md" 
                            : "bg-muted rounded-bl-md"
                        )}>
                          {msg.media_url && (
                            <div className="mb-2">
                              {msg.message_type === 'image' && (
                                <img 
                                  src={msg.media_url} 
                                  alt="" 
                                  className="rounded-lg max-w-full" 
                                />
                              )}
                              {msg.message_type === 'video' && (
                                <video 
                                  src={msg.media_url} 
                                  controls 
                                  className="rounded-lg max-w-full" 
                                />
                              )}
                              {msg.message_type === 'audio' && (
                                <audio 
                                  src={msg.media_url} 
                                  controls 
                                  className="w-full" 
                                />
                              )}
                              {msg.message_type === 'document' && (
                                <div className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
                                  <FileText className="w-4 h-4" />
                                  <span className="text-sm">Documento</span>
                                </div>
                              )}
                              {msg.media_caption && (
                                <p className="mt-2">{msg.media_caption}</p>
                              )}
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={cn(
                            "text-[10px] mt-1",
                            msg.from_me ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && (
                    <div className="text-center text-muted-foreground text-sm">
                      Nenhuma mensagem ainda
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}