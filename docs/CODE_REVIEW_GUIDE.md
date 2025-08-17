# Koveo Gestion Code Review Guide

## Overview

This guide outlines the mandatory code review process for Koveo Gestion, ensuring code quality, security, and compliance with Quebec property management requirements.

## Code Review Requirements

### Mandatory Checks

All pull requests must pass these automated checks before review:

- ✅ **Static Analysis**: ESLint, TypeScript, Prettier
- ✅ **Testing**: Unit, Integration, E2E tests with ≥80% coverage
- ✅ **Security**: No critical/high vulnerabilities
- ✅ **Quality**: Code complexity ≤10, JSDoc documentation
- ✅ **Quebec Compliance**: Bilingual support, accessibility, privacy
- ✅ **Build**: Successful client and server builds

### Review Process

1. **Automated Checks**: All CI/CD checks must pass
2. **Code Review**: At least one approved review from codeowners
3. **Business Review**: Product owner approval for feature changes
4. **Security Review**: Security team approval for auth/security changes
5. **Quebec Compliance**: Compliance officer approval for legal/regulatory changes

## Review Guidelines

### Code Quality

**Look for:**
- [ ] Code follows TypeScript best practices
- [ ] SOLID principles are applied
- [ ] Functions are single-responsibility and well-named
- [ ] Complex logic is broken into smaller functions
- [ ] Error handling is comprehensive
- [ ] Performance implications are considered

**Red Flags:**
- ❌ Functions over 50 lines
- ❌ Cyclomatic complexity over 10
- ❌ Hardcoded values that should be configurable
- ❌ Missing error handling
- ❌ Security vulnerabilities or data exposure

### Quebec Compliance

**Must verify:**
- [ ] All user-facing text supports bilingual functionality
- [ ] Accessibility standards (WCAG 2.1 AA) are met
- [ ] Data handling complies with Quebec Law 25
- [ ] Property management business rules align with Quebec regulations

**Critical areas:**
- 🇨🇦 Language switching functionality
- ♿ Keyboard navigation and screen reader support
- 🔐 Personal data collection and storage practices
- 🏢 Quebec property law compliance

### Security Review

**Security checklist:**
- [ ] Input validation and sanitization
- [ ] Proper authentication and authorization
- [ ] No sensitive data in client-side code
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Secure session management

**High-risk areas:**
- 🔒 Authentication endpoints
- 💳 Payment processing
- 📊 Database queries
- 📁 File uploads
- 🔑 API key management

### Testing Requirements

**Test coverage:**
- [ ] Critical business logic: 100% coverage
- [ ] API endpoints: 95% coverage
- [ ] UI components: 85% coverage
- [ ] Utility functions: 90% coverage

**Test types required:**
- 🧪 Unit tests for business logic
- 🔗 Integration tests for API endpoints
- 🎭 End-to-end tests for user workflows
- 📱 Mobile responsive tests
- ♿ Accessibility tests

## Review Types

### Standard Review
- Code changes without security or compliance impact
- Requires: 1 codeowner approval
- Timeline: 24-48 hours

### Security Review
- Changes to authentication, authorization, or data handling
- Requires: Security team + tech lead approval
- Timeline: 48-72 hours

### Compliance Review
- Changes affecting Quebec regulations or accessibility
- Requires: Compliance officer + legal team approval
- Timeline: 3-5 days

### Database Review
- Schema changes or migration scripts
- Requires: Database admin + tech lead approval
- Timeline: 24-48 hours

## Branch Protection Rules

Configure these settings in GitHub:

```yaml
protection_rules:
  main:
    required_status_checks:
      - "Static Analysis"
      - "Testing Suite"
      - "Quality Analysis"
      - "Quebec Compliance"
      - "Build Validation"
    enforce_admins: true
    required_pull_request_reviews:
      required_approving_review_count: 1
      dismiss_stale_reviews: true
      require_code_owner_reviews: true
    restrict_pushes: true
    allow_force_pushes: false
    allow_deletions: false
```

## Common Review Comments

### Code Structure
- "Consider extracting this logic into a separate function"
- "This function has high complexity - can it be simplified?"
- "Add JSDoc documentation for this public API"

### Quebec Compliance
- "This text needs bilingual support - use the language hook"
- "Add ARIA labels for accessibility compliance"
- "Ensure this data handling complies with Law 25"

### Security
- "This input needs validation and sanitization"
- "Don't log sensitive information"
- "Use environment variables for this configuration"

### Testing
- "Add test coverage for this edge case"
- "This integration test needs error scenario coverage"
- "Mock external dependencies in unit tests"

## Performance Guidelines

### Critical Metrics
- Initial page load: <3 seconds
- Time to interactive: <5 seconds
- Largest contentful paint: <2.5 seconds
- Bundle size increase: <10% per PR

### Optimization Checklist
- [ ] Images are optimized and responsive
- [ ] Code splitting is implemented for large features
- [ ] Database queries are optimized with indexes
- [ ] API responses are properly cached
- [ ] Unnecessary re-renders are eliminated

## Documentation Requirements

### Required Documentation
- [ ] JSDoc for all exported functions and classes
- [ ] README updates for new features
- [ ] API documentation for new endpoints
- [ ] Migration guides for breaking changes

### Quebec-Specific Documentation
- [ ] Bilingual user documentation
- [ ] Compliance requirement explanations
- [ ] Property management workflow descriptions

## Escalation Process

### Blocked Reviews
1. Tag the appropriate team lead
2. Schedule review meeting if needed
3. Escalate to architecture review for complex decisions

### Disagreements
1. Discuss in PR comments first
2. Schedule synchronous discussion
3. Involve tech lead for final decision
4. Document decision rationale

### Emergency Fixes
- Require 2 tech lead approvals
- Must include rollback plan
- Post-incident review required

## Tools and Resources

### Automated Tools
- ESLint for code quality
- Prettier for code formatting
- Jest for testing
- Husky for git hooks
- GitHub Actions for CI/CD

### Manual Review Tools
- GitHub PR interface
- Browser dev tools for frontend testing
- Database query analyzers
- Accessibility testing tools

### Reference Materials
- [Branch Protection Setup Guide](./BRANCH_PROTECTION_SETUP.md)
- [Quality System Overview](./QUALITY_SYSTEM_OVERVIEW.md)
- [RBAC System Documentation](./RBAC_SYSTEM.md)
- [Accessibility Standards (WCAG 2.1)](https://www.w3.org/WAI/WCAG21/quickref/)

---

*This guide is a living document. Update it as the team learns and the project evolves.*