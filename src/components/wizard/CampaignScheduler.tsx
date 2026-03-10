import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export interface ScheduledCampaign {
  id: string;
  name: string;
  scheduledDate: Date;
  status: 'scheduled' | 'running' | 'completed' | 'cancelled';
  messageIds: string[];
  contactCount: number;
}

interface CampaignSchedulerProps {
  scheduledCampaigns: ScheduledCampaign[];
  onSchedule: (campaign: Omit<ScheduledCampaign, 'id' | 'status'>) => void;
  onCancel: (id: string) => void;
  contactCount: number;
  messageCount: number;
}

export function CampaignScheduler({
  scheduledCampaigns,
  onSchedule,
  onCancel,
  contactCount,
  messageCount,
}: CampaignSchedulerProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const handleSchedule = () => {
    if (!name.trim() || !date || !time) {
      toast.error('Preencha todos os campos');
      return;
    }

    const scheduledDate = new Date(`${date}T${time}`);
    if (scheduledDate <= new Date()) {
      toast.error('A data deve ser no futuro');
      return;
    }

    onSchedule({
      name: name.trim(),
      scheduledDate,
      messageIds: [],
      contactCount,
    });

    setName('');
    setDate('');
    setTime('');
    setShowForm(false);
    toast.success('Campanha agendada com sucesso!');
  };

  const getStatusInfo = (status: ScheduledCampaign['status']) => {
    switch (status) {
      case 'scheduled':
        return { icon: Clock, color: 'text-warning', bg: 'bg-warning/10', label: 'Agendado' };
      case 'running':
        return { icon: Play, color: 'text-primary', bg: 'bg-primary/10', label: 'Executando' };
      case 'completed':
        return { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', label: 'Concluído' };
      case 'cancelled':
        return { icon: Pause, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Cancelado' };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Agendamento de Campanhas
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Agendar
        </button>
      </div>

      {/* Schedule Form */}
      {showForm && (
        <div className="glass-card p-6 space-y-4 animate-fade-in">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Nome da Campanha</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Promoção Semanal"
              className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Horário</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border border-border/30 text-sm text-muted-foreground">
            Será enviado para <strong className="text-foreground">{contactCount}</strong> contatos com <strong className="text-foreground">{messageCount}</strong> mensagem(ns)
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSchedule}
              className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Confirmar Agendamento
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-3 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Scheduled List */}
      {scheduledCampaigns.length > 0 ? (
        <div className="space-y-3">
          {scheduledCampaigns.map((campaign) => {
            const statusInfo = getStatusInfo(campaign.status);
            return (
              <div key={campaign.id} className="glass-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl ${statusInfo.bg} flex items-center justify-center`}>
                    <statusInfo.icon className={`w-5 h-5 ${statusInfo.color}`} />
                  </div>
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {campaign.scheduledDate.toLocaleDateString('pt-BR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {campaign.scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>{campaign.contactCount} contatos</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  {campaign.status === 'scheduled' && (
                    <button
                      onClick={() => {
                        onCancel(campaign.id);
                        toast.success('Agendamento cancelado');
                      }}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-8 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhuma campanha agendada</p>
        </div>
      )}
    </div>
  );
}
