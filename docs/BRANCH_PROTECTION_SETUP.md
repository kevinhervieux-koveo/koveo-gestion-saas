# Branch Protection Setup Guide

## Overview

This guide provides step-by-step instructions for setting up mandatory branch protection rules on GitHub to enforce code review requirements for Koveo Gestion.

## Required Branch Protection Rules

### Main Branch Protection

Configure the following settings for the `main` branch:

#### General Settings
- ✅ **Restrict pushes that create files larger than 100 MB**
- ✅ **Restrict pushes that create files larger than 100 MB**

#### Branch Protection Rules

**Rule Name:** `Main Branch Protection`

**Branch name pattern:** `main`

#### Pull Request Requirements
- ✅ **Require a pull request before merging**
  - Required approving reviews: **1**
  - ✅ **Dismiss stale PR reviews when new commits are pushed**
  - ✅ **Require review from CODEOWNERS**
  - ✅ **Restrict dismissals** (only admins can dismiss reviews)
  - ✅ **Allow specified actors to bypass required pull requests**
    - Add: Emergency responders (for critical hotfixes only)

#### Status Check Requirements
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**

**Required status checks:**
```yaml
Static Analysis
Testing Suite  
Quality Analysis
Quebec Compliance
Build Validation
Quality Gate
```

#### Additional Restrictions
- ✅ **Restrict pushes that create files larger than 100 MB**
- ✅ **Block force pushes**
- ✅ **Require linear history** (recommended for clean history)

#### Administrative Controls
- ✅ **Do not allow bypassing the above settings**
- ✅ **Include administrators** (admins must follow same rules)

### Development Branch Protection

Configure the following settings for the `develop` branch:

#### Pull Request Requirements
- ✅ **Require a pull request before merging**
  - Required approving reviews: **1**
  - ✅ **Dismiss stale PR reviews when new commits are pushed**
  - ✅ **Require review from CODEOWNERS**

#### Status Check Requirements
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**

**Required status checks:**
```yaml
Static Analysis
Testing Suite
Quality Analysis
Build Validation
```

## GitHub Repository Settings

### General Repository Settings

Navigate to **Settings > General**:

#### Pull Requests
- ✅ **Allow squash merging**
  - Default message: "Pull request title and description"
- ✅ **Allow merge commits**
- ❌ **Allow rebase merging** (to maintain linear history)

#### Automatically delete head branches
- ✅ **Enable automatic deletion of head branches**

### Actions Permissions

Navigate to **Settings > Actions > General**:

#### Actions permissions
- ✅ **Allow all actions and reusable workflows**

#### Workflow permissions
- ✅ **Read repository contents and packages permissions**
- ✅ **Allow GitHub Actions to create and approve pull requests**

### Security Settings

Navigate to **Settings > Security & analysis**:

#### Vulnerability alerts
- ✅ **Dependency graph**
- ✅ **Dependabot alerts**
- ✅ **Dependabot security updates**

#### Code scanning
- ✅ **Code scanning** (setup CodeQL if not already configured)

## Team Setup

### Required Teams

Create the following teams with appropriate permissions:

#### @koveogestion/tech-leads
- **Permission Level:** Admin
- **Members:** Senior developers, technical architects
- **Responsibilities:** Architecture decisions, critical reviews

#### @koveogestion/security-team
- **Permission Level:** Write
- **Members:** Security specialists, senior developers
- **Responsibilities:** Security and authentication reviews

#### @koveogestion/database-admins
- **Permission Level:** Write  
- **Members:** Database specialists, backend developers
- **Responsibilities:** Schema changes, migration reviews

#### @koveogestion/quality-team
- **Permission Level:** Write
- **Members:** QA engineers, DevOps engineers
- **Responsibilities:** Quality standards, CI/CD maintenance

#### @koveogestion/quebec-compliance
- **Permission Level:** Write
- **Members:** Legal compliance officers, product managers
- **Responsibilities:** Quebec law compliance, accessibility

