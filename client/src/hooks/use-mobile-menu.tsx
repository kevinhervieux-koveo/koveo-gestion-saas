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
export const useMobileMenu = () => {
  const context = useContext(MobileMenuContext);
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
export function MobileMenuProvider({ children }: MobileMenuProviderProps) {
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