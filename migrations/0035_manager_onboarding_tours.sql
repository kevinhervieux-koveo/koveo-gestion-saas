-- Manager onboarding tour catalog (Task #1590)
-- Forward migration: seed onboarding_versions rows for the seven manager tours.
--
-- content_hash is the sha256 of the canonical step JSON produced by
-- server/lib/onboarding-health-analyzer.ts#computeTourContentHash.
-- Recompute with:
--   npx tsx -e "import { createHash } from 'crypto'; import { MANAGER_TOURS } from \
--     './client/src/content/onboarding/manager/index.ts'; \
--     for (const t of MANAGER_TOURS) { \
--       const c = JSON.stringify({tourId:t.tourId,steps:t.steps.map(s=>({id:s.id,anchor:s.anchor??null,covers:[...(s.covers??[])].sort()}))}); \
--       console.log(t.tourId+'|'+require('crypto').createHash('sha256').update(c).digest('hex')); \
--     }"
--
-- ON CONFLICT DO NOTHING keeps this migration idempotent; re-running it on a
-- database that already has these rows is safe.
--
-- Rollback is included at the bottom as comments (run manually if needed).

-- ============================================================
-- FORWARD MIGRATION
-- ============================================================

INSERT INTO "onboarding_versions" ("tour_id", "version", "description", "content_hash")
VALUES
  ('manager.core.welcome',        1, 'Initial manager tour', '9a26b94a87a09ad1786fbf9e7dd3ac7c108d6b60db8b55d8ad824a31c2e514f4'),
  ('manager.core.buildings',      1, 'Initial manager tour', 'b226700c8bd251caea00bdcf669ccee3799c7283063331010d0327fb4f3349da'),
  ('manager.core.invitations',    1, 'Initial manager tour', 'e1d31b0c18f48bf0c28fe7525c08c1c5de19746feef07d73586a0c932bf71ded'),
  ('manager.core.financials',     1, 'Initial manager tour', '825868cd9376a5dfeba46976027e94d7afcb135dce79590ea47f84d5363e42ef'),
  ('manager.core.requests',       1, 'Initial manager tour', 'f6d432841a11ecdaf4c989d2b43b7b26637b5872fc2dd1aa9e1765e32c83b268'),
  ('manager.core.communications', 1, 'Initial manager tour', 'bb2fae92881b9905b28aba5ccb991c3f8d1b942a84d4333feff42e2faafced8a'),
  ('manager.core.settings',       1, 'Initial manager tour', '4fb6dc32420e79c9e1eba31620231a97cbe09613320750845a0685cebd9828e9')
ON CONFLICT ("tour_id") DO NOTHING;

-- ============================================================
-- ROLLBACK (run manually if needed, not executed automatically)
-- ============================================================
-- DELETE FROM "onboarding_versions"
-- WHERE "tour_id" IN (
--   'manager.core.welcome',
--   'manager.core.buildings',
--   'manager.core.invitations',
--   'manager.core.financials',
--   'manager.core.requests',
--   'manager.core.communications',
--   'manager.core.settings'
-- );
