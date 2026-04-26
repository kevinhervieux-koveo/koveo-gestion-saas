/**
 * @jest-environment jsdom
 *
 * Jank-regression guard for the manager Demands page (extends task #1163).
 *
 * ManagerDemandsPage already routes the search box through
 * `useDeferredValue` and dispatches non-text filter changes
 * (status / type / building / residence / creator) through
 * `startTransition` (see `client/src/pages/manager/demands.tsx`). Without
 * those wrappers the cascading filter recomputes (which scan every demand
 * record) run inside the keystroke / click handler and Chromium prints
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

// Force the filters panel always-expanded and pass each filter's
// `customComponent` straight through. The real CollapsibleFilters keeps
// the inputs hidden until the user clicks the toggle, which would defeat
// the purpose of measuring keystroke / click handlers below.
jest.mock('../../../client/src/components/ui/collapsible-filters', () => ({
  CollapsibleFilters: ({ filters }: any) => (
    <div data-testid="collapsible-filters-stub">
      {filters?.map((f: any) => (
        <div key={f.id} data-testid={`filter-slot-${f.id}`}>
          {f.customComponent}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('../../../client/src/components/demands/demand-details-popup', () => ({
  __esModule: true,
  default: () => <div data-testid="demand-details-popup" />,
}));

jest.mock('../../../client/src/components/layout/header', () => ({
  Header: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

// Lightweight stand-ins for shadcn primitives that wire onChange / onClick
// straight through, so fireEvent reaches the real ManagerDemandsPage
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
jest.mock('../../../client/src/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...rest }: any) => (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...rest}
    />
  ),
}));
jest.mock('../../../client/src/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children }: any) => <div>{children}</div>,
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

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
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

import ManagerDemandsPage from '../../../client/src/pages/manager/demands';

function renderDemandsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ManagerDemandsPage />
    </QueryClientProvider>,
  );
}

describe('ManagerDemandsPage — UI jank guard (extends task #1163)', () => {
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

  it('typing in the demands search field stays responsive', async () => {
    renderDemandsPage();

    // The page renders a "loadingDemands" panel until the `/api/demands`
    // query resolves; wait for the search input to appear before driving
    // keystrokes so the test exercises the real handler.
    const input = (await screen.findByTestId('input-search-demands')) as HTMLInputElement;

    // ManagerDemandsPage mirrors the search box through useDeferredValue
    // so the cascading `uniqueBuildings` / `uniqueResidences` /
    // `uniqueCreators` / `filteredDemands` recomputes (each O(n) over
    // every demand) run at lower priority and don't block the keystroke.
    for (const value of ['p', 'pl', 'plu', 'plum', 'plumb', 'plumbing']) {
      detector.runAndMeasure(`type "${value}"`, () => {
        fireEvent.change(input, { target: { value } });
      });
    }
    act(() => {});

    detector.assertNoJank();
  });

  it('changing the status filter does not block the click handler', async () => {
    renderDemandsPage();

    // Wait for the loading state to clear so the status SelectItem is
    // present in the DOM (it lives inside the CollapsibleFilters tree).
    await screen.findByTestId('select-item-in_progress');

    // The status filter setter is dispatched through startTransition;
    // without that wrapper the cascading filter recomputes would run
    // inside the click and trip the detector.
    detector.runAndMeasure('change status filter to in_progress', () => {
      fireEvent.click(screen.getByTestId('select-item-in_progress'));
    });
    act(() => {});

    detector.assertNoJank();
  });
});
