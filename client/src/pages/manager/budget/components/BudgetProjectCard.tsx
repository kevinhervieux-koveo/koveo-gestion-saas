import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Check,
} from 'lucide-react';
import type { Project } from '../types';

export interface BudgetProjectCardProps {
  project: Project;
  hasPendingYear: boolean;
  isConfirming: boolean;
  minShiftableYear: number;
  maxShiftableYear: number;
  language: string;
  t: (key: string) => string;
  deleteQuickProjectPending: boolean;
  onShiftYear: (project: Project, delta: number) => void;
  onConfirmYear: (project: Project) => void;
  onToggleInclude: (project: Project, value: boolean) => void;
  onEdit: (project: Project) => void;
  onDeleteQuickProject: (project: Project) => void;
}

export function BudgetProjectCard({
  project,
  hasPendingYear,
  isConfirming,
  minShiftableYear,
  maxShiftableYear,
  language,
  t,
  deleteQuickProjectPending,
  onShiftYear,
  onConfirmYear,
  onToggleInclude,
  onEdit,
  onDeleteQuickProject,
}: BudgetProjectCardProps) {
  return (
    <div
      className={`border rounded-lg p-4 space-y-3 ${
        hasPendingYear ? 'border-primary ring-1 ring-primary/40 bg-primary/5' : ''
      }`}
      data-testid={`budget-project-card-${project.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{project.title}</h4>
            {project.isQuickProject && (
              <Badge variant="secondary" className="text-xs">
                {t('budgetQuickProjectBadge')}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {project.status}
            </Badge>
            {hasPendingYear && (
              <Badge
                variant="default"
                className="text-xs"
                data-testid={`badge-pending-year-${project.id}`}
              >
                {language === 'fr' ? 'Modification non enregistrée' : 'Unsaved change'}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">{t('budget')}:</span> $
              {project.totalBudget.toLocaleString()}
            </div>
            <div>
              <span className="font-medium">{t('budgetActualCost')}:</span> $
              {project.actualCost.toLocaleString()}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                disabled={project.financialYear <= minShiftableYear || isConfirming}
                onClick={() => onShiftYear(project, -1)}
                data-testid={`button-shift-prev-year-${project.id}`}
                title={language === 'fr' ? 'Période précédente' : 'Previous period'}
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span>
                <span className="font-medium">
                  {language === 'fr' ? 'Année financière' : 'Financial Year'}:
                </span>{' '}
                {project.financialYear}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                disabled={project.financialYear >= maxShiftableYear || isConfirming}
                onClick={() => onShiftYear(project, 1)}
                data-testid={`button-shift-next-year-${project.id}`}
                title={language === 'fr' ? 'Période suivante' : 'Next period'}
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            <div>
              <span className="font-medium">{t('cost')}:</span> $
              {(project.estimatedCost || project.totalBudget).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Label
            htmlFor={`project-include-${project.id}`}
            className="text-xs hidden sm:inline"
          >
            {t('budgetIncludeInBudget')}
          </Label>
          <Switch
            id={`project-include-${project.id}`}
            checked={project.includeInBudget}
            onCheckedChange={checked => onToggleInclude(project, checked)}
            data-testid={`switch-project-include-${project.id}`}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(project)}
            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex-shrink-0"
            data-testid={`button-edit-project-${project.id}`}
            title={t('edit')}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          {project.isQuickProject && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDeleteQuickProject(project)}
              disabled={deleteQuickProjectPending}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              data-testid={`button-delete-quick-project-${project.id}`}
              title={t('delete')}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      {hasPendingYear && (
        <div className="flex justify-end pt-2 border-t">
          <Button
            size="sm"
            onClick={() => onConfirmYear(project)}
            disabled={isConfirming}
            data-testid={`button-confirm-year-${project.id}`}
          >
            {isConfirming ? (
              <>
                <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                {t('saving')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-1" />
                {language === 'fr' ? 'Confirmer' : 'Confirm'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
