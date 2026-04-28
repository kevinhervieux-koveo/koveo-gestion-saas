import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useDocumentTitle } from '@/hooks/use-document-title';

export default function NotFound() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  useDocumentTitle('notFoundTitle');

  return (
    <div className='min-h-screen w-full flex items-center justify-center bg-gray-50'>
      <Card className='w-full max-w-md mx-4'>
        <CardContent className='pt-6'>
          <div className='flex mb-4 gap-2'>
            <AlertCircle className='h-8 w-8 text-red-500' />
            <h1 className='text-2xl font-bold text-gray-900'>{t('notFoundTitle')}</h1>
          </div>

          <p className='mt-4 text-sm text-gray-600'>{t('notFoundMessage')}</p>

          <div className='mt-6'>
            {isAuthenticated ? (
              <Link
                href='/dashboard/overview'
                className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
              >
                {t('goToDashboard')}
              </Link>
            ) : (
              <Link
                href='/login'
                className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
              >
                {t('goToLogin')}
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
