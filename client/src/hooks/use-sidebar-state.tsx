import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

interface SidebarStateValue {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (value: boolean) => void;
}

const SidebarStateContext = createContext<SidebarStateValue | null>(null);

/**
 * Provides shared collapsed/expanded state for the desktop sidebar so that
 * the main content area (and any other layout consumers) can react to it.
 *
 * Persistence in `localStorage` uses the same key the sidebar previously used
 * directly, so existing user preferences carry over without any migration.
 */
export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsedState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });

  const setCollapsed = useCallback((value: boolean) => {
    setIsCollapsedState(value);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(value));
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsedState((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
        } catch {
          // ignore storage errors
        }
      }
      return next;
    });
  }, []);

  return (
    <SidebarStateContext.Provider value={{ isCollapsed, toggleCollapsed, setCollapsed }}>
      {children}
    </SidebarStateContext.Provider>
  );
}

/**
 * Reads the shared sidebar collapsed state. When called outside of a provider
 * (e.g. in isolated tests), returns a safe non-collapsed default with no-op
 * setters so consumers never crash.
 */
export function useSidebarState(): SidebarStateValue {
  const ctx = useContext(SidebarStateContext);
  if (!ctx) {
    return {
      isCollapsed: false,
      toggleCollapsed: () => {},
      setCollapsed: () => {},
    };
  }
  return ctx;
}
