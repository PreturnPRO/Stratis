-- ==========================================================
-- ONE-SHOT: put existing workspaces on the beta plan
-- ==========================================================
--
-- Run this ONCE, immediately after the first migration that adds the plan
-- columns. Do not put it in schema.sql.
--
-- Why it exists: `organizations.plan` defaults to 'free', and Free is capped at
-- 5 meetings a month and 3 seats. Every workspace that existed before the plan
-- columns did — the live demo, every beta team — would silently inherit those
-- caps and hit a wall on a plan they never chose. This moves them to the beta
-- tier, which is what they were actually promised.
--
-- Why it is not in schema.sql: schema.sql is re-run on every deploy. This
-- statement in there would keep promoting genuinely-new Free signups to beta
-- forever. It is a migration, not a schema definition.
--
--   psql "$DATABASE_URL" -f backend/src/db/backfill-plans.sql
--   (or: npm run db:backfill-plans)

UPDATE organizations
SET plan = 'beta',
    plan_status = 'active',
    is_beta = TRUE,
    plan_started_at = COALESCE(plan_started_at, NOW()),
    plan_note = 'Backfilled: workspace predates plan enforcement'
WHERE plan = 'free'
  AND plan_started_at IS NULL;
