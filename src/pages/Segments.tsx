
import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Edit, Trash2, MessageSquare } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Group {
  id: string;
  name: string;
  members: number;
  description: string;
}

interface Segment {
  id: string;
  name: string;
  groups: string[];
  totalMembers: number;
  createdAt: Date;
}

const Segments = () => {
  const [segments, setSegments] = useState<Segment[]>([
    {
      id: '1',
      name: 'קמפיינים שיווקיים',
      groups: ['צוות שיווק', 'לקוחות VIP'],
      totalMembers: 125,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: '2',
      name: 'תקשורת פנימית',
      groups: ['צוות מכירות', 'שירות לקוחות'],
      totalMembers: 45,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: '3',
      name: 'משתמשים פרימיום',
      groups: ['לקוחות VIP'],
      totalMembers: 50,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  ]);

  const [availableGroups] = useState<Group[]>([
    { id: '1', name: 'צוות שיווק', members: 25, description: 'חברי מחלקת השיווק' },
    { id: '2', name: 'צוות מכירות', members: 20, description: 'נציגי מכירות' },
    { id: '3', name: 'שירות לקוחות', members: 15, description: 'צוות שירות לקוחות' },
    { id: '4', name: 'לקוחות VIP', members: 50, description: 'לקוחות פרימיום' },
    { id: '5', name: 'בודקי בטא', members: 30, description: 'בודקי המוצר' },
    { id: '6', name: 'מנויי ניוזלטר', members: 200, description: 'מנויי הניוזלטר' },
    { id: '7', name: 'משתתפי אירועים', members: 80, description: 'משתתפי אירועים קודמים' },
    { id: '8', name: 'שותפים עסקיים', members: 12, description: 'שותפים עסקיים' },
  ]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);

  const handleCreateSegment = () => {
    if (!newSegmentName.trim()) {
      toast({
        title: "נדרש שם",
        description: "אנא הכנס שם לקטגוריה.",
        variant: "destructive",
      });
      return;
    }

    if (selectedGroups.length === 0) {
      toast({
        title: "נדרשות קבוצות",
        description: "אנא בחר לפחות קבוצה אחת.",
        variant: "destructive",
      });
      return;
    }

    const totalMembers = selectedGroups.reduce((sum, groupName) => {
      const group = availableGroups.find(g => g.name === groupName);
      return sum + (group?.members || 0);
    }, 0);

    const newSegment: Segment = {
      id: Date.now().toString(),
      name: newSegmentName,
      groups: selectedGroups,
      totalMembers,
      createdAt: new Date(),
    };

    setSegments([...segments, newSegment]);
    setNewSegmentName('');
    setSelectedGroups([]);
    setIsCreateDialogOpen(false);
    
    toast({
      title: "קטגוריה נוצרה!",
      description: `"${newSegmentName}" נוצרה עם ${selectedGroups.length} קבוצות.`,
    });
  };

  const handleEditSegment = (segment: Segment) => {
    setEditingSegment(segment);
    setNewSegmentName(segment.name);
    setSelectedGroups(segment.groups);
    setIsCreateDialogOpen(true);
  };

  const handleUpdateSegment = () => {
    if (!editingSegment) return;

    const totalMembers = selectedGroups.reduce((sum, groupName) => {
      const group = availableGroups.find(g => g.name === groupName);
      return sum + (group?.members || 0);
    }, 0);

    const updatedSegment: Segment = {
      ...editingSegment,
      name: newSegmentName,
      groups: selectedGroups,
      totalMembers,
    };

    setSegments(segments.map(s => s.id === editingSegment.id ? updatedSegment : s));
    setNewSegmentName('');
    setSelectedGroups([]);
    setEditingSegment(null);
    setIsCreateDialogOpen(false);
    
    toast({
      title: "קטגוריה עודכנה!",
      description: `"${newSegmentName}" עודכנה.`,
    });
  };

  const handleDeleteSegment = (id: string) => {
    const segment = segments.find(s => s.id === id);
    setSegments(segments.filter(s => s.id !== id));
    toast({
      title: "קטגוריה נמחקה",
      description: `"${segment?.name}" נמחקה.`,
    });
  };

  const handleGroupToggle = (groupName: string) => {
    setSelectedGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    );
  };

  const resetDialog = () => {
    setNewSegmentName('');
    setSelectedGroups([]);
    setEditingSegment(null);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">קטגוריות</h1>
            <p className="text-gray-600">צור ונהל קטגוריות קבוצות להודעות ממוקדות</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) resetDialog();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 ml-2" />
                צור קטגוריה
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingSegment ? 'ערוך קטגוריה' : 'צור קטגוריה חדשה'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="segmentName">שם הקטגוריה</Label>
                  <Input
                    id="segmentName"
                    placeholder="הכנס שם לקטגוריה..."
                    value={newSegmentName}
                    onChange={(e) => setNewSegmentName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label>בחר קבוצות</Label>
                  <div className="mt-2 space-y-3 max-h-64 overflow-y-auto">
                    {availableGroups.map((group) => (
                      <div key={group.id} className="flex items-center space-x-3 space-x-reverse">
                        <Checkbox
                          id={group.id}
                          checked={selectedGroups.includes(group.name)}
                          onCheckedChange={() => handleGroupToggle(group.name)}
                        />
                        <div className="flex-1">
                          <label htmlFor={group.id} className="text-sm font-medium cursor-pointer">
                            {group.name}
                          </label>
                          <p className="text-xs text-gray-500">{group.description} • {group.members} חברים</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedGroups.length > 0 && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">קבוצות נבחרות:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedGroups.map(group => (
                        <Badge key={group} variant="outline" className="text-green-700 border-green-700">
                          {group}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-green-700 mt-2">
                      סך הכל חברים: {selectedGroups.reduce((sum, groupName) => {
                        const group = availableGroups.find(g => g.name === groupName);
                        return sum + (group?.members || 0);
                      }, 0)}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    ביטול
                  </Button>
                  <Button
                    onClick={editingSegment ? handleUpdateSegment : handleCreateSegment}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {editingSegment ? 'עדכן קטגוריה' : 'צור קטגוריה'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">סך קטגוריות</p>
                  <p className="text-2xl font-bold">{segments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">קבוצות זמינות</p>
                  <p className="text-2xl font-bold">{availableGroups.length}</p>
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
                  <p className="text-sm text-gray-600">סך חברים</p>
                  <p className="text-2xl font-bold">
                    {availableGroups.reduce((sum, group) => sum + group.members, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Segments List */}
        <div className="space-y-4">
          {segments.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">לא נוצרו קטגוריות</h3>
                <p className="text-gray-600 mb-6">צור את הקטגוריה הראשונה שלך כדי לארגן את הקבוצות שלך להודעות ממוקדות.</p>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      <Plus className="h-4 w-4 ml-2" />
                      צור את הקטגוריה הראשונה
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </CardContent>
            </Card>
          ) : (
            segments.map((segment) => (
              <Card key={segment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{segment.name}</h3>
                        <Badge variant="outline">
                          {segment.totalMembers} חברים
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {segment.groups.map(group => (
                          <Badge key={group} variant="secondary" className="text-xs">
                            {group}
                          </Badge>
                        ))}
                      </div>
                      
                      <p className="text-sm text-gray-600">
                        נוצר ב-{segment.createdAt.toLocaleDateString('he-IL', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSegment(segment)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSegment(segment.id)}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => window.location.href = '/compose'}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <MessageSquare className="h-4 w-4 ml-1" />
                        הודעה
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

export default Segments;
