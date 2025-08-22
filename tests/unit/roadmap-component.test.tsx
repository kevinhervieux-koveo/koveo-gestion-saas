/**
 * @file Roadmap component tests.
 * @description Test suite for the roadmap page and feature management UI.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Roadmap from '../../client/src/pages/admin/roadmap';

// Mock dependencies
jest.mock('../../client/src/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

jest.mock('../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('wouter', () => ({
  useLocation: () => ['/roadmap', jest.fn()],
}));

jest.mock('lucide-react', () => ({
  Target: () => <div data-testid="target-icon">Target</div>,
  Home: () => <div data-testid="home-icon">Home</div>,
  Building: () => <div data-testid="building-icon">Building</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
  DollarSign: () => <div data-testid="dollar-icon">Dollar</div>,
  Wrench: () => <div data-testid="wrench-icon">Wrench</div>,
  FileText: () => <div data-testid="file-icon">File</div>,
  Bell: () => <div data-testid="bell-icon">Bell</div>,
  Bot: () => <div data-testid="bot-icon">Bot</div>,
  Shield: () => <div data-testid="shield-icon">Shield</div>,
  BarChart3: () => <div data-testid="chart-icon">Chart</div>,
  Database: () => <div data-testid="database-icon">Database</div>,
  Cloud: () => <div data-testid="cloud-icon">Cloud</div>,
  Globe: () => <div data-testid="globe-icon">Globe</div>,
  CheckCircle2: () => <div data-testid="check-icon">Check</div>,
  Circle: () => <div data-testid="circle-icon">Circle</div>,
  Clock: () => <div data-testid="clock-icon">Clock</div>,
  Plus: () => <div data-testid="plus-icon">Plus</div>,
  MessageCircle: () => <div data-testid="message-icon">Message</div>,
  Terminal: () => <div data-testid="terminal-icon">Terminal</div>,
  ChevronDown: () => <div data-testid="chevron-down-icon">Down</div>,
  ChevronRight: () => <div data-testid="chevron-right-icon">Right</div>,
  ListTodo: () => <div data-testid="todo-icon">Todo</div>,
}));

// Mock API responses
const mockFeatures = [
  {
    id: 'feature-1',
    name: 'SSL Management',
    description: 'Automatic SSL certificate renewal',
    category: 'Website',
    status: 'in-progress',
    priority: 'high',
    isStrategicPath: true,
  },
  {
    id: 'feature-2',
    name: 'User Dashboard',
    description: 'Property management dashboard',
    category: 'Dashboard & Home',
    status: 'completed',
    priority: 'medium',
    isStrategicPath: false,
  },
];

const mockActionableItems = {
  'feature-1': [
    {
      id: 'item-1',
      featureId: 'feature-1',
      title: '1. Create SSL Certificate Database Table',
      description: 'Database table for certificates',
      status: 'pending',
      orderIndex: 0,
    },
  ],
};

describe('Roadmap Component Tests', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    // Mock fetch for API calls
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockFeatures,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockActionableItems,
      });

    jest.clearAllMocks();
  });

  it('should render roadmap page title', async () => {
    render(<Roadmap />, { wrapper: createWrapper() });

    expect(screen.getByText('Product Roadmap')).toBeInTheDocument();
    expect(screen.getByText('Complete feature list and development progress (Live Data)')).toBeInTheDocument();
  });

  it('should display strategic path section', async () => {
    render(<Roadmap />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Strategic Path')).toBeInTheDocument();
    });

    expect(screen.getByText('High-level strategic initiatives and business objectives')).toBeInTheDocument();
  });

  it('should show features in correct sections', async () => {
    render(<Roadmap />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('SSL Management')).toBeInTheDocument();
    });

    expect(screen.getByText('User Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Automatic SSL certificate renewal')).toBeInTheDocument();
  });

  it('should display strategic badge for strategic features', async () => {
    render(<Roadmap />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('SSL Management')).toBeInTheDocument();
    });

    expect(screen.getByText('Strategic')).toBeInTheDocument();
  });

  it('should show LLM Help Form button', async () => {
    render(<Roadmap />, { wrapper: createWrapper() });

    expect(screen.getByText('LLM Help Form')).toBeInTheDocument();
  });

  it('should show Create New Item button', async () => {
    render(<Roadmap />, { wrapper: createWrapper() });

    expect(screen.getByText('Create New Item')).toBeInTheDocument();
  });

  it('should display feature status controls', async () => {
    render(<Roadmap />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('SSL Management')).toBeInTheDocument();
    });

    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getByText('Strategic Path:')).toBeInTheDocument();
  });

  it('should copy LLM help form to clipboard', async () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });

    render(<Roadmap />, { wrapper: createWrapper() });

    const llmButton = screen.getByText('LLM Help Form');
    fireEvent.click(llmButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    const clipboardContent = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0];
    expect(clipboardContent).toContain('Koveo Gestion Feature Development Discussion Form');
    expect(clipboardContent).toContain('APPLICATION CONTEXT');
    expect(clipboardContent).toContain('CRITICAL INSTRUCTIONS FOR LLM');
  });

  it('should expand and collapse feature sections', async () => {
    render(<Roadmap />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('SSL Management')).toBeInTheDocument();
    });

    // Find expand button for feature
    const expandButton = screen.getByTestId('chevron-right-icon');
    fireEvent.click(expandButton);

    // Should show actionable items
    await waitFor(() => {
      expect(screen.getByText('1. Create SSL Certificate Database Table')).toBeInTheDocument();
    });
  });

  it('should handle feature status change', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockFeatures,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockActionableItems,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockFeatures[0], status: 'completed' }),
      });

    render(<Roadmap />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('SSL Management')).toBeInTheDocument();
    });

    // Find status dropdown (would need proper test IDs in actual component)
    const statusSelects = screen.getAllByDisplayValue('in-progress');
    if (statusSelects.length > 0) {
      fireEvent.change(statusSelects[0], { target: { value: 'completed' } });
    }
  });

  it('should handle strategic path toggle', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockFeatures,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockActionableItems,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockFeatures[1], isStrategicPath: true }),
      });

    render(<Roadmap />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('User Dashboard')).toBeInTheDocument();
    });

    // Find strategic path switches (would need proper test IDs in actual component)
    const switches = screen.getAllByRole('switch');
    if (switches.length > 0) {
      fireEvent.click(switches[0]);
    }
  });

  it('should display correct feature counts in overview', async () => {
    render(<Roadmap />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // Total features
    });

    expect(screen.getByText('1')).toBeInTheDocument(); // In progress
    expect(screen.getByText('1')).toBeInTheDocument(); // Completed
  });

  it('should handle loading state', () => {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => { /* Mock loading state */ }));

    render(<Roadmap />, { wrapper: createWrapper() });

    expect(screen.getByText('Loading features...')).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('API Error'));

    render(<Roadmap />, { wrapper: createWrapper() });

    // Should handle error state (would need error boundaries in actual component)
    await waitFor(() => {
      expect(screen.queryByText('Loading features...')).not.toBeInTheDocument();
    });
  });
});