import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { DataTable, type ColumnConfig } from '@/components/ui/data-table';
import { BaseDialog } from '@/components/ui/base-dialog';
import { useDeleteMutation } from '@/hooks/use-api-handler';
import { useToast } from '@/hooks/use-toast';
import { OrganizationFormDialog } from './organization-form-dialog';
import type { Organization } from '@shared/schema';

/**
 *
 */
interface OrganizationsCardProps {
  className?: string;
}

/**
 * Organizations Card Component - Refactored using reusable components
 * Reduced from 398+ lines to ~200 lines by leveraging DataTable, BaseDialog, and API hooks.
 * @param root0
 * @param root0.className
 */
/**
 * OrganizationsCard function.
 * @param root0
 * @param root0.className
 * @returns Function result.
 */
export function OrganizationsCard({ className }: OrganizationsCardProps) {
  const { toast } = useToast();
  
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const [viewingOrganization, setViewingOrganization] = useState<Organization | null>(null);

  // Data fetching
  const { data: organizations = [], isLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  // API mutations using reusable hooks
  const deleteOrganizationMutation = useDeleteMutation(
    (organizationId) => `/api/organizations/${organizationId}`,
    {
      successMessage: (data, organizationId) => {
        const org = organizations.find(o => o.id === organizationId);
        return `Organization "${org?.name || 'Unknown'}" deleted successfully`;
      },
      invalidateQueries: ['/api/organizations'],
    }
  );

  // Organization type badge styling
  const getTypeBadgeVariant = (type: string) => {
    switch (type.toLowerCase()) {
      case 'demo': return 'secondary';
      case 'koveo': return 'default';
      case 'enterprise': return 'success';
      case 'residential': return 'default';
      default: return 'outline';
    }
  };

  // Status badge styling
  const getStatusBadgeVariant = (isActive: boolean) => {
    return isActive ? 'success' : 'destructive';
  };

  // Handle organization actions
  const handleEdit = (organization: Organization) => {
    setEditingOrganization(organization);
    setIsFormDialogOpen(true);
  };

  const handleView = (organization: Organization) => {
    setViewingOrganization(organization);
  };

  const handleDelete = (organizationId: string) => {
    deleteOrganizationMutation.mutate(organizationId);
  };

  const handleAdd = () => {
    setEditingOrganization(null);
    setIsFormDialogOpen(true);
  };

  // Table column configuration
  const columns: ColumnConfig<Organization>[] = [
    {
      accessor: 'name',
      cell: (org) => (
        <div className="flex flex-col">
          <span className="font-medium">{org.name}</span>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={getTypeBadgeVariant(org.type)}>
              {org.type}
            </Badge>
            <Badge variant={getStatusBadgeVariant(org.isActive)}>
              {org.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      accessor: () => 'contact',
      cell: (org) => (
        <div className="space-y-1">
          {org.email && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" />
              {org.email}
            </div>
          )}
          {org.phone && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              {org.phone}
            </div>
          )}
          {org.website && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Globe className="h-3 w-3" />
              {org.website}
            </div>
          )}
        </div>
      ),
    },
    {
      accessor: 'address',
      cell: (org) => (
        <div className="flex items-start gap-1">
          <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            {org.address && <div>{org.address}</div>}
            {(org.city || org.province || org.postalCode) && (
              <div>
                {[org.city, org.province, org.postalCode].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessor: () => 'stats',
      cell: (org) => (
        <div className="text-sm space-y-1">
          <div>Buildings: {(org as any).buildingsCount || 0}</div>
          <div>Users: {(org as any).usersCount || 0}</div>
          <div className="text-xs text-muted-foreground">
            Created: {new Date(org.createdAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      accessor: () => 'actions',
      cell: (org) => (
        <OrganizationActions
          organization={org}
          onEdit={handleEdit}
          onView={handleView}
          onDelete={handleDelete}
        />
      ),
    },
  ];

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'All Organizations' },
    { value: 'demo', label: 'Demo' },
    { value: 'koveo', label: 'Koveo' },
    { value: 'enterprise', label: 'Enterprise' },
    { value: 'residential', label: 'Residential' },
  ];

  const statusFilterOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active Only' },
    { value: 'inactive', label: 'Inactive Only' },
  ];

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Organizations ({organizations.length})
            </CardTitle>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Organization
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={organizations as any}
            columns={columns as any}
            enableSearch={true}
            filterableColumns={[
              {
                id: 'type',
                title: 'Type',
                options: filterOptions,
              },
              {
                id: 'isActive',
                title: 'Status',
                options: statusFilterOptions,
                filterFn: (row, columnId, value) => {
                  if (value === 'all') {return true;}
                  if (value === 'active') {return row.getValue(columnId) === true;}
                  if (value === 'inactive') {return row.getValue(columnId) === false;}
                  return true;
                },
              },
            ]}
            isLoading={isLoading}
            initialPageSize={10}
            emptyStateMessage="No organizations found"
          />
        </CardContent>
      </Card>

      {/* Organization Form Dialog */}
      <OrganizationFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        organization={editingOrganization}
        onSuccess={() => {
          setIsFormDialogOpen(false);
          setEditingOrganization(null);
        }}
      />

      {/* Organization Details Dialog */}
      <BaseDialog
        open={!!viewingOrganization}
        onOpenChange={(open) => !open && setViewingOrganization(null)}
        title={viewingOrganization?.name || 'Organization Details'}
        description="Organization information and statistics"
        maxWidth="2xl"
        showFooter={false}
      >
        {viewingOrganization && <OrganizationDetails organization={viewingOrganization} />}
      </BaseDialog>
    </div>
  );
}

// Actions dropdown for individual organizations
/**
 *
 */
interface OrganizationActionsProps {
  organization: Organization;
  onEdit: (org: Organization) => void;
  onView: (org: Organization) => void;
  onDelete: (id: string) => void;
}

/**
 *
 * @param root0
 * @param root0.organization
 * @param root0.onEdit
 * @param root0.onView
 * @param root0.onDelete
 */
/**
 * OrganizationActions function.
 * @param root0
 * @param root0.organization
 * @param root0.onEdit
 * @param root0.onView
 * @param root0.onDelete
 * @returns Function result.
 */
function OrganizationActions({ organization, onEdit, onView, onDelete }: OrganizationActionsProps) {
  const canDelete = organization.type !== 'koveo' && organization.type !== 'demo';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(organization)}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(organization)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit Organization
        </DropdownMenuItem>
        {canDelete && (
          <DropdownMenuItem 
            onClick={() => onDelete(organization.id)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Organization
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Organization details component for the view dialog
/**
 *
 */
interface OrganizationDetailsProps {
  organization: Organization;
}

/**
 *
 * @param root0
 * @param root0.organization
 */
/**
 * OrganizationDetails function.
 * @param root0
 * @param root0.organization
 * @returns Function result.
 */
function OrganizationDetails({ organization }: OrganizationDetailsProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Organization Name</label>
              <p className="text-sm">{organization.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type</label>
              <div className="mt-1">
                <Badge variant={organization.type === 'demo' ? 'secondary' : 'default'}>
                  {organization.type}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge variant={organization.isActive ? 'success' : 'destructive'}>
                  {organization.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {organization.contactEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{organization.contactEmail}</span>
              </div>
            )}
            {organization.contactPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{organization.contactPhone}</span>
              </div>
            )}
            {organization.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{organization.website}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                {organization.address && <div>{organization.address}</div>}
                {(organization.city || organization.province || organization.postalCode) && (
                  <div className="text-muted-foreground">
                    {[organization.city, organization.province, organization.postalCode]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Buildings</label>
              <p className="text-2xl font-bold">{organization.buildingsCount || 0}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Users</label>
              <p className="text-2xl font-bold">{organization.usersCount || 0}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm">{new Date(organization.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}