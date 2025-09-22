/**
 * Inventory page entry point
 * Main export for the building maintenance inventory page
 */
export { InventoryPage as default } from './InventoryPage';

// Re-export all components for potential individual usage
export { InventoryPage } from './InventoryPage';
export { InventoryHeader } from './InventoryHeader';
export { InventoryOverview } from './InventoryOverview'; 
export { ElementDetailsPanel } from './ElementDetailsPanel';

// Export types for TypeScript support
export type { InventoryHeaderProps } from './InventoryHeader';
export type { InventoryOverviewProps } from './InventoryOverview';
export type { ElementDetailsPanelProps } from './ElementDetailsPanel';