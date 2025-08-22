import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';

/**
 * Configuration for API mutation hooks.
 */
interface ApiMutationConfig<TData = unknown, TError = Error, TVariables = void> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string | ((_variables: TVariables) => string);
  successMessage?: string | ((_data: TData, _variables: TVariables) => string);
  errorMessage?: string | ((_error: TError, _variables: TVariables) => string);
  invalidateQueries?: string[];
  onSuccessCallback?: (_data: TData, _variables: TVariables) => void | Promise<void>;
  onErrorCallback?: (_error: TError, _variables: TVariables) => void | Promise<void>;
  transformData?: (_variables: TVariables) => unknown;
}

/**
 * Custom hook for standardized API mutations.
 * 
 * Provides consistent error handling, success messages, cache invalidation,
 * and loading states across all API operations to reduce boilerplate code.
 * 
 * @param config - API mutation configuration.
 * @returns Mutation hook with standardized behavior.
 */
/**
 * UseApiMutation function.
 * @param config
 * @returns Function result.
 */
export function useApiMutation<TData = unknown, TError = Error, TVariables = void>(
  config: ApiMutationConfig<TData, TError, TVariables>
) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<TData, TError, TVariables>({
    mutationFn: async (variables: TVariables) => {
      const endpoint = typeof config.endpoint === 'function' 
        ? config.  /**
   * Endpoint function.
   * @param variables - variables parameter.
   * @returns config.endpoint;
      
      const requestData = config.transformData 
        ? config.transformData(variables) 
        : variables;

      const response = await apiRequest(config.method, endpoint, requestData);
      
      // Handle different response types
      if (config.method === 'DELETE' && response.status === 204) result.
   */
endpoint(variables) 
        : config.endpoint;
      
      const requestData = config.transformData 
        ? config.transformData(variables) 
        : variables;

      const response = await apiRequest(config.method, endpoint, requestData);
      
      // Handle different response types
      if (config.method === 'DELETE' && response.status === 204) {
        return null as TData;
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json() as Promise<TData>;
      }
      
      return response.text() as unknown as TData;
    },
    onSuccess: async (data: TData, variables: TVariables) => {
      // Show success message  /**
   * If function.
   * @param config.successMessage - config.successMessage parameter.
   */

      if (config.successMessage) {
        const message = typeof config.successMessage === 'function'
          ? config.  /**
   * Success message function.
   * @param data - Data object to process.
   * @param variables - variables parameter.
   * @returns config.successMessage;
        
        toast( result.
   */
successMessage(data, variables)
          : config.successMessage;
        
        toast({
          title: 'Success',
          description: message,
        });
      }

      // Invalidate specified queries  /**
   * If function.
   * @param config.invalidateQueries - config.invalidateQueries parameter.
   */

      if (config.invalidateQueries) {  /**
   * For function.
   * @param const queryKey of config.invalidateQueries - const queryKey of config.invalidateQueries parameter.
   */

        for (const queryKey of config.invalidateQueries) {
          await queryClient.invalidateQueries({ queryKey: [queryKey] });
        }
      }

      // Execute success callback  /**
   * If function.
   * @param config.onSuccessCallback - config.onSuccessCallback parameter.
   */

      if (config.onSuccessCallback) {
        await config.onSuccessCallback(data, variables);
      }
    },
    onError: async (error: TError, variables: TVariables) => {
      // Show error message
      const message = config.errorMessage
        ? typeof config.errorMessage === 'function'
          ? config.  /**
   * Error message function.
   * @param error - Error object.
   * @param variables - variables parameter.
   * @returns config.errorMessage
        : (error as Error).message || 'Unknown error occurred';

      toast( result.
   */
errorMessage(error, variables)
          : config.errorMessage
        : (error as Error).message || 'Unknown error occurred';

      toast({
        title: t('error'),
        description: message,
        variant: 'destructive',
      });

      // Execute error callback  /**
   * If function.
   * @param config.onErrorCallback - config.onErrorCallback parameter.
   */

      if (config.onErrorCallback) {
        await config.onErrorCallback(error, variables);
      }
    },
  });
}

/**
 * Pre-configured mutation hooks for common operations.
 */

/**
 * Hook for create operations.
 * @param endpoint - API endpoint for creation.
 * @param options - Additional configuration options.
 * @returns Mutation hook for create operations.
 */
/**
 * UseCreateMutation function.
 * @param endpoint
 * @param options
 * @returns Function result.
 */
export function useCreateMutation<TData = unknown, TVariables = unknown>(
  endpoint: string,
  options?: Partial<ApiMutationConfig<TData, Error, TVariables>>
) {
  return useApiMutation<TData, Error, TVariables>({
    method: 'POST',
    endpoint,
    successMessage: 'Item created successfully',
    ...options,
  });
}

/**
 * Hook for update operations.
 * @param endpoint - API endpoint for updates.
 * @param options - Additional configuration options.
 * @returns Mutation hook for update operations.
 */
/**
 * UseUpdateMutation function.
 * @param endpoint
 * @param options
 * @returns Function result.
 */
export function useUpdateMutation<TData = unknown, TVariables = unknown>(
  endpoint: string | ((_variables: TVariables) => string),
  options?: Partial<ApiMutationConfig<TData, Error, TVariables>>
) {
  return useApiMutation<TData, Error, TVariables>({
    method: 'PUT',
    endpoint,
    successMessage: 'Item updated successfully',
    ...options,
  });
}

/**
 * Hook for delete operations.
 * @param endpoint - API endpoint for deletions.
 * @param options - Additional configuration options.
 * @returns Mutation hook for delete operations.
 */
/**
 * UseDeleteMutation function.
 * @param endpoint
 * @param options
 * @returns Function result.
 */
export function useDeleteMutation<TVariables = string>(
  endpoint: string | ((_id: TVariables) => string),
  options?: Partial<ApiMutationConfig<void, Error, TVariables>>
) {
  return useApiMutation<void, Error, TVariables>({
    method: 'DELETE',
    endpoint,
    successMessage: 'Item deleted successfully',
    ...options,
  });
}

/**
 * Hook for bulk operations.
 * @param endpoint - API endpoint for bulk operations.
 * @param options - Additional configuration options.
 * @returns Mutation hook for bulk operations.
 */
/**
 * UseBulkMutation function.
 * @param endpoint
 * @param options
 * @returns Function result.
 */
export function useBulkMutation<TData = unknown, TVariables = unknown>(
  endpoint: string,
  options?: Partial<ApiMutationConfig<TData, Error, TVariables>>
) {
  return useApiMutation<TData, Error, TVariables>({
    method: 'POST',
    endpoint,
    successMessage: 'Bulk operation completed successfully',
    ...options,
  });
}