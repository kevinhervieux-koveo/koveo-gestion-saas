import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { 
  useUpdateProjectDetails,
  type ProjectWorkflowState 
} from '@/hooks/useProjectWorkflow';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatStatus } from '@/lib/utils';
import { ReopenStepDialog } from './ReopenStepDialog';
import {
  CheckCircle2,
  Calendar,
  DollarSign,
  Clock,
  FileText,
  Star,
  TrendingUp,
  Target,
  Award,
  AlertTriangle,
  Info,
} from 'lucide-react';

export interface CompleteTabProps {
  project: MaintenanceProject;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
}

const completeTabSchema = z.object({
  completionSummary: z.string().min(10, 'Please provide a meaningful summary of at least 10 characters'),
  actualEndDate: z.string().optional(),
});

type CompleteTabData = z.infer<typeof completeTabSchema>;

/**
 * Complete tab component for project completion and summary
 * Displays project summary, final comments, and completion status
 */
export function CompleteTab({ project, workflowState, onUpdate }: CompleteTabProps) {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);

  // Defensive null check for project data
  if (!project) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Project data is missing. Unable to load the completion tab.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { mutate: updateProject, isPending: isUpdating } = useUpdateProjectDetails();

  const form = useForm<CompleteTabData>({
    resolver: zodResolver(completeTabSchema),
    defaultValues: {
      completionSummary: project.completionSummary || '',
      actualEndDate: project.actualEndDate ? format(new Date(project.actualEndDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    },
  });

  // Watch for form changes
  useEffect(() => {
    const subscription = form.watch(() => setHasChanges(true));
    return () => subscription.unsubscribe();
  }, [form]);


  const handleSave = async () => {
    const values = form.getValues();
    
    // Basic validation
    if (!values.completionSummary || values.completionSummary.trim().length < 10) {
      return;
    }

    updateProject({
      projectId: project.id,
      updates: {
        completionSummary: values.completionSummary,
        actualEndDate: values.actualEndDate,
      },
      status: 'completed',
    }, {
      onSuccess: () => {
        setHasChanges(false);
        onUpdate();
      },
    });
  };


  // Calculate project metrics
  const projectMetrics = {
    duration: project.actualStartDate && project.actualEndDate 
      ? Math.ceil((new Date(project.actualEndDate).getTime() - new Date(project.actualStartDate).getTime()) / (1000 * 60 * 60 * 24))
      : null,
    budgetUsed: project.actualCost ? parseFloat(project.actualCost) : 0,
    budgetTotal: project.totalBudget ? parseFloat(project.totalBudget) : 0,
    isOverBudget: project.actualCost && project.totalBudget 
      ? parseFloat(project.actualCost) > parseFloat(project.totalBudget)
      : false,
  };

  const budgetUtilization = projectMetrics.budgetTotal > 0 
    ? Math.round((projectMetrics.budgetUsed / projectMetrics.budgetTotal) * 100)
    : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const isProjectComplete = workflowState.currentStatus === 'completed';

  return (
    <div className="space-y-6" data-testid="complete-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Project Completion</h3>
            {isProjectComplete && (
              <Badge className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Final project summary and completion details
          </p>
        </div>
        
        {hasChanges && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSave} 
            disabled={isUpdating || workflowState.currentStatus === 'completed'}
            data-testid="button-save-changes"
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {/* Main Content - Completion Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Completion Summary
              </CardTitle>
              <CardDescription>
                Document the final outcome, lessons learned, and key accomplishments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form className="space-y-4">
                  <FormField
                    control={form.control}
                    name="completionSummary"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Provide a comprehensive summary of the completed work, including:
• What was accomplished
• Any challenges overcome
• Quality of work delivered
• Impact on the building/residents
• Lessons learned for future projects
• Recommendations for maintenance"
                            className="min-h-[200px]"
                            {...field}
                            data-testid="textarea-completion-summary"
                          />
                        </FormControl>
                        <FormDescription>
                          This summary will be part of the permanent project record
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Project Timeline Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Project Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Planned Start</div>
                      <div className="text-base">
                        {project.planningStartDate 
                          ? format(new Date(project.planningStartDate), 'MMM d, yyyy')
                          : 'Not specified'
                        }
                      </div>
                    </div>
                    <div>
                      <FormField
                        control={form.control}
                        name="actualEndDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-muted-foreground">Actual End</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                data-testid="input-actual-end-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {projectMetrics.duration && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Project duration: <span className="font-medium">{projectMetrics.duration} days</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Project Metrics */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />
                Budget Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Budget</div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(projectMetrics.budgetTotal)}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Actual Cost</div>
                  <div className={`text-lg font-semibold ${projectMetrics.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(projectMetrics.budgetUsed)}
                  </div>
                </div>

                {projectMetrics.budgetTotal > 0 && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Budget Utilization</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          budgetUtilization > 100 ? 'bg-red-600' : 
                          budgetUtilization > 90 ? 'bg-yellow-600' : 'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
                      />
                    </div>
                    <div className={`text-sm mt-1 ${
                      budgetUtilization > 100 ? 'text-red-600' : 
                      budgetUtilization > 90 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {budgetUtilization}% utilized
                    </div>

                    {projectMetrics.isOverBudget && (
                      <div className="flex items-center gap-1 text-red-600 text-sm mt-2">
                        <AlertTriangle className="h-3 w-3" />
                        Over budget by {formatCurrency(projectMetrics.budgetUsed - projectMetrics.budgetTotal)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" />
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Project Number</div>
                  <div className="font-medium">{project.projectNumber}</div>
                </div>
                
                <div>
                  <div className="text-muted-foreground">Project Type</div>
                  <div className="capitalize font-medium">
                    {formatStatus(project.type, 'Not specified')}
                  </div>
                </div>
                
                <div>
                  <div className="text-muted-foreground">Priority</div>
                  <Badge variant={
                    project.priority === 'critical' ? 'destructive' :
                    project.priority === 'high' ? 'default' :
                    project.priority === 'medium' ? 'secondary' : 'outline'
                  }>
                    {project.priority}
                  </Badge>
                </div>

                <div>
                  <div className="text-muted-foreground">Origin</div>
                  <div className="flex items-center gap-1">
                    {project.origin === 'auto' ? (
                      <>
                        <TrendingUp className="h-3 w-3" />
                        <span>Auto-generated</span>
                      </>
                    ) : (
                      <>
                        <FileText className="h-3 w-3" />
                        <span>Manual</span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-muted-foreground">Created</div>
                  <div>{format(new Date(project.createdAt), 'MMM d, yyyy')}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-4 w-4" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-6">
                <div className="text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
                  <div className="text-lg font-semibold text-green-600">
                    Project Complete
                  </div>
                  <div className="text-sm text-muted-foreground">
                    All workflow stages completed
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="text-sm text-muted-foreground">
          Project has been completed successfully
        </div>
        
        <ReopenStepDialog
          projectId={project.id}
          currentStatus={workflowState.currentStatus}
          onSuccess={onUpdate}
          disabled={!workflowState.currentStatus || workflowState.currentStatus !== 'completed'}
          triggerText="Reopen Project"
        />
      </div>

    </div>
  );
}