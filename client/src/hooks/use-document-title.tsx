import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { translations } from '@/lib/i18n';

const APP_NAME = 'Koveo Gestion';

type TranslationKey = keyof typeof translations.en;

const ROUTE_TITLE_KEYS: Array<{ pattern: RegExp | string; key: TranslationKey }> = [
  { pattern: '/dashboard/overview', key: 'overview' },
  { pattern: '/dashboard/communication', key: 'communication' },
  { pattern: '/manager/buildings', key: 'buildings' },
  { pattern: '/manager/residences', key: 'residences' },
  { pattern: '/manager/budget', key: 'budget' },
  { pattern: '/manager/bills', key: 'bills' },
  { pattern: '/manager/invoices', key: 'invoiceManagement' },
  { pattern: '/manager/demands', key: 'demands' },
  { pattern: '/manager/user-management', key: 'navUserManagement' },
  { pattern: '/manager/common-spaces-stats', key: 'manageCommonSpaces' },
  { pattern: '/manager/maintenance/inventory', key: 'inventory' },
  { pattern: '/manager/maintenance/projects', key: 'projects' },
  { pattern: /^\/manager\/maintenance\/elements\/.+\/history$/, key: 'inventory' },
  { pattern: '/residents/residence', key: 'myResidence' },
  { pattern: '/residents/building', key: 'myBuilding' },
  { pattern: '/residents/demands', key: 'myDemands' },
  { pattern: '/resident/common-spaces', key: 'commonSpaces' },
  { pattern: '/resident/my-calendar', key: 'calendar' },
  { pattern: '/settings/general', key: 'settings' },
  { pattern: '/settings', key: 'settings' },
  { pattern: '/admin/organizations', key: 'organizations' },
  { pattern: '/admin/quality', key: 'navQualityAssurance' },
  { pattern: '/admin/compliance', key: 'navLaw25Compliance' },
  { pattern: '/admin/permissions', key: 'rbacPermissions' },
  { pattern: '/admin/bulk-document-import', key: 'navBulkDocumentImport' },
  { pattern: '/admin/document-tags', key: 'documentTags' },
  { pattern: '/admin/kpi-dashboard', key: 'navKpiDashboard' },
  { pattern: '/admin/impersonation-log', key: 'navImpersonationLog' },
  { pattern: '/admin/org-access', key: 'navOrgAccess' },
];

function findTitleKey(pathname: string): TranslationKey | null {
  const cleanPath = pathname.split('?')[0];
  for (const entry of ROUTE_TITLE_KEYS) {
    if (typeof entry.pattern === 'string') {
      if (cleanPath === entry.pattern || cleanPath.startsWith(entry.pattern + '/')) {
        return entry.key;
      }
    } else {
      if (entry.pattern.test(cleanPath)) {
        return entry.key;
      }
    }
  }
  return null;
}

export function useDocumentTitle(overrideKey?: TranslationKey) {
  const [location] = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    const key = overrideKey ?? findTitleKey(location);
    if (key) {
      document.title = `${t(key)} — ${APP_NAME}`;
    } else {
      document.title = APP_NAME;
    }
  }, [location, overrideKey, t]);
}

export function RouteDocumentTitle() {
  useDocumentTitle();
  return null;
}
