/**
 * Expanded Mobile UI Test Coverage for Quebec Property Management.
 * 
 * Comprehensive mobile testing covering responsiveness, touch interactions,
 * accessibility, and Quebec-specific mobile requirements.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'wouter/memory';
import { LanguageProvider } from '@/hooks/use-language';

// Import components for mobile testing
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import OwnerDashboard from '@/pages/owner/dashboard';
import ManagerBuildings from '@/pages/manager/buildings';
import ResidentsDemands from '@/pages/residents/demands';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';

// Mobile viewport configurations
const MOBILE_VIEWPORTS = {
  phone: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  largeMobile: { width: 414, height: 896 },
  smallMobile: { width: 320, height: 568 }
};

// Mock global functions for mobile testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock touch events
const mockTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
  return new TouchEvent(type, {
    touches: touches.map(touch => ({
      ...touch,
      identifier: 0,
      target: document.body,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1
    })) as any
  });
};

describe('Expanded Mobile UI Coverage', () => {
  let queryClient: QueryClient;
  let user: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    user = userEvent.setup();
  });

  const renderWithProviders = (Component: React.ComponentType<any>, props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <LanguageProvider>
            <Component {...props} />
          </LanguageProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  const setMobileViewport = (viewport: keyof typeof MOBILE_VIEWPORTS) => {
    const { width, height } = MOBILE_VIEWPORTS[viewport];
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height });
    window.dispatchEvent(new Event('resize'));
  };

  describe('Responsive Layout Testing', () => {
    test('Sidebar collapses properly on mobile viewports', async () => {
      setMobileViewport('phone');
      renderWithProviders(Sidebar);

      // Check if sidebar is collapsed on mobile
      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('w-64'); // Default width, should adapt

      // Test mobile menu toggle
      const menuButton = screen.getByRole('button', { name: /menu/i });
      await user.click(menuButton);

      await waitFor(() => {
        expect(sidebar).toHaveClass('mobile-expanded');
      });
    });

    test('Header adapts to mobile viewports with Quebec branding', async () => {
      setMobileViewport('phone');
      renderWithProviders(Header);

      // Check Quebec branding visibility
      expect(screen.getByText(/Koveo Gestion/i)).toBeInTheDocument();
      
      // Test mobile navigation
      const mobileNav = screen.getByRole('navigation');
      expect(mobileNav).toHaveClass('mobile-responsive');

      // Test language switcher in mobile
      const languageButton = screen.getByRole('button', { name: /français/i });
      expect(languageButton).toBeVisible();
    });

    test('Dashboard cards stack properly on mobile', async () => {
      setMobileViewport('phone');
      renderWithProviders(OwnerDashboard);

      const cards = screen.getAllByTestId('dashboard-card');
      cards.forEach(card => {
        expect(card).toHaveClass('w-full'); // Full width on mobile
      });

      // Test scroll behavior
      fireEvent.scroll(window, { target: { scrollY: 100 } });
      expect(window.scrollY).toBe(100);
    });

    test('Forms adapt to mobile input methods', async () => {
      setMobileViewport('phone');
      renderWithProviders(ResidentsDemands);

      const titleInput = screen.getByLabelText(/titre/i);
      expect(titleInput).toHaveAttribute('type', 'text');
      
      // Test mobile keyboard appearance
      await user.click(titleInput);
      expect(titleInput).toHaveFocus();

      // Test Quebec French virtual keyboard support
      await user.type(titleInput, 'Problème de chauffage - unité 3A');
      expect(titleInput).toHaveValue('Problème de chauffage - unité 3A');
    });
  });

  describe('Touch Interaction Testing', () => {
    test('Touch gestures work on interactive elements', async () => {
      setMobileViewport('phone');
      renderWithProviders(Button, { children: 'Test Button' });

      const button = screen.getByRole('button');
      
      // Test touch start/end
      fireEvent.touchStart(button, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      fireEvent.touchEnd(button, {
        changedTouches: [{ clientX: 100, clientY: 100 }]
      });

      expect(button).toHaveClass('active'); // Touch feedback
    });

    test('Swipe gestures work on cards and lists', async () => {
      setMobileViewport('phone');
      renderWithProviders(ManagerBuildings);

      const buildingCard = screen.getByTestId('building-card');
      
      // Simulate swipe right
      fireEvent.touchStart(buildingCard, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      fireEvent.touchMove(buildingCard, {
        touches: [{ clientX: 200, clientY: 100 }]
      });
      fireEvent.touchEnd(buildingCard, {
        changedTouches: [{ clientX: 200, clientY: 100 }]
      });

      // Check if swipe action was triggered
      await waitFor(() => {
        expect(screen.getByText(/actions disponibles/i)).toBeInTheDocument();
      });
    });

    test('Pinch-to-zoom works on Quebec building floor plans', async () => {
      setMobileViewport('tablet');
      renderWithProviders(ManagerBuildings);

      const floorPlan = screen.getByTestId('floor-plan');
      
      // Simulate pinch gesture
      fireEvent.touchStart(floorPlan, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ]
      });
      fireEvent.touchMove(floorPlan, {
        touches: [
          { clientX: 80, clientY: 80 },
          { clientX: 220, clientY: 220 }
        ]
      });

      expect(floorPlan).toHaveStyle('transform: scale(1.2)');
    });

    test('Long press context menus work on mobile', async () => {
      setMobileViewport('phone');
      renderWithProviders(ResidentsDemands);

      const demandItem = screen.getByTestId('demand-item');
      
      // Simulate long press
      fireEvent.touchStart(demandItem, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      
      // Wait for long press duration
      await new Promise(resolve => setTimeout(resolve, 800));
      
      fireEvent.touchEnd(demandItem, {
        changedTouches: [{ clientX: 100, clientY: 100 }]
      });

      await waitFor(() => {
        expect(screen.getByText(/options/i)).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Accessibility Testing', () => {
    test('Screen reader navigation works on mobile', async () => {
      setMobileViewport('phone');
      renderWithProviders(OwnerDashboard);

      // Test focus management
      const firstFocusable = screen.getByRole('button', { name: /menu/i });
      firstFocusable.focus();
      expect(firstFocusable).toHaveFocus();

      // Test keyboard navigation
      fireEvent.keyDown(firstFocusable, { key: 'Tab' });
      const nextFocusable = document.activeElement;
      expect(nextFocusable).not.toBe(firstFocusable);
    });

    test('Quebec French voice-over compatibility', async () => {
      setMobileViewport('phone');
      renderWithProviders(ResidentsDemands);

      // Test Quebec French ARIA labels
      const submitButton = screen.getByRole('button', { name: /soumettre la demande/i });
      expect(submitButton).toHaveAttribute('aria-label', 'Soumettre la demande de maintenance');

      // Test Quebec French form labels
      const prioritySelect = screen.getByLabelText(/priorité de la demande/i);
      expect(prioritySelect).toHaveAttribute('aria-describedby');
    });

    test('High contrast mode works on mobile Quebec interface', async () => {
      setMobileViewport('phone');
      
      // Mock high contrast media query
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      }));

      renderWithProviders(OwnerDashboard);

      const dashboard = screen.getByRole('main');
      expect(dashboard).toHaveClass('high-contrast');
    });

    test('Large text scaling preserves Quebec layout', async () => {
      setMobileViewport('phone');
      
      // Mock large text preference
      document.body.style.fontSize = '1.5rem';
      
      renderWithProviders(Sidebar);

      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('large-text-optimized');

      // Test Quebec text doesn't overflow
      const quebecTitle = screen.getByText(/Koveo Gestion/i);
      const rect = quebecTitle.getBoundingClientRect();
      expect(rect.width).toBeLessThan(window.innerWidth);
    });
  });

  describe('Quebec Mobile Performance Testing', () => {
    test('Quebec French text rendering performance on mobile', async () => {
      setMobileViewport('phone');
      
      const startTime = performance.now();
      renderWithProviders(ManagerBuildings);
      
      await waitFor(() => {
        expect(screen.getByText(/Immeubles/i)).toBeInTheDocument();
      });
      
      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(1000); // Should render Quebec text within 1 second
    });

    test('Mobile image optimization for Quebec property photos', async () => {
      setMobileViewport('phone');
      renderWithProviders(ManagerBuildings);

      const propertyImages = screen.getAllByRole('img');
      propertyImages.forEach(img => {
        expect(img).toHaveAttribute('loading', 'lazy');
        expect(img).toHaveAttribute('sizes'); // Responsive image sizes
      });
    });

    test('Quebec compliance data loading performance on mobile', async () => {
      setMobileViewport('phone');
      
      // Mock heavy compliance data
      const mockData = Array(100).fill(null).map((_, i) => ({
        id: i,
        title: `Exigence Loi 25 ${i}`,
        status: i % 2 === 0 ? 'complété' : 'en cours'
      }));

      const startTime = performance.now();
      renderWithProviders(OwnerDashboard);
      
      await waitFor(() => {
        expect(screen.getByText(/Conformité/i)).toBeInTheDocument();
      });
      
      const loadTime = performance.now() - startTime;
      expect(loadTime).toBeLessThan(2000); // Should load within 2 seconds
    });
  });

  describe('Mobile Quebec Form Validation', () => {
    test('Quebec postal code validation on mobile keyboards', async () => {
      setMobileViewport('phone');
      renderWithProviders(ManagerBuildings);

      const postalCodeInput = screen.getByLabelText(/code postal/i);
      expect(postalCodeInput).toHaveAttribute('pattern', '[A-Za-z][0-9][A-Za-z] [0-9][A-Za-z][0-9]');
      
      // Test Quebec postal code format
      await user.type(postalCodeInput, 'H3A 1B1');
      expect(postalCodeInput).toHaveValue('H3A 1B1');
      
      // Test invalid format
      await user.clear(postalCodeInput);
      await user.type(postalCodeInput, '12345');
      expect(screen.getByText(/format de code postal invalide/i)).toBeInTheDocument();
    });

    test('Quebec phone number validation with mobile input', async () => {
      setMobileViewport('phone');
      renderWithProviders(ResidentsDemands);

      const phoneInput = screen.getByLabelText(/téléphone/i);
      expect(phoneInput).toHaveAttribute('type', 'tel');
      
      // Test Quebec phone format
      await user.type(phoneInput, '514-123-4567');
      expect(phoneInput).toHaveValue('(514) 123-4567');
      
      // Test automatic formatting
      await user.clear(phoneInput);
      await user.type(phoneInput, '5141234567');
      expect(phoneInput).toHaveValue('(514) 123-4567');
    });

    test('Quebec language preference persistence on mobile', async () => {
      setMobileViewport('phone');
      renderWithProviders(Header);

      // Switch to French
      const frenchButton = screen.getByRole('button', { name: /français/i });
      await user.click(frenchButton);

      // Simulate page reload
      renderWithProviders(Header);

      // Check if French is still selected
      expect(screen.getByText(/français/i)).toHaveClass('active');
      expect(localStorage.getItem('language')).toBe('fr');
    });
  });

  describe('Mobile Offline Support', () => {
    test('Quebec compliance data available offline on mobile', async () => {
      setMobileViewport('phone');
      
      // Mock offline mode
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      renderWithProviders(OwnerDashboard);

      // Check offline indicator
      expect(screen.getByText(/mode hors ligne/i)).toBeInTheDocument();
      
      // Check cached Quebec compliance data
      expect(screen.getByText(/données de conformité mises en cache/i)).toBeInTheDocument();
    });

    test('Offline form data sync when back online', async () => {
      setMobileViewport('phone');
      renderWithProviders(ResidentsDemands);

      // Fill form while offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      const titleInput = screen.getByLabelText(/titre/i);
      await user.type(titleInput, 'Demande hors ligne');
      
      const submitButton = screen.getByRole('button', { name: /soumettre/i });
      await user.click(submitButton);

      // Check offline storage
      expect(screen.getByText(/sauvegardé localement/i)).toBeInTheDocument();

      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', { value: true });
      window.dispatchEvent(new Event('online'));

      await waitFor(() => {
        expect(screen.getByText(/synchronisation en cours/i)).toBeInTheDocument();
      });
    });
  });
});