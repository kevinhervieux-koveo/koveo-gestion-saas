import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { hasRoleOrHigher } from '@/config/navigation';
import {
  BuildingData,
  Organization,
  BuildingFormData,
  buildingFormSchema,
} from '@/components/buildings/types';

/**
 * Custom hook for managing buildings data and operations.
 */
/**
 * UseBuildings function.
 * @returns Function result.
 */
/**
 * UseBuildings custom hook.
 * @returns Hook return value.
 */
/**
 * Use buildings function.
 */
export function /**
 * Use buildings function.
 */ /**
 * Use buildings function.
 */

useBuildings() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<BuildingData | null>(null);
  const [deletingBuilding, setDeletingBuilding] = useState<BuildingData | null>(null);

  // Form for creating new building
  const form = useForm<BuildingFormData>({
    resolver: zodResolver(buildingFormSchema),
    defaultValues: {
      name: '',
      organizationId: '',
      address: '',
      city: '',
      province: 'QC',
      postalCode: '',
      buildingType: 'condo',
      yearBuilt: undefined,
      totalUnits: undefined,
      totalFloors: undefined,
      parkingSpaces: undefined,
      storageSpaces: undefined,
      managementCompany: '',
    },
  });

  // Form for editing building
  const editForm = useForm<BuildingFormData>({
    resolver: zodResolver(buildingFormSchema),
    defaultValues: {
      name: '',
      organizationId: '',
      address: '',
      city: '',
      province: 'QC',
      postalCode: '',
      buildingType: 'condo',
      yearBuilt: undefined,
      totalUnits: undefined,
      totalFloors: undefined,
      parkingSpaces: undefined,
      storageSpaces: undefined,
      managementCompany: '',
    },
  });

  // Fetch buildings data
  const {
    _data: buildingsResponse,
    isLoading,
    error,
  } = useQuery<{ buildings: BuildingData[] }>({
    queryKey: ['/api/manager/buildings'],
    enabled: isAuthenticated && hasRoleOrHigher(user?.role, 'manager'),
  });

  // Fetch organizations for admin users
  const { _data: organizationsResponse } = useQuery<{ organizations: Organization[] }>({
    queryKey: ['/api/admin/organizations'],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  // Mutation for creating building
  const createBuildingMutation = useMutation({
    mutationFn: async (_data: BuildingFormData) => {
      const response = await fetch('/api/admin/buildings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      }); /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */
      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */
      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */ /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */

      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */
      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create building');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Building created',
        description: 'The building has been successfully created.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/manager/buildings'] });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (_error: unknown) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create building.',
        variant: 'destructive',
      });
    },
  });

  // Mutation for updating building
  const updateBuildingMutation = useMutation({
    mutationFn: async (_data: BuildingFormData & { id: string }) => {
      const response = await fetch(`/api/admin/buildings/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update building');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Building updated',
        description: 'The building has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/manager/buildings'] });
      setIsEditDialogOpen(false);
      setEditingBuilding(null);
      editForm.reset();
    },
    onError: (_error: unknown) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update building.',
        variant: 'destructive',
      });
    },
  });

  // Mutation for deleting building
  const deleteBuildingMutation = useMutation({
    mutationFn: async (buildingId: string) => {
      const response = await fetch(`/api/admin/buildings/${buildingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete building');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Building deleted',
        description: 'The building has been successfully deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/manager/buildings'] });
    },
    onError: (_error: unknown) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete building.',
        variant: 'destructive',
      });
    },
  });

  // Event handlers
  const handleCreateBuilding = (_data: BuildingFormData) => {
    createBuildingMutation.mutate(_data);
  };

  const handleEditBuilding = (building: BuildingData) => {
    setEditingBuilding(building);
    editForm.reset({
      name: building.name,
      organizationId: building.organizationId,
      address: building.address,
      city: building.city,
      province: building.province,
      postalCode: building.postalCode,
      buildingType: building.buildingType,
      yearBuilt: building.yearBuilt,
      totalUnits: building.totalUnits,
      totalFloors: building.totalFloors,
      parkingSpaces: building.parkingSpaces,
      storageSpaces: building.storageSpaces,
      managementCompany: building.managementCompany,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateBuilding = (_data: BuildingFormData) => {
    /**
     * If function.
     * @param editingBuilding - EditingBuilding parameter.
     */ /**
     * If function.
     * @param editingBuilding - EditingBuilding parameter.
     */

    if (editingBuilding) {
      updateBuildingMutation.mutate({ id: editingBuilding.id, ...data });
    }
  };

  const handleDeleteBuilding = (building: BuildingData) => {
    setDeletingBuilding(building);
  };

  const confirmDeleteBuilding = () => {
    /**
     * If function.
     * @param deletingBuilding - DeletingBuilding parameter.
     */ /**
     * If function.
     * @param deletingBuilding - DeletingBuilding parameter.
     */

    if (deletingBuilding) {
      deleteBuildingMutation.mutate(deletingBuilding.id);
      setDeletingBuilding(null);
    }
  };

  return {
    // Data
    buildings: buildingsResponse?.buildings || [],
    organizations: organizationsResponse?.organizations || [],
    isLoading,
    error,

    // Forms
    form,
    editForm,

    // State
    isAddDialogOpen,
    setIsAddDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    editingBuilding,
    deletingBuilding,
    setDeletingBuilding,

    // Mutations
    createBuildingMutation,
    updateBuildingMutation,
    deleteBuildingMutation,

    // Handlers
    handleCreateBuilding,
    handleEditBuilding,
    handleUpdateBuilding,
    handleDeleteBuilding,
    confirmDeleteBuilding,
  };
}
