import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUpdateSkipFlags, type ProjectWorkflowState } from '@/hooks/useProjectWorkflow';
import { cn, formatStatus } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
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
  const { t } = useLanguage();

  // Handle case where workflowState is not yet available
  if (!workflowState) {
    return (
      <div className="p-4" data-testid="workflow-tab-navigation">
        <div className="text-center text-muted-foreground">
          {t('wfNavLoading')}
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
    <div className="p-4" data-testid="workflow-tab-navigation">
      {/* Simple Vertical Progress */}
      <div className="mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t('wfNavWorkflowProgress')}
        </span>
        <Badge variant="secondary" className="ml-2 text-xs">
          {currentStatus === 'completed' ? t('wfNavBadgeComplete') : t('wfNavBadgeInProgress')}
        </Badge>
      </div>
      
      {/* Clean Vertical Progress Steps */}
      <div className="space-y-3">
        {allTabs.filter(tab => !isTabSkipped(tab.id)).map((tab, index) => {
          const config = tabConfig[tab.id];
          const status = getTabStatus(tab.id);
          const isSkipped = isTabSkipped(tab.id);
          const isAccessible = accessibleTabs && accessibleTabs.includes(tab.id);
          const isActive = activeTab === tab.id;
          const isClickable = isAccessible && !isSkipped;
          const TabIcon = config?.icon || Settings;

          if (!config) return null;

          const handleStepClick = () => {
            if (isClickable) {
              onTabChange(tab.id);
            }
          };

          return (
            <div key={tab.id} className="flex items-center gap-3 relative">
              {/* Progress Step */}
              <div
                onClick={handleStepClick}
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all flex-shrink-0',
                  status === 'completed' && 'bg-green-600 border-green-600 text-white',
                  status === 'current' && 'bg-blue-600 border-blue-600 text-white',
                  status === 'accessible' && 'border-blue-300 text-blue-600',
                  status === 'locked' && 'border-muted text-muted-foreground',
                  isSkipped && 'border-dashed bg-muted/50',
                  isClickable && 'cursor-pointer hover:scale-105',
                  !isClickable && 'cursor-default'
                )}
                data-testid={`progress-step-${tab.id}`}
              >
                {isSkipped ? (
                  <Circle className="h-3 w-3" />
                ) : (
                  <TabIcon className="h-3 w-3" />
                )}
              </div>

              {/* Step Name */}
              <div
                onClick={handleStepClick}
                className={cn(
                  'flex items-center gap-2 flex-1 transition-colors',
                  isClickable && 'cursor-pointer hover:text-primary',
                  status === 'current' && 'font-medium text-blue-600',
                  status === 'completed' && 'text-green-600',
                  isSkipped && 'text-muted-foreground line-through opacity-60',
                  !isClickable && 'cursor-default'
                )}
              >
                <span className="text-sm">{config.label}</span>
              </div>

              {/* Status Badge */}
              {status === 'current' && (
                <Badge variant="secondary" className="text-xs">
                  {t('wfNavCurrent')}
                </Badge>
              )}

              {/* Connection Line */}
              {index < allTabs.filter(tab => !isTabSkipped(tab.id)).length - 1 && (
                <div className="absolute left-[14px] top-7 z-0">
                  <div
                    className={cn(
                      'w-0.5 h-6 transition-all',
                      status === 'completed' && 'bg-green-600',
                      status === 'current' && 'bg-blue-600',
                      'bg-muted'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}