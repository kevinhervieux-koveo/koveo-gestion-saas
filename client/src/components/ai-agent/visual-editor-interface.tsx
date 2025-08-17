import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Eye, 
  Code, 
  Palette, 
  Layout, 
  Move, 
  Edit3, 
  Save, 
  Undo, 
  Redo,
  Settings,
  MousePointer,
  Square,
  Type,
  Image as ImageIcon,
  Layers
} from 'lucide-react';

/**
 * Visual Editor Interface Component
 * Enables direct visual editing of UI components with real-time code generation
 */
export function VisualEditorInterface() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [editMode, setEditMode] = useState<'select' | 'move' | 'edit' | 'style'>('select');
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Element selection handler
  const handleElementSelect = (event: MouseEvent) => {
    if (!isEnabled) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const target = event.target as HTMLElement;
    if (target && target !== selectedElement) {
      // Remove previous selection highlight
      if (selectedElement) {
        selectedElement.classList.remove('visual-editor-selected');
      }
      
      // Add selection highlight
      target.classList.add('visual-editor-selected');
      setSelectedElement(target);
    }
  };

  // Initialize visual editor
  useEffect(() => {
    if (isEnabled) {
      document.addEventListener('click', handleElementSelect);
      document.body.style.cursor = 'crosshair';
      
      // Add visual editor styles
      const style = document.createElement('style');
      style.id = 'visual-editor-styles';
      style.textContent = `
        .visual-editor-selected {
          outline: 2px solid #3b82f6 !important;
          outline-offset: 2px !important;
          position: relative;
        }
        .visual-editor-hover {
          outline: 1px dashed #6b7280 !important;
          outline-offset: 1px !important;
        }
      `;
      document.head.appendChild(style);
    } else {
      document.removeEventListener('click', handleElementSelect);
      document.body.style.cursor = 'default';
      
      // Remove visual editor styles
      const style = document.getElementById('visual-editor-styles');
      if (style) style.remove();
      
      // Clean up selection
      if (selectedElement) {
        selectedElement.classList.remove('visual-editor-selected');
        setSelectedElement(null);
      }
    }

    return () => {
      document.removeEventListener('click', handleElementSelect);
      document.body.style.cursor = 'default';
    };
  }, [isEnabled, selectedElement]);

  const handleStyleChange = (property: string, value: string) => {
    if (!selectedElement) return;
    
    // Save current state for undo
    const currentState = selectedElement.outerHTML;
    setUndoStack(prev => [...prev, currentState]);
    setRedoStack([]);
    
    // Apply style change
    selectedElement.style.setProperty(property, value);
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || !selectedElement) return;
    
    const lastState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, selectedElement.outerHTML]);
    setUndoStack(prev => prev.slice(0, -1));
    
    // This would need more sophisticated implementation in real app
    console.log('Undo:', lastState);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !selectedElement) return;
    
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, selectedElement?.outerHTML || '']);
    setRedoStack(prev => prev.slice(0, -1));
    
    console.log('Redo:', nextState);
  };

  return (
    <div className="fixed top-4 right-4 z-50 w-80 max-h-96 overflow-auto">
      <Card className="bg-white/95 backdrop-blur-sm shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Visual Editor</CardTitle>
            <Badge variant={isEnabled ? "default" : "secondary"}>
              {isEnabled ? "Active" : "Inactive"}
            </Badge>
          </div>
          <Button
            onClick={() => setIsEnabled(!isEnabled)}
            variant={isEnabled ? "destructive" : "default"}
            size="sm"
            className="w-full"
          >
            <Eye className="w-4 h-4 mr-2" />
            {isEnabled ? "Disable Editor" : "Enable Editor"}
          </Button>
        </CardHeader>

        {isEnabled && (
          <CardContent className="pt-0 space-y-4">
            {/* Mode Selector */}
            <div className="grid grid-cols-4 gap-1">
              <Button
                variant={editMode === 'select' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEditMode('select')}
                className="p-2"
              >
                <MousePointer className="w-3 h-3" />
              </Button>
              <Button
                variant={editMode === 'move' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEditMode('move')}
                className="p-2"
              >
                <Move className="w-3 h-3" />
              </Button>
              <Button
                variant={editMode === 'edit' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEditMode('edit')}
                className="p-2"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
              <Button
                variant={editMode === 'style' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEditMode('style')}
                className="p-2"
              >
                <Palette className="w-3 h-3" />
              </Button>
            </div>

            {/* Undo/Redo */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="flex-1"
              >
                <Undo className="w-3 h-3 mr-1" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="flex-1"
              >
                <Redo className="w-3 h-3 mr-1" />
                Redo
              </Button>
            </div>

            {/* Element Properties */}
            {selectedElement && (
              <Tabs defaultValue="style" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="style">Style</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                </TabsList>
                
                <TabsContent value="style" className="space-y-2">
                  <div className="text-xs font-medium text-gray-600">
                    Element: {selectedElement.tagName.toLowerCase()}
                  </div>
                  
                  {/* Quick Style Controls */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStyleChange('display', 'none')}
                      className="p-1 h-auto"
                    >
                      Hide
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStyleChange('display', '')}
                      className="p-1 h-auto"
                    >
                      Show
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStyleChange('opacity', '0.5')}
                      className="p-1 h-auto"
                    >
                      50% Opacity
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStyleChange('opacity', '1')}
                      className="p-1 h-auto"
                    >
                      Full Opacity
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="content" className="space-y-2">
                  <div className="text-xs text-gray-600">
                    Content editing would require more advanced implementation
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {/* Save Changes */}
            <Button 
              variant="default" 
              size="sm" 
              className="w-full"
              onClick={() => {
                console.log('Save changes - would generate code here');
                // This would trigger AI agent to generate corresponding code changes
              }}
            >
              <Save className="w-3 h-3 mr-2" />
              Generate Code Changes
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}