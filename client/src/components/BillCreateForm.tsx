import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/hooks/use-language';

interface BillCreateFormProps {
  onClose: () => void;
  selectedBuilding?: any;
  buildingId?: string;
  onSuccess?: () => void;
}

export function BillCreateForm({ onClose, selectedBuilding }: BillCreateFormProps) {
  const { t } = useLanguage();

  return (
    <Card className='p-6'>
      <h2 className='text-xl font-semibold mb-4'>{t('createNewBill')}</h2>
      <p className='text-gray-600 mb-4'>
        Bill creation form for {selectedBuilding?.name || 'selected building'}
      </p>
      <div className='flex gap-2'>
        <Button variant='outline' onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button>{t('createBill')}</Button>
      </div>
    </Card>
  );
}
