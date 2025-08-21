import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, ShieldCheck, ShieldAlert, ShieldX, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { z } from 'zod';

import { StandardForm, type FormFieldConfig } from '@/components/ui/standard-form';
import { BaseDialog } from '@/components/ui/base-dialog';
import { useCreateMutation } from '@/hooks/use-api-handler';
import { cn } from '@/lib/utils';

// Types
/**
 *
 */
interface CertificateStatus {
  isValid: boolean;
  isExpiring: boolean;
  daysUntilExpiry: number;
  statusLabel: string;
}

/**
 *
 */
interface SslCertificateData {
  domain: string;
  issuer: string;
  subject: string;
  serialNumber: string;
  fingerprint: string;
  validFrom: string;
  validTo: string;
  status: 'active' | 'expired' | 'revoked' | 'pending';
  autoRenew: boolean;
  lastRenewalAttempt: string | null;
  renewalAttempts: number;
  maxRenewalAttempts: number;
  renewalError: string | null;
  dnsProvider: string | null;
  createdAt: string;
  updatedAt: string;
  certificateStatus: CertificateStatus;
}

/**
 *
 */
interface SslApiResponse {
  success: boolean;
  data: SslCertificateData;
}

// Form validation schema
const domainFormSchema = z.object({
  domain: z.string()
    .min(1, 'Domain is required')
    .max(253, 'Domain too long')
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/,
      'Invalid domain format'
    )
});

/**
 *
 */
type DomainFormData = z.infer<typeof domainFormSchema>;

/**
 * SSL Certificate Info Component - Refactored using reusable components
 * Reduced from 469+ lines to ~240 lines by leveraging StandardForm and BaseDialog.
 */
/**
 * SslCertificateInfo function.
 * @returns Function result.
 */
