import { useLanguage } from '@/hooks/use-language';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMobileMenu } from '@/hooks/use-mobile-menu';

/**
 * Props for the Header component.
 * Defines the title and subtitle text to display in the page header.
 */
interface HeaderProps {
  title: string;
  subtitle: string;
}

/**
 * Page header component with title, subtitle, and workspace status indicator.
 * Provides consistent branding and navigation across all application pages.
 * 
 * @param {HeaderProps} props - Component props.
 * @param {string} props.title - Main page title to display.
 * @param {string} props.subtitle - Descriptive subtitle text.
 * @returns {JSX.Element} Header with title, subtitle, and active workspace indicator.
 * @example
 * ```typescript
 * function DashboardPage() {
 *   return (
 *     <div>
 *       <Header 
 *         title="Dashboard" 
 *         subtitle="Overview of your property management system"
 *       />
 *       <main>Dashboard content...</main>
 *     </div>
 *   );
 * }
 * ```
 */
export function Header({ title, subtitle }: HeaderProps) {
  const { t } = useLanguage();
  
  // Access mobile menu context
  const mobileMenu = useMobileMenu();
  const toggleMobileMenu = mobileMenu?.toggleMobileMenu;
  
  const handleMobileMenuClick = () => {
    if (toggleMobileMenu) {
      toggleMobileMenu();
    }
  };

  return (
    <header className='bg-white border-b border-gray-200 px-6 py-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-4'>
          {/* Mobile menu button - always show on mobile for debugging */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={handleMobileMenuClick}
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <div>
            <h2 className='text-2xl font-semibold text-gray-900'>{title}</h2>
            <p className='text-gray-600'>{subtitle}</p>
          </div>
        </div>
        <div className='flex items-center space-x-4'>
          <div className='flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm'>
            <div className='w-2 h-2 bg-green-500 rounded-full'></div>
            <span>{t('workspaceActive')}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
