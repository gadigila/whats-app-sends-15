
import { AlertTriangle, Crown, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { Link, useLocation } from 'react-router-dom';

const TrialStatusBanner = () => {
  const { trialStatus, isLoading } = useTrialStatus();
  const location = useLocation();

  if (isLoading || !trialStatus) return null;

  // אם המשתמש שילם - לא צריך להציג באנר
  if (trialStatus.isPaid) return null;

  // אל תציג את הבאנר בעמוד התשלום
  if (location.pathname === '/billing') return null;

  // אם תקופת הניסיון פגה
  if (trialStatus.isExpired) {
    return (
      <Alert className="border-red-200 bg-red-50 rounded-none border-x-0 border-t-0">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-red-800">
            תקופת הניסיון שלך הסתיימה. אנא שדרג כדי להמשיך להשתמש בשירות.
          </span>
          <Button asChild size="sm" className="bg-red-600 hover:bg-red-700">
            <Link to="/billing">שדרג עכשיו</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // אם תקופת הניסיון עדיין פעילה
  return (
    <Alert className={`border-orange-200 rounded-none border-x-0 border-t-0 ${
      trialStatus.daysLeft <= 1 ? 'bg-red-50' : 'bg-orange-50'
    }`}>
      <Clock className={`h-4 w-4 ${
        trialStatus.daysLeft <= 1 ? 'text-red-600' : 'text-orange-600'
      }`} />
      <AlertDescription className="flex items-center justify-between">
        <span className={`${
          trialStatus.daysLeft <= 1 ? 'text-red-800' : 'text-orange-800'
        }`}>
          {trialStatus.daysLeft === 0 
            ? 'תקופת הניסיון שלך תסתיים היום!'
            : `נותרו ${trialStatus.daysLeft} ימים לתקופת הניסיון שלך`
          }
        </span>
        <Button asChild variant="outline" size="sm">
          <Link to="/billing">
            <Crown className="h-4 w-4 ml-2" />
            שדרג
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default TrialStatusBanner;
