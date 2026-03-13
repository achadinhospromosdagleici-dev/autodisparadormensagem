import React, { useState, useEffect } from 'react';
import {
  Link2,
  Unlink,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Wifi,
  WifiOff,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  UnoApiCredentials,
  UnoApiInstance,
  saveUnoApiCredentials,
  loadUnoApiCredentials,
  clearUnoApiCredentials,
  testConnection,
  fetchInstances,
} from '@/services/unoapi';

interface UnoApiSettingsProps {
  onConnectionChange: (connected: boolean) => void;
}

export function UnoApiSettings({ onConnectionChange }: UnoApiSettingsProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [instances, setInstances] = useState<UnoApiInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);

  useEffect(() => {
    const creds = loadUnoApiCredentials();
    if (creds) {
      setBaseUrl(creds.baseUrl);
      setToken(creds.token);
      setIsConnected(true);
      onConnectionChange(true);
      checkOnline(creds);
      loadInstances(creds);
    }
  }, []);

  const checkOnline = async (creds: UnoApiCredentials) => {
    const online = await testConnection(creds);
    setIsOnline(online);
  };

  const loadInstances = async (creds: UnoApiCredentials) => {
    setLoadingInstances(true);
    const result = await fetchInstances(creds);
    setInstances(result);
    setLoadingInstances(false);
  };

  const handleConnect = async () => {
    if (!baseUrl.trim() || !token.trim()) {
      toast.error('Preencha URL e Token');
      return;
    }

    setIsLoading(true);
    const creds: UnoApiCredentials = {
      baseUrl: baseUrl.replace(/\/$/, ''),
      token: token.trim(),
    };

    try {
      const online = await testConnection(creds);
      saveUnoApiCredentials(creds);
      setIsConnected(true);
      setIsOnline(online);
      onConnectionChange(true);
      
      if (online) {
        await loadInstances(creds);
        toast.success('Conectado à UnoAPI! ✅');
      } else {
        toast.success('Credenciais salvas (servidor não respondeu ao ping)');
      }
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearUnoApiCredentials();
    setIsConnected(false);
    setIsOnline(false);
    setInstances([]);
    onConnectionChange(false);
    toast.success('Desconectado da UnoAPI');
  };

  const handleCheckStatus = async () => {
    const creds = loadUnoApiCredentials();
    if (!creds) return;
    setIsLoading(true);
    const online = await testConnection(creds);
    setIsOnline(online);
    if (online) await loadInstances(creds);
    toast[online ? 'success' : 'error'](online ? 'UnoAPI online!' : 'UnoAPI offline');
    setIsLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className={`glass-card p-4 flex items-center justify-between ${isOnline ? 'border-success/30' : isConnected ? 'border-warning/30' : 'border-border/50'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOnline ? 'bg-success/10' : isConnected ? 'bg-warning/10' : 'bg-muted'}`}>
            {isOnline ? <Wifi className="w-5 h-5 text-success" /> : <WifiOff className="w-5 h-5 text-warning" />}
          </div>
          <div>
            <p className="font-medium">
              {isOnline ? 'UnoAPI Online' : isConnected ? 'UnoAPI Configurada' : 'UnoAPI Desconectada'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isOnline
                ? `${instances.length} número(s) conectado(s)`
                : isConnected ? 'Servidor pode estar offline' : 'Configure para enviar mensagens via WhatsApp'}
            </p>
          </div>
        </div>
        {isConnected && (
          <div className="flex items-center gap-2">
            <button onClick={handleCheckStatus} disabled={isLoading}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleDisconnect}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm hover:bg-destructive/20 transition-colors">
              <Unlink className="w-4 h-4" /> Desconectar
            </button>
          </div>
        )}
      </div>

      {/* Credentials Form */}
      {!isConnected && (
        <div className="glass-card p-6 space-y-4 animate-fade-in">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">URL da UnoAPI</label>
            <input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://sua-unoapi.com"
              className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Token de Autorização</label>
            <div className="relative">
              <input type={showToken ? 'text' : 'password'} value={token} onChange={e => setToken(e.target.value)}
                placeholder="Seu token de acesso"
                className="w-full px-4 py-3 pr-12 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <button type="button" onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button onClick={handleConnect} disabled={isLoading}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</> : <><Link2 className="w-4 h-4" /> Conectar à UnoAPI</>}
          </button>

          <div className="glass-card p-3 border-muted bg-muted/20">
            <p className="text-xs text-muted-foreground">
              💡 Apenas URL e Token são necessários. Os números conectados serão buscados automaticamente da sua UnoAPI.
            </p>
          </div>
        </div>
      )}

      {/* Connected numbers list */}
      {isConnected && (
        <div className="glass-card p-6 space-y-3 animate-fade-in border-success/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-success" />
              <h3 className="font-semibold">Números Conectados</h3>
            </div>
            <button onClick={() => { const c = loadUnoApiCredentials(); if (c) loadInstances(c); }}
              disabled={loadingInstances}
              className="text-xs text-primary hover:underline flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${loadingInstances ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {loadingInstances ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Buscando números...</span>
            </div>
          ) : instances.length > 0 ? (
            <div className="space-y-2">
              {instances.map((inst) => (
                <div key={inst.phone} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/20">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    inst.status === 'connected' ? 'bg-success/10' : 'bg-destructive/10'
                  }`}>
                    <Phone className={`w-4 h-4 ${
                      inst.status === 'connected' ? 'text-success' : 'text-destructive'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{inst.phone}</p>
                    {inst.name && <p className="text-xs text-muted-foreground">{inst.name}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    inst.status === 'connected'
                      ? 'bg-success/10 text-success'
                      : 'bg-destructive/10 text-destructive'
                  }`}>
                    {inst.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Phone className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Nenhum número encontrado.</p>
              <p className="text-xs mt-1">Conecte um número via <code className="bg-muted px-1 rounded">/session/NUMERO</code> na sua UnoAPI.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm pt-2">
            {[
              { label: '📝 Texto', desc: 'Mensagens com variáveis' },
              { label: '🖼️ Imagem', desc: 'Fotos com legenda' },
              { label: '🎵 Áudio', desc: 'Mensagens de voz' },
              { label: '📹 Vídeo', desc: 'Vídeos com legenda' },
              { label: '📄 Documento', desc: 'PDFs e arquivos' },
              { label: '🔗 Contato', desc: 'Verificação de contatos' },
            ].map(item => (
              <div key={item.label} className="p-2 rounded-lg bg-muted/30 border border-border/20">
                <p className="font-medium text-xs">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
