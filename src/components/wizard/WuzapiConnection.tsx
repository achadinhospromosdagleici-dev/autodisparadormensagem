import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Plus,
  RefreshCw,
  WifiOff,
  Trash2,
  Loader2,
  X,
  Smartphone,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  WuzapiInstanceDb,
  loadWuzapiSettings,
  loadWuzapiInstances,
  saveWuzapiInstance,
  updateWuzapiInstance,
  deleteWuzapiInstance,
  createUser,
  connect,
  getStatus,
  getQRCode,
  disconnect,
  logout,
  deleteUser,
  WuzapiStatus,
} from '@/services/wuzapi';

interface WuzapiConnectionProps {
  onInstancesChange?: () => void;
}

export function WuzapiConnection({ onInstancesChange }: WuzapiConnectionProps) {
  const [instances, setInstances] = useState<WuzapiInstanceDb[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [creatingInstance, setCreatingInstance] = useState(false);

  const [qrModalInstance, setQrModalInstance] = useState<WuzapiInstanceDb | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'waiting' | 'connecting' | 'connected' | 'error'>('waiting');
  const [qrPolling, setQrPolling] = useState<ReturnType<typeof setInterval> | null>(null);

  const loadInstances = useCallback(async () => {
    const settings = await loadWuzapiSettings();
    if (!settings) return;

    const insts = await loadWuzapiInstances();
    setInstances(insts);

    for (const inst of insts) {
      if (inst.status === 'connected' || inst.status === 'connecting') {
        try {
          const status = await getStatus(settings.baseUrl, inst.user_token);
          if (status.loggedIn) {
            await updateWuzapiInstance(inst.id, { status: 'connected' });
          } else {
            await updateWuzapiInstance(inst.id, { status: 'disconnected' });
          }
        } catch {
          await updateWuzapiInstance(inst.id, { status: 'disconnected' });
        }
      }
    }

    const updatedInsts = await loadWuzapiInstances();
    setInstances(updatedInsts);
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast.error('Informe o nome da instância');
      return;
    }

    const settings = await loadWuzapiSettings();
    if (!settings) {
      toast.error('Configure a WuzAPI primeiro nas Configurações');
      return;
    }
    if (!settings.baseUrl || !settings.adminToken) {
      toast.error('URL base ou token admin da WuzAPI não configurados');
      return;
    }

    setCreatingInstance(true);

    try {
      const wuzapiUser = await createUser(settings.baseUrl, settings.adminToken, newInstanceName.trim());

      const inst = await saveWuzapiInstance(
        settings.id!,
        wuzapiUser.token,
        newInstanceName.trim()
      );

      if (inst) {
        setInstances(prev => [inst, ...prev]);
        setShowNewModal(false);
        setNewInstanceName('');
        toast.success('Instância criada! Escaneie o QR Code para conectar.');
        
        setQrModalInstance(inst);
        setQrError(null);
        setConnectionStatus('waiting');
        startQrPolling(inst, settings.baseUrl);
      }
    } catch (error: any) {
      toast.error('Erro ao criar instância: ' + (error.message || 'Desconhecido'));
    } finally {
      setCreatingInstance(false);
    }
  };

  const startQrPolling = async (inst: WuzapiInstanceDb, baseUrl: string) => {
    setQrLoading(true);
    setQrPolling(existing => {
      if (existing) clearInterval(existing);
      return null;
    });

    try {
      await connect(baseUrl, inst.user_token);
      const qr = await getQRCode(baseUrl, inst.user_token);
      setQrCode(qr);
      setQrError(null);

      const pollInterval = setInterval(async () => {
        try {
          const status = await getStatus(baseUrl, inst.user_token);
          if (status.loggedIn) {
            setConnectionStatus('connected');
            clearInterval(pollInterval);
            setQrPolling(null);
            await updateWuzapiInstance(inst.id, { status: 'connected', connected_at: new Date().toISOString() });
            await loadInstances();
            setTimeout(() => {
              setQrModalInstance(null);
              toast.success('WhatsApp conectado com sucesso!');
            }, 1500);
          } else {
            const newQr = await getQRCode(baseUrl, inst.user_token);
            if (newQr) {
              setQrCode(newQr);
            }
          }
        } catch (err) {
          console.error('[WuzapiConnection] Polling error:', err);
        }
      }, 5000);

      setQrPolling(pollInterval);
    } catch (error: any) {
      setQrError(error.message || 'Erro ao obter QR Code');
      setQrCode(null);
    } finally {
      setQrLoading(false);
    }
  };

  const handleConnect = async (inst: WuzapiInstanceDb) => {
    const settings = await loadWuzapiSettings();
    if (!settings) {
      toast.error('Configure a WuzAPI primeiro');
      return;
    }
    if (!settings.baseUrl) {
      toast.error('URL base da WuzAPI não configurada');
      return;
    }
    if (!inst.user_token) {
      toast.error('Token da instância não disponível. Crie uma nova instância.');
      return;
    }

    setQrModalInstance(inst);
    setQrError(null);
    setConnectionStatus('waiting');
    startQrPolling(inst, settings.baseUrl);
  };

  const handleDisconnect = async (inst: WuzapiInstanceDb) => {
    const settings = await loadWuzapiSettings();
    if (!settings?.baseUrl) return;
    if (!inst.user_token) {
      toast.error('Token da instância não disponível');
      return;
    }

    try {
      await disconnect(settings.baseUrl, inst.user_token);
      await updateWuzapiInstance(inst.id, { status: 'disconnected' });
      await loadInstances();
      toast.success('Instância desconectada');
    } catch (error: any) {
      toast.error('Erro ao desconectar: ' + (error.message || 'Desconhecido'));
    }
  };

  const handleLogout = async (inst: WuzapiInstanceDb) => {
    const settings = await loadWuzapiSettings();
    if (!settings?.baseUrl) return;
    if (!inst.user_token) {
      toast.error('Token da instância não disponível');
      return;
    }

    try {
      await logout(settings.baseUrl, inst.user_token);
      await updateWuzapiInstance(inst.id, { status: 'disconnected' });
      await loadInstances();
      toast.success('Sessão removida. Escaneie o QR novamente.');
    } catch (error: any) {
      toast.error('Erro ao fazer logout: ' + (error.message || 'Desconhecido'));
    }
  };

  const handleDelete = async (inst: WuzapiInstanceDb) => {
    if (!confirm(`Excluir instância "${inst.name}"?`)) return;

    const settings = await loadWuzapiSettings();
    if (settings?.baseUrl) {
      try {
        await logout(settings.baseUrl, inst.user_token);
      } catch {}
    }

    try {
      await deleteWuzapiInstance(inst.id);
      setInstances(prev => prev.filter(i => i.id !== inst.id));
      onInstancesChange?.();
      toast.success('Instância removida');
    } catch (error: any) {
      toast.error('Erro ao remover instância: ' + (error.message || 'Desconhecido'));
    }
  };

  const closeQrModal = () => {
    if (qrPolling) {
      clearInterval(qrPolling);
      setQrPolling(null);
    }
    setQrModalInstance(null);
    setQrCode(null);
    setQrError(null);
    loadInstances();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Instâncias WuzAPI</h3>
          <span className="text-xs text-muted-foreground">({instances.length})</span>
        </div>

        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nova Instância
        </button>
      </div>

      {instances.length === 0 ? (
        <div className="p-6 text-center rounded-lg border border-dashed border-border/50">
          <MessageCircle className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma instância WuzAPI</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Configure a WuzAPI nas Configurações primeiro
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {instances.map(inst => (
            <div
              key={inst.id}
              className={`p-3 rounded-lg bg-muted/30 border ${
                inst.status === 'connected' ? 'border-success/30 bg-success/[0.02]' : 'border-border/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {inst.status === 'connected' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success/15 text-success border border-success/25">
                      <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      Online
                    </span>
                  ) : inst.status === 'connecting' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/15 text-warning border border-warning/25">
                      <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                      Conectando
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/50">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                      Offline
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-medium">{inst.name}</p>
                    {inst.phone && (
                      <p className="text-xs text-muted-foreground">{inst.phone}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {inst.status !== 'connected' ? (
                    <button
                      type="button"
                      onClick={() => handleConnect(inst)}
                      className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Conectar (QR Code)"
                    >
                      <Smartphone className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDisconnect(inst)}
                      className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Desconectar"
                    >
                      <WifiOff className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleLogout(inst)}
                    className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Remover sessão"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(inst)}
                    className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Nova Instância WuzAPI
              </h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="p-1 rounded-md hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1.5">
                  Nome da Instância
                </label>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="Ex: Zap Marketing"
                  className="w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  maxLength={50}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border/50 hover:bg-muted text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateInstance}
                  disabled={creatingInstance}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium disabled:opacity-50"
                >
                  {creatingInstance ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    'Criar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {qrModalInstance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl shadow-lg w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                {qrModalInstance.name}
              </h3>
              <button
                type="button"
                onClick={closeQrModal}
                className="p-1 rounded-md hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {connectionStatus === 'connected' ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-2" />
                <p className="text-green-500 font-medium">Conectado!</p>
              </div>
            ) : (
              <>
                {qrLoading && (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                  </div>
                )}

                {qrError && (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
                    <p className="text-sm text-red-500">{qrError}</p>
                  </div>
                )}

                {qrCode && !qrLoading && (
                  <div className="text-center">
                    <div className="bg-white p-4 rounded-lg inline-block mb-4">
                      <img
                        src={qrCode}
                        alt="QR Code"
                        className="w-48 h-48 mx-auto"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Escaneie com WhatsApp
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}