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
          caption: 'flex justify-center pt-1 relative items-center mb-4',
          caption_label: 'text-sm font-medium px-8',
          nav: 'space-x-1 flex items-center',
          nav_button: cn(
            buttonVariants({ variant: 'outline' }),
            'h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 border-0'
          ),
          nav_button_previous: 'absolute left-0',
          nav_button_next: 'absolute right-0',
          table: 'w-full border-collapse space-y-0',
          head_row: 'grid grid-cols-7 w-full mb-2',
          head_cell: 'text-muted-foreground w-8 h-8 font-normal text-xs text-center flex items-center justify-center flex-shrink-0',
          row: 'grid grid-cols-7 w-full',
          cell: 'relative h-8 w-8 text-center text-sm p-0 focus-within:relative focus-within:z-20 flex items-center justify-center flex-shrink-0',
          day: cn(
            buttonVariants({ variant: 'ghost' }),
            'h-8 w-8 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground transition-colors'
          ),
          day_range_end: 'day-range-end',
          day_selected:
            'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
          day_today: 'bg-accent text-accent-foreground font-semibold',
          day_outside:
            'day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
          day_disabled: 'text-muted-foreground opacity-50',
          day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
          day_hidden: 'invisible',
          ...classNames,
        }}
        components={{
          Chevron: ({ ...props }) => {
            if (props.orientation === 'left') {
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