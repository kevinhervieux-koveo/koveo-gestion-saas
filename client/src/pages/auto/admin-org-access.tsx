/**
 * Admin – Org Access page (Task #1473 / Task #657).
 *
 * Surfaces which organisations the current admin is a member of and
 * explains why they may only see Demo data when no real-org membership
 * exists. Links to the Organizations management page so the admin (or a
 * super-admin) can grant the missing cross-org access.
 *
 * Auto-registered via the `client/src/pages/auto/_register.tsx` system.
 */

import type { AutoPageRoute } from './_register';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Building2, AlertTriangle, CheckCircle2, Info, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';

export const route: AutoPageRoute = {
  path: '/admin/org-access',
  role: 'admin',
};

type OrgEntry = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  canAccessAllOrganizations: boolean;
};

type OrgAccessResponse = {
  orgs: OrgEntry[];
  isDemoOnly: boolean;
  hasCrossOrgAccess: boolean;
};

const ORG_TYPE_LABELS: Record<string, string> = {
  management_company: 'Management Company',
  syndicate: 'Syndicate',
  cooperative: 'Cooperative',
  condo_association: 'Condo Association',
  demo: 'Demo',
};

function orgTypeLabel(type: string): string {
  return ORG_TYPE_LABELS[type] ?? type;
}

export default function AdminOrgAccessPage() {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery<OrgAccessResponse>({
    queryKey: ['/api/admin/org-access'],
    queryFn: async () => {
      const res = await fetch('/api/admin/org-access', { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    enabled: user?.role === 'admin' || user?.role === 'super_admin',
    staleTime: 30_000,
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Org Access"
        subtitle="Your organisation memberships and data-scope visibility"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <Alert variant="destructive">
              <AlertDescription>Failed to load org access information. Please try again.</AlertDescription>
            </Alert>
          )}

          {!isLoading && !isError && data && (
            <>
              {data.isDemoOnly && (
                <Alert className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-800 dark:text-amber-200">
                    You only see Demo data
                  </AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-300 space-y-2">
                    <p>
                      Your account is not yet a member of any live organisation, so all lists
                      (buildings, residences, demands, etc.) only show data from the Demo
                      environment.
                    </p>
                    <p>
                      To see real client data, a super-admin must add you as a member of the
                      relevant organisation from the{' '}
                      <Link href="/admin/organizations" className="underline font-medium">
                        Organizations
                      </Link>{' '}
                      page.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {!data.isDemoOnly && !data.hasCrossOrgAccess && (
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-800 dark:text-blue-200">
                    Scoped to your organisations
                  </AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-300">
                    You can see data for the organisations listed below. To gain access to
                    additional organisations, ask a super-admin to add you as a member from the{' '}
                    <Link href="/admin/organizations" className="underline font-medium">
                      Organizations
                    </Link>{' '}
                    page.
                  </AlertDescription>
                </Alert>
              )}

              {data.hasCrossOrgAccess && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertTitle className="text-green-800 dark:text-green-200">
                    Cross-organisation access enabled
                  </AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-300">
                    At least one of your memberships grants cross-organisation access, so you
                    can view data across all organisations on this platform.
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border bg-white dark:bg-gray-900">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organisation</TableHead>
                      <TableHead className="w-[160px]">Type</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[180px]">Cross-org access</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orgs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                          <Building2 className="mx-auto h-8 w-8 mb-2 opacity-30" />
                          No organisation memberships found.
                        </TableCell>
                      </TableRow>
                    )}
                    {data.orgs.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={org.type === 'demo' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {orgTypeLabel(org.type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {org.isActive ? (
                            <Badge variant="outline" className="text-xs text-green-700 border-green-300 dark:text-green-400">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {org.canAccessAllOrganizations ? (
                            <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Enabled
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/organizations">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Manage organisations
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
