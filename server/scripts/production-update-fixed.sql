-- =====================================================================
-- FIXED PRODUCTION UPDATE SCRIPT
-- =====================================================================
-- Purpose: Complete production database update with enum fixes
-- This version includes the enum value fixes needed for production
-- =====================================================================

\echo '====================================================================='
\echo 'KOVEO GESTION - PRODUCTION DATABASE UPDATE (FIXED VERSION)'
\echo '====================================================================='
\echo 'Starting complete production database update with enum fixes...'
\echo ''

-- STEP 0: FIX ENUM VALUES FIRST
\echo 'STEP 0: Fixing enum values...'

-- Check and fix payment_type enum
DO $$
BEGIN
    -- Ensure payment_type enum exists first
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_type') THEN 
        CREATE TYPE payment_type AS ENUM ('unique','recurrent','auto-generated');
        RAISE NOTICE 'Created payment_type enum';
    ELSE
        -- Add missing values to existing enum
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_type') 
            AND enumlabel = 'auto-generated'
        ) THEN
            ALTER TYPE payment_type ADD VALUE 'auto-generated';
            RAISE NOTICE 'Added auto-generated to payment_type enum';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_type') 
            AND enumlabel = 'unique'
        ) THEN
            ALTER TYPE payment_type ADD VALUE 'unique';
            RAISE NOTICE 'Added unique to payment_type enum';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_type') 
            AND enumlabel = 'recurrent'
        ) THEN
            ALTER TYPE payment_type ADD VALUE 'recurrent';
            RAISE NOTICE 'Added recurrent to payment_type enum';
        END IF;
    END IF;
END $$;

\echo 'Enum fixes completed!'
\echo ''

-- STEP 1: EXTENSIONS SETUP
\echo 'STEP 1/4: Setting up extensions...'

CREATE EXTENSION IF NOT EXISTS pgcrypto;

\echo 'Extensions setup completed!'
\echo ''

-- STEP 2: ENUMS SETUP  
\echo 'STEP 2/4: Setting up remaining enum types...'

DO $$ 
BEGIN
    -- bill_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='bill_status') THEN 
        CREATE TYPE bill_status AS ENUM ('draft','sent','overdue','paid','cancelled');
        RAISE NOTICE 'Created bill_status enum';
    END IF;
    
    -- bill_category enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='bill_category') THEN 
        CREATE TYPE bill_category AS ENUM ('insurance','maintenance','salary','utilities','cleaning','security','landscaping','professional_services','administration','repairs','supplies','taxes','technology','reserves','other');
        RAISE NOTICE 'Created bill_category enum';
    END IF;
    
    -- schedule_payment enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='schedule_payment') THEN 
        CREATE TYPE schedule_payment AS ENUM ('weekly','monthly','quarterly','yearly','custom');
        RAISE NOTICE 'Created schedule_payment enum';
    END IF;
    
    -- payment_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_status') THEN 
        CREATE TYPE payment_status AS ENUM ('pending','overdue','paid','cancelled');
        RAISE NOTICE 'Created payment_status enum';
    END IF;
END $$;

\echo 'Enums setup completed!'
\echo ''

-- STEP 3: TABLES SETUP
\echo 'STEP 3/4: Setting up tables...'

