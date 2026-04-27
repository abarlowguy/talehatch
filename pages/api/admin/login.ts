// Requires ADMIN_PASSWORD environment variable to be set in Vercel (or .env.local for local dev).
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body as { password?: string };

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  res.setHeader(
    "Set-Cookie",
    "admin_session=1; HttpOnly; Path=/; SameSite=Strict"
  );
  return res.status(200).json({ ok: true });
}
