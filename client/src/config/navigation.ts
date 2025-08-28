import {
  Home,
  ShieldCheck,
  CheckCircle,
  Settings,
  User,
  Building,
  Building2,
  Users,
  DollarSign,
  FileText,
  AlertCircle,
  Lightbulb,
  Shield,
  LayoutDashboard,
  AreaChart,
} from 'lucide-react';

// Import translation keys for navigation
export const NAVIGATION_KEYS = {
  dashboard: 'dashboard',
  quickActions: 'quickActions',
  calendar: 'calendar',
  residents: 'residents',
  myResidence: 'myResidence',
  myBuilding: 'myBuilding',
  myDemands: 'myDemands',
  commonSpaces: 'commonSpaces',
  manager: 'manager',
  buildings: 'buildings',
  residences: 'residences',
  budget: 'budget',
  bills: 'bills',
  demands: 'demands',
  userManagement: 'userManagement',
  manageCommonSpaces: 'manageCommonSpaces',
  admin: 'admin',
  organizations: 'organizations',
  documentation: 'documentation',
  pillars: 'pillars',
  roadmap: 'roadmap',
  qualityAssurance: 'qualityAssurance',
  law25Compliance: 'law25Compliance',
  suggestions: 'suggestions',
  rbacPermissions: 'rbacPermissions',
  settings: 'settings',
  bugReports: 'bugReports',
  ideaBox: 'ideaBox',
} as const;

/**
 * Navigation item with translation key
 */
export interface NavigationItem {
  nameKey: string; // Translation key instead of hardcoded name
  href: string;
  icon: React.ComponentType<any>;
  requiredRole?: string;
}

/**
 * Navigation section with translation key
 */
export interface NavigationSection {
  nameKey: string; // Translation key instead of hardcoded name
  _key: string;
  icon: React.ComponentType<any>;
  requiredRole: string;
  items: NavigationItem[];
}

/**
 * Consolidated navigation configuration for the entire application.
 * This is the single source of truth for all navigation structures.
 *
 * Role hierarchy: tenant (1) = resident (1) < manager (2) < admin (3).
 */
export const NAVIGATION_CONFIG: NavigationSection[] = [
  {
    nameKey: 'dashboard',
    _key: 'dashboard',
    icon: LayoutDashboard,
    requiredRole: 'tenant',
    items: [
      { nameKey: 'quickActions', href: '/dashboard/quick-actions', icon: LayoutDashboard },
      { nameKey: 'calendar', href: '/dashboard/calendar', icon: AreaChart },
    ],
  },
  {
    nameKey: 'residents',
    _key: 'residents',
    icon: Users,
    requiredRole: 'tenant',
    items: [
      { nameKey: 'myResidence', href: '/residents/residence', icon: Home },
      { nameKey: 'myBuilding', href: '/residents/building', icon: Building },
      { nameKey: 'myDemands', href: '/residents/demands', icon: AlertCircle },
      {
        nameKey: 'commonSpaces',
        href: '/resident/common-spaces',
        icon: Building2,
        requiredRole: 'resident',
      },
    ],
  },
  {
    nameKey: 'manager',
    _key: 'manager',
    icon: Building,
    requiredRole: 'manager',
    items: [
      { nameKey: 'buildings', href: '/manager/buildings', icon: Building },
      { nameKey: 'residences', href: '/manager/residences', icon: Home },
      { nameKey: 'budget', href: '/manager/budget', icon: DollarSign },
      { nameKey: 'bills', href: '/manager/bills', icon: FileText },
      { nameKey: 'demands', href: '/manager/demands', icon: AlertCircle },
      { nameKey: 'navUserManagement', href: '/manager/user-management', icon: Users },
      { nameKey: 'manageCommonSpaces', href: '/manager/common-spaces-stats', icon: AreaChart },
    ],
  },

  {
    nameKey: 'admin',
    _key: 'admin',
    icon: User,
    requiredRole: 'admin',
    items: [
      { nameKey: 'organizations', href: '/admin/organizations', icon: Building },
      { nameKey: 'documentation', href: '/admin/documentation', icon: FileText },
      { nameKey: 'pillars', href: '/admin/pillars', icon: Building },
      { nameKey: 'roadmap', href: '/admin/roadmap', icon: ShieldCheck },
      { nameKey: 'navQualityAssurance', href: '/admin/quality', icon: CheckCircle },
      { nameKey: 'navLaw25Compliance', href: '/admin/compliance', icon: Shield },
      { nameKey: 'suggestions', href: '/admin/suggestions', icon: Lightbulb },
      { nameKey: 'rbacPermissions', href: '/admin/permissions', icon: ShieldCheck },
    ],
  },
  {
    nameKey: 'settings',
    _key: 'settings',
    icon: Settings,
    requiredRole: 'tenant',
    items: [
      { nameKey: 'settings', href: '/settings/settings', icon: Settings },
      { nameKey: 'bugReports', href: '/settings/bug-reports', icon: AlertCircle },
      { nameKey: 'ideaBox', href: '/settings/idea-box', icon: Lightbulb },
    ],
  },
];

/**
 * Role hierarchy configuration for permission checks.
 * Higher numbers indicate higher permissions.
 */
export const ROLE_HIERARCHY = {
  tenant: 1,
  resident: 1,
  demo_tenant: 1,    // Demo tenant has same permissions as tenant
  demo_resident: 1,  // Demo resident has same permissions as resident
  manager: 2,
  demo_manager: 2,   // Demo manager has same permissions as manager
  admin: 3,
} as const;

/**
 * Helper function to check if a user has the required role or higher.
 * @param userRole - The user's current role.
 * @param requiredRole - The minimum required role.
 * @returns True if user has sufficient permissions.
 */
/**
 * HasRoleOrHigher function.
 * @param userRole
 * @param requiredRole
 * @returns Function result.
 */
export function hasRoleOrHigher(userRole: string | undefined, requiredRole: string): boolean {
  if (!userRole) {
    return false;
  }

  const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole as keyof typeof ROLE_HIERARCHY] || 0;

  return userLevel >= requiredLevel;
}

/**
 * Filter navigation sections based on user role.
 * @param userRole - The user's current role.
 * @returns Array of navigation sections the user can access.
 */
/**
 * GetFilteredNavigation function.
 * @param userRole
 * @returns Function result.
 */
export function getFilteredNavigation(userRole: string | undefined): NavigationSection[] {
  return NAVIGATION_CONFIG.filter((section) => hasRoleOrHigher(userRole, section.requiredRole)).map(
    (section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.requiredRole || hasRoleOrHigher(userRole, item.requiredRole)
      ),
    })
  );
}
