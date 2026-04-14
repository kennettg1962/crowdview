-- ============================================================
-- CrowdView — Brilliant Labs Halo (Frame) device opt-in flag
-- Run once: mysql -u root -p -h 127.0.0.1 crowdview < halo_migration.sql
-- ============================================================

USE crowdview;

ALTER TABLE User
  ADD COLUMN Halo_Enabled_Fl CHAR(1) NOT NULL DEFAULT 'N';
