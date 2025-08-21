import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLanguage } from '@/hooks/use-language';
import { Shield, Users, Settings, Plus, Search, Filter, Edit, Save, X, Check, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Permissions config reference for display purposes
const permissionsConfig = {
  admin: { length: 148 },
  manager: { length: 70 }, 
  tenant: { length: 9 },
  resident: { length: 9 }
};

/**
 *
 */
interface Permission {
  id: string;
  name: string;
  displayName: string;
  description: string;
  resourceType: string;
  action: string;
  isActive: boolean;
  createdAt: string;
}

/**
 *
 */
interface RolePermission {
  id: string;
  role: string;
  permissionId: string;
  permission?: Permission;
  grantedBy: string;
  grantedAt: string;
}

/**
 *
 */
interface UserPermission {
  id: string;
  userId: string;
  permissionId: string;
  permission?: Permission;
  granted: boolean;
  grantedBy: string;
  reason?: string;
  grantedAt: string;
}

/**
 *
 */
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

/**
 * RBAC Permissions Management Page
 * Shows actual permissions being used in the platform and provides management capabilities.
 */
export default function Permissions() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [showNewPermissionForm, setShowNewPermissionForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Fetch permissions matrix (includes all permission data grouped by resource)
  const { data: permissionsMatrix, isLoading: matrixLoading } = useQuery<{
    permissionsByResource: Record<string, Permission[]>;
    roleMatrix: Record<string, string[]>;
    permissions: Permission[];
    rolePermissions: RolePermission[];
  }>({
    queryKey: ['/api/permissions-matrix'],
  });

  // Fetch user permissions
  const { data: userPermissions, isLoading: userPermissionsLoading } = useQuery<UserPermission[]>({
    queryKey: ['/api/user-permissions'],
  });

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const isLoading = matrixLoading || userPermissionsLoading || usersLoading;

  // Extract data from matrix
  const permissions = permissionsMatrix?.permissions || [];
  const rolePermissions = permissionsMatrix?.rolePermissions || [];
  const permissionsByResource = permissionsMatrix?.permissionsByResource || {};
  const roleMatrix = permissionsMatrix?.roleMatrix || {};

  // Group permissions by role for backward compatibility
  const permissionsByRole = rolePermissions.reduce((acc, rp) => {
    if (!acc[rp.role]) {acc[rp.role] = [];}
    acc[rp.role].push(rp);
    return acc;
  }, {} as Record<string, RolePermission[]>);

  // Available roles (now from actual RBAC system)
  const roles = ['admin', 'manager', 'tenant', 'resident'];
  
  // Fetch permission categories for filtering
  const { data: permissionCategories } = useQuery<any[]>({
    queryKey: ['/api/permission-categories'],
  });
  
  // Get unique categories from permissions
  const categories = permissionCategories?.map(cat => cat.name) || [];

  // Filter users based on search and role
  const filteredUsers = users?.filter(user => {
    const matchesSearch = searchQuery === '' || 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  }) || [];

  // Pagination calculations
  const totalUsers = filteredUsers.length;
  const totalPages = Math.ceil(totalUsers / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleRoleChange = (value: string) => {
    setFilterRole(value);
    setCurrentPage(1);
  };
  
  // Set default category to first available category if none selected
  useEffect(() => {
    const availableCategories = Object.keys(permissionsByResource);
    if (!selectedCategory && availableCategories.length > 0) {
      setSelectedCategory(availableCategories[0]);
    }
  }, [permissionsByResource, selectedCategory]);

  // Filter permissions by category
  const filteredPermissions = permissions?.filter(permission => {
    if (!selectedCategory) {return false;}
    return permission.resourceType === selectedCategory;
  }) || [];

  // Mutations for managing permissions
  const grantUserPermissionMutation = useMutation({
    mutationFn: (data: { userId: string; permissionId: string; reason?: string }) => 
      apiRequest('POST', '/api/user-permissions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-permissions'] });
      toast({
        title: 'Permission Granted',
        description: 'User permission has been successfully granted.'
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to grant permission',
        variant: 'destructive'
      });
    }
  });

  const validatePermissionMutation = useMutation({
    mutationFn: (permission: string) => 
      apiRequest('POST', '/api/permissions/validate', { permission }),
    onSuccess: (data: unknown) => {
      toast({
        title: 'Permission Validation',
        description: `${data.message} for role: ${data.role}`,
        variant: data.hasPermission ? 'default' : 'destructive'
      });
    }
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header 
        title="RBAC Permissions" 
        subtitle="Manage role-based access control and user permissions" 
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="hover:shadow-md transition-shadow cursor-pointer" 
                  onClick={() => setActiveTab('permissions')}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">System Permissions</p>
                    <p className="text-2xl font-bold text-koveo-navy">
                      {permissions?.length || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Active permissions</p>
                  </div>
                  <Shield className="h-8 w-8 text-koveo-navy" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" 
                  onClick={() => setActiveTab('permissions')}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Role Hierarchy</p>
                    <p className="text-2xl font-bold text-koveo-navy">{roles.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Admin → Manager → Tenant → Resident</p>
                  </div>
                  <Users className="h-8 w-8 text-koveo-navy" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" 
                  onClick={() => setActiveTab('permissions')}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Permission Matrix</p>
                    <p className="text-2xl font-bold text-koveo-navy">12</p>
                    <p className="text-xs text-gray-500 mt-1">Permission categories</p>
                  </div>
                  <Settings className="h-8 w-8 text-koveo-navy" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" 
                  onClick={() => setActiveTab('users')}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">User Overrides</p>
                    <p className="text-2xl font-bold text-koveo-navy">
                      {userPermissions?.length || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {userPermissions?.length === 0 ? 'Role-based only' : 'Custom permissions'}
                    </p>
                  </div>
                  <Shield className="h-8 w-8 text-koveo-navy" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="users">User Permissions</TabsTrigger>
              <TabsTrigger value="permissions">All Permissions</TabsTrigger>
            </TabsList>



            {/* User Permissions Tab */}
            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    User-Specific Permissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Search and Filter */}
                  <div className="flex gap-4 mb-6">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={filterRole} onValueChange={handleRoleChange}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {roles.map(role => (
                          <SelectItem key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-koveo-navy"></div>
                    </div>
                  ) : (
                    <>
                    <div className="space-y-4">
                      {currentUsers.map(user => {
                        const userSpecificPermissions = userPermissions?.filter(up => up.userId === user.id) || [];
                        const rolePermissionsCount = permissionsByRole[user.role]?.length || 0;
                        const totalPermissions = rolePermissionsCount + userSpecificPermissions.filter(up => up.granted).length;
                        
                        return (
                          <div key={user.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-koveo-navy rounded-full flex items-center justify-center">
                                  <span className="text-white text-sm font-medium">
                                    {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900">{user.firstName} {user.lastName}</h4>
                                  <p className="text-sm text-gray-600">{user.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="capitalize font-medium">
                                  {user.role}
                                </Badge>
                                <Badge variant={user.isActive ? "default" : "secondary"}>
                                  {user.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </div>
                            
                            {/* Permission Summary */}
                            <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                              <div className="text-center">
                                <p className="text-2xl font-bold text-koveo-navy">{rolePermissionsCount}</p>
                                <p className="text-xs text-gray-600">Role Permissions</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-blue-600">{userSpecificPermissions.length}</p>
                                <p className="text-xs text-gray-600">User Overrides</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-green-600">{totalPermissions}</p>
                                <p className="text-xs text-gray-600">Total Permissions</p>
                              </div>
                            </div>

                            {/* User-specific permissions */}
                            {userSpecificPermissions.length > 0 ? (
                              <div className="space-y-2">
                                <h5 className="font-medium text-gray-900 flex items-center gap-2">
                                  <Settings className="h-4 w-4" />
                                  User-Specific Permissions ({userSpecificPermissions.length})
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {userSpecificPermissions.map(up => (
                                    <div key={up.id} className={`text-sm px-3 py-2 rounded-lg border flex items-center justify-between ${
                                      up.granted 
                                        ? 'bg-green-50 border-green-200 text-green-800' 
                                        : 'bg-red-50 border-red-200 text-red-800'
                                    }`}>
                                      <div className="flex-1">
                                        <p className="font-medium">{up.permission?.displayName || up.permissionId}</p>
                                        {up.reason && (
                                          <p className="text-xs opacity-75 mt-1">{up.reason}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant={up.granted ? "default" : "destructive"} className="text-xs">
                                          {up.granted ? 'Granted' : 'Revoked'}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                  Last modified: {new Date(userSpecificPermissions[0]?.grantedAt).toLocaleDateString()}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4 text-gray-500">
                                <Shield className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <p className="text-sm">No user-specific permission overrides</p>
                                <p className="text-xs text-gray-400">User inherits all permissions from {user.role} role</p>
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-2 mt-4 pt-4 border-t">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setEditingUser(editingUser === user.id ? null : user.id)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {editingUser === user.id ? 'Cancel' : 'Manage Permissions'}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  // View detailed permissions for this user
                                  toast({
                                    title: 'User Details',
                                    description: `${user.firstName} ${user.lastName} has ${totalPermissions} total permissions`,
                                  });
                                }}
                              >
                                <Users className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                            </div>

                            {/* Expandable permission management form */}
                            {editingUser === user.id && (
                              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h6 className="font-medium text-blue-900 mb-3">Manage User Permissions</h6>
                                <div className="space-y-3">
                                  <Select onValueChange={(permissionId) => {
                                    grantUserPermissionMutation.mutate({
                                      userId: user.id,
                                      permissionId,
                                      reason: 'Admin granted via permissions page'
                                    });
                                  }}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Grant a new permission..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {permissions
                                        .filter(p => !userSpecificPermissions.some(up => up.permissionId === p.id))
                                        .map(permission => (
                                          <SelectItem key={permission.id} value={permission.id}>
                                            {permission.displayName} ({permission.resourceType})
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="flex gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => setEditingUser(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      disabled
                                    >
                                      <Badge variant="secondary">Future: Bulk Actions</Badge>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {filteredUsers.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                          <p>No users found matching your search criteria.</p>
                        </div>
                      )}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className='flex justify-center items-center gap-4 mt-6'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        
                        <div className='flex items-center gap-2'>
                          <span className='text-sm text-gray-600'>Page</span>
                          <Input
                            type='number'
                            min='1'
                            max={totalPages}
                            value={currentPage}
                            onChange={(e) => {
                              const page = parseInt(e.target.value);
                              if (page >= 1 && page <= totalPages) {
                                setCurrentPage(page);
                              }
                            }}
                            onBlur={(e) => {
                              const page = parseInt(e.target.value);
                              if (isNaN(page) || page < 1) {
                                setCurrentPage(1);
                              } else if (page > totalPages) {
                                setCurrentPage(totalPages);
                              }
                            }}
                            className='w-16 text-center'
                          />
                          <span className='text-sm text-gray-600'>of {totalPages}</span>
                        </div>
                        
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                        
                        <div className='text-sm text-gray-600'>
                          Showing {startIndex + 1}-{Math.min(endIndex, totalUsers)} of {totalUsers} users
                        </div>
                      </div>
                    )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* All Permissions Tab */}
            <TabsContent value="permissions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    All Permissions
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Complete system permissions table with detailed information about each permission.
                  </p>
                </CardHeader>
                <CardContent>
                  {/* Search and Filter for permissions */}
                  <div className="flex gap-4 mb-6">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search permissions..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by category" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(permissionsByResource).map(category => (
                          <SelectItem key={category} value={category}>
                            {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-koveo-navy"></div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="font-semibold text-gray-900">Permission ID</TableHead>
                            <TableHead className="font-semibold text-gray-900">Display Name</TableHead>
                            <TableHead className="font-semibold text-gray-900">Resource Type</TableHead>
                            <TableHead className="font-semibold text-gray-900">Action</TableHead>
                            <TableHead className="text-center font-semibold text-gray-900">Status</TableHead>
                            <TableHead className="font-semibold text-gray-900">Description</TableHead>
                            <TableHead className="text-center font-semibold text-gray-900">Roles</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPermissions.map((permission) => {
                            const rolesWithPermission = roles.filter(role => 
                              roleMatrix[role]?.includes(permission.id)
                            );
                            
                            return (
                              <TableRow key={permission.id} className="hover:bg-gray-50">
                                <TableCell className="font-mono text-xs text-gray-600">
                                  {permission.id}
                                </TableCell>
                                <TableCell className="font-medium text-gray-900">
                                  {permission.displayName}
                                </TableCell>
                                <TableCell className="capitalize">
                                  <Badge variant="outline">
                                    {permission.resourceType.replace('_', ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-blue-600 font-medium uppercase">
                                  {permission.action}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={permission.isActive ? "default" : "secondary"}>
                                    {permission.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-gray-600 max-w-md">
                                  {permission.description}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {rolesWithPermission.map(role => (
                                      <Badge key={role} variant="secondary" className="text-xs">
                                        {role.charAt(0).toUpperCase() + role.slice(1)}
                                      </Badge>
                                    ))}
                                    {rolesWithPermission.length === 0 && (
                                      <span className="text-xs text-gray-400">None</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      
                      {filteredPermissions.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                          <p>No permissions found matching your search criteria.</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>


          </Tabs>
        </div>
      </div>
    </div>
  );
}