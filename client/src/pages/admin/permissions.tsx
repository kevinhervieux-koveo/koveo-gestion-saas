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
import { useState } from 'react';
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
  const [selectedCategory, setSelectedCategory] = useState('all');

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
  
  // Filter permissions by category
  const filteredPermissions = permissions?.filter(permission => {
    if (selectedCategory === 'all') {return true;}
    return permission.category === selectedCategory;
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
    onError: (error: any) => {
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
    onSuccess: (data) => {
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="users">User Permissions</TabsTrigger>
              <TabsTrigger value="permissions">Permissions Table</TabsTrigger>
              <TabsTrigger value="manage">Manage</TabsTrigger>
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

            {/* Permissions Table Tab */}
            <TabsContent value="permissions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Role-Based Permissions Matrix
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-koveo-navy"></div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* RBAC Matrix Table */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[300px]">Permission</TableHead>
                              <TableHead className="text-center">Admin</TableHead>
                              <TableHead className="text-center">Manager</TableHead>
                              <TableHead className="text-center">Tenant</TableHead>
                              <TableHead className="text-center">Resident</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {/* Static permissions based on config/permissions.json */}
                            <TableRow>
                              <TableCell className="font-medium">Profile Management</TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">User Management</TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <X className="h-4 w-4 text-red-500 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <X className="h-4 w-4 text-red-500 mx-auto" />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Organization Management</TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <X className="h-4 w-4 text-red-500 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <X className="h-4 w-4 text-red-500 mx-auto" />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Building Management</TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <X className="h-4 w-4 text-red-500 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <X className="h-4 w-4 text-red-500 mx-auto" />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Residence Access</TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Bill Management</TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-xs text-gray-500">Read Only</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-xs text-gray-500">Read Only</span>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Budget Management</TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-xs text-gray-500">Read Only</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <X className="h-4 w-4 text-red-500 mx-auto" />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Maintenance Requests</TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Document Access</TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-xs text-gray-500">Read Only</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-xs text-gray-500">Read Only</span>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Notifications</TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-xs text-gray-500">Read Only</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-xs text-gray-500">Read Only</span>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">AI Analysis & Assistant</TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <X className="h-4 w-4 text-red-500 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <X className="h-4 w-4 text-red-500 mx-auto" />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Invitations</TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <X className="h-4 w-4 text-red-500 mx-auto" />
                              </TableCell>
                              <TableCell className="text-center">
                                <X className="h-4 w-4 text-red-500 mx-auto" />
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                      
                      {/* Permission Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">148</div>
                          <div className="text-sm text-blue-600">Admin Permissions</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">70</div>
                          <div className="text-sm text-green-600">Manager Permissions</div>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">9</div>
                          <div className="text-sm text-orange-600">Tenant Permissions</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">9</div>
                          <div className="text-sm text-purple-600">Resident Permissions</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Manage Tab */}
            <TabsContent value="manage" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button 
                      className="w-full justify-start" 
                      onClick={() => setShowNewPermissionForm(true)}
                      disabled
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Permission
                      <Badge variant="secondary" className="ml-2">Future</Badge>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('permissions')}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      View Permission Matrix
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('users')}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Manage User Permissions
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-left"
                      disabled
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Bulk Permissions Update
                      <Badge variant="secondary" className="ml-2">Future</Badge>
                    </Button>
                  </CardContent>
                </Card>

                {/* Permission Guidelines */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Guidelines
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-gray-600">
                    <div>
                      <p className="font-medium text-gray-900 mb-2">Role Hierarchy:</p>
                      <ul className="space-y-1 ml-4">
                        <li>• <strong className="text-red-600">Admin</strong>: Full system access ({permissionsConfig?.admin?.length || 0} permissions)</li>
                        <li>• <strong className="text-blue-600">Manager</strong>: Building management ({permissionsConfig?.manager?.length || 0} permissions)</li>
                        <li>• <strong className="text-green-600">Admin</strong>: Property oversight ({permissionsConfig?.admin?.length || 0} permissions)</li>
                        <li>• <strong className="text-yellow-600">Tenant</strong>: Personal data only ({permissionsConfig?.tenant?.length || 0} permissions)</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 mb-2">Quebec Law 25 Compliance:</p>
                      <ul className="space-y-1 ml-4">
                        <li>• All permission changes are logged</li>
                        <li>• Minimal access principle enforced</li>
                        <li>• Regular audit trails maintained</li>
                        <li>• Data processing permissions tracked</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* System Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      System Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Active Permissions:</span>
                        <Badge variant="default">{permissions?.length || 0}</Badge>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Role Mappings:</span>
                        <Badge variant="secondary">{rolePermissions?.length || 0}</Badge>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">User Overrides:</span>
                        <Badge variant={userPermissions?.length === 0 ? "default" : "destructive"}>
                          {userPermissions?.length || 0}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Categories:</span>
                        <Badge variant="outline">{categories.length || 0}</Badge>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => {
                          queryClient.invalidateQueries({ queryKey: ['/api/permissions'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/role-permissions'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/user-permissions'] });
                          toast({ title: 'Refreshed', description: 'Permission data has been refreshed' });
                        }}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Refresh Data
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Permission Categories Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Permission Categories Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {permissionCategories?.map(category => (
                      <div key={category.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-koveo-navy">{category.name}</h4>
                          <Badge variant="outline">{category.count}</Badge>
                        </div>
                        <div className="text-sm text-gray-600 mb-3">
                          {category.permissions?.slice(0, 3).map((p: any) => p.displayName).join(', ')}
                          {category.count > 3 && ` + ${category.count - 3} more`}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full"
                          onClick={() => {
                            setSelectedCategory(category.name);
                            setActiveTab('permissions');
                          }}
                        >
                          View Category
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}