import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { StandardDocumentAttachments, type AttachedFile } from '@/components/common/StandardDocumentAttachments';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSubmissionVendors, useSubmissionVendorMutations, useMarkStatusComplete, type ProjectWorkflowState } from '@/hooks/useProjectWorkflow';
import { MaintenanceProject, type SubmissionVendor } from '@shared/schemas/maintenance';
import { PaymentPlanForm } from './PaymentPlanForm';
import { cn, formatStatus, safeCapitalize } from '@/lib/utils';
import {
  CheckCircle2,
  Users,
  DollarSign,
  FileText,
  Calendar,
  Info,
  Star,
  Phone,
  Mail,
  AlertTriangle,
  Edit,
  Settings,
  Plus,
  Upload,
} from 'lucide-react';

// Form schema for new submission
const newSubmissionSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  availableDate: z.date().optional(),
  price: z.number().min(0, 'Price must be a positive number').optional(),
  description: z.string().optional(),
  preferred: z.boolean().default(false),
});

// Form schema for editing existing vendor
const editVendorSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  availableDate: z.date().optional(),
  price: z.number().min(0, 'Price must be a positive number').optional(),
  description: z.string().optional(),
  contactInfo: z.string().optional(),
  preferred: z.boolean().default(false),
});

type NewSubmissionForm = z.infer<typeof newSubmissionSchema>;
type EditVendorForm = z.infer<typeof editVendorSchema>;

export interface SubmissionTabProps {
  project: MaintenanceProject;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
}

/**
 * Submission tab component for vendor management and selection
 * Displays vendor submissions, payment plans, and selection interface
 */
