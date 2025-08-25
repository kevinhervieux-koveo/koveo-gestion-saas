-- Migration: Add Common Spaces functionality
-- Generated from Drizzle ORM schema for common spaces, bookings, and user restrictions

-- Create enum for booking status
DO $$ BEGIN
 CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create common_spaces table
CREATE TABLE IF NOT EXISTS "common_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"building_id" uuid NOT NULL,
	"is_reservable" boolean DEFAULT false NOT NULL,
	"capacity" integer,
	"contact_person_id" uuid,
	"opening_hours" jsonb,
	"booking_rules" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"common_space_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create user_booking_restrictions table
CREATE TABLE IF NOT EXISTS "user_booking_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"common_space_id" uuid NOT NULL,
	"is_blocked" boolean DEFAULT true NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "common_spaces" ADD CONSTRAINT "common_spaces_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "common_spaces" ADD CONSTRAINT "common_spaces_contact_person_id_users_id_fk" FOREIGN KEY ("contact_person_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_common_space_id_common_spaces_id_fk" FOREIGN KEY ("common_space_id") REFERENCES "public"."common_spaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_booking_restrictions" ADD CONSTRAINT "user_booking_restrictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_booking_restrictions" ADD CONSTRAINT "user_booking_restrictions_common_space_id_common_spaces_id_fk" FOREIGN KEY ("common_space_id") REFERENCES "public"."common_spaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_common_spaces_building_id" ON "common_spaces"("building_id");
CREATE INDEX IF NOT EXISTS "idx_common_spaces_is_reservable" ON "common_spaces"("is_reservable") WHERE "is_reservable" = true;
CREATE INDEX IF NOT EXISTS "idx_bookings_common_space_id" ON "bookings"("common_space_id");
CREATE INDEX IF NOT EXISTS "idx_bookings_user_id" ON "bookings"("user_id");
CREATE INDEX IF NOT EXISTS "idx_bookings_time_range" ON "bookings"("common_space_id", "start_time", "end_time");
CREATE INDEX IF NOT EXISTS "idx_bookings_status" ON "bookings"("status") WHERE "status" = 'confirmed';
CREATE INDEX IF NOT EXISTS "idx_user_booking_restrictions_user_space" ON "user_booking_restrictions"("user_id", "common_space_id");
CREATE INDEX IF NOT EXISTS "idx_user_booking_restrictions_blocked" ON "user_booking_restrictions"("is_blocked") WHERE "is_blocked" = true;

-- Add comments for documentation
COMMENT ON TABLE "common_spaces" IS 'Common spaces table storing shared facilities within buildings. Represents spaces like gyms, lounges, meeting rooms that can be reserved by residents.';
COMMENT ON TABLE "bookings" IS 'Bookings table for common space reservations. Tracks user reservations for common spaces with time slots and status.';
COMMENT ON TABLE "user_booking_restrictions" IS 'User booking restrictions table to manage blocked users. Allows administrators to block specific users from booking certain common spaces.';

COMMENT ON COLUMN "common_spaces"."opening_hours" IS 'JSON array storing structured opening times (e.g., [{"day": "Monday", "open": "08:00", "close": "22:00"}])';
COMMENT ON COLUMN "common_spaces"."contact_person_id" IS 'Optional foreign key referencing users table. If null, the building manager is the default contact.';
COMMENT ON COLUMN "bookings"."start_time" IS 'Booking start time with timezone support';
COMMENT ON COLUMN "bookings"."end_time" IS 'Booking end time with timezone support';