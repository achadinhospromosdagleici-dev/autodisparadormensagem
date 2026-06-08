import React, { useState } from 'react';
import { MessageCircle, Smartphone, Bot, Settings, ChevronRight, Zap, Cpu, MessageSquare, Users, Globe, Key, CheckCircle2, AlertCircle } from 'lucide-react';
import { ChatwootSettings } from './ChatwootSettings';
import { EvolutionConnection } from './EvolutionConnection';
import { EvolutionGoConnection } from './EvolutionGoConnection';
import { UnoApiSettings } from './UnoApiSettings';
import { WuzapiSettings } from './WuzapiSettings';
import { WuzapiConnection } from './WuzapiConnection';
import { GroupContacts } from './GroupContacts';
import { ChatwootInbox } from '@/services/chatwoot';
import { api } from '@/lib/api';
import { getCurrentUserId } from '@/lib/jwt';

interface SettingsPageProps {
  onInboxesLoaded: (inboxes: ChatwootInbox[]) => void;
  onConnectionChange: (connected: boolean) => void;
  onUnoApiConnectionChange: (connected: boolean) => void;
}

type SettingsTab = 'unoapi' | 'chatwoot' | 'evolution' | 'evolution-go' | 'wuzapi' | 'ai-gateway' | 'grupos' | 'google-places';

const tabs = [
  { id: 'grupos' as SettingsTab, label: 'Grupos', icon: Users, desc: 'Exportar contatos de grupos do WhatsApp' },
  { id: 'unoapi' as SettingsTab, label: 'UnoAPI', icon: Zap, desc: 'Envio via WhatsApp Cloud API (texto, mídia, docs)' },
  { id: 'chatwoot' as SettingsTab, label: 'Chatwoot', icon: MessageCircle, desc: 'Integração com Chatwoot para envio e monitoramento' },
  { id: 'evolution' as SettingsTab, label: 'Evolution API', icon: Smartphone, desc: 'Conectar número via Evolution API (Node.js)' },
  { id: 'evolution-go' as SettingsTab, label: 'Evolution Go', icon: Cpu, desc: 'Conectar número via Evolution Go (Go)' },
  { id: 'wuzapi' as SettingsTab, label: 'WuzAPI', icon: MessageSquare, desc: 'Conectar número via WuzAPI (Go/WaProto)' },
  { id: 'ai-gateway' as SettingsTab, label: 'AI Gateway', icon: Bot, desc: 'Configurar IA para variação de mensagens' },
  { id: 'google-places' as SettingsTab, label: 'Google Places', icon: Globe, desc: 'API Key para busca de empresas por palavra-chave' },
];

export function SettingsPage({ onInboxesLoaded, onConnectionChange, onUnoApiConnectionChange }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('grupos');

  return (
    <div className="space-y-6">
      {/* Tab selector */}
      <div className="flex flex-wrap gap-3">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`glass-card p-4 text-left transition-all ${
              activeTab === tab.id ? 'border-primary/50 bg-primary/5' : 'hover:border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === tab.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                <tab.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{tab.label}</p>
                <p className="text-xs text-muted-foreground truncate hidden lg:block">{tab.desc}</p>
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
        {activeTab === 'evolution-go' && <EvolutionGoConnection />}
        {activeTab === 'wuzapi' && (
          <div className="space-y-6">
            <WuzapiSettings onConnectionChange={onConnectionChange} />
            <WuzapiConnection />
          </div>
        )}
        {activeTab === 'ai-gateway' && <AIGatewaySettings />}
        {activeTab === 'grupos' && <GroupContacts />}
        {activeTab === 'google-places' && <GooglePlacesSettings />}
      </div>
    </div>
  );
}

function GooglePlacesSettings() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  React.useEffect(() => {
    const { loadGoogleSettings } = require('@/services/googleSettings');
    const current = loadGoogleSettings();
    if (current?.apiKey) setApiKey(current.apiKey);
  }, []);

  async function handleSave() {
    const { saveGoogleSettings } = await import('@/services/googleSettings');
    await saveGoogleSettings({ apiKey: apiKey.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-medium">Google Places API</h3>
          <p className="text-xs text-muted-foreground">
            Chave necessária para buscar empresas por palavra-chave
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Chave da API (Google Places API Key)</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm pr-10"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saved ? 'Salvo ✓' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-lg">
        <p className="font-medium text-foreground">Como obter sua chave:</p>
        <p>1. Acesse <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" className="text-primary hover:underline">Google Cloud Console</a></p>
        <p>2. Crie um projeto e ative a <strong>Places API</strong></p>
        <p>3. Crie uma chave de API (Credentials &gt; Create Credentials &gt; API Key)</p>
        <p className="text-yellow-600">⚠️ A chave pode gerar custos. O Google oferece US$ 200/mês grátis.</p>
      </div>
    </div>
  );
}

function AIGatewaySettings() {
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [showKey, setShowKey] = useState(false);

  React.useEffect(() => {
    async function load() {
      const userId = getCurrentUserId();
      if (!userId) return;
      try {
        const { data } = await api.get('/settings/ai');
        if (data) {
          setProvider(data.provider || 'openai');
          setApiKey(data.api_key || '');
          setModel(data.model || 'gpt-4o-mini');
        }
      } catch {}
    }
    load();
  }, []);

  const handleSave = async () => {
    const userId = getCurrentUserId();
    if (userId) {
      await api.post('/settings/ai', { provider, api_key: apiKey, model });
    }
    import('sonner').then(({ toast }) => toast.success('Configuração salva!'));
  };

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
