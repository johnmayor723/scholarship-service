const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const config = require("./config");

const absolutePath = path.resolve(config.databasePath);
fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
const db = new Database(absolutePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS scholarships (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  provider TEXT,
  university_name TEXT,
  description TEXT,
  academic_session TEXT NOT NULL,
  study_levels TEXT NOT NULL DEFAULT '[]',
  eligible_nationalities TEXT NOT NULL DEFAULT '["Nigerian"]',
  eligible_locations TEXT NOT NULL DEFAULT '["Nigeria"]',
  fields_of_study TEXT NOT NULL DEFAULT '[]',
  benefits TEXT,
  eligibility TEXT,
  application_url TEXT,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'unconfirmed',
  source_url TEXT NOT NULL,
  source_name TEXT,
  source_type TEXT NOT NULL DEFAULT 'official',
  source_published_at TEXT,
  last_checked_at TEXT,
  verified_at TEXT,
  verification_notes TEXT,
  discovered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  raw_excerpt TEXT,
  UNIQUE(title, provider, academic_session)
);
CREATE TABLE IF NOT EXISTS source_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'official',
  enabled INTEGER NOT NULL DEFAULT 1,
  trust_level TEXT NOT NULL DEFAULT 'primary',
  notes TEXT,
  last_checked_at TEXT,
  last_status TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS crawl_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  sources_checked INTEGER NOT NULL DEFAULT 0,
  candidates_found INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);
CREATE INDEX IF NOT EXISTS idx_scholarships_session_status
  ON scholarships(academic_session, status);
CREATE INDEX IF NOT EXISTS idx_scholarships_deadline ON scholarships(deadline);
`);

module.exports = db;