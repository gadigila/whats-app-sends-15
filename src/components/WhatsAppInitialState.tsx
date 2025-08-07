
import { useState } from 'react';
import { Button, ThreeDButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Loader2 } from 'lucide-react';

interface WhatsAppInitialStateProps {
  onCreateChannel: () => Promise<void>;
}

const WhatsAppInitialState = ({ onCreateChannel }: WhatsAppInitialStateProps) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateChannel = async () => {
    if (isCreating) return;
    
    setIsCreating(true);
    try {
      await onCreateChannel();
    } catch (error) {
      console.error('❌ Channel creation failed:', error);
    } finally {
      setIsCreating(false);
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
        <ThreeDButton
          variant="primary"
          size="lg"
          onClick={handleCreateChannel}
          disabled={isCreating}
        >
          {isCreating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              יוצר ערוץ...
            </>
          ) : (
            "התחבר לוואטסאפ"
          )}
        </ThreeDButton>
      </CardContent>
    </Card>
  );
};

export default WhatsAppInitialState;
