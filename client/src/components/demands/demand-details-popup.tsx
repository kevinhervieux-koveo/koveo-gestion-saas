import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DocumentInlineViewer } from '@/components/common/DocumentInlineViewer';
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
import { Edit2, Save, X, Send, Trash2, ArrowUp, Paperclip, Download, Image, Eye } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { sanitizeComment, sanitizeDescription } from '@/utils/sanitize';
import { useLanguage } from '@/hooks/use-language';
import { useLocation } from 'wouter';
import { TagChips } from '@/components/document-tags/TagPicker';

// Types
/**
 *
 */
interface Demand {
  id: string;
  type: 'maintenance' | 'complaint' | 'information' | 'other';
  description: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
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
  } | null;
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
  filePath?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
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

const statusColors = {
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-800',
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
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const commentFileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewingFile, setViewingFile] = useState<{ url: string; downloadUrl?: string; name?: string } | null>(null);

  // Form schemas - must be inside component to access t()
  const editDemandSchema = z.object({
    type: z.enum(['maintenance', 'complaint', 'information', 'other']),
    description: z.string()
      .min(10, t('descriptionMinLengthError'))
      .max(2000, t('descriptionMaxLengthError')),
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
    reviewNotes: z.string()
      .max(1000, t('reviewNotesMaxLengthError'))
      .optional(),
  });

  const commentSchema = z.object({
    comment: z.string()
      .min(1, t('commentMinLengthError'))
      .max(1000, t('commentMaxLengthError')),
  });

  type EditDemandFormData = z.infer<typeof editDemandSchema>;
  type CommentFormData = z.infer<typeof commentSchema>;

  const typeLabels = {
    maintenance: t('maintenanceType'),
    complaint: t('complaintType'),
    information: t('informationType'),
    other: t('otherType'),
  };
  
  const statusLabels = {
    submitted: t('submittedStatus'),
    under_review: t('underReviewStatus'),
    approved: t('approvedStatus'),
    rejected: t('rejectedStatus'),
    in_progress: t('inProgressStatus'),
    completed: t('completedStatus'),
    cancelled: t('cancelledStatus'),
  };

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

  // Fetch attached documents
  const { data: attachedDocuments = [] } = useQuery<any[]>({
    queryKey: [`/api/documents?attachedToType=demand&attachedToId=${demand?.id}`],
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
  const updateDemandMutation = useCreateUpdateMutation<unknown, EditDemandFormData>({
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
    successTitle: t('success'),
    successMessage: t('demandUpdatedSuccessfully'),
    errorTitle: t('error'),
    errorMessage: (error: any) => error?.message || t('failedToUpdateDemand'),
    queryKeysToInvalidate: [['/api/demands']],
    onSuccessCallback: () => {
      setIsEditing(false);
      onDemandUpdated?.();
    },
  });

  // Delete demand mutation
  const deleteDemandMutation = useCreateUpdateMutation<unknown, void>({
    mutationFn: async () => {
      const response = await fetch(`/api/demands/${demand?.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete demand');
      }
      return response.json();
    },
    successTitle: t('success'),
    successMessage: t('demandDeletedSuccessfully'),
    errorTitle: t('error'),
    errorMessage: t('failedToDeleteDemand'),
    queryKeysToInvalidate: [['/api/demands']],
    onSuccessCallback: () => {
      onClose();
      onDemandUpdated?.();
    },
  });

  // Upload a single file via the demands signed-URL endpoint and return the
  // attachment payload accepted by POST /api/demands/:id/comments.
  const uploadCommentFile = async (
    file: File
  ): Promise<{ url: string; originalName: string; size: number }> => {
    const urlResponse = await fetch('/api/demands/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name }),
      credentials: 'include',
    });
    if (!urlResponse.ok) {
      throw new Error('Failed to get upload URL');
    }
    const { uploadUrl, objectPath } = await urlResponse.json();
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }
    return { url: objectPath, originalName: file.name, size: file.size };
  };

  // Add comment mutation
  const addCommentMutation = useCreateUpdateMutation<
    unknown,
    { comment: string; file: File | null }
  >({
    mutationFn: async ({ comment, file }) => {
      const attachment = file ? await uploadCommentFile(file) : undefined;
      const response = await fetch(`/api/demands/${demand?.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentText: comment,
          ...(attachment && { attachment }),
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to add comment');
      }
      return response.json();
    },
    successTitle: t('success'),
    successMessage: t('commentAddedSuccessfully'),
    errorTitle: t('error'),
    errorMessage: (error: any) => error?.message || t('failedToAddComment'),
    onSuccessCallback: () => {
      refetchComments();
      setNewComment('');
      setCommentFile(null);
      if (commentFileInputRef.current) {
        commentFileInputRef.current.value = '';
      }
    },
  });

  const handleSave = (_data: EditDemandFormData) => {
    updateDemandMutation.mutate(_data);
  };

  const handleDelete = () => {
    if (window.confirm(t('confirmDeleteDemand'))) {
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
      addCommentMutation.mutate({ comment: newComment, file: commentFile });
    }
  };

  const handleCommentFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCommentFile(file);
  };

  const handleClearCommentFile = () => {
    setCommentFile(null);
    if (commentFileInputRef.current) {
      commentFileInputRef.current.value = '';
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
            <span>{t('demandDetails')}</span>
            <div className='flex items-center gap-2'>
              {canEdit && !isEditing && (
                <Button variant='outline' size='sm' onClick={() => setIsEditing(true)}>
                  <Edit2 className='h-4 w-4 mr-1' />
                  {t('edit')}
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
                  {t('escalateToManager')}
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
                          <SelectItem value='submitted'>{t('submittedStatus')}</SelectItem>
                          <SelectItem value='cancelled'>{t('cancelledStatus')}</SelectItem>
                        </>
                      ) : (
                        // Managers and admins can change to any status (except draft)
                        <>
                          <SelectItem value='submitted'>{t('submittedStatus')}</SelectItem>
                          <SelectItem value='under_review'>{t('underReviewStatus')}</SelectItem>
                          <SelectItem value='approved'>{t('approvedStatus')}</SelectItem>
                          <SelectItem value='rejected'>{t('rejectedStatus')}</SelectItem>
                          <SelectItem value='in_progress'>{t('inProgressStatus')}</SelectItem>
                          <SelectItem value='completed'>{t('completedStatus')}</SelectItem>
                          <SelectItem value='cancelled'>{t('cancelledStatus')}</SelectItem>
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
                          <FormLabel>{t('typeLabel')}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value='maintenance'>{t('maintenanceType')}</SelectItem>
                              <SelectItem value='complaint'>{t('complaintType')}</SelectItem>
                              <SelectItem value='information'>{t('informationType')}</SelectItem>
                              <SelectItem value='other'>{t('otherType')}</SelectItem>
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
                          <FormLabel>{t('descriptionLabel')}</FormLabel>
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
                            <FormLabel>{t('reviewNotes')}</FormLabel>
                            <FormControl>
                              <Textarea placeholder={t('addReviewNotes')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <div className='flex gap-2'>
                      <Button type='submit' disabled={updateDemandMutation.isPending}>
                        <Save className='h-4 w-4 mr-1' />
                        {updateDemandMutation.isPending ? t('saving') : t('save')}
                      </Button>
                      <Button type='button' variant='outline' onClick={() => setIsEditing(false)}>
                        <X className='h-4 w-4 mr-1' />
                        {t('cancel')}
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <div className='space-y-4'>
                  <div>
                    <Label>{t('descriptionLabel')}</Label>
                    <p className='mt-1 text-sm whitespace-pre-wrap'>{sanitizeDescription(demand.description)}</p>
                  </div>

                  {/* Attachments Section */}
                  {demand.filePath && (
                    <div>
                      <Label className='flex items-center gap-1'>
                        <Paperclip className='h-4 w-4' />
                        {t('fileAttachment')}
                      </Label>
                      <div className='mt-2 space-y-2'>
                        {demand.fileName && (() => {
                          const filename = demand.fileName;
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
                          
                          const handleView = () => {
                            setViewingFile({ url: demand.filePath!, name: filename });
                          };

                          const handleDownload = async () => {
                            try {
                              const response = await fetch(demand.filePath, {
                                method: 'GET',
                                credentials: 'include',
                              });

                              if (!response.ok) {
                                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
                              }

                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              
                              const link = window.document.createElement('a');
                              link.href = url;
                              link.download = filename;
                              window.document.body.appendChild(link);
                              link.click();
                              
                              window.document.body.removeChild(link);
                              window.URL.revokeObjectURL(url);
                            } catch (error: any) {
                              alert(`Download failed: ${error.message || 'Unknown error'}`);
                            }
                          };
                          
                          return (
                            <div className='flex items-center gap-2 p-2 bg-gray-50 rounded-md'>
                              {isImage ? (
                                <Image className='h-4 w-4 text-blue-500' />
                              ) : (
                                <Paperclip className='h-4 w-4 text-gray-500' />
                              )}
                              <span className='text-sm flex-1'>{filename}</span>
                              <div className='flex gap-2'>
                                <Button
                                  variant='outline'
                                  size='sm'
                                  onClick={handleView}
                                  data-testid='button-view-attachment'
                                >
                                  <Eye className='h-3 w-3 mr-1' />
                                  {t('view')}
                                </Button>
                                <Button
                                  variant='outline'
                                  size='sm'
                                  onClick={handleDownload}
                                  data-testid='button-download-attachment'
                                >
                                  <Download className='h-3 w-3 mr-1' />
                                  {t('download')}
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                    <div>
                      <Label>{t('submittedBy')}</Label>
                      <p className='mt-1'>
                        {demand.submitter 
                          ? `${demand.submitter.firstName} ${demand.submitter.lastName}`
                          : 'Utilisateur supprimé'}
                        <br />
                        <span className='text-muted-foreground'>
                          {demand.submitter?.email || ''}
                        </span>
                      </p>
                    </div>
                    <div>
                      <Label>{t('location')}</Label>
                      <p className='mt-1'>
                        {demand.building?.name}
                        {demand.residence && (
                          <>
                            <br />
                            <span className='text-muted-foreground'>
                              {t('unit')} {demand.residence.unitNumber}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {demand.reviewNotes && (
                    <div>
                      <Label>{t('reviewNotes')}</Label>
                      <p className='mt-1 text-sm text-muted-foreground whitespace-pre-wrap'>
                        {demand.reviewNotes}
                      </p>
                    </div>
                  )}

                  <div className='text-xs text-muted-foreground'>
                    <p>{t('created')} {new Date(demand.createdAt).toLocaleString()}</p>
                    <p>{t('updated')} {new Date(demand.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Attached Documents Section */}
          {attachedDocuments.length > 0 && (
            <div className='space-y-4'>
              <h3 className='font-semibold flex items-center gap-2'>
                <Paperclip className='h-5 w-5' />
                {t('fileAttachment')}s ({attachedDocuments.length})
              </h3>
              <div className='space-y-2'>
                {attachedDocuments.map((doc: any) => {
                  const filename = doc.fileName || doc.name;
                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
                  
                  const handleView = () => {
                    setViewingFile({
                      url: `/api/documents/${doc.id}/file`,
                      downloadUrl: `/api/documents/${doc.id}/file?download=true`,
                      name: filename,
                    });
                  };

                  const handleDownload = async () => {
                    try {
                      const response = await fetch(`/api/documents/${doc.id}/file`, {
                        method: 'GET',
                        credentials: 'include',
                      });

                      if (!response.ok) {
                        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
                      }

                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      
                      const link = window.document.createElement('a');
                      link.href = url;
                      link.download = filename;
                      window.document.body.appendChild(link);
                      link.click();
                      
                      window.document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                    } catch (error: any) {
                      alert(`Download failed: ${error.message || 'Unknown error'}`);
                    }
                  };
                  
                  return (
                    <div key={doc.id} className='p-3 bg-gray-50 rounded-md border space-y-2'>
                      <div className='flex items-center gap-2'>
                        {isImage ? (
                          <Image className='h-5 w-5 text-blue-500' />
                        ) : (
                          <Paperclip className='h-5 w-5 text-gray-500' />
                        )}
                        <div className='flex-1'>
                          <span className='text-sm font-medium'>{filename}</span>
                          {doc.description && (
                            <p className='text-xs text-muted-foreground'>{doc.description}</p>
                          )}
                        </div>
                        <div className='flex gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={handleView}
                            data-testid={`button-view-document-${doc.id}`}
                          >
                            <Eye className='h-3 w-3 mr-1' />
                            {t('view')}
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={handleDownload}
                            data-testid={`button-download-document-${doc.id}`}
                          >
                            <Download className='h-3 w-3 mr-1' />
                            {t('download')}
                          </Button>
                        </div>
                      </div>
                      {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                        <TagChips tags={doc.tags} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Separator />

          {/* Comments Section */}
          <div className='space-y-4'>
            <h3 className='font-semibold'>{t('comments')} ({comments.length})</h3>

            {/* Add Comment - only if demand is not closed */}
            {demand && !['cancelled', 'completed', 'rejected'].includes(demand.status) && (
              <div className='space-y-2'>
                <Textarea
                  placeholder={t('addAComment')}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  data-testid='input-new-comment'
                />
                <input
                  type='file'
                  ref={commentFileInputRef}
                  onChange={handleCommentFileChange}
                  className='hidden'
                  data-testid='input-comment-attachment'
                />
                {commentFile && (
                  <div
                    className='flex items-center gap-2 p-2 bg-gray-50 rounded-md text-sm'
                    data-testid='comment-attachment-preview'
                  >
                    <Paperclip className='h-4 w-4 text-gray-500' />
                    <span className='flex-1 truncate'>{commentFile.name}</span>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={handleClearCommentFile}
                      disabled={addCommentMutation.isPending}
                      data-testid='button-clear-comment-attachment'
                    >
                      <X className='h-3 w-3' />
                    </Button>
                  </div>
                )}
                <div className='flex items-center gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => commentFileInputRef.current?.click()}
                    disabled={addCommentMutation.isPending}
                    data-testid='button-attach-comment-file'
                  >
                    <Paperclip className='h-4 w-4 mr-1' />
                    {commentFile ? t('replaceFile') : t('attachFile')}
                  </Button>
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                    size='sm'
                    data-testid='button-add-comment'
                  >
                    <Send className='h-4 w-4 mr-1' />
                    {addCommentMutation.isPending ? t('adding') : t('addComment')}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Show message if demand is closed */}
            {demand && ['cancelled', 'completed', 'rejected'].includes(demand.status) && (
              <p className='text-sm text-muted-foreground bg-gray-50 p-3 rounded'>
                {t('commentsDisabledFor').replace('{status}', demand.status)}
              </p>
            )}

            {/* Comments List */}
            <div className='space-y-3 max-h-60 overflow-y-auto'>
              {comments.map((comment) => {
                const commentFilePath = comment.filePath || undefined;
                const commentFileName = comment.fileName || undefined;
                const commentIsImage = commentFileName
                  ? /\.(jpg|jpeg|png|gif|webp)$/i.test(commentFileName)
                  : false;

                const formatBytes = (size: number) => {
                  if (size < 1024) return `${size} B`;
                  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
                  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
                };

                const handleViewCommentFile = () => {
                  if (commentFilePath) {
                    setViewingFile({ url: commentFilePath, name: commentFileName });
                  }
                };

                const handleDownloadCommentFile = async () => {
                  if (!commentFilePath || !commentFileName) return;
                  try {
                    const response = await fetch(commentFilePath, {
                      method: 'GET',
                      credentials: 'include',
                    });

                    if (!response.ok) {
                      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
                    }

                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);

                    const link = window.document.createElement('a');
                    link.href = url;
                    link.download = commentFileName;
                    window.document.body.appendChild(link);
                    link.click();

                    window.document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  } catch (error: any) {
                    alert(`Download failed: ${error.message || 'Unknown error'}`);
                  }
                };

                return (
                  <Card key={comment.id}>
                    <CardContent className='p-4'>
                      <div className='flex justify-between items-start mb-2'>
                        <div className='font-medium text-sm'>
                          {comment.author
                            ? `${comment.author.firstName} ${comment.author.lastName}`
                            : 'Utilisateur supprimé'}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          {new Date(comment.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <p className='text-sm whitespace-pre-wrap'>{sanitizeComment(comment.commentText)}</p>
                      {commentFilePath && commentFileName && (
                        <div
                          className='mt-2 flex items-center gap-2 p-2 bg-gray-50 rounded-md'
                          data-testid={`comment-attachment-${comment.id}`}
                        >
                          {commentIsImage ? (
                            <Image className='h-4 w-4 text-blue-500' />
                          ) : (
                            <Paperclip className='h-4 w-4 text-gray-500' />
                          )}
                          <div className='flex-1 min-w-0'>
                            <div className='text-sm truncate'>{commentFileName}</div>
                            {typeof comment.fileSize === 'number' && comment.fileSize > 0 && (
                              <div className='text-xs text-muted-foreground'>
                                {formatBytes(comment.fileSize)}
                              </div>
                            )}
                          </div>
                          <div className='flex gap-2'>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={handleViewCommentFile}
                              data-testid={`button-view-comment-attachment-${comment.id}`}
                            >
                              <Eye className='h-3 w-3 mr-1' />
                              {t('view')}
                            </Button>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={handleDownloadCommentFile}
                              data-testid={`button-download-comment-attachment-${comment.id}`}
                            >
                              <Download className='h-3 w-3 mr-1' />
                              {t('download')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {comments.length === 0 && (
                <p className='text-center text-muted-foreground py-4'>{t('noCommentsYet')}</p>
              )}
            </div>
          </div>

          {/* Delete button at bottom right */}
          {canDelete && (
            <div className='flex justify-end pt-4'>
              <Button
                variant='destructive'
                size='sm'
                onClick={handleDelete}
                disabled={deleteDemandMutation.isPending}
                data-testid='button-delete-demand'
              >
                <Trash2 className='h-4 w-4 mr-1' />
                {deleteDemandMutation.isPending ? t('deleting') : t('deleteDemand')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {viewingFile && (
        <DocumentInlineViewer
          isOpen={!!viewingFile}
          onClose={() => setViewingFile(null)}
          fileUrl={viewingFile.url}
          downloadUrl={viewingFile.downloadUrl}
          fileName={viewingFile.name}
        />
      )}
    </Dialog>
  );
}
