-- =====================================================================
-- PRODUCTION UPDATE SCRIPT 4/4: Generate Payment Structures
-- =====================================================================
-- Purpose: Generate payment records for all bills missing payment structures
-- Run order: 4th (last - after all tables are set up)
-- Safety: Only creates new records, never modifies existing data
-- =====================================================================

-- Step 1: Pre-execution verification and reporting
DO $$
DECLARE
    bills_without_payments INTEGER;
    total_bills INTEGER;
    total_payments INTEGER;
BEGIN
    -- Get current counts
    SELECT COUNT(*) INTO total_bills FROM bills;
    SELECT COUNT(*) INTO total_payments FROM payments;
    
    -- Count bills without payments
    SELECT COUNT(*) INTO bills_without_payments 
    FROM bills b
    LEFT JOIN payments p ON b.id = p.bill_id
    WHERE p.id IS NULL;
    
    RAISE NOTICE '=== PRE-EXECUTION REPORT ===';
    RAISE NOTICE 'Total bills in database: %', total_bills;
    RAISE NOTICE 'Total payments in database: %', total_payments;
    RAISE NOTICE 'Bills without payments: %', bills_without_payments;
    
    IF bills_without_payments = 0 THEN
        RAISE NOTICE 'All bills already have payment structures. No action needed.';
    ELSE
        RAISE NOTICE 'Starting payment generation for % bills...', bills_without_payments;
    END IF;
END $$;

-- Step 2: Create temporary function to generate payments for a single bill
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

-- Step 3: Process all bills without payments
DO $$
DECLARE
    bills_without_payments INTEGER;
    bills_processed INTEGER := 0;
    payments_created INTEGER := 0;
    bill_record RECORD;
    payments_for_bill INTEGER;
    start_time TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    
    -- Count bills without payments
    SELECT COUNT(*) INTO bills_without_payments 
    FROM bills b
    LEFT JOIN payments p ON b.id = p.bill_id
    WHERE p.id IS NULL;
    
    IF bills_without_payments = 0 THEN
        RAISE NOTICE 'No bills need payment generation. Exiting.';
        RETURN;
    END IF;
    
    RAISE NOTICE '=== STARTING PAYMENT GENERATION ===';
    RAISE NOTICE 'Processing % bills without payments...', bills_without_payments;
    
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
            RAISE NOTICE 'Progress: % bills processed, % payments created...', bills_processed, payments_created;
        END IF;
        
        -- Optional: Add a small delay to avoid overwhelming the database
        -- PERFORM pg_sleep(0.01); -- 10ms delay - uncomment if needed
    END LOOP;
    
    RAISE NOTICE '=== PAYMENT GENERATION COMPLETED ===';
    RAISE NOTICE 'Execution time: %', clock_timestamp() - start_time;
    RAISE NOTICE 'Bills processed: %', bills_processed;
    RAISE NOTICE 'Payments created: %', payments_created;
END $$;

-- Step 4: Clean up the temporary function
DROP FUNCTION generate_payments_for_bill(varchar);

-- Step 5: Post-execution verification and reporting
DO $$
DECLARE
    bills_without_payments INTEGER;
    total_bills INTEGER;
    total_payments INTEGER;
    bills_with_payments INTEGER;
BEGIN
    -- Get final counts
    SELECT COUNT(*) INTO total_bills FROM bills;
    SELECT COUNT(*) INTO total_payments FROM payments;
    
    -- Count bills without payments
    SELECT COUNT(*) INTO bills_without_payments 
    FROM bills b
    LEFT JOIN payments p ON b.id = p.bill_id
    WHERE p.id IS NULL;
    
    bills_with_payments := total_bills - bills_without_payments;
    
    RAISE NOTICE '=== FINAL VERIFICATION REPORT ===';
    RAISE NOTICE 'Total bills in database: %', total_bills;
    RAISE NOTICE 'Bills with payments: %', bills_with_payments;
    RAISE NOTICE 'Bills without payments: %', bills_without_payments;
    RAISE NOTICE 'Total payments in database: %', total_payments;
    RAISE NOTICE 'Success rate: %% (%/%)', 
        CASE WHEN total_bills > 0 THEN ROUND((bills_with_payments::numeric / total_bills) * 100, 1) ELSE 0 END,
        bills_with_payments, total_bills;
        
    IF bills_without_payments = 0 THEN
        RAISE NOTICE '✅ SUCCESS: All bills have payment structures!';
    ELSE
        RAISE WARNING '⚠️  WARNING: % bills still without payments - investigate these manually', bills_without_payments;
    END IF;
END $$;

-- Additional verification queries for manual review
SELECT 'PAYMENT STATISTICS BY BUILDING:' as info;
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

SELECT 'BILLS WITH UNUSUAL PAYMENT COUNTS:' as info;
SELECT 
    b.id,
    b.title,
    b.payment_type,
    COUNT(p.id) as payment_count
FROM bills b
LEFT JOIN payments p ON b.id = p.bill_id
GROUP BY b.id, b.title, b.payment_type
HAVING COUNT(p.id) = 0 OR COUNT(p.id) > 15
ORDER BY payment_count DESC
LIMIT 20;

SELECT 'Payment generation script completed successfully!' as result;