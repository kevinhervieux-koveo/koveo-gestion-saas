import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  // AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Building, 
  Plus, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye,
  MapPin,
  Phone,
  Mail,
  Globe
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { OrganizationFormDialog } from './organization-form-dialog';
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog';
import type { Organization } from '@shared/schema';

/**
 * Props interface for OrganizationsCard component.
 */
interface OrganizationsCardProps {
  className?: string;
}

/**
 * Organizations Card component displays and manages organization data.
 * @param props - Component props
 * @param props.className - Optional CSS class name for styling
 * @returns JSX element for the organizations card component
 */
export function OrganizationsCard({ className }: OrganizationsCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const [deletingOrganization, setDeletingOrganization] = useState<Organization | null>(null);
  const [viewingOrganization, setViewingOrganization] = useState<Organization | null>(null);

  // Fetch organizations
  const { data: organizations, isLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/organizations');
      return response.json();
    },
  });

  // Delete organization mutation
  const deleteMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      return apiRequest('DELETE', `/api/organizations/${organizationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
      toast({
        title: 'Organization Deleted',
        description: 'Organization deleted successfully',
      });
      setDeletingOrganization(null);
    },
    onError: (_error: Error) => {
      toast({
        title: 'Error',
        description: _error.message || 'Failed to delete organization',
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (organization: Organization) => {
    setEditingOrganization(organization);
    setIsFormDialogOpen(true);
  };

  const handleView = (organization: Organization) => {
    setViewingOrganization(organization);
  };

  const handleDelete = (organization: Organization) => {
    setDeletingOrganization(organization);
  };

  const confirmDelete = () => {
    if (deletingOrganization) {
      deleteMutation.mutate(deletingOrganization.id);
    }
  };

  const handleCreateNew = () => {
    setEditingOrganization(null);
    setIsFormDialogOpen(true);
  };

  const handleFormClose = () => {
    setIsFormDialogOpen(false);
    setEditingOrganization(null);
  };

  const getOrganizationTypeColor = (type: string) => {
    switch (type) {
      case 'management_company':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'syndicate':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'cooperative':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatTypeName = (type: string) => {
    switch (type) {
      case 'management_company':
        return 'Management Company';
      case 'syndicate':
        return 'Syndicate';
      case 'cooperative':
        return 'Cooperative';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building className="h-4 w-4" />
            Organizations
          </CardTitle>
          <Button size="sm" onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Building className="h-5 w-5" />
            Organizations
          </CardTitle>
          <Button size="sm" onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!organizations || organizations.length === 0 ? (
            <div className="text-center py-8">
              <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No organizations found</p>
              <Button onClick={handleCreateNew} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create First Organization
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {organizations.map((organization) => (
                <div
                  key={organization.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-lg">{organization.name}</h4>
                        <Badge className={getOrganizationTypeColor(organization.type)}>
                          {formatTypeName(organization.type)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{organization.city}, {organization.province}</span>
                        </div>
                        {organization.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{organization.phone}</span>
                          </div>
                        )}
                        {organization.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span>{organization.email}</span>
                          </div>
                        )}
                        {organization.website && (
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            <span>{organization.website}</span>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {organization.address}
                      </p>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(organization)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(organization)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(organization)}
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Organization Form Dialog */}
      <OrganizationFormDialog
        open={isFormDialogOpen}
        onOpenChange={handleFormClose}
        organization={editingOrganization}
        onSuccess={() => {
          setIsFormDialogOpen(false);
          setEditingOrganization(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      {deletingOrganization && (
        <DeleteConfirmationDialog
          open={!!deletingOrganization}
          onOpenChange={(open) => !open && setDeletingOrganization(null)}
          entityType="organization"
          entityId={deletingOrganization.id}
          entityName={deletingOrganization.name}
          onConfirm={confirmDelete}
          isDeleting={deleteMutation.isPending}
        />
      )}

      {/* View Organization Dialog */}
      {viewingOrganization && (
        <AlertDialog 
          open={!!viewingOrganization} 
          onOpenChange={() => setViewingOrganization(null)}
        >
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                {viewingOrganization.name}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Type
                  </label>
                  <Badge className={getOrganizationTypeColor(viewingOrganization.type)}>
                    {formatTypeName(viewingOrganization.type)}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </label>
                  <Badge variant={viewingOrganization.isActive ? 'default' : 'secondary'}>
                    {viewingOrganization.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Address
                </label>
                <p className="mt-1">
                  {viewingOrganization.address}<br />
                  {viewingOrganization.city}, {viewingOrganization.province} {viewingOrganization.postalCode}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {viewingOrganization.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Phone
                    </label>
                    <p className="mt-1">{viewingOrganization.phone}</p>
                  </div>
                )}
                {viewingOrganization.email && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Email
                    </label>
                    <p className="mt-1">{viewingOrganization.email}</p>
                  </div>
                )}
              </div>
              
              {viewingOrganization.website && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Website
                  </label>
                  <p className="mt-1">
                    <a 
                      href={viewingOrganization.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                    >
                      {viewingOrganization.website}
                    </a>
                  </p>
                </div>
              )}
              
              {viewingOrganization.registrationNumber && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Registration Number
                  </label>
                  <p className="mt-1">{viewingOrganization.registrationNumber}</p>
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                setViewingOrganization(null);
                handleEdit(viewingOrganization);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}