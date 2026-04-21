import { useState } from 'react';
import { StandardCard } from '@/components/common/StandardCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Edit2, 
  Trash2, 
  FileText, 
  Calendar,
  DollarSign,
  Building,
  Eye,
  MoreHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Invoice } from '@shared/schemas/invoices';
import { InvoiceForm } from '../invoices/InvoiceForm';
import { DocumentCard } from '@/components/document-management/DocumentCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface InvoiceCardProps {
  invoice: Invoice;
  onUpdate?: () => void;
  compact?: boolean;
}

const getPaymentTypeVariant = (paymentType: string): 'default' | 'secondary' => {
  return paymentType === 'recurring' ? 'default' : 'secondary';
};

const formatAmount = (amount: string | number): string => {
  return parseFloat(amount.toString()).toFixed(2);
};

export function InvoiceCard({ invoice, onUpdate, compact = false }: InvoiceCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useCreateUpdateMutation<unknown, void>({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/invoices/${invoice.id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete invoice');
      }
      return response.json();
    },
    successTitle: 'Success',
    successMessage: 'Invoice deleted successfully',
    errorMessage: (error) => error?.message || '',
    queryKeysToInvalidate: [['/api/invoices']],
    onSuccessCallback: () => {
      onUpdate?.();
    },
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  const handleEditSuccess = () => {
    setShowEditDialog(false);
    onUpdate?.();
  };

  const badges = compact ? [] : [
    {
      text: invoice.paymentType === 'recurring' ? 'Recurring' : 'One-Time Bill',
      variant: getPaymentTypeVariant(invoice.paymentType),
    },
    ...(invoice.isAiExtracted ? [{
      text: 'AI Processed',
      variant: 'outline' as const,
    }] : []),
  ];

  const metadata = compact 
    ? [
        {
          icon: <DollarSign className="w-3 h-3" />,
          value: `$${formatAmount(invoice.totalAmount)}`,
        },
      ]
    : [
        {
          icon: <DollarSign className="w-3 h-3" />,
          value: `$${formatAmount(invoice.totalAmount)}`,
        },
        {
          icon: <Calendar className="w-3 h-3" />,
          label: 'Due',
          value: format(new Date(invoice.dueDate), 'MMM dd, yyyy'),
        },
        ...(invoice.frequency ? [{
          value: invoice.frequency.charAt(0).toUpperCase() + invoice.frequency.slice(1),
        }] : []),
        ...(invoice.buildingId ? [{
          icon: <Building className="w-3 h-3" />,
          value: `Bldg ${invoice.buildingId.slice(0, 8)}...`,
        }] : []),
        ...(invoice.documentId ? [{
          icon: <FileText className="w-3 h-3" />,
          value: 'Document attached',
        }] : []),
      ];

  const ActionsDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          data-testid={`button-actions-${invoice.id}`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setShowViewDialog(true)}>
          <Eye className="w-4 h-4 mr-2" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
          <Edit2 className="w-4 h-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <StandardCard
        title={invoice.vendorName}
        description={`#${invoice.invoiceNumber}`}
        icon={<FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        badges={badges}
        metadata={metadata}
        compact={compact}
        actions={[
          {
            icon: <ActionsDropdown />,
            label: 'Actions',
            onClick: () => {},
            testId: `invoice-actions-wrapper-${invoice.id}`,
          },
        ]}
        testId={`invoice-card-${invoice.id}`}
      />

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
          </DialogHeader>
          <InvoiceForm
            invoice={invoice}
            buildingId={invoice.buildingId}
            residenceId={invoice.residenceId}
            initialData={{
              vendorName: invoice.vendorName,
              invoiceNumber: invoice.invoiceNumber,
              totalAmount: invoice.totalAmount,
              dueDate: new Date(invoice.dueDate),
              paymentType: invoice.paymentType,
              frequency: invoice.frequency,
              startDate: invoice.startDate ? new Date(invoice.startDate) : undefined,
              customPaymentDates: invoice.customPaymentDates?.map((d: string) => new Date(d)),
              documentId: invoice.documentId,
              isAiExtracted: invoice.isAiExtracted,
              extractionConfidence: invoice.extractionConfidence ? parseFloat(invoice.extractionConfidence.toString()) : undefined,
            }}
            mode="edit"
            onSuccess={handleEditSuccess}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Vendor Information</h4>
                <p className="text-sm text-muted-foreground">Vendor: {invoice.vendorName}</p>
                <p className="text-sm text-muted-foreground">Invoice #: {invoice.invoiceNumber}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Payment Information</h4>
                <p className="text-sm text-muted-foreground">
                  Amount: ${formatAmount(invoice.totalAmount)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Due: {format(new Date(invoice.dueDate), 'PPP')}
                </p>
                <p className="text-sm text-muted-foreground">
                  Type: {invoice.paymentType}
                </p>
                {invoice.frequency && (
                  <p className="text-sm text-muted-foreground">
                    Frequency: {invoice.frequency}
                  </p>
                )}
              </div>
            </div>

            {invoice.documentId && (
              <div>
                <h4 className="font-medium mb-4">Attached Document</h4>
                <DocumentCard
                  title="Invoice Document"
                  documentId={invoice.documentId}
                  onViewClick={() => {}}
                />
              </div>
            )}

            {invoice.isAiExtracted && invoice.extractionConfidence && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">AI Extraction Info</h4>
                <p className="text-sm text-muted-foreground">
                  Confidence: {(parseFloat(invoice.extractionConfidence.toString()) * 100).toFixed(1)}%
                </p>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              <p>Created: {format(new Date(invoice.createdAt), 'PPP pp')}</p>
              <p>Updated: {format(new Date(invoice.updatedAt), 'PPP pp')}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
