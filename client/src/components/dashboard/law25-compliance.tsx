import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NoDataCard } from '@/components/ui/no-data-card';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Users,
  Lock,
  Globe,
  Eye,
  Scale,
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Interface for Law 25 compliance data from the API.
 */
interface Law25ComplianceData {
  complianceScore: number;
  totalViolations: number;
  criticalViolations: number;
  lastScanDate: string;
  categories: {
    dataCollection: number;
    consent: number;
    dataRetention: number;
    security: number;
    crossBorderTransfer: number;
    dataSubjectRights: number;
  };
  violations: Array<{
    rule: string;
    message: string;
    file: string;
    line: number;
    category: string;
    law25Aspect: string;
    severity: string;
  }>;
}

/**
 * Quebec Law 25 compliance dashboard component that displays privacy compliance status,
 * violations, and remediation guidance for property management systems.
 * @returns JSX element for the Law 25 compliance dashboard.
 */
/**
 * Law25Compliance function.
 * @returns Function result.
 */
export function Law25Compliance() {
  const { t: _t } = useLanguage();

  const { data: complianceData, isLoading } = useQuery<Law25ComplianceData>({
    queryKey: ['/api/law25-compliance'],
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 15 * 60 * 1000, // Refetch every 15 minutes
  });

  const getComplianceStatus = (score: number) => {
    if (score >= 90) {
      return { level: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
    }
    if (score >= 80) {
      return { level: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
    }
    if (score >= 60) {
      return { level: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    }
    return { level: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'dataCollection':
        return FileText;
      case 'consent':
        return Users;
      case 'dataRetention':
        return FileText;
      case 'security':
        return Lock;
      case 'crossBorderTransfer':
        return Globe;
      case 'dataSubjectRights':
        return Eye;
      default:
        return Scale;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      dataCollection: 'Data Collection',
      consent: 'Consent Management',
      dataRetention: 'Data Retention',
      security: 'Security & Encryption',
      crossBorderTransfer: 'Cross-Border Transfer',
      dataSubjectRights: 'Data Subject Rights',
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'info':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-32 w-full' />
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className='h-24 w-full' />
          ))}
        </div>
        <Skeleton className='h-96 w-full' />
      </div>
    );
  }

  if (!complianceData) {
    return (
      <NoDataCard
        icon={Shield}
        titleKey="noComplianceData"
        descriptionKey="noComplianceDataMessage"
        badgeKey="noData"
        testId="no-compliance-data-message"
      />
    );
  }

  const status = getComplianceStatus(complianceData.complianceScore);

  return (
    <div className='space-y-6'>
      {/* Compliance Overview */}
      <Card
        className={`border-l-4 ${complianceData.complianceScore >= 80 ? 'border-l-green-500' : complianceData.complianceScore >= 60 ? 'border-l-yellow-500' : 'border-l-red-500'}`}
      >
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Shield className='w-6 h-6' />
            Quebec Law 25 Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {/* Compliance Score */}
            <div className='text-center'>
              <div className={`text-4xl font-bold mb-2 ${status.color}`}>
                {complianceData.complianceScore}/100
              </div>
              <div
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.bg} ${status.color}`}
              >
                {complianceData.complianceScore >= 80 ? (
                  <CheckCircle className='w-4 h-4 mr-1' />
                ) : (
                  <XCircle className='w-4 h-4 mr-1' />
                )}
                {status.level}
              </div>
              <Progress
                value={complianceData.complianceScore}
                className='mt-3'
                // className={`mt-3 ${complianceData.complianceScore >= 80 ? '[&>div]:bg-green-500' : complianceData.complianceScore >= 60 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`}
              />
            </div>

            {/* Violations Summary */}
            <div className='text-center'>
              <div className='text-2xl font-semibold text-gray-700 mb-2'>
                {complianceData.totalViolations}
              </div>
              <div className='text-sm text-gray-500 mb-1'>Total Violations</div>
              {complianceData.criticalViolations > 0 && (
                <div className='flex items-center justify-center gap-1 text-red-600'>
                  <AlertTriangle className='w-4 h-4' />
                  <span className='text-sm font-medium'>
                    {complianceData.criticalViolations} Critical
                  </span>
                </div>
              )}
            </div>

            {/* Last Scan */}
            <div className='text-center'>
              <div className='text-sm text-gray-500 mb-1'>Last Scan</div>
              <div className='text-sm font-medium text-gray-700'>
                {new Date(complianceData.lastScanDate).toLocaleDateString()}
              </div>
              <div className='text-xs text-gray-400'>
                {new Date(complianceData.lastScanDate).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
        {Object.entries(complianceData.categories).map(([category, count]) => {
          const Icon = getCategoryIcon(category);
          const isClean = count === 0;

          return (
            <Card key={category} className={`${isClean ? 'border-green-200' : 'border-red-200'}`}>
              <CardContent className='p-4'>
                <div className='flex items-center justify-between mb-2'>
                  <div className='flex items-center gap-2'>
                    <Icon className={`w-4 h-4 ${isClean ? 'text-green-600' : 'text-red-600'}`} />
                    <span className='text-sm font-medium'>{getCategoryLabel(category)}</span>
                  </div>
                  <Badge variant={isClean ? 'default' : 'destructive'}>{count}</Badge>
                </div>
                <div className={`text-xs ${isClean ? 'text-green-600' : 'text-red-600'}`}>
                  {isClean ? 'Compliant' : `${count} issue${count > 1 ? 's' : ''} found`}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Violations Detail */}
      {complianceData.violations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <AlertTriangle className='w-5 h-5 text-orange-500' />
              Compliance Violations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              {complianceData.violations.slice(0, 10).map((violation, _index) => (
                <div key={_index} className='flex items-start gap-3 p-3 rounded-lg bg-gray-50'>
                  <div
                    className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                      violation.severity === 'error'
                        ? 'bg-red-500'
                        : violation.severity === 'warning'
                          ? 'bg-yellow-500'
                          : 'bg-blue-500'
                    }`}
                  />
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1'>
                      <Badge className={getSeverityColor(violation.severity)}>
                        {violation.severity.toUpperCase()}
                      </Badge>
                      <span className='text-xs text-gray-500'>{violation.rule}</span>
                    </div>
                    <p className='text-sm text-gray-700 mb-1'>{violation.message}</p>
                    <div className='text-xs text-gray-500'>
                      {violation.file}:{violation.line} • {getCategoryLabel(violation.law25Aspect)}
                    </div>
                  </div>
                </div>
              ))}

              {complianceData.violations.length > 10 && (
                <div className='text-center py-2'>
                  <Badge variant='outline'>
                    +{complianceData.violations.length - 10} more violations
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compliance Guide */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Scale className='w-5 h-5 text-blue-500' />
            Quebec Law 25 Compliance Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div>
              <h4 className='font-medium mb-3'>Required Compliance Areas</h4>
              <ul className='space-y-2 text-sm'>
                <li className='flex items-center gap-2'>
                  <CheckCircle className='w-4 h-4 text-green-500' />
                  Explicit consent for data collection
                </li>
                <li className='flex items-center gap-2'>
                  <CheckCircle className='w-4 h-4 text-green-500' />
                  Data retention policies
                </li>
                <li className='flex items-center gap-2'>
                  <CheckCircle className='w-4 h-4 text-green-500' />
                  Encryption of personal data
                </li>
                <li className='flex items-center gap-2'>
                  <CheckCircle className='w-4 h-4 text-green-500' />
                  Data subject rights implementation
                </li>
              </ul>
            </div>
            <div>
              <h4 className='font-medium mb-3'>Property Management Focus</h4>
              <ul className='space-y-2 text-sm'>
                <li className='flex items-center gap-2'>
                  <Users className='w-4 h-4 text-blue-500' />
                  Tenant personal information protection
                </li>
                <li className='flex items-center gap-2'>
                  <Lock className='w-4 h-4 text-blue-500' />
                  Financial data security
                </li>
                <li className='flex items-center gap-2'>
                  <FileText className='w-4 h-4 text-blue-500' />
                  Building access code protection
                </li>
                <li className='flex items-center gap-2'>
                  <Eye className='w-4 h-4 text-blue-500' />
                  Maintenance request privacy
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
