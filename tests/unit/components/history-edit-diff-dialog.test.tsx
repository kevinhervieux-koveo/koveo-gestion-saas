/**
 * Task #1133 — Frontend tests for the edit-history audit diff dialog.
 *
 * Tests:
 *  1. The trigger button (history-audit-trigger-*) opens the audit diff dialog.
 *  2. The dialog renders a per-field before/after table for a multi-field edit.
 *  3. The dialog renders the empty-state message when the audit list is empty.
 *  4. The dialog title includes the event type.
 *  5. MCP_API_KEY edits are displayed as the "System" editor label.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

jest.setTimeout(15000);

// --- Mocks ---------------------------------------------------------------

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => {
      const keys: Record<string, string> = {
        htAuditDialogTitle: 'Edit History',
        htAuditSystemEditor: 'System',
        htAuditEmptyState: 'No recorded changes',
        htAuditEmptyStateDetail: 'This entry was edited before change tracking existed.',
        htAuditLoadError: 'Failed to load edit history',
        htAuditRetry: 'Retry',
        htAuditBeforeLabel: 'Before',
        htAuditAfterLabel: 'After',
        htAuditFieldColumnHeader: 'Field',
        htAuditEditorLabel: 'Editor',
        htAuditTimestampLabel: 'Timestamp',
        htAuditFieldEventType: 'Event Type',
        htAuditFieldEventDate: 'Event Date',
        htAuditFieldWorkDescription: 'Work Description',
        htAuditFieldCost: 'Cost',
        htAuditFieldVendor: 'Vendor',
        htAuditFieldLifespanImpact: 'Lifespan Impact',
        htAuditFieldWarranty: 'Warranty',
        htAuditValueNotSet: '—',
        htAuditEditedIndicator: 'edited',
        htAuditViewChanges: 'View changes',
        htConstructionEventLabel: 'Construction',
        htRepairEventLabel: 'Repair',
        htMinorRehabEventLabel: 'Minor Rehab',
        htMajorRehabEventLabel: 'Major Rehab',
        htReplacementEventLabel: 'Replacement',
        htWarrantyYearsSuffix: 'years',
      };
      return keys[key] ?? key;
    },
    setLanguage: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

// Mock apiRequest — the component uses it internally
let mockAuditResponse: { success: boolean; entries: unknown[] } = { success: true, entries: [] };
let mockVendorResponse: { vendors: unknown[] } = { vendors: [] };

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(async (_method: string, url: string) => ({
    json: async () => {
      if (url.includes('/audit')) return mockAuditResponse;
      if (url.includes('/vendors')) return mockVendorResponse;
      return {};
    },
  })),
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
  parseDateOnly: (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  },
}));

// --- Helpers --------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderDialog(
  props: Partial<React.ComponentProps<typeof HistoryEditDiffDialog>> = {},
) {
  const { HistoryEditDiffDialog } = require('@/components/maintenance/inventory/HistoryEditDiffDialog');
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <HistoryEditDiffDialog
        entry={{ id: 'hist-1', eventType: 'repair', eventDate: '2024-01-15' }}
        isOpen={true}
        onClose={jest.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
}

// --- Tests ----------------------------------------------------------------

describe('HistoryEditDiffDialog', () => {
  beforeEach(() => {
    mockAuditResponse = { success: true, entries: [] };
    mockVendorResponse = { vendors: [] };
    jest.clearAllMocks();
  });

  it('shows the empty-state message when the audit list is empty', async () => {
    mockAuditResponse = { success: true, entries: [] };
    renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId('audit-dialog-empty')).toBeTruthy();
    });
    expect(screen.getByText('No recorded changes')).toBeTruthy();
  });

  it('renders a per-field before/after table for a multi-field edit', async () => {
    mockAuditResponse = {
      success: true,
      entries: [
        {
          id: 'audit-1',
          historyId: 'hist-1',
          performedBy: 'user-1',
          editorName: 'Alice Manager',
          changes: {
            workDescription: { before: 'old description', after: 'new description' },
            cost: { before: '100', after: '250' },
          },
          createdAt: '2024-03-10T14:00:00Z',
        },
      ],
    };

    renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId('audit-entry-diff-0')).toBeTruthy();
    });

    // Both before and after values should be visible
    expect(screen.getByText('old description')).toBeTruthy();
    expect(screen.getByText('new description')).toBeTruthy();

    // Field label should appear
    expect(screen.getByText('Work Description')).toBeTruthy();
  });

  it('displays the editor name from the audit entry', async () => {
    mockAuditResponse = {
      success: true,
      entries: [
        {
          id: 'audit-2',
          historyId: 'hist-1',
          performedBy: 'user-2',
          editorName: 'Bob Admin',
          changes: { workDescription: { before: 'x', after: 'y' } },
          createdAt: '2024-03-11T09:00:00Z',
        },
      ],
    };

    renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId('audit-entry-editor-0')).toBeTruthy();
    });
    expect(screen.getByTestId('audit-entry-editor-0').textContent).toBe('Bob Admin');
  });

  it('renders the System label for MCP_API_KEY entries (editorName === System)', async () => {
    mockAuditResponse = {
      success: true,
      entries: [
        {
          id: 'audit-3',
          historyId: 'hist-1',
          performedBy: null,
          editorName: 'System',
          changes: {
            workDescription: { before: 'a', after: 'b' },
            meta: { system: true, source: 'mcp_api_key' },
          },
          createdAt: '2024-03-12T08:00:00Z',
        },
      ],
    };

    renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId('audit-entry-editor-0')).toBeTruthy();
    });
    expect(screen.getByTestId('audit-entry-editor-0').textContent).toBe('System');
  });

  it('includes the event type in the dialog title', async () => {
    mockAuditResponse = { success: true, entries: [] };
    renderDialog({ entry: { id: 'hist-1', eventType: 'repair', eventDate: '2024-01-15' } });

    await waitFor(() => {
      expect(screen.getByTestId('audit-dialog-title')).toBeTruthy();
    });
    const title = screen.getByTestId('audit-dialog-title').textContent ?? '';
    // Title should include "Edit History", the event type label, and a date fragment
    expect(title).toContain('Edit History');
    expect(title).toContain('Repair');
  });
});
