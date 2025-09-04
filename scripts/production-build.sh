#!/bin/bash

# Production Build Script for Koveo Gestion
# This script builds both client and server for production deployment

set -e

echo "🚀 Starting production build..."

# Set environment variables to bypass development plugins
export NODE_ENV=production
export REPL_ID=

echo "📦 Building client..."
# Build the client without the problematic cartographer plugin
vite build

echo "🔧 Building server..."
# Build the server using the dedicated build script
npm run build:server

echo "✅ Production build completed successfully!"
echo "📁 Client build: dist/public/"
echo "📁 Server build: dist/index.js"