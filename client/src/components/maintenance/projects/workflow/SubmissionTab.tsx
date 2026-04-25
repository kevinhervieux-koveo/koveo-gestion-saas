import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { StandardDocumentAttachments, type AttachedFile } from '@/components/common/StandardDocumentAttachments';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSubmissionVendors, useSubmissionVendorMutations, useMarkStatusComplete, useReopenWorkflowStep, type ProjectWorkflowState } from '@/hooks/useProjectWorkflow';
import { ReopenStepDialog } from './ReopenStepDialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { MaintenanceProject, type SubmissionVendor } from '@shared/schemas/maintenance';
import { PaymentPlanForm } from './PaymentPlanForm';
import { ElementManagementTab } from './ElementManagementTab';
import { cn, formatStatus, parseDateOnly, safeCapitalize } from '@/lib/utils';
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
  X,
  RotateCcw,
} from 'lucide-react';

// Form schema for new submission with payment plan (matching bills structure)
const newSubmissionSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  availableDate: z.date().optional(),
  description: z.string().optional(),
  preferred: z.boolean(),
  // Payment plan fields matching bills structure
  paymentType: z.enum(['unique', 'recurrent']).default('unique'),
  totalAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Total amount must be between $0.01 and $999,999.99'),
  schedulePayment: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
  dateFirstPayment: z.date().optional(),
  dateEndPayment: z.date().optional(),
  hasInitialPayment: z.boolean().default(false),
  recurringPaymentsEqual: z.boolean().default(true),
  initialPaymentAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Initial payment amount must be between $0.01 and $999,999.99'),
  recurringPaymentAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Recurring payment amount must be between $0.01 and $999,999.99'),
  customPayments: z.array(z.object({
    amount: z.string().min(1, 'Amount is required').refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 999999.99;
    }, 'Amount must be between $0.01 and $999,999.99'),
    date: z.string().min(1, 'Date is required').refine((val) => {
      return !isNaN(Date.parse(val));
    }, 'Date must be a valid date'),
    description: z.string().optional()
  })).default([]),
}).superRefine((data, ctx) => {
  // Custom validation logic for payment structure with specific field error targeting
  if (data.paymentType === 'unique') {
    // For unique payments, total amount and payment date are required
    if (!data.totalAmount || data.totalAmount.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Total amount is required for one-time payments',
        path: ['totalAmount']
      });
    }
    if (!data.dateFirstPayment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment date is required for one-time payments',
        path: ['dateFirstPayment']
      });
    }
  } else if (data.paymentType === 'recurrent') {
    // For recurring payments, validate based on configuration
    if (data.hasInitialPayment && (!data.initialPaymentAmount || data.initialPaymentAmount.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Initial payment amount is required when initial payment is enabled',
        path: ['initialPaymentAmount']
      });
    }
    if (data.recurringPaymentsEqual && (!data.recurringPaymentAmount || data.recurringPaymentAmount.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Recurring payment amount is required for equal recurring payments',
        path: ['recurringPaymentAmount']
      });
    }
    if (!data.recurringPaymentsEqual && (!data.customPayments || data.customPayments.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one custom payment is required for unequal recurring payments',
        path: ['customPayments']
      });
    }
  }
});

// Form schema for editing existing vendor with payment plan
const editVendorSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  availableDate: z.date().optional(),
  description: z.string().optional(),
  contactInfo: z.string().optional(),
  preferred: z.boolean(),
  // Payment plan fields matching bills structure
  paymentType: z.enum(['unique', 'recurrent']).default('unique'),
  totalAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Total amount must be between $0.01 and $999,999.99'),
  schedulePayment: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
  dateFirstPayment: z.date().optional(),
  dateEndPayment: z.date().optional(),
  hasInitialPayment: z.boolean().default(false),
  recurringPaymentsEqual: z.boolean().default(true),
  initialPaymentAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Initial payment amount must be between $0.01 and $999,999.99'),
  recurringPaymentAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Recurring payment amount must be between $0.01 and $999,999.99'),
  customPayments: z.array(z.object({
    amount: z.string().min(1, 'Amount is required').refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 999999.99;
    }, 'Amount must be between $0.01 and $999,999.99'),
    date: z.string().min(1, 'Date is required').refine((val) => {
      return !isNaN(Date.parse(val));
    }, 'Date must be a valid date'),
    description: z.string().optional()
  })).default([]),
}).superRefine((data, ctx) => {
  // Custom validation logic for payment structure with specific field error targeting
  if (data.paymentType === 'unique') {
    // For unique payments, total amount and payment date are required
    if (!data.totalAmount || data.totalAmount.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Total amount is required for one-time payments',
        path: ['totalAmount']
      });
    }
    if (!data.dateFirstPayment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment date is required for one-time payments',
        path: ['dateFirstPayment']
      });
    }
  } else if (data.paymentType === 'recurrent') {
    // For recurring payments, validate based on configuration
    if (data.hasInitialPayment && (!data.initialPaymentAmount || data.initialPaymentAmount.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Initial payment amount is required when initial payment is enabled',
        path: ['initialPaymentAmount']
      });
    }
    if (data.recurringPaymentsEqual && (!data.recurringPaymentAmount || data.recurringPaymentAmount.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Recurring payment amount is required for equal recurring payments',
        path: ['recurringPaymentAmount']
      });
    }
    if (!data.recurringPaymentsEqual && (!data.customPayments || data.customPayments.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one custom payment is required for unequal recurring payments',
        path: ['customPayments']
      });
    }
  }
});

type NewSubmissionForm = z.infer<typeof newSubmissionSchema>;
type EditVendorForm = z.infer<typeof editVendorSchema>;

