/**
 * @file ElementDetailsPanel date-display unit test
 *
 * Regression guard for the fr-CA / negative-offset date-shift bug in the
 * Element Details panel `plannedStartDate` rendering (panel "Projects" tab).
 *
 * `ElementDetailsPanel.tsx` was fixed in Task #1146 to use `parseDateOnly`
 * instead of `parseISO` for `originalConstructionDate`, `nextEvaluationDate`,
 * and `plannedStartDate`. The first two are exercised by the e2e suite via
 * the seeded element on the inventory page. The `plannedStartDate` value
 * comes from the related-projects query, which is fetched from a separate
 * endpoint that cannot be seeded for an arbitrary demo element through the
 * admin REST API — so this test pre-populates the React Query cache and
 * renders the panel directly to verify that:
 *
 *   - `plannedStartDate = '2026-05-01'` renders as `May 2026` (not
 *     `Apr 2026`) under `TZ=America/Montreal` (UTC-4).
 *   - `parseDateOnly` keeps the calendar month stable across negative-offset
 *     timezones, so a future regression that swaps it back to `parseISO`
 *     fails this test.
 */

// Force a negative-offset timezone for the entire test process before any
// imports observe Date semantics. Only `parseDateOnly` keeps the calendar
// day stable here; `parseISO('2026-05-01')` would roll back to April 30 and
// the assertions below would fail.
process.env.TZ = 'America/Montreal';

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ElementDetailsPanel } from '../../../client/src/pages/manager/maintenance/inventory/ElementDetailsPanel';
import { LanguageProvider } from '../../../client/src/hooks/use-language';

// Tooltip / Toaster providers aren't required by the panel itself.

// `IntersectionObserver` is missing in jsdom — Radix uses it internally.
if (typeof (globalThis as any).IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): unknown[] {
      return [];
    }
  }
  (globalThis as any).IntersectionObserver = IntersectionObserverStub;
}

// `ResizeObserver` is also missing in jsdom — required by Radix Tabs.
if (typeof (globalThis as any).ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as any).ResizeObserver = ResizeObserverStub;
}

if (typeof (Element.prototype as any).hasPointerCapture !== 'function') {
  (Element.prototype as any).hasPointerCapture = () => false;
}
if (typeof (Element.prototype as any).releasePointerCapture !== 'function') {
  (Element.prototype as any).releasePointerCapture = () => {};
}
if (typeof (Element.prototype as any).scrollIntoView !== 'function') {
  (Element.prototype as any).scrollIntoView = () => {};
}

function buildElement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'elem-test-1',
    name: 'Test Element',
    description: 'Test description',
    buildingId: 'bld-1',
    organizationId: 'org-1',
    uniformatCode: 'B2010',
    currentCondition: 'good',
    originalLifespan: 30,
    currentLifespan: 30,
    originalConstructionDate: '2010-01-01',
    nextEvaluationDate: null,
    lastInspectionDate: null,
    ...overrides,
  } as unknown as Parameters<typeof ElementDetailsPanel>[0]['element'];
}

function renderPanelWithProjects(plannedStartDate: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        // Pre-populated below; do not allow background refetch from missing fn.
        gcTime: Infinity,
      },
    },
  });

  const element = buildElement();

  // Pre-populate the three queries the panel issues so React Query never
  // attempts a network fetch and the panel renders the projects tab content
  // synchronously.
  queryClient.setQueryData(
    ['/api/maintenance/elements', element!.id, 'history'],
    { history: [] },
  );
  queryClient.setQueryData(
    ['/api/maintenance/elements', element!.id, 'documents'],
    { documents: [] },
  );
  queryClient.setQueryData(
    ['/api/maintenance/elements', element!.id, 'projects'],
    {
      projects: [
        {
          id: 'proj-test-1',
          title: 'Test Project',
          projectNumber: '0001',
          status: 'planned',
          type: 'maintenance',
          plannedStartDate,
        },
      ],
    },
  );

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ElementDetailsPanel
          element={element}
          isOpen={true}
          onClose={() => {}}
        />
      </LanguageProvider>
    </QueryClientProvider>,
  );

  return { ...utils, element };
}

describe('ElementDetailsPanel — plannedStartDate uses parseDateOnly', () => {
  it(
    'renders plannedStartDate "2026-05-01" as "May 2026" in TZ=America/Montreal (no UTC roll-back to Apr)',
    async () => {
      const { element } = renderPanelWithProjects('2026-05-01');

      // Switch to the Projects tab so the planned-start cell mounts.
      const user = userEvent.setup();
      const projectsTab = await screen.findByRole('tab', { name: /projects?|projets?/i });
      await user.click(projectsTab);

      const cell = await waitFor(() => {
        const el = document.querySelector('[data-testid="project-planned-start-proj-test-1"]');
        if (!el) throw new Error('planned-start cell not yet rendered');
        return el;
      });
      expect(cell).not.toBeNull();

      const text = (cell?.textContent ?? '').trim();

      // parseDateOnly keeps the calendar month stable; parseISO + Montreal
      // would have rolled back to 2026-04-30 and rendered the previous month
      // ("Apr 2026" in en, "avr. 2026" in fr). Accept either locale's May
      // ("May" in en / "mai" in fr) but never any April variant.
      expect(text).toMatch(/May|mai/);
      expect(text).toContain('2026');
      expect(text).not.toMatch(/\bApr\b/);
      expect(text).not.toContain('April');
      expect(text).not.toContain('avr');
    },
  );

  it('omits the date suffix when plannedStartDate is missing', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
      },
    });
    const element = buildElement();

    queryClient.setQueryData(
      ['/api/maintenance/elements', element!.id, 'history'],
      { history: [] },
    );
    queryClient.setQueryData(
      ['/api/maintenance/elements', element!.id, 'documents'],
      { documents: [] },
    );
    queryClient.setQueryData(
      ['/api/maintenance/elements', element!.id, 'projects'],
      {
        projects: [
          {
            id: 'proj-no-date',
            title: 'No-Date Project',
            projectNumber: '0002',
            status: 'planned',
            type: 'maintenance',
            plannedStartDate: null,
          },
        ],
      },
    );

    render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <ElementDetailsPanel
            element={element}
            isOpen={true}
            onClose={() => {}}
          />
        </LanguageProvider>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    const projectsTab = screen.getByRole('tab', { name: /projects?|projets?/i });
    await user.click(projectsTab);

    const cell = await waitFor(() => {
      const el = document.querySelector('[data-testid="project-planned-start-proj-no-date"]');
      if (!el) throw new Error('planned-start cell not yet rendered');
      return el;
    });
    expect(cell).not.toBeNull();
    const text = (cell?.textContent ?? '').trim();

    // No leading bullet/dot when there's no plannedStartDate.
    expect(text).not.toContain('•');
    expect(text).toContain('maintenance');
  });
});
