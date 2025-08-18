import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import { Link } from 'wouter';
import {
  Building,
  Shield,
  BarChart3,
  FileText,
  Home,
  TrendingUp,
  Users,
  Activity,
  Calendar,
  Settings,
  ArrowRight
} from 'lucide-react';

export function Dashboard() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return <div style={{padding: '20px', background: '#ffffff', color: '#000000'}}>Loading user...</div>;
  }

  const roleBasedActions = [];
  
  if (user?.role === 'admin') {
    roleBasedActions.push(
      { icon: Building, label: 'Organizations', href: '/admin/organizations', color: 'bg-blue-50 text-blue-600' },
      { icon: Shield, label: 'Permissions', href: '/admin/permissions', color: 'bg-purple-50 text-purple-600' },
      { icon: BarChart3, label: 'Quality Metrics', href: '/admin/quality', color: 'bg-green-50 text-green-600' },
      { icon: FileText, label: 'Documentation', href: '/admin/documentation', color: 'bg-orange-50 text-orange-600' }
    );
  } else if (user?.role === 'manager') {
    roleBasedActions.push(
      { icon: Building, label: 'Buildings', href: '/manager/buildings', color: 'bg-indigo-50 text-indigo-600' },
      { icon: Home, label: 'Residences', href: '/manager/residences', color: 'bg-cyan-50 text-cyan-600' },
      { icon: FileText, label: 'Bills', href: '/manager/bills', color: 'bg-yellow-50 text-yellow-600' },
      { icon: TrendingUp, label: 'Budget', href: '/manager/budget', color: 'bg-emerald-50 text-emerald-600' }
    );
  } else if (user?.role === 'tenant') {
    roleBasedActions.push(
      { icon: FileText, label: 'My Bills', href: '/tenant/bills', color: 'bg-blue-50 text-blue-600' },
      { icon: Activity, label: 'Maintenance', href: '/tenant/maintenance', color: 'bg-red-50 text-red-600' },
      { icon: FileText, label: 'Documents', href: '/tenant/documents', color: 'bg-purple-50 text-purple-600' },
      { icon: Calendar, label: 'Events', href: '/tenant/events', color: 'bg-green-50 text-green-600' }
    );
  }

  return (
    <div style={{background: '#f9fafb', minHeight: '100vh'}}>
      <Header />
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {user?.first_name || 'User'}!
          </h1>
          <p className="text-gray-600">
            Manage your property efficiently from your dashboard
          </p>
        </div>

        <div className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">User Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Name</span>
                    <span className="font-medium">
                      {user?.first_name} {user?.last_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Email</span>
                    <span className="font-medium truncate">{user?.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Role</span>
                    <Badge variant="outline" className="capitalize">
                      {user?.role}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Active Tasks</span>
                    <Badge className="bg-blue-100 text-blue-800">12</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Pending Bills</span>
                    <Badge className="bg-yellow-100 text-yellow-800">3</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Notifications</span>
                    <Badge className="bg-green-100 text-green-800">5</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">API</span>
                    <Badge className="bg-green-100 text-green-800">Online</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Database</span>
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

          {roleBasedActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {roleBasedActions.map((action, index) => {
                    const Icon = action.icon;
                    return (
                      <Link key={index} href={action.href}>
                        <div className={`p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer ${action.color}`}>
                          <Icon className="w-8 h-8 mb-3" />
                          <h3 className="font-medium">{action.label}</h3>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
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
                        View Docs
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      View Docs
                    </Button>
                  )}
                </div>
                
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <Settings className="w-8 h-8 text-green-500 mb-3" />
                  <h3 className="font-medium mb-2">Customize Settings</h3>
                  <p className="text-sm text-gray-600 mb-3">Personalize your experience and preferences</p>
                  <Link href="/settings/settings">
                    <Button variant="outline" size="sm" className="w-full">
                      Open Settings
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
                        Get Started
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