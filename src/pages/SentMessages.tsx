
import { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Clock, Users, Search, Filter } from 'lucide-react';

interface SentMessage {
  id: string;
  message: string;
  groups: string[];
  sentAt: Date;
  status: 'delivered' | 'failed' | 'pending';
  recipients: number;
  delivered: number;
  hasAttachment: boolean;
}

const SentMessages = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [messages] = useState<SentMessage[]>([
    {
      id: '1',
      message: 'התראת מבצק מבזק! 🚨 קבלו 70% הנחה על כל התוכניות הפרימיום ל-24 השעות הבאות בלבד. אל תפספסו!',
      groups: ['צוות שיווק', 'לקוחות VIP'],
      sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      status: 'delivered',
      recipients: 150,
      delivered: 147,
      hasAttachment: true,
    },
    {
      id: '2',
      message: 'בוקר טוב צוות! הזכרה לפגישת הסטנדאפ היומית. אנא הצטרפו בשעה 9:00.',
      groups: ['צוות מכירות'],
      sentAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      status: 'delivered',
      recipients: 25,
      delivered: 25,
      hasAttachment: false,
    },
    {
      id: '3',
      message: 'תחזוקת מערכת מתוכננת הלילה בין 23:00 ל-02:00. אנא תכננו בהתאם.',
      groups: ['כל הקבוצות'],
      sentAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      status: 'pending',
      recipients: 200,
      delivered: 180,
      hasAttachment: false,
    },
    {
      id: '4',
      message: 'ברוכים הבאים לשירות הפרימיום שלנו! הנה המדריך להתחלה שלכם.',
      groups: ['לקוחות VIP'],
      sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      status: 'failed',
      recipients: 50,
      delivered: 0,
      hasAttachment: true,
    },
    {
      id: '5',
      message: 'תודה על הרכישה! הזמנה מספר 12345 אושרה ותישלח בקרוב.',
      groups: ['צוות שיווק'],
      sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      status: 'delivered',
      recipients: 75,
      delivered: 73,
      hasAttachment: false,
    },
  ]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle className="h-3 w-3 ml-1" />
            נמסר
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="text-red-600 border-red-600">
            <XCircle className="h-3 w-3 ml-1" />
            נכשל
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <Clock className="h-3 w-3 ml-1" />
            ממתין
          </Badge>
        );
      default:
        return <Badge variant="outline">לא ידוע</Badge>;
    }
  };

  const formatDateTime = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'עכשיו';
    } else if (diffInHours < 24) {
      return `לפני ${Math.floor(diffInHours)} שעות`;
    } else {
      return date.toLocaleDateString('he-IL', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const getDeliveryRate = (delivered: number, recipients: number) => {
    return recipients > 0 ? Math.round((delivered / recipients) * 100) : 0;
  };

  const filteredMessages = messages.filter((message) => {
    const matchesSearch = message.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         message.groups.some(group => group.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || message.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalMessages = messages.length;
  const deliveredMessages = messages.filter(msg => msg.status === 'delivered').length;
  const failedMessages = messages.filter(msg => msg.status === 'failed').length;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">הודעות שנשלחו</h1>
          <p className="text-gray-600">צפה בהיסטוריית ההודעות ובסטטיסטיקות המסירה</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">סך נשלחו</p>
                  <p className="text-2xl font-bold">{totalMessages}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">נמסרו</p>
                  <p className="text-2xl font-bold">{deliveredMessages}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">נכשלו</p>
                  <p className="text-2xl font-bold">{failedMessages}</p>
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
                  <p className="text-sm text-gray-600">אחוז הצלחה</p>
                  <p className="text-2xl font-bold">
                    {totalMessages > 0 ? Math.round((deliveredMessages / totalMessages) * 100) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="חפש הודעות..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 ml-2" />
              <SelectValue placeholder="סנן לפי סטטוס" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל ההודעות</SelectItem>
              <SelectItem value="delivered">נמסרו</SelectItem>
              <SelectItem value="pending">ממתינות</SelectItem>
              <SelectItem value="failed">נכשלו</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Messages List */}
        <div className="space-y-4">
          {filteredMessages.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">לא נמצאו הודעות</h3>
                <p className="text-gray-600">נסה לתקן את החיפוש או הסינון.</p>
              </CardContent>
            </Card>
          ) : (
            filteredMessages.map((message) => (
              <Card key={message.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <p className="text-gray-900 font-medium line-clamp-2 pl-4">
                          {message.message}
                        </p>
                        {getStatusBadge(message.status)}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatDateTime(message.sentAt)}</span>
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
                    
                    <div className="flex flex-col items-end text-left">
                      <div className="text-sm text-gray-600 mb-1">
                        {message.delivered} / {message.recipients} נמסרו
                      </div>
                      <div className={`text-lg font-semibold ${
                        message.status === 'delivered' ? 'text-green-600' : 
                        message.status === 'failed' ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {getDeliveryRate(message.delivered, message.recipients)}%
                      </div>
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

export default SentMessages;
