import { ModularBillForm } from '@/components/bill-management/ModularBillForm';

interface BillCreateFormProps {
  onClose: () => void;
  selectedBuilding?: any;
  buildingId?: string;
  onSuccess?: () => void;
}

export function BillCreateForm({ onClose, selectedBuilding, buildingId, onSuccess }: BillCreateFormProps) {
  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  return (
    <ModularBillForm
      mode="create"
      onSuccess={handleSuccess}
      onCancel={onClose}
      buildingId={buildingId}
    />
  );
}
