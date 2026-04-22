import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";

export const config = {
  maxDuration: 60,
};

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EDIT_SYSTEM = `You are editing a chapter of a children's story (ages 10–14).

Apply the requested edits faithfully while:
- Preserving the overall story arc and the child's original ideas
- Keeping the cliffhanger at the end (unless the edit explicitly asks to change it)
- Not inventing major new story elements the child didn't provide
- Maintaining the same writing style, tense, and voice

Return ONLY the revised chapter text — no explanation, no preamble, no formatting labels.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { chapter, editInstructions, cliffhanger } = req.body as {
    chapter: string;
    editInstructions: string;
    cliffhanger: string;
  };

  if (!chapter || !editInstructions) {
    return res.status(400).json({ error: "Chapter and edit instructions required" });
  }

  const userPrompt = [
    `Current chapter:\n${chapter}`,
    cliffhanger ? `The chapter ends with this cliffhanger (preserve it unless told otherwise):\n${cliffhanger}` : "",
    `Requested edits:\n${editInstructions}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: EDIT_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    const revised = (message.content[0] as { text: string }).text.trim();
    return res.status(200).json({ chapter: revised });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not apply edits. Try again." });
  }
}
