import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

/**
 * Comprehensive Demo Synchronization Service.
 *
 * Synchronizes ALL data from the Demo organization to the Open Demo organization
 * to provide a complete read-only demo environment. This service copies all data types:
 * - Organizations and users
 * - Buildings and residences
 * - Financial data (bills, budgets, money flow)
 * - Operations data (maintenance, demands, notifications)
 * - Settings data (bugs, feature requests)
 * - Documents.
 */
export class ComprehensiveDemoSyncService {
  private static readonly DEMO_ORG_NAME = 'Demo';
  private static readonly OPEN_DEMO_ORG_NAME = 'Open Demo';

  /**
   * Get the Demo organization.
   */
  private static async getDemoOrg() {
    const result = await db.select().from(schema.organizations).where(eq(schema.organizations.name, this.DEMO_ORG_NAME)).limit(1);
    return result[0];
  }

  /**
   * Get the Open Demo organization.
   */
  private static async getOpenDemoOrg() {
    const result = await db.select().from(schema.organizations).where(eq(schema.organizations.name, this.OPEN_DEMO_ORG_NAME)).limit(1);
    return result[0];
  }

  /**
   * Complete synchronization from Demo to Open Demo.
   */
  public static async fullSync(): Promise<void> {
    console.log('🔄 Starting comprehensive Demo → Open Demo synchronization...');

    const demoOrg = await this.getDemoOrg();
    const openDemoOrg = await this.getOpenDemoOrg();

    if (!demoOrg) {
      throw new Error('Demo organization not found');
    }

    if (!openDemoOrg) {
      throw new Error('Open Demo organization not found');
    }

    try {
      // Step 1: Clean existing Open Demo data
      await this.cleanOpenDemoData(openDemoOrg.id);

      // Step 2: Sync core data (users, buildings, residences)
      const buildingMapping = await this.syncCoreData(demoOrg.id, openDemoOrg.id);

      // Step 3: Sync financial data
      await this.syncFinancialData(demoOrg.id, openDemoOrg.id, buildingMapping);

      // Step 4: Sync operations data
      await this.syncOperationsData(demoOrg.id, openDemoOrg.id, buildingMapping);

      // Step 5: Sync settings data
      await this.syncSettingsData(demoOrg.id, openDemoOrg.id);

      // Step 6: Sync documents
      await this.syncDocuments(demoOrg.id, openDemoOrg.id, buildingMapping);

      console.log('✅ Comprehensive Demo → Open Demo synchronization completed successfully');
    } catch (error) {
      console.error('❌ Demo synchronization failed:', error);
      throw error;
    }
  }

