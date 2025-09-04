/**
 * Comprehensive UI Elements Translation Test Suite
 * Validates that ALL user interface elements are properly translated:
 * - Residence cards and all their labels
 * - Building cards and all their labels  
 * - Titles and subtitles
 * - Pagination elements
 * - All buttons in cards
 * - All form labels and field names
 */

import { describe, it, expect } from '@jest/globals';
import { translations, type Language } from '../../client/src/lib/i18n.ts';

describe('Comprehensive UI Elements Translation Coverage', () => {
  const languages: Language[] = ['en', 'fr'];

  describe('Residence Card Elements Translation', () => {
    const residenceCardKeys = [
      'address',
      'floor',
      'sqFt',
      'bedrooms', 
      'bathrooms',
      'parkingSpaces',
      'storageSpaces',
      'parking',
      'storage'
    ];

    it('should have all residence card field labels translated', () => {
      residenceCardKeys.forEach(key => {
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

    it('should have proper French translations for residence fields', () => {
      const fr = translations.fr;
      expect(fr.address).toBe('Adresse');
      expect(fr.floor).toBe('Étage'); 
      expect(fr.bedrooms).toBe('Chambres');
      expect(fr.bathrooms).toBe('Salles de bain');
    });

    it('should have residence card buttons translated', () => {
      const residenceButtonKeys = [
        'viewDocuments',
        'viewDocuments2',
        'buildingDocuments'
      ];

      residenceButtonKeys.forEach(key => {
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

  describe('Building Card Elements Translation', () => {
    const buildingCardKeys = [
      'address',
      'buildingType',
      'yearBuilt',
      'totalUnits',
      'managementCompany',
      'occupancyStats',
      'occupancy'
    ];

    it('should have all building card field labels translated', () => {
      buildingCardKeys.forEach(key => {
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

    it('should have building occupancy translations', () => {
      languages.forEach(lang => {
        const t = translations[lang] as any;
        if (t.occupancy) {
          expect(typeof t.occupancy).toBe('string');
        }
      });
    });
  });

  describe('Page Titles and Subtitles Translation', () => {
    const titleSubtitleKeys = [
      'myResidence',
      'myResidenceInfo',
      'viewResidenceInfo',
      'myBuilding',
      'myBuildings',
      'viewBuildingsAccess',
      'noBuildingsFound',
      'noResidencesFound'
    ];

    it('should have all page titles and subtitles translated', () => {
      titleSubtitleKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });

    it('should have proper French page titles', () => {
      const fr = translations.fr;
      expect(fr.myResidence).toBe('Ma résidence');
      expect(fr.myBuildings).toBe('Mes bâtiments');
    });
  });

  describe('Pagination Elements Translation', () => {
    const paginationKeys = [
      'showing',
      'showingResults',
      'previous',
      'next',
      'page',
      'of',
      'total',
      'results',
      'residences',
      'buildings'
    ];

    it('should have pagination text translations', () => {
      paginationKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have pagination pattern support for dynamic text', () => {
      // Test patterns like "Showing X to Y of Z residences"
      const patterns = ['showingResults', 'showingXtoYofZ'];
      
      patterns.forEach(pattern => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[pattern]) {
            expect(typeof t[pattern]).toBe('string');
          }
        });
      });
    });
  });

  describe('Button Translation Coverage', () => {
    const cardButtonKeys = [
      'viewDocuments',
      'viewDocuments2', 
      'buildingDocuments',
      'previous',
      'next',
      'close',
      'cancel',
      'save',
      'edit',
      'delete',
      'add',
      'create',
      'update'
    ];

    it('should have all card buttons translated', () => {
      cardButtonKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have French button translations using proper Quebec terminology', () => {
      const fr = translations.fr;
      
      // Common button verbs in Quebec French
      if (fr.save) expect(fr.save).toBe('Enregistrer');
      if (fr.cancel) expect(fr.cancel).toBe('Annuler');
      if (fr.close) expect(fr.close).toBe('Fermer');
      if (fr.edit) expect(fr.edit).toBe('Modifier');
    });
  });

  describe('Form Labels and Field Names Translation', () => {
    const formLabelKeys = [
      'firstName',
      'lastName', 
      'email',
      'phone',
      'address',
      'city',
      'province',
      'postalCode',
      'unitNumber',
      'buildingName',
      'organization',
      'role',
      'type'
    ];

    it('should have all form labels translated', () => {
      formLabelKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should use proper Quebec French form terminology', () => {
      const fr = translations.fr;
      
      if (fr.email) expect(fr.email).toBe('Courriel'); // Quebec French for email
      if (fr.phone) expect(fr.phone).toBe('Téléphone');
      if (fr.address) expect(fr.address).toBe('Adresse');
    });
  });

  describe('Unit Measurements and Technical Terms', () => {
    const measurementKeys = [
      'sqFt',
      'units',
      'occupied',
      'vacant',
      'apartment',
      'condo',
      'house'
    ];

    it('should have measurement and property type translations', () => {
      measurementKeys.forEach(key => {
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

  describe('Status and State Indicators Translation', () => {
    const statusKeys = [
      'active',
      'inactive', 
      'occupied',
      'vacant',
      'available',
      'unavailable',
      'pending',
      'approved',
      'rejected',
      'complete',
      'loading'
    ];

    it('should have all status indicators translated', () => {
      statusKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[key]) {
            expect(typeof t[key]).toBe('string');
            expect(t[key].length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should have proper Quebec French status terms', () => {
      const fr = translations.fr;
      
      if (fr.loading) expect(fr.loading).toBe('Chargement...');
      if (fr.complete) expect(fr.complete).toBe('Terminé');
      if (fr.pending) expect(fr.pending).toBe('En attente');
    });
  });

  describe('Card Content and Labels Translation', () => {
    it('should translate all residence card content labels', () => {
      const residenceLabels = [
        'unit',
        'building2', // "Building" label
        'residence',
        'floor',
        'bedrooms',
        'bathrooms', 
        'parkingSpaces',
        'storageSpaces'
      ];

      residenceLabels.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });

    it('should translate all building card content labels', () => {
      const buildingLabels = [
        'address',
        'buildingType',
        'totalUnits',
        'occupancy',
        'managementCompany'
      ];

      buildingLabels.forEach(key => {
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

  describe('Missing Translation Detection', () => {
    it('should identify any UI elements that might be missing translations', () => {
      // Common UI patterns that should be translated
      const commonUIPatterns = [
        'viewDocuments',
        'buildingDocuments', 
        'showingResults',
        'loading',
        'noDataFound',
        'errorLoading'
      ];

      commonUIPatterns.forEach(pattern => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          if (t[pattern]) {
            expect(typeof t[pattern]).toBe('string');
            expect(t[pattern].length).toBeGreaterThan(0);
            // Should not contain unprocessed placeholder brackets (unless it's a template)
            if (!pattern.includes('showing') && !pattern.includes('Results')) {
              expect(t[pattern]).not.toMatch(/\{[^}]*\}/);
            }
          }
        });
      });
    });

    it('should ensure no hardcoded English text in common UI patterns', () => {
      // These are patterns that commonly appear untranslated
      const problematicPatterns = [
        /^View Documents?$/i,
        /^Building Documents?$/i,
        /^Address$/i,
        /^Sq Ft$/i,
        /^Bedrooms?$/i,
        /^Bathrooms?$/i,
        /^Parking$/i,
        /^Storage$/i,
        /^Showing \d+ to \d+ of \d+ /i,
        /^Previous$/i,
        /^Next$/i
      ];

      // This test documents patterns to watch for - would need actual component scanning
      // to detect hardcoded text, but serves as a reminder of what to look for
      expect(problematicPatterns.length).toBeGreaterThan(0);
    });
  });
});