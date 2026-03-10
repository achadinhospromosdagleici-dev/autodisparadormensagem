import React, { useState } from 'react';
import { useWizard, Instance } from '@/contexts/WizardContext';
import {
  Smartphone,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Shuffle,
  QrCode,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

export function StepInstances() {
  const {
    instances,
    selectedInstances,
    toggleInstanceSelection,
    selectAllInstances,
    deselectAllInstances,
    addInstance,
    settings,
    setSettings,
  } = useWizard();

  const [showNewInstance, setShowNewInstance] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');

  const handleAddInstance = () => {
    if (!newInstanceName.trim()) {
      toast.error('Digite um nome para a instância');
      return;
    }

    const newInstance: Instance = {
      id: crypto.randomUUID(),
      name: newInstanceName.trim(),
      status: 'pending',
    };

    addInstance(newInstance);
    setNewInstanceName('');
    setShowNewInstance(false);
    toast.success('Instância criada. Escaneie o QR Code para ativar.');
  };

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
        return 'Ativo';
      case 'inactive':
        return 'Inativo';
      case 'pending':
        return 'Pendente';
    }
  };

  const activeInstances = instances.filter((i) => i.status === 'active');

  return (
    <div className="max-w-4xl mx-auto space-y-4">

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
                Alternar automaticamente entre as instâncias selecionadas
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              setSettings({ instanceRandomization: !settings.instanceRandomization })
            }
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              settings.instanceRandomization ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                settings.instanceRandomization ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={selectAllInstances}
            className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors"
          >
            Selecionar Ativos
          </button>
          <button
            onClick={deselectAllInstances}
            className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors"
          >
            Limpar Seleção
          </button>
        </div>
        <button
          onClick={() => setShowNewInstance(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Instância
        </button>
      </div>

      {/* New Instance Form */}
      {showNewInstance && (
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Criar Nova Instância
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Nome da Instância
                </label>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="Ex: Marketing, Vendas, Suporte..."
                  className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAddInstance}
                  className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                >
                  Criar Instância
                </button>
                <button
                  onClick={() => {
                    setShowNewInstance(false);
                    setNewInstanceName('');
                  }}
                  className="px-4 py-3 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-xl border border-dashed border-border">
              <QrCode className="w-16 h-16 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground text-center">
                Após criar, escaneie o QR Code com seu WhatsApp para ativar
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Instances Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {instances.map((instance) => {
          const isSelected = selectedInstances.includes(instance.id);
          const isActive = instance.status === 'active';

          return (
            <div
              key={instance.id}
              onClick={() => {
                if (isActive) {
                  toggleInstanceSelection(instance.id);
                }
              }}
              className={`instance-card ${instance.status} ${
                isSelected ? 'selected' : ''
              } ${!isActive ? 'cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      instance.status === 'active'
                        ? 'bg-success/10'
                        : instance.status === 'inactive'
                        ? 'bg-destructive/10'
                        : 'bg-warning/10'
                    }`}
                  >
                    <Smartphone
                      className={`w-5 h-5 ${
                        instance.status === 'active'
                          ? 'text-success'
                          : instance.status === 'inactive'
                          ? 'text-destructive'
                          : 'text-warning'
                      }`}
                    />
                  </div>
                  <div>
                    <p className="font-medium">{instance.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {instance.phoneNumber || 'Aguardando conexão'}
                    </p>
                  </div>
                </div>
                {isSelected && isActive && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {getStatusIcon(instance.status)}
                  <span
                    className={`text-sm ${
                      instance.status === 'active'
                        ? 'text-success'
                        : instance.status === 'inactive'
                        ? 'text-destructive'
                        : 'text-warning'
                    }`}
                  >
                    {getStatusLabel(instance.status)}
                  </span>
                </div>

                {instance.status === 'pending' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.info('Exibindo QR Code...');
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Ver QR Code
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selection Summary */}
      {selectedInstances.length > 0 && (
        <div className="glass-card p-4 border-primary/30 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>
                <strong>{selectedInstances.length}</strong> instância(s) selecionada(s)
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
      {activeInstances.length === 0 && (
        <div className="glass-card p-4 border-warning/30 bg-warning/5">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-warning shrink-0" />
            <div>
              <p className="font-medium text-warning">Nenhuma instância ativa</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crie e ative pelo menos uma instância para continuar com o envio.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
