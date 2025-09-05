import { pgTable, varchar, text, jsonb, timestamp, unique, uuid, integer, date, boolean, foreignKey, json, numeric, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const action = pgEnum("action", ['read', 'create', 'update', 'delete', 'manage', 'approve', 'assign', 'share', 'export', 'backup', 'restore'])
export const actionableItemStatus = pgEnum("actionable_item_status", ['pending', 'in-progress', 'completed', 'blocked'])
export const billCategory = pgEnum("bill_category", ['insurance', 'maintenance', 'salary', 'utilities', 'cleaning', 'security', 'landscaping', 'professional_services', 'administration', 'repairs', 'supplies', 'taxes', 'technology', 'reserves', 'other'])
export const billStatus = pgEnum("bill_status", ['draft', 'sent', 'overdue', 'paid', 'cancelled'])
export const bookingStatus = pgEnum("booking_status", ['confirmed', 'cancelled'])
export const bugCategory = pgEnum("bug_category", ['ui_ux', 'functionality', 'performance', 'data', 'security', 'integration', 'other'])
export const bugPriority = pgEnum("bug_priority", ['low', 'medium', 'high', 'critical'])
export const bugStatus = pgEnum("bug_status", ['new', 'acknowledged', 'in_progress', 'resolved', 'closed'])
export const buildingType = pgEnum("building_type", ['apartment', 'condo', 'rental'])
export const contactCategory = pgEnum("contact_category", ['resident', 'manager', 'tenant', 'maintenance', 'emergency', 'other'])
export const contactEntity = pgEnum("contact_entity", ['organization', 'building', 'residence'])
export const demandStatus = pgEnum("demand_status", ['draft', 'submitted', 'under_review', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled'])
export const demandType = pgEnum("demand_type", ['maintenance', 'complaint', 'information', 'other'])
export const featureCategory = pgEnum("feature_category", ['Dashboard & Home', 'Property Management', 'Resident Management', 'Financial Management', 'Maintenance & Requests', 'Document Management', 'Communication', 'AI & Automation', 'Compliance & Security', 'Analytics & Reporting', 'Integration & API', 'Infrastructure & Performance', 'Website'])
export const featurePriority = pgEnum("feature_priority", ['low', 'medium', 'high', 'critical'])
export const featureRequestCategory = pgEnum("feature_request_category", ['dashboard', 'property_management', 'resident_management', 'financial_management', 'maintenance', 'document_management', 'communication', 'reports', 'mobile_app', 'integrations', 'security', 'performance', 'other'])
export const featureRequestStatus = pgEnum("feature_request_status", ['submitted', 'under_review', 'planned', 'in_progress', 'completed', 'rejected'])
export const featureStatus = pgEnum("feature_status", ['submitted', 'planned', 'in-progress', 'ai-analyzed', 'completed', 'cancelled'])
export const invitationStatus = pgEnum("invitation_status", ['pending', 'accepted', 'expired', 'cancelled'])
export const issueSeverity = pgEnum("issue_severity", ['info', 'low', 'medium', 'high', 'critical', 'quebec_compliance'])
export const maintenancePriority = pgEnum("maintenance_priority", ['low', 'medium', 'high', 'urgent', 'emergency'])
export const maintenanceStatus = pgEnum("maintenance_status", ['submitted', 'acknowledged', 'in_progress', 'completed', 'cancelled'])
export const metricType = pgEnum("metric_type", ['code_coverage', 'code_quality', 'security_vulnerabilities', 'build_time', 'translation_coverage', 'api_response_time', 'memory_usage', 'bundle_size', 'database_query_time', 'page_load_time', 'accessibility_score', 'seo_score', 'quebec_compliance_score'])
export const notificationType = pgEnum("notification_type", ['bill_reminder', 'maintenance_update', 'announcement', 'system', 'emergency'])
export const oldBillType = pgEnum("old_bill_type", ['condo_fees', 'special_assessment', 'utility', 'maintenance', 'other'])
export const paymentType = pgEnum("payment_type", ['unique', 'recurrent'])
export const resourceType = pgEnum("resource_type", ['user', 'users', 'organization', 'building', 'residence', 'bill', 'budget', 'maintenance_request', 'document', 'audit_log', 'system_settings', 'development_pillar', 'quality_metric', 'feature', 'actionable_item', 'improvement_suggestion'])
export const schedulePayment = pgEnum("schedule_payment", ['weekly', 'monthly', 'quarterly', 'yearly', 'custom'])
export const sslStatus = pgEnum("ssl_status", ['active', 'pending', 'expired', 'revoked', 'failed'])
export const suggestionCategory = pgEnum("suggestion_category", ['Code Quality', 'Security', 'Testing', 'Documentation', 'Performance', 'Continuous Improvement', 'Replit AI Agent Monitoring', 'Replit App'])
export const suggestionPriority = pgEnum("suggestion_priority", ['Low', 'Medium', 'High', 'Critical'])
export const suggestionStatus = pgEnum("suggestion_status", ['New', 'Acknowledged', 'Done'])
export const userRole = pgEnum("user_role", ['admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident'])
export const validationStatus = pgEnum("validation_status", ['pending', 'true_positive', 'false_positive', 'true_negative', 'false_negative'])


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
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("framework_configuration_key_unique").on(table.key),
]);

export const qualityMetrics = pgTable("quality_metrics", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	metricType: text("metric_type").notNull(),
	value: text().notNull(),
	timestamp: timestamp({ mode: 'string' }).defaultNow(),
});

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

