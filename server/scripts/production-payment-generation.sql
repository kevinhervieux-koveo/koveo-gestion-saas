-- =====================================================================
-- PRODUCTION DATABASE UPDATE: Generate Payment Structures for Bills
-- =====================================================================
-- 
-- IMPORTANT: This script should be run on the PRODUCTION database by a
-- database administrator. It cannot be executed through Replit Agent tools.
--
-- Purpose: Generate payment records for all bills that don't have payment structures
-- 
-- Prerequisites:
-- 1. Backup the production database before running this script
-- 2. Test this script on a staging environment first
-- 3. Run during low-traffic hours
-- 4. Monitor the execution and be ready to rollback if needed
--
-- Estimated execution time: Depends on number of bills (could take several minutes)
-- =====================================================================

-- Step 1: Create a temporary function to generate payments for a single bill
CREATE OR REPLACE FUNCTION generate_payments_for_bill(bill_id_param varchar)
RETURNS INTEGER AS $$
DECLARE
    bill_record RECORD;
    payment_count INTEGER := 0;
    current_date_val DATE;
    payment_num INTEGER;
    max_payments INTEGER := 12;
    payment_amount DECIMAL(12,2);
    custom_date_str TEXT;
BEGIN
    -- Get the bill details
    SELECT * INTO bill_record FROM bills WHERE id = bill_id_param;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Bill % not found', bill_id_param;
        RETURN 0;
    END IF;
    
    -- Generate payments based on payment type
    CASE bill_record.payment_type
        WHEN 'unique' THEN
            -- Single payment for unique bills
            INSERT INTO payments (
                bill_id, 
                payment_number, 
                scheduled_date, 
                amount, 
                status
            ) VALUES (
                bill_id_param,
                1,
                bill_record.start_date,
                bill_record.total_amount,
                'pending'
            );
            payment_count := 1;
            
        WHEN 'recurrent', 'auto-generated' THEN
            -- Multiple payments for recurrent bills
            current_date_val := bill_record.start_date;
            payment_num := 1;
            
            IF bill_record.schedule_payment = 'custom' AND bill_record.schedule_custom IS NOT NULL THEN
                -- Custom schedule - create payment for each custom date
                FOR custom_date_str IN SELECT unnest(bill_record.schedule_custom)
                LOOP
                    payment_amount := CASE 
                        WHEN array_length(bill_record.costs, 1) >= payment_num THEN 
                            bill_record.costs[payment_num]
                        ELSE 
                            bill_record.total_amount / array_length(bill_record.schedule_custom, 1)
                    END;
                    
                    INSERT INTO payments (
                        bill_id, 
                        payment_number, 
                        scheduled_date, 
                        amount, 
                        status
                    ) VALUES (
                        bill_id_param,
                        payment_num,
                        custom_date_str::DATE,
                        payment_amount,
                        'pending'
                    );
                    
                    payment_num := payment_num + 1;
                    payment_count := payment_count + 1;
                END LOOP;
            ELSE
                -- Standard schedule (weekly, monthly, quarterly, yearly)
                WHILE payment_num <= max_payments AND 
                      (bill_record.end_date IS NULL OR current_date_val <= bill_record.end_date)
                LOOP
                    payment_amount := CASE 
                        WHEN array_length(bill_record.costs, 1) >= payment_num THEN 
                            bill_record.costs[payment_num]
                        ELSE 
                            bill_record.total_amount / max_payments
                    END;
                    
                    INSERT INTO payments (
                        bill_id, 
                        payment_number, 
                        scheduled_date, 
                        amount, 
                        status
                    ) VALUES (
                        bill_id_param,
                        payment_num,
                        current_date_val,
                        payment_amount,
                        'pending'
                    );
                    
                    -- Calculate next payment date based on schedule
                    CASE bill_record.schedule_payment
                        WHEN 'weekly' THEN
                            current_date_val := current_date_val + INTERVAL '7 days';
                        WHEN 'monthly' THEN
                            current_date_val := current_date_val + INTERVAL '1 month';
                        WHEN 'quarterly' THEN
                            current_date_val := current_date_val + INTERVAL '3 months';
                        WHEN 'yearly' THEN
                            current_date_val := current_date_val + INTERVAL '1 year';
                        ELSE
                            -- Default to monthly if schedule not specified
                            current_date_val := current_date_val + INTERVAL '1 month';
                    END CASE;
                    
                    payment_num := payment_num + 1;
                    payment_count := payment_count + 1;
                END LOOP;
            END IF;
    END CASE;
    
    RETURN payment_count;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Get count of bills without payments (for reporting)
