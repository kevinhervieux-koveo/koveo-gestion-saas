import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NoDataCard } from '@/components/ui/no-data-card';
import { useLanguage } from '@/hooks/use-language';
import { Trash2, Mail, Clock, Building2, Home, History } from 'lucide-react';

interface InvitationWithDetails {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  organizationId: string | null;
  buildingId: string | null;
  residenceId: string | null;
  organizationName?: string;
  buildingName?: string;
  residenceUnitNumber?: string;
  invitedByName?: string;
}

interface InvitationHistoryItem {
  id: string;
  invitationId: string;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  performedBy: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  performedByName: string | null;
  performedByEmail: string | null;
}

interface InvitationHistoryResponse {
  items: InvitationHistoryItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function InvitationManagement() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [deletingInvitation, setDeletingInvitation] = useState<InvitationWithDetails | null>(null);
  const [historyInvitation, setHistoryInvitation] = useState<InvitationWithDetails | null>(null);

  // Fetch pending invitations with role-based filtering
  const { data: invitations = [], isLoading } = useQuery<InvitationWithDetails[]>({
    queryKey: ['/api/invitations/pending'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/invitations/pending');
      return response.json();
    },
  });

  // History query (only enabled when an invitation is selected)
  const {
    data: history,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
  } = useQuery<InvitationHistoryResponse>({
    queryKey: ['/api/invitations', historyInvitation?.id, 'history'],
    enabled: !!historyInvitation,
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/invitations/${historyInvitation!.id}/history`,
      );
      return response.json();
    },
  });

  // Delete invitation mutation
  const deleteInvitationMutation = useCreateUpdateMutation<unknown, string>({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest('DELETE', `/api/invitations/${invitationId}`);
      return response.json();
    },
    successTitle: 'Success',
    successMessage: t('invitationDeletedSuccess'),
    errorMessage: t('invitationDeletedError'),
    queryKeysToInvalidate: [['/api/invitations/pending']],
    onSuccessCallback: () => {
      setDeletingInvitation(null);
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'tenant':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'resident':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getSourceFromDetails = (details: Record<string, unknown> | null): string | null => {
    if (!details) {
      return null;
    }
    const source = (details as { source?: unknown }).source;
    return typeof source === 'string' ? source : null;
  };

  // Strip the `source` key (already shown in its own column) and any
  // null/undefined fields, then return the remaining details so the UI
  // can render the full audit payload (route, role, etc.).
  const getExtraDetails = (
    details: Record<string, unknown> | null,
  ): Record<string, unknown> | null => {
    if (!details) {
      return null;
    }
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(details)) {
      if (k === 'source' || v === null || v === undefined) {
        continue;
      }
      extra[k] = v;
    }
    return Object.keys(extra).length > 0 ? extra : null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('pendingInvitations')}</CardTitle>
          <CardDescription>{t('loadingInvitations')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('pendingInvitations')}
          </CardTitle>
          <CardDescription>
            {t('managePendingInvitations')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <NoDataCard
              icon={Mail}
              titleKey="noInvitationsFound"
              descriptionKey="noInvitationsFound"
              testId="no-invitations-message"
              iconSize={12}
            />
          ) : (
            <div className="overflow-x-auto" data-onboarding="invitations.list">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('email')}</TableHead>
                    <TableHead>{t('role')}</TableHead>
                    <TableHead>{t('organization')}</TableHead>
                    <TableHead>{t('building')}</TableHead>
                    <TableHead>{t('residence')}</TableHead>
                    <TableHead>{t('expires')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id} data-testid={`invitation-row-${invitation.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          {invitation.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(invitation.role)}>
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {invitation.organizationName ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">{invitation.organizationName}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {invitation.buildingName ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">{invitation.buildingName}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {invitation.residenceUnitNumber ? (
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">{t('unit')} {invitation.residenceUnitNumber}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className={`text-sm ${isExpired(invitation.expiresAt) ? 'text-red-600' : ''}`}>
                            {formatDate(invitation.expiresAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={isExpired(invitation.expiresAt) ? 'destructive' : 'default'}
                        >
                          {isExpired(invitation.expiresAt) ? t('expired') : t('pending')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2" data-onboarding="invitations.row-actions">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setHistoryInvitation(invitation)}
                            data-testid={`button-view-history-${invitation.id}`}
                            data-onboarding="invitations.history-btn"
                            title={t('viewInvitationHistory')}
                            aria-label={t('viewInvitationHistory')}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingInvitation(invitation)}
                            data-testid={`button-delete-invitation-${invitation.id}`}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={!!deletingInvitation} 
        onOpenChange={(open) => !open && setDeletingInvitation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteInvitation')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteInvitationConfirm').replace('{email}', deletingInvitation?.email || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deleteInvitationMutation.isPending}
              data-testid="button-cancel-delete-invitation"
            >
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingInvitation) {
                  deleteInvitationMutation.mutate(deletingInvitation.id);
                }
              }}
              disabled={deleteInvitationMutation.isPending}
              data-testid="button-confirm-delete-invitation"
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteInvitationMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <Dialog
        open={!!historyInvitation}
        onOpenChange={(open) => !open && setHistoryInvitation(null)}
      >
        <DialogContent className="max-w-3xl" data-testid="invitation-history-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t('invitationHistory')}
            </DialogTitle>
            <DialogDescription>
              {t('invitationHistoryDescription').replace(
                '{email}',
                historyInvitation?.email || '',
              )}
            </DialogDescription>
          </DialogHeader>

          {isHistoryLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : isHistoryError ? (
            <p className="text-sm text-red-600 py-4" data-testid="invitation-history-error">
              {t('invitationHistoryLoadError')}
            </p>
          ) : !history || history.items.length === 0 ? (
            <p className="text-sm text-gray-500 py-4" data-testid="invitation-history-empty">
              {t('invitationHistoryEmpty')}
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('invitationHistoryAction')}</TableHead>
                    <TableHead>{t('invitationHistoryStatusChange')}</TableHead>
                    <TableHead>{t('invitationHistoryPerformedBy')}</TableHead>
                    <TableHead>{t('invitationHistorySource')}</TableHead>
                    <TableHead>{t('invitationHistoryWhen')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.items.map((entry) => {
                    const source = getSourceFromDetails(entry.details);
                    const extraDetails = getExtraDetails(entry.details);
                    const performer =
                      entry.performedByName?.trim() ||
                      entry.performedByEmail ||
                      t('invitationHistorySystem');
                    const hasExtraInfo = !!extraDetails || !!entry.ipAddress;
                    return (
                      <TableRow
                        key={entry.id}
                        data-testid={`invitation-history-row-${entry.id}`}
                      >
                        <TableCell className="font-medium">
                          <Badge variant="secondary">{entry.action}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.previousStatus || entry.newStatus ? (
                            <span>
                              {entry.previousStatus ?? '—'} → {entry.newStatus ?? '—'}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{performer}</span>
                            {entry.performedByEmail && entry.performedByName ? (
                              <span className="text-xs text-gray-500">
                                {entry.performedByEmail}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {source ? (
                            <Badge variant="outline">{source}</Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                          {hasExtraInfo ? (
                            <details
                              className="mt-1"
                              data-testid={`invitation-history-details-${entry.id}`}
                            >
                              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                                {t('invitationHistoryShowDetails')}
                              </summary>
                              <pre className="mt-1 max-w-xs whitespace-pre-wrap break-words rounded bg-gray-50 p-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
{JSON.stringify(
                                  {
                                    ...(extraDetails ?? {}),
                                    ...(entry.ipAddress ? { ip: entry.ipAddress } : {}),
                                  },
                                  null,
                                  2,
                                )}
                              </pre>
                            </details>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDate(entry.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
