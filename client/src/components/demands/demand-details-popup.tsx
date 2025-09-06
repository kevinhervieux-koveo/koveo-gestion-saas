import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Edit2, Save, X, Send, Trash2, ArrowUp, Paperclip, Download, Image } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

// Types
/**
 *
 */
interface Demand {
  id: string;
  type: 'maintenance' | 'complaint' | 'information' | 'other';
  description: string;
  attachments?: string[];
  status:
    | 'submitted'
    | 'under_review'
    | 'approved'
    | 'rejected'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
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

/**
 *
 */
interface DemandComment {
  id: string;
  demandId: string;
  commentText: string;
  commentType?: string;
  isInternal?: boolean;
  commenterId: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

/**
 *
 */
interface User {
  id: string;
  role: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

/**
 *
 */
interface DemandDetailsPopupProps {
  demand: Demand | null;
  isOpen: boolean;
  onClose: () => void;
  user?: User;
  onDemandUpdated?: () => void;
}

// Form schemas
const editDemandSchema = z.object({
  type: z.enum(['maintenance', 'complaint', 'information', 'other']),
  description: z.string().min(10, 'Description must be at least 10 characters long (example: Faucet in kitchen sink is leaking and needs repair)').max(2000, 'Description must be less than 2000 characters'),
  status: z
    .enum([
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'in_progress',
      'completed',
      'cancelled',
    ])
    .optional(),
  reviewNotes: z.string().max(1000, 'Review notes must be less than 1000 characters').optional(),
});

const _commentSchema = z.object({
  comment: z.string().min(1, 'Comment text is required (minimum 1 character)').max(1000, 'Comment must be less than 1000 characters'),
});

/**
 *
 */
type EditDemandFormData = z.infer<typeof editDemandSchema>;
/**
 *
 */
type _CommentFormData = z.infer<typeof _commentSchema>;

const statusColors = {
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const typeLabels = {
  maintenance: 'Maintenance',
  complaint: 'Complaint',
  information: 'Information',
  other: 'Other',
};

const statusLabels = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * Displays detailed information about a demand in a popup dialog with edit functionality.
 *
 * @param root0 - The props object.
 * @param root0.demand - The demand object to display.
 * @param root0.isOpen - Whether the popup is open.
 * @param root0.onClose - Function to close the popup.
 * @param root0.user - The current user object.
 * @param root0.onDemandUpdated - Callback when demand is updated.
 * @returns JSX element for the demand details popup.
 */
export default function DemandDetailsPopup({
  demand,
  isOpen,
  onClose,
  user,
  onDemandUpdated,
}: DemandDetailsPopupProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Check permissions
  // Nobody can edit demands (as requested)
  const canEdit = false;

  const canDelete =
    demand &&
    user &&
    (user.role === 'admin' ||
      user.role === 'manager');

  const canChangeStatus =
    demand &&
    user &&
    (user.role === 'admin' ||
      user.role === 'manager');

  const canEscalate =
    demand &&
    user &&
    user.role === 'resident' &&
    demand.submitterId !== user.id &&
    !['completed', 'cancelled'].includes(demand.status);

  // Fetch comments
  const { data: comments = [], refetch: refetchComments } = useQuery<DemandComment[]>({
    queryKey: ['/api/demands', demand?.id, 'comments'],
    enabled: !!demand?.id && isOpen,
  });

  // Edit form
  const editForm = useForm<EditDemandFormData>({
    resolver: zodResolver(editDemandSchema),
    defaultValues: {
      type: demand?.type || 'maintenance',
      description: demand?.description || '',
      status: demand?.status || 'submitted',
      reviewNotes: demand?.reviewNotes || '',
    },
  });

  // Update demand mutation
  const updateDemandMutation = useMutation({
    mutationFn: async (demandData: EditDemandFormData) => {
      const response = await fetch(`/api/demands/${demand?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(demandData),
      });
      if (!response.ok) {
        throw new Error('Failed to update demand');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
      setIsEditing(false);
      onDemandUpdated?.();
      toast({
        title: 'Success',
        description: 'Demand updated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update demand',
        variant: 'destructive',
      });
    },
  });

  // Delete demand mutation
  const deleteDemandMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/demands/${demand?.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete demand');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
      onClose();
      onDemandUpdated?.();
      toast({
        title: 'Success',
        description: 'Demand deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete demand',
        variant: 'destructive',
      });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      const response = await fetch(`/api/demands/${demand?.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commentText: comment }),
      });
      if (!response.ok) {
        throw new Error('Failed to add comment');
      }
      return response.json();
    },
    onSuccess: () => {
      refetchComments();
      setNewComment('');
      toast({
        title: 'Success',
        description: 'Comment added successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
    },
  });

  const handleSave = (_data: EditDemandFormData) => {
    updateDemandMutation.mutate(_data);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this demand?')) {
      deleteDemandMutation.mutate();
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (demand) {
      updateDemandMutation.mutate({
        type: demand.type,
        description: demand.description,
        status: newStatus as any,
        reviewNotes: demand.reviewNotes,
      });
    }
  };

  const handleEscalate = () => {
    if (demand) {
      updateDemandMutation.mutate({
        type: demand.type,
        description: demand.description,
        status: 'submitted',
        reviewNotes: demand.reviewNotes,
      });
    }
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment);
    }
  };

