/**
 * Task #979 — ProfileResidences widget
 *
 * Verifies that:
 * 1. The skeleton is shown while the query is loading.
 * 2. The empty-state message appears when the API returns an empty array.
 * 3. Residence rows (building name, unit, org, relationship, start date)
 *    are rendered when the API returns data.
 * 4. A clear error message is shown when the query fails.
 *
 * The test mocks @tanstack/react-query to control query state without
 * any real network calls.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock useQuery to control query state
// ---------------------------------------------------------------------------
const mockUseQuery = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  QueryClient: jest.fn().mockImplementation(() => ({})),
  QueryClientProvider: ({ children }: any) => children,
}));

// ---------------------------------------------------------------------------
// Mock use-language hook
// ---------------------------------------------------------------------------
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Stub UI primitives
// ---------------------------------------------------------------------------
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid='card' {...props}>{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid='card-header'>{children}</div>,
  CardTitle: ({ children }: any) => <h2 data-testid='card-title'>{children}</h2>,
  CardContent: ({ children }: any) => <div data-testid='card-content'>{children}</div>,
}));

jest.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div data-testid='skeleton' className={className} />,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid='badge' data-variant={variant} className={className}>{children}</span>
  ),
}));

jest.mock('lucide-react', () => ({
  Home: () => <svg data-testid='home-icon' />,
  AlertCircle: () => <svg data-testid='alert-circle-icon' />,
}));

// ---------------------------------------------------------------------------
// Import the component under test AFTER all mocks are set up
// ---------------------------------------------------------------------------
import { ProfileResidences } from '@/components/profile-residences';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SAMPLE_ROWS = [
  {
    id: 'link-1',
    residenceId: 'res-1',
    unitNumber: '101',
    buildingName: 'Maple Tower',
    organizationName: 'Maple Corp',
    relationshipType: 'tenant',
    startDate: '2024-01-15',
  },
  {
    id: 'link-2',
    residenceId: 'res-2',
    unitNumber: '202',
    buildingName: 'Oak Building',
    organizationName: 'Oak Syndicate',
    relationshipType: 'owner',
    startDate: '2023-06-01',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ProfileResidences widget', () => {
  it('shows skeletons while loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<ProfileResidences />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('profile-residences-empty')).toBeNull();
    expect(screen.queryByTestId('profile-residences-list')).toBeNull();
  });

  it('shows the empty-state message when the API returns an empty array', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<ProfileResidences />);
    const empty = screen.getByTestId('profile-residences-empty');
    expect(empty).toBeInTheDocument();
    expect(empty.textContent).toContain('noResidenceLinkedYet');
    expect(screen.queryByTestId('profile-residences-list')).toBeNull();
    expect(screen.queryByTestId('skeleton')).toBeNull();
  });

  it('renders rows with the correct data when the API returns residences', () => {
    mockUseQuery.mockReturnValue({ data: SAMPLE_ROWS, isLoading: false, isError: false });
    render(<ProfileResidences />);
    const list = screen.getByTestId('profile-residences-list');
    expect(list).toBeInTheDocument();

    const row1 = screen.getByTestId('profile-residence-row-link-1');
    expect(row1.textContent).toContain('Maple Tower');
    expect(row1.textContent).toContain('101');
    expect(row1.textContent).toContain('Maple Corp');

    const row2 = screen.getByTestId('profile-residence-row-link-2');
    expect(row2.textContent).toContain('Oak Building');
    expect(row2.textContent).toContain('202');
    expect(row2.textContent).toContain('Oak Syndicate');

    expect(screen.queryByTestId('profile-residences-empty')).toBeNull();
    expect(screen.queryByTestId('skeleton')).toBeNull();
  });

  it('shows a distinct error message when the API call fails', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<ProfileResidences />);
    const error = screen.getByTestId('profile-residences-error');
    expect(error).toBeInTheDocument();
    expect(error.textContent).toContain('residencesLoadError');
    expect(screen.queryByTestId('profile-residences-empty')).toBeNull();
    expect(screen.queryByTestId('profile-residences-list')).toBeNull();
    expect(screen.queryByTestId('skeleton')).toBeNull();
  });
});
