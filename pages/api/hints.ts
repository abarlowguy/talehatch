import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import type { ChapterHistoryEntry } from "@/lib/storyBuilder";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function buildHintPrompt(
  type: "answer" | "moral",
  question: string,
  story: string,
  entities: string[],
  chapterHistory: ChapterHistoryEntry[],
  previousAnswers: string[]
): string {
  const entityContext = entities.length > 0
    ? `Key story characters/entities: ${entities.join(", ")}.`
    : "";

  const historyContext = chapterHistory.length > 0
    ? `Prior chapters:\n${chapterHistory
        .map((ch) => `Chapter ${ch.chapterNumber} — "${ch.title}" ended with: ${ch.cliffhanger}`)
        .join("\n")}`
    : "";

  const answersContext = previousAnswers.length > 0
    ? `Answers already given this session:\n${previousAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
    : "";

  const storyContext = [entityContext, historyContext, answersContext, story ? `Story so far: ${story}` : ""]
    .filter(Boolean)
    .join("\n\n");

  if (type === "moral") {
    return `You are helping a child think of a meaningful lesson for the end of their story.

${storyContext}

Generate exactly 3 short moral/lesson suggestions that fit naturally with this story. Each suggestion should be 1 sentence, written from the perspective of something the main character might learn or the reader might take away. Make them specific to this story's characters and events — not generic life lessons.

Return ONLY a JSON array of 3 strings. Example format:
["suggestion one", "suggestion two", "suggestion three"]`;
  }

  return `You are helping a child answer a story-building question. The question is: "${question}"

${storyContext}

Generate exactly 3 short, specific, imaginative answer suggestions that:
- Directly answer the question asked
- Reference characters, places, or events already established in this story
- Are written as if the child is saying them (first person is fine, keep it simple)
- Are 1-2 sentences each, vivid and concrete

Return ONLY a JSON array of 3 strings. Example format:
["suggestion one", "suggestion two", "suggestion three"]`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    type = "answer",
    question = "",
    story = "",
    entities = [],
    chapterHistory = [],
    previousAnswers = [],
  } = req.body as {
    type?: "answer" | "moral";
    question?: string;
    story?: string;
    entities?: string[];
    chapterHistory?: ChapterHistoryEntry[];
    previousAnswers?: string[];
  };

  const userPrompt = buildHintPrompt(type, question, story, entities, chapterHistory, previousAnswers);

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      return res.status(500).json({ hints: [], error: "Unexpected AI response" });
    }

    const jsonMatch = block.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ hints: [], error: "Could not parse hints" });
    }

    const hints: string[] = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ hints });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ hints: [], error: "AI error. Try again." });
  }
}
