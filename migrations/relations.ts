import { relations } from "drizzle-orm/relations";
import { users, improvementSuggestions, featureRequestUpvotes, featureRequests, bugs, passwordResetTokens, userBookingRestrictions, commonSpaces, organizations, buildings, residences, userPermissions, permissions, userOrganizations, userTimeLimits, budgets, monthlyBudgets, oldBills, userResidences, bills, notifications, maintenanceRequests, demands, qualityIssues, metricPredictions, sslCertificates, invitations, invitationAuditLog, bookings, predictionValidations, features, actionableItems, rolePermissions, demandsComments, documents } from "./schema";

export const improvementSuggestionsRelations = relations(improvementSuggestions, ({one}) => ({
	user_suggestedBy: one(users, {
		fields: [improvementSuggestions.suggestedBy],
		references: [users.id],
		relationName: "improvementSuggestions_suggestedBy_users_id"
	}),
	user_assignedTo: one(users, {
		fields: [improvementSuggestions.assignedTo],
		references: [users.id],
		relationName: "improvementSuggestions_assignedTo_users_id"
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	improvementSuggestions_suggestedBy: many(improvementSuggestions, {
		relationName: "improvementSuggestions_suggestedBy_users_id"
	}),
	improvementSuggestions_assignedTo: many(improvementSuggestions, {
		relationName: "improvementSuggestions_assignedTo_users_id"
	}),
	featureRequestUpvotes: many(featureRequestUpvotes),
	bugs_createdBy: many(bugs, {
		relationName: "bugs_createdBy_users_id"
	}),
	bugs_assignedTo: many(bugs, {
		relationName: "bugs_assignedTo_users_id"
	}),
	bugs_resolvedBy: many(bugs, {
		relationName: "bugs_resolvedBy_users_id"
	}),
	featureRequests_createdBy: many(featureRequests, {
		relationName: "featureRequests_createdBy_users_id"
	}),
	featureRequests_assignedTo: many(featureRequests, {
		relationName: "featureRequests_assignedTo_users_id"
	}),
	featureRequests_reviewedBy: many(featureRequests, {
		relationName: "featureRequests_reviewedBy_users_id"
	}),
	passwordResetTokens: many(passwordResetTokens),
	userBookingRestrictions: many(userBookingRestrictions),
	userPermissions: many(userPermissions),
	commonSpaces: many(commonSpaces),
	userOrganizations: many(userOrganizations),
	userTimeLimits: many(userTimeLimits),
	budgets_approvedBy: many(budgets, {
		relationName: "budgets_approvedBy_users_id"
	}),
	budgets_createdBy: many(budgets, {
		relationName: "budgets_createdBy_users_id"
	}),
	monthlyBudgets: many(monthlyBudgets),
	oldBills: many(oldBills),
	userResidences: many(userResidences),
	bills: many(bills),
	notifications: many(notifications),
	maintenanceRequests_submittedBy: many(maintenanceRequests, {
		relationName: "maintenanceRequests_submittedBy_users_id"
	}),
	maintenanceRequests_assignedTo: many(maintenanceRequests, {
		relationName: "maintenanceRequests_assignedTo_users_id"
	}),
	demands_submitterId: many(demands, {
		relationName: "demands_submitterId_users_id"
	}),
	demands_reviewedBy: many(demands, {
		relationName: "demands_reviewedBy_users_id"
	}),
	qualityIssues: many(qualityIssues),
	sslCertificates: many(sslCertificates),
	invitationAuditLogs: many(invitationAuditLog),
	bookings: many(bookings),
	predictionValidations: many(predictionValidations),
	actionableItems: many(actionableItems),
	rolePermissions: many(rolePermissions),
	demandsComments: many(demandsComments),
}));

export const featureRequestUpvotesRelations = relations(featureRequestUpvotes, ({one}) => ({
	user: one(users, {
		fields: [featureRequestUpvotes.userId],
		references: [users.id]
	}),
	featureRequest: one(featureRequests, {
		fields: [featureRequestUpvotes.featureRequestId],
		references: [featureRequests.id]
	}),
}));

export const featureRequestsRelations = relations(featureRequests, ({one, many}) => ({
	featureRequestUpvotes: many(featureRequestUpvotes),
	user_createdBy: one(users, {
		fields: [featureRequests.createdBy],
		references: [users.id],
		relationName: "featureRequests_createdBy_users_id"
	}),
	user_assignedTo: one(users, {
		fields: [featureRequests.assignedTo],
		references: [users.id],
		relationName: "featureRequests_assignedTo_users_id"
	}),
	user_reviewedBy: one(users, {
		fields: [featureRequests.reviewedBy],
		references: [users.id],
		relationName: "featureRequests_reviewedBy_users_id"
	}),
}));

export const bugsRelations = relations(bugs, ({one}) => ({
	user_createdBy: one(users, {
		fields: [bugs.createdBy],
		references: [users.id],
		relationName: "bugs_createdBy_users_id"
	}),
	user_assignedTo: one(users, {
		fields: [bugs.assignedTo],
		references: [users.id],
		relationName: "bugs_assignedTo_users_id"
	}),
	user_resolvedBy: one(users, {
		fields: [bugs.resolvedBy],
		references: [users.id],
		relationName: "bugs_resolvedBy_users_id"
	}),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({one}) => ({
	user: one(users, {
		fields: [passwordResetTokens.userId],
		references: [users.id]
	}),
}));

export const userBookingRestrictionsRelations = relations(userBookingRestrictions, ({one}) => ({
	user: one(users, {
		fields: [userBookingRestrictions.userId],
		references: [users.id]
	}),
	commonSpace: one(commonSpaces, {
		fields: [userBookingRestrictions.commonSpaceId],
		references: [commonSpaces.id]
	}),
}));

export const commonSpacesRelations = relations(commonSpaces, ({one, many}) => ({
	userBookingRestrictions: many(userBookingRestrictions),
	building: one(buildings, {
		fields: [commonSpaces.buildingId],
		references: [buildings.id]
	}),
	user: one(users, {
		fields: [commonSpaces.contactPersonId],
		references: [users.id]
	}),
	userTimeLimits: many(userTimeLimits),
	bookings: many(bookings),
}));

export const buildingsRelations = relations(buildings, ({one, many}) => ({
	organization: one(organizations, {
		fields: [buildings.organizationId],
		references: [organizations.id]
	}),
	residences: many(residences),
	commonSpaces: many(commonSpaces),
	budgets: many(budgets),
	monthlyBudgets: many(monthlyBudgets),
	bills: many(bills),
	demands_assignationBuildingId: many(demands, {
		relationName: "demands_assignationBuildingId_buildings_id"
	}),
	demands_buildingId: many(demands, {
		relationName: "demands_buildingId_buildings_id"
	}),
	documents: many(documents),
}));

export const organizationsRelations = relations(organizations, ({many}) => ({
	buildings: many(buildings),
	userOrganizations: many(userOrganizations),
}));

export const residencesRelations = relations(residences, ({one, many}) => ({
	building: one(buildings, {
		fields: [residences.buildingId],
		references: [buildings.id]
	}),
	oldBills: many(oldBills),
	userResidences: many(userResidences),
	maintenanceRequests: many(maintenanceRequests),
	demands_assignationResidenceId: many(demands, {
		relationName: "demands_assignationResidenceId_residences_id"
	}),
	demands_residenceId: many(demands, {
		relationName: "demands_residenceId_residences_id"
	}),
	documents: many(documents),
}));

export const userPermissionsRelations = relations(userPermissions, ({one}) => ({
	user: one(users, {
		fields: [userPermissions.userId],
		references: [users.id]
	}),
	permission: one(permissions, {
		fields: [userPermissions.permissionId],
		references: [permissions.id]
	}),
}));

export const permissionsRelations = relations(permissions, ({many}) => ({
	userPermissions: many(userPermissions),
	rolePermissions: many(rolePermissions),
}));

export const userOrganizationsRelations = relations(userOrganizations, ({one}) => ({
	user: one(users, {
		fields: [userOrganizations.userId],
		references: [users.id]
	}),
	organization: one(organizations, {
		fields: [userOrganizations.organizationId],
		references: [organizations.id]
	}),
}));

export const userTimeLimitsRelations = relations(userTimeLimits, ({one}) => ({
	user: one(users, {
		fields: [userTimeLimits.userId],
		references: [users.id]
	}),
	commonSpace: one(commonSpaces, {
		fields: [userTimeLimits.commonSpaceId],
		references: [commonSpaces.id]
	}),
}));

export const budgetsRelations = relations(budgets, ({one}) => ({
	building: one(buildings, {
		fields: [budgets.buildingId],
		references: [buildings.id]
	}),
	user_approvedBy: one(users, {
		fields: [budgets.approvedBy],
		references: [users.id],
		relationName: "budgets_approvedBy_users_id"
	}),
	user_createdBy: one(users, {
		fields: [budgets.createdBy],
		references: [users.id],
		relationName: "budgets_createdBy_users_id"
	}),
}));

export const monthlyBudgetsRelations = relations(monthlyBudgets, ({one, many}) => ({
	building: one(buildings, {
		fields: [monthlyBudgets.buildingId],
		references: [buildings.id]
	}),
	user: one(users, {
		fields: [monthlyBudgets.approvedBy],
		references: [users.id]
	}),
	monthlyBudget: one(monthlyBudgets, {
		fields: [monthlyBudgets.originalBudgetId],
		references: [monthlyBudgets.id],
		relationName: "monthlyBudgets_originalBudgetId_monthlyBudgets_id"
	}),
	monthlyBudgets: many(monthlyBudgets, {
		relationName: "monthlyBudgets_originalBudgetId_monthlyBudgets_id"
	}),
}));

export const oldBillsRelations = relations(oldBills, ({one}) => ({
	residence: one(residences, {
		fields: [oldBills.residenceId],
		references: [residences.id]
	}),
	user: one(users, {
		fields: [oldBills.createdBy],
		references: [users.id]
	}),
}));

export const userResidencesRelations = relations(userResidences, ({one}) => ({
	user: one(users, {
		fields: [userResidences.userId],
		references: [users.id]
	}),
	residence: one(residences, {
		fields: [userResidences.residenceId],
		references: [residences.id]
	}),
}));

export const billsRelations = relations(bills, ({one, many}) => ({
	building: one(buildings, {
		fields: [bills.buildingId],
		references: [buildings.id]
	}),
	bill: one(bills, {
		fields: [bills.reference],
		references: [bills.id],
		relationName: "bills_reference_bills_id"
	}),
	bills: many(bills, {
		relationName: "bills_reference_bills_id"
	}),
	user: one(users, {
		fields: [bills.createdBy],
		references: [users.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));

export const maintenanceRequestsRelations = relations(maintenanceRequests, ({one}) => ({
	residence: one(residences, {
		fields: [maintenanceRequests.residenceId],
		references: [residences.id]
	}),
	user_submittedBy: one(users, {
		fields: [maintenanceRequests.submittedBy],
		references: [users.id],
		relationName: "maintenanceRequests_submittedBy_users_id"
	}),
	user_assignedTo: one(users, {
		fields: [maintenanceRequests.assignedTo],
		references: [users.id],
		relationName: "maintenanceRequests_assignedTo_users_id"
	}),
}));

export const demandsRelations = relations(demands, ({one, many}) => ({
	user_submitterId: one(users, {
		fields: [demands.submitterId],
		references: [users.id],
		relationName: "demands_submitterId_users_id"
	}),
	residence_assignationResidenceId: one(residences, {
		fields: [demands.assignationResidenceId],
		references: [residences.id],
		relationName: "demands_assignationResidenceId_residences_id"
	}),
	building_assignationBuildingId: one(buildings, {
		fields: [demands.assignationBuildingId],
		references: [buildings.id],
		relationName: "demands_assignationBuildingId_buildings_id"
	}),
	residence_residenceId: one(residences, {
		fields: [demands.residenceId],
		references: [residences.id],
		relationName: "demands_residenceId_residences_id"
	}),
	building_buildingId: one(buildings, {
		fields: [demands.buildingId],
		references: [buildings.id],
		relationName: "demands_buildingId_buildings_id"
	}),
	user_reviewedBy: one(users, {
		fields: [demands.reviewedBy],
		references: [users.id],
		relationName: "demands_reviewedBy_users_id"
	}),
	demandsComments: many(demandsComments),
}));

export const qualityIssuesRelations = relations(qualityIssues, ({one}) => ({
	user: one(users, {
		fields: [qualityIssues.detectedBy],
		references: [users.id]
	}),
	metricPrediction: one(metricPredictions, {
		fields: [qualityIssues.predictionId],
		references: [metricPredictions.id]
	}),
}));

export const metricPredictionsRelations = relations(metricPredictions, ({many}) => ({
	qualityIssues: many(qualityIssues),
	predictionValidations: many(predictionValidations),
}));

export const sslCertificatesRelations = relations(sslCertificates, ({one}) => ({
	user: one(users, {
		fields: [sslCertificates.createdBy],
		references: [users.id]
	}),
}));

export const invitationAuditLogRelations = relations(invitationAuditLog, ({one}) => ({
	invitation: one(invitations, {
		fields: [invitationAuditLog.invitationId],
		references: [invitations.id]
	}),
	user: one(users, {
		fields: [invitationAuditLog.performedBy],
		references: [users.id]
	}),
}));

export const invitationsRelations = relations(invitations, ({many}) => ({
	invitationAuditLogs: many(invitationAuditLog),
}));

export const bookingsRelations = relations(bookings, ({one}) => ({
	commonSpace: one(commonSpaces, {
		fields: [bookings.commonSpaceId],
		references: [commonSpaces.id]
	}),
	user: one(users, {
		fields: [bookings.userId],
		references: [users.id]
	}),
}));

export const predictionValidationsRelations = relations(predictionValidations, ({one}) => ({
	metricPrediction: one(metricPredictions, {
		fields: [predictionValidations.predictionId],
		references: [metricPredictions.id]
	}),
	user: one(users, {
		fields: [predictionValidations.validatorId],
		references: [users.id]
	}),
}));

export const actionableItemsRelations = relations(actionableItems, ({one}) => ({
	feature: one(features, {
		fields: [actionableItems.featureId],
		references: [features.id]
	}),
	user: one(users, {
		fields: [actionableItems.assignedTo],
		references: [users.id]
	}),
}));

export const featuresRelations = relations(features, ({many}) => ({
	actionableItems: many(actionableItems),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id]
	}),
	user: one(users, {
		fields: [rolePermissions.grantedBy],
		references: [users.id]
	}),
}));

export const demandsCommentsRelations = relations(demandsComments, ({one}) => ({
	demand: one(demands, {
		fields: [demandsComments.demandId],
		references: [demands.id]
	}),
	user: one(users, {
		fields: [demandsComments.commenterId],
		references: [users.id]
	}),
}));

export const documentsRelations = relations(documents, ({one}) => ({
	residence: one(residences, {
		fields: [documents.residenceId],
		references: [residences.id]
	}),
	building: one(buildings, {
		fields: [documents.buildingId],
		references: [buildings.id]
	}),
}));