export interface SubmissionTabProps {
  project: MaintenanceProject;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
  onMarkComplete?: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

/**
 * Submission tab component for vendor management and selection
 * Displays vendor submissions, payment plans, and selection interface
 */
export function SubmissionTab({ project, workflowState, onUpdate, onMarkComplete, onNavigateToTab }: SubmissionTabProps) {
  const [editingPaymentPlan, setEditingPaymentPlan] = useState<SubmissionVendor | null>(null);
  const [editingVendor, setEditingVendor] = useState<SubmissionVendor | null>(null);
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<AttachedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [editVendorDocuments, setEditVendorDocuments] = useState<AttachedFile[]>([]);
  const [editUploadProgress, setEditUploadProgress] = useState<{ [key: string]: number }>({});
  const [activeTab, setActiveTab] = useState<string>("vendors");

  // Get category from file name
  const getCategoryFromFileName = (fileName: string): string => {
    const lower = fileName.toLowerCase();
    if (lower.includes('invoice') || lower.includes('bill')) return 'invoice';
    if (lower.includes('receipt')) return 'receipt';
    if (lower.includes('contract')) return 'contract';
    if (lower.includes('quote') || lower.includes('estimate')) return 'quote';
    return 'document';
  };

  const { toast } = useToast();
  const { t } = useLanguage();

  // Defensive null check for project data
  if (!project) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('submissionProjectDataMissing')}
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
  const { mutate: reopenStep, isPending: isReopening } = useReopenWorkflowStep();
  const { createSubmissionVendor, updateSubmissionVendor, updatePreferredStatus, deleteSubmissionVendor } = useSubmissionVendorMutations();

  // Form for new submission
  const submissionForm = useForm<NewSubmissionForm>({
    resolver: zodResolver(newSubmissionSchema),
    defaultValues: {
      vendorName: '',
      availableDate: undefined,
      description: '',
      preferred: false,
      // Payment plan defaults - unique payment
      paymentType: 'unique',
      totalAmount: '',
      schedulePayment: undefined,
      dateFirstPayment: undefined,
      dateEndPayment: undefined,
      hasInitialPayment: false,
      recurringPaymentsEqual: true,
      initialPaymentAmount: '',
      recurringPaymentAmount: '',
      customPayments: [],
    },
  });

  // Form for editing vendor
  const editVendorForm = useForm<EditVendorForm>({
    resolver: zodResolver(editVendorSchema),
    defaultValues: {
      vendorName: '',
      availableDate: undefined,
      description: '',
      contactInfo: '',
      preferred: false,
      // Payment plan defaults - unique payment
      paymentType: 'unique',
      totalAmount: '',
      schedulePayment: undefined,
      dateFirstPayment: undefined,
      dateEndPayment: undefined,
      hasInitialPayment: false,
      recurringPaymentsEqual: true,
      initialPaymentAmount: '',
      recurringPaymentAmount: '',
      customPayments: [],
    },
  });

  const canAdvance = workflowState.canAdvance && workflowState.currentStatus === 'submission';
  const hasPreferredVendor = submissionVendors.some(v => v.preferred);


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

    // Convert existing documents to AttachedFile format for editing
    // Filter out documents with invalid/incomplete metadata
    const existingDocs: AttachedFile[] = (vendor.documents && Array.isArray(vendor.documents)) 
      ? vendor.documents
          .filter(doc => {
            // Filter out documents with incomplete or invalid metadata
            const hasValidName = doc.name && doc.name !== 'unknown' && doc.name.trim() !== '';
            const hasValidSize = doc.size !== null && doc.size !== undefined && doc.size > 0;
            const hasValidId = doc.id && doc.id.trim() !== '';
            return hasValidName && hasValidSize && hasValidId;
          })
          .map(doc => ({
            id: doc.id || crypto.randomUUID(),
            isExisting: true,
            name: doc.name,
            size: doc.size || 0,
            type: doc.type || 'application/octet-stream',
            url: doc.id ? `/api/maintenance/documents/${doc.id}/file` : undefined,
            uploadProgress: 100, // Existing files are already uploaded
            category: getCategoryFromFileName(doc.name || ''),
          }))
      : [];
    setEditVendorDocuments(existingDocs);
    
    // Convert existing payment plan data back to form format
    const paymentPlanCosts = vendor.paymentPlanCosts || [];
    const hasPaymentPlan = paymentPlanCosts.length > 0;
    
    let paymentType: 'unique' | 'recurrent' = 'unique';
    let totalAmount = vendor.price || '0';
    let schedulePayment: string | undefined;
    let hasInitialPayment = false;
    let recurringPaymentsEqual = true;
    let initialPaymentAmount = '';
    let recurringPaymentAmount = '';
    let customPayments: any[] = [];

    if (hasPaymentPlan) {
      if (vendor.paymentPlanSchedule) {
        // Has a schedule, so it's recurrent
        paymentType = 'recurrent';
        schedulePayment = vendor.paymentPlanSchedule;
        
        if (vendor.paymentPlanSchedule === 'custom' && vendor.paymentPlanCustomDates?.length > 0) {
          // Custom payment schedule
          recurringPaymentsEqual = false;
          customPayments = paymentPlanCosts.map((cost, index) => ({
            amount: cost.toString(),
            date: vendor.paymentPlanCustomDates?.[index] || '',
            description: `Payment ${index + 1}`
          }));
        } else {
          // Regular recurring payments
          if (paymentPlanCosts.length === 1) {
            recurringPaymentAmount = paymentPlanCosts[0].toString();
          } else if (paymentPlanCosts.length > 1) {
            // Check if first payment is different (initial payment)
            const firstCost = paymentPlanCosts[0];
            const otherCosts = paymentPlanCosts.slice(1);
            
            if (otherCosts.length > 0 && otherCosts.every(cost => cost === otherCosts[0])) {
              hasInitialPayment = true;
              initialPaymentAmount = firstCost.toString();
              recurringPaymentAmount = otherCosts[0].toString();
            } else {
              recurringPaymentAmount = firstCost.toString();
            }
          }
        }
      } else {
        // No schedule, single payment
        paymentType = 'unique';
        totalAmount = paymentPlanCosts[0]?.toString() || totalAmount;
      }
    }

