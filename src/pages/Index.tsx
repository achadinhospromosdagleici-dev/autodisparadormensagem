import { WizardProvider } from '@/contexts/WizardContext';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { TrialExpired } from '@/components/TrialExpired';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading, profile, trialActive } = useAuth();

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
