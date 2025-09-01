#!/bin/bash

# Safe production hotfix deployment script
# This deploys code changes without database migrations to avoid data loss

set -e

echo "🚀 Starting safe production hotfix deployment..."
echo "⚠️  This deployment will NOT run database migrations to prevent data loss"

# Build the application
echo "📦 Building application..."
npm run build:server
npm run build:client

echo "✅ Build completed successfully"

# Verify build artifacts exist
if [ ! -f "dist/server/index.js" ]; then
    echo "❌ Server build failed - missing dist/server/index.js"
    exit 1
fi

if [ ! -d "dist/public" ]; then
    echo "❌ Client build failed - missing dist/public directory"
    exit 1
fi

echo "✅ Build artifacts verified"

echo "🚀 Safe hotfix deployment ready!"
echo "📋 Deployment includes:"
echo "   ✓ Fixed document upload functionality"
echo "   ✓ Simplified storage implementation (removed broken OptimizedDatabaseStorage)"
echo "   ✓ Schema now matches production database"
echo "   ✓ No database migrations (safe for production)"

echo ""
echo "📝 To deploy to production:"
echo "   1. Upload the dist/ folder to your production server"
echo "   2. Restart your production server process"
echo "   3. Your document upload issue should be resolved"

echo ""
echo "⚠️  IMPORTANT: This fix avoids database changes to prevent data loss"
echo "   Your production database structure is preserved exactly as-is"