import React, { useRef, useState } from 'react';
import { useWizard } from '@/contexts/WizardContext';
import { StepDataEntry } from './steps/StepDataEntry';
import { StepDataReview } from './steps/StepDataReview';
import { StepSettings } from './steps/StepSettings';
import { StepMessages } from './steps/StepMessages';
import { StepInstances } from './steps/StepInstances';
import { StepConfirmation } from './steps/StepConfirmation';
import { SettingsPage } from './SettingsPage';
import { Dashboard } from './Dashboard';
import { CampaignScheduler, ScheduledCampaign } from './CampaignScheduler';
import { BlacklistManager } from './BlacklistManager';
import { AppSidebar, AppView } from '@/components/AppSidebar';
import { CampaignHistory } from './CampaignHistory';
import { ActiveCampaigns } from './ActiveCampaigns';
import {
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Send,
  ChevronDown,
  Check,
  Calendar,
} from 'lucide-react';
import { ChatwootInbox } from '@/services/chatwoot';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

const campaignSections = [
  { id: 'data-entry', title: 'Importar Dados', description: 'Cole ou importe sua lista de contatos' },
  { id: 'data-review', title: 'Revisar e Corrigir', description: 'Valide e edite os dados importados' },
  { id: 'messages', title: 'Mensagens', description: 'Crie o conteúdo das mensagens' },
  { id: 'instances', title: 'Instâncias', description: 'Escolha os canais de envio' },
  { id: 'settings', title: 'Configurações', description: 'Defina intervalos e opções de envio' },
];

