-- =====================================================================
-- PRODUCTION UPDATE SCRIPT 2/4: Enums Setup
-- =====================================================================
-- Purpose: Create all required enum types
-- Run order: 2nd (after extensions, before tables)
-- Safety: Idempotent - safe to run multiple times
-- =====================================================================

-- Create all required enum types (only if they don't exist)
DO $$ 
BEGIN
    -- bill_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='bill_status') THEN 
        CREATE TYPE bill_status AS ENUM ('draft','sent','overdue','paid','cancelled');
        RAISE NOTICE 'Created bill_status enum';
    ELSE 
        RAISE NOTICE 'bill_status enum already exists';
    END IF;
    
    -- bill_category enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='bill_category') THEN 
        CREATE TYPE bill_category AS ENUM ('insurance','maintenance','salary','utilities','cleaning','security','landscaping','professional_services','administration','repairs','supplies','taxes','technology','reserves','other');
        RAISE NOTICE 'Created bill_category enum';
    ELSE 
        RAISE NOTICE 'bill_category enum already exists';
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
    
    -- payment_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_status') THEN 
        CREATE TYPE payment_status AS ENUM ('pending','overdue','paid','cancelled');
        RAISE NOTICE 'Created payment_status enum';
    ELSE 
        RAISE NOTICE 'payment_status enum already exists';
    END IF;
END $$;

-- Verify all enums are created
SELECT 'ENUMS VERIFICATION:' as status;
SELECT typname FROM pg_type WHERE typtype='e' AND typname IN (
    'bill_status', 'bill_category', 'payment_type', 'schedule_payment', 'payment_status'
) ORDER BY typname;

SELECT 'Enums setup completed successfully!' as result;