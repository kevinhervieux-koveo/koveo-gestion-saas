import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, differenceInYears, parseISO } from 'date-fns';
import { parseDateOnly } from '@/lib/utils';
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
import { useLanguage } from '@/hooks/use-language';
import { handleApiError } from '@/lib/demo-error-handler';
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
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();
  const { language } = useLanguage();
  
  // Delete element mutation
  // Exception (task #229): error handled via `handleApiError` for demo-mode/locale-aware messaging.
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
        title: t('edpElementDeletedToastTitle'),
        description: t('edpElementDeletedToastDesc'),
      });
      // Call the onDelete callback to close the panel
      if (element) {
        onDelete?.(element);
      }
    },
    onError: (error: any) => {
      handleApiError(
        error,
        language,
        language === 'fr'
          ? 'Échec de la suppression de l\'élément. Veuillez réessayer.'
          : 'Failed to delete element. Please try again.'
      );
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

  // Fetch element documents - handle 404 gracefully
  const {
    data: documentsResponse,
    isLoading: documentsLoading,
  } = useQuery({
    queryKey: ['/api/maintenance/elements', element?.id, 'documents'],
    queryFn: async () => {
      if (!element?.id) throw new Error('Element ID required');
      try {
        const response = await apiRequest('GET', `/api/maintenance/elements/${element.id}/documents`);
        return await response.json();
      } catch (error: any) {
        // Handle 404 or other errors gracefully
        if (error.status === 404 || error.message?.includes('404')) {
          return { documents: [] };
        }
        throw error;
      }
    },
    enabled: !!element?.id && isOpen,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch related projects - handle 404 gracefully
  const {
    data: projectsResponse,
    isLoading: projectsLoading,
  } = useQuery({
    queryKey: ['/api/maintenance/elements', element?.id, 'projects'],
    queryFn: async () => {
      if (!element?.id) throw new Error('Element ID required');
      try {
        const response = await apiRequest('GET', `/api/maintenance/elements/${element.id}/projects`);
        return await response.json();
      } catch (error: any) {
        // Handle 404 or other errors gracefully
        if (error.status === 404 || error.message?.includes('404')) {
          return { projects: [] };
        }
        throw error;
      }
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
  // parseDateOnly reads YYYY-MM-DD in local time to avoid UTC-midnight off-by-one in
  // negative-offset zones (e.g. America/Montreal). Falls back to null when date is absent.
  const parsedConstructionDate = element.originalConstructionDate
    ? parseDateOnly(element.originalConstructionDate)
    : null;
  const age = parsedConstructionDate ? differenceInYears(new Date(), parsedConstructionDate) : null;
  
  const originalLifespan = element.originalLifespan;
  const currentLifespan = element.currentLifespan || originalLifespan;
  const lifespanProgress = age && originalLifespan ? Math.min((age / originalLifespan) * 100, 100) : 0;

  const getUrgencyStatus = () => {
    if (!element.nextEvaluationDate) return 'not-scheduled';
    
    // parseDateOnly prevents UTC-midnight rollback for date-only fields; null means no valid date
    const evaluationDate = parseDateOnly(element.nextEvaluationDate);
    if (!evaluationDate) return 'not-scheduled';
    const today = new Date();
    const daysUntil = Math.ceil((evaluationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 30) return 'due-soon';
    return 'scheduled';
  };

  const urgencyStatus = getUrgencyStatus();
  const urgencyConfig = {
    'overdue': { color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle, label: t('edpUrgencyOverdueLabel') },
    'due-soon': { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Clock, label: t('edpUrgencyDueSoonLabel') },
    'scheduled': { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle, label: t('edpUrgencyScheduledLabel') },
    'not-scheduled': { color: 'text-gray-600', bg: 'bg-gray-100', icon: Calendar, label: t('edpUrgencyNotScheduledLabel') },
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
          {t('edpEditAction')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUploadDocuments?.(element)}
          data-testid="upload-documents-action"
        >
          <Upload className="h-4 w-4 mr-2" />
          {t('edpUploadFilesAction')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onScheduleEvaluation?.(element)}
          data-testid="schedule-evaluation-action"
        >
          <Calendar className="h-4 w-4 mr-2" />
          {t('edpScheduleAction')}
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
                {t('edpDeleteAction')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('edpDeleteDialogTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('areYouSureYouWantTo2')}{element.name}{t('thisActionCannotBeUndoneAnd')}
                </AlertDialogDescription>
                {/* eslint-enable i18n/no-untranslated-jsx-strings */}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('edpDeleteDialogConfirmCancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteElementMutation.mutate(element)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteElementMutation.isPending}
                >
                  {deleteElementMutation.isPending ? t('edpDeletingProgress') : t('edpDeleteAction')}
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
            <TabsTrigger value="overview">{t('edpOverviewTab')}</TabsTrigger>
            <TabsTrigger value="documents">{t('edpDocumentsTab')}</TabsTrigger>
            <TabsTrigger value="projects">{t('edpProjectsTab')}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Status Card */}
            <Card data-testid="status-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t('edpStatusEvaluationTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('edpCurrentConditionLabel')}</span>
                  <ConditionBadge condition={element.currentCondition} />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('edpNextEvaluationLabel')}</span>
                  <div className={cn('flex items-center gap-2 px-2 py-1 rounded-full text-xs', urgency.bg, urgency.color)}>
                    <urgency.icon className="h-3 w-3" />
                    {element.nextEvaluationDate
                      ? (parseDateOnly(element.nextEvaluationDate)
                          ? format(parseDateOnly(element.nextEvaluationDate)!, 'MMM d, yyyy')
                          : '—')
                      : urgency.label}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('edpLastInspectionLabel')}</span>
                  <span className="text-sm">
                    {element.lastInspectionDate 
                      ? format(parseISO(element.lastInspectionDate), 'MMM d, yyyy')
                      : t('edpLastInspectionNever')
                    }
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Lifespan & Age */}
            {age !== null && originalLifespan && (
              <Card data-testid="lifespan-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {t('edpLifespanAnalysisTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{t('edpAgeProgressLabel')}</span>
                      <span className="font-medium">{age} / {currentLifespan} {t('edpYearsSuffix')}</span>
                    </div>
                    <Progress value={lifespanProgress} className="h-2" data-testid="lifespan-progress" />
                    <div className="text-xs text-muted-foreground">
                      {lifespanProgress > 80 ? (
                        <span className="text-red-600">⚠️ {t('edpNearingEndLifespan')}</span>
                      ) : lifespanProgress > 60 ? (
                        <span className="text-yellow-600">⚡ {t('edpAgingMonitor')}</span>
                      ) : (
                        <span className="text-green-600">✓ {t('edpGoodRemaining')}</span>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">{t('edpOriginalLifespanLabel')}</div>
                      <div className="font-medium">{originalLifespan} {t('edpYearsSuffix')}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{t('edpCurrentLifespanLabel')}</div>
                      <div className="font-medium">{currentLifespan} {t('edpYearsSuffix')}</div>
                    </div>
                  </div>

                  {parsedConstructionDate && (
                    <div data-testid="element-construction-date">
                      <div className="text-muted-foreground text-sm">{t('edpConstructionDateLabel')}</div>
                      {/* parseDateOnly prevents UTC-midnight off-by-one in negative-offset zones. Do not replace with parseISO. */}
                      <div className="font-medium">{format(parsedConstructionDate, 'MMMM d, yyyy')}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Specifications */}
            <Card data-testid="specifications-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  {t('edpSpecificationsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {element.unitValue && element.unit && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('edpQuantityLabel')}</span>
                    <span className="font-medium">{element.unitValue} {element.unit}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('edpUniformatCodeLabel')}</span>
                  <Badge variant="outline">{element.uniformatCode}</Badge>
                </div>

                {element.notes && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">{t('edpNotesLabel')}</div>
                      <p className="text-sm">{element.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
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
                          {doc.documentType} • {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : t('edpUnknownSize')}
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
                <p>{t('edpNoDocumentsUploaded')}</p>
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
                          {t('edpProjectNumberPrefix')} #{project.projectNumber}
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
                      {/* parseDateOnly prevents UTC-midnight off-by-one for date-only plannedStartDate. Do not replace with parseISO. */}
                      {project.type}{project.plannedStartDate && parseDateOnly(project.plannedStartDate)
                        ? ` • ${format(parseDateOnly(project.plannedStartDate)!, 'MMM yyyy')}`
                        : ''}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('edpNoRelatedProjects')}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}

export type { ElementDetailsPanelProps };