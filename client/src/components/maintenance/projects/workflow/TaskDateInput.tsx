import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface TaskDateInputProps {
  taskId: string;
  currentValue: string | null;
  onDateChange: (taskId: string, field: string, value: string | null) => void;
  index: number;
  testIdPrefix: string;
}

export const TaskDateInput = ({ 
  taskId, 
  currentValue, 
  onDateChange, 
  index, 
  testIdPrefix 
}: TaskDateInputProps) => {
  return (
    <Input
      type="date"
      min={format(new Date(), 'yyyy-MM-dd')}
      value={currentValue || ''}
      onChange={(e) => {
        // Store the date string directly to avoid timezone issues
        const dateValue = e.target.value || null;
        onDateChange(taskId, 'dueDate', dateValue);
      }}
      className="flex-1"
      data-testid={`input-${testIdPrefix}-task-due-date-${index}`}
    />
  );
};