DO $$
DECLARE
    bills_without_payments INTEGER;
    bills_processed INTEGER := 0;
    payments_created INTEGER := 0;
    bill_record RECORD;
    payments_for_bill INTEGER;
BEGIN
    -- Count bills without payments
    SELECT COUNT(*) INTO bills_without_payments 
    FROM bills b
    LEFT JOIN payments p ON b.id = p.bill_id
    WHERE p.id IS NULL;
    
    RAISE NOTICE 'Starting payment generation for % bills without payments...', bills_without_payments;
    
    -- Process each bill without payments
    FOR bill_record IN 
        SELECT b.id, b.title, b.payment_type
        FROM bills b
        LEFT JOIN payments p ON b.id = p.bill_id
        WHERE p.id IS NULL
        ORDER BY b.created_at
    LOOP
        -- Generate payments for this bill
        SELECT generate_payments_for_bill(bill_record.id) INTO payments_for_bill;
        
        bills_processed := bills_processed + 1;
        payments_created := payments_created + payments_for_bill;
        
        -- Log progress every 100 bills
        IF bills_processed % 100 = 0 THEN
            RAISE NOTICE 'Processed % bills, created % payments...', bills_processed, payments_created;
        END IF;
        
        -- Optional: Add a small delay to avoid overwhelming the database
        -- PERFORM pg_sleep(0.01); -- 10ms delay
    END LOOP;
    
    RAISE NOTICE 'Payment generation completed!';
    RAISE NOTICE 'Bills processed: %', bills_processed;
    RAISE NOTICE 'Payments created: %', payments_created;
    
    -- Verify results
    SELECT COUNT(*) INTO bills_without_payments 
    FROM bills b
    LEFT JOIN payments p ON b.id = p.bill_id
    WHERE p.id IS NULL;
    
    RAISE NOTICE 'Bills still without payments: %', bills_without_payments;
    
    -- Get total payment count
    SELECT COUNT(*) INTO payments_created FROM payments;
    RAISE NOTICE 'Total payments in database: %', payments_created;
END $$;

-- Step 3: Clean up the temporary function
DROP FUNCTION generate_payments_for_bill(varchar);

-- =====================================================================
-- VERIFICATION QUERIES (Run these after the script to verify success)
-- =====================================================================

-- Query 1: Count bills without payments (should be 0 or very few)
SELECT COUNT(*) as bills_without_payments 
FROM bills b
LEFT JOIN payments p ON b.id = p.bill_id
WHERE p.id IS NULL;

-- Query 2: Get payment statistics by building
SELECT 
    b.building_id,
    COUNT(DISTINCT b.id) as total_bills,
    COUNT(p.id) as total_payments,
    ROUND(AVG(p.amount::numeric), 2) as avg_payment_amount
FROM bills b
LEFT JOIN payments p ON b.id = p.bill_id
GROUP BY b.building_id
ORDER BY total_bills DESC
LIMIT 10;

-- Query 3: Check for any bills with unusual payment counts
SELECT 
    b.id,
    b.title,
    b.payment_type,
    COUNT(p.id) as payment_count
FROM bills b
LEFT JOIN payments p ON b.id = p.bill_id
GROUP BY b.id, b.title, b.payment_type
HAVING COUNT(p.id) = 0 OR COUNT(p.id) > 20
ORDER BY payment_count DESC;

-- =====================================================================
-- ROLLBACK PROCEDURE (In case of issues)
-- =====================================================================
-- 
-- If you need to rollback this operation:
-- 
-- 1. First, identify the payments created by this script:
--    SELECT COUNT(*) FROM payments WHERE created_at > '[SCRIPT_RUN_TIME]';
-- 
-- 2. If you need to remove all payments created after a specific time:
--    DELETE FROM payments WHERE created_at > '[SCRIPT_RUN_TIME]';
--    
-- 3. Or to restore from backup:
--    -- Restore the payments table from your backup
--    -- Make sure to coordinate with your backup/restore procedures
-- 
-- =====================================================================