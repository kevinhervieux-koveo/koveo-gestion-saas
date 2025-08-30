# Document Management Manual Test Script

## Demo Users Test Scenarios

### 🧑‍💼 **Demo Manager User**

- **Email**: manager@demo.com
- **Role**: Manager
- **Access**: Full CRUD operations on all documents

### 🏠 **Demo Tenant User**

- **Email**: tenant@demo.com
- **Role**: Tenant
- **Access**: View-only for approved documents

---

## Test Scenarios

### 1. **Manager Building Documents** (`/manager/buildings`)

#### ✅ Test: Create New Building Document

1. Navigate to Building Documents page as manager
2. Click "Add Document" button
3. Fill form:
   - Name: "Updated Building Policy 2024"
   - Type: "Policies"
   - Description: "New building rules and regulations"
   - Check "Visible to tenants"
4. Upload a simple text file (optional)
5. Submit form
6. ✅ **Expected**: Document created successfully with toast notification

#### ✅ Test: Edit Existing Document

1. Find existing document card
2. Click Edit button (pencil icon)
3. Modify name to "Updated Policy Name"
4. Uncheck "Visible to tenants"
5. Submit changes
6. ✅ **Expected**: Document updated with new name and visibility settings

#### ✅ Test: Delete Document

1. Find document to delete
2. Click Delete button (trash icon)
3. Confirm deletion in popup
4. ✅ **Expected**: Document removed from list with success message

#### ✅ Test: View/Download Document

1. Find document with attached file
2. Click "View" button
3. ✅ **Expected**: File opens in new tab or downloads

---

### 2. **Manager Residence Documents** (`/manager/residences`)

#### ✅ Test: Create Residence-Specific Document

1. Navigate to specific residence documents page
2. Click "Add Document"
3. Fill form:
   - Name: "Unit 101 Lease Agreement"
   - Type: "Lease"
   - Check "Visible to tenants"
4. Submit form
5. ✅ **Expected**: Document created for specific residence

#### ✅ Test: View Building Context

1. Check page displays:
   - Unit number (e.g., "Unit 101")
   - Building name
   - Address
   - Unit details (bedrooms, bathrooms, sq ft)
2. ✅ **Expected**: All contextual information visible

---

### 3. **Tenant Building Documents** (`/residents/building`)

#### ✅ Test: View Only Tenant-Visible Documents

1. Navigate as tenant user
2. Check document list
3. ✅ **Expected**: Only documents marked "Visible to tenants" appear
4. ✅ **Expected**: No "Add Document" button visible
5. ✅ **Expected**: No edit/delete buttons on documents

#### ✅ Test: Search and Filter

1. Use search box to find specific document
2. Use category filter dropdown
3. ✅ **Expected**: Results filter correctly

#### ✅ Test: Download Allowed Documents

1. Click "View Document" on available document
2. ✅ **Expected**: File opens/downloads successfully

---

### 4. **Tenant Residence Documents** (`/residents/residence`)

#### ✅ Test: Residence-Specific Viewing

1. Navigate to residence documents as tenant
2. Check document list shows only:
   - Documents for current residence
   - Documents marked as tenant-visible
3. ✅ **Expected**: Proper filtering applied

#### ✅ Test: No Upload Capability

1. Verify no "Add Document" button
2. Verify no edit/delete options
3. ✅ **Expected**: Read-only interface for tenants

---

## Permission Testing

### ✅ Role-Based Access Control

1. **As Manager**: Can see all documents (visible + hidden)
2. **As Tenant**: Can only see documents marked "Visible to tenants"
3. **Create/Edit/Delete**: Only available to managers
4. **View/Download**: Available to both roles (for their allowed documents)

---

## Error Handling Tests

### ✅ Test: Form Validation

1. Try to submit empty form
2. ✅ **Expected**: Required field validation prevents submission

### ✅ Test: Missing Residence ID

1. Navigate to residence documents without valid ID
2. ✅ **Expected**: Shows "Residence ID Required" message

### ✅ Test: Network Error Handling

1. Simulate network failure during document creation
2. ✅ **Expected**: Error toast message appears, form state preserved

---

## Quick Verification Checklist

- [ ] All 4 pages load without errors
- [ ] Manager sees full CRUD controls
- [ ] Tenant sees read-only interface
- [ ] Document categories work properly
- [ ] File upload/download functions
- [ ] Search and filtering work
- [ ] Role permissions enforced correctly
- [ ] Error messages display appropriately
- [ ] Navigation between pages works
- [ ] Context information displays correctly

---

## Demo Data Used

**Buildings**: Demo Building (123 Test Street, Demo City, QC)
**Residences**: Unit 101, 102 (2BR/1BA, 850 sq ft)
**Document Types**: Policies, Financial, Legal, Maintenance, Lease, Inspection
**Files**: PDF, DOC, TXT formats supported
