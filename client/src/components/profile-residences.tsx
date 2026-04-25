import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Home, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import type { UserResidenceProfileRow } from '@shared/schema';
import { translations } from '@/lib/i18n';

function formatRelationshipType(
  type: string,
  t: (key: keyof typeof translations.en) => string,
): string {
  switch (type) {
    case 'owner':
      return t('residenceRelationshipOwner');
    case 'tenant':
      return t('residenceRelationshipTenant');
    case 'occupant':
      return t('residenceRelationshipOccupant');
    default:
      return type;
  }
}

function formatDate(dateStr: string, language: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function ProfileResidences() {
  const { t, language } = useLanguage();

  const { data, isLoading, isError } = useQuery<UserResidenceProfileRow[]>({
    queryKey: ['/api/user/residences'],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  return (
    <Card data-testid='profile-residences-card'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Home className='w-5 h-5' />
          {t('myResidences')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className='space-y-3' data-testid='profile-residences-loading'>
            <Skeleton className='h-16 w-full rounded-md' />
            <Skeleton className='h-16 w-full rounded-md' />
          </div>
        )}

        {isError && !isLoading && (
          <div
            className='flex items-center gap-2 text-destructive text-sm'
            data-testid='profile-residences-error'
          >
            <AlertCircle className='w-4 h-4 flex-shrink-0' />
            <span>{t('residencesLoadError')}</span>
          </div>
        )}

        {!isLoading && !isError && data && data.length === 0 && (
          <p
            className='text-sm text-muted-foreground'
            data-testid='profile-residences-empty'
          >
            {t('noResidenceLinkedYet')}
          </p>
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <div className='space-y-3' data-testid='profile-residences-list'>
            {data.map((row) => (
              <div
                key={row.id}
                className='flex items-start justify-between p-3 border rounded-lg gap-4'
                data-testid={`profile-residence-row-${row.id}`}
              >
                <div className='space-y-1 min-w-0'>
                  <p className='font-medium text-sm leading-tight'>
                    {row.buildingName} &mdash; #{row.unitNumber}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {row.organizationName}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {t('residenceSince')} {formatDate(row.startDate, language)}
                  </p>
                </div>
                <Badge variant='secondary' className='flex-shrink-0 text-xs'>
                  {formatRelationshipType(row.relationshipType, t)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
