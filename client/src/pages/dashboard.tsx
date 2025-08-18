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
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header 
        title={welcome.title}
        subtitle={welcome.subtitle}
      />

      <div style={{padding: '1.5rem'}}>
          
          {/* Welcome Card with User Info */}
          <div style={{
            background: 'linear-gradient(to right, #3b82f6, #2563eb)', 
            color: 'white', 
            borderRadius: '0.75rem', 
            overflow: 'hidden',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <div>
                <h2 style={{fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'white'}}>{welcome.title}</h2>
                <p style={{color: '#dbeafe', marginBottom: '1rem'}}>{welcome.subtitle}</p>
                <div style={{display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem'}}>
                  <span style={{
                    background: 'rgba(255,255,255,0.2)', 
                    color: 'white', 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '0.375rem',
                    fontWeight: 500
                  }}>
                    {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                  </span>
                  <span style={{color: '#dbeafe'}}>
                    {user?.email}
                  </span>
                </div>
              </div>
              <div style={{display: 'none'}}>
                <Home style={{width: '4rem', height: '4rem', color: '#93c5fd'}} />
              </div>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div style={{
            background: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#1f2937'
            }}>
              <TrendingUp style={{width: '1.25rem', height: '1.25rem'}} />
              Quick Actions
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '1rem'
            }}>
              {roleActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link key={index} href={action.href}>
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: 'white'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}>
                      <div style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: action.color.includes('blue') ? '#dbeafe' : 
                                   action.color.includes('green') ? '#d1fae5' :
                                   action.color.includes('purple') ? '#e9d5ff' :
                                   action.color.includes('orange') ? '#fed7aa' :
                                   action.color.includes('yellow') ? '#fef3c7' :
                                   action.color.includes('indigo') ? '#e0e7ff' :
                                   action.color.includes('cyan') ? '#cffafe' :
                                   action.color.includes('emerald') ? '#d1fae5' :
                                   '#f3f4f6',
                        color: action.color.includes('blue') ? '#2563eb' : 
                               action.color.includes('green') ? '#059669' :
                               action.color.includes('purple') ? '#7c3aed' :
                               action.color.includes('orange') ? '#ea580c' :
                               action.color.includes('yellow') ? '#d97706' :
                               action.color.includes('indigo') ? '#4f46e5' :
                               action.color.includes('cyan') ? '#0891b2' :
                               action.color.includes('emerald') ? '#059669' :
                               '#4b5563'
                      }}>
                        <Icon style={{width: '1.25rem', height: '1.25rem'}} />
                      </div>
                      <span style={{fontSize: '0.75rem', fontWeight: 500, textAlign: 'center', color: '#374151'}}>
                        {action.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

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