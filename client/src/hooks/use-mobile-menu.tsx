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
 * useMobileMenu component.
 * @returns JSX element.
 */
/**
 * useMobileMenu custom hook.
 * @returns Hook return value.
 */
/**
 * Use mobile menu function.
 */
export const useMobileMenu = () => {
  const context = useContext(MobileMenuContext);  /**
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
export function  /**
   * Mobile menu provider function.
   * @param { children } - { children } parameter.
   */
 MobileMenuProvider({ children }: MobileMenuProviderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const value = {
    isMobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
  };

  return (
    <MobileMenuContext.Provider value={value}>
      {children}
    </MobileMenuContext.Provider>
  );
}