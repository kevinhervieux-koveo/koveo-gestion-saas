import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface OverviewProjectCardProject {
  id: string;
  title: string;
  buildingName?: string;
  status: string;
  totalBudget?: number;
  actualCost?: number;
  estimatedCost?: number;
  isQuickProject?: boolean;
  includeInBudget?: boolean;
}

export interface OverviewProjectCardProps {
  project: OverviewProjectCardProject;
  baseYearLabel: string;
  baseYear: number | null;
  offset: number;
  minYear: number;
  maxYear: number;
  t: (key: string) => string;
  onShift: (projectId: string, delta: number) => void;
  onToggleInclude: (projectId: string, value: boolean) => void;
}

export function OverviewProjectCard({
  project,
  baseYearLabel,
  baseYear,
  offset,
  minYear,
  maxYear,
  t,
  onShift,
  onToggleInclude,
}: OverviewProjectCardProps) {
  const displayedYear = baseYear !== null ? baseYear + offset : null;
  const canPrev = displayedYear !== null && displayedYear > minYear;
  const canNext = displayedYear !== null && displayedYear < maxYear;

  return (
    <div
      className="border rounded-lg p-4 space-y-3"
      data-testid={`project-${project.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm">{project.title}</h4>
            {project.buildingName && (
              <Badge variant="default" className="text-xs">
                {project.buildingName}
              </Badge>
            )}
            {project.isQuickProject && (
              <Badge variant="secondary" className="text-xs">
                {t('quickProject')}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {project.status}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">{t('budget')}:</span> $
              {project.totalBudget?.toLocaleString() || 0}
            </div>
            <div>
              <span className="font-medium">{t('actual')}:</span> $
              {project.actualCost?.toLocaleString() || 0}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                disabled={!canPrev}
                onClick={() => onShift(project.id, -1)}
                data-testid={`button-overview-shift-prev-${project.id}`}
                title="Previous period"
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span data-testid={`overview-fy-${project.id}`}>
                <span className="font-medium">Fiscal Year:</span>{' '}
                {displayedYear ?? baseYearLabel}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                disabled={!canNext}
                onClick={() => onShift(project.id, 1)}
                data-testid={`button-overview-shift-next-${project.id}`}
                title="Next period"
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            <div>
              <span className="font-medium">{t('cost')}:</span> $
              {(project.estimatedCost || project.totalBudget)?.toLocaleString() || 0}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Label
            htmlFor={`project-include-${project.id}`}
            className="text-xs hidden sm:inline"
          >
            {t('include')}
          </Label>
          <Switch
            id={`project-include-${project.id}`}
            checked={project.includeInBudget ?? true}
            onCheckedChange={checked => onToggleInclude(project.id, checked)}
            data-testid={`switch-project-include-${project.id}`}
          />
        </div>
      </div>
    </div>
  );
}
