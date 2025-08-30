import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Save, FileText } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  description?: string;
  type: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
}

interface TextFileEditorProps {
  document: Document;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updatedDocument: Document) => void;
  readOnly?: boolean;
}

export default function TextFileEditor({ 
  document, 
  isOpen, 
  onClose, 
  onSave,
  readOnly = false 
}: TextFileEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [editedName, setEditedName] = useState(document.name);
  const [editedDescription, setEditedDescription] = useState(document.description || '');

  // Fetch file content
  const { data: fileContent, isLoading } = useQuery({
    queryKey: [`/api/documents/${document.id}/content`],
    queryFn: async () => {
      if (!document.fileUrl) return '';
      
      try {
        const response = await fetch(document.fileUrl, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }
        
        return await response.text();
      } catch (error: any) {
        console.error('Error fetching file content:', error);
        throw new Error('Failed to load file content');
      }
    },
    enabled: isOpen && !!document.fileUrl,
  });

  useEffect(() => {
    if (fileContent !== undefined) {
      setContent(fileContent);
    }
  }, [fileContent]);

  useEffect(() => {
    setEditedName(document.name);
    setEditedDescription(document.description || '');
  }, [document]);

  // Save content mutation
  const saveContentMutation = useMutation({
    mutationFn: async ({ content, name, description }: { content: string; name: string; description: string }) => {
      // Create a text file blob
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], `${name}.txt`, { type: 'text/plain' });
      
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      formData.append('description', description);
      formData.append('documentType', document.type);
      
      // If document already exists, update it
      if (document.id) {
        const response = await fetch(`/api/documents/${document.id}/upload`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Update failed' }));
          throw new Error(errorData.message || `Update failed with status ${response.status}`);
        }
        
        return await response.json();
      }
      
      throw new Error('Document ID is required for updates');
    },
    onSuccess: (updatedDocument) => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${document.id}/content`] });
      toast({
        title: 'Success',
        description: 'Text file saved successfully!',
      });
      onSave?.(updatedDocument);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save text file',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (!editedName.trim()) {
      toast({
        title: 'Error',
        description: 'Document name is required',
        variant: 'destructive',
      });
      return;
    }
    
    saveContentMutation.mutate({
      content,
      name: editedName,
      description: editedDescription,
    });
  };

  const isTextFile = (mimeType?: string, fileName?: string) => {
    if (mimeType) {
      return mimeType.startsWith('text/') || mimeType === 'application/json';
    }
    if (fileName) {
      const ext = fileName.toLowerCase().split('.').pop();
      return ['txt', 'text', 'json', 'md', 'csv', 'log'].includes(ext || '');
    }
    return false;
  };

  if (!isTextFile(document.mimeType, document.fileName)) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {readOnly ? 'View Text File' : 'Edit Text File'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto space-y-4">
          {!readOnly && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="document-name">Document Name</Label>
                <Input
                  id="document-name"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter document name"
                  data-testid="input-edit-document-name"
                />
              </div>
              <div>
                <Label htmlFor="document-description">Description</Label>
                <Input
                  id="document-description"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Enter description (optional)"
                  data-testid="input-edit-document-description"
                />
              </div>
            </div>
          )}
          
          <div>
            <Label htmlFor="file-content">Content</Label>
            {isLoading ? (
              <div className="flex items-center justify-center h-96 bg-gray-50 rounded-md">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <Textarea
                id="file-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter text content..."
                className="min-h-96 font-mono text-sm"
                readOnly={readOnly}
                data-testid="textarea-file-content"
              />
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button
              onClick={handleSave}
              disabled={saveContentMutation.isPending || isLoading}
              data-testid="button-save-text-file"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveContentMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}