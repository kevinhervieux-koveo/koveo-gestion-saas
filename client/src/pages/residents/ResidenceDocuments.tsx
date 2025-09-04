import DocumentPageWrapper from '@/components/common/DocumentPageWrapper';

export default function ResidenceDocuments() {
  return (
    <DocumentPageWrapper
      type="residence"
      userRole="resident"
      backPath="/residents/residence"
      entityIdParam="residenceId"
    />
  );
}
