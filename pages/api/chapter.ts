import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";

export const config = {
  maxDuration: 60,
};

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(chapterNumber: number, previousCliffhanger?: string): string {
  const isFirstChapter = chapterNumber === 1;

  const continuationContext = !isFirstChapter && previousCliffhanger
    ? `\n\nThis is Chapter ${chapterNumber} of an ongoing story. The previous chapter ended with this cliffhanger:\n"${previousCliffhanger}"\n\nThe chapter must open by picking up from that cliffhanger — reference it directly in the first paragraph.`
    : "";

  return `You are writing Chapter ${chapterNumber} of a children's story (ages 10–14).${continuationContext}

You have been given the child's answers to guided prompts. These answers contain ALL the raw material for the chapter. Transform them into a vivid, engaging chapter — roughly 1,200 to 1,500 words.

RULES:
- Use ONLY the ideas the child provided. Do not invent major new characters, locations, or plot elements.
- You MAY add sensory detail, atmosphere, pacing, and emotional texture.
- Write in third person, past tense, as a real published book for young readers.
- Vary sentence length. Short punchy sentences for action and tension. Longer ones for description.
- Clear structure: beginning (establish the scene), middle (conflict escalates), end (cliffhanger).
- DO NOT use the word "suddenly." DO NOT use clichés.
- Write like a real author. Make it feel earned.

CLIFFHANGER RULES (CRITICAL):
- The chapter MUST end on a genuine cliffhanger — a moment of threat, discovery, or impossible choice that makes stopping feel unbearable.
- The cliffhanger should feel earned by the events of the chapter, not dropped in from nowhere.
- It must leave one urgent question unanswered.

Return your response in EXACTLY this format:

TITLE:
[A short, evocative chapter title — not "Chapter ${chapterNumber}", just the title]

CHAPTER:
[The full chapter text — 1,200 to 1,500 words, ending on the cliffhanger]

CLIFFHANGER:
[2–3 sentences summarising the exact cliffhanger moment — written so the next chapter can pick up from it precisely]

IMAGE_PROMPT:
[A vivid description of the most visually striking scene. Characters, appearance, environment, mood, lighting, colour palette. Under 120 words. Kid-friendly watercolour style.]`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { inputs, story, entities, chapterNumber = 1, previousCliffhanger } = req.body as {
    inputs: string[];
    story: string;
    entities: string[];
    chapterNumber?: number;
    previousCliffhanger?: string;
  };

  if (!inputs || inputs.length === 0) {
    return res.status(400).json({ error: "No inputs provided" });
  }

  const numberedInputs = inputs.map((inp, i) => `Answer ${i + 1}: ${inp}`).join("\n");

  const userPrompt = [
    `Child's answers to guided story prompts:\n${numberedInputs}`,
    story ? `Accumulated story fragments:\n${story}` : "",
    entities.length > 0 ? `Key story entities:\n${entities.join(", ")}` : "",
    `Now write Chapter ${chapterNumber}.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: buildSystemPrompt(chapterNumber, previousCliffhanger),
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = (message.content[0] as { text: string }).text.trim();

    const titleMatch = raw.match(/TITLE:\s*([\s\S]*?)(?=CHAPTER:|$)/i);
    const chapterMatch = raw.match(/CHAPTER:\s*([\s\S]*?)(?=CLIFFHANGER:|IMAGE_PROMPT:|$)/i);
    const cliffhangerMatch = raw.match(/CLIFFHANGER:\s*([\s\S]*?)(?=IMAGE_PROMPT:|$)/i);
    const imageMatch = raw.match(/IMAGE_PROMPT:\s*([\s\S]*)/i);

    const chapterTitle = titleMatch ? titleMatch[1].trim() : `Chapter ${chapterNumber}`;
    const chapter = chapterMatch ? chapterMatch[1].trim() : raw;
    const cliffhanger = cliffhangerMatch ? cliffhangerMatch[1].trim() : "";
    const imagePromptText = imageMatch
      ? imageMatch[1].trim()
      : "A child in a mysterious landscape, dramatic lighting, kid-friendly storybook art style";

    const styledPrompt = `${imagePromptText}, children's book illustration, watercolour and ink, warm and magical, highly detailed`;
    const seed = Math.floor(Math.random() * 999999);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(styledPrompt)}?width=768&height=768&model=flux&seed=${seed}`;
    const imageUrl = `/api/image-proxy?url=${encodeURIComponent(pollinationsUrl)}`;

    return res.status(200).json({ chapterTitle, chapter, cliffhanger, imageUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not generate chapter. Try again." });
  }
}
