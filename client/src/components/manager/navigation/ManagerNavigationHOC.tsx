import { ComponentType } from 'react';
import { Link, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/hooks/use-language';
import { 
  Home, 
  Settings, 
  ChevronRight,
  Receipt,
  Home as HomeIcon,
  DollarSign,
  Building,
  Users,
  FileText,
  BarChart3,
  type LucideIcon
} from 'lucide-react';

// Navigation section configuration
export interface ManagerSection {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  isActive: boolean;
}

// HOC options interface
export interface ManagerNavigationOptions {
  title?: string;
  description?: string;
}

// Component props with navigation options
export interface WithManagerNavigationProps {
  title?: string;
  description?: string;
}

/**
 * Generic Manager Navigation HOC Component
 * Provides unified navigation, breadcrumbs, and section management for all manager pages
 */
function ManagerNavigationLayout({
  currentSection,
  title,
  description,
  children
}: {
  currentSection: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const [location] = useLocation();
  
  // Preserve query parameters when navigating between manager sections
  const currentSearchParams = typeof window !== 'undefined' ? window.location.search : '';
  const preserveParams = (href: string) => `${href}${currentSearchParams}`;

  // Define all manager sections with their configuration
  const managerSections: ManagerSection[] = [
    {
      id: 'bills',
      label: t('bills') || 'Bills',
      href: preserveParams('/manager/bills'),
      icon: Receipt,
      description: 'Manage property bills, invoices, and financial documents',
      isActive: currentSection === 'bills'
    },
    {
      id: 'residences',
      label: t('residences') || 'Residences',
      href: preserveParams('/manager/residences'),
      icon: HomeIcon,
      description: 'Manage residence information, units, and property details',
      isActive: currentSection === 'residences'
    },
    {
      id: 'budget',
      label: t('budget') || 'Budget',
      href: preserveParams('/manager/budget'),
      icon: DollarSign,
      description: 'Plan and track financial budgets for property management',
      isActive: currentSection === 'budget'
    },
    {
      id: 'buildings',
      label: t('buildings') || 'Buildings',
      href: preserveParams('/manager/buildings'),
      icon: Building,
      description: 'Manage building information and property assets',
      isActive: currentSection === 'buildings'
    },
    {
      id: 'user-management',
      label: t('userManagement') || 'User Management',
      href: preserveParams('/manager/user-management'),
      icon: Users,
      description: 'Manage users, roles, and access permissions',
      isActive: currentSection === 'user-management'
    },
    {
      id: 'demands',
      label: t('demands') || 'Demands',
      href: preserveParams('/manager/demands'),
      icon: FileText,
      description: 'Handle resident requests and maintenance demands',
      isActive: currentSection === 'demands'
    },
    {
      id: 'maintenance',
      label: t('maintenanceJournal') || 'Maintenance Journal',
      href: preserveParams('/manager/maintenance/inventory'),
      icon: Settings,
      description: 'Comprehensive building maintenance management system',
      isActive: currentSection === 'maintenance'
    },
    {
      id: 'common-spaces-stats',
      label: 'Common Spaces',
      href: preserveParams('/manager/common-spaces-stats'),
      icon: BarChart3,
      description: 'Monitor and analyze common space usage statistics',
      isActive: currentSection === 'common-spaces-stats'
    }
  ];

  // Get default title based on current section
  const getDefaultTitle = () => {
    switch (currentSection) {
      case 'bills':
        return 'Bills Management';
      case 'residences':
        return 'Residence Management';
      case 'budget':
        return 'Budget Management';
      case 'buildings':
        return 'Buildings Management';
      case 'user-management':
        return 'User Management';
      case 'demands':
        return 'Demands Management';
      case 'maintenance':
        return 'Maintenance Management';
      case 'common-spaces-stats':
        return 'Common Spaces Management';
      default:
        return t('manager') || 'Manager';
    }
  };

  // Get default description based on current section
  const getDefaultDescription = () => {
    const section = managerSections.find(s => s.id === currentSection);
    return section?.description || '';
  };

  // Breadcrumb configuration
  const breadcrumbs = [
    {
      label: t('dashboard') || 'Dashboard',
      href: '/dashboard',
      icon: Home,
      isActive: false
    },
    {
      label: t('manager') || 'Manager',
      href: '/manager',
      icon: Settings,
      isActive: false
    },
    {
      label: title || getDefaultTitle(),
      href: location,
      icon: managerSections.find(s => s.id === currentSection)?.icon || Settings,
      isActive: true
    }
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header Section */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center space-x-2">
                {index > 0 && <ChevronRight className="h-3 w-3" />}
                {crumb.isActive ? (
                  <div className="flex items-center space-x-1 font-medium text-foreground">
                    <crumb.icon className="h-3 w-3" />
                    <span>{crumb.label}</span>
                  </div>
                ) : (
                  <Link href={crumb.href}>
                    <div className="flex items-center space-x-1 hover:text-foreground transition-colors">
                      <crumb.icon className="h-3 w-3" />
                      <span>{crumb.label}</span>
                    </div>
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Page Header */}
          <div className="flex items-center justify-between">
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

          {/* Manager Section Navigation Tabs */}
          <div className="mt-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 overflow-x-auto">
                {managerSections.map((section) => (
                  <Link key={section.id} href={section.href}>
                    <div
                      className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                        section.isActive
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <section.icon className="h-5 w-5" />
                      <span className="font-medium">{section.label}</span>
                      {section.isActive && (
                        <Badge variant="secondary" className="ml-2">
                          Active
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {managerSections.slice(0, 4).map((section) => (
            <Card 
              key={section.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                section.isActive ? 'ring-2 ring-blue-500 shadow-md' : ''
              }`}
            >
              <Link href={section.href}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {section.label}
                  </CardTitle>
                  <section.icon className={`h-4 w-4 ${
                    section.isActive ? 'text-blue-600' : 'text-muted-foreground'
                  }`} />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {section.description}
                  </p>
                  {section.isActive && (
                    <Badge variant="secondary" className="mt-2">
                      Current Section
                    </Badge>
                  )}
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>

        <Separator className="mb-6" />

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Higher Order Component for Manager Navigation
 * Wraps manager pages with unified navigation, breadcrumbs, and section management
 */
export function withManagerNavigation<T extends Record<string, any>>(
  Component: ComponentType<T>,
  sectionId: string,
  options: ManagerNavigationOptions = {}
) {
  const WrappedComponent = (props: T & WithManagerNavigationProps) => {
    const { title: propTitle, description: propDescription, ...componentProps } = props;
    
    return (
      <ManagerNavigationLayout
        currentSection={sectionId}
        title={propTitle || options.title}
        description={propDescription || options.description}
      >
        <Component {...(componentProps as T)} />
      </ManagerNavigationLayout>
    );
  };

  WrappedComponent.displayName = `withManagerNavigation(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

export default ManagerNavigationLayout;