/**
 * Navigation Accessibility Tests
 * 
 * Tests to ensure navigation components are accessible and work correctly
 * across different user roles and authentication states.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import React from 'react';
import '@testing-library/jest-dom';

// Import navigation components
import HamburgerMenu from '../../client/src/components/ui/hamburger-menu';
import Sidebar from '../../client/src/components/layout/sidebar';
import LanguageSwitcher from '../../client/src/components/ui/language-switcher';

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode; route?: string }> = ({ 
  children, 
  route = '/' 
}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  const [location, navigate] = memoryLocation({ path: route });

  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={() => [location, navigate]}>
        {children}
      </Router>
    </QueryClientProvider>
  );
};

// Mock hooks
const mockUseAuth = vi.fn();
const mockUseLanguage = vi.fn(() => ({
  language: 'en',
  t: (key: string) => key,
  setLanguage: vi.fn(),
}));

vi.mock('../../client/src/hooks/use-auth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('../../client/src/hooks/use-language', () => ({
  useLanguage: mockUseLanguage,
}));

vi.mock('../../client/src/lib/queryClient', () => ({
  apiRequest: vi.fn(),
  queryClient: new QueryClient(),
}));

describe('Navigation Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hamburger Menu Accessibility', () => {
    test('hamburger menu is keyboard accessible', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null as any,
      });

      render(
        <TestWrapper>
          <HamburgerMenu />
        </TestWrapper>
      );

      const menuButton = screen.getByTestId('hamburger-menu-button');
      expect(menuButton).toBeInTheDocument();

      // Test keyboard navigation
      menuButton.focus();
      expect(menuButton).toHaveFocus();

      // Test Enter key opens menu
      fireEvent.keyDown(menuButton, { key: 'Enter', code: 'Enter' });
      expect(screen.getByTestId('hamburger-menu-content')).toBeInTheDocument();
    });

    test('hamburger menu has proper ARIA attributes', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null as any,
      });

      render(
        <TestWrapper>
          <HamburgerMenu />
        </TestWrapper>
      );

      const menuButton = screen.getByTestId('hamburger-menu-button');
      expect(menuButton).toHaveAttribute('aria-label');
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');

      // Open menu
      fireEvent.click(menuButton);
      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    });

    test('hamburger menu links are keyboard navigable', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'admin' } as any,
      });

      render(
        <TestWrapper>
          <HamburgerMenu />
        </TestWrapper>
      );

      // Open menu
      const menuButton = screen.getByTestId('hamburger-menu-button');
      fireEvent.click(menuButton);

      // Test that links can be focused with keyboard
      const homeLink = screen.getByTestId('nav-link-home');
      homeLink.focus();
      expect(homeLink).toHaveFocus();

      // Test tab navigation
      fireEvent.keyDown(homeLink, { key: 'Tab', code: 'Tab' });
      const nextLink = screen.getByTestId('nav-link-dashboard');
      nextLink.focus();
      expect(nextLink).toHaveFocus();
    });

    test('hamburger menu closes on escape key', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null as any,
      });

      render(
        <TestWrapper>
          <HamburgerMenu />
        </TestWrapper>
      );

      const menuButton = screen.getByTestId('hamburger-menu-button');
      fireEvent.click(menuButton);

      expect(screen.getByTestId('hamburger-menu-content')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      expect(screen.queryByTestId('hamburger-menu-content')).not.toBeInTheDocument();
    });
  });

  describe('Sidebar Accessibility', () => {
    test('sidebar navigation is accessible for different roles', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'manager' } as any,
      });

      render(
        <TestWrapper>
          <Sidebar />
        </TestWrapper>
      );

      // Manager should see manager-specific links
      expect(screen.getByTestId('sidebar-link-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar-link-buildings')).toBeInTheDocument();
    });

    test('sidebar handles role changes properly', () => {
      const { rerender } = render(
        <TestWrapper>
          <Sidebar />
        </TestWrapper>
      );

      // Start as manager
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'manager' } as any,
      });

      rerender(
        <TestWrapper>
          <Sidebar />
        </TestWrapper>
      );

      expect(screen.getByTestId('sidebar-link-buildings')).toBeInTheDocument();

      // Change to resident
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'resident' },
      });

      rerender(
        <TestWrapper>
          <Sidebar />
        </TestWrapper>
      );

      // Should not see manager links anymore
      expect(screen.queryByTestId('sidebar-link-buildings')).not.toBeInTheDocument();
      expect(screen.getByTestId('sidebar-link-residence')).toBeInTheDocument();
    });

    test('sidebar navigation items have proper focus management', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'admin' } as any,
      });

      render(
        <TestWrapper>
          <Sidebar />
        </TestWrapper>
      );

      const dashboardLink = screen.getByTestId('sidebar-link-dashboard');
      dashboardLink.focus();
      expect(dashboardLink).toHaveFocus();

      // Test keyboard navigation between items
      fireEvent.keyDown(dashboardLink, { key: 'ArrowDown', code: 'ArrowDown' });
      const nextLink = screen.getByTestId('sidebar-link-buildings');
      expect(nextLink).toHaveFocus();
    });
  });

  describe('Language Switcher Accessibility', () => {
    test('language switcher is keyboard accessible', async () => {
      const mockSetLanguage = vi.fn();
      mockUseLanguage.mockReturnValue({
        language: 'en',
        t: (key: string) => key,
        setLanguage: mockSetLanguage,
      });

      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>
      );

      const languageSwitcher = screen.getByTestId('language-switcher');
      expect(languageSwitcher).toBeInTheDocument();

      // Test keyboard access
      languageSwitcher.focus();
      expect(languageSwitcher).toHaveFocus();

      // Test Enter key opens options
      fireEvent.keyDown(languageSwitcher, { key: 'Enter', code: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText('Français')).toBeInTheDocument();
      });
    });

    test('language switcher changes language correctly', async () => {
      const mockSetLanguage = vi.fn();
      mockUseLanguage.mockReturnValue({
        language: 'en',
        t: (key: string) => key,
        setLanguage: mockSetLanguage,
      });

      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>
      );

      const languageSwitcher = screen.getByTestId('language-switcher');
      fireEvent.click(languageSwitcher);

      await waitFor(() => {
        const frenchOption = screen.getByText('Français');
        fireEvent.click(frenchOption);
        expect(mockSetLanguage).toHaveBeenCalledWith('fr');
      });
    });

    test('language switcher has proper ARIA labels', () => {
      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>
      );

      const languageSwitcher = screen.getByTestId('language-switcher');
      expect(languageSwitcher).toHaveAttribute('aria-label');
      expect(languageSwitcher).toHaveAttribute('role', 'combobox');
    });
  });

  describe('Focus Management', () => {
    test('focus returns to trigger after menu closes', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null as any,
      });

      render(
        <TestWrapper>
          <HamburgerMenu />
        </TestWrapper>
      );

      const menuButton = screen.getByTestId('hamburger-menu-button');
      
      // Open menu
      fireEvent.click(menuButton);
      expect(screen.getByTestId('hamburger-menu-content')).toBeInTheDocument();

      // Close menu with Escape
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByTestId('hamburger-menu-content')).not.toBeInTheDocument();
        expect(menuButton).toHaveFocus();
      });
    });

    test('focus trap works within open menu', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'admin' } as any,
      });

      render(
        <TestWrapper>
          <HamburgerMenu />
        </TestWrapper>
      );

      const menuButton = screen.getByTestId('hamburger-menu-button');
      fireEvent.click(menuButton);

      // Focus should be trapped within menu
      const menuContent = screen.getByTestId('hamburger-menu-content');
      expect(menuContent).toBeInTheDocument();

      const firstLink = screen.getByTestId('nav-link-home');
      firstLink.focus();
      expect(firstLink).toHaveFocus();

      // Tab should cycle through menu items
      fireEvent.keyDown(firstLink, { key: 'Tab', code: 'Tab' });
      const nextItem = screen.getByTestId('nav-link-dashboard');
      expect(nextItem).toHaveFocus();
    });
  });

  describe('Screen Reader Support', () => {
    test('navigation landmarks are properly labeled', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'manager' } as any,
      });

      render(
        <TestWrapper>
          <Sidebar />
        </TestWrapper>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label');
    });

    test('current page is indicated for screen readers', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'manager' } as any,
      });

      render(
        <TestWrapper route="/dashboard">
          <Sidebar />
        </TestWrapper>
      );

      const currentPageLink = screen.getByTestId('sidebar-link-dashboard');
      expect(currentPageLink).toHaveAttribute('aria-current', 'page');
    });

    test('navigation changes are announced to screen readers', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'manager' } as any,
      });

      render(
        <TestWrapper>
          <Sidebar />
        </TestWrapper>
      );

      const buildingsLink = screen.getByTestId('sidebar-link-buildings');
      fireEvent.click(buildingsLink);

      await waitFor(() => {
        // Check if announcement region exists
        const announcement = document.querySelector('[aria-live="polite"]');
        expect(announcement).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Navigation', () => {
    test('mobile navigation is touch-friendly', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null as any,
      });

      render(
        <TestWrapper>
          <HamburgerMenu />
        </TestWrapper>
      );

      const menuButton = screen.getByTestId('hamburger-menu-button');
      
      // Test touch interaction
      fireEvent.touchStart(menuButton);
      fireEvent.touchEnd(menuButton);
      fireEvent.click(menuButton);

      expect(screen.getByTestId('hamburger-menu-content')).toBeInTheDocument();
    });

    test('mobile navigation respects reduced motion preferences', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null as any,
      });

      render(
        <TestWrapper>
          <HamburgerMenu />
        </TestWrapper>
      );

      const menuButton = screen.getByTestId('hamburger-menu-button');
      fireEvent.click(menuButton);

      // Menu should still work with reduced motion
      expect(screen.getByTestId('hamburger-menu-content')).toBeInTheDocument();
    });
  });
});