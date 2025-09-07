-- Fix file_size column type in production
ALTER TABLE invoices ALTER COLUMN file_size TYPE INTEGER USING file_size::INTEGER;
