import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "stories.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        title TEXT NOT NULL,
        chapter_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        state TEXT NOT NULL
      );
    `);
  }
  return _db;
}

export interface StorySummary {
  id: string;
  title: string;
  chapter_count: number;
  created_at: string;
  updated_at: string;
}

export interface StoryRow extends StorySummary {
  user_email: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: Record<string, any>;
}

export function getStoriesByEmail(email: string): StorySummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, title, chapter_count, created_at, updated_at
       FROM stories WHERE user_email = ?
       ORDER BY updated_at DESC`
    )
    .all(email) as StorySummary[];
  return rows;
}

export function getStory(id: string): StoryRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_email, title, chapter_count, created_at, updated_at, state
       FROM stories WHERE id = ?`
    )
    .get(id) as (Omit<StoryRow, "state"> & { state: string }) | undefined;

  if (!row) return null;
  return { ...row, state: JSON.parse(row.state) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createStory(email: string, id: string, title: string, state: Record<string, any>): void {
  const db = getDb();
  const now = new Date().toISOString();

  // Upsert user row
  db.prepare(
    `INSERT OR IGNORE INTO users (email, created_at) VALUES (?, ?)`
  ).run(email, now);

  db.prepare(
    `INSERT INTO stories (id, user_email, title, chapter_count, created_at, updated_at, state)
     VALUES (?, ?, ?, 0, ?, ?, ?)`
  ).run(id, email, title, now, now, JSON.stringify(state));
}

export function updateStory(
  id: string,
  title: string,
  chapterCount: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: Record<string, any>
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE stories SET title = ?, chapter_count = ?, updated_at = ?, state = ?
     WHERE id = ?`
  ).run(title, chapterCount, now, JSON.stringify(state), id);
}
