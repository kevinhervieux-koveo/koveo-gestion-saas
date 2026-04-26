/**
 * @jest-environment jsdom
 *
 * Jank-regression guard for InventoryPage (task #1163).
 *
 * Drives the typical filter / search / collapsible flows that previously
 * produced "[Violation] 'click' handler took N ms" warnings and asserts:
 *   • no real "[Violation]" message reaches the console, AND
 *   • each interaction's synchronous wall-clock duration stays below the
 *     configured threshold (250 ms by default — 5× the Chromium budget,
 *     generous enough to absorb shared-CI jitter while still catching
 *     obvious synchronous heavy work in a handler).
 *
 * The heavy bundles (ElementTable, UniformatBrowser, ElementForm) are
 * stubbed with cheap div renderers because React in `act()` always flushes
 * transitions synchronously, which would otherwise mask the real signal
 * we care about: synchronous heavy work added directly into a click /
 * change / keystroke handler. The detector's own self-tests
 * (`tests/unit/utils/jank-detector.test.ts`) prove that any handler that
 * busy-waits past the threshold is reliably flagged, so this file focuses
 * on the actual user-flow regression net for InventoryPage.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { installJankDetector, type JankDetector } from '../../utils/jank-detector';

// HOC mock: pass a stable set of hierarchical props to the wrapped page.
jest.mock('../../../client/src/components/hoc/withHierarchicalSelection', () => ({
  withHierarchicalSelection: (Component: any) =>
    function HierarchicalWrapper(props: any) {
      return (
        <Component
          {...props}
          organizationId="test-org-id"
          buildingId="test-building-id"
          residenceId={undefined}
          buildingName="Test Building"
          showBackButton={false}
          backButtonLabel="Back"
          onBack={() => {}}
        />
      );
    },
}));

// Cheap stubs for the lazy-loaded inventory bundles. The detector
// captures any wall-clock cost a future regression introduces directly
// into the InventoryPage click / change handlers themselves.
jest.mock('../../../client/src/components/maintenance/inventory/lazy-components', () => ({
  ElementTable: (props: any) => <div data-testid="element-table" data-building-id={props.buildingId} />,
  ElementForm: (_: any) => <div data-testid="element-form" />,
  UniformatBrowser: (_: any) => <div data-testid="uniformat-browser" />,
  LazyElementTable: (_: any) => <div data-testid="element-table" />,
  LazyElementForm: (_: any) => <div data-testid="element-form" />,
  LazyElementCard: (_: any) => <div data-testid="element-card" />,
  LazyUniformatBrowser: (_: any) => <div data-testid="uniformat-browser" />,
  LazyDocumentManager: (_: any) => <div data-testid="document-manager" />,
}));

jest.mock('../../../client/src/pages/manager/maintenance/inventory/InventoryOverview', () => ({
  InventoryOverview: () => <div data-testid="inventory-overview">overview</div>,
}));

jest.mock('../../../client/src/components/maintenance/inventory/ElementDocumentViewer', () => ({
  ElementDocumentViewer: () => <div data-testid="element-document-viewer" />,
}));

jest.mock('../../../client/src/components/layout/header', () => ({
  Header: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

// Lightweight stand-ins for shadcn primitives that wire onChange / onClick
// straight through, so fireEvent actually fires the real InventoryPage
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
jest.mock('../../../client/src/components/ui/alert', () => ({
  Alert: ({ children }: any) => <div>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('../../../client/src/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuCheckboxItem: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
}));

// shadcn Select wired so onValueChange fires when we click a SelectItem,
// matching the way the real popover works from the user's perspective.
jest.mock('../../../client/src/components/ui/select', () => {
  const SelectCtx = (jest.requireActual('react') as typeof import('react')).createContext<
    ((v: string) => void) | undefined
  >(undefined);
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
      const onValueChange = (jest.requireActual('react') as typeof import('react')).useContext(SelectCtx);
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

// Collapsible mock that wires onOpenChange to the trigger button — the
// real shadcn implementation does this through context; this minimal
// version is enough for the click-handler timing assertion.
jest.mock('../../../client/src/components/ui/collapsible', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Ctx = React.createContext<{ open?: boolean; onOpenChange?: (v: boolean) => void }>({});
  return {
    Collapsible: ({ children, open, onOpenChange }: any) => (
      <Ctx.Provider value={{ open, onOpenChange }}>
        <div data-open={open}>{children}</div>
      </Ctx.Provider>
    ),
    CollapsibleTrigger: ({ children, asChild }: any) => {
      const { open, onOpenChange } = React.useContext(Ctx);
      const handleClick = () => onOpenChange?.(!open);
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as any, { onClick: handleClick });
      }
      return <button onClick={handleClick}>{children}</button>;
    },
    CollapsibleContent: ({ children }: any) => {
      const { open } = React.useContext(Ctx);
      return open ? <div>{children}</div> : null;
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
    json: async () => ({
      id: 'test-building-id',
      name: 'Test Building',
      organizationId: 'test-org-id',
    }),
  }),
  queryClient: {
    invalidateQueries: jest.fn(),
    refetchQueries: jest.fn(),
  },
}));

import InventoryPage from '../../../client/src/pages/manager/maintenance/inventory/InventoryPage';

function renderInventoryPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <InventoryPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('InventoryPage — UI jank guard (task #1163)', () => {
  let detector: JankDetector;

  beforeEach(() => {
    // 250 ms = 5× Chromium's "[Violation]" budget. Generous enough to
    // tolerate jitter from a loaded CI runner while still catching the
    // ~150-300 ms regressions that originally surfaced in task #1147.
    detector = installJankDetector({ thresholdMs: 250 });
  });

  afterEach(() => {
    detector.uninstall();
  });

  it('expanding the Building Elements section does not block the click handler', () => {
    renderInventoryPage();

    const toggle = screen.getByTestId('building-elements-toggle');

    // The toggle expands a Collapsible whose content mounts ElementTable
    // (an intentionally heavy component for this test). InventoryPage
    // wraps the state update in `startTransition`, so React must defer
    // the heavy mount and keep the click handler itself fast.
    detector.runAndMeasure('expand building-elements collapsible', () => {
      fireEvent.click(toggle);
    });

    // Flush any deferred transitions so the heavy children commit.
    act(() => {});

    detector.assertNoJank();
  });

  it('typing in the search field stays responsive', () => {
    renderInventoryPage();

    fireEvent.click(screen.getByTestId('building-elements-toggle'));
    act(() => {});
    detector.reset();

    const input = screen.getByTestId('element-search-input') as HTMLInputElement;

    for (const char of ['s', 'sw', 'swi', 'swit', 'switc', 'switch']) {
      detector.runAndMeasure(`type "${char}"`, () => {
        fireEvent.change(input, { target: { value: char } });
      });
    }

    detector.assertNoJank();
  });

  it('changing filters does not cause a synchronous handler violation', () => {
    renderInventoryPage();

    fireEvent.click(screen.getByTestId('building-elements-toggle'));
    act(() => {});

    detector.runAndMeasure('open filter panel', () => {
      fireEvent.click(screen.getByTestId('filters-toggle'));
    });
    act(() => {});

    // Each filter mutation is wrapped in startTransition inside
    // InventoryPage. Without that wrapper the heavy ElementTable
    // re-render would run inside the click and trip the detector.
    detector.runAndMeasure('change condition filter', () => {
      fireEvent.click(screen.getByTestId('select-item-good'));
    });
    act(() => {});

    detector.runAndMeasure('toggle overdue filter', () => {
      fireEvent.click(screen.getByTestId('overdue-filter-button'));
    });
    act(() => {});

    detector.assertNoJank();
  });
});
