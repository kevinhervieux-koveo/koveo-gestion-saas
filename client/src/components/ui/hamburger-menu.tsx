import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import {
  X,
  Menu,
  Home,
  Wrench,
  Shield,
  BookOpen,
  FileText,
  Scale,
  LogOut,
  User,
  Settings,
  Globe,
  UserPlus,
  DollarSign,
  Building2,
} from 'lucide-react';

interface HamburgerMenuProps {
  className?: string;
}

export function HamburgerMenu({ className = '' }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();

  const handleNavigation = (path: string) => {
    setLocation(path);
    setIsOpen(false);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      setIsOpen(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const publicNavItems = [
    { icon: Home, label: t('home'), path: '/', testId: 'nav-home' },
    { icon: Wrench, label: t('features'), path: '/features', testId: 'nav-features' },
    { icon: DollarSign, label: t('pricing'), path: '/pricing', testId: 'nav-pricing' },
    { icon: Building2, label: t('enterprise'), path: '/enterprise', testId: 'nav-enterprise' },
    { icon: Shield, label: t('security'), path: '/security', testId: 'nav-security' },
    { icon: BookOpen, label: t('ourStory'), path: '/story', testId: 'nav-story' },
    { icon: FileText, label: t('privacyPolicy'), path: '/privacy-policy', testId: 'nav-privacy' },
    { icon: Scale, label: t('termsOfService'), path: '/terms-of-service', testId: 'nav-terms' },
  ];

  return (
    <div className={`relative ${className}`}>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='relative'
            data-testid='hamburger-button'
            aria-label={isOpen ? t('closeMenu') : t('openMenu')}
          >
            {isOpen ? <X className='h-6 w-6' /> : <Menu className='h-6 w-6' />}
          </Button>
        </SheetTrigger>
        <SheetContent side='right' className='w-80 max-w-[80vw] bg-gray-50 p-0'>
          <div className='p-6 flex flex-col h-full overflow-y-auto'>
            <SheetHeader className='mb-8'>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>

            <nav className='flex-1'>
              <ul className='space-y-2'>
                {publicNavItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <li key={item.path}>
                      <Button
                        variant='ghost'
                        className='w-full justify-start h-12 bg-transparent hover:bg-gray-100'
                        onClick={() => handleNavigation(item.path)}
                        data-testid={item.testId}
                      >
                        <IconComponent className='mr-3 h-5 w-5' />
                        {item.label}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {!user && (
              <div className='mt-auto border-t border-gray-300 pt-4 space-y-3'>
                <div className='flex items-center justify-center space-x-2'>
                  <Globe className='h-4 w-4 text-gray-500' />
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-sm'
                    onClick={() => {
                      toggleLanguage();
                      setIsOpen(false);
                    }}
                    data-testid='language-toggle'
                  >
                    {language === 'en' ? 'Français' : 'English'}
                  </Button>
                </div>

                <div className='space-y-2'>
                  <Button
                    variant='default'
                    className='w-full'
                    onClick={() => handleNavigation('/login')}
                    data-testid='nav-login'
                  >
                    <UserPlus className='mr-2 h-4 w-4' />
                    {t('login')}
                  </Button>
                </div>
              </div>
            )}

            {user && (
              <div className='mt-auto border-t pt-4'>
                <div className='flex items-center mb-4 p-3 bg-gray-100 rounded-lg'>
                  <User className='h-8 w-8 text-gray-500 mr-3' />
                  <div>
                    <p className='font-medium text-sm'>
                      {`${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                        (user as any).username ||
                        user.email ||
                        'User'}
                    </p>
                    <p className='text-xs text-gray-500'>{user.email}</p>
                  </div>
                </div>

                <div className='space-y-1'>
                  <Button
                    variant='ghost'
                    className='w-full justify-start h-10'
                    onClick={() => handleNavigation('/settings')}
                    data-testid='nav-profile'
                  >
                    <Settings className='mr-3 h-4 w-4' />
                    {t('profileSettings')}
                  </Button>

                  <Button
                    variant='ghost'
                    className='w-full justify-start h-10 text-red-600 hover:text-red-700 hover:bg-red-50'
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    data-testid='nav-logout'
                  >
                    {isLoggingOut ? (
                      <>
                        <div className='mr-3 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
                        Logging out...
                      </>
                    ) : (
                      <>
                        <LogOut className='mr-3 h-4 w-4' />
                        Logout
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
