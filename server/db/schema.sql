CREATE DATABASE IF NOT EXISTS crowdview;
USE crowdview;

CREATE TABLE IF NOT EXISTS Organization (
  Organization_Id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Primary Key',
  Organization_Name_Txt VARCHAR(255) NOT NULL UNIQUE COMMENT 'Organization Name',
  Contact_Name_Txt VARCHAR(255) NOT NULL COMMENT 'Contact Name',
  Contact_Email_Txt VARCHAR(255) NOT NULL COMMENT 'Contact Email',
  Contact_Phone_Txt VARCHAR(255) NOT NULL COMMENT 'Contact Phone',
  Contact_Address_Multi_Line_Txt TEXT COMMENT 'Contact Address',
  Contact_City_Txt VARCHAR(255) NOT NULL COMMENT 'Contact City',
  Contact_State_Txt VARCHAR(255) NOT NULL COMMENT 'Contact State',
  Contact_Zip_Txt VARCHAR(255) NOT NULL COMMENT 'Contact Zip',
  Contact_Country_Txt VARCHAR(255) NOT NULL COMMENT 'Contact Country',
  Description_Multi_Line_Txt TEXT COMMENT 'Organization Description',
  Employee_Fl CHAR(1) NOT NULL DEFAULT 'N' COMMENT 'Employee Module Enabled Flag',
  Created_At DATETIME DEFAULT NULL COMMENT 'Create Time',
  Updated_At DATETIME DEFAULT NULL COMMENT 'Update Time'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS User (
  User_Id BIGINT AUTO_INCREMENT PRIMARY KEY,
  Email VARCHAR(255) NOT NULL UNIQUE,
  Password_Hash VARCHAR(255) NOT NULL,
  Name_Txt VARCHAR(100),
  Last_Source_Device_Id VARCHAR(255),
  Connect_Last_Used_Device_After_Login_Fl CHAR(1) DEFAULT 'N',
  Facebook_Token TEXT,
  Instagram_Token TEXT,
  YouTube_Token TEXT,
  User_Level INT DEFAULT 0,
  Password_Reset_Token VARCHAR(255),
  Password_Reset_Expires DATETIME,
  Stream_Key_Txt VARCHAR(255),
  Parent_Organization_Id BIGINT DEFAULT NULL,
  Corporate_Admin_Fl CHAR(1) DEFAULT 'N',
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Friend (
  Friend_Id INT AUTO_INCREMENT PRIMARY KEY,
  User_Id INT NOT NULL,
  Name_Txt VARCHAR(100) NOT NULL,
  Note_Multi_Line_Txt TEXT,
  Friend_Group VARCHAR(50) DEFAULT 'Friend',
  Friend_User_Id INT NULL,
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (User_Id) REFERENCES User(User_Id) ON DELETE CASCADE,
  FOREIGN KEY (Friend_User_Id) REFERENCES User(User_Id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Friend_Photo (
  Friend_Photo_Id INT AUTO_INCREMENT PRIMARY KEY,
  Friend_Id INT NOT NULL,
  Photo_Data LONGBLOB NOT NULL,
  Photo_Mime_Type VARCHAR(50) DEFAULT 'image/jpeg',
  Rekognition_Face_Id VARCHAR(255) NULL,
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (Friend_Id) REFERENCES Friend(Friend_Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS User_Media (
  User_Media_Id INT AUTO_INCREMENT PRIMARY KEY,
  User_Id INT NOT NULL,
  Media_Data LONGBLOB NOT NULL,
  Media_Mime_Type VARCHAR(50),
  Media_Type ENUM('photo', 'video') NOT NULL,
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (User_Id) REFERENCES User(User_Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `Organization_Employee` (
  `Organization_Employee_Id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary Key',
  `Organization_Id` BIGINT NOT NULL COMMENT 'Organization ID',
  `Login_Cd` VARCHAR(255) NOT NULL COMMENT 'Login Code',
  `Login_Password_Hash` VARCHAR(255) NOT NULL COMMENT 'Login Password',
  `Created_At` DATETIME DEFAULT NULL COMMENT 'Create Time',
  `Updated_At` DATETIME DEFAULT NULL COMMENT 'Update Time',
  `Employee_Nm` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`Organization_Employee_Id`),
  KEY `Organization_Login_ibfk_Id` (`Organization_Id`),
  CONSTRAINT `Organization_Employee_ibfk_Id` FOREIGN KEY (`Organization_Id`) REFERENCES `Organization` (`Organization_Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `Organization_Employee_Attendance` (
  `Organization_Employee_Attendance_Id` BIGINT NOT NULL AUTO_INCREMENT,
  `Organization_Employee_Id` BIGINT NOT NULL,
  `Organization_Id` BIGINT NOT NULL,
  `Attendance_Dt` DATE NOT NULL,
  `Created_At` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Organization_Employee_Attendance_Id`),
  UNIQUE KEY `uq_emp_date` (`Organization_Employee_Id`, `Attendance_Dt`),
  CONSTRAINT `OEA_emp_fk` FOREIGN KEY (`Organization_Employee_Id`) REFERENCES `Organization_Employee` (`Organization_Employee_Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `Friend_Attendance` (
  `Friend_Attendance_Id` BIGINT NOT NULL AUTO_INCREMENT,
  `Friend_Id` INT NOT NULL,
  `Organization_Id` BIGINT NOT NULL,
  `Attendance_Dt` DATE NOT NULL,
  `Created_At` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Friend_Attendance_Id`),
  UNIQUE KEY `uq_friend_date` (`Friend_Id`, `Attendance_Dt`),
  CONSTRAINT `FA_friend_fk` FOREIGN KEY (`Friend_Id`) REFERENCES `Friend` (`Friend_Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `Friend_Detection` (
  `Friend_Detection_Id` BIGINT NOT NULL AUTO_INCREMENT,
  `Friend_Id` INT NOT NULL,
  `Organization_Id` BIGINT NOT NULL,
  `Detected_By_User_Id` INT NOT NULL,
  `Detected_At` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Friend_Detection_Id`),
  KEY `FD_friend_idx` (`Friend_Id`, `Detected_At`),
  CONSTRAINT `FD_friend_fk` FOREIGN KEY (`Friend_Id`) REFERENCES `Friend` (`Friend_Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `Organization_Employee_Detection` (
  `Organization_Employee_Detection_Id` BIGINT NOT NULL AUTO_INCREMENT,
  `Organization_Employee_Id` BIGINT NOT NULL,
  `Organization_Id` BIGINT NOT NULL,
  `Detected_By_User_Id` INT NOT NULL,
  `Detected_At` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Organization_Employee_Detection_Id`),
  KEY `OED_emp_idx` (`Organization_Employee_Id`, `Detected_At`),
  CONSTRAINT `OED_emp_fk` FOREIGN KEY (`Organization_Employee_Id`) REFERENCES `Organization_Employee` (`Organization_Employee_Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `Organization_Employee_Photo` (
  `Organization_Employee_Photo_Id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary Key',
  `Organization_Employee_Id` BIGINT NOT NULL COMMENT 'Employee ID',
  `Photo_Data` LONGBLOB NOT NULL,
  `Photo_Mime_Type` VARCHAR(50) DEFAULT 'image/jpeg',
  `Rekognition_Face_Id` VARCHAR(255) NULL,
  `Created_At` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Organization_Employee_Photo_Id`),
  CONSTRAINT `Organization_Employee_Photo_ibfk_Id` FOREIGN KEY (`Organization_Employee_Id`) REFERENCES `Organization_Employee` (`Organization_Employee_Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
