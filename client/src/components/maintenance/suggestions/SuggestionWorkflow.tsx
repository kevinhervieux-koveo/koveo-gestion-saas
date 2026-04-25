import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { format, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBuildingContext } from '@/hooks/use-building-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  FileText,
  DollarSign,
  Building,
  ArrowRight,
  ArrowDown,
  AlertCircle,
  Play,
  Pause,
  SkipForward,
  Users,
  Calendar,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Eye,
  UserCheck,
  Zap,
} from 'lucide-react';
import { SuggestionWorkflowProps, WorkflowStep, ApprovalGate } from './types';
import { useLanguage } from '@/hooks/use-language';

// Workflow step definitions
const defaultWorkflowSteps: WorkflowStep[] = [
  {
    id: 'review',
    name: 'Initial Review',
    status: 'pending',
    requiredRole: 'maintenance',
    estimatedDuration: 2,
    dependencies: [],
    approvalRequired: false,
  },
  {
    id: 'evaluate',
    name: 'Technical Evaluation',
    status: 'pending',
    requiredRole: 'maintenance',
    estimatedDuration: 4,
    dependencies: ['review'],
    approvalRequired: false,
  },
  {
    id: 'cost_analysis',
    name: 'Cost Analysis',
    status: 'pending',
    requiredRole: 'manager',
    estimatedDuration: 3,
    dependencies: ['evaluate'],
    approvalRequired: false,
  },
  {
    id: 'approve',
    name: 'Management Approval',
    status: 'pending',
    requiredRole: 'manager',
    estimatedDuration: 1,
    dependencies: ['cost_analysis'],
    approvalRequired: true,
  },
  {
    id: 'execute',
    name: 'Execute/Schedule',
    status: 'pending',
    requiredRole: 'maintenance',
    estimatedDuration: 2,
    dependencies: ['approve'],
    approvalRequired: false,
  },
];

// Approval gates configuration
const approvalGates: ApprovalGate[] = [
  {
    id: 'cost_threshold',
    name: 'High Cost Approval',
    condition: 'cost_threshold',
    threshold: 10000,
    requiredRole: 'admin',
    description: 'Requires admin approval for costs over $10,000',
  },
  {
    id: 'critical_priority',
    name: 'Critical Priority Gate',
    condition: 'critical_priority',
    requiredRole: 'manager',
    description: 'Critical priority suggestions require manager approval',
  },
  {
    id: 'multiple_elements',
    name: 'Multi-Element Impact',
    condition: 'multiple_elements',
    requiredRole: 'manager',
    description: 'Suggestions affecting multiple elements need review',
  },
];

/**
 * SuggestionWorkflow component for managing suggestion processing workflow
 * Provides step-by-step workflow with approval controls and progress tracking
 */
