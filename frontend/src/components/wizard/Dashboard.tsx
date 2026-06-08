import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

export interface CampaignMetrics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalReplied: number;
  totalOptOut: number;
  deliveryRate: number;
  replyRate: number;
  failRate: number;
  avgResponseTime: string;
  campaignCount: number;
}

interface DashboardProps {
  metrics: CampaignMetrics;
}

export function Dashboard({ metrics }: DashboardProps) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');

  const statCards = [
    {
      icon: MessageSquare,
      label: 'Mensagens Enviadas',
      value: metrics.totalSent.toLocaleString('pt-BR'),
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: CheckCircle2,
      label: 'Entregues',
      value: metrics.totalDelivered.toLocaleString('pt-BR'),
      subValue: `${metrics.deliveryRate.toFixed(1)}%`,
      color: 'text-success',
      bgColor: 'bg-success/10',
      trend: 'up' as const,
    },
    {
      icon: Users,
      label: 'Respostas',
      value: metrics.totalReplied.toLocaleString('pt-BR'),
      subValue: `${metrics.replyRate.toFixed(1)}%`,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      trend: 'up' as const,
    },
    {
      icon: XCircle,
      label: 'Falhas',
      value: metrics.totalFailed.toLocaleString('pt-BR'),
      subValue: `${metrics.failRate.toFixed(1)}%`,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      trend: 'down' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Dashboard de Métricas
        </h3>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {([
            { key: 'today', label: 'Hoje' },
            { key: 'week', label: 'Semana' },
            { key: 'month', label: 'Mês' },
            { key: 'all', label: 'Total' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              {stat.trend && (
                <div className={`flex items-center gap-1 text-xs ${stat.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                  {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.subValue}
                </div>
              )}
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-lg font-bold">{metrics.avgResponseTime}</p>
            <p className="text-xs text-muted-foreground">Tempo Médio de Resposta</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-lg font-bold">{metrics.totalOptOut}</p>
            <p className="text-xs text-muted-foreground">Opt-outs (Blacklist)</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-lg font-bold">{metrics.campaignCount}</p>
            <p className="text-xs text-muted-foreground">Campanhas Realizadas</p>
          </div>
        </div>
      </div>

      {/* Delivery Rate Bar */}
      <div className="glass-card p-4 space-y-3">
        <p className="text-sm font-medium">Taxa de Entrega Geral</p>
        <div className="w-full h-4 bg-muted/50 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-success transition-all"
            style={{ width: `${metrics.deliveryRate}%` }}
          />
          <div
            className="h-full bg-destructive transition-all"
            style={{ width: `${metrics.failRate}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success" />
            Entregues {metrics.deliveryRate.toFixed(1)}%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            Falhas {metrics.failRate.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
