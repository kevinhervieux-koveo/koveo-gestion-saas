import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, ShieldCheck, ShieldAlert, ShieldX, Clock, Calendar, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types based on the SSL API response
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
 *
 */
interface SslCertificateInfoProps {
  initialDomain?: string;
  className?: string;
}

/**
 * SSL Certificate Information component that displays SSL certificate details
 * for a given domain. Only accessible by administrators.
 * @param root0
 * @param root0.initialDomain
 * @param root0.className
 */
export function SslCertificateInfo({ initialDomain = '', className }: SslCertificateInfoProps) {
  const { user, hasAnyRole } = useAuth();
  const [selectedDomain, setSelectedDomain] = React.useState(initialDomain);

  const form = useForm<DomainFormData>({
    resolver: zodResolver(domainFormSchema),
    defaultValues: {
      domain: initialDomain
    }
  });

  // Check if user has admin role
  const hasAdminAccess = hasAnyRole(['admin']);

  // Query SSL certificate information
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isRefetching 
  } = useQuery<SslApiResponse>({
    queryKey: ['/api/ssl', selectedDomain],
    enabled: !!selectedDomain && selectedDomain.length > 0 && hasAdminAccess,
    retry: false,
    staleTime: 60 * 1000, // 1 minute
  });

  const onSubmit = (formData: DomainFormData) => {
    setSelectedDomain(formData.domain);
  };

  // Access control - only allow admins/owners
  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertTitle>Authentication Required</AlertTitle>
            <AlertDescription>
              You must be logged in to view SSL certificate information.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!hasAdminAccess) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              Only administrators can view SSL certificate information.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (cert: SslCertificateData) => {
    const { certificateStatus } = cert;
    
    if (!certificateStatus.isValid || cert.status === 'expired') {
      return <Badge variant="destructive" className="gap-1"><ShieldX className="h-3 w-3" />Expired</Badge>;
    }
    
    if (certificateStatus.isExpiring) {
      return <Badge variant="outline" className="gap-1 border-orange-500 text-orange-700 dark:text-orange-400"><ShieldAlert className="h-3 w-3" />Expiring Soon</Badge>;
    }
    
    if (cert.status === 'active') {
      return <Badge variant="default" className="gap-1 bg-green-500 hover:bg-green-600"><ShieldCheck className="h-3 w-3" />Active</Badge>;
    }
    
    return <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" />{cert.status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Domain Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SSL Certificate Information
          </CardTitle>
          <CardDescription>
            View SSL certificate details and status for any domain
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-3 items-end">
              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Domain</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter domain (e.g., example.com)" 
                        {...field}
                        className="max-w-md"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading || isRefetching}>
                {isLoading || isRefetching ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Get Certificate Info'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Loading State */}
      {(isLoading || isRefetching) && selectedDomain && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && selectedDomain && !isLoading && (
        <Card>
          <CardContent className="p-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Loading Certificate</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p>Failed to load SSL certificate information for "{selectedDomain}".</p>
                <p className="text-sm">
                  {error instanceof Error 
                    ? error.message 
                    : 'An unexpected error occurred. Please try again.'}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Certificate Information Display */}
      {data?.data && !isLoading && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="text-xl">{data.data.domain}</CardTitle>
                <CardDescription>SSL Certificate Details</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(data.data)}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  disabled={isRefetching}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Warnings */}
            {data.data.certificateStatus.isExpiring && (
              <Alert variant="default" className="border-orange-500">
                <Clock className="h-4 w-4" />
                <AlertTitle>Certificate Expiring Soon</AlertTitle>
                <AlertDescription>
                  This certificate will expire in {data.data.certificateStatus.daysUntilExpiry} days on {formatDate(data.data.validTo)}.
                  {data.data.autoRenew ? ' Auto-renewal is enabled.' : ' Auto-renewal is disabled.'}
                </AlertDescription>
              </Alert>
            )}

            {data.data.renewalError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Renewal Error</AlertTitle>
                <AlertDescription>
                  {data.data.renewalError}
                </AlertDescription>
              </Alert>
            )}

            {/* Certificate Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Certificate Details
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Issuer</Label>
                    <p className="mt-1 text-sm">{data.data.issuer}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Subject</Label>
                    <p className="mt-1 text-sm">{data.data.subject}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Serial Number</Label>
                    <p className="mt-1 text-sm font-mono text-xs">{data.data.serialNumber}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Fingerprint</Label>
                    <p className="mt-1 text-sm font-mono text-xs break-all">{data.data.fingerprint}</p>
                  </div>
                </div>
              </div>

              {/* Validity & Status */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Validity & Status
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Valid From</Label>
                    <p className="mt-1 text-sm">{formatDate(data.data.validFrom)}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Valid To</Label>
                    <p className="mt-1 text-sm">{formatDate(data.data.validTo)}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Days Until Expiry</Label>
                    <p className="mt-1 text-sm">{data.data.certificateStatus.daysUntilExpiry} days</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Auto Renewal</Label>
                    <p className="mt-1 text-sm">
                      <Badge variant={data.data.autoRenew ? "default" : "secondary"}>
                        {data.data.autoRenew ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>

              {/* Renewal Information */}
              {(data.data.lastRenewalAttempt || data.data.renewalAttempts > 0) && (
                <div className="md:col-span-2 space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Renewal Information
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {data.data.lastRenewalAttempt && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Last Renewal Attempt</Label>
                        <p className="mt-1 text-sm">{formatDate(data.data.lastRenewalAttempt)}</p>
                      </div>
                    )}
                    
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Renewal Attempts</Label>
                      <p className="mt-1 text-sm">
                        {data.data.renewalAttempts} / {data.data.maxRenewalAttempts}
                      </p>
                    </div>
                    
                    {data.data.dnsProvider && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">DNS Provider</Label>
                        <p className="mt-1 text-sm">{data.data.dnsProvider}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* System Information */}
              <div className="md:col-span-2 space-y-4">
                <h3 className="font-semibold text-lg">System Information</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                    <p className="mt-1 text-sm">{formatDate(data.data.createdAt)}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
                    <p className="mt-1 text-sm">{formatDate(data.data.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {!data?.data && !isLoading && !error && selectedDomain && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <Shield className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">No Certificate Found</h3>
                <p className="text-sm text-muted-foreground">
                  No SSL certificate found for domain "{selectedDomain}".
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SslCertificateInfo;