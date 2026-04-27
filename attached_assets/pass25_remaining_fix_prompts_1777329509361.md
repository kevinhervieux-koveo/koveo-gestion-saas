# Pass #25 — Remaining Fix Prompts (Replit Agent input)

**Source pass:** Koveo Gestion QA Pass #25 (2026-04-27, build asset bundle `index-D1EmwMS1.js` / `index-6gaOWe09.css`).
**Scope of THIS file:** every Pass #25 finding **except** W43, W44, W46, W64 (those are in a separate prompts file).
**Coverage:** W45 (HIGH); W47, W48, W49 (MEDIUM); W50–W63 (LOW). Total 18 findings, packaged as **2 bundles + 8 standalone** = **10 Replit Agent tasks**.

---

## ⚠️ Instructions to Replit (read first)

> **Split each bug below into its own Replit Agent task — except where bugs have been bundled into a single PR (each bundle is marked with a `Bundle:` heading and a single combined prompt).**
>
> For every section below — bundle or standalone — open a **fresh Replit Agent message** and paste the section's prompt block (the fenced ```` ```prompt ```` block at the bottom of the section) as the Agent prompt. Do NOT mix multiple sections into one Agent run; the bundles are already pre-merged where it makes sense.
>
> Each prompt is self-contained: it includes the bug ID, the exact repro / endpoints / pages affected, the area of the codebase to look at, and acceptance criteria. Do not start a fix without re-reading the corresponding section in `test_list.md` (Pass #25 entry) for full context if the prompt feels under-specified.
>
> Default browser-test framework for new acceptance tests: **Puppeteer**. Vitest/Jest for API/unit tests.

### Role hierarchy reference (canonical, per Kevin 2026-04-27)

> **Hierarchy (most-restricted → least-restricted):** `tenant` < `resident` < `manager` < `admin` < `super_admin`. **Five distinct ranks** — `tenant` and `resident` are NOT equivalent; they sit on adjacent rungs in the same helper.
>
> Recommended helper (place in `server/lib/auth/roleRank.ts` and `client/src/lib/auth/roleRank.ts`):
>
> ```ts
> export type Role = 'tenant' | 'resident' | 'manager' | 'admin' | 'super_admin';
> const RANK: Record<Role, number> = {
>   tenant:      0,
>   resident:    1,
>   manager:     2,
>   admin:       3,
>   super_admin: 4,
> };
> export const roleRank = (r: Role | string): number => RANK[r as Role] ?? -1;
> export const requireMinRole = (min: Role) => (req, res, next) =>
>   roleRank(req.user?.role) >= roleRank(min)
>     ? next()
>     : res.status(403).json({code:'INSUFFICIENT_PERMISSIONS', message:'Access denied. Insufficient permissions.'});
> ```
>
> | Role | Rank | Menus visible | Building scope | Document visibility | Financial / sensitive info |
> |------|------|---------------|----------------|---------------------|----------------------------|
> | `tenant` | 0 | Resident menu | **Own building(s) only** — buildings the user is linked to as a tenant | **Per-document opt-in.** Manager checks "accessible au locataire" on each building-level document, and the resident/owner does the same on each residence-level document. Tenant sees ONLY documents with that flag set. Examples: lease (`bail`) — usually flagged, tenant sees it. Certificat de localisation, CA minutes, états financiers — usually not flagged, tenant does not see them. | **None.** No financial cards, no aggregate building/org financials, no other-tenants-list, no AG minutes. Per-document flag is the canonical gate. |
> | `resident` | 1 | Resident menu | Own building(s) only — buildings the user is linked to as a resident (owner) | Full document access for the building(s) the resident owns into. Resident sees CA minutes, états financiers, certificat de localisation, etc. | **Full** — resident is an owner, has the right to all financial info on their building / org. |
> | `manager` | 2 | Manager + Resident menus | Their org(s) | Full doc access on managed orgs; sets the "accessible au locataire" flag on building-level documents. | Full read/write on managed orgs. |
> | `admin` | 3 | Admin + Manager + Resident menus | Their org(s) | Same as manager + Admin menu. | Same as manager + Admin menu. |
> | `super_admin` | 4 | everything | **No org scope restriction.** Must succeed wherever `manager` or `admin` succeeds. | Same as admin, no scope restriction. (QA test account uses this role.) | Same as admin, no scope restriction. |
>
> **Document visibility model — important detail:** tenant access is NOT a class-level "no financial info" filter. It is a **per-document opt-in flag** set by the manager (building-level documents) or the resident/owner (residence-level documents). Whenever you see "tenant must not see X" in this file, the implementation pattern is:
>
> 1. The document/resource has an `accessible_to_tenant` (or equivalent) boolean column.
> 2. List endpoints filter rows where `accessible_to_tenant = true` when `req.user.role === 'tenant'`.
> 3. Detail endpoints 403 a tenant request when the row's flag is false.
> 4. UIs that render aggregated financial data (cards, totals, charts) gate the entire card with `roleRank(user.role) >= roleRank('resident')` because aggregates have no per-row flag.
>
> **Implication for every role guard / RBAC check in this file:** **replace any hardcoded role allow-list like `["manager", "admin"]` with a hierarchy comparison** — e.g. `requireMinRole('manager')`. Any guard that omits `super_admin` from a list of allowed roles is a bug. For tenant-sensitive surfaces, gate aggregate / sensitive UI with `roleRank(user.role) >= roleRank('resident')`, and gate per-document access with the `accessible_to_tenant` flag at the row level.
>
> Same helper on the client for sidebar/menu visibility — `if (roleRank(user.role) >= roleRank('manager')) { showManagerMenu }`.

### TL;DR — what's bundled vs split

| Section | Bug IDs covered | Bundle? | Why bundled / why split |
|---------|-----------------|---------|--------------------------|
| 1. **Standalone — W45** (HIGH) | W45 | split | Standalone API RBAC fix; same root cause as W43/W44 (already in the other prompts file) but a different code path. |
| 2. **Bundle: admin-pages i18n cleanup** | W47, W48, W49, W53, W56, W57 | **bundled** | All six are missing-translation / missing-enum-label issues across admin & dashboard surfaces — same i18n bundle + same enum-label helper. One PR. |
| 3. **Bundle: SPA shell DOM hygiene** | W50, W51, W52, W54 | **bundled** | All four are shell-level layout / accessibility defects (sidebar dup, html lang, document.title, missing main landmark). Same App.tsx-level changes. One PR. |
| 4. **Standalone — W55** | W55 | split | One-line route rename; touches router config + sidebar nav and nothing else. |
| 5. **Standalone — W58** | W58 | split | Single page (`/admin/compliance`), date-format pick-one. |
| 6. **Standalone — W59** | W59 | split | `/admin/bulk-document-import` building-row component — structural duplication + raw enum. Distinct from the i18n bundle because of the row-duplication piece. |
| 7. **Standalone — W60** | W60 | split | Single copy change on `/settings`, role-aware gate. |
| 8. **Standalone — W61** | W61 | split | Single page header on `/residents/building`. |
| 9. **Standalone — W62** | W62 | split | Backend route handler — the dropped `?has_bills` / `?has_budget` params on `/api/users/me/buildings`. Tightly linked to W43 (already in the other prompts file). |
| 10. **Standalone — W63** | W63 | split | One label collision on `/manager/demands`. |

**Net IDs covered: 18.** Bundled IDs: 10 (W47, W48, W49, W50, W51, W52, W53, W54, W56, W57). Standalone IDs: 8 (W45, W55, W58, W59, W60, W61, W62, W63).

---

## 1. Standalone — W45 (HIGH) — `/api/buildings` returns 403 even on in-scope orgs

**Bug ID:** W45
**Severity:** HIGH
**Surface:** API
**Affected role:** super_admin (and presumably admin)

**One-line summary:** The canonical `GET /api/buildings` resource route returns 403 INSUFFICIENT_PERMISSIONS to super_admin both bare and with `?organizationId=<in-scope-org>`. Only the workaround route `/api/users/me/buildings` works.

**Repro (from Pass #25 re-verification 2026-04-27 21:50 UTC, super_admin Kevin Hervieux session):**

```
GET /api/buildings                                              → 403 INSUFFICIENT_PERMISSIONS
GET /api/buildings?organizationId=22134aad-…  (563, IN-SCOPE)   → 403
GET /api/buildings?organizationId=8c6de72f-…  (Demo, IN-SCOPE)  → 403
GET /api/buildings?organizationId=1d330caa-…  (MCP-1)           → 403
GET /api/buildings?organizationId=7c616978-…  (MCP-2)           → 403
GET /api/users/me/buildings                                      → 200, 13 rows
```

The 403 fires even on Demo and 563 — orgs the test super_admin legitimately owns (verified by `/api/users/me/buildings` returning rows from those orgs). So the regression is real, not a side-effect of the intentional super_admin test-org scoping (which only affects `/api/users/me/organizations`).

**Where to look in the codebase:** the route handler for `GET /api/buildings`. Compare its RBAC middleware to the one on `/api/users` (which works under super_admin per Pass #21) and to the working `/api/users/me/buildings`. Likely the Drizzle handler still uses a hardcoded role allow-list (e.g. `["manager", "admin"]`) and silently 403s `super_admin` because it isn't on the list. Replace with `requireMinRole('admin')` (or whichever min-role applies) using the canonical hierarchy helper.

**Expected behavior, by role (per the canonical hierarchy):**

| Role | `GET /api/buildings` (no params) | `GET /api/buildings?organizationId=<their-org>` | `GET /api/buildings?organizationId=<other-org>` |
|------|----------------------------------|--------------------------------------------------|-------------------------------------------------|
| `super_admin` | **200**, every building (no org filter) | **200**, that org's buildings | **200**, that org's buildings (no org-scope restriction) |
| `admin` | **200**, union of buildings in their orgs | **200**, that org's buildings | **403** (or 200/empty) |
| `manager` | **200**, union of buildings in their orgs | **200**, that org's buildings | **403** (or 200/empty) |
| `resident` | **403** (or 200/empty — match `/api/users/me/buildings` policy) | **403** | **403** |
| `tenant` | **403** | **403** | **403** — explicit denial; tenants have no buildings list scope at all |

**Replit prompt:**

```prompt
BUG (HIGH) — W45: GET /api/buildings returns 403 INSUFFICIENT_PERMISSIONS to super_admin (with or without ?organizationId), including when ?organizationId points to an org the user has access to.

Verified 2026-04-27 against build-asset hash D1EmwMS1, super_admin Kevin Hervieux:
  GET /api/buildings                                                  → 403
  GET /api/buildings?organizationId=22134aad-… (563 IN-SCOPE)          → 403
  GET /api/buildings?organizationId=8c6de72f-… (Demo IN-SCOPE)         → 403
  GET /api/users/me/buildings                                           → 200, 13 rows

This regresses the Pass #21 W17/W28 fix that made the canonical
resource route serve admin scope correctly. The Web UI works around
by hitting /api/users/me/buildings, so visible breakage is limited
on the front-end, but any API client / future caller using the
canonical /api/buildings route will hit the 403.

ROOT-CAUSE PATTERN: this is part of a cluster (with W43 + W44 in
the other prompts file) where role guards use hardcoded allow-lists
like ["manager", "admin"] that silently exclude super_admin. The
canonical Koveo role hierarchy (per Kevin 2026-04-27) is:

  tenant < resident < manager < admin < super_admin   (5 distinct ranks)

super_admin must succeed everywhere manager/admin succeeds. Replace
hardcoded allow-lists with a hierarchy check.

EXPECTED, by role:
- super_admin (no org scope restriction):
    GET /api/buildings                          → 200, every building
    GET /api/buildings?organizationId=<any>     → 200, that org's bldgs
- admin / manager (org-scoped):
    GET /api/buildings (no params)              → 200, union of their
                                                  org-scoped bldgs
    GET /api/buildings?organizationId=<theirs>  → 200, that org's bldgs
    GET /api/buildings?organizationId=<other>   → 403 (or 200/empty)
- resident (own building only):
    GET /api/buildings (no params)              → 403 (or 200/empty)
- tenant (own building only, no financial/sensitive access — but
  buildings list itself is non-financial, so tenant policy follows
  resident here):
    GET /api/buildings (no params)              → 403

FIX:
1. Introduce (or reuse) the centralized helper described in the
   Role hierarchy reference at the top of this file:
     server/lib/auth/roleRank.ts (5 distinct ranks):
       const RANK = { tenant: 0, resident: 1, manager: 2, admin: 3,
                      super_admin: 4 };
       export const roleRank = (r) => RANK[r] ?? -1;
       export const requireMinRole = (min) => (req, res, next) =>
         roleRank(req.user.role) >= roleRank(min)
           ? next()
           : res.status(403).json({code:'INSUFFICIENT_PERMISSIONS',
              message:'Access denied. Insufficient permissions.'});
2. Locate the route handler for GET /api/buildings (likely
   server/routes/buildings.ts). Replace any hardcoded allow-list
   (e.g. requireRole(['manager','admin'])) with
   requireMinRole('admin'). Then in the handler:
     - if super_admin: no org filter applied unless
       ?organizationId is given.
     - else: filter to req.user.orgScope (and intersect with
       ?organizationId if provided).
3. Sweep the codebase for OTHER role guards using hardcoded
   allow-lists and migrate them too — at minimum, the routes that
   surface in W43 / W44 from the other prompts file.
4. Update Vitest cases accordingly.

ACCEPTANCE TESTS:
- Vitest, super_admin: GET /api/buildings → 200, body.length >= 13.
- Vitest, super_admin: GET /api/buildings?organizationId=22134aad-…
  (563) → 200, every row.organizationId === '22134aad-…'.
- Vitest, admin: GET /api/buildings → 200, only buildings from
  that admin's accessible orgs.
- Vitest, manager: same as admin (org-scoped subset).
- Vitest, resident: GET /api/buildings → 403 (or 200/empty —
  pick one and document).
- Vitest, tenant: GET /api/buildings → 403.
- Puppeteer, super_admin: log in, navigate to a page that uses
  /api/buildings, assert no 403 in the Network panel.
- Helper unit test: roleRank('super_admin') > roleRank('admin') >
  roleRank('manager') > roleRank('resident') >= roleRank('tenant').
```

---

## 2. Bundle: admin-pages i18n cleanup (W47, W48, W49, W53, W56, W57)

**Bugs bundled:** W47 (MEDIUM), W48 (MEDIUM), W49 (MEDIUM), W53 (LOW), W56 (LOW), W57 (LOW).

**Why bundled:** every one of these is a missing-translation or missing-enum-label issue that lands in either the i18n bundle (`fr.json`) or a centralized enum-label helper. Splitting them would mean six PRs that each touch the same one or two files. One bundle keeps the changes coherent and lets a single i18n-coverage test catch all of them.

**Bug-by-bug summary:**

| ID | Surface | Symptom |
|----|---------|---------|
| W47 | `/admin/permissions` | Page entirely English on FR UI: title "RBAC Permissions", subtitle, KPI labels (System Permissions / Active permissions / Role Hierarchy / Permission Matrix / Permission categories / User Overrides / Role-based only), filter buttons (User Permissions, All Permissions, All Roles, All Users, All Permission Types, Reset Filters), table action labels (Manage Permissions, View Details), pagination (Previous, Next, "Showing 10 of 10 users"), status badge "Active", per-row "Role Permissions / User Overrides / Total Permissions". The role-hierarchy line uses FR labels (`Administrateur → Gestionnaire → Résident → Locataire`) but the per-user role column shows raw enums (`tenant`, `manager`, `resident`). |
| W48 | `/admin/impersonation-log` | Entire page English on FR UI: title "Impersonation Audit Log", subtitle "All MCP assume_user and restore_acting_user events, newest first", disclaimer paragraph, all 6 column headers (Timestamp, Action, Performed By, Assumed User, IP Address, Outcome), empty state "No impersonation events recorded yet." Sidebar label is FR ("Journal d'usurpation d'identité") so the translation key exists for the nav label but not for any of the page-internal strings. |
| W49 | `/admin/organizations` | Page English ("Organizations Management" title, "Create" button) AND the `type` column renders the enum in **4 different formats on the same screen**: `Syndicate` (EN title-case), `demo` (raw lowercase), `Management Company` (EN two-word), `condo_association` (raw snake_case). Lookup table partially populated. |
| W53 | Sidebar (every page) | User card under sidebar reads `KH / Kevin Hervieux / super_admin` — role displayed as raw snake_case enum. Should be "Super administrateur" / "Super admin" via i18n role-label table. Same translation-table-miss as W49 org-type column. |
| W56 | `/dashboard/overview` | "Mois précédent / Mois sélectionné" subtitles render English month names ("March 2026", "April 2026"). Header card uses "Avril" so the translation table exists for some month references but not for these subheaders. |
| W57 | `/manager/user-management` | Pagination text "Utilisateurs (10 of 20 utilisateurs)" — English "of" inside an FR phrase. Same English "of" pattern on `/admin/permissions` ("Showing 10 of 10 users") but folded into W47. |

**Where to look in the codebase:**
- `client/src/i18n/fr.json` (or wherever the FR i18n bundle lives) — most missing keys.
- Each affected page component for hard-coded English strings to replace with `t('key')` calls.
- A shared helper for enum→label mapping (org-type, role) that doesn't exist yet OR exists but is incomplete. Suggest centralizing as `client/src/lib/i18n/enumLabels.ts` (or whatever the project convention is).
- The dashboard-overview month-subtitle formatter — replace the EN locale with `Intl.DateTimeFormat(language === 'fr' ? 'fr-CA' : 'en-CA', {month:'long', year:'numeric'})`.

**Role-visibility expectations for the affected pages (per the canonical hierarchy):**

| Page | Expected access (Admin menu = `admin`+) |
|------|------------------------------------------|
| `/admin/permissions` (W47) | `admin`, `super_admin` only — `manager`, `resident`, `tenant` should not see this page in the sidebar nor be able to access it directly. |
| `/admin/impersonation-log` (W48) | `admin`, `super_admin` only. |
| `/admin/organizations` (W49) | `admin`, `super_admin` only. |
| `/manager/user-management` (W57) | `manager`, `admin`, `super_admin`. Resident and tenant should not see the Manager menu at all. |
| `/dashboard/overview` (W56) | All authenticated roles, but **the financial card on the dashboard must not render any per-building bill totals to `tenant`** (tenant differentiator — see Role hierarchy reference at the top of this file). For `tenant`, render the FR/EN-localized month subtitle but suppress the dollar amounts. |
| Sidebar role label (W53) | Visible to all — render the role through `enumLabels.role(role, language)`. |

When you write the i18n / enum-helper pair, also wire up `requireMinRole('admin')` as the page-level guard for the three Admin-menu pages (W47, W48, W49). If they currently use a hardcoded allow-list that omits `super_admin`, that's a side-bug to clean up while the page is open.

**Replit prompt:**

```prompt
BUNDLED BUG FIX (MEDIUM/LOW) — W47, W48, W49, W53, W56, W57: several admin pages and shared widgets ship raw English strings on the French UI. All six findings share root cause (missing i18n keys + missing enum-label helper) and should land in a single PR.

Affected surfaces:

  /admin/permissions         (W47) — title, subtitle, all KPI labels,
                                     all filter buttons, table action
                                     labels, pagination, "Active"
                                     badge, per-row "Role Permissions /
                                     User Overrides / Total Permissions".
                                     Per-user role column shows raw enum
                                     (tenant/manager/resident).
  /admin/impersonation-log   (W48) — entire page (title, subtitle,
                                     disclaimer, all 6 table headers
                                     Timestamp/Action/Performed By/
                                     Assumed User/IP Address/Outcome,
                                     empty state).
  /admin/organizations       (W49) — "Organizations Management" title,
                                     "Create" button, AND the org-type
                                     column rendered in 4 different
                                     formats (Syndicate, demo,
                                     Management Company,
                                     condo_association).
  Sidebar user card          (W53) — role label rendered as raw
                                     "super_admin" enum.
  /dashboard/overview        (W56) — "Mois précédent / Mois sélectionné"
                                     subheaders show "March 2026" /
                                     "April 2026" (English month names).
  /manager/user-management   (W57) — "Utilisateurs (10 of 20
                                     utilisateurs)" uses English "of".

EXPECTED: every visible string passes through the FR i18n bundle when
user.language === "fr". Org-type enums map to a single FR title-case
label (Syndicat / Démo / Société de gestion / Association de
copropriété / Société de gestion). Role enums map to FR labels (Super
administrateur / Administrateur / Gestionnaire / Résident / Locataire).
Month names use Intl.DateTimeFormat with 'fr-CA'. Pagination uses
"sur" instead of "of".

FIX:
1. Audit each affected page, replace literal English strings with
   t('key') calls; add the missing keys to the i18n bundle.
2. Centralize the org-type → label and role → label mapping in a
   single helper (e.g. client/src/lib/i18n/enumLabels.ts) and call it
   everywhere a role or org-type is rendered. Cover: super_admin,
   admin, manager, resident, tenant; condo_association, syndicate,
   management_company, demo, rental, apartment.
3. Replace any "March 2026" / "April 2026" formatter with
   `new Intl.DateTimeFormat(language === 'fr' ? 'fr-CA' : 'en-CA',
   {month:'long', year:'numeric'}).format(date)`.
4. Replace pagination "of" with t('common.of') resolving to "sur" in
   FR and "of" in EN.

ROLE-VISIBILITY (per canonical Koveo role hierarchy
tenant < resident < manager < admin < super_admin — 5 distinct ranks):
while you're in
the affected components, replace any page-level role allow-list
that omits super_admin (e.g. requireRole(['admin'])) with
requireMinRole('admin'). Specifically:
  /admin/permissions, /admin/impersonation-log,
  /admin/organizations  → requireMinRole('admin')
  /manager/user-management → requireMinRole('manager')

For /dashboard/overview (W56), the page itself is visible to every
authenticated role, BUT the per-building bill totals on the
financial card MUST NOT render to tenant. Tenants see the dashboard
shell + month labels, but financial figures are suppressed (or the
financial card is hidden). This is the tenant differentiator — see
Role hierarchy reference at the top of this file.

ACCEPTANCE TESTS:
- Puppeteer: visit each page above with user.language='fr', assert
  the body does not contain any of: "Manage Permissions", "Reset
  Filters", "Showing", " of ", "March ", "April ", "Syndicate",
  "Management Company", "condo_association", "super_admin", "Active
  permissions", "Impersonation Audit Log", "Organizations
  Management", "RBAC Permissions".
- Puppeteer: same pages with user.language='en' should still render
  in English (no false-positive translation regressions).
- Vitest: enumLabels.role('super_admin', 'fr') === 'Super
  administrateur' (and matching cases for every role/type/locale).
- Add a regex-snapshot test that fails CI if any of the affected
  pages, with user.language='fr', contains the English month names
  March/April/etc., the literal "of" between digits, or a raw
  snake_case enum surfaced as text content.
- Puppeteer (role visibility): tenant + resident sessions cannot
  see the Admin sidebar group nor reach /admin/permissions,
  /admin/impersonation-log, /admin/organizations directly (403 or
  redirect).
- Puppeteer (tenant financial scope): tenant on /dashboard/overview
  does NOT see any "$" character or dollar amounts in the financial
  card. Resident + manager + admin + super_admin all do see them.
```

---

## 3. Bundle: SPA shell DOM hygiene (W50, W51, W52, W54)

**Bugs bundled:** W50, W51, W52, W54 (all LOW).

**Why bundled:** all four are structural defects in the SPA shell layout (sidebar duplication, html lang attribute, document.title management, missing main landmark). They live in the same App-level component(s) and are best fixed together so the acceptance tests don't fight each other.

**Bug-by-bug summary:**

| ID | Surface | Symptom |
|----|---------|---------|
| W50 | DOM (every authenticated route) | Sidebar nav buttons (Tableau de bord, Résidents, Gestionnaire, Administrateur, Super Admin, Paramètres, Déconnexion) and the user card ("KH Kevin Hervieux super_admin / Suivez-nous LinkedIn") render twice in the DOM. `document.querySelectorAll('aside button, nav button')` returns 14 buttons (each label twice). Likely desktop + mobile sidebars both mounted with no responsive `display:none` gate. |
| W51 | DOM (every page) | `<html lang="en">` while UI rendered in French (`/api/auth/user.language === "fr"`). Affects screen-reader voice, browser auto-translate, SEO. |
| W52 | DOM (every page) | `<title>` is the marketing-page tagline (`Koveo Gestion — Property Management Software for Quebec Condos & Rentals`) on every authenticated route. No per-route title management. Affects browser history, tab labels, bookmarks, and screen-reader page-change announcements. |
| W54 | DOM (every page) | `document.querySelectorAll('main').length === 0` on every authenticated route tested. Page has `<aside>` for the sidebar but no `<main>` wrapping the route content. Fails WCAG 1.3.1 / ARIA landmark requirements. |

**Where to look in the codebase:**
- The top-level layout component (likely `client/src/components/AppLayout.tsx` / `Layout.tsx` / `Shell.tsx` — wherever the sidebar + content area is composed).
- The two sidebar components (desktop + mobile) — look for `md:hidden` / `hidden md:block` Tailwind gates that may be missing.
- The router root — wherever `<Switch>` / `<Routes>` is wrapped, that's where to insert `<main>`.
- Wherever `language` is read from the user/me endpoint — that's where to push it into `document.documentElement.lang`.
- A per-route `documentTitle` hook (or add one) — set `document.title = ${routeTitle} — Koveo Gestion`.

**Replit prompt:**

```prompt
BUNDLED BUG FIX (LOW) — W50, W51, W52, W54: the SPA shell has four
structural issues across all authenticated routes. All four are best
fixed in a single PR because they touch the same App / Layout
component(s) and share acceptance-test infrastructure.

  W50 — Sidebar nav + user card render twice in the DOM on every page.
        Most likely the desktop sidebar AND the mobile sidebar are
        both mounted with no responsive display gate.
  W51 — <html lang="en"> regardless of user.language. Accessibility
        and Chrome auto-translate both rely on this attribute.
  W52 — <title> is the marketing tagline ("Koveo Gestion — Property
        Management Software for Quebec Condos & Rentals") on every
        authenticated route. No per-route title.
  W54 — No <main> landmark anywhere. Screen-reader users can't jump
        to page content via the "main" landmark.

REPRO (super_admin Kevin Hervieux, build D1EmwMS1, 2026-04-27):
  Open /dashboard/overview in DevTools console:
    document.querySelectorAll('aside button, nav button').length
                                                          → 14 (W50)
    document.documentElement.lang                          → "en" (W51)
    document.title                                         → "Koveo
      Gestion — Property Management Software ..."         (W52)
    document.querySelectorAll('main').length              → 0  (W54)

EXPECTED:
  - Only one nav rendered at any viewport size (W50).
  - <html lang="fr"> when user.language='fr', "en" when 'en' (W51).
  - <title> = `${routeTitle} — Koveo Gestion` per route, with FR
    titles when user.language='fr' (W52).
  - <main> landmark wraps the route outlet on every page (W54).
  - "Skip to main content" link above the layout (a11y bonus).

FIX:
1. (W50) Wrap the desktop sidebar in `hidden md:block` (or
   equivalent) and the mobile sidebar in `md:hidden`, so only one is
   in the DOM at any viewport size. Remove the duplicated user card
   from one of them.
2. (W54) Replace the route outlet's wrapper <div> with
   `<main id="main" role="main">`. Add a "Skip to main content" link
   above it, hidden until focused.
3. (W51) In a top-level useEffect that depends on user.language (and
   on initial mount), set `document.documentElement.lang = language`.
4. (W52) Per-route title management: add a `useDocumentTitle(key)`
   hook (or equivalent) called in each route component, setting
   document.title = `${t(key)} — Koveo Gestion`. Default catch-all
   fallback: just "Koveo Gestion".

ACCEPTANCE TESTS (Puppeteer):
- (W50) Visit /dashboard/overview, assert
  `document.querySelectorAll('aside button').length === 7`
  (one nav, not two).
- (W54) Assert `document.querySelector('main') !== null` on every
  authenticated route in the sidebar (loop through them).
- (W51) With user.language='fr', assert
  `document.documentElement.lang === 'fr'`. Switch to 'en', assert
  it flips.
- (W52) Visit each route, assert `document.title` starts with the
  expected route name (not the marketing tagline). Specifically:
  /dashboard/overview → "Tableau de bord — Koveo Gestion" (or FR
  equivalent), /manager/buildings → "Bâtiments — Koveo Gestion",
  etc.
```

---

## 4. Standalone — W55 — `/resident/common-spaces` (singular) vs `/residents/*` (plural)

**Bug ID:** W55
**Severity:** LOW
**Surface:** routing
**Affected role:** tenant, resident, super_admin (sidebar nav exposed to all)

**One-line summary:** The Résidents nav group has 4 routes — 3 plural (`/residents/residence`, `/residents/building`, `/residents/demands`) and 1 singular (`/resident/common-spaces`). Inconsistent prefix; breaks any active-section highlighting that uses `pathname.startsWith('/residents/')`.

**Where to look:** the router config file + the sidebar nav component that lists the Résidents links + any hook / helper that highlights the active section.

**Decision required:** which prefix to canonicalize on. The plural form (`/residents/`) is the existing majority — recommend renaming `/resident/common-spaces` → `/residents/common-spaces` and adding a permanent redirect from the singular path to the plural.

**Role visibility:** the Résidents nav group is visible to `resident`, `tenant`, `manager`, `admin`, `super_admin` (everyone — Resident menu is the most-permissive menu group). No RBAC change needed; just the route rename.

**Replit prompt:**

```prompt
BUG (LOW) — W55: routing inconsistency. The Résidents nav group has
4 routes:
  /residents/residence        ← plural
  /residents/building         ← plural
  /residents/demands          ← plural
  /resident/common-spaces     ← SINGULAR

Inconsistent prefix; breaks any pathname.startsWith('/residents/')
based active-section highlighting.

EXPECTED: canonicalize on the plural form. Rename
/resident/common-spaces → /residents/common-spaces. Add a permanent
301-style client redirect from the old singular path to the new
plural path so any deep links keep working.

FIX:
1. In the router config, rename the route from /resident/common-spaces
   to /residents/common-spaces. Add a redirect rule
   `/resident/common-spaces → /residents/common-spaces`.
2. Update the sidebar nav entry's href to the new path.
3. Grep the codebase for any other reference to '/resident/common-
   spaces' and replace.

ACCEPTANCE TESTS:
- Puppeteer: visit /residents/common-spaces directly → renders the
  Common Spaces page.
- Puppeteer: visit the old /resident/common-spaces → redirects to
  /residents/common-spaces, page renders.
- Puppeteer: with the user on /residents/common-spaces, assert the
  "Résidents" sidebar group is highlighted (using the same
  highlighting logic as the other 3 plural routes).
```

---

## 5. Standalone — W58 — `/admin/compliance` shows two different date formats

**Bug ID:** W58
**Severity:** LOW
**Surface:** Web (`/admin/compliance`)

**One-line summary:** Same timestamp rendered two different ways on the same page, ~200 px apart.

**Repro:**

```
Header card:    Dernière analyse: 2026-04-27 17 h 26 min 11 s     ← FR-Canada locale, ISO date
Metric card:    Dernière analyse 27/04/2026 17:26:11               ← dd/mm/yyyy + numeric
```

**Where to look:** the `/admin/compliance` page component — likely two different date-formatting calls (one using `Intl.DateTimeFormat` with FR-Canada, one using a `format()` helper with a hardcoded format string).

**Role visibility:** `/admin/compliance` is in the Admin menu — visible to `admin`, `super_admin` only. While in this component, confirm the page-level guard uses `requireMinRole('admin')` (not a hardcoded allow-list that would omit `super_admin`). No tenant/resident/manager exposure for this page.

**Replit prompt:**

```prompt
BUG (LOW) — W58: /admin/compliance shows two different date-time
formats on the same page, ~200 px apart, for the same timestamp.

  Header card:  "Dernière analyse: 2026-04-27 17 h 26 min 11 s"
                ← FR-Canada locale, ISO date, words for time units
  Metric card:  "Dernière analyse 27/04/2026 17:26:11"
                ← dd/mm/yyyy + numeric time

EXPECTED: pick one format and use it everywhere on this page.
Recommendation: keep the FR-Canada locale variant
("2026-04-27 17 h 26 min 11 s") since it's the cleaner option for
a Quebec-focused product. Use Intl.DateTimeFormat with locale
'fr-CA' for both calls.

FIX:
1. In the /admin/compliance page component, find both
   "Dernière analyse" date renders.
2. Replace both with the same `formatComplianceDate(date, language)`
   helper (or inline Intl.DateTimeFormat call) using the FR-Canada
   format.
3. Audit other admin pages for the dd/mm/yyyy + numeric pattern and
   normalize while you're in the area.

ACCEPTANCE TESTS:
- Puppeteer: load /admin/compliance with user.language='fr', assert
  the body does not contain "/2026" (the dd/mm/yyyy slash format).
- Puppeteer: assert the body contains the FR-Canada-style format
  marker "h " (e.g. "17 h 26 min").
```

---

## 6. Standalone — W59 — `/admin/bulk-document-import` building rows duplicate name + leak raw enums

**Bug ID:** W59
**Severity:** LOW
**Surface:** Web (`/admin/bulk-document-import`)

**One-line summary:** Each building row in the selector duplicates the building/org name and renders enums as raw lower-case strings.

**Repro examples (textContent of the row, captured 2026-04-27):**

```
"563 montée des pionniers563 montée des pionniers563 montée des pionniers, terrebonne, QC6 unitéscondo"
"4647 Meggie Pass Building 26051 montée René-Lévesque, Montreal, QC8 unitésappartement"
```

Three issues stacked:
1. Building name + address concatenated without separator (the visual probably has a line break, but the textContent suggests no spacer between fields).
2. City `terrebonne` lower-cased (should be `Terrebonne`).
3. Building type rendered as raw enum (`condo`, `appartement`) — should map to the same enum-label helper used by the i18n bundle (W49).
4. For the `563 montée des pionniers` row specifically: the org name is duplicated **three times** ("563 montée des pionniers563 montée des pionniers563 montée des pionniers, …"), suggesting the row template concatenates building-name + org-name + something else without separators.

**Where to look:** the building-row component in `/admin/bulk-document-import` — likely a `<BuildingCard>` or similar. Check the JSX template for missing separators between fields (probably stacked `<div>`s with `flex` / `gap-2` rather than concatenated text).

**Note:** the enum-label part of this overlaps with the i18n bundle (W49). Either pick this up after the i18n bundle merges (and just consume the helper here), or duplicate the local enum lookup inline. Coordinate the order of merge.

**Role visibility:** `/admin/bulk-document-import` is in the Admin menu — visible to `admin`, `super_admin` only. Page-level guard should be `requireMinRole('admin')`.

**Replit prompt:**

```prompt
BUG (LOW) — W59: /admin/bulk-document-import building rows are
malformed. Each row's textContent shows the building name
concatenated with the address with no separator, the city
lower-cased, and the building type rendered as a raw enum. For the
563 row specifically, the org name appears three times in the row.

REPRO (super_admin, build D1EmwMS1, 2026-04-27):
  Visit /admin/bulk-document-import. Each building card's
  textContent looks like:

    "563 montée des pionniers563 montée des pionniers563 montée des
     pionniers, terrebonne, QC6 unitéscondo"

    "4647 Meggie Pass Building 26051 montée René-Lévesque, Montreal,
     QC8 unitésappartement"

EXPECTED:
- Building name and address rendered on separate lines (or with a
  visible separator).
- City title-cased (e.g. "Terrebonne", not "terrebonne").
- Building type rendered through the shared enum-label helper
  introduced in the i18n bundle (W49) — "Condo" / "Appartement"
  on FR UI.
- Each row's textContent contains the building name and the org
  name AT MOST ONCE each.

FIX:
1. Locate the building-row component used on /admin/bulk-document-
   import (likely a BuildingCard or a row template inside a list
   component).
2. Audit the JSX for the "name + name + name" duplication on the
   563 row — likely a misplaced prop or a mistakenly repeated child.
3. Add proper separators between building-name, address, city/prov,
   units, type. Use stacked divs with semantic spacing rather than
   inline string concatenation.
4. Apply title-case to city via `string.replace(/\b\w/g, c =>
   c.toUpperCase())` or rely on the source being capitalized — if
   the source is lowercase in the DB, normalize on render.
5. Replace the raw `condo` / `appartement` text with
   `enumLabels.buildingType(type, language)` from the helper added
   in the i18n bundle (or inline equivalent).

ACCEPTANCE TESTS:
- Puppeteer: visit /admin/bulk-document-import. For each visible
  building card, assert:
    - The card's text does not contain the building name twice.
    - The card's text contains exactly one of: "Condo" / "Appartement"
      / equivalent FR labels (no raw "condo" / "appartement").
    - The card's text contains the city title-cased
      (no "terrebonne", instead "Terrebonne").
- Take a snapshot of the cleaned-up "563 montée des pionniers" card
  and pin it as a regression artefact.
```

---

## 7. Standalone — W60 — `/settings` tells super_admin "contactez votre gestionnaire"

**Bug ID:** W60
**Severity:** LOW
**Surface:** Web (`/settings`)
**Affected role:** super_admin (and presumably admin, manager — anyone with no upstream "manager")

**One-line summary:** The "Mes résidences" section on `/settings` shows the tenant-style fallback copy to a super_admin user, which is wrong since super_admin has no upstream "gestionnaire".

**Repro:** super_admin → `/settings` → "Mes résidences" section reads:

> "Aucune résidence liée pour l'instant — contactez votre gestionnaire."

**Where to look:** the `/settings` page component, "Mes résidences" section. Likely a default copy used for tenants that doesn't gate on role.

**Role-aware copy expected (per the canonical Koveo hierarchy `tenant ≤ resident < manager < admin < super_admin`):**

| Role | Copy expected when "Mes résidences" is empty |
|------|----------------------------------------------|
| `tenant` | **Original copy:** "Aucune résidence liée pour l'instant — contactez votre gestionnaire." (Correct as-is — tenants do have an upstream gestionnaire.) Tenant should NOT see anything that links to a Manager surface (no "Gestionnaire → Résidences" CTA). |
| `resident` | Same as tenant — they have an upstream gestionnaire and no Manager menu. |
| `manager` / `admin` / `super_admin` | **New role-aware copy:** "En tant que {role-label}, vous gérez les résidences depuis Gestionnaire → Résidences." with a `<Link to="/manager/residences">`. They have no upstream gestionnaire (they ARE the management). |

Use `roleRank(user.role) >= roleRank('manager')` (from the canonical helper) as the gate, not a hardcoded list.

**Replit prompt:**

```prompt
BUG (LOW) — W60: /settings "Mes résidences" section shows tenant-
style fallback copy to super_admin / admin / manager users.

REPRO: log in as super_admin (or admin, or manager), navigate to
/settings, scroll to "Mes résidences". Section reads:

  "Aucune résidence liée pour l'instant — contactez votre
   gestionnaire."

This is wrong for super_admin (and admin, and manager) — they have
no upstream "gestionnaire"; in many cases they ARE the manager.
The original copy is correct for tenant + resident (who DO have an
upstream gestionnaire).

EXPECTED, by role (per canonical Koveo hierarchy
tenant ≤ resident < manager < admin < super_admin):

  tenant   : existing copy "Aucune résidence liée pour l'instant —
             contactez votre gestionnaire." (Tenants do have an
             upstream gestionnaire — leave as-is. No
             Manager-surface link.)
  resident : same as tenant.
  manager  : NEW role-aware copy, e.g. "En tant que gestionnaire,
             vous gérez les résidences depuis Gestionnaire →
             Résidences." with a Link to /manager/residences.
  admin    : NEW role-aware copy, e.g. "En tant qu'administrateur,
             vous gérez les résidences depuis Gestionnaire →
             Résidences." with the same Link.
  super_admin : same shape as admin.

FIX:
1. In the /settings page component, find the "Mes résidences"
   section.
2. Wrap the empty-state copy with the canonical hierarchy helper:
     if (roleRank(user.role) >= roleRank('manager')) {
       render <StaffEmptyResidences role={user.role} />
     } else {
       render <TenantEmptyResidences />  // existing copy
     }
3. Use the enum-label helper (W47/W49/W53 bundle) to render the
   role label inside the copy: t('settings.residences.empty.staff',
   { role: enumLabels.role(user.role, language) }).
4. Add the new i18n keys for both languages — make sure the
   translation references a SINGLE link target (/manager/residences)
   rather than role-specific links, since manager + admin + super_admin
   all share that destination.

ACCEPTANCE TESTS:
- Puppeteer, tenant: /settings, "Mes résidences" empty state — assert
  original "contactez votre gestionnaire" copy. Assert NO link to
  /manager/residences anywhere in the section.
- Puppeteer, resident: same as tenant.
- Puppeteer, manager: /settings, "Mes résidences" — assert NEW copy
  contains "Gestionnaire → Résidences" AND the link's href is
  "/manager/residences".
- Puppeteer, admin: same as manager.
- Puppeteer, super_admin: same as manager (the differentiator is
  scope, not the copy itself).
```

---

## 8. Standalone — W61 — `/residents/building` page header reads "Gestion de bâtiments"

**Bug ID:** W61
**Severity:** LOW
**Surface:** Web (`/residents/building`)

**One-line summary:** The page renders the manager-style title "Gestion de bâtiments" but the sidebar nav label that points to it says "Mon bâtiment". UI title doesn't match the navigation label.

**Where to look:** the `/residents/building` page component. Likely the manager building-list component is reused for the resident-context route, and its title is hard-coded.

**Role visibility + tenant-access model (per canonical hierarchy, confirmed by Kevin 2026-04-27):**

| Role | `/residents/building` access | What may render |
|------|-------------------------------|-----------------|
| `tenant` | ✓ visible (Resident menu) — **own building only** | Building info **without financial aggregates** (no operating budget totals, no shared-fund balance, no per-tenant cost breakdowns). Per-document visibility: tenant sees ONLY documents whose `accessible_to_tenant` flag is true (set by the manager on building docs). Examples: lease (`bail`) — usually shown; certificat de localisation, états financiers, CA minutes — usually hidden. |
| `resident` | ✓ visible (own building only) | Resident is the **owner** — full access to all financials and all documents on their building. Includes CA minutes, états financiers, certificat de localisation. |
| `manager` / `admin` / `super_admin` | ✓ visible | Same as resident; in addition they can navigate to /manager/buildings for the management view and toggle the per-document `accessible_to_tenant` flag. |

While renaming the title, audit the page for any leaks to tenants. Two distinct gating patterns apply (per Kevin's clarification):

1. **Aggregate financial cards** (operating budget totals, fund balance, per-tenant breakdowns, charts based on aggregated bills): no per-row flag exists → gate the entire card with `roleRank(user.role) >= roleRank('resident')`. Tenant sees nothing; resident, manager, admin, super_admin all see them.
2. **Per-document lists** (e.g. "Documents du bâtiment" panel listing leases / minutes / financial statements): filter rows server-side by `accessible_to_tenant = true` when `req.user.role === 'tenant'`. Detail endpoints 403 a tenant request when the row's flag is false.

**Replit prompt:**

```prompt
BUG (LOW) — W61: /residents/building page header reads "Gestion de
bâtiments" (manager-style title) instead of "Mon bâtiment" (the
sidebar nav label that points to it).

REPRO: log in (any role with the Résidents nav group), click "Mon
bâtiment" in the sidebar — page renders with header "Gestion de
bâtiments".

EXPECTED:
- Page header reads "Mon bâtiment" (FR) / "My building" (EN),
  matching the sidebar label.
- Per the canonical Koveo role hierarchy
  (tenant ≤ resident < manager < admin < super_admin), this page is
  visible to ALL roles with the Resident menu (everyone). BUT the
  TENANT role differentiator is "no sensitive/financial info" — so
  if the page reuses the manager building-list component with its
  financial cards, those financial cards must NOT render for
  tenant.

FIX:
1. Locate the page component for /residents/building. Most likely
   it reuses the manager building-list component — either pass a
   `title` prop / context, or split into a thin wrapper component
   that sets the resident-context title.
2. Add the i18n keys: residents.building.title = "Mon bâtiment" /
   "My building".
3. While in the component, audit for two distinct tenant-leak
   patterns (per Kevin's clarification 2026-04-27):
   a. AGGREGATE financial cards (operating budget totals,
      per-tenant breakdowns, fund balances, charts): no per-row
      flag exists → gate the entire card with
        {roleRank(user.role) >= roleRank('resident') && <FinancialCard … />}
      Resident is an owner with full access; tenant sees nothing
      aggregate.
   b. PER-DOCUMENT lists (e.g. "Documents du bâtiment" panel):
      filter rows server-side by accessible_to_tenant = true when
      req.user.role === 'tenant'. The flag is set by the manager on
      building-level documents. Tenant typically sees the lease
      (bail) but not états financiers / CA minutes / certificat de
      localisation.
4. Verify that any other manager-vs-resident reused component isn't
   inheriting the wrong title (audit /residents/residence,
   /residents/demands, /resident/common-spaces).

ACCEPTANCE TESTS:
- Puppeteer, any role: navigate to /residents/building, assert the
  visible H1 / page header text equals "Mon bâtiment" (FR) or "My
  building" (EN), NOT "Gestion de bâtiments".
- Puppeteer, manager: navigate to /manager/buildings, assert the
  header is still "Gestion des bâtiments" (manager context
  unchanged).
- Puppeteer, tenant: navigate to /residents/building. Assert NO
  "$" character or dollar amounts appear in the page body. Assert
  NO operating-budget / fund-balance card is rendered.
- Puppeteer, tenant: in the "Documents du bâtiment" panel (if
  present on this page), assert that ONLY documents with
  accessible_to_tenant=true appear (seed test data accordingly).
- Puppeteer, resident: same page — financial cards SHOULD render
  (resident is owner; only tenant is restricted on aggregates).
- Puppeteer, resident: in the "Documents du bâtiment" panel, ALL
  documents appear regardless of accessible_to_tenant flag.
```

---

## 9. Standalone — W62 — `/api/users/me/buildings` ignores most query parameters

**Bug ID:** W62
**Severity:** LOW
**Surface:** API
**Affected role:** any authenticated user

**One-line summary:** `/api/users/me/buildings` accepts `?has_common_spaces=true` (honored — returns the 3 buildings with common spaces) but **silently ignores** `?organizationId=…`, `?has_bills=true`, `?has_budget=true`, `?type=…` — they all return the full 13-row payload. This is the upstream cause of W43 (the bills page falls back to per-building probes that 403, because the server-side `has_bills` filter doesn't exist).

**Repro (super_admin, 2026-04-27):**

```
GET /api/users/me/buildings                                    → 13 rows
GET /api/users/me/buildings?organizationId=8c6de72f-…          → 13 rows  (param dropped)
GET /api/users/me/buildings?has_bills=true                     → 13 rows  (param dropped)
GET /api/users/me/buildings?has_budget=true                    → 13 rows  (param dropped)
GET /api/users/me/buildings?type=bills                         → 13 rows  (param dropped)
GET /api/users/me/buildings?has_common_spaces=true             →  3 rows  (HONORED)
```

**Where to look:** the route handler for `GET /api/users/me/buildings`. Find the existing `has_common_spaces` filter implementation and replicate the same pattern for `has_bills`, `has_budget`, `organizationId`, `type`.

**Note:** this is closely related to **W43** (which is in the other prompts file). When W62 lands, the bills page can stop probing per-building and rely on the server-side filter — which makes W43 less impactful. Coordinate the order: fixing W62 first lets W43 use a clean response shape; fixing W43 first means re-doing the W43 client logic when W62 lands. **Recommend merging W62 first.**

**Role behavior expected (per canonical hierarchy, confirmed by Kevin 2026-04-27):** `/api/users/me/buildings` is the "my scope" route — every authenticated role can call it. Each role gets the rows they're entitled to:
- `super_admin`: every building (no org filter unless `?organizationId` is given).
- `admin` / `manager`: org-scoped subset.
- `resident`: their own building only (resident is owner — full access to non-aggregate building data).
- `tenant`: their own building only on non-financial filters. **Confirmed: tenant calling `?has_bills=true` or `?has_budget=true` returns `403`** (financial filters are gated for tenants — no financial signal at all, even building-list-level). Tenant on `?has_common_spaces=true`, `?organizationId=…`, `?type=…` returns 200 with their building(s).

**Replit prompt:**

```prompt
BUG (LOW) — W62: /api/users/me/buildings honors ?has_common_spaces
but silently ignores ?organizationId, ?has_bills, ?has_budget,
?type. This is the root cause that makes W43 (bills/budget
selectors empty) visible.

REPRO (super_admin, 2026-04-27, build D1EmwMS1):
  GET /api/users/me/buildings                                  → 13
  GET /api/users/me/buildings?organizationId=8c6de72f-…        → 13
  GET /api/users/me/buildings?has_bills=true                   → 13
  GET /api/users/me/buildings?has_budget=true                  → 13
  GET /api/users/me/buildings?type=bills                       → 13
  GET /api/users/me/buildings?has_common_spaces=true           →  3 ✓

EXPECTED: all of the above query params are honored server-side and
filter the response. Specifically:
  - ?organizationId=<id>  : only buildings whose organizationId
                            matches.
  - ?has_bills=true       : only buildings that have at least one
                            bill (the bills page can then trust the
                            response and stop per-building probes).
  - ?has_budget=true      : only buildings that have a budget config.
  - ?type=<type>          : filter by buildingType.
  - ?has_common_spaces    : already works, leave as-is.

ROLE BEHAVIOR (per canonical Koveo hierarchy
tenant < resident < manager < admin < super_admin, confirmed by
Kevin 2026-04-27):
- super_admin: no org filter unless ?organizationId provided.
- admin / manager: filter to their accessible orgs; intersect with
  ?organizationId if provided.
- resident: their own building only (resident is owner, full
  non-aggregate access).
- tenant: their own building only on non-financial filters
  (has_common_spaces, organizationId, type). On the financial
  filters (?has_bills, ?has_budget), return 403 — confirmed by
  Kevin (no financial signal at all, even at the building-list
  level).

FIX:
1. In the route handler for GET /api/users/me/buildings, find the
   existing has_common_spaces filter implementation (it works, so
   it's the model).
2. Add equivalent server-side filters for has_bills, has_budget,
   organizationId, type. Each should be a guard on the SQL query
   (Drizzle `.where()` clause) that's only added when the param is
   present.
3. Update the OpenAPI / route schema (if any) to document the
   accepted params.

ACCEPTANCE TESTS:
- Vitest: GET /api/users/me/buildings?organizationId=8c6de72f-…
  under super_admin returns rows where every row.organizationId ===
  '8c6de72f-…'.
- Vitest: GET /api/users/me/buildings?has_bills=true returns a
  subset of the unfiltered response, where every row.id appears in
  the result of `SELECT DISTINCT building_id FROM bills`.
- Vitest: same shape for has_budget, type.
- Vitest: tenant calling ?has_bills=true → 403 (or 200 with
  financial fields stripped — match project convention).
- Vitest: tenant calling ?has_common_spaces=true → 200 (non-financial,
  no scope restriction).
- Puppeteer (also unblocks W43): super_admin → /manager/bills →
  pick Demo → at least one building shows up in the second selector
  (no longer "Aucun élément trouvé").
```

---

## 10. Standalone — W63 — `/manager/demands` shows duplicated "Filtres" label

**Bug ID:** W63
**Severity:** LOW
**Surface:** Web (`/manager/demands`)

**One-line summary:** Page chrome contains "...Demandes / ... / Filtres / Filtres / Effacer les filtres ..." — the literal "Filtres" appears twice in the textContent on the same row.

**Repro:** `/manager/demands` — DOM snapshot of the page chrome:

```
Gestion des demandes
Gérer les demandes de maintenance et réclamations
EN FR
Filtres            ← header
Filtres            ← button label or panel-toggle label
Effacer les filtres
Tout sélectionner
Aucune demande trouvée
```

**Where to look:** the `/manager/demands` page component, filter panel area. Likely a section header that says "Filtres" plus a button/toggle that also says "Filtres" — both rendered.

**Role visibility:** `/manager/demands` is in the Manager menu — visible to `manager`, `admin`, `super_admin`. Resident + tenant should not see this page (they have `/residents/demands` instead). Page guard should be `requireMinRole('manager')`.

**Replit prompt:**

```prompt
BUG (LOW) — W63: /manager/demands renders the literal "Filtres"
twice in the page chrome (header + button collision).

REPRO (super_admin, build D1EmwMS1, 2026-04-27):
  Visit /manager/demands. The page text contains:
    "...Demandes / Gérer les demandes de maintenance et
     réclamations / EN / FR / Filtres / Filtres / Effacer les
     filtres / Tout sélectionner / Aucune demande trouvée"

EXPECTED: only one "Filtres" label visible. Either drop the
section header, drop the button/toggle label, or rename one of
them so they don't collide.

FIX:
1. Locate the filter-panel component on /manager/demands. Identify
   the header and the button/toggle that both render the literal
   "Filtres".
2. Decide which one to keep (recommend: keep the header, rename
   the toggle to an icon-only button with `aria-label="Afficher /
   masquer les filtres"`).
3. Verify with screen-reader simulator that the duplicate is no
   longer announced twice.

ACCEPTANCE TESTS:
- Puppeteer: visit /manager/demands, count occurrences of the
  literal "Filtres" in the visible textContent. Assert ≤ 1.
- Puppeteer: assert the filter toggle still works (clicking it
  expands/collapses the filter panel).
- a11y check: assert the toggle has an aria-label so screen readers
  still know what it does.
```

---

## End of file

If anything in a prompt is under-specified, re-read the corresponding section in `test_list.md` (Pass #25 entry, between the `## QA pass #25` heading and the next `## QA pass` heading) for full context — repro evidence, network captures, and per-finding rationale are all there.
