/**
 * @file Demands Schema Validation Tests.
 * @description Tests for demand and comment schema validation using Zod schemas.
 */

import { describe, it, expect } from '@jest/globals';
import { 
  insertDemandSchema, 
  insertDemandCommentSchema,
  demandTypeEnum,
  demandStatusEnum
} from '../../../shared/schemas/operations';

describe('Demands Schema Validation Tests', () => {
  describe('insertDemandSchema', () => {
    it('should validate a valid demand object', () => {
      const validDemand = {
        submitterId: 'user-123',
        type: 'maintenance',
        description: 'Faucet is leaking in the kitchen sink',
        residenceId: 'residence-456',
        buildingId: 'building-789',
        assignationResidenceId: 'residence-456',
        assignationBuildingId: 'building-789',
        status: 'pending'
      };

      expect(() => insertDemandSchema.parse(validDemand)).not.toThrow();
    });

    it('should require submitterId', () => {
      const invalidDemand = {
        type: 'maintenance',
        description: 'Test description',
        residenceId: 'residence-456',
        buildingId: 'building-789'
      };

      expect(() => insertDemandSchema.parse(invalidDemand)).toThrow();
    });

    it('should validate demand type enum', () => {
      const validTypes = ['maintenance', 'complaint', 'information', 'other'];
      
      validTypes.forEach(type => {
        const demand = {
          submitterId: 'user-123',
          type,
          description: 'Test description',
          residenceId: 'residence-456',
          buildingId: 'building-789'
        };
        
        expect(() => insertDemandSchema.parse(demand)).not.toThrow();
      });
    });

    it('should reject invalid demand type', () => {
      const invalidDemand = {
        submitterId: 'user-123',
        type: 'invalid_type',
        description: 'Test description',
        residenceId: 'residence-456',
        buildingId: 'building-789'
      };

      expect(() => insertDemandSchema.parse(invalidDemand)).toThrow();
    });

    it('should require description', () => {
      const invalidDemand = {
        submitterId: 'user-123',
        type: 'maintenance',
        residenceId: 'residence-456',
        buildingId: 'building-789'
      };

      expect(() => insertDemandSchema.parse(invalidDemand)).toThrow();
    });

    it('should validate description length', () => {
      const shortDescription = 'a';
      const longDescription = 'a'.repeat(2001);
      
      const demandWithShortDesc = {
        submitterId: 'user-123',
        type: 'maintenance',
        description: shortDescription,
        residenceId: 'residence-456',
        buildingId: 'building-789'
      };

      const demandWithLongDesc = {
        submitterId: 'user-123',
        type: 'maintenance',
        description: longDescription,
        residenceId: 'residence-456',
        buildingId: 'building-789'
      };

      expect(() => insertDemandSchema.parse(demandWithShortDesc)).toThrow();
      expect(() => insertDemandSchema.parse(demandWithLongDesc)).toThrow();
    });

    it('should accept optional fields', () => {
      const demandWithOptionals = {
        submitterId: 'user-123',
        type: 'maintenance',
        description: 'Test description with optional fields',
        residenceId: 'residence-456',
        buildingId: 'building-789',
        assignationResidenceId: 'residence-789',
        assignationBuildingId: 'building-456',
        reviewNotes: 'Initial review notes'
      };

      expect(() => insertDemandSchema.parse(demandWithOptionals)).not.toThrow();
    });
  });

  describe('insertDemandCommentSchema', () => {
    it('should validate a valid comment object', () => {
      const validComment = {
        demandId: 'demand-123',
        authorId: 'user-456',
        content: 'This is a valid comment about the demand',
        isInternal: false
      };

      expect(() => insertDemandCommentSchema.parse(validComment)).not.toThrow();
    });

    it('should require demandId', () => {
      const invalidComment = {
        authorId: 'user-456',
        content: 'Missing demand ID',
        isInternal: false
      };

      expect(() => insertDemandCommentSchema.parse(invalidComment)).toThrow();
    });

    it('should require authorId', () => {
      const invalidComment = {
        demandId: 'demand-123',
        content: 'Missing author ID',
        isInternal: false
      };

      expect(() => insertDemandCommentSchema.parse(invalidComment)).toThrow();
    });

    it('should require content', () => {
      const invalidComment = {
        demandId: 'demand-123',
        authorId: 'user-456',
        isInternal: false
      };

      expect(() => insertDemandCommentSchema.parse(invalidComment)).toThrow();
    });

    it('should validate content length', () => {
      const shortContent = '';
      const longContent = 'a'.repeat(2001);
      
      const commentWithShortContent = {
        demandId: 'demand-123',
        authorId: 'user-456',
        content: shortContent,
        isInternal: false
      };

      const commentWithLongContent = {
        demandId: 'demand-123',
        authorId: 'user-456',
        content: longContent,
        isInternal: false
      };

      expect(() => insertDemandCommentSchema.parse(commentWithShortContent)).toThrow();
      expect(() => insertDemandCommentSchema.parse(commentWithLongContent)).toThrow();
    });

    it('should default isInternal to false', () => {
      const comment = {
        demandId: 'demand-123',
        authorId: 'user-456',
        content: 'Comment without isInternal specified'
      };

      const result = insertDemandCommentSchema.parse(comment);
      expect(result.isInternal).toBe(false);
    });

    it('should accept both internal and external comments', () => {
      const internalComment = {
        demandId: 'demand-123',
        authorId: 'user-456',
        content: 'Internal team comment',
        isInternal: true
      };

      const externalComment = {
        demandId: 'demand-123',
        authorId: 'user-456',
        content: 'External resident comment',
        isInternal: false
      };

      expect(() => insertDemandCommentSchema.parse(internalComment)).not.toThrow();
      expect(() => insertDemandCommentSchema.parse(externalComment)).not.toThrow();
    });
  });

  describe('Enum Validation', () => {
    it('should validate demand types', () => {
      const validTypes = ['maintenance', 'complaint', 'information', 'other'];
      const invalidTypes = ['invalid', 'repair', 'request', ''];

      validTypes.forEach(type => {
        expect(demandTypeEnum.enumValues).toContain(type);
      });

      invalidTypes.forEach(type => {
        expect(demandTypeEnum.enumValues).not.toContain(type);
      });
    });

    it('should validate demand statuses', () => {
      const validStatuses = [
        'draft', 'submitted', 'under_review', 'approved', 
        'in_progress', 'completed', 'rejected', 'cancelled'
      ];
      const invalidStatuses = ['pending', 'open', 'closed', 'resolved'];

      validStatuses.forEach(status => {
        expect(demandStatusEnum.enumValues).toContain(status);
      });

      invalidStatuses.forEach(status => {
        expect(demandStatusEnum.enumValues).not.toContain(status);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle UUID validation for IDs', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUUIDs = ['invalid', '123', '', null, undefined];

      const validDemand = {
        submitterId: validUUID,
        type: 'maintenance',
        description: 'Test with valid UUID',
        residenceId: validUUID,
        buildingId: validUUID
      };

      expect(() => insertDemandSchema.parse(validDemand)).not.toThrow();

      invalidUUIDs.forEach(invalidId => {
        const invalidDemand = {
          submitterId: invalidId,
          type: 'maintenance',
          description: 'Test with invalid UUID',
          residenceId: validUUID,
          buildingId: validUUID
        };

        expect(() => insertDemandSchema.parse(invalidDemand)).toThrow();
      });
    });

    it('should handle special characters in descriptions', () => {
      const descriptionsWithSpecialChars = [
        'Description with émojis 🏠 and açcénts',
        'Description with "quotes" and apostrophe\'s',
        'Description with <tags> and &symbols;',
        'Multi-line\ndescription\nwith breaks',
        'Description with numbers 123 and symbols !@#$%^&*()'
      ];

      descriptionsWithSpecialChars.forEach(description => {
        const demand = {
          submitterId: 'user-123',
          type: 'maintenance',
          description,
          residenceId: 'residence-456',
          buildingId: 'building-789'
        };

        expect(() => insertDemandSchema.parse(demand)).not.toThrow();
      });
    });

    it('should handle boundary values for string lengths', () => {
      const minValidDescription = 'a'.repeat(10); // Minimum valid length
      const maxValidDescription = 'a'.repeat(2000); // Maximum valid length
      const belowMin = 'a'.repeat(9);
      const aboveMax = 'a'.repeat(2001);

      const demandMinValid = {
        submitterId: 'user-123',
        type: 'maintenance',
        description: minValidDescription,
        residenceId: 'residence-456',
        buildingId: 'building-789'
      };

      const demandMaxValid = {
        submitterId: 'user-123',
        type: 'maintenance',
        description: maxValidDescription,
        residenceId: 'residence-456',
        buildingId: 'building-789'
      };

      expect(() => insertDemandSchema.parse(demandMinValid)).not.toThrow();
      expect(() => insertDemandSchema.parse(demandMaxValid)).not.toThrow();

      const demandBelowMin = { ...demandMinValid, description: belowMin };
      const demandAboveMax = { ...demandMaxValid, description: aboveMax };

      expect(() => insertDemandSchema.parse(demandBelowMin)).toThrow();
      expect(() => insertDemandSchema.parse(demandAboveMax)).toThrow();
    });
  });
});