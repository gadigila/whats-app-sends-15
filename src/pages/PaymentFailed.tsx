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
    <div dir="rtl" className="bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md mx-auto text-center space-y-4">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-6 animate-in zoom-in duration-300">
            <AlertCircle className="h-16 w-16 text-destructive" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            התשלום נכשל
          </h1>
          <p className="text-base text-muted-foreground">
            אנא נסה שוב
          </p>
        </div>

        {/* Closing indicator */}
        <p className="text-sm text-muted-foreground/70 pt-2">
          סוגר...
        </p>
      </div>
    </div>
  );
};

export default PaymentFailed;
