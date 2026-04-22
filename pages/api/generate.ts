import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { COLLECTABLE_ELEMENTS, ELEMENT_LABELS } from "@/lib/prompts";
import type { StoryElement } from "@/lib/prompts";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const elementList = COLLECTABLE_ELEMENTS.map(
  (el) => `- ${el}: ${ELEMENT_LABELS[el as StoryElement]}`
).join("\n");

function buildSystemPrompt(chapterNumber: number, previousCliffhanger?: string): string {
  const chapterContext = chapterNumber > 1 && previousCliffhanger
    ? `\nThis is Chapter ${chapterNumber}. The previous chapter ended with this cliffhanger:\n"${previousCliffhanger}"\nYour questions should help build on what came before and resolve (or deepen) that cliffhanger.\n`
    : "";

  return `You are helping a child (age 10–14) build a story through conversation.
${chapterContext}
Each turn you will:
1. Add the child's new input to the growing story fragment.
2. Identify which story elements have now been established (cumulative — include previously covered ones).
3. Decide if you have enough to write a compelling chapter.
4. If not ready, ask the single most important missing question — reacting to what they just said.

THE 10 STORY ELEMENTS TO COLLECT:
${elementList}

READY TO WRITE when ALL of these are covered:
character, desire, motivation, setting, inciting-incident, obstacle, internal-conflict, stakes

(choice and emotion are bonuses — signal READY once the 8 core elements above are covered)

STORY RULES:
- Use ONLY the child's input — no invented characters, places, or plot
- Keep sentences short and simple
- Preserve their exact words and names

PROMPT RULES:
- React specifically to what they just said — use their words/names
- Ask about ONE thing only — the most important missing element
- Be short, punchy, and engaging — not clinical
- Do NOT ask about something already covered
- If READY, leave PROMPT blank

Return your response in EXACTLY this format (no extra text):

STORY:
[updated story fragment — only what the child has told you]

COVERED:
[comma-separated list of covered element keys, e.g.: character, desire, setting]

READY: yes
or
READY: no

PROMPT:
[next question, or blank if READY: yes]`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    story,
    input,
    entities,
    coveredElements = [],
    questionCount = 0,
    chapterNumber = 1,
    previousCliffhanger,
  } = req.body as {
    story: string;
    input: string;
    entities: string[];
    coveredElements?: string[];
    questionCount?: number;
    chapterNumber?: number;
    previousCliffhanger?: string;
  };

  if (!input) {
    return res.status(400).json({ error: "Input required" });
  }

  const userPrompt = [
    story ? `Story so far:\n${story}` : "",
    `Child's latest input:\n${input}`,
    entities.length > 0 ? `Established entities (names, places, objects):\n${entities.join(", ")}` : "",
    coveredElements.length > 0
      ? `Elements already covered: ${coveredElements.join(", ")}`
      : "No elements covered yet.",
    `Questions asked so far: ${questionCount}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: buildSystemPrompt(chapterNumber, previousCliffhanger),
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = (message.content[0] as { text: string }).text.trim();

    const storyMatch = raw.match(/STORY:\s*([\s\S]*?)(?=COVERED:|$)/i);
    const coveredMatch = raw.match(/COVERED:\s*([\s\S]*?)(?=READY:|$)/i);
    const readyMatch = raw.match(/READY:\s*(yes|no)/i);
    const promptMatch = raw.match(/PROMPT:\s*([\s\S]*)/i);

    const storyText = storyMatch ? storyMatch[1].trim() : story;
    const newlyCovered = coveredMatch
      ? coveredMatch[1].trim().split(",").map((s) => s.trim()).filter(Boolean)
      : coveredElements;
    const aiSaysReady = readyMatch ? readyMatch[1].toLowerCase() === "yes" : false;
    const nextPrompt = promptMatch ? promptMatch[1].trim() : "";

    return res.status(200).json({
      story: storyText,
      nextPrompt,
      coveredElements: newlyCovered,
      readyToWrite: aiSaysReady,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI error. Try again." });
  }
}
