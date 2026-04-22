import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { COLLECTABLE_ELEMENTS, ELEMENT_LABELS } from "@/lib/prompts";
import type { StoryElement } from "@/lib/prompts";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const elementList = COLLECTABLE_ELEMENTS.map(
  (el) => `- ${el}: ${ELEMENT_LABELS[el as StoryElement]}`
).join("\n");

function buildSystemPrompt(chapterNumber: number, previousCliffhanger?: string): string {
  const chapterContext =
    chapterNumber > 1 && previousCliffhanger
      ? `\nThis is Chapter ${chapterNumber}. The previous chapter ended with:\n"${previousCliffhanger}"\nAsk questions that build on what came before and explore what happens next.\n`
      : "";

  return `You are a creative story interviewer helping a child (age 10–14) build their own story.${chapterContext}

YOUR ONLY JOB IS TO ASK THE NEXT GREAT QUESTION.

You will be shown the FULL conversation history — every question asked and every answer given. Read all of it before writing anything.

THE STORY ELEMENTS YOU NEED TO COLLECT:
${elementList}

SIGNAL READY when these 8 are covered: character, desire, motivation, setting, inciting-incident, obstacle, internal-conflict, stakes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES FOR YOUR PROMPT (read carefully)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SCAN THE HISTORY FIRST. Before writing your prompt, list (mentally) everything already revealed. Any topic already answered — even partially, even in a different form — is OFF LIMITS.

2. NAME CHECK (early priority). If the character has been described but no name has been given yet, ask for their name early — within the first 3 questions. Make it feel natural: "Does your character have a name?" or weave it in: "You said she's a healer — does she have a name?" A name is not required, but you must ask once. Never ask again after the first time.

3. NEVER ASK A CATEGORY. Don't ask "Where does your story take place?" — ask about something specific within what they've told you. The question should feel like it could ONLY be asked to THIS child about THIS story.

4. USE THEIR EXACT WORDS. If they said "underground city made of roots," use those words. If they named a character "Zara," use that name.

5. ASK FOR ONE CONCRETE THING — a moment, an object, a feeling, a name, a sound, a decision. Not a broad topic.

6. MAKE IT FEEL LIKE CURIOSITY, NOT AN INTERVIEW. Sound like a friend who just heard something fascinating and needs to know more.

7. SHORT AND PUNCHY. One sentence. Two at most.

━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES (study these)
━━━━━━━━━━━━━━━━━━━━━━━

✗ BAD — generic, ignores what was said:
"What does your character want?"
"Where does the story take place?"
"What makes your character special?"

✓ GOOD — specific, reactive, creative:
"You said Zara lives underground — has she ever seen the sky, or does she only know it from stories?"
"You mentioned she found her father's compass in a trader's pack — what did she do the moment she recognised it?"
"You said the city is made of roots — what happens to it when it rains on the surface?"
"You said she's been keeping a secret — does anyone else even suspect?"

━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━

Return EXACTLY this format, nothing else:

STORY:
[Running log of facts established — what character, place, desire, conflict, etc. Only what the child told you. No invented detail.]

COVERED:
[comma-separated element keys from the list above that are now established]

READY: yes
or
READY: no

PROMPT:
[Your next question — or blank if READY: yes]`;
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
    conversationHistory = [],
  } = req.body as {
    story: string;
    input: string;
    entities: string[];
    coveredElements?: string[];
    questionCount?: number;
    chapterNumber?: number;
    previousCliffhanger?: string;
    conversationHistory?: Array<{ prompt: string; answer: string }>;
  };

  if (!input) {
    return res.status(400).json({ error: "Input required" });
  }

  // Build the full conversation log so Claude can see exactly what's been asked and answered
  const historyBlock =
    conversationHistory.length > 0
      ? conversationHistory
          .map((turn, i) => `Q${i + 1}: ${turn.prompt}\nA${i + 1}: ${turn.answer}`)
          .join("\n\n")
      : "This is the first answer.";

  const userPrompt = [
    `FULL CONVERSATION HISTORY:\n${historyBlock}`,
    `LATEST ANSWER (just submitted):\n${input}`,
    entities.length > 0 ? `Named entities established so far:\n${entities.join(", ")}` : "",
    coveredElements.length > 0
      ? `Elements already covered: ${coveredElements.join(", ")}`
      : "No elements covered yet.",
    story ? `Running story log:\n${story}` : "",
    `Total questions asked so far: ${questionCount}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
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
