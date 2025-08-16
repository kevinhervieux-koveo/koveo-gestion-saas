import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
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
  MoreHorizontal, 
  Mail, 
  RefreshCw, 
  XCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  Copy,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  requires2FA: boolean;
}

/**
 *
 */
interface InvitationManagementProps {
  invitations: Invitation[];
  onSendReminder: (invitationId: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

/**
 * Invitation Management Component
 * Displays and manages user invitations with actions for reminders, cancellation, etc.
 * @param root0
 * @param root0.invitations
 * @param root0.onSendReminder
 * @param root0.onRefresh
 * @param root0.isLoading
 */
export function InvitationManagement({ 
  invitations, 
  onSendReminder, 
  onRefresh,
  isLoading = false 
}: InvitationManagementProps) {
  const { t } = useLanguage();
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancellingInvitation, setCancellingInvitation] = useState<string | null>(null);

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest('PUT', `/api/invitations/${invitationId}`, {
        status: 'cancelled',
        reason: 'Cancelled by administrator'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-management'] });
      toast({
        title: t('invitationCancelled'),
        description: t('invitationCancelledSuccessfully'),
      });
      setCancellingInvitation(null);
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest('POST', `/api/invitations/${invitationId}/resend`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('invitationResent'),
        description: t('invitationResentSuccessfully'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleCopyInvitationLink = (invitation: Invitation) => {
    const invitationUrl = `${window.location.origin}/accept-invitation?token=${invitation.token}`;
    navigator.clipboard.writeText(invitationUrl);
    toast({
      title: t('linkCopied'),
      description: t('invitationLinkCopied'),
    });
  };

  const handleOpenInvitationLink = (invitation: Invitation) => {
    const invitationUrl = `${window.location.origin}/accept-invitation?token=${invitation.token}`;
    window.open(invitationUrl, '_blank');
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    switch (status) {
      case 'pending':
        if (isExpired) {
          return (
            <Badge variant="destructive" className="bg-orange-100 text-orange-800">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {t('expired')}
            </Badge>
          );
        }
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            {t('pending')}
          </Badge>
        );
      case 'accepted':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('accepted')}
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="destructive" className="bg-orange-100 text-orange-800">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {t('expired')}
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            {t('cancelled')}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {status}
          </Badge>
        );
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'admin': return 'bg-red-100 text-red-800';
      case 'tenant': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) {return t('expired');}
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return t('daysRemaining', { count: days });
    } else if (hours > 0) {
      return t('hoursRemaining', { count: hours });
    } else {
      return t('expiringsSoon');
    }
  };

  const canManageInvitations = hasRole(['admin', 'manager']);

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              {t('invitationsList')}
            </CardTitle>
            <Button
              onClick={onRefresh}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('recipient')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('role')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('invited')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('expires')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('invitedBy')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => {
                  const isExpired = new Date(invitation.expiresAt) < new Date();
                  const isPending = invitation.status === 'pending' && !isExpired;
                  
                  return (
                    <TableRow key={invitation.id} className="group">
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {invitation.email}
                          </div>
                          {invitation.personalMessage && (
                            <div className="text-xs text-muted-foreground mt-1 max-w-xs truncate">
                              "{invitation.personalMessage}"
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge 
                          variant="secondary" 
                          className={getRoleBadgeColor(invitation.role)}
                        >
                          {t(invitation.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(invitation.status, invitation.expiresAt)}
                          {isPending && (
                            <div className="text-xs text-muted-foreground">
                              {getTimeRemaining(invitation.expiresAt)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatDate(invitation.createdAt)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {formatDate(invitation.expiresAt)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {invitation.inviterName || t('system')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label={t('invitationActions')}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem onClick={() => handleCopyInvitationLink(invitation)}>
                              <Copy className="h-4 w-4 mr-2" />
                              {t('copyLink')}
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem onClick={() => handleOpenInvitationLink(invitation)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              {t('openLink')}
                            </DropdownMenuItem>
                            
                            {isPending && canManageInvitations && (
                              <>
                                <DropdownMenuSeparator />
                                
                                <DropdownMenuItem 
                                  onClick={() => onSendReminder(invitation.id)}
                                  disabled={isLoading}
                                >
                                  <Mail className="h-4 w-4 mr-2" />
                                  {t('sendReminder')}
                                </DropdownMenuItem>
                                
                                <DropdownMenuItem 
                                  onClick={() => resendInvitationMutation.mutate(invitation.id)}
                                  disabled={resendInvitationMutation.isPending}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  {t('resendInvitation')}
                                </DropdownMenuItem>
                                
                                <DropdownMenuSeparator />
                                
                                <DropdownMenuItem 
                                  onClick={() => setCancellingInvitation(invitation.id)}
                                  className="text-destructive focus:text-destructive"
                                  disabled={cancelInvitationMutation.isPending}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  {t('cancelInvitation')}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                {invitations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-muted-foreground">
                        {t('noInvitationsFound')}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Invitation Dialog */}
      <AlertDialog 
        open={cancellingInvitation !== null} 
        onOpenChange={(open) => !open && setCancellingInvitation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelInvitation')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cancelInvitationConfirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancellingInvitation) {
                  cancelInvitationMutation.mutate(cancellingInvitation);
                }
              }}
              disabled={cancelInvitationMutation.isPending}
            >
              {cancelInvitationMutation.isPending ? t('cancelling') : t('cancelInvitation')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}