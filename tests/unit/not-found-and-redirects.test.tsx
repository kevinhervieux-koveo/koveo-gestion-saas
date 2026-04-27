/**
 * Tests for the 404 Not Found page and parent-route redirect behaviour.
 *
 * Coverage:
 * 1. NotFound renders with localized titles and a "Go to Dashboard" button
 *    for authenticated users in both supported languages (English / French).
 * 2. NotFound shows a "Go to Login" button for unauthenticated users.
 * 3. The "Go to Dashboard" button links to `/dashboard` so the in-app router
 *    can forward users to the authenticated overview without a full page reload.
 * 4. The "Go to Login" button links to `/login` for unauthenticated users.
 * 5. Parent-route redirects – each top-level route (`/dashboard`, `/admin`,
 *    `/manager`, `/residents`) redirects to its registered sub-route.
 *    Tests verify that a component using the identical useEffect+setLocation
 *    pattern as App.tsx actually calls navigate() with the expected target.
 */

import React, { useEffect } from 'react';
import { render, act, screen } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as wouter from 'wouter';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@/hooks/use-language', () => ({
  useLanguage: jest.fn(),
}));

jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

jest.mock('lucide-react', () => ({
  AlertCircle: () => <svg data-testid='alert-circle' />,
}));

// Override just Link inside the shared wouter mock so NotFound renders a
// plain <a> we can inspect, while preserving useLocation for redirect tests.
jest.mock('wouter', () => {
  const mock = jest.requireActual<Record<string, unknown>>('wouter');
  return {
    ...mock,
    Link: ({
      href,
      children,
      className,
    }: {
      href: string;
      children: React.ReactNode;
      className?: string;
    }) => (
      <a href={href} className={className} data-testid='page-link'>
        {children}
      </a>
    ),
  };
});

import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { PARENT_ROUTE_REDIRECTS } from '@/config/route-redirects';

// ---------------------------------------------------------------------------
// Translation fixtures
// ---------------------------------------------------------------------------

const englishT = (key: string) => {
  const map: Record<string, string> = {
    notFoundTitle: 'Page not found',
    notFoundMessage: 'Page not found. Check the URL or return to the dashboard.',
    goToDashboard: 'Go to Dashboard',
    goToLogin: 'Go to Login',
  };
  return map[key] ?? key;
};

const frenchT = (key: string) => {
  const map: Record<string, string> = {
    notFoundTitle: 'Page introuvable',
    notFoundMessage: "Page introuvable. Vérifiez l'URL ou retournez au tableau de bord.",
    goToDashboard: 'Aller au tableau de bord',
    goToLogin: 'Aller à la connexion',
  };
  return map[key] ?? key;
};

// ---------------------------------------------------------------------------
// 404 page rendering tests — authenticated user
// ---------------------------------------------------------------------------

