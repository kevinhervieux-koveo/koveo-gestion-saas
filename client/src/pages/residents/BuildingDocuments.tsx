import ModularDocumentPageWrapper from '@/components/common/ModularDocumentPageWrapper';

export default function BuildingDocuments() {
  return (
    <ModularDocumentPageWrapper
      type="building"
      userRole="resident"
      backPath="/residents/buildings"
      backLabel="Back to Buildings"
      entityIdParam="buildingId"
    />
  );
}
