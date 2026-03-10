import React, { useState } from 'react';
import { MessageCircle, Smartphone, Bot, Settings, ChevronRight, Zap } from 'lucide-react';
import { ChatwootSettings } from './ChatwootSettings';
import { EvolutionConnection } from './EvolutionConnection';
import { UnoApiSettings } from './UnoApiSettings';
import { ChatwootInbox } from '@/services/chatwoot';

interface SettingsPageProps {
  onInboxesLoaded: (inboxes: ChatwootInbox[]) => void;
  onConnectionChange: (connected: boolean) => void;
  onUnoApiConnectionChange: (connected: boolean) => void;
}

type SettingsTab = 'unoapi' | 'chatwoot' | 'evolution' | 'ai-gateway';

const tabs = [
  { id: 'unoapi' as SettingsTab, label: 'UnoAPI', icon: Zap, desc: 'Envio via WhatsApp Cloud API (texto, mídia, docs)' },
  { id: 'chatwoot' as SettingsTab, label: 'Chatwoot', icon: MessageCircle, desc: 'Integração com Chatwoot para envio e monitoramento' },
  { id: 'evolution' as SettingsTab, label: 'WhatsApp / Evolution', icon: Smartphone, desc: 'Conectar número WhatsApp via Evolution API' },
  { id: 'ai-gateway' as SettingsTab, label: 'AI Gateway', icon: Bot, desc: 'Configurar IA para variação de mensagens' },
];

export function SettingsPage({ onInboxesLoaded, onConnectionChange, onUnoApiConnectionChange }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('unoapi');

  return (
    <div className="space-y-6">
      {/* Tab selector */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`glass-card p-4 text-left transition-all ${
              activeTab === tab.id ? 'border-primary/50 bg-primary/5' : 'hover:border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeTab === tab.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                <tab.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{tab.label}</p>
                <p className="text-xs text-muted-foreground truncate">{tab.desc}</p>
              </div>
              {activeTab === tab.id && <ChevronRight className="w-4 h-4 text-primary shrink-0" />}
            </div>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="animate-fade-in">
        {activeTab === 'unoapi' && <UnoApiSettings onConnectionChange={onUnoApiConnectionChange} />}
        {activeTab === 'chatwoot' && (
          <ChatwootSettings onInboxesLoaded={onInboxesLoaded} onConnectionChange={onConnectionChange} />
        )}
        {activeTab === 'evolution' && <EvolutionConnection />}
        {activeTab === 'ai-gateway' && <AIGatewaySettings />}
      </div>
    </div>
  );
}

function AIGatewaySettings() {
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    localStorage.setItem('ai_gateway_config', JSON.stringify({ provider, apiKey, model }));
    import('sonner').then(({ toast }) => toast.success('Configuração salva!'));
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('ai_gateway_config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setProvider(config.provider || 'openai');
        setApiKey(config.apiKey || '');
        setModel(config.model || 'gpt-4o-mini');
      } catch {}
    }
  }, []);

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Bot className="w-6 h-6 text-primary" />
        <div>
          <h3 className="font-semibold">AI Gateway</h3>
          <p className="text-xs text-muted-foreground">Configure a IA para variação inteligente de mensagens</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Provedor</label>
        <select value={provider} onChange={e => setProvider(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="groq">Groq</option>
          <option value="ollama">Ollama (Local)</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">API Key</label>
        <div className="relative">
          <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..."
            className="w-full px-4 py-3 pr-12 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showKey ? <span className="text-xs">🙈</span> : <span className="text-xs">👁️</span>}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Modelo</label>
        <select value={model} onChange={e => setModel(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50">
          {provider === 'openai' && <>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </>}
          {provider === 'anthropic' && <>
            <option value="claude-3-haiku">Claude 3 Haiku</option>
            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
          </>}
          {provider === 'groq' && <>
            <option value="llama3-8b">Llama 3 8B</option>
            <option value="mixtral-8x7b">Mixtral 8x7B</option>
          </>}
          {provider === 'ollama' && <>
            <option value="llama3">Llama 3</option>
            <option value="mistral">Mistral</option>
          </>}
        </select>
      </div>

      <button onClick={handleSave}
        className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
        Salvar Configuração
      </button>

      <div className="glass-card p-3 border-muted bg-muted/20">
        <p className="text-xs text-muted-foreground">
          ⚠️ A API Key é usada para gerar variações de mensagens com IA, evitando bloqueios por mensagens repetidas.
        </p>
      </div>
    </div>
  );
}
