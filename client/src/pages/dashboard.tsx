import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import {
  Home,
  Building,
  Users,
  Settings,
  TrendingUp,
  Bell,
  Calendar,
  FileText,
  BarChart3,
  Shield,
  ArrowRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Link } from 'wouter';
import { useFullscreen } from '@/hooks/use-fullscreen';

/**
 * Main Dashboard - Central hub for all user roles
 * Provides role-based navigation and quick access to key features.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // Determine role-based navigation items
  const getRoleBasedActions = () => {
    if (!user) {
      return [];
    }

    const actions = [];

    // Admin actions
    if (user.role === 'admin') {
      actions.push(
        {
          title: t('systemManagement'),
          description: t('manageOrganizationsUsers'),
          icon: Settings,
          path: '/admin/organizations',
          color: 'bg-red-500',
          testId: 'card-admin',
        },
        {
          title: t('organizationOverview'),
          description: t('viewManageOrganizations'),
          icon: Building,
          path: '/admin/organizations',
          color: 'bg-blue-500',
          testId: 'card-organizations',
        },
        {
          title: 'User Management',
          description: 'Manage users across all organizations',
          icon: Users,
          path: '/admin/organizations',
          color: 'bg-green-500',
          testId: 'card-users',
        }
      );
    }

    // Manager actions
    if (user.role === 'manager' || user.role === 'demo_manager' || user.role === 'admin') {
      actions.push(
        {
          title: 'Buildings',
          description: 'Manage your property portfolio',
          icon: Building,
          path: '/manager/buildings',
          color: 'bg-blue-600',
          testId: 'card-buildings',
        },
        {
          title: 'Financial Reports',
          description: 'View revenue, expenses, and financial analytics',
          icon: BarChart3,
          path: '/manager/budget',
          color: 'bg-purple-500',
          testId: 'card-reports',
        },
        {
          title: 'Maintenance',
          description: 'Track and manage maintenance requests',
          icon: Settings,
          path: '/manager/demands',
          color: 'bg-orange-500',
          testId: 'card-maintenance',
        }
      );
    }

    // Tenant actions
    if (user.role === 'tenant' || user.role === 'demo_tenant') {
      actions.push(
        {
          title: 'My Residence',
          description: 'View your residence information and details',
          icon: Home,
          path: '/residents/residence',
          color: 'bg-green-600',
          testId: 'card-tenant-residence',
        },
        {
          title: 'Maintenance Requests',
          description: 'Submit and track maintenance requests',
          icon: Settings,
          path: '/residents/maintenance',
          color: 'bg-orange-500',
          testId: 'card-tenant-maintenance',
        },
        {
          title: 'Documents',
          description: 'View important documents and notices',
          icon: FileText,
          path: '/residents/documents',
          color: 'bg-blue-500',
          testId: 'card-tenant-documents',
        }
      );
    }

    // Resident actions
    if (user.role === 'resident' || user.role === 'demo_resident') {
      actions.push(
        {
          title: 'My Home',
          description: 'Access your residence dashboard',
          icon: Home,
          path: '/residents/dashboard',
          color: 'bg-green-600',
          testId: 'card-resident-home',
        },
        {
          title: 'Maintenance Requests',
          description: 'Submit and track maintenance requests',
          icon: Settings,
          path: '/residents/maintenance',
          color: 'bg-orange-500',
          testId: 'card-resident-maintenance',
        },
        {
          title: 'Documents',
          description: 'View important documents and notices',
          icon: FileText,
          path: '/residents/documents',
          color: 'bg-blue-500',
          testId: 'card-resident-documents',
        }
      );
    }

    return actions;
  };

  const roleActions = getRoleBasedActions();

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title={`${t('welcomeBack')}, ${user?.firstName || 'User'}`}
        subtitle={t('personalizedDashboard')}
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto'>
          {/* Fullscreen Controls */}
          <div className='flex justify-end mb-6'>
            <Button
              variant='outline'
              size='sm'
              onClick={toggleFullscreen}
              className='flex items-center gap-2'
              data-testid='button-fullscreen-toggle'
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className='w-4 h-4' />
                  <span className='hidden sm:inline'>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className='w-4 h-4' />
                  <span className='hidden sm:inline'>Fullscreen</span>
                </>
              )}
            </Button>
          </div>


          {/* Quick Actions Grid */}
          {roleActions.length > 0 ? (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8'>
              {roleActions.map((action, index) => {
                const IconComponent = action.icon;
                return (
                  <Link key={index} href={action.path}>
                    <Card
                      className='cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1'
                      data-testid={action.testId}
                    >
                      <CardHeader className='pb-3'>
                        <div className='flex items-center justify-between'>
                          <div className={`p-3 rounded-lg ${action.color} text-white`}>
                            <IconComponent className='h-6 w-6' />
                          </div>
                          <ArrowRight className='h-4 w-4 text-muted-foreground' />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardTitle className='text-lg mb-2'>{action.title}</CardTitle>
                        <p className='text-sm text-muted-foreground'>{action.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className='text-center py-12'>
              <CardContent>
                <Home className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
                <CardTitle className='text-xl mb-2'>Welcome to Koveo Gestion</CardTitle>
                <p className='text-muted-foreground'>
                  Your dashboard will be customized based on your role and permissions.
                </p>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
