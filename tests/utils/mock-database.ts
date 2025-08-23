// Mock database utilities for testing

export const mockBillsData = [
  {
    id: '1',
    billNumber: 'MAINT-2024-001',
    paymentType: 'unique',
    costs: [1000],
    totalAmount: 1000,
    category: 'maintenance'
  },
  {
    id: '2',
    billNumber: 'UTIL-2024-002',
    paymentType: 'recurrent', 
    costs: [500, 500, 500],
    totalAmount: 1500,
    category: 'utilities',
    startDate: '2024-01-01'
  },
  {
    id: '3',
    billNumber: 'INS-2024-003',
    paymentType: 'unique',
    costs: [2500],
    totalAmount: 2500,
    category: 'insurance'
  },
  {
    id: '4',
    billNumber: 'TAX-2024-004',
    paymentType: 'unique',
    costs: [5000],
    totalAmount: 5000,
    category: 'taxes'
  }
];

export const mockMoneyFlowData = [
  {
    id: '1',
    amount: 1000,
    type: 'expense',
    category: 'maintenance',
    billId: '1'
  }
];

export const createMockDb = () => ({
  select: globalThis.jest.fn().mockReturnValue({
    from: globalThis.jest.fn().mockReturnValue({
      where: globalThis.jest.fn().mockImplementation((condition: any) => {
        const conditionStr = condition?.toString?.() || '';
        
        if (conditionStr.includes('unique')) {
          return Promise.resolve(mockBillsData.filter(b => b.paymentType === 'unique'));
        }
        if (conditionStr.includes('recurrent')) {
          return Promise.resolve(mockBillsData.filter(b => b.paymentType === 'recurrent'));
        }
        if (conditionStr.includes('insurance') || conditionStr.includes('taxes')) {
          return Promise.resolve(mockBillsData.filter(b => ['insurance', 'taxes', 'maintenance'].includes(b.category)));
        }
        return Promise.resolve(mockBillsData);
      })
    })
  }),
  delete: globalThis.jest.fn().mockReturnValue({
    where: globalThis.jest.fn().mockResolvedValue({ success: true })
  }),
  insert: globalThis.jest.fn().mockReturnValue({
    values: globalThis.jest.fn().mockResolvedValue({ success: true })
  })
});