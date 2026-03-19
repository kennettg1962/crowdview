-- Run this against an existing crowdview database to add new columns.
-- Safe to re-run (IF NOT EXISTS requires MySQL 8.0+).
USE crowdview;
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
