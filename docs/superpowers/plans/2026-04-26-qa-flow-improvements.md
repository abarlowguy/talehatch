# TaleHatch Q&A Flow Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement six improvements to TaleHatch: final chapter selection with moral prompt, dynamic "Need ideas?" hints, skip/rephrase prompts, mobile keyboard fix, recency-weighted Q&A, and character-anchored image prompts.

**Architecture:** All Q&A screen changes are extracted into a new `QAPrompt` component. New AI-powered hints live behind a single `/api/hints` endpoint shared by answer-hints and moral-hints. Image anchor context is threaded through `imageRegen.ts` so every image prompt carries a stable character/setting prefix.

**Tech Stack:** Next.js 16 (Pages Router for API), React 19, Bun, TypeScript, Anthropic SDK (`claude-haiku-4-5-20251001` for hints/Q&A, `claude-sonnet-4-6` for chapter generation), Tailwind CSS, bun:test

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| **Create** | `pages/api/hints.ts` | Returns 3 contextual hint suggestions (answer or moral type) |
| **Create** | `components/QAPrompt.tsx` | Q&A prompt UI: skip, rephrase, need ideas, final chapter checkbox |
| **Create** | `lib/useKeyboardScroll.ts` | Visual Viewport hook — keeps focused input above keyboard |
| **Modify** | `lib/storyBuilder.ts` | Add new request/response types + `fetchHints` fetch wrapper |
| **Modify** | `lib/imageRegen.ts` | Add `buildImageUrl` that prepends character anchor to every image prompt |
| **Modify** | `lib/imageRegen.test.ts` | Add tests for `buildImageUrl` |
| **Modify** | `pages/api/generate.ts` | Add `chapterHistory` to system prompt for recency-weighted questions |
| **Modify** | `pages/api/chapter.ts` | Final chapter mode, `CHARACTER_DESCRIPTION` output, character anchor on images |
| **Modify** | `app/page.tsx` | New AppState fields, use QAPrompt, use keyboard hook, wire all APIs |

---

## Task 1: Add Types and fetchHints to storyBuilder.ts

**Files:**
- Modify: `lib/storyBuilder.ts`

- [ ] **Step 1: Add ChapterHistoryEntry type and update GenerateRequest**

Open `lib/storyBuilder.ts` and add after the existing imports at the top, then update `GenerateRequest`:

```typescript
export interface ChapterHistoryEntry {
  chapterNumber: number;
  title: string;
  cliffhanger: string;
}
```

Add to `GenerateRequest` (after `ageRange?`):
```typescript
  chapterHistory?: ChapterHistoryEntry[];
```

- [ ] **Step 2: Update ChapterRequest with final chapter fields**

Add to `ChapterRequest` (after `artStyle?`):
```typescript
  isFinalChapter?: boolean;
  storyMoral?: string;
  characterDescription?: string;
```

- [ ] **Step 3: Update ChapterResponse with characterDescription**

Add to `ChapterResponse` (after `artStyle?`):
```typescript
  characterDescription?: string;
```

- [ ] **Step 4: Add HintsRequest, HintsResponse, and fetchHints**

Add after the `EditChapterResponse` interface:

```typescript
export interface HintsRequest {
  type: "answer" | "moral";
  question: string;
  story: string;
  entities: string[];
  chapterHistory?: ChapterHistoryEntry[];
  previousAnswers?: string[];
}

export interface HintsResponse {
  hints: string[];
  error?: string;
}

export async function fetchHints(req: HintsRequest): Promise<HintsResponse> {
  const res = await fetch("/api/hints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) return { hints: [], error: "Could not load hints." };
  return res.json();
}
```

- [ ] **Step 5: Verify types compile**

```bash
cd /Users/andrewbarlow/talehatch && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/storyBuilder.ts
git commit -m "feat: add ChapterHistoryEntry, final chapter fields, HintsRequest/Response to storyBuilder"
```

---

## Task 2: Add buildImageUrl to imageRegen.ts (Task 6 foundation)

**Files:**
- Modify: `lib/imageRegen.ts`
- Modify: `lib/imageRegen.test.ts`

- [ ] **Step 1: Write failing tests for buildImageUrl**

Add to the end of `lib/imageRegen.test.ts`:

