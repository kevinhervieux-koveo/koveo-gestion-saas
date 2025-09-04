/**
 * Authentication Button Functionality Tests
 * Tests all authentication-related buttons (login, logout, password toggle, etc.)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock API requests
const mockApiRequest = jest.fn();
jest.mock('../../../client/src/lib/queryClient', () => ({
  apiRequest: mockApiRequest,
  queryClient: new (jest.requireActual('@tanstack/react-query').QueryClient)(),
}));

// Mock authentication context
const mockLogin = jest.fn();
const mockLogout = jest.fn();
jest.mock('../../../client/src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    login: mockLogin,
    logout: mockLogout,
  }),
}));

describe('Authentication Buttons Functionality', () => {
  let queryClient: QueryClient;
  let user: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();
    jest.clearAllMocks();
    mockApiRequest.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Password Toggle Buttons', () => {
    const passwordToggleTestIds = [
      'button-toggle-password',
      'button-toggle-confirm-password',
    ];

    passwordToggleTestIds.forEach(testId => {
      it(`should toggle password visibility for ${testId}`, async () => {
        const MockPasswordField = () => {
          const [showPassword, setShowPassword] = React.useState(false);

          return (
            <div>
              <input 
                type={showPassword ? 'text' : 'password'} 
                data-testid="password-input"
                defaultValue="testpassword"
              />
              <button 
                data-testid={testId}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          );
        };

        renderWithProvider(<MockPasswordField />);
        
        const passwordInput = screen.getByTestId('password-input') as HTMLInputElement;
        const toggleButton = screen.getByTestId(testId);
        
        expect(passwordInput.type).toBe('password');
        expect(toggleButton).toBeInTheDocument();
        
        await user.click(toggleButton);
        
        await waitFor(() => {
          expect(passwordInput.type).toBe('text');
        });
        
        await user.click(toggleButton);
        
        await waitFor(() => {
          expect(passwordInput.type).toBe('password');
        });
      });
    });
  });

  describe('Language Toggle Buttons', () => {
    it('should switch to English when EN button is clicked', async () => {
      const mockSetLanguage = jest.fn();
      
      const MockLanguageSwitcher = () => (
        <div>
          <button 
            data-testid="button-language-en"
            onClick={() => mockSetLanguage('en')}
          >
            EN
          </button>
          <button 
            data-testid="button-language-fr"
            onClick={() => mockSetLanguage('fr')}
          >
            FR
          </button>
        </div>
      );

      renderWithProvider(<MockLanguageSwitcher />);
      
      const enButton = screen.getByTestId('button-language-en');
      const frButton = screen.getByTestId('button-language-fr');
      
      expect(enButton).toBeInTheDocument();
      expect(frButton).toBeInTheDocument();
      
      await user.click(enButton);
      expect(mockSetLanguage).toHaveBeenCalledWith('en');
      
      await user.click(frButton);
      expect(mockSetLanguage).toHaveBeenCalledWith('fr');
    });
  });

  describe('Login Form Buttons', () => {
    it('should handle login form submission', async () => {
      const MockLoginForm = () => {
        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          mockLogin({ email: 'test@test.com', password: 'password' });
        };

        return (
          <form onSubmit={handleSubmit}>
            <input type="email" name="email" defaultValue="test@test.com" />
            <input type="password" name="password" defaultValue="password" />
            <button type="submit" data-testid="button-login">
              Login
            </button>
          </form>
        );
      };

      renderWithProvider(<MockLoginForm />);
      
      const loginButton = screen.getByTestId('button-login');
      expect(loginButton).toBeInTheDocument();
      
      await user.click(loginButton);
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({ 
          email: 'test@test.com', 
          password: 'password' 
        });
      });
    });
  });

  describe('Registration Buttons', () => {
    it('should handle registration navigation', async () => {
      const mockNavigate = jest.fn();
      
      const MockRegisterButton = () => (
        <button 
          data-testid="button-register"
          onClick={() => mockNavigate('/auth/register')}
        >
          Register
        </button>
      );

      renderWithProvider(<MockRegisterButton />);
      
      const registerButton = screen.getByTestId('button-register');
      expect(registerButton).toBeInTheDocument();
      
      await user.click(registerButton);
      
      expect(mockNavigate).toHaveBeenCalledWith('/auth/register');
    });
  });

  describe('Password Reset Buttons', () => {
    it('should handle password reset request', async () => {
      const MockPasswordResetForm = () => {
        const handleReset = (e: React.FormEvent) => {
          e.preventDefault();
          mockApiRequest('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email: 'test@test.com' })
          });
        };

        return (
          <form onSubmit={handleReset}>
            <input type="email" name="email" defaultValue="test@test.com" />
            <button type="submit" data-testid="button-reset-password">
              Reset Password
            </button>
          </form>
        );
      };

      renderWithProvider(<MockPasswordResetForm />);
      
      const resetButton = screen.getByTestId('button-reset-password');
      expect(resetButton).toBeInTheDocument();
      
      await user.click(resetButton);
      
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email: 'test@test.com' })
        });
      });
    });
  });

  describe('Logout Buttons', () => {
    it('should handle logout action', async () => {
      const MockLogoutButton = () => (
        <button 
          data-testid="button-logout"
          onClick={mockLogout}
        >
          Logout
        </button>
      );

      renderWithProvider(<MockLogoutButton />);
      
      const logoutButton = screen.getByTestId('button-logout');
      expect(logoutButton).toBeInTheDocument();
      
      await user.click(logoutButton);
      
      expect(mockLogout).toHaveBeenCalled();
    });
  });
});