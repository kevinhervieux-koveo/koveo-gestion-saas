import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';
import { applyDangerousInputFieldError } from '@/lib/form-errors';
import { Eye, EyeOff, CheckCircle, ArrowLeft, Linkedin } from 'lucide-react';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'authNewPasswordRequired')
      .min(8, 'authPasswordMin8')
      .max(100, 'authPasswordMax100')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'authPasswordComplexity'
      ),
    confirmPassword: z.string().min(1, 'authConfirmPasswordRequiredZ'),
  })
  .refine((_data) => _data.password === _data.confirmPassword, {
    message: 'authPasswordsDoNotMatchHelp',
    path: ['confirmPassword'],
  });

/**
 *
 */
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

/**
 *
 */
export default function /**
 * Reset password page function.
 */ /**
 * Reset password page function.
 */

ResetPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { language, t } = useLanguage();

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Extract token from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token'); /**
     * If function.
     * @param !tokenParam - !tokenParam parameter.
     */ /**
     * If function.
     * @param !tokenParam - !tokenParam parameter.
     */

    if (!tokenParam) {
      toast({
        title: t('authTokenMissing'),
        description: t('authResetLinkInvalid'),
        variant: 'destructive',
      });
      navigate('/login');
      return;
    }

    setToken(tokenParam);
  }, [navigate, toast, t]);

  const onSubmit = async (_data: ResetPasswordForm) => {
    /**
     * If function.
     * @param !token - !token parameter.
     */ /**
     * If function.
     * @param !token - !token parameter.
     */

    if (!token) {
      toast({
        title: t('authErrorTitle'),
        description: t('authResetTokenMissing'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('POST', '/api/auth/reset-password', {
        token,
        password: _data.password,
      });

      setResetComplete(true);
      toast({
        title: t('authPasswordResetTitle'),
        description: t('authPasswordUpdatedSuccess'),
      });
    } catch (_error: unknown) {
      // Task #166: pin DANGEROUS_INPUT rejections to the offending
      // field inline and skip the generic toast below.
      if (applyDangerousInputFieldError(_error, form)) {
        return;
      }

      let errorMessage = t('authResetGeneralError'); /**
       * If function.
       * @param error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED' - error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED' parameter.
       */ /**
       * If function.
       * @param error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED' - error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED' parameter.
       */

      if ((_error as any).code === 'INVALID_TOKEN' || (_error as any).code === 'TOKEN_EXPIRED') {
        errorMessage = t('authResetLinkInvalidExpired');
      } else if ((_error as any).code === 'TOKEN_ALREADY_USED') {
        /**
         * If function.
         * @param error.code === 'TOKEN_ALREADY_USED' - error.code === 'TOKEN_ALREADY_USED' parameter.
         */ /**
         * If function.
         * @param error.code === 'TOKEN_ALREADY_USED' - error.code === 'TOKEN_ALREADY_USED' parameter.
         */

        errorMessage = t('authResetLinkAlreadyUsed');
      } else if ((_error as any).code === 'PASSWORD_TOO_SHORT') {
        /**
         * If function.
         * @param error.code === 'PASSWORD_TOO_SHORT' - error.code === 'PASSWORD_TOO_SHORT' parameter.
         */ /**
         * If function.
         * @param error.code === 'PASSWORD_TOO_SHORT' - error.code === 'PASSWORD_TOO_SHORT' parameter.
         */

        errorMessage = t('authPasswordTooShort');
      } else if ((_error as any).code === 'PASSWORD_TOO_WEAK') {
        /**
         * If function.
         * @param error.code === 'PASSWORD_TOO_WEAK' - error.code === 'PASSWORD_TOO_WEAK' parameter.
         */ /**
         * If function.
         * @param error.code === 'PASSWORD_TOO_WEAK' - error.code === 'PASSWORD_TOO_WEAK' parameter.
         */

        errorMessage = t('authPasswordTooWeak');
      }

      toast({
        title: t('authErrorTitle'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }; /**
   * If function.
   * @param resetComplete - ResetComplete parameter.
   */ /**
   * If function.
   * @param resetComplete - ResetComplete parameter.
   */

  if (resetComplete) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'>
        <Card className='w-full max-w-md'>
          <CardHeader className='text-center'>
            <div className='mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4'>
              <CheckCircle className='w-6 h-6 text-green-600 dark:text-green-400' />
            </div>
            <CardTitle className='text-2xl font-bold'>{t('authPasswordResetTitle')}</CardTitle>
            <CardDescription>
              {t('authPasswordResetCompleteDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className='w-full'>
              <Link href='/login'>{t('authSignIn')}</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Follow Us */}
        <div className='text-center mt-6'>
          <p className='text-sm text-gray-500 dark:text-gray-400 mb-2'>{language === 'fr' ? 'Suivez-nous' : 'Follow Us'}</p>
          <a
            href='https://www.linkedin.com/company/koveo-gestion-inc/'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center justify-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white px-4 py-2 rounded-lg transition-colors text-sm'
          >
            <Linkedin className='h-4 w-4' />
            <span>LinkedIn</span>
          </a>
        </div>
      </div>
    );
  } /**
   * If function.
   * @param !token - !token parameter.
   */ /**
   * If function.
   * @param !token - !token parameter.
   */

  if (!token) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'>
        <Card className='w-full max-w-md'>
          <CardHeader className='text-center'>
            <CardTitle className='text-2xl font-bold'>{t('authInvalidLink')}</CardTitle>
            <CardDescription>{t('authResetLinkInvalid')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <Button asChild className='w-full'>
                <Link href='/forgot-password'>{t('authRequestNewLink')}</Link>
              </Button>
              <Button variant='ghost' asChild className='w-full'>
                <Link href='/login'>
                  <ArrowLeft className='w-4 h-4 mr-2' />
                  {t('authBackToLogin')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Follow Us */}
        <div className='text-center mt-6'>
          <p className='text-sm text-gray-500 dark:text-gray-400 mb-2'>{language === 'fr' ? 'Suivez-nous' : 'Follow Us'}</p>
          <a
            href='https://www.linkedin.com/company/koveo-gestion-inc/'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center justify-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white px-4 py-2 rounded-lg transition-colors text-sm'
          >
            <Linkedin className='h-4 w-4' />
            <span>LinkedIn</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <CardTitle className='text-2xl font-bold'>{t('authResetPasswordTitle')}</CardTitle>
          <CardDescription>{t('authEnterNewPassword')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('authNewPasswordLabel')}</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder={t('authEnterNewPassword')}
                          className='pr-10'
                          data-testid='input-password'
                          {...field}
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid='button-toggle-password'
                        >
                          {showPassword ? (
                            <EyeOff className='h-4 w-4 text-gray-400' />
                          ) : (
                            <Eye className='h-4 w-4 text-gray-400' />
                          )}
                          <span className='sr-only'>
                            {showPassword ? t('authHidePassword') : t('authShowPassword')}
                          </span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='confirmPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('authConfirmPasswordLabel')}</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder={t('authConfirmNewPassword')}
                          className='pr-10'
                          data-testid='input-confirm-password'
                          {...field}
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          data-testid='button-toggle-confirm-password'
                        >
                          {showConfirmPassword ? (
                            <EyeOff className='h-4 w-4 text-gray-400' />
                          ) : (
                            <Eye className='h-4 w-4 text-gray-400' />
                          )}
                          <span className='sr-only'>
                            {showConfirmPassword
                              ? t('authHidePassword')
                              : t('authShowPassword')}
                          </span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type='submit' className='w-full' disabled={isSubmitting}>
                {isSubmitting ? t('authResettingInProgress') : t('authResetPasswordTitle')}
              </Button>

              <div className='text-center'>
                <Button variant='ghost' asChild>
                  <Link href='/login'>
                    <ArrowLeft className='w-4 h-4 mr-2' />
                    {t('authBackToLogin')}
                  </Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Follow Us */}
      <div className='text-center mt-6'>
        <p className='text-sm text-gray-500 dark:text-gray-400 mb-2'>{language === 'fr' ? 'Suivez-nous' : 'Follow Us'}</p>
        <a
          href='https://www.linkedin.com/company/koveo-gestion-inc/'
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center justify-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white px-4 py-2 rounded-lg transition-colors text-sm'
        >
          <Linkedin className='h-4 w-4' />
          <span>LinkedIn</span>
        </a>
      </div>
    </div>
  );
}
