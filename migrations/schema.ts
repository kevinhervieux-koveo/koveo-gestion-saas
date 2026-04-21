import { pgTable, foreignKey, text, numeric, date, varchar, boolean, jsonb, timestamp, integer, uuid, json, index, check, uniqueIndex, unique, type AnyPgColumn, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const action = pgEnum("action", ['read', 'create', 'update', 'delete', 'manage', 'approve', 'assign', 'share', 'export', 'backup', 'restore'])
export const actionableItemStatus = pgEnum("actionable_item_status", ['pending', 'in-progress', 'completed', 'blocked'])
export const autoProjectStatus = pgEnum("auto_project_status", ['pending', 'accepted', 'dismissed'])
export const billCategory = pgEnum("bill_category", ['insurance', 'maintenance', 'salary', 'utilities', 'cleaning', 'security', 'landscaping', 'professional_services', 'administration', 'repairs', 'supplies', 'taxes', 'technology', 'reserves', 'other'])
export const billStatus = pgEnum("bill_status", ['draft', 'sent', 'overdue', 'paid', 'cancelled'])
export const bookingStatus = pgEnum("booking_status", ['confirmed', 'cancelled'])
export const bugCategory = pgEnum("bug_category", ['ui_ux', 'functionality', 'performance', 'data', 'security', 'integration', 'other'])
export const bugPriority = pgEnum("bug_priority", ['low', 'medium', 'high', 'critical'])
export const bugStatus = pgEnum("bug_status", ['new', 'acknowledged', 'in_progress', 'resolved', 'closed'])
export const buildingType = pgEnum("building_type", ['apartment', 'appartement', 'condo', 'rental'])
export const contactCategory = pgEnum("contact_category", ['resident', 'manager', 'tenant', 'maintenance', 'emergency', 'other'])
export const contactEntity = pgEnum("contact_entity", ['organization', 'building', 'residence'])
export const demandStatus = pgEnum("demand_status", ['draft', 'submitted', 'under_review', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled'])
export const demandType = pgEnum("demand_type", ['maintenance', 'complaint', 'information', 'other'])
export const documentType = pgEnum("document_type", ['image', 'pdf', 'specification', 'warranty', 'report'])
export const elementAccess = pgEnum("element_access", ['not_restrained', 'restrained'])
export const elementCharge = pgEnum("element_charge", ['common', 'personnal'])
export const elementCondition = pgEnum("element_condition", ['excellent', 'good', 'fair', 'poor', 'critical'])
export const elementUpdateStatus = pgEnum("element_update_status", ['repair', 'minor_rehab', 'major_rehab', 'replace', 'nothing'])
export const evaluationStatus = pgEnum("evaluation_status", ['pending', 'scheduled', 'postponed', 'completed', 'dismissed'])
export const eventType = pgEnum("event_type", ['construction', 'repair', 'minor_rehab', 'major_rehab', 'replacement'])
export const featureCategory = pgEnum("feature_category", ['Dashboard & Home', 'Property Management', 'Resident Management', 'Financial Management', 'Maintenance & Requests', 'Document Management', 'Communication', 'AI & Automation', 'Compliance & Security', 'Analytics & Reporting', 'Integration & API', 'Infrastructure & Performance', 'Website'])
export const featurePriority = pgEnum("feature_priority", ['low', 'medium', 'high', 'critical'])
export const featureRequestCategory = pgEnum("feature_request_category", ['dashboard', 'property_management', 'resident_management', 'financial_management', 'maintenance', 'document_management', 'communication', 'reports', 'mobile_app', 'integrations', 'security', 'performance', 'other'])
export const featureRequestStatus = pgEnum("feature_request_status", ['submitted', 'under_review', 'planned', 'in_progress', 'completed', 'rejected'])
export const featureStatus = pgEnum("feature_status", ['submitted', 'planned', 'in-progress', 'ai-analyzed', 'completed', 'cancelled'])
export const frequency = pgEnum("frequency", ['immediate', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'bi-annually', 'annually'])
export const investmentOwnership = pgEnum("investment_ownership", ['residences', 'owner'])
export const investmentType = pgEnum("investment_type", ['auto_generated', 'custom'])
export const investmentUrgency = pgEnum("investment_urgency", ['not_urgent', 'urgent', 'suggested'])
export const invitationStatus = pgEnum("invitation_status", ['pending', 'accepted', 'expired', 'cancelled'])
export const invoiceFrequency = pgEnum("invoice_frequency", ['monthly', 'quarterly', 'annually', 'custom'])
export const invoicePaymentType = pgEnum("invoice_payment_type", ['one-time', 'recurring'])
export const issueSeverity = pgEnum("issue_severity", ['info', 'low', 'medium', 'high', 'critical', 'quebec_compliance'])
export const maintenancePriority = pgEnum("maintenance_priority", ['low', 'medium', 'high', 'urgent', 'emergency'])
export const maintenanceStatus = pgEnum("maintenance_status", ['submitted', 'acknowledged', 'in_progress', 'completed', 'cancelled'])
export const metricType = pgEnum("metric_type", ['code_coverage', 'code_quality', 'security_vulnerabilities', 'build_time', 'translation_coverage', 'api_response_time', 'memory_usage', 'bundle_size', 'database_query_time', 'page_load_time', 'accessibility_score', 'seo_score', 'quebec_compliance_score'])
export const notificationType = pgEnum("notification_type", ['bill_reminder', 'maintenance_update', 'announcement', 'system', 'upcoming_payment', 'upcoming_bills', 'bill_paid_last_month', 'bills_overdue', 'payment_overdue', 'new_building_document', 'meeting_invite', 'maintenance_completed', 'budget_update', 'policy_change', 'seasonal_reminder'])
export const paymentStatus = pgEnum("payment_status", ['pending', 'overdue', 'paid', 'cancelled'])
export const paymentType = pgEnum("payment_type", ['unique', 'recurrent'])
export const priority = pgEnum("priority", ['low', 'medium', 'high', 'critical'])
export const projectOrigin = pgEnum("project_origin", ['manual', 'auto'])
export const projectStatus = pgEnum("project_status", ['planned', 'submission', 'pre_work', 'in_progress', 'post_work', 'completed'])
export const projectType = pgEnum("project_type", ['repair', 'minor_rehab', 'major_rehab', 'replacement', 'not_sure'])
export const resourceType = pgEnum("resource_type", ['user', 'users', 'organization', 'building', 'residence', 'bill', 'budget', 'maintenance_request', 'document', 'audit_log', 'system_settings', 'development_pillar', 'quality_metric', 'feature', 'actionable_item', 'improvement_suggestion'])
export const schedulePayment = pgEnum("schedule_payment", ['weekly', 'monthly', 'quarterly', 'yearly', 'custom'])
export const sslStatus = pgEnum("ssl_status", ['active', 'pending', 'expired', 'revoked', 'failed'])
export const stepStatus = pgEnum("step_status", ['pending', 'in_progress', 'completed', 'skipped'])
export const stepType = pgEnum("step_type", ['submission', 'pre_work', 'in_progress', 'post_work', 'completion'])
export const suggestionCategory = pgEnum("suggestion_category", ['Code Quality', 'Security', 'Testing', 'Documentation', 'Performance', 'Continuous Improvement', 'Replit AI Agent Monitoring', 'Replit App'])
export const suggestionPriority = pgEnum("suggestion_priority", ['Low', 'Medium', 'High', 'Critical'])
export const suggestionStatus = pgEnum("suggestion_status", ['New', 'Acknowledged', 'Done'])
export const suggestionType = pgEnum("suggestion_type", ['inspection', 'minor_rehab', 'major_rehab', 'replacement'])
export const timingType = pgEnum("timing_type", ['one_day_before', 'three_days_before', 'one_week_before', 'custom'])
export const userRole = pgEnum("user_role", ['admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident'])
export const validationStatus = pgEnum("validation_status", ['pending', 'true_positive', 'false_positive', 'true_negative', 'false_negative'])
export const workflowPhase = pgEnum("workflow_phase", ['pre_work', 'in_progress', 'post_work'])


export const invoices = pgTable("invoices", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	vendorName: text("vendor_name").notNull(),
	invoiceNumber: text("invoice_number").notNull(),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }).notNull(),
	dueDate: date("due_date").notNull(),
	paymentType: invoicePaymentType("payment_type").notNull(),
	frequency: invoiceFrequency(),
	startDate: date("start_date"),
	customPaymentDates: date("custom_payment_dates").array(),
	documentId: varchar("document_id"),
	isAiExtracted: boolean("is_ai_extracted").default(false).notNull(),
	aiExtractionData: jsonb("ai_extraction_data"),
	extractionConfidence: numeric("extraction_confidence", { precision: 5, scale:  4 }),
	buildingId: varchar("building_id"),
	residenceId: varchar("residence_id"),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "invoices_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.residenceId],
			foreignColumns: [residences.id],
			name: "invoices_residence_id_residences_id_fk"
		}),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "invoices_building_id_buildings_id_fk"
		}),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "invoices_document_id_documents_id_fk"
		}),
]);

