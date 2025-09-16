-- =====================================================================
-- PRODUCTION UPDATE SCRIPT 3/4: Tables Setup
-- =====================================================================
-- Purpose: Create payments table and ensure bills table compatibility
-- Run order: 3rd (after extensions and enums)
-- Safety: Idempotent - safe to run multiple times
-- =====================================================================

-- Check if bills table exists and has required columns
DO $$
DECLARE
    bills_exists boolean;
    missing_columns text[] := '{}';
    col_record record;
BEGIN
    -- Check if bills table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema='public' AND table_name='bills'
    ) INTO bills_exists;
    
    IF NOT bills_exists THEN
        RAISE EXCEPTION 'CRITICAL: bills table does not exist in production. Run your main schema migrations first before running these payment update scripts.';
    END IF;
    
    -- Check for required columns in bills table
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
        RAISE EXCEPTION 'CRITICAL: bills table is missing required columns: %. Run your main schema migrations first.', array_to_string(missing_columns, ', ');
    END IF;
    
    RAISE NOTICE 'bills table verification passed - all required columns present';
END $$;

-- Create payments table (only if it doesn't exist)
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
        
        -- Add foreign key constraint to bills table
        ALTER TABLE public.payments ADD CONSTRAINT fk_payments_bill_id 
        FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;
        
        -- Create indexes for performance
        CREATE INDEX idx_payments_bill_id ON public.payments(bill_id);
        CREATE INDEX idx_payments_scheduled_date ON public.payments(scheduled_date);
        CREATE INDEX idx_payments_status ON public.payments(status);
        
        -- Add unique constraint to prevent duplicate payment numbers per bill
        ALTER TABLE public.payments ADD CONSTRAINT uniq_payments_bill_payment_number 
        UNIQUE (bill_id, payment_number);
        
        RAISE NOTICE 'Created payments table with indexes and constraints';
    ELSE
        RAISE NOTICE 'payments table already exists';
    END IF;
END $$;

-- Verify table structure
SELECT 'PAYMENTS TABLE VERIFICATION:' as status;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') 
        THEN '✅ payments table exists'
        ELSE '❌ payments table MISSING'
    END as payments_table_status;

-- Show payments table structure
SELECT 'PAYMENTS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema='public' AND table_name='payments'
ORDER BY ordinal_position;

-- Show constraints
SELECT 'PAYMENTS TABLE CONSTRAINTS:' as info;
SELECT conname, contype FROM pg_constraint 
WHERE conrelid = 'public.payments'::regclass
ORDER BY conname;

-- Show indexes
SELECT 'PAYMENTS TABLE INDEXES:' as info;
SELECT indexname FROM pg_indexes 
WHERE tablename = 'payments' AND schemaname = 'public'
ORDER BY indexname;

SELECT 'Tables setup completed successfully!' as result;