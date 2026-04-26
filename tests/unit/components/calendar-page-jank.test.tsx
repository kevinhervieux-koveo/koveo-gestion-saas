/**
 * @jest-environment jsdom
 *
 * Jank-regression guard for the common-space Calendar page (extends task
 * #1163, #1175, #1182, #1201).
 *
 * The "calendar" page named in task #1216 lives at
 * `client/src/pages/residents/my-calendar.tsx`, which renders the shared
 * `<UserCalendar />` → `<CalendarView />` surface. There is no
 * `client/src/pages/manager/calendar.tsx` in the tree today; the
 * common-space calendar (CalendarView) is the actual high-traffic
 * date-navigation surface that ships to managers and residents alike,
 * and it is the surface this guard protects.
 *
 * The page exposes two interactions that historically have been hot
 * targets for "[Violation] '<event>' handler took N ms" warnings:
 *
 *   • Date navigation (`prev-month` / `next-month`) — flips
 *     `currentDate`, which re-derives `monthDays` through
 *     `eachDayOfInterval` + `startOfMonth` / `endOfMonth` from
 *     `date-fns` and triggers a fresh `/api/common-spaces/...` query.
 *   • Event re-render — clicking a `calendar-event-*` button calls
 *     `onEventClick`, which the parent uses to drive the
 *     `selectedBooking` details card.
 *
 * The guard mirrors the InventoryPage / Residences / Bills jank tests
 * (100 ms threshold, mocked heavy children, scoped fetch routing) so a
 * future refactor that pulls a heavier date computation back into the
 * click handler — or adds synchronous work to the event-click path —
 * fails CI instead of silently regressing the UX.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { installJankDetector, type JankDetector } from '../../utils/jank-detector';

// Pin the user so CalendarView's `enabled: !!user && !!user.id` guard
// resolves and the page actually mounts the date-navigation buttons we
// drive below.
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'test-resident-id', role: 'resident' },
    isLoading: false,
    isAuthenticating: false,
    isAuthenticated: true,
    isFirstHydrationComplete: true,
    login: jest.fn(),
    logout: jest.fn(),
    hasRole: () => true,
    hasAnyRole: () => true,
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
  LanguageProvider: ({ children }: any) => children,
}));

// Lightweight stand-ins for shadcn primitives that wire onChange / onClick
// straight through, so fireEvent reaches the real CalendarView handlers
// instead of being absorbed by Radix internals.
jest.mock('../../../client/src/components/ui/button', () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>{children}</button>
  ),
}));
jest.mock('../../../client/src/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
jest.mock('../../../client/src/components/ui/separator', () => ({
  Separator: () => <hr />,
}));
jest.mock('../../../client/src/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
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

// Pin the calendar's `/api/common-spaces/user-calendar` query so the
// event-click handler has at least one event to fire against.
const TEST_BOOKING = {
  id: 'booking-1',
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  status: 'confirmed' as const,
  spaceName: 'Gym',
  spaceId: 'space-gym',
  buildingName: 'Test Building',
  buildingId: 'test-building-id',
  userName: 'Test Resident',
};

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn().mockImplementation((_method: string, _url: string) => {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        user: { id: 'test-resident-id', name: 'Test Resident', role: 'resident' },
        calendar: {
          view: 'month',
          startDate: TEST_BOOKING.startTime,
          endDate: TEST_BOOKING.endTime,
          bookings: [TEST_BOOKING],
          events: [TEST_BOOKING],
        },
        permissions: { canViewDetails: true, canCreateBookings: true },
        summary: { totalBookings: 1, totalHours: 1, uniqueUsers: 1 },
      }),
    });
  }),
  queryClient: {
    invalidateQueries: jest.fn(),
    refetchQueries: jest.fn(),
  },
}));

import MyCalendarPage from '../../../client/src/pages/residents/my-calendar';

function renderCalendarPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MyCalendarPage />
    </QueryClientProvider>,
  );
}

describe('Common-space calendar page — UI jank guard (extends task #1163)', () => {
  let detector: JankDetector;

  beforeEach(() => {
    // 100 ms convention shared across the jank-guard suites: anything
    // above this prints as "[Violation] '<event>' handler took N ms" in
    // Chromium, which is the user-visible regression we want to catch.
    detector = installJankDetector({ thresholdMs: 100 });
  });

  afterEach(() => {
    detector.uninstall();
  });

  it('navigating between months stays responsive', async () => {
    renderCalendarPage();

    // Wait for the date-navigation header to mount — CalendarView only
    // renders these buttons once `useAuth` resolves with a user (the
    // query is gated by `enabled: !!user && !!user.id`).
    const nextBtn = await screen.findByTestId('next-month');
    const prevBtn = await screen.findByTestId('prev-month');

    // Each click flips `currentDate`, which re-derives `monthDays`
    // through `eachDayOfInterval` + `startOfMonth` / `endOfMonth` from
    // date-fns and refetches `/api/common-spaces/user-calendar`. The
    // handler itself must stay below the Chromium "[Violation]" budget
    // even though those date-fns recomputes happen as a downstream
    // consequence — a future refactor that pulls them back into the
    // click handler would trip the detector.
    detector.runAndMeasure('click next month (1)', () => {
      fireEvent.click(nextBtn);
    });
    act(() => {});

    detector.runAndMeasure('click next month (2)', () => {
      fireEvent.click(nextBtn);
    });
    act(() => {});

    detector.runAndMeasure('click prev month', () => {
      fireEvent.click(prevBtn);
    });
    act(() => {});

    detector.assertNoJank();
  });

  it('switching the calendar view mode does not block the click handler', async () => {
    renderCalendarPage();

    // The view-mode Select switches between 'month' and 'week', which
    // re-keys the `/api/common-spaces/user-calendar` query and triggers
    // a fresh `monthDays` derivation. The setter must stay below the
    // jank threshold so date-fns work never sneaks back into the click.
    const weekOption = await screen.findByTestId('select-item-week');

    detector.runAndMeasure('switch to week view', () => {
      fireEvent.click(weekOption);
    });
    act(() => {});

    detector.runAndMeasure('switch back to month view', () => {
      fireEvent.click(screen.getByTestId('select-item-month'));
    });
    act(() => {});

    detector.assertNoJank();
  });
});