export const payments = pgTable("payments", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	billId: varchar("bill_id").notNull(),
	paymentNumber: integer("payment_number").notNull(),
	scheduledDate: date("scheduled_date").notNull(),
	paidDate: date("paid_date"),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	status: paymentStatus().default('pending').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.billId],
			foreignColumns: [bills.id],
			name: "payments_bill_id_bills_id_fk"
		}).onDelete("cascade"),
]);

export const capitalInvestments = pgTable("capital_investments", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	buildingId: varchar("building_id").notNull(),
	title: text().notNull(),
	description: text(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	targetDate: date("target_date").notNull(),
	urgency: investmentUrgency().notNull(),
	type: investmentType().notNull(),
	ownershipType: investmentOwnership("ownership_type").notNull(),
	category: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "capital_investments_building_id_buildings_id_fk"
		}),
]);

export const generalCommunications = pgTable("general_communications", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	organizationId: varchar("organization_id").notNull(),
	createdBy: varchar("created_by").notNull(),
	title: text().notNull(),
	content: text().notNull(),
	isUrgent: boolean("is_urgent").default(false).notNull(),
	scheduledFor: timestamp("scheduled_for", { mode: 'string' }),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	recipientRoles: text("recipient_roles").array(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "general_communications_organization_id_organizations_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "general_communications_created_by_users_id_fk"
		}),
]);

export const meetings = pgTable("meetings", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	organizationId: varchar("organization_id").notNull(),
	createdBy: varchar("created_by").notNull(),
	title: text().notNull(),
	description: text(),
	location: text().notNull(),
	scheduledDate: timestamp("scheduled_date", { mode: 'string' }).notNull(),
	duration: integer().notNull(),
	invitedRoles: text("invited_roles").array(),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "meetings_organization_id_organizations_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "meetings_created_by_users_id_fk"
		}),
]);

export const userNotificationPreferences = pgTable("user_notification_preferences", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	notificationType: notificationType("notification_type").notNull(),
	frequency: frequency().default('monthly').notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	startingDate: timestamp("starting_date", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_notification_preferences_user_id_users_id_fk"
		}),
]);

export const projectSteps = pgTable("project_steps", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull(),
	stepType: stepType("step_type").notNull(),
	isRequired: boolean("is_required").default(true).notNull(),
	status: stepStatus().default('pending').notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	notes: text(),
	documents: jsonb(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [maintenanceProjects.id],
			name: "project_steps_project_id_maintenance_projects_id_fk"
		}).onDelete("cascade"),
]);

export const uniformatCodes = pgTable("uniformat_codes", {
	code: varchar({ length: 10 }).primaryKey().notNull(),
	level: integer().notNull(),
	parentCode: varchar("parent_code", { length: 10 }),
	nameFr: varchar("name_fr", { length: 255 }).notNull(),
	nameEn: varchar("name_en", { length: 255 }).notNull(),
	descriptionFr: text("description_fr"),
	descriptionEn: text("description_en"),
	typicalLifespan: integer("typical_lifespan"),
	category: varchar({ length: 100 }),
}, (table) => [
	foreignKey({
			columns: [table.parentCode],
			foreignColumns: [table.code],
			name: "uniformat_codes_parent_code_uniformat_codes_code_fk"
		}),
]);

export const session = pgTable("session", {
	sid: varchar().primaryKey().notNull(),
	sess: json().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
});

export const vendors = pgTable("vendors", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	name: varchar({ length: 200 }).notNull(),
	category: varchar({ length: 100 }),
	contactPerson: varchar("contact_person", { length: 100 }),
	phone: varchar({ length: 20 }),
	email: varchar({ length: 255 }),
	address: text(),
	rating: numeric({ precision: 3, scale:  2 }),
	notes: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("vendors_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "vendors_organization_id_organizations_id_fk"
		}).onDelete("cascade"),
	check("vendors_rating_check", sql`(rating >= (0)::numeric) AND (rating <= (5)::numeric)`),
]);

export const financialCache = pgTable("financial_cache", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	buildingId: varchar("building_id").notNull(),
	cacheKey: text("cache_key").notNull(),
	cacheData: jsonb("cache_data").notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("idx_financial_cache_lookup").using("btree", table.buildingId.asc().nullsLast().op("timestamp_ops"), table.cacheKey.asc().nullsLast().op("text_ops"), table.expiresAt.asc().nullsLast().op("text_ops")),
	uniqueIndex("unq_financial_cache").using("btree", table.buildingId.asc().nullsLast().op("text_ops"), table.cacheKey.asc().nullsLast().op("text_ops"), table.startDate.asc().nullsLast().op("text_ops"), table.endDate.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "financial_cache_building_id_buildings_id_fk"
		}),
]);

