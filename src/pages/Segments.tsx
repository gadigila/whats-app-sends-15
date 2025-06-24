import { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Users, Plus, Edit, Trash2, MessageSquare, Search, X, Shield, Star } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useWhatsAppGroups } from '@/hooks/useWhatsAppGroups';

interface Segment {
  id: string;
  name: string;
  groupIds: string[];
  totalMembers: number;
  createdAt: Date;
}

const Segments = () => {
  const { groups: allGroups, isLoadingGroups } = useWhatsAppGroups();
  
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  
  // 🔍 חיפוש קבוצות
  const [searchQuery, setSearchQuery] = useState('');
  
  // 👑 סינון קבוצות מנהל
  const [showOnlyAdminGroups, setShowOnlyAdminGroups] = useState(false);
  
  // סינון קבוצות לפי חיפוש ומנהל
  const filteredGroups = useMemo(() => {
    let filtered = allGroups;
    
    // סנן לפי מנהל אם נדרש
    if (showOnlyAdminGroups) {
      filtered = filtered.filter(group => group.is_admin === true);
    }
    
    // סנן לפי חיפוש
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(group => 
        group.name.toLowerCase().includes(query) ||
        (group.description && group.description.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [allGroups, searchQuery, showOnlyAdminGroups]);

  // סטטיסטיקות קבוצות
  const groupStats = useMemo(() => {
    const totalGroups = allGroups.length;
    const adminGroups = allGroups.filter(g => g.is_admin).length;
    const memberGroups = totalGroups - adminGroups;
    
    return { totalGroups, adminGroups, memberGroups };
  }, [allGroups]);

  const handleCreateSegment = () => {
    if (!newSegmentName.trim()) {
      toast({
        title: "נדרש שם",
        description: "אנא הכנס שם לקטגוריה.",
        variant: "destructive",
      });
      return;
    }

    if (selectedGroupIds.length === 0) {
      toast({
        title: "נדרשות קבוצות",
        description: "אנא בחר לפחות קבוצה אחת.",
        variant: "destructive",
      });
      return;
    }

    const totalMembers = selectedGroupIds.reduce((sum, groupId) => {
      const group = allGroups.find(g => g.group_id === groupId);
      return sum + (group?.participants_count || 0);
    }, 0);

    const newSegment: Segment = {
      id: Date.now().toString(),
      name: newSegmentName,
      groupIds: selectedGroupIds,
      totalMembers,
      createdAt: new Date(),
    };

    setSegments([...segments, newSegment]);
    setNewSegmentName('');
    setSelectedGroupIds([]);
    setIsCreateDialogOpen(false);
    
    toast({
      title: "קטגוריה נוצרה!",
      description: `"${newSegmentName}" נוצרה עם ${selectedGroupIds.length} קבוצות.`,
    });
  };

  const handleEditSegment = (segment: Segment) => {
    setEditingSegment(segment);
    setNewSegmentName(segment.name);
    setSelectedGroupIds(segment.groupIds);
    setIsCreateDialogOpen(true);
  };

  const handleUpdateSegment = () => {
    if (!editingSegment) return;

    const totalMembers = selectedGroupIds.reduce((sum, groupId) => {
      const group = allGroups.find(g => g.group_id === groupId);
      return sum + (group?.participants_count || 0);
    }, 0);

    const updatedSegment: Segment = {
      ...editingSegment,
      name: newSegmentName,
      groupIds: selectedGroupIds,
      totalMembers,
    };

    setSegments(segments.map(s => s.id === editingSegment.id ? updatedSegment : s));
    setNewSegmentName('');
    setSelectedGroupIds([]);
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

  const handleGroupToggle = (groupId: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(g => g !== groupId)
        : [...prev, groupId]
    );
  };

  const resetDialog = () => {
    setNewSegmentName('');
    setSelectedGroupIds([]);
    setEditingSegment(null);
    setSearchQuery('');
    setShowOnlyAdminGroups(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const getGroupNames = (groupIds: string[]) => {
    return groupIds.map(id => {
      const group = allGroups.find(g => g.group_id === id);
      return group?.name || 'קבוצה לא ידועה';
    });
  };

  if (isLoadingGroups) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-lg">טוען קבוצות...</div>
        </div>
      </Layout>
    );
  }

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
              <Button 
                className="bg-green-600 hover:bg-green-700"
                disabled={allGroups.length === 0}
              >
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
                  
                  {/* פילטרים */}
                  <div className="mt-3 space-y-3">
                    {/* 👑 טוגל קבוצות מנהל */}
                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-900">
                          הצג רק קבוצות שאני מנהל ({groupStats.adminGroups} מתוך {groupStats.totalGroups})
                        </span>
                      </div>
                      <Switch
                        checked={showOnlyAdminGroups}
                        onCheckedChange={setShowOnlyAdminGroups}
                      />
                    </div>
                    
                    {/* 🔍 שדה חיפוש */}
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="חפש קבוצות..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pr-10 pl-10"
                      />
                      {searchQuery && (
                        <button
                          onClick={clearSearch}
                          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* מידע על תוצאות */}
                    <div className="text-sm text-gray-600">
                      {showOnlyAdminGroups && searchQuery ? (
                        filteredGroups.length === 0 
                          ? `לא נמצאו קבוצות מנהל עבור "${searchQuery}"`
                          : `נמצאו ${filteredGroups.length} קבוצות מנהל מתוך ${groupStats.adminGroups}`
                      ) : showOnlyAdminGroups ? (
                        `מציג ${filteredGroups.length} קבוצות שאתה מנהל בהן`
                      ) : searchQuery ? (
                        filteredGroups.length === 0 
                          ? `לא נמצאו קבוצות עבור "${searchQuery}"`
                          : `נמצאו ${filteredGroups.length} קבוצות מתוך ${allGroups.length}`
                      ) : (
                        `מציג ${filteredGroups.length} קבוצות זמינות`
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-3 max-h-64 overflow-y-auto border rounded-lg p-3">
                    {allGroups.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        אין קבוצות זמינות. אנא סנכרן את הקבוצות שלך תחילה.
                      </div>
                    ) : filteredGroups.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        לא נמצאו קבוצות התואמות לחיפוש
                        <br />
                        <div className="flex justify-center gap-2 mt-2">
                          {searchQuery && (
                            <button 
                              onClick={clearSearch}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              נקה חיפוש
                            </button>
                          )}
                          {showOnlyAdminGroups && (
                            <button 
                              onClick={() => setShowOnlyAdminGroups(false)}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              הצג כל הקבוצות
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      filteredGroups.map((group) => (
                        <div key={group.group_id} className="flex items-center space-x-3 space-x-reverse p-2 hover:bg-gray-50 rounded-lg">
                          <Checkbox
                            id={group.group_id}
                            checked={selectedGroupIds.includes(group.group_id)}
                            onCheckedChange={() => handleGroupToggle(group.group_id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <label htmlFor={group.group_id} className="text-sm font-medium cursor-pointer">
                                {/* הדגשת טקסט החיפוש */}
                                {searchQuery ? (
                                  <span dangerouslySetInnerHTML={{
                                    __html: group.name.replace(
                                      new RegExp(searchQuery, 'gi'),
                                      '<mark class="bg-yellow-200">$&</mark>'
                                    )
                                  }} />
                                ) : (
                                  group.name
                                )}
                              </label>
                              {/* ⭐ אייקון מנהל */}
                              {group.is_admin && (
                                <div title="אתה מנהל בקבוצה זו">
                                  <Star className="h-3 w-3 text-amber-500" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {group.description || 'ללא תיאור'} • {group.participants_count || 0} חברים
                              {group.is_admin && ' • מנהל'}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {selectedGroupIds.length > 0 && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">קבוצות נבחרות ({selectedGroupIds.length}):</h4>
                    <div className="flex flex-wrap gap-2">
                      {getGroupNames(selectedGroupIds).map(name => (
                        <Badge key={name} variant="outline" className="text-green-700 border-green-700">
                          {name}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-green-700 mt-2">
                      סך הכל חברים: {selectedGroupIds.reduce((sum, groupId) => {
                        const group = allGroups.find(g => g.group_id === groupId);
                        return sum + (group?.participants_count || 0);
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
                    disabled={allGroups.length === 0}
                  >
                    {editingSegment ? 'עדכן קטגוריה' : 'צור קטגוריה'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <p className="text-sm text-gray-600">כל הקבוצות</p>
                  <p className="text-2xl font-bold">{groupStats.totalGroups}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <Star className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">קבוצות מנהל</p>
                  <p className="text-2xl font-bold">{groupStats.adminGroups}</p>
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
                    {allGroups.reduce((sum, group) => sum + (group.participants_count || 0), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Groups Info */}
        {allGroups.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">אין קבוצות זמינות</h3>
              <p className="text-gray-600 mb-6">כדי ליצור קטגוריות, תחילה סנכרן את קבוצות הוואטסאפ שלך.</p>
            </CardContent>
          </Card>
        )}

        {/* Segments List */}
        <div className="space-y-4">
          {segments.length === 0 && allGroups.length > 0 ? (
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
                        {getGroupNames(segment.groupIds).map(name => (
                          <Badge key={name} variant="secondary" className="text-xs">
                            {name}
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