export const improvementSuggestions = pgTable("improvement_suggestions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	category: suggestionCategory().notNull(),
	priority: suggestionPriority().notNull(),
	status: suggestionStatus().default('New').notNull(),
	filePath: text("file_path"),
	technicalDetails: text("technical_details"),
	businessImpact: text("business_impact"),
	implementationEffort: text("implementation_effort"),
	quebecComplianceRelevance: text("quebec_compliance_relevance"),
	suggestedBy: varchar("suggested_by"),
	assignedTo: varchar("assigned_to"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
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

export const featureRequestUpvotes = pgTable("feature_request_upvotes", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
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

export const bugs = pgTable("bugs", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
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

export const featureRequests = pgTable("feature_requests", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
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

export const organizations = pgTable("organizations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	type: text().notNull(),
	address: text().notNull(),
	city: text().notNull(),
	province: text().default('QC').notNull(),
	postalCode: text("postal_code").notNull(),
	phone: text(),
	email: text(),
	website: text(),
	registrationNumber: text("registration_number"),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

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
	organizationId: varchar("organization_id"),
	buildingId: varchar("building_id"),
	residenceId: text("residence_id"),
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
	lastAccessedAt: timestamp("last_accessed_at", { mode: 'string' }),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
}, (table) => [
	unique("invitations_token_unique").on(table.token),
]);

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

export const buildings = pgTable("buildings", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	organizationId: varchar("organization_id").notNull(),
	name: text().notNull(),
	address: text().notNull(),
	city: text().notNull(),
	province: text().default('QC').notNull(),
	postalCode: text("postal_code").notNull(),
	buildingType: buildingType("building_type").notNull(),
	yearBuilt: integer("year_built"),
	totalUnits: integer("total_units").notNull(),
	totalFloors: integer("total_floors"),
	parkingSpaces: integer("parking_spaces"),
	storageSpaces: integer("storage_spaces"),
	amenities: jsonb(),
	managementCompany: text("management_company"),
	bankAccountNumber: text("bank_account_number"),
	bankAccountNotes: text("bank_account_notes"),
	bankAccountUpdatedAt: timestamp("bank_account_updated_at", { mode: 'string' }),
	bankAccountStartDate: timestamp("bank_account_start_date", { mode: 'string' }),
	bankAccountStartAmount: numeric("bank_account_start_amount", { precision: 10, scale:  2 }),
	bankAccountMinimums: text("bank_account_minimums"),
	inflationSettings: text("inflation_settings"),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "buildings_organization_id_organizations_id_fk"
		}).onDelete("cascade"),
]);

export const residences = pgTable("residences", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	buildingId: varchar("building_id").notNull(),
	unitNumber: text("unit_number").notNull(),
	floor: integer(),
	squareFootage: numeric("square_footage", { precision: 8, scale:  2 }),
	bedrooms: integer(),
	bathrooms: numeric({ precision: 3, scale:  1 }),
	balcony: boolean().default(false),
	parkingSpaceNumbers: text("parking_space_numbers").array(),
	storageSpaceNumbers: text("storage_space_numbers").array(),
	ownershipPercentage: numeric("ownership_percentage", { precision: 5, scale:  2 }),
	monthlyFees: numeric("monthly_fees", { precision: 10, scale:  2 }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "residences_building_id_buildings_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	username: text().notNull(),
	email: text().notNull(),
	password: text().notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	phone: text(),
	profileImage: text("profile_image"),
	language: text().default('fr').notNull(),
	role: userRole().default('tenant').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_username_unique").on(table.username),
	unique("users_email_unique").on(table.email),
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
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_permissions_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [permissions.id],
			name: "user_permissions_permission_id_permissions_id_fk"
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
}, (table) => [
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "common_spaces_building_id_buildings_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.contactPersonId],
			foreignColumns: [users.id],
			name: "common_spaces_contact_person_id_users_id_fk"
		}).onDelete("set null"),
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

export const budgets = pgTable("budgets", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
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
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "budgets_building_id_buildings_id_fk"
		}),
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
]);

