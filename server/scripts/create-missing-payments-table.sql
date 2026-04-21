-- =====================================================================
-- PRODUCTION FIX: Create Missing Payments Table
-- =====================================================================
-- 
-- Run this BEFORE the payment generation script if payments table is missing
-- This script is IDEMPOTENT - safe to run multiple times
-- =====================================================================

-- Step 1: Verify what's missing (informational only)
SELECT 'Checking current schema...' as status;

-- List existing tables
SELECT 'EXISTING TABLES:' as info, string_agg(table_name, ', ' ORDER BY table_name) as tables
FROM information_schema.tables 
WHERE table_schema='public' AND table_type='BASE TABLE';

-- List existing enums  
SELECT 'EXISTING ENUMS:' as info, string_agg(typname, ', ' ORDER BY typname) as enums
FROM pg_type WHERE typtype='e';

-- Step 2: Create missing objects (idempotent)

-- Ensure pgcrypto extension exists (for UUID generation)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create missing enums (only if they don't exist)
DO $$ 
BEGIN
    -- payment_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_status') THEN 
        CREATE TYPE payment_status AS ENUM ('pending','overdue','paid','cancelled');
        RAISE NOTICE 'Created payment_status enum';
    ELSE 
        RAISE NOTICE 'payment_status enum already exists';
    END IF;
    
    -- payment_type enum  
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_type') THEN 
        CREATE TYPE payment_type AS ENUM ('unique','recurrent','auto-generated');
        RAISE NOTICE 'Created payment_type enum';
    ELSE 
        RAISE NOTICE 'payment_type enum already exists';
    END IF;
    
    -- schedule_payment enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='schedule_payment') THEN 
        CREATE TYPE schedule_payment AS ENUM ('weekly','monthly','quarterly','yearly','custom');
        RAISE NOTICE 'Created schedule_payment enum';
    ELSE 
        RAISE NOTICE 'schedule_payment enum already exists';
    END IF;
END $$;

-- Step 3: Create payments table (only if it doesn't exist)
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
        
        -- Add foreign key constraint (only if bills table exists)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bills') THEN
            ALTER TABLE public.payments ADD CONSTRAINT fk_payments_bill_id 
            FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint to bills table';
        ELSE
            RAISE WARNING 'bills table not found - skipping foreign key constraint';
        END IF;
        
        -- Create indexes for performance
        CREATE INDEX idx_payments_bill_id ON public.payments(bill_id);
        CREATE INDEX idx_payments_scheduled_date ON public.payments(scheduled_date);
        CREATE INDEX idx_payments_status ON public.payments(status);
        
        -- Optional: Add unique constraint to prevent duplicate payment numbers per bill
        ALTER TABLE public.payments ADD CONSTRAINT uniq_payments_bill_payment_number 
        UNIQUE (bill_id, payment_number);
        
        RAISE NOTICE 'Created payments table with indexes and constraints';
    ELSE
        RAISE NOTICE 'payments table already exists';
    END IF;
END $$;

-- Step 4: Verification
SELECT 'VERIFICATION RESULTS:' as status;

-- Check if payments table now exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') 
        THEN '✅ payments table exists'
        ELSE '❌ payments table MISSING'
    END as payments_table_status;

-- Check if bills table exists (required for foreign key)
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bills') 
        THEN '✅ bills table exists'
        ELSE '❌ bills table MISSING - THIS WILL CAUSE ISSUES'
    END as bills_table_status;

-- Show payments table structure
SELECT 'PAYMENTS TABLE STRUCTURE:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema='public' AND table_name='payments'
ORDER BY ordinal_position;

-- Count existing data
SELECT 
    (SELECT COUNT(*) FROM bills) as total_bills,
    (SELECT COUNT(*) FROM payments) as total_payments,
    (SELECT COUNT(*) FROM bills b LEFT JOIN payments p ON b.id = p.bill_id WHERE p.id IS NULL) as bills_without_payments;

SELECT 'Ready to run payment generation script!' as next_step;

-- =====================================================================