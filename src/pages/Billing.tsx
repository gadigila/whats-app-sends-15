import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ThreeDButton } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Crown, Star, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { trackInitiateCheckout } from '@/lib/fbPixel';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { usePaymentPlans } from '@/hooks/usePaymentPlans';
import TranzilaPaymentModal from '@/components/TranzilaPaymentModal';
import SubscriptionManagement from '@/components/SubscriptionManagement';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useInvoices } from '@/hooks/useInvoices';
import { FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const Billing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [iframeUrl, setIframeUrl] = useState('');
  const { trialStatus, isLoading: trialLoading } = useTrialStatus();
  const { plans, currentPlan, billingPeriod, setBillingPeriod } = usePaymentPlans();
  const queryClient = useQueryClient();
  const { data: invoices } = useInvoices();

  const isPaid = trialStatus?.isPaid || false;
  const latestInvoice = invoices?.[0];

  // Track InitiateCheckout when user views the billing page
  useEffect(() => {
    if (!trialLoading && !isPaid) {
      trackInitiateCheckout();
    }
  }, [trialLoading, isPaid]);

  // Handle postMessage from payment result pages in iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PAYMENT_SUCCESS') {
        setShowPaymentModal(false);
        setIframeUrl('');
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        queryClient.invalidateQueries({ queryKey: ['trialStatus'] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        
        // Show success message
        toast({
          title: "התשלום בוצע בהצלחה! 🎉",
          description: "החשבון שלך שודרג למנוי פרימיום",
        });
        
        // Redirect to WhatsApp connection
        setTimeout(() => {
          navigate('/connect');
        }, 1500);
        
      } else if (event.data?.type === 'PAYMENT_FAILED') {
        setShowPaymentModal(false);
        setIframeUrl('');
        
        toast({
          title: "התשלום נכשל",
          description: "אנא נסה שוב או פנה לתמיכה",
          variant: "destructive",
        });
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [queryClient, navigate]);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-tranzila-payment', {
        body: { 
          planType: billingPeriod,
          redirectOrigin: window.location.origin 
        },
      });

      if (error) throw error;

      if (data?.iframeUrl) {
        setIframeUrl(data.iframeUrl);
        setShowPaymentModal(true);
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן ליצור תשלום. אנא נסה שוב.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    // This will be handled by SubscriptionManagement component
    queryClient.invalidateQueries({ queryKey: ['userProfile'] });
  };

  const handleReactivateSubscription = async () => {
    // This will be handled by SubscriptionManagement component
    queryClient.invalidateQueries({ queryKey: ['userProfile'] });
  };

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
                <ThreeDButton 
                  onClick={handleUpgrade}
                  disabled={loading || isPaid}
                  variant="primary"
                  className="w-full"
                >
                  {loading ? (
                    "מעבד..."
                  ) : isPaid ? (
                    "התוכנית הנוכחית שלך"
                  ) : (
                    <>
                      התחל עכשיו
                      <ArrowLeft className="mr-2 h-5 w-5" />
                    </>
                  )}
                </ThreeDButton>
                
                {!isPaid && (
                  <p className="text-center text-sm text-gray-500 mt-4">
                    לאחר התשלום תועבר לחיבור וואטסאפ
                  </p>
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

        {/* Tranzila Payment Modal */}
        <TranzilaPaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setIframeUrl('');
          }}
          iframeUrl={iframeUrl}
        />
      </div>
    </Layout>
  );
};

export default Billing;
