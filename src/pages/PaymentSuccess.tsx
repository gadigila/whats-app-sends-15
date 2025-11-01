import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Notify parent window about successful payment
    window.parent.postMessage({ type: 'PAYMENT_SUCCESS' }, '*');
    
    // Invalidate queries to refetch fresh data
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['trialStatus'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }, 1000);
  }, [queryClient]);

  const handleGoToDashboard = () => {
    // This will be handled by the parent window, but we can also navigate
    navigate('/dashboard');
  };

  return (
    <div dir="rtl" className="bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md mx-auto text-center space-y-4">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 p-6 animate-in zoom-in duration-300">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            התשלום בוצע בהצלחה! 🎉
          </h1>
          <p className="text-base text-muted-foreground">
            המנוי שלך שודרג לפרימיום
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

export default PaymentSuccess;
