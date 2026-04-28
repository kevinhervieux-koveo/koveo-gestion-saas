import { useEffect } from 'react';
import { Mail } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

const SUPPORT_EMAIL = 'support@koveo-gestion.com';

export default function HelpPlaceholderPage() {
  const { t } = useLanguage();

  useEffect(() => {
    document.title = `${t('helpPlaceholderTitle')} — Koveo Gestion`;
  }, [t]);

  return (
    <>
      <a
        href='#main-content'
        className='sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-koveo-navy focus:text-white focus:rounded focus:text-sm focus:font-medium'
      >
        Aller au contenu principal / Skip to main content
      </a>

      <main id='main-content' role='main' className='min-h-screen flex items-center justify-center bg-gray-50 p-6'>
        <div className='max-w-lg w-full text-center space-y-6'>
          <div className='rounded-full bg-muted p-5 inline-flex'>
            <Mail className='h-10 w-10 text-muted-foreground' />
          </div>

          <h1 className='text-2xl font-bold text-foreground'>{t('helpPlaceholderTitle')}</h1>

          <div className='space-y-3 text-muted-foreground'>
            <p>{t('helpPlaceholderBodyFr')}</p>
            <p>{t('helpPlaceholderBodyEn')}</p>
          </div>

          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className='inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors'
          >
            <Mail className='h-4 w-4' />
            {t('helpPlaceholderCta')}
          </a>
        </div>
      </main>
    </>
  );
}
