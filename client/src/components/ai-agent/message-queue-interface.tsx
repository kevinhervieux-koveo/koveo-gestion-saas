import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Play,
  Pause
} from 'lucide-react';

interface QueuedMessage {
  id: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  estimatedDuration?: number;
}

/**
 * Message Queue Interface for AI Agent
 * Allows scheduling and managing follow-up tasks
 */
export function MessageQueueInterface() {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isProcessing, setIsProcessing] = useState(false);

  // Simulate queue processing
  useEffect(() => {
    if (isProcessing && queue.length > 0) {
      const timer = setTimeout(() => {
        setQueue(prev => {
          const updated = [...prev];
          const nextPending = updated.find(item => item.status === 'pending');
          if (nextPending) {
            nextPending.status = 'processing';
            
            // Simulate completion after duration
            setTimeout(() => {
              setQueue(current => 
                current.map(item => 
                  item.id === nextPending.id 
                    ? { ...item, status: 'completed' }
                    : item
                )
              );
            }, nextPending.estimatedDuration || 2000);
          }
          return updated;
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isProcessing, queue]);

  const addToQueue = () => {
    if (!newMessage.trim()) return;

    const newTask: QueuedMessage = {
      id: Date.now().toString(),
      message: newMessage,
      priority: newPriority,
      status: 'pending',
      createdAt: new Date(),
      estimatedDuration: Math.random() * 3000 + 2000 // 2-5 seconds
    };

    setQueue(prev => [...prev, newTask].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }));
    
    setNewMessage('');
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const movePriority = (id: string, direction: 'up' | 'down') => {
    setQueue(prev => {
      const index = prev.findIndex(item => item.id === id);
      if (index === -1) return prev;

      const updated = [...prev];
      const item = updated[index];
      
      if (direction === 'up' && index > 0) {
        [updated[index], updated[index - 1]] = [updated[index - 1], updated[index]];
      } else if (direction === 'down' && index < updated.length - 1) {
        [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      }
      
      return updated;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-gray-500" />;
      case 'processing': return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const pendingCount = queue.filter(item => item.status === 'pending').length;
  const processingCount = queue.filter(item => item.status === 'processing').length;
  const completedCount = queue.filter(item => item.status === 'completed').length;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            AI Agent Message Queue
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              {pendingCount} pending
            </Badge>
            <Badge variant="outline" className="text-xs">
              {processingCount} active
            </Badge>
            <Badge variant="outline" className="text-xs">
              {completedCount} done
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Add New Message */}
        <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
          <div className="flex gap-2">
            <Textarea
              placeholder="Enter a task for the AI agent to process later..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 min-h-[80px]"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={newPriority === 'low' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNewPriority('low')}
              >
                Low
              </Button>
              <Button
                variant={newPriority === 'medium' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNewPriority('medium')}
              >
                Medium
              </Button>
              <Button
                variant={newPriority === 'high' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNewPriority('high')}
              >
                High
              </Button>
            </div>
            
            <Button onClick={addToQueue} disabled={!newMessage.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Add to Queue
            </Button>
          </div>
        </div>

        {/* Queue Controls */}
        <div className="flex justify-between items-center">
          <Button
            variant={isProcessing ? "destructive" : "default"}
            onClick={() => setIsProcessing(!isProcessing)}
            disabled={queue.length === 0}
          >
            {isProcessing ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause Processing
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Processing
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => setQueue(prev => prev.filter(item => item.status !== 'completed'))}
            disabled={completedCount === 0}
          >
            Clear Completed
          </Button>
        </div>

        {/* Queue Items */}
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className={`p-3 border rounded-lg transition-colors ${
                  item.status === 'processing' ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(item.status)}
                      <Badge className={`text-xs ${getPriorityColor(item.priority)}`}>
                        {item.priority}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {item.createdAt.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 break-words">
                      {item.message}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => movePriority(item.id, 'up')}
                      disabled={item.status !== 'pending'}
                      className="p-1"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => movePriority(item.id, 'down')}
                      disabled={item.status !== 'pending'}
                      className="p-1"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromQueue(item.id)}
                      disabled={item.status === 'processing'}
                      className="p-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {item.status === 'processing' && (
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                    <div className="bg-blue-600 h-1 rounded-full animate-pulse w-1/2"></div>
                  </div>
                )}
              </div>
            ))}

            {queue.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No messages in queue</p>
                <p className="text-xs">Add tasks above to get started</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}