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
  Plus,
  X,
  AlertTriangle,
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
  saveManualInstances,
  loadManualInstances,
  clearManualInstances,
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    const creds = loadUnoApiCredentials();
    if (creds) {
      setBaseUrl(creds.baseUrl);
      setToken(creds.token);
      setIsConnected(true);
      onConnectionChange(true);
      checkOnline(creds);
      loadInstancesFromApi(creds);
    }
  }, []);

  const checkOnline = async (creds: UnoApiCredentials) => {
    const online = await testConnection(creds);
    setIsOnline(online);
  };

  const loadInstancesFromApi = async (creds: UnoApiCredentials) => {
    setLoadingInstances(true);
    setFetchError(null);
    const { instances: fetched, error } = await fetchInstances(creds);
    
    if (fetched.length > 0) {
      setInstances(fetched);
      saveManualInstances(fetched);
      setFetchError(null);
    } else {
      // Only show error, don't fallback to manual cache
      setInstances([]);
      if (error) setFetchError(error);
    }
    setLoadingInstances(false);
  };

  const handleAddManualPhone = () => {
    const phone = newPhone.replace(/\D/g, '').trim();
    if (!phone || phone.length < 10) {
      toast.error('Número inválido. Use formato: 5531992127204');
      return;
    }
    if (instances.some(i => i.phone === phone)) {
      toast.error('Número já adicionado');
      return;
    }
    const updated = [...instances, { phone, status: 'connected' as const }];
    setInstances(updated);
    saveManualInstances(updated);
    setNewPhone('');
    toast.success(`Número ${phone} adicionado`);
  };

  const handleRemovePhone = (phone: string) => {
    const updated = instances.filter(i => i.phone !== phone);
    setInstances(updated);
    saveManualInstances(updated);
    toast.success(`Número ${phone} removido`);
  };

  const handleConnect = async () => {
    if (!baseUrl.trim() || !token.trim()) {
      toast.error('Preencha URL e Token');
      return;
    }

    setIsLoading(true);
    
    // Clear old manual instances cache before connecting
    clearManualInstances();
    
    const creds: UnoApiCredentials = {
      baseUrl: baseUrl.replace(/\/$/, ''),
      token: token.trim(),
    };

    try {
      const online = await testConnection(creds);
      saveUnoApiCredentials(creds);
      setIsConnected(true);
      setIsOnline(online);
      setInstances([]); // Clear any old instances
      onConnectionChange(true);
      
      await loadInstancesFromApi(creds);
      
      if (online) {
        toast.success('Conectado à UnoAPI! ✅');
      } else {
        toast.success('Credenciais salvas (tentando buscar números...)');
      }
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearUnoApiCredentials();
    clearManualInstances();
    setIsConnected(false);
    setIsOnline(false);
    setInstances([]);
    setFetchError(null);
    onConnectionChange(false);
    toast.success('Desconectado da UnoAPI');
  };

  const handleCheckStatus = async () => {
    const creds = loadUnoApiCredentials();
    if (!creds) return;
    setIsLoading(true);
    const online = await testConnection(creds);
    setIsOnline(online);
    await loadInstancesFromApi(creds);
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
                ? `${instances.length} número(s) configurado(s)`
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
            <button onClick={() => { 
                clearManualInstances(); // Clear cache first
                const c = loadUnoApiCredentials(); 
                if (c) loadInstancesFromApi(c); 
              }}
              disabled={loadingInstances}
              className="text-xs text-primary hover:underline flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${loadingInstances ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {/* CORS/Error warning */}
          {fetchError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-warning font-medium">{fetchError}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Adicione os números manualmente abaixo. Eles serão usados para envio de campanhas.
                </p>
              </div>
            </div>
          )}

          {loadingInstances ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Buscando números...</span>
            </div>
          ) : (
            <>
              {/* Numbers table */}
              {instances.length > 0 ? (
                <div className="rounded-lg border border-border/30 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/30">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Número</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nome</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instances.map((inst) => (
                        <tr key={inst.phone} className="border-b border-border/10 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <span className="font-mono font-medium">{inst.phone}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
                              inst.status === 'connected'
                                ? 'bg-success/10 text-success'
                                : 'bg-destructive/10 text-destructive'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                inst.status === 'connected' ? 'bg-success' : 'bg-destructive'
                              }`} />
                              {inst.status === 'connected' ? 'online' : 'offline'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {inst.name || '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleRemovePhone(inst.phone)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <Phone className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum número encontrado.</p>
                  <p className="text-xs mt-1">Adicione manualmente abaixo ou verifique sua UnoAPI.</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Exibindo {instances.length} número(s)
              </p>

              {/* Manual add */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddManualPhone()}
                  placeholder="Ex: 5531992127204"
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button onClick={handleAddManualPhone}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </div>
            </>
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
