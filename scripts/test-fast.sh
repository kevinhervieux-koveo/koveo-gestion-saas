#!/bin/bash
# Fast test execution script
# Optimized for quick feedback during development

echo "🚀 Running fast unit tests..."

# Set environment for fast execution
export TEST_TYPE=unit
export USE_MOCK_DB=true
export DISABLE_LOGS=true

# Run unit tests with maximum performance
npx jest tests/unit/ \
  --passWithNoTests=false \
  --maxWorkers=75% \
  --cache \
  --forceExit \
  --silent \
  --testTimeout=10000 \
  --bail=5

echo "✅ Fast tests completed"