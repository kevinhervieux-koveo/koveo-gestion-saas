import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, asc } from "drizzle-orm";
import {
  forecastHandler,
  calculateMinimumRequirement,
  updateUnplannedBillsSchema,
} from "../api/budgets";
import { forecastInputSchema } from "../api/forecast-input-schema";
import { insertCapitalInvestmentSchema } from "@shared/schema";
import {
  buildWriteErrorResponse,
  withRetryableDbCall,
} from "./server";

type McpRole = "admin" | "manager" | "tenant";

interface BudgetToolDeps {
  roleParam: z.ZodTypeAny;
  getMcpUser: (role: McpRole) => Promise<{ id: string; role: string } | null>;
  getMcpOrgIds: () => Promise<string[]>;
}

type Building = typeof schema.buildings.$inferSelect;
type BuildingUpdate = Partial<typeof schema.buildings.$inferInsert>;

interface CustomRevenueLine {
  id: string;
  description: string;
  monthlyAmount: number;
}

interface PunctualGrowthEntry {
  id: string;
  year: number;
  month: number;
  percentage: number;
  inflationIncluded: boolean;
}

/**
 * Shape of the JSON document persisted in `buildings.amenities` for budget
 * configuration. Mirrors the object built by the bank-account PUT endpoint
 * (server/api/budgets.ts) so the MCP tools and the UI write the same schema.
 */
interface ExtendedBudgetConfig {
  emergencyFundMinimum?: number;
  operatingCashMinimum?: number;
  revenueGrowthRate?: number;
  revenueInflation?: number;
  reserveFundTarget?: number;
  utilityInflationRate?: number;
  maintenanceInflationRate?: number;
  costInflationRate?: number;
  specialInvestmentBudget?: number;
  investmentHorizonYears?: number;
  capitalProjectReserve?: number;
  customBankFields?: Record<string, number>;
  customRevenueLines?: CustomRevenueLine[];
  punctualRevenueGrowth?: PunctualGrowthEntry[];
  useGlobalBillsInflation?: boolean;
  globalBillsInflationRate?: number;
  categoryInflationRates?: Record<string, number>;
}

const accessDenied = (msg: string) => ({
  content: [{ type: "text" as const, text: msg }],
});
const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

async function loadScopedBuilding(
  buildingId: string,
  mcpOrgIds: string[],
): Promise<Building | null> {
  const [building] = await db
    .select()
    .from(schema.buildings)
    .where(eq(schema.buildings.id, buildingId));
  if (!building || !mcpOrgIds.includes(building.organizationId)) {
    return null;
  }
  return building;
}

function getExtendedConfig(building: Building): ExtendedBudgetConfig {
  const raw = building.amenities;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as ExtendedBudgetConfig) };
  }
  return {};
}

async function saveExtendedConfig(
  buildingId: string,
  extendedConfig: ExtendedBudgetConfig,
  topLevelUpdates: BuildingUpdate = {},
): Promise<void> {
  await db
    .update(schema.buildings)
    .set({
      ...topLevelUpdates,
      amenities: extendedConfig,
      bankAccountUpdatedAt: new Date(),
    })
    .where(eq(schema.buildings.id, buildingId));
}

/**
 * Typed in-process adapter for invoking the exported forecast Express handler.
 * Constructs a minimal Request/Response pair sufficient for the handler's
 * surface area (it only reads `params`/`body` and writes `status`/`json`).
 */
interface CapturedResponse {
  status: number;
  payload: unknown;
}

class ForecastResponseAdapter {
  statusCode = 200;
  headersSent = false;
  private resolved = false;
  private readonly resolver: (value: CapturedResponse) => void;

