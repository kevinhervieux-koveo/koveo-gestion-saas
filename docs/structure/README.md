# Project Structure Documentation

This directory contains comprehensive documentation about the Koveo Gestion project structure, organization principles, and maintenance guidelines.

## Documentation Files

- **[PROJECT_STRUCTURE_GUIDE.md](../references/PROJECT_STRUCTURE_GUIDE.md)** - Complete project structure overview
- **[NAMING_CONVENTIONS.md](./NAMING_CONVENTIONS.md)** - File and code naming standards
- **[COMPONENT_ORGANIZATION.md](./COMPONENT_ORGANIZATION.md)** - Frontend component structure
- **[API_ORGANIZATION.md](./API_ORGANIZATION.md)** - Backend API structure
- **[CONFIGURATION_MANAGEMENT.md](./CONFIGURATION_MANAGEMENT.md)** - Configuration patterns

## Quick Reference

### Directory Structure

```
koveo-gestion/
├── client/                 # Frontend React application
├── server/                 # Backend Express application
├── shared/                 # Shared code and types
├── docs/                   # Documentation
├── tests/                  # Test files
├── config/                 # Configuration files
└── tools/                  # Development tools
```

### Key Principles

1. **Separation of Concerns** - Clear boundaries between frontend, backend, and shared code
2. **Feature-Based Organization** - Group related functionality together
3. **Consistent Naming** - Standard naming conventions across all files
4. **Centralized Exports** - Index files for clean imports
5. **Type Safety** - Comprehensive TypeScript coverage

For detailed information, see the [complete project structure guide](../references/PROJECT_STRUCTURE_GUIDE.md).
