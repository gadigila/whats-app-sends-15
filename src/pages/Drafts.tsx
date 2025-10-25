import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Edit, Trash2, Users, Clock } from "lucide-react";
import { useDrafts } from "@/hooks/useDrafts";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import Layout from "@/components/Layout";
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
} from "@/components/ui/alert-dialog";

const Drafts = () => {
  const { drafts, isLoading, deleteDraft } = useDrafts();
  const navigate = useNavigate();

  const handleEdit = (draftId: string) => {
    navigate('/compose', { state: { draftId } });
  };

  const handleDelete = (draftId: string) => {
    deleteDraft.mutate(draftId);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">הודעות טיוטה</h1>
          <p className="text-muted-foreground">נהל והמשך את ההודעות השמורות שלך</p>
        </div>

        {/* Empty State */}
        {drafts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <FileText className="h-16 w-16 text-muted-foreground/50" />
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">אין טיוטות שמורות</h3>
                <p className="text-muted-foreground">התחל לכתוב הודעה ושמור אותה כטיוטה</p>
              </div>
              <Button onClick={() => navigate('/compose')}>
                כתוב הודעה חדשה
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Drafts List */
          <div className="space-y-4">
            {drafts.map((draft) => (
              <Card key={draft.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">טיוטה</CardTitle>
                      </div>
                      <CardDescription className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {draft.total_groups} קבוצות
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDistanceToNow(new Date(draft.updated_at), {
                            addSuffix: true,
                            locale: he
                          })}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(draft.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>מחיקת טיוטה</AlertDialogTitle>
                            <AlertDialogDescription>
                              האם אתה בטוח שברצונך למחוק טיוטה זו? פעולה זו לא ניתנת לביטול.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(draft.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              מחק
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Message Preview */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap">
                        {draft.message}
                      </p>
                    </div>

                    {/* Media Preview */}
                    {draft.media_url && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>קובץ מצורף</span>
                      </div>
                    )}

                    {/* Group Names */}
                    {draft.group_names && draft.group_names.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {draft.group_names.slice(0, 3).map((name: string, idx: number) => (
                          <span
                            key={idx}
                            className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                          >
                            {name}
                          </span>
                        ))}
                        {draft.group_names.length > 3 && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                            +{draft.group_names.length - 3} נוספות
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Drafts;
