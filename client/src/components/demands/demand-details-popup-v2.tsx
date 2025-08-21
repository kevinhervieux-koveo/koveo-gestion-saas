import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Edit2, Save, X, Send, Trash2, ArrowUp } from 'lucide-react';
import { z } from 'zod';

import { BaseDialog } from '@/components/ui/base-dialog';
import { StandardForm, type FormFieldConfig } from '@/components/ui/standard-form';
import { useCreateMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/use-api-handler';

// Types
interface Demand {
  id: string;
  type: 'maintenance' | 'complaint' | 'information' | 'other';
  description: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';
  submitterId: string;
  buildingId: string;
  residenceId?: string;
  assignationBuildingId?: string;
  assignationResidenceId?: string;
  createdAt: string;
  updatedAt: string;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submitter?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  residence?: {
    id: string;
    unitNumber: string;
    buildingId: string;
  };
  building?: {
    id: string;
    name: string;
    address: string;
  };
}

interface DemandComment {
  id: string;
  demandId: string;
  comment: string;
  orderIndex: number;
  createdBy: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface DemandDetailsPopupProps {
  demandId: string | null;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}

// Validation schemas
const updateStatusSchema = z.object({
  status: z.enum(['draft', 'submitted', 'under_review', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled']),
  reviewNotes: z.string().optional(),
});

const addCommentSchema = z.object({
  comment: z.string().min(1, 'Comment cannot be empty'),
});

const updateDemandSchema = z.object({
  type: z.enum(['maintenance', 'complaint', 'information', 'other']),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  assignationBuildingId: z.string().optional(),
  assignationResidenceId: z.string().optional(),
});

type UpdateStatusData = z.infer<typeof updateStatusSchema>;
type AddCommentData = z.infer<typeof addCommentSchema>;
type UpdateDemandData = z.infer<typeof updateDemandSchema>;

/**
 * Demand Details Popup - Refactored using reusable components
 * Reduced from 590+ lines to ~300 lines by leveraging BaseDialog, StandardForm, and API hooks
 */
export function DemandDetailsPopup({ demandId, open, onOpenChange }: DemandDetailsPopupProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

  // Data fetching
  const { data: demand, isLoading: demandLoading } = useQuery<Demand>({
    queryKey: ['/api/demands', demandId],
    enabled: !!demandId && open,
  });

  const { data: comments = [] } = useQuery<DemandComment[]>({
    queryKey: ['/api/demands', demandId, 'comments'],
    enabled: !!demandId && open,
  });

  // API mutations using reusable hooks
  const updateStatusMutation = useUpdateMutation<Demand, UpdateStatusData>(
    (variables) => `/api/demands/${demandId}/status`,
    {
      successMessage: 'Demand status updated successfully',
      invalidateQueries: ['/api/demands', demandId],
    }
  );

  const updateDemandMutation = useUpdateMutation<Demand, UpdateDemandData>(
    `/api/demands/${demandId}`,
    {
      successMessage: 'Demand updated successfully',
      invalidateQueries: ['/api/demands', demandId],
      onSuccessCallback: () => setIsEditing(false),
    }
  );

  const addCommentMutation = useCreateMutation<DemandComment, AddCommentData>(
    `/api/demands/${demandId}/comments`,
    {
      successMessage: 'Comment added successfully',
      invalidateQueries: [`/api/demands/${demandId}/comments`],
    }
  );

  const updateCommentMutation = useUpdateMutation<DemandComment, { comment: string }>(
    (variables, commentId) => `/api/demands/${demandId}/comments/${commentId}`,
    {
      successMessage: 'Comment updated successfully',
      invalidateQueries: [`/api/demands/${demandId}/comments`],
      onSuccessCallback: () => setEditingCommentId(null),
    }
  );

  const deleteCommentMutation = useDeleteMutation(
    (commentId) => `/api/demands/${demandId}/comments/${commentId}`,
    {
      successMessage: 'Comment deleted successfully',
      invalidateQueries: [`/api/demands/${demandId}/comments`],
    }
  );

  // Form field configurations
  const getStatusFields = (): FormFieldConfig[] => [
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'submitted', label: 'Submitted' },
        { value: 'under_review', label: 'Under Review' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
    {
      name: 'reviewNotes',
      label: 'Review Notes',
      type: 'textarea',
      placeholder: 'Add notes about this status change...',
      rows: 3,
    },
  ];

  const getEditDemandFields = (): FormFieldConfig[] => [
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'maintenance', label: 'Maintenance' },
        { value: 'complaint', label: 'Complaint' },
        { value: 'information', label: 'Information' },
        { value: 'other', label: 'Other' },
      ],
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Describe the demand in detail...',
      rows: 4,
    },
    {
      name: 'assignationBuildingId',
      label: 'Assigned Building',
      type: 'text',
      placeholder: 'Optional: Assign to specific building',
    },
    {
      name: 'assignationResidenceId',
      label: 'Assigned Residence',
      type: 'text',
      placeholder: 'Optional: Assign to specific residence',
    },
  ];

  const getCommentFields = (): FormFieldConfig[] => [
    {
      name: 'comment',
      label: 'Add Comment',
      type: 'textarea',
      placeholder: 'Add a comment to this demand...',
      rows: 3,
    },
  ];

  // Status badge styling
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'submitted': return 'default';
      case 'under_review': return 'default';
      case 'approved': return 'success';
      case 'rejected': return 'destructive';
      case 'in_progress': return 'default';
      case 'completed': return 'success';
      case 'cancelled': return 'secondary';
      default: return 'default';
    }
  };

  const handleStatusUpdate = (data: UpdateStatusData) => {
    updateStatusMutation.mutate(data);
  };

  const handleDemandUpdate = (data: UpdateDemandData) => {
    updateDemandMutation.mutate(data);
  };

  const handleAddComment = (data: AddCommentData) => {
    addCommentMutation.mutate(data);
  };

  const handleUpdateComment = (commentId: string, data: { comment: string }) => {
    updateCommentMutation.mutate(data, commentId);
  };

  const handleDeleteComment = (commentId: string) => {
    deleteCommentMutation.mutate(commentId);
  };

  if (!demand && !demandLoading) {
    return null;
  }

  return (
    <BaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title={demand ? `Demand #${demand.id.slice(-6)}` : 'Loading...'}
      description={demand ? `${demand.type} - ${demand.status}` : ''}
      maxWidth="2xl"
      showFooter={false}
      isLoading={demandLoading}
    >
      {demand && (
        <div className="space-y-6">
          {/* Demand Header */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(demand.status)}>
                      {demand.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline">{demand.type}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Submitted by {demand.submitter?.firstName} {demand.submitter?.lastName} • {' '}
                    {new Date(demand.createdAt).toLocaleDateString()}
                  </div>
                  {demand.residence && (
                    <div className="text-sm text-muted-foreground">
                      Unit {demand.residence.unitNumber} - {demand.building?.name}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  {isEditing ? 'Cancel Edit' : 'Edit'}
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Demand Content */}
          <Card>
            <CardContent className="pt-6">
              {isEditing ? (
                <StandardForm
                  schema={updateDemandSchema}
                  fields={getEditDemandFields()}
                  onSubmit={handleDemandUpdate}
                  isLoading={updateDemandMutation.isPending}
                  submitText="Save Changes"
                  submitIcon={<Save className="h-4 w-4" />}
                  defaultValues={{
                    type: demand.type,
                    description: demand.description,
                    assignationBuildingId: demand.assignationBuildingId || '',
                    assignationResidenceId: demand.assignationResidenceId || '',
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Description</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {demand.description}
                    </p>
                  </div>
                  {demand.reviewNotes && (
                    <div>
                      <h3 className="font-medium mb-2">Review Notes</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {demand.reviewNotes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Management */}
          <Card>
            <CardHeader>
              <h3 className="font-medium">Update Status</h3>
            </CardHeader>
            <CardContent>
              <StandardForm
                schema={updateStatusSchema}
                fields={getStatusFields()}
                onSubmit={handleStatusUpdate}
                isLoading={updateStatusMutation.isPending}
                submitText="Update Status"
                submitIcon={<ArrowUp className="h-4 w-4" />}
                defaultValues={{
                  status: demand.status,
                  reviewNotes: '',
                }}
              />
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <h3 className="font-medium">Comments ({comments.length})</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Comment Form */}
              <StandardForm
                schema={addCommentSchema}
                fields={getCommentFields()}
                onSubmit={handleAddComment}
                isLoading={addCommentMutation.isPending}
                submitText="Add Comment"
                submitIcon={<Send className="h-4 w-4" />}
                defaultValues={{ comment: '' }}
              />

              <Separator />

              {/* Comments List */}
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm font-medium">
                        {comment.author.firstName} {comment.author.lastName}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCommentId(
                            editingCommentId === comment.id ? null : comment.id
                          )}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComment(comment.id)}
                          disabled={deleteCommentMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {editingCommentId === comment.id ? (
                      <StandardForm
                        schema={z.object({ comment: z.string().min(1) })}
                        fields={[{
                          name: 'comment',
                          label: '',
                          type: 'textarea',
                          rows: 2,
                        }]}
                        onSubmit={(data) => handleUpdateComment(comment.id, data)}
                        isLoading={updateCommentMutation.isPending}
                        submitText="Save"
                        submitIcon={<Save className="h-3 w-3" />}
                        defaultValues={{ comment: comment.comment }}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {comment.comment}
                      </p>
                    )}
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No comments yet. Add the first comment above.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </BaseDialog>
  );
}