export const monthlyBudgets = pgTable("monthly_budgets", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
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
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "monthly_budgets_building_id_buildings_id_fk"
		}),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "monthly_budgets_approved_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.originalBudgetId],
			foreignColumns: [table.id],
			name: "monthly_budgets_original_budget_id_monthly_budgets_id_fk"
		}),
]);

export const oldBills = pgTable("old_bills", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	residenceId: varchar("residence_id").notNull(),
	billNumber: text("bill_number").notNull(),
	type: oldBillType().notNull(),
	description: text().notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	dueDate: date("due_date").notNull(),
	issueDate: date("issue_date").notNull(),
	status: billStatus().default('draft').notNull(),
	notes: text(),
	lateFeeAmount: numeric("late_fee_amount", { precision: 10, scale:  2 }),
	discountAmount: numeric("discount_amount", { precision: 10, scale:  2 }),
	finalAmount: numeric("final_amount", { precision: 12, scale:  2 }).notNull(),
	paymentReceivedDate: date("payment_received_date"),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.residenceId],
			foreignColumns: [residences.id],
			name: "old_bills_residence_id_residences_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "old_bills_created_by_users_id_fk"
		}),
	unique("old_bills_bill_number_unique").on(table.billNumber),
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

export const bills = pgTable("bills", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	buildingId: varchar("building_id").notNull(),
	billNumber: text("bill_number").notNull(),
	title: text().notNull(),
	description: text(),
	category: billCategory().notNull(),
	vendor: text(),
	paymentType: paymentType("payment_type").notNull(),
	schedulePayment: schedulePayment("schedule_payment"),
	scheduleCustom: date("schedule_custom").array(),
	costs: numeric({ precision: 12, scale:  2 }).array().notNull(),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }).notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date"),
	status: billStatus().default('draft').notNull(),
	documentPath: text("document_path"),
	documentName: text("document_name"),
	isAiAnalyzed: boolean("is_ai_analyzed").default(false),
	aiAnalysisData: jsonb("ai_analysis_data"),
	notes: text(),
	autoGenerated: boolean("auto_generated").default(false).notNull(),
	reference: varchar(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "bills_building_id_buildings_id_fk"
		}),
	foreignKey({
			columns: [table.reference],
			foreignColumns: [table.id],
			name: "bills_reference_bills_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "bills_created_by_users_id_fk"
		}),
	unique("bills_bill_number_unique").on(table.billNumber),
]);

