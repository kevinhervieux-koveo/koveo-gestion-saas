import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Feature } from '@shared/schema';

/**
 * Props for PromptDisplay component.
 */
interface PromptDisplayProps {
  prompt: string;
  feature: Feature | null;
  onSavePrompt: (prompt: string, title: string) => void;
  onCopyToClipboard: (text: string) => Promise<void>;
  isSaving?: boolean;
}

/**
 * Component for displaying and managing generated development prompts.
 */
export function PromptDisplay({ 
  prompt, 
  feature, 
  onSavePrompt, 
  onCopyToClipboard,
  isSaving = false 
}: PromptDisplayProps) {
  const { toast } = useToast();
  const [promptTitle, setPromptTitle] = useState('Implementation Prompt');

  const handleCopyPrompt = async () => {
    try {
      await onCopyToClipboard(prompt);
      toast({
        title: 'Prompt Copied!',
        description: 'The development prompt has been copied to your clipboard.',
      });
    } catch (_error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy the prompt to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleSavePrompt = () => {
    if (!promptTitle.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please enter a title for the prompt.',
        variant: 'destructive',
      });
      return;
    }
    
    onSavePrompt(prompt, promptTitle.trim());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Generated Development Prompt</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyPrompt}
            className="flex items-center gap-1"
          >
            <Copy className="h-3 w-3" />
            Copy to Clipboard
          </Button>
          
          {feature?.id && (
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="promptTitle" className="text-xs text-gray-600">
                  Save as Actionable Item:
                </Label>
                <div className="flex gap-1">
                  <Input
                    id="promptTitle"
                    placeholder="Enter title..."
                    value={promptTitle}
                    onChange={(e) => setPromptTitle(e.target.value)}
                    className="text-sm h-8 w-40"
                  />
                  <Button
                    size="sm"
                    onClick={handleSavePrompt}
                    disabled={isSaving || !promptTitle.trim()}
                    className="flex items-center gap-1 h-8"
                  >
                    <Save className="h-3 w-3" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border">
        <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed max-h-96 overflow-y-auto">
          {prompt}
        </pre>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <p>
          <strong>Usage Instructions:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Copy this prompt and paste it into ChatGPT, Claude, or another AI assistant</li>
          <li>The AI will have full context about Koveo Gestion's architecture and requirements</li>
          <li>Request specific implementation details or ask follow-up questions</li>
          <li>Save as an actionable item to track implementation progress</li>
        </ul>
      </div>
    </div>
  );
}