import ModularDocumentPageWrapper from '@/components/common/ModularDocumentPageWrapper';

export default function ResidenceDocuments() {
  return (
    <ModularDocumentPageWrapper
      type="residence"
      userRole="manager"
      backPath="/manager/residences"
      backLabel="Back to Residences"
      entityIdParam="residenceId"
    />
  );
}
