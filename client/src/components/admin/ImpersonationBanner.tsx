/**
 * ImpersonationBanner — Task #1322 / Task #1473.
 *
 * Renders a sticky banner at the top of the authenticated layout when the
 * logged-in admin has an active impersonation session.  Two sources:
 *
 *   source: 'web'  — started via POST /api/admin/impersonation/start (web UI).
 *                    Stored in the Express session; "Exit" clears the session
 *                    field and writes an audit row.  This is a real state change.
 *
 *   source: 'mcp'  — detected from the MCP audit log (assume→restore pairs).
 *                    The MCP session state lives in a per-connection server
 *                    closure; "Exit" writes an advisory restore row so the
 *                    banner disappears.  It cannot terminate the live MCP
 *                    connection from the web layer.
 *
 * Polls GET /api/admin/impersonation-status every 60 s (cheap single-row query).
 * Non-admin/super_admin users: the query is never issued (enabled: false).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type ImpersonationStatus =
  | { active: false; assumedUser: null }
  | {
      active: true;
      source: 'web' | 'mcp';
      assumedUser: { id: string; email: string | null; fullName: string };
      since?: string;
    };

function userLabel(u: { email: string | null; fullName: string }): string {
  if (u.fullName && u.email) return `${u.fullName} (${u.email})`;
  if (u.email) return u.email;
  if (u.fullName) return u.fullName;
  return '(unknown)';
}

export function ImpersonationBanner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isAdminLike = user?.role === 'admin' || user?.role === 'super_admin';

  const { data } = useQuery<ImpersonationStatus>({
    queryKey: ['/api/admin/impersonation-status'],
    queryFn: async () => {
      const res = await fetch('/api/admin/impersonation-status', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: isAdminLike,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });

  const exitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/impersonation/exit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/impersonation-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/impersonation-log'] });
      toast({
        title: 'Impersonation session ended',
        description: 'You are no longer viewing as another user.',
      });
    },
    onError: () => {
      toast({
        title: 'Could not exit impersonation',
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  if (!data?.active) return null;

  const label = userLabel(data.assumedUser);
  const isMcp = data.source === 'mcp';

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center gap-3 bg-amber-500 dark:bg-amber-600 text-white px-4 py-2 text-sm font-medium shadow-sm z-50"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">
        {isMcp ? 'MCP impersonation active' : 'Viewing as'} —{' '}
        <strong className="font-semibold">{label}</strong>.
        {isMcp
          ? ' All MCP tool calls are attributed to this user.'
          : ' Exiting will restore your own identity.'}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="text-white hover:bg-amber-600 dark:hover:bg-amber-700 h-7 px-2 text-xs font-medium"
        onClick={() => exitMutation.mutate()}
        disabled={exitMutation.isPending}
        aria-label="Exit impersonation session"
      >
        <X className="h-3.5 w-3.5 mr-1" />
        {exitMutation.isPending ? 'Exiting…' : 'Exit impersonation'}
      </Button>
    </div>
  );
}