export const submissionVendors = pgTable("submission_vendors", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull(),
	contactInfo: text("contact_info"),
	notes: text(),
	price: numeric({ precision: 12, scale:  2 }),
	projectType: projectType("project_type").notNull(),
	addedLifespan: integer("added_lifespan"),
	documents: jsonb(),
	isSelected: boolean("is_selected").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	paymentPlanCosts: numeric("payment_plan_costs", { precision: 10, scale:  2 }).array(),
	paymentPlanSchedule: schedulePayment("payment_plan_schedule"),
	paymentPlanCustomDates: date("payment_plan_custom_dates").array(),
	paymentPlanStartDate: date("payment_plan_start_date"),
	preferred: boolean().default(false).notNull(),
	vendorName: varchar("vendor_name", { length: 255 }).notNull(),
	availableDate: date("available_date"),
}, (table) => [
	index("submission_vendors_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	index("submission_vendors_vendor_name_idx").using("btree", table.vendorName.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [maintenanceProjects.id],
			name: "submission_vendors_project_id_maintenance_projects_id_fk"
		}).onDelete("cascade"),
	check("submission_vendors_price_check", sql`price >= (0)::numeric`),
	check("submission_vendors_added_lifespan_check", sql`added_lifespan >= 0`),
]);

export const autoGeneratedProjects = pgTable("auto_generated_projects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	buildingId: text("building_id").notNull(),
	elementId: uuid("element_id").notNull(),
	suggestionId: uuid("suggestion_id"),
	status: autoProjectStatus().default('pending').notNull(),
	title: varchar({ length: 200 }).notNull(),
	description: text().notNull(),
	suggestedType: projectType("suggested_type").notNull(),
	suggestedPriority: priority("suggested_priority").default('medium').notNull(),
	estimatedCost: numeric("estimated_cost", { precision: 12, scale:  2 }),
	confidence: numeric({ precision: 3, scale:  2 }),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("auto_generated_projects_building_id_idx").using("btree", table.buildingId.asc().nullsLast().op("text_ops")),
	index("auto_generated_projects_element_id_idx").using("btree", table.elementId.asc().nullsLast().op("uuid_ops")),
	index("auto_generated_projects_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.suggestionId],
			foreignColumns: [evaluationSuggestions.id],
			name: "auto_generated_projects_suggestion_id_evaluation_suggestions_id"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "auto_generated_projects_building_id_buildings_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.elementId],
			foreignColumns: [buildingElements.id],
			name: "auto_generated_projects_element_id_building_elements_id_fk"
		}).onDelete("cascade"),
	unique("auto_generated_projects_unique_pending_per_element").on(table.elementId, table.status),
	check("auto_generated_projects_estimated_cost_check", sql`estimated_cost >= (0)::numeric`),
	check("auto_generated_projects_confidence_check", sql`(confidence >= (0)::numeric) AND (confidence <= (1)::numeric)`),
]);

export const projectNotifications = pgTable("project_notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull(),
	messageText: text("message_text").notNull(),
	timingType: timingType("timing_type").notNull(),
	customDaysBefore: integer("custom_days_before"),
	isSent: boolean("is_sent").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("project_notifications_is_sent_idx").using("btree", table.isSent.asc().nullsLast().op("bool_ops")),
	index("project_notifications_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [maintenanceProjects.id],
			name: "project_notifications_project_id_maintenance_projects_id_fk"
		}).onDelete("cascade"),
	check("project_notifications_custom_days_before_check", sql`custom_days_before > 0`),
]);

export const developmentPillars = pgTable("development_pillars", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	status: text().default('pending').notNull(),
	order: text().notNull(),
	configuration: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const frameworkConfiguration = pgTable("framework_configuration", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	key: text().notNull(),
	value: text().notNull(),
	description: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("framework_configuration_key_unique").on(table.key),
]);

export const qualityMetrics = pgTable("quality_metrics", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	metricType: text("metric_type").notNull(),
	value: text().notNull(),
	timestamp: timestamp({ mode: 'string' }).defaultNow(),
});

export const users = pgTable("users", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	username: text().notNull(),
	password: text().notNull(),
	language: varchar({ length: 10 }).default('fr').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	email: varchar({ length: 255 }).notNull(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	phone: varchar({ length: 20 }),
	role: userRole().default('tenant').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	profileImage: text("profile_image"),
	notificationsStartingDate: date("notifications_starting_date"),
}, (table) => [
	unique("users_username_unique").on(table.username),
	unique("users_email_unique").on(table.email),
]);

export const workflowTasks = pgTable("workflow_tasks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull(),
	phase: workflowPhase().notNull(),
	taskName: text("task_name").notNull(),
	description: text(),
	cost: numeric({ precision: 10, scale:  2 }),
	isCompleted: boolean("is_completed").default(false).notNull(),
	orderIndex: integer("order_index").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	dueDate: date("due_date"),
}, (table) => [
	index("workflow_tasks_order_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops"), table.orderIndex.asc().nullsLast().op("int4_ops")),
	index("workflow_tasks_project_phase_idx").using("btree", table.projectId.asc().nullsLast().op("enum_ops"), table.phase.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [maintenanceProjects.id],
			name: "workflow_tasks_project_id_maintenance_projects_id_fk"
		}).onDelete("cascade"),
	check("workflow_tasks_cost_check", sql`cost >= (0)::numeric`),
]);

export const actionableItems = pgTable("actionable_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	featureId: uuid("feature_id").notNull(),
	title: text().notNull(),
	description: text().notNull(),
	technicalDetails: text("technical_details"),
	implementationPrompt: text("implementation_prompt"),
	testingRequirements: text("testing_requirements"),
	estimatedEffort: text("estimated_effort"),
	dependencies: jsonb(),
	status: actionableItemStatus().default('pending').notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	orderIndex: integer("order_index").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	type: text().notNull(),
	estimatedHours: integer("estimated_hours"),
	actualHours: integer("actual_hours"),
	assignedTo: varchar("assigned_to"),
	acceptanceCriteria: text("acceptance_criteria"),
	implementationNotes: text("implementation_notes"),
	startedAt: timestamp("started_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.featureId],
			foreignColumns: [features.id],
			name: "actionable_items_feature_id_features_id_fk"
		}),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [users.id],
			name: "actionable_items_assigned_to_users_id_fk"
		}),
]);

export const workspaceStatus = pgTable("workspace_status", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	component: text().notNull(),
	status: text().default('pending').notNull(),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow(),
});

export const features = pgTable("features", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	category: featureCategory().notNull(),
	status: featureStatus().default('submitted').notNull(),
	priority: featurePriority().default('medium').notNull(),
	requestedBy: text("requested_by"),
	assignedTo: text("assigned_to"),
	estimatedHours: integer("estimated_hours"),
	actualHours: integer("actual_hours"),
	startDate: date("start_date"),
	completedDate: date("completed_date"),
	isPublicRoadmap: boolean("is_public_roadmap").default(true).notNull(),
	tags: jsonb(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	businessObjective: text("business_objective"),
	targetUsers: text("target_users"),
	successMetrics: text("success_metrics"),
	technicalComplexity: text("technical_complexity"),
	dependencies: text(),
	userFlow: text("user_flow"),
	aiAnalysisResult: jsonb("ai_analysis_result"),
	aiAnalyzedAt: timestamp("ai_analyzed_at", { mode: 'string' }),
	isStrategicPath: boolean("is_strategic_path").default(false).notNull(),
	syncedAt: timestamp("synced_at", { mode: 'string' }),
});

