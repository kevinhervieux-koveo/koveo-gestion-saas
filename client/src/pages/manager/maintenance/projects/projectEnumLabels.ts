type Translator = (key: string) => string;

export function translateProjectStatus(status: string | null | undefined, t: Translator): string {
  if (!status) return '';
  switch (status) {
    case 'planned': return t('pvStatusPlanned');
    case 'evaluation': return t('pvStatusEvaluation');
    case 'submission': return t('pvStatusSubmission');
    case 'pre_work': return t('pvStatusPreWork');
    case 'in_progress': return t('pvStatusActiveWork');
    case 'post_work': return t('pvStatusPostWork');
    case 'completed': return t('pvStatusCompleted');
    default: return status.replace(/_/g, ' ');
  }
}

export function translateProjectPriority(priority: string | null | undefined, t: Translator): string {
  if (!priority) return '';
  switch (priority) {
    case 'low': return t('low');
    case 'medium': return t('medium');
    case 'high': return t('high');
    case 'critical': return t('critical');
    default: return priority;
  }
}

export function translateProjectType(type: string | null | undefined, t: Translator): string {
  if (!type) return '';
  switch (type) {
    case 'repair': return t('pvTypeRepair');
    case 'minor_rehab': return t('pvTypeMinorRehab');
    case 'major_rehab': return t('pvTypeMajorRehab');
    case 'replacement': return t('pvTypeReplacement');
    case 'not_sure': return t('pvTypeNotSure');
    case 'inspection': return t('pvTypeInspection');
    default: return type.replace(/_/g, ' ');
  }
}

export function translateHealthStatus(health: string | null | undefined, t: Translator): string {
  if (!health) return '';
  switch (health) {
    case 'healthy': return t('pvHealthHealthy');
    case 'warning': return t('pvHealthWarning');
    case 'critical': return t('pvHealthCritical');
    default: return health;
  }
}

export function translateBreakdownName(name: string | null | undefined, t: Translator): string {
  if (!name) return '';
  switch (name) {
    case 'Completed': return t('pvStatusCompleted');
    case 'Active Work': return t('pvStatusActiveWork');
    case 'Pre-Work': return t('pvStatusPreWork');
    case 'Planned': return t('pvStatusPlanned');
    case 'Evaluation': return t('pvStatusEvaluation');
    case 'Submission': return t('pvStatusSubmission');
    case 'Post-Work': return t('pvStatusPostWork');
    case 'Low': return t('low');
    case 'Medium': return t('medium');
    case 'High': return t('high');
    case 'Critical': return t('critical');
    default: return name;
  }
}
