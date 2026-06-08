import React, { useState } from 'react';
import { History, Calendar, Clock, Users, MessageSquare, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

export interface Campaign {
  id: string;
  name: string;
  date: Date;
  totalContacts: number;
  sentCount: number;
  successCount: number;
  failedCount: number;
  messages: string[];
  status: 'completed' | 'failed' | 'partial';
}

interface CampaignHistoryProps {
  campaigns: Campaign[];
  onReuse: (campaign: Campaign) => void;
}

export function CampaignHistory({ campaigns, onReuse }: CampaignHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState<string>('all');

  // Agrupar campanhas por mês
  const groupedByMonth = campaigns.reduce((acc, campaign) => {
    const monthKey = new Date(campaign.date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(campaign);
    return acc;
  }, {} as Record<string, Campaign[]>);

  const months = Object.keys(groupedByMonth);
  const filteredCampaigns = filterMonth === 'all' 
    ? campaigns 
    : groupedByMonth[filterMonth] || [];

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'completed': return 'text-success bg-success/10';
      case 'failed': return 'text-destructive bg-destructive/10';
      case 'partial': return 'text-warning bg-warning/10';
    }
  };

  const getStatusLabel = (status: Campaign['status']) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'failed': return 'Falhou';
      case 'partial': return 'Parcial';
    }
  };

  if (campaigns.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <History className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
        <h3 className="font-semibold text-lg mb-2">Nenhum histórico ainda</h3>
        <p className="text-muted-foreground text-sm">
          Seus disparos aparecerão aqui após a primeira campanha
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtro por mês */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Histórico de Campanhas
        </h3>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">Todos os meses</option>
          {months.map(month => (
            <option key={month} value={month}>{month}</option>
          ))}
        </select>
      </div>

      {/* Lista de campanhas */}
      <div className="space-y-3">
        {filteredCampaigns.map((campaign) => (
          <div 
            key={campaign.id}
            className="glass-card overflow-hidden transition-all duration-300"
          >
            {/* Header da campanha */}
            <div 
              className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedId(expandedId === campaign.id ? null : campaign.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(campaign.status)}`}>
                    {getStatusLabel(campaign.status)}
                  </div>
                  <div>
                    <h4 className="font-medium">{campaign.name}</h4>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(campaign.date).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(campaign.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{campaign.sentCount}/{campaign.totalContacts}</span>
                    </div>
                  </div>
                  {expandedId === campaign.id ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            {/* Detalhes expandidos */}
            {expandedId === campaign.id && (
              <div className="px-4 pb-4 pt-0 border-t border-border/30 space-y-4 animate-fade-in">
                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-3 pt-4">
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-success">{campaign.successCount}</div>
                    <div className="text-xs text-muted-foreground">Enviados</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-destructive">{campaign.failedCount}</div>
                    <div className="text-xs text-muted-foreground">Falharam</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {Math.round((campaign.successCount / campaign.totalContacts) * 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Taxa de Sucesso</div>
                  </div>
                </div>

                {/* Mensagens usadas */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    Mensagens utilizadas
                  </div>
                  <div className="space-y-2">
                    {campaign.messages.slice(0, 2).map((msg, idx) => (
                      <div key={idx} className="bg-muted/20 rounded-lg p-3 text-sm font-mono">
                        {msg.length > 100 ? msg.substring(0, 100) + '...' : msg}
                      </div>
                    ))}
                    {campaign.messages.length > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{campaign.messages.length - 2} mais mensagens
                      </div>
                    )}
                  </div>
                </div>

                {/* Botão reutilizar */}
                <button
                  onClick={() => onReuse(campaign)}
                  className="w-full py-3 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reutilizar esta campanha
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
