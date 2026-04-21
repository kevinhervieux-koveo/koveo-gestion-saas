import ModularDocumentPageWrapper from '@/components/common/ModularDocumentPageWrapper';

export default function BuildingDocuments() {
  return (
    <ModularDocumentPageWrapper
      type="building"
      userRole="resident"
      backPath="/residents/residence"
      entityIdParam="buildingId"
    />
  );
}
