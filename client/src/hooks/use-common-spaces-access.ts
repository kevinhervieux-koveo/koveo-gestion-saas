import { useQuery } from '@tanstack/react-query';

interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
}

/**
 * Hook to check if user has access to buildings with common spaces.
 * Used for conditional navigation display.
 */
export function useCommonSpacesAccess() {
  const {
    data: buildingsWithCommonSpaces = [],
    isLoading,
    error,
  } = useQuery<Building[]>({
    queryKey: ['/api/users/me/buildings', { has_common_spaces: true }],
    queryFn: async () => {
      const response = await fetch('/api/users/me/buildings?has_common_spaces=true');
      if (!response.ok) {
        throw new Error('Failed to fetch buildings with common spaces');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    buildingsWithCommonSpaces,
    hasCommonSpacesAccess: buildingsWithCommonSpaces.length > 0,
    isLoading,
    error,
  };
}