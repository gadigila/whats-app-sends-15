
import { Lock, Crown } from 'lucide-react';
import { ThreeDButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';

interface LockedFeatureProps {
  title: string;
  description: string;
  className?: string;
}

const LockedFeature = ({ title, description, className }: LockedFeatureProps) => {
  return (
    <Card className={`border-2 border-dashed border-gray-300 ${className}`}>
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-gray-100 p-4 mb-4">
          <Lock className="h-8 w-8 text-gray-400" />
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        
        <p className="text-gray-600 mb-6 max-w-sm">
          {description}
        </p>

        <Link to="/billing">
          <ThreeDButton variant="primary">
            <Crown className="h-4 w-4 ml-2" />
            שדרג עכשיו
          </ThreeDButton>
        </Link>
      </CardContent>
    </Card>
  );
};

export default LockedFeature;
