import DocumentPageWrapper from '@/components/common/DocumentPageWrapper';

export default function BuildingDocuments() {
  return (
    <DocumentPageWrapper
      type="building"
      userRole="resident"
      backPath="/residents/buildings"
      backLabel="Back to Buildings"
      entityIdParam="buildingId"
    />
  );
}
