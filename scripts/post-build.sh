#!/bin/bash

# Post-build script to prepare for deployment
echo "🔧 Running post-build setup..."

# Copy the server build to the location expected by start script
echo "📦 Copying server build..."
cp dist/index.js server/index.js

# Verify the copy worked
if [ -f "server/index.js" ]; then
    echo "✅ Server build copied successfully"
    echo "📊 Server build size: $(du -h server/index.js | cut -f1)"
else
    echo "❌ Failed to copy server build"
    exit 1
fi

# Remove any existing server/public directory
rm -rf server/public

# Copy built files from dist/public to server/public
cp -r dist/public server/

echo "✅ Static files copied to server/public successfully"

# Verify the copy was successful
if [ -f "server/public/index.html" ]; then
    echo "✅ Frontend build verified"
    echo "📊 Frontend assets: $(ls -1 dist/public/assets | wc -l) files"
else
    echo "❌ Error: index.html not found in server/public"
    exit 1
fi

echo "🚀 Post-build setup complete - ready for deployment!"