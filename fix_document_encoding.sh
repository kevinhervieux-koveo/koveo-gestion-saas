#!/bin/bash

# Function to fix encoding in a single file
fix_file_encoding() {
    local file="$1"
    if [[ -f "$file" ]]; then
        # Replace Unicode warning symbols and borders with ASCII equivalents
        sed -i 's/⚠️/\*\*\*/g; s/═══════════════════════════════════════════════════════════/===============================================================/g' "$file" 2>/dev/null
        
        # Verify the file was changed
        if grep -q "\*\*\* DEMO NOTICE" "$file" 2>/dev/null; then
            echo "✅ Fixed: $(basename "$file")"
            return 0
        else
            echo "❌ Failed to fix: $(basename "$file")"
            return 1
        fi
    fi
    return 1
}

echo "Fixing document encoding issues..."

# Fix all text files in uploads directory
fixed=0
total=0

# Process all .txt files in uploads directory
find uploads -name "*.txt" -type f | while read file; do
    total=$((total + 1))
    
    # Check if file contains the problematic Unicode characters
    if grep -q "⚠️\|═══" "$file" 2>/dev/null; then
        if fix_file_encoding "$file"; then
            fixed=$((fixed + 1))
        fi
    fi
    
    # Report progress every 50 files
    if ((total % 50 == 0)); then
        echo "Processed $total files..."
    fi
done

echo "✅ Document encoding fix completed!"
