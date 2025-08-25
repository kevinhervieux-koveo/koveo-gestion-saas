import { apiRequest } from './queryClient';
import { toast } from '@/hooks/use-toast';

// Common API response patterns
/**
 *
 */
export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  success: boolean;
  error?: string;
}

// Common API error handling
/**
 *
 */
export class ApiError extends Error {
  /**
   *
   * @param message
   * @param status
   * @param code
   */
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// CRUD operation helpers
export const crudHelpers = {
  // Generic create operation
  create: async <T, U = T>(
    endpoint: string,
    data: Partial<T>,
    options?: {
      onSuccess?: (response: U) => void;
      onError?: (error: any) => void;
      showSuccessToast?: boolean;
      successMessage?: string;
    }
  ): Promise<U> => {
    try {
      const response = await apiRequest('POST', endpoint, data) as U;
      
      if (options?.showSuccessToast !== false) {
        toast({
          title: 'Success',
          description: options?.successMessage || 'Item created successfully',
        });
      }
      
      options?.onSuccess?.(response);
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to create item';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      
      options?.onError?.(error);
      throw new ApiError(errorMessage, error.status);
    }
  },

  // Generic update operation
  update: async <T, U = T>(
    endpoint: string,
    id: string,
    data: Partial<T>,
    options?: {
      onSuccess?: (response: U) => void;
      onError?: (error: any) => void;
      showSuccessToast?: boolean;
      successMessage?: string;
    }
  ): Promise<U> => {
    try {
      const response = await apiRequest('PUT', `${endpoint}/${id}`, data) as U;
      
      if (options?.showSuccessToast !== false) {
        toast({
          title: 'Success',
          description: options?.successMessage || 'Item updated successfully',
        });
      }
      
      options?.onSuccess?.(response);
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update item';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      
      options?.onError?.(error);
      throw new ApiError(errorMessage, error.status);
    }
  },

  // Generic delete operation
  delete: async (
    endpoint: string,
    id: string,
    options?: {
      onSuccess?: () => void;
      onError?: (error: any) => void;
      showSuccessToast?: boolean;
      successMessage?: string;
      confirmMessage?: string;
    }
  ): Promise<void> => {
    // Show confirmation dialog if message provided
    if (options?.confirmMessage) {
      const confirmed = window.confirm(options.confirmMessage);
      if (!confirmed) {return;}
    }

    try {
      await apiRequest('DELETE', `${endpoint}/${id}`);
      
      if (options?.showSuccessToast !== false) {
        toast({
          title: 'Success',
          description: options?.successMessage || 'Item deleted successfully',
        });
      }
      
      options?.onSuccess?.();
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to delete item';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      
      options?.onError?.(error);
      throw new ApiError(errorMessage, error.status);
    }
  },

  // Generic fetch operation
  fetch: async <T>(
    endpoint: string,
    options?: {
      onError?: (error: any) => void;
      showErrorToast?: boolean;
    }
  ): Promise<T> => {
    try {
      return await apiRequest('GET', endpoint) as T;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to fetch data';
      
      if (options?.showErrorToast !== false) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      
      options?.onError?.(error);
      throw new ApiError(errorMessage, error.status);
    }
  },
};

// Query key helpers for React Query
export const queryKeys = {
  // Generate consistent query keys
  all: (resource: string) => [resource] as const,
  lists: (resource: string) => [...queryKeys.all(resource), 'list'] as const,
  list: (resource: string, filters?: Record<string, any>) => 
    [...queryKeys.lists(resource), filters] as const,
  details: (resource: string) => [...queryKeys.all(resource), 'detail'] as const,
  detail: (resource: string, id: string) => 
    [...queryKeys.details(resource), id] as const,
  
  // Common resource query keys
  users: {
    all: () => queryKeys.all('/api/users'),
    list: (filters?: any) => queryKeys.list('/api/users', filters),
    detail: (id: string) => queryKeys.detail('/api/users', id),
  },
  
  buildings: {
    all: () => queryKeys.all('/api/buildings'),
    list: (filters?: any) => queryKeys.list('/api/buildings', filters),
    detail: (id: string) => queryKeys.detail('/api/buildings', id),
  },
  
  residences: {
    all: () => queryKeys.all('/api/residences'),
    list: (filters?: any) => queryKeys.list('/api/residences', filters),
    detail: (id: string) => queryKeys.detail('/api/residences', id),
  },
  
  demands: {
    all: () => queryKeys.all('/api/demands'),
    list: (filters?: any) => queryKeys.list('/api/demands', filters),
    detail: (id: string) => queryKeys.detail('/api/demands', id),
  },
  
  bills: {
    all: () => queryKeys.all('/api/bills'),
    list: (filters?: any) => queryKeys.list('/api/bills', filters),
    detail: (id: string) => queryKeys.detail('/api/bills', id),
  },
  
  documents: {
    all: () => queryKeys.all('/api/documents'),
    byBuilding: (buildingId: string) => [...queryKeys.all('/api/documents'), 'building', buildingId] as const,
    byResidence: (residenceId: string) => [...queryKeys.all('/api/documents'), 'residence', residenceId] as const,
  },
};

// Mutation helpers
export const mutationHelpers = {
  // Create standard mutation configuration
  createMutation: <TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: {
      onSuccess?: (data: TData, variables: TVariables) => void;
      onError?: (error: any, variables: TVariables) => void;
      invalidateQueries?: string[][];
      showToast?: boolean;
      successMessage?: string;
    }
  ) => ({
    mutationFn,
    onSuccess: (data: TData, variables: TVariables) => {
      // Invalidate queries if specified
      if (options?.invalidateQueries) {
        // Note: This would need to be implemented with actual queryClient
        // options.invalidateQueries.forEach(queryKey => queryClient.invalidateQueries({ queryKey }));
      }
      
      if (options?.showToast !== false) {
        toast({
          title: 'Success',
          description: options?.successMessage || 'Operation completed successfully',
        });
      }
      
      options?.onSuccess?.(data, variables);
    },
    onError: (error: any, variables: TVariables) => {
      toast({
        title: 'Error',
        description: error.message || 'Operation failed',
        variant: 'destructive',
      });
      
      options?.onError?.(error, variables);
    },
  }),
};

// URL parameter helpers
export const urlHelpers = {
  // Build query string from object
  buildQueryString: (params: Record<string, any>): string => {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v.toString()));
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  },

  // Parse query string to object
  parseQueryString: (queryString: string): Record<string, string | string[]> => {
    const params = new URLSearchParams(queryString);
    const result: Record<string, string | string[]> = {};
    
    for (const [key, value] of params.entries()) {
      if (result[key]) {
        // Convert to array if multiple values
        if (Array.isArray(result[key])) {
          (result[key] as string[]).push(value);
        } else {
          result[key] = [result[key] as string, value];
        }
      } else {
        result[key] = value;
      }
    }
    
    return result;
  },
};

// Polling helpers
export const pollingHelpers = {
  // Create polling configuration
  createPollingConfig: (intervalMs = 30000, enabled = true) => ({
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    enabled,
  }),

  // Common polling intervals
  intervals: {
    fast: 5000, // 5 seconds
    normal: 30000, // 30 seconds  
    slow: 60000, // 1 minute
  },
};

// Export main helpers
export {
  crudHelpers as default,
  queryKeys,
  mutationHelpers,
  urlHelpers,
  pollingHelpers,
  ApiError,
};