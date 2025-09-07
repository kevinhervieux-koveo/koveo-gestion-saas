import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  FileText, 
  Calendar,
  DollarSign,
  Building,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Invoice } from '@shared/schemas/invoices';
import { InvoiceForm } from './InvoiceForm';
import { DocumentCard } from '@/components/document-management/DocumentCard';

interface InvoiceCardProps {
  invoice: Invoice;
  onUpdate?: () => void;
}

export function InvoiceCard({ invoice, onUpdate }: InvoiceCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/invoices/${invoice.id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Invoice deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      onUpdate?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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

  const getPaymentTypeVariant = (paymentType: string) => {
    return paymentType === 'recurring' ? 'default' : 'secondary';
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow" data-testid={`invoice-card-${invoice.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">
                {invoice.vendorName}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                #{invoice.invoiceNumber}
              </p>
            </div>
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
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-lg">
                ${parseFloat(invoice.totalAmount.toString()).toFixed(2)}
              </span>
            </div>
            <Badge variant={getPaymentTypeVariant(invoice.paymentType)}>
              {invoice.paymentType === 'recurring' ? 'Recurring' : 'One-time'}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Due: {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}</span>
            </div>
            
            {invoice.frequency && (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4" />
                <span className="text-muted-foreground">
                  {invoice.frequency.charAt(0).toUpperCase() + invoice.frequency.slice(1)}
                </span>
              </div>
            )}

            {invoice.buildingId && (
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground truncate">
                  Building ID: {invoice.buildingId.slice(0, 8)}...
                </span>
              </div>
            )}
          </div>

          {invoice.documentId && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>Document attached</span>
                {invoice.isAiExtracted && (
                  <Badge variant="outline" className="text-xs">
                    AI Processed
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
          </DialogHeader>
          <InvoiceForm
            mode="edit"
            invoice={invoice}
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
                  Amount: ${parseFloat(invoice.totalAmount.toString()).toFixed(2)}
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
                  documentId={invoice.documentId}
                  showRemove={false}
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