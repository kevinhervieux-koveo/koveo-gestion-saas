import { useEffect, useState } from 'react';
import { Download, Share, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/hooks/use-language';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'koveo-install-prompt-dismissed';

const copy = {
  en: {
    title: 'Install Koveo',
    androidBody: 'Add Koveo to your home screen for quick access.',
    iosBody: 'Install Koveo on your iPhone: tap',
    iosBody2: 'then',
    iosShare: 'Share',
    iosAdd: 'Add to Home Screen',
    install: 'Install',
    dismiss: 'Dismiss',
  },
  fr: {
    title: 'Installer Koveo',
    androidBody: "Ajoutez Koveo à votre écran d'accueil pour un accès rapide.",
    iosBody: 'Installez Koveo sur votre iPhone : appuyez sur',
    iosBody2: 'puis sur',
    iosShare: 'Partager',
    iosAdd: "Sur l'écran d'accueil",
    install: 'Installer',
    dismiss: 'Ignorer',
  },
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari
  return Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
}

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) !== null;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const isMobile = useIsMobile();
  const { language } = useLanguage();
  const t = copy[language] ?? copy.en;

  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    if (wasDismissed()) {
      setDismissed(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    if (isIOSDevice()) {
      setShowIOS(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'dismissed') {
        handleDismiss();
      }
    } catch {
      /* ignore */
    } finally {
      setDeferred(null);
    }
  };

  if (installed || dismissed || !isMobile) return null;
  if (!deferred && !showIOS) return null;

  return (
    <div
      data-testid='install-prompt-banner'
      className='fixed inset-x-3 bottom-3 z-50 md:hidden rounded-lg border border-gray-200 bg-white shadow-lg p-3 flex items-start gap-3'
      role='dialog'
      aria-label={t.title}
    >
      <div className='flex-shrink-0 w-10 h-10 rounded-md bg-blue-900 text-white flex items-center justify-center'>
        <Download className='w-5 h-5' />
      </div>
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-semibold text-gray-900'>{t.title}</p>
        {deferred ? (
          <p className='text-xs text-gray-600 mt-0.5'>{t.androidBody}</p>
        ) : (
          <p className='text-xs text-gray-600 mt-0.5 flex flex-wrap items-center gap-1'>
            <span>{t.iosBody}</span>
            <Share className='w-3.5 h-3.5 inline' aria-hidden='true' />
            <span className='font-medium'>{t.iosShare}</span>
            <span>{t.iosBody2}</span>
            <Plus className='w-3.5 h-3.5 inline' aria-hidden='true' />
            <span className='font-medium'>{t.iosAdd}</span>
          </p>
        )}
        {deferred && (
          <div className='mt-2'>
            <Button
              size='sm'
              onClick={handleInstall}
              data-testid='install-prompt-install-button'
            >
              {t.install}
            </Button>
          </div>
        )}
      </div>
      <button
        type='button'
        onClick={handleDismiss}
        aria-label={t.dismiss}
        data-testid='install-prompt-dismiss-button'
        className='flex-shrink-0 p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100'
      >
        <X className='w-4 h-4' />
      </button>
    </div>
  );
}

export default InstallPrompt;
