CREATE TYPE "public"."actionable_item_status" AS ENUM('pending', 'in-progress', 'completed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."ai_insight_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."ai_insight_status" AS ENUM('new', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."ai_insight_type" AS ENUM('performance', 'quality', 'security', 'ux', 'efficiency');--> statement-breakpoint
CREATE TYPE "public"."ai_interaction_status" AS ENUM('success', 'error', 'pending');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('draft', 'sent', 'overdue', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."bill_type" AS ENUM('condo_fees', 'special_assessment', 'utility', 'maintenance', 'other');--> statement-breakpoint
CREATE TYPE "public"."building_type" AS ENUM('condo', 'rental');--> statement-breakpoint
CREATE TYPE "public"."feature_category" AS ENUM('Dashboard & Home', 'Property Management', 'Resident Management', 'Financial Management', 'Maintenance & Requests', 'Document Management', 'Communication', 'AI & Automation', 'Compliance & Security', 'Analytics & Reporting', 'Integration & API', 'Infrastructure & Performance', 'Website');--> statement-breakpoint
CREATE TYPE "public"."feature_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."feature_status" AS ENUM('submitted', 'planned', 'in-progress', 'ai-analyzed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."maintenance_priority" AS ENUM('low', 'medium', 'high', 'urgent', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('submitted', 'acknowledged', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('bill', 'maintenance', 'meeting', 'announcement', 'document');--> statement-breakpoint
CREATE TYPE "public"."suggestion_category" AS ENUM('Code Quality', 'Security', 'Testing', 'Documentation', 'Performance', 'Continuous Improvement', 'Replit AI Agent Monitoring');--> statement-breakpoint
CREATE TYPE "public"."suggestion_priority" AS ENUM('Low', 'Medium', 'High', 'Critical');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('New', 'Acknowledged', 'Done');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'tenant', 'board_member');--> statement-breakpoint
CREATE TABLE "actionable_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "feature_id" uuid NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "technical_details" text,
        "implementation_prompt" text,
        "testing_requirements" text,
        "estimated_effort" text,
        "dependencies" jsonb,
        "status" "actionable_item_status" DEFAULT 'pending' NOT NULL,
        "completed_at" timestamp,
        "order_index" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_insights" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "type" "ai_insight_type" NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "recommendation" text NOT NULL,
        "priority" "ai_insight_priority" NOT NULL,
        "status" "ai_insight_status" DEFAULT 'new' NOT NULL,
        "implemented_at" timestamp,
        "implemented_by" uuid,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_interactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "timestamp" timestamp DEFAULT now() NOT NULL,
        "action" text NOT NULL,
        "category" varchar(100) NOT NULL,
        "duration" integer NOT NULL,
        "status" "ai_interaction_status" NOT NULL,
        "improvement" text,
        "impact" varchar(20),
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_metrics" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "date" date NOT NULL,
        "total_interactions" integer DEFAULT 0,
        "success_rate" numeric(5, 2) DEFAULT '0',
        "avg_response_time" integer DEFAULT 0,
        "improvements_suggested" integer DEFAULT 0,
        "improvements_implemented" integer DEFAULT 0,
        "categories_analyzed" jsonb DEFAULT '[]',
        "last_analysis" timestamp DEFAULT now(),
        "ai_efficiency" numeric(5, 2) DEFAULT '0',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bills" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "residence_id" uuid NOT NULL,
        "bill_number" text NOT NULL,
        "type" "bill_type" NOT NULL,
        "description" text NOT NULL,
        "amount" numeric(12, 2) NOT NULL,
        "due_date" date NOT NULL,
        "issue_date" date NOT NULL,
        "status" "bill_status" DEFAULT 'draft' NOT NULL,
        "notes" text,
        "late_fee_amount" numeric(10, 2),
        "discount_amount" numeric(10, 2),
        "final_amount" numeric(12, 2) NOT NULL,
        "payment_received_date" date,
        "created_by" uuid NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "bills_bill_number_unique" UNIQUE("bill_number")
);
--> statement-breakpoint
CREATE TABLE "budgets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "building_id" uuid NOT NULL,
        "year" integer NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "category" text NOT NULL,
        "budgeted_amount" numeric(12, 2) NOT NULL,
        "actual_amount" numeric(12, 2) DEFAULT '0',
        "variance" numeric(12, 2) DEFAULT '0',
        "approved_by" uuid,
        "approved_date" date,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "buildings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" uuid NOT NULL,
        "name" text NOT NULL,
        "address" text NOT NULL,
        "city" text NOT NULL,
        "province" text DEFAULT 'QC' NOT NULL,
        "postal_code" text NOT NULL,
        "building_type" "building_type" NOT NULL,
        "year_built" integer,
        "total_units" integer NOT NULL,
        "total_floors" integer,
        "parking_spaces" integer,
        "storage_spaces" integer,
        "amenities" jsonb,
        "management_company" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "development_pillars" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "description" text NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "order" text NOT NULL,
        "configuration" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" uuid,
        "building_id" uuid,
        "residence_id" uuid,
        "title" text NOT NULL,
        "description" text,
        "category" text NOT NULL,
        "file_url" text NOT NULL,
        "file_name" text NOT NULL,
        "file_size" integer,
        "mime_type" text,
        "is_public" boolean DEFAULT false NOT NULL,
        "uploaded_by" uuid NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "features" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "description" text NOT NULL,
        "category" "feature_category" NOT NULL,
        "status" "feature_status" DEFAULT 'submitted' NOT NULL,
        "priority" "feature_priority" DEFAULT 'medium' NOT NULL,
        "business_objective" text,
        "target_users" text,
        "success_metrics" text,
        "technical_complexity" text,
        "dependencies" text,
        "user_flow" text,
        "ai_analysis_result" jsonb,
        "ai_analyzed_at" timestamp,
        "requested_by" uuid,
        "assigned_to" uuid,
        "estimated_hours" integer,
        "actual_hours" integer,
        "start_date" date,
        "completed_date" date,
        "is_public_roadmap" boolean DEFAULT true NOT NULL,
        "is_strategic_path" boolean DEFAULT false NOT NULL,
        "tags" jsonb,
        "metadata" jsonb,
        "synced_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "framework_configuration" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "key" text NOT NULL,
        "value" jsonb NOT NULL,
        "description" text,
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "framework_configuration_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "improvement_suggestions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "category" "suggestion_category" NOT NULL,
        "priority" "suggestion_priority" NOT NULL,
        "status" "suggestion_status" DEFAULT 'New' NOT NULL,
        "file_path" text,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "maintenance_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "residence_id" uuid NOT NULL,
        "submitted_by" uuid NOT NULL,
        "assigned_to" uuid,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "category" text NOT NULL,
        "priority" "maintenance_priority" DEFAULT 'medium' NOT NULL,
        "status" "maintenance_status" DEFAULT 'submitted' NOT NULL,
        "estimated_cost" numeric(10, 2),
        "actual_cost" numeric(10, 2),
        "scheduled_date" timestamp,
        "completed_date" timestamp,
        "notes" text,
        "images" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "type" "notification_type" NOT NULL,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "related_entity_id" uuid,
        "related_entity_type" text,
        "is_read" boolean DEFAULT false NOT NULL,
        "read_at" timestamp,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "type" text NOT NULL,
        "address" text NOT NULL,
        "city" text NOT NULL,
        "province" text DEFAULT 'QC' NOT NULL,
        "postal_code" text NOT NULL,
        "phone" text,
        "email" text,
        "website" text,
        "registration_number" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quality_metrics" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "metric_type" text NOT NULL,
        "value" text NOT NULL,
        "timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "residences" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "building_id" uuid NOT NULL,
        "unit_number" text NOT NULL,
        "floor" integer,
        "square_footage" numeric(8, 2),
        "bedrooms" integer,
        "bathrooms" numeric(3, 1),
        "balcony" boolean DEFAULT false,
        "parking_space_number" text,
        "storage_space_number" text,
        "ownership_percentage" numeric(5, 4),
        "monthly_fees" numeric(10, 2),
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_residences" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "residence_id" uuid NOT NULL,
        "relationship_type" text NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "email" text NOT NULL,
        "password" text NOT NULL,
        "first_name" text NOT NULL,
        "last_name" text NOT NULL,
        "phone" text,
        "language" text DEFAULT 'fr' NOT NULL,
        "role" "user_role" DEFAULT 'tenant' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "last_login_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_status" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "component" text NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "actionable_items" ADD CONSTRAINT "actionable_items_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_implemented_by_users_id_fk" FOREIGN KEY ("implemented_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_residence_id_residences_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_residence_id_residences_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_residence_id_residences_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residences" ADD CONSTRAINT "residences_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_residences" ADD CONSTRAINT "user_residences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_residences" ADD CONSTRAINT "user_residences_residence_id_residences_id_fk" FOREIGN KEY ("residence_id") REFERENCES "public"."residences"("id") ON DELETE no action ON UPDATE no action;