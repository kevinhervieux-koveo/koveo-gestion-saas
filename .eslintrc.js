module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:jsdoc/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'jsx-a11y',
    'import',
    'jsdoc',
    'security',
    'unicorn',
    'perfectionist'
  ],
  settings: {
    react: {
      version: 'detect'
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true
      }
    }
  },
  rules: {
    // JSDoc Rules - Enhanced for better documentation
    'jsdoc/require-description': ['error', {
      contexts: ['any']
    }],
    'jsdoc/require-description-complete-sentence': 'error',
    'jsdoc/require-param-description': 'error',
    'jsdoc/require-returns-description': 'error',
    'jsdoc/require-returns': ['error', {
      contexts: ['FunctionDeclaration', 'MethodDefinition', 'ArrowFunctionExpression', 'FunctionExpression'],
      exemptedBy: ['constructor']
    }],
    'jsdoc/require-param': ['error', {
      contexts: ['FunctionDeclaration', 'MethodDefinition', 'ArrowFunctionExpression', 'FunctionExpression'],
      exemptedBy: ['constructor']
    }],
    'jsdoc/check-param-names': 'error',
    'jsdoc/check-tag-names': 'error',
    'jsdoc/check-types': 'error',
    'jsdoc/no-undefined-types': 'off', // TypeScript handles this
    'jsdoc/require-jsdoc': ['error', {
      require: {
        FunctionDeclaration: true,
        MethodDefinition: true,
        ClassDeclaration: true,
        ArrowFunctionExpression: false, // Only for exported functions
        FunctionExpression: false
      },
      contexts: [
        'Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
        'Program > ExportDefaultDeclaration > ArrowFunctionExpression',
        'Program > ExportNamedDeclaration > FunctionDeclaration',
        'Program > ExportDefaultDeclaration > FunctionDeclaration'
      ]
    }],
    
    // TypeScript Rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/prefer-const': 'error',
    '@typescript-eslint/no-var-requires': 'error',
    
    // React Rules
    'react/react-in-jsx-scope': 'off', // Not needed in React 19
    'react/prop-types': 'off', // TypeScript handles this
    'react/jsx-uses-react': 'off',
    'react/jsx-uses-vars': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // General Rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-undef': 'error',
    'no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'prefer-const': 'error',
    'no-var': 'error',
    
    // Import Rules
    'import/order': ['error', {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'never'
    }],
    'import/no-duplicates': 'error',
    'import/no-unresolved': 'error',
    
    // Security Rules
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    
    // Unicorn Rules
    'unicorn/prefer-module': 'off', // We use ES modules
    'unicorn/prevent-abbreviations': 'off', // Too strict for our use case
    
    // Perfectionist Rules
    'perfectionist/sort-imports': 'off', // Handled by import/order
    'perfectionist/sort-named-imports': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.{ts,tsx,js,jsx}'],
      env: {
        jest: true
      },
      rules: {
        'jsdoc/require-jsdoc': 'off', // Relaxed for test files
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off'
      }
    },
    {
      files: ['scripts/**/*.{ts,js}'],
      rules: {
        'no-console': 'off', // Scripts can use console
        'jsdoc/require-jsdoc': ['error', {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false
          }
        }]
      }
    },
    {
      files: ['tools/**/*.{ts,js}'],
      rules: {
        'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
        'jsdoc/require-jsdoc': ['error', {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false
          }
        }]
      }
    },
    {
      files: ['client/src/**/*.{ts,tsx}'],
      rules: {
        'jsdoc/require-jsdoc': ['error', {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false
          },
          contexts: [
            'Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
            'Program > ExportDefaultDeclaration > ArrowFunctionExpression',
            'Program > ExportNamedDeclaration > FunctionDeclaration',
            'Program > ExportDefaultDeclaration > FunctionDeclaration'
          ]
        }]
      }
    }
  ]
};