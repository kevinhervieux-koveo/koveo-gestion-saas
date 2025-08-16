import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Shield, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import koveoLogo from '@/assets/koveo-logo.jpg';

/**
 * Login form validation schema with Quebec-specific requirements.
 * Ensures proper email format and password complexity for security compliance.
 */
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

/**
 *
 */
type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Login page component for Koveo Gestion property management system.
 * Implements secure authentication with Quebec Law 25 compliance messaging.
 * 
 * Features:
 * - Form validation with Zod schema
 * - Error handling with user-friendly messages  
 * - Bilingual support (French/English)
 * - Quebec-compliant security messaging
 * - Role-based redirection after login.
 */
export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { login } = useAuth();
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    try {
      setIsLoggingIn(true);
      setLoginError('');
      
      const response = await login(data.email, data.password);
      
      toast({
        title: language === 'fr' ? 'Connexion réussie' : 'Login successful',
        description: language === 'fr' 
          ? 'Vous êtes maintenant connecté(e) à Koveo Gestion'
          : 'You are now logged into Koveo Gestion',
      });

      // Note: Routing to /dashboard is handled by the auth hook
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      setLoginError(errorMessage);
      
      toast({
        title: language === 'fr' ? 'Erreur de connexion' : 'Login error',
        description: language === 'fr' 
          ? 'Identifiants invalides ou compte inactif'
          : 'Invalid credentials or inactive account',
        variant: 'destructive',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const onSubmit = (data: LoginFormData) => {
    handleLogin(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={koveoLogo} 
              alt="Koveo Gestion Logo" 
              className="h-16 w-auto rounded-lg shadow-sm"
            />
          </div>
        </div>

        {/* Login Form */}
        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {language === 'fr' ? 'Connexion' : 'Sign In'}
            </CardTitle>
            <CardDescription className="text-center">
              {language === 'fr' 
                ? 'Entrez vos identifiants pour accéder à votre compte'
                : 'Enter your credentials to access your account'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loginError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {language === 'fr' ? 'Adresse courriel' : 'Email Address'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder={language === 'fr' ? 'votre@email.com' : 'your@email.com'}
                          disabled={isLoggingIn}
                          className="h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {language === 'fr' ? 'Mot de passe' : 'Password'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder={language === 'fr' ? 'Votre mot de passe' : 'Your password'}
                          disabled={isLoggingIn}
                          className="h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    language === 'fr' ? 'Connexion...' : 'Signing in...'
                  ) : (
                    language === 'fr' ? 'Se connecter' : 'Sign In'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Quebec Compliance Notice */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">
                  {language === 'fr' ? 'Confidentialité & Sécurité' : 'Privacy & Security'}
                </p>
                <p>
                  {language === 'fr' 
                    ? 'Conforme à la Loi 25 du Québec. Vos données sont protégées selon les normes de sécurité les plus strictes.'
                    : 'Quebec Law 25 compliant. Your data is protected according to the strictest security standards.'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            {language === 'fr' 
              ? '© 2025 Koveo Gestion. Tous droits réservés.'
              : '© 2025 Koveo Gestion. All rights reserved.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}