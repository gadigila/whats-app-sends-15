
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Phone, AlertCircle } from 'lucide-react';
import { usePhoneAuth } from '@/hooks/usePhoneAuth';

interface PhoneAuthConnectorProps {
  onConnected?: () => void;
}

const PhoneAuthConnector = ({ onConnected }: PhoneAuthConnectorProps) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState<string | null>(null);
  
  const { authenticateWithPhone, isAuthenticating } = usePhoneAuth();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      setError('אנא הזן מספר טלפון');
      return;
    }
    
    try {
      setError(null);
      console.log('📱 Submitting phone number:', phoneNumber);
      
      const result = await authenticateWithPhone.mutateAsync({
        phoneNumber: phoneNumber.trim()
      });
      
      if (result.success && !result.code_required) {
        // Connected immediately
        onConnected?.();
      } else if (result.code_required) {
        // Need verification code
        setStep('code');
      }
    } catch (error) {
      console.error('❌ Phone authentication failed:', error);
      setError(error.message || 'שגיאה באימות מספר הטלפון');
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode.trim()) {
      setError('אנא הזן קוד אימות');
      return;
    }
    
    try {
      setError(null);
      console.log('🔢 Submitting verification code');
      
      const result = await authenticateWithPhone.mutateAsync({
        phoneNumber: phoneNumber.trim(),
        verificationCode: verificationCode.trim()
      });
      
      if (result.success) {
        onConnected?.();
      }
    } catch (error) {
      console.error('❌ Code verification failed:', error);
      setError(error.message || 'קוד האימות שגוי');
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setVerificationCode('');
    setError(null);
  };

  return (
    <Card>
      <CardContent className="p-8">
        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-6">
            <div className="text-center">
              <div className="p-4 bg-orange-50 rounded-full w-fit mx-auto mb-6">
                <Phone className="h-12 w-12 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                חיבור עם מספר טלפון
              </h3>
              <p className="text-gray-600 text-sm">
                הזן את מספר הוואטסאפ שלך
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  מספר טלפון (עם קידומת מדינה)
                </label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="972501234567+"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="text-left"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-1">
                  לדוגמה: 972501234567+ (ללא רווחים או מקפים)
                </p>
              </div>
              
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              
              <Button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700"
                disabled={isAuthenticating}
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    שולח קוד אימות...
                  </>
                ) : (
                  'שלח קוד אימות'
                )}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} className="space-y-6">
            <div className="text-center">
              <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-6">
                <Phone className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                הזן קוד אימות
              </h3>
              <p className="text-gray-600 text-sm">
                נשלח קוד אימות ל-{phoneNumber}
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                  קוד אימות
                </label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="text-center text-lg font-mono"
                  maxLength={6}
                />
              </div>
              
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={isAuthenticating}
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      מאמת קוד...
                    </>
                  ) : (
                    'אמת קוד'
                  )}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToPhone}
                  className="w-full"
                  disabled={isAuthenticating}
                >
                  חזור למספר טלפון
                </Button>
              </div>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default PhoneAuthConnector;
