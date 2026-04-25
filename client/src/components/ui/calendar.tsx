import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { Button } from './button';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

// Keep the original interface for backward compatibility
export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  showActions?: boolean;
  onClear?: () => void;
  onToday?: () => void;
};

function Calendar({ 
  className, 
  classNames, 
  showOutsideDays = true, 
  showActions = false,
  onClear,
  onToday,
  ...props 
}: CalendarProps) {
  const handleTodayClick = () => {
    onToday?.();
  };

  const handleClearClick = () => {
    onClear?.();
  };

  return (
    <div className={cn('p-0', className)}>
      <DayPicker
        showOutsideDays={showOutsideDays}
        className="p-4"
        classNames={{
          months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
          month: 'space-y-4 w-full',
          month_caption: 'flex justify-center pt-1 relative items-center mb-4',
          caption_label: 'text-sm font-medium px-8',
          nav: 'absolute inset-x-0 top-0 flex items-center justify-between pointer-events-none',
          button_previous: cn(
            buttonVariants({ variant: 'outline' }),
            'h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 border-0 pointer-events-auto'
          ),
          button_next: cn(
            buttonVariants({ variant: 'outline' }),
            'h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 border-0 pointer-events-auto'
          ),
          month_grid: 'w-full border-collapse',
          weekdays: 'grid grid-cols-7 w-full mb-2',
          weekday: 'text-muted-foreground w-8 h-8 font-normal text-xs text-center flex items-center justify-center flex-shrink-0',
          week: 'grid grid-cols-7 w-full',
          day: 'relative h-8 w-8 text-center text-sm p-0 focus-within:relative focus-within:z-20 flex items-center justify-center flex-shrink-0',
          day_button: cn(
            buttonVariants({ variant: 'ghost' }),
            'h-8 w-8 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground transition-colors'
          ),
          range_end: 'range-end',
          range_start: 'range-start',
          selected:
            'bg-primary text-primary-foreground rounded-md hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
          today: 'bg-accent text-accent-foreground font-semibold rounded-md',
          outside:
            'outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
          disabled: 'text-muted-foreground opacity-50',
          range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
          hidden: 'invisible',
          ...classNames,
        }}
        components={{
          Chevron: ({ orientation, ...rest }) => {
            if (orientation === 'left') {
              return <ChevronLeft className="h-4 w-4" />;
            }
            return <ChevronRight className="h-4 w-4" />;
          },
        }}
        {...props}
      />
      {showActions && (onClear || onToday) && (
        <div className="flex items-center justify-between px-4 pb-3 pt-2 border-t">
          {onClear && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearClick}
              data-testid="calendar-clear"
            >
              Clear
            </Button>
          )}
          <div className="flex-1" />
          {onToday && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTodayClick}
              data-testid="calendar-today"
            >
              Today
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };

// Enhanced Calendar wrapper component that includes proper sizing and actions
export function CalendarPicker({
  selected,
  onSelect,
  className,
  showActions = true,
  ...props
}: {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  className?: string;
  showActions?: boolean;
} & Omit<CalendarProps, 'mode' | 'selected' | 'onSelect' | 'showActions' | 'onClear' | 'onToday'>) {
  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={onSelect}
      className={cn('min-w-[240px]', className)}
      showActions={showActions}
      onClear={() => onSelect?.(undefined)}
      onToday={() => onSelect?.(new Date())}
      {...(props as any)}
    />
  );
}
