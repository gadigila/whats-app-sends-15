
import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Send, Upload, Image, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const MessageComposer = () => {
  const [message, setMessage] = useState('');
  const [selectedGroups, setSelectedGroups] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  
  const groups = [
    { id: 'all', name: 'All Groups (8)' },
    { id: 'marketing', name: 'Marketing Team' },
    { id: 'sales', name: 'Sales Team' },
    { id: 'support', name: 'Customer Support' },
    { id: 'vip', name: 'VIP Customers' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File too large",
          description: "Please select a file smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      setAttachedFile(file);
      toast({
        title: "File attached",
        description: `${file.name} has been attached to your message.`,
      });
    }
  };

  const handleSendNow = () => {
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a message to send.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedGroups) {
      toast({
        title: "Select groups",
        description: "Please select groups to send the message to.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Message sent!",
      description: `Your message has been sent to ${selectedGroups}.`,
    });
    
    // Clear form
    setMessage('');
    setSelectedGroups('');
    setAttachedFile(null);
  };

  const handleSchedule = () => {
    if (!message.trim() || !selectedGroups || !scheduleDate || !scheduleTime) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields to schedule a message.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Message scheduled!",
      description: `Your message will be sent on ${scheduleDate} at ${scheduleTime}.`,
    });
    
    // Clear form
    setMessage('');
    setSelectedGroups('');
    setScheduleDate('');
    setScheduleTime('');
    setAttachedFile(null);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Compose Message</h1>
          <p className="text-gray-600">Create and send messages to your WhatsApp groups</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Message Content */}
            <Card>
              <CardHeader>
                <CardTitle>Message Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="message">Message Text</Label>
                  <Textarea
                    id="message"
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className="mt-1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {message.length}/4096 characters
                  </p>
                </div>

                <div>
                  <Label>Attachment</Label>
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
                        <span className="text-sm">Upload File</span>
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
                <CardTitle>Recipients</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="groups">Select Groups</Label>
                  <Select value={selectedGroups} onValueChange={setSelectedGroups}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose groups to send to..." />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.name}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Schedule (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">Date</Label>
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
                    <Label htmlFor="time">Time</Label>
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
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {message || "Your message will appear here..."}
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
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleSendNow}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Now
                </Button>
                
                <Button
                  onClick={handleSchedule}
                  variant="outline"
                  className="w-full"
                  size="lg"
                  disabled={!scheduleDate || !scheduleTime}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule Message
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-600 space-y-2">
                  <p className="font-medium">Tips:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Keep messages concise and engaging</li>
                    <li>• Images get better engagement than text-only</li>
                    <li>• Best times: 10-11 AM, 7-9 PM</li>
                    <li>• Test with one group first</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MessageComposer;
