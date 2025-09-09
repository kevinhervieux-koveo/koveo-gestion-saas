import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Shield, Building, Users, Eye, EyeOff, Loader2, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { StandardFormField } from '@/components/forms/StandardFormField';
import koveoLogo from '@/assets/koveo-logo.jpg';

/**
 * Login form validation schema with Quebec-specific requirements.
 * Ensures proper email format and password complexity for security compliance.
 */
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'emailRequired')
    .email('invalidEmailFormat')
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'passwordRequired')
    .min(8, 'passwordTooShort'),
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
// Demo credentials for testing purposes only - not real production data
const DEMO_CREDENTIALS = {
  DEFAULT_DEMO_PASSWORD: 'demo123456',
  TENANT_DEMO_PASSWORD: 'demo123456',
} as const;

// Types for demo users from API
interface DemoUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface DemoUsersData {
  demo_manager: DemoUser[];
  demo_tenant: DemoUser[];
  demo_resident: DemoUser[];
}

/**
 *
 */
export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { login } = useAuth();
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [demoUsers, setDemoUsers] = useState<DemoUsersData | null>(null);
  const [loadingDemoUsers, setLoadingDemoUsers] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Check for demo query parameter on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') {
      setIsDemoMode(true);
    }
  }, []);

  // Fetch demo users when demo mode is enabled
  useEffect(() => {
    if (isDemoMode && !demoUsers) {
      setLoadingDemoUsers(true);
      fetch(`/api/demo/users?t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setDemoUsers(data.data);
          } else {
            // Failed to fetch demo users
            toast({
              title: language === 'fr' ? 'Erreur Demo' : 'Demo Error',
              description: language === 'fr' 
                ? 'Impossible de charger les utilisateurs de démonstration' 
                : 'Failed to load demo users',
              variant: 'destructive',
            });
          }
        })
        .catch(error => {
          // Error fetching demo users
          toast({
            title: language === 'fr' ? 'Erreur Demo' : 'Demo Error',
            description: language === 'fr' 
              ? 'Impossible de charger les utilisateurs de démonstration' 
              : 'Failed to load demo users',
            variant: 'destructive',
          });
        })
        .finally(() => {
          setLoadingDemoUsers(false);
        });
    }
  }, [isDemoMode, demoUsers, toast, language]);

  // Create dynamic demo roles from fetched users
  const getDemoRoles = () => {
    if (!demoUsers) return {};

    return {
      demo_manager: {
        displayName: language === 'fr' ? 'Gestionnaire' : 'Manager',
        description:
          language === 'fr' ? 'Gestion complète des immeubles' : 'Full building management',
        detailedDescription:
          language === 'fr'
            ? 'Accès complet à toutes les fonctionnalités de gestion immobilière, incluant la gestion des locataires, maintenance, finances et rapports.'
            : 'Complete access to all property management features, including tenant management, maintenance, finances, and reporting.',
        users: demoUsers.demo_manager.map(user => ({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          building: language === 'fr' ? 'Gestionnaire Démonstration' : 'Demo Manager',
          password: DEMO_CREDENTIALS.DEFAULT_DEMO_PASSWORD,
        })),
      },
      demo_tenant: {
        displayName: language === 'fr' ? 'Locataire' : 'Tenant',
        description: language === 'fr' ? 'Accès locataire standard' : 'Standard tenant access',
        detailedDescription:
          language === 'fr'
            ? 'Accès aux fonctionnalités essentielles pour les locataires: demandes de maintenance, documents, communications avec la gestion.'
            : 'Access to essential tenant features: maintenance requests, documents, communication with management.',
        users: demoUsers.demo_tenant.map(user => ({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          building: language === 'fr' ? 'Locataire Démonstration' : 'Demo Tenant',
          password: DEMO_CREDENTIALS.DEFAULT_DEMO_PASSWORD,
        })),
      },
      demo_resident: {
        displayName: language === 'fr' ? 'Résident' : 'Resident',
        description: language === 'fr' ? 'Accès résident propriétaire' : 'Resident owner access',
        detailedDescription:
          language === 'fr'
            ? 'Accès étendu pour les résidents propriétaires: gestion de leur unité, participation aux décisions, accès aux documents financiers.'
            : 'Extended access for resident owners: unit management, participation in decisions, access to financial documents.',
        users: demoUsers.demo_resident.map(user => ({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          building: language === 'fr' ? 'Résident Démonstration' : 'Demo Resident',
          password: DEMO_CREDENTIALS.DEFAULT_DEMO_PASSWORD,
        })),
      },
    };
  };

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleLogin = async (_data: LoginFormData) => {
    try {
      setIsLoggingIn(true);
      setLoginError('');

      const response = await login(_data.email, _data.password);

      toast({
        title: language === 'fr' ? 'Connexion réussie' : 'Login successful',
        description:
          language === 'fr'
            ? 'Vous êtes maintenant connecté(e) à Koveo Gestion'
            : 'You are now logged into Koveo Gestion',
      });

      // Note: Routing to /dashboard is handled by the auth hook
    } catch (_error: unknown) {
      /**
       * Catch function.
       * @param error - Error object.
       */
      /**
       * Catch function.
       * @param error - Error object.
       */ /**
       * Catch function.
       * @param error - Error object.
       */

      /**
       * Catch function.
       * @param error - Error object.
       */
      const errorMessage = (_error as Error).message || 'Login failed';
      setLoginError(errorMessage);

      toast({
        title: language === 'fr' ? 'Erreur de connexion' : 'Login error',
        description:
          language === 'fr'
            ? 'Identifiants invalides ou compte inactif'
            : 'Invalid credentials or inactive account',
        variant: 'destructive',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const onSubmit = (_data: LoginFormData) => {
    handleLogin(_data);
  };

  const handleDemoLogin = async (demoUserEmail: string, userName: string) => {
    try {
      setIsLoggingIn(true);
      setLoginError('');

      // Find the password for the selected user
      let password: string = DEMO_CREDENTIALS.DEFAULT_DEMO_PASSWORD; // default
      const demoRoles = getDemoRoles();
      for (const role of Object.values(demoRoles)) {
        const user = role.users?.find((u) => u.email === demoUserEmail);
        if (user) {
          password = user.password;
          break;
        }
      }

      const response = await login(demoUserEmail, password);

      toast({
        title: language === 'fr' ? 'Demo Mode Activé' : 'Demo Mode Activated',
        description:
          language === 'fr' ? `Connecté(e) en tant que ${userName}` : `Logged in as ${userName}`,
        duration: 3000,
      });
    } catch (_error: unknown) {
      const errorMessage = (_error as Error).message || 'Demo login failed';
      setLoginError(errorMessage);

      toast({
        title: language === 'fr' ? 'Erreur Demo' : 'Demo Error',
        description:
          language === 'fr' ? "Impossible d'accéder à la démonstration" : 'Unable to access demo',
        variant: 'destructive',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRoleSelect = (roleKey: string) => {
    setSelectedRole(roleKey);
    setCurrentPage(0); // Reset pagination when switching roles
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4'>
      {/* Header with Language Switcher and Home Button */}
      <div className='absolute top-4 left-4 right-4 flex justify-between items-center z-10'>
        <Button
          variant='ghost'
          size='sm'
          asChild
          className='text-gray-600 hover:text-gray-800 hover:bg-white/80 backdrop-blur-sm'
          data-testid='button-home'
        >
          <Link href='/'>
            <Home className='w-4 h-4 mr-2' />
            {language === 'fr' ? 'Accueil' : 'Home'}
          </Link>
        </Button>
        <div className='bg-white/80 backdrop-blur-sm rounded-lg p-1'>
          <LanguageSwitcher />
        </div>
      </div>
      
      <div className='w-full max-w-md space-y-6'>
        {/* Header */}
        <div className='text-center space-y-4'>
          <div className='flex items-center justify-center mb-4'>
            <img
              src={koveoLogo}
              alt='Koveo Gestion Logo'
              className='h-16 w-auto rounded-lg shadow-sm'
            />
          </div>
        </div>

        {/* Login Form */}
        <Card className='shadow-lg border-0'>
          <CardHeader className='space-y-1'>
            <CardTitle className='text-2xl text-center'>
              {language === 'fr' ? 'Connexion' : 'Sign In'}
            </CardTitle>
            <CardDescription className='text-center'>
              {language === 'fr'
                ? 'Entrez vos identifiants pour accéder à votre compte'
                : 'Enter your credentials to access your account'}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {loginError && (
              <Alert variant='destructive'>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            )}

            {/* Demo Mode Toggle */}
            <div className='flex items-center justify-between p-3 border rounded-lg bg-blue-50 dark:bg-blue-900/20'>
              <div className='flex items-center space-x-2'>
                <Eye className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                <span className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                  {language === 'fr' ? 'Mode Démonstration' : 'Demo Mode'}
                </span>
              </div>
              <Switch
                checked={isDemoMode}
                onCheckedChange={setIsDemoMode}
                data-testid='toggle-demo-mode'
              />
            </div>

            {isDemoMode ? (
              <div className='space-y-3'>
                {loadingDemoUsers ? (
                  // Loading state
                  <div className='flex items-center justify-center py-8'>
                    <Loader2 className='w-6 h-6 animate-spin text-blue-600 dark:text-blue-400' />
                    <span className='ml-2 text-sm text-gray-600 dark:text-gray-400'>
                      {language === 'fr' ? 'Chargement des utilisateurs...' : 'Loading users...'}
                    </span>
                  </div>
                ) : !selectedRole ? (
                  // Role Selection View
                  <>
                    <div className='text-center text-sm text-gray-600 dark:text-gray-400'>
                      {language === 'fr'
                        ? 'Choisissez un rôle pour tester la plateforme :'
                        : 'Choose a role to test the platform:'}
                    </div>
                    {Object.entries(getDemoRoles()).map(([roleKey, role]) => (
                      <Card
                        key={roleKey}
                        className='cursor-pointer hover:shadow-md transition-shadow border border-blue-200 hover:border-blue-300'
                        onClick={() => handleRoleSelect(roleKey)}
                        data-testid={`demo-role-${roleKey}`}
                      >
                        <CardContent className='p-4'>
                          <div className='flex items-center justify-between'>
                            <div>
                              <h3 className='font-medium text-sm'>{role.displayName}</h3>
                              <p className='text-xs text-gray-500 dark:text-gray-400'>
                                {role.description}
                              </p>
                            </div>
                            <Users className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                ) : (
                  // Role Detail View with Demo Users
                  <>
                    <div className='mb-4'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={handleBackToRoles}
                        className='text-blue-600 hover:text-blue-700'
                      >
                        ← {language === 'fr' ? 'Retour' : 'Back'}
                      </Button>
                      <h3 className='font-medium text-lg text-center mt-2'>{getDemoRoles()[selectedRole]?.displayName}</h3>
                    </div>

                    <div className='bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4'>
                      <p className='text-sm text-blue-800 dark:text-blue-200'>
                        {getDemoRoles()[selectedRole]?.detailedDescription}
                      </p>
                    </div>

                    <div className='text-center text-sm text-gray-600 dark:text-gray-400 mb-3'>
                      {language === 'fr'
                        ? 'Sélectionnez un utilisateur de démonstration :'
                        : 'Select a demo user:'}
                    </div>

                    {(() => {
                      const users = getDemoRoles()[selectedRole]?.users || [];
                      const usersPerPage = 3;
                      const totalPages = Math.ceil(users.length / usersPerPage);
                      const startIndex = currentPage * usersPerPage;
                      const endIndex = startIndex + usersPerPage;
                      const currentUsers = users.slice(startIndex, endIndex);

                      return (
                        <>
                          {currentUsers.map((user, index) => (
                            <Card
                              key={user.email}
                              className='cursor-pointer hover:shadow-md transition-shadow border border-green-200 hover:border-green-300'
                              onClick={() => handleDemoLogin(user.email, user.name)}
                              data-testid={`demo-user-${selectedRole}-${startIndex + index}`}
                            >
                              <CardContent className='p-4'>
                                <div className='flex items-center justify-between'>
                                  <div>
                                    <h4 className='font-medium text-sm'>{user.name}</h4>
                                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                                      {user.building}
                                    </p>
                                    <p className='text-xs text-green-600 dark:text-green-400 mt-1'>
                                      {user.email}
                                    </p>
                                  </div>
                                  <Building className='w-4 h-4 text-green-600 dark:text-green-400' />
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          
                          {totalPages > 1 && (
                            <div className='flex items-center justify-between pt-2'>
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                                disabled={currentPage === 0}
                                className='text-xs'
                              >
                                ← {language === 'fr' ? 'Précédent' : 'Previous'}
                              </Button>
                              
                              <span className='text-xs text-gray-500'>
                                {language === 'fr' 
                                  ? `Page ${currentPage + 1} de ${totalPages}`
                                  : `Page ${currentPage + 1} of ${totalPages}`
                                }
                              </span>
                              
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                                disabled={currentPage === totalPages - 1}
                                className='text-xs'
                              >
                                {language === 'fr' ? 'Suivant' : 'Next'} →
                              </Button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}

                <div className='text-xs text-center text-amber-600 dark:text-amber-400 px-2'>
                  <AlertCircle className='w-3 h-3 inline mr-1' />
                  {language === 'fr'
                    ? 'Mode lecture seule - aucune modification possible'
                    : 'Read-only mode - no modifications allowed'}
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
                  <StandardFormField
                    control={form.control}
                    name='email'
                    label={language === 'fr' ? 'Adresse courriel' : 'Email Address'}
                    type='email'
                    placeholder={language === 'fr' ? 'votre@email.com' : 'your@email.com'}
                    disabled={isLoggingIn}
                    className='h-11'
                    data-testid='input-email'
                    autoComplete='username'
                    formName='login'
                  />

                  <FormField
                    control={form.control}
                    name='password'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'fr' ? 'Mot de passe' : 'Password'}</FormLabel>
                        <FormControl>
                          <div className='relative'>
                            <Input
                              {...field}
                              type={showPassword ? 'text' : 'password'}
                              placeholder={
                                language === 'fr' ? 'Votre mot de passe' : 'Your password'
                              }
                              disabled={isLoggingIn}
                              className='h-11 pr-10'
                              data-testid='input-password'
                              autoComplete='current-password'
                            />
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                              onClick={() => setShowPassword(!showPassword)}
                              disabled={isLoggingIn}
                              data-testid='button-toggle-password'
                            >
                              {showPassword ? (
                                <EyeOff className='h-4 w-4 text-gray-400' />
                              ) : (
                                <Eye className='h-4 w-4 text-gray-400' />
                              )}
                              <span className='sr-only'>
                                {showPassword
                                  ? language === 'fr'
                                    ? 'Masquer le mot de passe'
                                    : 'Hide password'
                                  : language === 'fr'
                                    ? 'Afficher le mot de passe'
                                    : 'Show password'}
                              </span>
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type='submit' className='w-full h-11' disabled={isLoggingIn}>
                    {isLoggingIn
                      ? language === 'fr'
                        ? 'Connexion...'
                        : 'Signing in...'
                      : language === 'fr'
                        ? 'Se connecter'
                        : 'Sign In'}
                  </Button>

                  <div className='text-center'>
                    <Button variant='link' asChild className='text-sm'>
                      <Link href='/forgot-password'>
                        {language === 'fr' ? 'Mot de passe oublié ?' : 'Forgot your password?'}
                      </Link>
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        {/* Quebec Compliance Notice */}
        <Card className='border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800'>
          <CardContent className='pt-6'>
            <div className='flex items-start space-x-3'>
              <Shield className='w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5' />
              <div className='text-sm text-blue-800 dark:text-blue-200'>
                <p className='font-medium mb-1'>
                  {language === 'fr' ? 'Confidentialité & Sécurité' : 'Privacy & Security'}
                </p>
                <p>
                  {language === 'fr'
                    ? 'Conforme à la Loi 25 du Québec. Vos données sont protégées selon les normes de sécurité les plus strictes.'
                    : 'Quebec Law 25 compliant. Your data is protected according to the strictest security standards.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className='text-center text-sm text-gray-500 dark:text-gray-400'>
          <p>
            {language === 'fr'
              ? '© 2025 Koveo Gestion. Tous droits réservés.'
              : '© 2025 Koveo Gestion. All rights reserved.'}
          </p>
        </div>
      </div>
    </div>
  );
}
