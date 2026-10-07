import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type Db = DatabaseSync

/** Migraciones en orden; nunca se edita una ya publicada, se agrega una nueva. */
const MIGRATIONS: string[] = [
  /* 1: base */ `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE projects (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    code          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    color         TEXT NOT NULL DEFAULT '#2563EB',
    favorite      INTEGER NOT NULL DEFAULT 0,
    archived      INTEGER NOT NULL DEFAULT 0,
    brief_md      TEXT NOT NULL DEFAULT '',
    card_counter  INTEGER NOT NULL DEFAULT 0,
    round_counter INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE people (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL DEFAULT '',
    role       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE cards (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id             INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    number                 INTEGER NOT NULL,
    title                  TEXT NOT NULL,
    type                   TEXT NOT NULL,
    priority               TEXT NOT NULL,
    column_id              TEXT NOT NULL,
    ord                    TEXT NOT NULL,
    labels                 TEXT NOT NULL DEFAULT '[]',
    assignee               TEXT,
    description_md         TEXT NOT NULL DEFAULT '',
    report                 TEXT,
    acceptance             TEXT NOT NULL DEFAULT '[]',
    attachments            TEXT NOT NULL DEFAULT '[]',
    sprint_id              INTEGER,
    version_id             INTEGER,
    branch                 TEXT,
    pr_url                 TEXT,
    commit_sha             TEXT,
    source_observation_ids TEXT NOT NULL DEFAULT '[]',
    created_by             TEXT NOT NULL,
    created_at             TEXT NOT NULL,
    updated_at             TEXT NOT NULL,
    archived               INTEGER NOT NULL DEFAULT 0,
    UNIQUE (project_id, number)
  );
  CREATE INDEX cards_board ON cards (project_id, archived, column_id, ord);
  `,
  /* 2: comentarios e historial */ `
  CREATE TABLE comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id    INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    author     TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX comments_card ON comments (card_id, id);

  CREATE TABLE history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    card_id    INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    actor      TEXT NOT NULL,
    action     TEXT NOT NULL,
    from_value TEXT,
    to_value   TEXT,
    detail     TEXT,
    at         TEXT NOT NULL
  );
  CREATE INDEX history_card ON history (card_id, id);
  CREATE INDEX history_project ON history (project_id, id);
  `,
  /* 3: observaciones (Por revisar) */ `
  ALTER TABLE projects ADD COLUMN observation_counter INTEGER NOT NULL DEFAULT 0;

  CREATE TABLE observations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    number      INTEGER NOT NULL,
    channel     TEXT NOT NULL,
    kind        TEXT NOT NULL,
    title       TEXT NOT NULL,
    report      TEXT NOT NULL,
    attachments TEXT NOT NULL DEFAULT '[]',
    sender      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pendiente',
    status_note TEXT,
    card_number INTEGER,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE (project_id, number)
  );
  CREATE INDEX observations_inbox ON observations (project_id, channel, status, created_at);

  CREATE TABLE observation_comments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    author         TEXT NOT NULL,
    text           TEXT NOT NULL,
    created_at     TEXT NOT NULL
  );
  `,
]

export function openDb(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON;')
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  migrate(db)
  return db
}

function migrate(db: Db) {
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number }
  for (let v = current; v < MIGRATIONS.length; v++) {
    tx(db, () => {
      db.exec(MIGRATIONS[v]!)
      db.exec(`PRAGMA user_version = ${v + 1}`)
    })
  }
}

const depth = new WeakMap<Db, number>()

/** Ejecuta fn dentro de una transacción. Reentrante: si ya hay una abierta, se suma a ella. */
export function tx<T>(db: Db, fn: () => T): T {
  const level = depth.get(db) ?? 0
  if (level > 0) return fn()
  db.exec('BEGIN IMMEDIATE')
  depth.set(db, 1)
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  } finally {
    depth.set(db, 0)
  }
}

export const now = () => new Date().toISOString()
