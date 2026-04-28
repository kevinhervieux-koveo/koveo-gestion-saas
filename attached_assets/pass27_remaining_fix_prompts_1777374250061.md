# Pass #27 — Remaining Fix Prompts (Replit Agent input)

**Source pass:** Koveo Gestion QA Pass #27 (2026-04-28, build `772dba9ec` / `2026-04-28T08:58:27.930Z`).
**Scope of THIS file:** every Pass #27 finding still OPEN or PARTIAL after the massive Pass #25 → Pass #27 fix-confirmation sweep.
**Coverage:** W65 (HIGH a11y, carried from Pass #26); W67 (MEDIUM, carried from Pass #26); W49 (PARTIAL); W59 (PARTIAL); W70, W71, W72, W73, W74 (LOW, NEW Pass #27); W11 followup (LOW); H1–H7 (LOW cluster, open since Pass #16); W37, W38, W41 (LOW MCP-side, carried); M9 (INFO MCP-side, carried). Total **20 findings**, packaged as **5 bundles + 5 standalone = 10 Replit Agent tasks**.

---

## ⚠️ Instructions to Replit (read first)

> **Split each bug below into its own Replit Agent task — except where bugs have been bundled into a single PR (each bundle is marked with a `Bundle:` heading and a single combined prompt).**
>
> For every section below — bundle or standalone — open a **fresh Replit Agent message** and paste the section's prompt block (the fenced ```` ```prompt ```` block at the bottom of the section) as the Agent prompt. Do NOT mix multiple sections into one Agent run; the bundles are already pre-merged where it makes sense.
>
> Each prompt is self-contained: it includes the bug ID, the exact repro / endpoints / pages affected, the area of the codebase to look at, and acceptance criteria. Do not start a fix without re-reading the corresponding section in `test_list.md` (Pass #27 entry) for full context if the prompt feels under-specified.
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
> | `tenant` | 0 | Resident menu | **Own building(s) only** — buildings the user is linked to as a tenant | **Per-document opt-in.** Manager checks "accessible au locataire" on each building-level document, and the resident/owner does the same on each residence-level document. Tenant sees ONLY documents with that flag set. | **None.** No financial cards, no aggregate building/org financials, no other-tenants-list, no AG minutes. Per-document flag is the canonical gate. |
> | `resident` | 1 | Resident menu | Own building(s) only — buildings the user is linked to as a resident (owner) | Full document access for the building(s) the resident owns into. Resident sees CA minutes, états financiers, certificat de localisation, etc. | **Full** — resident is an owner, has the right to all financial info on their building / org. |
> | `manager` | 2 | Manager + Resident menus | Their org(s) | Full doc access on managed orgs; sets the "accessible au locataire" flag on building-level documents. | Full read/write on managed orgs. |
> | `admin` | 3 | Admin + Manager + Resident menus | Their org(s) | Same as manager + Admin menu. | Same as manager + Admin menu. |
> | `super_admin` | 4 | everything | **No org scope restriction.** Must succeed wherever `manager` or `admin` succeeds. | Same as admin, no scope restriction. (QA test account uses this role.) | Same as admin, no scope restriction. |
>
> **Implication:** **replace any hardcoded role allow-list like `["manager", "admin"]` with a hierarchy comparison** — e.g. `requireMinRole('manager')`. Any guard that omits `super_admin` from a list of allowed roles is a bug.

#### Specific capabilities (per Kevin 2026-04-27 — exceptions to the plain hierarchy comparison)

> | Capability | Minimum role | Notes |
> |------------|--------------|-------|
> | **Create an organization** (`POST /api/organizations`) | `super_admin` **only** | Even `admin` is denied. |
> | **Create a building** (`POST /api/buildings`) | `admin` or higher | `manager` denied (read-only). |

### TL;DR — what's bundled vs split

| Section | Bug IDs covered | Bundle? | Why bundled / why split |
|---------|-----------------|---------|--------------------------|
| 1. **Standalone — W65** (HIGH a11y) | W65 | split | Single `<meta name="viewport">` tag fix in the SPA shell. |
| 2. **Standalone — W67** (MEDIUM a11y) | W67 | split | Touch-target sweep across the shared icon-button primitive — affects every page but a single CSS-class fix. |
| 3. **Bundle: i18n residuals** | W49 (residual), W70, W73 | **bundled** | Three remaining hardcoded English strings + raw enum render — all in the same i18n bundle / `enumLabels` helper that landed in Pass #25/#27 work. One PR. |
| 4. **Bundle: CSS uppercase override** | W59 (residual), W71 | **bundled** | Both refer to the exact same `text-transform: uppercase` class on the `/admin/bulk-document-import` org-section header. Drop one CSS rule. |
| 5. **Standalone — W72** | W72 | split | One static diagram on `/admin/permissions`; prepend a node + bump count. |
| 6. **Standalone — W11 followup** | W11-followup | split | Ship a user-facing 404 page (small standalone PR). Does NOT depend on the Help system bundle. |
| 7. **Bundle: ship the Help system** | H1, H2, H3, H4, H5, H6, H7 | **bundled** | One product-level PR — design + ship `/help`, `/admin/help`, `/dashboard/help` content. Has been STILL-OPEN since Pass #16. Even the interim placeholder fix lands as a single PR. |
| 8. **Bundle: delete_element_history_event regressions** | W41, W74 | **bundled** | Identical root cause — both reproduce `delete_element_history_event` clobbering the parent element's `lastInspectionDate`. One handler fix + one Vitest covers both. |
| 9. **Bundle: element_history audit semantics** | W37, W38 | **bundled** | Same `element_history` row schema — adding a `source` discriminator and an `element_history_audit_log` mirror table closes both at once. |
| 10. **Standalone — M9** | M9 | split | Documentation/discoverability change on the `assume_user` tool description; not a code fix per se. |

**Net IDs covered: 20.** Bundled IDs: 14 (W37, W38, W41, W49, W59, W70, W71, W73, W74, H1, H2, H3, H4, H5, H6, H7). Standalone IDs: 5 (W11-followup, W65, W67, W72, M9).

---

## 1. Standalone — W65 (HIGH a11y) — Viewport meta locks pinch-zoom (WCAG 1.4.4)

**Bug ID:** W65
**Severity:** HIGH (accessibility — WCAG 2.1 SC 1.4.4 Resize text, Level AA)
**Surface:** Web (SPA shell)
**Affected role:** all authenticated roles + public marketing pages

**One-line summary:** `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">` is served on every page. iOS Safari and Android Chrome respect `maximum-scale=1` and block pinch-zoom up to 200%, which is required by WCAG 2.1 SC 1.4.4 (Level AA) and is implicitly expected under Quebec Loi 25 / accessibility-compliance frameworks for residential property-management products.

**Repro (re-confirmed Pass #27, 2026-04-28 09:30 UTC):**

```js
document.querySelector('meta[name=viewport]').content
// → "width=device-width, initial-scale=1.0, maximum-scale=1"
```

Open any authenticated route in iOS Safari, attempt pinch-zoom — fails to zoom past initial scale.

**Where to look in the codebase:** the SPA root `index.html` (or whatever ships the `<meta name="viewport">` tag — typically `client/index.html` or `client/public/index.html`).

**Fix:** replace the offending tag with:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

Add `text-size-adjust: 100%` (and `-webkit-text-size-adjust: 100%`) to the global stylesheet so iOS Safari does not auto-scale text on rotation.

**Acceptance tests:**
- Puppeteer (`page.emulate(KnownDevices['iPhone 13'])`): visit `/dashboard/overview`, run `await page.evaluate(() => document.querySelector('meta[name=viewport]').content)` and assert it does NOT match `/maximum-scale\s*=\s*1\b/`.
- Puppeteer pinch-zoom test (Chrome devtools `Input.dispatchTouchEvent`) — programmatically pinch-zoom and assert `window.visualViewport.scale` exceeds 1.5.
- Vitest (HTML lint): grep the built `dist/index.html` for `maximum-scale` — must return 0 matches.

**Replit prompt:**

```prompt
BUG (HIGH a11y — WCAG 2.1 SC 1.4.4 Level AA): every page on
koveo-gestion.com ships a viewport meta that blocks pinch-zoom on
iOS Safari + Android Chrome.

REPRO: open any authenticated route in iOS Safari → attempt
pinch-zoom → fails. document.querySelector('meta[name=viewport]')
.content === "width=device-width, initial-scale=1.0,
maximum-scale=1".

EXPECTED: pinch-zoom up to 200% works on every page (WCAG 1.4.4
Resize text, Level AA). Required by Loi 25 / accessibility-compliance
frameworks for residential property-management products in Quebec.

FIX (one file):
- In client/index.html (or wherever the SPA root is rendered),
  replace the viewport meta with:
    <meta name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover">
- Add to the global CSS:
    html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }

ACCEPTANCE TESTS:
- Puppeteer (page.emulate(KnownDevices['iPhone 13'])): visit
  /dashboard/overview, evaluate document.querySelector(
  'meta[name=viewport]').content and assert it does NOT match
  /maximum-scale\s*=\s*1\b/.
- Puppeteer (programmatic pinch-zoom via Input.dispatchTouchEvent):
  zoom into the page and assert window.visualViewport.scale > 1.5.
- HTML-lint test: grep dist/index.html for "maximum-scale" — must
  return 0 matches.
- Run on /dashboard/overview, /residents/dashboard, /manager/bills,
  /admin/permissions, /login (i.e. covers public + authenticated).
```

---

## 2. Standalone — W67 (MEDIUM a11y) — Touch targets below 44×44 CSS pixels (WCAG 2.5.5)

**Bug ID:** W67
**Severity:** MEDIUM (accessibility — WCAG 2.1 SC 2.5.5 Target Size, Level AAA; Apple HIG / Material guidelines minimum)
**Surface:** Web (every authenticated route)
**Affected role:** all authenticated roles, especially mobile users

**One-line summary:** 14 of 18 visible interactive elements (78 %) on `/manager/common-spaces-stats` measure under 44×44 CSS pixels. Same shape on `/dashboard/overview`. Manager-specific tables additionally include sort-caret buttons (~16×16) and row-action three-dot menus (~32×32) on `/manager/buildings` that compound the issue.

**Repro (re-confirmed Pass #27):**

```js
const btns = Array.from(document.querySelectorAll('button, a, [role=button]'));
btns.filter(b => {
  const r = b.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
}).length;
// → 14 (out of 18 visible interactive elements)
```

Specific offenders observed on `/dashboard/overview`:
- "Collapse sidebar" — 24×24
- "EN" / "FR" language switchers — 41–43×36
- 3× close-icon buttons (toasts/cards) — 32×28

**Where to look in the codebase:** the shared icon-button primitive (likely `client/src/components/ui/icon-button.tsx` or whatever the Tailwind-based primitive is). Add `min-h-[44px] min-w-[44px]` (or `h-11 w-11`) to the base class. Keep the visual icon size; expand only the hit area via padding.

**Fix:**

```tsx
// client/src/components/ui/icon-button.tsx (or equivalent)
export const IconButton = ({ icon, ...props }) => (
  <button
    {...props}
    className={cn(
      'inline-flex items-center justify-center',
      'min-h-11 min-w-11',          // ⬅️ NEW: 44×44 hit area
      'p-2',                         // visual icon size unchanged
      props.className
    )}
  >
    {icon}
  </button>
);
```

Same treatment for the language-switcher pill, the sidebar collapse button, and any toast-close `<button>`.

**Acceptance tests:**
- Puppeteer (`page.emulate(KnownDevices['iPhone 13'])`): on `/dashboard/overview`, count interactive elements with bounding rect under 44×44 — assert `count === 0`.
- Same assertion on `/manager/common-spaces-stats`, `/manager/buildings`, `/admin/permissions`.
- Snapshot test (Vitest): `IconButton` rendered output contains classes `min-h-11` and `min-w-11`.

**Replit prompt:**

```prompt
BUG (MEDIUM a11y — WCAG 2.5.5 Target Size): 14 of 18 visible
interactive elements on /manager/common-spaces-stats (and similar
density on /dashboard/overview, /manager/buildings) measure under
44×44 CSS pixels. iOS HIG and Material guidelines both require 44.

OFFENDERS sampled on /dashboard/overview:
  - Collapse-sidebar icon button         24×24
  - "EN" / "FR" language-switcher        41–43×36
  - 3× toast/card close icon buttons     32×28
Manager-specific tables additionally have:
  - Sort-caret buttons in column headers ~16×16
  - Row-action three-dot menus           ~32×32

REPRO: on /manager/common-spaces-stats:
  Array.from(document.querySelectorAll('button, a, [role=button]'))
    .filter(b => {
      const r = b.getBoundingClientRect();
      return r.width>0 && r.height>0 && (r.width<44 || r.height<44);
    }).length
  → 14

EXPECTED: every interactive element has a hit area >= 44×44 px,
WITHOUT increasing the visual icon size (use padding to grow the
hit area, not the icon).

FIX:
1. In the shared icon-button primitive (client/src/components/ui/
   icon-button.tsx or equivalent), add Tailwind classes
   "min-h-11 min-w-11" (= 44×44 px) to the base button.
2. Same for the language-switcher pill, the sidebar collapse
   button, and the toast-close button (these likely don't share
   the IconButton primitive yet — fix in place).
3. For sort-caret buttons in tables, expand the hit area using a
   wrapping <button> with min-h-11 min-w-11 around the visual
   caret.

ACCEPTANCE TESTS:
- Puppeteer (page.emulate iPhone 13) on /dashboard/overview,
  /manager/common-spaces-stats, /manager/buildings,
  /admin/permissions: assert
    Array.from(document.querySelectorAll(
      'button, a, [role=button]'))
      .filter(b => {
        const r = b.getBoundingClientRect();
        return r.width>0 && r.height>0 && (r.width<44 || r.height<44);
      }).length === 0
- Vitest snapshot: IconButton rendered output contains "min-h-11"
  and "min-w-11".
```

---

## 3. Bundle: i18n residuals (W49 partial, W70, W73)

**Bugs bundled:** W49 (PARTIAL — `/admin/organizations` H1 + subtitle still EN), W70 (LOW — `/admin/quality` subtitle EN + `/admin/organizations` H1+subtitle EN), W73 (LOW — `/manager/user-management` Rôle column raw enum).

**Why bundled:** all three are missing-translation / missing-enum-label issues that land in the same FR i18n bundle and the same `enumLabels` helper that already exists from the Pass #25/#27 i18n cleanup. Splitting them would mean three PRs each touching one or two files. One bundle keeps the changes coherent.

**Bug-by-bug summary:**

| ID | Surface | Symptom |
|----|---------|---------|
| W49 (residual) | `/admin/organizations` | Tab title FR ("Organisations — Koveo Gestion"), "Créer" button FR, type enum FR (Syndicat / Démo / Société de gestion / Association de copropriété) all FR. **Residual:** in-page H1 reads "Organizations Management" and subtitle reads "Create, view, edit and delete organizations in the system" — both still EN. |
| W70 | `/admin/quality` + `/admin/organizations` | `/admin/quality` H1 "Assurance qualité" (FR) but subtitle "Quality metrics and assurance tracking" still EN. The metric cards below (Couverture de code, Qualité du code, Problèmes de sécurité, …) are all FR — the only EN string on the page is the subtitle. `/admin/organizations` covered by W49 above. |
| W73 | `/manager/user-management` | User table "Rôle" column displays raw enum values ("tenant", "manager", "resident", "admin") rather than the localized strings ("Locataire", "Gestionnaire", "Résident", "Administrateur") used by `/admin/permissions` on the same app. The "Statut" column on the same row IS translated ("Actif"). |

**Where to look in the codebase:**
- `client/src/i18n/fr.json` — three or four missing keys for the page H1/subtitle pair on `/admin/quality` and `/admin/organizations`.
- `client/src/pages/admin/quality.tsx` and `client/src/pages/admin/organizations.tsx` — replace the hardcoded EN H1/subtitle string with `t('quality.subtitle')` / `t('organizations.title')` / `t('organizations.subtitle')`.
- `client/src/lib/i18n/enumLabels.ts` (or the project's equivalent enum-label helper) — make sure `role` is translated wherever a role enum is rendered. Then in `client/src/pages/manager/user-management.tsx`, the "Rôle" column cell must call `enumLabels.role(user.role, language)` rather than rendering `user.role` directly.

**Acceptance tests:**
- Puppeteer (super_admin, `language=fr`): visit `/admin/quality` → assert body does NOT contain "Quality metrics and assurance tracking".
- Puppeteer (super_admin, `language=fr`): visit `/admin/organizations` → assert body does NOT contain "Organizations Management" or "Create, view, edit and delete organizations".
- Puppeteer (super_admin, `language=fr`): visit `/manager/user-management` → assert the "Rôle" column cells render `Locataire` / `Gestionnaire` / `Résident` / `Administrateur` and do NOT contain raw `tenant` / `manager` / `resident` / `admin` literals.
- Puppeteer (super_admin, `language=en`): same three pages should still render EN strings (no false-positive translation regressions).
- Vitest: `enumLabels.role('tenant', 'fr') === 'Locataire'` (and matching cases for every role/locale pair).

**Replit prompt:**

```prompt
BUNDLED BUG FIX (LOW) — W49 (residual), W70, W73: three remaining
hardcoded English strings + one raw-enum render on the FR UI. All
three share root cause (missing i18n keys + missing enum-label
helper call) and should land in a single PR.

Affected surfaces:

  /admin/quality            (W70) — H1 "Assurance qualité" (FR) but
                                    subtitle "Quality metrics and
                                    assurance tracking" still EN.
  /admin/organizations      (W49 + W70) — tab title FR, "Créer"
                                    button FR, type enum FR — but
                                    in-page H1 "Organizations
                                    Management" + subtitle "Create,
                                    view, edit and delete organizations
                                    in the system" still EN.
  /manager/user-management  (W73) — "Rôle" column shows raw enum
                                    values "tenant" / "manager" /
                                    "resident" / "admin" instead of
                                    "Locataire" / "Gestionnaire" /
                                    "Résident" / "Administrateur".
                                    Other columns on the same row
                                    (e.g. Statut → "Actif") ARE
                                    translated.

EXPECTED: with user.language === "fr", every visible string on these
pages renders in French, including the user-management role column.

FIX:
1. In client/src/i18n/fr.json (or wherever the FR bundle lives),
   add keys for:
     - admin.quality.subtitle           = "Métriques de qualité et suivi de l'assurance"
     - admin.organizations.title        = "Gestion des organisations"
     - admin.organizations.subtitle     = "Créer, consulter, modifier et supprimer des organisations dans le système"
   (And matching EN values in en.json so language=en still works.)
2. Replace the hardcoded EN strings in
     client/src/pages/admin/quality.tsx
     client/src/pages/admin/organizations.tsx
   with t('admin.quality.subtitle') / t('admin.organizations.title') /
   t('admin.organizations.subtitle').
3. In client/src/pages/manager/user-management.tsx, change the
   "Rôle" column cell from `{user.role}` to
   `{enumLabels.role(user.role, language)}` (using the same helper
   already in use elsewhere — likely client/src/lib/i18n/
   enumLabels.ts).
4. If enumLabels.role doesn't yet cover all 5 roles in both locales,
   add the missing entries:
     fr: tenant=Locataire, resident=Résident, manager=Gestionnaire,
         admin=Administrateur, super_admin=Super administrateur
     en: tenant=Tenant, resident=Resident, manager=Manager,
         admin=Admin, super_admin=Super Admin

ACCEPTANCE TESTS:
- Puppeteer (super_admin, language=fr): visit /admin/quality →
  assert body does NOT contain "Quality metrics and assurance
  tracking".
- Puppeteer (super_admin, language=fr): visit /admin/organizations
  → assert body does NOT contain "Organizations Management" nor
  "Create, view, edit and delete organizations".
- Puppeteer (super_admin, language=fr): visit /manager/user-management
  → assert the role-cell text on every row matches /^(Locataire|
  Gestionnaire|Résident|Administrateur|Super administrateur)$/ and
  no row renders /^(tenant|manager|resident|admin|super_admin)$/.
- Puppeteer (super_admin, language=en): same three pages still
  render English strings (regression guard for the i18n change).
- Vitest: enumLabels.role('tenant', 'fr') === 'Locataire',
  enumLabels.role('super_admin', 'fr') === 'Super administrateur',
  enumLabels.role('tenant', 'en') === 'Tenant', etc. for every
  role × locale pair.
```

---

## 4. Bundle: CSS uppercase override (W59 residual, W71)

**Bugs bundled:** W59 (PARTIAL — `/admin/bulk-document-import` org-section header still ALL-CAPS via CSS), W71 (LOW — same finding, fresh write-up in Pass #27).

**Why bundled:** W59-residual and W71 describe the **exact same defect** — a CSS `text-transform: uppercase` rule on the org-section header on `/admin/bulk-document-import`. After this PR ships, both rows close.

**Repro (re-confirmed Pass #27):**

Super_admin → `/admin/bulk-document-import` → wait for the building list to load (5–10 s after the AI panel). Each org-section header is rendered ALL-CAPS:

```
563 MONTÉE DES PIONNIERS
  563 montée des pionniers
  Terrebonne, QC
  6 unités
  Condo

DEMO
  4647 Meggie Pass Building 2
  6051 montée René-Lévesque
  …
```

The building rows directly below render with correct case ("563 montée des pionniers", "4647 Meggie Pass Building 2") — the visual mismatch is jarring on the FR UI where caps are unusual outside short section dividers.

**Where to look in the codebase:** `client/src/pages/admin/bulk-document-import.tsx` (or wherever the page lives) — the org-section header element. Find the `text-transform: uppercase` (or Tailwind `uppercase` utility) and remove it. Keep the typography hierarchy via font-weight + size if needed.

**Acceptance tests:**
- Puppeteer: navigate to `/admin/bulk-document-import` → wait for building list → assert every org-section header element's `textContent` matches its underlying data exactly (case-preserving). Specifically: page must contain "563 montée des pionniers" but must NOT contain "563 MONTÉE DES PIONNIERS"; must contain "Demo" but must NOT contain "DEMO".

**Replit prompt:**

```prompt
BUG (LOW) — W59 residual + W71: /admin/bulk-document-import org-section
headers are rendered ALL-CAPS via CSS text-transform: uppercase, while
the building rows directly below them render correctly cased. Both
findings refer to the same defect.

REPRO: super_admin login → /admin/bulk-document-import → wait for the
building list (~5-10 s after AI panel) → headers above each org's
buildings render as "563 MONTÉE DES PIONNIERS", "DEMO" etc., visually
clashing with the regular-case data below.

EXPECTED: org-section headers preserve the case stored in the data
(e.g. "563 montée des pionniers", "Demo"). Typography hierarchy
maintained via font-weight + size, not CSS uppercase transform.

FIX (one file):
- In client/src/pages/admin/bulk-document-import.tsx (or wherever the
  page lives), find the org-section header className and remove the
  Tailwind `uppercase` utility (or the inline `text-transform:
  uppercase` style). Keep the existing font-weight / size classes so
  the heading still reads as a heading.

ACCEPTANCE TESTS:
- Puppeteer: navigate to /admin/bulk-document-import as super_admin
  → wait for building list → assert
    document.body.innerText.includes('563 montée des pionniers') === true
    document.body.innerText.includes('563 MONTÉE DES PIONNIERS') === false
    document.body.innerText.includes('Demo') === true
    document.body.innerText.includes('DEMO\n') === false
- Snapshot test: CSS class string of the org-section header does not
  contain `uppercase`.
```

---

## 5. Standalone — W72 (LOW) — `/admin/permissions` role-hierarchy diagram omits super_admin

**Bug ID:** W72
**Severity:** LOW (admin-page documentation defect)
**Surface:** Web (`/admin/permissions`)
**Affected role:** admin, super_admin (the only roles that see this page)

**One-line summary:** The "Hiérarchie des rôles" card on `/admin/permissions` displays only 4 roles ("Administrateur → Gestionnaire → Résident → Locataire"). Per Kevin's canonical role hierarchy (2026-04-27), the correct hierarchy is `super_admin > admin > manager > resident > tenant` (5 ranks). The page's other UI elements (filter dropdowns, user table) DO include super_admin — the hierarchy diagram alone is wrong.

**Repro:** super_admin login → `/admin/permissions` → "Hiérarchie des rôles" card → diagram reads "Administrateur → Gestionnaire → Résident → Locataire" with a count card showing "4". Should read "Super administrateur → Administrateur → Gestionnaire → Résident → Locataire" with count "5".

**Where to look in the codebase:** `client/src/pages/admin/permissions.tsx` (or wherever the hierarchy card is rendered). Likely a hardcoded array of role labels powering both the diagram and the count card. Prepend `super_admin` to the array.

**Acceptance tests:**
- Puppeteer (super_admin): `/admin/permissions` → assert "Hiérarchie des rôles" card body contains "Super administrateur" → "Administrateur" → "Gestionnaire" → "Résident" → "Locataire".
- Puppeteer (same): assert the role-count cell on the same card reads "5" (not "4").
- Vitest: the hierarchy-array constant has length 5 and includes `super_admin` at index 0.

**Replit prompt:**

```prompt
BUG (LOW) — W72: /admin/permissions "Hiérarchie des rôles" diagram shows
only 4 roles (Administrateur → Gestionnaire → Résident → Locataire) but
the canonical Koveo hierarchy is 5 (super_admin > admin > manager >
resident > tenant). super_admin is silently absent from the diagram.

REPRO: super_admin login → /admin/permissions → "Hiérarchie des rôles"
card shows the 4-role diagram and a count card "4". Other elements on
the same page (filter dropdowns, user table) DO include super_admin.

EXPECTED: diagram reads "Super administrateur → Administrateur →
Gestionnaire → Résident → Locataire" and the count card reads "5".

FIX (one file): in client/src/pages/admin/permissions.tsx (or wherever
the hierarchy card is rendered), prepend "super_admin" to the
role-array constant powering both the diagram and the count card.
Make sure it goes through the existing enumLabels.role helper so the
display uses "Super administrateur" / "Super Admin" depending on
locale.

ACCEPTANCE TESTS:
- Puppeteer (super_admin, language=fr): /admin/permissions →
  "Hiérarchie des rôles" card body contains the 5-role chain
  ending in "Locataire" and starting with "Super administrateur".
- Puppeteer (super_admin, language=en): same card uses "Super Admin"
  → "Admin" → "Manager" → "Resident" → "Tenant".
- Puppeteer: count card on the same page reads "5" (was "4").
- Vitest: hierarchy-array constant has length 5 and roles[0] ===
  'super_admin'.
```

---

## 6. Standalone — W11 followup (LOW) — Unknown SPA routes silently return empty shell (no user-facing 404 page)

**Bug ID:** W11-followup
**Severity:** LOW (UX)
**Surface:** Web (SPA shell)
**Affected role:** all (any user that mistypes a URL or follows a stale link)

**One-line summary:** `/this-route-does-not-exist` returns the SPA shell (200, ~4625 bytes) and the rendered page contains only the global chrome (sidebar nav, footer, feedback widget) — no `<main>` content, no user-facing 404 page, no "back to home" CTA. Pass #24 fixed the dev-copy leak ("Did you forget to add the page to the router?") but the user-facing 404 page itself was never shipped.

**Repro:** any user → navigate to `/this-route-does-not-exist` → page renders the SPA chrome with `document.title = "Koveo Gestion"` (generic) and no main content. `bodyLen ≈ 847 chars` (= chrome only). `document.querySelectorAll('main').length === 0` on the unknown-route page even though authenticated routes have a `<main>` landmark.

**Where to look in the codebase:** the SPA route configuration — likely `client/src/App.tsx` (or `client/src/router.tsx`). Add a wildcard catch-all route `*` that renders a `NotFound` component.

**Fix:**

1. Create `client/src/pages/not-found.tsx`:

   ```tsx
   import { useTranslation } from 'react-i18next';
   import { Link } from 'react-router-dom';

   export default function NotFound() {
     const { t } = useTranslation();
     return (
       <main id="main-content" className="flex flex-col items-center justify-center py-24 gap-4">
         <h1 className="text-5xl font-bold">404</h1>
         <p className="text-xl">{t('notFound.title')}</p>
         <p className="text-muted-foreground">{t('notFound.subtitle')}</p>
         <Link to="/dashboard/overview" className="btn btn-primary">
           {t('notFound.cta')}
         </Link>
       </main>
     );
   }
   ```

2. In `App.tsx`, after every other `<Route>`, add:

   ```tsx
   <Route path="*" element={<NotFound />} />
   ```

3. Add i18n keys:
   - `notFound.title` (fr): "Page introuvable" / (en): "Page not found"
   - `notFound.subtitle` (fr): "La page que vous cherchez n'existe pas ou a été déplacée." / (en): "The page you are looking for does not exist or has moved."
   - `notFound.cta` (fr): "Retour au tableau de bord" / (en): "Back to dashboard"

**Acceptance tests:**
- Puppeteer: visit `/this-route-does-not-exist` (authenticated and unauthenticated) → assert `document.querySelector('main h1').innerText === '404'`.
- Puppeteer: same route, language=fr → assert body contains "Page introuvable".
- Puppeteer: same route, language=en → assert body contains "Page not found".
- Puppeteer: the 404 page also has the skip-to-main link from the W68 fix, and `<main id="main-content">` matching the layout.

**Replit prompt:**

```prompt
BUG (LOW) — W11 followup: /this-route-does-not-exist returns the SPA
shell (200, ~4625 bytes) and renders only the global chrome (sidebar
nav, footer, feedback widget). No user-facing 404 page, no "back to
home" CTA. Pass #24 closed the dev-copy leak; the 404 page itself
was never shipped.

REPRO: navigate to https://koveo-gestion.com/this-route-does-not-exist
→ page renders chrome only. document.title === "Koveo Gestion"
(generic). document.querySelectorAll('main').length === 0 on this
route, while authenticated valid routes have <main> landmark.

EXPECTED: a localized, branded 404 page with a clear CTA back to
the dashboard (or login if unauthenticated).

FIX:
1. Create client/src/pages/not-found.tsx with a localized component
   that renders inside <main id="main-content">.
2. In client/src/App.tsx (or whichever file holds the router), add
   <Route path="*" element={<NotFound />} /> as the last route.
3. Add i18n keys to fr.json / en.json:
     notFound.title    : "Page introuvable" / "Page not found"
     notFound.subtitle : "La page que vous cherchez n'existe pas ou
                         a été déplacée." / "The page you are
                         looking for does not exist or has moved."
     notFound.cta      : "Retour au tableau de bord" / "Back to
                         dashboard"
4. Set document.title via useEffect to the localized notFound.title
   so the browser tab also reflects the 404.
5. The 404 page must include the skip-to-main link from the W68
   fix, and be wrapped in <main id="main-content"> so W54 doesn't
   regress.

ACCEPTANCE TESTS:
- Puppeteer: navigate to /this-route-does-not-exist (authenticated)
  → document.querySelector('main h1').innerText === '404'.
- Puppeteer: language=fr → body contains "Page introuvable".
- Puppeteer: language=en → body contains "Page not found".
- Puppeteer: the page has document.querySelectorAll('main').length
  === 1 and document.querySelector('a[href^="#main"]') (skip link).
- Puppeteer: the CTA button exists with text "Retour au tableau de
  bord" (fr) / "Back to dashboard" (en) and href === "/dashboard/
  overview".
- Puppeteer: unauthenticated user navigating to /this-route-does-not-
  exist gets the same 404 page (not redirected to /login).
```

---

## 7. Bundle: ship the Help system (H1, H2, H3, H4, H5, H6, H7)

**Bugs bundled:** H1, H2, H3, H4, H5, H6, H7 — the in-app Help cluster, **STILL OPEN since Pass #16 (2026-04-23)**. Tracked as 7 separate row IDs because Pass #16 broke the audit into 7 distinct symptom buckets, but the underlying ask is one product feature: **ship the Help system**.

**Why bundled:** the seven rows describe seven facets of the same missing feature. Splitting them into seven Replit tasks would just create seven copies of the same "design and ship the Help" PR.

**Bug-by-bug summary (re-confirmed Pass #27):**

| ID | Symptom |
|----|---------|
| H1 | `/help` returns the SPA shell (4625 bytes); rendered body is only the global chrome + feedback widget (~847 chars). No help content. |
| H2 | `/admin/help` same behavior — shell only. |
| H3 | `/dashboard/help` same behavior — shell only. |
| H4 | `/api/help` returns 404. `/api/help/topics` returns 404. `/api/i18n/help/fr` returns 404. No backend Help API. |
| H5 | No Help content has shipped between Pass #16 and Pass #27 (5 builds skipped this work). Recommended interim from Pass #24 still applies: ship a single bilingual placeholder. |
| H6 | Same as H5 — no Help content; user has no in-app self-service. |
| H7 | Same as H5/H6 — Help cluster aging. |

**Two-stage plan:**

**Stage A — interim placeholder (one quick PR, closes H1-H7 immediately):**

Ship a single bilingual `/help` page that says:

```
Aide / Help — bientôt disponible

Le centre d'aide Koveo Gestion est en cours de développement. En attendant,
contactez-nous : support@koveo-gestion.com.

The Koveo Gestion help centre is under development. In the meantime,
please reach us at: support@koveo-gestion.com.
```

Mount it at `/help`. Redirect `/admin/help` and `/dashboard/help` to `/help` (308). This unblocks the H1-H7 cluster on the bug board even before the full Help system ships.

**Stage B — full Help system (separate epic, scoped after Stage A):**

Real help articles, search, contextual deep-links, FR/EN content. Out of scope for this immediate PR; track as a separate product epic. The Stage A placeholder buys time without leaving an empty SPA shell in the meantime.

**Where to look in the codebase:**
- `client/src/App.tsx` (or router) — add `<Route path="/help" element={<HelpPlaceholder />} />` and 308 redirects from `/admin/help` and `/dashboard/help` to `/help`.
- `client/src/pages/help-placeholder.tsx` — new file rendering the bilingual content above.
- i18n keys for the placeholder copy.

**Acceptance tests:**
- Puppeteer: navigate to `/help` → assert body contains "Aide / Help — bientôt disponible".
- Puppeteer: navigate to `/admin/help` → assert final URL after redirect is `/help`.
- Puppeteer: navigate to `/dashboard/help` → assert final URL after redirect is `/help`.
- Puppeteer: assert the `/help` page has `<main>` and a skip-link (W54/W68 won't regress).

**Replit prompt:**

```prompt
PRODUCT FIX (LOW × 7) — H1, H2, H3, H4, H5, H6, H7: Help system has
been STILL-OPEN since Pass #16 (2026-04-23). /help, /admin/help, and
/dashboard/help all return the SPA shell (4625 bytes) with only the
global chrome rendered. /api/help, /api/help/topics, /api/i18n/help/fr
all return 404. No help content has shipped in 5 builds.

This PR does Stage A (interim placeholder) — ship a single bilingual
"coming soon" page so the empty-shell experience is replaced with a
clear message + support contact. Stage B (full Help system, search,
articles) is tracked as a separate epic.

REPRO (Pass #27):
  fetch /help                  → 200, 4625 bytes (SPA shell), 847 chars
                                  rendered (chrome only).
  fetch /admin/help            → same as /help.
  fetch /dashboard/help        → same as /help.
  fetch /api/help              → 404.
  fetch /api/help/topics       → 404.

EXPECTED (Stage A):
  - /help renders a bilingual "Aide / Help — bientôt disponible"
    page with support@koveo-gestion.com contact.
  - /admin/help and /dashboard/help 308-redirect to /help.
  - The page has <main id="main-content">, a skip link, and a
    proper document.title (so W54/W52/W68 don't regress on this
    route).
  - The page is accessible to ALL roles, including unauthenticated
    visitors (Help shouldn't require login).

CONTENT (exact copy):
  HEADING: "Aide / Help — bientôt disponible"
  BODY (fr):
    "Le centre d'aide Koveo Gestion est en cours de développement.
     En attendant, contactez-nous : support@koveo-gestion.com."
  BODY (en):
    "The Koveo Gestion help centre is under development. In the
     meantime, please reach us at: support@koveo-gestion.com."
  CTA: a mailto: link on the email.

FIX:
1. Create client/src/pages/help-placeholder.tsx with the bilingual
   content above (use t('help.placeholder.title') etc., add the
   keys to fr.json + en.json).
2. In client/src/App.tsx (or router), add:
     <Route path="/help" element={<HelpPlaceholder />} />
   and redirects:
     <Route path="/admin/help" element={<Navigate to="/help"
       replace />} />
     <Route path="/dashboard/help" element={<Navigate to="/help"
       replace />} />
3. Set document.title to t('help.placeholder.title') via useEffect
   on the placeholder page.

ACCEPTANCE TESTS:
- Puppeteer (any role, language=fr): navigate to /help → body
  contains "Aide / Help — bientôt disponible" and a mailto:
  support@koveo-gestion.com link.
- Puppeteer (any role): navigate to /admin/help → final URL ===
  "/help".
- Puppeteer (any role): navigate to /dashboard/help → final URL
  === "/help".
- Puppeteer: /help has document.querySelectorAll('main').length
  === 1 and a skip-to-main link (W54/W68 regression guard).
- Puppeteer: /help works without authentication (no redirect to
  /login).

OUT OF SCOPE for this PR (separate epic):
  - Real help content / articles.
  - Search across help topics.
  - Contextual deep-links from app pages to /help#section.
  - Multi-locale rich content beyond the placeholder copy.
```

---

## 8. Bundle: `delete_element_history_event` regressions (W41, W74)

**Bugs bundled:** W41 (LOW — Pass #24 — `delete_element_history_event` clears `lastInspectionDate` even when the deleted event didn't advance it), W74 (LOW — Pass #27 — same defect class, same handler, repro confirmed live).

**Why bundled:** identical root cause. Both reproduce on the same `delete_element_history_event` MCP tool. One handler fix + one Vitest test cover both.

**Bug-by-bug summary:**

| ID | Symptom |
|----|---------|
| W41 | Element with `lastInspectionDate=2026-04-26` + backdated `repair` event (forward-only guard from W36 left date alone) + `delete_element_history_event(eventId)` → element's `lastInspectionDate` becomes `null`. Date set at element-creation time is silently lost. |
| W74 | `update_inventory_element(elementId, lastInspectionDate=2026-04-28)` → element shows `lastInspectionDate: "2026-04-28"`. Then `create_element_history_event(repair, eventDate=2026-04-15, lifespanImpact=2)` → guard correctly leaves date alone. Then `delete_element_history_event(eventId)` → response body's `updatedElement` shows `lastInspectionDate: "2024-09-12"` (a Pass #22-era event date), silently dropping the manual override. |

**Where to look in the codebase:** the `delete_element_history_event` handler — likely `server/services/inventoryHistoryService.ts` or `server/routes/maintenance/inventory-history.ts` (whatever owns `DELETE /api/maintenance/elements/:elementId/history/:eventId`). The handler currently recomputes `lastInspectionDate` from the surviving events / snapshot history rather than respecting an admin's manual override.

**Fix:** in the delete handler, only adjust `lastInspectionDate` if it equals the deleted event's `eventDate` (i.e. the deleted event is the one that previously advanced the date via the W36 forward-only guard). Otherwise leave the column untouched. The same transaction can still refund `currentLifespan` per `lifespanImpact` (that part is correct).

```ts
// pseudocode
async function deleteHistoryEvent(eventId: string) {
  const event = await getEvent(eventId);
  await db.transaction(async tx => {
    await tx.delete(elementHistory).where(eq(elementHistory.id, eventId));
    // refund lifespanImpact (existing behavior, keep)
    if (event.lifespanImpact) {
      await tx.update(buildingElements)
        .set({ currentLifespan: sql`GREATEST(0, currentLifespan - ${event.lifespanImpact})` })
        .where(eq(buildingElements.id, event.elementId));
    }
    // ⬇️ FIX: only touch lastInspectionDate if the deleted event WAS the one that set it
    const element = await tx.select().from(buildingElements).where(eq(buildingElements.id, event.elementId)).limit(1);
    if (element[0].lastInspectionDate === event.eventDate) {
      // recompute from the new latest event (existing behavior — keep)
      const latestRepairOrMinor = await tx.select()
        .from(elementHistory)
        .where(and(
          eq(elementHistory.elementId, event.elementId),
          inArray(elementHistory.eventType, ['repair', 'minor_rehab']),
        ))
        .orderBy(desc(elementHistory.eventDate))
        .limit(1);
      await tx.update(buildingElements)
        .set({ lastInspectionDate: latestRepairOrMinor[0]?.eventDate ?? null })
        .where(eq(buildingElements.id, event.elementId));
    }
    // else: do NOT touch lastInspectionDate — admin's manual value persists
  });
}
```

**Acceptance tests (Vitest, hits a real DB):**

```ts
it('delete_element_history_event preserves manually-set lastInspectionDate (W74)', async () => {
  const el = await createInventoryElement({ buildingId, name:'roof', uniformatCode:'B3010', currentCondition:'good' });
  await updateInventoryElement(el.id, { lastInspectionDate: '2026-04-28' });

  const evt = await createElementHistoryEvent({
    elementId: el.id, eventType:'repair',
    eventDate:'2026-04-15', // backdated; W36 guard leaves lastInspectionDate alone
    lifespanImpact: 2, workDescription: 'patch'
  });

  // sanity: date is the manual one, not the event date
  let updated = await getInventoryElement(el.id);
  expect(updated.lastInspectionDate).toBe('2026-04-28');

  await deleteElementHistoryEvent(evt.id);

  // ✅ EXPECTED: manual date persists
  updated = await getInventoryElement(el.id);
  expect(updated.lastInspectionDate).toBe('2026-04-28');
  // currentLifespan refunded
  expect(updated.currentLifespan).toBe(el.currentLifespan); // back to pre-event value
});

it('delete_element_history_event recomputes lastInspectionDate when the deleted event was the one that set it (W41)', async () => {
  const el = await createInventoryElement({ buildingId, name:'roof2', uniformatCode:'B3010', currentCondition:'good' });
  // first event sets lastInspectionDate = today
  const evt = await createElementHistoryEvent({
    elementId: el.id, eventType:'repair', eventDate:'2026-04-28',
    workDescription:'first repair'
  });
  let updated = await getInventoryElement(el.id);
  expect(updated.lastInspectionDate).toBe('2026-04-28');

  await deleteElementHistoryEvent(evt.id);
  updated = await getInventoryElement(el.id);
  // No surviving event → null (existing behavior, kept)
  expect(updated.lastInspectionDate).toBeNull();
});
```

**Replit prompt:**

```prompt
BUNDLED BUG FIX (LOW) — W41, W74: delete_element_history_event regresses
the parent element's lastInspectionDate even when the deleted event did
not advance it. Both findings reproduce on the same MCP handler with
identical root cause; one PR closes both.

REPROS:
  W41 (Pass #24): create element with lastInspectionDate=2026-04-26 +
    backdated repair event (W36 forward-only guard leaves date alone) +
    delete the event → element.lastInspectionDate becomes NULL.
  W74 (Pass #27): set lastInspectionDate=2026-04-28 via
    update_inventory_element + create_element_history_event(repair,
    eventDate=2026-04-15, lifespanImpact=2) (date stays 2026-04-28
    per W36) + delete_element_history_event → element's
    lastInspectionDate reverts to 2024-09-12 (a prior event's date),
    dropping the manual override.

EXPECTED: delete refunds currentLifespan via lifespanImpact (existing
behavior, KEEP). Manual lastInspectionDate set via
update_inventory_element MUST persist unless the deleted event itself
was the one that advanced it (eventDate === current
lastInspectionDate).

FIX (likely server/services/inventoryHistoryService.ts or wherever the
DELETE handler lives):
  In the same transaction, only recompute lastInspectionDate if the
  deleted event's eventDate equals the element's current
  lastInspectionDate. Otherwise leave the column untouched. (See
  full pseudocode in the section's body.)

VITEST CASES (cover both W41 and W74):
  - W74: manual lastInspectionDate persists when the deleted event did
    not advance it (date set via update_inventory_element BEFORE
    creating a backdated event; after delete, the manual date is
    still there).
  - W41: when the deleted event WAS the one that advanced
    lastInspectionDate (event eventDate === current
    lastInspectionDate AND no other repair/minor_rehab events
    survive), the column is recomputed from the new latest event,
    or set to null if no event survives.
  - currentLifespan refund: deleted event's lifespanImpact must roll
    back, clamped at 0.
  - W36 cross-check: forward-only guard on create still works — a
    backdated repair event after this PR still does NOT regress
    lastInspectionDate.
```

---

## 9. Bundle: `element_history` audit semantics (W37, W38)

**Bugs bundled:** W37 (LOW — element history rows lack a `source` / `origin` / `isManuallyEntered` discriminator), W38 (PARTIAL — element history events silently editable; `updatedAt` / `updatedBy` populate but no per-edit audit log of previous values).

**Why bundled:** both findings ask the same `element_history` row schema to grow audit semantics. W37 wants a column on the row; W38 wants a sibling audit-log table mirroring `invitation_audit_log`. One DB migration + one service-layer change covers both.

**Bug-by-bug summary (Pass #27 status):**

| ID | Status | Symptom |
|----|--------|---------|
| W37 | STILL-OPEN | `list_element_history` rows have schema `{eventType, eventDate, vendorId, vendorName, cost, warranty, lifespanImpact, workDescription, createdBy, createdAt, updatedAt, updatedBy}`. No `source`, `origin`, or `isManuallyEntered` field. Auditors cannot distinguish manual entries from automation-created events except via `createdBy` heuristics. |
| W38 | PARTIAL | `update_element_history_event` populates `updatedAt` / `updatedBy` (Pass #23 fix — the *who/when* half). But there is still no `element_history_audit_log` table to record previous values across edits, so a manager can flip a $50,000 rehab to $5 and the only signal is the `updatedAt` timestamp. The *what* half remains open. |

**Where to look in the codebase:**
- `db/schema.ts` (or wherever the Drizzle schemas live) — add `source` enum column to `element_history`; create new `element_history_audit_log` table mirroring `invitation_audit_log`.
- `server/services/inventoryHistoryService.ts` — every `update_element_history_event` / `delete_element_history_event` handler must, in the same transaction, insert an audit row capturing the previous values.
- MCP tool description (`get_mcp_info` `tools` array entry for `list_element_history`) — surface the new `source` column so QA can filter by it.

**Schema sketch:**

```ts
// element_history adds:
source: pgEnum('element_history_source', ['manual', 'project', 'import', 'system']).default('manual')

// new audit-log table:
elementHistoryAuditLog {
  id: uuid primary key
  elementHistoryId: uuid references element_history(id) on delete cascade
  action: enum('created', 'updated', 'deleted')
  performedByUserId: uuid references users(id)
  performedAt: timestamptz default now()
  previousValues: jsonb  // snapshot of the row before the change (null on 'created')
  newValues: jsonb       // snapshot of the row after the change (null on 'deleted')
  source: enum('rest_api', 'mcp', 'project_workflow', 'import', 'system')
}
```

**Acceptance tests (Vitest, hits a real DB):**

```ts
it('list_element_history rows expose a source discriminator (W37)', async () => {
  const el = await createInventoryElement(...);
  const evt = await createElementHistoryEvent({ elementId: el.id, eventType:'repair', eventDate:'2026-04-28', workDescription:'manual test' });
  const rows = await listElementHistory(el.id);
  expect(rows[0].source).toBe('manual'); // when created via MCP/REST manually
});

it('update_element_history_event writes a previous-values audit row (W38)', async () => {
  const evt = await createElementHistoryEvent({ ..., cost: 450 });
  await updateElementHistoryEvent(evt.id, { cost: 9999 });

  const audit = await db.select().from(elementHistoryAuditLog)
    .where(eq(elementHistoryAuditLog.elementHistoryId, evt.id))
    .orderBy(desc(elementHistoryAuditLog.performedAt));

  expect(audit).toHaveLength(2); // 'created' + 'updated'
  expect(audit[0].action).toBe('updated');
  expect(audit[0].previousValues.cost).toBe('450.00');
  expect(audit[0].newValues.cost).toBe('9999.00');
});
```

**Replit prompt:**

```prompt
BUNDLED BUG FIX (LOW) — W37 + W38: the element_history table lacks the
audit semantics auditors need — (a) no source/origin discriminator on
each row (W37), (b) no previous-values audit log when events are edited
(W38, currently PARTIAL — updatedAt/updatedBy work but the WHAT-changed
half is missing).

W37 (STILL-OPEN): list_element_history rows expose only
{eventType, eventDate, vendorId, vendorName, cost, warranty,
lifespanImpact, workDescription, createdBy, createdAt, updatedAt,
updatedBy} — no source / origin / isManuallyEntered field. Manager
auditors must use createdBy heuristics to distinguish manual entries
from automation-created events.

W38 (PARTIAL): update_element_history_event populates updatedAt /
updatedBy (Pass #23 fix). But there is no audit-log table recording
previous values, so a manager can flip a $50,000 rehab to $5 and the
only signal is a timestamp.

EXPECTED:
1. Every element_history row has a `source` enum:
   'manual' | 'project' | 'import' | 'system' (default 'manual').
2. A new element_history_audit_log table mirrors invitation_audit_log:
     id, elementHistoryId, action ('created'|'updated'|'deleted'),
     performedByUserId, performedAt, previousValues (jsonb),
     newValues (jsonb), source ('rest_api'|'mcp'|'project_workflow'|
     'import'|'system')
3. createElementHistoryEvent inserts an audit row with action='created'
   and previousValues=null.
4. updateElementHistoryEvent inserts an audit row with action='updated',
   previousValues = the row as it was before, newValues = the row
   as it is now.
5. deleteElementHistoryEvent inserts an audit row with action='deleted',
   previousValues = the row, newValues = null.

FIX:
- Drizzle migration: add `source` column to element_history (with
  enum), create element_history_audit_log table.
- Update server/services/inventoryHistoryService.ts (or wherever the
  CRUD handlers live) to write the audit rows in the same transaction
  as the actual write.
- The MCP tool description for list_element_history should be updated
  to mention the new `source` column.

ACCEPTANCE TESTS (Vitest):
- list_element_history rows expose source: list it on a freshly
  created event → source === 'manual'.
- update_element_history_event(evtId, {cost: 9999}) on an event that
  had cost=450 → audit log row with previousValues.cost === '450.00',
  newValues.cost === '9999.00', action === 'updated'.
- delete_element_history_event(evtId) → audit log row with
  action === 'deleted', previousValues equals the deleted row,
  newValues === null.
- Cross-checks: the audit table is per-event-id (multiple updates
  produce multiple rows), the source enum on element_history is
  immutable across edits (the source of the original write doesn't
  flip), and the audit log table cascades on element_history delete
  (FK on delete cascade).
```

---

## 10. Standalone — M9 (INFO) — `assume_user` not exercisable in production (documentation/discoverability)

**Bug ID:** M9
**Severity:** INFO (not a code defect — feature-flag intentional)
**Surface:** MCP
**Affected role:** QA only (manager/admin sessions)

**One-line summary:** `assume_user(<userId>)` advertised in the MCP tool list returns:

```
assume_user is not enabled on this server. Note: MCP_ASSUME_USER is hard-locked
OFF in production (NODE_ENV=production) regardless of the env var — this is
a code-level safety guard. To use impersonation, target the staging deployment
where MCP_ASSUME_USER=1 is set. See docs/MCP_STAGING_QA_HARNESS.md for the
full QA harness guide.
```

This is correct production behavior — the safety guard is a feature, not a bug. But the MCP **tool description** of `assume_user` does not mention the production hard-lock. A QA agent reading just the tool list will think they can use it on prod and only discover the gate at call time.

**Where to look in the codebase:** the MCP tool definition for `assume_user` — likely `server/mcp/tools/assumeUser.ts` (or wherever the MCP server registers tools).

**Fix:** prepend a one-line note to the tool description:

```
description: |
  Admin-only QA tool: replace the effective user on this MCP session with the
  user identified by `userId`. NOT AVAILABLE IN PRODUCTION — hard-locked OFF
  when NODE_ENV=production regardless of MCP_ASSUME_USER. Use the staging
  deployment for impersonation; see docs/MCP_STAGING_QA_HARNESS.md.

  Subsequent tool calls on this session behave as if that user were the
  OAuth caller… [rest unchanged]
```

**Acceptance tests:**
- Vitest: `getMcpInfo().tools.find(t => t.name === 'assume_user').description.toLowerCase()` includes "not available in production" and "hard-locked off".
- Manual: in production, `assume_user(...)` still returns the same enriched error (no behavior change).

**Replit prompt:**

```prompt
DOCUMENTATION FIX (INFO) — M9: the MCP tool `assume_user` advertises
itself in the tool list with a description that does not mention it
is hard-locked off in production. The runtime behavior is correct (the
production guard returns a clear, helpful error pointing at
docs/MCP_STAGING_QA_HARNESS.md) but the discoverability pre-call is
poor: a QA agent reading the tool list will try to call it on prod
and only learn about the gate at call time.

REPRO: connect the MCP connector to a production session, call
assume_user(<any userId>) → response says
  "assume_user is not enabled on this server. Note: MCP_ASSUME_USER
  is hard-locked OFF in production (NODE_ENV=production) regardless
  of the env var… See docs/MCP_STAGING_QA_HARNESS.md…"

EXPECTED: the same hard-lock message also surfaces in the tool
description so QA agents can plan around it without trial-and-error.

FIX (one description string, server/mcp/tools/assumeUser.ts or
wherever the MCP tool is registered): prepend to the tool's
description:

  "Admin-only QA tool: replace the effective user on this MCP session
   with the user identified by `userId`. NOT AVAILABLE IN PRODUCTION
   — hard-locked OFF when NODE_ENV=production regardless of
   MCP_ASSUME_USER. Use the staging deployment for impersonation; see
   docs/MCP_STAGING_QA_HARNESS.md.

   Subsequent tool calls on this session behave as if that user were
   the OAuth caller…"

ACCEPTANCE TESTS:
- Vitest: getMcpInfo().tools.find(t => t.name === 'assume_user')
  .description.toLowerCase() includes both
  "not available in production" and "mcp_staging_qa_harness".
- No behavior change at runtime — production still returns the
  existing enriched error envelope.
```

---

## Summary

**Coverage:** 20 findings.
**Bundles:** 5 (i18n residuals; CSS uppercase; Help system; delete-history regressions; element-history audit semantics).
**Standalone:** 5 (W65 viewport pinch-zoom HIGH a11y; W67 touch targets MEDIUM; W72 hierarchy diagram; W11 user-facing 404; M9 tool description).
**Top 3 to ship first** (per Pass #27 priority): **W65** (HIGH a11y, WCAG 1.4.4 violation, blocks pinch-zoom on iOS), **Help system bundle H1–H7** (open since Pass #16), **W67** (MEDIUM, WCAG 2.5.5 touch targets, 14 of 18 elements under 44 px).
