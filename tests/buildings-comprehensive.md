# Buildings Management Test Suite Documentation

## Overview
Comprehensive test coverage for the Buildings Management functionality in Koveo Gestion, including unit tests, integration tests, validation tests, and end-to-end workflow tests.

## Test Categories

### 1. Unit Tests (`tests/unit/buildings-basic.test.tsx`)

**Purpose**: Test individual components and functions in isolation

**Coverage**:
- ✅ Building data validation
- ✅ Search functionality (name, address, city, organization)
- ✅ Role-based access control logic
- ✅ Form validation (required fields, data types, ranges)
- ✅ Quebec-specific features (French characters, postal codes)
- ✅ Zero value handling for numeric fields
- ✅ Error handling and edge cases

**Key Test Cases**:
```javascript
// Valid building validation
const validBuilding = {
  name: 'Maple Heights',
  organizationId: 'org-123',
  postalCode: 'H3A 1A1',
  parkingSpaces: 0, // Zero values allowed
  storageSpaces: 0
};

// Role-based permissions
const adminPerms = checkAccessPermissions('admin');
// admin: view ✅, create ✅, edit ✅, delete ✅
// manager: view ✅, create ❌, edit ✅, delete ❌
// tenant/resident: all ❌

// Search functionality
searchBuildings(buildings, 'Maple'); // By name
searchBuildings(buildings, 'Sainte-Catherine'); // By address
searchBuildings(buildings, 'René-Lévesque'); // Special characters
```

### 2. Integration Tests (`tests/integration/buildings-validation.test.ts`)

**Purpose**: Test server-side validation and API contract compliance

**Coverage**:
- ✅ Required field validation (name, organizationId)
- ✅ String length limits (name: 200, address: 300, city: 100)
- ✅ Numeric range validation (yearBuilt: 1800-2030, units: 0-10000)
- ✅ Enum validation (province, buildingType)
- ✅ Pattern validation (Canadian postal codes)
- ✅ UUID validation (organizationId format)
- ✅ Quebec-specific postal code patterns
- ✅ French character support
- ✅ Security considerations (injection prevention)

**Validation Rules**:
```javascript
const buildingValidationRules = {
  name: { required: true, minLength: 1, maxLength: 200 },
  organizationId: { required: true, format: 'uuid' },
  postalCode: { pattern: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/ },
  yearBuilt: { type: 'integer', min: 1800, max: currentYear + 5 },
  totalUnits: { type: 'integer', min: 0, max: 10000 },
  totalFloors: { type: 'integer', min: 1, max: 200 },
  parkingSpaces: { type: 'integer', min: 0, max: 50000 },
  storageSpaces: { type: 'integer', min: 0, max: 50000 }
};
```

### 3. End-to-End Tests (`tests/e2e/buildings-workflow.test.tsx`)

**Purpose**: Test complete user workflows from UI interaction to API response

**Coverage**:
- ✅ Complete building creation workflow (Admin)
- ✅ Building edit workflow with zero value handling
- ✅ Building deletion workflow with confirmation
- ✅ Manager user restrictions (edit allowed, create/delete denied)
- ✅ Real-time search and filtering
- ✅ Error handling with user-friendly messages
- ✅ Loading states during operations
- ✅ Accessibility and keyboard navigation

**User Workflows**:
```javascript
// Admin workflow: Create → Edit → Delete
1. Login as admin
2. Navigate to buildings page
3. Click "Add New Building"
4. Fill form with complete data
5. Submit and verify success
6. Edit building with zero values
7. Delete building with confirmation

// Manager workflow: View and Edit only
1. Login as manager
2. See buildings but no "Add" button
3. Can edit existing buildings
4. Cannot delete buildings
```

### 4. Practical Test Runner (`test-buildings.js`)

**Purpose**: Standalone test runner for core business logic

**Features**:
- ✅ No external dependencies
- ✅ Real-time test execution
- ✅ Clear pass/fail indicators
- ✅ Comprehensive validation testing
- ✅ Quebec-specific feature validation
- ✅ Data integrity checks

**Test Results**:
```
🚀 Starting Buildings Management Tests...

🧪 Testing Building Validation...
✅ Valid building should pass validation
✅ Building with zero values should be valid
✅ Invalid postal code should fail validation

🔍 Testing Building Search...
✅ Should find 1 building by name
✅ Should handle special characters in search

🔐 Testing Role-based Access Control...
✅ Admin should have full access
✅ Manager should have limited access
✅ Tenant/Resident should be denied access

🎉 All tests passed successfully!
```

