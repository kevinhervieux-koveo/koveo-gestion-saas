import { useState } from 'react';
import { Link } from 'wouter';
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
import { ArrowLeft, Mail } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string()
    .min(1, 'Adresse e-mail requise pour la réinitialisation')
    .email('Veuillez entrer une adresse e-mail valide (exemple: utilisateur@domaine.com)'),
});

/**
 *
 */
type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

/**
 *
 */
export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (_data: ForgotPasswordForm) => {
    setIsSubmitting(true);
    try {
      await apiRequest('POST', '/api/auth/forgot-password', _data);

      setEmailSent(true);
      toast({
        title: 'E-mail envoyé',
        description: 'Si cette adresse e-mail existe, un lien de réinitialisation a été envoyé.',
      });
    } catch (_error: unknown) {
      if (import.meta.env.DEV) {
      }
      const errorMessage =
        _error instanceof Error
          ? _error.message
          : "Une erreur est survenue lors de l'envoi de l'e-mail.";
      toast({
        title: 'Erreur',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (emailSent) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'>
        <Card className='w-full max-w-md'>
          <CardHeader className='text-center'>
            <div className='mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4'>
              <Mail className='w-6 h-6 text-green-600 dark:text-green-400' />
            </div>
            <CardTitle className='text-2xl font-bold'>E-mail envoyé</CardTitle>
            <CardDescription>
              Si votre adresse e-mail est dans notre système, vous recevrez un lien de
              réinitialisation du mot de passe dans quelques minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground text-center'>
                N'oubliez pas de vérifier votre dossier de courrier indésirable.
              </p>
              <Button asChild className='w-full'>
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
          <CardTitle className='text-2xl font-bold'>Mot de passe oublié</CardTitle>
          <CardDescription>
            Entrez votre adresse e-mail pour recevoir un lien de réinitialisation du mot de passe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse e-mail</FormLabel>
                    <FormControl>
                      <Input type='email' placeholder='votre@email.com' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type='submit' className='w-full' disabled={isSubmitting}>
                {isSubmitting ? 'Envoi en cours...' : 'Envoyer le lien'}
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
