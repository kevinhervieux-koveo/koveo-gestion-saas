import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CalendarIcon, Download, Plus, Link2, Check } from 'lucide-react';
import { CalendarView } from './calendar-view';
import { useLanguage } from '@/hooks/use-language';

/**
 *
 */
interface CommonSpaceCalendarProps {
  space: {
    id: string;
    name: string;
    isReservable: boolean;
  };
  onExport?: () => void;
  onNewBooking?: (date?: Date) => void;
  className?: string;
}

/**
 * Reusable Common Space Calendar Component
 * Used across all pages that need to display space calendars.
 * @param root0
 * @param root0.space
 * @param root0.onExport
 * @param root0.onNewBooking
 * @param root0.className
 */
export function CommonSpaceCalendar({
  space,
  onExport,
  onNewBooking,
  className = '',
}: CommonSpaceCalendarProps) {
  const { language } = useLanguage();
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedCalendarType, setSelectedCalendarType] = useState<string | null>(null);
  const [showProviderStep, setShowProviderStep] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 shadow-sm ${className}`}>
      <div className='flex items-center justify-between mb-6'>
        <h3 className='text-lg font-semibold text-gray-900 flex items-center gap-2'>
          <CalendarIcon className='h-5 w-5 text-koveo-navy' />
          {language === 'fr' ? `Calendrier - ${space.name}` : `Calendar - ${space.name}`}
        </h3>
        <div className='flex gap-2'>
          {space.isReservable && onNewBooking && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onNewBooking();
              }}
              className='flex items-center gap-2'
              data-testid='button-new-booking-inline'
            >
              <Plus className='w-4 h-4' />
              {language === 'fr' ? 'Réserver' : 'Book'}
            </Button>
          )}
        </div>
      </div>

      <CalendarView
        mode='space'
        spaceId={space.id}
        showControls={false}
        onEventClick={(event) => {
          // Event clicked
        }}
        onDateClick={(date) => {
          // Date clicked
          onNewBooking?.(date);
        }}
        data-testid={`inline-calendar-${space.id}`}
      />
    </div>
  );
}