export function SuggestionWorkflow({
  suggestion,
  onStatusChange,
  onCreateProject,
  onAssignVendor,
  showApprovalGates = true,
  className,
}: SuggestionWorkflowProps) {
  const { t } = useLanguage();
  const { hasPermission } = useBuildingContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<ApprovalGate | null>(null);
  const [selectedVendor, setSelectedVendor] = useState('');

  // Fetch workflow data
  const {
    data: workflowResponse,
    isLoading: isLoadingWorkflow,
  } = useQuery({
    queryKey: ['/api/maintenance/suggestions', suggestion.id, 'workflow'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/suggestions/${suggestion.id}/workflow`);
      return await response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch available vendors
  const {
    data: vendorsResponse,
  } = useQuery({
    queryKey: ['/api/maintenance/vendors'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/maintenance/vendors');
      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const workflowSteps: WorkflowStep[] = workflowResponse?.steps || defaultWorkflowSteps;
  const vendors = vendorsResponse?.vendors || [];

  // Determine current workflow step
  const currentStep = useMemo(() => {
    return workflowSteps.find(step => step.status === 'in_progress') ||
           workflowSteps.find(step => step.status === 'pending');
  }, [workflowSteps]);

  // Calculate workflow progress
  const workflowProgress = useMemo(() => {
    const completedSteps = workflowSteps.filter(step => step.status === 'completed').length;
    return (completedSteps / workflowSteps.length) * 100;
  }, [workflowSteps]);

  // Check if approval gates are triggered
  const triggeredGates = useMemo(() => {
    if (!showApprovalGates) return [];

    return approvalGates.filter(gate => {
      switch (gate.condition) {
        case 'cost_threshold':
          return suggestion.costEstimate && suggestion.costEstimate > (gate.threshold || 0);
        case 'critical_priority':
          return suggestion.priority === 'critical';
        case 'multiple_elements':
          // This would need additional data about related elements
          return false;
        default:
          return false;
      }
    });
  }, [suggestion, showApprovalGates]);

  // Step transition mutation
  const transitionMutation = useCreateUpdateMutation<unknown, { stepId: string; action: 'start' | 'complete' | 'skip'; notes?: string }>({
    mutationFn: async (data) => {
      const response = await apiRequest('PATCH', `/api/maintenance/suggestions/${suggestion.id}/workflow`, {
        stepId: data.stepId,
        action: data.action,
        notes: data.notes,
      });
      return response.json();
    },
    successTitle: 'Workflow Updated',
    successMessage: 'The workflow step has been updated successfully.',
    errorTitle: 'Error',
    errorMessage: 'Failed to update workflow step. Please try again.',
    queryKeysToInvalidate: [
      ['/api/maintenance/suggestions', suggestion.id, 'workflow'],
      ['/api/maintenance/suggestions'],
    ],
    onSuccessCallback: () => {
      setNotes('');
    },
  });

  // Approval mutation
  const approvalMutation = useCreateUpdateMutation<unknown, { gateId: string; approved: boolean; notes?: string }>({
    mutationFn: async (data) => {
      const response = await apiRequest('PATCH', `/api/maintenance/suggestions/${suggestion.id}/approval`, {
        gateId: data.gateId,
        approved: data.approved,
        notes: data.notes,
      });
      return response.json();
    },
    successTitle: 'Approval Processed',
    successMessage: 'The approval decision has been recorded.',
    errorTitle: 'Error',
    errorMessage: 'Failed to process approval. Please try again.',
    queryKeysToInvalidate: [['/api/maintenance/suggestions', suggestion.id, 'workflow']],
    onSuccessCallback: () => {
      setShowApprovalDialog(false);
      setPendingApproval(null);
    },
  });

  // Vendor assignment mutation
  const assignVendorMutation = useCreateUpdateMutation<unknown, string>({
    mutationFn: async (vendorId: string) => {
      const response = await apiRequest('PATCH', `/api/maintenance/suggestions/${suggestion.id}/assign`, {
        vendorId,
      });
      return response.json();
    },
    successTitle: 'Vendor Assigned',
    successMessage: 'The vendor has been assigned to this suggestion.',
    errorTitle: 'Error',
    errorMessage: 'Failed to assign vendor. Please try again.',
    queryKeysToInvalidate: [['/api/maintenance/suggestions']],
    onSuccessCallback: () => {
      onAssignVendor?.(suggestion, selectedVendor);
    },
  });

  // Handle step actions
  const handleStepAction = (stepId: string, action: 'start' | 'complete' | 'skip') => {
    transitionMutation.mutate({ stepId, action, notes });
  };

  // Handle approval
  const handleApproval = (gate: ApprovalGate) => {
    setPendingApproval(gate);
    setShowApprovalDialog(true);
  };

  const processApproval = (approved: boolean) => {
    if (pendingApproval) {
      approvalMutation.mutate({
        gateId: pendingApproval.id,
        approved,
        notes,
      });
    }
  };

  // Check if user can perform action on step
  const canPerformStepAction = (step: WorkflowStep) => {
    // Basic permission check - in real implementation, map role to specific permission
    const hasRole = hasPermission('canEditMaintenance');
    const dependenciesMet = step.dependencies?.every(depId => 
      workflowSteps.find(s => s.id === depId)?.status === 'completed'
    );
    return hasRole && dependenciesMet;
  };

  // Get step status icon
  const getStepIcon = (step: WorkflowStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'skipped':
        return <SkipForward className="h-5 w-5 text-gray-400" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  return (
    <TooltipProvider>
      <Card className={cn("w-full", className)} data-testid="suggestion-workflow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="h-5 w-5" />
              Suggestion Workflow
            </CardTitle>
            <Badge variant="outline" className="text-sm">
              {Math.round(workflowProgress)}% Complete
            </Badge>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={workflowProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{workflowSteps.filter(s => s.status === 'completed').length}/{workflowSteps.length} steps</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Approval Gates */}
          {triggeredGates.length > 0 && (
            <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-800">Approval Required</span>
              </div>
              
              <div className="space-y-2">
                {triggeredGates.map(gate => (
                  <div key={gate.id} className="flex items-center justify-between bg-white rounded p-2">
                    <div>
                      <div className="font-medium text-sm">{gate.name}</div>
                      <div className="text-xs text-muted-foreground">{gate.description}</div>
                    </div>
                    {hasPermission('canEditMaintenance') && (
                      <Button
                        size="sm"
                        onClick={() => handleApproval(gate)}
                        data-testid={`approve-gate-${gate.id}`}
                      >
                        <UserCheck className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow Steps */}
          <div className="space-y-4">
            {workflowSteps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-4">
                {/* Step Icon & Line */}
                <div className="flex flex-col items-center">
                  <div className="flex-shrink-0">
                    {getStepIcon(step)}
                  </div>
                  {index < workflowSteps.length - 1 && (
                    <div className={cn(
                      "w-px h-8 mt-2",
                      step.status === 'completed' ? "bg-green-200" : "bg-gray-200"
                    )} />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-sm">{step.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="capitalize">{step.requiredRole} role required</span>
                        {step.estimatedDuration && (
                          <>
                            <Clock className="h-3 w-3 ml-2" />
                            <span>{step.estimatedDuration}h estimated</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Step Actions */}
                    <div className="flex items-center gap-1">
                      {step.status === 'pending' && canPerformStepAction(step) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStepAction(step.id, 'start')}
                              disabled={transitionMutation.isPending}
                              data-testid={`start-step-${step.id}`}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Start this step</TooltipContent>
                        </Tooltip>
                      )}

                      {step.status === 'in_progress' && canPerformStepAction(step) && (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                onClick={() => handleStepAction(step.id, 'complete')}
                                disabled={transitionMutation.isPending}
                                data-testid={`complete-step-${step.id}`}
                              >
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Complete this step</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStepAction(step.id, 'skip')}
                                disabled={transitionMutation.isPending}
                                data-testid={`skip-step-${step.id}`}
                              >
                                <SkipForward className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Skip this step</TooltipContent>
                          </Tooltip>
                        </>
                      )}

                      {step.status === 'completed' && step.completedAt && (
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(step.completedAt), 'MMM d, HH:mm')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step Notes */}
                  {step.notes && (
                    <div className="bg-gray-50 rounded p-2 text-xs">
                      <MessageSquare className="h-3 w-3 inline mr-1" />
                      {step.notes}
                    </div>
                  )}

                  {/* Assigned User */}
                  {step.assignedTo && (
                    <div className="flex items-center gap-2 mt-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={`/api/users/${step.assignedTo}/avatar`} />
                        <AvatarFallback className="text-xs">
                          {step.assignedTo.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        Assigned to user
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Actions Section */}
          <Separator />
          
          <div className="space-y-4">
            {/* Notes Input */}
            {currentStep && canPerformStepAction(currentStep) && (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Add Notes (Optional)
                </Label>
                <Textarea
                  placeholder="Add notes about this workflow step..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  data-testid="workflow-notes-input"
                />
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {hasPermission('canEditMaintenance') && suggestion.status === 'pending' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCreateProject?.(suggestion)}
                    data-testid="create-project-workflow"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Create Project
                  </Button>

                  {vendors.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors.map((vendor: any) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button
                        size="sm"
                        disabled={!selectedVendor}
                        onClick={() => assignVendorMutation.mutate(selectedVendor)}
                        data-testid="assign-vendor-workflow"
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Assign
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <AlertDialogContent data-testid="approval-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingApproval?.name}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingApproval?.description}
              {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
              <br /><br />
              {t('pleaseReviewTheSuggestionDetailsAnd')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label className="text-sm font-medium mb-2 block">
              Approval Notes (Optional)
            </Label>
            <Textarea
              placeholder="Add notes about your decision..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              data-testid="approval-notes-input"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowApprovalDialog(false);
                setPendingApproval(null);
                setNotes('');
              }}
              data-testid="cancel-approval"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => processApproval(false)}
              className="bg-red-600 hover:bg-red-700"
              disabled={approvalMutation.isPending}
              data-testid="reject-approval"
            >
              <ThumbsDown className="h-4 w-4 mr-1" />
              Reject
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => processApproval(true)}
              disabled={approvalMutation.isPending}
              data-testid="approve-approval"
            >
              <ThumbsUp className="h-4 w-4 mr-1" />
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}