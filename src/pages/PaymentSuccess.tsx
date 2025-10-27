import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PaymentSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Notify parent window about successful payment
    window.parent.postMessage({ type: 'PAYMENT_SUCCESS' }, '*');
  }, []);

  const handleGoToDashboard = () => {
    // This will be handled by the parent window, but we can also navigate
    navigate('/dashboard');
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto text-center space-y-6">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 p-6 animate-in zoom-in duration-300">
            <CheckCircle2 className="h-20 w-20 text-green-600" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            התשלום בוצע בהצלחה! 🎉
          </h1>
          <p className="text-lg text-muted-foreground">
            תודה על התשלום. המנוי שלך שודרג לפרימיום!
          </p>
        </div>

        {/* Additional Info */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
          בדוק את המייל שלך לקבלת אישור תשלום וחשבונית
        </div>

        {/* Action Button */}
        <div className="pt-4">
          <Button 
            onClick={handleGoToDashboard}
            size="lg"
            className="w-full"
          >
            חזור לדף הראשי
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
