import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TranzilaPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  iframeUrl: string;
}

const TranzilaPaymentModal = ({ isOpen, onClose, iframeUrl }: TranzilaPaymentModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl h-[80vh] bg-background rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">השלמת תשלום</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* iFrame */}
        <div className="w-full h-[calc(100%-60px)]">
          {iframeUrl ? (
            <iframe
              src={iframeUrl}
              className="w-full h-full border-0"
              title="Tranzila Payment"
              sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">טוען טופס תשלום...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranzilaPaymentModal;
