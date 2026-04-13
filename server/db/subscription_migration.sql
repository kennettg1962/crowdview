-- ============================================================
-- CrowdView subscription & live-usage migration
-- Run once: mysql -u root -p crowdview < subscription_migration.sql
-- ============================================================

USE crowdview;

-- ------------------------------------------------------------
-- 1. User_Subscription
--    One row per user.  Tracks current tier and live-minute
--    consumption for the current billing period.
--
--    Tier values: 'trial' | 'lite' | 'personal' | 'plus' | 'power'
--    Live_Minutes_Alloc_Int:  -1 = unlimited (Power tier)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS User_Subscription (
  Subscription_Id       BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  User_Id               BIGINT       NOT NULL UNIQUE,
  Tier_Txt              VARCHAR(20)  NOT NULL DEFAULT 'trial',
  Period_Start_Dt       DATE         NOT NULL,
  Live_Minutes_Alloc_Int INT         NOT NULL DEFAULT 600,  -- -1 = unlimited
  Live_Minutes_Used_Int  INT         NOT NULL DEFAULT 0,
  Live_Minutes_Topup_Int INT         NOT NULL DEFAULT 0,
  Trial_Started_At      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Created_At            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Updated_At            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (User_Id) REFERENCES User(User_Id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 2. Live_Session_Log
--    One row per live-scan session (Live button on → off).
--    Duration_Seconds_Int is computed and stored when the
--    session ends so queries are fast.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Live_Session_Log (
  Session_Id            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  User_Id               BIGINT       NOT NULL,
  Started_At            DATETIME     NOT NULL,
  Ended_At              DATETIME     NULL,
  Duration_Seconds_Int  INT          NULL,
  FOREIGN KEY (User_Id) REFERENCES User(User_Id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 3. Subscription_History
--    One row per closed billing period (archived when the
--    period rolls over or the tier changes).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Subscription_History (
  History_Id            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  User_Id               BIGINT       NOT NULL,
  Tier_Txt              VARCHAR(20)  NOT NULL,
  Period_Start_Dt       DATE         NOT NULL,
  Period_End_Dt         DATE         NOT NULL,
  Live_Minutes_Alloc_Int INT         NOT NULL,
  Live_Minutes_Used_Int  INT         NOT NULL DEFAULT 0,
  Topup_Minutes_Int      INT         NOT NULL DEFAULT 0,
  Created_At            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (User_Id) REFERENCES User(User_Id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 4. Detection_Call_Log
--    One row per call to the face-detection API.
--    Kept for analytics regardless of billing model.
--    Detection_Type_Txt: 'id' | 'live' | 'snap'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Detection_Call_Log (
  Call_Id               BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  User_Id               BIGINT       NOT NULL,
  Detection_Type_Txt    VARCHAR(10)  NOT NULL DEFAULT 'id',
  Called_At             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (User_Id) REFERENCES User(User_Id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
