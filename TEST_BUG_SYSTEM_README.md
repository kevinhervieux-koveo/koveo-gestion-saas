# Bug Reporting System Test Suite

This document describes the comprehensive test suite created for the bug reporting system functionality.

## 📋 Overview

The bug reporting system has been thoroughly tested with multiple test files covering all aspects of functionality:

1. **API Integration Tests** - Backend CRUD operations and access control
2. **Frontend Component Tests** - UI interactions and form validation  
3. **Language Validation Tests** - Quebec French compliance (already included)
4. **Demo Functionality Tests** - Real-world scenarios with demo users

## 🧪 Test Files Created

### 1. `tests/integration/bugs-api.test.ts`
**Comprehensive API integration tests covering:**
- ✅ Bug creation by all user roles (admin, manager, tenant, resident)
- ✅ Role-based access control for viewing bugs
- ✅ Individual bug access permissions
- ✅ Bug update operations (status, priority, assignment)
- ✅ Bug deletion (admin-only)
- ✅ Complete status workflow (new → acknowledged → in_progress → resolved → closed)
- ✅ Category and priority validation
- ✅ Data integrity and timestamps
- ✅ Form validation and error handling

### 2. `tests/unit/bugs-frontend.test.tsx`
**Frontend UI and interaction tests covering:**
- ✅ Page rendering with all components
- ✅ Bug creation dialog and form
- ✅ Form validation for required fields
- ✅ Bug list display and filtering
- ✅ Search functionality
- ✅ Status/priority/category filters
- ✅ French translations for all text
- ✅ Accessibility features
- ✅ Performance considerations
- ✅ Error handling

### 3. `tests/integration/demo-bugs-functionality.test.ts`
**Real-world demo scenarios using existing demo users:**
- ✅ Bug creation by demo manager, tenant, and resident
- ✅ Role-based viewing permissions
- ✅ Bug status management by manager
- ✅ Complete bug lifecycle scenario
- ✅ Category and priority testing
- ✅ Validation error testing
- ✅ Comprehensive test summary report

### 4. Language Tests (Already Extended)
**Quebec French validation in `tests/integration/page-language-validation.test.tsx`:**
- ✅ Bug Reports page language validation (line 331)
- ✅ Settings page language validation (line 321)

## 🚀 Running the Tests

### Quick Test Script
Use the provided test runner script:
```bash
npm run tsx scripts/run-bug-tests.ts
```

### Individual Test Commands
```bash
# Frontend UI tests
npm run test -- tests/unit/bugs-frontend.test.tsx --verbose

# API integration tests  
npm run test -- tests/integration/bugs-api.test.ts --verbose

# Demo functionality tests
npm run test -- tests/integration/demo-bugs-functionality.test.ts --verbose

# Language validation tests
npm run test -- tests/integration/page-language-validation.test.tsx --testNamePattern="Bug Reports.*language" --verbose
npm run test -- tests/integration/page-language-validation.test.tsx --testNamePattern="Settings.*language" --verbose
```

### All Bug Tests
```bash
# Run all bug-related tests
npm run test -- --testPathPattern="bugs" --verbose

# With coverage
npm run test -- --coverage --testPathPattern="bugs"

# Watch mode
npm run test -- --watch --testPathPattern="bugs"
```

## 🎯 Test Coverage

The test suite covers all major functionality:

### Bug Operations
- ✅ Create bugs (all user roles)
- ✅ Read bugs (role-based access)
- ✅ Update bugs (manager/admin only)
- ✅ Delete bugs (admin only)

### User Roles Tested
- ✅ **Admin**: Can see and manage all bugs
- ✅ **Manager**: Can see all org bugs, update status
- ✅ **Tenant**: Can create and see own bugs only
- ✅ **Resident**: Can create and see own bugs only

### Bug Properties
- ✅ **Categories**: ui_ux, functionality, performance, data, security, integration, other
- ✅ **Priorities**: low, medium, high, critical
- ✅ **Statuses**: new, acknowledged, in_progress, resolved, closed

### Validation
- ✅ Required field validation
- ✅ Data type validation
- ✅ Business rule validation
- ✅ Authentication requirements

## 📊 Demo User Credentials

The tests use demo users created by `scripts/create-test-users.ts`:

- **Manager**: manager@563pionniers.test / TestManager2024!
- **Tenant**: tenant@563pionniers.test / TestTenant2024!  
- **Resident**: resident@563pionniers.test / TestResident2024!

## 🔧 Prerequisites

Before running tests, ensure:

1. **Database is running** with proper schema
2. **Demo users are created**: `npm run tsx scripts/create-test-users.ts`
3. **Environment variables are set** (DATABASE_URL, etc.)
4. **Dependencies are installed**: `npm install`

## 📈 Test Results

When all tests pass, you'll see:
- ✅ All CRUD operations working
- ✅ Proper access controls enforced
- ✅ Form validation functioning
- ✅ Quebec French compliance verified
- ✅ Real-world scenarios validated

## 🐛 Troubleshooting

**If tests fail:**

1. **Check database connection** - Ensure DATABASE_URL is correct
2. **Create demo users** - Run the user creation script
3. **Check server status** - Ensure the app is running
4. **Review logs** - Check console output for detailed error messages

**Common issues:**
- Demo users not found → Run `scripts/create-test-users.ts`
- Database connection error → Check DATABASE_URL
- Authentication failures → Verify user credentials
- Permission errors → Check user roles and organization assignments

## 💡 Extending Tests

To add more tests:

1. **Add new test cases** to existing files
2. **Create new test files** following the established patterns
3. **Update the test runner script** to include new test files
4. **Document new functionality** in this README

## ✨ Summary

This comprehensive test suite ensures the bug reporting system is:
- **Fully functional** across all user roles
- **Secure** with proper access controls
- **User-friendly** with Quebec French translations
- **Robust** with proper validation and error handling
- **Well-documented** with real-world usage examples

The bug reporting system is now production-ready with complete test coverage!