import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, DollarSign, Users, FileText, AlertCircle, Terminal, Plus } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useQuery } from '@tanstack/react-query';
import { OrganizationForm } from '@/components/forms';
import type { Organization, User } from '@shared/schema';

/**
 *
 */
export default function Dashboard() {
  const { t } = useLanguage();
  const [isOrganizationDialogOpen, setIsOrganizationDialogOpen] = useState(false);

  const { data: organizations, isLoading: organizationsLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const isLoading = organizationsLoading || usersLoading;

  // Calculate admin-related statistics
  const totalOrganizations = Array.isArray(organizations) ? organizations.length : 0;
  const totalUsers = Array.isArray(users) ? users.length : 0;
  const activeOrganizations = Array.isArray(organizations)
    ? organizations.filter((org: Organization) => org.isActive).length
    : 0;
  const adminUsers = Array.isArray(users)
    ? users.filter((user: User) => user.role === 'admin').length
    : 0;

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Admin Dashboard' subtitle='Property management overview and insights' />

      {/* Refresh Command */}
      <div className='border-b bg-gray-50 px-6 py-3'>
        <div className='max-w-7xl mx-auto'>
          <div className='flex items-center gap-2 text-sm text-gray-600'>
            <Terminal className='h-4 w-4' />
            <span className='font-medium'>Refresh Command:</span>
            <code className='bg-gray-100 px-2 py-1 rounded text-xs font-mono'>npm run validate:quick</code>
          </div>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Key Metrics */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
            <Card>
              <CardContent className='p-6'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-sm font-medium text-gray-600'>Total Organizations</p>
                    <p className='text-2xl font-bold text-gray-900'>
                      {isLoading ? '-' : totalOrganizations}
                    </p>
                  </div>
                  <Building className='text-koveo-navy' size={24} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className='p-6'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-sm font-medium text-gray-600'>Active Organizations</p>
                    <p className='text-2xl font-bold text-green-600'>
                      {isLoading ? '-' : activeOrganizations}
                    </p>
                  </div>
                  <DollarSign className='text-green-600' size={24} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className='p-6'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-sm font-medium text-gray-600'>Total Users</p>
                    <p className='text-2xl font-bold text-gray-900'>
                      {isLoading ? '-' : totalUsers}
                    </p>
                  </div>
                  <Users className='text-koveo-navy' size={24} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className='p-6'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-sm font-medium text-gray-600'>Property Admins</p>
                    <p className='text-2xl font-bold text-blue-600'>
                      {isLoading ? '-' : adminUsers}
                    </p>
                  </div>
                  <FileText className='text-blue-600' size={24} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Organizations Overview */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className='flex items-center'>
                    <Building className='text-koveo-navy mr-2' size={20} />
                    Organizations
                  </CardTitle>
                  <Button
                    onClick={() => setIsOrganizationDialogOpen(true)}
                    className='bg-blue-600 hover:bg-blue-700 text-white shrink-0'
                    size="sm"
                  >
                    <Plus className='h-4 w-4 mr-1' />
                    Create
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className='space-y-3'>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className='h-4 bg-gray-200 rounded animate-pulse'></div>
                    ))}
                  </div>
                ) : Array.isArray(organizations) && organizations.length > 0 ? (
                  <div className='space-y-3'>
                    {organizations.slice(0, 5).map((org: Organization) => (
                      <div
                        key={org.id}
                        className='flex items-center justify-between py-2 border-b border-gray-100 last:border-0'
                      >
                        <div>
                          <p className='font-medium text-gray-900'>{org.name}</p>
                          <p className='text-sm text-gray-600'>{org.type}</p>
                        </div>
                        <Badge variant={org.isActive ? 'default' : 'secondary'}>
                          {org.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='text-center py-8 text-gray-500'>
                    <Building className='mx-auto mb-3' size={48} />
                    <p>No organizations found</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center'>
                  <Users className='text-koveo-navy mr-2' size={20} />
                  Recent Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className='space-y-3'>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className='h-4 bg-gray-200 rounded animate-pulse'></div>
                    ))}
                  </div>
                ) : Array.isArray(users) && users.length > 0 ? (
                  <div className='space-y-3'>
                    {users.slice(0, 5).map((user: User) => (
                      <div
                        key={user.id}
                        className='flex items-center justify-between py-2 border-b border-gray-100 last:border-0'
                      >
                        <div>
                          <p className='font-medium text-gray-900'>
                            {user.firstName} {user.lastName}
                          </p>
                          <p className='text-sm text-gray-600'>{user.email}</p>
                        </div>
                        <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                          {user.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='text-center py-8 text-gray-500'>
                    <Users className='mx-auto mb-3' size={48} />
                    <p>No users found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <OrganizationForm
        open={isOrganizationDialogOpen}
        onOpenChange={setIsOrganizationDialogOpen}
      />
    </div>
  );
}
