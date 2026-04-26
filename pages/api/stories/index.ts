import type { NextApiRequest, NextApiResponse } from "next";
import { ensureDb, getStoriesByEmail, createStory } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureDb();
  } catch {
    return res.status(500).json({ error: "Database error" });
  }

  if (req.method === "GET") {
    const rawEmail = req.query.email as string | undefined;
    if (!rawEmail || !rawEmail.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }
    try {
      const stories = await getStoriesByEmail(rawEmail.toLowerCase());
      return res.status(200).json(stories);
    } catch {
      return res.status(500).json({ error: "Database error" });
    }
  }

  if (req.method === "POST") {
    const { email, id, title, state } = req.body as {
      email?: string;
      id?: string;
      title?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state?: Record<string, any>;
    };

    if (!email || !email.includes("@") || !id || !title || !state) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      await createStory(email.toLowerCase(), id, title, state);
      return res.status(200).json({ id });
    } catch {
      return res.status(500).json({ error: "Database error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
