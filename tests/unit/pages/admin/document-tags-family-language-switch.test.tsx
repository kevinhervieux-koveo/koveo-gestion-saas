/**
 * @jest-environment jsdom
 *
 * Task #1456 — Admin FamiliesTable language-switch smoke test
 *
 * Verifies that switching the UI language from EN to FR causes FamiliesTable
 * to render the localized name for:
 *   - one original (pre-task #1456) system family: "Sequence"
 *   - one new (task #1456) system family: "Assurances"
 */

import React from 'react';
import { describe, it, expect } from '@jest/globals';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { translations } from '../../../../client/src/lib/i18n';
import type { Translations } from '../../../../client/src/lib/i18n';

// ─── Mutable language state — mutated before each render, read by the hook ───

let currentLanguage: 'en' | 'fr' = 'en';

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: currentLanguage,
    t: (key: keyof Translations): string =>
      (translations[currentLanguage][key] as string) ?? (key as string),
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));

jest.mock('wouter', () => ({
  useLocation: () => ['/admin/document-tags', jest.fn()],
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: { invalidateQueries: jest.fn() },
}));

jest.mock('@/components/layout/header', () => ({
  Header: () => null,
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

// ─── Import the tested component ─────────────────────────────────────────────

import { FamiliesTable } from '../../../../client/src/pages/admin/document-tags';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FAMILIES = [
  {
    id: 'sys-seq',
    name: 'Sequence',
    description: 'raw sequence desc',
    isSystem: true,
    organizationId: null,
  },
  {
    id: 'sys-ass',
    name: 'Assurances',
    description: 'raw assurance desc',
    isSystem: true,
    organizationId: null,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FamiliesTable language switching (Task #1456)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders EN names for the original "Sequence" family and new "Assurances" family', () => {
    currentLanguage = 'en';
    render(<FamiliesTable families={FAMILIES} isLoading={false} readOnly />);

    expect(screen.getByText(translations.en.sfNameSequence)).toBeInTheDocument();
    expect(screen.getByText(translations.en.sfNameAssurances)).toBeInTheDocument();
  });

  it('renders FR names for the original "Sequence" family and new "Assurances" family', () => {
    currentLanguage = 'fr';
    render(<FamiliesTable families={FAMILIES} isLoading={false} readOnly />);

    expect(screen.getByText(translations.fr.sfNameSequence)).toBeInTheDocument();
    expect(screen.getByText(translations.fr.sfNameAssurances)).toBeInTheDocument();
  });

  it('EN and FR names differ, proving the helper is not returning raw DB fallback', () => {
    expect(translations.en.sfNameSequence).not.toBe(translations.fr.sfNameSequence);
    expect(translations.en.sfNameAssurances).not.toBe(translations.fr.sfNameAssurances);
  });
});
