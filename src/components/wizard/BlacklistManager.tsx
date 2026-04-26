import React, { useState } from 'react';
import {
  Ban,
  Plus,
  Trash2,
  Upload,
  Shield,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const BLACKLIST_KEY = 'messageflow_blacklist';
const OPT_OUT_KEYWORDS = ['SAIR', 'PARAR', 'CANCELAR', 'STOP', 'REMOVER', 'NAO QUERO', 'NÃO QUERO'];

async function saveBlacklistToDb(list: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('blacklist').delete().eq('user_id', user.id);
  for (const phone of list) {
    await supabase.from('blacklist').upsert({
      user_id: user.id,
      phone,
      reason: 'manual',
    }, { onConflict: 'user_id,phone' });
  }
}

async function loadBlacklistFromDb(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from('blacklist').select('phone').eq('user_id', user.id);
  return data?.map((t: any) => t.phone) ?? [];
}

export async function loadBlacklist(): Promise<string[]> {
  try {
    const stored = localStorage.getItem(BLACKLIST_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return loadBlacklistFromDb();
}

export async function saveBlacklist(list: string[]): Promise<void> {
  localStorage.setItem(BLACKLIST_KEY, JSON.stringify(list));
  await saveBlacklistToDb(list);
}

export function isBlacklisted(phone: string): boolean {
  const list = loadBlacklist();
  const normalized = phone.replace(/\D/g, '');
  return list.some((p) => p.replace(/\D/g, '') === normalized);
}

export function addToBlacklist(phone: string): void {
  const list = loadBlacklist();
  const normalized = phone.replace(/\D/g, '');
  if (!list.some((p) => p.replace(/\D/g, '') === normalized)) {
    list.push(phone);
    saveBlacklist(list);
  }
}

export function isOptOutMessage(content: string): boolean {
  const upper = content.toUpperCase().trim();
  return OPT_OUT_KEYWORDS.some((kw) => upper.includes(kw));
}

interface BlacklistManagerProps {
  onBlacklistChange?: (list: string[]) => void;
}

export function BlacklistManager({ onBlacklistChange }: BlacklistManagerProps) {
  const [blacklist, setBlacklist] = useState<string[]>(loadBlacklist());
  const [newNumber, setNewNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const updateBlacklist = (newList: string[]) => {
    setBlacklist(newList);
    saveBlacklist(newList);
    onBlacklistChange?.(newList);
  };

  const handleAdd = () => {
    if (!newNumber.trim()) {
      toast.error('Digite um número');
      return;
    }
    const normalized = newNumber.replace(/\D/g, '');
    if (blacklist.some((p) => p.replace(/\D/g, '') === normalized)) {
      toast.error('Número já está na blacklist');
      return;
    }
    updateBlacklist([...blacklist, newNumber.trim()]);
    setNewNumber('');
    toast.success('Número adicionado à blacklist');
  };

  const handleRemove = (phone: string) => {
    updateBlacklist(blacklist.filter((p) => p !== phone));
    toast.success('Número removido da blacklist');
  };

  const handleClearAll = () => {
    updateBlacklist([]);
    toast.success('Blacklist limpa');
  };

  const filteredList = blacklist.filter((p) =>
    p.replace(/\D/g, '').includes(searchQuery.replace(/\D/g, ''))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Blacklist / Opt-out
        </h3>
        <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-md">
          {blacklist.length} número(s)
        </span>
      </div>

      {/* Opt-out keywords info */}
      <div className="glass-card p-4 border-warning/20 bg-warning/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-medium">Detecção Automática de Opt-out</p>
            <p className="text-xs text-muted-foreground mt-1">
              Quando um contato responder com palavras como <strong>SAIR</strong>, <strong>PARAR</strong>, <strong>CANCELAR</strong> ou <strong>STOP</strong>, ele será automaticamente adicionado à blacklist.
            </p>
          </div>
        </div>
      </div>

      {/* Add Number */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newNumber}
          onChange={(e) => setNewNumber(e.target.value)}
          placeholder="Digite o número para bloquear"
          className="flex-1 px-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          className="px-4 py-3 rounded-lg bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors flex items-center gap-2"
        >
          <Ban className="w-4 h-4" />
          Bloquear
        </button>
      </div>

      {/* Search */}
      {blacklist.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar na blacklist..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      )}

      {/* Blacklist */}
      {filteredList.length > 0 ? (
        <div className="glass-card p-4 space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
          {filteredList.map((phone) => (
            <div key={phone} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <Ban className="w-4 h-4 text-destructive" />
                <span className="text-sm font-mono">{phone}</span>
              </div>
              <button
                onClick={() => handleRemove(phone)}
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-8 text-center">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum número na blacklist</p>
        </div>
      )}

      {blacklist.length > 0 && (
        <button
          onClick={handleClearAll}
          className="w-full py-2 rounded-lg bg-destructive/10 text-destructive text-sm hover:bg-destructive/20 transition-colors"
        >
          Limpar toda a blacklist
        </button>
      )}
    </div>
  );
}
