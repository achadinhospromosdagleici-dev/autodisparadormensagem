import { useEffect, useState } from 'react';
import { WizardProvider } from '@/contexts/WizardContext';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { TrialExpired } from '@/components/TrialExpired';
import { Loader2, RefreshCw, LogOut } from 'lucide-react';

const Index = () => {
  const { user, loading, profile, trialActive, refreshProfile, signOut } = useAuth();
  const [profileTimeout, setProfileTimeout] = useState(false);

  // If profile takes too long, show recovery options instead of infinite spinner
  useEffect(() => {
    if (user && !profile && !loading) {
      const t = setTimeout(() => setProfileTimeout(true), 4000);
      return () => clearTimeout(t);
    }
    setProfileTimeout(false);
  }, [user, profile, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthModal isOpen={true} />;
  }

  // Profile may still be loading right after signup
  if (!profile) {
    if (profileTimeout) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card border border-border/50 rounded-xl p-8 space-y-4 text-center">
            <h1 className="text-xl font-bold">Não foi possível carregar seu perfil</h1>
            <p className="text-sm text-muted-foreground">
              Sua conta foi autenticada, mas o perfil ainda não está disponível. Tente recarregar.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => refreshProfile()}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90"
              >
                <RefreshCw className="w-4 h-4" /> Tentar novamente
              </button>
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!trialActive) {
    return <TrialExpired />;
  }

  return (
    <WizardProvider>
      <WizardLayout />
    </WizardProvider>
  );
};

export default Index;
