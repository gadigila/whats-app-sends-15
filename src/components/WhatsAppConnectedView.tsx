import Layout from '@/components/Layout';
import WhatsAppConnectionStatus from '@/components/WhatsAppConnectionStatus';
import WhatsAppConnectionDetails from '@/components/WhatsAppConnectionDetails';
import { useWhatsAppInstance } from '@/hooks/useWhatsAppInstance';

interface Profile {
  payment_plan?: string;
  trial_expires_at?: string;
}

interface WhatsAppConnectedViewProps {
  profile: Profile | null | undefined;
  onNavigateToCompose: () => void;
  onSyncGroups: () => void;
  onDisconnect: () => void;
  isSyncingGroups: boolean;
  isDisconnecting: boolean;
}

const WhatsAppConnectedView = ({
  profile,
  onNavigateToCompose,
  onSyncGroups,
  onDisconnect,
  isSyncingGroups,
  isDisconnecting
}: WhatsAppConnectedViewProps) => {
  // NEW: Use the hard disconnect hook
  const {
    showDisconnectDialog,
    openDisconnectDialog,
    closeDisconnectDialog,
    confirmHardDisconnect,
    isHardDisconnecting
  } = useWhatsAppInstance();

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">וואטסאפ מחובר</h1>
          <p className="text-gray-600">הוואטסאפ שלך מחובר ומוכן לשימוש!</p>
        </div>
        
        <WhatsAppConnectionStatus
          onNavigateToCompose={onNavigateToCompose}
          onSyncGroups={onSyncGroups}
          onDisconnect={onDisconnect}
          isSyncingGroups={isSyncingGroups}
          isDisconnecting={isDisconnecting}
          // NEW: Pass hard disconnect props
          showDisconnectDialog={showDisconnectDialog}
          onOpenDisconnectDialog={openDisconnectDialog}
          onCloseDisconnectDialog={closeDisconnectDialog}
          onConfirmHardDisconnect={confirmHardDisconnect}
          isHardDisconnecting={isHardDisconnecting}
        />
        
        <WhatsAppConnectionDetails profile={profile} />
      </div>
    </Layout>
  );
};

export default WhatsAppConnectedView;