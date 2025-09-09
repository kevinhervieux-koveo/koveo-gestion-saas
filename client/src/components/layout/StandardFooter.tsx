import { Shield } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useSmoothLocationSetter } from '@/hooks/use-smooth-navigation';
import koveoLogo from '@/assets/koveo-logo.jpg';

/**
 * Standardized footer component used across all public pages
 */
export function StandardFooter() {
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const setLocation = useSmoothLocationSetter();

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <footer className='bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-7xl mx-auto'>
        <div className='grid grid-cols-1 md:grid-cols-12 gap-8'>
          {/* Left section - Logo and description */}
          <div className='md:col-span-6 lg:col-span-5'>
            <div className='flex items-center mb-4'>
              <img 
                src={koveoLogo} 
                alt='Koveo Gestion' 
                className='h-12 w-12 rounded-lg object-cover shadow-sm mr-4 cursor-pointer hover:opacity-80 transition-opacity' 
                onClick={scrollToTop}
                data-testid='footer-logo'
              />
              <span className='text-xl font-semibold'>Koveo Gestion</span>
            </div>
            <p className='text-gray-400 mb-6 max-w-md'>
              {language === 'fr' 
                ? 'Solution de gestion immobilière complète conçue spécifiquement pour les communautés résidentielles du Québec'
                : 'Comprehensive property management solution designed specifically for Quebec residential communities'
              }
            </p>
            
            {/* Quebec Law 25 Compliance */}
            <div className='flex items-center text-gray-400'>
              <Shield className='h-4 w-4 mr-2' />
              <span className='text-sm'>
                {language === 'fr' 
                  ? 'Conforme à la Loi 25 du Québec • Vos données sont protégées'
                  : 'Quebec Law 25 Compliant • Your data is protected'
                }
              </span>
            </div>
          </div>

          {/* Navigation section */}
          <div className='md:col-span-3 lg:col-span-3'>
            <h3 className='text-lg font-semibold mb-4'>
              {language === 'fr' ? 'Navigation' : 'Navigation'}
            </h3>
            <ul className='space-y-3'>
              <li>
                <Link href='/' className='text-gray-400 hover:text-white transition-colors'>
                  {t('home')}
                </Link>
              </li>
              <li>
                <Link href='/features' className='text-gray-400 hover:text-white transition-colors'>
                  {t('features')}
                </Link>
              </li>
              <li>
                <Link href='/pricing' className='text-gray-400 hover:text-white transition-colors'>
                  {t('pricing')}
                </Link>
              </li>
              <li>
                <Link href='/security' className='text-gray-400 hover:text-white transition-colors'>
                  {t('security')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Account section */}
          <div className='md:col-span-3 lg:col-span-4'>
            <h3 className='text-lg font-semibold mb-4'>
              {language === 'fr' ? 'Compte' : 'Account'}
            </h3>
            <ul className='space-y-3'>
              <li>
                <Link href='/story' className='text-gray-400 hover:text-white transition-colors'>
                  {language === 'fr' ? 'Notre Histoire' : 'Our Story'}
                </Link>
              </li>
              <li>
                <Link href='/privacy-policy' className='text-gray-400 hover:text-white transition-colors'>
                  {t('privacyPolicy')}
                </Link>
              </li>
              <li>
                <Link href='/terms-of-service' className='text-gray-400 hover:text-white transition-colors'>
                  {t('termsOfService')}
                </Link>
              </li>
              <li>
                {isAuthenticated ? (
                  <button 
                    onClick={() => setLocation('/dashboard/quick-actions')}
                    className='text-gray-400 hover:text-white transition-colors'
                  >
                    {t('dashboard')}
                  </button>
                ) : (
                  <Link href='/login' className='text-gray-400 hover:text-white transition-colors'>
                    {language === 'fr' ? 'Connexion' : 'Login'}
                  </Link>
                )}
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className='mt-12 pt-8 border-t border-gray-800 text-center'>
          <p className='text-gray-400'>
            &copy; 2024 Koveo Gestion Inc. {t('allRightsReserved')}
          </p>
        </div>
      </div>
    </footer>
  );
}