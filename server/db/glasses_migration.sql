-- ============================================================
-- CrowdView glasses device opt-in flags
-- Run once: mysql -u root -p -h 127.0.0.1 crowdview < glasses_migration.sql
-- ============================================================

USE crowdview;

ALTER TABLE User
  ADD COLUMN IF NOT EXISTS Inmo_Air3_Enabled_Fl   CHAR(1) NOT NULL DEFAULT 'N',
  ADD COLUMN IF NOT EXISTS Meta_Glasses_Enabled_Fl CHAR(1) NOT NULL DEFAULT 'N';
