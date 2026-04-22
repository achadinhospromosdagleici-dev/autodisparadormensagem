import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Campaign } from '@/components/wizard/CampaignHistory';
import { ActiveCampaign } from '@/components/wizard/ActiveCampaigns';
import { ScheduledCampaign } from '@/components/wizard/CampaignScheduler';
import { ABTest } from '@/components/wizard/ABTesting';
import { FollowUpConfig } from '@/components/wizard/FollowUpSettings';
import { CampaignMetrics } from '@/components/wizard/Dashboard';
import { ChatwootInbox } from '@/services/chatwoot';

export interface DataRow {
  id: string;
  numero: string;
  isValid: boolean;
  errorMessage?: string;
  [key: string]: string | boolean | undefined;
}

export interface Message {
  id: string;
  content: string;
  aiVariations?: string[];
  mediaType?: 'text' | 'image' | 'audio' | 'video' | 'document' | 'buttons' | 'link';
  mediaUrl?: string;
  mediaCaption?: string;
  mediaFilename?: string;
  // Botões interativos (Evolution sendButtons) ou link "mascarado" no texto
  buttons?: MessageButton[];
  // Para tipo 'link': URL clicável anexada ao texto
  linkUrl?: string;
}

export interface MessageButton {
  id: string;
  type: 'url' | 'phone' | 'reply';
  label: string;          // Texto do botão (max 20 chars recomendado)
  value: string;          // URL, telefone (com DDI) ou ID de resposta
}

export interface Instance {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'pending';
  phoneNumber?: string;
}

export interface WizardSettings {
  hasHeader: boolean;
  intervalType: 'fixed' | 'random';
  fixedInterval: number;
  minInterval: number;
  maxInterval: number;
  sendType: 'single' | 'multiple';
  useAI: boolean;
  messageRandomization: 'random' | 'sequential';
  instanceRandomization: boolean;
}

interface WizardState {
  currentStep: number;
  data: DataRow[];
  columns: string[];
  messages: Message[];
  instances: Instance[];
  selectedInstances: string[];
  settings: WizardSettings;
  campaignHistory: Campaign[];
  // New features
  chatwootConnected: boolean;
  unoApiConnected: boolean;
  chatwootInboxes: ChatwootInbox[];
  selectedInboxId: number | null;
  followUpConfig: FollowUpConfig;
  scheduledCampaigns: ScheduledCampaign[];
  abTests: ABTest[];
  metrics: CampaignMetrics;
  activeCampaigns: ActiveCampaign[];
}

interface WizardContextType extends WizardState {
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setData: (data: DataRow[]) => void;
  setColumns: (columns: string[]) => void;
  updateRow: (id: string, updates: Partial<DataRow>) => void;
  deleteRow: (id: string) => void;
  deleteRows: (ids: string[]) => void;
  addMessage: (content: string, media?: { mediaType?: Message['mediaType']; mediaUrl?: string; mediaCaption?: string; mediaFilename?: string }) => void;
  updateMessage: (id: string, content: string) => void;
  deleteMessage: (id: string) => void;
  setSettings: (settings: Partial<WizardSettings>) => void;
  addInstance: (instance: Instance) => void;
  toggleInstanceSelection: (id: string) => void;
  selectAllInstances: () => void;
  deselectAllInstances: () => void;
  getValidCount: () => number;
  getInvalidCount: () => number;
  addCampaign: (campaign: Campaign) => void;
  reuseCampaign: (campaign: Campaign) => void;
  // New
  setChatwootConnected: (connected: boolean) => void;
  setUnoApiConnected: (connected: boolean) => void;
  setChatwootInboxes: (inboxes: ChatwootInbox[]) => void;
  setSelectedInboxId: (id: number | null) => void;
  setFollowUpConfig: (config: FollowUpConfig) => void;
  addScheduledCampaign: (campaign: ScheduledCampaign) => void;
  cancelScheduledCampaign: (id: string) => void;
  addABTest: (test: ABTest) => void;
  removeABTest: (id: string) => void;
  updateMetrics: (metrics: Partial<CampaignMetrics>) => void;
  addActiveCampaign: (campaign: ActiveCampaign) => void;
  updateActiveCampaign: (id: string, updates: Partial<ActiveCampaign>) => void;
  removeActiveCampaign: (id: string) => void;
}