export const notifications = pgTable("notifications", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	type: notificationType().notNull(),
	title: text().notNull(),
	message: text().notNull(),
	relatedEntityId: varchar("related_entity_id"),
	relatedEntityType: text("related_entity_type"),
	isRead: boolean("is_read").default(false).notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notifications_user_id_users_id_fk"
		}),
]);

export const userPermissions = pgTable("user_permissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	permissionId: uuid("permission_id").notNull(),
	granted: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [permissions.id],
			name: "user_permissions_permission_id_permissions_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_permissions_user_id_users_id_fk"
		}),
]);

export const elementProjectUpdates = pgTable("element_project_updates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull(),
	elementId: uuid("element_id").notNull(),
	updateStatus: elementUpdateStatus("update_status").notNull(),
	actualCost: numeric("actual_cost", { precision: 10, scale:  2 }),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("element_project_updates_element_id_idx").using("btree", table.elementId.asc().nullsLast().op("uuid_ops")),
	index("element_project_updates_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [maintenanceProjects.id],
			name: "element_project_updates_project_id_maintenance_projects_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.elementId],
			foreignColumns: [buildingElements.id],
			name: "element_project_updates_element_id_building_elements_id_fk"
		}).onDelete("cascade"),
	unique("element_project_updates_unique_project_element").on(table.projectId, table.elementId),
	check("element_project_updates_actual_cost_check", sql`actual_cost >= (0)::numeric`),
]);

export const rolePermissions = pgTable("role_permissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	role: userRole().notNull(),
	permissionId: uuid("permission_id").notNull(),
	grantedBy: varchar("granted_by"),
	grantedAt: timestamp("granted_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [permissions.id],
			name: "role_permissions_permission_id_permissions_id_fk"
		}),
	foreignKey({
			columns: [table.grantedBy],
			foreignColumns: [users.id],
			name: "role_permissions_granted_by_users_id_fk"
		}),
]);

export const permissions = pgTable("permissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	displayName: text("display_name").notNull(),
	description: text(),
	resourceType: resourceType("resource_type").notNull(),
	action: action().notNull(),
	conditions: json(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("permissions_name_unique").on(table.name),
]);

export const invitationAuditLog = pgTable("invitation_audit_log", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	invitationId: varchar("invitation_id"),
	action: text().notNull(),
	performedBy: varchar("performed_by"),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	details: json(),
	previousStatus: invitationStatus("previous_status"),
	newStatus: invitationStatus("new_status"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.invitationId],
			foreignColumns: [invitations.id],
			name: "invitation_audit_log_invitation_id_invitations_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.performedBy],
			foreignColumns: [users.id],
			name: "invitation_audit_log_performed_by_users_id_fk"
		}),
]);

export const sslCertificates = pgTable("ssl_certificates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	domain: text().notNull(),
	certificateData: text("certificate_data").notNull(),
	privateKey: text("private_key").notNull(),
	certificateChain: text("certificate_chain"),
	issuer: text().notNull(),
	subject: text().notNull(),
	serialNumber: text("serial_number").notNull(),
	fingerprint: text().notNull(),
	validFrom: timestamp("valid_from", { mode: 'string' }).notNull(),
	validTo: timestamp("valid_to", { mode: 'string' }).notNull(),
	status: sslStatus().default('pending').notNull(),
	autoRenew: boolean("auto_renew").default(true).notNull(),
	lastRenewalAttempt: timestamp("last_renewal_attempt", { mode: 'string' }),
	renewalAttempts: integer("renewal_attempts").default(0).notNull(),
	maxRenewalAttempts: integer("max_renewal_attempts").default(3).notNull(),
	renewalError: text("renewal_error"),
	dnsProvider: text("dns_provider"),
	dnsCredentials: text("dns_credentials"),
	notificationEmails: text("notification_emails"),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	nextRenewalDate: timestamp("next_renewal_date", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "ssl_certificates_created_by_users_id_fk"
		}),
	unique("ssl_certificates_domain_unique").on(table.domain),
]);

export const notificationDispatchLog = pgTable("notification_dispatch_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	configurationId: uuid("configuration_id").notNull(),
	userId: varchar("user_id").notNull(),
	periodKey: text("period_key").notNull(),
	sentAt: timestamp("sent_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.configurationId],
			foreignColumns: [notificationConfigurations.id],
			name: "notification_dispatch_log_configuration_id_notification_configu"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_dispatch_log_user_id_users_id_fk"
		}),
	unique("notification_dispatch_log_configuration_id_user_id_period_key_u").on(table.configurationId, table.userId, table.periodKey),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	token: text().notNull(),
	tokenHash: text("token_hash").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { mode: 'string' }),
	isUsed: boolean("is_used").default(false).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "password_reset_tokens_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("password_reset_tokens_token_unique").on(table.token),
]);

export const invitations = pgTable("invitations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	email: text().notNull(),
	token: text().notNull(),
	role: userRole().notNull(),
	status: invitationStatus().default('pending').notNull(),
	invitedByUserId: varchar("invited_by_user_id").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	tokenHash: text("token_hash").notNull(),
	usageCount: integer("usage_count").default(0).notNull(),
	maxUsageCount: integer("max_usage_count").default(1).notNull(),
	personalMessage: text("personal_message"),
	invitationContext: json("invitation_context"),
	securityLevel: text("security_level"),
	requires2Fa: boolean("requires_2fa").default(false).notNull(),
	acceptedAt: timestamp("accepted_at", { mode: 'string' }),
	acceptedByUserId: varchar("accepted_by_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	organizationId: varchar("organization_id"),
	buildingId: varchar("building_id"),
	lastAccessedAt: timestamp("last_accessed_at", { mode: 'string' }),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	residenceId: text("residence_id"),
}, (table) => [
	unique("invitations_token_unique").on(table.token),
]);

export const userResidences = pgTable("user_residences", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	residenceId: varchar("residence_id").notNull(),
	relationshipType: text("relationship_type").notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date"),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_residences_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.residenceId],
			foreignColumns: [residences.id],
			name: "user_residences_residence_id_residences_id_fk"
		}).onDelete("cascade"),
]);

export const userOrganizations = pgTable("user_organizations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	organizationId: varchar("organization_id").notNull(),
	organizationRole: userRole("organization_role").default('tenant').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	canAccessAllOrganizations: boolean("can_access_all_organizations").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_organizations_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "user_organizations_organization_id_organizations_id_fk"
		}).onDelete("cascade"),
]);

