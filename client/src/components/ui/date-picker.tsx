import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedDate: Date | undefined) => {
    onSelect?.(selectedDate);
    setOpen(false);
  };

  const isDateDisabled = (day: Date) => {
    if (min && day < min) return true;
    if (max && day > max) return true;
    return false;
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
              buttonClassName
            )}
            disabled={disabled}
            data-testid={dataTestId || "date-picker-trigger"}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarPicker
            selected={date}
            onSelect={handleSelect}
            disabled={isDateDisabled}
            showActions={true}
          />
        </PopoverContent>
      </Popover>
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