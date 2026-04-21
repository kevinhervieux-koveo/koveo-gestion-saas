import { useEffect } from 'react';
import { useParams } from 'wouter';
import ModularDocumentPageWrapper from '@/components/common/ModularDocumentPageWrapper';

export default function BuildingDocuments() {
  const params = useParams();
  const buildingId = (params as any).buildingId;

  useEffect(() => {
    console.log('🔍 [BUILDING_DOCUMENTS] Component initialized', {
      buildingId,
      userRole: 'manager',
      timestamp: new Date().toISOString()
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
