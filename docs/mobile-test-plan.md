# Mobile Test Plan — Resident / Tenant Flows

**Suite:** MOB-T01 – MOB-T10  
**Scope:** Mobile browser (375 × 812 viewport) using a resident/tenant account.  
**Prerequisite:** A resident or tenant session must be active in the browser.  
Tenant Chrome credentials are a separate blocker (tracked as a QA harness task);
route validity is the only gate addressed here.

---

## Route-decision record (W76 reconciliation)

The table below records the one-time verdict taken for each route that was
referenced in MOB-T03 – MOB-T10 but did not exist in the SPA bundle at Pass #28.

| Missing route (old test plan) | Verdict | Resolved to |
|-------------------------------|---------|-------------|
| `/residents/maintenance` | **Rewrite test** — existing route covers the intent | `/residents/demands` |
| `/residents/bookings` | **Rewrite test** — booking UI lives inside common-spaces | `/residents/common-spaces` |
| `/residents/profile` | **Rewrite test** — user profile is in global settings | `/settings/general` |
| `/residents/meetings` | **Rewrite test** — calendar/bookings view covers meetings | `/resident/my-calendar` |
| `/residents/dashboard` | **Ship page** — `dashboard.tsx` existed but was unregistered; route added in App.tsx | `/residents/dashboard` |
| `/residents/bills` | **Follow-up new page** — no resident bills page exists yet; test case marked PENDING | _(new page required)_ |
| `/residents/comms` | **Follow-up new page** — no resident communications page exists yet; test case marked PENDING | _(new page required)_ |

Routes in the "follow-up" category must not block the rest of the suite.
Their test cases are marked **PENDING** below and will be unblocked when the
corresponding pages are delivered.

---

## Test cases

### MOB-T01 — Login on mobile

| Field | Value |
|-------|-------|
| **Route** | `/login` |
| **Status** | READY |
| **Steps** | 1. Open app on 375 × 812 viewport. 2. Enter resident credentials. 3. Tap **Sign in**. |
| **Expected** | Redirected to `/residents/residence`. Session cookie set. |

---

### MOB-T02 — Resident landing page after login

| Field | Value |
|-------|-------|
| **Route** | `/residents/residence` |
| **Status** | READY |
| **Steps** | 1. Log in as resident. 2. Verify automatic redirect destination. |
| **Expected** | `/residents/residence` is the default landing page (parent `/residents` redirects here). Residence card rendered without horizontal scroll. |

---

### MOB-T03 — View my residence details

| Field | Value |
|-------|-------|
| **Route** | `/residents/residence` |
| **Status** | READY |
| **Steps** | 1. Navigate to `/residents/residence`. 2. Verify unit number, address and building name are shown. |
| **Expected** | Residence card visible. Data matches the tenant's assigned unit. |

---

### MOB-T04 — Submit a maintenance request

| Field | Value |
|-------|-------|
| **Route** | `/residents/demands` |
| **Status** | READY |
| **Decision** | `/residents/maintenance` → `/residents/demands` (route renamed at project inception) |
| **Steps** | 1. Navigate to `/residents/demands`. 2. Tap **New request**. 3. Fill in title and description. 4. Submit. |
| **Expected** | Request appears in the list with status *Pending*. Success toast shown. |

---

### MOB-T05 — Pay / view bills

| Field | Value |
|-------|-------|
| **Route** | _(pending: `/residents/bills` — new page required)_ |
| **Status** | **PENDING** — no resident bills page exists yet |
| **Decision** | `/residents/bills` has no existing route. A dedicated resident bills page is needed. See follow-up task. |
| **Steps** | _(deferred until page ships)_ |
| **Expected** | _(deferred)_ |

---

### MOB-T06 — Book a common space

| Field | Value |
|-------|-------|
| **Route** | `/residents/common-spaces` |
| **Status** | READY |
| **Decision** | `/residents/bookings` → `/residents/common-spaces` (booking UI is embedded in the common-spaces page) |
| **Steps** | 1. Navigate to `/residents/common-spaces`. 2. Select a space. 3. Pick a date and time slot. 4. Confirm booking. |
| **Expected** | Booking appears in the space's calendar with status *Confirmed*. |

---

### MOB-T07 — View and edit profile

| Field | Value |
|-------|-------|
| **Route** | `/settings/general` |
| **Status** | READY |
| **Decision** | `/residents/profile` → `/settings/general` (resident profile is managed through the global settings page) |
| **Steps** | 1. Navigate to `/settings/general`. 2. Verify display name and email are shown. 3. Update a field and save. |
| **Expected** | Profile data persisted. Success toast shown. |

---

### MOB-T08 — View communications / announcements

| Field | Value |
|-------|-------|
| **Route** | _(pending: `/residents/comms` — new page required)_ |
| **Status** | **PENDING** — no resident communications page exists yet |
| **Decision** | `/residents/comms` has no existing route. A resident communications/announcements page is needed. See follow-up task. |
| **Steps** | _(deferred until page ships)_ |
| **Expected** | _(deferred)_ |

---

### MOB-T09 — View meetings / calendar

| Field | Value |
|-------|-------|
| **Route** | `/resident/my-calendar` |
| **Status** | READY |
| **Decision** | `/residents/meetings` → `/resident/my-calendar` (the user calendar shows all bookings and scheduled events; note the singular `/resident/` prefix — this is a known inconsistency tracked as W55) |
| **Steps** | 1. Navigate to `/resident/my-calendar`. 2. Verify upcoming bookings are listed. |
| **Expected** | Calendar rendered. User's confirmed bookings displayed. |

---

### MOB-T10 — Resident dashboard overview

| Field | Value |
|-------|-------|
| **Route** | `/residents/dashboard` |
| **Status** | READY |
| **Decision** | `/residents/dashboard` — `dashboard.tsx` existed in `client/src/pages/residents/` but was not registered in `App.tsx`. Route added as part of W76 fix. |
| **Steps** | 1. Navigate to `/residents/dashboard`. 2. Verify quick-action cards render (My Home, Documents, Maintenance, Bills, Messages). 3. Verify recent activity section visible. |
| **Expected** | Dashboard page renders without errors. Quick-action cards visible. |

---

## Summary

| Case | Route | Status |
|------|-------|--------|
| MOB-T01 | `/login` | READY |
| MOB-T02 | `/residents/residence` | READY |
| MOB-T03 | `/residents/residence` | READY |
| MOB-T04 | `/residents/demands` | READY |
| MOB-T05 | `/residents/bills` | PENDING (new page) |
| MOB-T06 | `/residents/common-spaces` | READY |
| MOB-T07 | `/settings/general` | READY |
| MOB-T08 | `/residents/comms` | PENDING (new page) |
| MOB-T09 | `/resident/my-calendar` | READY |
| MOB-T10 | `/residents/dashboard` | READY |

8 of 10 cases are unblocked by route. The remaining 2 (MOB-T05, MOB-T08)
are blocked on new-page delivery, not route validity.
