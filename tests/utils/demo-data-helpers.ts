// Demo data helpers for testing with real Demo organization data
// Constants from the actual Demo organization
export const DEMO_ORG_ID = 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6';
export const DEMO_ORG_NAME = 'Demo';

// Real Demo data samples based on the database queries
export const demoBillsData = [
  {
    id: 'e6d90d48-f520-4b17-a323-527f0c86b2c5',
    billNumber: 'MAINT-2025-001-2036-03-G6',
    paymentType: 'unique' as const,
    category: 'maintenance' as const,
    totalAmount: 1276.29,
    costs: [1276.29],
    startDate: '2025-01-01',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },
  {
    id: '22b8cc1b-2537-4fbf-98e5-f11ef0bade2b',
    billNumber: 'MAINT-2025-001-2036-11-G12',
    paymentType: 'unique' as const,
    category: 'maintenance' as const,
    totalAmount: 1403.91,
    costs: [1403.91],
    startDate: '2025-01-01',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },
  {
    id: 'c04a4f42-70b2-47dc-a400-7c3b0e4a0417',
    billNumber: 'MAINT-2025-001-2036-02-G2',
    paymentType: 'unique' as const,
    category: 'maintenance' as const,
    totalAmount: 1659.17,
    costs: [1659.17],
    startDate: '2025-01-01',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },
  {
    id: '113157c7-686c-46ca-9f4a-9b60461d9a73',
    billNumber: 'MAINT-2025-001-2036-03-G3',
    paymentType: 'unique' as const,
    category: 'maintenance' as const,
    totalAmount: 1531.54,
    costs: [1531.54],
    startDate: '2025-01-01',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },
  {
    id: 'a835b435-3615-42dc-9d49-8cff39f2fc06',
    billNumber: 'MAINT-2025-001-2036-06-G6',
    paymentType: 'unique' as const,
    category: 'maintenance' as const,
    totalAmount: 1276.29,
    costs: [1276.29],
    startDate: '2025-01-01',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },
  // Add some utility bills for variety
  {
    id: 'util-001',
    billNumber: 'UTIL-2025-001',
    paymentType: 'recurrent' as const,
    category: 'utilities' as const,
    totalAmount: 850.00,
    costs: [425.00, 425.00],
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },
  {
    id: 'ins-001',
    billNumber: 'INS-2025-001',
    paymentType: 'unique' as const,
    category: 'insurance' as const,
    totalAmount: 2500.00,
    costs: [2500.00],
    startDate: '2025-01-01',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  }
];

export const demoBuildingsData = [
  {
    id: 'demo-building-1',
    organizationId: DEMO_ORG_ID,
    name: 'Demo Building 1',
    address: '100 Demo Avenue',
    city: 'Montreal',
    province: 'QC',
    postalCode: 'H1A 1A1',
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },
  {
    id: 'demo-building-2', 
    organizationId: DEMO_ORG_ID,
    name: 'Demo Building 2',
    address: '200 Demo Boulevard',
    city: 'Montreal',
    province: 'QC',
    postalCode: 'H1B 1B1',
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  }
];

/**
 * Get Demo organization data for testing
 */
export function getDemoOrganization() {
  return {
    id: DEMO_ORG_ID,
    name: DEMO_ORG_NAME,
    type: 'management_company',
    address: '100 Demo Street',
    city: 'Montreal',
    province: 'QC',
    postalCode: 'H1C 1C1',
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  };
}

/**
 * Get Demo buildings for testing
 */
export function getDemoBuildings() {
  return demoBuildingsData;
}

/**
 * Get Demo bills for payment testing
 */
export function getDemoBills(paymentType?: string, category?: string) {
  let filteredBills = demoBillsData;
  
  if (paymentType) {
    filteredBills = filteredBills.filter(bill => bill.paymentType === paymentType);
  }
  
  if (category) {
    filteredBills = filteredBills.filter(bill => bill.category === category);
  }
  
  return filteredBills;
}

/**
 * Get Demo users for testing
 */
export function getDemoUsers() {
  return [
    {
      id: 'demo-user-1',
      email: 'demo@example.com',
      role: 'ADMIN',
      organizationId: DEMO_ORG_ID,
      isActive: true,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z')
    }
  ];
}

/**
 * Validate Demo data structure for tests
 */
export function validateDemoDataStructure() {
  const org = getDemoOrganization();
  const buildings = getDemoBuildings();
  const bills = getDemoBills();
  
  return {
    hasOrganization: !!org,
    buildingCount: buildings.length,
    billCount: bills.length,
    isValidStructure: !!org && buildings.length > 0 && bills.length > 0
  };
}