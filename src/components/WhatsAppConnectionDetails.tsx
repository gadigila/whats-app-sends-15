
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wifi } from 'lucide-react';

interface Profile {
  payment_plan?: string;
  trial_expires_at?: string;
}

interface WhatsAppConnectionDetailsProps {
  profile: Profile | null | undefined;
}

const WhatsAppConnectionDetails = ({ profile }: WhatsAppConnectionDetailsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>פרטי החיבור</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">סטטוס:</span>
            <span className="text-green-600 font-medium flex items-center gap-1">
              <Wifi className="h-4 w-4" />
              מחובר
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">תוכנית:</span>
            <span className="font-medium">
              {profile?.payment_plan === 'trial' ? 'ניסיון' : profile?.payment_plan || 'ניסיון'}
            </span>
          </div>
          {profile?.trial_expires_at && (
            <div className="flex justify-between">
              <span className="text-gray-600">תוקף הניסיון:</span>
              <span className="font-medium">
                {new Date(profile.trial_expires_at).toLocaleDateString('he-IL')}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppConnectionDetails;
