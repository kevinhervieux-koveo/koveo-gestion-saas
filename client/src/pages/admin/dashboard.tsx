import React from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, DollarSign, Users, FileText, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { OrganizationsCard } from '@/components/admin/organizations-card';
import { apiRequest } from '@/lib/queryClient';
import type { Organization, User } from '@shared/schema';

/**
 * Admin Dashboard - Property Management Overview
 * Provides comprehensive overview of organizations, users, and system metrics
 */
export default function Dashboard() {
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
        title='Admin Dashboard' 
        subtitle='Property management system overview and administration'
      />
      
      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Overview Cards */}
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
            <Card>
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

            <Card>
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

            <Card>
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

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Healthy</div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    All systems operational
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {/* Organizations Management Card */}
            <div className="lg:col-span-2">
              <OrganizationsCard />
            </div>

            {/* Quick Actions Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Additional admin features coming soon</p>
                  <div className="space-y-2 text-sm text-gray-600">
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

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Activity tracking will be available soon</p>
                <p className="text-sm text-gray-400 mt-2">
                  Monitor user actions, organization changes, and system events
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}