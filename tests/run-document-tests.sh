#!/bin/bash

# Script to run document management tests specifically
echo "🚀 Running Document Management Tests with Demo Users"
echo "=================================================="

# Run the specific test file
npx jest tests/integration/document-management-comprehensive.test.tsx --verbose --no-cache

echo ""
echo "✅ Document Management Tests Complete!"
echo ""
echo "📋 Test Coverage Summary:"
echo "• Tenant viewing permissions (view-only access)"
echo "• Manager full CRUD operations (create/read/update/delete)"
echo "• File upload and download functionality"
echo "• Role-based permission enforcement"
echo "• Document categorization and filtering"
echo "• Error handling and validation"
echo "• All 4 document pages:"
echo "  - /residents/residence (Tenants)"
echo "  - /residents/building (Tenants)" 
echo "  - /manager/buildings (Managers)"
echo "  - /manager/residences (Managers)"