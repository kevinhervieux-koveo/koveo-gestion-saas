import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Globe,
  Palette,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Key,
} from 'lucide-react';
import { z } from 'zod';
import { useLanguage } from '@/contexts/LanguageContext';

// Form schemas
const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required (example: Jean)').max(50, 'First name must be less than 50 characters').regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'First name can only contain letters, spaces, apostrophes and hyphens'),
  lastName: z.string().min(1, 'Last name is required (example: Dupont)').max(50, 'Last name must be less than 50 characters').regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Last name can only contain letters, spaces, apostrophes and hyphens'),
  email: z.string().min(1, 'Email address is required').email('Please enter a valid email address (example: jean.dupont@email.com)'),
  username: z.string().min(3, 'Username must be between 3 and 30 characters (example: jdupont)').max(30, 'Username must be between 3 and 30 characters (example: jdupont)').regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, dots, underscores and hyphens'),
  phone: z.string().optional().refine((val) => {
    if (!val) return true;
    return /^(\+1\s?)?(\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/.test(val);
  }, 'Phone number must be a valid North American format (example: (514) 123-4567)'),
  language: z.enum(['fr', 'en']),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required to verify your identity'),
    newPassword: z.string()
      .min(8, 'New password must be at least 8 characters long (example: MonNouveauMotDePasse123!)')
      .max(100, 'New password must be less than 100 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'New password must contain at least one lowercase letter, one uppercase letter, and one number'),
    confirmPassword: z.string().min(1, 'Please confirm your new password by typing it again'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match - please enter the same password in both fields",
    path: ['confirmPassword'],
  });

const deleteAccountSchema = z.object({
  confirmEmail: z.string().min(1, 'Email confirmation is required to delete account').email('Please enter a valid email address that matches your account'),
  reason: z.string().max(500, 'Reason must be less than 500 characters').optional(),
});

/**
 *
 */
type ProfileFormData = z.infer<typeof profileSchema>;
/**
 *
 */
type PasswordFormData = z.infer<typeof passwordSchema>;
/**
 *
 */
type DeleteAccountFormData = z.infer<typeof deleteAccountSchema>;

/**
 *
 */
export default function Settings() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      username: user?.username || '',
      phone: user?.phone || '',
      language: (user?.language as 'fr' | 'en') || 'fr',
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Delete account form
  const deleteForm = useForm<DeleteAccountFormData>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      confirmEmail: '',
      reason: '',
    },
  });

  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });

  // Password change mutation
  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      const response = await fetch('/api/users/me/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to change password');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Password changed',
        description: 'Your password has been changed successfully.',
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to change password',
        variant: 'destructive',
      });
    },
  });

  // Data export mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/users/me/data-export', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: 'Data exported',
        description: 'Your data has been downloaded successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export data',
        variant: 'destructive',
      });
    },
  });

  // Account deletion mutation
  const deleteMutation = useMutation({
    mutationFn: async (data: DeleteAccountFormData) => {
      const response = await fetch('/api/users/me/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete account');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Account deleted',
        description: 'Your account and all associated data have been permanently deleted.',
      });
      logout();
    },
    onError: (error: any) => {
      toast({
        title: 'Deletion failed',
        description: error.message || 'Failed to delete account',
        variant: 'destructive',
      });
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    profileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    passwordMutation.mutate(data);
  };

  const onDeleteSubmit = (data: DeleteAccountFormData) => {
    deleteMutation.mutate(data);
    setShowDeleteDialog(false);
  };

  const handleDataExport = () => {
    exportMutation.mutate();
  };

  return (
    <div className='flex-1 flex flex-col overflow-hidden' data-testid='settings-page'>
      <Header title={t('settings')} subtitle={t('manageAccountSettings')} />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-4xl mx-auto space-y-6'>
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <User className='w-5 h-5' />
                {t('generalSettings')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className='space-y-4'>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <FormField
                      control={profileForm.control}
                      name='firstName'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('firstName')}</FormLabel>
                          <FormControl>
                            <Input data-testid='input-first-name' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name='lastName'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('lastName')}</FormLabel>
                          <FormControl>
                            <Input data-testid='input-last-name' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={profileForm.control}
                    name='email'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('email')}</FormLabel>
                        <FormControl>
                          <Input type='email' data-testid='input-email' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name='username'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('username')}</FormLabel>
                        <FormControl>
                          <Input data-testid='input-username' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name='phone'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('phone')}</FormLabel>
                        <FormControl>
                          <Input type='tel' data-testid='input-phone' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name='language'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('language')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          data-testid='select-language'
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectLanguage')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='fr'>Français</SelectItem>
                            <SelectItem value='en'>English</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type='submit'
                    data-testid='button-save-profile'
                    disabled={profileMutation.isPending}
                    className='flex items-center gap-2'
                  >
                    <Save className='w-4 h-4' />
                    {profileMutation.isPending ? t('saving') : t('saveChanges')}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Key className='w-5 h-5' />
                {t('securitySettings')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className='space-y-4'>
                  <FormField
                    control={passwordForm.control}
                    name='currentPassword'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('currentPassword')}</FormLabel>
                        <FormControl>
                          <div className='relative'>
                            <Input
                              type={showCurrentPassword ? 'text' : 'password'}
                              data-testid='input-current-password'
                              {...field}
                            />
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              data-testid='toggle-current-password'
                            >
                              {showCurrentPassword ? (
                                <EyeOff className='h-4 w-4' />
                              ) : (
                                <Eye className='h-4 w-4' />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name='newPassword'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('newPassword')}</FormLabel>
                        <FormControl>
                          <div className='relative'>
                            <Input
                              type={showNewPassword ? 'text' : 'password'}
                              data-testid='input-new-password'
                              {...field}
                            />
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              data-testid='toggle-new-password'
                            >
                              {showNewPassword ? (
                                <EyeOff className='h-4 w-4' />
                              ) : (
                                <Eye className='h-4 w-4' />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name='confirmPassword'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('confirmNewPassword')}</FormLabel>
                        <FormControl>
                          <div className='relative'>
                            <Input
                              type={showConfirmPassword ? 'text' : 'password'}
                              data-testid='input-confirm-password'
                              {...field}
                            />
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              data-testid='toggle-confirm-password'
                            >
                              {showConfirmPassword ? (
                                <EyeOff className='h-4 w-4' />
                              ) : (
                                <Eye className='h-4 w-4' />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type='submit'
                    data-testid='button-change-password'
                    disabled={passwordMutation.isPending}
                    className='flex items-center gap-2'
                  >
                    <Shield className='w-4 h-4' />
                    {passwordMutation.isPending ? t('changing') : t('changePassword')}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Future Settings */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <SettingsIcon className='w-5 h-5' />
                {t('additionalSettings')}
                <Badge variant='secondary' className='text-xs ml-2'>
                  {t('future')}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <Button
                  variant='outline'
                  className='h-auto p-4 flex flex-col space-y-2'
                  disabled
                  data-testid='button-notifications'
                >
                  <Bell className='w-6 h-6' />
                  <span>{t('notifications')}</span>
                  <Badge variant='secondary' className='text-xs'>
                    {t('future')}
                  </Badge>
                </Button>
                <Button
                  variant='outline'
                  className='h-auto p-4 flex flex-col space-y-2'
                  disabled
                  data-testid='button-theme'
                >
                  <Palette className='w-6 h-6' />
                  <span>{t('theme')}</span>
                  <Badge variant='secondary' className='text-xs'>
                    {t('future')}
                  </Badge>
                </Button>
                <Button
                  variant='outline'
                  className='h-auto p-4 flex flex-col space-y-2'
                  disabled
                  data-testid='button-advanced'
                >
                  <Globe className='w-6 h-6' />
                  <span>{t('advanced')}</span>
                  <Badge variant='secondary' className='text-xs'>
                    {t('future')}
                  </Badge>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Law 25 Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Shield className='w-5 h-5' />
                {t('privacyDataCompliance')}
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800'>
                <h4 className='font-semibold text-blue-900 dark:text-blue-100 mb-2'>
                  {t('yourDataRights')}
                </h4>
                <p className='text-blue-700 dark:text-blue-300 text-sm mb-3'>
                  {t('dataRightsDescription')}
                </p>
              </div>

              <div className='space-y-3'>
                <div className='flex items-center justify-between p-4 border rounded-lg'>
                  <div className='space-y-1'>
                    <h5 className='font-medium'>Download Your Data</h5>
                    <p className='text-sm text-muted-foreground'>
                      Export all your personal data including profile information, bills, documents,
                      and activity history.
                    </p>
                  </div>
                  <Button
                    onClick={handleDataExport}
                    disabled={exportMutation.isPending}
                    className='flex items-center gap-2'
                    data-testid='button-export-data'
                  >
                    <Download className='w-4 h-4' />
                    {exportMutation.isPending ? t('exporting') : t('exportData')}
                  </Button>
                </div>

                <Separator />

                <div className='flex items-center justify-between p-4 border rounded-lg border-red-200 dark:border-red-800'>
                  <div className='space-y-1'>
                    <h5 className='font-medium text-red-900 dark:text-red-100'>
                      Delete Your Account
                    </h5>
                    <p className='text-sm text-red-700 dark:text-red-300'>
                      Permanently delete your account and all associated data. This action cannot be
                      undone.
                    </p>
                  </div>
                  <Button
                    variant='destructive'
                    onClick={() => setShowDeleteDialog(true)}
                    className='flex items-center gap-2'
                    data-testid='button-delete-account'
                  >
                    <Trash2 className='w-4 h-4' />
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Account Deletion Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid='dialog-delete-account'>
          <AlertDialogHeader>
            <AlertDialogTitle className='flex items-center gap-2 text-red-600'>
              <Trash2 className='w-5 h-5' />
              Delete Account Permanently
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated data, including:
              <ul className='list-disc list-inside mt-2 space-y-1'>
                <li>Your profile information</li>
                <li>All documents and files</li>
                <li>Bill history and payments</li>
                <li>Maintenance requests</li>
                <li>All other personal data</li>
              </ul>
              <strong className='text-red-600 block mt-3'>This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Form {...deleteForm}>
            <form onSubmit={deleteForm.handleSubmit(onDeleteSubmit)} className='space-y-4'>
              <FormField
                control={deleteForm.control}
                name='confirmEmail'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm your email to proceed</FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        placeholder={user?.email}
                        data-testid='input-confirm-email'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={deleteForm.control}
                name='reason'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for deletion (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Let us know why you are deleting your account...'
                        data-testid='textarea-delete-reason'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AlertDialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setShowDeleteDialog(false)}
                  data-testid='button-cancel-delete'
                >
                  Cancel
                </Button>
                <Button
                  type='submit'
                  variant='destructive'
                  disabled={deleteMutation.isPending}
                  data-testid='button-confirm-delete'
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Account'}
                </Button>
              </AlertDialogFooter>
            </form>
          </Form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
