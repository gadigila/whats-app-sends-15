
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone } from 'lucide-react';

const WhatsAppInstructions = () => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <Smartphone className="h-5 w-5 text-green-500 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">הערות חשובות</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• השאר את הטלפון שלך מחובר לאינטרנט</li>
              <li>• החיבור יישאר פעיל כל עוד הטלפון מחובר</li>
              <li>• אתה יכול להתנתק בכל עת מהטלפון או מכאן</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppInstructions;
