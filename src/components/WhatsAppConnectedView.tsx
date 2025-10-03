
import Layout from '@/components/Layout';
import WhatsAppConnectionStatus from '@/components/WhatsAppConnectionStatus';
import WhatsAppConnectionDetails from '@/components/WhatsAppConnectionDetails';
import TrialUsageCard from '@/components/TrialUsageCard';
import { useWhatsAppInstance } from '@/hooks/useWhatsAppInstance';

interface Profile {
  payment_plan?: string;
  trial_expires_at?: string;
}

interface WhatsAppConnectedViewProps {
  profile: Profile | null | undefined;
  onNavigateToCompose: () => void;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}

const WhatsAppConnectedView = ({
  profile,
  onNavigateToCompose,
  onDisconnect,
  isDisconnecting
}: WhatsAppConnectedViewProps) => {
  // Use the hard disconnect hook
  const {
    showDisconnectDialog,
    openDisconnectDialog,
    closeDisconnectDialog,
    confirmHardDisconnect,
    isHardDisconnecting
  } = useWhatsAppInstance();

  const handleNavigateToGroups = () => {
    window.location.href = '/segments';
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">וואטסאפ מחובר</h1>
          <p className="text-gray-600">הוואטסאפ שלך מחובר ומוכן לשימוש!</p>
        </div>
        
        <WhatsAppConnectionStatus
          onNavigateToCompose={onNavigateToCompose}
          onNavigateToGroups={handleNavigateToGroups}
          onDisconnect={onDisconnect}
          isDisconnecting={isDisconnecting}
          // Hard disconnect props
          showDisconnectDialog={showDisconnectDialog}
          onOpenDisconnectDialog={openDisconnectDialog}
          onCloseDisconnectDialog={closeDisconnectDialog}
          onConfirmHardDisconnect={confirmHardDisconnect}
          isHardDisconnecting={isHardDisconnecting}
        />
        
        {profile?.payment_plan === 'trial' && <TrialUsageCard />}
        
        <WhatsAppConnectionDetails profile={profile} />
      </div>
    </Layout>
  );
};

export default WhatsAppConnectedView;
