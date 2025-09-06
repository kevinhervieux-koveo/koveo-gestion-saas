import ModularDocumentPageWrapper from '@/components/common/ModularDocumentPageWrapper';

export default function BuildingDocuments() {
  return (
    <ModularDocumentPageWrapper
      type="building"
      userRole="manager"
      backPath="/manager/buildings"
      backLabel="Back to Buildings"
      entityIdParam="buildingId"
    />
  );
}
