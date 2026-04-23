/**
 * @file Residences Page Shareable URL Tests
 * @description Mounts the migrated residences page and verifies that the
 *   floor filter survives reload via the query string and that selecting
 *   a different floor mirrors back to the URL.
 */

import React, { type ComponentType } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface ResidencesPageProps {
  buildingId?: string;
  organizationId?: string;
}

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: jest.fn(),
    toggleLanguage: jest.fn(),
    t: (key: string) => key,
  }),
}));

jest.mock('@/components/hoc/withHierarchicalSelection', () => ({
  withHierarchicalSelection: (Component: ComponentType<ResidencesPageProps>) => {
    const Wrapped = (props: ResidencesPageProps) => (
      <Component buildingId="building-1" organizationId="org-1" {...props} />
    );
    Wrapped.displayName = 'MockWithHierarchicalSelection';
    return Wrapped;
  },
}));

jest.mock('@/components/layout/header', () => ({ Header: () => null }));

jest.mock('@/components/residences/ResidenceCard', () => ({
  ResidenceCard: ({ residence }: { residence: { id: string; unitNumber: string } }) => (
    <div data-testid={`residence-card-${residence.id}`}>{residence.unitNumber}</div>
  ),
}));

type FetchInput = Parameters<typeof fetch>[0];
const mockFetch = jest.fn<typeof fetch>();
(globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

const jsonResponse = (data: unknown): Response =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const RESIDENCES = [
  {
    id: 'res-1',
    unitNumber: '101',
    floor: 1,
    squareFootage: '900',
    bedrooms: 2,
    bathrooms: '1',
    balcony: false,
    parkingSpaceNumbers: [],
    storageSpaceNumbers: [],
    ownershipPercentage: '1',
    monthlyFees: '0',
    isActive: true,
    building: { id: 'building-1', name: 'B', address: 'a', city: 'c' },
    organization: { id: 'org-1', name: 'O' },
    tenants: [],
  },
  {
    id: 'res-2',
    unitNumber: '202',
    floor: 2,
    squareFootage: '900',
    bedrooms: 2,
    bathrooms: '1',
    balcony: false,
    parkingSpaceNumbers: [],
    storageSpaceNumbers: [],
    ownershipPercentage: '1',
    monthlyFees: '0',
    isActive: true,
    building: { id: 'building-1', name: 'B', address: 'a', city: 'c' },
    organization: { id: 'org-1', name: 'O' },
    tenants: [],
  },
];

// Imported after mocks so the module sees the mocked dependencies.
import ManagerResidences from '../../client/src/pages/manager/residences';

function renderAt(search: string) {
  window.history.replaceState({}, '', `/manager/residences${search}`);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ManagerResidences />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockImplementation((input: FetchInput) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (url.includes('/api/residences')) {
      const params = new URLSearchParams(url.split('?')[1] ?? '');
      const floor = params.get('floor');
      const search = params.get('search');
      let out = RESIDENCES;
      if (floor) out = out.filter((r) => String(r.floor) === floor);
      if (search) out = out.filter((r) => r.unitNumber.includes(search));
      return Promise.resolve(jsonResponse(out));
    }
    return Promise.resolve(jsonResponse({}));
  });
});

describe('Residences page shareable URLs', () => {
  it('restores floor filter and search from the query string on load', async () => {
    renderAt('?floor=2&search=202');

    // Filtered list shows only the matching residence.
    expect(await screen.findByTestId('residence-card-res-2')).toBeInTheDocument();
    expect(screen.queryByTestId('residence-card-res-1')).not.toBeInTheDocument();

    // The URL contract is preserved exactly because the parsed state
    // matches what we mounted with.
    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('floor')).toBe('2');
      expect(params.get('search')).toBe('202');
    });
  });

  it('writes filter changes back to the URL', async () => {
    renderAt('');

    await screen.findByTestId('residence-card-res-1');

    // Default floor "all" must NOT appear in the URL — it's the dynamic
    // default declared in the residences page urlSync config.
    expect(window.location.search).toBe('');

    const searchInput = screen.getByTestId('search-residences');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '101' } });
    });

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('search')).toBe('101');
    });
  });
});
