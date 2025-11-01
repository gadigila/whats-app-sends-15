import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Crown, Star, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { trackInitiateCheckout } from '@/lib/fbPixel';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { usePaymentPlans } from '@/hooks/usePaymentPlans';
import SubscriptionManagement from '@/components/SubscriptionManagement';
import { useQueryClient } from '@tanstack/react-query';
import { useInvoices } from '@/hooks/useInvoices';
import { FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getClientId, getPlanId, PAYPAL_CONFIG } from '@/config/paypal.config';

const Billing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const { trialStatus, isLoading: trialLoading } = useTrialStatus();
  const { plans, currentPlan, billingPeriod, setBillingPeriod } = usePaymentPlans();
  const queryClient = useQueryClient();
  const { data: invoices } = useInvoices();

  const isPaid = trialStatus?.isPaid || false;
  const latestInvoice = invoices?.[0];

  // Debug: Log PayPal mode
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🔧 PayPal Mode:', PAYPAL_CONFIG.mode);
      console.log('🔑 Client ID:', getClientId().slice(0, 20) + '...');
    }
  }, []);

  // Load PayPal SDK
  useEffect(() => {
    if (!isPaid && !paypalLoaded) {
      const clientId = getClientId();
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription`;
      script.async = true;
      script.onload = () => setPaypalLoaded(true);
      document.body.appendChild(script);
      
      return () => {
        document.body.removeChild(script);
      };
    }
  }, [isPaid, paypalLoaded]);

  // Track InitiateCheckout when user views the billing page
  useEffect(() => {
    if (!trialLoading && !isPaid) {
      trackInitiateCheckout();
    }
  }, [trialLoading, isPaid]);

  // Initialize PayPal button when SDK loads
  useEffect(() => {
    const win = window as any;
    if (paypalLoaded && win.paypal && !isPaid) {
      const planId = getPlanId(billingPeriod);
      
      // Clear previous button
      const container = document.getElementById('paypal-button-container');
      if (container) {
        container.innerHTML = '';
      }
      
      win.paypal.Buttons({
        style: {
          shape: 'pill',
          color: 'gold',
          layout: 'vertical',
          label: 'subscribe',
          height: 48
        },
        createSubscription: function(data: any, actions: any) {
          return actions.subscription.create({
            plan_id: planId,
            custom_id: user?.id // Track user ID in PayPal
          });
        },
        onApprove: function(data: any, actions: any) {
          console.log('✅ PayPal subscription approved:', data.subscriptionID);
          
          toast({
            title: "מנוי נוצר בהצלחה! 🎉",
            description: "המערכת מעדכנת את המנוי שלך...",
          });
          
          // Refresh data
          queryClient.invalidateQueries({ queryKey: ['userProfile'] });
          queryClient.invalidateQueries({ queryKey: ['trialStatus'] });
          
          // Redirect to WhatsApp connection
          setTimeout(() => {
            navigate('/connect');
          }, 2000);
        },
        onError: function(err: any) {
          console.error('❌ PayPal error:', err);
          toast({
            title: "שגיאה ביצירת מנוי",
            description: "אנא נסה שוב או צור קשר עם התמיכה",
            variant: "destructive",
          });
        },
        onCancel: function() {
          toast({
            title: "התשלום בוטל",
            description: "לא בוצע חיוב. אתה יכול לנסות שוב מתי שתרצה.",
          });
        }
      }).render('#paypal-button-container');
    }
  }, [paypalLoaded, billingPeriod, isPaid, queryClient, navigate]);

  // Listen for payment success from iframe/modal
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'PAYMENT_SUCCESS') {
        console.log('✅ Received PAYMENT_SUCCESS message, refreshing data...');
        
        // Invalidate all queries to fetch fresh data
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        queryClient.invalidateQueries({ queryKey: ['trialStatus'] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        
        toast({
          title: "תשלום בוצע בהצלחה! 🎉",
          description: "המנוי שלך עודכן",
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [queryClient]);

  // Handle query parameters for payment result (from PayPal redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    
    if (paymentStatus === 'success') {
      console.log('✅ Payment success callback received from PayPal');
      
      // Show success message
      toast({
        title: "תשלום בוצע בהצלחה! 🎉",
        description: "המנוי שלך מופעל. מעביר אותך להתחברות...",
      });

      // Refresh data to get updated subscription status
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['trialStatus'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      
      // Clean URL
      window.history.replaceState({}, '', '/billing');
      
      // Redirect to WhatsApp connection after short delay
      setTimeout(() => {
        navigate('/connect');
      }, 2000);
      
    } else if (paymentStatus === 'cancelled') {
      console.log('⚠️ Payment cancelled by user');
      
      toast({
        title: "התשלום בוטל",
        description: "לא בוצע חיוב. אתה יכול לנסות שוב מתי שתרצה.",
        variant: "default",
      });

      // Clean URL
      window.history.replaceState({}, '', '/billing');
    }
  }, [queryClient, navigate]);


  // Check if we're in iframe with payment result - show minimal UI
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');
  const isInIframe = window.self !== window.top;

  if (isInIframe && (paymentStatus === 'success' || paymentStatus === 'failed')) {
    // Minimal UI for iframe payment result
    return (
      <div dir="rtl" className="bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-md mx-auto text-center space-y-4">
          <div className="flex justify-center">
            <div className={`rounded-full ${paymentStatus === 'success' ? 'bg-green-100' : 'bg-destructive/10'} p-6 animate-in zoom-in duration-300`}>
              {paymentStatus === 'success'
                ? <CheckCircle2 className="h-16 w-16 text-green-600" />
                : <AlertCircle className="h-16 w-16 text-destructive" />
              }
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {paymentStatus === 'success' ? 'התשלום בוצע בהצלחה! 🎉' : 'התשלום נכשל'}
            </h1>
            <p className="text-base text-muted-foreground">
              {paymentStatus === 'success' ? 'המנוי שלך שודרג לפרימיום' : 'אנא נסה שוב'}
            </p>
          </div>
          <p className="text-sm text-muted-foreground/70 pt-2">סוגר...</p>
        </div>
      </div>
    );
  }

  if (trialLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-lg">טוען...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">הצטרף לתוכנית שלנו</h1>
          <p className="text-gray-600">
            גישה מלאה לכל התכונות של Reecher.app
          </p>
        </div>

        {/* Subscription Management - For paid users */}
        {user && trialStatus && (trialStatus.isPaid || trialStatus.isCancelled || trialStatus.isGracePeriod) && (
          <>
            <SubscriptionManagement
              subscriptionStatus={trialStatus.status}
              expiresAt={trialStatus.expiresAt?.toISOString()}
              planType={trialStatus.planType}
              gracePeriodEndsAt={trialStatus.gracePeriodEndsAt?.toISOString()}
              onStatusChange={() => queryClient.invalidateQueries({ queryKey: ['userProfile'] })}
            />

            {/* Latest Invoice */}
            {latestInvoice && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">חשבונית אחרונה</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">מספר חשבונית:</span>
                    <span className="font-medium">{latestInvoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">תאריך:</span>
                    <span className="font-medium">
                      {format(new Date(latestInvoice.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">סכום:</span>
                    <span className="font-medium">₪{latestInvoice.amount}</span>
                  </div>
                  {latestInvoice.invoice_url && (
                    <a 
                      href={latestInvoice.invoice_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full mt-4 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      הצג חשבונית
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Current Status - For trial/expired users */}
        {user && trialStatus && !trialStatus.isPaid && !trialStatus.isCancelled && !trialStatus.isGracePeriod && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${
                  trialStatus.isExpired ? 'bg-red-50' : 'bg-orange-50'
                }`}>
                  {trialStatus.isExpired ? (
                    <Star className="h-6 w-6 text-red-600" />
                  ) : (
                    <Star className="h-6 w-6 text-orange-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    סטטוס נוכחי: {
                      trialStatus.isExpired ? 'תקופת ניסיון פגה' : 
                      `תקופת ניסיון - ${trialStatus.daysLeft} ימים נותרו`
                    }
                  </h3>
                  <p className="text-gray-600">
                    {trialStatus.isExpired
                      ? 'תקופת הניסיון הסתיימה. שדרג כדי להמשיך.'
                      : 'בחר תוכנית כדי להמשיך לאחר תקופת הניסיון.'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Period Toggle */}
        {!isPaid && (
          <div className="flex justify-center">
            <div className="bg-gray-300 p-1 rounded-lg">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingPeriod === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-800 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                חודשי
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingPeriod === 'yearly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-800 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                שנתי
                <span className="mr-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  חסוך 17%
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Main Pricing Plan */}
        {currentPlan && (
          <div className="max-w-md mx-auto">
            <Card className={`border-green-200 bg-green-50/50 ${
              currentPlan.popular ? 'ring-2 ring-green-500' : ''
            }`}>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                  <Crown className="h-6 w-6 text-green-500" />
                  {currentPlan.name}
                  {currentPlan.popular && (
                    <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                      הכי פופולרי
                    </span>
                  )}
                </CardTitle>
                <div className="mt-4">
                  <div className="text-5xl font-bold text-gray-900">₪{currentPlan.price}</div>
                  {currentPlan.originalPrice && (
                    <div className="text-lg text-gray-500 line-through">₪{currentPlan.originalPrice}</div>
                  )}
                  <p className="text-gray-600 text-lg">
                    ל{currentPlan.period === 'monthly' ? 'חודש' : 'שנה'} - ללא הגבלה
                  </p>
                </div>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <ul className="space-y-3 mb-8">
                  {currentPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                {isPaid ? (
                  <div className="text-center py-3 bg-green-100 text-green-800 rounded-md font-medium">
                    התוכנית הנוכחית שלך
                  </div>
                ) : (
                  <>
                    <div 
                      id="paypal-button-container" 
                      className="w-full min-h-[48px]"
                    />
                    
                    {!paypalLoaded && (
                      <div className="text-center py-3 text-gray-500">
                        טוען כפתור תשלום...
                      </div>
                    )}
                    
                    <a
                      href={`https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=${getPlanId(billingPeriod)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-sm text-blue-600 hover:underline mt-3"
                    >
                      אם כפתור PayPal לא נטען, לחץ כאן לתשלום ישיר
                    </a>
                    
                    <p className="text-center text-sm text-gray-500 mt-4">
                      לאחר התשלום תועבר לחיבור וואטסאפ
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Why Reecher */}
        <Card>
          <CardContent className="p-8">
            <h3 className="text-xl font-semibold text-center mb-6">למה Reecher?</h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-semibold mb-2">🚀 חסוך זמן</h4>
                <p className="text-gray-600">במקום לשלוח הודעה לכל קבוצה בנפרד - שלח לכולן בבת אחת</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">⏰ תזמון חכם</h4>
                <p className="text-gray-600">תזמן הודעות מראש ותן למערכת לשלוח בזמן המתאים</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">📁 קבצים ותמונות</h4>
                <p className="text-gray-600">שלח לא רק טקסט - גם תמונות, מסמכים וקובצים</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">📊 בקרה מלאה</h4>
                <p className="text-gray-600">עקוב אחר סטטוס השליחה ונהל את כל ההודעות שלך</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal Policies Footer */}
        <Card className="bg-gray-50">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="flex flex-wrap justify-center gap-4 text-xs">
                <a 
                  href="/terms-of-service" 
                  className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  תנאי שימוש
                </a>
                <span className="text-gray-400">•</span>
                <a 
                  href="/privacy-policy" 
                  className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  מדיניות פרטיות
                </a>
                <span className="text-gray-400">•</span>
                <a 
                  href="/refund-policy" 
                  className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  מדיניות החזרים
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PayPal Payment Modal - Not needed since we redirect directly */}
        {/* Modal functionality removed as PayPal requires direct redirect to their page */}
      </div>
    </Layout>
  );
};

export default Billing;
