
import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Send, Upload, Image, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useWhatsAppMessages } from '@/hooks/useWhatsAppMessages';
import { useSegments } from '@/hooks/useSegments';
import LockedFeature from '@/components/LockedFeature';
import SuccessDialog from '@/components/SuccessDialog';
import MessageRecipientsSelector from '@/components/MessageRecipientsSelector';

const MessageComposer = () => {
  const [message, setMessage] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [successDialog, setSuccessDialog] = useState<{
    isOpen: boolean;
    type: 'sent' | 'scheduled';
  }>({ isOpen: false, type: 'sent' });
  
  const { trialStatus, isLoading } = useTrialStatus();
  const { groups } = useWhatsAppGroups();
  const { segments } = useSegments();
  const { sendImmediateMessage, scheduleMessage } = useWhatsAppMessages();
  
  // Check if user has access to features
  const hasAccess = !isLoading && trialStatus && (!trialStatus.isExpired || trialStatus.isPaid);

  // Get all unique group IDs from both direct selection and segments
  const getAllSelectedGroupIds = () => {
    const groupIdsFromSegments = new Set<string>();
    selectedSegmentIds.forEach(segmentId => {
      const segment = segments.find(s => s.id === segmentId);
      if (segment) {
        segment.group_ids.forEach(groupId => groupIdsFromSegments.add(groupId));
      }
    });
    
    const allGroupIds = new Set([...selectedGroupIds, ...Array.from(groupIdsFromSegments)]);
    return Array.from(allGroupIds);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasAccess) return;
    
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "קובץ גדול מדי",
          description: "אנא בחר קובץ קטן מ-10MB.",
          variant: "destructive",
        });
        return;
      }
      setAttachedFile(file);
      toast({
        title: "קובץ צורף",
        description: `${file.name} צורף להודעה שלך.`,
      });
    }
  };

  const handleSendNow = () => {
    if (!hasAccess) return;
    
    if (!message.trim()) {
      toast({
        title: "הודעה נדרשת",
        description: "אנא הכנס הודעה לשליחה.",
        variant: "destructive",
      });
      return;
    }
    
    const allGroupIds = getAllSelectedGroupIds();
    if (allGroupIds.length === 0) {
      toast({
        title: "בחר נמענים",
        description: "אנא בחר קבוצות או קטגוריות לשליחת ההודעה.",
        variant: "destructive",
      });
      return;
    }

    sendImmediateMessage.mutate({
      groupIds: allGroupIds,
      message,
      mediaUrl: attachedFile ? URL.createObjectURL(attachedFile) : undefined
    }, {
      onSuccess: () => {
        setSuccessDialog({ isOpen: true, type: 'sent' });
        // Clear form
        setMessage('');
        setSelectedGroupIds([]);
        setSelectedSegmentIds([]);
        setAttachedFile(null);
      }
    });
  };

  const handleSchedule = () => {
    if (!hasAccess) return;
    
    const allGroupIds = getAllSelectedGroupIds();
    if (!message.trim() || allGroupIds.length === 0 || !scheduleDate || !scheduleTime) {
      toast({
        title: "חסר מידע",
        description: "אנא מלא את כל השדות כדי לתזמן הודעה.",
        variant: "destructive",
      });
      return;
    }

    const sendAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

    scheduleMessage.mutate({
      groupIds: allGroupIds,
      message,
      mediaUrl: attachedFile ? URL.createObjectURL(attachedFile) : undefined,
      sendAt
    }, {
      onSuccess: () => {
        setSuccessDialog({ isOpen: true, type: 'scheduled' });
        // Clear form
        setMessage('');
        setSelectedGroupIds([]);
        setSelectedSegmentIds([]);
        setScheduleDate('');
        setScheduleTime('');
        setAttachedFile(null);
      }
    });
  };

  if (isLoading) {
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">כתיבת הודעה</h1>
            <p className="text-gray-600">צור ושלח הודעות לקבוצות הוואטסאפ שלך</p>
          </div>
          
          <LockedFeature
            title="כתיבת הודעות"
            description="כדי לכתוב ולשלוח הודעות לקבוצות הוואטסאפ שלך, אנא שדרג את החשבון שלך."
            className="min-h-96"
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">כתיבת הודעה</h1>
          <p className="text-gray-600">צור ושלח הודעות לקבוצות הוואטסאפ שלך</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Message Content */}
            <Card>
              <CardHeader>
                <CardTitle>תוכן ההודעה</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="message">טקסט ההודעה</Label>
                  <Textarea
                    id="message"
                    placeholder="כתוב את ההודעה שלך כאן..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className="mt-1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {message.length}/4096 תווים
                  </p>
                </div>

                <div>
                  <Label>קובץ מצורף</Label>
                  <div className="mt-1 flex items-center gap-4">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*,video/*,.pdf,.doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">העלה קובץ</span>
                      </div>
                    </label>
                    
                    {attachedFile && (
                      <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
                        {attachedFile.type.startsWith('image/') ? (
                          <Image className="h-4 w-4 text-green-600" />
                        ) : (
                          <FileText className="h-4 w-4 text-green-600" />
                        )}
                        <span className="text-sm text-green-700">{attachedFile.name}</span>
                        <button
                          onClick={() => setAttachedFile(null)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recipients */}
            <Card>
              <CardHeader>
                <CardTitle>נמענים</CardTitle>
              </CardHeader>
              <CardContent>
                <MessageRecipientsSelector
                  selectedGroupIds={selectedGroupIds}
                  selectedSegmentIds={selectedSegmentIds}
                  onGroupsChange={setSelectedGroupIds}
                  onSegmentsChange={setSelectedSegmentIds}
                />
              </CardContent>
            </Card>

            {/* Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  תזמון (אופציונלי)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">תאריך</Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">שעה</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview & Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>תצוגה מקדימה</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {message || "ההודעה שלך תופיע כאן..."}
                    </p>
                    {attachedFile && (
                      <div className="mt-2 p-2 bg-gray-50 rounded flex items-center gap-2">
                        {attachedFile.type.startsWith('image/') ? (
                          <Image className="h-4 w-4 text-gray-600" />
                        ) : (
                          <FileText className="h-4 w-4 text-gray-600" />
                        )}
                        <span className="text-xs text-gray-600">{attachedFile.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>פעולות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleSendNow}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                  disabled={sendImmediateMessage.isPending}
                >
                  <Send className="h-4 w-4 ml-2" />
                  {sendImmediateMessage.isPending ? 'שולח...' : 'שלח עכשיו'}
                </Button>
                
                <Button
                  onClick={handleSchedule}
                  variant="outline"
                  className="w-full"
                  size="lg"
                  disabled={!scheduleDate || !scheduleTime || scheduleMessage.isPending}
                >
                  <Clock className="h-4 w-4 ml-2" />
                  {scheduleMessage.isPending ? 'מתזמן...' : 'תזמן הודעה'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-600 space-y-2">
                  <p className="font-medium">טיפים:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• שמור על הודעות קצרות ומעניינות</li>
                    <li>• תמונות מקבלות יותר מעורבות מטקסט בלבד</li>
                    <li>• זמנים טובים: 10-11 בבוקר, 7-9 בערב</li>
                    <li>• השתמש בקטגוריות לשליחה מהירה</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Success Dialog */}
        <SuccessDialog
          isOpen={successDialog.isOpen}
          onClose={() => setSuccessDialog({ isOpen: false, type: 'sent' })}
          type={successDialog.type}
        />
      </div>
    </Layout>
  );
};

export default MessageComposer;
