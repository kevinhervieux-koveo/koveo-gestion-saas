import { useState } from 'react';
import { Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';
import { applyDangerousInputFieldError } from '@/lib/form-errors';
import { ArrowLeft, Mail, Linkedin } from 'lucide-react';
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
  const { language } = useLanguage();
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
    // Task #166: if the server flags a specific field as containing
    // disallowed characters, show the red underline + server-supplied
    // French message inline on the email input and stop here. We
    // deliberately bypass useStandardForm's generic error banner for
    // this case so users don't see a duplicate, generic error above
    // the already-highlighted input.
    try {
      await apiRequest('POST', '/api/auth/forgot-password', data);
      setEmailSent(true);
      toast({
        title: 'E-mail envoyé',
        description: 'Si cette adresse e-mail existe, un lien de réinitialisation a été envoyé.',
      });
    } catch (err) {
      if (applyDangerousInputFieldError(err, form)) {
        return;
      }
      // Any other error — fall back to the shared error-banner path.
      await handleSubmit(
        async () => {
          throw err;
        },
        form,
        'E-mail de réinitialisation envoyé avec succès',
      )(data);
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
            {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
            <CardDescription>
              Si votre adresse e-mail est dans notre système, vous recevrez un lien de
              réinitialisation du mot de passe dans quelques minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
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
          <CardTitle className='text-2xl font-bold'>Mot de passe oublié</CardTitle>
          {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
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
              // eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up
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
