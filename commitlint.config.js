/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation only changes
        'style',    // Changes that do not affect the meaning of the code
        'refactor', // A code change that neither fixes a bug nor adds a feature
        'perf',     // A code change that improves performance
        'test',     // Adding missing tests or correcting existing tests
        'chore',    // Changes to the build process or auxiliary tools
        'ci',       // Changes to CI configuration files and scripts
        'build',    // Changes that affect the build system or external dependencies
        'revert'    // Reverts a previous commit
      ]
    ],
    'scope-enum': [
      1,
      'always',
      [
        'auth',        // Authentication related
        'database',    // Database changes
        'api',         // API changes
        'ui',          // User interface
        'security',    // Security related
        'quebec',      // Quebec compliance
        'quality',     // Code quality
        'docs',        // Documentation
        'config',      // Configuration changes
        'deps',        // Dependencies
        'mobile',      // Mobile specific
        'performance', // Performance improvements
        'a11y',        // Accessibility
        'i18n'         // Internationalization
      ]
    ],
    'subject-case': [2, 'always', 'sentence-case'],
    'subject-min-length': [2, 'always', 10],
    'subject-max-length': [2, 'always', 72],
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100]
  },
  helpUrl: 'https://github.com/conventional-changelog/commitlint/#what-is-commitlint'
};