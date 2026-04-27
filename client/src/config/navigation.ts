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
  Shield,
  LayoutDashboard,
  AreaChart,
  MessageSquare,
  Wrench,
  Package,
  Folder,
  ClipboardList,
} from 'lucide-react';

// Import translation keys for navigation
export const NAVIGATION_KEYS = {
  dashboard: 'dashboard',
  quickActions: 'quickActions',
  calendar: 'calendar',
  communication: 'communication',
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
  pillars: 'pillars',
  roadmap: 'roadmap',
  qualityAssurance: 'qualityAssurance',
  law25Compliance: 'law25Compliance',
  suggestions: 'suggestions',
  rbacPermissions: 'rbacPermissions',
  bulkDocumentImport: 'bulkDocumentImport',
  impersonationLog: 'impersonationLog',
  maintenanceJournal: 'maintenanceJournal',
  inventory: 'inventory',
  projects: 'projects',
  settings: 'settings',
} as const;

/**
 * Navigation item with translation key
 */
export interface NavigationItem {
  nameKey: string; // Translation key instead of hardcoded name
  href?: string; // Optional for items that have sub-items
  icon: React.ComponentType<any>;
  requiredRole?: string;
  superAdminOnly?: boolean; // Restrict to internal Koveo staff only
  _key?: string; // Optional key for collapsible items
  items?: NavigationItem[]; // Optional sub-items for collapsible navigation
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
      { nameKey: 'overview', href: '/dashboard/overview', icon: LayoutDashboard },
      { nameKey: 'communication', href: '/dashboard/communication', icon: MessageSquare },
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
      { nameKey: 'documentTags', href: '/manager/document-tags', icon: FileText },
      { nameKey: 'manageCommonSpaces', href: '/manager/common-spaces-stats', icon: AreaChart },
      {
        nameKey: 'maintenanceJournal',
        _key: 'maintenanceJournal',
        icon: Wrench,
        items: [
          { nameKey: 'inventory', href: '/manager/maintenance/inventory', icon: Package },
          { nameKey: 'projects', href: '/manager/maintenance/projects', icon: Folder },
        ],
      },
    ],
  },

  {
    nameKey: 'admin',
    _key: 'admin',
    icon: User,
    requiredRole: 'admin',
    items: [
      { nameKey: 'navBulkDocumentImport', href: '/admin/bulk-document-import', icon: Folder },
    ],
  },
  {
    nameKey: 'superAdmin',
    _key: 'superAdmin',
    icon: ShieldCheck,
    requiredRole: 'super_admin',
    items: [
      { nameKey: 'organizations', href: '/admin/organizations', icon: Building },
      { nameKey: 'navQualityAssurance', href: '/admin/quality', icon: CheckCircle },
      { nameKey: 'navLaw25Compliance', href: '/admin/compliance', icon: Shield },
      { nameKey: 'rbacPermissions', href: '/admin/permissions', icon: ShieldCheck },
      { nameKey: 'navBulkDocumentImport', href: '/admin/bulk-document-import', icon: Folder },
      { nameKey: 'navImpersonationLog', href: '/admin/impersonation-log', icon: ClipboardList },
    ],
  },
  {
    nameKey: 'settings',
    _key: 'settings',
    icon: Settings,
    requiredRole: 'tenant',
    items: [
      { nameKey: 'settings', href: '/settings', icon: Settings },
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
  demo_tenant: 1, // Demo tenant has same permissions as tenant
  demo_resident: 1, // Demo resident has same permissions as resident
  manager: 2,
  demo_manager: 2, // Demo manager has same permissions as manager
  admin: 3,
  super_admin: 4, // Internal Koveo staff — highest privilege level
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
 * Internal Koveo staff email domain. Users with an admin role AND an email
 * matching this domain are considered "super admins" — they can see internal
 * developer/scan tooling such as the Quebec Law 25 compliance panel that
 * surfaces raw file paths, line numbers and Semgrep rule IDs.
 */
export const SUPER_ADMIN_EMAIL_DOMAIN = '@koveo-gestion.com';

/**
 * Returns true when the user has the `super_admin` role (internal Koveo staff).
 * The email-domain heuristic is no longer used here — role is the source of truth.
 * `SUPER_ADMIN_EMAIL_DOMAIN` is still used as an eligibility rule during user
 * creation/role assignment (server-side), but not as a runtime permission check.
 *
 * @param user - Authenticated user (or partial user shape) to inspect.
 * @returns True if the user qualifies as a super admin.
 */
export function isSuperAdmin(
  user: { role?: string | null; email?: string | null } | null | undefined
): boolean {
  if (!user || !user.role) {
    return false;
  }
  return user.role === 'super_admin';
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
export function getFilteredNavigation(
  userRole: string | undefined,
  user?: { role?: string | null; email?: string | null } | null
): NavigationSection[] {
  const userIsSuperAdmin = isSuperAdmin(user);
  return NAVIGATION_CONFIG.filter((section) => hasRoleOrHigher(userRole, section.requiredRole)).map(
    (section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (!item.requiredRole || hasRoleOrHigher(userRole, item.requiredRole)) &&
          (!item.superAdminOnly || userIsSuperAdmin)
      ),
    })
  );
}
