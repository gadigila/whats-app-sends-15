
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Phone } from 'lucide-react';
import { usePhoneAuth } from '@/hooks/usePhoneAuth';

interface PhoneAuthConnectorProps {
  onConnected: () => void;
}

const PhoneAuthConnector = ({ onConnected }: PhoneAuthConnectorProps) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const { authenticateWithPhone, isAuthenticating } = usePhoneAuth();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      return;
    }

    try {
      const result = await authenticateWithPhone.mutateAsync(phoneNumber);
      
      if (result.success && !result.code_required) {
        onConnected();
      } else if (result.code_required) {
        setShowCodeInput(true);
      }
    } catch (error) {
      console.error('Phone authentication failed:', error);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement code verification
    console.log('Code verification not implemented yet:', verificationCode);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          חיבור דרך מספר טלפון
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!showCodeInput ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div>
              <Label htmlFor="phone">מספר טלפון</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+972-50-123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="text-right"
                dir="ltr"
              />
              <p className="text-sm text-gray-500 mt-1">
                הזן את מספר הטלפון הרשום בוואטסאפ שלך
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={isAuthenticating || !phoneNumber.trim()}
            >
              {isAuthenticating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Phone className="h-4 w-4 mr-2" />
              )}
              התחבר דרך טלפון
            </Button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div>
              <Label htmlFor="code">קוד אימות</Label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="text-center"
                maxLength={6}
              />
              <p className="text-sm text-gray-500 mt-1">
                הזן את הקוד שנשלח לטלפון {phoneNumber}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                type="submit" 
                className="flex-1"
                disabled={!verificationCode.trim()}
              >
                אמת קוד
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setShowCodeInput(false)}
              >
                חזור
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default PhoneAuthConnector;
