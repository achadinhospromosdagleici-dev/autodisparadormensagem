import { Clock, LogOut, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function TrialExpired() {
  const { profile, signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card border border-border/50 rounded-xl max-w-md w-full p-8 space-y-6 shadow-2xl text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center bg-transparent">
            <img src="/logo-nexia.png" alt="Nexia" className="w-full h-full object-contain" />
          </div>
        </div>
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center">
            <Clock className="w-7 h-7 text-warning" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Período de teste encerrado</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.is_active === false
              ? 'Sua conta foi desativada. Entre em contato para reativar.'
              : 'Seus 3 dias de teste acabaram. Entre em contato para continuar usando o Nexia.'}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 text-left space-y-1">
          <p className="text-xs text-muted-foreground">Conta</p>
          <p className="text-sm font-medium">{profile?.email}</p>
        </div>
        <div className="space-y-2">
          <a
            href="mailto:bigcreditossf@gmail.com?subject=Reativar%20conta%20Nexia"
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <Mail className="w-4 h-4" /> Falar com o suporte
          </a>
          <button
            onClick={signOut}
            className="w-full inline-flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}
