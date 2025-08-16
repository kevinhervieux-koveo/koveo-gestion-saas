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
import { Shield, Users, Settings, Plus, Search, Filter } from 'lucide-react';
import { useState } from 'react';
import { queryClient } from '@/lib/queryClient';

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
 *
 */
export default function Permissions() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('roles');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  // Fetch permissions
  const { data: permissions, isLoading: permissionsLoading } = useQuery<Permission[]>({
    queryKey: ['/api/permissions'],
  });

  // Fetch role permissions
  const { data: rolePermissions, isLoading: rolePermissionsLoading } = useQuery<RolePermission[]>({
    queryKey: ['/api/role-permissions'],
  });

  // Fetch user permissions
  const { data: userPermissions, isLoading: userPermissionsLoading } = useQuery<UserPermission[]>({
    queryKey: ['/api/user-permissions'],
  });

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const isLoading = permissionsLoading || rolePermissionsLoading || userPermissionsLoading || usersLoading;

  // Group permissions by role
  const permissionsByRole = rolePermissions?.reduce((acc, rp) => {
    if (!acc[rp.role]) {acc[rp.role] = [];}
    acc[rp.role].push(rp);
    return acc;
  }, {} as Record<string, RolePermission[]>) || {};

  // Available roles
  const roles = ['admin', 'manager', 'owner', 'tenant'];

  // Filter users based on search and role
  const filteredUsers = users?.filter(user => {
    const matchesSearch = searchQuery === '' || 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  }) || [];

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
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Permissions</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {permissions?.length || 0}
                    </p>
                  </div>
                  <Shield className="h-8 w-8 text-koveo-navy" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Roles</p>
                    <p className="text-2xl font-bold text-gray-900">{roles.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-koveo-navy" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Role Permissions</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {rolePermissions?.length || 0}
                    </p>
                  </div>
                  <Settings className="h-8 w-8 text-koveo-navy" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">User Overrides</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {userPermissions?.length || 0}
                    </p>
                  </div>
                  <Shield className="h-8 w-8 text-koveo-navy" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="roles">Role Permissions</TabsTrigger>
              <TabsTrigger value="users">User Permissions</TabsTrigger>
              <TabsTrigger value="permissions">All Permissions</TabsTrigger>
              <TabsTrigger value="manage">Manage</TabsTrigger>
            </TabsList>

            {/* Role Permissions Tab */}
            <TabsContent value="roles" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Role-Based Permissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-koveo-navy"></div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {roles.map(role => (
                        <div key={role} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold capitalize">{role}</h3>
                            <Badge variant="outline">
                              {permissionsByRole[role]?.length || 0} permissions
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {permissionsByRole[role]?.map(rp => (
                              <div key={rp.id} className="text-sm bg-gray-50 px-3 py-2 rounded">
                                {rp.permission?.displayName || rp.permissionId}
                              </div>
                            )) || (
                              <div className="text-sm text-gray-500 col-span-3">
                                No permissions assigned to this role
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

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
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={filterRole} onValueChange={setFilterRole}>
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
                    <div className="space-y-4">
                      {filteredUsers.map(user => {
                        const userSpecificPermissions = userPermissions?.filter(up => up.userId === user.id) || [];
                        return (
                          <div key={user.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h4 className="font-medium">{user.firstName} {user.lastName}</h4>
                                <p className="text-sm text-gray-600">{user.email}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="capitalize">{user.role}</Badge>
                                <Badge variant="secondary">
                                  {userSpecificPermissions.length} overrides
                                </Badge>
                              </div>
                            </div>
                            {userSpecificPermissions.length > 0 && (
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {userSpecificPermissions.map(up => (
                                  <div key={up.id} className={`text-sm px-3 py-2 rounded flex items-center justify-between ${
                                    up.granted ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                  }`}>
                                    <span>{up.permission?.displayName || up.permissionId}</span>
                                    <Badge variant={up.granted ? "default" : "destructive"}>
                                      {up.granted ? 'Granted' : 'Revoked'}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* All Permissions Tab */}
            <TabsContent value="permissions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    System Permissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-koveo-navy"></div>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Permission</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {permissions?.map(permission => (
                          <TableRow key={permission.id}>
                            <TableCell className="font-medium">{permission.displayName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {permission.resourceType.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {permission.action.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={permission.isActive ? "default" : "destructive"}>
                                {permission.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {permission.description || 'No description'}
                            </TableCell>
                          </TableRow>
                        )) || (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                              No permissions found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Manage Tab */}
            <TabsContent value="manage" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button className="w-full justify-start">
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Permission
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="h-4 w-4 mr-2" />
                      Assign Role Permissions
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Shield className="h-4 w-4 mr-2" />
                      Grant User Permission
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Bulk Permissions Update
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Permission Guidelines</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-gray-600">
                    <div>
                      <p className="font-medium text-gray-900 mb-2">Role Hierarchy:</p>
                      <ul className="space-y-1 ml-4">
                        <li>• <strong>Admin</strong>: Full system access</li>
                        <li>• <strong>Manager</strong>: Building and resident management</li>
                        <li>• <strong>Owner</strong>: Property oversight and reports</li>
                        <li>• <strong>Board Member</strong>: Meeting and document access</li>
                        <li>• <strong>Tenant</strong>: Personal data and maintenance requests</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 mb-2">Best Practices:</p>
                      <ul className="space-y-1 ml-4">
                        <li>• Assign permissions at the role level first</li>
                        <li>• Use user-specific permissions sparingly</li>
                        <li>• Regular permission audits recommended</li>
                        <li>• Document permission changes</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}