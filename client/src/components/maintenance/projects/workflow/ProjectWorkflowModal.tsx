import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProjectWorkflowState, useMarkStatusComplete, ProjectWorkflowState } from '@/hooks/useProjectWorkflow';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import {
  WorkflowTabNavigation,
  PlannedTab,
  SubmissionTab,
  PreWorkTab,
  InProgressTab,
  PostWorkTab,
  CompleteTab,
} from './lazy-components';
import { cn, formatStatus } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  Settings,
  Users,
} from 'lucide-react';
import { WorkflowSkipConfigDialog } from './WorkflowSkipConfigDialog';
import { useLanguage } from '@/hooks/use-language';
import type { Translations } from '@/lib/i18n';

export interface ProjectWorkflowModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: MaintenanceProject;
  initialTab?: string; // Optional tab to open first
  onProjectUpdate?: (project: MaintenanceProject) => void;
  onProjectDelete?: () => void; // Called after a successful project deletion
}

const TAB_CONFIG = {
  planned: {
    id: 'planned',
    labelKey: 'wfModalTabPlannedLabel',
    icon: Clock,
    descriptionKey: 'wfModalTabPlannedDesc',
  },
  submission: {
    id: 'submission',
    labelKey: 'wfModalTabSubmissionLabel',
    icon: Users,
    descriptionKey: 'wfModalTabSubmissionDesc',
  },
  pre_work: {
    id: 'pre_work',
    labelKey: 'wfModalTabPreWorkLabel',
    icon: Building2,
    descriptionKey: 'wfModalTabPreWorkDesc',
  },
  in_progress: {
    id: 'in_progress',
    labelKey: 'wfModalTabInProgressLabel',
    icon: Building2,
    descriptionKey: 'wfModalTabInProgressDesc',
  },
  post_work: {
    id: 'post_work',
    labelKey: 'wfModalTabPostWorkLabel',
    icon: CheckCircle2,
    descriptionKey: 'wfModalTabPostWorkDesc',
  },
  completed: {
    id: 'completed',
    labelKey: 'wfModalTabCompletedLabel',
    icon: CheckCircle2,
    descriptionKey: 'wfModalTabCompletedDesc',
  },
} as const;

/**
 * Main workflow modal for managing project lifecycle
 * Provides tabbed interface based on current project status and skip flags
 */
