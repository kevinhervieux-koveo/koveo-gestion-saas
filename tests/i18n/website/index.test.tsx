/**
 * Website Translation Test Suite Index
 * 
 * Comprehensive test suite for website translation functionality.
 * This replaces the original website-translation.test.tsx file with
 * organized, focused test files.
 * 
 * Test Categories:
 * - Language Coverage: Validates translation completeness
 * - Language Switcher: Tests language switching functionality  
 * - Page Content: Tests page-specific translations
 * - Form Elements: Tests form and UI element translations
 * - Quebec Compliance: Tests Quebec Law 25 compliance
 * - User Management: Tests user management translations
 * - Dashboard: Tests dashboard-specific translations
 * - Accessibility: Tests accessibility with translations
 * 
 * Each test file focuses on a specific aspect of translation
 * functionality, making them easier to maintain and debug.
 */

// Import all test suites to ensure they run
import './language-coverage.test';
import './language-switcher.test';
import './page-content.test';
import './form-elements.test';
import './quebec-compliance.test';
import './user-management.test';
import './dashboard-translations.test';
import './accessibility.test';