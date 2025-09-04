import { useLocation } from 'wouter';
import { useEffect } from 'react';

/**
 * Custom hook that provides smooth scroll-to-top behavior on page navigation.
 * Automatically scrolls to the top of the page whenever the route changes.
 */
export function useSmoothNavigation() {
  const [location] = useLocation();

  useEffect(() => {
    // Smooth scroll to top when location changes
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }, [location]);
}

/**
 * Enhanced setLocation function that provides smooth scroll-to-top behavior
 * when navigating to a new page.
 */
export function useSmoothLocationSetter() {
  const [, setLocationOriginal] = useLocation();
  
  const setLocation = (path: string) => {
    // First scroll to top smoothly
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
    
    // Small delay to let the scroll animation start, then navigate
    setTimeout(() => {
      setLocationOriginal(path);
    }, 50);
  };

  return setLocation;
}