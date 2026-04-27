import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { extractFkViolation, formatFkViolationDescription } from '@/lib/fk-violation';
import { MaintenanceProject, SubmissionVendor } from '@shared/schemas/maintenance';

// Types for workflow management
export interface ProjectWorkflowState {
  project: MaintenanceProject;
  currentStatus: string;
  nextStatus: string | null;
  canAdvance: boolean;
  skipFlags: {
    skipSubmission: boolean;
    skipPreWork: boolean;
    skipInProgress: boolean;
    skipPostWork: boolean;
  };
  accessibleTabs: string[];
  firstIncompleteTab: string;
}

export interface WorkflowTask {
  id: string;
  projectId: string;
  phase: 'pre_work' | 'in_progress' | 'post_work';
  taskName: string;
  description?: string;
  cost?: number;
  isCompleted: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}


export interface ProjectNotification {
  id: string;
  projectId: string;
  messageText: string;
  timingType: 'one_day_before' | 'three_days_before' | 'one_week_before' | 'custom';
  customDaysBefore?: number;
  isSent: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extends the base SubmissionVendor DB row with the joined vendor object that
 * the API includes in every response. The base Drizzle select type only covers
 * scalar columns; the relation is resolved server-side and returned alongside.
 */
export type SubmissionVendorWithRelation = SubmissionVendor & {
  vendor: { id: string; name: string } | null;
};

/**
 * Shape sent to the API for creating or updating a submission vendor.
 * Uses `number[]` for `paymentPlanCosts` (matching the Zod insert schema)
 * rather than the DB select type's `string[]` (Drizzle decimal columns).
 */
type SubmissionVendorPayload = Omit<
  SubmissionVendor,
  'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'paymentPlanCosts' | 'price'
> & { paymentPlanCosts?: number[]; price?: string | null };

type SubmissionVendorUpdatePayload = Partial<SubmissionVendorPayload>;

// Update types for specific status updates
export interface PlannedTabUpdate {
  planningDescription?: string;
  planningStartDate?: string;
  estimatedCost?: number;
  financialYear?: number;
  type?: string;
}

export interface InProgressTabUpdate {
  workStartDate?: string;
  // workflow tasks will be handled separately
}

export interface CompleteTabUpdate {
  completionSummary?: string;
  actualEndDate?: string;
}

export interface SkipFlagsUpdate {
  skipSubmission?: boolean;
  skipPreWork?: boolean;
  skipInProgress?: boolean;
  skipPostWork?: boolean;
}

/**
 * Get project workflow state including current status, skip flags, and navigation info
 */
export function useProjectWorkflowState(projectId: string) {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['/api/maintenance/projects', projectId, 'workflow'],
    queryFn: async (): Promise<ProjectWorkflowState> => {
      // Fetching workflow state for project
      
      if (!projectId) throw new Error('Project ID is required');
      
      const url = `/api/maintenance/projects/${projectId}/workflow`;
      // Making workflow state request
      
      const response = await apiRequest('GET', url);
      // Processing workflow response
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch workflow state' }));
        console.error('[WORKFLOW HOOK] Error response:', error);
        throw new Error(error.message || 'Failed to fetch workflow state');
      }
      
      const data = await response.json();
      // Workflow state received successfully
      
      // Check if we need to extract data from {success: true, data: {...}} format
      if (data.success && data.data) {
        // Extracting workflow data from response wrapper
        return data.data;
      }
      
      return data;
    },
    enabled: !!projectId,
    staleTime: 30000, // 30 seconds
    retry: (failureCount, error) => {
      if (error.message?.includes('not found')) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Mutation to mark current status as complete and advance to next status
 */
export function useMarkStatusComplete() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ projectId, currentStatus }: { projectId: string; currentStatus: string }) => {
      const response = await apiRequest('POST', `/api/maintenance/projects/${projectId}/advance-status`, {
        currentStatus,
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to advance status' }));
        throw new Error(error.message || 'Failed to advance status');
      }
      
      return await response.json();
    },
    onSuccess: (data, variables) => {
      const { projectId } = variables;
      
      // Invalidate workflow state
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', projectId, 'workflow'] 
      });
      
      // Invalidate main project data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', projectId] 
      });
      
      // Invalidate projects list
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/buildings'] 
      });

      toast({
        title: 'Status Updated',
        description: `Project status has been advanced to ${data.newStatus}`,
      });
    },
    onError: (error: Error) => {
      console.error('Failed to advance project status:', error);
      toast({
        title: 'Status Update Failed',
        description: error.message || 'Failed to advance project status',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Get allowed reopen targets for a project
 */
export function useReopenTargets(projectId: string) {
  return useQuery({
    queryKey: ['/api/maintenance/projects', projectId, 'reopen-targets'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/projects/${projectId}/reopen-targets`);
      if (!response.ok) {
        throw new Error('Failed to fetch reopen targets');
      }
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!projectId,
  });
}

/**
 * Mutation to reopen/revert workflow step to a specific target status
 */
export function useReopenWorkflowStep() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ projectId, targetStatus, reason }: { 
      projectId: string; 
      targetStatus: string; 
      reason?: string;
    }) => {
      const response = await apiRequest('POST', `/api/maintenance/projects/${projectId}/reopen-step`, {
        targetStatus,
        reason,
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to reopen workflow step' }));
        throw new Error(error.message || 'Failed to reopen workflow step');
      }
      
      return await response.json();
    },
    onSuccess: (data, variables) => {
      const { projectId } = variables;
      
      // Invalidate workflow state
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', projectId, 'workflow'] 
      });
      
      // Invalidate main project data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', projectId] 
      });
      
      // Invalidate projects list
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/buildings'] 
      });

      toast({
        title: 'Step Reopened',
        description: `Project has been reopened to ${data.newStatus} step`,
      });
    },
    onError: (error: Error) => {
      console.error('Failed to reopen workflow step:', error);
      toast({
        title: 'Reopen Failed',
        description: error.message || 'Failed to reopen workflow step',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Mutation to update skip flags for workflow steps
 */
export function useUpdateSkipFlags() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ projectId, skipFlags }: { projectId: string; skipFlags: SkipFlagsUpdate }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${projectId}/skip-flags`, skipFlags);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to update skip flags' }));
        throw new Error(error.message || 'Failed to update skip flags');
      }
      
      return await response.json();
    },
    onSuccess: (data, variables) => {
      const { projectId } = variables;
      
      // Invalidate workflow state to refresh navigation
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', projectId, 'workflow'] 
      });
      
      // Invalidate main project data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', projectId] 
      });

      toast({
        title: 'Skip Settings Updated',
        description: 'Workflow skip settings have been updated',
      });
    },
    onError: (error: Error) => {
      console.error('Failed to update skip flags:', error);
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update skip settings',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Mutation to update project details for specific workflow statuses
 */
export function useUpdateProjectDetails() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      updates, 
      status 
    }: { 
      projectId: string; 
      updates: PlannedTabUpdate | InProgressTabUpdate | CompleteTabUpdate; 
      status: string;
    }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${projectId}`, {
        ...updates,
        status, // Include current status for validation
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to update project details' }));
        throw new Error(error.message || 'Failed to update project details');
      }
      
      return await response.json();
    },
    onSuccess: (data, variables) => {
      const { projectId } = variables;
      
      // Invalidate workflow state
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', projectId, 'workflow'] 
      });
      
      // Invalidate main project data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', projectId] 
      });

      // Task #1275: financialYear changes affect budget forecasts/dashboards/
      // reports, which compute on demand from maintenance_projects.financial_year.
      // Invalidate dependent caches so charts refetch after a FY edit.
      queryClient.invalidateQueries({ queryKey: ['/api/budgets/forecast'] });
      queryClient.invalidateQueries({ queryKey: ['budgetForecast'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/projects'] });

      toast({
        title: 'Project Updated',
        description: 'Project details have been updated successfully',
      });
    },
    onError: (error: Error) => {
      console.error('Failed to update project details:', error);
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update project details',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to fetch workflow tasks for a specific project and phase
 */
export function useWorkflowTasks(projectId: string, phase?: 'pre_work' | 'in_progress' | 'post_work') {
  return useQuery({
    queryKey: ['/api/maintenance/projects', projectId, 'tasks', phase],
    queryFn: async (): Promise<WorkflowTask[]> => {
      if (!projectId) throw new Error('Project ID is required');
      
      const url = phase 
        ? `/api/maintenance/projects/${projectId}/tasks?phase=${phase}`
        : `/api/maintenance/projects/${projectId}/tasks`;
        
      const response = await apiRequest('GET', url);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch workflow tasks' }));
        throw new Error(error.message || 'Failed to fetch workflow tasks');
      }
      
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!projectId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Mutation to create, update, or delete workflow tasks
 */
export function useWorkflowTaskMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Helper: extract a human-readable error message from the thrown error
  const extractErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const parseErrorResponse = async (response: Response, fallback: string): Promise<string> => {
    try {
      const body = await response.json();
      return body?.message || body?.error || fallback;
    } catch {
      return fallback;
    }
  };

  const createTask = useMutation({
    mutationFn: async ({ 
      projectId, 
      taskData 
    }: { 
      projectId: string; 
      taskData: Omit<WorkflowTask, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>;
    }) => {
      const response = await apiRequest('POST', `/api/maintenance/projects/${projectId}/tasks`, taskData);
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response, 'Failed to create task'));
      }
      return await response.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate both the prefix key and the phase-specific key so the task
      // list refreshes immediately regardless of how the consuming query was
      // structured. The prefix match covers all phases; the explicit phase
      // key guarantees the exact key is invalidated even if matching
      // semantics change.
      queryClient.invalidateQueries({
        queryKey: ['/api/maintenance/projects', variables.projectId, 'tasks'],
      });
      if (variables.taskData?.phase) {
        queryClient.invalidateQueries({
          queryKey: ['/api/maintenance/projects', variables.projectId, 'tasks', variables.taskData.phase],
        });
      }
      toast({
        title: 'Task Created',
        description: 'Workflow task has been created successfully',
      });
    },
    onError: async (error) => {
      toast({
        title: 'Failed to create task',
        description: await extractErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ 
      projectId, 
      taskId, 
      updates 
    }: { 
      projectId: string; 
      taskId: string; 
      updates: Partial<WorkflowTask>;
    }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/tasks/${taskId}`, updates);
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response, 'Failed to update task'));
      }
      return await response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', variables.projectId, 'tasks'] 
      });
    },
    onError: async (error) => {
      toast({
        title: 'Failed to update task',
        description: await extractErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async ({ projectId: _projectId, taskId }: { projectId: string; taskId: string }) => {
      const response = await apiRequest('DELETE', `/api/maintenance/tasks/${taskId}`);
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response, 'Failed to delete task'));
      }
      return await response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', variables.projectId, 'tasks'] 
      });
      toast({
        title: 'Task Deleted',
        description: 'Workflow task has been deleted successfully',
      });
    },
    onError: async (error) => {
      toast({
        title: 'Failed to delete task',
        description: await extractErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    },
  });

  return { createTask, updateTask, deleteTask };
}