  /**
   * Clean all existing Open Demo data.
   * @param openDemoOrgId
   */
  private static async cleanOpenDemoData(openDemoOrgId: string): Promise<void> {
    console.log('  🧹 Cleaning existing Open Demo data...');

    try {
      // Get Open Demo buildings to cascade delete properly
      const openDemoBuildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, openDemoOrgId),
      });

      const buildingIds = openDemoBuildings.map((b) => b.id);

      if (buildingIds.length > 0) {
        // Get residences in these buildings
        const residences = await db.query.residences.findMany({
          where: inArray(schema.residences.buildingId, buildingIds),
        });
        const residenceIds = residences.map((r) => r.id);

        // Delete in proper order to respect foreign key constraints

        // Delete user-residence relationships
        if (residenceIds.length > 0) {
          await db
            .delete(schema.userResidences)
            .where(inArray(schema.userResidences.residenceId, residenceIds));
        }

        // Delete residence documents
        if (residenceIds.length > 0) {
          await db
            .delete(schema.documentsResidents)
            .where(inArray(schema.documentsResidents.residenceId, residenceIds));
        }

        // Delete building documents
        await db
          .delete(schema.documentsBuildings)
          .where(inArray(schema.documentsBuildings.buildingId, buildingIds));

        // Delete demands
        if (residenceIds.length > 0) {
          const demands = await db.query.demands.findMany({
            where: inArray(schema.demands.residenceId, residenceIds),
          });
          const demandIds = demands.map((d) => d.id);

          if (demandIds.length > 0) {
            await db
              .delete(schema.demandComments)
              .where(inArray(schema.demandComments.demandId, demandIds));
            await db.delete(schema.demands).where(inArray(schema.demands.id, demandIds));
          }
        }

        // Delete maintenance requests
        if (residenceIds.length > 0) {
          await db
            .delete(schema.maintenanceRequests)
            .where(inArray(schema.maintenanceRequests.residenceId, residenceIds));
        }

        // Delete bills
        await db.delete(schema.bills).where(inArray(schema.bills.buildingId, buildingIds));

        // Delete budgets
        await db.delete(schema.budgets).where(inArray(schema.budgets.buildingId, buildingIds));
        await db
          .delete(schema.monthlyBudgets)
          .where(inArray(schema.monthlyBudgets.buildingId, buildingIds));

        // Delete residences
        if (residenceIds.length > 0) {
          await db.delete(schema.residences).where(inArray(schema.residences.id, residenceIds));
        }

        // Delete buildings FIRST before any organization operations
        await db.delete(schema.buildings).where(inArray(schema.buildings.id, buildingIds));
      }

      // Delete user-organization relationships for Open Demo
      await db
        .delete(schema.userOrganizations)
        .where(eq(schema.userOrganizations.organizationId, openDemoOrgId));

      // Delete Open Demo users (only those that don't belong to other orgs)
      const openDemoUserOrgs = await db.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, openDemoOrgId),
      });

      for (const userOrg of openDemoUserOrgs) {
        const otherOrgs = await db.query.userOrganizations.findMany({
          where: and(
            eq(schema.userOrganizations.userId, userOrg.userId),
            eq(schema.userOrganizations.organizationId, openDemoOrgId)
          ),
        });

        if (otherOrgs.length === 0) {
          // Delete user notifications first
          await db
            .delete(schema.notifications)
            .where(eq(schema.notifications.userId, userOrg.userId));

          // Delete user's bugs and feature requests
          await db.delete(schema.bugs).where(eq(schema.bugs.createdBy, userOrg.userId));

          const userFeatureRequests = await db.query.featureRequests.findMany({
            where: eq(schema.featureRequests.createdBy, userOrg.userId),
          });
          const featureRequestIds = userFeatureRequests.map((fr) => fr.id);

          if (featureRequestIds.length > 0) {
            await db
              .delete(schema.featureRequestUpvotes)
              .where(inArray(schema.featureRequestUpvotes.featureRequestId, featureRequestIds));
            await db
              .delete(schema.featureRequests)
              .where(inArray(schema.featureRequests.id, featureRequestIds));
          }

          // Delete the user
          await db.delete(schema.users).where(eq(schema.users.id, userOrg.userId));
        }
      }

      console.log('  ✅ Cleaned existing Open Demo data');
    } catch (error) {
      console.error('  ❌ Error cleaning Open Demo data:', error);
      throw error;
    }
  }

  /**
   * Sync core data (users, buildings, residences).
   * @param demoOrgId
   * @param openDemoOrgId
   */
  private static async syncCoreData(
    demoOrgId: string,
    openDemoOrgId: string
  ): Promise<Map<string, string>> {
    console.log('  👥 Syncing users...');

    // Get Demo users (using simple query to avoid relations)
    const demoUserOrgs = await db.select().from(schema.userOrganizations).where(eq(schema.userOrganizations.organizationId, demoOrgId));

    const userMapping = new Map<string, string>();

    // Create users in Open Demo
    for (const userOrg of demoUserOrgs) {
      // Get user details separately
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userOrg.userId));
      
      const [newUser] = await db
        .insert(schema.users)
        .values({
          username: user.username + '.1', // PRODUCTION FIX: Add number suffix to make usernames unique for Open Demo
          email: user.email.replace('@demo.com', '@opendemo.com'), // Different email domain
          password: user.password,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          profileImage: user.profileImage,
          language: user.language,
          role: user.role,
          isActive: user.isActive,
        })
        .returning();

      // Create user-organization relationship
      await db.insert(schema.userOrganizations).values({
        userId: newUser.id,
        organizationId: openDemoOrgId,
        organizationRole: userOrg.organizationRole,
        canAccessAllOrganizations: userOrg.canAccessAllOrganizations,
      });

      userMapping.set(user.id, newUser.id);
    }

    console.log(`  ✅ Synced ${demoUserOrgs.length} users`);

    console.log('  🏢 Syncing buildings...');

    // Get Demo buildings
    const demoBuildings = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, demoOrgId),
    });

    const buildingMapping = new Map<string, string>();

    // Create buildings in Open Demo
    for (const building of demoBuildings) {
      const [newBuilding] = await db
        .insert(schema.buildings)
        .values({
          organizationId: openDemoOrgId,
          name: building.name,
          address: building.address,
          city: building.city,
          province: building.province,
          postalCode: building.postalCode,
          buildingType: building.buildingType,
          yearBuilt: building.yearBuilt,
          totalUnits: building.totalUnits,
          totalFloors: building.totalFloors,
          parkingSpaces: building.parkingSpaces,
          storageSpaces: building.storageSpaces,
          amenities: building.amenities,
          managementCompany: building.managementCompany,
          bankAccountNumber: building.bankAccountNumber,
          bankAccountNotes: building.bankAccountNotes,
          bankAccountUpdatedAt: building.bankAccountUpdatedAt,
          bankAccountStartDate: building.bankAccountStartDate,
          bankAccountStartAmount: building.bankAccountStartAmount,
          bankAccountMinimums: building.bankAccountMinimums,
          inflationSettings: building.inflationSettings,
          isActive: building.isActive,
        })
        .returning();

      buildingMapping.set(building.id, newBuilding.id);
    }

    console.log(`  ✅ Synced ${demoBuildings.length} buildings`);

    console.log('  🏠 Syncing residences...');

    // Get Demo residences
    const demoResidences = await db.query.residences.findMany({
      where: inArray(schema.residences.buildingId, Array.from(buildingMapping.keys())),
    });

    const residenceMapping = new Map<string, string>();

    // Create residences in Open Demo
    for (const residence of demoResidences) {
      const newBuildingId = buildingMapping.get(residence.buildingId);
      if (!newBuildingId) {
        continue;
      }

      const [newResidence] = await db
        .insert(schema.residences)
        .values({
          buildingId: newBuildingId,
          unitNumber: residence.unitNumber,
          floor: residence.floor,
          squareFootage: residence.squareFootage,
          bedrooms: residence.bedrooms,
          bathrooms: residence.bathrooms,
          balcony: residence.balcony,
          parkingSpaceNumbers: residence.parkingSpaceNumbers,
          storageSpaceNumbers: residence.storageSpaceNumbers,
          ownershipPercentage: residence.ownershipPercentage,
          monthlyFees: residence.monthlyFees,
          isActive: residence.isActive,
        })
        .returning();

      residenceMapping.set(residence.id, newResidence.id);
    }

    console.log(`  ✅ Synced ${demoResidences.length} residences`);

    // Sync user-residence relationships
    const demoUserResidences = await db.query.userResidences.findMany({
      where: inArray(schema.userResidences.residenceId, Array.from(residenceMapping.keys())),
    });

    for (const userRes of demoUserResidences) {
      const newUserId = userMapping.get(userRes.userId);
      const newResidenceId = residenceMapping.get(userRes.residenceId);

      if (newUserId && newResidenceId) {
        await db.insert(schema.userResidences).values({
          userId: newUserId,
          residenceId: newResidenceId,
          relationshipType: userRes.relationshipType,
          startDate: userRes.startDate,
          endDate: userRes.endDate,
          isActive: userRes.isActive,
        });
      }
    }

    console.log(`  ✅ Synced ${demoUserResidences.length} user-residence relationships`);

    return buildingMapping;
  }

  /**
   * Sync financial data (bills, budgets, money flow).
   * @param demoOrgId
   * @param openDemoOrgId
   * @param buildingMapping
   */
  private static async syncFinancialData(
    demoOrgId: string,
    openDemoOrgId: string,
    buildingMapping: Map<string, string>
  ): Promise<void> {
    console.log('  💰 Syncing financial data...');

    const demoBuildingIds = Array.from(buildingMapping.keys());
    const openDemoBuildingIds = Array.from(buildingMapping.values());

    // Get admin user for Open Demo
    const openDemoAdmin = await db.query.userOrganizations.findFirst({
      where: and(
        eq(schema.userOrganizations.organizationId, openDemoOrgId),
        eq(schema.userOrganizations.organizationRole, 'admin')
      ),
      with: { user: true },
    });

    if (!openDemoAdmin) {
      throw new Error('Open Demo admin user not found');
    }

    // Sync bills
    const demoBills = await db.query.bills.findMany({
      where: inArray(schema.bills.buildingId, demoBuildingIds),
    });

    for (const bill of demoBills) {
      const newBuildingId = buildingMapping.get(bill.buildingId);
      if (!newBuildingId) {
        continue;
      }

      await db.insert(schema.bills).values({
        buildingId: newBuildingId,
        billNumber: bill.billNumber,
        title: bill.title,
        description: bill.description,
        category: bill.category,
        vendor: bill.vendor,
        paymentType: bill.paymentType,
        schedulePayment: bill.schedulePayment,
        scheduleCustom: bill.scheduleCustom,
        costs: bill.costs,
        totalAmount: bill.totalAmount,
        startDate: bill.startDate,
        endDate: bill.endDate,
        status: bill.status,
        documentPath: bill.documentPath,
        documentName: bill.documentName,
        isAiAnalyzed: bill.isAiAnalyzed,
        aiAnalysisData: bill.aiAnalysisData,
        notes: bill.notes,
        autoGenerated: bill.autoGenerated,
        createdBy: openDemoAdmin.userId,
      });
    }

    // Sync budgets
    const demoBudgets = await db.query.budgets.findMany({
      where: inArray(schema.budgets.buildingId, demoBuildingIds),
    });

    for (const budget of demoBudgets) {
      const newBuildingId = buildingMapping.get(budget.buildingId);
      if (!newBuildingId) {
        continue;
      }

      await db.insert(schema.budgets).values({
        buildingId: newBuildingId,
        year: budget.year,
        name: budget.name,
        description: budget.description,
        category: budget.category,
        budgetedAmount: budget.budgetedAmount,
        actualAmount: budget.actualAmount,
        variance: budget.variance,
        approvedBy: openDemoAdmin.userId,
        approvedDate: budget.approvedDate,
        isActive: budget.isActive,
        createdBy: openDemoAdmin.userId,
      });
    }

    // Sync monthly budgets
    const demoMonthlyBudgets = await db.query.monthlyBudgets.findMany({
      where: inArray(schema.monthlyBudgets.buildingId, demoBuildingIds),
    });

    for (const budget of demoMonthlyBudgets) {
      const newBuildingId = buildingMapping.get(budget.buildingId);
      if (!newBuildingId) {
        continue;
      }

      await db.insert(schema.monthlyBudgets).values({
        buildingId: newBuildingId,
        year: budget.year,
        month: budget.month,
        incomeTypes: budget.incomeTypes,
        incomes: budget.incomes,
        spendingTypes: budget.spendingTypes,
        spendings: budget.spendings,
        approved: budget.approved,
        approvedBy: budget.approved ? openDemoAdmin.userId : null,
        approvedDate: budget.approvedDate,
      });
    }

    // Skip money flow sync - table no longer exists

    console.log(
      `  ✅ Synced financial data: ${demoBills.length} bills, ${demoBudgets.length} budgets, ${demoMonthlyBudgets.length} monthly budgets`
    );
  }

  /**
   * Sync operations data (maintenance, demands, notifications).
   * @param demoOrgId
   * @param openDemoOrgId
   * @param buildingMapping
   */
  private static async syncOperationsData(
    demoOrgId: string,
    openDemoOrgId: string,
    buildingMapping: Map<string, string>
  ): Promise<void> {
    console.log('  🔧 Syncing operations data...');

    // Get user mappings
    const userMapping = new Map<string, string>();
    const demoUserOrgs = await db.query.userOrganizations.findMany({
      where: eq(schema.userOrganizations.organizationId, demoOrgId),
    });
    const openDemoUserOrgs = await db.query.userOrganizations.findMany({
      where: eq(schema.userOrganizations.organizationId, openDemoOrgId),
    });

    // Create user mapping based on email (since we changed domain)
    for (const demoUserOrg of demoUserOrgs) {
      const demoUser = await db.query.users.findFirst({
        where: eq(schema.users.id, demoUserOrg.userId),
      });

      if (demoUser) {
        const openDemoUser = await db.query.users.findFirst({
          where: eq(schema.users.email, demoUser.email.replace('@demo.com', '@opendemo.com')),
        });

        if (openDemoUser) {
          userMapping.set(demoUser.id, openDemoUser.id);
        }
      }
    }

    // Get residence mappings
    const residenceMapping = new Map<string, string>();
    const demoBuildingIds = Array.from(buildingMapping.keys());

    const demoResidences = await db.query.residences.findMany({
      where: inArray(schema.residences.buildingId, demoBuildingIds),
    });

    for (const demoRes of demoResidences) {
      const newBuildingId = buildingMapping.get(demoRes.buildingId);
      if (newBuildingId) {
        const openDemoRes = await db.query.residences.findFirst({
          where: and(
            eq(schema.residences.buildingId, newBuildingId),
            eq(schema.residences.unitNumber, demoRes.unitNumber)
          ),
        });
        if (openDemoRes) {
          residenceMapping.set(demoRes.id, openDemoRes.id);
        }
      }
    }

    // Sync maintenance requests
    const demoMaintenanceRequests = await db.query.maintenanceRequests.findMany({
      where: inArray(schema.maintenanceRequests.residenceId, Array.from(residenceMapping.keys())),
    });

    for (const request of demoMaintenanceRequests) {
      const newResidenceId = residenceMapping.get(request.residenceId);
      const newSubmitterId = userMapping.get(request.submittedBy);
      const newAssignedTo = request.assignedTo ? userMapping.get(request.assignedTo) : null;

      if (newResidenceId && newSubmitterId) {
        await db.insert(schema.maintenanceRequests).values({
          residenceId: newResidenceId,
          submittedBy: newSubmitterId,
          assignedTo: newAssignedTo,
          title: request.title,
          description: request.description,
          category: request.category,
          priority: request.priority,
          status: request.status,
          estimatedCost: request.estimatedCost,
          actualCost: request.actualCost,
          scheduledDate: request.scheduledDate,
          completedDate: request.completedDate,
          notes: request.notes,
          images: request.images,
        });
      }
    }

    // Sync demands
    const demoDemands = await db.query.demands.findMany({
      where: inArray(schema.demands.residenceId, Array.from(residenceMapping.keys())),
    });

    for (const demand of demoDemands) {
      const newResidenceId = residenceMapping.get(demand.residenceId);
      const newBuildingId = buildingMapping.get(demand.buildingId);
      const newSubmitterId = userMapping.get(demand.submitterId);
      const newReviewedBy = demand.reviewedBy ? userMapping.get(demand.reviewedBy) : null;

      if (newResidenceId && newBuildingId && newSubmitterId) {
        await db.insert(schema.demands).values({
          submitterId: newSubmitterId,
          type: demand.type,
          assignationResidenceId: demand.assignationResidenceId
            ? residenceMapping.get(demand.assignationResidenceId)
            : null,
          assignationBuildingId: demand.assignationBuildingId
            ? buildingMapping.get(demand.assignationBuildingId)
            : null,
          description: demand.description,
          residenceId: newResidenceId,
          buildingId: newBuildingId,
          status: demand.status,
          reviewedBy: newReviewedBy,
          reviewedAt: demand.reviewedAt,
          reviewNotes: demand.reviewNotes,
        });
      }
    }

    // Sync notifications
    for (const [demoUserId, openDemoUserId] of userMapping.entries()) {
      const demoNotifications = await db.query.notifications.findMany({
        where: eq(schema.notifications.userId, demoUserId),
      });

      for (const notification of demoNotifications) {
        await db.insert(schema.notifications).values({
          userId: openDemoUserId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          relatedEntityId: notification.relatedEntityId,
          relatedEntityType: notification.relatedEntityType,
          isRead: notification.isRead,
          readAt: notification.readAt,
        });
      }
    }

    console.log(
      `  ✅ Synced operations data: ${demoMaintenanceRequests.length} maintenance requests, ${demoDemands.length} demands, notifications`
    );
  }

  /**
   * Sync settings data (bugs, feature requests).
   * @param demoOrgId
   * @param openDemoOrgId
   */
  private static async syncSettingsData(demoOrgId: string, openDemoOrgId: string): Promise<void> {
    console.log('  ⚙️ Syncing settings data...');

    // Get user mappings
    const userMapping = new Map<string, string>();
    const demoUserOrgs = await db.query.userOrganizations.findMany({
      where: eq(schema.userOrganizations.organizationId, demoOrgId),
    });

    for (const demoUserOrg of demoUserOrgs) {
      const demoUser = await db.query.users.findFirst({
        where: eq(schema.users.id, demoUserOrg.userId),
      });

      if (demoUser) {
        const openDemoUser = await db.query.users.findFirst({
          where: eq(schema.users.email, demoUser.email.replace('@demo.com', '@opendemo.com')),
        });

        if (openDemoUser) {
          userMapping.set(demoUser.id, openDemoUser.id);
        }
      }
    }

    // Sync bugs
    const demoBugs = await db.query.bugs.findMany({
      where: inArray(schema.bugs.createdBy, Array.from(userMapping.keys())),
    });

    for (const bug of demoBugs) {
      const newCreatedBy = userMapping.get(bug.createdBy);
      const newAssignedTo = bug.assignedTo ? userMapping.get(bug.assignedTo) : null;
      const newResolvedBy = bug.resolvedBy ? userMapping.get(bug.resolvedBy) : null;

      if (newCreatedBy) {
        await db.insert(schema.bugs).values({
          createdBy: newCreatedBy,
          title: bug.title,
          description: bug.description,
          category: bug.category,
          page: bug.page,
          priority: bug.priority,
          status: bug.status,
          assignedTo: newAssignedTo,
          resolvedAt: bug.resolvedAt,
          resolvedBy: newResolvedBy,
          notes: bug.notes,
          reproductionSteps: bug.reproductionSteps,
          environment: bug.environment,
        });
      }
    }

    // Sync feature requests
    const demoFeatureRequests = await db.query.featureRequests.findMany({
      where: inArray(schema.featureRequests.createdBy, Array.from(userMapping.keys())),
    });

    for (const featureRequest of demoFeatureRequests) {
      const newCreatedBy = userMapping.get(featureRequest.createdBy);
      const newAssignedTo = featureRequest.assignedTo
        ? userMapping.get(featureRequest.assignedTo)
        : null;
      const newReviewedBy = featureRequest.reviewedBy
        ? userMapping.get(featureRequest.reviewedBy)
        : null;

      if (newCreatedBy) {
        const [newFeatureRequest] = await db
          .insert(schema.featureRequests)
          .values({
            createdBy: newCreatedBy,
            title: featureRequest.title,
            description: featureRequest.description,
            need: featureRequest.need,
            category: featureRequest.category,
            page: featureRequest.page,
            status: featureRequest.status,
            upvoteCount: featureRequest.upvoteCount,
            assignedTo: newAssignedTo,
            reviewedBy: newReviewedBy,
            reviewedAt: featureRequest.reviewedAt,
            adminNotes: featureRequest.adminNotes,
          })
          .returning();

        // Sync upvotes for this feature request
        const upvotes = await db.query.featureRequestUpvotes.findMany({
          where: eq(schema.featureRequestUpvotes.featureRequestId, featureRequest.id),
        });

        for (const upvote of upvotes) {
          const newUserId = userMapping.get(upvote.userId);
          if (newUserId) {
            await db.insert(schema.featureRequestUpvotes).values({
              featureRequestId: newFeatureRequest.id,
              userId: newUserId,
            });
          }
        }
      }
    }

    console.log(
      `  ✅ Synced settings data: ${demoBugs.length} bugs, ${demoFeatureRequests.length} feature requests`
    );
  }

  /**
   * Sync documents.
   * @param demoOrgId
   * @param openDemoOrgId
   * @param buildingMapping
   */
  private static async syncDocuments(
    demoOrgId: string,
    openDemoOrgId: string,
    buildingMapping: Map<string, string>
  ): Promise<void> {
    console.log('  📄 Syncing documents...');

    // Get user mapping for uploadedBy field
    const openDemoAdmin = await db.query.userOrganizations.findFirst({
      where: and(
        eq(schema.userOrganizations.organizationId, openDemoOrgId),
        eq(schema.userOrganizations.organizationRole, 'admin')
      ),
    });

    if (!openDemoAdmin) {
      throw new Error('Open Demo admin user not found');
    }

    // Sync building documents
    const demoBuildingDocs = await db.query.documentsBuildings.findMany({
      where: inArray(schema.documentsBuildings.buildingId, Array.from(buildingMapping.keys())),
    });

    for (const doc of demoBuildingDocs) {
      const newBuildingId = buildingMapping.get(doc.buildingId);
      if (newBuildingId) {
        await db.insert(schema.documentsBuildings).values({
          name: doc.name,
          dateReference: doc.dateReference,
          type: doc.type,
          buildingId: newBuildingId,
          fileUrl: doc.fileUrl,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          uploadedBy: openDemoAdmin.userId,
          isVisibleToTenants: doc.isVisibleToTenants,
        });
      }
    }

    // Get residence mappings
    const residenceMapping = new Map<string, string>();
    const demoBuildingIds = Array.from(buildingMapping.keys());

    const demoResidences = await db.query.residences.findMany({
      where: inArray(schema.residences.buildingId, demoBuildingIds),
    });

    for (const demoRes of demoResidences) {
      const newBuildingId = buildingMapping.get(demoRes.buildingId);
      if (newBuildingId) {
        const openDemoRes = await db.query.residences.findFirst({
          where: and(
            eq(schema.residences.buildingId, newBuildingId),
            eq(schema.residences.unitNumber, demoRes.unitNumber)
          ),
        });
        if (openDemoRes) {
          residenceMapping.set(demoRes.id, openDemoRes.id);
        }
      }
    }

    // Sync residence documents
    const demoResidenceDocs = await db.query.documentsResidents.findMany({
      where: inArray(schema.documentsResidents.residenceId, Array.from(residenceMapping.keys())),
    });

    for (const doc of demoResidenceDocs) {
      const newResidenceId = residenceMapping.get(doc.residenceId);
      if (newResidenceId) {
        await db.insert(schema.documentsResidents).values({
          name: doc.name,
          dateReference: doc.dateReference,
          type: doc.type,
          residenceId: newResidenceId,
          fileUrl: doc.fileUrl,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          uploadedBy: openDemoAdmin.userId,
          isVisibleToTenants: doc.isVisibleToTenants,
        });
      }
    }

    console.log(
      `  ✅ Synced documents: ${demoBuildingDocs.length} building documents, ${demoResidenceDocs.length} residence documents`
    );
  }

  /**
   * Run complete synchronization.
   */
  public static async runFullSync(): Promise<void> {
    try {
      await this.fullSync();
      console.log('🎉 Complete Demo → Open Demo synchronization finished successfully');
    } catch (error) {
      console.error('💥 Complete Demo synchronization failed:', error);
      throw error;
    }
  }
}

// Export for use in other modules
export default ComprehensiveDemoSyncService;
