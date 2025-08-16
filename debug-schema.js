import { insertBuildingSchema, insertResidenceSchema } from './shared/schema.ts';

// Test building schema
const condoBuilding = {
  organizationId: 'org-123',
  name: 'Les Jardins du Château',
  address: '2450 Boulevard Laurier',
  city: 'Québec',
  province: 'QC',
  postalCode: 'G1V 2L1',
  buildingType: 'condo',
  yearBuilt: 1985,
  totalUnits: 120,
  totalFloors: 15,
  parkingSpaces: 150,
  storageSpaces: 120,
  amenities: ['gym', 'pool', 'concierge', 'rooftop_terrace'],
  managementCompany: 'Gestion Immobilière Québec Inc.',
};

console.log('Testing building schema...');
const buildingResult = insertBuildingSchema.safeParse(condoBuilding);
console.log('Building success:', buildingResult.success);
if (!buildingResult.success) {
  console.log('Building errors:', JSON.stringify(buildingResult.error.issues, null, 2));
}

// Test residence schema
const condoUnit = {
  buildingId: 'building-123',
  unitNumber: '1205',
  floor: 12,
  squareFootage: 985.50,
  bedrooms: 2,
  bathrooms: 1.5,
  balcony: true,
  parkingSpaceNumber: 'P-045',
  storageSpaceNumber: 'S-045',
  ownershipPercentage: 0.0083,
  monthlyFees: 425.75,
};

console.log('\nTesting residence schema...');
const residenceResult = insertResidenceSchema.safeParse(condoUnit);
console.log('Residence success:', residenceResult.success);
if (!residenceResult.success) {
  console.log('Residence errors:', JSON.stringify(residenceResult.error.issues, null, 2));
}