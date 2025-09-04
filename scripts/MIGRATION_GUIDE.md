# Advanced Database Migration Guide

## Overview

The Advanced Database Migration script provides safe, comprehensive database migration capabilities for both development and production environments with comprehensive safety features.

## Features

- **Schema Analysis**: Detailed comparison between current and expected database schemas
- **Risk Assessment**: Identifies critical column mismatches, constraint issues, and data migration risks
- **Safety Checks**: Manual approval required for dangerous operations
- **Dual Environment Support**: Handles both development and production databases
- **Dry Run Mode**: Analyze without making any changes
- **Automatic Rollback Planning**: Built-in rollback strategies for each operation

## Usage

### Add Migration Command to package.json

Add this line to your scripts section:
```json
"db:migrate-advanced": "npx tsx scripts/advanced-database-migration.ts"
```

### Command Options

```bash
# Full analysis and migration with safety checks
npm run db:migrate-advanced

# Analysis only - no changes made
npm run db:migrate-advanced -- --dry-run

# Development environment only
npm run db:migrate-advanced -- --dev-only

# Force production migration after dev testing
npm run db:migrate-advanced -- --production-force
```

## Migration Process

### 1. Schema Analysis
The script analyzes:
- Missing tables in the database
- Extra tables not in schema
- Column type mismatches (especially critical ID types)
- Foreign key constraint issues
- Data migration risks for populated tables

### 2. Migration Planning
Creates a comprehensive plan with:
- **Phase 1**: Schema structure updates
- **Phase 2**: Data migration (if needed)
- **Phase 3**: Constraint validation
- Estimated duration and risk assessment
- Required manual steps

### 3. Safety Features
- **Manual Approval**: Required for risky/dangerous operations
- **Environment Isolation**: Can test on dev before production
- **Rollback Planning**: Each operation includes rollback strategy
- **Data Preservation**: Backup strategies for tables with data

## Critical Safety Rules

⚠️ **NEVER change primary key ID column types** - This breaks existing data and causes migration failures.

### Safe Migration Practices

1. **Always run dry-run first**: `npm run db:migrate-advanced -- --dry-run`
2. **Test on development first**: `npm run db:migrate-advanced -- --dev-only`
3. **Review migration plan carefully**: Check all risks and manual steps
4. **Coordinate production downtime**: Plan for potential application downtime
5. **Have rollback plan ready**: Ensure you can revert changes if needed

## Example Output

```
🔧 Advanced Database Migration Tool for Koveo Gestion

🔍 Running in DRY RUN mode - no changes will be made

✔ Database connections initialized (2 environments)
✔ Schema analysis completed for Development

📊 Analysis Results for Development:
   ✅ Schema is in sync

✔ Schema analysis completed for Production

📊 Analysis Results for Production:

🔧 Column Mismatches (8):
   • users.id: uuid → character varying [critical]
   • organizations.id: uuid → character varying [critical]
   • buildings.id: uuid → character varying [critical]

📋 Migration Plan:

1. Schema Structure Update
   Update database schema to match current definitions
   Operations: 1
   ⚠️ 1 dangerous operations

⏱️ Estimated Duration: 15-30 minutes

⚠️ Risks:
   • Critical ID type mismatch in users.id
   • Critical ID type mismatch in organizations.id

📝 Manual Steps Required:
   • Verify application functionality after each phase
   • Monitor database performance during migration
   • Have rollback plan ready for production
   • Coordinate with team for production downtime window
```

## Environment Variables

The script requires these environment variables:
- `DATABASE_URL`: Development database connection
- `DATABASE_URL_KOVEO`: Production database connection (optional for dev-only)

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify environment variables are set
   - Check database credentials and network access

2. **Schema Analysis Failed**
   - Ensure database is accessible
   - Check if tables exist in public schema

3. **Migration Failed**
   - Review error messages carefully
   - Consider running with `--dev-only` first
   - Verify all prerequisites are met

### Recovery Steps

If a migration fails:
1. Check the error message for specific issues
2. Use the provided rollback SQL if available
3. Restore from backup if necessary
4. Contact the development team for complex issues

## Best Practices

1. **Always backup before production migrations**
2. **Test thoroughly in development environment**
3. **Plan for downtime during production migrations**
4. **Monitor application after migration**
5. **Keep migration logs for troubleshooting**

## Security Considerations

- Database credentials are handled securely via environment variables
- No sensitive data is logged or exposed
- All operations require explicit approval for safety
- Production database access is controlled and audited

## Support

For issues with the migration script:
1. Check this guide first
2. Review the migration logs
3. Test in development environment
4. Contact the development team with specific error messages