export const residences = pgTable("residences", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	buildingId: varchar("building_id").notNull(),
	unitNumber: varchar("unit_number", { length: 20 }).notNull(),
	floor: integer(),
	squareFootage: numeric("square_footage", { precision: 8, scale:  2 }),
	bedrooms: integer(),
	bathrooms: numeric({ precision: 3, scale:  1 }),
	balcony: boolean().default(false),
	ownershipPercentage: numeric("ownership_percentage", { precision: 5, scale:  2 }),
	monthlyFees: numeric("monthly_fees", { precision: 10, scale:  2 }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	parkingSpaceNumbers: text("parking_space_numbers").array(),
	storageSpaceNumbers: text("storage_space_numbers").array(),
}, (table) => [
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "residences_building_id_buildings_id_fk"
		}).onDelete("cascade"),
]);

export const organizations = pgTable("organizations", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	type: text().notNull(),
	address: text().notNull(),
	city: varchar({ length: 100 }).notNull(),
	province: varchar({ length: 3 }).default('QC').notNull(),
	postalCode: varchar("postal_code", { length: 10 }).notNull(),
	phone: text(),
	email: varchar({ length: 255 }),
	website: text(),
	registrationNumber: text("registration_number"),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const contacts = pgTable("contacts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	email: text(),
	phone: text(),
	entity: contactEntity().notNull(),
	entityId: varchar("entity_id").notNull(),
	contactCategory: contactCategory("contact_category").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const budgets = pgTable("budgets", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	buildingId: varchar("building_id").notNull(),
	year: integer().notNull(),
	name: text().notNull(),
	description: text(),
	category: text().notNull(),
	budgetedAmount: numeric("budgeted_amount", { precision: 12, scale:  2 }).notNull(),
	actualAmount: numeric("actual_amount", { precision: 12, scale:  2 }).default('0'),
	variance: numeric({ precision: 12, scale:  2 }).default('0'),
	approvedBy: varchar("approved_by"),
	approvedDate: date("approved_date"),
	isActive: boolean("is_active").default(true).notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "budgets_approved_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "budgets_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "budgets_building_id_buildings_id_fk"
		}),
]);

export const demands = pgTable("demands", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	submitterId: varchar("submitter_id").notNull(),
	type: demandType().notNull(),
	assignationResidenceId: varchar("assignation_residence_id"),
	assignationBuildingId: varchar("assignation_building_id"),
	description: text().notNull(),
	residenceId: varchar("residence_id"),
	buildingId: varchar("building_id").notNull(),
	status: demandStatus().default('draft').notNull(),
	reviewedBy: varchar("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	reviewNotes: text("review_notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	filePath: text("file_path"),
	fileName: text("file_name"),
	fileSize: integer("file_size"),
}, (table) => [
	foreignKey({
			columns: [table.submitterId],
			foreignColumns: [users.id],
			name: "demands_submitter_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "demands_reviewed_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignationResidenceId],
			foreignColumns: [residences.id],
			name: "demands_assignation_residence_id_residences_id_fk"
		}),
	foreignKey({
			columns: [table.residenceId],
			foreignColumns: [residences.id],
			name: "demands_residence_id_residences_id_fk"
		}),
	foreignKey({
			columns: [table.assignationBuildingId],
			foreignColumns: [buildings.id],
			name: "demands_assignation_building_id_buildings_id_fk"
		}),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "demands_building_id_buildings_id_fk"
		}),
]);

export const notificationConfigurations = pgTable("notification_configurations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: varchar("organization_id").notNull(),
	buildingId: varchar("building_id").notNull(),
	createdBy: varchar("created_by").notNull(),
	type: notificationType().notNull(),
	title: text().notNull(),
	message: text().notNull(),
	frequency: frequency().notNull(),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	endsAt: timestamp("ends_at", { mode: 'string' }),
	timezone: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "notification_configurations_organization_id_organizations_id_fk"
		}),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "notification_configurations_building_id_buildings_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "notification_configurations_created_by_users_id_fk"
		}),
]);

export const buildings = pgTable("buildings", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	organizationId: varchar("organization_id").notNull(),
	name: varchar({ length: 200 }).notNull(),
	address: text().notNull(),
	city: varchar({ length: 100 }).notNull(),
	province: varchar({ length: 3 }).default('QC').notNull(),
	postalCode: varchar("postal_code", { length: 10 }).notNull(),
	buildingType: buildingType("building_type").notNull(),
	totalUnits: integer("total_units").notNull(),
	totalFloors: integer("total_floors"),
	parkingSpaces: integer("parking_spaces"),
	storageSpaces: integer("storage_spaces"),
	amenities: jsonb(),
	managementCompany: text("management_company"),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	bankAccountNumber: text("bank_account_number"),
	bankAccountNotes: text("bank_account_notes"),
	bankAccountUpdatedAt: timestamp("bank_account_updated_at", { mode: 'string' }),
	bankAccountStartDate: timestamp("bank_account_start_date", { mode: 'string' }),
	bankAccountStartAmount: numeric("bank_account_start_amount", { precision: 10, scale:  2 }),
	bankAccountMinimums: text("bank_account_minimums"),
	inflationSettings: text("inflation_settings"),
	generalInflationRate: numeric("general_inflation_rate", { precision: 5, scale:  2 }).default('2.0').notNull(),
	revenueInflationRate: numeric("revenue_inflation_rate", { precision: 5, scale:  2 }).default('2.0').notNull(),
	unplannedBillsAmount: numeric("unplanned_bills_amount", { precision: 10, scale:  2 }).default('0'),
	financialYearStart: date("financial_year_start"),
	unplannedBillsStartDate: date("unplanned_bills_start_date"),
	constructionDate: date("construction_date"),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "buildings_organization_id_organizations_id_fk"
		}).onDelete("cascade"),
]);

export const improvementSuggestions = pgTable("improvement_suggestions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	category: suggestionCategory().notNull(),
	priority: suggestionPriority().notNull(),
	status: suggestionStatus().default('New').notNull(),
	filePath: text("file_path"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	technicalDetails: text("technical_details"),
	businessImpact: text("business_impact"),
	implementationEffort: text("implementation_effort"),
	quebecComplianceRelevance: text("quebec_compliance_relevance"),
	suggestedBy: varchar("suggested_by"),
	assignedTo: varchar("assigned_to"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	acknowledgedAt: timestamp("acknowledged_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.suggestedBy],
			foreignColumns: [users.id],
			name: "improvement_suggestions_suggested_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [users.id],
			name: "improvement_suggestions_assigned_to_users_id_fk"
		}),
]);

