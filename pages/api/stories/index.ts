import type { NextApiRequest, NextApiResponse } from "next";
import { initDb, getStoriesByEmail, createStory } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await initDb();

  if (req.method === "GET") {
    const email = req.query.email as string | undefined;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }
    const stories = await getStoriesByEmail(email);
    return res.status(200).json(stories);
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

    await createStory(email, id, title, state);
    return res.status(200).json({ id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
