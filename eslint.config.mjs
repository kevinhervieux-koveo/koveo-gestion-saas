import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      'coverage/**',
      'drizzle/**',
      'migrations/**'
    ],
  },
  {
    files: ['**/*.test.{ts,tsx,js,jsx}', '**/tests/**/*.{ts,tsx,js,jsx}', '**/test/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        URL: 'readonly',
        performance: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly'
      },
    },
    rules: {
      // Turn off all problematic rules for test files
      'no-console': 'off',
      'no-undef': 'off', 
      'no-unused-vars': 'off',
      'no-var': 'off',
      'prefer-const': 'off',
      'no-empty': 'off',
      'no-debugger': 'off'
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        URL: 'readonly',
        performance: 'readonly'
      },
    },
    rules: {
      'no-console': 'off', // Allow console for now
      'no-debugger': 'warn',
      'no-undef': 'off', // Turn off for TypeScript
      'no-unused-vars': 'off', // Turn off for now
      'prefer-const': 'off',
      'no-var': 'off'
    },
  }
];