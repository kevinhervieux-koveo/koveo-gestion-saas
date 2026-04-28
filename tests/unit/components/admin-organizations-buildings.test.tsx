/**
 * @jest-environment jsdom
 *
 * Task #1690 — regression guard for admin OrganizationsCard building display.
 *
 * Before the fix, the card called GET /api/organizations/:id/buildings (non-existent).
 * After the fix, it fetches GET /api/buildings (scoped) and groups by organizationId.
 *
 * This suite asserts:
 * 1. Building counts render correctly under each organization card.
 * 2. The component never calls the non-existent /api/organizations/:id/buildings endpoint.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/common-hooks', () => ({
  useCreateUpdateMutation: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
}));

jest.mock('@/lib/i18n/enumLabels', () => ({
  enumLabels: {
    orgType: (_type: string, _lang: string) => _type,
  },
}));

jest.mock('./organization-form-dialog', () => ({
  OrganizationFormDialog: () => null,
}), { virtual: true });

jest.mock(
  '../../../client/src/components/admin/organization-form-dialog',
  () => ({ OrganizationFormDialog: () => null }),
);

jest.mock(
  '../../../client/src/components/dialogs/delete-confirmation-dialog',
  () => ({ DeleteConfirmationDialog: () => null }),
);

jest.mock('lucide-react', () => new Proxy({}, { get: () => () => <span /> }));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: () => null,
  AlertDialogAction: ({ children }: any) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
}));

const TEST_ORGS = [
  { id: 'org-a', name: 'Alpha Org', type: 'syndicate', address: '1 Main St', city: 'Montreal', province: 'QC', isActive: true },
  { id: 'org-b', name: 'Beta Org', type: 'cooperative', address: '2 Oak Ave', city: 'Quebec', province: 'QC', isActive: true },
];

const TEST_BUILDINGS = [
  { id: 'bld-1', name: 'Tower A', city: 'Montreal', organizationId: 'org-a', isActive: true },
  { id: 'bld-2', name: 'Tower B', city: 'Montreal', organizationId: 'org-a', isActive: true },
  { id: 'bld-3', name: 'Villa C', city: 'Quebec', organizationId: 'org-b', isActive: true },
];

const calledUrls: string[] = [];

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn((_method: string, url: string) => {
    calledUrls.push(url);
    return Promise.resolve({
      ok: true,
      json: async () => {
        if (url === '/api/organizations') return TEST_ORGS;
        if (url === '/api/buildings') return TEST_BUILDINGS;
        return [];
      },
    });
  }),
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}));

import { OrganizationsCard } from '../../../client/src/components/admin/organizations-card';

function renderCard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <OrganizationsCard />
    </QueryClientProvider>,
  );
}

describe('OrganizationsCard — buildings display (task #1690)', () => {
  beforeEach(() => {
    calledUrls.length = 0;
  });

  it('renders building count for each organization', async () => {
    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Alpha Org')).toBeInTheDocument();
    });

    expect(screen.getByText('Beta Org')).toBeInTheDocument();

    expect(screen.getByText('Tower A')).toBeInTheDocument();
    expect(screen.getByText('Tower B')).toBeInTheDocument();
    expect(screen.getByText('Villa C')).toBeInTheDocument();
  });

  it('does NOT call the non-existent /api/organizations/:id/buildings endpoint', async () => {
    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Alpha Org')).toBeInTheDocument();
    });

    const badCalls = calledUrls.filter((u) => /\/api\/organizations\/.+\/buildings/.test(u));
    expect(badCalls).toHaveLength(0);
  });

  it('calls GET /api/buildings (the correct endpoint) exactly once', async () => {
    renderCard();

    await waitFor(() => {
      expect(screen.getByText('Alpha Org')).toBeInTheDocument();
    });

    const buildingCalls = calledUrls.filter((u) => u === '/api/buildings');
    expect(buildingCalls).toHaveLength(1);
  });
});