#### @koveogestion/business-team
- **Permission Level:** Write
- **Members:** Product managers, business analysts
- **Responsibilities:** Business logic, property management workflows

### Team Permissions

#### Repository Access Levels
- **Admin:** Tech leads only
- **Write:** All team members (required for reviews)
- **Read:** Contractors, external reviewers

## Environment Setup

### Required Secrets

Navigate to **Settings > Secrets and variables > Actions**:

#### Repository Secrets
```yaml
# Database (if needed for CI)
DATABASE_URL

# Code coverage (if using external service)  
CODECOV_TOKEN

# Package registry (if using private packages)
NPM_TOKEN

# Notification webhooks (optional)
SLACK_WEBHOOK_URL
```

### Environment Configuration

#### Production Environment
- **Protection rules:** Require reviewers (tech leads only)
- **Deployment branches:** `main` only
- **Environment secrets:** Production database, API keys

#### Staging Environment  
- **Protection rules:** Require reviewers (any team member)
- **Deployment branches:** `main`, `develop`
- **Environment secrets:** Staging database, test API keys

## Enforcement Scripts

### Setup Script

Create a setup script to automate branch protection:

```bash
#!/bin/bash
# setup-branch-protection.sh

REPO="koveogestion/platform"
GITHUB_TOKEN="your_token_here"

# Main branch protection
curl -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/$REPO/branches/main/protection \
  -d @branch-protection-main.json

# Develop branch protection  
curl -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/$REPO/branches/develop/protection \
  -d @branch-protection-develop.json

echo "✅ Branch protection rules applied"
```

### Validation Script

```bash
#!/bin/bash
# validate-protection.sh

# Check if main branch is protected
PROTECTION=$(curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/$REPO/branches/main/protection)

if echo "$PROTECTION" | grep -q "required_status_checks"; then
  echo "✅ Main branch protection active"
else  
  echo "❌ Main branch protection missing"
  exit 1
fi
```

## Monitoring and Alerts

### GitHub Notifications

Configure notifications for:
- Failed status checks
- Required review requests
- Security alerts
- Failed deployments

### Team Notifications

Set up Slack/Teams integration for:
- Pull request reviews needed
- Build failures
- Security vulnerability alerts
- Quality gate failures

## Emergency Procedures

### Hotfix Process

For critical production fixes:

1. Create hotfix branch from `main`
2. Make minimal necessary changes
3. Request emergency review from 2 tech leads  
4. Use "Emergency bypass" if configured
5. Deploy immediately
6. Create post-incident review task

### Bypass Procedures

Emergency bypass is only allowed for:
- Security vulnerabilities requiring immediate patch
- Production outages affecting users
- Data loss prevention

**Required for bypass:**
- 2 tech lead approvals
- Incident documentation  
- Post-fix review commitment
- Rollback plan documented

## Compliance Validation

### Weekly Audit Checklist

- [ ] All main branch commits came via reviewed PRs
- [ ] No direct pushes to protected branches
- [ ] All required status checks are passing
- [ ] CODEOWNERS file is up to date
- [ ] Team memberships are current
- [ ] No bypass usage without documentation

### Monthly Review

- [ ] Protection rules are still appropriate
- [ ] Required checks are catching relevant issues
- [ ] Team structure aligns with project needs  
- [ ] Emergency procedures are documented
- [ ] Compliance requirements are met

## Troubleshooting

### Common Issues

#### Status checks not appearing
- Verify GitHub Actions workflow names match protection settings
- Check Actions have proper permissions
- Ensure workflows run on pull requests

#### Reviews not required from CODEOWNERS
- Validate CODEOWNERS file syntax
- Check team memberships are current
- Verify file paths match repository structure

#### Branch not up to date errors
- Ensure "Require branches to be up to date" is properly configured
- Check if merge conflicts exist
- Verify base branch is correct

### Support Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [CODEOWNERS Syntax](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

*Review and update these settings quarterly or when team structure changes.*