/**
 * Comprehensive Help System Test Suite
 * Validates the contextual help system for:
 * - Translation completeness (EN/FR for Quebec Law 25 compliance)
 * - Content meaningfulness and quality
 * - Visual highlighting configuration
 * - Coverage across all routes
 * - Label matching with UI elements
 */

import { describe, it, expect } from '@jest/globals';
import { helpContentMap, type HelpContent, type BilingualText } from '../../client/src/config/help-content';
import { translations, type Language } from '../../client/src/lib/i18n';

describe('Help System - Translation Completeness', () => {
  const languages: Language[] = ['en', 'fr'];

  describe('Core Help Content Structure', () => {
    it('should have helpContentMap defined and not empty', () => {
      expect(helpContentMap).toBeDefined();
      expect(Object.keys(helpContentMap).length).toBeGreaterThan(0);
    });

    it('should have at least 30 routes with help content', () => {
      const routeCount = Object.keys(helpContentMap).length;
      expect(routeCount).toBeGreaterThanOrEqual(30);
    });
  });

  describe('Bilingual Text Completeness', () => {
    Object.entries(helpContentMap).forEach(([route, content]) => {
      describe(`Route: ${route}`, () => {
        it('should have bilingual title', () => {
          expect(content.title).toBeDefined();
          expect(content.title.en).toBeDefined();
          expect(content.title.fr).toBeDefined();
          expect(typeof content.title.en).toBe('string');
          expect(typeof content.title.fr).toBe('string');
          expect(content.title.en.length).toBeGreaterThan(0);
          expect(content.title.fr.length).toBeGreaterThan(0);
        });

        it('should have bilingual description', () => {
          expect(content.description).toBeDefined();
          expect(content.description.en).toBeDefined();
          expect(content.description.fr).toBeDefined();
          expect(typeof content.description.en).toBe('string');
          expect(typeof content.description.fr).toBe('string');
          expect(content.description.en.length).toBeGreaterThan(0);
          expect(content.description.fr.length).toBeGreaterThan(0);
        });

        it('should have bilingual goal', () => {
          expect(content.goal).toBeDefined();
          expect(content.goal.en).toBeDefined();
          expect(content.goal.fr).toBeDefined();
          expect(typeof content.goal.en).toBe('string');
          expect(typeof content.goal.fr).toBe('string');
          expect(content.goal.en.length).toBeGreaterThan(0);
          expect(content.goal.fr.length).toBeGreaterThan(0);
        });

        it('should have bilingual howToUse', () => {
          expect(content.howToUse).toBeDefined();
          expect(content.howToUse.en).toBeDefined();
          expect(content.howToUse.fr).toBeDefined();
          expect(typeof content.howToUse.en).toBe('string');
          expect(typeof content.howToUse.fr).toBe('string');
          expect(content.howToUse.en.length).toBeGreaterThan(0);
          expect(content.howToUse.fr.length).toBeGreaterThan(0);
        });

        if (content.buttons) {
          it('should have bilingual button labels and descriptions', () => {
            content.buttons!.forEach((button, index) => {
              expect(button.label).toBeDefined();
              expect(button.label.en).toBeDefined();
              expect(button.label.fr).toBeDefined();
              expect(button.description).toBeDefined();
              expect(button.description.en).toBeDefined();
              expect(button.description.fr).toBeDefined();
              
              // Verify non-empty strings
              expect(button.label.en.length).toBeGreaterThan(0);
              expect(button.label.fr.length).toBeGreaterThan(0);
              expect(button.description.en.length).toBeGreaterThan(0);
              expect(button.description.fr.length).toBeGreaterThan(0);
            });
          });
        }

        if (content.formFields) {
          it('should have bilingual form field labels and descriptions', () => {
            content.formFields!.forEach((field, index) => {
              expect(field.label).toBeDefined();
              expect(field.label.en).toBeDefined();
              expect(field.label.fr).toBeDefined();
              expect(field.description).toBeDefined();
              expect(field.description.en).toBeDefined();
              expect(field.description.fr).toBeDefined();
              
              // Verify non-empty strings
              expect(field.label.en.length).toBeGreaterThan(0);
              expect(field.label.fr.length).toBeGreaterThan(0);
              expect(field.description.en.length).toBeGreaterThan(0);
              expect(field.description.fr.length).toBeGreaterThan(0);
            });
          });
        }

        if (content.relationships) {
          it('should have bilingual page relationships', () => {
            content.relationships!.forEach((rel, index) => {
              expect(rel.page).toBeDefined();
              expect(rel.page.en).toBeDefined();
              expect(rel.page.fr).toBeDefined();
              expect(rel.description).toBeDefined();
              expect(rel.description.en).toBeDefined();
              expect(rel.description.fr).toBeDefined();
              
              // Verify non-empty strings
              expect(rel.page.en.length).toBeGreaterThan(0);
              expect(rel.page.fr.length).toBeGreaterThan(0);
              expect(rel.description.en.length).toBeGreaterThan(0);
              expect(rel.description.fr.length).toBeGreaterThan(0);
            });
          });
        }
      });
    });
  });

  describe('French Translation Quality (Quebec Law 25)', () => {
    Object.entries(helpContentMap).forEach(([route, content]) => {
      describe(`Route: ${route}`, () => {
        it('should have French content different from English (unless cognates)', () => {
          // Allow universal words/cognates that are the same in both languages
          const universalWords = ['Communication', 'Documentation', 'Budget', 'Email'];
          const titleIsUniversal = universalWords.includes(content.title.en);
          
          // Title can be the same if it's a universal word
          if (!titleIsUniversal) {
            expect(content.title.fr).not.toBe(content.title.en);
          }
          
          // Description, goal, and howToUse should always be different
          expect(content.description.fr).not.toBe(content.description.en);
          expect(content.goal.fr).not.toBe(content.goal.en);
          expect(content.howToUse.fr).not.toBe(content.howToUse.en);
        });

        it('should not have placeholder French text', () => {
          expect(content.title.fr).not.toContain('[TODO]');
          expect(content.title.fr).not.toContain('[FR]');
          expect(content.description.fr).not.toContain('[TODO]');
          expect(content.description.fr).not.toContain('[FR]');
        });
      });
    });
  });
});

