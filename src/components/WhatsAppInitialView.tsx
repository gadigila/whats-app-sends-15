
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle } from 'lucide-react';

interface WhatsAppInitialViewProps {
  onConnect: () => void;
}

const WhatsAppInitialView = ({ onConnect }: WhatsAppInitialViewProps) => {
  console.log('🎯 WhatsAppInitialView rendered - should show connect button');
  
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
          onClick={() => {
            console.log('🚀 Connect button clicked!');
            onConnect();
          }}
          size="lg"
          className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg font-semibold"
        >
          התחבר לוואטסאפ
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppInitialView;
