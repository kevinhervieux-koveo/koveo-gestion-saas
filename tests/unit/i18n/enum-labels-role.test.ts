/**
 * Unit tests for enumLabels.role() – covers every canonical role × locale.
 * Guards against regressions where raw enum values are shown instead of
 * human-readable localized labels (QA Pass #27 finding W73).
 */

import { describe, it, expect } from '@jest/globals';
import { enumLabels } from '../../../client/src/lib/i18n/enumLabels.ts';

describe('enumLabels.role()', () => {
  describe('English labels (lang = "en")', () => {
    it('renders "Tenant" for tenant', () => {
      expect(enumLabels.role('tenant', 'en')).toBe('Tenant');
    });

    it('renders "Resident" for resident', () => {
      expect(enumLabels.role('resident', 'en')).toBe('Resident');
    });

    it('renders "Manager" for manager', () => {
      expect(enumLabels.role('manager', 'en')).toBe('Manager');
    });

    it('renders "Admin" for admin', () => {
      expect(enumLabels.role('admin', 'en')).toBe('Admin');
    });

    it('renders "Super Admin" for super_admin', () => {
      expect(enumLabels.role('super_admin', 'en')).toBe('Super Admin');
    });

    it('renders "Demo Tenant" for demo_tenant', () => {
      expect(enumLabels.role('demo_tenant', 'en')).toBe('Demo Tenant');
    });

    it('renders "Demo Resident" for demo_resident', () => {
      expect(enumLabels.role('demo_resident', 'en')).toBe('Demo Resident');
    });

    it('renders "Demo Manager" for demo_manager', () => {
      expect(enumLabels.role('demo_manager', 'en')).toBe('Demo Manager');
    });

    it('falls back to the raw string for an unknown role', () => {
      expect(enumLabels.role('unknown_role', 'en')).toBe('unknown_role');
    });

    it('defaults to English when no lang argument is passed', () => {
      expect(enumLabels.role('tenant')).toBe('Tenant');
    });
  });

  describe('French labels (lang = "fr")', () => {
    it('renders "Locataire" for tenant', () => {
      expect(enumLabels.role('tenant', 'fr')).toBe('Locataire');
    });

    it('renders "Résident" for resident', () => {
      expect(enumLabels.role('resident', 'fr')).toBe('Résident');
    });

    it('renders "Gestionnaire" for manager', () => {
      expect(enumLabels.role('manager', 'fr')).toBe('Gestionnaire');
    });

    it('renders "Administrateur" for admin', () => {
      expect(enumLabels.role('admin', 'fr')).toBe('Administrateur');
    });

    it('renders "Super administrateur" for super_admin', () => {
      expect(enumLabels.role('super_admin', 'fr')).toBe('Super administrateur');
    });

    it('renders "Locataire démo" for demo_tenant', () => {
      expect(enumLabels.role('demo_tenant', 'fr')).toBe('Locataire démo');
    });

    it('renders "Résident démo" for demo_resident', () => {
      expect(enumLabels.role('demo_resident', 'fr')).toBe('Résident démo');
    });

    it('renders "Gestionnaire démo" for demo_manager', () => {
      expect(enumLabels.role('demo_manager', 'fr')).toBe('Gestionnaire démo');
    });

    it('falls back to the raw string for an unknown role', () => {
      expect(enumLabels.role('unknown_role', 'fr')).toBe('unknown_role');
    });
  });

  describe('No raw enum values leak through', () => {
    const canonicalRoles = ['tenant', 'resident', 'manager', 'admin', 'super_admin'] as const;
    const langs = ['en', 'fr'] as const;

    for (const role of canonicalRoles) {
      for (const lang of langs) {
        it(`${role} (${lang}) does not render as the raw value "${role}"`, () => {
          expect(enumLabels.role(role, lang)).not.toBe(role);
        });
      }
    }
  });
});
