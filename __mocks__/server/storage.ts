/**
 * Mock for server/storage.ts - Provides test-ready storage implementation
 * Uses MemStorage automatically for all tests
 */

import { MemStorage } from '../../server/storage';

// Export the MemStorage class for tests - this ensures in-memory storage during tests
export { MemStorage } from '../../server/storage';
export { IStorage } from '../../server/storage';

// Create a default mock storage instance
const mockStorage = new MemStorage();

// Export default mock storage instance
export const storage = mockStorage;
export default mockStorage;

// Additional storage utilities for tests
export const createTestStorage = () => new MemStorage();
export const clearTestStorage = (storage: MemStorage) => {
  // Clear all internal maps in MemStorage for clean test state
  (storage as any).users.clear();
  (storage as any).organizations.clear();
  (storage as any).buildings.clear();
  (storage as any).residences.clear();
  (storage as any).pillars.clear();
  (storage as any).workspaceStatuses.clear();
  (storage as any).qualityMetrics.clear();
  (storage as any).frameworkConfigs.clear();
  (storage as any).improvementSuggestions.clear();
  (storage as any).features.clear();
  (storage as any).actionableItems.clear();
  (storage as any).invitations.clear();
  (storage as any).invitationAuditLogs.clear();
  (storage as any).bugs.clear();
  (storage as any).featureRequests.clear();
  (storage as any).featureRequestUpvotes.clear();
  (storage as any).invoices.clear();
};