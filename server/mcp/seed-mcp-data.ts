import { db } from "../db";
import * as schema from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import * as bcrypt from "bcryptjs";

/**
 * One-shot backfill for environments whose MCP sandbox was seeded BEFORE
 * the manager `user_buildings` inserts were added (Task #963). Without
 * these rows, `mcp-manager@koveo-mcp.test` is treated as having access to
 * no buildings, which makes manager-only flows impossible to exercise
 * end-to-end in already-seeded environments.
 *
 * The check is keyed on (mcp-manager, MCP-scoped buildings): if every
 * MCP-1/MCP-2 building already has an active `user_buildings` row for the
 * manager, this is a true no-op and the caller's "skipping" log path is
 * preserved. Otherwise we insert ONLY the missing rows so we can never
 * create duplicates in environments that were seeded after the fix.
 *
 * Returns the number of rows inserted (0 means nothing to backfill).
 */
async function backfillMcpManagerBuildingAccess(log: (msg: string) => void): Promise<number> {
  const [manager] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "mcp-manager@koveo-mcp.test"))
    .limit(1);

  if (!manager) {
    // Pre-existing sandbox without the canonical manager user — out of
    // scope for this backfill. Don't touch anything.
    return 0;
  }

  const mcpOrgs = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(inArray(schema.organizations.name, ["MCP-1", "MCP-2"]));

  if (mcpOrgs.length === 0) {
    return 0;
  }

  const mcpOrgIds = mcpOrgs.map((o) => o.id);
  const mcpBuildings = await db
    .select({ id: schema.buildings.id })
    .from(schema.buildings)
    .where(inArray(schema.buildings.organizationId, mcpOrgIds));

  if (mcpBuildings.length === 0) {
    return 0;
  }

  const mcpBuildingIds = mcpBuildings.map((b) => b.id);
  // Existence check ignores `isActive` on purpose: if an admin manually
  // deactivated a row out-of-band, the backfill should NOT silently
  // re-enable it (that would surprise operators). It only fills truly
  // missing rows.
  const existing = await db
    .select({ buildingId: schema.userBuildings.buildingId })
    .from(schema.userBuildings)
    .where(
      and(
        eq(schema.userBuildings.userId, manager.id),
        inArray(schema.userBuildings.buildingId, mcpBuildingIds),
      ),
    );

  const existingBuildingIds = new Set(existing.map((e) => e.buildingId));
  const missingBuildingIds = mcpBuildingIds.filter((id) => !existingBuildingIds.has(id));

  if (missingBuildingIds.length === 0) {
    return 0;
  }

  await db.insert(schema.userBuildings).values(
    missingBuildingIds.map((buildingId) => ({
      userId: manager.id,
      buildingId,
      relationshipType: "manager",
      isActive: true,
    })),
  );

  log(
    `[MCP SEED] Backfilled ${missingBuildingIds.length} missing manager ` +
      `user_buildings row(s) for mcp-manager@koveo-mcp.test.`,
  );
  return missingBuildingIds.length;
}

