/**
 * @jest-environment jsdom
 *
 * Regression tests for the Tags / Link Families view toggle on the
 * `/admin/document-tags` admin page (task #1404, guarding behaviour added in
 * task #1400).
 *
 * The page renders a single section at a time, controlled by a toggle:
 *   - Default: "Tags" is selected — only the Tags section is visible.
 *   - Clicking "Link Families" hides Tags and shows the Link Families section.
 *   - Clicking "Tags" again restores the original view.
 *
 * Both sections used to render simultaneously prior to #1400; the toggle
 * exists to keep them mutually exclusive. These tests pin that behaviour by
 * asserting on the `data-testid` hooks (`toggle-view-tags`,
 * `toggle-view-families`, `section-link-families`, `button-create-tag`,
 * `button-create-family`).
 *
 * Out of scope (mirrors the task description):
 *   - No Playwright / e2e coverage.
 *   - No exercising the create / edit / delete flows of either section.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks — kept minimal so the page itself is the unit under test.
// ---------------------------------------------------------------------------

jest.mock('wouter', () => ({
  useLocation: () => ['/admin/document-tags', jest.fn()],
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}));

// The Header pulls in heavier layout dependencies (auth, navigation) that
// aren't relevant to the toggle behaviour — stub it out.
jest.mock('@/components/layout/header', () => ({
  Header: ({ title }: { title?: React.ReactNode }) => (
    <header data-testid='page-header'>{title}</header>
  ),
}));

// Mock the Tabs primitive: the real Radix component requires more browser
// APIs than jsdom provides reliably and we only need to verify the page's
// own state-driven rendering. The mock wires `onValueChange` from <Tabs>
// to its <TabsTrigger> children via React context so clicks toggle the
// page's view state exactly like the real component would.
jest.mock('@/components/ui/tabs', () => {
  const TabsCtx = React.createContext<{
    value: string;
    onValueChange: (v: string) => void;
  }>({
    value: '',
    onValueChange: () => {},
  });

  const Tabs = ({
    value,
    onValueChange,
    children,
    ...rest
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
    [key: string]: any;
  }) => (
    <TabsCtx.Provider value={{ value, onValueChange }}>
      <div {...rest}>{children}</div>
    </TabsCtx.Provider>
  );

  const TabsList = ({ children }: { children: React.ReactNode }) => (
    <div role='tablist'>{children}</div>
  );

  const TabsTrigger = ({
    value,
    children,
    ...rest
  }: {
    value: string;
    children: React.ReactNode;
    [key: string]: any;
  }) => {
    const ctx = React.useContext(TabsCtx);
    return (
      <button
        type='button'
        role='tab'
        aria-selected={ctx.value === value}
        onClick={() => ctx.onValueChange(value)}
        {...rest}
      >
        {children}
      </button>
    );
  };

  return { Tabs, TabsList, TabsTrigger };
});

// Import the page AFTER mocks so it picks them up.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdminDocumentTags = require('@/pages/admin/document-tags').default;

function renderPage() {
  // Provide a query client whose default queryFn returns empty payloads.
  // This prevents the page's `useQuery` calls from issuing real network
  // requests and keeps both sections in their (empty) loaded state.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const key = String(queryKey[0]);
          if (key === '/api/document-tags') return { tags: [] };
          if (key === '/api/document-link-families') return { families: [] };
          return {};
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminDocumentTags />
    </QueryClientProvider>
  );
}

describe('Document Tags admin page — Tags / Link Families view toggle (task #1404)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to the Tags view: shows the Tags section and hides the Link Families section', () => {
    const { getByTestId, queryByTestId } = renderPage();

    // Both toggle buttons are always rendered.
    expect(getByTestId('toggle-view-tags')).toBeInTheDocument();
    expect(getByTestId('toggle-view-families')).toBeInTheDocument();

    // Tags is the active selection.
    expect(getByTestId('toggle-view-tags')).toHaveAttribute('aria-selected', 'true');
    expect(getByTestId('toggle-view-families')).toHaveAttribute('aria-selected', 'false');

    // Tags section is rendered (its "create" button is the section's anchor).
    expect(getByTestId('button-create-tag')).toBeInTheDocument();

    // Link Families section is NOT rendered.
    expect(queryByTestId('section-link-families')).not.toBeInTheDocument();
    expect(queryByTestId('button-create-family')).not.toBeInTheDocument();
  });

  it('switches to the Link Families view when its toggle is clicked', () => {
    const { getByTestId, queryByTestId } = renderPage();

    fireEvent.click(getByTestId('toggle-view-families'));

    // Selection moves to families.
    expect(getByTestId('toggle-view-families')).toHaveAttribute('aria-selected', 'true');
    expect(getByTestId('toggle-view-tags')).toHaveAttribute('aria-selected', 'false');

    // Link Families section is now rendered.
    expect(getByTestId('section-link-families')).toBeInTheDocument();
    expect(getByTestId('button-create-family')).toBeInTheDocument();

    // Tags section is hidden.
    expect(queryByTestId('button-create-tag')).not.toBeInTheDocument();
  });

  it('restores the Tags view when the Tags toggle is clicked again', () => {
    const { getByTestId, queryByTestId } = renderPage();

    // Switch to families first…
    fireEvent.click(getByTestId('toggle-view-families'));
    expect(getByTestId('section-link-families')).toBeInTheDocument();
    expect(queryByTestId('button-create-tag')).not.toBeInTheDocument();

    // …then back to tags.
    fireEvent.click(getByTestId('toggle-view-tags'));

    expect(getByTestId('toggle-view-tags')).toHaveAttribute('aria-selected', 'true');
    expect(getByTestId('toggle-view-families')).toHaveAttribute('aria-selected', 'false');

    expect(getByTestId('button-create-tag')).toBeInTheDocument();
    expect(queryByTestId('section-link-families')).not.toBeInTheDocument();
    expect(queryByTestId('button-create-family')).not.toBeInTheDocument();
  });
});
