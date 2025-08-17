import { UserList } from '@/components/admin/user-list';
import { useLanguage } from '@/hooks/use-language';

/**
 * Management User Management page component.
 * Consolidates user management functionality for managers and admins.
 * This is the ONLY user management route - replaces /admin/user-management and /owner/user-management.
 * @returns JSX element for the management user management page.
 */
export default function ManagementUserManagement() {
  const { t } = useLanguage();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('userManagement')}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {t('manageUsersDescription')}
            </p>
          </div>

          <UserList />
        </div>
      </div>
    </div>
  );
}