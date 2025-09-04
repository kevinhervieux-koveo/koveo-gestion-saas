#!/bin/bash

# Database Synchronization Script
# Usage: ./sync-db.sh [push|verify|execute "SQL" "description"]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check environment variables
if [ -z "$DATABASE_URL" ] || [ -z "$DATABASE_URL_KOVEO" ]; then
    echo -e "${RED}❌ Missing database environment variables${NC}"
    echo "Required: DATABASE_URL and DATABASE_URL_KOVEO"
    exit 1
fi

echo -e "${BLUE}🔄 Starting database synchronization...${NC}"

# Function to execute SQL on both databases
execute_dual_query() {
    local sql="$1"
    local description="$2"
    
    echo -e "\n${YELLOW}📝 ${description}${NC}"
    
    echo -e "  ${BLUE}→ Development database...${NC}"
    if psql "$DATABASE_URL" -c "$sql" > /dev/null 2>&1; then
        echo -e "    ${GREEN}✓ Development: Success${NC}"
    else
        echo -e "    ${RED}❌ Development: Failed${NC}"
        exit 1
    fi
    
    echo -e "  ${BLUE}→ Production database...${NC}"
    if psql "$DATABASE_URL_KOVEO" -c "$sql" > /dev/null 2>&1; then
        echo -e "    ${GREEN}✓ Production: Success${NC}"
    else
        echo -e "    ${RED}❌ Production: Failed${NC}"
        exit 1
    fi
    
    echo -e "  ${GREEN}✅ ${description} completed on both databases${NC}"
}

# Function to push Drizzle schema
push_drizzle_schema() {
    echo -e "\n${BLUE}🚀 Pushing Drizzle schema changes...${NC}"
    
    echo -e "  ${BLUE}→ Pushing to development database...${NC}"
    if npm run db:push > /dev/null 2>&1; then
        echo -e "    ${GREEN}✓ Development schema updated${NC}"
    else
        echo -e "    ${RED}❌ Development schema push failed${NC}"
        exit 1
    fi
    
    echo -e "  ${BLUE}→ Pushing to production database...${NC}"
    if DATABASE_URL="$DATABASE_URL_KOVEO" npm run db:push > /dev/null 2>&1; then
        echo -e "    ${GREEN}✓ Production schema updated${NC}"
    else
        echo -e "    ${RED}❌ Production schema push failed${NC}"
        exit 1
    fi
    
    echo -e "  ${GREEN}✅ Schema synchronization completed${NC}"
}

# Function to verify schema sync
verify_schema_sync() {
    echo -e "\n${BLUE}🔍 Verifying schema synchronization...${NC}"
    
    local check_query="SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;"
    
    local dev_result=$(psql "$DATABASE_URL" -t -c "$check_query" 2>/dev/null)
    local prod_result=$(psql "$DATABASE_URL_KOVEO" -t -c "$check_query" 2>/dev/null)
    
    if [ "$dev_result" = "$prod_result" ]; then
        echo -e "  ${GREEN}✅ Schemas are synchronized${NC}"
        return 0
    else
        echo -e "  ${RED}❌ Schema mismatch detected${NC}"
        return 1
    fi
}

# Main script logic
case "$1" in
    "push")
        push_drizzle_schema
        verify_schema_sync
        ;;
    "verify")
        verify_schema_sync
        ;;
    "execute")
        if [ -z "$2" ]; then
            echo -e "${RED}❌ SQL command required${NC}"
            echo "Usage: ./sync-db.sh execute \"SQL_COMMAND\" \"description\""
            exit 1
        fi
        execute_dual_query "$2" "${3:-Custom SQL execution}"
        ;;
    *)
        echo -e "${BLUE}🔧 Database Synchronization Tool${NC}"
        echo ""
        echo "Commands:"
        echo "  push    - Push Drizzle schema to both databases"
        echo "  verify  - Verify schemas are synchronized"
        echo "  execute - Execute SQL on both databases"
        echo ""
        echo "Examples:"
        echo "  ./sync-db.sh push"
        echo "  ./sync-db.sh verify"
        echo "  ./sync-db.sh execute \"ALTER TABLE...\" \"Add constraint\""
        exit 0
        ;;
esac

echo -e "\n${GREEN}✅ Database synchronization completed successfully${NC}"