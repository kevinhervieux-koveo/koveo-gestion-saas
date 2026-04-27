/**
 * ImpersonationBanner — Task #1322.
 *
 * Renders a sticky banner at the top of the authenticated layout when the
 * currently logged-in admin has an active MCP impersonation session.
 * The banner shows the name/email of the user being impersonated and how
 * long ago the session started.
 *
 * It polls GET /api/admin/impersonation-status every 60 seconds.  The
 * endpoint is lazy-mounted (no cost until first hit) and returns within
 * a single DB round-trip, so the polling is cheap.
 *
 * Non-admin users: the query is never issued (enabled: false).
 * Admins with no active impersonation: the banner is not rendered.
 *
 * The banner is intentionally non-dismissible while impersonation is
 * active so that visibility is truly persistent for the duration of the
 * MCP session.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { AlertTriangle } from 'lucide-react';

type ImpersonationStatus =
  | { active: false; assumedUser: null }
  | {
      active: true;
      assumedUser: { id: string; email: string | null; fullName: string };
      since: string;
    };

function userLabel(u: { email: string | null; fullName: string }): string {
  if (u.fullName && u.email) return `${u.fullName} (${u.email})`;
  if (u.email) return u.email;
  if (u.fullName) return u.fullName;
  return '(unknown)';
}

export function ImpersonationBanner() {
  const { user } = useAuth();

  const { data } = useQuery<ImpersonationStatus>({
    queryKey: ['/api/admin/impersonation-status'],
    queryFn: async () => {
      const res = await fetch('/api/admin/impersonation-status', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: user?.role === 'admin',
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });

  if (!data?.active) return null;

  const label = userLabel(data.assumedUser);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center gap-3 bg-amber-500 dark:bg-amber-600 text-white px-4 py-2 text-sm font-medium shadow-sm z-50"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">
        MCP impersonation active — currently acting as{' '}
        <strong className="font-semibold">{label}</strong>.
        {' '}All MCP tool calls are attributed to this user.
      </span>
    </div>
  );
}