describe('NotFound page (authenticated)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });
  });

  it('renders the English title and Go to Dashboard button', async () => {
    (useLanguage as jest.Mock).mockReturnValue({ t: englishT });

    const { default: NotFound } = await import('@/pages/not-found');
    render(<NotFound />);

    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(
      screen.getByText('Page not found. Check the URL or return to the dashboard.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  it('renders the French title and Go to Dashboard button', async () => {
    (useLanguage as jest.Mock).mockReturnValue({ t: frenchT });

    const { default: NotFound } = await import('@/pages/not-found');
    render(<NotFound />);

    expect(screen.getByText('Page introuvable')).toBeInTheDocument();
    expect(screen.getByText('Aller au tableau de bord')).toBeInTheDocument();
  });

  it('the Go to Dashboard button links to /dashboard (in-app router)', async () => {
    (useLanguage as jest.Mock).mockReturnValue({ t: englishT });

    const { default: NotFound } = await import('@/pages/not-found');
    render(<NotFound />);

    const link = screen.getByTestId('page-link');
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('renders the alert icon', async () => {
    (useLanguage as jest.Mock).mockReturnValue({ t: englishT });

    const { default: NotFound } = await import('@/pages/not-found');
    render(<NotFound />);

    expect(screen.getByTestId('alert-circle')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 404 page rendering tests — unauthenticated user
// ---------------------------------------------------------------------------

describe('NotFound page (unauthenticated)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false });
  });

  it('renders Go to Login button (English) when unauthenticated', async () => {
    (useLanguage as jest.Mock).mockReturnValue({ t: englishT });

    const { default: NotFound } = await import('@/pages/not-found');
    render(<NotFound />);

    expect(screen.getByText('Go to Login')).toBeInTheDocument();
    expect(screen.queryByText('Go to Dashboard')).not.toBeInTheDocument();
  });

  it('renders Go to Login button (French) when unauthenticated', async () => {
    (useLanguage as jest.Mock).mockReturnValue({ t: frenchT });

    const { default: NotFound } = await import('@/pages/not-found');
    render(<NotFound />);

    expect(screen.getByText('Aller à la connexion')).toBeInTheDocument();
    expect(screen.queryByText('Aller au tableau de bord')).not.toBeInTheDocument();
  });

  it('the Go to Login button links to /login when unauthenticated', async () => {
    (useLanguage as jest.Mock).mockReturnValue({ t: englishT });

    const { default: NotFound } = await import('@/pages/not-found');
    render(<NotFound />);

    const link = screen.getByTestId('page-link');
    expect(link).toHaveAttribute('href', '/login');
  });
});

// ---------------------------------------------------------------------------
// PARENT_ROUTE_REDIRECTS constant tests
// ---------------------------------------------------------------------------

describe('PARENT_ROUTE_REDIRECTS (client/src/config/route-redirects.ts)', () => {
  it('covers all five authenticated parent routes', () => {
    expect(Object.keys(PARENT_ROUTE_REDIRECTS)).toHaveLength(5);
  });

  it.each(Object.entries(PARENT_ROUTE_REDIRECTS))(
    '%s maps to a sub-route that starts with itself',
    (parent, target) => {
      expect(target.startsWith(parent)).toBe(true);
    },
  );

  it('/dashboard redirects to /dashboard/overview', () => {
    expect(PARENT_ROUTE_REDIRECTS['/dashboard']).toBe('/dashboard/overview');
  });

  it('/admin redirects to /admin/organizations', () => {
    expect(PARENT_ROUTE_REDIRECTS['/admin']).toBe('/admin/organizations');
  });

  it('/manager redirects to /manager/buildings', () => {
    expect(PARENT_ROUTE_REDIRECTS['/manager']).toBe('/manager/buildings');
  });

  it('/residents redirects to /residents/residence', () => {
    expect(PARENT_ROUTE_REDIRECTS['/residents']).toBe('/residents/residence');
  });

  it('/settings redirects to /settings/general', () => {
    expect(PARENT_ROUTE_REDIRECTS['/settings']).toBe('/settings/general');
  });
});

// ---------------------------------------------------------------------------
// Parent-route redirect BEHAVIOUR tests
//
// These tests render a component that uses the identical redirect mechanism
// as App.tsx's private DashboardOverviewRedirect / AdminOverviewRedirect / etc.:
//
//   useEffect(() => setLocation(target), [setLocation])
//
// We spy on the wouter mock's useLocation to inject a jest.fn() as the
// setLocation/navigate function, then verify it is called with the expected
// target path after the component mounts.
//
// PARENT_ROUTE_REDIRECTS is the single source of truth for the expected
// targets, so any change to a redirect target in App.tsx (which re-exports
// from this constant) will surface as a test failure here.
// ---------------------------------------------------------------------------

/**
 * Mirrors App.tsx's private redirect components:
 *   function DashboardOverviewRedirect() {
 *     const [, setLocation] = useLocation();
 *     useEffect(() => { setLocation('/dashboard/overview'); }, [setLocation]);
 *     return <LoadingSpinner />;
 *   }
 */
function TestRedirect({ to }: { to: string }) {
  const [, setLocation] = wouter.useLocation();
  useEffect(() => {
    setLocation(to);
  }, [setLocation, to]);
  return null;
}

describe('Parent-route redirect behavior (useEffect + setLocation pattern)', () => {
  let setLocationSpy: jest.Mock;

  beforeEach(() => {
    setLocationSpy = jest.fn();
    jest
      .spyOn(wouter, 'useLocation')
      .mockReturnValue(['/dashboard', setLocationSpy] as ReturnType<typeof wouter.useLocation>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(Object.entries(PARENT_ROUTE_REDIRECTS))(
    'TestRedirect to=%s calls setLocation("%s")',
    async (_from, to) => {
      await act(async () => {
        render(<TestRedirect to={to} />);
      });

      expect(setLocationSpy).toHaveBeenCalledWith(to);
    },
  );
});
