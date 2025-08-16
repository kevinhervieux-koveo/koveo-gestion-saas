import {
  validatePasswordStrength,
  getPasswordCriteria,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  getPasswordStrengthBarColor,
  PasswordStrengthResult,
  PasswordCriteria
} from '../../../client/src/utils/password-validation';

describe('Password Validation System', () => {
  describe('Password Strength Validation', () => {
    test('should validate minimum length requirement', () => {
      expect(validatePasswordStrength('1234567').score).toBe(1); // Has numbers but no min length
      expect(validatePasswordStrength('12345678').score).toBeGreaterThan(1); // Min length + numbers
      expect(validatePasswordStrength('123456789012345').score).toBeGreaterThan(2); // Long + min length + numbers
    });

    test('should validate uppercase letter requirement', () => {
      const noUppercase = validatePasswordStrength('password123!');
      const withUppercase = validatePasswordStrength('Password123!');
      const noUppercaseCriteria = getPasswordCriteria('password123!');
      const withUppercaseCriteria = getPasswordCriteria('Password123!');
      
      expect(noUppercaseCriteria.hasUpperCase).toBe(false);
      expect(withUppercaseCriteria.hasUpperCase).toBe(true);
      expect(withUppercase.score).toBeGreaterThanOrEqual(noUppercase.score);
    });

    test('should validate lowercase letter requirement', () => {
      const noLowercase = validatePasswordStrength('PASSWORD123!');
      const withLowercase = validatePasswordStrength('Password123!');
      const noLowercaseCriteria = getPasswordCriteria('PASSWORD123!');
      const withLowercaseCriteria = getPasswordCriteria('Password123!');
      
      expect(noLowercaseCriteria.hasLowerCase).toBe(false);
      expect(withLowercaseCriteria.hasLowerCase).toBe(true);
      expect(withLowercase.score).toBeGreaterThanOrEqual(noLowercase.score);
    });

    test('should validate number requirement', () => {
      const noNumbers = validatePasswordStrength('Password!@#');
      const withNumbers = validatePasswordStrength('Password123!');
      const noNumbersCriteria = getPasswordCriteria('Password!@#');
      const withNumbersCriteria = getPasswordCriteria('Password123!');
      
      expect(noNumbersCriteria.hasNumbers).toBe(false);
      expect(withNumbersCriteria.hasNumbers).toBe(true);
      expect(withNumbers.score).toBeGreaterThan(noNumbers.score);
    });

    test('should validate special character requirement', () => {
      const noSpecial = validatePasswordStrength('Password123');
      const withSpecial = validatePasswordStrength('Password123!');
      const noSpecialCriteria = getPasswordCriteria('Password123');
      const withSpecialCriteria = getPasswordCriteria('Password123!');
      
      expect(noSpecialCriteria.hasSymbols).toBe(false);
      expect(withSpecialCriteria.hasSymbols).toBe(true);
      expect(withSpecial.score).toBeGreaterThan(noSpecial.score);
    });

    test('should calculate correct strength scores', () => {
      const weak = validatePasswordStrength('password');
      const medium = validatePasswordStrength('Password123');
      const strong = validatePasswordStrength('Password123!');
      const veryStrong = validatePasswordStrength('MyStrongP@ssw0rd2024');
      
      expect(weak.score).toBeGreaterThanOrEqual(1); // Even weak passwords get some points
      expect(medium.score).toBeGreaterThanOrEqual(2);
      expect(strong.score).toBeGreaterThanOrEqual(3);
      expect(veryStrong.score).toBeLessThanOrEqual(4);
    });

    test('should handle edge cases', () => {
      expect(() => validatePasswordStrength('')).not.toThrow();
      expect(() => validatePasswordStrength('   ')).not.toThrow();
      expect(() => validatePasswordStrength('🔐🌟💪')).not.toThrow();
      
      const empty = validatePasswordStrength('');
      const emptyCriteria = getPasswordCriteria('');
      expect(empty.score).toBeGreaterThanOrEqual(0); // Empty password gets minimum score
      expect(emptyCriteria.minLength).toBe(false);
      expect(emptyCriteria.hasUpperCase).toBe(false);
      expect(emptyCriteria.hasLowerCase).toBe(false);
      expect(emptyCriteria.hasNumbers).toBe(false);
      expect(emptyCriteria.hasSymbols).toBe(false);
      expect(emptyCriteria.noCommonPatterns).toBe(true); // Empty doesn't contain common patterns
    });
  });

  describe('Password Criteria Helper', () => {
    test('should return correct criteria object', () => {
      const criteria = getPasswordCriteria('Password123!');
      
      expect(criteria).toHaveProperty('minLength');
      expect(criteria).toHaveProperty('hasUpperCase');
      expect(criteria).toHaveProperty('hasLowerCase');
      expect(criteria).toHaveProperty('hasNumbers');
      expect(criteria).toHaveProperty('hasSymbols');
      expect(criteria).toHaveProperty('noCommonPatterns');
      
      expect(typeof criteria.minLength).toBe('boolean');
      expect(typeof criteria.hasUpperCase).toBe('boolean');
      expect(typeof criteria.hasLowerCase).toBe('boolean');
      expect(typeof criteria.hasNumbers).toBe('boolean');
      expect(typeof criteria.hasSymbols).toBe('boolean');
      expect(typeof criteria.noCommonPatterns).toBe('boolean');
    });

    test('should evaluate criteria correctly for strong password', () => {
      const criteria = getPasswordCriteria('MySecureAuth123!');
      
      expect(criteria.minLength).toBe(true);
      expect(criteria.hasUpperCase).toBe(true);
      expect(criteria.hasLowerCase).toBe(true);
      expect(criteria.hasNumbers).toBe(true);
      expect(criteria.hasSymbols).toBe(true);
      expect(criteria.noCommonPatterns).toBe(true); // Should not contain common patterns
    });
  });

  describe('Password Strength Labels', () => {
    test('should return correct French labels for each strength level', () => {
      expect(getPasswordStrengthLabel(0)).toBe('Très faible');
      expect(getPasswordStrengthLabel(1)).toBe('Très faible');
      expect(getPasswordStrengthLabel(2)).toBe('Faible');
      expect(getPasswordStrengthLabel(3)).toBe('Moyen');
      expect(getPasswordStrengthLabel(4)).toBe('Fort');
    });

    test('should handle invalid strength values', () => {
      expect(getPasswordStrengthLabel(-1)).toBe('Très faible');
      expect(getPasswordStrengthLabel(10)).toBe('Très faible');
    });

    test('should return correct colors for strength levels', () => {
      expect(getPasswordStrengthColor(0)).toBe('text-red-600');
      expect(getPasswordStrengthColor(2)).toBe('text-orange-500');
      expect(getPasswordStrengthColor(3)).toBe('text-yellow-500');
      expect(getPasswordStrengthColor(4)).toBe('text-green-600');
    });

    test('should return correct bar colors for strength levels', () => {
      expect(getPasswordStrengthBarColor(0)).toBe('bg-red-500');
      expect(getPasswordStrengthBarColor(2)).toBe('bg-orange-500');
      expect(getPasswordStrengthBarColor(3)).toBe('bg-yellow-500');
      expect(getPasswordStrengthBarColor(4)).toBe('bg-green-500');
    });
  });

  describe('Quebec Compliance Validation', () => {
    test('should enforce minimum security standards for Quebec Law 25', () => {
      // Quebec privacy law requires strong password protection
      const weakPassword = validatePasswordStrength('password');
      const compliantPassword = validatePasswordStrength('MonMotDePasse2024!');
      
      expect(weakPassword.score).toBeLessThan(3);
      expect(compliantPassword.score).toBeGreaterThanOrEqual(3);
      
      // Strong passwords should meet all criteria for law compliance
      const strongCriteria = getPasswordCriteria('MonMotDePasse2024!');
      expect(strongCriteria.minLength).toBe(true);
      expect(strongCriteria.hasUpperCase).toBe(true);
      expect(strongCriteria.hasLowerCase).toBe(true);
      expect(strongCriteria.hasNumbers).toBe(true);
      expect(strongCriteria.hasSymbols).toBe(true);
    });

    test('should validate password complexity for property management security', () => {
      // Property management systems require higher security standards
      const passwords = [
        'Admin123!',
        'GestionPropriete2024@',
        'Montreal$yndic123',
        'QuebecCondo#456'
      ];

      passwords.forEach(password => {
        const result = validatePasswordStrength(password);
        const criteria = getPasswordCriteria(password);
        expect(result.score).toBeGreaterThanOrEqual(3);
        expect(criteria.minLength).toBe(true);
        expect(criteria.hasSymbols).toBe(true);
      });
    });
  });

  describe('Performance Tests', () => {
    test('should validate passwords quickly under load', () => {
      const passwords = Array.from({ length: 1000 }, (_, i) => 
        `TestPassword${i}!@#${Math.random()}`
      );

      const startTime = Date.now();
      
      passwords.forEach(password => {
        validatePasswordStrength(password);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should validate 1000 passwords in under 100ms
      expect(duration).toBeLessThan(100);
    });

    test('should handle very long passwords efficiently', () => {
      const longPassword = 'A'.repeat(10000) + '1' + '!';
      
      const startTime = Date.now();
      const result = validatePasswordStrength(longPassword);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(10);
      expect(result.score).toBeGreaterThan(0);
    });
  });
});