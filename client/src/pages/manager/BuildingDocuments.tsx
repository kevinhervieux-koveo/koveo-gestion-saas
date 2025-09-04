import DocumentPageWrapper from '@/components/common/DocumentPageWrapper';

export default function BuildingDocuments() {
  return (
    <DocumentPageWrapper
      type="building"
      userRole="manager"
      backPath="/manager/buildings"
      backLabel="Back to Buildings"
      entityIdParam="buildingId"
    />
  );
}
