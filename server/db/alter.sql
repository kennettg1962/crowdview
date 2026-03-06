-- Run this against an existing crowdview database to add password reset columns.
-- Safe to re-run (IF NOT EXISTS requires MySQL 8.0+).
USE crowdview;
ALTER TABLE User ADD COLUMN IF NOT EXISTS Password_Reset_Token VARCHAR(255);
ALTER TABLE User ADD COLUMN IF NOT EXISTS Password_Reset_Expires DATETIME;
