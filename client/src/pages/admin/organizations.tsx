import React from 'react';
import { Header } from '@/components/layout/header';
import { OrganizationsCard } from '@/components/admin/organizations-card';
import { useLanguage } from '@/hooks/use-language';

/**
 * Admin Organizations Management Page
 * Complete CRUD interface for managing organizations.
 */
export default function Organizations() {
  const { t } = useLanguage();
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title={t('adminOrganizationsTitle')}
        subtitle={t('adminOrganizationsSubtitle')}
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto'>
          <OrganizationsCard />
        </div>
      </div>
    </div>
  );
}
