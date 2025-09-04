import React, { useState } from 'react';
import { Header } from '@/components/layout/header';
import { useLanguage } from '@/hooks/use-language';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserPlus } from 'lucide-react';
import { SendInvitationDialog } from '@/components/admin/send-invitation-dialog';

/**
 * Simplified User Management Page - focusing on invitation functionality
 * This is a temporary simplified version to resolve component loading issues
 */
export default function UserManagementSimple() {
  const { t } = useLanguage();
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const handleInvitationSuccess = () => {
    // Success handling for invitations
    console.log('Invitation sent successfully');
    setShowInviteDialog(false);
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
      <Header title="User Management" subtitle="Manage users and send invitations" />
      <div className='container mx-auto px-4 py-8 space-y-6'>
        <div className='flex justify-between items-center'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
              <Users className='h-8 w-8' />
              {t('userManagement')}
            </h1>
            <p className='text-gray-600 dark:text-gray-400 mt-2'>
              Manage users and send invitations to your property management system
            </p>
          </div>

          <Button onClick={() => setShowInviteDialog(true)} data-testid="button-invite-user">
            <UserPlus className='h-4 w-4 mr-2' />
            Invite User
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Send Invitations</CardTitle>
          </CardHeader>
          <CardContent className='p-6'>
            <div className='text-center space-y-4'>
              <p className='text-gray-600 dark:text-gray-400'>
                Click the "Invite User" button above to send invitations to new users.
              </p>
              <p className='text-sm text-gray-500'>
                Note: This is a simplified interface. Full user management features will be restored after fixing the component loading issue.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Send Invitation Dialog */}
        <SendInvitationDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          onSuccess={handleInvitationSuccess}
        />
      </div>
    </div>
  );
}