
import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Edit, Trash2, Users, RefreshCw } from 'lucide-react';
import { useScheduledMessages } from '@/hooks/useScheduledMessages';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import LockedFeature from '@/components/LockedFeature';

const ScheduledMessages = () => {
  const { messages, isLoading, deleteMessage, isDeleting, refetch } = useScheduledMessages();
  const { trialStatus, isLoading: trialLoading } = useTrialStatus();
  
  // Check if user has access to features
  const hasAccess = !trialLoading && trialStatus && (!trialStatus.isExpired || trialStatus.isPaid);

  const handleDelete = (id: string) => {
    deleteMessage(id);
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

  if (trialLoading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-lg">טוען...</div>
        </div>
      </Layout>
    );
  }

  // If user doesn't have access, show locked feature
  if (!hasAccess) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">הודעות מתוזמנות</h1>
            <p className="text-gray-600">נהל את משלוחי ההודעות העתידיים שלך</p>
          </div>
          
          <LockedFeature
            title="הודעות מתוזמנות"
            description="כדי לנהל הודעות מתוזמנות, אנא שדרג את החשבון שלך."
            className="min-h-96"
          />
        </div>
      </Layout>
    );
  }

  const pendingMessages = messages.filter(msg => msg.status === 'pending');
  const todayMessages = messages.filter(msg => {
    const sendDate = new Date(msg.send_at);
    const today = new Date();
    return sendDate.toDateString() === today.toDateString();
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">הודעות מתוזמנות</h1>
            <p className="text-gray-600">נהל את משלוחי ההודעות העתידיים שלך</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => refetch()}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 ml-2" />
              רענן
            </Button>
            <Button 
              onClick={() => window.location.href = '/compose'}
              className="bg-green-600 hover:bg-green-700"
            >
              תזמן הודעה חדשה
            </Button>
          </div>
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
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">ממתינות לשליחה</p>
                  <p className="text-2xl font-bold">{pendingMessages.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">היום</p>
                  <p className="text-2xl font-bold">{todayMessages.length}</p>
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
                          <span>{formatDateTime(message.send_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{message.total_groups || message.group_ids.length} קבוצות</span>
                        </div>
                        {message.group_names && message.group_names.length > 0 && (
                          <div className="text-xs text-blue-600">
                            {message.group_names.slice(0, 2).join(', ')}
                            {message.group_names.length > 2 && ` +${message.group_names.length - 2}`}
                          </div>
                        )}
                        {message.media_url && (
                          <Badge variant="secondary" className="text-xs">
                            יש קובץ מצורף
                          </Badge>
                        )}
                      </div>
                      
                      {message.error_message && (
                        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                          שגיאה: {message.error_message}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(message.id)}
                        disabled={isDeleting}
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