export const bugs = pgTable("bugs", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	createdBy: varchar("created_by").notNull(),
	title: text().notNull(),
	description: text().notNull(),
	category: bugCategory().notNull(),
	page: text().notNull(),
	priority: bugPriority().default('medium').notNull(),
	status: bugStatus().default('new').notNull(),
	assignedTo: varchar("assigned_to"),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
	resolvedBy: varchar("resolved_by"),
	notes: text(),
	reproductionSteps: text("reproduction_steps"),
	environment: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	filePath: text("file_path"),
	fileName: text("file_name"),
	fileSize: integer("file_size"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "bugs_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [users.id],
			name: "bugs_assigned_to_users_id_fk"
		}),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [users.id],
			name: "bugs_resolved_by_users_id_fk"
		}),
]);

export const bills = pgTable("bills", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	buildingId: varchar("building_id").notNull(),
	billNumber: varchar("bill_number", { length: 50 }).notNull(),
	title: varchar({ length: 200 }).notNull(),
	description: text(),
	category: billCategory().notNull(),
	vendor: varchar({ length: 200 }),
	paymentType: paymentType("payment_type").notNull(),
	costs: numeric({ precision: 10, scale:  2 }).array().notNull(),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).notNull(),
	startDate: date("start_date").notNull(),
	status: billStatus().default('draft').notNull(),
	notes: text(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	schedulePayment: schedulePayment("schedule_payment"),
	scheduleCustom: date("schedule_custom").array(),
	endDate: date("end_date"),
	filePath: text("file_path"),
	fileName: text("file_name"),
	isAiAnalyzed: boolean("is_ai_analyzed").default(false),
	aiAnalysisData: jsonb("ai_analysis_data"),
	isAutoGenerated: boolean("is_auto_generated").default(false).notNull(),
	fileSize: integer("file_size"),
	sourceTemplateId: varchar("source_template_id"),
	autoGeneratedLabel: varchar("auto_generated_label"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "bills_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.sourceTemplateId],
			foreignColumns: [table.id],
			name: "bills_source_template_id_bills_id_fk"
		}),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "bills_building_id_buildings_id_fk"
		}),
	unique("bills_bill_number_unique").on(table.billNumber),
]);

export const monthlyBudgets = pgTable("monthly_budgets", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	buildingId: varchar("building_id").notNull(),
	year: integer().notNull(),
	month: integer().notNull(),
	incomeTypes: text("income_types").array().notNull(),
	incomes: numeric({ precision: 12, scale:  2 }).array().notNull(),
	spendingTypes: text("spending_types").array().notNull(),
	spendings: numeric({ precision: 12, scale:  2 }).array().notNull(),
	approved: boolean().default(false).notNull(),
	approvedBy: varchar("approved_by"),
	approvedDate: timestamp("approved_date", { mode: 'string' }),
	originalBudgetId: varchar("original_budget_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "monthly_budgets_approved_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "monthly_budgets_building_id_buildings_id_fk"
		}),
	foreignKey({
			columns: [table.originalBudgetId],
			foreignColumns: [table.id],
			name: "monthly_budgets_original_budget_id_monthly_budgets_id_fk"
		}),
]);

export const demandsComments = pgTable("demands_comments", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	demandId: uuid("demand_id").notNull(),
	commenterId: text("commenter_id").notNull(),
	commentText: text("comment_text").notNull(),
	commentType: text("comment_type"),
	isInternal: boolean("is_internal").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.demandId],
			foreignColumns: [demands.id],
			name: "demands_comments_demand_id_demands_id_fk"
		}),
	foreignKey({
			columns: [table.commenterId],
			foreignColumns: [users.id],
			name: "demands_comments_commenter_id_users_id_fk"
		}),
]);

export const commonSpaces = pgTable("common_spaces", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	buildingId: varchar("building_id").notNull(),
	isReservable: boolean("is_reservable").default(false).notNull(),
	capacity: integer(),
	contactPersonId: varchar("contact_person_id"),
	openingHours: jsonb("opening_hours"),
	bookingRules: text("booking_rules"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	availableDays: jsonb("available_days"),
	unavailablePeriods: jsonb("unavailable_periods"),
}, (table) => [
	foreignKey({
			columns: [table.contactPersonId],
			foreignColumns: [users.id],
			name: "common_spaces_contact_person_id_users_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "common_spaces_building_id_buildings_id_fk"
		}).onDelete("cascade"),
]);

export const documents = pgTable("documents", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	documentType: text("document_type").notNull(),
	filePath: text("file_path").notNull(),
	isVisibleToTenants: boolean("is_visible_to_tenants").default(false).notNull(),
	residenceId: varchar("residence_id"),
	buildingId: varchar("building_id"),
	uploadedById: varchar("uploaded_by_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	fileName: text("file_name"),
	fileSize: integer("file_size"),
	mimeType: text("mime_type"),
	attachedToType: text("attached_to_type"),
	attachedToId: varchar("attached_to_id"),
	isQuarantined: boolean("is_quarantined").default(false).notNull(),
	effectiveDate: timestamp("effective_date", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.residenceId],
			foreignColumns: [residences.id],
			name: "documents_residence_id_residences_id_fk"
		}),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "documents_building_id_buildings_id_fk"
		}),
	unique("documents_file_path_key").on(table.filePath),
]);

export const elementDocuments = pgTable("element_documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	elementId: uuid("element_id").notNull(),
	historyId: uuid("history_id"),
	documentType: documentType("document_type").notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	filePath: text("file_path").notNull(),
	fileSize: integer("file_size"),
	mimeType: varchar("mime_type", { length: 100 }),
	uploadedBy: text("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.elementId],
			foreignColumns: [buildingElements.id],
			name: "element_documents_element_id_building_elements_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.historyId],
			foreignColumns: [elementHistory.id],
			name: "element_documents_history_id_element_history_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "element_documents_uploaded_by_users_id_fk"
		}),
]);

export const userTimeLimits = pgTable("user_time_limits", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	commonSpaceId: varchar("common_space_id"),
	limitType: varchar("limit_type", { length: 20 }).notNull(),
	limitHours: integer("limit_hours").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_time_limits_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.commonSpaceId],
			foreignColumns: [commonSpaces.id],
			name: "user_time_limits_common_space_id_common_spaces_id_fk"
		}).onDelete("cascade"),
]);

export const bookings = pgTable("bookings", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	commonSpaceId: varchar("common_space_id").notNull(),
	userId: varchar("user_id").notNull(),
	startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }).notNull(),
	endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }).notNull(),
	status: bookingStatus().default('confirmed').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "bookings_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.commonSpaceId],
			foreignColumns: [commonSpaces.id],
			name: "bookings_common_space_id_common_spaces_id_fk"
		}).onDelete("cascade"),
]);

export const userBookingRestrictions = pgTable("user_booking_restrictions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	commonSpaceId: varchar("common_space_id").notNull(),
	isBlocked: boolean("is_blocked").default(true).notNull(),
	reason: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_booking_restrictions_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.commonSpaceId],
			foreignColumns: [commonSpaces.id],
			name: "user_booking_restrictions_common_space_id_common_spaces_id_fk"
		}).onDelete("cascade"),
]);

