import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Shield, Crown, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AdminGroup {
  group_id: string;
  name: string;
  participants_count: number;
  is_creator: boolean;
  is_admin: boolean;
}

interface SyncProgress {
  stage: string;
  current: number;
  total: number;
  admin_found: number;
  creator_found: number;
  last_group: string | null;
}

interface RealtimeSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const RealtimeSyncModal: React.FC<RealtimeSyncModalProps> = ({
  isOpen,
  onClose,
  userId
}) => {
  const [progress, setProgress] = useState<SyncProgress>({
    stage: 'מתכונן לסנכרון...',
    current: 0,
    total: 100,
    admin_found: 0,
    creator_found: 0,
    last_group: null
  });
  
  const [adminGroups, setAdminGroups] = useState<AdminGroup[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentChunk, setCurrentChunk] = useState(0);

  // Real-time subscription to progress updates
  useEffect(() => {
    if (!isOpen || !userId) return;

    const progressSubscription = supabase
      .channel('sync_progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_progress',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('📊 Progress update received:', payload);
          if (payload.new) {
            setProgress({
              stage: payload.new.stage,
              current: payload.new.current,
              total: payload.new.total,
              admin_found: payload.new.admin_found || 0,
              creator_found: payload.new.creator_found || 0,
              last_group: payload.new.last_group
            });
          }
        }
      )
      .subscribe();

    return () => {
      progressSubscription.unsubscribe();
    };
  }, [isOpen, userId]);

  // Real-time subscription to new admin groups
  useEffect(() => {
    if (!isOpen || !userId) return;

    const groupsSubscription = supabase
      .channel('whatsapp_groups')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_groups',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('👑 New admin group found:', payload);
          if (payload.new) {
            const newGroup: AdminGroup = {
              group_id: payload.new.group_id,
              name: payload.new.name,
              participants_count: payload.new.participants_count,
              is_creator: payload.new.is_creator,
              is_admin: payload.new.is_admin
            };
            
            setAdminGroups(prev => {
              // Avoid duplicates
              const exists = prev.some(g => g.group_id === newGroup.group_id);
              if (exists) return prev;
              return [...prev, newGroup];
            });
          }
        }
      )
      .subscribe();

    return () => {
      groupsSubscription.unsubscribe();
    };
  }, [isOpen, userId]);

  // Chunked sync process
  const runChunkedSync = async (chunk: number = 0) => {
    try {
      setError(null);
      
      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups-realtime', {
        body: { 
          userId, 
          chunk,
          batchSize: 25 
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.phase === 'discovery_complete') {
        console.log(`🔍 Discovery complete: ${data.total_groups} groups found`);
        setProgress(prev => ({ ...prev, total: data.total_groups }));
        
        // Start processing chunks
        setTimeout(() => runChunkedSync(1), 2000);
        
      } else if (data.phase === 'processing') {
        console.log(`🔄 Processed chunk ${data.chunk_processed}`);
        
        // Continue with next chunk
        setTimeout(() => runChunkedSync(data.next_chunk), 1500);
        
      } else if (data.phase === 'complete') {
        console.log('🎉 Sync complete!');
        setIsComplete(true);
        setProgress(prev => ({
          ...prev,
          stage: data.message,
          current: prev.total
        }));
      }

    } catch (err: any) {
      console.error('❌ Sync error:', err);
      setError(err.message || 'שגיאה בסנכרון');
    }
  };

  // Start sync when modal opens
  useEffect(() => {
    if (isOpen && !isComplete && currentChunk === 0) {
      setCurrentChunk(1);
      setTimeout(() => runChunkedSync(0), 1000);
    }
  }, [isOpen]);

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const totalFound = progress.admin_found + progress.creator_found;

  const handleClose = () => {
    if (isComplete || error) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-center">
            {isComplete ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : error ? (
              <AlertCircle className="h-5 w-5 text-red-600" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            )}
            {isComplete ? 'סנכרון הושלם!' : error ? 'שגיאה בסנכרון' : 'מסנכרן את הקבוצות שלך'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">❌ {error}</p>
              <Button 
                onClick={() => {
                  setError(null);
                  setIsComplete(false);
                  setCurrentChunk(0);
                  setAdminGroups([]);
                  runChunkedSync(0);
                }}
                className="mt-2"
                size="sm"
              >
                נסה שוב
              </Button>
            </div>
          )}

          {/* Progress Section */}
          {!error && (
            <div className="space-y-3">
              <div className="flex flex-col items-center space-y-2">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900">
                    {progress.stage}
                  </p>
                  
                  {progress.last_group && (
                    <p className="text-xs text-gray-600 mt-1">
                      📊 אחרון שנבדק: {progress.last_group}
                    </p>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-1">
                    {progress.current} מתוך {progress.total} קבוצות נבדקו
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress value={progressPercentage} className="h-3" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{Math.round(progressPercentage)}%</span>
                  <span>{progress.current}/{progress.total}</span>
                </div>
              </div>
            </div>
          )}

          {/* Admin Groups Found - Real-time updates */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-green-900 flex items-center gap-2">
                <Crown className="h-4 w-4" />
                קבוצות בניהולך ({totalFound})
              </h3>
              
              <div className="flex gap-2">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  {progress.creator_found} יוצר
                </Badge>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {progress.admin_found} מנהל
                </Badge>
              </div>
            </div>

            {/* Real-time list of admin groups */}
            {adminGroups.length > 0 ? (
              <ScrollArea className="h-32 w-full">
                <div className="space-y-2">
                  {adminGroups.map((group, index) => (
                    <div 
                      key={group.group_id}
                      className="flex items-center justify-between p-2 bg-white rounded border animate-in slide-in-from-bottom-2 duration-300"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center gap-2">
                        {group.is_creator ? (
                          <Crown className="h-3 w-3 text-yellow-600" />
                        ) : (
                          <Shield className="h-3 w-3 text-blue-600" />
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {group.name}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {group.participants_count} חברים
                        </Badge>
                        <Badge 
                          variant={group.is_creator ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {group.is_creator ? 'יוצר' : 'מנהל'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-4">
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {isComplete ? 'לא נמצאו קבוצות בניהולך' : 'מחפש קבוצות בניהולך...'}
                </p>
              </div>
            )}

            {/* Summary stats */}
            {totalFound > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-green-600">{totalFound}</div>
                    <div className="text-xs text-green-700">סה"כ קבוצות</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-yellow-600">{progress.creator_found}</div>
                    <div className="text-xs text-yellow-700">כיוצר</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-600">{progress.admin_found}</div>
                    <div className="text-xs text-blue-700">כמנהל</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* What we're looking for (only show during sync) */}
          {!isComplete && !error && (
            <div className="bg-blue-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-blue-900 mb-2">מה אנחנו מחפשים:</p>
              <div className="grid grid-cols-1 gap-1 text-xs">
                <div className="flex items-center gap-2 text-blue-700">
                  <Crown className="h-3 w-3" />
                  <span>קבוצות שאתה יוצר</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <Shield className="h-3 w-3" />
                  <span>קבוצות שאתה מנהל</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <Users className="h-3 w-3" />
                  <span>כל הקבוצות (כולל גדולות)</span>
                </div>
              </div>
            </div>
          )}

          {/* Tips */}
          {!isComplete && !error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                <strong>💡 טיפ:</strong> הקבוצות מופיעות כאן ברגע שאנחנו מוצאים אותן! אל תסגור את החלון עד שהסנכרון יסתיים
              </p>
            </div>
          )}

          {/* Completion message */}
          {isComplete && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-800 font-medium">
                🎉 סנכרון הושלם בהצלחה!
              </p>
              <p className="text-green-700 text-sm mt-1">
                {totalFound > 0 
                  ? `נמצאו ${totalFound} קבוצות בניהולך (${progress.creator_found} כיוצר, ${progress.admin_found} כמנהל)`
                  : 'לא נמצאו קבוצות בניהולך'
                }
              </p>
              
              <Button 
                onClick={handleClose}
                className="mt-3"
                size="sm"
              >
                סגור
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};