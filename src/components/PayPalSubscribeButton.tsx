import { useEffect, useRef, useState } from 'react';

type Props = {
  planId: string;
  className?: string;
  label?: string;
};

export default function PayPalSubscribeButton({ planId, className, label = 'הצטרפות עם PayPal' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const win = window as any;

    const tryRender = () => {
      if (cancelled) return;
      if (win.paypal && ref.current) {
        const buttons = win.paypal.Buttons({
          style: { 
            shape: 'pill', 
            color: 'gold', 
            layout: 'vertical', 
            label: 'subscribe',
            height: 48 
          },
          createSubscription: (_data: any, actions: any) => actions.subscription.create({ plan_id: planId }),
          onApprove: (data: any) => {
            console.log('✅ PayPal subscription approved:', data.subscriptionID);
            window.location.href = '/billing?payment=success';
          },
          onError: (err: any) => {
            console.error('❌ PayPal error:', err);
            alert('שגיאה ביצירת מנוי. אנא נסה שוב.');
          },
          onCancel: () => {
            console.log('⚠️ User cancelled PayPal subscription');
          }
        });

        buttons.render(ref.current);
      } else {
        setTimeout(() => {
          if (!win.paypal) {
            setFallback(true);
          }
        }, 1200);
      }
    };

    tryRender();
    return () => { cancelled = true; };
  }, [planId]);

  if (fallback) {
    return (
      <a
        href={`https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=${planId}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center h-12 w-full rounded-full bg-[#FFC439] text-black font-semibold hover:bg-[#FFD666] transition-colors ${className || ''}`}
      >
        {label}
      </a>
    );
  }

  return <div ref={ref} className={className} />;
}
