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
import { apiRequest } from '@/lib/queryClient';
import { Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
      .max(100, 'Le mot de passe ne peut pas dépasser 100 caractères')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'
      ),
    confirmPassword: z.string(),
  })
  .refine((_data) => _data.password === _data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
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
        title: 'Token manquant',
        description: 'Le lien de réinitialisation est invalide ou manquant.',
        variant: 'destructive',
      });
      navigate('/login');
      return;
    }

    setToken(tokenParam);
  }, [navigate, toast]);

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
        title: 'Erreur',
        description: 'Token de réinitialisation manquant.',
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
        title: 'Mot de passe réinitialisé',
        description: 'Votre mot de passe a été mis à jour avec succès.',
      });
    } catch (_error: unknown) {
      /**
       * Catch function.
       * @param error - Error object.
       */ /**
       * Catch function.
       * @param error - Error object.
       */

      console.error('Reset password _error:', _error);
      let errorMessage = 'Une erreur est survenue lors de la réinitialisation du mot de passe.'; /**
       * If function.
       * @param error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED' - error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED' parameter.
       */ /**
       * If function.
       * @param error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED' - error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED' parameter.
       */

      if ((_error as any).code === 'INVALID_TOKEN' || (_error as any).code === 'TOKEN_EXPIRED') {
        errorMessage =
          'Le lien de réinitialisation est invalide ou expiré. Veuillez demander un nouveau lien.';
      } else if ((_error as any).code === 'TOKEN_ALREADY_USED') {
        /**
         * If function.
         * @param error.code === 'TOKEN_ALREADY_USED' - error.code === 'TOKEN_ALREADY_USED' parameter.
         */ /**
         * If function.
         * @param error.code === 'TOKEN_ALREADY_USED' - error.code === 'TOKEN_ALREADY_USED' parameter.
         */

        errorMessage = 'Ce lien de réinitialisation a déjà été utilisé.';
      } else if ((_error as any).code === 'PASSWORD_TOO_SHORT') {
        /**
         * If function.
         * @param error.code === 'PASSWORD_TOO_SHORT' - error.code === 'PASSWORD_TOO_SHORT' parameter.
         */ /**
         * If function.
         * @param error.code === 'PASSWORD_TOO_SHORT' - error.code === 'PASSWORD_TOO_SHORT' parameter.
         */

        errorMessage = 'Le mot de passe doit contenir au moins 8 caractères.';
      } else if ((_error as any).code === 'PASSWORD_TOO_WEAK') {
        /**
         * If function.
         * @param error.code === 'PASSWORD_TOO_WEAK' - error.code === 'PASSWORD_TOO_WEAK' parameter.
         */ /**
         * If function.
         * @param error.code === 'PASSWORD_TOO_WEAK' - error.code === 'PASSWORD_TOO_WEAK' parameter.
         */

        errorMessage =
          'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.';
      }

      toast({
        title: 'Erreur',
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
            <CardTitle className='text-2xl font-bold'>Mot de passe réinitialisé</CardTitle>
            <CardDescription>
              Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter
              avec votre nouveau mot de passe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className='w-full'>
              <Link href='/login'>Se connecter</Link>
            </Button>
          </CardContent>
        </Card>
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
            <CardTitle className='text-2xl font-bold'>Lien invalide</CardTitle>
            <CardDescription>Le lien de réinitialisation est invalide ou manquant.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <Button asChild className='w-full'>
                <Link href='/forgot-password'>Demander un nouveau lien</Link>
              </Button>
              <Button variant='ghost' asChild className='w-full'>
                <Link href='/login'>
                  <ArrowLeft className='w-4 h-4 mr-2' />
                  Retour à la connexion
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <CardTitle className='text-2xl font-bold'>Réinitialiser le mot de passe</CardTitle>
          <CardDescription>Entrez votre nouveau mot de passe</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouveau mot de passe</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder='Entrez votre nouveau mot de passe'
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
                            {showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
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
                    <FormLabel>Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder='Confirmez votre nouveau mot de passe'
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
                              ? 'Masquer le mot de passe'
                              : 'Afficher le mot de passe'}
                          </span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type='submit' className='w-full' disabled={isSubmitting}>
                {isSubmitting ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
              </Button>

              <div className='text-center'>
                <Button variant='ghost' asChild>
                  <Link href='/login'>
                    <ArrowLeft className='w-4 h-4 mr-2' />
                    Retour à la connexion
                  </Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
