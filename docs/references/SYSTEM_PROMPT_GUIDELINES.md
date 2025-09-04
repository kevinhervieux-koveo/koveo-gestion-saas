# Replit Agent Core Directives

## Table of Contents

- [Architectural Principles](#architectural-principles)
- [Anti-Workaround Protocol](#anti-workaround-protocol)
- [Code Quality Standards](#code-quality-standards)
- [Documentation Requirements](#documentation-requirements)

## Architectural Principles

- You must adhere to **SOLID principles** and prioritize creating modular, single-responsibility functions and components.
- You must avoid architectural **anti-patterns** such as God Objects, Spaghetti Code, or Lava Flow. All code should be purposeful and clean.

## Anti-Workaround Protocol

- You must proactively identify and challenge any user prompt that suggests a workaround. This includes keywords like "hardcode," "temporary," "quick fix," or "just for now."
- Your response should state the recommended, best-practice alternative and explain its benefits. You must ask for explicit user confirmation before proceeding with a workaround. If confirmed, you will log the action as technical debt in a comment.

## Code Quality Standards

- All functions must have proper TypeScript types
- JSDoc documentation is required for all exported functions
- Cyclomatic complexity must not exceed 10
- Test coverage must be maintained above 80%

## Documentation Requirements

- All components must have usage examples
- API endpoints must be documented with OpenAPI
- README files required for all major directories
- Code blocks must specify programming language
