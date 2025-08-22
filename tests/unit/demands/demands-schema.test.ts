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
        submitterId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'maintenance',
        description: 'Faucet is leaking in the kitchen sink',
        residenceId: '223e4567-e89b-12d3-a456-426614174001',
        buildingId: '323e4567-e89b-12d3-a456-426614174002',
        assignationResidenceId: '223e4567-e89b-12d3-a456-426614174001',
        assignationBuildingId: '323e4567-e89b-12d3-a456-426614174002',
        status: 'submitted'
      };

      expect(() => insertDemandSchema.parse(validDemand)).not.toThrow();
    });

    it('should require submitterId', () => {
      const invalidDemand = {
        type: 'maintenance',
        description: 'Test description',
        residenceId: '223e4567-e89b-12d3-a456-426614174001',
        buildingId: '323e4567-e89b-12d3-a456-426614174002'
      };

      expect(() => insertDemandSchema.parse(invalidDemand)).toThrow();
    });

    it('should validate demand type enum', () => {
      const validTypes = ['maintenance', 'complaint', 'information', 'other'];
      
      validTypes.forEach(type => {
        const demand = {
          submitterId: '123e4567-e89b-12d3-a456-426614174000',
          type,
          description: 'Test description',
          residenceId: '223e4567-e89b-12d3-a456-426614174001',
          buildingId: '323e4567-e89b-12d3-a456-426614174002'
        };
        
        expect(() => insertDemandSchema.parse(demand)).not.toThrow();
      });
    });

    it('should reject invalid demand type', () => {
      const invalidDemand = {
        submitterId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'invalid_type',
        description: 'Test description',
        residenceId: '223e4567-e89b-12d3-a456-426614174001',
        buildingId: '323e4567-e89b-12d3-a456-426614174002'
      };

      expect(() => insertDemandSchema.parse(invalidDemand)).toThrow();
    });

    it('should require description', () => {
      const invalidDemand = {
        submitterId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'maintenance',
        residenceId: '223e4567-e89b-12d3-a456-426614174001',
        buildingId: '323e4567-e89b-12d3-a456-426614174002'
      };

      expect(() => insertDemandSchema.parse(invalidDemand)).toThrow();
    });

    it('should validate description length', () => {
      const shortDescription = 'a';
      const longDescription = 'a'.repeat(2001);
      
      const demandWithShortDesc = {
        submitterId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'maintenance',
        description: shortDescription,
        residenceId: '223e4567-e89b-12d3-a456-426614174001',
        buildingId: '323e4567-e89b-12d3-a456-426614174002'
      };

      const demandWithLongDesc = {
        submitterId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'maintenance',
        description: longDescription,
        residenceId: '223e4567-e89b-12d3-a456-426614174001',
        buildingId: '323e4567-e89b-12d3-a456-426614174002'
      };

      expect(() => insertDemandSchema.parse(demandWithShortDesc)).toThrow();
      expect(() => insertDemandSchema.parse(demandWithLongDesc)).toThrow();
    });

    it('should accept optional fields', () => {
      const demandWithOptionals = {
        submitterId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'maintenance',
        description: 'Test description with optional fields',
        residenceId: '223e4567-e89b-12d3-a456-426614174001',
        buildingId: '323e4567-e89b-12d3-a456-426614174002',
        assignationResidenceId: '223e4567-e89b-12d3-a456-426614174001',
        assignationBuildingId: '323e4567-e89b-12d3-a456-426614174002',
        reviewNotes: 'Initial review notes'
      };

      expect(() => insertDemandSchema.parse(demandWithOptionals)).not.toThrow();
    });
  });

  describe('insertDemandCommentSchema', () => {
    it('should validate a valid comment object', () => {
      const validComment = {
        demandId: '423e4567-e89b-12d3-a456-426614174003',
        orderIndex: '1.0',
        comment: 'This is a valid comment about the demand',
        createdBy: '123e4567-e89b-12d3-a456-426614174000'
      };

      expect(() => insertDemandCommentSchema.parse(validComment)).not.toThrow();
    });

    it('should require demandId', () => {
      const invalidComment = {
        orderIndex: '1.0',
        comment: 'Missing demand ID',
        createdBy: '123e4567-e89b-12d3-a456-426614174000'
      };

      expect(() => insertDemandCommentSchema.parse(invalidComment)).toThrow();
    });

    it('should require authorId', () => {
      const invalidComment = {
        demandId: '423e4567-e89b-12d3-a456-426614174003',
        orderIndex: '1.0',
        comment: 'Missing author ID'
      };

      expect(() => insertDemandCommentSchema.parse(invalidComment)).toThrow();
    });

    it('should require content', () => {
      const invalidComment = {
        demandId: '423e4567-e89b-12d3-a456-426614174003',
        orderIndex: '1.0',
        createdBy: '123e4567-e89b-12d3-a456-426614174000'
      };

      expect(() => insertDemandCommentSchema.parse(invalidComment)).toThrow();
    });

    it('should validate content length', () => {
      const shortContent = '';
      const longContent = 'a'.repeat(2001);
      
      const commentWithShortContent = {
        demandId: '423e4567-e89b-12d3-a456-426614174003',
        orderIndex: '1.0',
        comment: shortContent,
        createdBy: '123e4567-e89b-12d3-a456-426614174000'
      };

      const commentWithLongContent = {
        demandId: '423e4567-e89b-12d3-a456-426614174003',
        orderIndex: '1.0',
        comment: longContent,
        createdBy: '123e4567-e89b-12d3-a456-426614174000'
      };

      expect(() => insertDemandCommentSchema.parse(commentWithShortContent)).toThrow();
      expect(() => insertDemandCommentSchema.parse(commentWithLongContent)).toThrow();
    });

    it('should accept valid comment data', () => {
      const comment = {
        demandId: '423e4567-e89b-12d3-a456-426614174003',
        orderIndex: '1.0',
        comment: 'Valid comment data',
        createdBy: '123e4567-e89b-12d3-a456-426614174000'
      };

      expect(() => insertDemandCommentSchema.parse(comment)).not.toThrow();
    });

    it('should validate order index', () => {
      const validComment = {
        demandId: '423e4567-e89b-12d3-a456-426614174003',
        orderIndex: '1.5',
        comment: 'Comment with decimal order index',
        createdBy: '123e4567-e89b-12d3-a456-426614174000'
      };

      const invalidComment = {
        demandId: '423e4567-e89b-12d3-a456-426614174003',
        comment: 'Comment without order index',
        createdBy: '123e4567-e89b-12d3-a456-426614174000'
      };

      expect(() => insertDemandCommentSchema.parse(validComment)).not.toThrow();
      expect(() => insertDemandCommentSchema.parse(invalidComment)).toThrow();
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
          submitterId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'maintenance',
          description,
          residenceId: '223e4567-e89b-12d3-a456-426614174001',
          buildingId: '323e4567-e89b-12d3-a456-426614174002'
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
        submitterId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'maintenance',
        description: minValidDescription,
        residenceId: '223e4567-e89b-12d3-a456-426614174001',
        buildingId: '323e4567-e89b-12d3-a456-426614174002'
      };

      const demandMaxValid = {
        submitterId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'maintenance',
        description: maxValidDescription,
        residenceId: '223e4567-e89b-12d3-a456-426614174001',
        buildingId: '323e4567-e89b-12d3-a456-426614174002'
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