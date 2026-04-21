import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Project } from '../types';

interface MaintenanceProjectsResponse {
  data: any[];
}

function parseFyStartMonth(financialYearStart?: string): number {
  if (!financialYearStart) return new Date().getMonth() + 1;
  const match = financialYearStart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date().getMonth() + 1;
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return new Date().getMonth() + 1;
  return month;
}

function computeCurrentFinancialYear(financialYearStart?: string): number {
  const now = new Date();
  const fyStartMonth = parseFyStartMonth(financialYearStart);
  const calendarMonth = now.getMonth() + 1;
  const calendarYear = now.getFullYear();
  return calendarMonth < fyStartMonth ? calendarYear - 1 : calendarYear;
}

/**
 * Owns the maintenance-projects domain of the budget page:
 *  - the query that loads projects for the building
 *  - the `projects` state array rendered in the UI
 *  - the `projectStatesRef` map that preserves the user's
 *    includeInBudget toggles across refetches
 *  - the sync effect that converts server projects into our
 *    `Project[]` shape with a content-equality guard to prevent
 *    render-loop regressions (see Task #46).
 *
 * Returns `setProjects` / `projectStatesRef` so callers that still
 * mutate the list directly (remove, toggle includeInBudget) keep
 * working without a second refactor pass.
 */
export function useBudgetProjects(
  buildingId: string | undefined,
  financialYearStart: string | undefined
) {
  const [projects, setProjects] = useState<Project[]>([]);
  const projectStatesRef = useRef<Map<string, boolean>>(new Map());

  const {
    data: maintenanceProjectsResponse,
    isLoading: projectsLoading,
    error: projectsError,
  } = useQuery<MaintenanceProjectsResponse>({
    queryKey: ['/api/maintenance/buildings', buildingId, 'projects'],
    enabled: !!buildingId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (!maintenanceProjectsResponse?.data) return;

    const maintenanceProjects = maintenanceProjectsResponse.data;
    const currentFinancialYear = computeCurrentFinancialYear(financialYearStart);

    const relevantProjects = maintenanceProjects.filter(
      (project: any) => project.status !== 'completed'
    );

    const convertedProjects: Project[] = relevantProjects.map((project: any) => {
      const includeInBudget = projectStatesRef.current.get(project.id) ?? true;
      return {
        id: project.id,
        title: project.title || 'Untitled Project',
        totalBudget: parseFloat(project.totalBudget || '0'),
        actualCost: parseFloat(project.actualCost || '0'),
        financialYear: project.financialYear || currentFinancialYear,
        status: project.status || 'planned',
        type: project.type || 'maintenance',
        origin: project.origin || 'manual',
        isQuickProject: project.isQuickProject || false,
        plannedStartDate: project.plannedStartDate,
        plannedEndDate: project.plannedEndDate,
        estimatedCost: project.estimatedCost
          ? parseFloat(project.estimatedCost)
          : undefined,
        includeInBudget,
      };
    });

    setProjects((prev) => {
      if (prev.length === convertedProjects.length) {
        const sameContent = prev.every((p, i) => {
          const next = convertedProjects[i];
          return (
            p.id === next.id &&
            p.title === next.title &&
            p.totalBudget === next.totalBudget &&
            p.actualCost === next.actualCost &&
            p.financialYear === next.financialYear &&
            p.status === next.status &&
            p.type === next.type &&
            p.origin === next.origin &&
            p.isQuickProject === next.isQuickProject &&
            p.plannedStartDate === next.plannedStartDate &&
            p.plannedEndDate === next.plannedEndDate &&
            p.estimatedCost === next.estimatedCost &&
            p.includeInBudget === next.includeInBudget
          );
        });
        if (sameContent) return prev;
      }
      return convertedProjects;
    });
  }, [maintenanceProjectsResponse, financialYearStart]);

  return {
    projects,
    setProjects,
    projectStatesRef,
    projectsLoading,
    projectsError,
  };
}
