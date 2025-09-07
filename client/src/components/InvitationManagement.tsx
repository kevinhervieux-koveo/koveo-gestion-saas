import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NoDataCard } from '@/components/ui/no-data-card';
import { useLanguage } from '@/hooks/use-language';
import { Trash2, Mail, Clock, Building2, Home } from 'lucide-react';

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

export function InvitationManagement() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [deletingInvitation, setDeletingInvitation] = useState<InvitationWithDetails | null>(null);

  // Fetch pending invitations with role-based filtering
  const { data: invitations = [], isLoading } = useQuery<InvitationWithDetails[]>({
    queryKey: ['/api/invitations/pending'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/invitations/pending');
      return response.json();
    },
  });

  // Delete invitation mutation
  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest('DELETE', `/api/invitations/${invitationId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: t('invitationDeletedSuccess'),
      });
      setDeletingInvitation(null);
      queryClient.invalidateQueries({ queryKey: ['/api/invitations/pending'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: t('invitationDeletedError'),
        variant: 'destructive',
      });
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
            <div className="overflow-x-auto">
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingInvitation(invitation)}
                          data-testid={`button-delete-invitation-${invitation.id}`}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
    </>
  );
}