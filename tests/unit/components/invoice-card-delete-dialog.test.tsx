/**
 * Task #1466 — InvoiceCard delete uses an in-app shadcn AlertDialog
 * (no native window.confirm). Cancelling does nothing; only the
 * destructive confirm triggers the DELETE API call.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { LanguageProvider } from '../../../client/src/hooks/use-language';
import { InvoiceCard } from '../../../client/src/components/invoice-management/InvoiceCard';
import type { Invoice } from '../../../shared/schemas/invoices';
import { apiRequest } from '../../../client/src/lib/queryClient';

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

jest.mock('../../../client/src/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('../../../client/src/lib/queryClient', () => {
  const actual = jest.requireActual('../../../client/src/lib/queryClient');
  return {
    ...actual,
    apiRequest: jest.fn(),
  };
});

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

const invoiceFixture: Invoice = {
  id: 'inv-del-1',
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

function renderInvoiceCard(onUpdate?: () => void) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <InvoiceCard invoice={invoiceFixture} onUpdate={onUpdate} />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('InvoiceCard delete confirmation (Task #1466)', () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    mockedApiRequest.mockReset();
    confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => {
      throw new Error('window.confirm must not be called — use the in-app AlertDialog');
    });
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  async function openActionsMenu(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId(`button-actions-${invoiceFixture.id}`));
    await screen.findByTestId(`button-delete-invoice-${invoiceFixture.id}`);
  }

  it('opens the in-app AlertDialog when the delete button is clicked (no window.confirm)', async () => {
    const user = userEvent.setup();
    renderInvoiceCard();

    expect(screen.queryByTestId('dialog-confirm-delete-invoice')).not.toBeInTheDocument();

    await openActionsMenu(user);
    await user.click(screen.getByTestId(`button-delete-invoice-${invoiceFixture.id}`));

    await waitFor(() => {
      expect(screen.getByTestId('dialog-confirm-delete-invoice')).toBeInTheDocument();
    });
    expect(screen.getByTestId('text-confirm-delete-invoice-message')).toHaveTextContent(
      /INV-001.*Acme Co/,
    );
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('cancelling the AlertDialog does NOT trigger the DELETE request', async () => {
    const user = userEvent.setup();
    renderInvoiceCard();

    await openActionsMenu(user);
    await user.click(screen.getByTestId(`button-delete-invoice-${invoiceFixture.id}`));
    await screen.findByTestId('dialog-confirm-delete-invoice');

    await user.click(screen.getByTestId('button-cancel-delete-invoice'));

    await waitFor(() => {
      expect(screen.queryByTestId('dialog-confirm-delete-invoice')).not.toBeInTheDocument();
    });
    expect(mockedApiRequest).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('confirming the AlertDialog issues a DELETE request to the invoice endpoint', async () => {
    mockedApiRequest.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const user = userEvent.setup();
    renderInvoiceCard();

    await openActionsMenu(user);
    await user.click(screen.getByTestId(`button-delete-invoice-${invoiceFixture.id}`));
    await screen.findByTestId('dialog-confirm-delete-invoice');

    await user.click(screen.getByTestId('button-confirm-delete-invoice'));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith('DELETE', `/api/invoices/${invoiceFixture.id}`);
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
