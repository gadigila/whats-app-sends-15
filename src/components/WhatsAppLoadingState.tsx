
import Layout from '@/components/Layout';
import { Loader2 } from 'lucide-react';

const WhatsAppLoadingState = () => {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto flex flex-col items-center min-h-[75vh] justify-center gap-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="text-gray-700">טוען...</span>
      </div>
    </Layout>
  );
};

export default WhatsAppLoadingState;
