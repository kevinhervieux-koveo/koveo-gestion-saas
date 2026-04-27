/**
 * Quick-project lifecycle and edit-dialog tests (Task #1477)
 *
 * Coverage:
 *   - Clicking the Gantt pencil on a quick project opens the quick-project
 *     edit form (not the workflow modal).
 *   - Clicking the Gantt pencil on a non-quick project opens the workflow modal
 *     (via API GET).
 *   - Clicking a project's bar (gantt-bar-click) starts inline date editing.
 *   - The project Edit dialog surfaces a localized "Failed to update project"
 *     toast on save errors (updateProjectMutation.onError path).
 *   - Saving Gantt dates for a quick project with a null end date correctly
 *     derives a 30-day placeholder span (null → real end date edge case).
 *   - Cancel exits inline edit mode without calling the PATCH API.
 *   - Clicking the pencil on any project while inline editing is in progress
 *     triggers the "ganttDiscardUnsaved" confirm prompt (switching project
 *     types discard prompt).
 *   - The Gantt-save PATCH payload never includes isQuickProject so that flag
 *     is preserved across the PATCH.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React, { useCallback, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';

import {
  GanttChart,
  type GanttProject,
  type GanttEditingDates,
} from '../../../client/src/components/GanttChart';

import {
  BudgetProjectDialogs,
  type QuickProjectData,
  type CreateProjectPayload,
  type UpdateProjectPayload,
} from '../../../client/src/pages/manager/budget/BudgetProjectDialogs';

// PointerEvent polyfill — jsdom 26 ships without a global PointerEvent constructor.
if (typeof (globalThis as any).PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    public isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  (globalThis as any).PointerEvent = PointerEventPolyfill;
}

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: jest.fn(),
    toggleLanguage: jest.fn(),
    t: (key: string) => key,
  }),
}));

jest.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ children }: any) => <div data-testid="bar">{children}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Cell: () => <div data-testid="cell" />,
}));

jest.mock('lucide-react', () => ({
  Eye: () => <span data-testid="eye-icon" />,
  EyeOff: () => <span data-testid="eye-off-icon" />,
  Pencil: () => <span data-testid="pencil-icon" />,
  Save: () => <span data-testid="save-icon" />,
  X: () => <span data-testid="x-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
  DollarSign: () => <span data-testid="dollar-sign-icon" />,
  Trash2: () => <span data-testid="trash2-icon" />,
}));

const mockApiRequest = jest.fn();

jest.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  queryClient: {
    invalidateQueries: jest.fn(),
    refetchQueries: jest.fn(),
  },
}));

const mockToast = jest.fn();

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: (...args: any[]) => mockToast(...args) }),
  toast: (...args: any[]) => mockToast(...args),
}));

jest.mock('@/hooks/use-building-context', () => ({
  useBuildingContext: () => ({ buildingId: 'bld-1', organizationId: 'org-1' }),
  BuildingContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/maintenance/projects/workflow/lazy-components', () => ({
  ProjectWorkflowModal: () => <div data-testid="project-workflow-modal" />,
}));

// Shadcn Select components used by BudgetProjectDialogs' creation form
jest.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <div data-value={value} data-testid="select">{children}</div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => (
    <button data-value={value} onClick={() => {}}>{children}</button>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function stubLayoutFor(overlay: HTMLElement, plotWidth: number) {
  if (typeof (overlay as any).setPointerCapture !== 'function') {
    (overlay as any).setPointerCapture = jest.fn();
    (overlay as any).releasePointerCapture = jest.fn();
  }
  const timeline = overlay.parentElement as HTMLElement | null;
  if (!timeline) throw new Error('Drag overlay has no parent element');
  Object.defineProperty(timeline, 'clientWidth', {
    configurable: true,
    value: plotWidth + 20, // RECHARTS_RIGHT_MARGIN
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Harness — mirrors the Gantt wiring in client/src/pages/manager/budget/index.tsx
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A lightweight replica of the GanttChart wiring in the Budget page.
 * `isQuickProjectMap` mirrors the per-project `isQuickProject` flag that the
 * real page reads from its `projects` array.
 */
