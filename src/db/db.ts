import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('prompt','skill')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active_version_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS target_versions (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL REFERENCES targets(id),
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  parent_version_id TEXT,
  changelog TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'manual',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_versions_target ON target_versions(target_id, version);

CREATE TABLE IF NOT EXISTS sample_sets (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL REFERENCES targets(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  scenario TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS samples (
  id TEXT PRIMARY KEY,
  sample_set_id TEXT NOT NULL REFERENCES sample_sets(id),
  name TEXT NOT NULL,
  input TEXT NOT NULL,
  capability TEXT,
  tier TEXT CHECK (tier IN ('B','A','E','R') OR tier IS NULL),
  ground_truth TEXT,
  expected_trajectory TEXT NOT NULL DEFAULT '[]',
  expected_skill TEXT,
  expected_side_effects TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'manual',
  fresh_as_of INTEGER NOT NULL,
  contamination TEXT NOT NULL,
  mock_spec TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_samples_set ON samples(sample_set_id);

CREATE TABLE IF NOT EXISTS engines (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_id TEXT NOT NULL REFERENCES targets(id),
  target_version_id TEXT NOT NULL,
  baseline_version_id TEXT,
  sample_set_id TEXT NOT NULL,
  engine_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'single',
  eval_config TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES experiments(id),
  sample_id TEXT NOT NULL,
  arm TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  output TEXT NOT NULL DEFAULT '',
  selected_skill TEXT,
  grading TEXT NOT NULL,
  timing TEXT NOT NULL,
  tokens TEXT NOT NULL,
  error TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_experiment ON runs(experiment_id);

CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  steps TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_traces_run ON traces(run_id);

CREATE TABLE IF NOT EXISTS attributions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  sample_id TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  counterfactuals TEXT NOT NULL DEFAULT '[]',
  trace_step_index INTEGER,
  fix_layer TEXT NOT NULL,
  recommendation TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attr_experiment ON attributions(experiment_id);

CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  base_version_id TEXT NOT NULL,
  proposed_content TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  attribution_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS benchmarks (
  experiment_id TEXT PRIMARY KEY,
  report TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attribution_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scenario TEXT NOT NULL DEFAULT '',
  criteria TEXT NOT NULL DEFAULT '',
  judge_id TEXT NOT NULL DEFAULT 'mock-judge',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES attribution_agents(id),
  experiment_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  findings TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_analysis_experiment ON analysis_tasks(experiment_id);

CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  template TEXT NOT NULL,
  built_in INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_reports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template_id TEXT NOT NULL,
  task_id TEXT,
  experiment_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

/** Additive migrations for databases created before these columns existed. */
const MIGRATIONS = [
  "ALTER TABLE samples ADD COLUMN capability TEXT",
  "ALTER TABLE samples ADD COLUMN tier TEXT",
];

export function openDb(path: string): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  for (const m of MIGRATIONS) {
    try {
      db.exec(m);
    } catch {
      // column already exists (fresh schema or previously migrated)
    }
  }
  return db;
}

let defaultDb: Database | null = null;

export function getDb(): Database {
  if (!defaultDb) {
    const path = process.env.STUDIO_DB ?? "data/studio.db";
    defaultDb = openDb(path);
  }
  return defaultDb;
}

/** test hook */
export function setDb(db: Database) {
  defaultDb = db;
}
