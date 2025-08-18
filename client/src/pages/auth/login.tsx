import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertCircle, Shield, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { colors, typography } from '@/styles/inline-styles';

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
  const [showPassword, setShowPassword] = useState(false);

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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      fontFamily: typography.fontFamily
    }}>
      {/* Floating particles background effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        animation: 'float 20s ease-in-out infinite'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '420px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Logo and Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              background: colors.white,
              borderRadius: '1rem',
              padding: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img 
                src="/assets/koveo-logo-full.jpg"
                alt="Koveo Gestion Logo" 
                style={{
                  height: '48px',
                  width: 'auto',
                  display: 'block'
                }}
                onError={(e) => {
                  // Fallback to K logo if main logo fails to load
                  const target = e.currentTarget as HTMLImageElement;
                  target.src = '/assets/koveo-logo-k.jpg';
                  target.style.width = '48px';
                  target.onerror = () => {
                    // Final fallback to styled K
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = `
                      <div style="
                        width: 48px; 
                        height: 48px; 
                        background: ${colors.primary}; 
                        border-radius: 8px; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        font-weight: bold; 
                        color: white; 
                        font-size: 24px;
                      ">K</div>
                    `;
                  };
                }}
              />
            </div>
          </div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: colors.white,
            marginBottom: '0.5rem',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}>
            {language === 'fr' ? 'Bienvenue' : 'Welcome'}
          </h1>
          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.9)',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
          }}>
            {language === 'fr' 
              ? 'Accédez à votre plateforme de gestion immobilière'
              : 'Access your property management platform'
            }
          </p>
        </div>

        {/* Login Form Card */}
        <div style={{
          background: colors.white,
          borderRadius: '1rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}>
          {/* Card Header */}
          <div style={{
            padding: '2rem 2rem 1rem 2rem',
            textAlign: 'center',
            borderBottom: `1px solid ${colors.gray[100]}`
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: colors.gray[900],
              marginBottom: '0.5rem'
            }}>
              {language === 'fr' ? 'Connexion' : 'Sign In'}
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: colors.gray[600]
            }}>
              {language === 'fr' 
                ? 'Entrez vos identifiants pour continuer'
                : 'Enter your credentials to continue'
              }
            </p>
          </div>

          {/* Card Content */}
          <div style={{
            padding: '2rem'
          }}>
            {loginError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: colors.dangerLight,
                border: `1px solid ${colors.danger}`,
                borderRadius: '0.5rem',
                marginBottom: '1.5rem'
              }}>
                <AlertCircle style={{
                  width: '16px',
                  height: '16px',
                  color: colors.danger
                }} />
                <span style={{
                  fontSize: '0.875rem',
                  color: colors.danger,
                  fontWeight: '500'
                }}>
                  {loginError}
                </span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
              }}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: colors.gray[700],
                        marginBottom: '0.5rem'
                      }}>
                        {language === 'fr' ? 'Adresse courriel' : 'Email Address'}
                      </FormLabel>
                      <FormControl>
                        <div style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <Mail style={{
                            position: 'absolute',
                            left: '0.75rem',
                            width: '18px',
                            height: '18px',
                            color: colors.gray[400],
                            zIndex: 1
                          }} />
                          <Input
                            {...field}
                            type="email"
                            placeholder={language === 'fr' ? 'votre@email.com' : 'your@email.com'}
                            disabled={isLoggingIn}
                            style={{
                              height: '48px',
                              paddingLeft: '2.5rem',
                              border: `2px solid ${colors.gray[200]}`,
                              borderRadius: '0.5rem',
                              fontSize: '1rem',
                              transition: 'all 0.2s ease',
                              background: colors.white
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = colors.primary;
                              e.target.style.boxShadow = `0 0 0 3px ${colors.primary}20`;
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = colors.gray[200];
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>
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
                      <FormLabel style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: colors.gray[700],
                        marginBottom: '0.5rem'
                      }}>
                        {language === 'fr' ? 'Mot de passe' : 'Password'}
                      </FormLabel>
                      <FormControl>
                        <div style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <Lock style={{
                            position: 'absolute',
                            left: '0.75rem',
                            width: '18px',
                            height: '18px',
                            color: colors.gray[400],
                            zIndex: 1
                          }} />
                          <Input
                            {...field}
                            type={showPassword ? 'text' : 'password'}
                            placeholder={language === 'fr' ? 'Votre mot de passe' : 'Your password'}
                            disabled={isLoggingIn}
                            style={{
                              height: '48px',
                              paddingLeft: '2.5rem',
                              paddingRight: '2.5rem',
                              border: `2px solid ${colors.gray[200]}`,
                              borderRadius: '0.5rem',
                              fontSize: '1rem',
                              transition: 'all 0.2s ease',
                              background: colors.white
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = colors.primary;
                              e.target.style.boxShadow = `0 0 0 3px ${colors.primary}20`;
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = colors.gray[200];
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                              position: 'absolute',
                              right: '0.75rem',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {showPassword ? (
                              <EyeOff style={{
                                width: '18px',
                                height: '18px',
                                color: colors.gray[400]
                              }} />
                            ) : (
                              <Eye style={{
                                width: '18px',
                                height: '18px',
                                color: colors.gray[400]
                              }} />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  style={{
                    width: '100%',
                    height: '48px',
                    background: isLoggingIn ? colors.gray[400] : colors.primary,
                    color: colors.white,
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoggingIn) {
                      e.currentTarget.style.background = colors.primaryDark;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(59, 130, 246, 0.49)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoggingIn) {
                      e.currentTarget.style.background = colors.primary;
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(59, 130, 246, 0.39)';
                    }
                  }}
                >
                  {isLoggingIn ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTop: '2px solid currentColor',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      {language === 'fr' ? 'Connexion...' : 'Signing in...'}
                    </div>
                  ) : (
                    language === 'fr' ? 'Se connecter' : 'Sign In'
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>

        {/* Quebec Compliance Notice */}
        <div style={{
          marginTop: '1.5rem',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '0.75rem',
          padding: '1rem',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            <Shield style={{
              width: '20px',
              height: '20px',
              color: 'rgba(255, 255, 255, 0.9)',
              marginTop: '2px',
              flexShrink: 0
            }} />
            <div>
              <p style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: colors.white,
                marginBottom: '0.25rem'
              }}>
                {language === 'fr' ? 'Confidentialité & Sécurité' : 'Privacy & Security'}
              </p>
              <p style={{
                fontSize: '0.8rem',
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: '1.4'
              }}>
                {language === 'fr' 
                  ? 'Conforme à la Loi 25 du Québec. Vos données sont protégées selon les normes de sécurité les plus strictes.'
                  : 'Quebec Law 25 compliant. Your data is protected according to the strictest security standards.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '1.5rem'
        }}>
          <p style={{
            fontSize: '0.8rem',
            color: 'rgba(255, 255, 255, 0.7)'
          }}>
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