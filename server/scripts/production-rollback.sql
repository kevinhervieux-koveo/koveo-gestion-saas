-- =====================================================================
-- PRODUCTION ROLLBACK SCRIPT
-- =====================================================================
-- Purpose: Rollback payment generation changes if needed
-- DANGER: This will remove payment data - use carefully
-- 
-- Use this script if you need to undo the payment generation changes
-- =====================================================================

-- Check current state before rollback
SELECT 'PRE-ROLLBACK STATUS:' as info;
SELECT 
    (SELECT COUNT(*) FROM bills) as total_bills,
    (SELECT COUNT(*) FROM payments) as total_payments,
    (SELECT COUNT(*) FROM bills b LEFT JOIN payments p ON b.id = p.bill_id WHERE p.id IS NULL) as bills_without_payments;

-- Option 1: Remove all payments created after a specific timestamp
-- UNCOMMENT and MODIFY the timestamp below to match when you ran the payment generation
/*
DELETE FROM payments 
WHERE created_at > '2025-09-16 00:00:00'::timestamp;
*/

-- Option 2: Remove ALL payments (DANGEROUS - only if you're sure)
-- UNCOMMENT the line below ONLY if you want to remove ALL payment data
/*
DELETE FROM payments;
*/

-- Option 3: Remove payments for specific bills (safer approach)
-- UNCOMMENT and MODIFY to target specific bills if needed
/*
DELETE FROM payments 
WHERE bill_id IN (
    -- Add specific bill IDs here
    'bill-id-1',
    'bill-id-2'
);
*/

-- Verification after rollback
SELECT 'POST-ROLLBACK STATUS:' as info;
SELECT 
    (SELECT COUNT(*) FROM bills) as total_bills,
    (SELECT COUNT(*) FROM payments) as total_payments,
    (SELECT COUNT(*) FROM bills b LEFT JOIN payments p ON b.id = p.bill_id WHERE p.id IS NULL) as bills_without_payments;

-- Show which bills no longer have payments
SELECT 'BILLS WITHOUT PAYMENTS AFTER ROLLBACK:' as info;
SELECT b.id, b.title, b.payment_type, b.total_amount
FROM bills b
LEFT JOIN payments p ON b.id = p.bill_id
WHERE p.id IS NULL
ORDER BY b.created_at
LIMIT 20;