    // Populate form with vendor data including payment plan
    editVendorForm.reset({
      vendorName: vendor.vendorName,
      availableDate: vendor.availableDate ? new Date(vendor.availableDate) : undefined,
      description: vendor.notes || '',
      contactInfo: vendor.contactInfo || '',
      preferred: vendor.preferred,
      // Payment plan fields
      paymentType,
      totalAmount,
      schedulePayment,
      dateFirstPayment: vendor.paymentPlanStartDate ? new Date(vendor.paymentPlanStartDate) : undefined,
      dateEndPayment: undefined, // Not used in current implementation
      hasInitialPayment,
      recurringPaymentsEqual,
      initialPaymentAmount,
      recurringPaymentAmount,
      customPayments,
    });
  };

  const handleSaveVendorEdit = (data: EditVendorForm) => {
    if (!editingVendor) return;

    // Block submit while any attachment upload is still pending.
    const hasPendingUpload = editVendorDocuments.some(
      doc => doc.file && (doc.uploadProgress ?? 0) < 100
    );
    if (hasPendingUpload) {
      toast({
        title: t('submissionUploadInProgressTitle'),
        description: t('submissionUploadInProgressSaveDesc'),
      });
      return;
    }

    // Convert payment plan data from bills format to submission vendor format
    let paymentPlanCosts: string[] = [];
    let paymentPlanSchedule: string | undefined;
    let paymentPlanCustomDates: string[] = [];
    let paymentPlanStartDate: string | undefined;

    // Set payment start date from dateFirstPayment
    if (data.dateFirstPayment) {
      paymentPlanStartDate = format(data.dateFirstPayment, 'yyyy-MM-dd');
    }

    if (data.paymentType === 'unique') {
      // Single payment
      const amount = parseFloat(data.totalAmount || '0');
      if (amount > 0) {
        paymentPlanCosts = [amount];
      }
    } else if (data.paymentType === 'recurrent') {
      // Recurring payments
      paymentPlanSchedule = data.schedulePayment;
      
      if (data.schedulePayment === 'custom' && data.customPayments.length > 0) {
        // Custom payment schedule
        paymentPlanCosts = data.customPayments.map(p => parseFloat(p.amount));
        paymentPlanCustomDates = data.customPayments.map(p => p.date);
      } else {
        // Regular recurring payments
        if (data.hasInitialPayment && data.initialPaymentAmount) {
          paymentPlanCosts.push(parseFloat(data.initialPaymentAmount));
        }
        if (data.recurringPaymentAmount) {
          paymentPlanCosts.push(parseFloat(data.recurringPaymentAmount));
        }
      }
    }

    updateSubmissionVendor.mutate({
      projectId: project.id,
      vendorId: editingVendor.id,
      updates: {
        vendorName: data.vendorName,
        availableDate: data.availableDate ? format(data.availableDate, 'yyyy-MM-dd') : undefined,
        notes: data.description,
        contactInfo: data.contactInfo,
        preferred: data.preferred,
        // Include documents from editVendorDocuments
        documents: editVendorDocuments.map(doc => ({
          id: doc.id,
          name: doc.file?.name || doc.name || 'unknown',
          url: doc.url || '', 
          size: doc.file?.size || doc.size || 0,
          type: doc.file?.type || doc.type || 'application/octet-stream',
        })),
        // Payment plan data
        paymentPlanCosts,
        paymentPlanSchedule,
        paymentPlanCustomDates,
        paymentPlanStartDate,
      },
    }, {
      onSuccess: () => {
        setEditingVendor(null);
        editVendorForm.reset();
        setEditVendorDocuments([]);
        setEditUploadProgress({});
        onUpdate();
      },
    });
  };

  const handleCancelVendorEdit = () => {
    setEditingVendor(null);
    editVendorForm.reset();
    setEditVendorDocuments([]);
    setEditUploadProgress({});
  };

  // Handle deleting a vendor
  const handleDeleteVendor = (vendorToDelete: SubmissionVendor) => {
    if (!window.confirm(`Are you sure you want to delete the submission from ${vendorToDelete.vendorName}? This action cannot be undone.`)) {
      return;
    }

    deleteSubmissionVendor.mutate({
      projectId: project.id,
      vendorId: vendorToDelete.id,
    }, {
      onSuccess: () => {
        // Close edit dialog and refresh data
        setEditingVendor(null);
        editVendorForm.reset();
        setEditVendorDocuments([]);
        setEditUploadProgress({});
        onUpdate();
      },
    });
  };

  const handleTogglePreferred = (vendor: SubmissionVendor) => {
    updatePreferredStatus.mutate({
      projectId: project.id,
      vendorId: vendor.id,
      preferred: !vendor.preferred,
    });
  };

  const handleMarkComplete = () => {
    if (onMarkComplete) {
      // Delegate to parent so it can advance the workflow tab after success.
      onMarkComplete();
      return;
    }

    markComplete({
      projectId: project.id,
      currentStatus: 'submission',
    }, {
      onSuccess: () => {
        onUpdate();
      },
    });
  };

  const handleReopen = () => {
    // Validate that we have the required data
    if (!project.id || !workflowState.currentStatus) {
      toast({
        title: t('cannotReopenStepTitle'),
        description: t('reopenStepWorkflowDataUnavailableDesc'),
        variant: "destructive",
      });
      return;
    }

    // Validate that current status matches this tab's phase
    if (workflowState.currentStatus !== 'submission') {
      toast({
        title: t('cannotReopenStepTitle'),
        description: t('reopenStepWrongPhaseSubmissionDesc'),
        variant: "destructive",
      });
      return;
    }

    reopenStep(
      { projectId: project.id, currentStatus: workflowState.currentStatus },
      { 
        onSuccess: () => {
          toast({
            title: t('reopenStepSuccessTitle'),
            description: t('reopenStepReturnedSuccessDesc'),
          });
          onUpdate();
        },
        onError: (error: any) => {
          toast({
            title: t('failedToReopenStepTitle'),
            description: error.message || t('reopenStepFailedDesc'),
            variant: "destructive",
          });
        }
      }
    );
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
    // Block submit while any attachment upload is still in flight. This
    // prevents the client-side temporary UUID from being persisted into
    // submissionVendors.documents (which would cause later file lookups to
    // fail since that id does not exist in the documents table).
    const hasPendingUpload = uploadedDocuments.some(
      doc => doc.file && (doc.uploadProgress ?? 0) < 100
    );
    if (hasPendingUpload) {
      toast({
        title: t('submissionUploadInProgressTitle'),
        description: t('submissionUploadInProgressSubmitDesc'),
      });
      return;
    }

    // Convert payment plan data from bills format to submission vendor format
    let paymentPlanCosts: number[] = [];
    let paymentPlanSchedule: string | undefined;
    let paymentPlanCustomDates: string[] = [];
    let paymentPlanStartDate: string | undefined;

    // Set payment start date from dateFirstPayment
    if (data.dateFirstPayment) {
      paymentPlanStartDate = format(data.dateFirstPayment, 'yyyy-MM-dd');
    }

    if (data.paymentType === 'unique') {
      // Single payment
      const amount = parseFloat(data.totalAmount || '0');
      if (amount > 0) {
        paymentPlanCosts = [amount];
      }
    } else if (data.paymentType === 'recurrent') {
      // Recurring payments
      paymentPlanSchedule = data.schedulePayment;
      
      if (data.schedulePayment === 'custom' && data.customPayments.length > 0) {
        // Custom payment schedule
        paymentPlanCosts = data.customPayments.map(p => parseFloat(p.amount));
        paymentPlanCustomDates = data.customPayments.map(p => p.date);
      } else {
        // Regular recurring payments
        if (data.hasInitialPayment && data.initialPaymentAmount) {
          paymentPlanCosts.push(parseFloat(data.initialPaymentAmount));
        }
        if (data.recurringPaymentAmount) {
          paymentPlanCosts.push(parseFloat(data.recurringPaymentAmount));
        }
      }
    }

    // Convert form data to the API format
    const vendorData = {
      vendorName: data.vendorName,
      availableDate: data.availableDate ? format(data.availableDate, 'yyyy-MM-dd') : undefined,
      price: data.price?.toString(), // Keep original price behavior
      description: data.description || '',
      preferred: data.preferred || false,
      documents: uploadedDocuments.map(doc => ({
        id: doc.id,
        name: doc.file?.name || 'unknown',
        url: '', // This would be set by the server after upload
        size: doc.file?.size || 0,
        type: doc.file?.type || 'application/octet-stream',
      })),
      // Add other required fields with defaults
      contactInfo: '',
      notes: data.description || '',
      projectType: 'not_sure' as const, // Default project type
      addedLifespan: undefined,
      isSelected: false,
      // Payment plan data
      paymentPlanCosts,
      paymentPlanSchedule,
      paymentPlanCustomDates,
      paymentPlanStartDate,
    };

    // Creating new submission - submission data processed

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

  // Upload a file to /api/documents/upload and return the created document
  // record. We use the real `document.id` as the AttachedFile id so that the
  // id persisted into submissionVendors.documents JSONB matches the primary
  // key in the documents table — letting the file-serving endpoint look up
  // the actual filePath instead of guessing from the filename on disk.
  const uploadFileToDocumentsApi = async (file: File, tempId: string, onProgress?: (pct: number) => void): Promise<{ id: string; filePath: string } | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    formData.append('documentType', 'maintenance');
    formData.append('buildingId', project.buildingId);
    formData.append('attachedToType', 'submission_vendor');
    formData.append('attachedToId', project.id);
    formData.append('isVisibleToTenants', 'false');

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/documents/upload');
      xhr.withCredentials = true;
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response.document ? { id: response.document.id, filePath: response.document.filePath } : null);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
      xhr.addEventListener('error', () => resolve(null));
      xhr.send(formData);
    });
  };

  // Handle document changes from StandardDocumentAttachments
  const handleDocumentChange = async (file: File | null, text: string | null) => {
    if (!file) return;

    const tempId = crypto.randomUUID();
    const newAttachment: AttachedFile = {
      id: tempId,
      file,
      uploadProgress: 0,
    };
    setUploadedDocuments(prev => [...prev, newAttachment]);
    setUploadProgress(prev => ({ ...prev, [tempId]: 0 }));

    const uploaded = await uploadFileToDocumentsApi(file, tempId, (pct) => {
      setUploadProgress(prev => ({ ...prev, [tempId]: pct }));
    });

    if (uploaded) {
      setUploadedDocuments(prev =>
        prev.map(doc =>
          doc.id === tempId
            ? { ...doc, id: uploaded.id, url: `/api/maintenance/documents/${uploaded.id}/file`, uploadProgress: 100 }
            : doc
        )
      );
      setUploadProgress(prev => {
        const { [tempId]: _, ...rest } = prev;
        return { ...rest, [uploaded.id]: 100 };
      });
    } else {
      // Upload failed — remove the attachment and notify the user
      setUploadedDocuments(prev => prev.filter(doc => doc.id !== tempId));
      setUploadProgress(prev => {
        const { [tempId]: _, ...rest } = prev;
        return rest;
      });
      toast({
        title: t('submissionUploadFailedTitle'),
        description: t('submissionUploadFailedDescTemplate').replace('{fileName}', file.name),
        variant: 'destructive',
      });
    }
  };

  // Handle removing files
  const handleRemoveFile = (fileId: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== fileId));
  };

  // Handle document changes from StandardDocumentAttachments for edit vendor
  const handleEditDocumentChange = async (file: File | null, text: string | null) => {
    if (!file) return;

    const tempId = crypto.randomUUID();
    const newAttachment: AttachedFile = {
      id: tempId,
      file,
      uploadProgress: 0,
    };
    setEditVendorDocuments(prev => [...prev, newAttachment]);
    setEditUploadProgress(prev => ({ ...prev, [tempId]: 0 }));

    const uploaded = await uploadFileToDocumentsApi(file, tempId, (pct) => {
      setEditUploadProgress(prev => ({ ...prev, [tempId]: pct }));
    });

    if (uploaded) {
      setEditVendorDocuments(prev =>
        prev.map(doc =>
          doc.id === tempId
            ? { ...doc, id: uploaded.id, url: `/api/maintenance/documents/${uploaded.id}/file`, uploadProgress: 100 }
            : doc
        )
      );
      setEditUploadProgress(prev => {
        const { [tempId]: _, ...rest } = prev;
        return { ...rest, [uploaded.id]: 100 };
      });
    } else {
      setEditVendorDocuments(prev => prev.filter(doc => doc.id !== tempId));
      setEditUploadProgress(prev => {
        const { [tempId]: _, ...rest } = prev;
        return rest;
      });
      toast({
        title: t('submissionUploadFailedTitle'),
        description: t('submissionUploadFailedDescTemplate').replace('{fileName}', file.name),
        variant: 'destructive',
      });
    }
  };

  // Handle removing files for edit vendor
  const handleEditRemoveFile = async (fileId: string) => {
    const docToRemove = editVendorDocuments.find(doc => doc.id === fileId);
    
    // If it's an existing document, delete it from the server
    if (docToRemove?.isExisting) {
      try {
        const response = await fetch(`/api/maintenance/documents/${fileId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          console.error('Failed to delete document from server');
          return;
        }
      } catch (error) {
        console.error('Error deleting document:', error);
        return;
      }
    }
    
    // Remove from local state
    setEditVendorDocuments(prev => prev.filter(doc => doc.id !== fileId));
  };

  return (
    <div className="space-y-6" data-testid="submission-tab">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{t('submissionManagementHeader')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('submissionManagementSubheader')}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Skip option info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>{t('postWorkSkippableInfo')}</span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={cn("grid w-full", hasPreferredVendor ? "grid-cols-2" : "grid-cols-1")}>
          <TabsTrigger value="vendors" data-testid="tab-vendor-submissions">
            {t('submissionVendorSubmissionsHeader')}
          </TabsTrigger>
          {hasPreferredVendor && (
            <TabsTrigger value="elements" data-testid="tab-element-management">
              {t('submissionElementManagementTab')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="vendors" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-semibold">{t('submissionVendorSubmissionsHeader')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('submissionVendorSubmissionsSubheader')}
              </p>
            </div>
          
            <div className="flex items-center gap-3">
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
                {t('submissionAddSubmissionButton')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="add-submission-description">
              <DialogHeader>
                <DialogTitle>{t('submissionAddNewVendorTitle')}</DialogTitle>
                <div id="add-submission-description" className="sr-only">
                  {t('submissionAddSubmissionDescriptionSr')}
                </div>
              </DialogHeader>
              <Form {...submissionForm}>
                <form onSubmit={submissionForm.handleSubmit(handleSubmissionSubmit)} className="space-y-4 pb-4">
                  {/* Vendor Name */}
                  <FormField
                    control={submissionForm.control}
                    name="vendorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('submissionVendorNameLabel')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('submissionVendorNamePlaceholder')}
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
                        <FormLabel>{t('submissionAvailableDateLabel')}</FormLabel>
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
                          {t('wfSubmissionAvailableDateDesc')}
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
                        <FormLabel>{t('submissionDescriptionLabel')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('submissionDescriptionPlaceholder')}
                            rows={3}
                            data-testid="textarea-description"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('wfSubmissionAdditionalDetailsDesc')}
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
                      organizationId: project.organizationId,
                      buildingId: project.buildingId,
                      projectId: project.id,
                    }}
                    title={t('submissionDocumentsOptionalTitle')}
                    showUploadTabs={false}
                    defaultUploadTab="file"
                    aiEnabled={false}
                    showAiToggle={false}
                    className="border rounded-lg"
                  />

                  {/* Payment Plan Section */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      <h4 className="text-sm font-semibold">{t('submissionPaymentPlanHeader')}</h4>
                    </div>

                    {/* Payment Type */}
                    <FormField
                      control={submissionForm.control}
                      name="paymentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('submissionPaymentTypeLabel')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-payment-type">
                                <SelectValue placeholder={t('submissionSelectPaymentTypePlaceholder')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="unique">{t('submissionPaymentTypeOneTime')}</SelectItem>
                              <SelectItem value="recurrent">{t('submissionPaymentTypeRecurring')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {t('submissionPaymentTypeDescription')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* One-time Payment Options */}
                    {submissionForm.watch('paymentType') === 'unique' && (
                      <div className="space-y-4">
                        <FormField
                          control={submissionForm.control}
                          name="totalAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('submissionTotalAmountLabel')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  data-testid="input-total-amount"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {t('submissionTotalAmountDescription')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Payment Date (for one-time payments) */}
                        <FormField
                          control={submissionForm.control}
                          name="dateFirstPayment"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('submissionPaymentDateLabel')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  value={field.value ? field.value.toISOString().split('T')[0] : ''}
                                  onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                  data-testid="input-unique-payment-date"
                                />
                              </FormControl>
                              <FormDescription>
                                {t('submissionPaymentDateDescription')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Recurring Payment Options */}
                    {submissionForm.watch('paymentType') === 'recurrent' && (
                      <div className="space-y-4">
                        {/* Schedule Payment */}
                        <FormField
                          control={submissionForm.control}
                          name="schedulePayment"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('submissionPaymentScheduleLabel')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-schedule-payment">
                                    <SelectValue placeholder={t('submissionSelectPaymentSchedulePlaceholder')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="weekly">{t('submissionScheduleWeekly')}</SelectItem>
                                  <SelectItem value="monthly">{t('submissionScheduleMonthly')}</SelectItem>
                                  <SelectItem value="quarterly">{t('submissionScheduleQuarterly')}</SelectItem>
                                  <SelectItem value="yearly">{t('submissionScheduleYearly')}</SelectItem>
                                  <SelectItem value="custom">{t('submissionScheduleCustom')}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Date First Payment */}
                        <FormField
                          control={submissionForm.control}
                          name="dateFirstPayment"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('submissionDateFirstPaymentLabel')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  value={field.value ? field.value.toISOString().split('T')[0] : ''}
                                  onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                  data-testid="input-date-first-payment"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Date End Payment */}
                        <FormField
                          control={submissionForm.control}
                          name="dateEndPayment"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('submissionDateEndPaymentLabel')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  value={field.value ? field.value.toISOString().split('T')[0] : ''}
                                  onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                  data-testid="input-date-end-payment"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Has Initial Payment */}
                        <FormField
                          control={submissionForm.control}
                          name="hasInitialPayment"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-has-initial-payment"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>{t('submissionHasInitialPaymentLabel')}</FormLabel>
                                <FormDescription>
                                  {t('submissionHasInitialPaymentDescription')}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        {/* Initial Payment Amount */}
                        {submissionForm.watch('hasInitialPayment') && (
                          <FormField
                            control={submissionForm.control}
                            name="initialPaymentAmount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('submissionInitialPaymentAmountLabel')}</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    data-testid="input-initial-payment-amount"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {/* Recurring Payments Equal */}
                        <FormField
                          control={submissionForm.control}
                          name="recurringPaymentsEqual"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-recurring-payments-equal"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>{t('submissionEqualRecurringLabel')}</FormLabel>
                                <FormDescription>
                                  {t('submissionEqualRecurringDescription')}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        {/* Recurring Payment Amount */}
                        {submissionForm.watch('recurringPaymentsEqual') && (
                          <FormField
                            control={submissionForm.control}
                            name="recurringPaymentAmount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('submissionRecurringPaymentAmountLabel')}</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    data-testid="input-recurring-payment-amount"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {/* Custom Payments */}
                        {!submissionForm.watch('recurringPaymentsEqual') && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <FormLabel>{t('submissionCustomPaymentAmountsLabel')}</FormLabel>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const currentPayments = submissionForm.getValues('customPayments') || [];
                                  submissionForm.setValue('customPayments', [
                                    ...currentPayments,
                                    { amount: '', date: '', description: '' }
                                  ]);
                                }}
                                data-testid="button-add-custom-payment"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                {t('submissionAddPaymentButton')}
                              </Button>
                            </div>
                            
                            {submissionForm.watch('customPayments')?.map((payment, index) => (
                              <div key={`sub-payment-${payment.date || ''}-${index}`} className="flex items-center gap-2 p-3 border rounded">
                                <div className="flex-1 space-y-2">
                                  <FormField
                                    control={submissionForm.control}
                                    name={`customPayments.${index}.amount`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">{t('submissionCustomPaymentAmountSubLabel')}</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            data-testid={`input-custom-payment-amount-${index}`}
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={submissionForm.control}
                                    name={`customPayments.${index}.date`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">{t('submissionCustomPaymentDateSubLabel')}</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="date"
                                            data-testid={`input-custom-payment-date-${index}`}
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={submissionForm.control}
                                    name={`customPayments.${index}.description`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">{t('submissionCustomPaymentDescriptionSubLabel')}</FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder={t('submissionCustomPaymentDescriptionPlaceholder')}
                                            data-testid={`input-custom-payment-description-${index}`}
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const currentPayments = submissionForm.getValues('customPayments') || [];
                                    const newPayments = currentPayments.filter((_, i) => i !== index);
                                    submissionForm.setValue('customPayments', newPayments);
                                  }}
                                  data-testid={`button-remove-custom-payment-${index}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

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
                          <FormLabel>{t('submissionMarkAsPreferredLabel')}</FormLabel>
                          <FormDescription>
                            {t('submissionMarkAsPreferredDescription')}
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
                      {t('submissionCancelButton')}
                    </Button>
                    <Button type="submit" data-testid="button-submit" disabled={createSubmissionVendor.isPending}>
                      {createSubmissionVendor.isPending ? t('submissionAddingButton') : t('submissionAddSubmissionButton')}
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
            {t('submissionFailedToLoadVendors')}: {vendorsError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Vendor Submissions */}
      {submissionVendors.length === 0 && !isLoadingVendors && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('submissionNoSubmissionsYetTitle')}
            </CardTitle>
            <CardDescription>
              {t('submissionNoSubmissionsYetDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 space-y-4">
              <Users className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h4 className="text-lg font-semibold">{t('submissionNoVendorSubmissionsHeader')}</h4>
                <p className="text-muted-foreground">
                  {t('submissionNoVendorSubmissionsYetMessage')}
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
              {t('submissionVendorSubmissionsHeader')} ({submissionVendors.length})
            </h4>
            <div className="flex items-center gap-2">
              {submissionVendors.some(v => v.preferred) && (
                <Badge variant="outline" className="border-yellow-400 text-yellow-600">
                  <Star className="h-3 w-3 mr-1" />
                  {t('submissionPreferredCountTemplate').replace('{count}', String(submissionVendors.filter(v => v.preferred).length))}
                </Badge>
              )}
            </div>
          </div>

          {submissionVendors.map((vendor) => (
            <Card 
              key={vendor.id} 
              className={cn(
                'transition-all',
                vendor.preferred && 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950'
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div>
                      <CardTitle className="text-lg">{vendor.vendorName}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        {vendor.availableDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {t('submissionAvailableLabel')}: {(parseDateOnly(vendor.availableDate) ?? new Date(vendor.availableDate)).toLocaleDateString()}
                          </span>
                        )}
                        {vendor.contactInfo && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {t('submissionContactAvailable')}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {formatStatus(vendor.projectType, 'Not specified')}
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="text-right space-y-2">
                    <div className="flex flex-col gap-1">
                      {vendor.preferred && (
                        <Badge className="bg-yellow-600">
                          <Star className="h-3 w-3 mr-1" />
                          {t('submissionPreferredBadge')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditVendor(vendor);
                        }}
                        data-testid={`button-edit-${vendor.id}`}
                        className="w-full mb-1"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        {t('submissionEditButton')}
                      </Button>
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
                        {vendor.preferred ? t('submissionUnmarkPreferredButton') : t('submissionMarkAsPreferredButton')}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Proposal Details */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">{t('submissionProposalDetailsHeader')}</h5>
                    
                    {/* Description */}
                    {vendor.notes ? (
                      <div className="p-2 bg-muted/50 rounded text-sm">
                        <p className="text-muted-foreground">{vendor.notes}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">{t('submissionNoDescriptionProvided')}</p>
                    )}
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      {vendor.availableDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{t('submissionAvailableForWorkLabel')}: {(parseDateOnly(vendor.availableDate) ?? new Date(vendor.availableDate)).toLocaleDateString()}</span>
                        </div>
                      )}
                      {vendor.addedLifespan && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{t('submissionExtendsLifespanTemplate').replace('{years}', String(vendor.addedLifespan))}</span>
                        </div>
                      )}
                      {vendor.documents && Array.isArray(vendor.documents) && vendor.documents.length > 0 && (
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          <span>{t('submissionDocumentsSubmittedTemplate').replace('{count}', String(vendor.documents.length))}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Plan */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-sm">{t('submissionPaymentPlanHeader')}</h5>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        <span>{t('submissionPaymentScheduleSummaryTemplate').replace('{schedule}', formatPaymentSchedule(vendor.paymentPlanSchedule))}</span>
                      </div>
                      {vendor.paymentPlanStartDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{t('submissionPaymentStartsTemplate').replace('{date}', (parseDateOnly(vendor.paymentPlanStartDate) ?? new Date(vendor.paymentPlanStartDate)).toLocaleDateString())}</span>
                        </div>
                      )}
                      {vendor.paymentPlanCosts && vendor.paymentPlanCosts.length > 0 && (
                        <div>
                          <span>{t('submissionPaymentBreakdownLabel')}</span>
                          <div className="ml-4 mt-1">
                            {vendor.paymentPlanCosts.map((cost, i) => (
                              <div key={`plan-cost-${formatCurrency(cost)}-${i}`} className="text-xs">
                                {t('submissionPaymentItemTemplate').replace('{index}', String(i + 1)).replace('{amount}', formatCurrency(cost))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(!vendor.paymentPlanCosts || vendor.paymentPlanCosts.length === 0) && (
                        <div className="text-xs text-muted-foreground italic">
                          {t('submissionNoPaymentPlanConfigured')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                {vendor.contactInfo && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <h5 className="font-medium text-sm mb-2">{t('submissionContactInformationHeader')}</h5>
                    <p className="text-sm text-muted-foreground">{vendor.contactInfo}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}


      {/* Payment Plan Edit Dialog */}
      <Dialog 
        open={!!editingPaymentPlan} 
        onOpenChange={(open) => !open && handleCancelPaymentPlan()}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="payment-plan-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t('submissionEditPaymentPlanTitleTemplate').replace('{vendor}', editingPaymentPlan?.vendorName ?? '')}
            </DialogTitle>
            <div id="payment-plan-description" className="sr-only">
              {t('submissionEditPaymentPlanDescription')}
            </div>
          </DialogHeader>
          
          {editingPaymentPlan && (
            <PaymentPlanForm
              initialData={{
                paymentPlanCosts: editingPaymentPlan.paymentPlanCosts,
                paymentPlanSchedule: editingPaymentPlan.paymentPlanSchedule,
                paymentPlanStartDate: editingPaymentPlan.paymentPlanStartDate,
                paymentPlanCustomDates: editingPaymentPlan.paymentPlanCustomDates,
              }}
              totalAmount={undefined}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-vendor-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {t('submissionEditVendorTitleTemplate').replace('{vendor}', editingVendor?.vendorName ?? '')}
            </DialogTitle>
            <div id="edit-vendor-description" className="sr-only">
              {t('submissionEditVendorDialogDescription')}
            </div>
          </DialogHeader>
          
          {editingVendor && (
            <Form {...editVendorForm}>
              <form onSubmit={editVendorForm.handleSubmit(handleSaveVendorEdit)} className="space-y-4">
                <FormField
                  control={editVendorForm.control}
                  name="vendorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('submissionVendorNameLabelEdit')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('submissionVendorNamePlaceholder')} {...field} />
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
                      <FormLabel>{t('submissionAvailableDateLabel')}</FormLabel>
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
                          data-testid="input-edit-available-date"
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
                      <FormLabel>{t('submissionDescriptionLabel')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t('submissionDescriptionPlaceholderEdit')} 
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
                      <FormLabel>{t('submissionContactInformationLabel')}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={t('submissionContactInformationPlaceholder')} 
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Payment Plan Section for Edit Vendor */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <h4 className="text-sm font-semibold">{t('submissionPaymentPlanHeader')}</h4>
                  </div>

                  {/* Payment Type */}
                  <FormField
                    control={editVendorForm.control}
                    name="paymentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('submissionPaymentTypeLabel')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-payment-type">
                              <SelectValue placeholder={t('submissionSelectPaymentTypePlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unique">{t('submissionPaymentTypeOneTime')}</SelectItem>
                            <SelectItem value="recurrent">{t('submissionPaymentTypeRecurring')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {t('submissionPaymentTypeDescription')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* One-time Payment Options */}
                  {editVendorForm.watch('paymentType') === 'unique' && (
                    <div className="space-y-4">
                      <FormField
                        control={editVendorForm.control}
                        name="totalAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('submissionTotalAmountLabel')}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                data-testid="input-edit-total-amount"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('submissionTotalAmountDescription')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Payment Date (for one-time payments) */}
                      <FormField
                        control={editVendorForm.control}
                        name="dateFirstPayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('submissionPaymentDateLabel')}</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value ? field.value.toISOString().split('T')[0] : ''}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                data-testid="input-edit-unique-payment-date"
                              />
                            </FormControl>
                            <FormDescription>
                              {t('submissionPaymentDateDescription')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Recurring Payment Options */}
                  {editVendorForm.watch('paymentType') === 'recurrent' && (
                    <div className="space-y-4">
                      {/* Schedule Payment */}
                      <FormField
                        control={editVendorForm.control}
                        name="schedulePayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('submissionPaymentScheduleLabel')}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-edit-schedule-payment">
                                  <SelectValue placeholder={t('submissionSelectPaymentSchedulePlaceholder')} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="weekly">{t('submissionScheduleWeekly')}</SelectItem>
                                <SelectItem value="monthly">{t('submissionScheduleMonthly')}</SelectItem>
                                <SelectItem value="quarterly">{t('submissionScheduleQuarterly')}</SelectItem>
                                <SelectItem value="yearly">{t('submissionScheduleYearly')}</SelectItem>
                                <SelectItem value="custom">{t('submissionScheduleCustom')}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Date First Payment */}
                      <FormField
                        control={editVendorForm.control}
                        name="dateFirstPayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('submissionDateFirstPaymentLabel')}</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value ? field.value.toISOString().split('T')[0] : ''}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                data-testid="input-edit-date-first-payment"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Date End Payment */}
                      <FormField
                        control={editVendorForm.control}
                        name="dateEndPayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('submissionDateEndPaymentLabel')}</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value ? field.value.toISOString().split('T')[0] : ''}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                data-testid="input-edit-date-end-payment"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Has Initial Payment */}
                      <FormField
                        control={editVendorForm.control}
                        name="hasInitialPayment"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-edit-has-initial-payment"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>{t('submissionHasInitialPaymentLabel')}</FormLabel>
                              <FormDescription>
                                {t('submissionHasInitialPaymentDescription')}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />

                      {/* Initial Payment Amount */}
                      {editVendorForm.watch('hasInitialPayment') && (
                        <FormField
                          control={editVendorForm.control}
                          name="initialPaymentAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('submissionInitialPaymentAmountLabel')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  data-testid="input-edit-initial-payment-amount"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Recurring Payments Equal */}
                      <FormField
                        control={editVendorForm.control}
                        name="recurringPaymentsEqual"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-edit-recurring-payments-equal"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>{t('submissionEqualRecurringLabel')}</FormLabel>
                              <FormDescription>
                                {t('submissionEqualRecurringDescription')}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />

                      {/* Recurring Payment Amount */}
                      {editVendorForm.watch('recurringPaymentsEqual') && (
                        <FormField
                          control={editVendorForm.control}
                          name="recurringPaymentAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('submissionRecurringPaymentAmountLabel')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  data-testid="input-edit-recurring-payment-amount"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Custom Payments */}
                      {!editVendorForm.watch('recurringPaymentsEqual') && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <FormLabel>{t('submissionCustomPaymentAmountsLabel')}</FormLabel>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentPayments = editVendorForm.getValues('customPayments') || [];
                                editVendorForm.setValue('customPayments', [
                                  ...currentPayments,
                                  { amount: '', date: '', description: '' }
                                ]);
                              }}
                              data-testid="button-edit-add-custom-payment"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              {t('submissionAddPaymentButton')}
                            </Button>
                          </div>
                          
                          {editVendorForm.watch('customPayments')?.map((payment, index) => (
                            <div key={`edit-payment-${payment.date || ''}-${payment.amount || ''}-${index}`} className="flex items-center gap-2 p-3 border rounded">
                              <div className="flex-1 space-y-2">
                                <FormField
                                  control={editVendorForm.control}
                                  name={`customPayments.${index}.amount`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">{t('submissionCustomPaymentAmountSubLabel')}</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          placeholder="0.00"
                                          data-testid={`input-edit-custom-payment-amount-${index}`}
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={editVendorForm.control}
                                  name={`customPayments.${index}.date`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">{t('submissionCustomPaymentDateSubLabel')}</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="date"
                                          data-testid={`input-edit-custom-payment-date-${index}`}
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={editVendorForm.control}
                                  name={`customPayments.${index}.description`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">{t('submissionCustomPaymentDescriptionSubLabel')}</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder={t('submissionCustomPaymentDescriptionPlaceholder')}
                                          data-testid={`input-edit-custom-payment-description-${index}`}
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const currentPayments = editVendorForm.getValues('customPayments') || [];
                                  const newPayments = currentPayments.filter((_, i) => i !== index);
                                  editVendorForm.setValue('customPayments', newPayments);
                                }}
                                data-testid={`button-edit-remove-custom-payment-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Document Upload using StandardDocumentAttachments */}
                <div className="space-y-2">
                  <StandardDocumentAttachments
                    onDocumentChange={handleEditDocumentChange}
                    attachedFiles={editVendorDocuments}
                    onRemoveFile={handleEditRemoveFile}
                    uploadProgress={editUploadProgress}
                    uploadContext={{
                      type: 'maintenance',
                      organizationId: project.organizationId,
                      buildingId: project.buildingId,
                      projectId: project.id,
                    }}
                    title={t('submissionDocumentsTitle')}
                    showUploadTabs={false}
                    defaultUploadTab="file"
                    aiEnabled={false}
                    showAiToggle={false}
                  />
                </div>

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
                        <FormLabel>{t('submissionMarkAsPreferredLabel')}</FormLabel>
                        <FormDescription>
                          {t('submissionMarkAsPreferredEditDescription')}
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex justify-between pt-4">
                  <Button 
                    type="button" 
                    variant="destructive"
                    onClick={() => editingVendor && handleDeleteVendor(editingVendor)}
                    disabled={updateSubmissionVendor.isPending}
                    data-testid="button-delete-vendor"
                  >
                    {t('submissionDeleteVendorButton')}
                  </Button>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelVendorEdit}
                      disabled={updateSubmissionVendor.isPending}
                    >
                      {t('submissionCancelButton')}
                    </Button>
                    <Button 
                      type="submit"
                      disabled={updateSubmissionVendor.isPending}
                    >
                      {updateSubmissionVendor.isPending ? t('workflowSavingButton') : t('workflowSaveChangesButton')}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>

        {hasPreferredVendor && (
          <TabsContent value="elements" className="space-y-6">
            <ElementManagementTab 
              project={project} 
              workflowState={workflowState}
              onUpdate={onUpdate}
              onNavigateToTab={onNavigateToTab}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="flex items-center gap-3">
          <ReopenStepDialog
            projectId={project.id}
            currentStatus={workflowState.currentStatus}
            onSuccess={onUpdate}
            triggerText={t('reopenStepTrigger')}
          />
          
          <div className="text-sm text-muted-foreground">
            {workflowState.nextStatus && (
              <>{t('workflowNextLabel')} <span className="capitalize">{formatStatus(workflowState.nextStatus)}</span></>
            )}
          </div>
        </div>
        
        {canAdvance && hasPreferredVendor && (
          <Button 
            onClick={handleMarkComplete}
            disabled={isMarkingComplete}
            className="flex items-center gap-2"
            data-testid="button-complete-submission"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isMarkingComplete ? t('submissionCompletingButton') : t('submissionCompleteSubmissionPhaseButton')}
          </Button>
        )}
      </div>
    </div>
  );
}