-- ==========================================================
-- STRATIS DESTRUCTIVE RESET — DROPS EVERY TABLE AND ALL DATA
-- ==========================================================
--
-- This block used to live at the top of schema.sql, which meant `npm run
-- db:migrate` silently destroyed the entire database on every run: orgs, users,
-- meetings, transcripts, documents, summaries. The additive ALTERs at the
-- bottom of schema.sql exist precisely so an EXISTING database can be upgraded
-- in place — dropping everything first made them pointless and made the one
-- command you would reach for to fix a missing column the one that wipes prod.
--
-- Only `tsx src/db/migrate.ts --reset` runs this file. Never import it from
-- schema.sql again.

DROP TABLE IF EXISTS action_items CASCADE;
DROP TABLE IF EXISTS summary_blocks CASCADE;
DROP TABLE IF EXISTS participant_summaries CASCADE;
DROP TABLE IF EXISTS live_card_evidence CASCADE;
DROP TABLE IF EXISTS live_cards CASCADE;
DROP TABLE IF EXISTS node_evidence CASCADE;
DROP TABLE IF EXISTS document_patch_evidence CASCADE;
DROP TABLE IF EXISTS document_patch_items CASCADE;
DROP TABLE IF EXISTS document_patches CASCADE;
DROP TABLE IF EXISTS node_relationships CASCADE;
DROP TABLE IF EXISTS nodes CASCADE;
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS transcripts CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS consent_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS decisions CASCADE;
