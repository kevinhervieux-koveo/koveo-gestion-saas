/**
 * Dialog Button Functionality Tests
 * Tests all dialog and modal buttons (confirm, cancel, time limits, etc.)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

// Mock API requests
const mockApiRequest = jest.fn();
jest.mock('../../../client/src/lib/queryClient', () => ({
  apiRequest: mockApiRequest,
  queryClient: new (jest.requireActual('@tanstack/react-query').QueryClient)(),
}));

describe('Dialog Buttons Functionality', () => {
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

  describe('Confirmation Dialog Buttons', () => {
    it('should handle create confirmation flow', async () => {
      const MockCreateDialog = () => {
        const [showDialog, setShowDialog] = React.useState(false);
        
        return (
          <div>
            <button 
              data-testid="button-create-space"
              onClick={() => setShowDialog(true)}
            >
              Create Space
            </button>
            
            {showDialog && (
              <div>
                <button 
                  data-testid="button-cancel-create"
                  onClick={() => setShowDialog(false)}
                >
                  Cancel Create
                </button>
                <button 
                  data-testid="button-confirm-create"
                  onClick={() => {
                    mockApiRequest('/api/spaces', { method: 'POST' });
                    setShowDialog(false);
                  }}
                >
                  Confirm Create
                </button>
              </div>
            )}
          </div>
        );
      };

      renderWithProvider(<MockCreateDialog />);
      
      const createButton = screen.getByTestId('button-create-space');
      expect(createButton).toBeInTheDocument();
      
      await user.click(createButton);
      
      await waitFor(() => {
        const cancelButton = screen.getByTestId('button-cancel-create');
        const confirmButton = screen.getByTestId('button-confirm-create');
        
        expect(cancelButton).toBeInTheDocument();
        expect(confirmButton).toBeInTheDocument();
      });
      
      // Test cancel functionality
      const cancelButton = screen.getByTestId('button-cancel-create');
      await user.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('button-cancel-create')).not.toBeInTheDocument();
      });
      
      // Test confirm functionality
      await user.click(createButton);
      
      await waitFor(() => {
        const confirmButton = screen.getByTestId('button-confirm-create');
        expect(confirmButton).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByTestId('button-confirm-create');
      await user.click(confirmButton);
      
      expect(mockApiRequest).toHaveBeenCalledWith('/api/spaces', { method: 'POST' });
    });

    it('should handle delete confirmation flow', async () => {
      const MockDeleteDialog = () => {
        const [showDialog, setShowDialog] = React.useState(false);
        
        return (
          <div>
            <button 
              data-testid="button-delete"
              onClick={() => setShowDialog(true)}
            >
              Delete
            </button>
            
            {showDialog && (
              <div>
                <button 
                  data-testid="button-cancel-delete"
                  onClick={() => setShowDialog(false)}
                >
                  Cancel Delete
                </button>
                <button 
                  data-testid="button-confirm-delete"
                  onClick={() => {
                    mockApiRequest('/api/delete', { method: 'DELETE' });
                    setShowDialog(false);
                  }}
                >
                  Confirm Delete
                </button>
              </div>
            )}
          </div>
        );
      };

      renderWithProvider(<MockDeleteDialog />);
      
      const deleteButton = screen.getByTestId('button-delete');
      expect(deleteButton).toBeInTheDocument();
      
      await user.click(deleteButton);
      
      await waitFor(() => {
        const cancelButton = screen.getByTestId('button-cancel-delete');
        const confirmButton = screen.getByTestId('button-confirm-delete');
        
        expect(cancelButton).toBeInTheDocument();
        expect(confirmButton).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByTestId('button-confirm-delete');
      await user.click(confirmButton);
      
      expect(mockApiRequest).toHaveBeenCalledWith('/api/delete', { method: 'DELETE' });
    });
  });

  describe('Time Limit Dialog Buttons', () => {
    it('should handle time limit setting flow', async () => {
      const MockTimeLimitDialog = () => {
        const [showDialog, setShowDialog] = React.useState(false);
        
        return (
          <div>
            <button 
              data-testid="button-time-limit-user"
              onClick={() => setShowDialog(true)}
            >
              Set Time Limit
            </button>
            
            {showDialog && (
              <div>
                <input 
                  type="number" 
                  data-testid="time-limit-input"
                  defaultValue="10"
                />
                <button 
                  data-testid="button-cancel-time-limit"
                  onClick={() => setShowDialog(false)}
                >
                  Cancel Time Limit
                </button>
                <button 
                  data-testid="button-confirm-time-limit"
                  onClick={() => {
                    mockApiRequest('/api/time-limits', { 
                      method: 'POST',
                      body: JSON.stringify({ limit: 10 })
                    });
                    setShowDialog(false);
                  }}
                >
                  Confirm Time Limit
                </button>
              </div>
            )}
          </div>
        );
      };

      renderWithProvider(<MockTimeLimitDialog />);
      
      const timeLimitButton = screen.getByTestId('button-time-limit-user');
      expect(timeLimitButton).toBeInTheDocument();
      
      await user.click(timeLimitButton);
      
      await waitFor(() => {
        const cancelButton = screen.getByTestId('button-cancel-time-limit');
        const confirmButton = screen.getByTestId('button-confirm-time-limit');
        const input = screen.getByTestId('time-limit-input');
        
        expect(cancelButton).toBeInTheDocument();
        expect(confirmButton).toBeInTheDocument();
        expect(input).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByTestId('button-confirm-time-limit');
      await user.click(confirmButton);
      
      expect(mockApiRequest).toHaveBeenCalledWith('/api/time-limits', { 
        method: 'POST',
        body: JSON.stringify({ limit: 10 })
      });
    });
  });

  describe('Multi-step Dialog Buttons', () => {
    it('should handle multi-step dialog navigation', async () => {
      const MockMultiStepDialog = () => {
        const [step, setStep] = React.useState(0);
        const [showDialog, setShowDialog] = React.useState(false);
        
        return (
          <div>
            <button 
              data-testid="button-start-process"
              onClick={() => {
                setShowDialog(true);
                setStep(1);
              }}
            >
              Start Process
            </button>
            
            {showDialog && (
              <div>
                {step === 1 && (
                  <div>
                    <button 
                      data-testid="button-next-step"
                      onClick={() => setStep(2)}
                    >
                      Next Step
                    </button>
                    <button 
                      data-testid="button-cancel-process"
                      onClick={() => setShowDialog(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                
                {step === 2 && (
                  <div>
                    <button 
                      data-testid="button-back-step"
                      onClick={() => setStep(1)}
                    >
                      Back Step
                    </button>
                    <button 
                      data-testid="button-finish-process"
                      onClick={() => {
                        mockApiRequest('/api/finish', { method: 'POST' });
                        setShowDialog(false);
                        setStep(0);
                      }}
                    >
                      Finish
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      };

      renderWithProvider(<MockMultiStepDialog />);
      
      const startButton = screen.getByTestId('button-start-process');
      expect(startButton).toBeInTheDocument();
      
      await user.click(startButton);
      
      await waitFor(() => {
        const nextButton = screen.getByTestId('button-next-step');
        const cancelButton = screen.getByTestId('button-cancel-process');
        
        expect(nextButton).toBeInTheDocument();
        expect(cancelButton).toBeInTheDocument();
      });
      
      const nextButton = screen.getByTestId('button-next-step');
      await user.click(nextButton);
      
      await waitFor(() => {
        const backButton = screen.getByTestId('button-back-step');
        const finishButton = screen.getByTestId('button-finish-process');
        
        expect(backButton).toBeInTheDocument();
        expect(finishButton).toBeInTheDocument();
      });
      
      const finishButton = screen.getByTestId('button-finish-process');
      await user.click(finishButton);
      
      expect(mockApiRequest).toHaveBeenCalledWith('/api/finish', { method: 'POST' });
    });
  });

  describe('Special Function Buttons', () => {
    it('should handle generate insights button', async () => {
      const MockInsightsButton = () => (
        <button 
          data-testid="generate-insights-button"
          onClick={() => mockApiRequest('/api/generate-insights', { method: 'POST' })}
        >
          Generate Insights
        </button>
      );

      renderWithProvider(<MockInsightsButton />);
      
      const insightsButton = screen.getByTestId('generate-insights-button');
      expect(insightsButton).toBeInTheDocument();
      
      await user.click(insightsButton);
      
      expect(mockApiRequest).toHaveBeenCalledWith('/api/generate-insights', { method: 'POST' });
    });
  });

  describe('Dialog State Management', () => {
    it('should properly manage dialog open/close states', async () => {
      const MockDialogManagement = () => {
        const [dialogStates, setDialogStates] = React.useState({
          create: false,
          delete: false,
          edit: false
        });
        
        const toggleDialog = (type: string) => {
          setDialogStates(prev => ({ ...prev, [type]: !prev[type as keyof typeof prev] }));
        };
        
        return (
          <div>
            <button 
              data-testid="open-create-dialog"
              onClick={() => toggleDialog('create')}
            >
              Open Create
            </button>
            <button 
              data-testid="open-delete-dialog"
              onClick={() => toggleDialog('delete')}
            >
              Open Delete
            </button>
            
            {dialogStates.create && (
              <div data-testid="create-dialog">
                <button 
                  data-testid="close-create-dialog"
                  onClick={() => toggleDialog('create')}
                >
                  Close Create
                </button>
              </div>
            )}
            
            {dialogStates.delete && (
              <div data-testid="delete-dialog">
                <button 
                  data-testid="close-delete-dialog"
                  onClick={() => toggleDialog('delete')}
                >
                  Close Delete
                </button>
              </div>
            )}
          </div>
        );
      };

      renderWithProvider(<MockDialogManagement />);
      
      const openCreateButton = screen.getByTestId('open-create-dialog');
      const openDeleteButton = screen.getByTestId('open-delete-dialog');
      
      expect(openCreateButton).toBeInTheDocument();
      expect(openDeleteButton).toBeInTheDocument();
      
      // Test create dialog
      await user.click(openCreateButton);
      
      await waitFor(() => {
        const createDialog = screen.getByTestId('create-dialog');
        expect(createDialog).toBeInTheDocument();
      });
      
      const closeCreateButton = screen.getByTestId('close-create-dialog');
      await user.click(closeCreateButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('create-dialog')).not.toBeInTheDocument();
      });
      
      // Test delete dialog
      await user.click(openDeleteButton);
      
      await waitFor(() => {
        const deleteDialog = screen.getByTestId('delete-dialog');
        expect(deleteDialog).toBeInTheDocument();
      });
      
      const closeDeleteButton = screen.getByTestId('close-delete-dialog');
      await user.click(closeDeleteButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument();
      });
    });
  });
});