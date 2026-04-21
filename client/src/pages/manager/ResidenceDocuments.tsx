import { useEffect } from 'react';
import { useParams } from 'wouter';
import ModularDocumentPageWrapper from '@/components/common/ModularDocumentPageWrapper';

export default function ResidenceDocuments() {
  const params = useParams();
  const residenceId = (params as any).residenceId;

  useEffect(() => {
    console.log('🔍 [RESIDENCE_DOCUMENTS] Component initialized', {
      residenceId,
      userRole: 'manager',
      timestamp: new Date().toISOString()
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
