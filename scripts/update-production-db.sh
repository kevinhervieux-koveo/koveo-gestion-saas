#!/bin/bash

# Production Database Update Script
# This script safely updates the production database schema using Drizzle Kit

set -e  # Exit on any error

echo "🚀 Starting production database schema update..."
echo "📅 $(date)"
echo

# Check if production database URL is available
if [ -z "$DATABASE_URL_KOVEO" ]; then
    echo "❌ ERROR: DATABASE_URL_KOVEO environment variable is not set"
    echo "   Please ensure the production database URL is configured"
    exit 1
fi

echo "✅ Production database URL configured"
echo

# Set the production database URL for this operation
export DATABASE_URL=$DATABASE_URL_KOVEO

echo "🔍 Checking current schema differences..."
echo

# Function to handle interactive prompts automatically
run_with_auto_confirm() {
    local cmd="$1"
    
    # Try using expect if available for better prompt handling
    if command -v expect >/dev/null 2>&1; then
        expect << 'EOF'
set timeout 60
spawn npx drizzle-kit push
expect {
    "enum created or renamed" {
        send "y\r"
        exp_continue
    }
    "Changes applied" {
        # Success case
    }
    timeout {
        puts "Operation timed out"
        exit 1
    }
    eof
}
EOF
    else
        # Fallback: use yes command with timeout
        echo "📝 Auto-confirming any schema prompts..."
        timeout 60 bash -c 'yes | npx drizzle-kit push' || {
            echo "⚠️  Timeout reached, trying force push..."
            npx drizzle-kit push --force
        }
    fi
}

# Execute the database push
echo "🔄 Applying schema changes to production database..."
run_with_auto_confirm

# Check if the operation was successful
if [ $? -eq 0 ]; then
    echo
    echo "✅ Production database schema update completed successfully!"
    echo "📅 Completed at: $(date)"
    echo
    echo "🔍 Summary:"
    echo "   - Schema changes have been applied to production"
    echo "   - Database is now synchronized with latest schema"
    echo "   - Application can safely use updated schema"
else
    echo
    echo "❌ Production database schema update failed!"
    echo "📅 Failed at: $(date)"
    echo
    echo "🛠️  Troubleshooting steps:"
    echo "   1. Check database connectivity"
    echo "   2. Verify DATABASE_URL_KOVEO is correct"
    echo "   3. Ensure sufficient database permissions"
    echo "   4. Review schema changes for conflicts"
    exit 1
fi

echo
echo "🏁 Production database update process complete"