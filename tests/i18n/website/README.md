# Website Translation Test Suite

This directory contains the refactored website translation tests, previously contained in a single 18,539-line file. The tests have been broken down into focused, maintainable test files.

## Test Files

- **`test-providers.tsx`** - Shared test utilities and providers
- **`language-coverage.test.tsx`** - Translation completeness validation
- **`language-switcher.test.tsx`** - Language switching functionality
- **`page-content.test.tsx`** - Page-specific content translation
- **`form-elements.test.tsx`** - Form and UI element translations
- **`quebec-compliance.test.tsx`** - Quebec Law 25 compliance
- **`user-management.test.tsx`** - User management translation tests
- **`dashboard-translations.test.tsx`** - Dashboard-specific translations
- **`accessibility.test.tsx`** - Accessibility with translations
- **`index.test.tsx`** - Test suite index

## Benefits of Refactoring

- **Maintainable**: Each file focuses on a single concern (~100-200 lines each)
- **Debuggable**: Easier to identify and fix issues in specific areas
- **Testable**: Can run individual test suites for faster development
- **Scalable**: New translation tests can be added to appropriate files
- **Readable**: Clear organization and smaller file sizes

## Running Tests

```bash
# Run all translation tests
npm test tests/i18n/website/

# Run specific test category
npm test tests/i18n/website/language-coverage.test.tsx
npm test tests/i18n/website/quebec-compliance.test.tsx
```

## Coverage Areas

The test suite covers:

- ✅ Complete translation key coverage (English ↔ French)
- ✅ Quebec French terminology compliance
- ✅ Language switching UI behavior
- ✅ Quebec Law 25 compliance messaging
- ✅ Form element translations
- ✅ User management translations
- ✅ Dashboard content translations
- ✅ Accessibility with i18n support