/**
 * Hook to fetch submission vendors for a project
 */
export function useSubmissionVendors(projectId: string) {
  return useQuery({
    queryKey: ['/api/maintenance/projects', projectId, 'submission-vendors'],
    queryFn: async (): Promise<SubmissionVendorWithRelation[]> => {
      if (!projectId) throw new Error('Project ID is required');
      
      const response = await apiRequest('GET', `/api/maintenance/projects/${projectId}/submission-vendors`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch submission vendors' }));
        throw new Error(error.message || 'Failed to fetch submission vendors');
      }
      
      const data = await response.json();
      return data.vendors || [];
    },
    enabled: !!projectId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Mutations for managing submission vendors with payment plans
 */
export function useSubmissionVendorMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createSubmissionVendor = useMutation({
    mutationFn: async ({ 
      projectId, 
      vendorData 
    }: { 
      projectId: string; 
      vendorData: SubmissionVendorPayload;
    }) => {
      const response = await apiRequest('POST', `/api/maintenance/projects/${projectId}/submission-vendors`, vendorData);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to create submission vendor' }));
        throw new Error(error.message || 'Failed to create submission vendor');
      }
      return await response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', variables.projectId, 'submission-vendors'] 
      });
      toast({
        title: 'Vendor Submission Added',
        description: 'Vendor submission with payment plan has been added successfully',
      });
    },
    onError: (error: Error) => {
      console.error('Failed to create submission vendor:', error);
      toast({
        title: 'Submission Failed',
        description: error.message || 'Failed to add vendor submission',
        variant: 'destructive',
      });
    },
  });

  const updateSubmissionVendor = useMutation({
    mutationFn: async ({ 
      projectId, 
      vendorId, 
      updates 
    }: { 
      projectId: string; 
      vendorId: string; 
      updates: SubmissionVendorUpdatePayload;
    }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${projectId}/submission-vendors/${vendorId}`, updates);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to update submission vendor' }));
        throw new Error(error.message || 'Failed to update submission vendor');
      }
      return await response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', variables.projectId, 'submission-vendors'] 
      });
      toast({
        title: 'Vendor Submission Updated',
        description: 'Vendor submission and payment plan have been updated successfully',
      });
    },
    onError: (error: Error) => {
      console.error('Failed to update submission vendor:', error);
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update vendor submission',
        variant: 'destructive',
      });
    },
  });

  const selectSubmissionVendor = useMutation({
    mutationFn: async ({ 
      projectId, 
      vendorId, 
      isSelected 
    }: { 
      projectId: string; 
      vendorId: string; 
      isSelected: boolean;
    }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${projectId}/submission-vendors/${vendorId}`, {
        isSelected,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to update vendor selection' }));
        throw new Error(error.message || 'Failed to update vendor selection');
      }
      return await response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', variables.projectId, 'submission-vendors'] 
      });
      toast({
        title: variables.isSelected ? 'Vendor Selected' : 'Vendor Deselected',
        description: `Vendor has been ${variables.isSelected ? 'selected' : 'deselected'} for this project`,
      });
    },
    onError: (error: Error) => {
      console.error('Failed to update vendor selection:', error);
      toast({
        title: 'Selection Failed',
        description: error.message || 'Failed to update vendor selection',
        variant: 'destructive',
      });
    },
  });

  const updatePreferredStatus = useMutation({
    mutationFn: async ({ 
      projectId, 
      vendorId, 
      preferred 
    }: { 
      projectId: string; 
      vendorId: string; 
      preferred: boolean;
    }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${projectId}/vendors/${vendorId}/preferred`, {
        preferred,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to update preferred status' }));
        throw new Error(error.message || 'Failed to update preferred status');
      }
      return await response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', variables.projectId, 'submission-vendors'] 
      });
      toast({
        title: variables.preferred ? 'Marked as Preferred' : 'Unmarked as Preferred',
        description: `Vendor has been ${variables.preferred ? 'marked as your preferred choice' : 'unmarked as preferred'}`,
      });
    },
    onError: (error: Error) => {
      console.error('Failed to update preferred status:', error);
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update preferred status',
        variant: 'destructive',
      });
    },
  });

  const deleteSubmissionVendor = useMutation({
    mutationFn: async ({ 
      projectId, 
      vendorId 
    }: { 
      projectId: string; 
      vendorId: string; 
    }) => {
      const response = await apiRequest('DELETE', `/api/maintenance/projects/${projectId}/submission-vendors/${vendorId}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to delete submission vendor' }));
        throw new Error(error.message || 'Failed to delete submission vendor');
      }
      
      // Handle 204 No Content responses (no body to parse)
      if (response.status === 204) {
        return undefined;
      }
      
      // Only parse JSON if there's content
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return undefined;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', variables.projectId, 'submission-vendors'] 
      });
      toast({
        title: 'Vendor Deleted',
        description: 'Vendor submission has been deleted successfully',
      });
    },
    onError: (error: Error) => {
      console.error('Failed to delete submission vendor:', error);
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete vendor submission',
        variant: 'destructive',
      });
    },
  });

  return { createSubmissionVendor, updateSubmissionVendor, selectSubmissionVendor, updatePreferredStatus, deleteSubmissionVendor };
}

