type BillLike = {
  billType?: string | null;
  paymentType?: string | null;
};

export function getEffectiveBillType(bill: BillLike): 'unique' | 'recurrent' {
  return (bill.billType ?? bill.paymentType ?? 'unique') as 'unique' | 'recurrent';
}

export function isOverduePayment(payment: { status?: string; scheduledDate?: string | null }): boolean {
  if (payment.status === 'paid') return false;
  if (payment.status === 'overdue') return true;
  if (payment.status === 'pending' && payment.scheduledDate) {
    const today = new Date().toISOString().split('T')[0];
    return payment.scheduledDate < today;
  }
  return false;
}
