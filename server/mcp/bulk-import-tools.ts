/**
 * MCP tools for the admin Bulk Document Import feature (Task #451).
 *
 * Exposes a small admin-only surface so the AI assistant can drive the
 * pipeline outside of the React UI: list/create sessions, run AI
 * analysis on a staged item, and commit a fully-decided item to the
 * real `documents` table.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '@shared/schema';
import { buildWriteErrorResponse, withRetryableDbCall } from './server';
import { bulkImportAnalyzer } from '../services/bulk-import-analyzer';
import { documentService } from '../services/document-service';
import { logDebug } from '../utils/logger';

type McpRole = 'admin' | 'manager' | 'tenant';

interface BulkImportToolDeps {
  roleParam: z.ZodTypeAny;
  getMcpUser: (role: McpRole) => Promise<{ id: string; role: string } | null>;
  getMcpOrgIds: () => Promise<string[]>;
}

const accessDenied = (msg: string) => ({
  content: [{ type: 'text' as const, text: msg }],
});
const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

export function registerBulkImportTools(
  server: McpServer,
  deps: BulkImportToolDeps,
): void {
  const { roleParam, getMcpUser, getMcpOrgIds } = deps;

  server.tool(
    'list_bulk_import_sessions',
    'List bulk-import sessions visible to the caller (admin only).',
    { role: roleParam, buildingId: z.string().optional() },
    async ({ role, buildingId }) => {
      const t0 = Date.now();
      logDebug('[bulk-import] mcp tool entry list_bulk_import_sessions', {
        metadata: { buildingId },
      });
      if (role !== 'admin') {
        logDebug('[bulk-import] mcp tool exit list_bulk_import_sessions denied', {
          metadata: { reason: 'not-admin', durationMs: Date.now() - t0 },
        });
        return accessDenied('Access denied: admin only');
      }
      const orgIds = await getMcpOrgIds();
      if (orgIds.length === 0) {
        logDebug('[bulk-import] mcp tool exit list_bulk_import_sessions ok (no orgs)', {
          metadata: { durationMs: Date.now() - t0, count: 0 },
        });
        return ok([]);
      }
      const rows = await db
        .select()
        .from(schema.bulkImportSessions)
        .where(
          buildingId
            ? and(
                inArray(schema.bulkImportSessions.organizationId, orgIds),
                eq(schema.bulkImportSessions.buildingId, buildingId),
              )
            : inArray(schema.bulkImportSessions.organizationId, orgIds),
        );
      logDebug('[bulk-import] mcp tool exit list_bulk_import_sessions ok', {
        metadata: { durationMs: Date.now() - t0, count: rows.length },
      });
      return ok(rows);
    },
  );

  server.tool(
    'create_bulk_import_session',
    'Create (or reuse) a bulk-import session for a building (admin only).',
    { role: roleParam, buildingId: z.string() },
    async ({ role, buildingId }) => {
      const t0 = Date.now();
      logDebug('[bulk-import] mcp tool entry create_bulk_import_session', {
        metadata: { buildingId },
      });
      if (role !== 'admin') {
        logDebug('[bulk-import] mcp tool exit create_bulk_import_session denied', {
          metadata: { reason: 'not-admin', durationMs: Date.now() - t0 },
        });
        return accessDenied('Access denied: admin only');
      }
      const orgIds = await getMcpOrgIds();
      const [building] = await db
        .select()
        .from(schema.buildings)
        .where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        logDebug('[bulk-import] mcp tool exit create_bulk_import_session denied', {
          metadata: { buildingId, reason: 'building-not-found-or-access-denied', durationMs: Date.now() - t0 },
        });
        return accessDenied('Building not found or access denied');
      }
      const user = await getMcpUser('admin');
      if (!user) {
        logDebug('[bulk-import] mcp tool exit create_bulk_import_session denied', {
          metadata: { buildingId, reason: 'admin-user-missing', durationMs: Date.now() - t0 },
        });
        return accessDenied('Admin MCP user missing');
      }
      try {
        const [existing] = await db
          .select()
          .from(schema.bulkImportSessions)
          .where(
            and(
              eq(schema.bulkImportSessions.buildingId, buildingId),
              eq(schema.bulkImportSessions.adminUserId, user.id),
              inArray(schema.bulkImportSessions.status, ['active', 'paused']),
            ),
          )
          .limit(1);
        if (existing) {
          logDebug('[bulk-import] mcp tool exit create_bulk_import_session ok (reused)', {
            metadata: { sessionId: existing.id, buildingId, durationMs: Date.now() - t0 },
          });
          return ok(existing);
        }
        const [created] = await withRetryableDbCall(() =>
          db
            .insert(schema.bulkImportSessions)
            .values({
              buildingId,
              organizationId: building.organizationId,
              adminUserId: user.id,
              currentStep: 'upload',
              status: 'active',
            })
            .returning(),
        );
        logDebug('[bulk-import] mcp tool exit create_bulk_import_session ok (created)', {
          metadata: { sessionId: created.id, buildingId, durationMs: Date.now() - t0 },
        });
        return ok(created);
      } catch (e) {
        logDebug('[bulk-import] mcp tool exit create_bulk_import_session error', {
          metadata: { buildingId, durationMs: Date.now() - t0 },
        });
        return buildWriteErrorResponse(e, 'bulk import session', 'create');
      }
    },
  );

  server.tool(
    'get_bulk_import_session',
    'Fetch a bulk-import session and its items (admin only).',
    { role: roleParam, sessionId: z.string() },
    async ({ role, sessionId }) => {
      const t0 = Date.now();
      logDebug('[bulk-import] mcp tool entry get_bulk_import_session', {
        metadata: { sessionId },
      });
      if (role !== 'admin') {
        logDebug('[bulk-import] mcp tool exit get_bulk_import_session denied', {
          metadata: { sessionId, reason: 'not-admin', durationMs: Date.now() - t0 },
        });
        return accessDenied('Access denied: admin only');
      }
      const [session] = await db
        .select()
        .from(schema.bulkImportSessions)
        .where(eq(schema.bulkImportSessions.id, sessionId));
      if (!session) {
        logDebug('[bulk-import] mcp tool exit get_bulk_import_session denied', {
          metadata: { sessionId, reason: 'not-found', durationMs: Date.now() - t0 },
        });
        return accessDenied('Session not found');
      }
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(session.organizationId)) {
        logDebug('[bulk-import] mcp tool exit get_bulk_import_session denied', {
          metadata: { sessionId, reason: 'org-scope', durationMs: Date.now() - t0 },
        });
        return accessDenied('Access denied');
      }
      const items = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.sessionId, sessionId));
      logDebug('[bulk-import] mcp tool exit get_bulk_import_session ok', {
        metadata: { sessionId, itemCount: items.length, durationMs: Date.now() - t0 },
      });
      return ok({ session, items });
    },
  );

  server.tool(
    'analyze_bulk_import_item',
    'Run one AI step on a staged item: screen | sort | branch | identify | link.',
    {
      role: roleParam,
      itemId: z.string(),
      step: z.enum(['screen', 'sort', 'branch', 'identify', 'link']),
    },
    async ({ role, itemId, step }) => {
      const t0 = Date.now();
      logDebug('[bulk-import] mcp tool entry analyze_bulk_import_item', {
        metadata: { itemId, step },
      });
      if (role !== 'admin') {
        logDebug('[bulk-import] mcp tool exit analyze_bulk_import_item denied', {
          metadata: { itemId, step, reason: 'not-admin', durationMs: Date.now() - t0 },
        });
        return accessDenied('Access denied: admin only');
      }
      const [item] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, itemId));
      if (!item) {
        logDebug('[bulk-import] mcp tool exit analyze_bulk_import_item denied', {
          metadata: { itemId, step, reason: 'item-not-found', durationMs: Date.now() - t0 },
        });
        return accessDenied('Item not found');
      }
      const [analyzeSession] = await db
        .select({ organizationId: schema.bulkImportSessions.organizationId })
        .from(schema.bulkImportSessions)
        .where(eq(schema.bulkImportSessions.id, item.sessionId));
      const analyzeOrgIds = await getMcpOrgIds();
      if (!analyzeSession || !analyzeOrgIds.includes(analyzeSession.organizationId)) {
        logDebug('[bulk-import] mcp tool exit analyze_bulk_import_item denied', {
          metadata: { itemId, step, sessionId: item.sessionId, reason: 'org-scope', durationMs: Date.now() - t0 },
        });
        return accessDenied('Access denied');
      }
      logDebug('[bulk-import] mcp tool analyze_bulk_import_item org scope resolved', {
        metadata: { itemId, step, sessionId: item.sessionId, organizationId: analyzeSession.organizationId },
      });
      try {
        let payload: Record<string, unknown> = {};
        let nextStatus: schema.BulkImportItemStatus = item.status;
        switch (step) {
          case 'screen': {
            payload = (await bulkImportAnalyzer.screen({
              originalName: item.originalName,
              mimeType: item.mimeType,
              fileSize: item.fileSize,
              stagedPath: item.stagedPath,
            })) as unknown as Record<string, unknown>;
            await withRetryableDbCall(() =>
              db
                .update(schema.bulkImportItems)
                .set({ screening: payload, status: 'screened', updatedAt: new Date() })
                .where(eq(schema.bulkImportItems.id, itemId)),
            );
            nextStatus = 'screened';
            break;
          }
          case 'sort': {
            const allItems = await db
              .select({
                id: schema.bulkImportItems.id,
                name: schema.bulkImportItems.originalName,
                screening: schema.bulkImportItems.screening,
              })
              .from(schema.bulkImportItems)
              .where(eq(schema.bulkImportItems.sessionId, item.sessionId));
            const myScreening = item.screening as Record<string, unknown> | null | undefined;
            const myQa = (myScreening?.quickAnalysis as import('../services/bulk-import-analyzer').QuickAnalysis | null | undefined) ?? null;
            const myIsMultiDocument = typeof myScreening?.isMultiDocument === 'boolean'
              ? myScreening.isMultiDocument
              : null;
            const siblings = allItems
              .filter((s) => s.id !== itemId)
              .map((s) => {
                const sc = s.screening as Record<string, unknown> | null | undefined;
                const qa = (sc?.quickAnalysis as import('../services/bulk-import-analyzer').QuickAnalysis | null | undefined) ?? null;
                return { id: s.id, name: s.name, quickAnalysis: qa };
              });
            const mergeOrSplitResult = (await bulkImportAnalyzer.suggestMergeOrSplit({
              originalName: item.originalName,
              siblings,
              quickAnalysis: myQa,
              isMultiDocument: myIsMultiDocument,
              stagedPath: item.stagedPath,
              mimeType: item.mimeType,
            })) as unknown as Record<string, unknown>;
            payload = { ...mergeOrSplitResult, decisionState: 'pending' };
            await withRetryableDbCall(() =>
              db
                .update(schema.bulkImportItems)
                .set({
                  sortingDecision: payload,
                  status: 'sorted',
                  updatedAt: new Date(),
                })
                .where(eq(schema.bulkImportItems.id, itemId)),
            );
            nextStatus = 'sorted';
            break;
          }
          case 'branch': {
            payload = (await bulkImportAnalyzer.suggestBranch({
              originalName: item.originalName,
              description:
                (item.screening as { description?: string } | null)?.description ?? '',
              stagedPath: item.stagedPath,
              mimeType: item.mimeType,
            })) as unknown as Record<string, unknown>;
            await withRetryableDbCall(() =>
              db
                .update(schema.bulkImportItems)
                .set({
                  branchDecision: payload,
                  status: 'branched',
                  updatedAt: new Date(),
                })
                .where(eq(schema.bulkImportItems.id, itemId)),
            );
            nextStatus = 'branched';
            break;
          }
          case 'identify': {
            payload = (await bulkImportAnalyzer.identify({
              originalName: item.originalName,
              description:
                (item.screening as { description?: string } | null)?.description ?? '',
              branch:
                (item.branchDecision as { branch?: string } | null)?.branch ??
                'building_documents',
              stagedPath: item.stagedPath,
              mimeType: item.mimeType,
            })) as unknown as Record<string, unknown>;
            await withRetryableDbCall(() =>
              db
                .update(schema.bulkImportItems)
                .set({
                  identification: payload,
                  status: 'identified',
                  updatedAt: new Date(),
                })
                .where(eq(schema.bulkImportItems.id, itemId)),
            );
            nextStatus = 'identified';
            break;
          }
          case 'link': {
            const candidates = await db
              .select({
                id: schema.bulkImportItems.id,
                name: schema.bulkImportItems.originalName,
              })
              .from(schema.bulkImportItems)
              .where(eq(schema.bulkImportItems.sessionId, item.sessionId));
            payload = (await bulkImportAnalyzer.suggestLinks({
              originalName: item.originalName,
              candidates: candidates.filter((c) => c.id !== itemId),
              stagedPath: item.stagedPath,
              mimeType: item.mimeType,
            })) as unknown as Record<string, unknown>;
            await withRetryableDbCall(() =>
              db
                .update(schema.bulkImportItems)
                .set({
                  linkDecisions: payload,
                  status: 'linked',
                  updatedAt: new Date(),
                })
                .where(eq(schema.bulkImportItems.id, itemId)),
            );
            nextStatus = 'linked';
            break;
          }
        }
        logDebug('[bulk-import] mcp tool exit analyze_bulk_import_item ok', {
          metadata: { itemId, step, nextStatus, durationMs: Date.now() - t0 },
        });
        return ok({ itemId, step, status: nextStatus, result: payload });
      } catch (e) {
        logDebug('[bulk-import] mcp tool exit analyze_bulk_import_item error', {
          metadata: { itemId, step, durationMs: Date.now() - t0 },
        });
        return buildWriteErrorResponse(e, 'bulk import item', 'update');
      }
    },
  );

  server.tool(
    'commit_bulk_import_item',
    'Commit a staged bulk-import item into the real documents table (admin only).',
    { role: roleParam, itemId: z.string() },
    async ({ role, itemId }) => {
      const t0 = Date.now();
      logDebug('[bulk-import] mcp tool entry commit_bulk_import_item', {
        metadata: { itemId },
      });
      if (role !== 'admin') {
        logDebug('[bulk-import] mcp tool exit commit_bulk_import_item denied', {
          metadata: { itemId, reason: 'not-admin', durationMs: Date.now() - t0 },
        });
        return accessDenied('Access denied: admin only');
      }
      const [item] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, itemId));
      if (!item) {
        logDebug('[bulk-import] mcp tool exit commit_bulk_import_item denied', {
          metadata: { itemId, reason: 'item-not-found', durationMs: Date.now() - t0 },
        });
        return accessDenied('Item not found');
      }
      const [session] = await db
        .select()
        .from(schema.bulkImportSessions)
        .where(eq(schema.bulkImportSessions.id, item.sessionId));
      if (!session) {
        logDebug('[bulk-import] mcp tool exit commit_bulk_import_item denied', {
          metadata: { itemId, sessionId: item.sessionId, reason: 'session-not-found', durationMs: Date.now() - t0 },
        });
        return accessDenied('Session not found');
      }
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(session.organizationId)) {
        logDebug('[bulk-import] mcp tool exit commit_bulk_import_item denied', {
          metadata: { itemId, sessionId: item.sessionId, reason: 'org-scope', durationMs: Date.now() - t0 },
        });
        return accessDenied('Access denied');
      }
      logDebug('[bulk-import] mcp tool commit_bulk_import_item org scope resolved', {
        metadata: { itemId, sessionId: item.sessionId, organizationId: session.organizationId },
      });
      const user = await getMcpUser('admin');
      if (!user) {
        logDebug('[bulk-import] mcp tool exit commit_bulk_import_item denied', {
          metadata: { itemId, reason: 'admin-user-missing', durationMs: Date.now() - t0 },
        });
        return accessDenied('Admin MCP user missing');
      }
      try {
        const ident =
          (item.identification as {
            name?: string;
            description?: string;
            effectiveDate?: string;
          } | null) ?? {};
        const branch =
          (item.branchDecision as { branch?: string } | null)?.branch ??
          'building_documents';
        const filePath = documentService.normalizePath(
          documentService.buildHierarchicalPath(
            { type: 'documents', buildingId: session.buildingId },
            item.originalName,
          ),
        );
        const [doc] = await withRetryableDbCall(() =>
          db
            .insert(schema.documents)
            .values({
              name: ident.name ?? item.originalName,
              description: ident.description ?? null,
              documentType: branch,
              filePath,
              fileName: item.originalName,
              originalFileName: item.originalName,
              fileSize: item.fileSize ?? null,
              mimeType: item.mimeType ?? null,
              buildingId: session.buildingId,
              uploadedById: user.id,
              effectiveDate: ident.effectiveDate ? new Date(ident.effectiveDate) : null,
            })
            .returning(),
        );
        await db
          .insert(schema.clientDocumentFingerprints)
          .values({
            organizationId: session.organizationId,
            buildingId: session.buildingId,
            contentHash: item.contentHash,
            finalDocumentId: doc.id,
          })
          .onConflictDoNothing({
            target: [
              schema.clientDocumentFingerprints.organizationId,
              schema.clientDocumentFingerprints.contentHash,
            ],
          });
        await db
          .update(schema.bulkImportItems)
          .set({
            finalDocumentId: doc.id,
            status: 'committed',
            updatedAt: new Date(),
          })
          .where(eq(schema.bulkImportItems.id, itemId));
        logDebug('[bulk-import] mcp tool exit commit_bulk_import_item ok', {
          metadata: { itemId, documentId: doc.id, durationMs: Date.now() - t0 },
        });
        return ok({ itemId, documentId: doc.id, status: 'committed' });
      } catch (e) {
        logDebug('[bulk-import] mcp tool exit commit_bulk_import_item error', {
          metadata: { itemId, durationMs: Date.now() - t0 },
        });
        return buildWriteErrorResponse(e, 'bulk import item', 'create');
      }
    },
  );

  server.tool(
    'clear_bulk_import_session',
    'Clear a bulk-import session: marks it cleared and deletes its staged items (admin only).',
    { role: roleParam, sessionId: z.string() },
    async ({ role, sessionId }) => {
      const t0 = Date.now();
      logDebug('[bulk-import] mcp tool entry clear_bulk_import_session', {
        metadata: { sessionId },
      });
      if (role !== 'admin') {
        logDebug('[bulk-import] mcp tool exit clear_bulk_import_session denied', {
          metadata: { sessionId, reason: 'not-admin', durationMs: Date.now() - t0 },
        });
        return accessDenied('Access denied: admin only');
      }
      const [session] = await db
        .select()
        .from(schema.bulkImportSessions)
        .where(eq(schema.bulkImportSessions.id, sessionId));
      if (!session) {
        logDebug('[bulk-import] mcp tool exit clear_bulk_import_session denied', {
          metadata: { sessionId, reason: 'not-found', durationMs: Date.now() - t0 },
        });
        return accessDenied('Session not found');
      }
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(session.organizationId)) {
        logDebug('[bulk-import] mcp tool exit clear_bulk_import_session denied', {
          metadata: { sessionId, reason: 'org-scope', durationMs: Date.now() - t0 },
        });
        return accessDenied('Access denied');
      }
      logDebug('[bulk-import] mcp tool clear_bulk_import_session org scope resolved', {
        metadata: { sessionId, organizationId: session.organizationId },
      });
      try {
        await withRetryableDbCall(() =>
          db
            .update(schema.bulkImportSessions)
            .set({ status: 'cleared', updatedAt: new Date() })
            .where(eq(schema.bulkImportSessions.id, sessionId)),
        );
        await db
          .delete(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.sessionId, sessionId));
        logDebug('[bulk-import] mcp tool exit clear_bulk_import_session ok', {
          metadata: { sessionId, durationMs: Date.now() - t0 },
        });
        return ok({ sessionId, status: 'cleared' });
      } catch (e) {
        logDebug('[bulk-import] mcp tool exit clear_bulk_import_session error', {
          metadata: { sessionId, durationMs: Date.now() - t0 },
        });
        return buildWriteErrorResponse(e, 'bulk import session', 'delete');
      }
    },
  );
}
