#!/bin/bash

# Post-build script to copy static files to the expected location for production deployment

echo "📦 Post-build: Copying static files..."

# Remove any existing server/public directory
rm -rf server/public

# Copy built files from dist/public to server/public
cp -r dist/public server/

echo "✅ Static files copied to server/public successfully"

# Verify the copy was successful
if [ -f "server/public/index.html" ]; then
    echo "✅ Deployment files ready - index.html found in server/public"
else
    echo "❌ Error: index.html not found in server/public"
    exit 1
fi