import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// import { useBuildingContext } from '@/hooks/use-building-context';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  Building,
} from 'lucide-react';


export interface ProjectsHeaderProps {
  className?: string;
  buildingId?: string;
  organizationId?: string;
  buildingName?: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

/**
 * ProjectsHeader component for the maintenance projects page
 * Provides page title, breadcrumbs, view controls, actions, and filtering controls
 */
export function ProjectsHeader({
  className,
  buildingId,
  organizationId,
  buildingName,
  showBackButton,
  onBack,
}: ProjectsHeaderProps) {
  // Simplified placeholder - no context for now
  const building = null;
  const availableBuildings = [];
  const setBuildingId = () => {};
  const hasPermission = (permission: string) => true;
  // Permission checks (simplified for now)
  const canEdit = hasPermission('canEditMaintenance');
  const canCreate = hasPermission('canCreateProjects');
  const canViewReports = hasPermission('canViewReports');

  return (
    <div className={cn('space-y-4 p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60', className)}>
      {/* Building Navigation Bar */}
      {showBackButton && (
        <div className="flex items-center gap-3 pb-2 border-b">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              console.log('🔍 [PROJECTS] Navigating back to building', { buildingId, buildingName });
              onBack?.();
            }} 
            data-testid="back-to-building"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Building
          </Button>
          {buildingName && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>/</span>
              <Building className="h-4 w-4" />
              <span className="font-medium">{buildingName}</span>
            </div>
          )}
        </div>
      )}

      {/* Building Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Building Selector */}
          {availableBuildings.length > 1 && (
            <Select
              value={building?.id || ''}
              onValueChange={setBuildingId}
            >
              <SelectTrigger className="w-40" data-testid="building-selector">
                <SelectValue placeholder="Select building..." />
              </SelectTrigger>
              <SelectContent>
                {availableBuildings.map((bldg) => (
                  <SelectItem key={bldg.id} value={bldg.id}>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      <span>{bldg.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>


    </div>
  );
}