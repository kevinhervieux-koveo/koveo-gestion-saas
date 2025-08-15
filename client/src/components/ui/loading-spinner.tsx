import { Loader2 } from "lucide-react";

export function LoadingSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <div className="flex items-center space-x-2">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="text-sm text-gray-600">Loading...</span>
      </div>
    </div>
  );
}