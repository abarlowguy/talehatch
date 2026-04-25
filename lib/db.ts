import { neon } from "@neondatabase/serverless";

function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  return neon(process.env.DATABASE_URL);
}

export async function initDb() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      chapter_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      state TEXT NOT NULL
    )
  `;
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

export async function getStoriesByEmail(email: string): Promise<StorySummary[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, title, chapter_count, created_at, updated_at
    FROM stories
    WHERE user_email = ${email}
    ORDER BY updated_at DESC
  `;
  return rows as unknown as StorySummary[];
}

export async function getStory(id: string): Promise<StoryRow | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, user_email, title, chapter_count, created_at, updated_at, state
    FROM stories WHERE id = ${id}
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  return { ...row, state: JSON.parse(row.state as string) } as StoryRow;
}

export async function createStory(
  email: string,
  id: string,
  title: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: Record<string, any>
): Promise<void> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO users (email, created_at)
    VALUES (${email}, ${now})
    ON CONFLICT (email) DO NOTHING
  `;
  await sql`
    INSERT INTO stories (id, user_email, title, chapter_count, created_at, updated_at, state)
    VALUES (${id}, ${email}, ${title}, 0, ${now}, ${now}, ${JSON.stringify(state)})
  `;
}

export async function updateStory(
  id: string,
  title: string,
  chapterCount: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: Record<string, any>
): Promise<void> {
  const sql = getDb();
  const now = new Date().toISOString();
  await sql`
    UPDATE stories
    SET title = ${title}, chapter_count = ${chapterCount}, updated_at = ${now}, state = ${JSON.stringify(state)}
    WHERE id = ${id}
  `;
}
