import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  schemaReady?: Promise<void>;
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS program_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  program_name text NOT NULL DEFAULT 'Impact Newsletter',
  tagline text NOT NULL DEFAULT 'Notes home from the program',
  viewer_password_hash text,
  dropbox_refresh_token text,
  dropbox_account_id text,
  dropbox_account_label text,
  dropbox_folder_path text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO program_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS staff_users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  event_date date,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  dropbox_folder_path text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT issues_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  included boolean NOT NULL DEFAULT true,
  kind text NOT NULL,
  name text NOT NULL,
  dropbox_id text,
  dropbox_path text,
  source_url text,
  caption text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assets_kind_check CHECK (kind IN ('image', 'video'))
);

CREATE INDEX IF NOT EXISTS assets_issue_order_idx ON assets (issue_id, sort_order);

CREATE TABLE IF NOT EXISTS share_links (
  id uuid PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_encrypted text NOT NULL,
  label text NOT NULL DEFAULT 'Family link',
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function pool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  if (!globalForDb.pool) {
    const created = new Pool({ connectionString: url, max: 5 });
    attachDatabasePool(created);
    globalForDb.pool = created;
  }
  return globalForDb.pool;
}

export function getDb(): Db {
  return drizzle(pool(), { schema });
}

async function ensureSchema() {
  await pool().query(SCHEMA_SQL);
}

export async function ready() {
  if (!databaseConfigured()) {
    throw new Error("DATABASE_URL is not set.");
  }
  if (!globalForDb.schemaReady) {
    globalForDb.schemaReady = ensureSchema().catch((error: unknown) => {
      globalForDb.schemaReady = undefined;
      throw error;
    });
  }
  await globalForDb.schemaReady;
}

export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  await ready();
  return fn(getDb());
}
