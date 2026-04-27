/**
 * Admin – Impersonation Audit Log page (Task #1322).
 *
 * Shows every `assume_user` / `restore_acting_user` MCP tool invocation
 * recorded in `mcp_assume_user_log`.  Only users with the `admin` role
 * can reach this page; it is further enforced server-side by the
 * `/api/admin/impersonation-log` endpoint.
 *
 * Auto-registered via the `client/src/pages/auto/_register.tsx` system —
 * no edits to App.tsx are required.
 */

import type { AutoPageRoute } from './_register';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClipboardList, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

export const route: AutoPageRoute = {
  path: '/admin/impersonation-log',
  role: 'admin',
};

type ImpersonationUser = {
  id: string;
  email: string | null;
  fullName: string;
} | null;

type AuditRow = {
  id: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: string | null;
  performedBy: ImpersonationUser;
  assumedUser: ImpersonationUser;
};

type ApiResponse = {
  data: AuditRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function userLabel(u: ImpersonationUser): string {
  if (!u) return '(unknown / deleted)';
  if (u.fullName && u.email) return `${u.fullName} <${u.email}>`;
  if (u.email) return u.email;
  if (u.fullName) return u.fullName;
  return u.id;
}

function ActionBadge({ action }: { action: string }) {
  if (action === 'assume') {
    return (
      <Badge variant="destructive" className="text-xs font-mono">
        assume
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs font-mono">
      restore
    </Badge>
  );
}

export default function AdminImpersonationLogPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<ApiResponse>({
    queryKey: ['/api/admin/impersonation-log', page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/impersonation-log?page=${page}&limit=50`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    enabled: user?.role === 'admin' || user?.role === 'super_admin',
    staleTime: 30_000,
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={t('impLogTitle')}
        subtitle={t('impLogSubtitle')}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              {t('impLogDisclaimer')}
            </AlertDescription>
          </Alert>

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <Alert variant="destructive">
              <AlertDescription>{t('impLogError')}</AlertDescription>
            </Alert>
          )}

          {!isLoading && !isError && (
            <>
              <div className="rounded-md border bg-white dark:bg-gray-900">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">{t('impLogTimestamp')}</TableHead>
                      <TableHead className="w-[80px]">{t('impLogAction')}</TableHead>
                      <TableHead>{t('impLogPerformedBy')}</TableHead>
                      <TableHead>{t('impLogAssumedUser')}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t('impLogIpAddress')}</TableHead>
                      <TableHead className="hidden xl:table-cell">{t('impLogOutcome')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                          <ClipboardList className="mx-auto h-8 w-8 mb-2 opacity-30" />
                          {t('impLogEmpty')}
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(row.createdAt, language)}
                        </TableCell>
                        <TableCell>
                          <ActionBadge action={row.action} />
                        </TableCell>
                        <TableCell className="text-sm">{userLabel(row.performedBy)}</TableCell>
                        <TableCell className="text-sm">
                          {row.assumedUser ? userLabel(row.assumedUser) : '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {row.ipAddress ?? '—'}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                          {typeof row.details?.outcome === 'string' ? row.details.outcome : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {t('impLogPaginationLabel')
                      .replace('{page}', String(pagination.page))
                      .replace('{totalPages}', String(pagination.totalPages))
                      .replace('{total}', String(pagination.total))}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t('previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t('next')}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