export function ProjectWorkflowModal({
  isOpen,
  onOpenChange,
  project,
  initialTab,
  onProjectUpdate,
  onProjectDelete,
}: ProjectWorkflowModalProps) {
  const { t } = useLanguage();
  // Defensive null check for project prop
  if (!project) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" data-testid="project-workflow-modal-no-project">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('wfModalProjectMissingTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('wfModalNoProjectDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('wfModalProjectMissingMessage')}
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  // Fetch workflow state
  const {
    data: workflowState,
    isLoading: isLoadingWorkflow,
    error: workflowError,
    refetch: refetchWorkflow,
  } = useProjectWorkflowState(project.id) as {
    data: ProjectWorkflowState | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<any>;
  };

  // Current active tab state
  const [activeTab, setActiveTab] = useState<string>('');

  // Mark status complete hook
  const { mutateAsync: markCompleteAsync, isPending: isMarkingComplete } = useMarkStatusComplete();

  // Set initial active tab when workflow state loads
  useEffect(() => {
    if (workflowState && !activeTab) {
      // Use initialTab if provided and accessible, otherwise use first incomplete tab
      const targetTab = initialTab && workflowState.accessibleTabs?.includes(initialTab)
        ? initialTab
        : workflowState.firstIncompleteTab;
      
      setActiveTab(targetTab);
    }
  }, [workflowState, activeTab, initialTab]);

  // Reset active tab when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('');
    }
  }, [isOpen]);

  // Handle workflow updates
  const handleWorkflowUpdate = () => {
    refetchWorkflow();
    if (onProjectUpdate && workflowState?.project) {
      onProjectUpdate(workflowState.project);
    }
  };

  // Handle mark current step complete. Returns a promise so callers (e.g.
  // PostWorkTab.handleConfirmedCompletion) can `await` and react to backend
  // failures with their own error UI rather than silently relying on the
  // useMarkStatusComplete onError toast.
  const handleMarkCurrentStepComplete = async (): Promise<void> => {
    if (!workflowState?.canAdvance || !workflowState.currentStatus) {
      return;
    }

    // Special handling for final project completion
    if (workflowState.currentStatus === 'completed') {
      await markCompleteAsync({
        projectId: project.id,
        currentStatus: workflowState.currentStatus,
      });
      // Refresh workflow state to reflect final completion
      handleWorkflowUpdate();

      // Close modal after successful project completion
      setTimeout(() => {
        onOpenChange(false);
      }, 1000);
      return;
    }

    // Standard workflow advancement
    const data = await markCompleteAsync({
      projectId: project.id,
      currentStatus: workflowState.currentStatus,
    });

    // Navigate immediately to the new status from mutation response
    // The backend has already validated this transition, so it's safe to navigate
    if (data.newStatus && data.newStatus !== activeTab) {
      setActiveTab(data.newStatus);
    }

    // Refresh workflow state after navigation to get fresh data
    try {
      await refetchWorkflow();
      // Call handleWorkflowUpdate to trigger onProjectUpdate callback if provided
      if (onProjectUpdate && workflowState?.project) {
        onProjectUpdate(workflowState.project);
      }
    } catch (error) {
      console.error('Failed to refresh workflow state after advancement:', error);
      // Still call handleWorkflowUpdate as fallback
      handleWorkflowUpdate();
    }
  };

  // Get appropriate button text based on current status
  const getMarkCompleteButtonText = () => {
    if (!workflowState?.currentStatus) return t('wfModalCompleteStepDefault');
    
    switch (workflowState.currentStatus) {
      case 'planned':
        return t('wfModalCompletePlanning');
      case 'submission':
        return t('wfModalCompleteSubmissions');
      case 'pre_work':
        return t('wfModalCompletePreWork');
      case 'in_progress':
        return t('wfModalCompleteWork');
      case 'post_work':
        return t('wfModalCompletePostWork');
      case 'completed':
        return t('wfModalCompleteProject');
      default:
        return t('wfModalCompleteStepDefault');
    }
  };

  // Check if we can show the mark complete button
  const showMarkCompleteButton = workflowState?.canAdvance && 
    workflowState.currentStatus === activeTab && 
    (workflowState.currentStatus !== 'completed' || activeTab === 'completed');

  // Handle tab change
  const handleTabChange = (tabId: string) => {
    if (workflowState?.accessibleTabs.includes(tabId)) {
      setActiveTab(tabId);
    }
  };

  // Render tab content based on active tab
  const renderTabContent = () => {
    // Rendering tab content for active tab
    
    if (!workflowState || !activeTab) {
      // No content available - checking workflow state
      return null;
    }

    // Defensive null check for project data
    if (!workflowState.project) {
      return (
        <Alert className="m-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('wfModalProjectStillLoading')}
          </AlertDescription>
        </Alert>
      );
    }

    const tabProps = {
      project: workflowState.project,
      workflowState,
      onUpdate: handleWorkflowUpdate,
      onMarkComplete: handleMarkCurrentStepComplete,
      onAdvanceToNext: (newStatus?: string) => {
        if (newStatus) {
          setActiveTab(newStatus);
        }
      },
      onNavigateToTab: (tabId: string) => {
        setActiveTab(tabId);
      },
    };

    switch (activeTab) {
      case 'planned':
        return <PlannedTab {...tabProps} />;
      case 'submission':
        return <SubmissionTab {...tabProps} />;
      case 'pre_work':
        return <PreWorkTab {...tabProps} />;
      case 'in_progress':
        return <InProgressTab {...tabProps} />;
      case 'post_work':
        return <PostWorkTab {...tabProps} />;
      case 'completed':
        return <CompleteTab {...tabProps} />;
      default:
        return (
          <Alert className="m-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('wfModalUnknownTabPrefix')}: {activeTab}. {t('wfModalUnknownTabSuffix')}
            </AlertDescription>
          </Alert>
        );
    }
  };

  // Loading state
  if (isLoadingWorkflow) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden" data-testid="workflow-modal-loading">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-6 w-48" />
              </div>
            </DialogTitle>
            <DialogDescription>
              {t('wfModalLoadingDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col space-y-6">
            {/* Tab Navigation Skeleton */}
            <div className="flex space-x-1 rounded-lg border bg-muted p-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-24" />
              ))}
            </div>
            
            {/* Content Skeleton */}
            <div className="flex-1 space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-32 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Error state
  if (workflowError) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" data-testid="workflow-modal-error">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('wfModalWorkflowErrorTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('wfModalUnableToLoad')}
            </DialogDescription>
          </DialogHeader>
          
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {workflowError.message || t('wfModalLoadFailedFallback')}
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  if (!workflowState) return null;

  const currentTabConfig = TAB_CONFIG[activeTab as keyof typeof TAB_CONFIG];
  const CurrentTabIcon = currentTabConfig?.icon || Settings;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" 
        data-testid="project-workflow-modal"
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <DialogTitle className="flex items-center gap-3">
              <CurrentTabIcon className="h-6 w-6 text-primary" />
              <div className="flex flex-col">
                <span className="text-lg font-semibold">
                  {project.title}
                </span>
                <span className="text-sm text-muted-foreground font-normal">
                  {t('wfModalProjectNumberPrefix')}{project.projectNumber}
                </span>
              </div>
            </DialogTitle>
            
            {/* Configuration Button */}
            <WorkflowSkipConfigDialog
              projectId={project.id}
              workflowState={workflowState}
              onUpdate={handleWorkflowUpdate}
              isQuickProject={project.isQuickProject}
              onDelete={() => {
                onOpenChange(false);
                if (onProjectDelete) {
                  onProjectDelete();
                }
              }}
            />
          </div>
          
          <DialogDescription className="flex items-center gap-2">
            <span>
              {currentTabConfig ? t(currentTabConfig.descriptionKey as keyof Translations) : t('wfModalManagingDescription')}
            </span>
            {workflowState.currentStatus !== 'completed' && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {t('wfModalStatusPrefix')}: {formatStatus(workflowState.currentStatus)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Main Content Area - Side by side layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Tab Navigation Sidebar */}
          <div className="w-80 flex-shrink-0 border-r overflow-y-auto">
            <WorkflowTabNavigation
              activeTab={activeTab}
              onTabChange={handleTabChange}
              workflowState={workflowState}
              tabConfig={Object.fromEntries(
                Object.entries(TAB_CONFIG).map(([key, cfg]) => [
                  key,
                  {
                    id: cfg.id,
                    icon: cfg.icon,
                    label: t(cfg.labelKey as keyof Translations),
                    description: t(cfg.descriptionKey as keyof Translations),
                  },
                ])
              )}
            />
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 pb-20"> {/* Add bottom padding for button */}
              {renderTabContent()}
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
