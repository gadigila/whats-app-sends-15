import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Mail, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useTrialUsage } from '@/hooks/useTrialUsage';
import { Skeleton } from '@/components/ui/skeleton';

const TrialUsageCard = () => {
  const { data: usage, isLoading } = useTrialUsage();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>שימוש בתקופת הניסיון</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!usage) return null;

  const messagesPercentage = (usage.messagesSent / usage.messagesLimit) * 100;
  const chatsPercentage = (usage.uniqueChats / usage.chatsLimit) * 100;

  const getStatusColor = (percentage: number) => {
    if (percentage >= 100) return 'text-destructive';
    if (percentage >= 80) return 'text-orange-600';
    return 'text-primary';
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          שימוש בתקופת הניסיון
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Messages Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">הודעות שנשלחו</span>
            </div>
            <span className={`text-sm font-bold ${getStatusColor(messagesPercentage)}`}>
              {usage.messagesSent}/{usage.messagesLimit}
            </span>
          </div>
          <Progress value={messagesPercentage} className="h-2" />
        </div>

        {/* Chats Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">צ'אטים ייחודיים</span>
            </div>
            <span className={`text-sm font-bold ${getStatusColor(chatsPercentage)}`}>
              {usage.uniqueChats}/{usage.chatsLimit}
            </span>
          </div>
          <Progress value={chatsPercentage} className="h-2" />
        </div>

        {/* Upgrade Message */}
        <div className="mt-4 rounded-lg bg-primary/5 p-3 text-center">
          <p className="text-sm text-muted-foreground">
            💎 משתמשים משלמים נהנים מהודעות וצ'אטים ללא הגבלה
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrialUsageCard;
