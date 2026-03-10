import { WizardProvider } from '@/contexts/WizardContext';
import { WizardLayout } from '@/components/wizard/WizardLayout';

const Index = () => {
  return (
    <WizardProvider>
      <WizardLayout />
    </WizardProvider>
  );
};

export default Index;
