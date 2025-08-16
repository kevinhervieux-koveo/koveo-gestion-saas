#!/bin/bash
# Route validation script for Koveo Gestion
# Run this script to validate that removed routes are not present in the build

echo "🔍 Running route validation for Koveo Gestion..."
echo ""

# Run the TypeScript validation script
tsx scripts/validate-routes.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Route validation completed successfully!"
else
    echo ""
    echo "❌ Route validation failed. Please fix the issues and try again."
    exit 1
fi