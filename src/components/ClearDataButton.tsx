
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

const ClearDataButton = () => {
  const [isClearing, setIsClearing] = useState(false);

  const clearAllData = async () => {
    if (!confirm('האם אתה בטוח שתרצה למחוק את כל נתוני המשתמשים? פעולה זו אינה ניתנת לביטול!')) {
      return;
    }

    setIsClearing(true);
    
    try {
      console.log('Clearing all user data...');
      
      // Delete all profiles
      const { error: profilesError } = await supabase
        .from('profiles')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all profiles

      if (profilesError) {
        console.error('Error deleting profiles:', profilesError);
      }

      // Delete all scheduled messages
      const { error: messagesError } = await supabase
        .from('scheduled_messages')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all messages

      if (messagesError) {
        console.error('Error deleting messages:', messagesError);
      }

      toast({
        title: "נתונים נמחקו בהצלחה",
        description: "כל נתוני המשתמשים נמחקו מהמערכת"
      });

      console.log('All data cleared successfully');
      
    } catch (error) {
      console.error('Error clearing data:', error);
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה במחיקת הנתונים",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Button
      onClick={clearAllData}
      disabled={isClearing}
      variant="destructive"
      className="gap-2"
    >
      <Trash2 className="h-4 w-4" />
      {isClearing ? "מוחק..." : "מחק את כל הנתונים"}
    </Button>
  );
};

export default ClearDataButton;