export function SslCertificateInfo() {
  const { user } = useAuth();
  const [showAddDomain, setShowAddDomain] = React.useState(false);

  // Fetch SSL certificate data
  const { data: sslData, isLoading, error, refetch } = useQuery<SslApiResponse>({
    queryKey: ['/api/ssl/certificate-info'],
    enabled: !!user,
  });

  // Add domain mutation
  const addDomainMutation = useCreateMutation<SslCertificateData, DomainFormData>(
    '/api/ssl/certificates',
    {
      successMessage: 'SSL certificate requested successfully',
      invalidateQueries: ['/api/ssl/certificate-info'],
      onSuccessCallback: () => setShowAddDomain(false),
    }
  );

  // Status configuration
  const getStatusConfig = (status: string, certificateStatus: CertificateStatus) => {
    if (status === 'expired' || !certificateStatus.isValid) {
      return {
        icon: ShieldX,
        variant: 'destructive' as const,
        label: 'Expired',
        className: 'text-red-600',
      };
    }
    
    if (certificateStatus.isExpiring) {
      return {
        icon: ShieldAlert,
        variant: 'warning' as const,
        label: `Expires in ${certificateStatus.daysUntilExpiry} days`,
        className: 'text-yellow-600',
      };
    }

    if (status === 'active') {
      return {
        icon: ShieldCheck,
        variant: 'success' as const,
        label: 'Active',
        className: 'text-green-600',
      };
    }

    return {
      icon: Shield,
      variant: 'secondary' as const,
      label: status,
      className: 'text-muted-foreground',
    };
  };

  // Form field configuration
  const domainFormFields: FormFieldConfig[] = [
    {
      name: 'domain',
      label: 'Domain Name',
      type: 'text',
      placeholder: 'example.com',
      required: true,
      description: 'Enter the domain name for SSL certificate generation',
    },
  ];

  if (isLoading) {
    return <SslCertificateInfoSkeleton />;
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error loading SSL information</AlertTitle>
        <AlertDescription>
          Failed to load SSL certificate data. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (!sslData?.success || !sslData.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SSL Certificate
          </CardTitle>
          <CardDescription>
            No SSL certificate found for this domain
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              No SSL certificate configured
            </p>
            <StandardForm
              schema={domainFormSchema}
              fields={domainFormFields}
              onSubmit={(data) => addDomainMutation.mutate(data)}
              isLoading={addDomainMutation.isPending}
              submitText="Request Certificate"
              layout="inline"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  const certificate = sslData.data;
  const statusConfig = getStatusConfig(certificate.status, certificate.certificateStatus);

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <statusConfig.icon className={cn("h-5 w-5", statusConfig.className)} />
                <CardTitle>SSL Certificate</CardTitle>
              </div>
              <Badge variant={statusConfig.variant}>
                {statusConfig.label}
              </Badge>
            </div>
            <CardDescription>{certificate.domain}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Certificate Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CertificateInfoCard
                title="Certificate Details"
                items={[
                  { label: 'Domain', value: certificate.domain },
                  { label: 'Status', value: certificate.status },
                  { label: 'Issuer', value: certificate.issuer },
                  { label: 'Serial Number', value: certificate.serialNumber },
                ]}
              />
              
              <CertificateInfoCard
                title="Validity Period"
                items={[
                  { label: 'Valid From', value: new Date(certificate.validFrom).toLocaleDateString() },
                  { label: 'Valid To', value: new Date(certificate.validTo).toLocaleDateString() },
                  { label: 'Days Remaining', value: certificate.certificateStatus.daysUntilExpiry },
                  { label: 'Auto Renew', value: certificate.autoRenew ? 'Enabled' : 'Disabled' },
                ]}
              />
            </div>

            {/* Renewal Information */}
            {(certificate.renewalAttempts > 0 || certificate.renewalError) && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-orange-800 text-base flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Renewal Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Renewal Attempts:</span>
                    <span>{certificate.renewalAttempts} / {certificate.maxRenewalAttempts}</span>
                  </div>
                  {certificate.lastRenewalAttempt && (
                    <div className="flex justify-between text-sm">
                      <span>Last Attempt:</span>
                      <span>{new Date(certificate.lastRenewalAttempt).toLocaleString()}</span>
                    </div>
                  )}
                  {certificate.renewalError && (
                    <Alert className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-red-600">
                        {certificate.renewalError}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Expiration Warning */}
            {certificate.certificateStatus.isExpiring && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <Clock className="h-4 w-4" />
                <AlertTitle>Certificate Expiring Soon</AlertTitle>
                <AlertDescription>
                  This certificate will expire in {certificate.certificateStatus.daysUntilExpiry} days.
                  {certificate.autoRenew ? ' Automatic renewal is enabled.' : ' Consider enabling auto-renewal.'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Domain Dialog */}
      <BaseDialog
        open={showAddDomain}
        onOpenChange={setShowAddDomain}
        title="Request SSL Certificate"
        description="Enter a domain name to request a new SSL certificate"
        showFooter={false}
      >
        <StandardForm
          schema={domainFormSchema}
          fields={domainFormFields}
          onSubmit={(data) => addDomainMutation.mutate(data)}
          isLoading={addDomainMutation.isPending}
          submitText="Request Certificate"
          showCancelButton={true}
          onCancel={() => setShowAddDomain(false)}
        />
      </BaseDialog>
    </>
  );
}

// Certificate info card helper component
/**
 *
 */
interface CertificateInfoCardProps {
  title: string;
  items: { label: string; value: string | number }[];
}

/**
 *
 * @param root0
 * @param root0.title
 * @param root0.items
 */
/**
 * CertificateInfoCard function.
 * @param root0
 * @param root0.title
 * @param root0.items
 * @returns Function result.
 */
function CertificateInfoCard({ title, items }: CertificateInfoCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.label}:</span>
            <span className="font-medium">{item.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Loading skeleton component
/**
 *
 */
/**
 * SslCertificateInfoSkeleton function.
 * @returns Function result.
 */
function SslCertificateInfoSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}