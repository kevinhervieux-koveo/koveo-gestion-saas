import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign, Trash2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { BuildingContextProvider } from '@/hooks/use-building-context';
import { ProjectWorkflowModal } from '@/components/maintenance/projects/workflow/lazy-components';
import type { MaintenanceProject } from '@shared/schemas/maintenance';
import type { UseMutationResult } from '@tanstack/react-query';

export interface QuickProjectData {
  title: string;
  totalBudget: string;
  financialYear: string;
  plannedMonth: string;
  plannedDay: string;
  plannedEndDate: string;
  description: string;
}

export interface EditingProjectData extends QuickProjectData {
  id: string;
  isQuickProject: boolean;
}

export interface CreateProjectPayload {
  title: string;
  totalBudget: number;
  financialYear: number;
  plannedMonth: number;
  plannedDay: number;
  plannedEndDate?: string;
  description: string;
}

export interface UpdateProjectPayload extends CreateProjectPayload {
  id: string;
}

interface BudgetProjectDialogsProps {
  addQuickProjectDialogOpen: boolean;
  setAddQuickProjectDialogOpen: (open: boolean) => void;
  newQuickProject: QuickProjectData;
  setNewQuickProject: React.Dispatch<React.SetStateAction<QuickProjectData>>;
  createQuickProjectMutation: UseMutationResult<any, Error, CreateProjectPayload>;
  editProjectDialogOpen: boolean;
  setEditProjectDialogOpen: (open: boolean) => void;
  editingProject: EditingProjectData | null;
  setEditingProject: React.Dispatch<React.SetStateAction<EditingProjectData | null>>;
  updateProjectMutation: UseMutationResult<any, Error, UpdateProjectPayload>;
  deleteQuickProjectMutation: UseMutationResult<any, Error, string>;
  selectedProjectForWorkflow: MaintenanceProject | null;
  setSelectedProjectForWorkflow: (project: MaintenanceProject | null) => void;
  showProjectWorkflowModal: boolean;
  setShowProjectWorkflowModal: (open: boolean) => void;
  buildingId?: string;
  organizationId?: string;
  onProjectWorkflowClose: () => void;
  onProjectUpdate: (project: MaintenanceProject) => void;
  onProjectDelete?: () => void;
}

