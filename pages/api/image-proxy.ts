import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url param" });
  }

  const target = decodeURIComponent(url);
  if (!target.startsWith("https://image.pollinations.ai/")) {
    return res.status(403).json({ error: "Only Pollinations URLs allowed" });
  }

  const upstream = await fetch(target);
  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  const buffer = await upstream.arrayBuffer();

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.status(upstream.status).send(Buffer.from(buffer));
}
