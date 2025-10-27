import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PaymentFailed = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Notify parent window about failed payment
    window.parent.postMessage({ type: 'PAYMENT_FAILED' }, '*');
  }, []);

  const handleTryAgain = () => {
    navigate('/billing');
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto text-center space-y-6">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-6 animate-in zoom-in duration-300">
            <AlertCircle className="h-20 w-20 text-destructive" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            התשלום נכשל
          </h1>
          <p className="text-lg text-muted-foreground">
            נראה שלא קיבלנו את התשלום
          </p>
        </div>

        {/* Additional Info */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
          <p>אנא בדוק את פרטי התשלום ונסה שוב</p>
          <p>או צור קשר עם התמיכה אם הבעיה נמשכת</p>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 space-y-3">
          <Button 
            onClick={handleTryAgain}
            size="lg"
            className="w-full"
          >
            נסה שוב
          </Button>
          <Button 
            onClick={handleTryAgain}
            variant="outline"
            size="lg"
            className="w-full"
          >
            חזור לעמוד הבילינג
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailed;
