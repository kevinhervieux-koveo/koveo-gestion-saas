import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronRight, Wrench, Package, Folder, Home, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';

interface MaintenanceNavigationHOCProps {
  children: ReactNode;
  currentSection: 'inventory' | 'projects';
  title?: string;
  description?: string;
  className?: string;
  actions?: ReactNode;
}

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<any>;
  current?: boolean;
}

/**
 * Higher Order Component for Maintenance Navigation
 * Provides unified navigation, breadcrumbs, and shared layout for maintenance sections
 */
export function MaintenanceNavigationHOC({
  children,
  currentSection,
  title,
  description,
  className,
  actions
}: MaintenanceNavigationHOCProps) {
  const [location] = useLocation();
  const { t } = useLanguage();

  // Build breadcrumb navigation
  const breadcrumbs: BreadcrumbItem[] = [
    {
      label: t('dashboard'),
      href: '/dashboard/quick-actions',
      icon: Home
    },
    {
      label: t('manager'),
      href: '/manager/buildings',
      icon: Building
    },
    {
      label: t('maintenanceJournal'),
      icon: Wrench
    },
    {
      label: currentSection === 'inventory' ? t('inventory') : t('projects'),
      href: location,
      icon: currentSection === 'inventory' ? Package : Folder,
      current: true
    }
  ];

  // Navigation tabs for maintenance sections
  const navigationTabs = [
    {
      id: 'inventory',
      label: t('inventory'),
      href: '/manager/maintenance/inventory',
      icon: Package,
      description: 'Manage building elements and maintenance schedules',
      isActive: currentSection === 'inventory'
    },
    {
      id: 'projects',
      label: t('projects'),
      href: '/manager/maintenance/projects',
      icon: Folder,
      description: 'Track maintenance projects and work orders',
      isActive: currentSection === 'projects'
    }
  ];

  const getDefaultTitle = () => {
    switch (currentSection) {
      case 'inventory':
        return 'Building Inventory';
      case 'projects':
        return 'Maintenance Projects';
      default:
        return t('maintenanceJournal');
    }
  };

  const getDefaultDescription = () => {
    switch (currentSection) {
      case 'inventory':
        return 'Manage building elements, track conditions, and schedule maintenance activities according to Quebec standards.';
      case 'projects':
        return 'Plan, track, and manage maintenance projects with vendor coordination and budget tracking.';
      default:
        return '';
    }
  };

  return (
    <div className={cn('flex-1 flex flex-col h-full bg-background', className)}>
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <nav className="flex items-center space-x-2 text-sm" aria-label="Breadcrumb">
          {breadcrumbs.map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
              
              <div className="flex items-center space-x-1">
                {item.icon && <item.icon className="h-4 w-4 text-gray-500" />}
                {item.href && !item.current ? (
                  <Link href={item.href}>
                    <span className="text-gray-600 hover:text-gray-900 cursor-pointer transition-colors">
                      {item.label}
                    </span>
                  </Link>
                ) : (
                  <span className={cn(
                    'font-medium',
                    item.current ? 'text-blue-600' : 'text-gray-900'
                  )}>
                    {item.label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Section Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 px-4">
        <div className="flex space-x-8">
          {navigationTabs.map((tab) => (
            <Link key={tab.id} href={tab.href}>
              <div className={cn(
                'flex items-center space-x-2 py-4 px-1 border-b-2 transition-colors cursor-pointer',
                tab.isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}>
                <tab.icon className="h-5 w-5" />
                <span className="font-medium">{tab.label}</span>
                {tab.isActive && (
                  <Badge variant="secondary" className="ml-2">
                    Active
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-3">
              {currentSection === 'inventory' ? (
                <Package className="h-8 w-8 text-blue-600" />
              ) : (
                <Folder className="h-8 w-8 text-green-600" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {title || getDefaultTitle()}
                </h1>
                {(description || getDefaultDescription()) && (
                  <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                    {description || getDefaultDescription()}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Action buttons */}
          {actions && (
            <div className="flex items-center space-x-3">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="bg-gray-50 px-6 py-4">
        <div className="grid grid-cols-2 gap-4">
          {navigationTabs.map((tab) => (
            <Link key={tab.id} href={tab.href}>
              <Card className={cn(
                'cursor-pointer transition-all duration-200 hover:shadow-md',
                tab.isActive 
                  ? 'border-blue-200 bg-blue-50 ring-1 ring-blue-200' 
                  : 'hover:border-gray-300'
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className={cn(
                      'rounded-lg p-2',
                      tab.isActive 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-gray-100 text-gray-600'
                    )}>
                      <tab.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className={cn(
                        'font-medium',
                        tab.isActive ? 'text-blue-900' : 'text-gray-900'
                      )}>
                        {tab.label}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {tab.description}
                      </p>
                      {tab.isActive && (
                        <Badge variant="secondary" className="mt-2">
                          Current Section
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Separator />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/**
 * Higher-order component wrapper function
 * Use this to wrap your maintenance pages with unified navigation
 */
export function withMaintenanceNavigation<T extends Record<string, any>>(
  WrappedComponent: React.ComponentType<T>,
  sectionType: 'inventory' | 'projects',
  options?: {
    title?: string;
    description?: string;
    className?: string;
  }
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const WithMaintenanceNavigationComponent = (props: T) => {
    return (
      <MaintenanceNavigationHOC
        currentSection={sectionType}
        title={options?.title}
        description={options?.description}
        className={options?.className}
      >
        <WrappedComponent {...props} />
      </MaintenanceNavigationHOC>
    );
  };

  WithMaintenanceNavigationComponent.displayName = `withMaintenanceNavigation(${displayName})`;
  
  return WithMaintenanceNavigationComponent;
}

export default MaintenanceNavigationHOC;