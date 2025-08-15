import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoadingSpinner } from '../../client/src/components/ui/loading-spinner';
import { LanguageProvider } from '../../client/src/hooks/use-language';

// Mock wouter for routing components
jest.mock('wouter', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useLocation: () => ['/test', jest.fn()],
  Switch: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Route: ({ component: Component }: { component: React.ComponentType }) => <Component />,
}));

// Mock icons
jest.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader-icon">Loading...</div>,
  Building: () => <div data-testid="building-icon">Building</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
  Home: () => <div data-testid="home-icon">Home</div>,
  Settings: () => <div data-testid="settings-icon">Settings</div>,
  FileText: () => <div data-testid="file-icon">File</div>,
  Menu: () => <div data-testid="menu-icon">Menu</div>,
}));

describe('Component Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  describe('LoadingSpinner', () => {
    it('should render loading spinner', () => {
      render(<LoadingSpinner />);
      
      expect(screen.getByTestId('loader-icon')).toBeDefined();
      expect(screen.getByText('Loading...')).toBeDefined();
    });

    it('should have correct styling classes', () => {
      render(<LoadingSpinner />);
      
      const container = screen.getByText('Loading...').closest('div');
      expect(container?.className).toContain('flex');
    });
  });

  describe('LanguageProvider', () => {
    it('should provide language context', () => {
      const TestComponent = () => {
        const { useLanguage } = require('../../client/src/hooks/use-language');
        const { t, currentLanguage } = useLanguage();
        return (
          <div>
            <span data-testid="language">{currentLanguage}</span>
            <span data-testid="greeting">{t('welcome')}</span>
          </div>
        );
      };

      render(
        <LanguageProvider>
          <TestComponent />
        </LanguageProvider>
      );

      expect(screen.getByTestId('language')).toHaveTextContent('fr');
    });
  });

  describe('QueryClient Integration', () => {
    it('should provide query client to children', () => {
      const TestComponent = () => {
        const { useQueryClient } = require('@tanstack/react-query');
        const client = useQueryClient();
        return <div data-testid="has-client">{client ? 'true' : 'false'}</div>;
      };

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      expect(screen.getByTestId('has-client')).toHaveTextContent('true');
    });
  });
});