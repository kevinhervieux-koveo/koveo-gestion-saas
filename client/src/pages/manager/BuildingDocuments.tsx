import { useEffect } from 'react';
import { useParams } from 'wouter';
import ModularDocumentPageWrapper from '@/components/common/ModularDocumentPageWrapper';
import { logDebug } from '@/lib/logger';

export default function BuildingDocuments() {
  const params = useParams();
  const buildingId = (params as any).buildingId;

  useEffect(() => {
    logDebug('[BUILDING_DOCUMENTS] Component initialized', {
      buildingId,
      userRole: 'manager',
    });
  }, [buildingId]);

  return (
    <ModularDocumentPageWrapper
      type="building"
      userRole="manager"
      backPath="/manager/buildings"
      entityIdParam="buildingId"
    />
  );
}
