# Koveo Gestion — Manager Role Onboarding

**Audience:** Replit AI agent. Implements the manager tour catalog on top of the base layer (`00_onboarding_base.md`).

**Pre-reads (mandatory):** `00_onboarding_base.md`, `feature_list.md`, `role_description.md` §2.

> **Build state caveat (2026-04-25):** Manager flow is the most-exercised role in QA — most anchors below should map cleanly to existing screens. `create_common_space` was unblocked in build #20. `delete_residence` cascade now soft-cancels dependent invitations. `update_maintenance_request` now auto-assigns `assignedTo=caller` on first status transition — surface this in the relevant step.

---

## 1. Dependencies

| Depends on | Where | Why |
|------------|-------|-----|
| Base layer §2 (DB tables) | `00_onboarding_base.md` | Need `onboarding_progress`. |
| Base layer §4 (`/api/onboarding/*`) | `00_onboarding_base.md` | Engine reads/writes through these. |
| `<OnboardingProvider>` | base §3 | Mounts engine. |
| `data-onboarding` convention | base §3.4 | All anchors below assume this attribute. |
| Manager OAuth login flow | platform | Already exercised; fixture user `bd318cc4-…` (Kevin Hervieux). |
| Two test buildings + at least one residence + one tenant invite fixture | platform | Required so steps that assume "you have a building" are visible (see `visibleIf` predicates). |

---

## 2. Tour catalog

Six tours, run in this order on first sign-in:

| Order | `tour_id` | Title (EN / FR) | ~Steps | Notes |
|-------|-----------|-----------------|--------|-------|
| 1 | `manager.core.welcome` | Welcome, Manager / Bienvenue, gestionnaire | 4 | Dashboard, role badge, downgrade-to-tenant, locale, sign-out. |
| 2 | `manager.core.buildings` | Manage buildings & residences / Bâtiments et résidences | 7 | List, create, residences, link user, delete cascade. |
| 3 | `manager.core.invitations` | Invite people / Inviter des personnes | 6 | Invite roles ≤ manager, list, resend/cancel, audit. |
| 4 | `manager.core.financials` | Bills / Factures | 5 | List, create, update status, delete cascade. |
| 5 | `manager.core.requests` | Demands & maintenance / Demandes et entretien | 5 | Acknowledge & resolve, auto-assign, building-only demands. |
| 6 | `manager.core.communications` | Communications, meetings & spaces / Communications, réunions et espaces | 4 | Create comms, schedule meetings, common spaces. |
| 7 | `manager.core.settings` | Restart any tour later / Relancer une visite | 2 | Settings → Help & Onboarding. |

---

## 3. Step-by-step content

### 3.1 `manager.core.welcome`

| # | Step ID | Anchor | Title EN | Body EN (FR mirror) | `covers` |
|---|---------|--------|----------|---------------------|----------|
| 1 | `welcome.dashboard` | `dashboard.root` | Welcome | This dashboard shows pending demands, maintenance, and recent invitations across the buildings you manage. | `fr-1.oauth-signin` |
| 2 | `welcome.role-badge` | `topbar.role-badge` | Your role | Your role is **manager**. You can downgrade in-session to **tenant** to verify what they see. | `fr-1.role-downgrade` |
| 3 | `welcome.downgrade` | `topbar.role-switcher` | Try a tenant view | Click here to act as a tenant. Useful when debugging "what does my resident see?". Switch back any time. | `fr-1.role-downgrade` |
| 4 | `welcome.user-menu` | `topbar.user-menu` | Sign out & language | Open the user menu to sign out or change between English and French. | `fr-x-cross.localization`, `fr-1.oauth-signin` |

### 3.2 `manager.core.buildings`

