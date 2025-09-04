#!/bin/bash

# One-line database status check
# Usage: ./db-status.sh

echo "🔍 Database Sync Status:"
if ./sync-test.sh quick > /dev/null 2>&1; then
    echo "✅ Databases are synchronized"
else
    echo "❌ Sync issues detected - run './sync-test.sh' for details"
fi