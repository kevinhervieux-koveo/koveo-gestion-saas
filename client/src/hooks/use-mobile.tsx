import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * React hook to detect mobile screen size with responsive breakpoint.
 * Uses window.matchMedia for efficient responsive detection and updates.
 *
 * @returns {boolean} True if screen width is below 768px mobile breakpoint.
 * @example
 * ```typescript
 * function MyComponent() {
 *   const isMobile = useIsMobile();
 *
 *   return (
 *     <div className={isMobile ? 'mobile-layout' : 'desktop-layout'}>
 *       {isMobile ? <MobileMenu /> : <DesktopMenu />}
 *     </div>
 *   );
 * }
 * ```
 */
/**
 * UseIsMobile function.
 * @returns Function result.
 */
/**
 * UseIsMobile custom hook.
 * @returns Hook return value.
 */
/**
 * Use is mobile function.
 */
export function /**
 * Use is mobile function.
 */ /**
 * Use is mobile function.
 */

useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}
