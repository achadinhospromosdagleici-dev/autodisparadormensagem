import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Link2,
  Unlink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ChatwootCredentials,
  ChatwootInbox,
  saveChatwootCredentials,
  loadChatwootCredentials,
  clearChatwootCredentials,
  fetchInboxes,
} from '@/services/chatwoot';

interface ChatwootSettingsProps {
  onInboxesLoaded: (inboxes: ChatwootInbox[]) => void;
  onConnectionChange: (connected: boolean) => void;
}

export function ChatwootSettings({ onInboxesLoaded, onConnectionChange }: ChatwootSettingsProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inboxes, setInboxes] = useState<ChatwootInbox[]>([]);

  useEffect(() => {
    const creds = loadChatwootCredentials();
    if (creds) {
      setBaseUrl(creds.baseUrl);
      setApiToken(creds.apiToken);
      setAccountId(String(creds.accountId));
      setIsConnected(true);
      onConnectionChange(true);
      handleLoadInboxes(creds);
    }
  }, []);

  const handleLoadInboxes = async (creds: ChatwootCredentials) => {
    try {
      const loadedInboxes = await fetchInboxes(creds);
      setInboxes(loadedInboxes);
      onInboxesLoaded(loadedInboxes);
    } catch (err) {
      console.error('Error loading inboxes:', err);
    }
  };

  const handleConnect = async () => {
    if (!baseUrl.trim() || !apiToken.trim() || !accountId.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsLoading(true);
    const creds: ChatwootCredentials = {
      baseUrl: baseUrl.replace(/\/$/, ''),
      apiToken: apiToken.trim(),
      accountId: parseInt(accountId),
    };

    try {
      const loadedInboxes = await fetchInboxes(creds);
      saveChatwootCredentials(creds);
      setInboxes(loadedInboxes);
      setIsConnected(true);
      onInboxesLoaded(loadedInboxes);
      onConnectionChange(true);
      toast.success(`Conectado! ${loadedInboxes.length} caixa(s) de entrada encontrada(s).`);
    } catch (err) {
      toast.error('Falha ao conectar. Verifique as credenciais.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearChatwootCredentials();
    setIsConnected(false);
    setInboxes([]);
    onInboxesLoaded([]);
    onConnectionChange(false);
    toast.success('Desconectado do Chatwoot');
  };

  const handleRefreshInboxes = async () => {
    const creds = loadChatwootCredentials();
    if (!creds) return;
    setIsLoading(true);
    try {
      await handleLoadInboxes(creds);
      toast.success('Caixas de entrada atualizadas');
    } catch {
      toast.error('Erro ao atualizar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className={`glass-card p-4 flex items-center justify-between ${isConnected ? 'border-success/30' : 'border-warning/30'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConnected ? 'bg-success/10' : 'bg-warning/10'}`}>
            <MessageCircle className={`w-5 h-5 ${isConnected ? 'text-success' : 'text-warning'}`} />
          </div>
          <div>
            <p className="font-medium">{isConnected ? 'Chatwoot Conectado' : 'Chatwoot Desconectado'}</p>
            <p className="text-xs text-muted-foreground">
              {isConnected ? `${inboxes.length} caixa(s) de entrada disponível(is)` : 'Configure suas credenciais para conectar'}
            </p>
          </div>
        </div>
        {isConnected ? (
          <button onClick={handleDisconnect} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm hover:bg-destructive/20 transition-colors">
            <Unlink className="w-4 h-4" />
            Desconectar
          </button>
        ) : (
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-success' : 'bg-warning'} animate-pulse`} />
        )}
      </div>

      {/* Credentials Form */}
      {!isConnected && (
        <div className="glass-card p-6 space-y-4 animate-fade-in">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">URL do Chatwoot</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://seu-chatwoot.com"
              className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">ID da Conta</label>
            <input
              type="number"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="1"
              className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">API Access Token</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Seu token de acesso"
                className="w-full px-4 py-3 pr-12 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Conectar ao Chatwoot
              </>
            )}
          </button>

          <div className="glass-card p-3 border-muted bg-muted/20">
            <p className="text-xs text-muted-foreground">
              ⚠️ As credenciais são salvas localmente no navegador. Para uso em produção, recomenda-se utilizar um backend seguro.
            </p>
          </div>
        </div>
      )}

      {/* Inboxes List */}
      {isConnected && inboxes.length > 0 && (
        <div className="glass-card p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Inbox className="w-4 h-4 text-primary" />
              Caixas de Entrada Disponíveis
            </h4>
            <button
              onClick={handleRefreshInboxes}
              disabled={isLoading}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="grid gap-2">
            {inboxes.map((inbox) => (
              <div key={inbox.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <div>
                    <p className="text-sm font-medium">{inbox.name}</p>
                    <p className="text-xs text-muted-foreground">{inbox.channel_type} {inbox.phone_number ? `• ${inbox.phone_number}` : ''}</p>
                  </div>
                </div>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">ID: {inbox.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
