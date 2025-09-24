import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSubmissionVendors, useSubmissionVendorMutations, useMarkStatusComplete, type ProjectWorkflowState, type SubmissionVendor } from '@/hooks/useProjectWorkflow';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { PaymentPlanForm } from './PaymentPlanForm';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Users,
  Building,
  DollarSign,
  FileText,
  Calendar,
  Info,
  ExternalLink,
  Star,
  Phone,
  Mail,
  AlertTriangle,
  Edit,
  Settings,
} from 'lucide-react';

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
  const { selectSubmissionVendor, updateSubmissionVendor, updatePreferredStatus } = useSubmissionVendorMutations();

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

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'Not specified';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPaymentSchedule = (schedule?: string) => {
    if (!schedule) return 'Not specified';
    return schedule.replace('_', ' ').charAt(0).toUpperCase() + schedule.slice(1);
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
        
        {/* Skip option info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>This step can be skipped in tab navigation</span>
        </div>
      </div>

      {/* Vendor Management Placeholder Alert */}
      <Alert>
        <Building className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">Vendor Management Interface</p>
            <p>
              The vendor management interface will be implemented in the next task. This includes:
            </p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Adding and inviting vendors to submit proposals</li>
              <li>Vendor portal for quote submission</li>
              <li>Document upload and management</li>
              <li>Automated vendor communications</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

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
                <h4 className="text-lg font-semibold">Waiting for Vendor Submissions</h4>
                <p className="text-muted-foreground">
                  Vendors will be able to submit their proposals and quotes here
                </p>
              </div>
              <Button variant="outline" disabled>
                <ExternalLink className="h-4 w-4 mr-2" />
                Invite Vendors (Coming Soon)
              </Button>
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
                        {vendor.contactInfo && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            Contact Available
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {vendor.projectType.replace('_', ' ')}
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
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Proposal Details */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">Proposal Details</h5>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {vendor.addedLifespan && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Extends lifespan: {vendor.addedLifespan} years</span>
                        </div>
                      )}
                      {vendor.documents && vendor.documents.length > 0 && (
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          <span>{vendor.documents.length} document(s) submitted</span>
                        </div>
                      )}
                    </div>
                    
                    {vendor.notes && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">{vendor.notes}</p>
                      </div>
                    )}
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
            <>Next: <span className="capitalize">{workflowState.nextStatus.replace('_', ' ')}</span></>
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
    </div>
  );
}