import type { NextApiRequest, NextApiResponse } from "next";
import { initDb, getStory, updateStory, deleteStory } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await initDb();
  const { id } = req.query as { id: string };

  if (req.method === "GET") {
    const story = await getStory(id);
    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }
    return res.status(200).json(story);
  }

  if (req.method === "PUT") {
    const { title, chapterCount, state } = req.body as {
      title?: string;
      chapterCount?: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state?: Record<string, any>;
    };

    if (!title || chapterCount === undefined || !state) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await updateStory(id, title, chapterCount, state);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    await deleteStory(id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
