import React, { useState, useEffect } from 'react';
import { useWizard, Instance } from '@/contexts/WizardContext';
import {
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  Shuffle,
  Check,
  Loader2,
  RefreshCw,
  WifiOff,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  loadUnoApiCredentials,
  fetchInstances,
  UnoApiInstance,
} from '@/services/unoapi';

export function StepInstances() {
  const {
    instances,
    selectedInstances,
    toggleInstanceSelection,
    selectAllInstances,
    deselectAllInstances,
    settings,
    setSettings,
    unoApiConnected,
  } = useWizard();

  const [unoInstances, setUnoInstances] = useState<UnoApiInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Fetch UnoAPI instances on mount
  useEffect(() => {
    if (unoApiConnected) {
      loadUnoInstances();
    }
  }, [unoApiConnected]);

  const loadUnoInstances = async () => {
    const creds = loadUnoApiCredentials();
    if (!creds) return;
    setLoading(true);
    const result = await fetchInstances(creds);
    setUnoInstances(result);
    setLoaded(true);
    setLoading(false);
  };

  // Merge UnoAPI instances into wizard instances
  const mergedInstances: Instance[] = unoApiConnected && unoInstances.length > 0
    ? unoInstances.map((ui) => ({
        id: ui.phone,
        name: ui.name || ui.phone,
        status: ui.status === 'connected' ? 'active' as const : 'inactive' as const,
        phoneNumber: ui.phone,
      }))
    : instances;

  const activeInstances = mergedInstances.filter((i) => i.status === 'active');

  const getStatusIcon = (status: Instance['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'inactive':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-warning" />;
    }
  };

  const getStatusLabel = (status: Instance['status']) => {
    switch (status) {
      case 'active':
        return 'Conectado';
      case 'inactive':
        return 'Desconectado';
      case 'pending':
        return 'Pendente';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      {/* UnoAPI info banner */}
      {unoApiConnected && (
        <div className="glass-card p-4 border-primary/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Números da UnoAPI</p>
                <p className="text-sm text-muted-foreground">
                  {loading ? 'Buscando números...' : `${unoInstances.length} número(s) encontrado(s)`}
                </p>
              </div>
            </div>
            <button onClick={loadUnoInstances} disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>
      )}

      {/* Not connected warning */}
      {!unoApiConnected && (
        <div className="glass-card p-4 border-warning/30 bg-warning/5">
          <div className="flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-warning">UnoAPI não conectada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Vá em Configurações → UnoAPI para conectar e buscar seus números automaticamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Randomization Toggle */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shuffle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Randomização de Instâncias</p>
              <p className="text-sm text-muted-foreground">
                Alternar automaticamente entre os números selecionados
              </p>
            </div>
          </div>
          <button
            onClick={() => setSettings({ instanceRandomization: !settings.instanceRandomization })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              settings.instanceRandomization ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
              settings.instanceRandomization ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button onClick={selectAllInstances}
            className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors">
            Selecionar Ativos
          </button>
          <button onClick={deselectAllInstances}
            className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors">
            Limpar Seleção
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Buscando números da UnoAPI...</span>
        </div>
      )}

      {/* Instances Grid */}
      {!loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mergedInstances.map((instance) => {
            const isSelected = selectedInstances.includes(instance.id);
            const isActive = instance.status === 'active';

            return (
              <div
                key={instance.id}
                onClick={() => { if (isActive) toggleInstanceSelection(instance.id); }}
                className={`instance-card ${instance.status} ${isSelected ? 'selected' : ''} ${!isActive ? 'cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      instance.status === 'active' ? 'bg-success/10' :
                      instance.status === 'inactive' ? 'bg-destructive/10' : 'bg-warning/10'
                    }`}>
                      <Smartphone className={`w-5 h-5 ${
                        instance.status === 'active' ? 'text-success' :
                        instance.status === 'inactive' ? 'text-destructive' : 'text-warning'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">{instance.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {instance.phoneNumber || 'Sem número'}
                      </p>
                    </div>
                  </div>
                  {isSelected && isActive && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {getStatusIcon(instance.status)}
                  <span className={`text-sm ${
                    instance.status === 'active' ? 'text-success' :
                    instance.status === 'inactive' ? 'text-destructive' : 'text-warning'
                  }`}>
                    {getStatusLabel(instance.status)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selection Summary */}
      {selectedInstances.length > 0 && (
        <div className="glass-card p-4 border-primary/30 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>
                <strong>{selectedInstances.length}</strong> número(s) selecionado(s)
              </span>
            </div>
            {settings.instanceRandomization && selectedInstances.length > 1 && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Shuffle className="w-4 h-4" />
                Randomização ativa
              </span>
            )}
          </div>
        </div>
      )}

      {/* Warning for no active instances */}
      {!loading && activeInstances.length === 0 && (
        <div className="glass-card p-4 border-warning/30 bg-warning/5">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-warning shrink-0" />
            <div>
              <p className="font-medium text-warning">Nenhum número ativo</p>
              <p className="text-sm text-muted-foreground mt-1">
                {unoApiConnected
                  ? 'Conecte um número na sua UnoAPI para poder enviar mensagens.'
                  : 'Configure a UnoAPI nas Configurações para buscar seus números.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
