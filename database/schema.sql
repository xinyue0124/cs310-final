--
-- Pet Rescue Database Schema
-- CS 310 Final Project, Winter 2026
--
-- Run against your Amazon RDS (MySQL) instance:
--   mysql -h YOUR-RDS-ENDPOINT -u YOUR-USER -p petrescue < schema.sql
--
-- Three tables:
--   pets         — rescue-added pet listings (photos stored in S3)
--   subscribers  — email addresses that receive new-pet alert emails
--   applications — adoption applications submitted by users
--

CREATE DATABASE IF NOT EXISTS petrescue;
USE petrescue;

-- ─────────────────────────────────────────────────────────────────────────────
-- pets: one row per pet listing
--   photo_key  — S3 object key for the pet's photo
--   species    — auto-filled by Rekognition (cat, dog, animal, etc.)
--   source     — 'rescue' (uploaded by shelter) or 'external' (from API, stored
--                for reference only; external pets are NOT stored in this table)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pets (
  petid       INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  species     VARCHAR(50)   DEFAULT 'animal',
  breed       VARCHAR(100),
  age_years   FLOAT,
  description TEXT,
  photo_key   VARCHAR(255),
  source      VARCHAR(20)   DEFAULT 'rescue',
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- subscribers: users who want email alerts for new pet listings
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscribers (
  subid      INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(200) NOT NULL UNIQUE,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- applications: adoption applications
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  appid           INT AUTO_INCREMENT PRIMARY KEY,
  petid           INT          NOT NULL,
  applicant_name  VARCHAR(200) NOT NULL,
  applicant_email VARCHAR(200) NOT NULL,
  message         TEXT,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (petid) REFERENCES pets(petid)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Optional: seed a few test rows so GET /pets returns something right away
-- ─────────────────────────────────────────────────────────────────────────────
-- INSERT INTO pets (name, species, breed, age_years, description, source)
-- VALUES ('Luna', 'cat', 'Domestic Shorthair', 2.0, 'Friendly and loves cuddles.', 'rescue'),
--        ('Max',  'dog', 'Labrador Mix',       3.5, 'Energetic and great with kids.', 'rescue');

-- INSERT INTO subscribers (email)
-- VALUES ('test@example.com');
