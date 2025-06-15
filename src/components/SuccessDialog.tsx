
import { CheckCircle, Calendar, Send, ArrowLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface SuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'sent' | 'scheduled';
  title?: string;
  description?: string;
  showActions?: boolean;
}

const SuccessDialog = ({ 
  isOpen, 
  onClose, 
  type, 
  title, 
  description,
  showActions = true 
}: SuccessDialogProps) => {
  const navigate = useNavigate();

  const defaultTitles = {
    sent: 'ההודעה נשלחה בהצלחה!',
    scheduled: 'ההודעה תוזמנה בהצלחה!'
  };

  const defaultDescriptions = {
    sent: 'ההודעה שלך נשלחה לכל הקבוצות שנבחרו.',
    scheduled: 'ההודעה שלך תישלח בזמן שנקבע.'
  };

  const handleViewMessages = () => {
    if (type === 'sent') {
      navigate('/sent');
    } else {
      navigate('/scheduled');
    }
    onClose();
  };

  const handleSendAnother = () => {
    navigate('/compose');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <DialogTitle className="text-xl">
            {title || defaultTitles[type]}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {description || defaultDescriptions[type]}
          </DialogDescription>
        </DialogHeader>

        {showActions && (
          <div className="flex flex-col gap-3 mt-6">
            <Button onClick={handleViewMessages} className="w-full">
              {type === 'sent' ? (
                <>
                  <Send className="h-4 w-4 ml-2" />
                  הצג הודעות שנשלחו
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 ml-2" />
                  הצג הודעות מתוזמנות
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleSendAnother} className="w-full">
              <ArrowLeft className="h-4 w-4 ml-2" />
              שלח הודעה נוספת
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SuccessDialog;
