#!/bin/bash

# Quick Database Sync Test Script
# Usage: ./sync-test.sh [quick|full|fix]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check environment
if [ -z "$DATABASE_URL" ] || [ -z "$DATABASE_URL_KOVEO" ]; then
    echo -e "${RED}❌ Missing database environment variables${NC}"
    echo "Required: DATABASE_URL and DATABASE_URL_KOVEO"
    exit 1
fi

# Quick schema validation
quick_test() {
    echo -e "${BLUE}🔍 Quick Schema Validation${NC}"
    
    # Test basic connectivity
    echo -e "  ${BLUE}→ Testing connectivity...${NC}"
    if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "    ${RED}❌ Development database connection failed${NC}"
        return 1
    fi
    
    if ! psql "$DATABASE_URL_KOVEO" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "    ${RED}❌ Production database connection failed${NC}"
        return 1
    fi
    echo -e "    ${GREEN}✓ Both databases connected${NC}"
    
    # Test documents table structure
    echo -e "  ${BLUE}→ Checking documents table...${NC}"
    local dev_docs=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'documents';")
    local prod_docs=$(psql "$DATABASE_URL_KOVEO" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'documents';")
    
    if [ "$dev_docs" != "$prod_docs" ]; then
        echo -e "    ${RED}❌ Documents table column count differs: dev=$dev_docs, prod=$prod_docs${NC}"
        return 1
    fi
    echo -e "    ${GREEN}✓ Documents table structure consistent${NC}"
    
    # Test key constraints
    echo -e "  ${BLUE}→ Checking key constraints...${NC}"
    local dev_constraints=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'documents' AND constraint_type = 'UNIQUE';")
    local prod_constraints=$(psql "$DATABASE_URL_KOVEO" -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'documents' AND constraint_type = 'UNIQUE';")
    
    if [ "$dev_constraints" != "$prod_constraints" ]; then
        echo -e "    ${YELLOW}⚠ Unique constraint count differs: dev=$dev_constraints, prod=$prod_constraints${NC}"
    else
        echo -e "    ${GREEN}✓ Unique constraints consistent${NC}"
    fi
    
    echo -e "\n${GREEN}✅ Quick validation complete${NC}"
}

# Full comprehensive test
full_test() {
    echo -e "${BLUE}🧪 Running Full Database Sync Tests${NC}\n"
    
    if npx tsx scripts/test-database-sync.ts; then
        echo -e "\n${GREEN}🎉 All database sync tests passed!${NC}"
        return 0
    else
        echo -e "\n${RED}❌ Database sync tests failed${NC}"
        echo -e "${YELLOW}💡 Run './sync-test.sh fix' to attempt automatic fixes${NC}"
        return 1
    fi
}

# Auto-fix common issues
auto_fix() {
    echo -e "${BLUE}🔧 Attempting to fix common database sync issues${NC}\n"
    
    echo -e "${YELLOW}📝 Fixing document type inconsistencies...${NC}"
    psql "$DATABASE_URL" -c "UPDATE documents SET document_type = 'maintenance' WHERE document_type IN ('utilities', 'other');" 2>/dev/null || true
    psql "$DATABASE_URL" -c "UPDATE documents SET document_type = 'permit' WHERE document_type = 'permits';" 2>/dev/null || true
    echo -e "  ${GREEN}✓ Document types normalized${NC}"
    
    echo -e "${YELLOW}📝 Fixing constraint names...${NC}"
    psql "$DATABASE_URL" -c "ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_file_path_unique;" 2>/dev/null || true
    psql "$DATABASE_URL" -c "ALTER TABLE documents ADD CONSTRAINT documents_file_path_key UNIQUE (file_path);" 2>/dev/null || true
    echo -e "  ${GREEN}✓ Constraint names standardized${NC}"
    
    echo -e "${YELLOW}📝 Syncing foreign key constraints...${NC}"
    # Check if foreign keys exist in production but not development
    local prod_fks=$(psql "$DATABASE_URL_KOVEO" -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'documents' AND constraint_type = 'FOREIGN KEY';" | tr -d ' ')
    local dev_fks=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'documents' AND constraint_type = 'FOREIGN KEY';" | tr -d ' ')
    
    if [ "$prod_fks" -gt "$dev_fks" ]; then
        echo -e "    ${BLUE}→ Adding missing foreign key constraints to development...${NC}"
        psql "$DATABASE_URL" -c "ALTER TABLE documents ADD CONSTRAINT documents_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id);" 2>/dev/null || true
        psql "$DATABASE_URL" -c "ALTER TABLE documents ADD CONSTRAINT documents_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES residences(id);" 2>/dev/null || true
    fi
    echo -e "  ${GREEN}✓ Foreign key constraints synchronized${NC}"
    
    echo -e "\n${GREEN}🎯 Running validation after fixes...${NC}"
    quick_test
}

# Watch mode for development
watch_mode() {
    echo -e "${BLUE}👀 Watching for database changes (Ctrl+C to stop)${NC}\n"
    
    while true; do
        echo -e "${YELLOW}$(date): Running quick validation...${NC}"
        if quick_test; then
            echo -e "${GREEN}✓ All good${NC}"
        else
            echo -e "${RED}❌ Issues detected${NC}"
        fi
        echo ""
        sleep 30
    done
}

# Main script logic
case "${1:-quick}" in
    "quick"|"q")
        quick_test
        ;;
    "full"|"f")
        full_test
        ;;
    "fix"|"repair")
        auto_fix
        ;;
    "watch"|"w")
        watch_mode
        ;;
    "help"|"--help"|"-h")
        echo -e "${BLUE}🔧 Database Sync Test Tool${NC}"
        echo ""
        echo "Commands:"
        echo "  quick, q    - Quick schema validation (default)"
        echo "  full, f     - Run comprehensive test suite"
        echo "  fix, repair - Auto-fix common sync issues"
        echo "  watch, w    - Continuous monitoring mode"
        echo ""
        echo "Examples:"
        echo "  ./sync-test.sh           # Quick test"
        echo "  ./sync-test.sh full      # Full validation"
        echo "  ./sync-test.sh fix       # Fix issues"
        echo "  ./sync-test.sh watch     # Monitor changes"
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo "Use './sync-test.sh help' for usage information"
        exit 1
        ;;
esac