| # | Step ID | Anchor | Title EN | Body EN | `covers` |
|---|---------|--------|----------|---------|----------|
| 1 | `bld.list` | `nav.buildings` | Your buildings | Every building in the orgs you manage. Click into one to see residences, bills, and demands. | `fr-3.list-buildings`, `fr-3.get-building` |
| 2 | `bld.create` | `buildings.new-btn` | Add a new building | **Required:** name, address, city, postal code, total units. Optional: construction date, floors, parking, storage, amenities, bank account, unplanned bills, inflation. | `fr-3.create-building` |
| 3 | `bld.residences-tab` | `building.residences-tab` | Residences inside a building | One row per unit. From here you can add residences and link tenants. | `fr-4.list-residences` |
| 4 | `bld.create-residence` | `residences.new-btn` | Create a residence | Only `unitNumber` is required. Other fields (floor, bedrooms, parking, storage, ownership %) are optional. | `fr-4.create-residence` |
| 5 | `bld.link-user` | `residence.link-user-btn` | Link a person to a residence | Choose the **owner**, **tenant**, or **occupant** relationship. Cross-org linking is allowed and intentional. | `fr-4.link-user-to-residence` |
| 6 | `bld.unlink-user` | `residence.row-unlink-btn` | Unlink someone | Soft-ends the link (residency history is preserved). | `fr-4.unlink-user-from-residence` |
| 7 | `bld.delete-cascade` | `building.delete-btn` | Deleting a building cascades | Removes residences, bills, payments, demands, maintenance, common spaces, and pending invitations attached to the building. There is no soft-delete. | `fr-3.delete-building`, `fr-4.delete-residence` |

### 3.3 `manager.core.invitations`