  constructor(resolver: (value: CapturedResponse) => void) {
    this.resolver = resolver;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(payload: unknown): this {
    this.finish(payload);
    return this;
  }

  send(payload: unknown): this {
    this.finish(payload);
    return this;
  }

  end(): this {
    this.finish(undefined);
    return this;
  }

  set(): this {
    return this;
  }

  setHeader(): this {
    return this;
  }

  type(): this {
    return this;
  }

  private finish(payload: unknown): void {
    if (this.resolved) return;
    this.resolved = true;
    this.headersSent = true;
    this.resolver({ status: this.statusCode, payload });
  }
}

async function invokeForecastHandler(
  buildingId: string,
  body: z.infer<typeof forecastInputSchema>,
): Promise<CapturedResponse> {
  return new Promise<CapturedResponse>((resolve) => {
    const adapter = new ForecastResponseAdapter(resolve);
    const req = {
      params: { buildingId },
      body,
      query: {},
      headers: {},
    } as unknown as Request;
    Promise.resolve(forecastHandler(req, adapter as unknown as Response, () => undefined)).catch(
      (e: unknown) => {
        console.error("[mcp:invokeForecastHandler]", e);
        resolve({ status: 500, payload: { _error: "Internal server error" } });
      },
    );
  });
}

/**
 * Settings update payload accepted by `update_budget_settings`. Top-level
 * building columns plus extended-config keys, all optional. Uses the same
 * field names as the bank-account PUT endpoint for parity.
 */
const settingsUpdateSchema = z.object({
  bankAccountNumber: z.string().nullable().optional(),
  bankAccountNotes: z.string().nullable().optional(),
  bankAccountStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .nullable()
    .optional(),
  bankAccountStartAmount: z.number().optional(),
  bankAccountMinimums: z.string().nullable().optional(),
  generalInflationRate: z.number().optional(),
  revenueInflationRate: z.number().optional(),
  financialYearStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .nullable()
    .optional(),
  unplannedBillsAmount: z.number().min(0).optional(),
  unplannedBillsStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .nullable()
    .optional(),
  emergencyFundMinimum: z.number().optional(),
  operatingCashMinimum: z.number().optional(),
  revenueGrowthRate: z.number().optional(),
  revenueInflation: z.number().optional(),
  reserveFundTarget: z.number().optional(),
  utilityInflationRate: z.number().optional(),
  maintenanceInflationRate: z.number().optional(),
  costInflationRate: z.number().optional(),
  specialInvestmentBudget: z.number().optional(),
  investmentHorizonYears: z.number().optional(),
  capitalProjectReserve: z.number().optional(),
  useGlobalBillsInflation: z.boolean().optional(),
  globalBillsInflationRate: z.number().optional(),
  categoryInflationRates: z.record(z.string(), z.number()).optional(),
  customBankFields: z.record(z.string(), z.number()).optional(),
});

type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

function applySettingsUpdate(
  building: Building,
  partial: SettingsUpdate,
): { topLevel: BuildingUpdate; extendedConfig: ExtendedBudgetConfig } {
  const extendedConfig = getExtendedConfig(building);
  const topLevel: BuildingUpdate = {};

  if (partial.bankAccountNumber !== undefined)
    topLevel.bankAccountNumber = partial.bankAccountNumber;
  if (partial.bankAccountNotes !== undefined)
    topLevel.bankAccountNotes = partial.bankAccountNotes;
  if (partial.bankAccountStartDate !== undefined)
    topLevel.bankAccountStartDate = partial.bankAccountStartDate
      ? new Date(partial.bankAccountStartDate)
      : null;
  if (partial.bankAccountStartAmount !== undefined)
    topLevel.bankAccountStartAmount = partial.bankAccountStartAmount.toString();
  if (partial.bankAccountMinimums !== undefined)
    topLevel.bankAccountMinimums = partial.bankAccountMinimums;
  if (partial.generalInflationRate !== undefined)
    topLevel.generalInflationRate = partial.generalInflationRate.toString();
  if (partial.revenueInflationRate !== undefined)
    topLevel.revenueInflationRate = partial.revenueInflationRate.toString();
  if (partial.financialYearStart !== undefined)
    topLevel.financialYearStart = partial.financialYearStart || null;
  if (partial.unplannedBillsAmount !== undefined)
    topLevel.unplannedBillsAmount = partial.unplannedBillsAmount.toString();
  if (partial.unplannedBillsStartDate !== undefined)
    topLevel.unplannedBillsStartDate = partial.unplannedBillsStartDate || null;

  // Extended config keys merge into the existing amenities document.
  const extKeys: Array<keyof ExtendedBudgetConfig> = [
    "emergencyFundMinimum",
    "operatingCashMinimum",
    "revenueGrowthRate",
    "revenueInflation",
    "reserveFundTarget",
    "utilityInflationRate",
    "maintenanceInflationRate",
    "costInflationRate",
    "specialInvestmentBudget",
    "investmentHorizonYears",
    "capitalProjectReserve",
    "useGlobalBillsInflation",
    "globalBillsInflationRate",
    "categoryInflationRates",
    "customBankFields",
  ];
  for (const key of extKeys) {
    const value = partial[key as keyof SettingsUpdate];
    if (value !== undefined) {
      // Type-safe field-by-field assignment via a discriminated union.
      switch (key) {
        case "useGlobalBillsInflation":
          extendedConfig.useGlobalBillsInflation = value as boolean;
          break;
        case "categoryInflationRates":
          extendedConfig.categoryInflationRates = value as Record<string, number>;
          break;
        case "customBankFields":
          extendedConfig.customBankFields = value as Record<string, number>;
          break;
        default:
          extendedConfig[key as Exclude<
            keyof ExtendedBudgetConfig,
            "useGlobalBillsInflation" | "categoryInflationRates" | "customBankFields" |
              "customRevenueLines" | "punctualRevenueGrowth"
          >] = value as number;
      }
    }
  }

  return { topLevel, extendedConfig };
}

export function registerBudgetTools(server: McpServer, deps: BudgetToolDeps): void {
  const { roleParam, getMcpOrgIds } = deps;

  server.tool(
    "get_budget_settings",
    "Get the full budget configuration for a building (bank account, inflation rates, custom revenue lines, punctual growth, category inflation rates, unplanned bills, capital investments)",
    { role: roleParam, buildingId: z.string().describe("Building ID") },
    async ({ buildingId }) => {
      const orgIds = await getMcpOrgIds();
      const building = await loadScopedBuilding(buildingId, orgIds);
      if (!building) return accessDenied("Building not found or access denied");

      const ext = getExtendedConfig(building);
      const minimumRequirement = calculateMinimumRequirement(
        ext.emergencyFundMinimum,
        ext.operatingCashMinimum,
        ext.customBankFields,
      );
      const investments = await db
        .select()
        .from(schema.capitalInvestments)
        .where(eq(schema.capitalInvestments.buildingId, buildingId))
        .orderBy(asc(schema.capitalInvestments.targetDate));

      return ok({
        buildingId: building.id,
        buildingName: building.name,
        bankAccountNumber: building.bankAccountNumber,
        bankAccountNotes: building.bankAccountNotes,
        bankAccountStartDate: building.bankAccountStartDate,
        bankAccountStartAmount: building.bankAccountStartAmount,
        bankAccountMinimums: building.bankAccountMinimums,
        bankAccountUpdatedAt: building.bankAccountUpdatedAt,
        generalInflationRate: building.generalInflationRate,
        revenueInflationRate: building.revenueInflationRate,
        unplannedBillsAmount: building.unplannedBillsAmount,
        unplannedBillsStartDate: building.unplannedBillsStartDate,
        financialYearStart: building.financialYearStart,
        minimumRequirement,
        emergencyFundMinimum: ext.emergencyFundMinimum,
        operatingCashMinimum: ext.operatingCashMinimum,
        revenueGrowthRate: ext.revenueGrowthRate,
        revenueInflation: ext.revenueInflation,
        reserveFundTarget: ext.reserveFundTarget,
        utilityInflationRate: ext.utilityInflationRate,
        maintenanceInflationRate: ext.maintenanceInflationRate,
        costInflationRate: ext.costInflationRate,
        specialInvestmentBudget: ext.specialInvestmentBudget,
        investmentHorizonYears: ext.investmentHorizonYears,
        capitalProjectReserve: ext.capitalProjectReserve,
        useGlobalBillsInflation: ext.useGlobalBillsInflation,
        globalBillsInflationRate: ext.globalBillsInflationRate,
        categoryInflationRates: ext.categoryInflationRates ?? {},
        customBankFields: ext.customBankFields ?? {},
        customRevenueLines: ext.customRevenueLines ?? [],
        punctualRevenueGrowth: ext.punctualRevenueGrowth ?? [],
        capitalInvestments: investments,
      });
    },
  );

  server.tool(
    "update_budget_settings",
    "Update one or more budget settings for a building (admin/manager only). Accepts a partial payload of bank-account, inflation, and extended-config fields. Custom revenue lines, punctual growth, and capital investments have their own dedicated tools.",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      settings: settingsUpdateSchema.describe("Partial settings payload"),
    },
    async ({ role, buildingId, settings }) => {
      if (role === "tenant")
        return accessDenied("Access denied: tenants cannot update budget settings");
      const orgIds = await getMcpOrgIds();
      const building = await loadScopedBuilding(buildingId, orgIds);
      if (!building) return accessDenied("Building not found or access denied");
      try {
        const { topLevel, extendedConfig } = applySettingsUpdate(building, settings);
        await withRetryableDbCall(() => saveExtendedConfig(buildingId, extendedConfig, topLevel));
        return ok({ status: "ok", buildingId, updated: Object.keys(settings) });
      } catch (e) {
        console.error("[mcp:update_budget_settings]", e);
        return buildWriteErrorResponse(e, "budget settings", "update");
      }
    },
  );

