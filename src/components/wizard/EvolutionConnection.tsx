import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Link2,
  Unlink,
  Loader2,
  Eye,
  EyeOff,
  QrCode,
  RefreshCw,
  CheckCircle2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  EvolutionCredentials,
  saveEvolutionCredentials,
  loadEvolutionCredentials,
  clearEvolutionCredentials,
  getQRCode,
  getInstanceStatus,
  createInstance,
} from '@/services/evolution';

export function EvolutionConnection() {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [timer, setTimer] = useState(30);
  const timerRef = useRef<NodeJS.Timeout>();
  const pollRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const creds = loadEvolutionCredentials();
    if (creds) {
      setBaseUrl(creds.baseUrl);
      setApiKey(creds.apiKey);
      setInstanceName(creds.instanceName);
      setIsConnected(true);
      checkStatus(creds);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const checkStatus = async (creds: EvolutionCredentials) => {
    try {
      const status = await getInstanceStatus(creds);
      const state = status?.instance?.state || status?.state || '';
      setWhatsappConnected(state === 'open' || state === 'connected');
    } catch {
      setWhatsappConnected(false);
    }
  };

  const handleConnect = async () => {
    if (!baseUrl.trim() || !apiKey.trim() || !instanceName.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    setIsLoading(true);
    const creds: EvolutionCredentials = {
      baseUrl: baseUrl.replace(/\/$/, ''),
      apiKey: apiKey.trim(),
      instanceName: instanceName.trim(),
    };

    try {
      // Try to get status first, if fails try to create
      try {
        await getInstanceStatus(creds);
      } catch {
        await createInstance(creds);
      }
      saveEvolutionCredentials(creds);
      setIsConnected(true);
      toast.success('Conectado à Evolution API!');
      await generateQR(creds);
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearEvolutionCredentials();
    setIsConnected(false);
    setQrCode('');
    setWhatsappConnected(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    toast.success('Desconectado');
  };

  const generateQR = async (creds?: EvolutionCredentials) => {
    const c = creds || loadEvolutionCredentials();
    if (!c) return;
    setIsLoading(true);
    try {
      const qr = await getQRCode(c);
      setQrCode(qr);
      setTimer(30);
      
      // Start countdown
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setQrCode('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Poll for connection
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const status = await getInstanceStatus(c);
          const state = status?.instance?.state || status?.state || '';
          if (state === 'open' || state === 'connected') {
            setWhatsappConnected(true);
            setQrCode('');
            clearInterval(pollRef.current!);
            clearInterval(timerRef.current!);
            toast.success('WhatsApp conectado com sucesso! 🎉');
          }
        } catch {}
      }, 5000);
    } catch (err: any) {
      toast.error(`Erro ao gerar QR: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className={`glass-card p-4 flex items-center justify-between ${whatsappConnected ? 'border-success/30' : isConnected ? 'border-warning/30' : 'border-border/50'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${whatsappConnected ? 'bg-success/10' : 'bg-warning/10'}`}>
            {whatsappConnected ? <Wifi className="w-5 h-5 text-success" /> : <WifiOff className="w-5 h-5 text-warning" />}
          </div>
          <div>
            <p className="font-medium">
              {whatsappConnected ? 'WhatsApp Conectado' : isConnected ? 'Evolution API Conectada' : 'WhatsApp Desconectado'}
            </p>
            <p className="text-xs text-muted-foreground">
              {whatsappConnected ? 'Número vinculado e pronto para uso' : isConnected ? 'Escaneie o QR Code para conectar' : 'Configure a Evolution API'}
            </p>
          </div>
        </div>
        {isConnected && (
          <button onClick={handleDisconnect} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm hover:bg-destructive/20 transition-colors">
            <Unlink className="w-4 h-4" /> Desconectar
          </button>
        )}
      </div>

      {/* Credentials Form */}
      {!isConnected && (
        <div className="glass-card p-6 space-y-4 animate-fade-in">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">URL da Evolution API</label>
            <input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://sua-evolution-api.com"
              className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Nome da Instância</label>
            <input type="text" value={instanceName} onChange={e => setInstanceName(e.target.value)} placeholder="minha-instancia"
              className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">API Key</label>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Sua API Key"
                className="w-full px-4 py-3 pr-12 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button onClick={handleConnect} disabled={isLoading}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</> : <><Link2 className="w-4 h-4" /> Conectar</>}
          </button>
        </div>
      )}

      {/* QR Code Display */}
      {isConnected && !whatsappConnected && (
        <div className="glass-card p-6 space-y-4 animate-fade-in">
          <h3 className="font-medium text-center flex items-center justify-center gap-2">
            <QrCode className="w-5 h-5 text-primary" /> Escaneie o QR Code
          </h3>

          {qrCode ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-64 h-64 bg-white rounded-xl p-3 mx-auto">
                <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-full h-full object-contain" />
              </div>
              <p className="text-sm text-primary font-medium">Expira em {timer} segundos</p>
              <button onClick={() => generateQR()} disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted transition-colors text-sm">
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Gerar Novamente
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">Clique para gerar um novo QR Code</p>
              <button onClick={() => generateQR()} disabled={isLoading}
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 mx-auto">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                Gerar QR Code
              </button>
            </div>
          )}

          {/* Instructions */}
          <div className="space-y-3 pt-4 border-t border-border/30">
            <h4 className="text-sm font-medium text-primary">Como conectar</h4>
            {[
              { step: '1', title: 'Abra o WhatsApp', desc: 'No seu celular, abra o aplicativo WhatsApp.' },
              { step: '2', title: 'Configurações', desc: 'Toque em Configurações → Dispositivos conectados.' },
              { step: '3', title: 'Conectar dispositivo', desc: 'Toque em "Conectar um dispositivo" e escaneie o QR Code.' },
              { step: '4', title: 'Aguarde', desc: 'Após escanear, aguarde a confirmação da conexão.' },
            ].map(item => (
              <div key={item.step} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">{item.step}</div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connected success */}
      {whatsappConnected && (
        <div className="glass-card p-6 text-center space-y-3 animate-fade-in border-success/30">
          <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
          <h3 className="font-semibold text-lg">WhatsApp Conectado!</h3>
          <p className="text-sm text-muted-foreground">Seu número está vinculado e pronto para enviar mensagens.</p>
          <button onClick={() => checkStatus(loadEvolutionCredentials()!)}
            className="text-sm text-primary hover:underline flex items-center gap-1 mx-auto">
            <RefreshCw className="w-3 h-3" /> Verificar status
          </button>
        </div>
      )}
    </div>
  );
}
