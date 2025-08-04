
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Trash2, Users, MessageSquare } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useScheduledMessages } from '@/hooks/useScheduledMessages';
import { Link } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

const ScheduledMessages = () => {
  const { scheduledMessages, isLoading, deleteMessage } = useScheduledMessages();
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);

  const handleDeleteConfirm = () => {
    if (deleteMessageId) {
      deleteMessage.mutate(deleteMessageId);
      setDeleteMessageId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">ממתין</Badge>;
      case 'sent':
        return <Badge variant="outline" className="text-green-600 border-green-600">נשלח</Badge>;
      case 'failed':
        return <Badge variant="outline" className="text-red-600 border-red-600">נכשל</Badge>;
      default:
        return <Badge variant="outline">לא ידוע</Badge>;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const next24Hours = scheduledMessages.filter(msg => {
    const sendTime = new Date(msg.send_at).getTime();
    const now = Date.now();
    return sendTime - now < 24 * 60 * 60 * 1000 && sendTime > now;
  }).length;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-lg">טוען הודעות מתוזמנות...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">הודעות מתוזמנות</h1>
            <p className="text-gray-600">נהל את משלוחי ההודעות העתידיים שלך</p>
          </div>
          <Link to="/compose">
            <Button className="bg-green-600 hover:bg-green-700">
              תזמן הודעה חדשה
            </Button>
          </Link>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">סך מתוזמנות</p>
                  <p className="text-2xl font-bold">{scheduledMessages.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">ב-24 השעות הבאות</p>
                  <p className="text-2xl font-bold">{next24Hours}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">קבוצות ממוקדות</p>
                  <p className="text-2xl font-bold">
                    {scheduledMessages.reduce((acc, msg) => acc + (msg.total_groups || 0), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Messages List */}
        <div className="space-y-4">
          {scheduledMessages.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">אין הודעות מתוזמנות</h3>
                <p className="text-gray-600 mb-6">עדיין לא תזמנת הודעות. תזמן את ההודעה הראשונה שלך עכשיו.</p>
                <Link to="/compose">
                  <Button className="bg-green-600 hover:bg-green-700">
                    תזמן את ההודעה הראשונה שלך
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            scheduledMessages.map((message) => (
              <Card key={message.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <p className="text-gray-900 font-medium line-clamp-2">
                          {message.message}
                        </p>
                        {getStatusBadge(message.status)}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDateTime(message.send_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{message.group_names?.join(', ') || `${message.total_groups || 0} קבוצות`}</span>
                        </div>
                        {message.media_url && (
                          <Badge variant="secondary" className="text-xs">
                            יש קובץ מצורף
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-600 hover:bg-red-50"
                            disabled={deleteMessage.isPending}
                            onClick={() => setDeleteMessageId(message.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-right">מחק הודעה מתוזמנת</AlertDialogTitle>
                            <AlertDialogDescription className="text-right">
                              האם אתה בטוח שברצונך למחוק הודעה זו? הפעולה בלתי הפיכה והודעה לא תישלח.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteConfirm}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              מחק
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ScheduledMessages;