function GanttQuickProjectHarness({
  projects,
  isQuickProjectMap,
  dateRange,
}: {
  projects: GanttProject[];
  isQuickProjectMap: Record<string, boolean>;
  dateRange: { start: string; end: string };
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDates, setEditingDates] = useState<GanttEditingDates | null>(null);
  const originalDates = useRef<GanttEditingDates | null>(null);

  // Dialog state indicators — rendered so tests can assert which path was taken
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogProjectId, setEditDialogProjectId] = useState<string | null>(null);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);

  /** Returns false when the user declines to discard their unsaved changes. */
  const confirmDiscard = useCallback((): boolean => {
    if (!editingId) return true;
    if (!confirm('ganttDiscardUnsaved')) return false;
    setEditingId(null);
    setEditingDates(null);
    originalDates.current = null;
    return true;
  }, [editingId]);

  /**
   * Pencil-click handler — mirrors onEdit in budget/index.tsx (lines ~3780).
   * Quick projects open the edit dialog; others open the workflow modal.
   */
  const handleEdit = useCallback(
    async (id: string) => {
      if (editingId) {
        if (!confirmDiscard()) return;
        setEditingId(null);
        setEditingDates(null);
        originalDates.current = null;
      }
      if (isQuickProjectMap[id]) {
        setEditDialogProjectId(id);
        setEditDialogOpen(true);
      } else {
        const { apiRequest } = require('@/lib/queryClient');
        const response = await apiRequest('GET', `/api/maintenance/projects/${id}`);
        if (response.ok) {
          setWorkflowModalOpen(true);
        }
      }
    },
    [editingId, confirmDiscard, isQuickProjectMap],
  );

  /**
   * Bar-click handler — mirrors onStartEdit in budget/index.tsx (lines ~3829).
   * Quick projects with no end date derive a 30-day placeholder span.
   */
  const handleStartEdit = useCallback(
    (id: string) => {
      if (editingId && editingId !== id) {
        if (!confirmDiscard()) return;
      }
      const proj = projects.find(p => p.id === id);
      if (!proj) return;
      const parseTs = (s: string | null | undefined) => {
        if (!s) return null;
        const d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
        return isNaN(d.getTime()) ? null : d.getTime();
      };
      const startTs = parseTs(proj.plannedStartDate) ?? parseTs(proj.actualStartDate);
      const rawEndTs = parseTs(proj.plannedEndDate) ?? parseTs(proj.actualEndDate);
      if (!startTs) return;
      // Quick projects with no end date use the same 30-day placeholder span
      // that the GanttChart uses to draw their bar.
      const endTs = rawEndTs ?? startTs + 30 * DAY_MS;
      const dates = { startTs, endTs };
      originalDates.current = dates;
      setEditingId(id);
      setEditingDates(dates);
    },
    [editingId, projects, confirmDiscard],
  );

  const saveMutation = useMutation({
    mutationFn: async ({ id, startTs, endTs }: { id: string; startTs: number; endTs: number }) => {
      const { apiRequest } = require('@/lib/queryClient');
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${id}`, {
        plannedStartDate: toDateStr(startTs),
        plannedEndDate: toDateStr(endTs),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingDates(null);
      originalDates.current = null;
    },
    onError: () => {},
  });

  return (
    <div>
      {/* Dialog state indicators */}
      {editDialogOpen && (
        <div
          data-testid="quick-project-edit-dialog"
          data-editing-id={editDialogProjectId}
        />
      )}
      {workflowModalOpen && <div data-testid="workflow-modal-open" />}

      <GanttChart
        projects={projects}
        dateRange={dateRange}
        language="en"
        editingProjectId={editingId}
        editingDates={editingDates}
        onEdit={handleEdit}
        onStartEdit={handleStartEdit}
        onDragEnd={(_id, startTs, endTs) => setEditingDates({ startTs, endTs })}
        onSave={id => {
          if (!editingDates) return;
          saveMutation.mutate({ id, startTs: editingDates.startTs, endTs: editingDates.endTs });
        }}
        onCancel={() => {
          setEditingId(null);
          setEditingDates(null);
          originalDates.current = null;
        }}
        isSaving={saveMutation.isPending}
      />
    </div>
  );
}

function renderHarness(props: React.ComponentProps<typeof GanttQuickProjectHarness>) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <GanttQuickProjectHarness {...props} />
    </QueryClientProvider>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Harness for the Edit-dialog save-error path
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal harness that mirrors `updateProjectMutation` from budget/index.tsx
 * (lines ~1231) so we can assert the onError toast without rendering the full
 * BudgetProjectDialogs component.
 */
function EditDialogErrorHarness({ language = 'en' }: { language?: 'en' | 'fr' }) {
  const updateMutation = useMutation({
    mutationFn: async (projectData: { id: string; title: string }) => {
      const { apiRequest } = require('@/lib/queryClient');
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${projectData.id}`, {
        title: projectData.title,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return response.json();
    },
    onError: (error: any) => {
      // Mirrors budget/index.tsx updateProjectMutation.onError (lines ~1272)
      const { handleApiError } = require('@/lib/demo-error-handler');
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la mise à jour du projet' : 'Failed to update project',
      );
    },
  });

  return (
    <button
      data-testid="trigger-save"
      onClick={() => updateMutation.mutate({ id: 'proj1', title: 'Updated title' })}
    />
  );
}

