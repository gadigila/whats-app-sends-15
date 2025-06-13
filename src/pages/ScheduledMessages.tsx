
import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Edit, Trash2, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ScheduledMessage {
  id: string;
  message: string;
  groups: string[];
  scheduledFor: Date;
  status: 'pending' | 'sent' | 'failed';
  hasAttachment: boolean;
}

const ScheduledMessages = () => {
  const [messages, setMessages] = useState<ScheduledMessage[]>([
    {
      id: '1',
      message: 'אל תשכחו מהמבצע המיוחד שלנו שמסתיים מחר! קבלו 50% הנחה על כל התכונות הפרימיום.',
      groups: ['צוות שיווק', 'לקוחות VIP'],
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'pending',
      hasAttachment: true,
    },
    {
      id: '2',
      message: 'עדכון שבועי לצוות: אנא הגישו את הדוחות שלכם עד יום שישי.',
      groups: ['צוות מכירות'],
      scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: 'pending',
      hasAttachment: false,
    },
    {
      id: '3',
      message: 'ברכות חג מהצוות שלנו לצוות שלכם!',
      groups: ['כל הקבוצות'],
      scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending',
      hasAttachment: true,
    },
  ]);

  const handleEdit = (id: string) => {
    toast({
      title: "ערוך הודעה",
      description: "תכונת העריכה תפתח את הודעת הכתיבה עם ההודעה הזו.",
    });
  };

  const handleDelete = (id: string) => {
    setMessages(messages.filter(msg => msg.id !== id));
    toast({
      title: "הודעה נמחקה",
      description: "ההודעה המתוזמנת נמחקה.",
    });
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

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('he-IL', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">הודעות מתוזמנות</h1>
            <p className="text-gray-600">נהל את משלוחי ההודעות העתידיים שלך</p>
          </div>
          <Button 
            onClick={() => window.location.href = '/compose'}
            className="bg-green-600 hover:bg-green-700"
          >
            תזמן הודעה חדשה
          </Button>
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
                  <p className="text-2xl font-bold">{messages.length}</p>
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
                  <p className="text-2xl font-bold">
                    {messages.filter(msg => msg.scheduledFor.getTime() - Date.now() < 24 * 60 * 60 * 1000).length}
                  </p>
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
                  <p className="text-2xl font-bold">8</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Messages List */}
        <div className="space-y-4">
          {messages.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">אין הודעות מתוזמנות</h3>
                <p className="text-gray-600 mb-6">עדיין לא תזמנת הודעות.</p>
                <Button 
                  onClick={() => window.location.href = '/compose'}
                  className="bg-green-600 hover:bg-green-700"
                >
                  תזמן את ההודעה הראשונה שלך
                </Button>
              </CardContent>
            </Card>
          ) : (
            messages.map((message) => (
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
                          <span>{formatDateTime(message.scheduledFor)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{message.groups.join(', ')}</span>
                        </div>
                        {message.hasAttachment && (
                          <Badge variant="secondary" className="text-xs">
                            יש קובץ מצורף
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(message.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(message.id)}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
