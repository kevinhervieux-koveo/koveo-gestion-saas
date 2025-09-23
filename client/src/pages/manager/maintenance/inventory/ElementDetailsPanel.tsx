import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, differenceInYears, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
} from '@/components/ui/alert-dialog';
import { ConditionBadge } from '@/components/maintenance/StatusBadges';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { BuildingElement, ElementHistory, ElementDocument } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  X,
  Edit2,
  Clock,
  Upload,
  Calendar,
  FileText,
  Image,
  Building,
  Calculator,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Eye,
  Download,
  ExternalLink,
  Trash2,
} from 'lucide-react';

interface ElementDetailsPanelProps {
  element: BuildingElement | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (element: BuildingElement) => void;
  onUploadDocuments?: (element: BuildingElement) => void;
  onScheduleEvaluation?: (element: BuildingElement) => void;
  onDelete?: (element: BuildingElement) => void;
  className?: string;
}

/**
 * ElementDetailsPanel component displaying comprehensive element information
 * Shows element details, history, documents, and related projects
 */
export function ElementDetailsPanel({
  element,
  isOpen,
  onClose,
  onEdit,
  onUploadDocuments,
  onScheduleEvaluation,
  onDelete,
  className,
}: ElementDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();
  
  // Delete element mutation
  const deleteElementMutation = useMutation({
    mutationFn: async (element: BuildingElement) => {
      const response = await apiRequest('DELETE', `/api/maintenance/buildings/${element.buildingId}/elements/${element.id}`);
      // Only parse JSON if response has content (not 204 No Content)
      if (response.status !== 204 && response.headers.get('content-type')?.includes('application/json')) {
        return await response.json();
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', element?.buildingId, 'elements'] });
      toast({
        title: 'Element deleted',
        description: 'The building element has been removed successfully',
      });
      // Call the onDelete callback to close the panel
      if (element) {
        onDelete?.(element);
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete building element',
        variant: 'destructive',
      });
    },
  });

  // Fetch element history
  const {
    data: historyResponse,
    isLoading: historyLoading,
  } = useQuery({
    queryKey: ['/api/maintenance/elements', element?.id, 'history'],
    queryFn: async () => {
      if (!element?.id) throw new Error('Element ID required');
      const response = await apiRequest('GET', `/api/maintenance/elements/${element.id}/history`);
      return await response.json();
    },
    enabled: !!element?.id && isOpen,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch element documents
  const {
    data: documentsResponse,
    isLoading: documentsLoading,
  } = useQuery({
    queryKey: ['/api/maintenance/elements', element?.id, 'documents'],
    queryFn: async () => {
      if (!element?.id) throw new Error('Element ID required');
      const response = await apiRequest('GET', `/api/maintenance/elements/${element.id}/documents`);
      return await response.json();
    },
    enabled: !!element?.id && isOpen,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch related projects
  const {
    data: projectsResponse,
    isLoading: projectsLoading,
  } = useQuery({
    queryKey: ['/api/maintenance/elements', element?.id, 'projects'],
    queryFn: async () => {
      if (!element?.id) throw new Error('Element ID required');
      const response = await apiRequest('GET', `/api/maintenance/elements/${element.id}/projects`);
      return await response.json();
    },
    enabled: !!element?.id && isOpen,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const history: ElementHistory[] = historyResponse?.history || [];
  const documents: ElementDocument[] = documentsResponse?.documents || [];
  const projects = projectsResponse?.projects || [];

  if (!isOpen || !element) {
    return null;
  }

  // Calculate element metrics
  const age = element.originalConstructionDate 
    ? differenceInYears(new Date(), parseISO(element.originalConstructionDate))
    : null;
  
  const originalLifespan = element.originalLifespan;
  const currentLifespan = element.currentLifespan || originalLifespan;
  const lifespanProgress = age && originalLifespan ? Math.min((age / originalLifespan) * 100, 100) : 0;

  const getUrgencyStatus = () => {
    if (!element.nextEvaluationDate) return 'not-scheduled';
    
    const evaluationDate = parseISO(element.nextEvaluationDate);
    const today = new Date();
    const daysUntil = Math.ceil((evaluationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 30) return 'due-soon';
    return 'scheduled';
  };

  const urgencyStatus = getUrgencyStatus();
  const urgencyConfig = {
    'overdue': { color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle, label: 'Overdue' },
    'due-soon': { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Clock, label: 'Due Soon' },
    'scheduled': { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle, label: 'Scheduled' },
    'not-scheduled': { color: 'text-gray-600', bg: 'bg-gray-100', icon: Calendar, label: 'Not Scheduled' },
  };

  const urgency = urgencyConfig[urgencyStatus];

  return (
    <div className={cn(
      'fixed inset-y-0 right-0 w-full max-w-2xl bg-background border-l shadow-xl z-50 flex flex-col',
      'transform transition-transform duration-300 ease-in-out',
      isOpen ? 'translate-x-0' : 'translate-x-full',
      className
    )} data-testid="element-details-panel">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-6 border-b bg-muted/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-semibold truncate" data-testid="element-name">
              {element.name}
            </h2>
            <ConditionBadge condition={element.currentCondition} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {element.uniformatCode}
            </Badge>
            <span className="truncate">{element.description}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="close-panel-button">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 p-4 border-b bg-background">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit?.(element)}
          data-testid="edit-element-action"
        >
          <Edit2 className="h-4 w-4 mr-2" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUploadDocuments?.(element)}
          data-testid="upload-documents-action"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Files
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onScheduleEvaluation?.(element)}
          data-testid="schedule-evaluation-action"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Schedule
        </Button>
        
        {onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                data-testid="delete-element-action"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Building Element</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{element.name}"? This action cannot be undone 
                  and will remove all associated maintenance history and documents.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteElementMutation.mutate(element)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteElementMutation.isPending}
                >
                  {deleteElementMutation.isPending ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Panel Content */}
      <ScrollArea className="flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="p-6">
          <TabsList className="grid w-full grid-cols-3" data-testid="details-tabs">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
          </TabsList>

          {/* Overview Tab - Form-like View */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="space-y-6">
              {/* UNIFORMAT Code Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium">UNIFORMAT Code</label>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{element.uniformatCode}</Badge>
                    <span className="text-sm font-medium">{element.name}</span>
                  </div>
                  {element.description && (
                    <div className="text-xs text-muted-foreground">{element.description}</div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Element Name</label>
                  <Input value={element.name} disabled />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Current Condition</label>
                  <Select value={element.currentCondition} disabled>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={element.currentCondition}>
                        <ConditionBadge condition={element.currentCondition} size="sm" />
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea value={element.description || ''} disabled rows={3} />
              </div>

              {/* Element Assignment */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assignment Type</label>
                  <Input value={element.residenceId ? 'Specific Residence' : 'Building-wide'} disabled />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Access</label>
                  <Input value={element.access === 'not_restrained' ? 'Not Restrained' : 'Restrained'} disabled />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Charge</label>
                  <Input value={element.charge === 'common' ? 'Common' : 'Personal'} disabled />
                </div>
              </div>

              <Separator />

              {/* Dates Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Construction Date</label>
                  <Input 
                    type="date" 
                    value={element.originalConstructionDate || ''} 
                    disabled 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Last Inspection</label>
                  <Input 
                    type="date" 
                    value={element.lastInspectionDate || ''} 
                    disabled 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Next Evaluation</label>
                  <Input 
                    type="date" 
                    value={element.nextEvaluationDate || ''} 
                    disabled 
                  />
                </div>
              </div>

              {/* Lifespan Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Lifespan Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Original Lifespan (years)</label>
                    <Input value={element.originalLifespan || ''} disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Current Lifespan (years)</label>
                    <Input value={element.currentLifespan || ''} disabled />
                  </div>
                </div>
                
                {/* Lifespan Progress Visual */}
                {age !== null && originalLifespan && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Age Progress: {age} / {currentLifespan} years</span>
                      <span className={cn(
                        'text-xs px-2 py-1 rounded',
                        lifespanProgress > 80 ? 'bg-red-100 text-red-700' :
                        lifespanProgress > 60 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      )}>
                        {lifespanProgress > 80 ? '⚠️ Nearing end' :
                         lifespanProgress > 60 ? '⚡ Aging' : '✓ Good condition'}
                      </span>
                    </div>
                    <Progress value={lifespanProgress} className="h-2" />
                  </div>
                )}
              </div>

              {/* Quantity and Cost */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit</label>
                  <Input value={element.unit || ''} disabled />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unit Value</label>
                  <Input value={element.unitValue || ''} disabled />
                </div>
              </div>

              {/* Reconstruction Cost */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Reconstruction Evaluation
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Reconstruction Cost</label>
                    <Input 
                      value={element.reconstructionCost ? `$${element.reconstructionCost}` : ''} 
                      disabled 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date of Estimation</label>
                    <Input 
                      type="date" 
                      value={element.costEstimationDate || ''} 
                      disabled 
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea 
                  value={element.notes || ''} 
                  disabled 
                  rows={3} 
                  placeholder="No additional notes" 
                />
              </div>
            </div>
          </TabsContent>


          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4 mt-6">
            {documentsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : documents.length > 0 ? (
              <div className="space-y-3" data-testid="documents-list">
                {documents.map((doc) => (
                  <Card key={doc.id} className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {doc.documentType === 'image' ? (
                          <Image className="h-6 w-6 text-blue-500" />
                        ) : (
                          <FileText className="h-6 w-6 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{doc.fileName}</div>
                        <div className="text-xs text-muted-foreground">
                          {doc.documentType} • {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : 'Unknown size'}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" data-testid={`view-document-${doc.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" data-testid={`download-document-${doc.id}`}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No documents uploaded</p>
              </div>
            )}
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-4 mt-6">
            {projectsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : projects.length > 0 ? (
              <div className="space-y-3" data-testid="projects-list">
                {projects.map((project: any) => (
                  <Card key={project.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-sm">{project.title}</div>
                        <div className="text-xs text-muted-foreground">
                          Project #{project.projectNumber}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {project.status}
                        </Badge>
                        <Button variant="ghost" size="sm" data-testid={`view-project-${project.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {project.type} • {project.plannedStartDate && format(parseISO(project.plannedStartDate), 'MMM yyyy')}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No related projects</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}

export type { ElementDetailsPanelProps };