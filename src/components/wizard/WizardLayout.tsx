import React, { useRef, useState } from 'react';
import { useWizard } from '@/contexts/WizardContext';
import { StepDataEntry } from './steps/StepDataEntry';
import { StepDataReview } from './steps/StepDataReview';
import { StepSettings } from './steps/StepSettings';
import { StepMessages } from './steps/StepMessages';
import { StepInstances } from './steps/StepInstances';
import { StepConfirmation } from './steps/StepConfirmation';
import { SettingsPage } from './SettingsPage';
import { FollowUpSettings } from './FollowUpSettings';
import { Dashboard } from './Dashboard';
import { CampaignScheduler, ScheduledCampaign } from './CampaignScheduler';
import { BlacklistManager } from './BlacklistManager';
import { MessageTemplates } from './MessageTemplates';
import { ABTesting } from './ABTesting';
import { AppSidebar, AppView } from '@/components/AppSidebar';
import { CampaignHistory } from './CampaignHistory';
import {
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Send,
  ChevronDown,
  Check,
  MessageCircle,
  BarChart3,
  Calendar,
  Shield,
  FileText,
  FlaskConical,
  GitBranch,
  Menu,
} from 'lucide-react';
import { ChatwootInbox } from '@/services/chatwoot';

const campaignSections = [
  { id: 'data-entry', title: 'Importar Dados', description: 'Cole ou importe sua lista de contatos' },
  { id: 'data-review', title: 'Revisar e Corrigir', description: 'Valide e edite os dados importados' },
  { id: 'settings', title: 'Configurações', description: 'Defina intervalos e opções de envio' },
  { id: 'followup', title: 'Follow-up', description: 'Configure fluxo inteligente', icon: GitBranch },
  { id: 'templates', title: 'Templates', description: 'Biblioteca de mensagens', icon: FileText },
  { id: 'messages', title: 'Mensagens', description: 'Crie o conteúdo das mensagens' },
  { id: 'ab-testing', title: 'Teste A/B', description: 'Compare variantes', icon: FlaskConical },
  { id: 'instances', title: 'Instâncias', description: 'Escolha os canais de envio' },
  { id: 'schedule', title: 'Agendamento', description: 'Programe campanhas', icon: Calendar },
  { id: 'send', title: 'Enviar', description: 'Revise e inicie o disparo' },
];

export function WizardLayout() {
  const {
    data, messages, selectedInstances, chatwootConnected,
    setChatwootConnected, setChatwootInboxes, chatwootInboxes, selectedInboxId, setSelectedInboxId,
    followUpConfig, setFollowUpConfig, scheduledCampaigns, addScheduledCampaign, cancelScheduledCampaign,
    abTests, addABTest, removeABTest, metrics, getValidCount, addMessage, campaignHistory,
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
      case 'settings': return true;
      case 'messages': return messages.length > 0;
      case 'instances': return selectedInstances.length > 0;
      case 'followup': case 'templates': case 'ab-testing': case 'schedule': return true;
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
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Métricas e estatísticas em tempo real</p>
            </div>
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
            <SettingsPage onInboxesLoaded={handleInboxesLoaded} onConnectionChange={setChatwootConnected} />
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

            {/* Quick nav */}
            <div className="flex flex-wrap gap-1">
              {campaignSections.map(section => (
                <button key={section.id} onClick={() => scrollToSection(section.id)}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    isSectionComplete(section.id) ? 'bg-success/20 text-success' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}>
                  {isSectionComplete(section.id) && <Check className="w-3 h-3 inline mr-1" />}
                  {section.title}
                </button>
              ))}
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

            <section ref={el => sectionRefs.current['settings'] = el} className="scroll-mt-24">
              <SectionHeader title="Configurações de Envio" description="Defina intervalos e opções" isComplete onNext={() => scrollToSection('followup')} />
              <div className="mt-4"><StepSettings /></div>
            </section>

            <section ref={el => sectionRefs.current['followup'] = el} className="scroll-mt-24">
              <SectionHeader title="Follow-up Inteligente" description="Configure fluxo de saudação e resposta" isComplete onNext={() => scrollToSection('templates')} icon={<GitBranch className="w-6 h-6" />} />
              <div className="mt-4 max-w-3xl mx-auto">
                <FollowUpSettings config={followUpConfig} onChange={setFollowUpConfig} />
              </div>
            </section>

            <section ref={el => sectionRefs.current['templates'] = el} className="scroll-mt-24">
              <SectionHeader title="Templates" description="Biblioteca de mensagens reutilizáveis" isComplete onNext={() => scrollToSection('messages')} icon={<FileText className="w-6 h-6" />} />
              <div className="mt-4 max-w-4xl mx-auto">
                <MessageTemplates onUseTemplate={content => addMessage(content)} />
              </div>
            </section>

            <section ref={el => sectionRefs.current['messages'] = el} className="scroll-mt-24">
              <SectionHeader title="Mensagens" description="Crie o conteúdo das mensagens" isComplete={messages.length > 0} onNext={() => scrollToSection('ab-testing')} />
              <div className="mt-4"><StepMessages /></div>
            </section>

            <section ref={el => sectionRefs.current['ab-testing'] = el} className="scroll-mt-24">
              <SectionHeader title="Teste A/B" description="Compare variantes de mensagens" isComplete onNext={() => scrollToSection('instances')} icon={<FlaskConical className="w-6 h-6" />} />
              <div className="mt-4 max-w-4xl mx-auto">
                <ABTesting tests={abTests} onAddTest={addABTest} onRemoveTest={removeABTest} onUseVariant={content => addMessage(content)} />
              </div>
            </section>

            <section ref={el => sectionRefs.current['instances'] = el} className="scroll-mt-24">
              <SectionHeader title="Instâncias" description="Escolha os canais de envio" isComplete={selectedInstances.length > 0} onNext={() => scrollToSection('schedule')} />
              <div className="mt-4"><StepInstances /></div>
            </section>

            <section ref={el => sectionRefs.current['schedule'] = el} className="scroll-mt-24">
              <SectionHeader title="Agendamento" description="Programe campanhas futuras" isComplete onNext={() => scrollToSection('send')} icon={<Calendar className="w-6 h-6" />} />
              <div className="mt-4 max-w-3xl mx-auto">
                <CampaignScheduler scheduledCampaigns={scheduledCampaigns} onSchedule={handleSchedule} onCancel={cancelScheduledCampaign} contactCount={getValidCount()} messageCount={messages.length} />
              </div>
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar currentView={currentView} onViewChange={setCurrentView} />
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-14 flex items-center border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50 px-4 gap-3">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">MessageFlow</span>
            </div>
            {chatwootConnected && (
              <span className="ml-auto text-xs bg-success/20 text-success px-2 py-1 rounded-full flex items-center gap-1">
                <MessageCircle className="w-3 h-3" /> Chatwoot
              </span>
            )}
          </header>
          <main className="flex-1 p-6 overflow-y-auto pb-12">
            {renderView()}
          </main>
        </div>
      </div>
    </SidebarProvider>
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
