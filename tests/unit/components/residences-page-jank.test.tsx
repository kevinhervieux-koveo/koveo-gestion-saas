/**
 * @jest-environment jsdom
 *
 * Jank-regression guard for the manager Residences page (extends task #1163).
 *
 * ManagerResidences mirrors the search box through `useDeferredValue` so
 * the heavy `/api/residences` refetch + grid re-render runs at lower
 * priority, and dispatches the floor-filter Select through
 * `startTransition` (see `client/src/pages/manager/residences.tsx`).
 * Without those wrappers the network refetch + grid re-render runs
 * inside the keystroke / click handler and Chromium prints
 * "[Violation] '<event>' handler took N ms" warnings the harness is
 * designed to catch.
 *
 * This file mirrors the InventoryPage jank guard (task #1163) so a future
 * refactor that drops the deferred wrappers — or introduces new
 * synchronous heavy work into a search/filter handler — fails CI instead
 * of silently regressing the UX.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { installJankDetector, type JankDetector } from '../../utils/jank-detector';

// HOC mock: pass a stable set of hierarchical props to the wrapped page so
// ManagerResidences renders its body instead of the org/building picker.
jest.mock('../../../client/src/components/hoc/withHierarchicalSelection', () => ({
  withHierarchicalSelection: (Component: any) =>
    function HierarchicalWrapper(props: any) {
      return (
        <Component
          {...props}
          organizationId="test-org-id"
          buildingId="test-building-id"
          buildingName="Test Building"
          showBackButton={false}
          backButtonLabel="Back"
          onBack={() => {}}
        />
      );
    },
}));

// Cheap stubs for the heavy residence bundles. The detector measures any
// wall-clock cost a future regression introduces directly into the
// page's keystroke / click handlers themselves.
jest.mock('../../../client/src/components/residences/ResidenceCard', () => ({
  ResidenceCard: () => <div data-testid="residence-card" />,
}));
jest.mock('../../../client/src/components/forms/residence-edit-form', () => ({
  ResidenceEditForm: () => <div data-testid="residence-edit-form" />,
}));
jest.mock('../../../client/src/components/common/PaginationControls', () => ({
  PaginationControls: () => <div data-testid="pagination-controls" />,
}));

// Forward the SearchInput's onChange directly so fireEvent reaches the
// page's `handleSearchChange` (which calls useTableState's
// setSearchTerm) without going through the icon-decorated wrapper.
jest.mock('../../../client/src/components/common/SearchInput', () => ({
  SearchInput: ({ value, onChange, ...rest }: any) => (
    <input
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      {...rest}
    />
  ),
}));

jest.mock('../../../client/src/components/layout/header', () => ({
  Header: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

// Lightweight stand-ins for shadcn primitives that wire onChange / onClick
// straight through, so fireEvent reaches the real ManagerResidences
// handlers instead of being absorbed by Radix internals.
jest.mock('../../../client/src/components/ui/button', () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>{children}</button>
  ),
}));
jest.mock('../../../client/src/components/ui/input', () => ({
  Input: ({ value, onChange, ...rest }: any) => (
    <input value={value ?? ''} onChange={onChange} {...rest} />
  ),
}));
jest.mock('../../../client/src/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
jest.mock('../../../client/src/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));
jest.mock('../../../client/src/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

// shadcn Select wired so onValueChange fires when we click a SelectItem,
// matching the way the real popover works from the user's perspective.
jest.mock('../../../client/src/components/ui/select', () => {
  const ActualReact = jest.requireActual('react') as typeof import('react');
  const SelectCtx = ActualReact.createContext<((v: string) => void) | undefined>(undefined);
  return {
    Select: ({ children, onValueChange }: any) => (
      <SelectCtx.Provider value={onValueChange}>
        <div data-testid="select-root">{children}</div>
      </SelectCtx.Provider>
    ),
    SelectTrigger: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectItem: ({ children, value }: any) => {
      const onValueChange = ActualReact.useContext(SelectCtx);
      return (
        <button
          data-testid={`select-item-${value}`}
          onClick={() => onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
  };
});

jest.mock('lucide-react', () => new Proxy({}, {
  get: () => () => <span />,
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
  LanguageProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  }),
  queryClient: {
    invalidateQueries: jest.fn(),
    refetchQueries: jest.fn(),
  },
}));

import ManagerResidencesPage from '../../../client/src/pages/manager/residences';

function renderResidencesPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ManagerResidencesPage />
    </QueryClientProvider>,
  );
}

describe('ManagerResidencesPage — UI jank guard (extends task #1163)', () => {
  let detector: JankDetector;

  beforeEach(() => {
    // 100 ms convention shared across the jank-guard suites: anything
    // above this prints as "[Violation] '<event>' handler took N ms" in
    // Chromium, which is the user-visible regression we want to catch.
    detector = installJankDetector({ thresholdMs: 100 });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => [],
    }) as any;
  });

  afterEach(() => {
    detector.uninstall();
  });

  it('typing in the residences search field stays responsive', () => {
    renderResidencesPage();

    const input = screen.getByTestId('search-residences') as HTMLInputElement;

    // ManagerResidences mirrors the search term through useDeferredValue
    // so the controlled input updates urgently while the heavy
    // `/api/residences` refetch + grid re-render run at lower priority.
    for (const value of ['1', '10', '101', '101a', '101ap', '101apt']) {
      detector.runAndMeasure(`type "${value}"`, () => {
        fireEvent.change(input, { target: { value } });
      });
    }
    act(() => {});

    detector.assertNoJank();
  });

  it('changing the floor filter does not block the click handler', () => {
    renderResidencesPage();

    // `handleFloorChange` dispatches the filter update through
    // startTransition — without that wrapper the residences refetch
    // would run inside the click and trip the detector.
    detector.runAndMeasure('change floor filter to all', () => {
      fireEvent.click(screen.getByTestId('select-item-all'));
    });
    act(() => {});

    detector.assertNoJank();
  });
});