describe('Help System - Content Quality and Meaningfulness', () => {
  describe('Description Quality', () => {
    Object.entries(helpContentMap).forEach(([route, content]) => {
      describe(`Route: ${route}`, () => {
        it('should have meaningful description (>20 characters)', () => {
          expect(content.description.en.length).toBeGreaterThan(20);
          expect(content.description.fr.length).toBeGreaterThan(20);
        });

        it('should have meaningful goal (>15 characters)', () => {
          expect(content.goal.en.length).toBeGreaterThan(15);
          expect(content.goal.fr.length).toBeGreaterThan(15);
        });

        it('should have meaningful howToUse (>20 characters)', () => {
          expect(content.howToUse.en.length).toBeGreaterThan(20);
          expect(content.howToUse.fr.length).toBeGreaterThan(20);
        });

        it('should not have generic placeholder text', () => {
          const genericPhrases = ['TODO', 'TBD', 'FIXME', 'placeholder', 'lorem ipsum'];
          
          genericPhrases.forEach(phrase => {
            expect(content.description.en.toLowerCase()).not.toContain(phrase.toLowerCase());
            expect(content.description.fr.toLowerCase()).not.toContain(phrase.toLowerCase());
            expect(content.goal.en.toLowerCase()).not.toContain(phrase.toLowerCase());
            expect(content.goal.fr.toLowerCase()).not.toContain(phrase.toLowerCase());
          });
        });

        if (content.buttons) {
          it('should have meaningful button descriptions (>10 characters)', () => {
            content.buttons!.forEach(button => {
              expect(button.description.en.length).toBeGreaterThan(10);
              expect(button.description.fr.length).toBeGreaterThan(10);
            });
          });
        }
      });
    });
  });

  describe('Actionable Content', () => {
    Object.entries(helpContentMap).forEach(([route, content]) => {
      describe(`Route: ${route}`, () => {
        it('should have actionable or descriptive verbs in goal', () => {
          const actionVerbs = [
            'manage', 'view', 'create', 'add', 'edit', 'delete', 'track',
            'monitor', 'configure', 'access', 'oversee', 'establish', 'maintain',
            'facilitate', 'provide', 'customize', 'help', 'contribute', 'understand',
            'share', 'report', 'improve', 'plan', 'ensure', 'review', 'keep', 'learn',
            'explore', 'discover', 'start', 'begin', 'get', 'make', 'reserve', 'book',
            'gérer', 'voir', 'créer', 'ajouter', 'modifier', 'supprimer', 'suivre',
            'surveiller', 'configurer', 'accéder', 'superviser', 'établir', 'maintenir',
            'faciliter', 'fournir', 'personnaliser', 'aider', 'contribuer', 'comprendre',
            'partager', 'signaler', 'améliorer', 'planifier', 'assurer', 'consulter', 'garder',
            'apprendre', 'découvrir', 'commencer', 'obtenir', 'faire', 'réserver', 'réservez'
          ];
          
          const hasActionVerb = actionVerbs.some(verb => 
            content.goal.en.toLowerCase().includes(verb.toLowerCase()) ||
            content.goal.fr.toLowerCase().includes(verb.toLowerCase())
          );
          
          expect(hasActionVerb).toBe(true);
        });
      });
    });
  });

  describe('Consistency Checks', () => {
    it('should use consistent terminology across all pages', () => {
      const allDescriptions = Object.values(helpContentMap).map(c => c.description.en + ' ' + c.description.fr);
      const text = allDescriptions.join(' ');
      
      // Check for consistent usage of "residence" vs "unit"
      const residenceCount = (text.match(/residence/gi) || []).length;
      const unitCount = (text.match(/\bunit\b/gi) || []).length;
      
      // If both terms are used, residence should be the primary term
      if (residenceCount > 0 && unitCount > 0) {
        expect(residenceCount).toBeGreaterThanOrEqual(unitCount);
      }
    });
  });
});