export function WizardLayout() {
  const {
    data, messages, selectedInstances, chatwootConnected, unoApiConnected,
    setChatwootConnected, setUnoApiConnected, setChatwootInboxes, chatwootInboxes, selectedInboxId, setSelectedInboxId,
    scheduledCampaigns, addScheduledCampaign, cancelScheduledCampaign,
    metrics, getValidCount, addMessage, campaignHistory,
    activeCampaigns, updateActiveCampaign, removeActiveCampaign,
  } = useWizard();
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [currentView, setCurrentView] = useState<AppView>('campaign');

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isSectionComplete = (id: string) => {
    switch (id) {
      case 'data-entry': return data.length > 0;
      case 'data-review': return data.some(row => row.isValid);
      case 'messages': return messages.length > 0;
      case 'instances': return selectedInstances.length > 0;
      case 'settings': return true;
      default: return false;
    }
  };

  const handleSchedule = (campaign: Omit<ScheduledCampaign, 'id' | 'status'>) => {
    addScheduledCampaign({ ...campaign, id: crypto.randomUUID(), status: 'scheduled' });
  };

  const handleInboxesLoaded = (inboxes: ChatwootInbox[]) => {
    setChatwootInboxes(inboxes);
    if (inboxes.length > 0 && !selectedInboxId) setSelectedInboxId(inboxes[0].id);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <ActiveCampaigns
              campaigns={activeCampaigns}
              onPause={(id) => updateActiveCampaign(id, { status: 'paused' })}
              onResume={(id) => updateActiveCampaign(id, { status: 'running' })}
              onCancel={(id) => updateActiveCampaign(id, { status: 'cancelled' })}
              onResend={(id) => updateActiveCampaign(id, { status: 'running', sentCount: 0, failedCount: 0 })}
              onNewCampaign={() => setCurrentView('campaign')}
            />
            <Dashboard metrics={metrics} />
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Configurações</h1>
              <p className="text-sm text-muted-foreground">Chatwoot, WhatsApp, AI Gateway</p>
            </div>
            <SettingsPage onInboxesLoaded={handleInboxesLoaded} onConnectionChange={setChatwootConnected} onUnoApiConnectionChange={setUnoApiConnected} />
            {chatwootConnected && chatwootInboxes.length > 0 && (
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-sm font-medium">Caixa de Entrada para Disparos</h4>
                <select value={selectedInboxId ?? ''} onChange={e => setSelectedInboxId(parseInt(e.target.value))}
                  className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {chatwootInboxes.map(inbox => (
                    <option key={inbox.id} value={inbox.id}>{inbox.name} ({inbox.channel_type})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );

      case 'history':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Histórico de Campanhas</h1>
              <p className="text-sm text-muted-foreground">Todas as campanhas enviadas</p>
            </div>
            <CampaignHistory campaigns={campaignHistory} onReuse={() => {}} />
          </div>
        );

      case 'blacklist':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Blacklist / Opt-out</h1>
              <p className="text-sm text-muted-foreground">Gerencie números bloqueados</p>
            </div>
            <BlacklistManager />
          </div>
        );

      case 'campaign':
      default:
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold">Nova Campanha</h1>
              <p className="text-sm text-muted-foreground">Configure e envie mensagens em massa</p>
            </div>

            {/* Sections */}
            <section ref={el => sectionRefs.current['data-entry'] = el} className="scroll-mt-24">
              <SectionHeader title="Importar Dados" description="Cole ou importe sua lista de contatos" isComplete={data.length > 0} onNext={() => scrollToSection('data-review')} />
              <div className="mt-4"><StepDataEntry /></div>
            </section>

            <section ref={el => sectionRefs.current['data-review'] = el} className="scroll-mt-24">
              <SectionHeader title="Revisar e Corrigir" description="Valide e edite os dados importados" isComplete={data.some(r => r.isValid)} onNext={() => scrollToSection('settings')} disabled={data.length === 0} />
              <div className={`mt-4 ${data.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}><StepDataReview /></div>
            </section>

            <section ref={el => sectionRefs.current['messages'] = el} className="scroll-mt-24">
              <SectionHeader title="Mensagens" description="Crie o conteúdo das mensagens" isComplete={messages.length > 0} onNext={() => scrollToSection('instances')} />
              <div className="mt-4"><StepMessages /></div>
            </section>

            <section ref={el => sectionRefs.current['instances'] = el} className="scroll-mt-24">
              <SectionHeader title="Instâncias" description="Escolha os canais de envio" isComplete={selectedInstances.length > 0} onNext={() => scrollToSection('settings')} />
              <div className="mt-4"><StepInstances /></div>
            </section>

            <section ref={el => sectionRefs.current['settings'] = el} className="scroll-mt-24">
              <SectionHeader title="Configurações de Envio" description="Defina intervalos e opções" isComplete onNext={() => scrollToSection('send')} />
              <div className="mt-4"><StepSettings /></div>
            </section>

            <section ref={el => sectionRefs.current['send'] = el} className="scroll-mt-24">
              <SectionHeader title="Enviar" description="Revise e inicie o disparo" isComplete={false} isLast />
              <div className="mt-4"><StepConfirmation /></div>
            </section>
          </div>
        );
    }
  };

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar currentView={currentView} onViewChange={setCurrentView} />
          <div className="flex-1 flex flex-col min-h-screen">
            <header className="h-14 flex items-center border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50 px-4 gap-3">
              <SidebarTrigger />

              {currentView === 'campaign' && (
                <>
                  <div className="flex items-center gap-1">
                    {campaignSections.map((section, index) => {
                      const isComplete = isSectionComplete(section.id);
                      return (
                        <TooltipPrimitive.Root key={section.id}>
                          <TooltipPrimitive.Trigger asChild>
                            <button
                              onClick={() => scrollToSection(section.id)}
                              className={cn(
                                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                                isComplete 
                                  ? 'bg-success text-success-foreground' 
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              )}
                            >
                              {index + 1}
                            </button>
                          </TooltipPrimitive.Trigger>
                          <TooltipPrimitive.Portal>
                            <TooltipPrimitive.Content
                              sideOffset={5}
                              className="bg-foreground text-background px-2 py-1 rounded text-xs font-medium z-[100]"
                            >
                              {section.title}
                              <TooltipPrimitive.Arrow className="fill-foreground" />
                            </TooltipPrimitive.Content>
                          </TooltipPrimitive.Portal>
                        </TooltipPrimitive.Root>
                      );
                    })}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="font-semibold text-sm text-primary">Nexia</span>
                  </div>
                </>
              )}
            </header>
            <main className="flex-1 p-6 overflow-y-auto pb-12">
              {renderView()}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </TooltipPrimitive.Provider>
  );
}

interface SectionHeaderProps {
  title: string;
  description: string;
  isComplete: boolean;
  onNext?: () => void;
  disabled?: boolean;
  isLast?: boolean;
  icon?: React.ReactNode;
}

function SectionHeader({ title, description, isComplete, onNext, disabled, isLast, icon }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold transition-colors ${
          isComplete ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'
        }`}>
          {isComplete ? <Check className="w-6 h-6" /> : icon || <Send className="w-5 h-5" />}
        </div>
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {!isLast && onNext && (
        <button onClick={onNext} disabled={disabled}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            disabled ? 'bg-muted/30 text-muted-foreground cursor-not-allowed' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}>
          Próximo <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