function renderEditDialogHarness(language: 'en' | 'fr' = 'en') {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <EditDialogErrorHarness language={language} />
    </QueryClientProvider>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test data
// ─────────────────────────────────────────────────────────────────────────────

const quickProject: GanttProject = {
  id: 'qp1',
  title: 'Quick project with dates',
  status: 'planned',
  plannedStartDate: '2026-06-01',
  plannedEndDate: '2026-06-30',
};

const quickProjectNoEnd: GanttProject = {
  id: 'qp-no-end',
  title: 'Quick project without end date',
  status: 'planned',
  plannedStartDate: '2026-06-01',
  // no plannedEndDate
};

const fullProject: GanttProject = {
  id: 'fp1',
  title: 'Full workflow project',
  status: 'in_progress',
  plannedStartDate: '2026-08-01',
  plannedEndDate: '2026-08-31',
};

const mixedIsQuickMap: Record<string, boolean> = {
  [quickProject.id]: true,
  [quickProjectNoEnd.id]: true,
  [fullProject.id]: false,
};

const dateRange = { start: '2026-01-01', end: '2026-12-31' };

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Gantt pencil / bar-click routing (Task #1477)', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockToast.mockReset();
  });

  it('clicking the pencil on a quick project opens the quick-project edit dialog and not the workflow modal', async () => {
    renderHarness({
      projects: [quickProject, fullProject],
      isQuickProjectMap: mixedIsQuickMap,
      dateRange,
    });

    fireEvent.click(screen.getByTestId(`gantt-edit-${quickProject.id}`));

    expect(screen.getByTestId('quick-project-edit-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('quick-project-edit-dialog')).toHaveAttribute(
      'data-editing-id',
      quickProject.id,
    );
    expect(screen.queryByTestId('workflow-modal-open')).not.toBeInTheDocument();
    // No API call should have been made for a quick project
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('clicking the pencil on a non-quick project opens the workflow modal via GET', async () => {
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: fullProject.id } }),
    });

    renderHarness({
      projects: [quickProject, fullProject],
      isQuickProjectMap: mixedIsQuickMap,
      dateRange,
    });

    fireEvent.click(screen.getByTestId(`gantt-edit-${fullProject.id}`));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-modal-open')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('quick-project-edit-dialog')).not.toBeInTheDocument();
    expect(mockApiRequest).toHaveBeenCalledWith(
      'GET',
      `/api/maintenance/projects/${fullProject.id}`,
    );
  });

  it('clicking a project bar starts inline date editing (gantt-drag-overlay appears)', async () => {
    renderHarness({
      projects: [quickProject],
      isQuickProjectMap: { [quickProject.id]: true },
      dateRange,
    });

    fireEvent.click(screen.getByTestId(`gantt-bar-click-${quickProject.id}`));

    const overlay = await screen.findByTestId(`gantt-drag-overlay-${quickProject.id}`);
    expect(overlay).toBeInTheDocument();
    // The save and cancel buttons must appear
    expect(screen.getByTestId(`gantt-save-${quickProject.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`gantt-cancel-${quickProject.id}`)).toBeInTheDocument();
    // The pencil edit button must be hidden while a row is in edit mode
    expect(screen.queryByTestId(`gantt-edit-${quickProject.id}`)).not.toBeInTheDocument();
  });
});

describe('Project Edit dialog error path (Task #1477)', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockToast.mockReset();
  });

  it('surfaces a localized "Failed to update project" toast when the update PATCH fails (English)', async () => {
    // The mutation throws with an empty message so the fallback copy is exercised
    mockApiRequest.mockRejectedValue(new Error(''));

    renderEditDialogHarness('en');
    fireEvent.click(screen.getByTestId('trigger-save'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledTimes(1);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Failed to update project',
        variant: 'destructive',
      }),
    );
  });

  it('surfaces a localized "Échec de la mise à jour du projet" toast in French', async () => {
    mockApiRequest.mockRejectedValue(new Error(''));

    renderEditDialogHarness('fr');
    fireEvent.click(screen.getByTestId('trigger-save'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledTimes(1);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Échec de la mise à jour du projet',
        variant: 'destructive',
      }),
    );
  });

  it('surfaces the server-provided error message when the PATCH responds with ok:false', async () => {
    mockApiRequest.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'Title is required' }),
    });

    renderEditDialogHarness('en');
    fireEvent.click(screen.getByTestId('trigger-save'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledTimes(1);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Title is required',
        variant: 'destructive',
      }),
    );
  });
});

describe('Quick-project Gantt-save edge cases (Task #1477)', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockToast.mockReset();
  });

  it('null → real end date: a quick project with no end date gets a 30-day derived end date on save', async () => {
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    renderHarness({
      projects: [quickProjectNoEnd],
      isQuickProjectMap: { [quickProjectNoEnd.id]: true },
      dateRange,
    });

    // The bar-click overlay appears because the Gantt renders a 30-day placeholder bar.
    fireEvent.click(screen.getByTestId(`gantt-bar-click-${quickProjectNoEnd.id}`));
    await screen.findByTestId(`gantt-drag-overlay-${quickProjectNoEnd.id}`);

    // Save immediately — no drag, so the 30-day derived span is sent.
    fireEvent.click(screen.getByTestId(`gantt-save-${quickProjectNoEnd.id}`));

    const startTs = new Date('2026-06-01T00:00:00').getTime();
    const expectedEndTs = startTs + 30 * DAY_MS;

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [method, url, body] = mockApiRequest.mock.calls[0];
    expect(method).toBe('PATCH');
    expect(url).toBe(`/api/maintenance/projects/${quickProjectNoEnd.id}`);
    expect(body).toEqual({
      plannedStartDate: toDateStr(startTs),
      plannedEndDate: toDateStr(expectedEndTs),
    });

    // Edit mode exits after a successful save
    await waitFor(() => {
      expect(screen.queryByTestId(`gantt-drag-overlay-${quickProjectNoEnd.id}`)).not.toBeInTheDocument();
    });
  });

  it('Cancel reverts: exiting edit mode via Cancel never calls the PATCH API', async () => {
    renderHarness({
      projects: [quickProjectNoEnd],
      isQuickProjectMap: { [quickProjectNoEnd.id]: true },
      dateRange,
    });

    fireEvent.click(screen.getByTestId(`gantt-bar-click-${quickProjectNoEnd.id}`));
    await screen.findByTestId(`gantt-drag-overlay-${quickProjectNoEnd.id}`);

    fireEvent.click(screen.getByTestId(`gantt-cancel-${quickProjectNoEnd.id}`));

    await waitFor(() => {
      expect(
        screen.queryByTestId(`gantt-drag-overlay-${quickProjectNoEnd.id}`),
      ).not.toBeInTheDocument();
    });

    expect(mockApiRequest).not.toHaveBeenCalled();
    // Edit button must come back after Cancel
    expect(screen.getByTestId(`gantt-edit-${quickProjectNoEnd.id}`)).toBeInTheDocument();
  });

  it('switching project types triggers the discard prompt when inline editing is in progress', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    try {
      renderHarness({
        projects: [quickProject, fullProject],
        isQuickProjectMap: mixedIsQuickMap,
        dateRange,
      });

      // Start inline editing on the quick project via bar-click
      fireEvent.click(screen.getByTestId(`gantt-bar-click-${quickProject.id}`));
      await screen.findByTestId(`gantt-drag-overlay-${quickProject.id}`);

      // Click the pencil on the non-quick project (different type) — discard
      // prompt must fire before any routing decision is made.
      fireEvent.click(screen.getByTestId(`gantt-edit-${fullProject.id}`));
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith('ganttDiscardUnsaved');

      // The user declined — inline edit remains open, workflow modal stays closed
      expect(screen.getByTestId(`gantt-drag-overlay-${quickProject.id}`)).toBeInTheDocument();
      expect(screen.queryByTestId('workflow-modal-open')).not.toBeInTheDocument();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('isQuickProject flag is preserved across PATCH: the Gantt save payload never includes isQuickProject', async () => {
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    renderHarness({
      projects: [quickProject],
      isQuickProjectMap: { [quickProject.id]: true },
      dateRange,
    });

    fireEvent.click(screen.getByTestId(`gantt-bar-click-${quickProject.id}`));
    await screen.findByTestId(`gantt-drag-overlay-${quickProject.id}`);
    fireEvent.click(screen.getByTestId(`gantt-save-${quickProject.id}`));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const payload = mockApiRequest.mock.calls[0][2];
    // The PATCH must contain only the two date fields — never isQuickProject,
    // otherwise the backend could inadvertently flip the flag.
    expect(payload).not.toHaveProperty('isQuickProject');
    expect(payload).toHaveProperty('plannedStartDate');
    expect(payload).toHaveProperty('plannedEndDate');
    expect(Object.keys(payload)).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quick-project creation form — optional end-date field (Task #1477 Step 1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal stub of the mutation results expected by BudgetProjectDialogs.
 * The component only reads `.mutate`, `.isPending`, and calls toast internally.
 */
function makeMutationStub(mutateFn: (...args: any[]) => void) {
  return {
    mutate: mutateFn,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
    reset: jest.fn(),
  } as any;
}

function renderCreationDialog(mutateFn: jest.Mock) {
  const defaultQuickProject: QuickProjectData = {
    title: '',
    totalBudget: '',
    financialYear: new Date().getFullYear().toString(),
    plannedMonth: '1',
    plannedDay: '1',
    plannedEndDate: '',
    description: '',
  };

  function Wrapper() {
    const [form, setForm] = React.useState<QuickProjectData>(defaultQuickProject);
    return (
      <BudgetProjectDialogs
        addQuickProjectDialogOpen={true}
        setAddQuickProjectDialogOpen={jest.fn()}
        newQuickProject={form}
        setNewQuickProject={setForm}
        createQuickProjectMutation={makeMutationStub(mutateFn)}
        editProjectDialogOpen={false}
        setEditProjectDialogOpen={jest.fn()}
        editingProject={null}
        setEditingProject={jest.fn()}
        updateProjectMutation={makeMutationStub(jest.fn())}
        deleteQuickProjectMutation={makeMutationStub(jest.fn())}
        selectedProjectForWorkflow={null}
        setSelectedProjectForWorkflow={jest.fn()}
        showProjectWorkflowModal={false}
        setShowProjectWorkflowModal={jest.fn()}
        buildingId="bld-1"
        organizationId="org-1"
        onProjectWorkflowClose={jest.fn()}
        onProjectUpdate={jest.fn()}
        onProjectDelete={jest.fn()}
      />
    );
  }

  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Wrapper />
    </QueryClientProvider>,
  );
}

describe('Quick-project creation form — optional end-date field (Task #1477 step 1)', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockToast.mockReset();
  });

  it('renders the optional end-date input in the creation form', () => {
    renderCreationDialog(jest.fn());
    expect(screen.getByTestId('input-quick-project-end-date')).toBeInTheDocument();
    // The field is an optional date input — it must start empty
    expect(screen.getByTestId('input-quick-project-end-date')).toHaveValue('');
  });

  it('passes plannedEndDate to the create handler when the user fills it in', async () => {
    const mutateFn = jest.fn();
    renderCreationDialog(mutateFn);

    // Fill in required fields
    fireEvent.change(screen.getByTestId('input-quick-project-title'), {
      target: { value: 'Roof repair' },
    });
    fireEvent.change(screen.getByTestId('input-quick-project-budget'), {
      target: { value: '15000' },
    });
    // Fill in the optional end-date
    fireEvent.change(screen.getByTestId('input-quick-project-end-date'), {
      target: { value: '2026-08-31' },
    });

    fireEvent.click(screen.getByTestId('button-save-quick-project'));

    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Roof repair',
        totalBudget: 15000,
        plannedEndDate: '2026-08-31',
      }),
    );
  });

  it('omits plannedEndDate from the payload when the end-date input is left empty', async () => {
    const mutateFn = jest.fn();
    renderCreationDialog(mutateFn);

    fireEvent.change(screen.getByTestId('input-quick-project-title'), {
      target: { value: 'Parking lot' },
    });
    fireEvent.change(screen.getByTestId('input-quick-project-budget'), {
      target: { value: '5000' },
    });
    // Leave the end-date empty (default)

    fireEvent.click(screen.getByTestId('button-save-quick-project'));

    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Parking lot',
        plannedEndDate: undefined,
      }),
    );
    // Confirm the field was not filled and is truly absent from the payload
    const [payload] = mutateFn.mock.calls[0];
    expect(payload.plannedEndDate).toBeUndefined();
  });
});
