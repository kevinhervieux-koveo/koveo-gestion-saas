import { Button } from '@/components/ui/button';
import { HamburgerMenu } from '@/components/ui/hamburger-menu';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { LogIn, User } from 'lucide-react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import koveoLogo from '@/assets/koveo-logo.jpg';

/**
 * Common top navigation bar component used across all pages
 * Provides consistent navigation with logo, language switcher, user menu, and authentication controls
 */
export function TopNavigationBar() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { isAuthenticated, user } = useAuth();

  return (
    <header className='border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50'>
      <div className='container mx-auto px-4 py-4 flex items-center justify-between'>
        {/* Logo */}
        <div className='flex items-center'>
          <img
            src={koveoLogo}
            alt='Koveo Gestion'
            className='koveo-logo h-12 w-12 sm:h-14 sm:w-14 rounded-lg object-cover cursor-pointer shadow-sm hover:shadow-md transition-shadow'
            onClick={() => setLocation('/')}
            data-testid='logo-link'
          />
        </div>

        {/* Navigation Controls */}
        <div className='flex items-center gap-4'>
          {/* Hamburger Menu */}
          <HamburgerMenu />
          
          {/* Language Switcher */}
          <div className='hidden sm:block'>
            <LanguageSwitcher />
          </div>
          
          {/* Authentication Controls */}
          {isAuthenticated ? (
            /* User Menu - when authenticated */
            <div className='flex items-center gap-3'>
              {/* User Avatar/Initials */}
              <div
                className='h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-medium cursor-pointer hover:bg-slate-600 transition-colors'
                onClick={() => setLocation('/dashboard/quick-actions')}
                data-testid='user-avatar'
              >
                {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 
                 user?.email ? user.email.charAt(0).toUpperCase() : 
                 <User className='w-5 h-5' />}
              </div>
              
              {/* Dashboard Button - Desktop */}
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setLocation('/dashboard/quick-actions')}
                className='hidden md:flex items-center gap-2 text-gray-600 hover:text-gray-800'
                data-testid='dashboard-button'
              >
                {t('dashboard') || 'Dashboard'}
              </Button>
            </div>
          ) : (
            /* Login Button - when not authenticated */
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setLocation('/login')}
              className='hidden sm:flex items-center gap-2 text-gray-600 hover:text-gray-800'
              data-testid='header-login-button'
            >
              <LogIn className='w-4 h-4' />
              {language === 'fr' ? 'Connexion' : 'Login'}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}