-- Verify bills table exists
DO $$
DECLARE
    bills_exists boolean;
    missing_columns text[] := '{}';
    col_record record;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema='public' AND table_name='bills'
    ) INTO bills_exists;
    
    IF NOT bills_exists THEN
        RAISE EXCEPTION 'CRITICAL: bills table does not exist in production. Run your main schema migrations first.';
    END IF;
    
    -- Check for required columns
    FOR col_record IN 
        SELECT unnest(ARRAY[
            'payment_type', 'schedule_payment', 'schedule_custom', 'costs', 
            'total_amount', 'start_date', 'end_date', 'created_at'
        ]) as required_col
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema='public' AND table_name='bills' AND column_name=col_record.required_col
        ) THEN
            missing_columns := array_append(missing_columns, col_record.required_col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'CRITICAL: bills table missing columns: %. Run schema migrations first.', array_to_string(missing_columns, ', ');
    END IF;
    
    RAISE NOTICE 'bills table verification passed';
END $$;

-- Create payments table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') THEN
        CREATE TABLE public.payments (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            bill_id varchar NOT NULL,
            payment_number integer NOT NULL,
            scheduled_date date NOT NULL,
            paid_date date,
            amount numeric(12,2) NOT NULL,
            status payment_status NOT NULL DEFAULT 'pending',
            notes text,
            created_at timestamp DEFAULT now(),
            updated_at timestamp DEFAULT now()
        );
        
        ALTER TABLE public.payments ADD CONSTRAINT fk_payments_bill_id 
        FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;
        
        CREATE INDEX idx_payments_bill_id ON public.payments(bill_id);
        CREATE INDEX idx_payments_scheduled_date ON public.payments(scheduled_date);
        CREATE INDEX idx_payments_status ON public.payments(status);
        
        ALTER TABLE public.payments ADD CONSTRAINT uniq_payments_bill_payment_number 
        UNIQUE (bill_id, payment_number);
        
        RAISE NOTICE 'Created payments table with constraints and indexes';
    ELSE
        RAISE NOTICE 'payments table already exists';
    END IF;
END $$;

\echo 'Tables setup completed!'
\echo ''

-- STEP 4: PAYMENT GENERATION
\echo 'STEP 4/4: Generating payment structures for bills...'

-- Pre-execution report
DO $$
DECLARE
    bills_without_payments INTEGER;
    total_bills INTEGER;
    unique_bills INTEGER;
    recurrent_bills INTEGER;
    auto_generated_bills INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_bills FROM bills;
    SELECT COUNT(*) INTO bills_without_payments 
    FROM bills b LEFT JOIN payments p ON b.id = p.bill_id WHERE p.id IS NULL;
    
    SELECT COUNT(*) INTO unique_bills FROM bills WHERE payment_type = 'unique';
    SELECT COUNT(*) INTO recurrent_bills FROM bills WHERE payment_type = 'recurrent';
    SELECT COUNT(*) INTO auto_generated_bills FROM bills WHERE payment_type = 'auto-generated';
    
    RAISE NOTICE 'Pre-execution report:';
    RAISE NOTICE 'Total bills: %', total_bills;
    RAISE NOTICE 'Bills without payments: %', bills_without_payments;
    RAISE NOTICE 'Breakdown: unique=%, recurrent=%, auto-generated=%', unique_bills, recurrent_bills, auto_generated_bills;
END $$;

-- Create payment generation function
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
    SELECT * INTO bill_record FROM bills WHERE id = bill_id_param;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    CASE bill_record.payment_type
        WHEN 'unique' THEN
            INSERT INTO payments (bill_id, payment_number, scheduled_date, amount, status) 
            VALUES (bill_id_param, 1, bill_record.start_date, bill_record.total_amount, 'pending');
            payment_count := 1;
            
        WHEN 'recurrent', 'auto-generated' THEN
            current_date_val := bill_record.start_date;
            payment_num := 1;
            
            IF bill_record.schedule_payment = 'custom' AND bill_record.schedule_custom IS NOT NULL THEN
                FOR custom_date_str IN SELECT unnest(bill_record.schedule_custom)
                LOOP
                    payment_amount := CASE 
                        WHEN array_length(bill_record.costs, 1) >= payment_num THEN bill_record.costs[payment_num]
                        ELSE bill_record.total_amount / array_length(bill_record.schedule_custom, 1)
                    END;
                    
                    INSERT INTO payments (bill_id, payment_number, scheduled_date, amount, status) 
                    VALUES (bill_id_param, payment_num, custom_date_str::DATE, payment_amount, 'pending');
                    
                    payment_num := payment_num + 1;
                    payment_count := payment_count + 1;
                END LOOP;
            ELSE
                WHILE payment_num <= max_payments AND 
                      (bill_record.end_date IS NULL OR current_date_val <= bill_record.end_date)
                LOOP
                    payment_amount := CASE 
                        WHEN array_length(bill_record.costs, 1) >= payment_num THEN bill_record.costs[payment_num]
                        ELSE bill_record.total_amount / max_payments
                    END;
                    
                    INSERT INTO payments (bill_id, payment_number, scheduled_date, amount, status) 
                    VALUES (bill_id_param, payment_num, current_date_val, payment_amount, 'pending');
                    
                    CASE bill_record.schedule_payment
                        WHEN 'weekly' THEN current_date_val := current_date_val + INTERVAL '7 days';
                        WHEN 'monthly' THEN current_date_val := current_date_val + INTERVAL '1 month';
                        WHEN 'quarterly' THEN current_date_val := current_date_val + INTERVAL '3 months';
                        WHEN 'yearly' THEN current_date_val := current_date_val + INTERVAL '1 year';
                        ELSE current_date_val := current_date_val + INTERVAL '1 month';
                    END CASE;
                    
                    payment_num := payment_num + 1;
                    payment_count := payment_count + 1;
                END LOOP;
            END IF;
    END CASE;
    
    RETURN payment_count;
END;
$$ LANGUAGE plpgsql;

-- Process all bills
DO $$
DECLARE
    bills_processed INTEGER := 0;
    payments_created INTEGER := 0;
    bill_record RECORD;
    payments_for_bill INTEGER;
BEGIN
    FOR bill_record IN 
        SELECT b.id FROM bills b
        LEFT JOIN payments p ON b.id = p.bill_id
        WHERE p.id IS NULL
        ORDER BY b.created_at
    LOOP
        SELECT generate_payments_for_bill(bill_record.id) INTO payments_for_bill;
        bills_processed := bills_processed + 1;
        payments_created := payments_created + payments_for_bill;
        
        IF bills_processed % 100 = 0 THEN
            RAISE NOTICE 'Processed % bills, created % payments...', bills_processed, payments_created;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Payment generation completed: % bills processed, % payments created', bills_processed, payments_created;
END $$;

-- Clean up function
DROP FUNCTION generate_payments_for_bill(varchar);

-- Final verification
DO $$
DECLARE
    bills_without_payments INTEGER;
    total_bills INTEGER;
    total_payments INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_bills FROM bills;
    SELECT COUNT(*) INTO total_payments FROM payments;
    SELECT COUNT(*) INTO bills_without_payments 
    FROM bills b LEFT JOIN payments p ON b.id = p.bill_id WHERE p.id IS NULL;
    
    RAISE NOTICE '=== FINAL RESULTS ===';
    RAISE NOTICE 'Total bills: %', total_bills;
    RAISE NOTICE 'Total payments: %', total_payments;
    RAISE NOTICE 'Bills without payments: %', bills_without_payments;
    
    IF bills_without_payments = 0 THEN
        RAISE NOTICE '✅ SUCCESS: All bills have payment structures!';
    ELSE
        RAISE WARNING '⚠️  % bills still need manual review', bills_without_payments;
    END IF;
END $$;

\echo ''
\echo '====================================================================='
\echo 'PRODUCTION DATABASE UPDATE COMPLETED SUCCESSFULLY!'
\echo 'All enum issues have been resolved.'
\echo '====================================================================='