  if (!demand) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center justify-between'>
            <span>Demand Details</span>
            <div className='flex items-center gap-2'>
              {canEdit && !isEditing && (
                <Button variant='outline' size='sm' onClick={() => setIsEditing(true)}>
                  <Edit2 className='h-4 w-4 mr-1' />
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleDelete}
                  disabled={deleteDemandMutation.isPending}
                >
                  <Trash2 className='h-4 w-4 mr-1' />
                  Delete
                </Button>
              )}
              {canEscalate && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleEscalate}
                  disabled={updateDemandMutation.isPending}
                >
                  <ArrowUp className='h-4 w-4 mr-1' />
                  Escalate to Manager
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-6'>
          {/* Demand Details */}
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Badge variant='outline'>{typeLabels[demand.type]}</Badge>
                  <Badge className={statusColors[demand.status]}>
                    {statusLabels[demand.status]}
                  </Badge>
                </div>
                {canChangeStatus && !isEditing && (
                  <Select
                    value={demand.status}
                    onValueChange={handleStatusChange}
                    disabled={updateDemandMutation.isPending}
                  >
                    <SelectTrigger className='w-40'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {user?.role === 'resident' ? (
                        // Residents can only change status to submitted or cancelled
                        <>
                          <SelectItem value='submitted'>Submitted</SelectItem>
                          <SelectItem value='cancelled'>Cancelled</SelectItem>
                        </>
                      ) : (
                        // Managers and admins can change to any status (except draft)
                        <>
                          <SelectItem value='submitted'>Submitted</SelectItem>
                          <SelectItem value='under_review'>Under Review</SelectItem>
                          <SelectItem value='approved'>Approved</SelectItem>
                          <SelectItem value='rejected'>Rejected</SelectItem>
                          <SelectItem value='in_progress'>In Progress</SelectItem>
                          <SelectItem value='completed'>Completed</SelectItem>
                          <SelectItem value='cancelled'>Cancelled</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              {isEditing ? (
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(handleSave)} className='space-y-4'>
                    <FormField
                      control={editForm.control}
                      name='type'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value='maintenance'>Maintenance</SelectItem>
                              <SelectItem value='complaint'>Complaint</SelectItem>
                              <SelectItem value='information'>Information</SelectItem>
                              <SelectItem value='other'>Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name='description'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea className='min-h-[120px]' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {user?.role === 'manager' && (
                      <FormField
                        control={editForm.control}
                        name='reviewNotes'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Review Notes</FormLabel>
                            <FormControl>
                              <Textarea placeholder='Add review notes...' {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <div className='flex gap-2'>
                      <Button type='submit' disabled={updateDemandMutation.isPending}>
                        <Save className='h-4 w-4 mr-1' />
                        {updateDemandMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                      <Button type='button' variant='outline' onClick={() => setIsEditing(false)}>
                        <X className='h-4 w-4 mr-1' />
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <div className='space-y-4'>
                  <div>
                    <Label>Description</Label>
                    <p className='mt-1 text-sm whitespace-pre-wrap'>{demand.description}</p>
                  </div>

                  {/* Attachments Section */}
                  {demand.attachments && demand.attachments.length > 0 && (
                    <div>
                      <Label className='flex items-center gap-1'>
                        <Paperclip className='h-4 w-4' />
                        Attachments ({demand.attachments.length})
                      </Label>
                      <div className='mt-2 space-y-2'>
                        {demand.attachments.map((attachment, index) => {
                          const filename = attachment.split('/').pop() || `attachment-${index + 1}`;
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment);
                          
                          return (
                            <div key={index} className='flex items-center gap-2 p-2 bg-gray-50 rounded-md'>
                              {isImage ? (
                                <Image className='h-4 w-4 text-blue-500' />
                              ) : (
                                <Paperclip className='h-4 w-4 text-gray-500' />
                              )}
                              <span className='text-sm flex-1'>{filename}</span>
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={() => window.open(attachment, '_blank')}
                                data-testid={`button-view-attachment-${index}`}
                              >
                                {isImage ? 'View' : 'Download'}
                                <Download className='h-3 w-3 ml-1' />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                    <div>
                      <Label>Submitted by</Label>
                      <p className='mt-1'>
                        {demand.submitter?.firstName} {demand.submitter?.lastName}
                        <br />
                        <span className='text-muted-foreground'>{demand.submitter?.email}</span>
                      </p>
                    </div>
                    <div>
                      <Label>Location</Label>
                      <p className='mt-1'>
                        {demand.building?.name}
                        {demand.residence && (
                          <>
                            <br />
                            <span className='text-muted-foreground'>
                              Unit: {demand.residence.unitNumber}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {demand.reviewNotes && (
                    <div>
                      <Label>Review Notes</Label>
                      <p className='mt-1 text-sm text-muted-foreground whitespace-pre-wrap'>
                        {demand.reviewNotes}
                      </p>
                    </div>
                  )}

                  <div className='text-xs text-muted-foreground'>
                    <p>Created: {new Date(demand.createdAt).toLocaleString()}</p>
                    <p>Updated: {new Date(demand.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Comments Section */}
          <div className='space-y-4'>
            <h3 className='font-semibold'>Comments ({comments.length})</h3>

            {/* Add Comment - only if demand is not closed */}
            {demand && !['cancelled', 'completed', 'rejected'].includes(demand.status) && (
              <div className='space-y-2'>
                <Textarea
                  placeholder='Add a comment...'
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  size='sm'
                >
                  <Send className='h-4 w-4 mr-1' />
                  {addCommentMutation.isPending ? 'Adding...' : 'Add Comment'}
                </Button>
              </div>
            )}
            
            {/* Show message if demand is closed */}
            {demand && ['cancelled', 'completed', 'rejected'].includes(demand.status) && (
              <p className='text-sm text-muted-foreground bg-gray-50 p-3 rounded'>
                Comments are disabled for {demand.status} demands.
              </p>
            )}

            {/* Comments List */}
            <div className='space-y-3 max-h-60 overflow-y-auto'>
              {comments.map((comment) => (
                <Card key={comment.id}>
                  <CardContent className='p-4'>
                    <div className='flex justify-between items-start mb-2'>
                      <div className='font-medium text-sm'>
                        {comment.author.firstName} {comment.author.lastName}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {new Date(comment.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <p className='text-sm whitespace-pre-wrap'>{comment.commentText}</p>
                  </CardContent>
                </Card>
              ))}
              {comments.length === 0 && (
                <p className='text-center text-muted-foreground py-4'>No comments yet</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
