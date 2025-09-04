import { BillForm } from '@/components/common/BillForm';
import type { Bill } from '@shared/schema';

export function BillEditForm({
  bill,
  onSuccess,
  onCancel,
}: {
  bill: Bill;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  return (
    <BillForm
      mode="edit"
      bill={bill}
      onSuccess={onSuccess}
      onCancel={onCancel}
      buildingId={bill.buildingId}
    />
  );
}
