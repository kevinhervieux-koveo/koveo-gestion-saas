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
  ArrowRight
} from 'lucide-react';
import { Link } from 'wouter';

/**
 * Main Dashboard - Central hub for all user roles
 * Provides role-based navigation and quick access to key features.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  console.log('Dashboard component rendering, user:', user?.email, 'role:', user?.role);
  console.log('Dashboard: About to render UI with user:', user?.email, 'role:', user?.role);
  
  if (!user) {
    console.log('Dashboard: No user found, returning loading state');
    return <div style={{padding: '20px', background: '#ffffff', color: '#000000'}}>Loading user...</div>;
  }

  // Determine role-based navigation items
  const getRoleBasedActions = () => {
    if (!user) {return [];}

    const actions = [];

    // Admin actions
    if (user.role === 'admin') {
      actions.push(
        { icon: Building, label: 'Organizations', href: '/admin/organizations', color: 'bg-blue-50 text-blue-600' },
        { icon: Shield, label: 'Permissions', href: '/admin/permissions', color: 'bg-purple-50 text-purple-600' },
        { icon: BarChart3, label: 'Quality Metrics', href: '/admin/quality', color: 'bg-green-50 text-green-600' },
        { icon: FileText, label: 'Documentation', href: '/admin/documentation', color: 'bg-orange-50 text-orange-600' }
      );
    }

    // Manager actions
    if (['admin', 'manager'].includes(user.role)) {
      actions.push(
        { icon: Building, label: 'Buildings', href: '/manager/buildings', color: 'bg-indigo-50 text-indigo-600' },
        { icon: Home, label: 'Residences', href: '/manager/residences', color: 'bg-cyan-50 text-cyan-600' },
        { icon: FileText, label: 'Bills', href: '/manager/bills', color: 'bg-yellow-50 text-yellow-600' },
        { icon: TrendingUp, label: 'Budget', href: '/manager/budget', color: 'bg-emerald-50 text-emerald-600' }
      );
    }

    // Resident actions
    if (['resident', 'tenant'].includes(user.role)) {
      actions.push(
        { icon: Home, label: 'My Residence', href: '/residents/residence', color: 'bg-blue-50 text-blue-600' },
        { icon: Building, label: 'Building Info', href: '/residents/building', color: 'bg-green-50 text-green-600' },
        { icon: FileText, label: 'Requests', href: '/residents/demands', color: 'bg-orange-50 text-orange-600' }
      );
    }

    // Common actions for all users
    actions.push(
      { icon: Settings, label: 'Settings', href: '/settings/settings', color: 'bg-gray-50 text-gray-600' }
    );

    return actions;
  };

  const roleActions = getRoleBasedActions();

  const getWelcomeMessage = () => {
    const firstName = user?.firstName || 'User';
    switch (user?.role) {
      case 'admin':
        return {
          title: `Welcome back, ${firstName}`,
          subtitle: 'System Administrator Dashboard - Manage the platform and monitor all operations'
        };
      case 'manager':
        return {
          title: `Welcome back, ${firstName}`,
          subtitle: 'Property Manager Dashboard - Oversee buildings, residents, and operations'
        };
      case 'tenant':
      case 'resident':
        return {
          title: `Welcome home, ${firstName}`,
          subtitle: 'Resident Portal - Manage your residence and stay connected with your community'
        };
      default:
        return {
          title: `Welcome, ${firstName}`,
          subtitle: 'Property Management Portal - Your central hub for all activities'
        };
    }
  };

  const welcome = getWelcomeMessage();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#ffffff',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto'
    }}>
      <Header 
        title={welcome.title}
        subtitle={welcome.subtitle}
      />

      <div style={{
        flex: 1,
        padding: '24px',
        background: '#f8fafc',
        color: '#000000',
        overflow: 'auto'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          color: '#000000'
        }}>
          
          {/* Debug info */}
          <div style={{
            padding: '20px',
            background: '#e3f2fd',
            border: '2px solid #2196f3',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '16px',
            fontWeight: 'bold'
          }}>
            🎉 SUCCESS: User {user.email} ({user.role}) - Dashboard Fully Operational!
          </div>
          
          {/* Simple test content */}
          <div style={{
            padding: '20px',
            background: '#ffffff',
            border: '1px solid #ccc',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h1 style={{fontSize: '24px', marginBottom: '10px', color: '#000000'}}>Koveo Gestion Dashboard</h1>
            <p style={{color: '#666666'}}>Welcome to your property management system</p>
          </div>
          
          {/* Welcome Card with User Info */}
          <Card className="bg-gradient-to-r from-koveo-navy to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{welcome.title}</h2>
                  <p className="text-blue-100 mb-4">{welcome.subtitle}</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <Badge variant="secondary" className="bg-white/20 text-white">
                      {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                    </Badge>
                    <span className="text-blue-100">
                      {user?.email}
                    </span>
                  </div>
                </div>
                <div className="hidden md:block">
                  <Home className="w-16 h-16 text-blue-200" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Grid */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <TrendingUp className='w-5 h-5' />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4'>
                {roleActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <Link key={index} href={action.href}>
                      <Button 
                        variant='outline' 
                        className='h-auto p-4 flex flex-col space-y-2 group hover:shadow-md transition-all duration-200'
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color} group-hover:scale-110 transition-transform`}>
                          <Icon className='w-5 h-5' />
                        </div>
                        <span className="text-xs font-medium text-center">{action.label}</span>
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity & System Status */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Bell className='w-5 h-5' />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">System started</p>
                      <p className="text-xs text-gray-500">Welcome to Koveo Gestion</p>
                    </div>
                    <span className="text-xs text-gray-400">Now</span>
                  </div>
                  
                  <div className="text-center py-4 text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">Recent activities will appear here</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Shield className='w-5 h-5' />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Database</span>
                    <Badge className="bg-green-100 text-green-800">Online</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Authentication</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Storage</span>
                    <Badge className="bg-green-100 text-green-800">Available</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Workspace</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Getting Started (for new users) */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Calendar className='w-5 h-5' />
                Getting Started
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <FileText className="w-8 h-8 text-blue-500 mb-3" />
                  <h3 className="font-medium mb-2">Explore Documentation</h3>
                  <p className="text-sm text-gray-600 mb-3">Learn about the platform features and capabilities</p>
                  {user?.role === 'admin' ? (
                    <Link href="/admin/documentation">
                      <Button variant="outline" size="sm" className="w-full">
                        View Docs <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      View Docs <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
                
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <Settings className="w-8 h-8 text-green-500 mb-3" />
                  <h3 className="font-medium mb-2">Customize Settings</h3>
                  <p className="text-sm text-gray-600 mb-3">Personalize your experience and preferences</p>
                  <Link href="/settings/settings">
                    <Button variant="outline" size="sm" className="w-full">
                      Open Settings <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
                
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <Users className="w-8 h-8 text-purple-500 mb-3" />
                  <h3 className="font-medium mb-2">Manage Access</h3>
                  <p className="text-sm text-gray-600 mb-3">Set up users and manage permissions</p>
                  {user && ['admin', 'manager'].includes(user.role) ? (
                    <Link href={user.role === 'admin' ? '/admin/organizations' : '/manager/buildings'}>
                      <Button variant="outline" size="sm" className="w-full">
                        Get Started <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      Contact Manager
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}