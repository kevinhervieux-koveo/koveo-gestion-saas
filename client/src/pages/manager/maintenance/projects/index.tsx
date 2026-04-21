/**
 * Projects Page - Maintenance Management
 * Main export for the comprehensive projects management page
 */

export { ProjectsPage as default } from './ProjectsPage';
export { ProjectsPage } from './ProjectsPage';

// Re-export components for external use
export { ProjectsHeader } from './ProjectsHeader';
export { ProjectsOverview } from './ProjectsOverview';
export { ProjectDetailsPanel } from './ProjectDetailsPanel';
export { SuggestionsIntegration } from './SuggestionsIntegration';
export { ProjectTableView } from './ProjectTableView';

// Export types
export type { ProjectsPageProps } from './ProjectsPage';
export type { ProjectsHeaderProps } from './ProjectsHeader';
export type { ProjectsOverviewProps } from './ProjectsOverview';
export type { ProjectDetailsPanelProps } from './ProjectDetailsPanel';
export type { SuggestionsIntegrationProps } from './SuggestionsIntegration';
export type { ProjectTableViewProps } from './ProjectTableView';