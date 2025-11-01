import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export const ManualChannelUpgrade = () => {
  const { user } = useAuth();
  const [channelId, setChannelId] = useState('');
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = async () => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    if (!channelId.trim()) {
      toast.error('Please enter a channel ID');
      return;
    }

    setIsUpgrading(true);
    console.log('🚀 Upgrading channel:', channelId);

    try {
      const { data, error } = await supabase.functions.invoke('upgrade-whapi-channel', {
        body: {
          userId: user.id,
          channelId: channelId.trim(),
        },
      });

      if (error) {
        console.error('❌ Upgrade error:', error);
        throw error;
      }

      console.log('✅ Upgrade result:', data);

      if (data.success) {
        toast.success('Channel upgraded to live mode successfully! 🎉');
        setChannelId('');
        
        // Refresh the page after 2 seconds to show updated status
        setTimeout(() => window.location.reload(), 2000);
      } else {
        throw new Error(data.error || 'Upgrade failed');
      }
    } catch (error: any) {
      console.error('❌ Upgrade failed:', error);
      toast.error(error.message || 'Failed to upgrade channel');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle>Manual Channel Upgrade</CardTitle>
        <CardDescription>
          Upgrade your WHAPI channel from trial to live mode manually
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="channelId">WHAPI Channel ID</Label>
          <Input
            id="channelId"
            placeholder="REECHER-1234567890-XXXXX"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            disabled={isUpgrading}
          />
          <p className="text-sm text-muted-foreground">
            Find this in your WHAPI dashboard under "Channel name"
          </p>
        </div>

        <Button
          onClick={handleUpgrade}
          disabled={isUpgrading || !channelId.trim()}
          className="w-full"
        >
          {isUpgrading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Upgrading...
            </>
          ) : (
            'Upgrade to Live Mode'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
