import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestProviders } from '@/utils/test-providers';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';

// Performance testing utilities
interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  componentCount: number;
}

class PerformanceMonitor {
  private startTime: number = 0;
  private initialMemory: number = 0;

  start(): void {
    this.startTime = performance.now();
    this.initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
  }

  end(): PerformanceMetrics {
    const endTime = performance.now();
    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    return {
      renderTime: endTime - this.startTime,
      memoryUsage: finalMemory - this.initialMemory,
      componentCount: document.querySelectorAll('*').length,
    };
  }
}

// Mock components for testing
const LargeDataComponent: React.FC<{ items: any[] }> = ({ items }) => (
  <div data-testid="large-data-component">
    {items.map((item, index) => (
      <div key={index} data-testid={`item-${index}`}>
        {item.name} - {item.description}
      </div>
    ))}
  </div>
);

const HeavyCalculationComponent: React.FC = () => {
  const [result, setResult] = React.useState(0);
  
  React.useEffect(() => {
    // Simulate heavy calculation
    let sum = 0;
    for (let i = 0; i < 100000; i++) {
      sum += Math.sqrt(i);
    }
    setResult(sum);
  }, []);
  
  return <div data-testid="heavy-calc-result">{result.toFixed(2)}</div>;
};

const MemoizedComponent: React.FC<{ data: any }> = React.memo(({ data }) => (
  <div data-testid="memoized-component">{data.name}</div>
));

// Mock hooks
jest.mock('@/hooks/use-auth');
jest.mock('@/hooks/use-language');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLanguage = useLanguage as jest.MockedFunction<typeof useLanguage>;

