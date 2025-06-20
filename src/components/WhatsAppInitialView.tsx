
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle } from 'lucide-react';
import { useState } from 'react';

interface WhatsAppInitialViewProps {
  onConnect: () => void;
}

const WhatsAppInitialView = ({ onConnect }: WhatsAppInitialViewProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  
  console.log('🎯 WhatsAppInitialView rendered - should show connect button');
  
  const handleConnectClick = async () => {
    if (isConnecting) {
      console.log('⚠️ Connection already in progress, ignoring click');
      return;
    }
    
    console.log('🚀 Connect button clicked in WhatsAppInitialView!');
    
    setIsConnecting(true);
    
    try {
      await onConnect();
    } catch (error) {
      console.error('❌ Error in onConnect:', error);
    } finally {
      // Reset after a delay to prevent rapid clicks
      setTimeout(() => {
        setIsConnecting(false);
      }, 3000);
    }
  };
  
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="p-4 bg-green-50 rounded-full w-fit mx-auto mb-6">
          <MessageCircle className="h-12 w-12 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          מוכן להתחבר לוואטסאפ?
        </h3>
        <p className="text-gray-600 mb-6">
          נתחיל ביצירת חיבור בטוח בינך לבין וואטסאפ
        </p>
        <Button
          onClick={handleConnectClick}
          disabled={isConnecting}
          size="lg"
          className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? "מתחבר..." : "התחבר לוואטסאפ"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppInitialView;
