-- Run this against an existing crowdview database to add new columns.
-- Safe to re-run (IF NOT EXISTS requires MySQL 8.0+).
USE crowdview;

-- Corporate fields (already applied to production DB 2026-03-26)
ALTER TABLE User ADD COLUMN IF NOT EXISTS Parent_Organization_Id BIGINT DEFAULT NULL;
ALTER TABLE User ADD COLUMN IF NOT EXISTS Corporate_Admin_Fl CHAR(1) DEFAULT 'N';
ALTER TABLE User ADD COLUMN IF NOT EXISTS Password_Reset_Token VARCHAR(255);
ALTER TABLE User ADD COLUMN IF NOT EXISTS Password_Reset_Expires DATETIME;
ALTER TABLE Friend_Photo ADD COLUMN IF NOT EXISTS Rekognition_Face_Id VARCHAR(255);
ALTER TABLE User ADD COLUMN IF NOT EXISTS Stream_Key_Txt VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS Stream (
  Stream_Id       INT AUTO_INCREMENT PRIMARY KEY,
  User_Id         INT NOT NULL,
  Stream_Key_Txt  VARCHAR(255) NOT NULL,
  Title_Txt       VARCHAR(255) DEFAULT 'CrowdView Live',
  Status_Fl       ENUM('live','ended') DEFAULT 'live',
  Recording_Dir_Txt VARCHAR(500) NULL,
  Recording_File_Txt VARCHAR(500) NULL,
  Started_At      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  Ended_At        TIMESTAMP NULL,
  FOREIGN KEY (User_Id) REFERENCES User(User_Id) ON DELETE CASCADE
);

ALTER TABLE Stream ADD COLUMN Recording_File_Txt VARCHAR(500) NULL;
ALTER TABLE Stream ADD COLUMN IF NOT EXISTS Encoding_Fl CHAR(1) DEFAULT 'N';

-- Email verification (trial / self-signup flow)
ALTER TABLE User ADD COLUMN IF NOT EXISTS Email_Verified_Fl CHAR(1) DEFAULT 'N';
ALTER TABLE User ADD COLUMN IF NOT EXISTS Email_Verify_Token_Txt VARCHAR(255) NULL;
ALTER TABLE User ADD COLUMN IF NOT EXISTS Email_Verify_Expires_Dt DATETIME NULL;

-- Detection-call counters per user (session count is in-memory only)
ALTER TABLE User ADD COLUMN IF NOT EXISTS Detect_Month_Count INT DEFAULT 0;
ALTER TABLE User ADD COLUMN IF NOT EXISTS Detect_Month_Ref   CHAR(7) DEFAULT NULL;
ALTER TABLE User ADD COLUMN IF NOT EXISTS Detect_Year_Count  INT DEFAULT 0;
ALTER TABLE User ADD COLUMN IF NOT EXISTS Detect_Year_Ref    CHAR(4) DEFAULT NULL;
