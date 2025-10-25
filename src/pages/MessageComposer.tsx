import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button, ThreeDButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon, Clock, Send, Upload, Image, FileText, X, Loader2, CalendarDays, Save, Sparkles, Wand2, ZoomIn } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';
import { useWhatsAppMessages } from '@/hooks/useWhatsAppMessages';
import { useSegments } from '@/hooks/useSegments';
import { useDrafts } from '@/hooks/useDrafts';
import LockedFeature from '@/components/LockedFeature';
import SuccessDialog from '@/components/SuccessDialog';
import MessageRecipientsSelector from '@/components/MessageRecipientsSelector';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const MessageComposer = () => {
  const location = useLocation();
  const [message, setMessage] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [successDialog, setSuccessDialog] = useState<{
    isOpen: boolean;
    type: 'sent' | 'scheduled';
  }>({ isOpen: false, type: 'sent' });
  
  // AI generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  
  const { trialStatus, isLoading } = useTrialStatus();
  const { groups } = useWhatsAppGroups();
  const { segments } = useSegments();
  const { sendImmediateMessage, scheduleMessage } = useWhatsAppMessages();
  const { saveDraft, updateDraft, deleteDraft } = useDrafts();
  
  // Load draft if editing
  useEffect(() => {
    const loadDraft = async () => {
      const draftIdFromState = location.state?.draftId;
      if (draftIdFromState) {
        setDraftId(draftIdFromState);
        
        // Fetch draft data
        const { data: draft, error } = await supabase
          .from('scheduled_messages')
          .select('*')
          .eq('id', draftIdFromState)
          .eq('is_draft', true)
          .single();
        
        if (error || !draft) {
          toast({
            title: "שגיאה בטעינת טיוטה",
            description: "לא הצלחנו לטעון את הטיוטה.",
            variant: "destructive",
          });
          return;
        }
        
        // Populate form with draft data
        setMessage(draft.message);
        setSelectedGroupIds(draft.group_ids || []);
        setMediaUrl(draft.media_url);
        
        toast({
          title: "טיוטה נטענה",
          description: "המשך לערוך את ההודעה.",
        });
      }
    };
    
    loadDraft();
  }, [location.state]);
  
  // Auto-select segment from navigation state
  useEffect(() => {
    const selectedSegmentId = location.state?.selectedSegmentId;
    if (selectedSegmentId && segments.length > 0 && !draftId) {
      const segment = segments.find(s => s.id === selectedSegmentId);
      if (segment && !selectedSegmentIds.includes(selectedSegmentId)) {
        setSelectedSegmentIds([selectedSegmentId]);
        toast({
          title: "קטגוריה נבחרה",
          description: `הקטגוריה "${segment.name}" נבחרה אוטומטית.`,
        });
      }
    }
  }, [location.state, segments, selectedSegmentIds, draftId]);
  
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
      
      // Create preview URL for images
      if (file.type.startsWith('image/')) {
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
      }
      
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
    // Revoke preview URL to prevent memory leaks
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

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
    setPreviewUrl(null);
    
    toast({
      title: "קובץ הוסר",
      description: "הקובץ המצורף הוסר מההודעה.",
    });
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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
      onSuccess: async () => {
        // If editing a draft, delete it after sending
        if (draftId) {
          await supabase.from('scheduled_messages').delete().eq('id', draftId);
        }
        
        setSuccessDialog({ isOpen: true, type: 'sent' });
        // Clear form
        setMessage('');
        setSelectedGroupIds([]);
        setSelectedSegmentIds([]);
        setAttachedFile(null);
        setMediaUrl(null);
        setDraftId(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
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

  // ✅ FIXED: Updated schedule function with proper media URL and date handling
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

    // Create datetime from date and time
    const [hours, minutes] = scheduleTime.split(':');
    const scheduledDateTime = new Date(scheduleDate);
    scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    // Check if the scheduled time is in the past
    if (scheduledDateTime <= new Date()) {
      toast({
        title: "זמן לא תקין",
        description: "אנא בחר זמן עתידי לתזמון ההודעה.",
        variant: "destructive",
      });
      return;
    }
    
    const sendAt = scheduledDateTime.toISOString();

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
      onSuccess: async () => {
        // If editing a draft, delete it after scheduling
        if (draftId) {
          await supabase.from('scheduled_messages').delete().eq('id', draftId);
        }
        
        setSuccessDialog({ isOpen: true, type: 'scheduled' });
        // Clear form
        setMessage('');
        setSelectedGroupIds([]);
        setSelectedSegmentIds([]);
        setScheduleDate(undefined);
        setScheduleTime('');
        setAttachedFile(null);
        setMediaUrl(null);
        setDraftId(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
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

  // Handle AI message generation
  const handleAIGenerate = async (type: 'generate' | 'improve') => {
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-marketing-message', {
        body: {
          type,
          currentMessage: type === 'improve' ? message : undefined,
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setMessage(data.generatedMessage);
      
      toast({
        title: type === 'generate' ? "הודעה נוצרה!" : "הודעה שופרה!",
        description: "ההודעה עודכנה בהצלחה. בדוק וערוך לפי הצורך.",
      });
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast({
        title: "שגיאה ביצירת ההודעה",
        description: error.message || "נסה שוב או כתוב את ההודעה באופן ידני.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate time options for the time picker
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
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

  // Get group names for draft
  const getSelectedGroupNames = () => {
    const allGroupIds = getAllSelectedGroupIds();
    return groups
      .filter(g => allGroupIds.includes(g.group_id))
      .map(g => g.name);
  };

  // Handle save draft
  const handleSaveDraft = () => {
    if (!hasAccess) return;
    
    if (!message.trim()) {
      toast({
        title: "הודעה ריקה",
        description: "אנא כתוב משהו לפני שמירה כטיוטה.",
        variant: "destructive",
      });
      return;
    }

    const allGroupIds = getAllSelectedGroupIds();
    const groupNames = getSelectedGroupNames();

    const draftData = {
      message,
      groupIds: allGroupIds,
      groupNames,
      mediaUrl: mediaUrl || undefined,
      totalGroups: allGroupIds.length
    };

    if (draftId) {
      // Update existing draft
      updateDraft.mutate({ id: draftId, data: draftData });
    } else {
      // Save new draft
      saveDraft.mutate(draftData);
    }
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
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">כתיבת הודעה</h1>
            {draftId && (
              <Badge variant="secondary" className="text-sm">
                עורך טיוטה
              </Badge>
            )}
          </div>
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

                {/* AI Message Generator */}
                <div className="border-t pt-4 space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    עוזר AI למסרים מנצחים
                  </Label>

                  <div className="flex justify-start">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAIGenerate('improve')}
                      disabled={isGenerating || isUploading || !message.trim()}
                      type="button"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          משפר...
                        </>
                      ) : (
                        <>
                          <Wand2 className="ml-2 h-4 w-4" />
                          שפר את ההודעה
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-right">
                    AI יעזור לך לכתוב מסר שיווקי מנצח בהתאם לעקרונות השיווק המובילים
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
                        {previewUrl ? (
                          <img 
                            src={previewUrl} 
                            alt="Preview" 
                            className="h-12 w-12 object-cover rounded"
                          />
                        ) : (
                          getFileIcon(attachedFile)
                        )}
                        <div className="flex flex-col flex-1">
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
                <CardTitle>למי לשלוח?</CardTitle>
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

            {/* Schedule - Enhanced UI */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  תזמון (אופציונלי)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Date Picker */}
                  <div className="space-y-2">
                    <Label>תאריך</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-12 text-base",
                            !scheduleDate && "text-muted-foreground"
                          )}
                          disabled={isUploading}
                        >
                          <CalendarIcon className="ml-2 h-5 w-5" />
                          {scheduleDate ? (
                            format(scheduleDate, "PPP", { locale: undefined })
                          ) : (
                            <span>בחר תאריך</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduleDate}
                          onSelect={setScheduleDate}
                          disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return date < today;
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Enhanced Time Picker with Manual Input */}
                  <div className="space-y-2">
                    <Label htmlFor="time">שעה</Label>
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        id="time"
                        dir="ltr"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="flex-1 h-12 text-base"
                        disabled={isUploading}
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 flex-shrink-0"
                            disabled={isUploading}
                            title="בחר מרשימה מהירה"
                          >
                            <Clock className="h-5 w-5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="start">
                          <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                            {generateTimeOptions().map((time) => (
                              <Button
                                key={time}
                                variant={scheduleTime === time ? "default" : "ghost"}
                                size="sm"
                                className="h-8 text-sm"
                                onClick={() => setScheduleTime(time)}
                              >
                                {time}
                              </Button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                
                {/* Schedule Info */}
                {scheduleDate && scheduleTime && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-800">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        ההודעה תישלח ב-{format(scheduleDate, "dd/MM/yyyy")} בשעה {scheduleTime}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview & Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>תצוגה מקדימה</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsPreviewExpanded(true)}
                    className="h-8 w-8"
                    title="הגדל תצוגה"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    {attachedFile && previewUrl && (
                      <div className="mb-2">
                        <img 
                          src={previewUrl} 
                          alt="Preview" 
                          className="w-full max-h-48 object-contain rounded-lg border border-gray-200"
                        />
                      </div>
                    )}
                    {attachedFile && !previewUrl && (
                      <div className="mb-2 p-2 bg-gray-50 rounded flex items-center gap-2">
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
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words line-clamp-6">
                      {message || "ההודעה שלך תופיע כאן..."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expanded Preview Dialog */}
            <Dialog open={isPreviewExpanded} onOpenChange={setIsPreviewExpanded}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>תצוגה מלאה</DialogTitle>
                </DialogHeader>
                
                <div className="bg-green-50 p-6 rounded-lg">
                  <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                    {attachedFile && previewUrl && (
                      <div className="mb-3">
                        <img 
                          src={previewUrl} 
                          alt="Preview" 
                          className="w-full max-h-96 object-contain rounded-lg border border-gray-200"
                        />
                      </div>
                    )}
                    {attachedFile && !previewUrl && (
                      <div className="mb-3 p-3 bg-gray-50 rounded flex items-center gap-2">
                        {getFileIcon(attachedFile)}
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-600 font-medium">
                            {attachedFile.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatFileSize(attachedFile.size)}
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="text-base text-gray-800 whitespace-pre-wrap break-words">
                      {message || "ההודעה שלך תופיע כאן..."}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={() => setIsPreviewExpanded(false)}>
                    סגור
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader>
                <CardTitle>פעולות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ThreeDButton
                  variant="primary"
                  className="w-full"
                  size="lg"
                  onClick={handleSendNow}
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
                </ThreeDButton>
                
                <ThreeDButton
                  variant="secondary"
                  className="w-full"
                  size="lg"
                  onClick={handleSchedule}
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
                </ThreeDButton>

                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={handleSaveDraft}
                  disabled={saveDraft.isPending || updateDraft.isPending || isUploading}
                >
                  <Save className="h-4 w-4 ml-2" />
                  {draftId ? 'עדכן טיוטה' : 'שמור כטיוטה'}
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
