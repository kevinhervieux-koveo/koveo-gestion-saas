/**
 * Task #1274 — date-only fields must not roll back a day under negative-UTC
 * timezones. Forces TZ=America/Vancouver (UTC-8 / -7 with DST) before any
 * import so Date semantics in the test process are negative-offset.
 */
process.env.TZ = 'America/Vancouver';

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { parseDateOnly, parseDateOnlyLoose } from '../../../client/src/lib/utils';
import { LanguageProvider } from '../../../client/src/hooks/use-language';
import { SuggestionCard } from '../../../client/src/components/maintenance/suggestions/SuggestionCard';
import type { SuggestionWithElement } from '../../../client/src/components/maintenance/suggestions/types';
import { InvoiceCard } from '../../../client/src/components/invoice-management/InvoiceCard';
import type { Invoice } from '../../../shared/schemas/invoices';
import { sortBills } from '../../../client/src/pages/manager/bills-sort';

if (typeof (globalThis as any).IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): unknown[] { return []; }
  }
  (globalThis as any).IntersectionObserver = IntersectionObserverStub;
}
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

jest.mock('../../../client/src/hooks/use-building-context', () => ({
  useBuildingContext: () => ({ hasPermission: () => true }),
}));
jest.mock('../../../client/src/hooks/use-toast', () => ({
  useToast: () => ({ toast: () => {} }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>{ui}</LanguageProvider>
    </QueryClientProvider>,
  );
}

const suggestionFixture: SuggestionWithElement = {
  id: 'sugg-tz-1',
  buildingElementId: 'elem-1',
  organizationId: 'org-1',
  buildingId: 'bld-1',
  title: 'Inspect HVAC',
  description: 'Routine inspection',
  type: 'maintenance',
  suggestedType: 'maintenance',
  priority: 'medium',
  status: 'pending',
  suggestedDate: '2026-05-01',
  costEstimate: 1500,
  postponedTo: null,
  createdAt: new Date('2026-04-15T12:00:00.000Z'),
  updatedAt: new Date('2026-04-15T12:00:00.000Z'),
  element: {
    id: 'elem-1',
    name: 'HVAC Unit',
    currentCondition: 'good',
  },
} as unknown as SuggestionWithElement;

const invoiceFixture: Invoice = {
  id: 'inv-tz-1',
  organizationId: 'org-1',
  buildingId: 'bld-1',
  vendorName: 'Acme Co',
  invoiceNumber: 'INV-001',
  totalAmount: '250.00',
  paymentType: 'unique',
  dueDate: '2026-05-01',
  startDate: null,
  frequency: null,
  isAiExtracted: false,
  documentId: null,
  customPaymentDates: null,
  paymentDates: null,
  createdAt: new Date('2026-04-15T12:00:00.000Z'),
  updatedAt: new Date('2026-04-15T12:00:00.000Z'),
} as unknown as Invoice;

describe('Date-only fields under TZ=America/Vancouver (UTC-8)', () => {
  it('parseDateOnly: "2026-05-01" stays on May 1 in negative-offset TZ', () => {
    const d = parseDateOnly('2026-05-01');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(1);
  });

  it('SuggestionCard renders suggestedDate "2026-05-01" as May 1, not Apr 30', () => {
    renderWithProviders(<SuggestionCard suggestion={suggestionFixture} compact={false} />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/May 1/);
    expect(text).not.toMatch(/Apr(?:il)? 30/);
  });

  it('InvoiceCard renders dueDate "2026-05-01" as May 01, 2026 (not Apr 30)', () => {
    renderWithProviders(<InvoiceCard invoice={invoiceFixture} />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/May 0?1, 2026/);
    expect(text).not.toMatch(/Apr(?:il)? 30, 2026/);
  });

  it('sortBills (issueDate) compares date-only strings by calendar day, not UTC midnight', () => {
    type Bill = { id: string; issueDate?: string | null; startDate?: string | null; totalAmount?: string };
    const bills: Bill[] = [
      { id: 'a', issueDate: '2026-05-01', startDate: '2026-05-15' },
      { id: 'b', issueDate: '2026-04-30', startDate: '2026-05-15' },
      { id: 'c', issueDate: null, startDate: '2026-05-15' },
    ];
    const ascending = sortBills(bills, 'issueDate', 'asc').map((b) => b.id);
    expect(ascending).toEqual(['b', 'a', 'c']);
    const descending = sortBills(bills, 'issueDate', 'desc').map((b) => b.id);
    expect(descending).toEqual(['a', 'b', 'c']);
  });

  it('sortBills (dueDate) tolerates UTC-midnight ISO timestamps for date-only fields', () => {
    type Bill = { id: string; startDate?: string | null; issueDate?: string | null; totalAmount?: string };
    const bills: Bill[] = [
      { id: 'iso-late', startDate: '2026-05-02T00:00:00.000Z' },
      { id: 'iso-early', startDate: '2026-05-01T00:00:00.000Z' },
    ];
    const ordered = sortBills(bills, 'dueDate', 'asc').map((b) => b.id);
    expect(ordered).toEqual(['iso-early', 'iso-late']);
  });

  it('common-spaces unavailable-period overlap uses calendar days, not UTC midnight', () => {
    // Mirrors the date-only comparison in client/src/pages/residents/common-spaces.tsx
    // (`isDayAvailable` → unavailablePeriods loop). With a raw `new Date('2026-05-01')`
    // the period would start on Apr 30 in Vancouver and incorrectly mark Apr 30 as
    // unavailable while leaving May 1 partially open. parseDateOnly anchors both
    // bounds to local midnight so the May 1 → May 3 period blocks May 1 cleanly.
    const period = { startDate: '2026-05-01', endDate: '2026-05-03' };
    const start = parseDateOnly(period.startDate)!;
    const end = parseDateOnly(period.endDate)!;
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const apr30 = new Date(2026, 3, 30);
    apr30.setHours(0, 0, 0, 0);
    const may1 = new Date(2026, 4, 1);
    may1.setHours(0, 0, 0, 0);
    const may3 = new Date(2026, 4, 3);
    may3.setHours(0, 0, 0, 0);
    const may4 = new Date(2026, 4, 4);
    may4.setHours(0, 0, 0, 0);

    expect(apr30 >= start && apr30 <= end).toBe(false);
    expect(may1 >= start && may1 <= end).toBe(true);
    expect(may3 >= start && may3 <= end).toBe(true);
    expect(may4 >= start && may4 <= end).toBe(false);
  });

  it('parseDateOnlyLoose accepts UTC-midnight ISO and returns local May 1', () => {
    // Used by overview.tsx + budget/index.tsx for fields typed as Date that may
    // arrive as either a strict YYYY-MM-DD or a UTC-midnight ISO timestamp.
    const fromString = parseDateOnlyLoose('2026-05-01T00:00:00.000Z');
    expect(fromString).not.toBeNull();
    expect(fromString!.getFullYear()).toBe(2026);
    expect(fromString!.getMonth()).toBe(4);
    expect(fromString!.getDate()).toBe(1);

    const fromDate = parseDateOnlyLoose(new Date('2026-05-01T00:00:00.000Z'));
    expect(fromDate).not.toBeNull();
    expect(fromDate!.getDate()).toBe(1);
  });
});
