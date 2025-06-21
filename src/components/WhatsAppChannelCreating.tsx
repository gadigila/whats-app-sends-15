
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface WhatsAppChannelCreatingProps {
  countdown: number;
}

const WhatsAppChannelCreating = ({ countdown }: WhatsAppChannelCreatingProps) => {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-green-600">{countdown}</span>
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">מכין את החיבור...</h3>
        <p className="text-gray-600 mb-4">
          יוצר ערוץ בטוח לחיבור הוואטסאפ שלך
        </p>
        <p className="text-sm text-orange-600">
          זמן המתנה נדרש: {countdown} שניות נותרו
        </p>
        <p className="text-xs text-gray-500 mt-2">
          זהו דרישה של WHAPI - אנא המתן עד לסיום
        </p>
      </CardContent>
    </Card>
  );
};

export default WhatsAppChannelCreating;
