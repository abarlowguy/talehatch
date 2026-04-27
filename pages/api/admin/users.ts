import type { NextApiRequest, NextApiResponse } from "next";
import { ensureDb, getAllUsers } from "@/lib/db";

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

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await ensureDb();
  const users = await getAllUsers();
  return res.status(200).json(users);
}
