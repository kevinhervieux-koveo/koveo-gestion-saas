import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider, QueryFunction } from '@tanstack/react-query';
import { Router } from 'wouter';

const wouter = require('wouter');

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', role: 'manager', email: 'manager@test.com' },
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({ language: 'en', t: (k: string) => k, setLanguage: jest.fn() }),
  LanguageProvider: ({ children }: any) => children,
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  }),
  queryClient: { invalidateQueries: jest.fn(), refetchQueries: jest.fn() },
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

jest.mock('@/pages/manager/maintenance/projects/ProjectsHeader', () => ({
  ProjectsHeader: () => <div data-testid="projects-header">ProjectsHeader</div>,
}));

jest.mock('@/pages/manager/maintenance/projects/ProjectsOverview', () => ({
  ProjectsOverview: () => <div data-testid="projects-overview">ProjectsOverview</div>,
}));

jest.mock('@/pages/manager/maintenance/projects/ProjectDetailsPanel', () => ({
  ProjectDetailsPanel: () => <div data-testid="project-details-panel">ProjectDetailsPanel</div>,
}));

jest.mock('@/pages/manager/maintenance/projects/SuggestionsIntegration', () => ({
  SuggestionsIntegration: () => <div data-testid="suggestions-integration">SuggestionsIntegration</div>,
}));

jest.mock('@/pages/manager/maintenance/projects/ProjectTableView', () => ({
  ProjectTableView: () => <div data-testid="project-table-view">ProjectTableView</div>,
}));

jest.mock('@/components/maintenance/auto-projects', () => ({
  AutoProjectsSection: () => <div data-testid="auto-projects-section">AutoProjectsSection</div>,
}));

jest.mock('@/components/maintenance/projects/lazy-components', () => ({
  ProjectForm: () => <div data-testid="project-form">ProjectForm</div>,
  StatusStepper: () => <div data-testid="status-stepper">StatusStepper</div>,
  ProjectTimeline: () => <div data-testid="project-timeline">ProjectTimeline</div>,
  ProjectElements: () => <div data-testid="project-elements">ProjectElements</div>,
  ProjectNotes: () => <div data-testid="project-notes">ProjectNotes</div>,
  ProjectBudget: () => <div data-testid="project-budget">ProjectBudget</div>,
}));

jest.mock('@/components/maintenance/projects/workflow/lazy-components', () => ({
  ProjectWorkflowModal: () => <div data-testid="project-workflow-modal">ProjectWorkflowModal</div>,
}));

import ProjectsPage from '../../../client/src/pages/manager/maintenance/projects';

const defaultQueryFn: QueryFunction = async ({ queryKey, signal }) => {
  const url = (queryKey as readonly unknown[]).join('/') as string;
  const res = await fetch(url, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  return res.json();
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: defaultQueryFn,
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

function renderPage() {
  const queryClient = makeQueryClient();
  const result = render(
    <Router>
      <QueryClientProvider client={queryClient}>
        <ProjectsPage />
      </QueryClientProvider>
    </Router>
  );
  return { ...result, queryClient };
}

describe('ProjectsPage HOC regression — withHierarchicalSelection + wouter mount', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => [{ id: 'o1', name: 'Test Org' }],
    });
    wouter.__resetMocks();
  });

  it('mounts without throwing an Invalid hook call error', () => {
    wouter.__setLocation('/manager/maintenance/projects');
    expect(() => renderPage()).not.toThrow();
  });
});
