import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Phone, 
  MessageSquare, 
  Users, 
  RefreshCw, 
  LogOut, 
  Calendar,
  Clock,
  Loader2,
  Play,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';

interface WhatsAppConnectedViewProps {
  profile: any;
  onNavigateToCompose: () => void;
  onSyncGroups: () => void; // Legacy - not used anymore
  onDisconnect: () => void;
  isSyncingGroups: boolean; // Legacy - not used anymore
  isDisconnecting: boolean;
}

const WhatsAppConnectedView: React.FC<WhatsAppConnectedViewProps> = ({
  profile,
  onNavigateToCompose,
  onDisconnect,
  isDisconnecting
}) => {
  // 🆕 Use enhanced groups hook with background sync
  const {
    groups,
    totalGroups,
    adminGroups,
    totalMembers,
    startBackgroundSync,
    cancelSync,
    syncProgress,
    isBackgroundSyncRunning,
    backgroundSyncProgress,
    backgroundSyncMessage,
    groupsFoundSoFar,
    totalScannedSoFar,
  } = useWhatsAppGroups();

  // 🆕 Sync button handler
  const handleSyncClick = () => {
    if (isBackgroundSyncRunning) {
      // If running, offer to cancel
      cancelSync.mutate();
    } else {
      // Start background sync
      startBackgroundSync.mutate();
    }
  };

  // 🆕 Get sync button props
  const getSyncButtonProps = () => {
    if (isBackgroundSyncRunning) {
      return {
        text: "Cancel Sync",
        icon: <X className="h-4 w-4" />,
        variant: "destructive" as const,
        disabled: false
      };
    }
    
    if (cancelSync.isPending) {
      return {
        text: "Cancelling...",
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        variant: "secondary" as const,
        disabled: true
      };
    }
    
    if (startBackgroundSync.isPending) {
      return {
        text: "Starting...",
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        variant: "default" as const,
        disabled: true
      };
    }

    return {
      text: "Sync Groups",
      icon: <Play className="h-4 w-4" />,
      variant: "default" as const,
      disabled: false
    };
  };

  const buttonProps = getSyncButtonProps();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <Phone className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">WhatsApp Connected!</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="outline" className="text-green-700 border-green-700">
                Connected
              </Badge>
              {profile?.phone_number && (
                <Badge variant="secondary">
                  {profile.phone_number}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Group Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Group Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{totalGroups}</div>
              <div className="text-sm text-blue-800">Total Groups</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{adminGroups}</div>
              <div className="text-sm text-green-800">Admin Groups</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{totalMembers.toLocaleString()}</div>
              <div className="text-sm text-purple-800">Total Members</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🆕 Background Sync Progress Card */}
      {(isBackgroundSyncRunning || syncProgress) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {syncProgress?.status === 'completed' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : syncProgress?.status === 'failed' ? (
                <AlertCircle className="h-5 w-5 text-red-600" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              )}
              Background Group Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {syncProgress?.status === 'completed' ? 'Completed' : 
                   syncProgress?.status === 'failed' ? 'Failed' :
                   syncProgress?.status === 'cancelled' ? 'Cancelled' : 'Progress'}
                </span>
                <span>{Math.round(backgroundSyncProgress)}%</span>
              </div>
              <Progress value={backgroundSyncProgress} className="w-full" />
            </div>

            {/* Status Message */}
            <div className="text-sm text-blue-800">
              {backgroundSyncMessage}
            </div>

            {/* Statistics */}
            {(groupsFoundSoFar > 0 || totalScannedSoFar > 0) && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center p-2 bg-white rounded border">
                  <div className="font-bold text-green-600">{groupsFoundSoFar}</div>
                  <div className="text-gray-600">Admin Groups Found</div>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <div className="font-bold text-blue-600">{totalScannedSoFar}</div>
                  <div className="text-gray-600">Groups Scanned</div>
                </div>
              </div>
            )}

            {/* Sync Time Info */}
            {syncProgress?.startedAt && (
              <div className="text-xs text-gray-600">
                Started: {new Date(syncProgress.startedAt).toLocaleTimeString()}
                {syncProgress.completedAt && (
                  <> • Completed: {new Date(syncProgress.completedAt).toLocaleTimeString()}</>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Send Messages Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Send Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Send messages to all your groups or selected groups
            </p>
            <Button 
              onClick={onNavigateToCompose}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={totalGroups === 0}
            >
              <MessageSquare className="h-4 w-4 ml-2" />
              Create New Message
            </Button>
            {totalGroups === 0 && (
              <p className="text-sm text-orange-600">
                First sync your groups to send messages
              </p>
            )}
          </CardContent>
        </Card>

        {/* Sync Groups Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Group Synchronization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              {isBackgroundSyncRunning 
                ? "Background sync is running. You can cancel it or let it complete."
                : "Scan all your WhatsApp groups to find admin groups"
              }
            </p>
            
            {/* 🆕 Enhanced Sync Button */}
            <Button 
              onClick={handleSyncClick}
              disabled={buttonProps.disabled}
              className={`w-full ${
                buttonProps.variant === 'destructive' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              variant={buttonProps.variant}
            >
              {buttonProps.icon}
              <span className="mr-2">{buttonProps.text}</span>
            </Button>
            
            {/* Helper Text */}
            <div className="text-xs text-gray-500">
              {isBackgroundSyncRunning ? (
                "Sync runs in background - you can continue using the app"
              ) : (
                "Background sync will scan all groups and update results automatically"
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Manage messages scheduled for later delivery
          </p>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/scheduled'}
            className="w-full"
          >
            <Calendar className="h-4 w-4 ml-2" />
            View Scheduled Messages
          </Button>
        </CardContent>
      </Card>

      {/* Disconnect Section */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <LogOut className="h-5 w-5" />
            Disconnect WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Disconnect your WhatsApp account from the system
          </p>
          <Button 
            variant="outline" 
            onClick={onDisconnect}
            disabled={isDisconnecting}
            className="w-full text-red-600 border-red-600 hover:bg-red-50"
          >
            {isDisconnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                Disconnecting...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4 ml-2" />
                Disconnect WhatsApp
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppConnectedView;