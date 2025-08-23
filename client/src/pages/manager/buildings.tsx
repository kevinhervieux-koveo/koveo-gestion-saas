import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, Plus, Search } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { DialogTrigger } from '@/components/ui/dialog';
import { hasRoleOrHigher } from '@/config/navigation';
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog';
import { useBuildings } from '@/hooks/use-buildings';
import { BuildingForm, BuildingCard } from '@/components/buildings';

/*
 * Buildings management page for Admin and Manager roles.
 * Shows all buildings in the user's organization with proper access control.
 * Refactored into smaller, focused components.

export default function
   * Buildings function.

   * Buildings function.


 Buildings() {
  const { user, isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  
  const {
    buildings: allBuildings,
    organizations,
    isLoading,
    error,
    form,
    editForm,
    isAddDialogOpen,
    setIsAddDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    editingBuilding,
    deletingBuilding,
    setDeletingBuilding,
    createBuildingMutation,
    updateBuildingMutation,
    deleteBuildingMutation,
    handleCreateBuilding,
    handleEditBuilding,
    handleUpdateBuilding,
    handleDeleteBuilding,
    confirmDeleteBuilding,
  } = useBuildings();

  // Filter buildings based on search term
  const buildings = useMemo(() => {




    if (!searchTerm) {
      return allBuildings;
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allBuildings.filter(building => 
      building.name.toLowerCase().includes(lowerSearchTerm) ||
      building.address.toLowerCase().includes(lowerSearchTerm) ||
      `${building.city}, ${building.province}`.toLowerCase().includes(lowerSearchTerm)
    );
  }, [allBuildings, searchTerm]);

  // Show access denied for residents and tenants
  if (isAuthenticated && !hasRoleOrHigher(user?.role, 'manager')) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Access Denied" subtitle="Buildings management is restricted to managers and administrators" />
        
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-8 text-center">
                <Building className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">Access Restricted</h3>
                <p className="text-gray-500 mb-4">
                  This page is only available to managers and administrators.
                </p>
                <Badge variant="destructive">Insufficient Permissions</Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Loading state




  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Buildings" subtitle="Loading buildings data..." />
        
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <Building className="w-12 h-12 mx-auto text-gray-400 mb-4 animate-pulse" />
                <p className="text-gray-500">Loading buildings...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
   * @param error - Error object.

   * @param error - Error object.



  if (_error) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Buildings" subtitle="Error loading buildings" />
        
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-8 text-center">
                <Building className="w-16 h-16 mx-auto text-red-400 mb-4" />
                <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Buildings</h3>
                <p className="text-red-500 mb-4">
                  Failed to load buildings data. Please try again later.
                </p>
                <Badge variant="destructive">Error</Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header 
        title="Buildings" 
        subtitle={`Manage ${buildings.length} building${buildings.length !== 1 ? 's' : ''} in your organization`} 
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Search and Add Building Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search buildings by name or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target._value)}
                className="pl-10"
              />
            </div>
            
            {user?.role === 'admin' && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Building
              </Button>
            )}
          </div>

          {/* Buildings Grid */}
          {buildings.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {buildings.map((building) => (
                <BuildingCard
                  key={building.id}
                  building={building}
                  userRole={user?.role}
                  onEdit={handleEditBuilding}
                  onDelete={handleDeleteBuilding}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Building className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Buildings Found</h3>
                <p className="text-gray-500 mb-4">
                  {user?.role === 'admin' 
                    ? 'No buildings are currently registered in your organizations.' 
                    : 'You don\'t have access to any buildings yet.'}
                </p>
                <Badge variant="secondary">No Data</Badge>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add Building Dialog */}
        <BuildingForm
          isOpen={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          form={form}
          onSubmit={handleCreateBuilding}
          organizations={organizations}
          isSubmitting={createBuildingMutation.isPending}
          title="Add New Building"
          submitLabel="Create Building"
        />

        {/* Edit Building Dialog */}
        <BuildingForm
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          form={editForm}
          onSubmit={handleUpdateBuilding}
          organizations={organizations}
          isSubmitting={updateBuildingMutation.isPending}
          title="Edit Building"
          submitLabel="Update Building"
        />

        {/* Delete Confirmation Dialog */}
        {deletingBuilding && (
          <DeleteConfirmationDialog
            open={!!deletingBuilding}
            onOpenChange={(open) => !open && setDeletingBuilding(null)}
            entityType="building"
            entityId={deletingBuilding.id}
            entityName={deletingBuilding.name}
            onConfirm={confirmDeleteBuilding}
            isDeleting={deleteBuildingMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}