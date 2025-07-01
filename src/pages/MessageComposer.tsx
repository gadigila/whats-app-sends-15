import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Send, Upload, Image, FileText, X, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useWhatsAppMessages } from '@/hooks/useWhatsAppMessages';
import { useSegments } from '@/hooks/useSegments';
import LockedFeature from '@/components/LockedFeature';
import SuccessDialog from '@/components/SuccessDialog';
import MessageRecipientsSelector from '@/components/MessageRecipientsSelector';
import { supabase } from '@/integrations/supabase/client';

const MessageComposer = () => {
  const [message, setMessage] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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

  // ✅ FIXED: Enhanced file upload with Supabase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasAccess) return;
    
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "קובץ גדול מדי",
        description: "אנא בחר קובץ קטן מ-10MB.",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/mov', 'video/3gp',
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "סוג קובץ לא נתמך",
        description: "אנא בחר תמונה, וידאו, PDF או מסמך Office.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Show uploading toast
      toast({
        title: "מעלה קובץ...",
        description: "אנא המתן בזמן העלאת הקובץ.",
      });

      // Create unique filename with timestamp and random string
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      console.log('📤 Uploading file to Supabase Storage:', fileName);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('❌ Upload error:', error);
        toast({
          title: "שגיאה בהעלאה",
          description: error.message || "לא הצלחנו להעלות את הקובץ. נסה שוב.",
          variant: "destructive",
        });
        return;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('media')
        .getPublicUrl(data.path);

      const publicUrl = publicUrlData.publicUrl;
      console.log('✅ File uploaded successfully:', publicUrl);

      // Verify the URL is accessible
      try {
        const response = await fetch(publicUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error('URL not accessible');
        }
      } catch (urlError) {
        console.error('❌ Public URL not accessible:', urlError);
        toast({
          title: "שגיאה בגישה לקובץ",
          description: "הקובץ הועלה אך לא נגיש. בדוק הגדרות האבטחה.",
          variant: "destructive",
        });
        return;
      }

      // Update state with both file and public URL
      setAttachedFile(file);
      setMediaUrl(publicUrl);
      
      toast({
        title: "קובץ הועלה בהצלחה! ✅",
        description: `${file.name} מוכן לשליחה.`,
      });

    } catch (error) {
      console.error('💥 Upload error:', error);
      toast({
        title: "שגיאה בהעלאה",
        description: "אירעה שגיאה בהעלאת הקובץ. נסה שוב.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // ✅ FIXED: Enhanced file removal function
  const removeAttachedFile = async () => {
    // If we have a media URL, try to delete it from storage
    if (mediaUrl && attachedFile) {
      try {
        // Extract file path from public URL
        const urlParts = mediaUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        // Delete from Supabase Storage
        const { error } = await supabase.storage
          .from('media')
          .remove([fileName]);
        
        if (error) {
          console.warn('⚠️ Failed to delete file from storage:', error);
          // Don't show error to user, just log it
        } else {
          console.log('🗑️ File deleted from storage successfully');
        }
      } catch (error) {
        console.warn('⚠️ Error deleting file from storage:', error);
      }
    }

    // Clear state
    setAttachedFile(null);
    setMediaUrl(null);
    
    toast({
      title: "קובץ הוסר",
      description: "הקובץ המצורף הוסר מההודעה.",
    });
  };

  // ✅ FIXED: Updated send now function with proper media URL
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

    // Prevent sending while uploading
    if (isUploading) {
      toast({
        title: "אנא המתן",
        description: "המתן לסיום העלאת הקובץ לפני השליחה.",
        variant: "destructive",
      });
      return;
    }

    console.log('📤 Sending message:', {
      groupIds: allGroupIds,
      message: message.substring(0, 50) + '...',
      mediaUrl: mediaUrl,
      hasFile: !!attachedFile
    });

    sendImmediateMessage.mutate({
      groupIds: allGroupIds,
      message,
      mediaUrl: mediaUrl // ✅ Use the Supabase public URL
    }, {
      onSuccess: () => {
        setSuccessDialog({ isOpen: true, type: 'sent' });
        // Clear form
        setMessage('');
        setSelectedGroupIds([]);
        setSelectedSegmentIds([]);
        setAttachedFile(null);
        setMediaUrl(null);
      },
      onError: (error) => {
        console.error('❌ Send message error:', error);
        toast({
          title: "שגיאה בשליחה",
          description: "לא הצלחנו לשלוח את ההודעה. נסה שוב.",
          variant: "destructive",
        });
      }
    });
  };

  // ✅ FIXED: Updated schedule function with proper media URL
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

    // Prevent scheduling while uploading
    if (isUploading) {
      toast({
        title: "אנא המתן",
        description: "המתן לסיום העלאת הקובץ לפני התזמון.",
        variant: "destructive",
      });
      return;
    }

    const sendAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

    console.log('⏰ Scheduling message:', {
      groupIds: allGroupIds,
      message: message.substring(0, 50) + '...',
      mediaUrl: mediaUrl,
      sendAt,
      hasFile: !!attachedFile
    });

    scheduleMessage.mutate({
      groupIds: allGroupIds,
      message,
      mediaUrl: mediaUrl, // ✅ Use the Supabase public URL
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
        setMediaUrl(null);
      },
      onError: (error) => {
        console.error('❌ Schedule message error:', error);
        toast({
          title: "שגיאה בתזמון",
          description: "לא הצלחנו לתזמן את ההודעה. נסה שוב.",
          variant: "destructive",
        });
      }
    });
  };

  // Get file type for display
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-4 w-4 text-green-600" />;
    if (file.type.startsWith('video/')) return <FileText className="h-4 w-4 text-blue-600" />;
    if (file.type.startsWith('audio/')) return <FileText className="h-4 w-4 text-purple-600" />;
    return <FileText className="h-4 w-4 text-green-600" />;
  };

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
                    disabled={isUploading}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {message.length}/4096 תווים
                  </p>
                </div>

                <div>
                  <Label>קובץ מצורף</Label>
                  <div className="mt-1 flex items-center gap-4">
                    <label className={`cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="file"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                      <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        <span className="text-sm">
                          {isUploading ? 'מעלה קובץ...' : 'העלה קובץ'}
                        </span>
                      </div>
                    </label>
                    
                    {attachedFile && (
                      <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
                        {getFileIcon(attachedFile)}
                        <div className="flex flex-col">
                          <span className="text-sm text-green-700 font-medium">
                            {attachedFile.name}
                          </span>
                          <span className="text-xs text-green-600">
                            {formatFileSize(attachedFile.size)}
                          </span>
                        </div>
                        <button
                          onClick={removeAttachedFile}
                          className="text-red-500 hover:text-red-700 ml-2"
                          disabled={isUploading}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* File Upload Status */}
                  {isUploading && (
                    <div className="mt-2 text-sm text-blue-600">
                      מעלה קובץ לאחסון... אנא המתן.
                    </div>
                  )}
                  
                  {mediaUrl && !isUploading && (
                    <div className="mt-2 text-sm text-green-600">
                      ✅ קובץ הועלה בהצלחה ומוכן לשליחה
                    </div>
                  )}
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
                      disabled={isUploading}
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
                      disabled={isUploading}
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
                        {getFileIcon(attachedFile)}
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-600 font-medium">
                            {attachedFile.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatFileSize(attachedFile.size)}
                          </span>
                        </div>
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
                  disabled={sendImmediateMessage.isPending || isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      מעלה קובץ...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 ml-2" />
                      {sendImmediateMessage.isPending ? 'שולח...' : 'שלח עכשיו'}
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={handleSchedule}
                  variant="outline"
                  className="w-full"
                  size="lg"
                  disabled={!scheduleDate || !scheduleTime || scheduleMessage.isPending || isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      מעלה קובץ...
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 ml-2" />
                      {scheduleMessage.isPending ? 'מתזמן...' : 'תזמן הודעה'}
                    </>
                  )}
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
                    <li>• גודל קובץ מקסימלי: 10MB</li>
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