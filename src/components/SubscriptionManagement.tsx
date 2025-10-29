import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Calendar, Crown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SubscriptionManagementProps {
  subscriptionStatus: string;
  expiresAt?: string;
  planType?: string;
  gracePeriodEndsAt?: string;
  onStatusChange: () => void;
}

const SubscriptionManagement = ({
  subscriptionStatus,
  expiresAt,
  planType,
  gracePeriodEndsAt,
  onStatusChange,
}: SubscriptionManagementProps) => {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      // First, verify the user has a subscription ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('tranzila_sto_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (!profileData?.tranzila_sto_id) {
        toast.error('לא ניתן לבטל מנוי', {
          description: 'לא נמצא מזהה מנוי. אנא פנה לתמיכה.',
        });
        setShowCancelDialog(false);
        setIsLoading(false);
        return;
      }

      // Proceed with cancellation
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        method: 'POST',
      });

      if (error) throw error;

      toast.success('המנוי בוטל בהצלחה', {
        description: 'תוכל להמשיך להשתמש בשירות עד תום תקופת המנוי',
      });
      
      setShowCancelDialog(false);
      onStatusChange();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('שגיאה בביטול המנוי', {
        description: error.message || 'אנא נסה שוב או פנה לתמיכה',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reactivate-subscription', {
        method: 'POST',
      });

      if (error) throw error;

      toast.success('המנוי הופעל מחדש בהצלחה', {
        description: 'החידוש האוטומטי הופעל שוב',
      });
      
      setShowReactivateDialog(false);
      onStatusChange();
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      toast.error('שגיאה בהפעלת המנוי מחדש', {
        description: 'אנא נסה שוב או פנה לתמיכה',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (subscriptionStatus) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 ml-1" />
            פעיל
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary">
            <AlertTriangle className="h-3 w-3 ml-1" />
            בוטל
          </Badge>
        );
      case 'grace_period':
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
            <AlertTriangle className="h-3 w-3 ml-1" />
            תקופת חסד
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 ml-1" />
            פג תוקף
          </Badge>
        );
      default:
        return null;
    }
  };

  const getPlanName = () => {
    if (planType === 'yearly') return 'תוכנית שנתית';
    if (planType === 'monthly') return 'תוכנית חודשית';
    return 'תוכנית';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <CardTitle>ניהול מנוי</CardTitle>
            </div>
            {getStatusBadge()}
          </div>
          <CardDescription>
            {getPlanName()} - ₪{planType === 'yearly' ? '999' : '99'}/{planType === 'yearly' ? 'שנה' : 'חודש'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {expiresAt && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {subscriptionStatus === 'cancelled' ? 'תאריך סיום גישה:' : 'מתחדש ב:'}
              </span>
              <span className="font-medium">
                {format(new Date(expiresAt), 'PPP', { locale: he })}
              </span>
            </div>
          )}

          {gracePeriodEndsAt && subscriptionStatus === 'grace_period' && (
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-800">
                <AlertTriangle className="h-4 w-4 inline ml-1" />
                תקופת החסד מסתיימת ב-{format(new Date(gracePeriodEndsAt), 'PPP', { locale: he })}
              </p>
              <p className="text-xs text-orange-700 mt-1">
                אנא עדכן את פרטי התשלום כדי להמשיך להשתמש בשירות
              </p>
            </div>
          )}

          {subscriptionStatus === 'active' && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCancelDialog(true)}
            >
              ביטול מנוי
            </Button>
          )}

          {subscriptionStatus === 'cancelled' && (
            <Button
              variant="default"
              className="w-full"
              onClick={() => setShowReactivateDialog(true)}
            >
              הפעלת מנוי מחדש
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ביטול מנוי</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך לבטל את המנוי? תוכל להמשיך להשתמש בשירות עד תום תקופת המנוי הנוכחית 
              ({expiresAt && format(new Date(expiresAt), 'PPP', { locale: he })}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={isLoading}>
              {isLoading ? 'מבטל...' : 'אישור ביטול'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate Confirmation Dialog */}
      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>הפעלת מנוי מחדש</AlertDialogTitle>
            <AlertDialogDescription>
              המנוי שלך יופעל מחדש והחידוש האוטומטי יחזור לפעול. 
              התשלום הבא יתבצע ב-{expiresAt && format(new Date(expiresAt), 'PPP', { locale: he })}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivate} disabled={isLoading}>
              {isLoading ? 'מפעיל...' : 'אישור הפעלה'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SubscriptionManagement;
