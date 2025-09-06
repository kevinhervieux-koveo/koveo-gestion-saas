import ModularDocumentPageWrapper from '@/components/common/ModularDocumentPageWrapper';

export default function ResidenceDocuments() {
  return (
    <ModularDocumentPageWrapper
      type="residence"
      userRole="resident"
      backPath="/residents/residence"
      entityIdParam="residenceId"
    />
  );
}
