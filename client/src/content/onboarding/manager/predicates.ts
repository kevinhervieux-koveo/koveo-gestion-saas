/**
 * Named visibleIf predicates for manager onboarding tours (Task #1590).
 *
 * Predicates are called synchronously by the tour runner at step-display time
 * (outside the React tree) so they cannot use React hooks or async data.
 * Every predicate uses a real synchronous signal: the presence of the targeted
 * `data-onboarding` element in the live DOM at the moment the tour runs.
 *
 * Rationale:
 *   - The tour runner (OnboardingContext) calls each predicate before the
 *     tour starts and skips steps whose predicate returns false.  Driver.js
 *     would otherwise try to attach to a missing element and either error
 *     out or render an unanchored popover.
 *   - Whether a feature's anchor element is currently rendered is a faithful
 *     proxy for "does this user, on this page, in this build have access to
 *     this feature right now?"  When the corresponding UI element is added
 *     (e.g. residence link/unlink buttons, maintenance acknowledge button),
 *     the predicate begins returning true with no further code change.
 *
 * The four spec-named predicates (Task M.4) are exported with the names the
 * spec requires:
 *   PRED_HAS_LINKED_RESIDENCE_USER  (bld.unlink-user)
 *   PRED_HAS_INVITATION_HISTORY      (inv.audit-history)
 *   PRED_HAS_MAINTENANCE_ACKNOWLEDGE (req.auto-assign)
 *   PRED_HAS_COMMON_SPACES           (comm.spaces)
 */

const sel = (anchor: string) => () =>
  typeof document !== 'undefined' &&
  document.querySelector(`[data-onboarding="${anchor}"]`) !== null;

// ── Task M.4 spec-named predicates ──────────────────────────────────────────

/**
 * bld.unlink-user — true when an "unlink user" button is currently visible
 * inside a residence card.  When residence link/unlink UI ships, this
 * predicate begins returning true automatically.
 */
export const PRED_HAS_LINKED_RESIDENCE_USER = sel('residence.row-unlink-btn');

/**
 * inv.audit-history — true when the per-row "view audit history" button is
 * rendered for at least one invitation.  The button is added by
 * InvitationManagement once an invitation has audit entries.
 */
export const PRED_HAS_INVITATION_HISTORY = sel('invitations.history-btn');

/**
 * req.auto-assign — true when a per-row "acknowledge" button is rendered on
 * the maintenance-requests list.  Begins returning true when that button
 * ships (the back-end auto-assign behavior is already in place).
 */
export const PRED_HAS_MAINTENANCE_ACKNOWLEDGE = sel('maintenance.row-acknowledge-btn');

/**
 * comm.spaces — true when the building-scoped Common Spaces tab is visible.
 * The tab only renders for managers whose buildings expose common spaces and
 * who have permission to administer them, so DOM presence is a faithful
 * permission-driven signal.
 */
export const PRED_HAS_COMMON_SPACES = sel('building.common-spaces-tab');

// ── Buildings tour helpers ───────────────────────────────────────────────────

export const PRED_HAS_BUILDINGS_NEW_BTN = sel('buildings.new-btn');
export const PRED_HAS_RESIDENCES_TAB = sel('building.residences-tab');
export const PRED_HAS_RESIDENCES_NEW_BTN = sel('residences.new-btn');
export const PRED_HAS_RESIDENCE_LINK_BTN = sel('residence.link-user-btn');
export const PRED_HAS_BUILDING_DELETE_BTN = sel('building.delete-btn');

// ── Financials tour helpers ──────────────────────────────────────────────────

export const PRED_HAS_BUILDING_BILLS_TAB = sel('building.bills-tab');
export const PRED_HAS_BILLS_ROW_STATUS = sel('bills.row-status');
export const PRED_HAS_BILLS_ROW_NUMBER = sel('bills.row-number');
export const PRED_HAS_BILLS_ROW_DELETE = sel('bills.row-delete');

// ── Invitations tour helpers ─────────────────────────────────────────────────

export const PRED_HAS_INVITATIONS_NEW_BTN = sel('invitations.new-btn');
export const PRED_HAS_INVITATIONS_EMAIL_INPUT = sel('invitations.email-input');
export const PRED_HAS_INVITATIONS_RESIDENCE_INPUT = sel('invitations.residence-input');
export const PRED_HAS_INVITATIONS_LIST = sel('invitations.list');
export const PRED_HAS_INVITATIONS_ROW_ACTIONS = sel('invitations.row-actions');

// ── Requests tour helpers ────────────────────────────────────────────────────

export const PRED_HAS_NAV_MAINTENANCE = sel('nav.maintenance');
export const PRED_HAS_DEMANDS_CREATE_BTN = sel('demands.create-btn');
export const PRED_HAS_DEMANDS_RESIDENCE_INPUT = sel('demands.residence-input');

// ── Communications tour helpers ──────────────────────────────────────────────

export const PRED_HAS_COMMUNICATIONS_NEW_BTN = sel('communications.new-btn');
export const PRED_HAS_MEETINGS_NAV = sel('nav.meetings');

// ── Welcome / settings tour helpers ──────────────────────────────────────────

export const PRED_HAS_TOPBAR_ROLE_BADGE = sel('topbar.role-badge');
export const PRED_HAS_TOPBAR_USER_MENU = sel('topbar.user-menu');
export const PRED_HAS_TOPBAR_SETTINGS_LINK = sel('topbar.settings-link');
export const PRED_HAS_ROLE_SWITCHER = sel('topbar.role-switcher');
export const PRED_HAS_SETTINGS_RESTART_ALL = sel('settings.onboarding.restart-all');
