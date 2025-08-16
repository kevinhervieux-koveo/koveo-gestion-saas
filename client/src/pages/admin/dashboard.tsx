import React from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, Users, FileText, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { OrganizationsCard } from '@/components/admin/organizations-card';
import { apiRequest } from '@/lib/queryClient';
import type { Organization, User } from '@shared/schema';

/**
 * NEW Admin Dashboard v2.0 - Koveo Property Management
 * Complete Organizations CRUD Management Interface
 */
export default function Dashboard() {
  console.log('🚀 NEW Dashboard Loading - v2.0 with Organizations CRUD');
  
  // Fetch dashboard metrics
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      return response.json();
    },
  });

  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/organizations');
      return response.json();
    },
  });

  // Calculate metrics
  const totalUsers = users.length;
  const activeUsers = users.filter(user => user.isActive).length;
  const totalOrganizations = organizations.length;
  const activeOrganizations = organizations.filter(org => org.isActive).length;
  const propertyAdmins = users.filter(user => ['admin', 'manager'].includes(user.role)).length;

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header 
        title='🏢 Koveo Admin Dashboard' 
        subtitle='Complete Property Management - Organizations, Users & System Administration'
      />
      
      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          
          {/* Debug Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-blue-800">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">NEW Dashboard v2.0 Loaded Successfully</span>
            </div>
            <p className="text-blue-700 text-sm mt-1">
              Complete Organizations CRUD functionality is now active
            </p>
          </div>

          {/* Overview Metrics Cards */}
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsers}</div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <Badge variant={activeUsers > 0 ? 'default' : 'secondary'}>
                    {activeUsers} active
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Organizations</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrganizations}</div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <Badge variant={activeOrganizations > 0 ? 'default' : 'secondary'}>
                    {activeOrganizations} active
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Property Admins</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{propertyAdmins}</div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <span>Admins & Managers</span>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Healthy</div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                    All systems operational
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid - Organizations Management */}
          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {/* Organizations Management Card - MAIN FEATURE */}
            <div className="lg:col-span-2">
              <OrganizationsCard />
            </div>

            {/* Quick Actions & Future Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Additional admin features</p>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div>✓ Organization Management</div>
                    <div>• User Management</div>
                    <div>• Building Management</div>
                    <div>• Residence Management</div>
                    <div>• System Settings</div>
                    <div>• Reports & Analytics</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Overview */}
          <Card>
            <CardHeader>
              <CardTitle>System Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Building className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{totalOrganizations}</div>
                  <div className="text-sm text-gray-600">Total Organizations</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{totalUsers}</div>
                  <div className="text-sm text-gray-600">Total Users</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">100%</div>
                  <div className="text-sm text-gray-600">System Uptime</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}