/**
 * Hook to fetch project notifications
 */
export function useProjectNotifications(projectId: string) {
  return useQuery({
    queryKey: ['/api/maintenance/projects', projectId, 'notifications'],
    queryFn: async (): Promise<ProjectNotification[]> => {
      if (!projectId) throw new Error('Project ID is required');
      
      const response = await apiRequest('GET', `/api/maintenance/projects/${projectId}/notifications`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch project notifications' }));
        throw new Error(error.message || 'Failed to fetch project notifications');
      }
      
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!projectId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Mutation to create or update project notifications
 */
export function useProjectNotificationMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createNotification = useMutation({
    mutationFn: async ({ 
      projectId, 
      notificationData 
    }: { 
      projectId: string; 
      notificationData: Omit<ProjectNotification, 'id' | 'projectId' | 'isSent' | 'createdAt' | 'updatedAt'>;
    }) => {
      const response = await apiRequest('POST', `/api/maintenance/projects/${projectId}/notifications`, notificationData);
      if (!response.ok) throw new Error('Failed to create notification');
      return await response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', variables.projectId, 'notifications'] 
      });
      toast({
        title: 'Notification Created',
        description: 'Project notification has been created successfully',
      });
    },
  });

  const updateNotification = useMutation({
    mutationFn: async ({ 
      projectId, 
      notificationId, 
      updates 
    }: { 
      projectId: string; 
      notificationId: string; 
      updates: Partial<ProjectNotification>;
    }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/notifications/${notificationId}`, updates);
      if (!response.ok) throw new Error('Failed to update notification');
      return await response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', variables.projectId, 'notifications'] 
      });
      toast({
        title: 'Notification Updated',
        description: 'Project notification has been updated successfully',
      });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async ({ 
      projectId, 
      notificationId 
    }: { 
      projectId: string; 
      notificationId: string; 
    }) => {
      const response = await apiRequest('DELETE', `/api/maintenance/notifications/${notificationId}`);
      if (!response.ok) throw new Error('Failed to delete notification');
      
      // Handle 204 No Content responses (no body to parse)
      if (response.status === 204) {
        return undefined;
      }
      
      // Only parse JSON if there's content
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return undefined;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', variables.projectId, 'notifications'] 
      });
      toast({
        title: 'Notification Deleted',
        description: 'Project notification has been deleted successfully',
      });
    },
    onError: (error: Error) => {
      console.error('Failed to delete notification:', error);
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete notification',
        variant: 'destructive',
      });
    },
  });

  return { createNotification, updateNotification, deleteNotification };
}

// Utility functions for workflow logic
export function getNextStatus(currentStatus: string, skipFlags: SkipFlagsUpdate): string | null {
  const statusOrder = ['planned', 'submission', 'pre_work', 'in_progress', 'post_work', 'completed'];
  const currentIndex = statusOrder.indexOf(currentStatus);
  
  if (currentIndex === -1 || currentIndex === statusOrder.length - 1) {
    return null; // Invalid status or already at the end
  }
  
  // Find next non-skipped status
  for (let i = currentIndex + 1; i < statusOrder.length; i++) {
    const status = statusOrder[i];
    
    // Check if this status should be skipped
    const shouldSkip = 
      (status === 'submission' && skipFlags.skipSubmission) ||
      (status === 'pre_work' && skipFlags.skipPreWork) ||
      (status === 'in_progress' && skipFlags.skipInProgress) ||
      (status === 'post_work' && skipFlags.skipPostWork);
    
    if (!shouldSkip) {
      return status;
    }
  }
  
  return 'completed'; // If all remaining statuses are skipped, go to completed
}

export function getAccessibleTabs(currentStatus: string, skipFlags: SkipFlagsUpdate): string[] {
  // Return ALL tabs to allow unrestricted access for configuration regardless of current phase
  // This enables users to configure future workflow steps even when not at that phase yet
  return ['planned', 'submission', 'pre_work', 'in_progress', 'post_work', 'completed'];
}

export function getFirstIncompleteTab(currentStatus: string, skipFlags: SkipFlagsUpdate): string {
  const allTabs = ['planned', 'submission', 'pre_work', 'in_progress', 'post_work', 'completed'];
  const currentIndex = allTabs.indexOf(currentStatus);
  
  if (currentIndex === -1) return 'planned'; // Invalid status
  if (currentStatus === 'completed') return 'completed'; // Already completed
  
  // Return current status as it's the first incomplete tab
  return currentStatus;
}

/**
 * Mutation to delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest('DELETE', `/api/maintenance/projects/${projectId}`);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to delete project' }));
        throw new Error(error.message || 'Failed to delete project');
      }
      
      return await response.json();
    },
    onSuccess: (data, projectId) => {
      // Invalidate projects list
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/buildings'] 
      });
      
      // Remove specific project and its workflow state from cache
      queryClient.removeQueries({
        queryKey: ['/api/maintenance/projects', projectId]
      });
      // Explicitly remove the workflow state sub-key so no stale workflow
      // data is served if another component queries it before refetch.
      queryClient.removeQueries({
        queryKey: ['/api/maintenance/projects', projectId, 'workflow']
      });

      toast({
        title: 'Project Deleted',
        description: 'The project has been permanently deleted',
      });
    },
    onError: (error: Error) => {
      console.error('Failed to delete project:', error);
      // Task #1341 — render the structured FK blocker list when the server
      // refuses the delete because child rows still reference the project.
      const fk = extractFkViolation(error);
      if (fk) {
        toast({
          title: 'Cannot delete project',
          description: formatFkViolationDescription(fk, {
            emptyFallback: 'Other records still reference this project. Remove them first.',
          }),
          variant: 'destructive',
          duration: 8000,
        });
        return;
      }
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete project',
        variant: 'destructive',
      });
    },
  });
}