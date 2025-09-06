import { ModularBillForm } from '@/components/bill-management/ModularBillForm';
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
    <ModularBillForm
      mode="edit"
      bill={bill}
      onSuccess={onSuccess}
      onCancel={onCancel}
      buildingId={bill.buildingId}
    />
  );
}
