import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MoreHorizontal, 
  Mail, 
  RefreshCw, 
  XCircle,
  Copy,
  ExternalLink
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { DataTable, type ColumnConfig } from '@/components/ui/data-table';
import { useUpdateMutation, useDeleteMutation } from '@/hooks/use-api-handler';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

// Interface for invitation data
/**
 *
 */
interface Invitation {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  organizationId?: string;
  buildingId?: string;
  invitedByUserId: string;
  inviterName?: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
  personalMessage?: string;
  securityLevel: string;
}

/**
 *
 */
interface InvitationManagementProps {
  invitations: Invitation[];
  onSendReminder: (_invitationId: string) => void;
  onRefresh: () => void;
}

/**
 * Invitation Management Component - Refactored using reusable components
 * Reduced from 439+ lines to ~220 lines by leveraging DataTable and API hooks.
 * @param root0
 * @param root0.invitations
 * @param root0.onSendReminder
 * @param root0.onRefresh
 */
export function InvitationManagement({ 
  invitations, 
  onSendReminder, 
  onRefresh 
}: InvitationManagementProps) {
  const { toast } = useToast();
  const { hasRole } = useAuth();

  // API mutations using reusable hooks
  const cancelInvitationMutation = useUpdateMutation<Invitation, { status: 'cancelled' }>(
    (variables, invitationId) => `/api/invitations/${invitationId}`,
    {
      successMessage: 'Invitation cancelled successfully',
      invalidateQueries: ['/api/invitations'],
      onSuccessCallback: onRefresh,
    }
  );

  const deleteInvitationMutation = useDeleteMutation(
    (invitationId) => `/api/invitations/${invitationId}`,
    {
      successMessage: 'Invitation deleted successfully',
      invalidateQueries: ['/api/invitations'],
      onSuccessCallback: onRefresh,
    }
  );

  const resendInvitationMutation = useUpdateMutation<Invitation, { action: 'resend' }>(
    (variables, invitationId) => `/api/invitations/${invitationId}/resend`,
    {
      successMessage: 'Invitation resent successfully',
      invalidateQueries: ['/api/invitations'],
    }
  );

  // Status badge styling
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'accepted': return 'success';
      case 'expired': return 'destructive';
      case 'cancelled': return 'secondary';
      default: return 'default';
    }
  };

  // Role badge styling
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'resident': return 'bg-green-100 text-green-800';
      case 'tenant': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Table column configuration
  const columns: ColumnConfig<Invitation>[] = [
    {
      id: 'email',
      header: 'Email',
      cell: (invitation) => (
        <div className="flex flex-col">
          <span className="font-medium">{invitation.email}</span>
          {invitation.personalMessage && (
            <span className="text-xs text-muted-foreground">
              Has personal message
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (invitation) => (
        <Badge className={getRoleBadgeColor(invitation.role)}>
          {invitation.role}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (invitation) => (
        <Badge variant={getStatusBadgeVariant(invitation.status)}>
          {invitation.status}
        </Badge>
      ),
    },
    {
      id: 'inviter',
      header: 'Invited By',
      cell: (invitation) => (
        <span className="text-sm">
          {invitation.inviterName || 'Unknown'}
        </span>
      ),
    },
    {
      id: 'created',
      header: 'Sent',
      cell: (invitation) => (
        <span className="text-sm">
          {new Date(invitation.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'expires',
      header: 'Expires',
      cell: (invitation) => {
        const expiresAt = new Date(invitation.expiresAt);
        const isExpired = expiresAt < new Date();
        return (
          <span className={`text-sm ${isExpired ? 'text-red-600' : ''}`}>
            {expiresAt.toLocaleDateString()}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (invitation) => (
        <InvitationActions
          invitation={invitation}
          onCancel={(id) => cancelInvitationMutation.mutate({ status: 'cancelled' }, id)}
          onDelete={(id) => deleteInvitationMutation.mutate(id)}
          onResend={(id) => {
            resendInvitationMutation.mutate({ action: 'resend' }, id);
            onSendReminder(id);
          }}
          onCopyLink={copyInvitationLink}
          canEdit={hasRole(['admin', 'manager'])}
        />
      ),
    },
  ];

  // Copy invitation link to clipboard
  const copyInvitationLink = (invitation: Invitation) => {
    const inviteUrl = `${window.location.origin}/register?token=${invitation.token}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      toast({
        title: 'Link Copied',
        description: 'Invitation link copied to clipboard',
      });
    }).catch(() => {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy invitation link',
        variant: 'destructive',
      });
    });
  };

  // Filter and search configuration
  const getStatusCounts = () => {
    const counts = {
      all: invitations.length,
      pending: invitations.filter(i => i.status === 'pending').length,
      accepted: invitations.filter(i => i.status === 'accepted').length,
      expired: invitations.filter(i => i.status === 'expired').length,
      cancelled: invitations.filter(i => i.status === 'cancelled').length,
    };
    return counts;
  };

  const statusCounts = getStatusCounts();

  const filterOptions = [
    { value: 'all', label: `All (${statusCounts.all})` },
    { value: 'pending', label: `Pending (${statusCounts.pending})` },
    { value: 'accepted', label: `Accepted (${statusCounts.accepted})` },
    { value: 'expired', label: `Expired (${statusCounts.expired})` },
    { value: 'cancelled', label: `Cancelled (${statusCounts.cancelled})` },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invitation Management ({invitations.length})
          </CardTitle>
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          data={invitations}
          columns={columns}
          searchableColumns={['email', 'role']}
          filterableColumns={[
            {
              id: 'status',
              title: 'Status',
              options: filterOptions,
            },
            {
              id: 'role',
              title: 'Role',
              options: [
                { value: 'all', label: 'All Roles' },
                { value: 'admin', label: 'Admin' },
                { value: 'manager', label: 'Manager' },
                { value: 'resident', label: 'Resident' },
                { value: 'tenant', label: 'Tenant' },
              ],
            },
          ]}
          bulkActions={hasRole(['admin']) ? [
            {
              label: 'Cancel Selected',
              action: (selectedIds) => {
                selectedIds.forEach(id => {
                  cancelInvitationMutation.mutate({ status: 'cancelled' }, id);
                });
              },
              variant: 'destructive',
              icon: <XCircle className="h-4 w-4" />,
            },
          ] : []}
          initialPageSize={10}
          emptyStateMessage="No invitations found"
        />
      </CardContent>
    </Card>
  );
}

// Actions dropdown component for individual invitations
/**
 *
 */
interface InvitationActionsProps {
  invitation: Invitation;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onResend: (id: string) => void;
  onCopyLink: (invitation: Invitation) => void;
  canEdit: boolean;
}

/**
 *
 * @param root0
 * @param root0.invitation
 * @param root0.onCancel
 * @param root0.onDelete
 * @param root0.onResend
 * @param root0.onCopyLink
 * @param root0.canEdit
 */
function InvitationActions({
  invitation,
  onCancel,
  onDelete,
  onResend,
  onCopyLink,
  canEdit,
}: InvitationActionsProps) {
  const canResend = invitation.status === 'pending' && new Date(invitation.expiresAt) > new Date();
  const canCancel = invitation.status === 'pending';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onCopyLink(invitation)}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Link
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => {
            const inviteUrl = `${window.location.origin}/register?token=${invitation.token}`;
            window.open(inviteUrl, '_blank');
          }}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Link
        </DropdownMenuItem>

        {canResend && canEdit && (
          <DropdownMenuItem onClick={() => onResend(invitation.id)}>
            <Mail className="mr-2 h-4 w-4" />
            Resend Invitation
          </DropdownMenuItem>
        )}

        {canCancel && canEdit && (
          <DropdownMenuItem onClick={() => onCancel(invitation.id)}>
            <XCircle className="mr-2 h-4 w-4" />
            Cancel Invitation
          </DropdownMenuItem>
        )}

        {canEdit && (
          <DropdownMenuItem 
            onClick={() => onDelete(invitation.id)}
            className="text-red-600"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Delete Invitation
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}