```typescript
describe("buildImageUrl", () => {
  it("returns a Pollinations URL", () => {
    const artStyle = buildStyleSuffix("older", "fantasy");
    const url = buildImageUrl("a cave scene", artStyle);
    expect(url).toMatch(/^https:\/\/image\.pollinations\.ai\/prompt\//);
  });

  it("includes width, height, model, and seed params", () => {
    const artStyle = buildStyleSuffix("older", "");
    const url = buildImageUrl("forest", artStyle);
    expect(url).toContain("width=768");
    expect(url).toContain("height=512");
    expect(url).toContain("model=turbo");
    expect(url).toMatch(/seed=\d+/);
  });

  it("prepends character anchor when provided", () => {
    const artStyle = buildStyleSuffix("older", "");
    const url = buildImageUrl("cave scene", artStyle, "Gus the gopher, small brown fur, round nose");
    const decoded = decodeURIComponent(url.split("?")[0]);
    expect(decoded).toContain("Gus the gopher");
    expect(decoded).toContain("cave scene");
    // anchor comes before scene
    expect(decoded.indexOf("Gus the gopher")).toBeLessThan(decoded.indexOf("cave scene"));
  });

  it("works without character anchor", () => {
    const artStyle = buildStyleSuffix("older", "");
    const url = buildImageUrl("forest scene", artStyle);
    const decoded = decodeURIComponent(url.split("?")[0]);
    expect(decoded).toContain("forest scene");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/andrewbarlow/talehatch && bun test lib/imageRegen.test.ts
```

Expected: `buildImageUrl` tests fail with "buildImageUrl is not a function".

- [ ] **Step 3: Implement buildImageUrl in imageRegen.ts**

Add to the end of `lib/imageRegen.ts`:

```typescript
export function buildImageUrl(
  scenePrompt: string,
  artStyle: string,
  characterAnchor?: string
): string {
  const prefix = characterAnchor ? `${characterAnchor}. ` : "";
  const prompt = `${prefix}${scenePrompt}${artStyle}`;
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=512&model=turbo&seed=${seed}`;
}
```

Also add `buildImageUrl` to the existing imports in `lib/imageRegen.test.ts`:

```typescript
import { buildStyleSuffix, buildRegenPrompt, buildRegenUrl, buildImageUrl } from "./imageRegen";
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/andrewbarlow/talehatch && bun test lib/imageRegen.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Update buildRegenUrl to also accept character anchor**

The regen flow (user-triggered image regeneration) must also carry the character anchor. Update `buildRegenUrl` in `lib/imageRegen.ts`:

```typescript
export function buildRegenUrl(
  userText: string,
  originalPrompt: string,
  artStyle: string,
  characterAnchor?: string
): string {
  const prefix = characterAnchor ? `${characterAnchor}. ` : "";
  const prompt = buildRegenPrompt(userText, `${prefix}${originalPrompt}`, artStyle);
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=512&model=turbo&seed=${seed}`;
}
```

Existing `buildRegenUrl` tests still pass (characterAnchor is optional). In `app/page.tsx`, wherever `buildRegenUrl` is called, pass `state.characterDescription` as the fourth argument:

```typescript
buildRegenUrl(userText, originalPrompt, state.artStyle, state.characterDescription || undefined)
```

- [ ] **Step 6: Run all tests**

```bash
cd /Users/andrewbarlow/talehatch && bun test lib/imageRegen.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/imageRegen.ts lib/imageRegen.test.ts
git commit -m "feat: add buildImageUrl and update buildRegenUrl with optional character anchor prefix"
```

---

## Task 3: Create /api/hints endpoint (Tasks 2 and 1 moral hints)

**Files:**
- Create: `pages/api/hints.ts`

- [ ] **Step 1: Create the hints API route**

Create `pages/api/hints.ts`:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/andrewbarlow/talehatch && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Write tests for buildHintPrompt**

Create `lib/hints.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { buildHintPrompt } from "../pages/api/hints";

