import DocumentPageWrapper from '@/components/common/DocumentPageWrapper';

export default function ResidenceDocuments() {
  return (
    <DocumentPageWrapper
      type="residence"
      userRole="manager"
      backPath="/manager/residences"
      backLabel="Back to Residences"
      entityIdParam="residenceId"
    />
  );
}