export async function seedMcpData() {
  // Always log seed progress now: in dev it preserves existing developer
  // visibility; in production (gated by MCP_SEED_PRODUCTION at the caller)
  // operators need clear evidence of whether seeding happened or was a no-op.
  const log = (msg: string) => console.log(msg);

  log("[MCP SEED] Starting MCP data seeding...");

  const existingOrg = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.name, "MCP-1"))
    .limit(1);

  if (existingOrg.length > 0) {
    // Backfill ONLY runs on the fast-path: it's a no-op when rows are
    // already present (preserving the original "skipping" log message)
    // and inserts only what's missing in environments seeded before
    // Task #963's manager `user_buildings` inserts landed.
    await backfillMcpManagerBuildingAccess(log);
    log("[MCP SEED] MCP-1 already exists — sandbox already seeded, skipping.");
    return;
  }

  const hashedPassword = await bcrypt.hash("McpTest2024!", 12);

  // Idempotency strategy (defence in depth):
  //   1. Top-level sentinel: skip the entire seed when MCP-1 already exists
  //      (handled above). This is the fast path for re-runs / restarts.
  //   2. Atomic transaction: wrap every insert below in a single transaction.
  //      If anything throws, the entire seed rolls back, so subsequent boots
  //      see the sentinel as "missing" and can safely retry from a clean
  //      slate. This guarantees the system can never get stuck in a half-
  //      seeded state.
  //   3. Per-entity safety nets: bulk inserts for join/leaf tables use
  //      `.onConflictDoNothing()` so even if some sandbox row pre-exists
  //      out-of-band (e.g. a manual fix), the seed will still complete
  //      successfully without violating unique constraints. Inserts that
  //      use `.returning()` to capture generated IDs intentionally do NOT
  //      use onConflictDoNothing because they rely on the row being newly
  //      created — the transactional sentinel above guarantees they only
  //      run when no MCP data exists.
  await db.transaction(async (tx) => {
  const [org1] = await tx
    .insert(schema.organizations)
    .values({
      name: "MCP-1",
      type: "management_company",
      address: "100 rue MCP",
      city: "Montréal",
      province: "QC",
      postalCode: "H2X 1Y1",
      phone: "514-555-0101",
      email: "contact@mcp1.test",
    })
    .returning();

  const [org2] = await tx
    .insert(schema.organizations)
    .values({
      name: "MCP-2",
      type: "syndicate",
      address: "200 avenue MCP",
      city: "Québec",
      province: "QC",
      postalCode: "G1R 2B2",
      phone: "418-555-0201",
      email: "contact@mcp2.test",
    })
    .returning();

  log(`[MCP SEED] Created organizations: ${org1.id} (MCP-1), ${org2.id} (MCP-2)`);

  const [adminUser] = await tx
    .insert(schema.users)
    .values({
      username: "mcp-admin",
      email: "mcp-admin@koveo-mcp.test",
      password: hashedPassword,
      firstName: "MCP",
      lastName: "Admin",
      role: "super_admin",
      language: "en",
    })
    .returning();

  const [managerUser] = await tx
    .insert(schema.users)
    .values({
      username: "mcp-manager",
      email: "mcp-manager@koveo-mcp.test",
      password: hashedPassword,
      firstName: "MCP",
      lastName: "Manager",
      role: "manager",
      language: "en",
    })
    .returning();

  const [tenantUser] = await tx
    .insert(schema.users)
    .values({
      username: "mcp-tenant",
      email: "mcp-tenant@koveo-mcp.test",
      password: hashedPassword,
      firstName: "MCP",
      lastName: "Tenant",
      role: "tenant",
      language: "en",
    })
    .returning();

  log(`[MCP SEED] Created users: admin=${adminUser.id}, manager=${managerUser.id}, tenant=${tenantUser.id}`);

  for (const org of [org1, org2]) {
    await tx.insert(schema.userOrganizations).values({
      userId: adminUser.id,
      organizationId: org.id,
      organizationRole: "admin",
    }).onConflictDoNothing();
    await tx.insert(schema.userOrganizations).values({
      userId: managerUser.id,
      organizationId: org.id,
      organizationRole: "manager",
    }).onConflictDoNothing();
    await tx.insert(schema.userOrganizations).values({
      userId: tenantUser.id,
      organizationId: org.id,
      organizationRole: "tenant",
    }).onConflictDoNothing();
  }

  const [building1] = await tx
    .insert(schema.buildings)
    .values({
      organizationId: org1.id,
      name: "Résidence du Parc",
      address: "101 rue du Parc",
      city: "Montréal",
      province: "QC",
      postalCode: "H2W 1R7",
      buildingType: "condo",
      totalUnits: 12,
      totalFloors: 4,
      parkingSpaces: 8,
    })
    .returning();

  const [building2] = await tx
    .insert(schema.buildings)
    .values({
      organizationId: org1.id,
      name: "Les Terrasses MCP",
      address: "150 boulevard MCP",
      city: "Montréal",
      province: "QC",
      postalCode: "H3A 1B2",
      buildingType: "apartment",
      totalUnits: 24,
      totalFloors: 6,
      parkingSpaces: 20,
    })
    .returning();

  const [building3] = await tx
    .insert(schema.buildings)
    .values({
      organizationId: org2.id,
      name: "Condo Vieux-Québec",
      address: "45 rue Saint-Louis",
      city: "Québec",
      province: "QC",
      postalCode: "G1R 3Z2",
      buildingType: "condo",
      totalUnits: 8,
      totalFloors: 3,
      parkingSpaces: 6,
    })
    .returning();

  log(`[MCP SEED] Created buildings: ${building1.id}, ${building2.id}, ${building3.id}`);

  // Grant the MCP manager building-level access to every building in their orgs.
  // Without these rows, manager-scoped endpoints that consult `user_buildings`
  // (e.g. `/api/users/me/buildings`, `checkBuildingAccess` in maintenance) treat
  // this user as having access to no buildings, which makes manager-only flows
  // impossible to exercise end-to-end. We mirror the demo seed's behaviour for
  // `demo_manager` users by inserting active rows with a `manager` relationship.
  for (const building of [building1, building2, building3]) {
    await tx.insert(schema.userBuildings).values({
      userId: managerUser.id,
      buildingId: building.id,
      relationshipType: "manager",
      isActive: true,
    }).onConflictDoNothing();
  }
  log(`[MCP SEED] Granted manager building access for 3 buildings`);

  const residenceValues = [];
  for (let i = 1; i <= 4; i++) {
    residenceValues.push({
      buildingId: building1.id,
      unitNumber: `${i}01`,
      floor: i,
      bedrooms: i <= 2 ? 2 : 3,
      bathrooms: "1",
      monthlyFees: String(250 + i * 25),
    });
  }
  for (let i = 1; i <= 6; i++) {
    residenceValues.push({
      buildingId: building2.id,
      unitNumber: `${i}01`,
      floor: i,
      bedrooms: i <= 3 ? 1 : 2,
      bathrooms: "1",
      monthlyFees: String(200 + i * 20),
    });
  }
  for (let i = 1; i <= 3; i++) {
    residenceValues.push({
      buildingId: building3.id,
      unitNumber: `${i}01`,
      floor: i,
      bedrooms: 2,
      bathrooms: "1.5",
      monthlyFees: String(300 + i * 30),
    });
  }

  const createdResidences = await tx.insert(schema.residences).values(residenceValues).returning();
  log(`[MCP SEED] Created ${createdResidences.length} residences`);

  const tenantResidences = [createdResidences[0], createdResidences[4], createdResidences[10]];
  for (const res of tenantResidences) {
    await tx.insert(schema.userResidences).values({
      userId: tenantUser.id,
      residenceId: res.id,
      relationshipType: "tenant",
      startDate: "2024-01-01",
    }).onConflictDoNothing();
  }

  const billData = [
    {
      buildingId: building1.id,
      billNumber: "MCP-BILL-001",
      title: "Assurance immeuble annuelle",
      category: "insurance" as const,
      totalAmount: "4500.00",
      costs: ["4500.00"],
      paymentType: "unique" as const,
      startDate: "2025-01-15",
      status: "sent" as const,
      createdBy: managerUser.id,
    },
    {
      buildingId: building1.id,
      billNumber: "MCP-BILL-002",
      title: "Entretien paysager mensuel",
      category: "landscaping" as const,
      totalAmount: "350.00",
      costs: ["350.00"],
      paymentType: "recurrent" as const,
      schedulePayment: "monthly" as const,
      startDate: "2025-04-01",
      status: "sent" as const,
      createdBy: managerUser.id,
    },
    {
      buildingId: building2.id,
      billNumber: "MCP-BILL-003",
      title: "Réparation ascenseur",
      category: "repairs" as const,
      totalAmount: "8750.00",
      costs: ["8750.00"],
      paymentType: "unique" as const,
      startDate: "2025-03-10",
      status: "paid" as const,
      createdBy: managerUser.id,
    },
    {
      buildingId: building3.id,
      billNumber: "MCP-BILL-004",
      title: "Contrat de déneigement",
      category: "maintenance" as const,
      totalAmount: "2400.00",
      costs: ["200.00", "200.00", "200.00", "200.00", "200.00", "200.00", "200.00", "200.00", "200.00", "200.00", "200.00", "200.00"],
      paymentType: "recurrent" as const,
      schedulePayment: "monthly" as const,
      startDate: "2024-11-01",
      endDate: "2025-04-30",
      status: "sent" as const,
      createdBy: managerUser.id,
    },
  ];

  // bills.billNumber has a unique constraint — onConflictDoNothing protects
  // against races / partial pre-existing rows.
  await tx.insert(schema.bills).values(billData).onConflictDoNothing();
  log(`[MCP SEED] Created ${billData.length} bills`);

  const maintenanceData = [
    {
      residenceId: createdResidences[0].id,
      title: "Fuite robinet cuisine",
      description: "Le robinet de la cuisine fuit constamment. L'eau coule même quand le robinet est fermé.",
      category: "plumbing",
      priority: "medium" as const,
      status: "submitted" as const,
      submittedBy: tenantUser.id,
    },
    {
      residenceId: createdResidences[1].id,
      title: "Chauffage défaillant",
      description: "Le chauffage ne fonctionne plus dans le salon depuis 2 jours. Température très basse.",
      category: "hvac",
      priority: "high" as const,
      status: "in_progress" as const,
      submittedBy: tenantUser.id,
      assignedTo: managerUser.id,
    },
    {
      residenceId: createdResidences[4].id,
      title: "Prise électrique défectueuse",
      description: "La prise électrique dans la chambre principale produit des étincelles.",
      category: "electrical",
      priority: "urgent" as const,
      status: "acknowledged" as const,
      submittedBy: tenantUser.id,
    },
    {
      residenceId: createdResidences[10].id,
      title: "Fenêtre bloquée",
      description: "La fenêtre du salon ne s'ouvre plus. Le mécanisme semble coincé.",
      category: "general",
      priority: "low" as const,
      status: "submitted" as const,
      submittedBy: tenantUser.id,
    },
  ];

  await tx.insert(schema.maintenanceRequests).values(maintenanceData).onConflictDoNothing();
  log(`[MCP SEED] Created ${maintenanceData.length} maintenance requests`);

  const demandData = [
    {
      buildingId: building1.id,
      type: "information" as const,
      description: "Quand aura lieu la prochaine assemblée des copropriétaires?",
      submitterId: tenantUser.id,
      status: "submitted" as const,
    },
    {
      buildingId: building2.id,
      type: "complaint" as const,
      description: "Bruit excessif provenant de l'unité au-dessus entre 22h et 2h du matin.",
      submitterId: tenantUser.id,
      status: "under_review" as const,
      reviewedBy: managerUser.id,
    },
  ];

  await tx.insert(schema.demands).values(demandData).onConflictDoNothing();
  log(`[MCP SEED] Created ${demandData.length} demands`);

  const commonSpaceData = [
    {
      buildingId: building1.id,
      name: "Salle de gym",
      description: "Salle d'entraînement avec équipements cardio et musculation",
      isReservable: false,
      capacity: 10,
    },
    {
      buildingId: building1.id,
      name: "Salle communautaire",
      description: "Grande salle pour événements et réunions",
      isReservable: true,
      capacity: 40,
    },
    {
      buildingId: building3.id,
      name: "Terrasse sur le toit",
      description: "Terrasse aménagée avec vue sur le Vieux-Québec",
      isReservable: true,
      capacity: 20,
    },
  ];

  await tx.insert(schema.commonSpaces).values(commonSpaceData).onConflictDoNothing();
  log(`[MCP SEED] Created ${commonSpaceData.length} common spaces`);

  log("[MCP SEED] MCP data seeding completed successfully!");
  });
}