describe("buildHintPrompt", () => {
  it("includes the question in answer-type prompts", () => {
    const prompt = buildHintPrompt("answer", "What does Gus find?", "", [], [], []);
    expect(prompt).toContain("What does Gus find?");
  });

  it("includes entity names when provided", () => {
    const prompt = buildHintPrompt("answer", "What happens?", "", ["Gus", "Badger"], [], []);
    expect(prompt).toContain("Gus");
    expect(prompt).toContain("Badger");
  });

  it("includes prior chapter cliffhangers with recency context", () => {
    const history = [
      { chapterNumber: 1, title: "The Tunnel", cliffhanger: "Gus heard a rumble" },
      { chapterNumber: 2, title: "The River", cliffhanger: "The badger appeared" },
    ];
    const prompt = buildHintPrompt("answer", "What now?", "", [], history, []);
    expect(prompt).toContain("The badger appeared");
    expect(prompt).toContain("Gus heard a rumble");
  });

  it("moral type prompt does not include the question field", () => {
    const prompt = buildHintPrompt("moral", "", "Gus's story", ["Gus"], [], []);
    expect(prompt).not.toContain('The question is:');
    expect(prompt).toContain("moral");
  });

  it("includes previous answers in context", () => {
    const prompt = buildHintPrompt("answer", "Next step?", "", [], [], ["Gus ran fast", "He found a door"]);
    expect(prompt).toContain("Gus ran fast");
    expect(prompt).toContain("He found a door");
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/andrewbarlow/talehatch && bun test lib/hints.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add pages/api/hints.ts lib/hints.test.ts
git commit -m "feat: add /api/hints endpoint for contextual answer and moral suggestions"
```

---

## Task 4: Update generate.ts for recency-weighted chapter history (Task 5)

**Files:**
- Modify: `pages/api/generate.ts`

- [ ] **Step 1: Update buildSystemPrompt signature and add history section**

In `pages/api/generate.ts`, update `buildSystemPrompt` to accept `chapterHistory`:

```typescript
function buildSystemPrompt(
  chapterNumber: number,
  ageRange: AgeRange,
  previousCliffhanger?: string,
  chapterHistory?: Array<{ chapterNumber: number; title: string; cliffhanger: string }>
): string {
```

Replace the existing `chapterContext` block with this expanded version:

```typescript
  let chapterContext = "";
  if (chapterNumber > 1 && previousCliffhanger) {
    chapterContext = `\nThis is Chapter ${chapterNumber}. The previous chapter ended with:\n"${previousCliffhanger}"\nAsk questions that build on what came before and explore what happens next.\n`;
  }

  let historyContext = "";
  if (chapterHistory && chapterHistory.length > 1) {
    const sorted = [...chapterHistory].sort((a, b) => b.chapterNumber - a.chapterNumber);
    const lines = sorted.map((ch, i) => {
      const weight = i === 0 ? "MOST RECENT — prioritise callbacks to this" : `chapter ${ch.chapterNumber}`;
      return `• Chapter ${ch.chapterNumber} ("${ch.title}") [${weight}]: ${ch.cliffhanger}`;
    });
    historyContext = `\nCHAPTER HISTORY (most recent first — weight your questions toward the most recent events):\n${lines.join("\n")}\n`;
  }
```

Add `${historyContext}` into the system prompt string after `${chapterContext}`:

```typescript
  return `You are a creative story interviewer helping build a story for ${tier.readerDescription}.${chapterContext}${historyContext}
```

- [ ] **Step 2: Update handler to read chapterHistory from request body**

In the destructuring block inside `handler`, add:

```typescript
    chapterHistory = [],
```

And update the type annotation:

```typescript
    chapterHistory?: Array<{ chapterNumber: number; title: string; cliffhanger: string }>;
```

Pass it to `buildSystemPrompt`:

```typescript
      system: buildSystemPrompt(chapterNumber, ageRange, previousCliffhanger, chapterHistory),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/andrewbarlow/talehatch && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add pages/api/generate.ts
git commit -m "feat: add chapterHistory to generate.ts for recency-weighted Q&A prompts"
```

---

## Task 5: Update chapter.ts for final chapter + character anchor (Tasks 1 and 6)

**Files:**
- Modify: `pages/api/chapter.ts`

- [ ] **Step 1: Update buildSystemPrompt signature for final chapter**

Replace the existing `buildSystemPrompt` function signature:

```typescript
function buildSystemPrompt(
  chapterNumber: number,
  ageRange: AgeRange,
  previousCliffhanger?: string,
  isFinalChapter?: boolean,
  storyMoral?: string
): string {
```

- [ ] **Step 2: Add CHARACTER_DESCRIPTION to chapter 1 output format**

In `buildSystemPrompt`, update `genreSection`:

```typescript
  const genreSection = isFirstChapter
    ? `GENRE:\n[One word identifying the story genre. Choose the closest match: fantasy, sci-fi, mystery, adventure, cozy, historical, or other]\n\n`
    : "";

  const characterDescSection = isFirstChapter
    ? `CHARACTER_DESCRIPTION:\n[One sentence describing the main character's physical appearance, e.g. "Gus is a small brown gopher with round black eyes and dirt-stained paws."]\n\n`
    : "";
```

- [ ] **Step 3: Replace the cliffhanger rules section based on isFinalChapter**

Replace the hardcoded `CLIFFHANGER RULES` block with a conditional:

```typescript
  const endingRules = isFinalChapter
    ? `ENDING RULES (CRITICAL — this is the final chapter):
- The chapter MUST end with a satisfying resolution — the main conflict is resolved.
- Do NOT end on a cliffhanger. The story should feel complete.
- ${storyMoral ? `Weave this lesson naturally into the ending (do not state it as a moral — show it through the character's actions or realisation): "${storyMoral}"` : "End on a warm, earned moment of growth or triumph."}
- The final paragraph should leave the reader feeling satisfied, not wanting more.`
    : `CLIFFHANGER RULES (CRITICAL):
- The chapter MUST end on a genuine cliffhanger — a moment of threat, discovery, or impossible choice that makes stopping feel unbearable.
- The cliffhanger should feel earned by the events of the chapter, not dropped in from nowhere.
- It must leave one urgent question unanswered.`;
```

Replace the hardcoded cliffhanger rules string in the returned prompt template with `${endingRules}`.

- [ ] **Step 4: Update the return string to include new output sections**

Update the format section at the end of `buildSystemPrompt`:

```typescript
  return `You are writing Chapter ${chapterNumber} of a story for ${tier.readerDescription}.${continuationContext}

You have been given the child's answers to guided prompts. These answers contain ALL the raw material for the chapter. Transform them into a vivid, engaging chapter — roughly ${tier.chapterWords} words.

STYLE: ${ageGuidance[ageRange]}

RULES:
- Use ONLY the ideas the child provided. Do not invent major new characters, locations, or plot elements.
- You MAY add sensory detail, atmosphere, pacing, and emotional texture.
- Write in third person, past tense, as a real published book for young readers.
- Clear structure: beginning (establish the scene), middle (conflict escalates), end (resolution or cliffhanger).
- DO NOT use the word "suddenly." DO NOT use clichés.
- Write like a real author. Make it feel earned.

${endingRules}

Return your response in EXACTLY this format:

${genreSection}${characterDescSection}${storyTitleSection}TITLE:
[A short, evocative chapter title — not "Chapter ${chapterNumber}", just the title]

CHAPTER:
[The full chapter text — 1,200 to 1,500 words]

CLIFFHANGER:
${isFinalChapter ? "[Write: none]" : "[2–3 sentences summarising the exact cliffhanger moment — written so the next chapter can pick up from it precisely]"}

IMAGE_PROMPTS:
Write 3 to 5 image prompts — one for each distinct scene or visual moment in this chapter, in order. Number them. Each prompt should describe characters, setting, action, mood, lighting, and colour palette in under 80 words. Kid-friendly watercolour illustration style.

1. [Scene description]
2. [Scene description]
3. [Scene description]
(add more if the chapter has more distinct scenes, up to 5)`;
```

- [ ] **Step 5: Update handler to accept and pass new fields**

In the destructuring block inside `handler`, add:

```typescript
    isFinalChapter = false,
    storyMoral = "",
    characterDescription: incomingCharacterDescription = "",
```

Update the type annotation to include:
```typescript
    isFinalChapter?: boolean;
    storyMoral?: string;
    characterDescription?: string;
```

Pass to `buildSystemPrompt`:

```typescript
      system: buildSystemPrompt(chapterNumber, ageRange, previousCliffhanger, isFinalChapter, storyMoral),
```

- [ ] **Step 6: Parse CHARACTER_DESCRIPTION from chapter 1 response**

After the existing `storyTitle` parse block, add:

```typescript
    const characterDescMatch = chapterNumber === 1
      ? raw.match(/CHARACTER_DESCRIPTION:\s*([\s\S]*?)(?=STORY_TITLE:|TITLE:|$)/i)
      : null;
    const characterDescription = characterDescMatch
      ? characterDescMatch[1].trim()
      : incomingCharacterDescription;
```

- [ ] **Step 7: Use buildImageUrl with character anchor for all image prompts**

Add import at top of file:

```typescript
import { buildStyleSuffix, buildImageUrl } from "@/lib/imageRegen";
```

Replace the `imageUrls` construction block:

```typescript
    const imageUrls = imagePromptTexts.map((prompt) => {
      return buildImageUrl(prompt, artStyle, characterDescription || undefined);
    });
```

- [ ] **Step 8: Return characterDescription in response**

Update the return statement:

```typescript
    return res.status(200).json({
      chapterTitle, chapter, cliffhanger, imageUrls, imagePrompts: imagePromptTexts,
      storyTitle, artStyle, characterDescription,
    });
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd /Users/andrewbarlow/talehatch && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add pages/api/chapter.ts
git commit -m "feat: add final chapter mode, character description output, and character-anchored image prompts"
```

---

## Task 6: Create useKeyboardScroll hook (Task 4)

**Files:**
- Create: `lib/useKeyboardScroll.ts`

- [ ] **Step 1: Create the hook**

Create `lib/useKeyboardScroll.ts`:

```typescript
import { useEffect } from "react";

export function useKeyboardScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    function scrollFocusedIntoView() {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }

    vv.addEventListener("resize", scrollFocusedIntoView);
    document.addEventListener("focusin", scrollFocusedIntoView);

    return () => {
      vv.removeEventListener("resize", scrollFocusedIntoView);
      document.removeEventListener("focusin", scrollFocusedIntoView);
    };
  }, []);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/andrewbarlow/talehatch && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Add scroll-padding-bottom to dynamically track keyboard height**

In `lib/useKeyboardScroll.ts`, update the `scrollFocusedIntoView` function to also set `scroll-padding-bottom` on `document.documentElement`:

```typescript
export function useKeyboardScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    function scrollFocusedIntoView() {
      const keyboardHeight = Math.max(0, window.innerHeight - (vv?.height ?? window.innerHeight));
      document.documentElement.style.setProperty("--keyboard-height", `${keyboardHeight}px`);
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }

    vv.addEventListener("resize", scrollFocusedIntoView);
    document.addEventListener("focusin", scrollFocusedIntoView);

    return () => {
      vv.removeEventListener("resize", scrollFocusedIntoView);
      document.removeEventListener("focusin", scrollFocusedIntoView);
    };
  }, []);
}
```

Then in `app/globals.css` (or the root layout), add:

```css
html {
  scroll-padding-bottom: var(--keyboard-height, 0px);
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/andrewbarlow/talehatch && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/useKeyboardScroll.ts app/globals.css
git commit -m "feat: add useKeyboardScroll hook for mobile keyboard visibility"
```

---

## Task 7: Create QAPrompt component (Tasks 1, 2, 3)

**Files:**
- Create: `components/QAPrompt.tsx`

- [ ] **Step 1: Create the component**

Create `components/QAPrompt.tsx`:

```typescript
"use client";

import { useState } from "react";

interface QAPromptProps {
  prompt: string;
  chapterNumber: number;
  questionIndex: number; // 0-based — final chapter option shown only when this is 0
  onSubmit: (answer: string) => void;
  onSkip: () => void;
  onRephrase: () => Promise<string>;
  onFetchHints: () => Promise<string[]>;
  // Final chapter (shown on Q0 of chapter 2+)
  isFinalChapter: boolean;
  storyMoral: string;
  onFinalChapterChange: (isFinal: boolean) => void;
  onMoralChange: (moral: string) => void;
  onFetchMoralHints: () => Promise<string[]>;
  isLoading?: boolean;
}

export default function QAPrompt({
  prompt,
  chapterNumber,
  questionIndex,
  onSubmit,
  onSkip,
  onRephrase,
  onFetchHints,
  isFinalChapter,
  storyMoral,
  onFinalChapterChange,
  onMoralChange,
  onFetchMoralHints,
  isLoading = false,
}: QAPromptProps) {
  const [answer, setAnswer] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [hintsLoading, setHintsLoading] = useState(false);
  const [moralHints, setMoralHints] = useState<string[]>([]);
  const [moralHintsOpen, setMoralHintsOpen] = useState(false);
  const [moralHintsLoading, setMoralHintsLoading] = useState(false);
  const [rephraseUsed, setRephraseUsed] = useState(false);
  const [rephraseLoading, setRephraseLoading] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState(prompt);
  const [moralSaved, setMoralSaved] = useState(false);

  const showFinalChapterOption = chapterNumber >= 2 && questionIndex === 0;

  async function handleToggleHints() {
    if (hintsOpen) {
      setHintsOpen(false);
      return;
    }
    if (hints.length > 0) {
      setHintsOpen(true);
      return;
    }
    setHintsLoading(true);
    const result = await onFetchHints();
    setHints(result);
    setHintsLoading(false);
    setHintsOpen(true);
  }

  async function handleToggleMoralHints() {
    if (moralHintsOpen) {
      setMoralHintsOpen(false);
      return;
    }
    if (moralHints.length > 0) {
      setMoralHintsOpen(true);
      return;
    }
    setMoralHintsLoading(true);
    const result = await onFetchMoralHints();
    setMoralHints(result);
    setMoralHintsLoading(false);
    setMoralHintsOpen(true);
  }

  async function handleRephrase() {
    if (rephraseUsed || rephraseLoading) return;
    setRephraseLoading(true);
    const newPrompt = await onRephrase();
    setCurrentPrompt(newPrompt);
    setRephraseUsed(true);
    setRephraseLoading(false);
    // Reset hints since the question changed
    setHints([]);
    setHintsOpen(false);
  }

  function handleSubmit() {
    if (!answer.trim() || isLoading) return;
    onSubmit(answer.trim());
    setAnswer("");
    setHints([]);
    setHintsOpen(false);
  }

  function handleFinalChapterToggle(checked: boolean) {
    onFinalChapterChange(checked);
    if (!checked) {
      onMoralChange("");
      setMoralSaved(false);
      setMoralHints([]);
      setMoralHintsOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Prompt + rephrase icon */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-base leading-relaxed flex-1">{currentPrompt}</p>
        <button
          onClick={handleRephrase}
          disabled={rephraseUsed || rephraseLoading}
          title="Ask this differently"
          className={`text-xl transition-opacity ${rephraseUsed ? "opacity-30 cursor-not-allowed" : "opacity-60 hover:opacity-100"}`}
        >
          {rephraseLoading ? "⏳" : "🔄"}
        </button>
      </div>

      {/* Answer input */}
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Type your answer..."
        rows={3}
        className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm resize-none focus:outline-none focus:border-white/40"
      />

      {/* Need ideas */}
      <div>
        <button
          onClick={handleToggleHints}
          className="text-sm text-purple-400 hover:text-purple-300"
        >
          {hintsLoading ? "Loading ideas..." : hintsOpen ? "▾ Need ideas?" : "▸ Need ideas?"}
        </button>
        {hintsOpen && hints.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {hints.map((hint, i) => (
              <button
                key={i}
                onClick={() => setAnswer(hint)}
                className="text-left text-sm rounded-lg border border-white/20 bg-white/5 px-3 py-2 hover:bg-white/10 transition"
              >
                {hint}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Submit + skip */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSkip}
          className="text-sm text-white/40 hover:text-white/60 underline"
        >
          skip
        </button>
        <button
          onClick={handleSubmit}
          disabled={!answer.trim() || isLoading}
          className="flex-1 rounded-xl bg-purple-600 py-3 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-40 transition"
        >
          Submit →
        </button>
      </div>

      {/* Final chapter option — only Q0 of chapter 2+ */}
      {showFinalChapterOption && (
        <div className="border-t border-white/10 pt-3 flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFinalChapter}
              onChange={(e) => handleFinalChapterToggle(e.target.checked)}
              className="accent-purple-500"
            />
            <span className="text-sm text-white/60">Make this the final chapter</span>
          </label>

          {isFinalChapter && (
            <div className="rounded-xl border border-purple-500/40 bg-purple-900/20 p-4 flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-purple-400">Final Chapter</p>
              <p className="text-sm leading-relaxed">What lesson or message should this story leave with your reader?</p>
              <textarea
                value={storyMoral}
                onChange={(e) => { onMoralChange(e.target.value); setMoralSaved(false); }}
                placeholder='e.g. "Being brave means helping others even when it\'s scary"'
                rows={2}
                className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm resize-none focus:outline-none focus:border-purple-400"
              />

              {/* Moral hints */}
              <div>
                <button
                  onClick={handleToggleMoralHints}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  {moralHintsLoading ? "Loading ideas..." : moralHintsOpen ? "▾ Need ideas?" : "▸ Need ideas?"}
                </button>
                {moralHintsOpen && moralHints.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2">
                    {moralHints.map((hint, i) => (
                      <button
                        key={i}
                        onClick={() => { onMoralChange(hint); setMoralSaved(false); }}
                        className="text-left text-sm rounded-lg border border-white/20 bg-white/5 px-3 py-2 hover:bg-white/10 transition"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setMoralSaved(true)}
                  disabled={!storyMoral.trim()}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-500 disabled:opacity-40 transition"
                >
                  {moralSaved ? "✓ Saved" : "Save →"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/andrewbarlow/talehatch && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/QAPrompt.tsx
git commit -m "feat: add QAPrompt component with skip, rephrase, need ideas, and final chapter checkbox"
```

---

## Task 8: Wire everything into app/page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add new fields to AppState and INITIAL_STATE**

In the `AppState` interface, add after `ageRange`:

```typescript
  isFinalChapter: boolean;
  storyMoral: string;
  characterDescription: string;
```

In `INITIAL_STATE`, add matching defaults after `ageRange: "older"`:

```typescript
  isFinalChapter: false,
  storyMoral: "",
  characterDescription: "",
```

- [ ] **Step 2: Add new fields to serializeState**

In `serializeState`, add after `ageRange: state.ageRange`:

```typescript
    isFinalChapter: state.isFinalChapter,
    storyMoral: state.storyMoral,
    characterDescription: state.characterDescription,
```

- [ ] **Step 3: Add new fields to deserializeState (resume flow)**

Find where state is restored from DB (look for `resumeState` or similar). Add the three new fields wherever the saved state is spread back into AppState:

```typescript
isFinalChapter: (saved.isFinalChapter as boolean) ?? false,
storyMoral: (saved.storyMoral as string) ?? "",
characterDescription: (saved.characterDescription as string) ?? "",
```

- [ ] **Step 4: Add imports**

At the top of `app/page.tsx`, add:

```typescript
import QAPrompt from "@/components/QAPrompt";
import { useKeyboardScroll } from "@/lib/useKeyboardScroll";
import { fetchHints } from "@/lib/storyBuilder";
import type { ChapterHistoryEntry } from "@/lib/storyBuilder";
```

- [ ] **Step 5: Activate keyboard scroll hook**

Inside the `Home` component function, near the other hooks at the top:

```typescript
useKeyboardScroll();
```

- [ ] **Step 6: Pass chapterHistory to generateStorySegment**

Find the call to `generateStorySegment` in the guided Q&A flow. Add `chapterHistory`:

```typescript
const chapterHistory: ChapterHistoryEntry[] = state.savedChapters.map((ch) => ({
  chapterNumber: ch.chapterNumber,
  title: ch.title,
  cliffhanger: ch.cliffhanger,
}));

generateStorySegment({
  // ...existing fields...
  chapterHistory,
})
```

- [ ] **Step 7: Pass isFinalChapter, storyMoral, characterDescription to generateChapter**

Find the `generateChapter` call (inside the `building` mode effect). Add:

```typescript
generateChapter({
  // ...existing fields...
  isFinalChapter: state.isFinalChapter,
  storyMoral: state.storyMoral,
  characterDescription: state.characterDescription,
})
```

- [ ] **Step 8: Store characterDescription returned from chapter 1**

In the `.then((result) => ...)` callback after `generateChapter`, where `setState` is called with the new chapter data, add:

```typescript
characterDescription: result.characterDescription ?? s.characterDescription,
```

- [ ] **Step 9: Replace inline Q&A prompt UI with QAPrompt component**

Find where the guided Q&A prompt, answer input, and submit button are rendered in the JSX (look for `currentPrompt` and `InputBar`/answer input). Replace the entire prompt+input+submit block with:

```tsx
<QAPrompt
  prompt={currentPrompt}
  chapterNumber={state.chapterNumber}
  questionIndex={state.step}
  onSubmit={(answer) => handleAnswer(answer)}
  onSkip={() => handleSkip()}
  onRephrase={async () => {
    const res = await generateStorySegment({
      story: state.story,
      input: "__rephrase__",
      entities: state.entities,
      mode: "guided",
      step: state.step,
      coveredElements: state.coveredElements,
      questionCount: state.step,
      chapterNumber: state.chapterNumber,
      previousCliffhanger: state.cliffhanger,
      conversationHistory: state.promptHistory.map((p, i) => ({
        prompt: p,
        answer: state.inputs[i] ?? "",
      })),
      ageRange: state.ageRange,
      chapterHistory,
    });
    return res.nextPrompt ?? currentPrompt;
  }}
  onFetchHints={async () => {
    const res = await fetchHints({
      type: "answer",
      question: currentPrompt,
      story: state.story,
      entities: state.entities,
      chapterHistory,
      previousAnswers: state.inputs,
    });
    return res.hints;
  }}
  isFinalChapter={state.isFinalChapter}
  storyMoral={state.storyMoral}
  onFinalChapterChange={(val) => setState((s) => ({ ...s, isFinalChapter: val, storyMoral: val ? s.storyMoral : "" }))}
  onMoralChange={(val) => setState((s) => ({ ...s, storyMoral: val }))}
  onFetchMoralHints={async () => {
    const res = await fetchHints({
      type: "moral",
      question: "",
      story: state.story,
      entities: state.entities,
      chapterHistory,
    });
    return res.hints;
  }}
  isLoading={isLoading}
/>
```

- [ ] **Step 10: Add handleSkip function**

Add a `handleSkip` function near the other handlers in `Home`:

```typescript
function handleSkip() {
  // Advance to next prompt without recording an answer
  setState((s) => ({ ...s, step: s.step + 1, inputs: [...s.inputs, ""] }));
  // Fetch next prompt with empty answer
  setCurrentPrompt("...");
  generateStorySegment({
    story: state.story,
    input: "__skip__",
    entities: state.entities,
    mode: "guided",
    step: state.step + 1,
    coveredElements: state.coveredElements,
    questionCount: state.step + 1,
    chapterNumber: state.chapterNumber,
    previousCliffhanger: state.cliffhanger,
    conversationHistory: state.promptHistory.map((p, i) => ({
      prompt: p,
      answer: state.inputs[i] ?? "",
    })),
    ageRange: state.ageRange,
    chapterHistory: state.savedChapters.map((ch) => ({
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      cliffhanger: ch.cliffhanger,
    })),
  }).then((res) => {
    if (res.nextPrompt) setCurrentPrompt(res.nextPrompt);
    if (res.readyToWrite) setState((s) => ({ ...s, mode: "building" }));
  });
}
```

- [ ] **Step 11: Reset isFinalChapter and storyMoral when starting a new chapter**

Find where `state.mode` is reset to `"guided"` to start the next chapter. Ensure it also resets:

```typescript
isFinalChapter: false,
storyMoral: "",
```

- [ ] **Step 12: Verify TypeScript compiles**

```bash
cd /Users/andrewbarlow/talehatch && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 13: Run all tests**

```bash
cd /Users/andrewbarlow/talehatch && bun test
```

Expected: all tests pass.

- [ ] **Step 14: Start dev server and manually verify the golden path**

```bash
cd /Users/andrewbarlow/talehatch && bun dev
```

Open http://localhost:3000 and verify:
1. **Q&A flow** — new prompt has 🔄 icon, "Need ideas?" link, and skip link
2. **Skip** — advances to next question without an answer
3. **Rephrase** — 🔄 changes the question text; greys out after one use
4. **Need ideas?** — expands with 3 AI-generated suggestions; tapping fills the input
5. **Final chapter checkbox** — appears on Q0 of chapter 2+, expands moral card when checked
6. **Moral hints** — "Need ideas?" inside moral card shows 3 story-specific moral suggestions
7. **Mobile** — focus an input on a phone/iPad and confirm it scrolls above keyboard

- [ ] **Step 15: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire QAPrompt component, keyboard scroll, chapter history, final chapter, and character anchor into page.tsx"
```

---

## Task 9: Push to GitHub

- [ ] **Step 1: Verify clean state**

```bash
cd /Users/andrewbarlow/talehatch && git status
```

Expected: clean working tree (or only untracked files like CC-Session-Logs/).

- [ ] **Step 2: Push**

```bash
cd /Users/andrewbarlow/talehatch && git push origin main
```

Expected: all commits pushed to `abarlowguy/talehatch`.
