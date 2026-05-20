import React, { useState, useEffect } from 'react';
import {
  Link2,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  WuzapiSettings as WuzapiSettingsType,
  testConnection,
  saveWuzapiSettings,
  loadWuzapiSettings,
} from '@/services/wuzapi';

interface WuzapiSettingsProps {
  onConnectionChange: (connected: boolean) => void;
}

export function WuzapiSettings({ onConnectionChange }: WuzapiSettingsProps) {
  const [baseUrl, setBaseUrl] = useState('https://wuzapi.bigcreditos.com.br');
  const [adminToken, setAdminToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [usersCount, setUsersCount] = useState(0);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const settings = await loadWuzapiSettings();
      if (settings) {
        setBaseUrl(settings.base_url);
        setAdminToken(settings.admin_token);
        setIsConnected(true);
        onConnectionChange(true);
        checkOnline(settings.base_url, settings.admin_token);
      }
    }
    load();
  }, []);

  const checkOnline = async (url: string, token: string) => {
    const result = await testConnection(url, token);
    setIsOnline(result.success);
    if (result.success && result.users) {
      setUsersCount(result.users.length);
    }
    return result.success;
  };

  const handleTestConnection = async () => {
    if (!baseUrl.trim()) {
      toast.error('Informe a URL da wuzapi');
      return;
    }
    if (!adminToken.trim()) {
      toast.error('Informe o Admin Token');
      return;
    }

    setIsLoading(true);
    setTestError(null);

    try {
      const success = await checkOnline(baseUrl.trim(), adminToken.trim());
      if (success) {
        toast.success('Conexão estabelecida com sucesso!');
      } else {
        setTestError('Não foi possível conectar. Verifique a URL e o token.');
        toast.error('Falha na conexão');
      }
    } catch (error: any) {
      setTestError(error.message || 'Erro ao testar conexão');
      toast.error('Erro ao testar conexão');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!baseUrl.trim()) {
      toast.error('Informe a URL da wuzapi');
      return;
    }
    if (!adminToken.trim()) {
      toast.error('Informe o Admin Token');
      return;
    }

    setIsLoading(true);

    try {
      const settings = await saveWuzapiSettings(baseUrl.trim(), adminToken.trim());
      if (settings) {
        setIsConnected(true);
        onConnectionChange(true);
        toast.success('Configurações salvas com sucesso!');
      }
    } catch (error: any) {
      toast.error('Erro ao salvar configurações: ' + (error.message || 'Desconhecido'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Configurações WuzAPI</h3>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Link2 className="w-3.5 h-3.5" />
            URL da WuzAPI
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://wuzapi.seudominio.com.br"
            className="w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Wifi className="w-3.5 h-3.5" />
            Admin Token
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="Token_admin_wuzapi"
              className="w-full px-3 py-2.5 pr-10 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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

        {testError && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {testError}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted border border-border/50 text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Testar Conexão
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Salvar
          </button>
        </div>

        {isConnected && (
          <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-500 font-medium">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-500 font-medium">Offline</span>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                • {usersCount} usuário(s) cadastrado(s)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}