  // Custom revenue lines ------------------------------------------------------
  server.tool(
    "add_custom_revenue_line",
    "Add a custom monthly revenue line to a building's budget configuration (admin/manager only)",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      description: z.string().min(1).describe("Description of the revenue line"),
      monthlyAmount: z.number().describe("Monthly amount in dollars"),
    },
    async ({ role, buildingId, description, monthlyAmount }) => {
      if (role === "tenant")
        return accessDenied("Access denied: tenants cannot modify revenue lines");
      const orgIds = await getMcpOrgIds();
      const building = await loadScopedBuilding(buildingId, orgIds);
      if (!building) return accessDenied("Building not found or access denied");
      try {
        const ext = getExtendedConfig(building);
        const lines: CustomRevenueLine[] = Array.isArray(ext.customRevenueLines)
          ? [...ext.customRevenueLines]
          : [];
        const line: CustomRevenueLine = { id: randomUUID(), description, monthlyAmount };
        lines.push(line);
        ext.customRevenueLines = lines;
        await withRetryableDbCall(() => saveExtendedConfig(buildingId, ext));
        return ok({ status: "ok", line });
      } catch (e) {
        console.error("[mcp:add_custom_revenue_line]", e);
        return buildWriteErrorResponse(e, "custom revenue line", "create");
      }
    },
  );

  server.tool(
    "update_custom_revenue_line",
    "Update an existing custom revenue line by id (admin/manager only)",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      id: z.string().describe("Custom revenue line id"),
      description: z.string().min(1).optional(),
      monthlyAmount: z.number().optional(),
    },
    async ({ role, buildingId, id, description, monthlyAmount }) => {
      if (role === "tenant")
        return accessDenied("Access denied: tenants cannot modify revenue lines");
      const orgIds = await getMcpOrgIds();
      const building = await loadScopedBuilding(buildingId, orgIds);
      if (!building) return accessDenied("Building not found or access denied");
      const ext = getExtendedConfig(building);
      const lines: CustomRevenueLine[] = Array.isArray(ext.customRevenueLines)
        ? [...ext.customRevenueLines]
        : [];
      const idx = lines.findIndex((l) => l.id === id);
      if (idx === -1) return accessDenied(`Custom revenue line not found: ${id}`);
      lines[idx] = {
        ...lines[idx],
        ...(description !== undefined ? { description } : {}),
        ...(monthlyAmount !== undefined ? { monthlyAmount } : {}),
      };
      ext.customRevenueLines = lines;
      try {
        await withRetryableDbCall(() => saveExtendedConfig(buildingId, ext));
        return ok({ status: "ok", line: lines[idx] });
      } catch (e) {
        console.error("[mcp:update_custom_revenue_line]", e);
        return buildWriteErrorResponse(e, "custom revenue line", "update");
      }
    },
  );

  server.tool(
    "remove_custom_revenue_line",
    "Remove a custom revenue line by id (admin/manager only)",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      id: z.string().describe("Custom revenue line id"),
    },
    async ({ role, buildingId, id }) => {
      if (role === "tenant")
        return accessDenied("Access denied: tenants cannot modify revenue lines");
      const orgIds = await getMcpOrgIds();
      const building = await loadScopedBuilding(buildingId, orgIds);
      if (!building) return accessDenied("Building not found or access denied");
      const ext = getExtendedConfig(building);
      const lines: CustomRevenueLine[] = Array.isArray(ext.customRevenueLines)
        ? ext.customRevenueLines
        : [];
      const next = lines.filter((l) => l.id !== id);
      if (next.length === lines.length)
        return accessDenied(`Custom revenue line not found: ${id}`);
      ext.customRevenueLines = next;
      try {
        await withRetryableDbCall(() => saveExtendedConfig(buildingId, ext));
        return ok({ status: "ok", removedId: id, remaining: next.length });
      } catch (e) {
        console.error("[mcp:remove_custom_revenue_line]", e);
        return buildWriteErrorResponse(e, "custom revenue line", "delete");
      }
    },
  );

  // Punctual growth ----------------------------------------------------------
  server.tool(
    "add_punctual_growth",
    "Add a punctual revenue growth entry (admin/manager only)",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      year: z.number().int().min(1900).max(2200),
      month: z.number().int().min(1).max(12),
      percentage: z.number().describe("Growth percentage (e.g. 3.5 for 3.5%)"),
      inflationIncluded: z.boolean().default(true),
    },
    async ({ role, buildingId, year, month, percentage, inflationIncluded }) => {
      if (role === "tenant")
        return accessDenied("Access denied: tenants cannot modify revenue growth");
      const orgIds = await getMcpOrgIds();
      const building = await loadScopedBuilding(buildingId, orgIds);
      if (!building) return accessDenied("Building not found or access denied");
      const ext = getExtendedConfig(building);
      const entries: PunctualGrowthEntry[] = Array.isArray(ext.punctualRevenueGrowth)
        ? [...ext.punctualRevenueGrowth]
        : [];
      const entry: PunctualGrowthEntry = {
        id: randomUUID(),
        year,
        month,
        percentage,
        inflationIncluded,
      };
      entries.push(entry);
      ext.punctualRevenueGrowth = entries;
      try {
        await withRetryableDbCall(() => saveExtendedConfig(buildingId, ext));
        return ok({ status: "ok", entry });
      } catch (e) {
        console.error("[mcp:add_punctual_growth]", e);
        return buildWriteErrorResponse(e, "punctual growth entry", "create");
      }
    },
  );

  server.tool(
    "update_punctual_growth",
    "Update an existing punctual revenue growth entry by id (admin/manager only)",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      id: z.string().describe("Punctual growth entry id"),
      year: z.number().int().min(1900).max(2200).optional(),
      month: z.number().int().min(1).max(12).optional(),
      percentage: z.number().optional(),
      inflationIncluded: z.boolean().optional(),
    },
    async ({ role, buildingId, id, year, month, percentage, inflationIncluded }) => {
      if (role === "tenant")
        return accessDenied("Access denied: tenants cannot modify revenue growth");
      const orgIds = await getMcpOrgIds();
      const building = await loadScopedBuilding(buildingId, orgIds);
      if (!building) return accessDenied("Building not found or access denied");
      const ext = getExtendedConfig(building);
      const entries: PunctualGrowthEntry[] = Array.isArray(ext.punctualRevenueGrowth)
        ? [...ext.punctualRevenueGrowth]
        : [];
      const idx = entries.findIndex((e) => e.id === id);
      if (idx === -1) return accessDenied(`Punctual growth entry not found: ${id}`);
      entries[idx] = {
        ...entries[idx],
        ...(year !== undefined ? { year } : {}),
        ...(month !== undefined ? { month } : {}),
        ...(percentage !== undefined ? { percentage } : {}),
        ...(inflationIncluded !== undefined ? { inflationIncluded } : {}),
      };
      ext.punctualRevenueGrowth = entries;
      try {
        await withRetryableDbCall(() => saveExtendedConfig(buildingId, ext));
        return ok({ status: "ok", entry: entries[idx] });
      } catch (e) {
        console.error("[mcp:update_punctual_growth]", e);
        return buildWriteErrorResponse(e, "punctual growth entry", "update");
      }
    },
  );

  server.tool(
    "remove_punctual_growth",
    "Remove a punctual revenue growth entry by id (admin/manager only)",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      id: z.string().describe("Punctual growth entry id"),
    },
    async ({ role, buildingId, id }) => {
      if (role === "tenant")
        return accessDenied("Access denied: tenants cannot modify revenue growth");
      const orgIds = await getMcpOrgIds();
      const building = await loadScopedBuilding(buildingId, orgIds);
      if (!building) return accessDenied("Building not found or access denied");
      const ext = getExtendedConfig(building);
      const entries: PunctualGrowthEntry[] = Array.isArray(ext.punctualRevenueGrowth)
        ? ext.punctualRevenueGrowth
        : [];
      const next = entries.filter((e) => e.id !== id);
      if (next.length === entries.length)
        return accessDenied(`Punctual growth entry not found: ${id}`);
      ext.punctualRevenueGrowth = next;
      try {
        await withRetryableDbCall(() => saveExtendedConfig(buildingId, ext));
        return ok({ status: "ok", removedId: id, remaining: next.length });
      } catch (e) {
        console.error("[mcp:remove_punctual_growth]", e);
        return buildWriteErrorResponse(e, "punctual growth entry", "delete");
      }
    },
  );

  // Unplanned bills ----------------------------------------------------------
  // Mirrors PUT /api/budgets/:buildingId/unplanned-bills exactly: same Zod
  // schema, same `notes || null` clearing semantics, same updatedAt bump.
  server.tool(
    "update_unplanned_bills",
    "Update the monthly unplanned bills budget for a building (admin/manager only). Mirrors PUT /api/budgets/:buildingId/unplanned-bills.",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      unplannedBillsAmount: z.number().min(0).describe("Monthly unplanned bills amount"),
      unplannedBillsStartDate: z
        .string()
        .optional()
        .describe("Date when unplanned bills budgeting starts (YYYY-MM-DD)"),
      notes: z
        .string()
        .optional()
        .describe(
          "Optional reconciliation notes. Omitting clears any existing note (matches the UI endpoint).",
        ),
    },
    async ({ role, buildingId, ...input }) => {
      if (role === "tenant")
        return accessDenied("Access denied: tenants cannot update unplanned bills");
      const orgIds = await getMcpOrgIds();
      const building = await loadScopedBuilding(buildingId, orgIds);
      if (!building) return accessDenied("Building not found or access denied");
      try {
        const validated = updateUnplannedBillsSchema.parse(input);
        await withRetryableDbCall(() =>
          db
            .update(schema.buildings)
            .set({
              unplannedBillsAmount: validated.unplannedBillsAmount.toString(),
              unplannedBillsStartDate: validated.unplannedBillsStartDate || null,
              bankAccountNotes: validated.notes || null,
              updatedAt: new Date(),
            })
            .where(eq(schema.buildings.id, buildingId)),
        );
        return ok({
          status: "ok",
          buildingId,
          unplannedBillsAmount: validated.unplannedBillsAmount,
          unplannedBillsStartDate: validated.unplannedBillsStartDate ?? null,
          notes: validated.notes ?? null,
        });
      } catch (e) {
        if (e instanceof z.ZodError) {
          return accessDenied(`Invalid input: ${JSON.stringify(e.errors)}`);
        }
        console.error("[mcp:update_unplanned_bills]", e);
        return buildWriteErrorResponse(e, "unplanned bills", "update");
      }
    },
  );

  // Capital investments ------------------------------------------------------
  server.tool(
    "list_capital_investments",
    "List capital investments for a building. Each row has a `type` field — only rows with type='custom' may be modified or deleted via MCP (matching the budget UI). Rows with type='auto_generated' are produced by the system and are read-only.",
    { role: roleParam, buildingId: z.string().describe("Building ID") },
    async ({ buildingId }) => {
      const orgIds = await getMcpOrgIds();
      const building = await loadScopedBuilding(buildingId, orgIds);
      if (!building) return accessDenied("Building not found or access denied");
      const investments = await db
        .select()
        .from(schema.capitalInvestments)
        .where(eq(schema.capitalInvestments.buildingId, buildingId))
        .orderBy(asc(schema.capitalInvestments.targetDate));
      return ok(investments);
    },
  );

  server.tool(
    "create_capital_investment",
    "Create a new custom capital investment for a building (admin/manager only)",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      title: z.string().min(1).describe("Investment title"),
      amount: z.number().positive().describe("Amount in dollars"),
      targetDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
        .describe("Target date (YYYY-MM-DD)"),
      urgency: z.enum(["not_urgent", "urgent", "suggested"]).describe("Urgency"),
      ownershipType: z.enum(["residences", "owner"]).describe("Ownership type"),
      description: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
    },
    async ({
      role,
      buildingId,
      title,
      amount,
      targetDate,
      urgency,
      ownershipType,
      description,
      category,
    }) => {
      if (role === "tenant")
        return accessDenied("Access denied: tenants cannot create capital investments");
      const orgIds = await getMcpOrgIds();
      const building = await loadScopedBuilding(buildingId, orgIds);
      if (!building) return accessDenied("Building not found or access denied");
      try {
        const validated = insertCapitalInvestmentSchema.parse({
          buildingId,
          title,
          amount,
          targetDate,
          urgency,
          type: "custom",
          ownershipType,
          description: description ?? null,
          category: category ?? null,
        });
        const [created] = await withRetryableDbCall(() =>
          db
            .insert(schema.capitalInvestments)
            .values({
              type: "custom" as const,
              buildingId: validated.buildingId,
              title: validated.title,
              amount: validated.amount.toString(),
              targetDate: validated.targetDate.toISOString().split("T")[0],
              urgency: validated.urgency,
              ownershipType: validated.ownershipType,
              description: validated.description ?? null,
              category: validated.category ?? null,
            })
            .returning(),
        );
        return ok(created);
      } catch (e) {
        if (e instanceof z.ZodError) {
          return accessDenied(`Invalid input: ${JSON.stringify(e.errors)}`);
        }
        console.error("[mcp:create_capital_investment]", e);
        return buildWriteErrorResponse(e, "capital investment", "create");
      }
    },
  );

  server.tool(
    "update_capital_investment",
    "Update an existing custom capital investment (admin/manager only). Auto-generated investments cannot be modified — use the budget UI/maintenance pipeline instead.",
    {
      role: roleParam,
      investmentId: z.string().describe("Capital investment id"),
      title: z.string().min(1).optional(),
      amount: z.number().positive().optional(),
      targetDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
        .optional(),
      urgency: z.enum(["not_urgent", "urgent", "suggested"]).optional(),
      ownershipType: z.enum(["residences", "owner"]).optional(),
      description: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
    },
    async ({
      role,
      investmentId,
      title,
      amount,
      targetDate,
      urgency,
      ownershipType,
      description,
      category,
    }) => {
      if (role === "tenant")
        return accessDenied("Access denied: tenants cannot update capital investments");
      const orgIds = await getMcpOrgIds();
      const [investment] = await db
        .select()
        .from(schema.capitalInvestments)
        .where(eq(schema.capitalInvestments.id, investmentId));
      if (!investment) return accessDenied(`Capital investment not found: ${investmentId}`);
      if (investment.type !== "custom")
        return accessDenied(
          `Refusing to update auto-generated capital investment ${investmentId}. The budget UI only allows managers to mutate custom investments; auto_generated rows are produced by the system and must not be modified through MCP.`,
        );
      const building = await loadScopedBuilding(investment.buildingId, orgIds);
      if (!building) return accessDenied("Investment is not in an MCP-scoped building");
      try {
        const updates: Partial<typeof schema.capitalInvestments.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (title !== undefined) updates.title = title;
        if (amount !== undefined) updates.amount = amount.toString();
        if (targetDate !== undefined) updates.targetDate = targetDate;
        if (urgency !== undefined) updates.urgency = urgency;
        if (ownershipType !== undefined) updates.ownershipType = ownershipType;
        if (description !== undefined) updates.description = description;
        if (category !== undefined) updates.category = category;
        const [updated] = await withRetryableDbCall(() =>
          db
            .update(schema.capitalInvestments)
            .set(updates)
            .where(eq(schema.capitalInvestments.id, investmentId))
            .returning(),
        );
        return ok(updated);
      } catch (e) {
        console.error("[mcp:update_capital_investment]", e);
        return buildWriteErrorResponse(e, "capital investment", "update");
      }
    },
  );

  server.tool(
    "delete_capital_investment",
    "Delete a custom capital investment by id (admin/manager only). Auto-generated investments cannot be deleted via MCP.",
    {
      role: roleParam,
      investmentId: z.string().describe("Capital investment id"),
    },
    async ({ role, investmentId }) => {
      if (role === "tenant")
        return accessDenied("Access denied: tenants cannot delete capital investments");
      const orgIds = await getMcpOrgIds();
      const [investment] = await db
        .select()
        .from(schema.capitalInvestments)
        .where(eq(schema.capitalInvestments.id, investmentId));
      if (!investment) return accessDenied(`Capital investment not found: ${investmentId}`);
      if (investment.type !== "custom")
        return accessDenied(
          `Refusing to delete auto-generated capital investment ${investmentId}. The budget UI only allows managers to remove custom investments; auto_generated rows are produced by the system and must not be deleted through MCP.`,
        );
      const building = await loadScopedBuilding(investment.buildingId, orgIds);
      if (!building) return accessDenied("Investment is not in an MCP-scoped building");
      try {
        await withRetryableDbCall(() =>
          db
            .delete(schema.capitalInvestments)
            .where(eq(schema.capitalInvestments.id, investmentId)),
        );
        return ok({ status: "ok", deletedId: investmentId });
      } catch (e) {
        console.error("[mcp:delete_capital_investment]", e);
        return buildWriteErrorResponse(e, "capital investment", "delete");
      }
    },
  );

  // Forecast ------------------------------------------------------------------
  // Reuses the canonical `forecastInputSchema` so the tool exposes the exact
  // same filter contract as the Express endpoint (lookbackYears, all
  // extended-config overrides, projectIds, capitalInvestmentMode, etc.).
  server.tool(
    "get_budget_forecast",
    "Compute the budget forecast for a building (same data the budget chart consumes). Accepts every filter the POST /api/budgets/:buildingId/forecast endpoint supports — including lookbackYears, capitalInvestmentMode, projectIds, and all extended-config overrides.",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      ...forecastInputSchema.shape,
    },
    async ({ role: _role, buildingId, ...forecastArgs }) => {
      const orgIds = await getMcpOrgIds();
      const building = await loadScopedBuilding(buildingId, orgIds);
      if (!building) return accessDenied("Building not found or access denied");
      const validated = forecastArgs as z.infer<typeof forecastInputSchema>;
      const { status, payload } = await invokeForecastHandler(buildingId, validated);
      if (status >= 400) {
        return accessDenied(
          `Forecast failed (status ${status}): ${
            typeof payload === "object" ? JSON.stringify(payload) : String(payload)
          }`,
        );
      }
      return ok(payload);
    },
  );
}
