import type { NextApiRequest, NextApiResponse } from "next";
import { initDb, getStory, updateStory, deleteStory } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await initDb();
  } catch {
    return res.status(500).json({ error: "Database error" });
  }

  const { id } = req.query as { id: string };

  if (req.method === "GET") {
    const email = req.query.email as string | undefined;
    if (!email) return res.status(400).json({ error: "Missing email" });

    try {
      const story = await getStory(id);
      if (!story) return res.status(404).json({ error: "Story not found" });
      if (story.user_email.toLowerCase() !== email.toLowerCase()) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return res.status(200).json(story);
    } catch {
      return res.status(500).json({ error: "Database error" });
    }
  }

  if (req.method === "PUT") {
    const { email, title, chapterCount, state } = req.body as {
      email?: string;
      title?: string;
      chapterCount?: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state?: Record<string, any>;
    };

    if (!email || !title || chapterCount === undefined || !state) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const story = await getStory(id);
      if (!story) return res.status(404).json({ error: "Story not found" });
      if (story.user_email.toLowerCase() !== email.toLowerCase()) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await updateStory(id, title, chapterCount, state);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Database error" });
    }
  }

  if (req.method === "DELETE") {
    const email = req.query.email as string | undefined;
    if (!email) return res.status(400).json({ error: "Missing email" });

    try {
      const story = await getStory(id);
      if (!story) return res.status(404).json({ error: "Story not found" });
      if (story.user_email.toLowerCase() !== email.toLowerCase()) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await deleteStory(id);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Database error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
