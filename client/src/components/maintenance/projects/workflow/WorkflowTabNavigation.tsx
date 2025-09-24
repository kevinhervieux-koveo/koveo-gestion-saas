import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUpdateSkipFlags, type ProjectWorkflowState } from '@/hooks/useProjectWorkflow';
import { cn, formatStatus } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  Lock,
  Settings,
  Users,
  Clock,
  Building2,
  CheckCircle,
} from 'lucide-react';

export interface WorkflowTabNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  workflowState: ProjectWorkflowState;
  tabConfig: Record<string, {
    id: string;
    label: string;
    icon: any;
    description: string;
  }>;
}

/**
 * Tab navigation component with skip checkboxes and progress indicators
 * Provides visual workflow progression and navigation controls
 */
export function WorkflowTabNavigation({
  activeTab,
  onTabChange,
  workflowState,
  tabConfig,
}: WorkflowTabNavigationProps) {
  const { mutate: updateSkipFlags, isPending: isUpdatingSkipFlags } = useUpdateSkipFlags();

  // Handle case where workflowState is not yet available
  if (!workflowState) {
    return (
      <div className="p-4" data-testid="workflow-tab-navigation">
        <div className="text-center text-muted-foreground">
          Loading workflow navigation...
        </div>
      </div>
    );
  }

  // Add fallback values to prevent undefined access
  const { 
    currentStatus = 'planned', 
    accessibleTabs = [], 
    skipFlags = {
      skipSubmission: false,
      skipPreWork: false,
      skipInProgress: false,
      skipPostWork: false,
    },
    project,
  } = workflowState || {};

  // Define all tabs in order with skip capability
  const allTabs = [
    { id: 'planned', canSkip: false },
    { id: 'submission', canSkip: true, skipFlag: 'skipSubmission' as const },
    { id: 'pre_work', canSkip: true, skipFlag: 'skipPreWork' as const },
    { id: 'in_progress', canSkip: true, skipFlag: 'skipInProgress' as const },
    { id: 'post_work', canSkip: true, skipFlag: 'skipPostWork' as const },
    { id: 'completed', canSkip: false },
  ];

  // Get tab status for styling
  const getTabStatus = (tabId: string) => {
    if (tabId === currentStatus) return 'current';
    
    const statusOrder = ['planned', 'submission', 'pre_work', 'in_progress', 'post_work', 'completed'];
    const tabIndex = statusOrder.indexOf(tabId);
    const currentIndex = statusOrder.indexOf(currentStatus);
    
    if (tabIndex < currentIndex) return 'completed';
    if (accessibleTabs && accessibleTabs.includes(tabId)) return 'accessible';
    return 'locked';
  };

  // Check if tab is skipped
  const isTabSkipped = (tabId: string) => {
    if (!skipFlags) return false;
    switch (tabId) {
      case 'submission': return skipFlags.skipSubmission;
      case 'pre_work': return skipFlags.skipPreWork;
      case 'in_progress': return skipFlags.skipInProgress;
      case 'post_work': return skipFlags.skipPostWork;
      default: return false;
    }
  };

  // Handle skip flag change
  const handleSkipChange = (tabId: string, skipFlag: keyof typeof skipFlags, checked: boolean) => {
    if (!project?.id) {
      console.warn('Cannot update skip flags: project ID not available');
      return;
    }
    updateSkipFlags({
      projectId: project.id,
      skipFlags: {
        [skipFlag]: checked,
      },
    });
  };

  // Get status icon
  const getStatusIcon = (tabId: string) => {
    const status = getTabStatus(tabId);
    const isSkipped = isTabSkipped(tabId);
    
    if (isSkipped) return <Circle className="h-4 w-4 text-muted-foreground" />;
    if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === 'current') return <CheckCircle className="h-4 w-4 text-blue-600" />;
    if (status === 'locked') return <Lock className="h-4 w-4 text-muted-foreground" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <TooltipProvider>
      <div className="p-4" data-testid="workflow-tab-navigation">
        {/* Progress Indicator */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Workflow Progress
            </span>
            <Badge variant="secondary">
              {currentStatus === 'completed' ? 'Complete' : 'In Progress'}
            </Badge>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center space-x-2">
            {allTabs.map((tab, index) => {
              const tabStatus = getTabStatus(tab.id);
              const isSkipped = isTabSkipped(tab.id);
              const isAccessible = accessibleTabs && accessibleTabs.includes(tab.id);
              const isClickable = isAccessible && !isSkipped;
              const TabIcon = tabConfig[tab.id]?.icon || Settings;
              
              const handleStepClick = () => {
                if (isClickable) {
                  onTabChange(tab.id);
                }
              };
              
              return (
                <div key={tab.id} className="flex items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        onClick={handleStepClick}
                        className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all',
                          // Base styling
                          tabStatus === 'completed' && 'bg-green-600 border-green-600 text-white',
                          tabStatus === 'current' && 'bg-blue-600 border-blue-600 text-white',
                          tabStatus === 'accessible' && 'border-blue-300 text-blue-600',
                          tabStatus === 'locked' && 'border-muted text-muted-foreground',
                          isSkipped && 'border-dashed bg-muted/50',
                          // Interactive styling
                          isClickable && 'cursor-pointer hover:scale-105',
                          isClickable && tabStatus === 'completed' && 'hover:bg-green-700 hover:border-green-700',
                          isClickable && tabStatus === 'current' && 'hover:bg-blue-700 hover:border-blue-700',
                          isClickable && tabStatus === 'accessible' && 'hover:bg-blue-50 hover:border-blue-400',
                          !isClickable && 'cursor-default'
                        )}
                        data-testid={`progress-step-${tab.id}`}
                        role={isClickable ? 'button' : 'presentation'}
                        tabIndex={isClickable ? 0 : -1}
                        onKeyDown={(e) => {
                          if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            handleStepClick();
                          }
                        }}
                      >
                        {isSkipped ? (
                          <Circle className="h-4 w-4" />
                        ) : (
                          <TabIcon className="h-4 w-4" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-center">
                        <div className="font-semibold">{tabConfig[tab.id]?.label || tab.id}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {isSkipped ? 'Skipped' : tabStatus}
                          {isClickable && (
                            <div className="text-xs text-blue-600 mt-1">
                              Click to navigate
                            </div>
                          )}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  
                  {index < allTabs.length - 1 && (
                    <div
                      className={cn(
                        'w-8 h-0.5 mx-1 transition-all',
                        tabStatus === 'completed' && 'bg-green-600',
                        tabStatus === 'current' && 'bg-blue-600',
                        'bg-muted'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Tab Navigation */}
        <div className="space-y-2">
          {allTabs.map((tab) => {
            const config = tabConfig[tab.id];
            const status = getTabStatus(tab.id);
            const isSkipped = isTabSkipped(tab.id);
            const isAccessible = accessibleTabs && accessibleTabs.includes(tab.id);
            const isActive = activeTab === tab.id;
            const TabIcon = config?.icon || Settings;

            if (!config) return null;

            return (
              <div key={tab.id} className="flex items-center gap-3">
                {/* Skip Checkbox */}
                {tab.canSkip && (
                  <div className="flex items-center space-x-2 min-w-[80px]">
                    <Checkbox
                      id={`skip-${tab.id}`}
                      checked={isSkipped}
                      disabled={isUpdatingSkipFlags || status === 'completed'}
                      onCheckedChange={(checked) => 
                        handleSkipChange(tab.id, tab.skipFlag!, checked as boolean)
                      }
                      data-testid={`checkbox-skip-${tab.id}`}
                    />
                    <label
                      htmlFor={`skip-${tab.id}`}
                      className="text-xs text-muted-foreground cursor-pointer select-none"
                    >
                      Skip
                    </label>
                  </div>
                )}
                
                {!tab.canSkip && <div className="w-[80px]" />} {/* Spacing for non-skippable tabs */}

                {/* Tab Button */}
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  disabled={!isAccessible || isSkipped}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'flex items-center gap-2 h-auto p-3 justify-start flex-1',
                    isSkipped && 'opacity-50',
                    status === 'completed' && !isActive && 'text-green-700 hover:text-green-800',
                    status === 'locked' && 'cursor-not-allowed opacity-40'
                  )}
                  data-testid={`tab-${tab.id}`}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {getStatusIcon(tab.id)}
                  </div>

                  {/* Tab Content */}
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <TabIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">{config.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground text-left truncate max-w-full">
                      {isSkipped ? 'This step will be skipped' : config.description}
                    </span>
                  </div>

                  {/* Status Badges */}
                  <div className="flex-shrink-0">
                    {status === 'current' && (
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    )}
                    {status === 'completed' && (
                      <Badge variant="default" className="text-xs bg-green-600">
                        Done
                      </Badge>
                    )}
                    {isSkipped && (
                      <Badge variant="outline" className="text-xs">
                        Skipped
                      </Badge>
                    )}
                  </div>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Workflow Actions Summary */}
        <Separator className="my-4" />
        <div className="text-xs text-muted-foreground text-center">
          {workflowState?.canAdvance && workflowState?.nextStatus && (
            <div>
              Next: <span className="font-medium capitalize">{formatStatus(workflowState.nextStatus)}</span>
            </div>
          )}
          {currentStatus === 'completed' && (
            <div className="text-green-600 font-medium">
              Project workflow completed
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}