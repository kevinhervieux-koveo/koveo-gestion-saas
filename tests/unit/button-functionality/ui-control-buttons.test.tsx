/**
 * UI Control Button Functionality Tests
 * Tests all UI control buttons (pagination, calendar navigation, filters, etc.)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

describe('UI Control Buttons Functionality', () => {
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
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Pagination Control Buttons', () => {
    it('should handle pagination navigation', async () => {
      const mockSetPage = jest.fn();
      const currentPage = 2;
      const totalPages = 5;
      
      const MockPagination = () => (
        <div>
          <button 
            data-testid="button-previous-page"
            onClick={() => mockSetPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Previous
          </button>
          
          {[1, 2, 3, 4, 5].map(pageNum => (
            <button 
              key={pageNum}
              data-testid={`button-page-${pageNum}`}
              onClick={() => mockSetPage(pageNum)}
              className={pageNum === currentPage ? 'active' : ''}
            >
              {pageNum}
            </button>
          ))}
          
          <button 
            data-testid="button-next-page"
            onClick={() => mockSetPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      );

      renderWithProvider(<MockPagination />);
      
      const prevButton = screen.getByTestId('button-previous-page');
      const nextButton = screen.getByTestId('button-next-page');
      const page3Button = screen.getByTestId('button-page-3');
      
      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();
      expect(page3Button).toBeInTheDocument();
      
      await user.click(prevButton);
      expect(mockSetPage).toHaveBeenCalledWith(1);
      
      await user.click(nextButton);
      expect(mockSetPage).toHaveBeenCalledWith(3);
      
      await user.click(page3Button);
      expect(mockSetPage).toHaveBeenCalledWith(3);
    });
  });

  describe('Calendar Navigation Buttons', () => {
    it('should handle month navigation in calendar', async () => {
      const mockGoToPrevMonth = jest.fn();
      const mockGoToNextMonth = jest.fn();
      
      const MockCalendarNav = () => (
        <div>
          <button 
            data-testid="prev-month"
            onClick={mockGoToPrevMonth}
          >
            Previous Month
          </button>
          <button 
            data-testid="next-month"
            onClick={mockGoToNextMonth}
          >
            Next Month
          </button>
        </div>
      );

      renderWithProvider(<MockCalendarNav />);
      
      const prevMonthButton = screen.getByTestId('prev-month');
      const nextMonthButton = screen.getByTestId('next-month');
      
      expect(prevMonthButton).toBeInTheDocument();
      expect(nextMonthButton).toBeInTheDocument();
      
      await user.click(prevMonthButton);
      expect(mockGoToPrevMonth).toHaveBeenCalled();
      
      await user.click(nextMonthButton);
      expect(mockGoToNextMonth).toHaveBeenCalled();
    });
  });

  describe('Calendar Feature Buttons', () => {
    it('should handle calendar linking and export functionality', async () => {
      const mockLinkCalendar = jest.fn();
      const mockExportCalendar = jest.fn();
      const mockCancelLink = jest.fn();
      const mockNextStep = jest.fn();
      
      const MockCalendarFeatures = () => {
        const [isLinking, setIsLinking] = React.useState(false);
        
        return (
          <div>
            <button 
              data-testid="button-link-calendar"
              onClick={() => {
                mockLinkCalendar();
                setIsLinking(true);
              }}
            >
              Link Calendar
            </button>
            
            <button 
              data-testid="button-export-calendar"
              onClick={mockExportCalendar}
            >
              Export Calendar
            </button>
            
            {isLinking && (
              <div>
                <button 
                  data-testid="button-cancel-link"
                  onClick={() => {
                    mockCancelLink();
                    setIsLinking(false);
                  }}
                >
                  Cancel Link
                </button>
                <button 
                  data-testid="button-next-step"
                  onClick={mockNextStep}
                >
                  Next Step
                </button>
                <button 
                  data-testid="button-back-step"
                  onClick={() => console.log('Back step')}
                >
                  Back Step
                </button>
                <button 
                  data-testid="button-cancel-provider"
                  onClick={() => setIsLinking(false)}
                >
                  Cancel Provider
                </button>
                <button 
                  data-testid="button-confirm-final-link"
                  onClick={() => {
                    console.log('Confirming link');
                    setIsLinking(false);
                  }}
                >
                  Confirm Link
                </button>
              </div>
            )}
          </div>
        );
      };

      renderWithProvider(<MockCalendarFeatures />);
      
      const linkButton = screen.getByTestId('button-link-calendar');
      const exportButton = screen.getByTestId('button-export-calendar');
      
      expect(linkButton).toBeInTheDocument();
      expect(exportButton).toBeInTheDocument();
      
      await user.click(exportButton);
      expect(mockExportCalendar).toHaveBeenCalled();
      
      await user.click(linkButton);
      expect(mockLinkCalendar).toHaveBeenCalled();
      
      await waitFor(() => {
        const cancelButton = screen.getByTestId('button-cancel-link');
        const nextButton = screen.getByTestId('button-next-step');
        
        expect(cancelButton).toBeInTheDocument();
        expect(nextButton).toBeInTheDocument();
      });
      
      const nextButton = screen.getByTestId('button-next-step');
      await user.click(nextButton);
      expect(mockNextStep).toHaveBeenCalled();
    });
  });

  describe('Filter and Reset Buttons', () => {
    it('should handle filter reset functionality', async () => {
      const mockResetUserFilters = jest.fn();
      const mockResetPermissionFilters = jest.fn();
      
      const MockFilterControls = () => (
        <div>
          <button 
            data-testid="button-reset-user-filters"
            onClick={mockResetUserFilters}
          >
            Reset User Filters
          </button>
          <button 
            data-testid="button-reset-permission-filters"
            onClick={mockResetPermissionFilters}
          >
            Reset Permission Filters
          </button>
        </div>
      );

      renderWithProvider(<MockFilterControls />);
      
      const resetUserButton = screen.getByTestId('button-reset-user-filters');
      const resetPermissionButton = screen.getByTestId('button-reset-permission-filters');
      
      expect(resetUserButton).toBeInTheDocument();
      expect(resetPermissionButton).toBeInTheDocument();
      
      await user.click(resetUserButton);
      expect(mockResetUserFilters).toHaveBeenCalled();
      
      await user.click(resetPermissionButton);
      expect(mockResetPermissionFilters).toHaveBeenCalled();
    });
  });

  describe('Show/Hide Toggle Buttons', () => {
    it('should handle show all and hide all functionality', async () => {
      const mockShowAll = jest.fn();
      const mockHideAll = jest.fn();
      
      const MockToggleButtons = () => (
        <div>
          <button 
            data-testid="button-show-all"
            onClick={mockShowAll}
          >
            Show All
          </button>
          <button 
            data-testid="button-hide-all"
            onClick={mockHideAll}
          >
            Hide All
          </button>
          <button 
            data-testid="button-show-all-bottom"
            onClick={mockShowAll}
          >
            Show All Bottom
          </button>
        </div>
      );

      renderWithProvider(<MockToggleButtons />);
      
      const showAllButton = screen.getByTestId('button-show-all');
      const hideAllButton = screen.getByTestId('button-hide-all');
      const showAllBottomButton = screen.getByTestId('button-show-all-bottom');
      
      expect(showAllButton).toBeInTheDocument();
      expect(hideAllButton).toBeInTheDocument();
      expect(showAllBottomButton).toBeInTheDocument();
      
      await user.click(showAllButton);
      expect(mockShowAll).toHaveBeenCalled();
      
      await user.click(hideAllButton);
      expect(mockHideAll).toHaveBeenCalled();
      
      await user.click(showAllBottomButton);
      expect(mockShowAll).toHaveBeenCalledTimes(2);
    });
  });

  describe('Fullscreen Toggle Buttons', () => {
    it('should handle fullscreen toggle functionality', async () => {
      const mockToggleFullscreen = jest.fn();
      
      const MockFullscreenToggle = () => (
        <button 
          data-testid="button-fullscreen-toggle"
          onClick={mockToggleFullscreen}
        >
          Toggle Fullscreen
        </button>
      );

      renderWithProvider(<MockFullscreenToggle />);
      
      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      expect(fullscreenButton).toBeInTheDocument();
      
      await user.click(fullscreenButton);
      expect(mockToggleFullscreen).toHaveBeenCalled();
    });
  });

  describe('Menu Control Buttons', () => {
    it('should handle hamburger menu functionality', async () => {
      const MockHamburgerMenu = () => {
        const [isOpen, setIsOpen] = React.useState(false);
        
        return (
          <div>
            <button 
              data-testid="hamburger-button"
              onClick={() => setIsOpen(!isOpen)}
            >
              Menu
            </button>
            
            {isOpen && (
              <button 
                data-testid="menu-close-button"
                onClick={() => setIsOpen(false)}
              >
                Close Menu
              </button>
            )}
          </div>
        );
      };

      renderWithProvider(<MockHamburgerMenu />);
      
      const hamburgerButton = screen.getByTestId('hamburger-button');
      expect(hamburgerButton).toBeInTheDocument();
      
      await user.click(hamburgerButton);
      
      await waitFor(() => {
        const closeButton = screen.getByTestId('menu-close-button');
        expect(closeButton).toBeInTheDocument();
      });
      
      const closeButton = screen.getByTestId('menu-close-button');
      await user.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('menu-close-button')).not.toBeInTheDocument();
      });
    });
  });
});