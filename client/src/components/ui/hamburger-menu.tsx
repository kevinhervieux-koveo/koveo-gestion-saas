import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { TrialRequestForm } from '@/components/ui/trial-request-form';
import { Menu, X, Home, Shield, Wrench, BookOpen, FileText, Scale, LogIn, LogOut, LayoutDashboard } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';

interface HamburgerMenuProps {
  className?: string;
}

export function HamburgerMenu({ className = '' }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { t } = useLanguage();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const navigate = (path: string) => {
    setLocation(path);
    closeMenu();
  };

  const handleLogout = () => {
    logout();
    closeMenu();
  };

  // Navigation items for public pages
  const publicNavItems = [
    { icon: Home, label: 'Accueil', path: '/', testId: 'nav-home' },
    { icon: Wrench, label: 'Fonctionnalités', path: '/features', testId: 'nav-features' },
    { icon: Shield, label: 'Sécurité', path: '/security', testId: 'nav-security' },
    { icon: BookOpen, label: 'Notre histoire', path: '/story', testId: 'nav-story' },
    { icon: FileText, label: 'Politique de confidentialité', path: '/privacy-policy', testId: 'nav-privacy' },
    { icon: Scale, label: 'Conditions d\'utilisation', path: '/terms-of-service', testId: 'nav-terms' },
  ];

  return (
    <div className={`relative ${className}`}>
      {/* Hamburger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMenu}
        className="relative z-50"
        data-testid="hamburger-button"
        aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeMenu}
          data-testid="menu-overlay"
        />
      )}

      {/* Menu Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        data-testid="menu-panel"
      >
        {/* Menu Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeMenu}
            data-testid="close-menu-button"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Menu Content */}
        <div className="flex flex-col h-full">
          {/* Navigation Items */}
          <nav className="flex-1 p-4 space-y-2">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider px-3 py-2">
                Navigation
              </h3>
              {publicNavItems.map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  className="w-full justify-start text-left h-auto py-3 px-3"
                  onClick={() => navigate(item.path)}
                  data-testid={item.testId}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  <span>{item.label}</span>
                </Button>
              ))}
            </div>

            {/* Authentication Section */}
            <div className="pt-4 border-t space-y-1">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider px-3 py-2">
                Compte
              </h3>
              {isAuthenticated ? (
                <>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left h-auto py-3 px-3"
                    onClick={() => navigate('/dashboard')}
                    data-testid="nav-dashboard"
                  >
                    <LayoutDashboard className="mr-3 h-5 w-5" />
                    <span>Tableau de bord</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left h-auto py-3 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleLogout}
                    data-testid="nav-logout"
                  >
                    <LogOut className="mr-3 h-5 w-5" />
                    <span>Déconnexion</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left h-auto py-3 px-3"
                    onClick={() => navigate('/login')}
                    data-testid="nav-login"
                  >
                    <LogIn className="mr-3 h-5 w-5" />
                    <span>Se connecter</span>
                  </Button>
                  <TrialRequestForm>
                    <Button
                      className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white mt-2"
                      data-testid="nav-get-started"
                    >
                      <LogIn className="mr-3 h-5 w-5" />
                      <span>Commencer</span>
                    </Button>
                  </TrialRequestForm>
                </>
              )}
            </div>
          </nav>

          {/* Menu Footer */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Langue</span>
              <LanguageSwitcher />
            </div>
            <div className="mt-3 text-xs text-gray-500 text-center">
              © 2025 Koveo Gestion
              <br />
              Conforme à la Loi 25 du Québec
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}