import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CalendarPicker } from "@/components/ui/calendar";

interface DatePickerProps {
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  min?: Date;
  max?: Date;
  'data-testid'?: string;
}

export function DatePicker({
  date,
  onSelect,
  placeholder = "Pick a date",
  disabled = false,
  className,
  buttonClassName,
  min,
  max,
  'data-testid': dataTestId,
}: DatePickerProps) {
  const [displayMonth, setDisplayMonth] = React.useState(date || new Date());

  const handleSelect = (selectedDate: Date | undefined) => {
    onSelect?.(selectedDate);
  };

  const isDateDisabled = (day: Date) => {
    if (min && day < min) return true;
    if (max && day > max) return true;
    return false;
  };

  const goToPreviousMonth = () => {
    setDisplayMonth(subMonths(displayMonth, 1));
  };

  const goToNextMonth = () => {
    setDisplayMonth(addMonths(displayMonth, 1));
  };

  return (
    <div className={cn("space-y-3 border rounded-lg p-3 bg-background", className)} data-testid={dataTestId}>
      {/* Month/Year Navigation */}
      <div className="flex items-center justify-center relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPreviousMonth}
          className="absolute left-0 h-8 w-8 p-0"
          disabled={disabled}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-1">
          <span className="font-medium text-sm">
            {format(displayMonth, "MMMM yyyy")}
          </span>
          <div className="flex flex-col ml-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextMonth}
              className="h-3 w-4 p-0 hover:bg-muted"
              disabled={disabled}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost" 
              size="sm"
              onClick={goToPreviousMonth}
              className="h-3 w-4 p-0 hover:bg-muted"
              disabled={disabled}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={goToNextMonth}
          className="absolute right-0 h-8 w-8 p-0"
          disabled={disabled}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <CalendarPicker
        selected={date}
        onSelect={handleSelect}
        disabled={isDateDisabled}
        showActions={true}
        className="w-full"
        month={displayMonth}
        onMonthChange={setDisplayMonth}
      />

      {/* Selected Date Display */}
      {date && (
        <div className="text-center pt-2 border-t">
          <div className="text-sm font-medium">
            {format(date, "yyyy-MM-dd")}
          </div>
        </div>
      )}
    </div>
  );
}

// For React Hook Form integration
export interface FormDatePickerProps extends DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
}

export function FormDatePicker({
  value,
  onChange,
  ...props
}: FormDatePickerProps) {
  return (
    <DatePicker
      date={value}
      onSelect={onChange}
      {...props}
    />
  );
}

// Alternative prop names for consistency
export interface DatePickerAltProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  min?: Date;
  max?: Date;
  'data-testid'?: string;
}

export function DatePickerAlt({
  date,
  onDateChange,
  ...props
}: DatePickerAltProps) {
  return (
    <DatePicker
      date={date}
      onSelect={onDateChange}
      {...props}
    />
  );
}