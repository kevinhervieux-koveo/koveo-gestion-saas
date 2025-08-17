import {
  Home,
  ShieldCheck,
  CheckCircle,
  Settings,
  User,
  Building,
  Users,
  DollarSign,
  FileText,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  requiredRole?: string;
}

export interface NavigationSection {
  name: string;
  key: string;
  icon: React.ComponentType<any>;
  requiredRole: string;
  items: NavigationItem[];
}

/**
 * Consolidated navigation configuration for the entire application.
 * This is the single source of truth for all navigation structures.
 * 
 * Role hierarchy: tenant (1) = resident (1) < manager (2) < admin (3)
 */
export const NAVIGATION_CONFIG: NavigationSection[] = [
  {
    name: 'Residents',
    key: 'residents',
    icon: Users,
    requiredRole: 'tenant',
    items: [
      { name: 'My Residence', href: '/residents/residence', icon: Home },
      { name: 'My Building', href: '/residents/building', icon: Building },
      { name: 'My Demands', href: '/residents/demands', icon: AlertCircle },
    ],
  },
  {
    name: 'Manager',
    key: 'manager',
    icon: Building,
    requiredRole: 'manager',
    items: [
      { name: 'Buildings', href: '/manager/buildings', icon: Building },
      { name: 'Residences', href: '/manager/residences', icon: Home },
      { name: 'Budget', href: '/manager/budget', icon: DollarSign },
      { name: 'Bills', href: '/manager/bills', icon: FileText },
      { name: 'Demands', href: '/manager/demands', icon: AlertCircle },
    ],
  },
  {
    name: 'Admin',
    key: 'admin',
    icon: User,
    requiredRole: 'admin',
    items: [
      { name: 'Organizations', href: '/admin/organizations', icon: Building },
      { name: 'Documentation', href: '/admin/documentation', icon: FileText },
      { name: 'Pillars', href: '/admin/pillars', icon: Building },
      { name: 'Roadmap', href: '/admin/roadmap', icon: ShieldCheck },
      { name: 'Quality Assurance', href: '/admin/quality', icon: CheckCircle },
      { name: 'Suggestions', href: '/admin/suggestions', icon: Lightbulb },
      { name: 'RBAC Permissions', href: '/admin/permissions', icon: ShieldCheck },
    ],
  },
  {
    name: 'Settings',
    key: 'settings',
    icon: Settings,
    requiredRole: 'tenant',
    items: [
      { name: 'Settings', href: '/settings/settings', icon: Settings },
      { name: 'Bug Reports', href: '/settings/bug-reports', icon: AlertCircle },
      { name: 'Idea Box', href: '/settings/idea-box', icon: Lightbulb },
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
  manager: 2,
  admin: 3,
} as const;

/**
 * Helper function to check if a user has the required role or higher.
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 * @returns true if user has sufficient permissions
 */
export function hasRoleOrHigher(userRole: string | undefined, requiredRole: string): boolean {
  if (!userRole) return false;
  
  const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole as keyof typeof ROLE_HIERARCHY] || 0;
  
  return userLevel >= requiredLevel;
}

/**
 * Filter navigation sections based on user role.
 * @param userRole - The user's current role
 * @returns Array of navigation sections the user can access
 */
export function getFilteredNavigation(userRole: string | undefined): NavigationSection[] {
  return NAVIGATION_CONFIG
    .filter(section => hasRoleOrHigher(userRole, section.requiredRole))
    .map(section => ({
      ...section,
      items: section.items.filter(item => 
        !item.requiredRole || hasRoleOrHigher(userRole, item.requiredRole)
      )
    }));
}