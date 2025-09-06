import { useState } from 'react';
import { Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, Mail } from 'lucide-react';
import { StandardForm, useStandardForm } from '@/components/forms/StandardForm';
import { StandardFormField } from '@/components/forms/StandardFormField';
import { ValidationTemplates } from '@/utils/form-validation-helpers';

const forgotPasswordSchema = z.object({
  email: ValidationTemplates.email()
    .refine(val => val.length > 0, 'Adresse e-mail requise pour la réinitialisation'),
});

/**
 *
 */
type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

/**
 *
 */
export default function ForgotPasswordPage() {
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();
  const { isLoading, errorMessage, handleSubmit } = useStandardForm({
    showSuccessMessage: false
  });

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    const submitFn = async (formData: ForgotPasswordForm) => {
      await apiRequest('POST', '/api/auth/forgot-password', formData);
      setEmailSent(true);
      toast({
        title: 'E-mail envoyé',
        description: 'Si cette adresse e-mail existe, un lien de réinitialisation a été envoyé.',
      });
    };
    
    await handleSubmit(submitFn, form, 'E-mail de réinitialisation envoyé avec succès')(data);
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
          <StandardForm
            form={form}
            onSubmit={onSubmit}
            isLoading={isLoading}
            errorMessage={errorMessage}
            submitText="Envoyer le lien de réinitialisation"
            loadingText="Envoi en cours..."
            formName="forgot-password"
            showCard={false}
          >
            <StandardFormField
              control={form.control}
              name="email"
              label="Adresse e-mail"
              type="email"
              placeholder="votre@email.com"
              required
              formName="forgot-password"
              description="Nous vous enverrons un lien sécurisé pour réinitialiser votre mot de passe"
            />
          </StandardForm>

          <div className='text-center mt-4'>
            <Button variant='ghost' asChild>
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