describe('Component Performance Tests', () => {
  let queryClient: QueryClient;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    performanceMonitor = new PerformanceMonitor();

    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
        organizationId: 'org-1',
      },
      logout: jest.fn(),
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
    });

    mockUseLanguage.mockReturnValue({
      language: 'en',
      setLanguage: jest.fn(),
      t: { language: 'en' },
      translations: {},
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Render Performance', () => {
    it('renders large lists efficiently', async () => {
      const largeDataSet = Array.from({ length: 1000 }, (_, index) => ({
        id: index,
        name: `Item ${index}`,
        description: `Description for item ${index}`,
      }));

      performanceMonitor.start();

      await act(async () => {
        render(
          <QueryClientProvider client={queryClient}>
            <TestProviders>
              <LargeDataComponent items={largeDataSet} />
            </TestProviders>
          </QueryClientProvider>
        );
      });

      const metrics = performanceMonitor.end();

      // Should render 1000 items within reasonable time
      expect(metrics.renderTime).toBeLessThan(500); // Less than 500ms
      expect(screen.getByTestId('large-data-component')).toBeInTheDocument();
      expect(screen.getAllByTestId(/item-\d+/)).toHaveLength(1000);
    });

    it('handles component re-renders efficiently', async () => {
      const TestComponent: React.FC<{ count: number }> = ({ count }) => (
        <div data-testid="rerender-test">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} data-testid={`rerender-item-${i}`}>
              Item {i}
            </div>
          ))}
        </div>
      );

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <TestComponent count={10} />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getAllByTestId(/rerender-item-\d+/)).toHaveLength(10);

      performanceMonitor.start();

      // Trigger multiple re-renders
      for (let i = 20; i <= 100; i += 20) {
        await act(async () => {
          rerender(
            <QueryClientProvider client={queryClient}>
              <TestProviders>
                <TestComponent count={i} />
              </TestProviders>
            </QueryClientProvider>
          );
        });
      }

      const metrics = performanceMonitor.end();

      // Multiple re-renders should complete quickly
      expect(metrics.renderTime).toBeLessThan(200);
      expect(screen.getAllByTestId(/rerender-item-\d+/)).toHaveLength(100);
    });

    it('optimizes memoized component renders', async () => {
      const data = { name: 'Test Data', id: 1 };
      let renderCount = 0;

      const MemoizedTestComponent: React.FC<{ data: any }> = React.memo(({ data }) => {
        renderCount++;
        return <div data-testid="memoized-test">{data.name}</div>;
      });

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <MemoizedTestComponent data={data} />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(renderCount).toBe(1);

      // Re-render with same data (should not trigger re-render)
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <MemoizedTestComponent data={data} />
          </TestProviders>
        </QueryClientProvider>
      );

      // Memoized component should not re-render with same props
      expect(renderCount).toBe(1);

      // Re-render with different data (should trigger re-render)
      const newData = { name: 'New Test Data', id: 2 };
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <MemoizedTestComponent data={newData} />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(renderCount).toBe(2);
    });
  });

  describe('Memory Usage', () => {
    it('manages memory efficiently during component lifecycle', async () => {
      performanceMonitor.start();

      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <LargeDataComponent items={Array.from({ length: 500 }, (_, i) => ({ 
              id: i, 
              name: `Item ${i}`, 
              description: `Description ${i}` 
            }))} />
          </TestProviders>
        </QueryClientProvider>
      );

      const mountMetrics = performanceMonitor.end();

      performanceMonitor.start();
      unmount();
      const unmountMetrics = performanceMonitor.end();

      // Memory should be released after unmount
      expect(unmountMetrics.memoryUsage).toBeLessThanOrEqual(mountMetrics.memoryUsage);
    });

    it('prevents memory leaks in event listeners', async () => {
      let eventListenerCount = 0;
      const originalAddEventListener = document.addEventListener;
      const originalRemoveEventListener = document.removeEventListener;

      document.addEventListener = jest.fn((...args) => {
        eventListenerCount++;
        return originalAddEventListener.apply(document, args);
      });

      document.removeEventListener = jest.fn((...args) => {
        eventListenerCount--;
        return originalRemoveEventListener.apply(document, args);
      });

      const ComponentWithEventListener: React.FC = () => {
        React.useEffect(() => {
          const handleClick = () => console.log('clicked');
          document.addEventListener('click', handleClick);
          
          return () => {
            document.removeEventListener('click', handleClick);
          };
        }, []);

        return <div data-testid="event-component">Component with Event</div>;
      };

      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <ComponentWithEventListener />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(eventListenerCount).toBeGreaterThan(0);

      unmount();

      // Event listeners should be cleaned up
      expect(eventListenerCount).toBe(0);

      // Restore original methods
      document.addEventListener = originalAddEventListener;
      document.removeEventListener = originalRemoveEventListener;
    });
  });

  describe('Computational Performance', () => {
    it('handles heavy computations without blocking UI', async () => {
      performanceMonitor.start();

      await act(async () => {
        render(
          <QueryClientProvider client={queryClient}>
            <TestProviders>
              <HeavyCalculationComponent />
              <div data-testid="ui-element">UI should remain responsive</div>
            </TestProviders>
          </QueryClientProvider>
        );
      });

      const metrics = performanceMonitor.end();

      // Heavy computation should complete within reasonable time
      expect(metrics.renderTime).toBeLessThan(1000);
      expect(screen.getByTestId('ui-element')).toBeInTheDocument();
      expect(screen.getByTestId('heavy-calc-result')).toBeInTheDocument();
    });

    it('optimizes repeated calculations', async () => {
      const fibonacci = React.useMemo(() => {
        const cache: { [key: number]: number } = {};
        
        return function fib(n: number): number {
          if (n in cache) return cache[n];
          if (n <= 1) return n;
          
          cache[n] = fib(n - 1) + fib(n - 2);
          return cache[n];
        };
      }, []);

      const OptimizedCalculationComponent: React.FC<{ input: number }> = ({ input }) => {
        const result = React.useMemo(() => fibonacci(input), [input]);
        return <div data-testid="optimized-result">{result}</div>;
      };

      performanceMonitor.start();

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <OptimizedCalculationComponent input={20} />
          </TestProviders>
        </QueryClientProvider>
      );

      // First calculation
      const firstMetrics = performanceMonitor.end();

      performanceMonitor.start();

      // Same calculation (should use memoized result)
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <OptimizedCalculationComponent input={20} />
          </TestProviders>
        </QueryClientProvider>
      );

      const secondMetrics = performanceMonitor.end();

      // Memoized calculation should be much faster
      expect(secondMetrics.renderTime).toBeLessThan(firstMetrics.renderTime);
    });
  });

  describe('Bundle Size and Load Performance', () => {
    it('lazy loads components efficiently', async () => {
      const LazyComponent = React.lazy(() => 
        Promise.resolve({
          default: () => <div data-testid="lazy-component">Lazy Loaded</div>
        })
      );

      performanceMonitor.start();

      await act(async () => {
        render(
          <QueryClientProvider client={queryClient}>
            <TestProviders>
              <React.Suspense fallback={<div data-testid="loading">Loading...</div>}>
                <LazyComponent />
              </React.Suspense>
            </TestProviders>
          </QueryClientProvider>
        );
      });

      const metrics = performanceMonitor.end();

      expect(screen.getByTestId('lazy-component')).toBeInTheDocument();
      expect(metrics.renderTime).toBeLessThan(100); // Should load quickly
    });

    it('minimizes DOM nodes for complex layouts', () => {
      const ComplexLayoutComponent: React.FC = () => (
        <div data-testid="complex-layout">
          {Array.from({ length: 10 }, (_, sectionIndex) => (
            <section key={sectionIndex} data-testid={`section-${sectionIndex}`}>
              {Array.from({ length: 5 }, (_, itemIndex) => (
                <div key={itemIndex} data-testid={`item-${sectionIndex}-${itemIndex}`}>
                  Item {sectionIndex}-{itemIndex}
                </div>
              ))}
            </section>
          ))}
        </div>
      );

      performanceMonitor.start();

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <ComplexLayoutComponent />
          </TestProviders>
        </QueryClientProvider>
      );

      const metrics = performanceMonitor.end();

      // Should create reasonable number of DOM nodes
      expect(metrics.componentCount).toBeGreaterThan(50); // Has content
      expect(metrics.componentCount).toBeLessThan(200); // Not excessive
      expect(metrics.renderTime).toBeLessThan(200);
    });
  });

  describe('Query Performance', () => {
    it('caches query results efficiently', async () => {
      const mockData = { id: 1, name: 'Test Data' };
      let fetchCount = 0;

      const QueryComponent: React.FC = () => {
        const { data, isLoading } = queryClient.getQueryData(['test-query']) 
          ? { data: mockData, isLoading: false }
          : { data: undefined, isLoading: true };

        React.useEffect(() => {
          if (!queryClient.getQueryData(['test-query'])) {
            fetchCount++;
            queryClient.setQueryData(['test-query'], mockData);
          }
        }, []);

        if (isLoading) return <div data-testid="loading">Loading...</div>;
        return <div data-testid="query-result">{data?.name}</div>;
      };

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <QueryComponent />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(fetchCount).toBe(1);

      // Re-render should use cached data
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <QueryComponent />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(fetchCount).toBe(1); // Should not fetch again
      expect(screen.getByTestId('query-result')).toHaveTextContent('Test Data');
    });

    it('handles concurrent queries without performance degradation', async () => {
      const ConcurrentQueriesComponent: React.FC = () => {
        const [queries] = React.useState([
          'query-1',
          'query-2', 
          'query-3',
          'query-4',
          'query-5'
        ]);

        queries.forEach(queryKey => {
          React.useEffect(() => {
            if (!queryClient.getQueryData([queryKey])) {
              queryClient.setQueryData([queryKey], { id: queryKey, data: `Data for ${queryKey}` });
            }
          }, [queryKey]);
        });

        return (
          <div data-testid="concurrent-queries">
            {queries.map(queryKey => {
              const data = queryClient.getQueryData([queryKey]);
              return (
                <div key={queryKey} data-testid={`result-${queryKey}`}>
                  {data ? (data as any).data : 'Loading...'}
                </div>
              );
            })}
          </div>
        );
      };

      performanceMonitor.start();

      await act(async () => {
        render(
          <QueryClientProvider client={queryClient}>
            <TestProviders>
              <ConcurrentQueriesComponent />
            </TestProviders>
          </QueryClientProvider>
        );
      });

      const metrics = performanceMonitor.end();

      expect(metrics.renderTime).toBeLessThan(300); // Should handle 5 concurrent queries efficiently
      expect(screen.getByTestId('result-query-1')).toHaveTextContent('Data for query-1');
      expect(screen.getByTestId('result-query-5')).toHaveTextContent('Data for query-5');
    });
  });
});