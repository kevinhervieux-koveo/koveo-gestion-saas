import { useEffect } from 'react';
import { useParams } from 'wouter';
import ModularDocumentPageWrapper from '@/components/common/ModularDocumentPageWrapper';
import { logDebug } from '@/lib/logger';

export default function ResidenceDocuments() {
  const params = useParams();
  const residenceId = (params as any).residenceId;

  useEffect(() => {
    logDebug('[RESIDENCE_DOCUMENTS] Component initialized', {
      residenceId,
      userRole: 'manager',
    });
  }, [residenceId]);

  return (
    <ModularDocumentPageWrapper
      type="residence"
      userRole="manager"
      backPath="/manager/residences"
      entityIdParam="residenceId"
    />
  );
}