const defaultSettings: WizardSettings = {
  hasHeader: true,
  intervalType: 'random',
  fixedInterval: 5,
  minInterval: 3,
  maxInterval: 10,
  sendType: 'single',
  useAI: false,
  messageRandomization: 'random',
  instanceRandomization: true,
};

const defaultFollowUpConfig: FollowUpConfig = {
  enabled: false,
  mode: 'greeting-then-all',
  greetingMessageIndex: 0,
  waitForReplyTimeout: 30,
  maxRetries: 1,
  retryInterval: 60,
};

const defaultMetrics: CampaignMetrics = {
  totalSent: 4800,
  totalDelivered: 4650,
  totalFailed: 150,
  totalReplied: 1240,
  totalOptOut: 23,
  deliveryRate: 96.9,
  replyRate: 25.8,
  failRate: 3.1,
  avgResponseTime: '12min',
  campaignCount: 3,
};

const defaultInstances: Instance[] = [
  { id: '1', name: 'Instância Principal', status: 'active', phoneNumber: '+55 11 99999-0001' },
  { id: '2', name: 'Instância Backup', status: 'inactive', phoneNumber: '+55 11 99999-0002' },
  { id: '3', name: 'Marketing', status: 'pending' },
];

const sampleCampaignHistory: Campaign[] = [
  {
    id: '1',
    name: 'Black Friday 2024',
    date: new Date('2024-11-29T14:30:00'),
    totalContacts: 1500,
    sentCount: 1450,
    successCount: 1420,
    failedCount: 30,
    messages: ['Olá {{nome}}! 🎉 Aproveite 50% OFF em todos os produtos!', 'Ei {{nome}}, última chance! Desconto especial só até meia-noite!'],
    status: 'completed',
  },
  {
    id: '2',
    name: 'Natal - Promoção',
    date: new Date('2024-12-20T10:00:00'),
    totalContacts: 2000,
    sentCount: 1800,
    successCount: 1750,
    failedCount: 50,
    messages: ['{{nome}}, o Natal chegou! 🎄 Confira nossas ofertas especiais.'],
    status: 'partial',
  },
  {
    id: '3',
    name: 'Ano Novo',
    date: new Date('2024-12-31T08:00:00'),
    totalContacts: 500,
    sentCount: 500,
    successCount: 495,
    failedCount: 5,
    messages: ['Feliz Ano Novo, {{nome}}! 🎆 Que 2025 seja incrível!'],
    status: 'completed',
  },
];

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    data: [],
    columns: ['numero'],
    messages: [],
    instances: defaultInstances,
    selectedInstances: ['1'],
    settings: defaultSettings,
    campaignHistory: sampleCampaignHistory,
    chatwootConnected: false,
    unoApiConnected: false,
    chatwootInboxes: [],
    selectedInboxId: null,
    followUpConfig: defaultFollowUpConfig,
    scheduledCampaigns: [],
    abTests: [],
    metrics: defaultMetrics,
    activeCampaigns: [],
  });

  const setCurrentStep = (step: number) => setState(prev => ({ ...prev, currentStep: Math.max(1, Math.min(6, step)) }));
  const nextStep = () => setCurrentStep(state.currentStep + 1);
  const prevStep = () => setCurrentStep(state.currentStep - 1);
  const setData = (data: DataRow[]) => setState(prev => ({ ...prev, data }));
  const setColumns = (columns: string[]) => setState(prev => ({ ...prev, columns }));
  const updateRow = (id: string, updates: Partial<DataRow>) => setState(prev => ({ ...prev, data: prev.data.map(row => (row.id === id ? { ...row, ...updates } : row)) }));
  const deleteRow = (id: string) => setState(prev => ({ ...prev, data: prev.data.filter(row => row.id !== id) }));
  const deleteRows = (ids: string[]) => setState(prev => ({ ...prev, data: prev.data.filter(row => !ids.includes(row.id)) }));

  const addMessage = (content: string, media?: { mediaType?: Message['mediaType']; mediaUrl?: string; mediaCaption?: string; mediaFilename?: string }) => {
    setState(prev => ({ ...prev, messages: [...prev.messages, { id: crypto.randomUUID(), content, ...media }] }));
  };
  const updateMessage = (id: string, content: string) => setState(prev => ({ ...prev, messages: prev.messages.map(msg => msg.id === id ? { ...msg, content } : msg) }));
  const deleteMessage = (id: string) => setState(prev => ({ ...prev, messages: prev.messages.filter(msg => msg.id !== id) }));
  const setSettings = (settings: Partial<WizardSettings>) => setState(prev => ({ ...prev, settings: { ...prev.settings, ...settings } }));
  const addInstance = (instance: Instance) => setState(prev => ({ ...prev, instances: [...prev.instances, instance] }));
  const toggleInstanceSelection = (id: string) => setState(prev => ({ ...prev, selectedInstances: prev.selectedInstances.includes(id) ? prev.selectedInstances.filter(i => i !== id) : [...prev.selectedInstances, id] }));
  const selectAllInstances = () => setState(prev => ({ ...prev, selectedInstances: prev.instances.filter(i => i.status === 'active').map(i => i.id) }));
  const deselectAllInstances = () => setState(prev => ({ ...prev, selectedInstances: [] }));
  const getValidCount = () => state.data.filter(row => row.isValid).length;
  const getInvalidCount = () => state.data.filter(row => !row.isValid).length;
  const addCampaign = (campaign: Campaign) => setState(prev => ({ ...prev, campaignHistory: [campaign, ...prev.campaignHistory] }));
  const reuseCampaign = (campaign: Campaign) => {
    const restoredMessages = campaign.messages.map(content => ({ id: crypto.randomUUID(), content }));
    setState(prev => ({ ...prev, messages: restoredMessages, currentStep: 4 }));
  };

  // New functions
  const setChatwootConnected = (connected: boolean) => setState(prev => ({ ...prev, chatwootConnected: connected }));
  const setUnoApiConnected = (connected: boolean) => setState(prev => ({ ...prev, unoApiConnected: connected }));
  const setChatwootInboxes = (inboxes: ChatwootInbox[]) => setState(prev => ({ ...prev, chatwootInboxes: inboxes }));
  const setSelectedInboxId = (id: number | null) => setState(prev => ({ ...prev, selectedInboxId: id }));
  const setFollowUpConfig = (config: FollowUpConfig) => setState(prev => ({ ...prev, followUpConfig: config }));
  const addScheduledCampaign = (campaign: ScheduledCampaign) => setState(prev => ({ ...prev, scheduledCampaigns: [...prev.scheduledCampaigns, campaign] }));
  const cancelScheduledCampaign = (id: string) => setState(prev => ({ ...prev, scheduledCampaigns: prev.scheduledCampaigns.map(c => c.id === id ? { ...c, status: 'cancelled' as const } : c) }));
  const addABTest = (test: ABTest) => setState(prev => ({ ...prev, abTests: [...prev.abTests, test] }));
  const removeABTest = (id: string) => setState(prev => ({ ...prev, abTests: prev.abTests.filter(t => t.id !== id) }));
  const updateMetrics = (metrics: Partial<CampaignMetrics>) => setState(prev => ({ ...prev, metrics: { ...prev.metrics, ...metrics } }));
  const addActiveCampaign = (campaign: ActiveCampaign) => setState(prev => ({ ...prev, activeCampaigns: [campaign, ...prev.activeCampaigns] }));
  const updateActiveCampaign = (id: string, updates: Partial<ActiveCampaign>) => setState(prev => ({ ...prev, activeCampaigns: prev.activeCampaigns.map(c => c.id === id ? { ...c, ...updates } : c) }));
  const removeActiveCampaign = (id: string) => setState(prev => ({ ...prev, activeCampaigns: prev.activeCampaigns.filter(c => c.id !== id) }));

  return (
    <WizardContext.Provider value={{
      ...state,
      setCurrentStep, nextStep, prevStep, setData, setColumns, updateRow, deleteRow, deleteRows,
      addMessage, updateMessage, deleteMessage, setSettings, addInstance, toggleInstanceSelection,
      selectAllInstances, deselectAllInstances, getValidCount, getInvalidCount, addCampaign, reuseCampaign,
      setChatwootConnected, setUnoApiConnected, setChatwootInboxes, setSelectedInboxId, setFollowUpConfig,
      addScheduledCampaign, cancelScheduledCampaign, addABTest, removeABTest, updateMetrics,
      addActiveCampaign, updateActiveCampaign, removeActiveCampaign,
    }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) throw new Error('useWizard must be used within a WizardProvider');
  return context;
}
