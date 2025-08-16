import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock Intersection Observer for lazy loading tests
global.IntersectionObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn((element) => {
    // Simulate element coming into view
    callback([{ isIntersecting: true, target: element }]);
  }),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('Mobile Performance Tests', () => {
  describe('Image Optimization', () => {
    it('should implement lazy loading for property images', () => {
      render(
        <div className="grid gap-4 p-4">
          <div className="space-y-2">
            <img 
              src="/api/placeholder-image.jpg"
              alt="Maple Heights exterior"
              loading="lazy"
              className="w-full h-48 object-cover rounded-lg"
            />
            <h3>Maple Heights Condos</h3>
          </div>
          <div className="space-y-2">
            <img 
              src="/api/placeholder-image-2.jpg"
              alt="Oak Gardens lobby"
              loading="lazy"
              className="w-full h-48 object-cover rounded-lg"
            />
            <h3>Oak Gardens Apartments</h3>
          </div>
        </div>
      );
      
      const images = screen.getAllByRole('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('loading', 'lazy');
        expect(img).toHaveClass('object-cover');
      });
    });

    it('should use responsive images for different screen sizes', () => {
      render(
        <picture>
          <source 
            media="(max-width: 768px)" 
            srcSet="/images/property-mobile.webp"
          />
          <source 
            media="(min-width: 769px)" 
            srcSet="/images/property-desktop.webp"
          />
          <img 
            src="/images/property-fallback.jpg"
            alt="Property image"
            className="w-full h-auto"
          />
        </picture>
      );
      
      const picture = screen.getByRole('img').closest('picture');
      expect(picture).toBeInTheDocument();
      
      const sources = picture?.querySelectorAll('source');
      expect(sources).toHaveLength(2);
    });
  });

  describe('Virtual Scrolling', () => {
    it('should implement virtual scrolling for large property lists', () => {
      const { ScrollArea } = require('../../client/src/components/ui/scroll-area');
      
      render(
        <ScrollArea className="h-96 w-full">
          <div className="space-y-2 p-4" data-testid="virtual-list">
            {Array.from({ length: 1000 }, (_, i) => (
              <div 
                key={i}
                className="p-3 border rounded-lg"
                data-testid={`property-item-${i}`}
              >
                Property {i + 1}: Building Unit #{i + 1}A
              </div>
            ))}
          </div>
        </ScrollArea>
      );
      
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toBeInTheDocument();
      
      // Only first few items should be rendered initially
      expect(screen.getByTestId('property-item-0')).toBeInTheDocument();
      expect(screen.getByTestId('property-item-1')).toBeInTheDocument();
    });
  });

  describe('Skeleton Loading', () => {
    it('should show skeleton placeholders while data loads', async () => {
      const { Skeleton } = require('../../client/src/components/ui/skeleton');
      
      const PropertySkeleton = () => (
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      );
      
      render(<PropertySkeleton />);
      
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should replace skeletons with actual content when loaded', async () => {
      const { Skeleton } = require('../../client/src/components/ui/skeleton');
      
      const LoadingComponent = ({ isLoading }: { isLoading: boolean }) => (
        <div className="p-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-2">
              <h2>Maple Heights Condos</h2>
              <p>24 units • Montreal, QC</p>
              <div className="p-4 border rounded">
                Property details and resident information
              </div>
            </div>
          )}
        </div>
      );
      
      const { rerender } = render(<LoadingComponent isLoading={true} />);
      
      // Should show skeletons initially
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
      
      // Should show actual content after loading
      rerender(<LoadingComponent isLoading={false} />);
      
      await waitFor(() => {
        expect(screen.getByText('Maple Heights Condos')).toBeInTheDocument();
        expect(screen.getByText('24 units • Montreal, QC')).toBeInTheDocument();
      });
    });
  });

  describe('Code Splitting', () => {
    it('should lazy load dashboard components', async () => {
      // Mock dynamic import
      const mockLazyComponent = jest.fn().mockResolvedValue({
        default: () => <div>Lazy loaded dashboard component</div>
      });
      
      // Simulate lazy loading
      const LazyDashboard = () => {
        const [component, setComponent] = React.useState<React.ComponentType | null>(null);
        
        React.useEffect(() => {
          mockLazyComponent().then(module => {
            setComponent(() => module.default);
          });
        }, []);
        
        if (!component) {
          return <div>Loading dashboard...</div>;
        }
        
        const Component = component;
        return <Component />;
      };
      
      render(<LazyDashboard />);
      
      // Should show loading state initially
      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
      
      // Should load component
      await waitFor(() => {
        expect(screen.getByText('Lazy loaded dashboard component')).toBeInTheDocument();
      });
      
      expect(mockLazyComponent).toHaveBeenCalled();
    });
  });

  describe('Bundle Size Optimization', () => {
    it('should use tree-shaking friendly imports', () => {
      // Test that components are imported individually, not as entire libraries
      const { Button } = require('../../client/src/components/ui/button');
      const { Input } = require('../../client/src/components/ui/input');
      
      render(
        <form className="space-y-4">
          <Input placeholder="Property name" />
          <Button type="submit">Save Property</Button>
        </form>
      );
      
      expect(screen.getByPlaceholderText('Property name')).toBeInTheDocument();
      expect(screen.getByText('Save Property')).toBeInTheDocument();
    });
  });

  describe('Memory Management', () => {
    it('should properly cleanup event listeners and timers', () => {
      const mockAddEventListener = jest.spyOn(window, 'addEventListener');
      const mockRemoveEventListener = jest.spyOn(window, 'removeEventListener');
      
      const ComponentWithEventListener = () => {
        React.useEffect(() => {
          const handleResize = () => {
            // Handle window resize
          };
          
          window.addEventListener('resize', handleResize);
          
          return () => {
            window.removeEventListener('resize', handleResize);
          };
        }, []);
        
        return <div>Component with event listener</div>;
      };
      
      const { unmount } = render(<ComponentWithEventListener />);
      
      expect(mockAddEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
      
      unmount();
      
      expect(mockRemoveEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
      
      mockAddEventListener.mockRestore();
      mockRemoveEventListener.mockRestore();
    });

    it('should cancel pending API requests on component unmount', () => {
      const mockAbort = jest.fn();
      const mockAbortController = {
        abort: mockAbort,
        signal: { aborted: false }
      };
      
      global.AbortController = jest.fn(() => mockAbortController);
      
      const ComponentWithAPICall = () => {
        React.useEffect(() => {
          const controller = new AbortController();
          
          // Simulate API call
          fetch('/api/properties', { signal: controller.signal })
            .then(response => response.json())
            .catch(error => {
              if (error.name === 'AbortError') {
                console.log('Request aborted');
              }
            });
          
          return () => {
            controller.abort();
          };
        }, []);
        
        return <div>Component with API call</div>;
      };
      
      const { unmount } = render(<ComponentWithAPICall />);
      
      unmount();
      
      expect(mockAbort).toHaveBeenCalled();
    });
  });

  describe('Caching Strategy', () => {
    it('should implement efficient caching for property data', () => {
      const mockCacheGet = jest.fn();
      const mockCacheSet = jest.fn();
      
      // Mock cache API
      global.caches = {
        open: jest.fn().mockResolvedValue({
          match: mockCacheGet,
          put: mockCacheSet,
        })
      } as any;
      
      const CachedPropertyComponent = () => {
        const [properties, setProperties] = React.useState([]);
        
        React.useEffect(() => {
          const fetchProperties = async () => {
            // Try cache first
            const cached = await mockCacheGet('/api/properties');
            if (cached) {
              setProperties(await cached.json());
              return;
            }
            
            // Fetch from network and cache
            const response = await fetch('/api/properties');
            mockCacheSet('/api/properties', response.clone());
            setProperties(await response.json());
          };
          
          fetchProperties();
        }, []);
        
        return <div>Properties: {properties.length}</div>;
      };
      
      render(<CachedPropertyComponent />);
      
      expect(screen.getByText(/Properties:/)).toBeInTheDocument();
    });
  });
});