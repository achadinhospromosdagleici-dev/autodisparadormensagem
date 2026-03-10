import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Link2,
  Unlink,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  UnoApiCredentials,
  saveUnoApiCredentials,
  loadUnoApiCredentials,
  clearUnoApiCredentials,
  testConnection,
} from '@/services/unoapi';

interface UnoApiSettingsProps {
  onConnectionChange: (connected: boolean) => void;
}

export function UnoApiSettings({ onConnectionChange }: UnoApiSettingsProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const creds = loadUnoApiCredentials();
    if (creds) {
      setBaseUrl(creds.baseUrl);
      setToken(creds.token);
      setPhoneNumberId(creds.phoneNumberId);
      setIsConnected(true);
      onConnectionChange(true);
      checkOnline(creds);
    }
  }, []);

  const checkOnline = async (creds: UnoApiCredentials) => {
    const online = await testConnection(creds);
    setIsOnline(online);
  };

  const handleConnect = async () => {
    if (!baseUrl.trim() || !token.trim() || !phoneNumberId.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsLoading(true);
    const creds: UnoApiCredentials = {
      baseUrl: baseUrl.replace(/\/$/, ''),
      token: token.trim(),
      phoneNumberId: phoneNumberId.trim(),
    };

    try {
      const online = await testConnection(creds);
      saveUnoApiCredentials(creds);
      setIsConnected(true);
      setIsOnline(online);
      onConnectionChange(true);
      toast.success(online ? 'Conectado à UnoAPI! ✅' : 'Credenciais salvas (servidor não respondeu ao ping)');
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
    onConnectionChange(false);
    toast.success('Desconectado da UnoAPI');
  };

  const handleCheckStatus = async () => {
    const creds = loadUnoApiCredentials();
    if (!creds) return;
    setIsLoading(true);
    const online = await testConnection(creds);
    setIsOnline(online);
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
              {isOnline ? `Pronto para enviar via ${phoneNumberId}` : isConnected ? 'Servidor pode estar offline' : 'Configure para enviar mensagens via WhatsApp'}
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
            <label className="text-sm text-muted-foreground">Número do WhatsApp (Remetente)</label>
            <input type="text" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)}
              placeholder="5511999990001"
              className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <p className="text-xs text-muted-foreground">Número completo com DDI + DDD, sem espaços ou símbolos</p>
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
              💡 A UnoAPI usa o formato da API oficial do WhatsApp Cloud. Suporta envio de texto, imagem, áudio, vídeo e documentos.
            </p>
          </div>
        </div>
      )}

      {/* Connected info */}
      {isConnected && isOnline && (
        <div className="glass-card p-6 space-y-3 animate-fade-in border-success/30">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-success" />
            <div>
              <h3 className="font-semibold">UnoAPI Pronta!</h3>
              <p className="text-sm text-muted-foreground">Envio de mensagens via WhatsApp habilitado.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: '📝 Texto', desc: 'Mensagens de texto com variáveis' },
              { label: '🖼️ Imagem', desc: 'Fotos e imagens com legenda' },
              { label: '🎵 Áudio', desc: 'Mensagens de voz e áudio' },
              { label: '📹 Vídeo', desc: 'Vídeos com legenda' },
              { label: '📄 Documento', desc: 'PDFs, planilhas e arquivos' },
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