export function SubmissionTab({ project, workflowState, onUpdate }: SubmissionTabProps) {
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [editingPaymentPlan, setEditingPaymentPlan] = useState<SubmissionVendor | null>(null);
  const [editingVendor, setEditingVendor] = useState<SubmissionVendor | null>(null);
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<AttachedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  // Defensive null check for project data
  if (!project) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Project data is missing. Unable to load the submission tab.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { 
    data: submissionVendors = [], 
    isLoading: isLoadingVendors,
    error: vendorsError 
  } = useSubmissionVendors(project.id);

  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();
  const { createSubmissionVendor, selectSubmissionVendor, updateSubmissionVendor, updatePreferredStatus } = useSubmissionVendorMutations();

  // Form for new submission
  const submissionForm = useForm<NewSubmissionForm>({
    resolver: zodResolver(newSubmissionSchema),
    defaultValues: {
      vendorName: '',
      availableDate: undefined,
      price: undefined,
      description: '',
      preferred: false,
    },
  });

  // Form for editing vendor
  const editVendorForm = useForm<EditVendorForm>({
    resolver: zodResolver(editVendorSchema),
    defaultValues: {
      vendorName: '',
      availableDate: undefined,
      price: undefined,
      description: '',
      contactInfo: '',
      preferred: false,
    },
  });

  const canAdvance = workflowState.canAdvance && workflowState.currentStatus === 'submission';

  const handleVendorSelect = (vendor: SubmissionVendor) => {
    setSelectedVendorId(vendor.id);
    selectSubmissionVendor.mutate({
      projectId: project.id,
      vendorId: vendor.id,
      isSelected: !vendor.isSelected,
    });
  };

  const handleEditPaymentPlan = (vendor: SubmissionVendor) => {
    setEditingPaymentPlan(vendor);
  };

  const handleSavePaymentPlan = (paymentPlanData: any) => {
    if (!editingPaymentPlan) return;

    updateSubmissionVendor.mutate({
      projectId: project.id,
      vendorId: editingPaymentPlan.id,
      updates: paymentPlanData,
    }, {
      onSuccess: () => {
        setEditingPaymentPlan(null);
        onUpdate();
      },
    });
  };

  const handleCancelPaymentPlan = () => {
    setEditingPaymentPlan(null);
  };

  const handleEditVendor = (vendor: SubmissionVendor) => {
    setEditingVendor(vendor);
    // Populate form with vendor data
    editVendorForm.reset({
      vendorName: vendor.vendorName,
      availableDate: vendor.availableDate ? new Date(vendor.availableDate) : undefined,
      price: vendor.price ? parseFloat(vendor.price) : undefined,
      description: vendor.notes || '',
      contactInfo: vendor.contactInfo || '',
      preferred: vendor.preferred,
    });
  };

  const handleSaveVendorEdit = (data: EditVendorForm) => {
    if (!editingVendor) return;

    updateSubmissionVendor.mutate({
      projectId: project.id,
      vendorId: editingVendor.id,
      updates: {
        vendorName: data.vendorName,
        availableDate: data.availableDate ? format(data.availableDate, 'yyyy-MM-dd') : undefined,
        price: data.price?.toString(),
        notes: data.description,
        contactInfo: data.contactInfo,
        preferred: data.preferred,
      },
    }, {
      onSuccess: () => {
        setEditingVendor(null);
        editVendorForm.reset();
        onUpdate();
      },
    });
  };

  const handleCancelVendorEdit = () => {
    setEditingVendor(null);
    editVendorForm.reset();
  };

  const handleTogglePreferred = (vendor: SubmissionVendor) => {
    updatePreferredStatus.mutate({
      projectId: project.id,
      vendorId: vendor.id,
      preferred: !vendor.preferred,
    });
  };

  const handleMarkComplete = () => {
    markComplete({
      projectId: project.id,
      currentStatus: 'submission',
    }, {
      onSuccess: () => {
        onUpdate();
      },
    });
  };

  const formatCurrency = (amount?: string | number) => {
    if (!amount) return 'Not specified';
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return 'Not specified';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(numericAmount);
  };

  const formatPaymentSchedule = (schedule?: string) => {
    if (!schedule) return 'Not specified';
    const formatted = formatStatus(schedule, 'Not specified');
    return safeCapitalize(formatted, 'Not specified');
  };

  const handleSubmissionSubmit = (data: NewSubmissionForm) => {
    // Convert form data to the API format - note that we need to match the expected mutation interface
    const vendorData = {
      vendorName: data.vendorName,
      availableDate: data.availableDate ? format(data.availableDate, 'yyyy-MM-dd') : undefined,
      price: data.price?.toString(), // Convert number to string for decimal field
      description: data.description || '',
      preferred: data.preferred || false,
      documents: uploadedDocuments.map(doc => ({
        id: doc.id,
        name: doc.name,
        url: doc.url,
        size: doc.size,
        type: doc.type,
      })),
      // Add other required fields with defaults
      contactInfo: '',
      notes: data.description || '',
      projectType: 'not_sure' as const, // Default project type
      addedLifespan: undefined,
      paymentPlanCosts: [],
      paymentPlanSchedule: undefined,
      paymentPlanCustomDates: [],
      paymentPlanStartDate: undefined,
      isSelected: false,
    };

    console.log('Creating new submission:', vendorData);

    createSubmissionVendor.mutate(
      { projectId: project.id, vendorData },
      {
        onSuccess: () => {
          setShowSubmissionDialog(false);
          submissionForm.reset();
          setUploadedDocuments([]);
          onUpdate(); // Refresh the project data
        },
        onError: (error) => {
          console.error('Failed to create submission:', error);
          // Keep the dialog open on error so user can retry
        },
      }
    );
  };

  // Handle document changes from StandardDocumentAttachments
  const handleDocumentChange = (file: File | null, text: string | null) => {
    if (file) {
      const newAttachment: AttachedFile = {
        id: crypto.randomUUID(),
        file,
        uploadProgress: 0,
      };
      setUploadedDocuments(prev => [...prev, newAttachment]);
    }
  };

  // Handle removing files
  const handleRemoveFile = (fileId: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== fileId));
  };

  return (
    <div className="space-y-6" data-testid="submission-tab">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Vendor Submissions</h3>
          <p className="text-sm text-muted-foreground">
            Review and select from vendor proposals and quotes
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Skip option info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>This step can be skipped in tab navigation</span>
          </div>
          
          {/* Add Submission Button */}
          <Dialog 
            open={showSubmissionDialog} 
            onOpenChange={(open) => {
              setShowSubmissionDialog(open);
              if (!open) {
                // Clear uploaded documents when dialog closes
                setUploadedDocuments([]);
                setUploadProgress({});
                submissionForm.reset();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button data-testid="button-add-submission">
                <Plus className="h-4 w-4 mr-2" />
                Add Submission
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Vendor Submission</DialogTitle>
              </DialogHeader>
              <Form {...submissionForm}>
                <form onSubmit={submissionForm.handleSubmit(handleSubmissionSubmit)} className="space-y-4 pb-4">
                  {/* Vendor Name */}
                  <FormField
                    control={submissionForm.control}
                    name="vendorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter vendor name"
                            data-testid="input-vendor-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Available Date */}
                  <FormField
                    control={submissionForm.control}
                    name="availableDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Available Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            min={format(new Date(), 'yyyy-MM-dd')}
                            value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                field.onChange(new Date(e.target.value));
                              } else {
                                field.onChange(undefined);
                              }
                            }}
                            data-testid="input-available-date"
                          />
                        </FormControl>
                        <FormDescription>
                          When can the vendor start the work?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Price */}
                  <FormField
                    control={submissionForm.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const value = e.target.value ? parseFloat(e.target.value) : undefined;
                              field.onChange(value);
                            }}
                            data-testid="input-price"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the quoted price for the work
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description */}
                  <FormField
                    control={submissionForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the vendor's proposal..."
                            rows={3}
                            data-testid="textarea-description"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Additional details about the vendor's submission
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Document Upload using StandardDocumentAttachments */}
                  <StandardDocumentAttachments
                    onDocumentChange={handleDocumentChange}
                    attachedFiles={uploadedDocuments}
                    onRemoveFile={handleRemoveFile}
                    uploadProgress={uploadProgress}
                    uploadContext={{
                      type: 'maintenance',
                      buildingId: project.buildingId,
                      elementId: project.id,
                    }}
                    title="Documents (Optional)"
                    showUploadTabs={false}
                    defaultUploadTab="file"
                    aiEnabled={false}
                    showAiToggle={false}
                    className="border rounded-lg"
                  />

                  {/* Preferred Checkbox */}
                  <FormField
                    control={submissionForm.control}
                    name="preferred"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-preferred"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Mark as preferred vendor</FormLabel>
                          <FormDescription>
                            Flag this vendor as a preferred choice
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowSubmissionDialog(false);
                        submissionForm.reset();
                        setUploadedDocuments([]);
                        setUploadProgress({});
                      }}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="button-submit" disabled={createSubmissionVendor.isPending}>
                      {createSubmissionVendor.isPending ? 'Adding...' : 'Add Submission'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>


      {/* Loading State */}
      {isLoadingVendors && (
        <div className="space-y-4">
          <div className="h-32 bg-muted animate-pulse rounded-lg" />
          <div className="h-32 bg-muted animate-pulse rounded-lg" />
          <div className="h-32 bg-muted animate-pulse rounded-lg" />
        </div>
      )}

      {/* Error State */}
      {vendorsError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load vendor submissions: {vendorsError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Vendor Submissions */}
      {submissionVendors.length === 0 && !isLoadingVendors && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              No Submissions Yet
            </CardTitle>
            <CardDescription>
              No vendor submissions have been received for this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 space-y-4">
              <Users className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h4 className="text-lg font-semibold">No Vendor Submissions Yet</h4>
                <p className="text-muted-foreground">
                  Add vendor submissions with their quotes, availability, and proposal documents.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {submissionVendors.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold">
              Vendor Submissions ({submissionVendors.length})
            </h4>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {submissionVendors.filter(v => v.isSelected).length} Selected
              </Badge>
              {submissionVendors.some(v => v.preferred) && (
                <Badge variant="outline" className="border-yellow-400 text-yellow-600">
                  <Star className="h-3 w-3 mr-1" />
                  {submissionVendors.filter(v => v.preferred).length} Preferred
                </Badge>
              )}
            </div>
          </div>

          {submissionVendors.map((vendor) => (
            <Card 
              key={vendor.id} 
              className={cn(
                'transition-all cursor-pointer hover:shadow-md',
                vendor.isSelected && 'ring-2 ring-primary',
                vendor.preferred && 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950',
                selectedVendorId === vendor.id && 'ring-2 ring-blue-500'
              )}
              onClick={() => handleVendorSelect(vendor)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={vendor.isSelected}
                      onChange={() => handleVendorSelect(vendor)}
                      className="mt-1"
                    />
                    <div>
                      <CardTitle className="text-lg">{vendor.vendorName}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        {vendor.availableDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Available: {new Date(vendor.availableDate).toLocaleDateString()}
                          </span>
                        )}
                        {vendor.contactInfo && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            Contact Available
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {formatStatus(vendor.projectType, 'Not specified')}
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="text-right space-y-2">
                    <div className="text-lg font-semibold">
                      {formatCurrency(vendor.price)}
                    </div>
                    <div className="flex flex-col gap-1">
                      {vendor.isSelected && (
                        <Badge className="bg-green-600">Selected</Badge>
                      )}
                      {vendor.preferred && (
                        <Badge className="bg-yellow-600">
                          <Star className="h-3 w-3 mr-1" />
                          Preferred
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      <Button
                        variant={vendor.preferred ? "secondary" : "outline"}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePreferred(vendor);
                        }}
                        data-testid={`button-toggle-preferred-${vendor.id}`}
                        className="w-full"
                      >
                        <Star className={cn("h-3 w-3 mr-1", vendor.preferred && "fill-yellow-400 text-yellow-400")} />
                        {vendor.preferred ? 'Unmark Preferred' : 'Mark as Preferred'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditVendor(vendor);
                        }}
                        data-testid={`button-edit-vendor-${vendor.id}`}
                        className="w-full"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit Vendor
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Proposal Details */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">Proposal Details</h5>
                    
                    {/* Description */}
                    {vendor.notes ? (
                      <div className="p-2 bg-muted/50 rounded text-sm">
                        <p className="text-muted-foreground">{vendor.notes}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No description provided</p>
                    )}
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      {vendor.availableDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Available for work: {new Date(vendor.availableDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {vendor.addedLifespan && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Extends lifespan: {vendor.addedLifespan} years</span>
                        </div>
                      )}
                      {vendor.documents && Array.isArray(vendor.documents) && vendor.documents.length > 0 && (
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          <span>{vendor.documents.length} document(s) submitted</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Plan */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-sm">Payment Plan</h5>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPaymentPlan(vendor);
                        }}
                        data-testid={`button-edit-payment-plan-${vendor.id}`}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        <span>Schedule: {formatPaymentSchedule(vendor.paymentPlanSchedule)}</span>
                      </div>
                      {vendor.paymentPlanStartDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Starts: {new Date(vendor.paymentPlanStartDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {vendor.paymentPlanCosts && vendor.paymentPlanCosts.length > 0 && (
                        <div>
                          <span>Payment breakdown:</span>
                          <div className="ml-4 mt-1">
                            {vendor.paymentPlanCosts.map((cost, index) => (
                              <div key={index} className="text-xs">
                                Payment {index + 1}: {formatCurrency(cost)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(!vendor.paymentPlanCosts || vendor.paymentPlanCosts.length === 0) && (
                        <div className="text-xs text-muted-foreground italic">
                          No payment plan configured yet
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                {vendor.contactInfo && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <h5 className="font-medium text-sm mb-2">Contact Information</h5>
                    <p className="text-sm text-muted-foreground">{vendor.contactInfo}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="text-sm text-muted-foreground">
          {workflowState.nextStatus && (
            <>Next: <span className="capitalize">{formatStatus(workflowState.nextStatus)}</span></>
          )}
        </div>
        
        {canAdvance && (
          <Button 
            onClick={handleMarkComplete}
            disabled={isMarkingComplete}
            className="flex items-center gap-2"
            data-testid="button-mark-submission-complete"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isMarkingComplete ? 'Completing...' : 'Complete Submission Phase'}
          </Button>
        )}
      </div>

      {/* Payment Plan Edit Dialog */}
      <Dialog 
        open={!!editingPaymentPlan} 
        onOpenChange={(open) => !open && handleCancelPaymentPlan()}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Edit Payment Plan - {editingPaymentPlan?.vendorName}
            </DialogTitle>
          </DialogHeader>
          
          {editingPaymentPlan && (
            <PaymentPlanForm
              initialData={{
                paymentPlanCosts: editingPaymentPlan.paymentPlanCosts,
                paymentPlanSchedule: editingPaymentPlan.paymentPlanSchedule,
                paymentPlanStartDate: editingPaymentPlan.paymentPlanStartDate,
                paymentPlanCustomDates: editingPaymentPlan.paymentPlanCustomDates,
              }}
              totalAmount={editingPaymentPlan.price}
              onSave={handleSavePaymentPlan}
              onCancel={handleCancelPaymentPlan}
              isLoading={updateSubmissionVendor.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Vendor Dialog */}
      <Dialog 
        open={!!editingVendor} 
        onOpenChange={(open) => !open && handleCancelVendorEdit()}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Vendor - {editingVendor?.vendorName}
            </DialogTitle>
          </DialogHeader>
          
          {editingVendor && (
            <Form {...editVendorForm}>
              <form onSubmit={editVendorForm.handleSubmit(handleSaveVendorEdit)} className="space-y-4">
                <FormField
                  control={editVendorForm.control}
                  name="vendorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter vendor name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editVendorForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="Enter price" 
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editVendorForm.control}
                  name="availableDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date"
                          {...field}
                          value={field.value ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editVendorForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter description or notes" 
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editVendorForm.control}
                  name="contactInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Information</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter contact information" 
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editVendorForm.control}
                  name="preferred"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Mark as Preferred</FormLabel>
                        <FormDescription>
                          Mark this vendor as preferred for this project
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelVendorEdit}
                    disabled={updateSubmissionVendor.isPending}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={updateSubmissionVendor.isPending}
                  >
                    {updateSubmissionVendor.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}