export const buildingElements = pgTable("building_elements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	buildingId: text("building_id").notNull(),
	uniformatCode: varchar("uniformat_code", { length: 10 }).notNull(),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	originalConstructionDate: date("original_construction_date"),
	originalLifespan: integer("original_lifespan"),
	currentLifespan: integer("current_lifespan"),
	currentCondition: elementCondition("current_condition").default('good').notNull(),
	lastInspectionDate: date("last_inspection_date"),
	nextEvaluationDate: date("next_evaluation_date"),
	unit: varchar({ length: 20 }),
	unitValue: numeric("unit_value", { precision: 10, scale:  2 }),
	notes: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	reconstructionCost: numeric("reconstruction_cost", { precision: 10, scale:  2 }),
	costEstimationDate: date("cost_estimation_date"),
	residenceId: text("residence_id"),
	access: elementAccess().default('not_restrained').notNull(),
	charge: elementCharge().default('common').notNull(),
}, (table) => [
	index("building_elements_building_id_idx").using("btree", table.buildingId.asc().nullsLast().op("text_ops")),
	index("building_elements_residence_id_idx").using("btree", table.residenceId.asc().nullsLast().op("text_ops")),
	index("building_elements_uniformat_code_idx").using("btree", table.uniformatCode.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "building_elements_building_id_buildings_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uniformatCode],
			foreignColumns: [uniformatCodes.code],
			name: "building_elements_uniformat_code_uniformat_codes_code_fk"
		}),
	unique("building_elements_uniformat_code_building_id_unique").on(table.buildingId, table.uniformatCode),
]);

export const maintenanceRequests = pgTable("maintenance_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	residenceId: varchar("residence_id").notNull(),
	submittedBy: varchar("submitted_by").notNull(),
	assignedTo: varchar("assigned_to"),
	title: text().notNull(),
	description: text().notNull(),
	category: text().notNull(),
	priority: maintenancePriority().default('medium').notNull(),
	status: maintenanceStatus().default('submitted').notNull(),
	estimatedCost: numeric("estimated_cost", { precision: 10, scale:  2 }),
	actualCost: numeric("actual_cost", { precision: 10, scale:  2 }),
	scheduledDate: timestamp("scheduled_date", { mode: 'string' }),
	completedDate: timestamp("completed_date", { mode: 'string' }),
	notes: text(),
	images: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.submittedBy],
			foreignColumns: [users.id],
			name: "maintenance_requests_submitted_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [users.id],
			name: "maintenance_requests_assigned_to_users_id_fk"
		}),
	foreignKey({
			columns: [table.residenceId],
			foreignColumns: [residences.id],
			name: "maintenance_requests_residence_id_residences_id_fk"
		}),
]);

export const featureRequestUpvotes = pgTable("feature_request_upvotes", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	featureRequestId: varchar("feature_request_id").notNull(),
	userId: varchar("user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "feature_request_upvotes_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.featureRequestId],
			foreignColumns: [featureRequests.id],
			name: "feature_request_upvotes_feature_request_id_feature_requests_id_"
		}),
]);

export const featureRequests = pgTable("feature_requests", {
	id: text().default(gen_random_uuid()).primaryKey().notNull(),
	createdBy: varchar("created_by").notNull(),
	title: text().notNull(),
	description: text().notNull(),
	need: text().notNull(),
	category: featureRequestCategory().notNull(),
	page: text().notNull(),
	status: featureRequestStatus().default('submitted').notNull(),
	upvoteCount: integer("upvote_count").default(0).notNull(),
	assignedTo: varchar("assigned_to"),
	reviewedBy: varchar("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	adminNotes: text("admin_notes"),
	mergedIntoId: varchar("merged_into_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	filePath: text("file_path"),
	fileName: text("file_name"),
	fileSize: integer("file_size"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "feature_requests_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [users.id],
			name: "feature_requests_assigned_to_users_id_fk"
		}),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "feature_requests_reviewed_by_users_id_fk"
		}),
]);

export const metricCalibrationData = pgTable("metric_calibration_data", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	metricType: metricType("metric_type").notNull(),
	calibrationModel: text("calibration_model").notNull(),
	trainingDataSize: integer("training_data_size").notNull(),
	accuracy: numeric({ precision: 5, scale:  4 }).notNull(),
	precision: numeric({ precision: 5, scale:  4 }).notNull(),
	recall: numeric({ precision: 5, scale:  4 }).notNull(),
	f1Score: numeric("f1_score", { precision: 5, scale:  4 }).notNull(),
	crossValidationScore: numeric("cross_validation_score", { precision: 5, scale:  4 }),
	featureImportance: jsonb("feature_importance"),
	hyperparameters: jsonb(),
	quebecSpecificFactors: jsonb("quebec_specific_factors"),
	lastTrainingDate: date("last_training_date").notNull(),
	modelVersion: text("model_version").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	performanceMetrics: jsonb("performance_metrics"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const metricEffectivenessTracking = pgTable("metric_effectiveness_tracking", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	metricType: metricType("metric_type").notNull(),
	calculatedValue: numeric("calculated_value", { precision: 10, scale:  4 }).notNull(),
	actualOutcome: text("actual_outcome").notNull(),
	accuracy: numeric({ precision: 5, scale:  4 }).notNull(),
	precision: numeric({ precision: 5, scale:  4 }).notNull(),
	recall: numeric({ precision: 5, scale:  4 }).notNull(),
	f1Score: numeric("f1_score", { precision: 5, scale:  4 }).notNull(),
	calibrationScore: numeric("calibration_score", { precision: 5, scale:  4 }),
	predictionConfidence: numeric("prediction_confidence", { precision: 5, scale:  4 }),
	validationDate: date("validation_date").notNull(),
	quebecComplianceImpact: boolean("quebec_compliance_impact").default(false).notNull(),
	propertyManagementContext: text("property_management_context"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const evaluationSuggestions = pgTable("evaluation_suggestions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	elementId: uuid("element_id").notNull(),
	suggestedDate: date("suggested_date").notNull(),
	suggestedType: suggestionType("suggested_type").notNull(),
	reason: text().notNull(),
	priority: priority().default('medium').notNull(),
	status: evaluationStatus().default('pending').notNull(),
	postponedTo: date("postponed_to"),
	projectId: uuid("project_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("evaluation_suggestions_element_id_idx").using("btree", table.elementId.asc().nullsLast().op("uuid_ops")),
	index("evaluation_suggestions_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	index("evaluation_suggestions_status_suggested_date_idx").using("btree", table.status.asc().nullsLast().op("date_ops"), table.suggestedDate.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.elementId],
			foreignColumns: [buildingElements.id],
			name: "evaluation_suggestions_element_id_building_elements_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [maintenanceProjects.id],
			name: "evaluation_suggestions_project_id_maintenance_projects_id_fk"
		}).onDelete("set null"),
]);

export const projectElements = pgTable("project_elements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull(),
	elementId: uuid("element_id").notNull(),
	workDescription: text("work_description"),
	lifespanImpact: integer("lifespan_impact"),
	costAllocation: numeric("cost_allocation", { precision: 10, scale:  2 }),
	projectType: projectType("project_type"),
	confirmed: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.elementId],
			foreignColumns: [buildingElements.id],
			name: "project_elements_element_id_building_elements_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [maintenanceProjects.id],
			name: "project_elements_project_id_maintenance_projects_id_fk"
		}).onDelete("cascade"),
	check("project_elements_cost_allocation_check", sql`cost_allocation >= (0)::numeric`),
]);

