-- =====================================================================
-- PRODUCTION FIX: Update Enum Values Before Payment Generation
-- =====================================================================
-- Purpose: Fix enum values that are missing in production
-- Run this FIRST before running any other production scripts
-- =====================================================================

-- Check current enum values
SELECT 'CURRENT payment_type enum values:' as info;
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_type') 
ORDER BY enumlabel;

-- Fix payment_type enum - add missing values if they don't exist
DO $$
BEGIN
    -- Add 'auto-generated' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_type') 
        AND enumlabel = 'auto-generated'
    ) THEN
        ALTER TYPE payment_type ADD VALUE 'auto-generated';
        RAISE NOTICE 'Added auto-generated value to payment_type enum';
    ELSE
        RAISE NOTICE 'auto-generated value already exists in payment_type enum';
    END IF;
    
    -- Verify other required values exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_type') 
        AND enumlabel = 'unique'
    ) THEN
        ALTER TYPE payment_type ADD VALUE 'unique';
        RAISE NOTICE 'Added unique value to payment_type enum';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_type') 
        AND enumlabel = 'recurrent'
    ) THEN
        ALTER TYPE payment_type ADD VALUE 'recurrent';
        RAISE NOTICE 'Added recurrent value to payment_type enum';
    END IF;
END $$;

-- Verify the fix
SELECT 'UPDATED payment_type enum values:' as info;
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_type') 
ORDER BY enumlabel;

-- Check how many bills use each payment type
SELECT 'Bill counts by payment_type:' as info;
SELECT payment_type, COUNT(*) as bill_count 
FROM bills 
GROUP BY payment_type 
ORDER BY bill_count DESC;

SELECT 'Enum fix completed successfully!' as result;