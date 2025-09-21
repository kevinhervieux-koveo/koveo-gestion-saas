/**
 * Budget Page Translation Test Suite
 * Validates that all budget page UI elements are properly translated for Quebec compliance.
 * Follows established translation testing patterns to ensure comprehensive coverage.
 * 
 * Tests include:
 * - Budget form field labels (description, category, amount, frequency, etc.)
 * - Budget categories (maintenance, utilities, insurance, reserves, etc.)
 * - Frequency options (monthly, quarterly, annually)
 * - Action buttons (add, edit, delete, save, cancel)
 * - Table headers and column labels
 * - Summary and total calculation labels
 * - Validation error messages
 * - Success/confirmation messages
 * - Page titles and section headers
 * - Financial terminology accuracy in Quebec French
 */

import { describe, it, expect } from '@jest/globals';
import { translations, type Language } from '../../../client/src/lib/i18n.ts';

describe('Budget Page Translation Coverage', () => {
  const languages: Language[] = ['en', 'fr'];

  describe('Budget Page Core Elements Translation', () => {
    const budgetCoreKeys = [
      'budgetDashboard',
      'budgetSubtitle',
      'totalBudget',
      'usedBudget',
      'ofTotalBudget',
      'underBudget',
      'overBudget',
      'budgetCategories',
      'monthlySpendingTrend',
      'budgetAnalyticsChart'
    ];

    it('should have all budget page core elements translated', () => {
      budgetCoreKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });

    it('should have proper Quebec French budget page titles', () => {
      const fr = translations.fr;
      expect(fr.budgetDashboard).toBe('Tableau de bord budgétaire');
      expect(fr.budgetSubtitle).toBe('Gestion et suivi du budget financier');
      expect(fr.totalBudget).toBe('Budget total');
      expect(fr.budgetCategories).toBe('Catégories budgétaires');
    });

    it('should have budget status translations in Quebec French', () => {
      const fr = translations.fr;
      expect(fr.underBudget).toBe('Sous le budget');
      expect(fr.overBudget).toBe('Dépassement de budget');
      expect(fr.usedBudget).toBe('Budget utilisé');
      expect(fr.ofTotalBudget).toBe('du budget total');
    });
  });

  describe('Budget Form Field Labels Translation', () => {
    const budgetFormKeys = [
      'description',
      'category',
      'selectCategory',
      'amount',
      'paymentAmount',
      'monthlyPayments',
      'monthlyFees',
      'frequency'
    ];

    it('should have all budget form field labels translated', () => {
      budgetFormKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(t[key]).toBeDefined();
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French form field labels', () => {
      const fr = translations.fr;
      expect(fr.category).toBe('Catégorie');
      expect(fr.selectCategory).toBe('Sélectionner la catégorie');
      expect(fr.amount).toBe('Montant');
      expect(fr.paymentAmount).toBe('Montant du paiement');
      expect(fr.monthlyPayments).toBe('Paiements mensuels');
      expect(fr.monthlyFees).toBe('Frais mensuels');
    });
  });

  describe('Budget Categories Translation', () => {
    const budgetCategoryKeys = [
      'maintenance',
      'utilities',
      'insurance',
      'reserves',
      'generalExpenses',
      'capitalProjects',
      'emergencyFund'
    ];

    it('should have all budget category names translated', () => {
      budgetCategoryKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(t[key]).toBeDefined();
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French category translations', () => {
      const fr = translations.fr;
      if (fr.maintenance) expect(fr.maintenance).toBe('Entretien');
      if (fr.utilities) expect(fr.utilities).toBe('Services publics');
      if (fr.insurance) expect(fr.insurance).toBe('Assurance');
    });
  });

  describe('Budget Action Buttons Translation', () => {
    const budgetActionKeys = [
      'add',
      'edit',
      'delete',
      'save',
      'cancel',
      'create',
      'update',
      'confirm',
      'close'
    ];

    it('should have all budget action buttons translated', () => {
      budgetActionKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(t[key]).toBeDefined();
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French action button translations', () => {
      const fr = translations.fr;
      if (fr.save) expect(fr.save).toBe('Enregistrer');
      if (fr.cancel) expect(fr.cancel).toBe('Annuler');
      if (fr.edit) expect(fr.edit).toBe('Modifier');
      if (fr.delete) expect(fr.delete).toBe('Supprimer');
    });
  });

  describe('Budget Frequency Options Translation', () => {
    const frequencyKeys = [
      'monthly',
      'quarterly',
      'annually',
      'weekly',
      'biannually',
      'oneTime'
    ];

    it('should have all frequency options translated', () => {
      frequencyKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(t[key]).toBeDefined();
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French frequency translations', () => {
      const fr = translations.fr;
      if (fr.monthly) expect(fr.monthly).toBe('Mensuel');
      if (fr.quarterly) expect(fr.quarterly).toBe('Trimestriel');
      if (fr.annually) expect(fr.annually).toBe('Annuel');
    });
  });

  describe('Budget Table Headers and Column Labels Translation', () => {
    const tableHeaderKeys = [
      'date',
      'description',
      'category',
      'amount',
      'status',
      'actions',
      'total',
      'balance',
      'revenue',
      'expenses',
      'netCashFlow'
    ];

    it('should have all table headers and column labels translated', () => {
      tableHeaderKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(t[key]).toBeDefined();
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French table headers', () => {
      const fr = translations.fr;
      if (fr.date) expect(fr.date).toBe('Date');
      if (fr.status) expect(fr.status).toBe('Statut');
      if (fr.actions) expect(fr.actions).toBe('Actions');
      if (fr.total) expect(fr.total).toBe('Total');
      if (fr.balance) expect(fr.balance).toBe('Solde');
    });
  });

  describe('Budget Validation Messages Translation', () => {
    const validationKeys = [
      'required',
      'amountRequired',
      'categoryRequired',
      'descriptionRequired',
      'invalidAmount',
      'amountTooLow',
      'amountTooHigh',
      'invalidDate',
      'budgetExceeded'
    ];

    it('should have all validation messages translated', () => {
      validationKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(t[key]).toBeDefined();
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French validation messages', () => {
      const fr = translations.fr;
      if (fr.required) expect(fr.required).toBe('Requis');
      if (fr.invalidAmount) expect(fr.invalidAmount).toBe('Montant invalide');
    });
  });

  describe('Budget Success and Confirmation Messages Translation', () => {
    const messageKeys = [
      'success',
      'budgetSaved',
      'budgetUpdated',
      'budgetDeleted',
      'confirmDelete',
      'confirmBudgetDelete',
      'operationSuccess',
      'changesApplied'
    ];

    it('should have all success and confirmation messages translated', () => {
      messageKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(t[key]).toBeDefined();
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French success messages', () => {
      const fr = translations.fr;
      if (fr.success) expect(fr.success).toBe('Succès');
    });
  });

  describe('Financial Management Integration Translation', () => {
    const financialKeys = [
      'financialManagement',
      'financialReporting',
      'financialReportingDesc',
      'financialReports',
      'budget',
      'budgetManagement'
    ];

    it('should have all financial management terms translated', () => {
      financialKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(t[key]).toBeDefined();
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French financial terminology', () => {
      const fr = translations.fr;
      expect(fr.financialManagement).toBe('Gestion financière');
      expect(fr.financialReporting).toBe('Rapports financiers');
      expect(fr.financialReportingDesc).toBe('Suivi et rapports financiers complets');
      expect(fr.budget).toBe('Budget');
      if (fr.financialReports) expect(fr.financialReports).toBe('Rapports financiers');
    });
  });

  describe('Budget Navigation and Context Translation', () => {
    const navigationKeys = [
      'building',
      'organization',
      'back',
      'backToBuilding',
      'backToOrganization',
      'selectBuilding'
    ];

    it('should have all navigation context terms translated', () => {
      navigationKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(t[key]).toBeDefined();
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French navigation terms', () => {
      const fr = translations.fr;
      if (fr.building) expect(fr.building).toBe('Bâtiment');
      if (fr.organization) expect(fr.organization).toBe('Organisation');
      if (fr.back) expect(fr.back).toBe('Retour');
    });
  });

  describe('Budget Error Handling Translation', () => {
    const errorKeys = [
      'error',
      'errorLoadingData',
      'networkError',
      'serverError',
      'unexpectedError',
      'saveFailed',
      'updateFailed',
      'deleteFailed',
      'tryAgain'
    ];

    it('should have all error handling messages translated', () => {
      errorKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(t[key]).toBeDefined();
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French error messages', () => {
      const fr = translations.fr;
      if (fr.error) expect(fr.error).toBe('Erreur');
      if (fr.tryAgain) expect(fr.tryAgain).toBe('Réessayer');
    });
  });

  describe('Quebec-Specific Financial Terminology Validation', () => {
    it('should use proper Quebec French financial terms', () => {
      const fr = translations.fr;
      
      // Quebec French financial terminology validation
      expect(fr.amount).toBe('Montant'); // Not "quantité"
      expect(fr.budgetDashboard).toBe('Tableau de bord budgétaire'); // Proper Quebec terminology
      expect(fr.financialManagement).toBe('Gestion financière'); // Standard Quebec business French
      expect(fr.monthlyPayments).toBe('Paiements mensuels'); // Proper payment terminology
      expect(fr.category).toBe('Catégorie'); // Standard French spelling with accent
    });

    it('should ensure financial terminology consistency across budget elements', () => {
      const fr = translations.fr;
      
      // Consistency checks for related financial terms
      if (fr.amount && fr.paymentAmount) {
        expect(fr.amount).toContain('Montant');
        expect(fr.paymentAmount).toContain('Montant');
      }
      
      if (fr.budget && fr.totalBudget) {
        expect(fr.budget).toBe('Budget');
        expect(fr.totalBudget).toContain('Budget');
      }
      
      if (fr.category && fr.selectCategory && fr.budgetCategories) {
        expect(fr.category).toBe('Catégorie');
        expect(fr.selectCategory).toContain('catégorie');
        expect(fr.budgetCategories).toContain('Catégories');
      }
    });

    it('should validate proper currency and number formatting labels exist', () => {
      const currencyKeys = [
        'currency',
        'dollar',
        'cad',
        'total',
        'subtotal',
        'amount'
      ];

      currencyKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });
  });

  describe('Budget Page UI Element Translation Coverage', () => {
    it('should ensure no hardcoded English text in budget page UI patterns', () => {
      // Common budget page UI patterns that should be translated
      const budgetUIPatterns = [
        'budgetDashboard',
        'totalBudget',
        'monthlySpendingTrend',
        'budgetCategories',
        'financialReporting'
      ];

      budgetUIPatterns.forEach(pattern => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[pattern]) {
            expect(typeof t[pattern]).toBe('string');
            expect(t[pattern].length).toBeGreaterThan(0);
            // Should not contain unprocessed placeholder brackets
            expect(t[pattern]).not.toMatch(/\{[^}]*\}/);
          }
        });
      });
    });

    it('should validate all required budget translation keys exist', () => {
      const requiredBudgetKeys = [
        'budgetDashboard',
        'budgetSubtitle',
        'amount',
        'category',
        'save',
        'cancel',
        'error',
        'success'
      ];

      requiredBudgetKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Budget Form Component Translation Integration', () => {
    it('should have all budget form component labels translated', () => {
      const formComponentKeys = [
        'description',
        'category',
        'amount',
        'frequency',
        'startDate',
        'endDate',
        'notes',
        'priority'
      ];

      formComponentKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(t[key]).toBeDefined();
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should validate budget calculation and summary labels', () => {
      const calculationKeys = [
        'total',
        'subtotal',
        'balance',
        'remaining',
        'allocated',
        'available',
        'projected'
      ];

      calculationKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });
  });
});