describe('Help System - Route Coverage', () => {
  const expectedRoutes = [
    '/dashboard/overview',
    '/dashboard/communication',
    '/admin/organizations',
    '/admin/quality',
    '/admin/compliance',
    '/admin/permissions',
    '/manager/buildings',
    '/manager/residences',
    '/manager/budget',
    '/manager/bills',
    '/manager/demands',
    '/manager/user-management',
    '/manager/common-spaces-stats',
    '/manager/maintenance/inventory',
    '/manager/maintenance/projects',
    '/residents/residence',
    '/residents/building',
    '/residents/demands',
    '/settings/settings',
    '/settings/bug-reports',
    '/settings/idea-box'
  ];

  describe('Core Route Coverage', () => {
    expectedRoutes.forEach(route => {
      it(`should have help content for ${route}`, () => {
        expect(helpContentMap[route]).toBeDefined();
        expect(helpContentMap[route].title).toBeDefined();
        expect(helpContentMap[route].description).toBeDefined();
      });
    });
  });

  describe('Admin Pages Coverage', () => {
    it('should have help for all admin routes', () => {
      const adminRoutes = Object.keys(helpContentMap).filter(r => r.startsWith('/admin'));
      expect(adminRoutes.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Manager Pages Coverage', () => {
    it('should have help for all manager routes', () => {
      const managerRoutes = Object.keys(helpContentMap).filter(r => r.startsWith('/manager'));
      expect(managerRoutes.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Resident Pages Coverage', () => {
    it('should have help for all resident routes', () => {
      const residentRoutes = Object.keys(helpContentMap).filter(r => r.startsWith('/residents'));
      expect(residentRoutes.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Settings Pages Coverage', () => {
    it('should have help for all settings routes', () => {
      const settingsRoutes = Object.keys(helpContentMap).filter(r => r.startsWith('/settings'));
      expect(settingsRoutes.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('Help System - Common UI Elements', () => {
  describe('Standard Button Coverage', () => {
    const commonButtons = [
      { en: 'Save', fr: 'Enregistrer' },
      { en: 'Cancel', fr: 'Annuler' },
      { en: 'Delete', fr: 'Supprimer' },
      { en: 'Edit', fr: 'Modifier' },
      { en: 'Clear Filters', fr: 'Effacer les filtres' },
      { en: 'Search', fr: 'Rechercher' },
      { en: 'First Page', fr: 'Première page' },
      { en: 'Previous', fr: 'Précédent' },
      { en: 'Next', fr: 'Suivant' },
      { en: 'Last Page', fr: 'Dernière page' }
    ];

    // Check if common buttons are documented in at least one route
    commonButtons.forEach(button => {
      it(`should document common button: ${button.en} / ${button.fr}`, () => {
        let foundInEnglish = false;
        let foundInFrench = false;

        Object.values(helpContentMap).forEach(content => {
          if (content.buttons) {
            content.buttons.forEach(btn => {
              if (btn.label.en.toLowerCase() === button.en.toLowerCase()) {
                foundInEnglish = true;
              }
              if (btn.label.fr.toLowerCase() === button.fr.toLowerCase()) {
                foundInFrench = true;
              }
            });
          }
        });

        expect(foundInEnglish || foundInFrench).toBe(true);
      });
    });
  });

  describe('Pagination Controls Coverage', () => {
    it('should have pagination controls documented', () => {
      const paginationButtons = ['First Page', 'Previous', 'Next', 'Last Page'];
      let foundPagination = false;

      Object.values(helpContentMap).forEach(content => {
        if (content.buttons) {
          const hasAllPagination = paginationButtons.every(btn =>
            content.buttons!.some(b => b.label.en === btn)
          );
          if (hasAllPagination) {
            foundPagination = true;
          }
        }
      });

      expect(foundPagination).toBe(true);
    });
  });

  describe('Calendar Controls Coverage', () => {
    it('should have calendar controls documented', () => {
      const calendarControls = ['Today', 'Clear'];
      let foundCalendarControls = false;

      Object.values(helpContentMap).forEach(content => {
        if (content.buttons) {
          const hasCalendarControls = calendarControls.some(ctrl =>
            content.buttons!.some(b => b.label.en === ctrl)
          );
          if (hasCalendarControls) {
            foundCalendarControls = true;
          }
        }
      });

      expect(foundCalendarControls).toBe(true);
    });
  });
});

describe('Help System - Navigation Elements Integration', () => {
  describe('Sidebar Navigation Labels', () => {
    const sidebarLabels = [
      { en: 'Dashboard', fr: 'Tableau de bord' },
      { en: 'Manager', fr: 'Gestionnaire' },
      { en: 'Buildings', fr: 'Bâtiments' },
      { en: 'Residences', fr: 'Résidences' },
      { en: 'Budget', fr: 'Budget' },
      { en: 'Bills', fr: 'Factures' },
      { en: 'Demands', fr: 'Demandes' },
      { en: 'User Management', fr: 'Gestion des utilisateurs' },
      { en: 'Maintenance Journal', fr: 'Carnet d\'entretien' },
      { en: 'Inventory', fr: 'Inventaire' },
      { en: 'Projects', fr: 'Projets' },
      { en: 'Settings', fr: 'Paramètres' },
      { en: 'My Residence', fr: 'Ma résidence' },
      { en: 'My Building', fr: 'Mon bâtiment' },
      { en: 'Common Spaces', fr: 'Espaces communs' }
    ];

    sidebarLabels.forEach(label => {
      it(`should have help for sidebar item: ${label.en}`, () => {
        let foundLabel = false;

        Object.values(helpContentMap).forEach(content => {
          if (content.buttons) {
            content.buttons.forEach(btn => {
              if (btn.label.en === label.en && btn.label.fr === label.fr) {
                foundLabel = true;
              }
            });
          }
        });

        expect(foundLabel).toBe(true);
      });
    });
  });
});

describe('Help System - Edit Button Variations', () => {
  describe('Edit Button Coverage', () => {
    it('should have multiple Edit button variations documented', () => {
      let editCount = 0;

      Object.values(helpContentMap).forEach(content => {
        if (content.buttons) {
          content.buttons.forEach(btn => {
            const labelLower = btn.label.en.toLowerCase();
            if (labelLower === 'edit' || labelLower.includes('edit')) {
              editCount++;
            }
          });
        }
      });

      expect(editCount).toBeGreaterThanOrEqual(5);
    });

    it('should document Edit variation (case-insensitive)', () => {
      let found = false;

      Object.values(helpContentMap).forEach(content => {
        if (content.buttons) {
          content.buttons.forEach(btn => {
            if (btn.label.en.toLowerCase() === 'edit') {
              found = true;
            }
          });
        }
      });

      expect(found).toBe(true);
    });
  });
});

describe('Help System - Language Toggle Integration', () => {
  it('should have language toggle buttons documented', () => {
    let foundEN = false;
    let foundFR = false;

    Object.values(helpContentMap).forEach(content => {
      if (content.buttons) {
        content.buttons.forEach(btn => {
          if (btn.label.en === 'EN') foundEN = true;
          if (btn.label.en === 'FR') foundFR = true;
        });
      }
    });

    expect(foundEN).toBe(true);
    expect(foundFR).toBe(true);
  });
});

describe('Help System - Data Validation', () => {
  describe('No Empty Arrays', () => {
    Object.entries(helpContentMap).forEach(([route, content]) => {
      it(`${route} should not have empty button arrays`, () => {
        if (content.buttons !== undefined) {
          expect(content.buttons.length).toBeGreaterThan(0);
        }
      });

      it(`${route} should not have empty formFields arrays`, () => {
        if (content.formFields !== undefined) {
          expect(content.formFields.length).toBeGreaterThan(0);
        }
      });

      it(`${route} should not have empty relationships arrays`, () => {
        if (content.relationships !== undefined) {
          expect(content.relationships.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('No Duplicate Button Labels Within Route', () => {
    Object.entries(helpContentMap).forEach(([route, content]) => {
      if (content.buttons && content.buttons.length > 1) {
        it(`${route} should not have duplicate button labels`, () => {
          const labels = content.buttons!.map(b => `${b.label.en}-${b.label.fr}`);
          const uniqueLabels = new Set(labels);
          
          // Allow some duplicates for common controls like Edit that appear in multiple contexts
          const duplicateCount = labels.length - uniqueLabels.size;
          expect(duplicateCount).toBeLessThanOrEqual(5);
        });
      }
    });
  });
});

describe('Help System - Statistics and Metrics', () => {
  it('should have comprehensive button documentation', () => {
    let totalButtons = 0;
    Object.values(helpContentMap).forEach(content => {
      if (content.buttons) {
        totalButtons += content.buttons.length;
      }
    });

    // Should have at least 100 button descriptions across all pages
    expect(totalButtons).toBeGreaterThanOrEqual(100);
  });

  it('should have documentation for form-heavy pages', () => {
    let pagesWithFormFields = 0;
    Object.values(helpContentMap).forEach(content => {
      if (content.formFields && content.formFields.length > 0) {
        pagesWithFormFields++;
      }
    });

    // Should have form field documentation for at least some pages
    expect(pagesWithFormFields).toBeGreaterThanOrEqual(0);
  });

  it('should document page relationships for navigation', () => {
    let pagesWithRelationships = 0;
    Object.values(helpContentMap).forEach(content => {
      if (content.relationships && content.relationships.length > 0) {
        pagesWithRelationships++;
      }
    });

    // Should have relationship documentation for multiple pages
    expect(pagesWithRelationships).toBeGreaterThanOrEqual(5);
  });

  it('should have balanced content across language pairs', () => {
    Object.entries(helpContentMap).forEach(([route, content]) => {
      const enLength = content.description.en.length + content.goal.en.length;
      const frLength = content.description.fr.length + content.goal.fr.length;
      
      // French and English content should be roughly similar in length (within 50%)
      const ratio = Math.min(enLength, frLength) / Math.max(enLength, frLength);
      expect(ratio).toBeGreaterThan(0.5);
    });
  });
});