export const maintenanceProjects = pgTable("maintenance_projects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	buildingId: text("building_id").notNull(),
	suggestionId: uuid("suggestion_id"),
	projectNumber: varchar("project_number", { length: 50 }).notNull(),
	title: varchar({ length: 200 }).notNull(),
	type: projectType().notNull(),
	status: projectStatus().default('planned').notNull(),
	plannedStartDate: date("planned_start_date"),
	plannedEndDate: date("planned_end_date"),
	actualStartDate: date("actual_start_date"),
	actualEndDate: date("actual_end_date"),
	totalBudget: numeric("total_budget", { precision: 12, scale:  2 }),
	actualCost: numeric("actual_cost", { precision: 12, scale:  2 }).default('0'),
	priority: priority().default('medium').notNull(),
	createdBy: text("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	autoGeneratedId: uuid("auto_generated_id"),
	origin: projectOrigin().default('manual').notNull(),
	planningDescription: text("planning_description"),
	planningStartDate: date("planning_start_date"),
	estimatedCost: numeric("estimated_cost", { precision: 12, scale:  2 }),
	skipSubmission: boolean("skip_submission").default(false).notNull(),
	skipPreWork: boolean("skip_pre_work").default(false).notNull(),
	skipInProgress: boolean("skip_in_progress").default(false).notNull(),
	skipPostWork: boolean("skip_post_work").default(false).notNull(),
	completionSummary: text("completion_summary"),
	workStartDate: date("work_start_date"),
	isQuickProject: boolean("is_quick_project").default(false).notNull(),
	financialYear: integer("financial_year"),
}, (table) => [
	index("maintenance_projects_building_status_idx").using("btree", table.buildingId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.autoGeneratedId],
			foreignColumns: [autoGeneratedProjects.id],
			name: "maintenance_projects_auto_generated_id_auto_generated_projects_"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "maintenance_projects_building_id_buildings_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.suggestionId],
			foreignColumns: [evaluationSuggestions.id],
			name: "maintenance_projects_suggestion_id_evaluation_suggestions_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "maintenance_projects_created_by_users_id_fk"
		}),
	unique("maintenance_projects_project_number_unique").on(table.projectNumber),
	check("maintenance_projects_total_budget_check", sql`total_budget >= (0)::numeric`),
	check("maintenance_projects_actual_cost_check", sql`actual_cost >= (0)::numeric`),
	check("maintenance_projects_estimated_cost_check", sql`estimated_cost >= (0)::numeric`),
]);

export const metricPredictions = pgTable("metric_predictions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	metricType: metricType("metric_type").notNull(),
	predictedValue: numeric("predicted_value", { precision: 10, scale:  4 }).notNull(),
	confidenceLevel: numeric("confidence_level", { precision: 5, scale:  4 }).notNull(),
	thresholdUsed: numeric("threshold_used", { precision: 10, scale:  4 }).notNull(),
	contextData: jsonb("context_data"),
	predictionReason: text("prediction_reason"),
	expectedSeverity: issueSeverity("expected_severity").notNull(),
	quebecComplianceRelevant: boolean("quebec_compliance_relevant").default(false).notNull(),
	propertyManagementCategory: text("property_management_category"),
	filePath: text("file_path"),
	lineNumber: integer("line_number"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const predictionValidations = pgTable("prediction_validations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	predictionId: uuid("prediction_id").notNull(),
	validationStatus: validationStatus("validation_status").notNull(),
	actualOutcome: text("actual_outcome").notNull(),
	validationMethod: text("validation_method").notNull(),
	validatorId: varchar("validator_id"),
	timeTaken: integer("time_taken"),
	impactLevel: issueSeverity("impact_level"),
	resolutionActions: text("resolution_actions"),
	quebecComplianceNotes: text("quebec_compliance_notes"),
	costImpact: numeric("cost_impact", { precision: 10, scale:  2 }),
	validatedAt: timestamp("validated_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.validatorId],
			foreignColumns: [users.id],
			name: "prediction_validations_validator_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.predictionId],
			foreignColumns: [metricPredictions.id],
			name: "prediction_validations_prediction_id_metric_predictions_id_fk"
		}),
]);

export const qualityIssues = pgTable("quality_issues", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	category: text().notNull(),
	severity: issueSeverity().notNull(),
	filePath: text("file_path").notNull(),
	lineNumber: integer("line_number"),
	detectionMethod: text("detection_method").notNull(),
	detectedBy: varchar("detected_by"),
	relatedMetricType: metricType("related_metric_type"),
	wasPredicted: boolean("was_predicted").default(false).notNull(),
	predictionId: uuid("prediction_id"),
	resolutionStatus: text("resolution_status").default('open').notNull(),
	resolutionTime: integer("resolution_time"),
	resolutionActions: text("resolution_actions"),
	quebecComplianceRelated: boolean("quebec_compliance_related").default(false).notNull(),
	propertyManagementImpact: text("property_management_impact"),
	costToFix: numeric("cost_to_fix", { precision: 10, scale:  2 }),
	actualCost: numeric("actual_cost", { precision: 10, scale:  2 }),
	discoveredAt: timestamp("discovered_at", { mode: 'string' }).notNull(),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.detectedBy],
			foreignColumns: [users.id],
			name: "quality_issues_detected_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.predictionId],
			foreignColumns: [metricPredictions.id],
			name: "quality_issues_prediction_id_metric_predictions_id_fk"
		}),
]);

export const elementHistory = pgTable("element_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	elementId: uuid("element_id").notNull(),
	eventType: eventType("event_type").notNull(),
	eventDate: date("event_date").notNull(),
	vendorId: uuid("vendor_id"),
	vendorName: varchar("vendor_name", { length: 200 }),
	cost: numeric({ precision: 10, scale:  2 }),
	warranty: jsonb(),
	lifespanImpact: integer("lifespan_impact"),
	workDescription: text("work_description").notNull(),
	createdBy: text("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("element_history_element_id_idx").using("btree", table.elementId.asc().nullsLast().op("uuid_ops")),
	index("element_history_event_date_idx").using("btree", table.eventDate.asc().nullsLast().op("date_ops")),
	index("element_history_vendor_id_idx").using("btree", table.vendorId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.elementId],
			foreignColumns: [buildingElements.id],
			name: "element_history_element_id_building_elements_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "element_history_vendor_id_vendors_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "element_history_created_by_users_id_fk"
		}),
	check("element_history_cost_check", sql`cost >= (0)::numeric`),
]);
