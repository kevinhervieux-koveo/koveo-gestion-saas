import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Sidebar } from '@/components/layout/sidebar';
import { TestProviders } from '../../test-utils/providers';
import { useAuth } from '@/hooks/use-auth';
import { useMobileMenu } from '@/hooks/use-mobile-menu';
import { useLanguage } from '@/hooks/use-language';

// Mock hooks
jest.mock('@/hooks/use-auth');
jest.mock('@/hooks/use-mobile-menu');
jest.mock('@/hooks/use-language');
jest.mock('wouter', () => ({
  useLocation: () => ['/dashboard'],
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseMobileMenu = useMobileMenu as jest.MockedFunction<typeof useMobileMenu>;
const mockUseLanguage = useLanguage as jest.MockedFunction<typeof useLanguage>;

describe('Sidebar Component', () => {
  const mockCloseMobileMenu = jest.fn();
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseMobileMenu.mockReturnValue({
      isMobileMenuOpen: false,
      closeMobileMenu: mockCloseMobileMenu,
      toggleMobileMenu: jest.fn(),
    });

    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        username: 'john.doe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'hashedpassword',
        phone: '',
        profileImage: '',
        language: 'en',
        role: 'admin',
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      logout: mockLogout,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
    });

    mockUseLanguage.mockReturnValue({
      language: 'en',
      currentLanguage: 'en',
      setLanguage: jest.fn(),
      t: jest.fn((key: string) => key),
    });
  });

  describe('Basic Rendering', () => {
    it('renders sidebar with logo', () => {
      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      expect(screen.getByAltText('Koveo Gestion')).toBeInTheDocument();
    });

    it('displays user information', () => {
      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    it('shows logout button', () => {
      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      expect(screen.getByText('Logout')).toBeInTheDocument();
    });
  });

  describe('Language Translation', () => {
    it('displays French translations when language is French', () => {
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: jest.fn(),
        t: { language: 'fr' },
        translations: {},
      });

      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      expect(screen.getByText('Déconnexion')).toBeInTheDocument();
    });

    it('displays English translations when language is English', () => {
      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('translates section names correctly', () => {
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: jest.fn(),
        t: { language: 'fr' },
        translations: {},
      });

      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      // Check for French section names
      expect(screen.getByText('Administration')).toBeInTheDocument();
      expect(screen.getByText('Paramètres')).toBeInTheDocument();
    });
  });

  describe('Navigation Menu Functionality', () => {
    it('expands menu sections when clicked', async () => {
      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      const adminSection = screen.getByText('Admin');
      fireEvent.click(adminSection);

      await waitFor(() => {
        expect(screen.getByText('Organizations')).toBeInTheDocument();
      });
    });

    it('collapses expanded menu sections when clicked again', async () => {
      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      const adminSection = screen.getByText('Admin');

      // Expand
      fireEvent.click(adminSection);
      await waitFor(() => {
        expect(screen.getByText('Organizations')).toBeInTheDocument();
      });

      // Collapse
      fireEvent.click(adminSection);
      await waitFor(() => {
        expect(screen.queryByText('Organizations')).not.toBeInTheDocument();
      });
    });
  });

  describe('Mobile Menu Functionality', () => {
    it('shows mobile close button when mobile menu is open', () => {
      mockUseMobileMenu.mockReturnValue({
        isMobileMenuOpen: true,
        closeMobileMenu: mockCloseMobileMenu,
        openMobileMenu: jest.fn(),
        toggleMobileMenu: jest.fn(),
      });

      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      const closeButton = screen.getByLabelText('Close navigation menu');
      expect(closeButton).toBeInTheDocument();
    });

    it('calls closeMobileMenu when navigation item is clicked', () => {
      mockUseMobileMenu.mockReturnValue({
        isMobileMenuOpen: true,
        closeMobileMenu: mockCloseMobileMenu,
        openMobileMenu: jest.fn(),
        toggleMobileMenu: jest.fn(),
      });

      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      const logo = screen.getByAltText('Koveo Gestion');
      fireEvent.click(logo.closest('a')!);

      expect(mockCloseMobileMenu).toHaveBeenCalled();
    });
  });

  describe('Role-Based Navigation', () => {
    it('shows admin-specific navigation items for admin users', () => {
      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      const adminSection = screen.getByText('Admin');
      fireEvent.click(adminSection);

      expect(screen.getByText('Organizations')).toBeInTheDocument();
      expect(screen.getByText('RBAC Permissions')).toBeInTheDocument();
    });

    it('shows resident-specific navigation for resident users', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          firstName: 'Jane',
          lastName: 'Resident',
          email: 'jane@example.com',
          role: 'resident',
          isActive: true,
          organizationId: 'org-1',
        },
        logout: mockLogout,
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
      });

      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      expect(screen.getByText('Residents')).toBeInTheDocument();
    });
  });

  describe('Logout Functionality', () => {
    it('calls logout function when logout button is clicked', async () => {
      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });

    it('handles logout errors gracefully', async () => {
      mockLogout.mockRejectedValue(new Error('Logout failed'));
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' };

      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });

      window.location = originalLocation;
    });
  });

  describe('Accessibility', () => {
    it('supports keyboard navigation', () => {
      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      const adminSection = screen.getByText('Admin');
      adminSection.focus();

      fireEvent.keyDown(adminSection, { _key: 'Enter' });

      expect(screen.getByText('Organizations')).toBeInTheDocument();
    });

    it('has proper ARIA labels', () => {
      mockUseMobileMenu.mockReturnValue({
        isMobileMenuOpen: true,
        closeMobileMenu: mockCloseMobileMenu,
        openMobileMenu: jest.fn(),
        toggleMobileMenu: jest.fn(),
      });

      render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      expect(screen.getByLabelText('Close navigation menu')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('applies correct CSS classes for mobile menu state', () => {
      mockUseMobileMenu.mockReturnValue({
        isMobileMenuOpen: true,
        closeMobileMenu: mockCloseMobileMenu,
        openMobileMenu: jest.fn(),
        toggleMobileMenu: jest.fn(),
      });

      const { container } = render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar).toHaveClass('translate-x-0');
    });

    it('shows backdrop when mobile menu is open', () => {
      mockUseMobileMenu.mockReturnValue({
        isMobileMenuOpen: true,
        closeMobileMenu: mockCloseMobileMenu,
        openMobileMenu: jest.fn(),
        toggleMobileMenu: jest.fn(),
      });

      const { container } = render(
        <TestProviders>
          <Sidebar />
        </TestProviders>
      );

      const backdrop = container.querySelector('.bg-black.bg-opacity-50');
      expect(backdrop).toBeInTheDocument();
    });
  });
});