## Quebec-Specific Features Testing

### Postal Code Validation
```javascript
// Valid Quebec postal codes
['H3A 1A1', 'G1R 2B5', 'J5A 1B2'] // ✅ Pass
['12345', 'ABC123', 'H3A1A'] // ❌ Fail

// Pattern: Letter-Digit-Letter Space Digit-Letter-Digit
const quebecPattern = /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/;
```

### French Character Support
```javascript
// Buildings with French names and addresses
{
  name: 'Résidence Les Érables',
  address: 'Rue de la Cathédrale',
  city: 'Québec',
  managementCompany: 'Gestion Immobilière Québécoise'
}
```

## Role-Based Access Control Testing

### Permission Matrix
| Role | View | Create | Edit | Delete |
|------|------|--------|------|--------|
| Admin | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ❌ | ✅ | ❌ |
| Tenant | ❌ | ❌ | ❌ | ❌ |
| Resident | ❌ | ❌ | ❌ | ❌ |

### Special Access Rules
- **Koveo Organization**: Global access to ALL buildings from ALL organizations
- **Regular Organizations**: Access limited to buildings within same organization
- **Resident/Tenant**: Redirected to access denied page

## Zero Value Handling

### Critical Fix Implemented
```javascript
// Before (incorrect): field.value || ''
// After (correct): field.value ?? ''

// Handles zero values properly:
parkingSpaces: 0 // ✅ Displays as "0"
storageSpaces: 0 // ✅ Displays as "0"

// Form submission logic:
onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
```

## Search Functionality Testing

### Search Capabilities
- **By Name**: "Maple" → finds "Maple Heights"
- **By Address**: "Sainte-Catherine" → finds buildings on that street
- **By City**: "Montreal" → finds buildings in Montreal
- **By Organization**: "Koveo" → finds Koveo-managed buildings
- **Case Insensitive**: "MAPLE" = "maple" = "Maple"
- **Special Characters**: "René-Lévesque" works correctly
- **No Results**: "nonexistent" → shows "No buildings found"

## Error Handling and Edge Cases

### Form Validation Errors
- Missing required fields show specific error messages
- Invalid data types are caught and reported
- Malformed input is handled gracefully

### API Error Handling
- Network failures show user-friendly messages
- Validation errors are displayed in context
- Loading states prevent multiple submissions

### Security Considerations
- Input sanitization prevents injection attacks
- Role-based access is enforced server-side
- UUID validation prevents unauthorized access

## Performance Considerations

### Database Query Optimization
- Indexed searches on name, address, city
- Organization-based filtering
- Active building filtering (is_active = true)

### Frontend Optimization
- Real-time search with debouncing
- Lazy loading for large building lists
- Efficient re-rendering with React Query

## Test Execution

### Running Individual Test Suites
```bash
# Unit tests
npm test tests/unit/buildings-basic.test.tsx

# Integration tests  
npm test tests/integration/buildings-validation.test.ts

# E2E tests
npm test tests/e2e/buildings-workflow.test.tsx

# Practical test runner
node test-buildings.js
```

### Coverage Requirements
- **Unit Tests**: 80% code coverage minimum
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: Critical user workflows covered
- **Validation Tests**: All business rules covered

## Maintenance and Updates

### When to Update Tests
- New building fields added
- Validation rules changed
- New user roles introduced
- Quebec regulations updated
- UI components modified

### Test Quality Metrics
- ✅ All tests pass consistently
- ✅ Clear test descriptions and assertions
- ✅ Comprehensive edge case coverage
- ✅ Quebec-specific requirements validated
- ✅ Role-based access thoroughly tested
- ✅ Zero value handling verified
- ✅ Error scenarios properly handled

## Conclusion

The Buildings Management test suite provides comprehensive coverage of all critical functionality:

1. **Validation**: Ensures data integrity and business rule compliance
2. **Search**: Confirms real-time filtering works across all relevant fields
3. **Security**: Validates role-based access control and input sanitization
4. **Quebec Compliance**: Tests French character support and postal code validation
5. **User Experience**: Verifies complete workflows from UI to database
6. **Edge Cases**: Handles zero values, empty inputs, and error conditions

This testing framework ensures the Buildings Management system is robust, secure, and ready for production use in Quebec's property management industry.