| # | Step ID | Anchor | Title EN | Body EN | `covers` |
|---|---------|--------|----------|---------|----------|
| 1 | `inv.new` | `invitations.new-btn` | Invite a person | You can invite **manager**, **tenant**, or **resident**. Admin invites are reserved for admins. | `fr-6.invite-user` |
| 2 | `inv.with-residence` | `invitations.residence-input` | Pre-link a residence | Optional: attach a residence to the invitation so the user is auto-linked when they accept. | `fr-6.invite-with-residence-prelinked` |
| 3 | `inv.duplicate-rule` | `invitations.email-input` | One pending invite per email | A duplicate returns `INVITATION_ALREADY_PENDING`. Resend or cancel the original instead of inviting again. | `fr-6.duplicate-invite-guard` |
| 4 | `inv.list` | `invitations.list` | Pending invitations | You see invitations **you sent** (not your peers'). Filter by org or email. | `fr-6.list-pending-invitations` |
| 5 | `inv.cancel-resend` | `invitations.row-actions` | Cancel or resend | Resend extends expiry by 7 days. Cancel revokes the link. | `fr-6.cancel-invitation`, `fr-6.resend-invitation` |
| 6 | `inv.audit-history` | `invitations.history-btn` | Audit history | Every action on an invitation is logged. Use this when an invite seems to "disappear" — check audit before re-inviting. | `fr-6.invitation-audit-history` |

### 3.4 `manager.core.financials`

| # | Step ID | Anchor | Title EN | Body EN | `covers` |
|---|---------|--------|----------|---------|----------|
| 1 | `fin.list` | `building.bills-tab` | Bills | All bills for this building. Filter by category and status. | `fr-7.list-bills` |
| 2 | `fin.create` | `bills.new-btn` | Create a bill | Required: title, category (enum), total, payment type (`unique` or `recurrent`), start date. The bill carries `source: "mcp"` when created via API. | `fr-7.create-bill` |
| 3 | `fin.status` | `bills.row-status` | Update status | Move between draft, sent, paid, overdue. | `fr-7.update-bill-status` |
| 4 | `fin.delete-cascade` | `bills.row-delete` | Delete cascades to payments | Deleting a bill removes its scheduled payments. The response shows what was cascaded. | `fr-7.delete-bill` |
| 5 | `fin.numbering` | `bills.row-number` | Bill numbering | Numbers follow `MCP-<timestamp>` for API-created bills. Confirm with your accounting team if you change format. | `fr-7.bill-numbering` |

### 3.5 `manager.core.requests`

| # | Step ID | Anchor | Title EN | Body EN | `covers` |
|---|---------|--------|----------|---------|----------|
| 1 | `req.demands-list` | `nav.demands` | Demands | Resident requests for information, services, or other non-maintenance asks. Org-scoped. | `fr-10.list-demands` |
| 2 | `req.maintenance-list` | `nav.maintenance` | Maintenance requests | Tenant-filed work orders. Org-scoped. | `fr-11.list-maintenance-requests` |
| 3 | `req.auto-assign` | `maintenance.row-acknowledge-btn` | Acknowledging assigns it to you | When you move a request from **submitted → acknowledged** the first time, you are auto-assigned. Reassign manually if needed. | `fr-11.update-maintenance-request` |
| 4 | `req.building-only` | `demands.create-btn` | Building-level demands | Tenants who aren't linked to a residence may still file building-scoped demands (intentional — useful for general info requests). | `fr-10.create-demand-building-only` |
| 5 | `req.residence-rules` | `demands.residence-input` | Residence-scoped demands need a link | A tenant may only file a residence-scoped demand if they are linked to that residence. The platform rejects mismatches. | `fr-10.create-demand-residence-scoped` |

### 3.6 `manager.core.communications`

| # | Step ID | Anchor | Title EN | Body EN | `covers` |
|---|---------|--------|----------|---------|----------|
| 1 | `comm.list` | `nav.communications` | Communications | Org-wide announcements. Tenants and residents see them. | `fr-12.list-communications` |
| 2 | `comm.create` | `communications.new-btn` | Post an announcement | Title and content are required (each ≥ 1 char). Author attribution is automatic. | `fr-12.create-communication` |
| 3 | `comm.meetings` | `nav.meetings` | Meetings | Schedule and list meetings. Duration must be > 0; date must be in the future. | `fr-13.list-meetings`, `fr-13.create-meeting` |
| 4 | `comm.spaces` | `building.common-spaces-tab` | Common spaces | Pool, gym, guest suite — list and create the spaces you manage. (Booking sub-tools are reachable in this build.) | `fr-14.list-common-spaces`, `fr-14.create-common-space` |

### 3.7 `manager.core.settings`

| # | Step ID | Anchor | Title EN | Body EN | `covers` |
|---|---------|--------|----------|---------|----------|
| 1 | `settings.entry` | `topbar.settings-link` | Settings | Profile, language, notifications, and onboarding live here. | `fr-x-cross.settings` |
| 2 | `settings.restart` | `settings.onboarding.restart-all` | Restart any tour | Re-run any tour from this panel. The **What's new** section flags updated tours when product features change. | `fr-x-onboarding.restart` |

---

## 4. Implementation tasks for Replit (ordered)

### Task M.1 — Scaffold manager tour content files
- Create `content/onboarding/manager/` and one TS file per tour: `welcome.ts`, `buildings.ts`, `invitations.ts`, `financials.ts`, `requests.ts`, `communications.ts`, `settings.ts`.
- Each exports a `Tour` matching the base step contract.
- `npm run lint` and `tsc --noEmit` clean.
- **Depends on:** base layer.

### Task M.2 — Add `data-onboarding` anchors
- Add the attribute to every anchor referenced in §3. Do not duplicate components — modify existing ones.
- For any selector that does not resolve on the current build, file a follow-up issue and gate the step `visibleIf: () => false`.
- **Depends on:** Task M.1.

### Task M.3 — Register tour versions
- Insert `(tour_id, version=1, changelog='Initial manager tour')` for each `tour_id` in §2 via a migration seed.
- **Depends on:** Task M.1.

### Task M.4 — Add `visibleIf` predicates
- `bld.unlink-user` — only show if a residence has at least one active link.
- `inv.audit-history` — only show if at least one audited invitation exists.
- `comm.spaces` — only show if `create_common_space` permissions check passes for the caller (building.scope-check).
- `req.auto-assign` — only show if at least one maintenance request exists for any building the manager owns.
- **Depends on:** Task M.1.

### Task M.5 — Puppeteer e2e test
- File: `tests/e2e/onboarding.manager.spec.ts`.
- Pre-condition: a manager fixture user with at least one building, one residence, one pending invite, one demand, and one maintenance request.
- Test plan:
  1. Log in as manager fixture.
  2. Walk through every tour (skip nothing). Assert each step's anchor renders before clicking **Next**.
  3. Verify the **auto-assign** caveat: file a maintenance request as tenant fixture, log back in as manager, hit **Acknowledge**, confirm `assignedTo === manager.id`.
  4. Hard-reload — assert no tour re-launches.
  5. Settings → **Restart all** → assert `welcome.dashboard` re-appears.
- **Depends on:** Tasks M.1–M.4.

### Task M.6 — Freshness-monitor coverage
- Confirm zero "uncovered features" for the manager role across §1–7, 10–14, 16 of `feature_list.md`.
- Section 8 (Invoices) and 9 (Budgets) are intentionally light — list as `xcover: ['manager']` until those flows are exposed via web/API.
- **Depends on:** Task M.1.

### Task M.7 — Localization review
- Submit FR alongside EN. Reviewer must be a native FR speaker. Reuse the invitation wizard's tone — "Locataire", "Résidence", "Bâtiment", etc.
- **Depends on:** Task M.1.

---

## 5. Replit prompt template

```
Project: Koveo Gestion. Implement manager onboarding per `02_onboarding_manager.md` (and base `00_onboarding_base.md`).

Conventions:
- Browser/E2E tests: Puppeteer. Do NOT use Cypress.
- Tour engine: driver.js v1.x.
- Selectors: anchor on `[data-onboarding="<id>"]` attributes — never on class names.
- Localization: every string EN + FR; PRs failing this fail CI.
- Feature flag: gate the whole onboarding system behind `onboarding.enabled`.

Pre-conditions for the test fixture:
- Manager fixture user (existing user `bd318cc4-…` style).
- One building with at least one residence and one tenant link.
- One pending invitation in scope.
- One in-progress maintenance request.

Deliver:
1. Content TS files under `content/onboarding/manager/`.
2. `data-onboarding` attribute additions to existing components.
3. Migration seeding `onboarding_versions` rows.
4. `visibleIf` predicates per §4 Task M.4.
5. Puppeteer test verifying every tour and the auto-assign caveat.
6. Freshness-monitor `covers` linkage.

If a target screen doesn't exist (e.g., `audit-history-btn`), open a follow-up issue and gate the step with `visibleIf: () => false`. Don't fake the screen.
```

---

## 6. Acceptance checklist (PR review)

- [ ] All seven tours exist with content matching §3 (EN + FR).
- [ ] Every `anchor.selector` resolves on a headless render of the relevant route as manager.
- [ ] `onboarding_versions` has one row per `tour_id`.
- [ ] `/api/onboarding/catalog` returns the seven tours when called as manager, fewer when called as tenant/resident, more when called as admin.
- [ ] `visibleIf` predicates hide steps the user cannot meaningfully observe.
- [ ] Puppeteer test passes including the auto-assign caveat.
- [ ] Freshness monitor reports 0 uncovered features for manager scope.
- [ ] FR translations reviewed.
- [ ] Restart-from-settings works end-to-end.

---

## 7. Known caveats / questions for the human PM

1. **`update_building` not yet shipped** — `feature_list.md` §3 marks `update_building` as `⏳`. The buildings tour does NOT include an "edit building" step. When that ships, bump `manager.core.buildings` to v2 and add the step.
2. **Invoices tour absent** — Section 8 of `feature_list.md` is `⚠️ Not exposed via MCP`. No invoices step is included; revisit when invoices land.
3. **Common space booking flow** — `feature_list.md` §14 marks bookings as `⚠️ Not exposed directly via MCP`. Booking is mentioned only as a delete cascade. Step `comm.spaces` covers space creation only. Add a booking step when booking surfaces in the UI.
4. **Documents pipeline (§15)** — `request_upload_url` / `confirm_document_upload` / `analyze_document` / `get_analysis_status` exist but are not yet driven end-to-end. No documents step in this catalog. Open a tour `manager.core.documents` once the pipeline ships.
5. **Per-org isolation** — `role_description.md` §2 notes that per-org manager isolation is not yet verified (one OAuth session covers MCP-1 + MCP-2). Once an isolated-scope manager fixture exists, add a step calling out "you only see orgs you license."
