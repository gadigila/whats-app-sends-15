
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle2, Clock } from 'lucide-react';

const WhatsAppCreatingChannel = () => {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="space-y-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-green-600 animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-gray-900">מכין את החיבור...</h3>
            <p className="text-gray-600">
              יוצר ערוץ בטוח לחיבור הוואטסאפ שלך
            </p>
          </div>
          
          <div className="space-y-3 text-sm text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>יוצר ערוץ חדש ב-WHAPI</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span>מחכה לאתחול הערוץ</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>מכין קוד QR</span>
            </div>
          </div>
          
          <div className="text-xs text-gray-400 border-t pt-4">
            התהליך עשוי לקחת עד דקה. נא להמתין...
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppCreatingChannel;
