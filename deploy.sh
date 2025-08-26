#!/bin/bash

echo "🚀 Preparing deployment for Koveo Gestion..."

# Run build
echo "📦 Building application..."
npm run build

# Run post-build setup
echo "🔧 Running post-build setup..."
bash scripts/post-build.sh

# Verify deployment readiness
echo "✅ Verifying deployment files..."
if [ -f "server/index.js" ] && [ -f "server/public/index.html" ]; then
    echo "✅ All deployment files ready"
    echo "📊 Server build: $(du -h server/index.js | cut -f1)"
    echo "📊 Frontend assets: $(ls -1 server/public/assets | wc -l) files"
    echo "🚀 Ready for deployment!"
else
    echo "❌ Deployment files missing"
    exit 1
fi