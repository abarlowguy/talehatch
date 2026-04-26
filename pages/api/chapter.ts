import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { AGE_RANGE_CONFIG } from "@/lib/prompts";
import type { AgeRange } from "@/lib/prompts";
import { buildStyleSuffix } from "@/lib/imageRegen";

export const config = {
  maxDuration: 60,
};

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(
  chapterNumber: number,
  ageRange: AgeRange,
  previousCliffhanger?: string
): string {
  const tier = AGE_RANGE_CONFIG[ageRange];
  const isFirstChapter = chapterNumber === 1;

  const genreSection = isFirstChapter
    ? `GENRE:\n[One word identifying the story genre. Choose the closest match: fantasy, sci-fi, mystery, adventure, cozy, historical, or other]\n\n`
    : "";

  const storyTitleSection = isFirstChapter
    ? `STORY_TITLE:\n[A short, evocative title for the whole story — 2–5 words. Not the chapter title. Something that captures the spirit of the adventure.]\n\n`
    : "";

  const continuationContext = !isFirstChapter && previousCliffhanger
    ? `\n\nThis is Chapter ${chapterNumber} of an ongoing story. The previous chapter ended with this cliffhanger:\n"${previousCliffhanger}"\n\nThe chapter must open by picking up from that cliffhanger — reference it directly in the first paragraph.`
    : "";

  const ageGuidance: Record<AgeRange, string> = {
    tiny:
      "Write like a picture book read aloud. Every sentence must be short — 5 to 8 words maximum. Use only the simplest vocabulary a 4-year-old knows. Warm, gentle, cheerful tone. No scary moments. End with a happy resolution or a gentle 'I wonder what happens next' moment — NOT a cliffhanger.",
    young:
      "Use very short sentences. Simple, concrete vocabulary — nothing abstract. Bright and fun tone. No dark or scary themes. Lots of action, colour, and wonder.",
    middle:
      "Use clear, readable language. Mix short and medium sentences. Some tension and mild stakes are fine. Avoid heavy psychological depth.",
    older:
      "Write like a real published author. Vary sentence length. Short punchy sentences for action; longer ones for description. Full emotional and psychological depth.",
  };

  return `You are writing Chapter ${chapterNumber} of a story for ${tier.readerDescription}.${continuationContext}

You have been given the child's answers to guided prompts. These answers contain ALL the raw material for the chapter. Transform them into a vivid, engaging chapter — roughly ${tier.chapterWords} words.

STYLE: ${ageGuidance[ageRange]}

RULES:
- Use ONLY the ideas the child provided. Do not invent major new characters, locations, or plot elements.
- You MAY add sensory detail, atmosphere, pacing, and emotional texture.
- Write in third person, past tense, as a real published book for young readers.
- Clear structure: beginning (establish the scene), middle (conflict escalates), end (cliffhanger).
- DO NOT use the word "suddenly." DO NOT use clichés.
- Write like a real author. Make it feel earned.

CLIFFHANGER RULES (CRITICAL):
- The chapter MUST end on a genuine cliffhanger — a moment of threat, discovery, or impossible choice that makes stopping feel unbearable.
- The cliffhanger should feel earned by the events of the chapter, not dropped in from nowhere.
- It must leave one urgent question unanswered.

Return your response in EXACTLY this format:

${genreSection}${storyTitleSection}TITLE:
[A short, evocative chapter title — not "Chapter ${chapterNumber}", just the title]

CHAPTER:
[The full chapter text — 1,200 to 1,500 words, ending on the cliffhanger]

CLIFFHANGER:
[2–3 sentences summarising the exact cliffhanger moment — written so the next chapter can pick up from it precisely]

IMAGE_PROMPTS:
Write 3 to 5 image prompts — one for each distinct scene or visual moment in this chapter, in order. Number them. Each prompt should describe characters, setting, action, mood, lighting, and colour palette in under 80 words. Kid-friendly watercolour illustration style.

1. [Scene description]
2. [Scene description]
3. [Scene description]
(add more if the chapter has more distinct scenes, up to 5)`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    inputs, story, entities, chapterNumber = 1, previousCliffhanger,
    ageRange = "older", artStyle: incomingArtStyle,
  } = req.body as {
    inputs: string[];
    story: string;
    entities: string[];
    chapterNumber?: number;
    previousCliffhanger?: string;
    ageRange?: AgeRange;
    artStyle?: string;
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
      system: buildSystemPrompt(chapterNumber, ageRange, previousCliffhanger),
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      return res.status(500).json({ error: "Unexpected response format from AI" });
    }
    const raw = block.text.trim();

    const storyTitleMatch = chapterNumber === 1
      ? raw.match(/STORY_TITLE:\s*([\s\S]*?)(?=TITLE:|$)/i)
      : null;
    const storyTitle = storyTitleMatch ? storyTitleMatch[1].trim() : undefined;

    const genreMatch = chapterNumber === 1
      ? raw.match(/^GENRE:\s*(.+)$/im)
      : null;
    const genre = genreMatch ? genreMatch[1].trim().toLowerCase() : "";
    const artStyle = chapterNumber === 1
      ? buildStyleSuffix(ageRange, genre)
      : (incomingArtStyle ?? buildStyleSuffix(ageRange, ""));

    const titleMatch = raw.match(/TITLE:\s*([\s\S]*?)(?=CHAPTER:|$)/i);
    const chapterMatch = raw.match(/CHAPTER:\s*([\s\S]*?)(?=CLIFFHANGER:|IMAGE_PROMPTS:|$)/i);
    const cliffhangerMatch = raw.match(/CLIFFHANGER:\s*([\s\S]*?)(?=IMAGE_PROMPTS:|$)/i);
    const imageSection = raw.match(/IMAGE_PROMPTS:\s*([\s\S]*)/i)?.[1] ?? "";

    const chapterTitle = titleMatch ? titleMatch[1].trim() : `Chapter ${chapterNumber}`;
    const chapter = chapterMatch ? chapterMatch[1].trim() : raw;
    const cliffhanger = cliffhangerMatch ? cliffhangerMatch[1].trim() : "";

    // Parse numbered image prompts, filter out the example placeholder lines
    const rawImageLines = imageSection
      .split("\n")
      .map((line) => line.replace(/^\d+\.\s*/, "").trim())
      .filter((line) => line.length > 15 && !line.startsWith("["));

    const imagePromptTexts = rawImageLines.length > 0
      ? rawImageLines
      : ["A child in a mysterious landscape, dramatic lighting, kid-friendly storybook art style"];

    const imageUrls = imagePromptTexts.map((prompt) => {
      const styled = `${prompt}${artStyle}`;
      const seed = Math.floor(Math.random() * 999999);
      return `https://image.pollinations.ai/prompt/${encodeURIComponent(styled)}?width=768&height=512&model=turbo&seed=${seed}`;
    });

    return res.status(200).json({ chapterTitle, chapter, cliffhanger, imageUrls, imagePrompts: imagePromptTexts, storyTitle, artStyle });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not generate chapter. Try again." });
  }
}
