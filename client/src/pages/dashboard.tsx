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
  Minimize2
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
    if (user.role === 'admin' || user.role === 'super_admin') {
      actions.push(
        {
          title: 'System Management',
          description: 'Manage organizations, users, and system settings',
          icon: Settings,
          path: '/admin',
          color: 'bg-red-500',
          testId: 'card-admin'
        },
        {
          title: 'Organization Overview',
          description: 'View and manage all organizations',
          icon: Building,
          path: '/organizations',
          color: 'bg-blue-500',
          testId: 'card-organizations'
        },
        {
          title: 'User Management',
          description: 'Manage users across all organizations',
          icon: Users,
          path: '/users',
          color: 'bg-green-500',
          testId: 'card-users'
        }
      );
    }

    // Manager actions
    if (user.role === 'manager' || user.role === 'admin' || user.role === 'super_admin') {
      actions.push(
        {
          title: 'Buildings',
          description: 'Manage your property portfolio',
          icon: Building,
          path: '/buildings',
          color: 'bg-blue-600',
          testId: 'card-buildings'
        },
        {
          title: 'Financial Reports',
          description: 'View revenue, expenses, and financial analytics',
          icon: BarChart3,
          path: '/reports',
          color: 'bg-purple-500',
          testId: 'card-reports'
        },
        {
          title: 'Maintenance',
          description: 'Track and manage maintenance requests',
          icon: Settings,
          path: '/maintenance',
          color: 'bg-orange-500',
          testId: 'card-maintenance'
        }
      );
    }

    // Resident actions
    if (user.role === 'resident') {
      actions.push(
        {
          title: 'My Home',
          description: 'Access your residence dashboard',
          icon: Home,
          path: '/residents/dashboard',
          color: 'bg-green-600',
          testId: 'card-resident-home'
        },
        {
          title: 'Maintenance Requests',
          description: 'Submit and track maintenance requests',
          icon: Settings,
          path: '/residents/maintenance',
          color: 'bg-orange-500',
          testId: 'card-resident-maintenance'
        },
        {
          title: 'Documents',
          description: 'View important documents and notices',
          icon: FileText,
          path: '/residents/documents',
          color: 'bg-blue-500',
          testId: 'card-resident-documents'
        }
      );
    }

    return actions;
  };

  const roleActions = getRoleBasedActions();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header 
        title={`Welcome back, ${user?.first_name || 'User'}`}
        subtitle="Your personalized dashboard - quick access to everything you need"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Fullscreen Controls */}
          <div className="flex justify-end mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="flex items-center gap-2"
              data-testid="button-fullscreen-toggle"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </>
              )}
            </Button>
          </div>

          {/* User Role Badge */}
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="px-3 py-1">
                {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)} Dashboard
              </Badge>
              <div className="text-sm text-muted-foreground">
                Organization: {user?.organization?.name || 'Not assigned'}
              </div>
            </div>
          </div>

          {/* Quick Actions Grid */}
          {roleActions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {roleActions.map((action, index) => {
                const IconComponent = action.icon;
                return (
                  <Link key={index} href={action.path}>
                    <Card 
                      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
                      data-testid={action.testId}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className={`p-3 rounded-lg ${action.color} text-white`}>
                            <IconComponent className="h-6 w-6" />
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardTitle className="text-lg mb-2">{action.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <CardTitle className="text-xl mb-2">Welcome to Koveo Gestion</CardTitle>
                <p className="text-muted-foreground">
                  Your dashboard will be customized based on your role and permissions.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Notifications</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">+2 from last week</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2</div>
                <p className="text-xs text-muted-foreground">This week</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Good</div>
                <p className="text-xs text-muted-foreground">All systems operational</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">System updated successfully</p>
                    <p className="text-xs text-muted-foreground">Database optimizations applied</p>
                  </div>
                  <p className="text-xs text-muted-foreground">2 min ago</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Performance improvements</p>
                    <p className="text-xs text-muted-foreground">Page load times reduced by 40%</p>
                  </div>
                  <p className="text-xs text-muted-foreground">1 hour ago</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Maintenance completed</p>
                    <p className="text-xs text-muted-foreground">All critical issues resolved</p>
                  </div>
                  <p className="text-xs text-muted-foreground">3 hours ago</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}