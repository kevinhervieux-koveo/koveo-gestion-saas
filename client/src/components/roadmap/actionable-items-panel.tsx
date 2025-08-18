import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { ActionableItem, Feature } from '@shared/schema';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Copy,
  ChevronRight,
  Zap,
} from 'lucide-react';

/**
 * Props for the ActionableItemsPanel component.
 */
interface ActionableItemsPanelProps {
  feature: Feature;
  onClose?: () => void;
}

/**
 * Panel component for managing actionable items generated from feature analysis.
 * @param root0 - Component props
 * @param root0.feature - The feature containing actionable items
 * @param root0.onClose - Optional callback when panel is closed
 */
export function ActionableItemsPanel({ feature, onClose }: ActionableItemsPanelProps) {
  const { toast } = useToast();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Fetch actionable items
  const { data: items = [], isLoading } = useQuery<ActionableItem[]>({
    queryKey: [`/api/features/${feature.id}/actionable-items`],
    enabled: !!feature.id && feature.status === 'ai-analyzed',
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ActionableItem> }) => {
      const response = await fetch(`/api/actionable-items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {throw new Error('Failed to update item');}
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/features/${feature.id}/actionable-items`] });
      queryClient.invalidateQueries({ queryKey: ['/api/features'] });
      toast({
        title: 'Item Updated',
        description: 'The actionable item has been updated successfully.',
      });
    },
  });

  const getStatusIcon = (status: string, onClick?: () => void) => {
    const iconClass = "w-5 h-5 cursor-pointer hover:scale-110 transition-transform";
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent accordion toggle
      onClick?.();
    };

    switch (status) {
      case 'completed':
        return <CheckCircle2 className={`${iconClass} text-green-600`} onClick={handleClick} />;
      case 'in-progress':
        return <Clock className={`${iconClass} text-blue-600`} onClick={handleClick} />;
      case 'blocked':
        return <AlertCircle className={`${iconClass} text-red-600`} onClick={handleClick} />;
      default:
        return <Circle className={`${iconClass} text-gray-400 hover:text-green-600`} onClick={handleClick} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'blocked':
        return <Badge className="bg-red-100 text-red-800">Blocked</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    await updateItemMutation.mutateAsync({
      id: itemId,
      updates: {
        status: newStatus as any,
        ...(newStatus === 'completed' ? { completedAt: new Date() } : {}),
      },
    });
  };

  const handleCircleClick = async (item: ActionableItem) => {
    // Toggle between pending and completed when clicking the circle
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    await handleStatusChange(item.id, newStatus);
  };

  const copyImplementationPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast({
        title: '🤖 AI Prompt Copied!',
        description: 'The implementation prompt has been copied to your clipboard. You can now paste it directly into Replit AI.',
      });
    } catch (_error) {
      // Fallback to creating a text area and selecting the text
      try {
        const textArea = document.createElement('textarea');
        textArea.value = prompt;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast({
          title: '📋 Prompt Copied!',
          description: 'The implementation prompt has been copied using fallback method.',
        });
      } catch (_fallbackError) {
        toast({
          title: 'Copy Failed',
          description: 'Failed to copy prompt to clipboard. Please manually select and copy the text.',
          variant: 'destructive',
        });
      }
    }
  };

  const completedCount = items.filter((item) => item.status === 'completed').length;
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  if (!feature || feature.status !== 'ai-analyzed') {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Actionable Items...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Actionable Items for {feature.name}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {completedCount} of {items.length} items completed
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <Accordion
            type="multiple"
            value={expandedItems}
            onValueChange={setExpandedItems}
            className="space-y-4"
          >
            {items.map((item, index) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(item.status, () => handleCircleClick(item))}
                      <div className="text-left">
                        <div className="font-medium">{item.title}</div>
                        <div className="text-sm text-gray-600">
                          {item.estimatedEffort} • Item {index + 1} of {items.length}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mr-2">
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Description */}
                    <div>
                      <h4 className="font-semibold mb-1">Description</h4>
                      <p className="text-sm text-gray-700">{item.description}</p>
                    </div>

                    {/* Technical Details */}
                    {item.technicalDetails && (
                      <div>
                        <h4 className="font-semibold mb-1">Technical Details</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {item.technicalDetails}
                        </p>
                      </div>
                    )}

                    {/* Testing Requirements */}
                    {item.testingRequirements && (
                      <div>
                        <h4 className="font-semibold mb-1">Testing Requirements</h4>
                        <p className="text-sm text-gray-700">{String(item.testingRequirements)}</p>
                      </div>
                    )}

                    {/* Implementation Prompt - Always show, even if empty */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-blue-600 flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          AI Implementation Prompt
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyImplementationPrompt(
                            item.implementationPrompt || 
                            `Implement: ${item.title}\n\nDescription: ${item.description}\n\nTechnical Details: ${item.technicalDetails || 'No specific technical details provided'}\n\nEstimated Effort: ${item.estimatedEffort || 'Unknown'}`
                          )}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Copy AI Prompt
                        </Button>
                      </div>
                      <div className="bg-slate-900 text-green-400 p-4 rounded-lg border border-slate-700 shadow-inner">
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed">
{item.implementationPrompt || `Implement: ${item.title}

Description: ${item.description}

Technical Details: ${item.technicalDetails || 'No specific technical details provided'}

Estimated Effort: ${item.estimatedEffort || 'Unknown'}

Please implement this feature following best practices and ensuring proper error handling, testing, and documentation.`}
                        </pre>
                      </div>
                    </div>

                    {/* Dependencies */}
                    {item.dependencies && Array.isArray(item.dependencies) && (item.dependencies as string[]).length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-1">Dependencies</h4>
                        <ul className="text-sm text-gray-700 list-disc list-inside">
                          {(item.dependencies as string[]).map((dep, i) => (
                            <li key={i}>{dep}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Status Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <span className="text-sm font-medium">Status:</span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={item.status === 'pending' ? 'default' : 'outline'}
                          onClick={() => handleStatusChange(item.id, 'pending')}
                        >
                          Pending
                        </Button>
                        <Button
                          size="sm"
                          variant={item.status === 'in-progress' ? 'default' : 'outline'}
                          onClick={() => handleStatusChange(item.id, 'in-progress')}
                        >
                          In Progress
                        </Button>
                        <Button
                          size="sm"
                          variant={item.status === 'completed' ? 'default' : 'outline'}
                          onClick={() => handleStatusChange(item.id, 'completed')}
                        >
                          Completed
                        </Button>
                        <Button
                          size="sm"
                          variant={item.status === 'blocked' ? 'destructive' : 'outline'}
                          onClick={() => handleStatusChange(item.id, 'blocked')}
                        >
                          Blocked
                        </Button>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>

        {feature.aiAnalysisResult && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold mb-2">AI Analysis Summary</h4>
            <p className="text-sm text-gray-700">
              {String((feature.aiAnalysisResult as any)?.summary || '')}
            </p>
            {(feature.aiAnalysisResult as any)?.recommendations && (
              <div className="mt-3">
                <h5 className="font-medium text-sm mb-1">Recommendations:</h5>
                <ul className="text-sm text-gray-600 list-disc list-inside">
                  {Array.isArray((feature.aiAnalysisResult as any).recommendations) && (feature.aiAnalysisResult as any).recommendations.map((rec: string, i: number) => (
                    <li key={i}>{String(rec)}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 text-sm text-gray-600">
              <strong>Total Estimated Effort:</strong>{' '}
              {String((feature.aiAnalysisResult as any)?.estimatedTotalEffort || '')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}