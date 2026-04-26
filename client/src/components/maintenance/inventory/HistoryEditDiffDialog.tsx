// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { fr as frLocale, enUS } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  User,
  Clock,
  Building,
  Wrench,
  TrendingUp,
} from 'lucide-react';
import { parseDateOnly } from '@/lib/utils';

interface AuditEntry {
  id: string;
  historyId: string;
  performedBy: string | null;
  editorName: string;
  changes: Record<string, unknown>;
  createdAt: string | null;
}

interface HistoryEntryRef {
  id: string;
  eventType: string;
  eventDate: string;
}

interface HistoryEditDiffDialogProps {
  entry: HistoryEntryRef | null;
  isOpen: boolean;
  onClose: () => void;
}

function EventTypeBadge({ eventType, t }: { eventType: string; t: (key: string) => string }) {
  const configs: Record<string, { variant: any; icon: any; label: string }> = {
    construction: { variant: 'secondary', icon: Building, label: t('htConstructionEventLabel') },
    repair: { variant: 'outline', icon: Wrench, label: t('htRepairEventLabel') },
    minor_rehab: { variant: 'default', icon: TrendingUp, label: t('htMinorRehabEventLabel') },
    major_rehab: { variant: 'destructive', icon: TrendingUp, label: t('htMajorRehabEventLabel') },
    replacement: { variant: 'secondary', icon: Building, label: t('htReplacementEventLabel') },
  };
  const config = configs[eventType] || configs.repair;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="text-xs">
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function formatFieldValue(
  field: string,
  value: unknown,
  t: (key: string) => string,
  language: string,
  vendors: Array<{ id: string; name: string }>,
): { text?: string; node?: React.ReactNode } {
  const dateFnsLocale = language === 'fr' ? frLocale : enUS;
  const datePattern = language === 'fr' ? 'd MMMM yyyy' : 'MMM d, yyyy';

  if (value === null || value === undefined) {
    return { text: t('htAuditValueNotSet') };
  }

  if (field === 'eventType') {
    return { node: <EventTypeBadge eventType={String(value)} t={t} /> };
  }

  if (field === 'eventDate') {
    const d = parseDateOnly(String(value));
    return { text: d ? format(d, datePattern, { locale: dateFnsLocale }) : String(value) };
  }

  if (field === 'cost') {
    const num = parseFloat(String(value));
    if (isNaN(num)) return { text: t('htAuditValueNotSet') };
    return { text: `$${num.toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` };
  }

  if (field === 'lifespanImpact') {
    return { text: `${value} ${t('htWarrantyYearsSuffix')}` };
  }

  if (field === 'vendorId') {
    const vendor = vendors.find((v) => v.id === String(value));
    return { text: vendor ? vendor.name : String(value) };
  }

  if (field === 'warranty') {
    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return { text: t('htAuditValueNotSet') };
      return {
        node: (
          <dl className="text-xs space-y-0.5">
            {entries.map(([k, v]) => (
              <div key={k} className="flex gap-1">
                <dt className="font-medium capitalize">{k}:</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        ),
      };
    }
    return { text: String(value) };
  }

  return { text: String(value) };
}

function FieldLabel({ field, t }: { field: string; t: (key: string) => string }) {
  const labels: Record<string, string> = {
    eventType: t('htAuditFieldEventType'),
    eventDate: t('htAuditFieldEventDate'),
    workDescription: t('htAuditFieldWorkDescription'),
    cost: t('htAuditFieldCost'),
    vendorId: t('htAuditFieldVendor'),
    lifespanImpact: t('htAuditFieldLifespanImpact'),
    warranty: t('htAuditFieldWarranty'),
  };
  return <span>{labels[field] || field}</span>;
}

function FieldValueCell({
  field,
  value,
  t,
  language,
  vendors,
}: {
  field: string;
  value: unknown;
  t: (key: string) => string;
  language: string;
  vendors: Array<{ id: string; name: string }>;
}) {
  const rendered = formatFieldValue(field, value, t, language, vendors);
  if (rendered.node) return <>{rendered.node}</>;
  return <span className={rendered.text === t('htAuditValueNotSet') ? 'text-muted-foreground italic' : ''}>{rendered.text}</span>;
}

export function HistoryEditDiffDialog({
  entry,
  isOpen,
  onClose,
}: HistoryEditDiffDialogProps) {
  const { t, language } = useLanguage();
  const dateFnsLocale = language === 'fr' ? frLocale : enUS;
  const [retryCount, setRetryCount] = useState(0);

  const {
    data: auditData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['/api/maintenance/history', entry?.id, 'audit', retryCount],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/maintenance/history/${entry!.id}/audit`);
      return res.json();
    },
    enabled: isOpen && !!entry?.id,
    staleTime: 30 * 1000,
  });

  const {
    data: vendorsData,
  } = useQuery({
    queryKey: ['/api/maintenance/vendors'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/maintenance/vendors');
      return res.json();
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const vendors: Array<{ id: string; name: string }> = vendorsData?.vendors ?? vendorsData?.data ?? [];
  const auditEntries: AuditEntry[] = auditData?.entries ?? [];

  const eventTypeLabels: Record<string, string> = {
    construction: t('htConstructionEventLabel'),
    repair: t('htRepairEventLabel'),
    minor_rehab: t('htMinorRehabEventLabel'),
    major_rehab: t('htMajorRehabEventLabel'),
    replacement: t('htReplacementEventLabel'),
  };

  const dialogTitle = entry
    ? (() => {
        const datePattern = language === 'fr' ? 'd MMMM yyyy' : 'MMM d, yyyy';
        const d = parseDateOnly(entry.eventDate);
        const dateStr = d ? format(d, datePattern, { locale: dateFnsLocale }) : entry.eventDate;
        const typeLabel = eventTypeLabels[entry.eventType] ?? entry.eventType;
        return `${t('htAuditDialogTitle')} — ${typeLabel} — ${dateStr}`;
      })()
    : t('htAuditDialogTitle');

  function renderContent() {
    if (isLoading) {
      return (
        <div className="space-y-4" data-testid="audit-dialog-loading">
          {[1, 2].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40 ml-auto" />
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8 space-y-3" data-testid="audit-dialog-error">
          <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="font-medium">{t('htAuditLoadError')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRetryCount((c) => c + 1);
              refetch();
            }}
          >
            {t('htAuditRetry')}
          </Button>
        </div>
      );
    }

    if (auditEntries.length === 0) {
      return (
        <div className="text-center py-8 space-y-2" data-testid="audit-dialog-empty">
          <p className="font-medium text-muted-foreground">{t('htAuditEmptyState')}</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {t('htAuditEmptyStateDetail')}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4" data-testid="audit-dialog-entries">
        {auditEntries.map((auditEntry, idx) => {
          const changes = auditEntry.changes as Record<string, { before: unknown; after: unknown }>;
          const diffFields = Object.entries(changes).filter(([k]) => k !== 'meta');

          const createdAtDate = auditEntry.createdAt ? parseISO(auditEntry.createdAt) : null;
          const timestampStr = createdAtDate
            ? format(createdAtDate, language === 'fr' ? "d MMMM yyyy 'à' HH:mm" : "MMM d, yyyy 'at' h:mm a", { locale: dateFnsLocale })
            : '—';

          return (
            <div
              key={auditEntry.id}
              className="border rounded-lg p-4 space-y-3"
              data-testid={`audit-entry-${idx}`}
            >
              <div className="flex items-start gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span data-testid={`audit-entry-editor-${idx}`}>
                    {auditEntry.editorName === 'System'
                      ? t('htAuditSystemEditor')
                      : auditEntry.editorName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                  <Clock className="h-3.5 w-3.5" />
                  <span data-testid={`audit-entry-timestamp-${idx}`}>{timestampStr}</span>
                </div>
              </div>

              {diffFields.length > 0 && (
                <table className="w-full text-sm" data-testid={`audit-entry-diff-${idx}`}>
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left pb-1 pr-3 font-medium w-1/3">{t('htAuditFieldColumnHeader')}</th>
                      <th className="text-left pb-1 pr-3 font-medium">{t('htAuditBeforeLabel')}</th>
                      <th className="text-left pb-1 font-medium">{t('htAuditAfterLabel')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {diffFields.map(([field, { before, after }]) => (
                      <tr key={field} className="align-top">
                        <td className="py-1.5 pr-3 font-medium text-muted-foreground text-xs">
                          <FieldLabel field={field} t={t} />
                        </td>
                        <td className="py-1.5 pr-3 text-xs max-w-[160px]">
                          <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 rounded px-1.5 py-0.5 inline-block">
                            <FieldValueCell field={field} value={before} t={t} language={language} vendors={vendors} />
                          </div>
                        </td>
                        <td className="py-1.5 text-xs max-w-[160px]">
                          <div className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 rounded px-1.5 py-0.5 inline-block">
                            <FieldValueCell field={field} value={after} t={t} language={language} vendors={vendors} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        data-testid="audit-diff-dialog"
      >
        <DialogHeader>
          <DialogTitle data-testid="audit-dialog-title">{dialogTitle}</DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
