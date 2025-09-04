# Semgrep Security Testing Guide

## Overview

This guide explains the Semgrep security testing setup for Koveo Gestion, including static analysis rules, test validation, and integration with the development workflow.

## Configuration Files

### .semgrep.yml
Contains custom security rules for:
- **Quebec Law 25 Compliance**: Data protection, consent tracking, cross-border transfers
- **Property Management Security**: Tenant financial data, building access codes
- **Web Application Security**: SQL injection, XSS, CORS, authentication
- **Express.js Security**: Session management, rate limiting, security headers
- **React Security**: External links, prototype pollution, unsafe patterns
- **Cryptography**: Weak algorithms, hardcoded secrets, random generation
- **Input Validation**: Missing validation, command injection, path traversal

### .semgrepignore
Excludes files that don't need security analysis:
- Dependencies and build artifacts
- Test files and mocks
- Configuration files
- Documentation and assets
- Generated files

### semgrep.config.json
Configuration metadata including rule categorization and compliance mappings.

## Security Rules by Category

### Critical Security Issues (ERROR level)
- `hardcoded-secrets`: Detects hardcoded API keys, passwords, tokens
- `sql-injection-prevention`: Prevents SQL injection vulnerabilities
- `weak-crypto-usage`: Flags weak cryptographic algorithms
- `command-injection-risk`: Detects command injection vulnerabilities
- `directory-traversal-prevention`: Prevents path traversal attacks
- `express-cors-wildcard`: Flags overly permissive CORS policies
- `session-security-missing`: Detects insecure session configurations
- `jwt-weak-secret`: Flags JWT secrets that are too short
- `prototype-pollution-risk`: Detects prototype pollution vulnerabilities
- `file-upload-security`: Flags insecure file upload configurations
- `env-var-exposure`: Prevents environment variable exposure
- `database-connection-exposure`: Prevents database credential exposure

### Quebec Law 25 Compliance (ERROR/WARNING level)
- `law25-sensitive-data-logging`: Prevents logging personal data
- `law25-cross-border-transfer`: Flags unauthorized data transfers
- `law25-encryption-at-rest`: Requires encryption for sensitive data
- `law25-secure-communication`: Enforces HTTPS for personal data
- `law25-explicit-consent-required`: Flags missing consent mechanisms
- `law25-consent-tracking`: Requires consent tracking for data access
- `law25-data-retention-policy`: Flags missing retention policies
- `law25-consent-withdrawal`: Requires consent withdrawal mechanisms
- `law25-data-subject-rights`: Flags missing data subject rights implementation
- `law25-data-breach-notification`: Requires breach notification procedures

### Property Management Security (ERROR level)
- `tenant-financial-data-protection`: Protects tenant financial information
- `building-access-data-security`: Protects building access codes and keys

### Web Application Security (WARNING level)
- `express-missing-helmet`: Flags missing Helmet.js security headers
- `missing-rate-limiting`: Detects missing rate limiting on auth endpoints
- `missing-input-validation`: Flags missing Zod schema validation
- `react-external-links`: Detects external links missing security attributes
- `xss-prevention-react`: Flags risky dangerouslySetInnerHTML usage
- `insecure-random-generation`: Flags weak random number generation

## Running Security Tests

### Individual Commands

```bash
# Run custom security rules
npx semgrep --config=.semgrep.yml .

# Run OWASP Top 10 scan
npx semgrep --config=p/owasp-top-ten .

# Run React security scan
npx semgrep --config=p/react .

# Run comprehensive security test suite
npm run test:security

# Run Semgrep-specific tests
bash scripts/run-semgrep.sh
```

### Automated Test Pipeline

The security tests are integrated into:
- `scripts/run-security-tests.sh`: Comprehensive security test runner
- `scripts/run-semgrep.sh`: Dedicated Semgrep scanner
- `tests/security/semgrep-security.test.ts`: Jest-based validation tests

## Output and Reports

Security scan results are saved to the `reports/` directory:
- `semgrep-results.json`: Custom rule findings
- `owasp-results.json`: OWASP Top 10 findings
- `react-security-results.json`: React-specific findings
- `security-audit-results.json`: General security audit
- `security-summary.json`: Aggregated summary report

## Interpreting Results

### Severity Levels
- **ERROR**: Critical security issues that must be fixed
- **WARNING**: Security concerns that should be addressed
- **INFO**: Informational findings for awareness

### Quebec Law 25 Specific
All Law 25 rules include metadata for compliance tracking:
```yaml
metadata:
  category: privacy
  law25: data-collection  # Specific Law 25 requirement
```

### Property Management Specific
Domain-specific rules for property management security:
```yaml
metadata:
  category: financial-privacy
  domain: property-management
```

## Best Practices

1. **Run Before Commits**: Execute security tests before committing code
2. **Address Critical Issues**: Fix all ERROR-level findings immediately
3. **Review Warnings**: Evaluate WARNING-level findings for business impact
4. **Monitor Trends**: Track security findings over time
5. **Update Rules**: Keep Semgrep rules current with new vulnerabilities
6. **Document Exceptions**: Document any approved security exceptions

## Integration with Development Workflow

Security tests are integrated into:
- Pre-commit hooks (via Husky)
- Continuous integration pipeline
- Manual development testing
- Deployment validation

## Troubleshooting

### Common Issues
1. **Empty Results**: Check .semgrepignore for overly broad exclusions
2. **False Positives**: Update rules with more specific patterns
3. **Performance**: Use --exclude for large directories not relevant to security
4. **Rule Updates**: Keep Semgrep updated for latest security patterns

### Getting Help
- Semgrep documentation: https://semgrep.dev/docs/
- Rule gallery: https://semgrep.dev/r/
- Custom rule writing: https://semgrep.dev/docs/writing-rules/

## Compliance Reporting

The security test suite generates compliance reports for:
- Quebec Law 25 data protection requirements
- Property management industry standards
- Web application security benchmarks
- OWASP Top 10 vulnerability categories

Regular security scanning ensures ongoing compliance and security posture maintenance.