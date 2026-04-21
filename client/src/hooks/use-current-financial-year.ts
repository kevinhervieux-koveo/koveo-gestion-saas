import { useState, useEffect, useMemo } from 'react';
import { getFinancialYearRange, type FinancialYearRange } from '@/utils/financial-year';

/**
 * Hook options for useCurrentFinancialYear
 */
export interface UseCurrentFinancialYearOptions {
  /**
   * The building's fiscal year start date in format "YYYY-MM-DD"
   * If null, defaults to calendar year (January 1st)
   */
  financialYearStart: string | null;
  
  /**
   * Whether the hook should be active and refresh
   * @default true
   */
  enabled?: boolean;
}

/**
 * Return type for useCurrentFinancialYear hook
 */
export interface UseCurrentFinancialYearReturn {
  /**
   * The current financial year object containing label, start year, start and end dates
   */
  currentFinancialYear: FinancialYearRange;
  
  /**
   * Loading state - true during initial calculation
   */
  isLoading: boolean;
}

/**
 * Custom React hook that automatically calculates and refreshes the current financial year
 * based on a building's fiscal year start date.
 * 
 * Features:
 * - Automatically recalculates when financialYearStart changes
 * - Sets up a daily interval to check if the financial year has changed
 * - Cleans up interval on unmount
 * - Uses useMemo to avoid unnecessary recalculations
 * 
 * @param financialYearStart - The building's fiscal year start date (format: "YYYY-MM-DD")
 * @param enabled - Whether the hook should be active (default: true)
 * @returns Object containing currentFinancialYear and isLoading state
 * 
 * @example
 * ```typescript
 * const { currentFinancialYear, isLoading } = useCurrentFinancialYear(
 *   buildingData?.financialYearStart
 * );
 * 
 * // Use in component
 * if (isLoading) return <div>Loading...</div>;
 * 
 * console.log(currentFinancialYear.label); // "2023-2024" or "2024"
 * console.log(currentFinancialYear.start); // Date object for start
 * console.log(currentFinancialYear.end);   // Date object for end
 * ```
 * 
 * @example
 * ```typescript
 * // With enabled flag
 * const { currentFinancialYear, isLoading } = useCurrentFinancialYear(
 *   buildingData?.financialYearStart,
 *   !!buildingData
 * );
 * ```
 */
export function useCurrentFinancialYear(
  financialYearStart: string | null,
  enabled: boolean = true
): UseCurrentFinancialYearReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  /**
   * Memoized calculation of the current financial year
   * Recalculates when financialYearStart or currentDate changes
   */
  const currentFinancialYear = useMemo(() => {
    return getFinancialYearRange(financialYearStart, currentDate);
  }, [financialYearStart, currentDate]);

  /**
   * Set up daily interval to check if financial year has changed
   * The interval checks at midnight or every 24 hours
   */
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Mark as loaded after initial calculation
    setIsLoading(false);

    let timeoutId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    /**
     * Calculate milliseconds until next midnight
     * This allows us to sync the first check to midnight
     */
    const calculateMsUntilMidnight = (): number => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime() - now.getTime();
    };

    /**
     * Check if we've crossed into a new financial year
     * Updates the current date state if a change is detected
     */
    const checkFinancialYearChange = () => {
      const newDate = new Date();
      const newFinancialYear = getFinancialYearRange(financialYearStart, newDate);
      
      // Only update if the financial year has actually changed
      if (newFinancialYear.startYear !== currentFinancialYear.startYear) {
        setCurrentDate(newDate);
      }
    };

    // Set up initial timeout to sync to midnight
    const msUntilMidnight = calculateMsUntilMidnight();
    timeoutId = setTimeout(() => {
      checkFinancialYearChange();
      
      // After first midnight check, set up daily interval (24 hours)
      intervalId = setInterval(() => {
        checkFinancialYearChange();
      }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
    }, msUntilMidnight);

    // Cleanup function that clears both timeout and interval
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [enabled, financialYearStart, currentFinancialYear.startYear]);

  /**
   * Reset current date when financialYearStart changes
   * This ensures immediate recalculation with the new fiscal year settings
   */
  useEffect(() => {
    if (enabled) {
      setCurrentDate(new Date());
    }
  }, [financialYearStart, enabled]);

  return {
    currentFinancialYear,
    isLoading,
  };
}
