import { createContext, useContext, useState, ReactNode } from 'react';

/**
 * Mobile menu context type definition.
 */
interface MobileMenuContextType {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
}

const MobileMenuContext = createContext<MobileMenuContextType | undefined>(undefined);

/**
 * Hook to use mobile menu context.
 */
/**
 * UseMobileMenu component.
 * @returns JSX element.
 */
/**
 * UseMobileMenu custom hook.
 * @returns Hook return value.
 */
/**
 * Use mobile menu function.
 */
/**
 * UseMobileMenu component.
 * @returns JSX element.
 */
/**
 * UseMobileMenu custom hook.
 * @returns Hook return value.
 */
/**
 * Use mobile menu function.
 */
export const useMobileMenu = () => {
  const context = useContext(MobileMenuContext); /**
   * If function.
   * @param context === undefined - context === undefined parameter.
   */ /**
   * If function.
   * @param context === undefined - context === undefined parameter.
   */

  if (context === undefined) {
    throw new Error('useMobileMenu must be used within a MobileMenuProvider');
  }
  return context;
};

/**
 * Mobile menu provider props.
 */
interface MobileMenuProviderProps {
  children: ReactNode;
}

/**
 * Mobile menu provider component.
 * @param root0
 * @param root0.children
 */
/**
 * MobileMenuProvider function.
 * @param root0
 * @param root0.children
 * @returns Function result.
 */
/**
 * MobileMenuProvider component.
 * @param props - Component props.
 * @param props.children - React children elements.
 * @returns JSX element.
 */
/**
 * Mobile menu provider function.
 * @param { children } - { children } parameter.
 */
export function /**
 * Mobile menu provider function.
 * @param { children } - { children } parameter.
 */ /**
 * Mobile menu provider function.
 * @param { children } - { children } parameter.
 */

MobileMenuProvider({ children }: MobileMenuProviderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(() => {
    // Restore mobile menu state from localStorage on initialization
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mobile-menu-open');
      return saved === 'true';
    }
    return false;
  });

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => {
      const newState = !prev;
      // Persist state to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('mobile-menu-open', String(newState));
      }
      return newState;
    });
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    // Persist closed state to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('mobile-menu-open', 'false');
    }
  };

  const value = {
    isMobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
  };

  return <MobileMenuContext.Provider value={value}>{children}</MobileMenuContext.Provider>;
}
