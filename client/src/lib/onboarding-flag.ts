/**
 * Client-side onboarding feature flag.
 *
 * Mirrors the server's `isOnboardingEnabled()` semantics:
 *   - dev / test (Vite DEV mode): ON by default. Set VITE_ONBOARDING_ENABLED=false to disable.
 *   - production (Vite PROD mode): OFF by default. Set VITE_ONBOARDING_ENABLED=true to enable.
 *
 * Centralised here so OnboardingProvider, sidebar, and settings page stay in sync.
 */
export function isOnboardingEnabledClient(): boolean {
  const raw = import.meta.env.VITE_ONBOARDING_ENABLED;
  if (import.meta.env.PROD) {
    return raw === 'true';
  }
  return raw !== 'false';
}

export const ONBOARDING_ENABLED = isOnboardingEnabledClient();