export const notifications = pgTable("notifications", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
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
			columns: [table.residenceId],
			foreignColumns: [residences.id],
			name: "maintenance_requests_residence_id_residences_id_fk"
		}),
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
	attachments: text().array(),
}, (table) => [
	foreignKey({
			columns: [table.submitterId],
			foreignColumns: [users.id],
			name: "demands_submitter_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignationResidenceId],
			foreignColumns: [residences.id],
			name: "demands_assignation_residence_id_residences_id_fk"
		}),
	foreignKey({
			columns: [table.assignationBuildingId],
			foreignColumns: [buildings.id],
			name: "demands_assignation_building_id_buildings_id_fk"
		}),
	foreignKey({
			columns: [table.residenceId],
			foreignColumns: [residences.id],
			name: "demands_residence_id_residences_id_fk"
		}),
	foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildings.id],
			name: "demands_building_id_buildings_id_fk"
		}),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "demands_reviewed_by_users_id_fk"
		}),
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

export const sslCertificates = pgTable("ssl_certificates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	domain: text().notNull(),
	certificateData: text("certificate_data").notNull(),
	privateKey: text("private_key").notNull(),
	issuer: text().notNull(),
	subject: text().notNull(),
	serialNumber: text("serial_number").notNull(),
	fingerprint: text().notNull(),
	validFrom: timestamp("valid_from", { mode: 'string' }).notNull(),
	validTo: timestamp("valid_to", { mode: 'string' }).notNull(),
	status: sslStatus().default('pending').notNull(),
	autoRenew: boolean("auto_renew").default(true).notNull(),
	renewalAttempts: integer("renewal_attempts").default(0).notNull(),
	maxRenewalAttempts: integer("max_renewal_attempts").default(3).notNull(),
	dnsProvider: text("dns_provider"),
	lastRenewalAttempt: timestamp("last_renewal_attempt", { mode: 'string' }),
	nextRenewalDate: timestamp("next_renewal_date", { mode: 'string' }),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	certificateChain: text("certificate_chain"),
	renewalError: text("renewal_error"),
	dnsCredentials: text("dns_credentials"),
	notificationEmails: text("notification_emails"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "ssl_certificates_created_by_users_id_fk"
		}),
	unique("ssl_certificates_domain_unique").on(table.domain),
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
			columns: [table.commonSpaceId],
			foreignColumns: [commonSpaces.id],
			name: "bookings_common_space_id_common_spaces_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "bookings_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

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
			columns: [table.predictionId],
			foreignColumns: [metricPredictions.id],
			name: "prediction_validations_prediction_id_metric_predictions_id_fk"
		}),
	foreignKey({
			columns: [table.validatorId],
			foreignColumns: [users.id],
			name: "prediction_validations_validator_id_users_id_fk"
		}),
]);

export const actionableItems = pgTable("actionable_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	featureId: uuid("feature_id").notNull(),
	title: text().notNull(),
	description: text().notNull(),
	type: text().notNull(),
	status: actionableItemStatus().default('pending').notNull(),
	estimatedHours: integer("estimated_hours"),
	actualHours: integer("actual_hours"),
	assignedTo: varchar("assigned_to"),
	dependencies: jsonb(),
	acceptanceCriteria: text("acceptance_criteria"),
	implementationNotes: text("implementation_notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	technicalDetails: text("technical_details"),
	implementationPrompt: text("implementation_prompt"),
	testingRequirements: text("testing_requirements"),
	estimatedEffort: text("estimated_effort"),
	orderIndex: integer("order_index").default(0).notNull(),
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

export const rolePermissions = pgTable("role_permissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	role: userRole().notNull(),
	permissionId: uuid("permission_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	grantedBy: varchar("granted_by"),
	grantedAt: timestamp("granted_at", { mode: 'string' }).defaultNow(),
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

export const session = pgTable("session", {
	sid: varchar().primaryKey().notNull(),
	sess: json().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
});

export const documents = pgTable("documents", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
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
	fileSize: varchar("file_size"),
	mimeType: text("mime_type"),
	attachedToType: text("attached_to_type"),
	attachedToId: varchar("attached_to_id"),
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
	unique("documents_file_path_unique").on(table.filePath),
]);
