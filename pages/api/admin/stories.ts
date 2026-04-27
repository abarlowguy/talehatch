import type { NextApiRequest, NextApiResponse } from "next";
import { ensureDb, getAllStories, deleteStory } from "@/lib/db";

function isAuthorized(req: NextApiRequest): boolean {
  const raw = req.headers.cookie ?? "";
  return raw.split(";").some((c) => c.trim() === "admin_session=1");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await ensureDb();

  if (req.method === "GET") {
    const stories = await getAllStories();
    return res.status(200).json(stories);
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing story id" });
    }
    await deleteStory(id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
