
import { Card, CardContent } from '@/components/ui/card';

const WhatsAppCreatingChannel = () => {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <h3 className="text-lg font-semibold">מכין את החיבור...</h3>
          <p className="text-gray-600 text-sm">
            יוצר ערוץ בטוח לחיבור הוואטסאפ שלך
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppCreatingChannel;
