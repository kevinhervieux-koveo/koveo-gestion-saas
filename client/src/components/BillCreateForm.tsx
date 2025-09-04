import { BillForm } from '@/components/common/BillForm';

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
    <BillForm
      mode="create"
      onSuccess={handleSuccess}
      onCancel={onClose}
      buildingId={buildingId}
    />
  );
}