export function BudgetProjectDialogs({
  addQuickProjectDialogOpen,
  setAddQuickProjectDialogOpen,
  newQuickProject,
  setNewQuickProject,
  createQuickProjectMutation,
  editProjectDialogOpen,
  setEditProjectDialogOpen,
  editingProject,
  setEditingProject,
  updateProjectMutation,
  deleteQuickProjectMutation,
  selectedProjectForWorkflow,
  setSelectedProjectForWorkflow,
  showProjectWorkflowModal,
  setShowProjectWorkflowModal,
  buildingId,
  organizationId,
  onProjectWorkflowClose,
  onProjectUpdate,
  onProjectDelete,
}: BudgetProjectDialogsProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();

  return (
    <>
      <Dialog open={addQuickProjectDialogOpen} onOpenChange={setAddQuickProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('budgetAddQuickProject')}</DialogTitle>
            <DialogDescription>
              {t('budgetAddQuickProjectDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor="quick-project-title">{t('budgetProjectTitle')} *</Label>
              <Input
                id="quick-project-title"
                value={newQuickProject.title}
                onChange={(e) => setNewQuickProject(prev => ({ ...prev, title: e.target.value }))}
                placeholder={t('budgetEnterProjectTitle')}
                data-testid="input-quick-project-title"
              />
            </div>
            
            <div className='space-y-2'>
              <Label htmlFor="quick-project-description">{t('description')}</Label>
              <Input
                id="quick-project-description"
                value={newQuickProject.description}
                onChange={(e) => setNewQuickProject(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('budgetOptionalProjectDescription')}
                data-testid="input-quick-project-description"
              />
            </div>
            
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor="quick-project-budget">{t('budgetTotalBudget')} *</Label>
                <div className='relative'>
                  <DollarSign className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                  <Input
                    id="quick-project-budget"
                    type="number"
                    step="0.01"
                    value={newQuickProject.totalBudget}
                    onChange={(e) => setNewQuickProject(prev => ({ ...prev, totalBudget: e.target.value }))}
                    className="pl-9"
                    placeholder="0.00"
                    data-testid="input-quick-project-budget"
                  />
                </div>
              </div>
              
              <div className='space-y-2'>
                <Label htmlFor="quick-project-financial-year">{t('budgetProjectFinancialYear')} *</Label>
                <Input
                  id="quick-project-financial-year"
                  type="number"
                  value={newQuickProject.financialYear}
                  onChange={(e) => setNewQuickProject(prev => ({ ...prev, financialYear: e.target.value }))}
                  placeholder={new Date().getFullYear().toString()}
                  data-testid="input-quick-project-financial-year"
                />
              </div>
            </div>
            
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor="quick-project-month">{t('month')} *</Label>
                <Select
                  value={newQuickProject.plannedMonth}
                  onValueChange={(value) => setNewQuickProject(prev => ({ ...prev, plannedMonth: value }))}
                >
                  <SelectTrigger id="quick-project-month" data-testid="select-quick-project-month">
                    <SelectValue placeholder={t('selectMonth')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <SelectItem key={month} value={month.toString()}>
                        {new Date(2000, month - 1).toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className='space-y-2'>
                <Label htmlFor="quick-project-day">{t('day')} *</Label>
                <Select
                  value={newQuickProject.plannedDay}
                  onValueChange={(value) => setNewQuickProject(prev => ({ ...prev, plannedDay: value }))}
                >
                  <SelectTrigger id="quick-project-day" data-testid="select-quick-project-day">
                    <SelectValue placeholder={t('selectDay')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <SelectItem key={day} value={day.toString()}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor="quick-project-end-date">{t('budgetPlannedEndDate')}</Label>
              <Input
                id="quick-project-end-date"
                type="date"
                value={newQuickProject.plannedEndDate}
                onChange={(e) => setNewQuickProject(prev => ({ ...prev, plannedEndDate: e.target.value }))}
                data-testid="input-quick-project-end-date"
              />
            </div>
            
            <div className='flex gap-2 pt-4'>
              <Button 
                onClick={() => {
                  if (!newQuickProject.title.trim() || !newQuickProject.totalBudget || !newQuickProject.financialYear || !newQuickProject.plannedMonth || !newQuickProject.plannedDay) {
                    toast({
                      title: t('validationError'),
                      description: t('budgetPleaseCompleteRequiredFields'),
                      variant: 'destructive',
                    });
                    return;
                  }

                  createQuickProjectMutation.mutate({
                    title: newQuickProject.title.trim(),
                    totalBudget: parseFloat(newQuickProject.totalBudget),
                    financialYear: parseInt(newQuickProject.financialYear),
                    plannedMonth: parseInt(newQuickProject.plannedMonth),
                    plannedDay: parseInt(newQuickProject.plannedDay),
                    plannedEndDate: newQuickProject.plannedEndDate || undefined,
                    description: newQuickProject.description,
                  });
                }}
                disabled={createQuickProjectMutation.isPending}
                className='flex-1' 
                data-testid="button-save-quick-project"
              >
                {createQuickProjectMutation.isPending ? (
                  <>
                    <div className='animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2'></div>
                    {t('saving')}
                  </>
                ) : (
                  t('budgetAddProject')
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setAddQuickProjectDialogOpen(false);
                  setNewQuickProject({
                    title: '',
                    totalBudget: '',
                    financialYear: new Date().getFullYear().toString(),
                    plannedMonth: (new Date().getMonth() + 1).toString(),
                    plannedDay: new Date().getDate().toString(),
                    plannedEndDate: '',
                    description: '',
                  });
                }}
                data-testid="button-cancel-quick-project"
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editProjectDialogOpen} onOpenChange={setEditProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'fr' ? 'Modifier le projet' : 'Edit Project'}</DialogTitle>
            <DialogDescription>
              {language === 'fr' ? 'Modifiez les détails du projet' : 'Update project details'}
            </DialogDescription>
          </DialogHeader>
          {editingProject && (
            <div className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor="edit-project-title">{t('budgetProjectTitle')} *</Label>
                <Input
                  id="edit-project-title"
                  value={editingProject.title}
                  onChange={(e) => setEditingProject(prev => prev ? { ...prev, title: e.target.value } : null)}
                  placeholder={t('budgetEnterProjectTitle')}
                  data-testid="input-edit-project-title"
                />
              </div>
              
              <div className='space-y-2'>
                <Label htmlFor="edit-project-description">{t('description')}</Label>
                <Input
                  id="edit-project-description"
                  value={editingProject.description}
                  onChange={(e) => setEditingProject(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder={t('budgetOptionalProjectDescription')}
                  data-testid="input-edit-project-description"
                />
              </div>
              
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor="edit-project-budget">{t('budgetTotalBudget')} *</Label>
                  <div className='relative'>
                    <DollarSign className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                    <Input
                      id="edit-project-budget"
                      type="number"
                      step="0.01"
                      value={editingProject.totalBudget}
                      onChange={(e) => setEditingProject(prev => prev ? { ...prev, totalBudget: e.target.value } : null)}
                      className="pl-9"
                      placeholder="0.00"
                      data-testid="input-edit-project-budget"
                    />
                  </div>
                </div>
                
                <div className='space-y-2'>
                  <Label htmlFor="edit-project-financial-year">{t('budgetProjectFinancialYear')} *</Label>
                  <Input
                    id="edit-project-financial-year"
                    type="number"
                    value={editingProject.financialYear}
                    onChange={(e) => setEditingProject(prev => prev ? { ...prev, financialYear: e.target.value } : null)}
                    placeholder={new Date().getFullYear().toString()}
                    data-testid="input-edit-project-financial-year"
                  />
                </div>
              </div>
              
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor="edit-project-month">{t('month')} *</Label>
                  <Select
                    value={editingProject.plannedMonth}
                    onValueChange={(value) => setEditingProject(prev => prev ? { ...prev, plannedMonth: value } : null)}
                  >
                    <SelectTrigger id="edit-project-month" data-testid="select-edit-project-month">
                      <SelectValue placeholder={t('selectMonth')} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <SelectItem key={month} value={month.toString()}>
                          {new Date(2000, month - 1).toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className='space-y-2'>
                  <Label htmlFor="edit-project-day">{t('day')} *</Label>
                  <Select
                    value={editingProject.plannedDay}
                    onValueChange={(value) => setEditingProject(prev => prev ? { ...prev, plannedDay: value } : null)}
                  >
                    <SelectTrigger id="edit-project-day" data-testid="select-edit-project-day">
                      <SelectValue placeholder={t('selectDay')} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className='flex gap-2 pt-4'>
                <Button 
                  onClick={() => {
                    if (!editingProject.title.trim() || !editingProject.totalBudget || !editingProject.financialYear || !editingProject.plannedMonth || !editingProject.plannedDay) {
                      toast({
                        title: t('validationError'),
                        description: t('budgetPleaseCompleteRequiredFields'),
                        variant: 'destructive',
                      });
                      return;
                    }

                    updateProjectMutation.mutate({
                      id: editingProject.id,
                      title: editingProject.title.trim(),
                      totalBudget: parseFloat(editingProject.totalBudget),
                      financialYear: parseInt(editingProject.financialYear),
                      plannedMonth: parseInt(editingProject.plannedMonth),
                      plannedDay: parseInt(editingProject.plannedDay),
                      description: editingProject.description,
                    });
                  }}
                  disabled={updateProjectMutation.isPending}
                  className='flex-1' 
                  data-testid="button-save-edit-project"
                >
                  {updateProjectMutation.isPending ? (
                    <>
                      <div className='animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2'></div>
                      {t('saving')}
                    </>
                  ) : (
                    t('budgetSaveChanges')
                  )}
                </Button>
                {editingProject.isQuickProject && (
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      if (confirm(t('budgetDeleteQuickProjectConfirm').replace('{title}', editingProject.title))) {
                        deleteQuickProjectMutation.mutate(editingProject.id);
                        setEditProjectDialogOpen(false);
                        setEditingProject(null);
                      }
                    }}
                    disabled={deleteQuickProjectMutation.isPending}
                    data-testid="button-delete-edit-project"
                  >
                    {deleteQuickProjectMutation.isPending ? (
                      <>
                        <div className='animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2'></div>
                        {t('deleting')}
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('delete')}
                      </>
                    )}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setEditProjectDialogOpen(false);
                    setEditingProject(null);
                  }}
                  data-testid="button-cancel-edit-project"
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedProjectForWorkflow && buildingId && (
        <BuildingContextProvider initialBuildingId={buildingId} initialOrganizationId={organizationId}>
          <ProjectWorkflowModal
            isOpen={showProjectWorkflowModal}
            onOpenChange={(open) => {
              setShowProjectWorkflowModal(open);
              if (!open) {
                setSelectedProjectForWorkflow(null);
                onProjectWorkflowClose();
              }
            }}
            project={selectedProjectForWorkflow}
            onProjectUpdate={(updatedProject) => {
              setSelectedProjectForWorkflow(updatedProject);
              onProjectUpdate(updatedProject);
            }}
            onProjectDelete={() => {
              setShowProjectWorkflowModal(false);
              setSelectedProjectForWorkflow(null);
              if (onProjectDelete) {
                onProjectDelete();
              }
            }}
          />
        </BuildingContextProvider>
      )}
    </>
  );
}
