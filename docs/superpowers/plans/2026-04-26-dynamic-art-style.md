# Dynamic Art Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every story's illustrations look visually distinct by combining the reader's age range with a genre tag Claude detects from the story — replacing the single hardcoded watercolour style suffix.

**Architecture:** `buildStyleSuffix(ageRange, genre)` in `lib/imageRegen.ts` computes the full Pollinations style string from two inputs. The chapter 1 API detects genre, builds the style string, and returns it as `artStyle`. The client stores `artStyle` in `AppState` and passes it back to subsequent chapters and to `buildRegenUrl` for custom-prompt regen. The random regen (seed swap) already bakes the style into the URL, so it requires no change.

**Tech Stack:** TypeScript, Next.js API routes (Pages Router), React, Pollinations AI image generation, Bun test runner (`bun:test`)

---

## File Map

| File | Change |
|------|--------|
| `lib/imageRegen.ts` | Replace `STYLE_SUFFIX` constant with `buildStyleSuffix(ageRange, genre)` + age/genre maps; update `buildRegenPrompt`/`buildRegenUrl` to accept `artStyle` string |
| `lib/imageRegen.test.ts` | Update existing tests for new signatures; add `buildStyleSuffix` tests |
| `lib/storyBuilder.ts` | Add `artStyle?: string` to `ChapterResponse`, `ChapterRecord`, `ChapterRequest` |
| `pages/api/chapter.ts` | Add `GENRE:` field to chapter-1 system prompt format; accept `artStyle` in body; build/return `artStyle`; use it for image URLs |
| `app/page.tsx` | Add `artStyle` to `AppState`, `INITIAL_STATE`, `serializeState`, `handlePickerResume`, chapter callback, `handleStartNextChapter`; pass to `ChapterBody` and `describeRegen` |

---

### Task 1: Replace STYLE_SUFFIX with buildStyleSuffix in lib/imageRegen.ts

**Files:**
- Modify: `lib/imageRegen.ts` (full rewrite)
- Modify: `lib/imageRegen.test.ts`

- [ ] **Step 1: Write the failing tests first**

Replace the contents of `lib/imageRegen.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { buildStyleSuffix, buildRegenPrompt, buildRegenUrl } from "./imageRegen";

describe("buildStyleSuffix", () => {
  it("returns a string containing age-range style for tiny", () => {
    const result = buildStyleSuffix("tiny", "");
    expect(result).toContain("pastel");
    expect(result).toContain("highly detailed");
  });

  it("returns a string containing age-range style for older", () => {
    const result = buildStyleSuffix("older", "");
    expect(result).toContain("graphite");
    expect(result).toContain("highly detailed");
  });

  it("appends genre modifier when genre is recognised", () => {
    const result = buildStyleSuffix("middle", "fantasy");
    expect(result).toContain("enchanted");
  });

  it("omits genre modifier for unrecognised genre", () => {
    const withUnknown = buildStyleSuffix("middle", "vampires");
    const withEmpty = buildStyleSuffix("middle", "");
    expect(withUnknown).toBe(withEmpty);
  });

  it("is case-insensitive for genre", () => {
    expect(buildStyleSuffix("older", "Fantasy")).toBe(buildStyleSuffix("older", "fantasy"));
  });
});

describe("buildRegenPrompt", () => {
  it("places user text before the original prompt", () => {
    const artStyle = buildStyleSuffix("older", "fantasy");
    const result = buildRegenPrompt("make it rainy", "Zara stands in a cave, warm glow", artStyle);
    expect(result).toMatch(/^make it rainy — Zara stands in a cave, warm glow/);
  });

  it("appends the artStyle suffix", () => {
    const artStyle = buildStyleSuffix("older", "fantasy");
    const result = buildRegenPrompt("darker", "forest scene", artStyle);
    expect(result).toContain(artStyle);
  });

  it("handles empty user text by using only original prompt + artStyle", () => {
    const artStyle = buildStyleSuffix("older", "");
    const result = buildRegenPrompt("", "original scene", artStyle);
    expect(result).toMatch(/^original scene/);
    expect(result).toContain("graphite");
  });
});

describe("buildRegenUrl", () => {
  it("returns a Pollinations URL", () => {
    const artStyle = buildStyleSuffix("older", "");
    const url = buildRegenUrl("make it rainy", "Zara stands in a cave", artStyle);
    expect(url).toMatch(/^https:\/\/image\.pollinations\.ai\/prompt\//);
  });

  it("includes width, height, model, and seed params", () => {
    const artStyle = buildStyleSuffix("older", "");
    const url = buildRegenUrl("darker", "forest", artStyle);
    expect(url).toContain("width=768");
    expect(url).toContain("height=512");
    expect(url).toContain("model=turbo");
    expect(url).toMatch(/seed=\d+/);
  });

  it("percent-encodes spaces in the prompt path", () => {
    const artStyle = buildStyleSuffix("older", "");
    const url = buildRegenUrl("make it rainy", "Zara's cave", artStyle);
    const path = url.split("?")[0];
    expect(path).not.toContain(" ");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/andrewbarlow/talehatch && bun test lib/imageRegen.test.ts 2>&1 | tail -20
```

Expected: failures mentioning `buildStyleSuffix` not exported.

- [ ] **Step 3: Rewrite lib/imageRegen.ts**

```ts
import type { AgeRange } from "@/lib/prompts";

const AGE_BASE_STYLE: Record<AgeRange, string> = {
  tiny: "soft pastel picture book illustration, rounded shapes, gentle watercolour wash, warm and cozy",
  young: "bright gouache illustration, bold outlines, flat colour, lively children's adventure book",
  middle: "detailed ink and watercolour, dynamic composition, middle-grade adventure illustration",
  older: "dramatic graphite and ink, detailed crosshatching, cinematic lighting, young adult novel illustration",
};

const GENRE_STYLE_MODIFIER: Record<string, string> = {
  fantasy: "enchanted magical world, glowing runes, ethereal mist",
  "sci-fi": "sleek metallic surfaces, neon accents, futuristic technology",
  mystery: "moody shadows, candlelit atmosphere, noir-inspired palette",
  adventure: "lush natural environments, dynamic action, golden hour lighting",
  cozy: "warm hearth light, soft textures, intimate homey atmosphere",
  historical: "period-accurate details, aged parchment tones, classical composition",
};

export function buildStyleSuffix(ageRange: AgeRange, genre: string): string {
  const base = AGE_BASE_STYLE[ageRange] ?? AGE_BASE_STYLE.older;
  const modifier = GENRE_STYLE_MODIFIER[genre.toLowerCase()] ?? "";
  return modifier
    ? `, ${base}, ${modifier}, highly detailed`
    : `, ${base}, highly detailed`;
}

export function buildRegenPrompt(userText: string, originalPrompt: string, artStyle: string): string {
  const prefix = userText.trim() ? `${userText.trim()} — ` : "";
  return `${prefix}${originalPrompt}${artStyle}`;
}

export function buildRegenUrl(userText: string, originalPrompt: string, artStyle: string): string {
  const prompt = buildRegenPrompt(userText, originalPrompt, artStyle);
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=512&model=turbo&seed=${seed}`;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/andrewbarlow/talehatch && bun test lib/imageRegen.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/andrewbarlow/talehatch
git add lib/imageRegen.ts lib/imageRegen.test.ts
git commit -m "feat: replace STYLE_SUFFIX with buildStyleSuffix(ageRange, genre)"
```

---

### Task 2: Update shared types in lib/storyBuilder.ts

**Files:**
- Modify: `lib/storyBuilder.ts`

- [ ] **Step 1: Add artStyle to ChapterRequest**

In `lib/storyBuilder.ts`, find `ChapterRequest` (around line 23) and add `artStyle?: string`:

```ts
export interface ChapterRequest {
  inputs: string[];
  story: string;
  entities: string[];
  chapterNumber?: number;
  previousCliffhanger?: string;
  ageRange?: string;
  artStyle?: string;
}
```

- [ ] **Step 2: Add artStyle to ChapterResponse**

Find `ChapterResponse` (around line 15) and add `artStyle?: string`:

```ts
export interface ChapterResponse {
  chapterTitle: string;
  chapter: string;
  cliffhanger: string;
  imageUrls: string[];
  imagePrompts: string[];
  storyTitle?: string;
  artStyle?: string;
  error?: string;
}
```

- [ ] **Step 3: Add artStyle to ChapterRecord**

Find `ChapterRecord` (around line 53) and add `artStyle?: string`:

```ts
export interface ChapterRecord {
  chapterNumber: number;
  title: string;
  chapter: string;
  imageUrls: string[];
  imagePrompts: string[];
  cliffhanger: string;
  artStyle?: string;
}
```

- [ ] **Step 4: Update generateChapter error fallback**

Find the error fallback in `generateChapter` (around line 81) and add `artStyle: undefined`:

```ts
export async function generateChapter(req: ChapterRequest): Promise<ChapterResponse> {
  const res = await fetch("/api/chapter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    return { chapterTitle: "", chapter: "", cliffhanger: "", imageUrls: [], imagePrompts: [], artStyle: undefined, error: "Could not generate chapter. Try again." };
  }
  return res.json();
}
```

- [ ] **Step 5: Check TypeScript**

```bash
cd /Users/andrewbarlow/talehatch && npx tsc --noEmit 2>&1 | grep -v "bun:test"
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 6: Commit**

```bash
cd /Users/andrewbarlow/talehatch
git add lib/storyBuilder.ts
git commit -m "feat: add artStyle to ChapterRequest, ChapterResponse, and ChapterRecord"
```

---

### Task 3: Update pages/api/chapter.ts to detect genre and return artStyle

**Files:**
- Modify: `pages/api/chapter.ts`

This is the core of the feature. For chapter 1, Claude is asked to tag the genre. The API builds `artStyle` from `buildStyleSuffix(ageRange, genre)` and uses it for image URLs. For chapter 2+, the client sends its stored `artStyle` which is used directly.

- [ ] **Step 1: Update imports at the top of chapter.ts**

Replace:
```ts
import { STYLE_SUFFIX } from "@/lib/imageRegen";
```
With:
```ts
import { buildStyleSuffix } from "@/lib/imageRegen";
import type { AgeRange } from "@/lib/prompts";
```

(Note: `AgeRange` is already imported — remove the duplicate if present. Keep only one `import type { AgeRange } from "@/lib/prompts"` line.)

- [ ] **Step 2: Add GENRE section to buildSystemPrompt**

In `buildSystemPrompt`, find `storyTitleSection` (around line 21) and add a `genreSection` directly below it:

```ts
const genreSection = isFirstChapter
  ? `GENRE:\n[One word identifying the story genre. Choose the closest match: fantasy, sci-fi, mystery, adventure, cozy, historical, or other]\n\n`
  : "";
```

Then in the return string at the bottom of `buildSystemPrompt`, prepend `genreSection` before `storyTitleSection`:

```ts
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
Write 3 to 5 image prompts — one for each distinct scene or visual moment in this chapter, in order. Number them. Each prompt should describe characters, setting, action, mood, lighting, and colour palette in under 80 words. Kid-friendly illustration style.

1. [Scene description]
2. [Scene description]
3. [Scene description]
(add more if the chapter has more distinct scenes, up to 5)`;
```

- [ ] **Step 3: Update the handler to accept artStyle and parse genre**

In the handler function, update the destructuring of `req.body` to include `artStyle`:

```ts
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
```

- [ ] **Step 4: Parse genre and build artStyle after Claude responds**

In the try block, after extracting `raw`, add genre parsing and artStyle construction. Find where `storyTitleMatch` is parsed (around line 118) and add genre parsing alongside it:

```ts
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
```

- [ ] **Step 5: Use artStyle for image URL construction**

Find the image URL construction block (around line 142):

```ts
// BEFORE:
const imageUrls = imagePromptTexts.map((prompt) => {
  const styled = `${prompt}${STYLE_SUFFIX}`;
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(styled)}?width=768&height=512&model=turbo&seed=${seed}`;
});
```

Replace with:

```ts
// AFTER:
const imageUrls = imagePromptTexts.map((prompt) => {
  const styled = `${prompt}${artStyle}`;
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(styled)}?width=768&height=512&model=turbo&seed=${seed}`;
});
```

- [ ] **Step 6: Return artStyle in the response**

Find the final `return res.status(200).json(...)` line and add `artStyle`:

```ts
return res.status(200).json({
  chapterTitle, chapter, cliffhanger, imageUrls,
  imagePrompts: imagePromptTexts, storyTitle, artStyle,
});
```

- [ ] **Step 7: Check TypeScript**

```bash
cd /Users/andrewbarlow/talehatch && npx tsc --noEmit 2>&1 | grep -v "bun:test"
```

Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/andrewbarlow/talehatch
git add pages/api/chapter.ts
git commit -m "feat: detect story genre in chapter 1 and return dynamic artStyle for image generation"
```

---

### Task 4: Wire artStyle through app/page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add artStyle to AppState interface**

Find the `AppState` interface (around line 32). Add `artStyle: string` after `imagePrompts`:

```ts
interface AppState {
  chapterNumber: number;
  mode: Mode;
  step: number;
  inputs: string[];
  promptHistory: string[];
  story: string;
  entities: string[];
  coveredElements: string[];
  chapterTitle: string;
  chapter: string;
  cliffhanger: string;
  imageUrls: string[];
  imagePrompts: string[];
  artStyle: string;
  storyTitle: string;
  author: string;
  savedChapters: ChapterRecord[];
  storyId: string | null;
  userEmail: string | null;
  ageRange: AgeRange;
}
```

- [ ] **Step 2: Add artStyle to INITIAL_STATE**

Find `INITIAL_STATE` (around line 57). Add `artStyle: ""`:

```ts
const INITIAL_STATE: AppState = {
  chapterNumber: 1,
  mode: "guided",
  step: 0,
  inputs: [],
  promptHistory: [],
  story: "",
  entities: [],
  coveredElements: [],
  chapterTitle: "",
  chapter: "",
  cliffhanger: "",
  imageUrls: [],
  imagePrompts: [],
  artStyle: "",
  storyTitle: "",
  author: "",
  savedChapters: [],
  storyId: null,
  userEmail: null,
  ageRange: "older",
};
```

- [ ] **Step 3: Add artStyle to serializeState**

Find `serializeState` (around line 96). Add `artStyle: state.artStyle` to the returned object:

```ts
function serializeState(state: AppState): Record<string, unknown> {
  return {
    chapterNumber: state.chapterNumber,
    mode: state.mode,
    step: state.step,
    inputs: state.inputs,
    promptHistory: state.promptHistory,
    story: state.story,
    entities: state.entities,
    coveredElements: state.coveredElements,
    chapterTitle: state.chapterTitle,
    chapter: state.chapter,
    cliffhanger: state.cliffhanger,
    imageUrls: state.imageUrls,
    imagePrompts: state.imagePrompts,
    artStyle: state.artStyle,
    storyTitle: state.storyTitle,
    author: state.author,
    savedChapters: state.savedChapters,
    storyId: state.storyId,
    userEmail: state.userEmail,
    ageRange: state.ageRange,
  };
}
```

- [ ] **Step 4: Restore artStyle in handlePickerResume**

Find `handlePickerResume` (around line 264). Add `artStyle` to the `restored` object, just after `imagePrompts`:

```ts
imagePrompts: (savedState.imagePrompts as string[]) ?? [],
artStyle: (savedState.artStyle as string) ?? "",
```

- [ ] **Step 5: Capture artStyle in the chapter generation callback**

Find the `generateChapter(...).then((result) => {` callback (around line 186). In the `setState` call inside, add `artStyle` to the `next` object:

```ts
const next: AppState = {
  ...s,
  mode: "chapter",
  storyTitle: result.storyTitle ?? s.storyTitle,
  chapterTitle: result.chapterTitle,
  chapter: result.chapter,
  cliffhanger: result.cliffhanger,
  imageUrls: result.imageUrls ?? [],
  imagePrompts: result.imagePrompts ?? [],
  artStyle: result.artStyle ?? s.artStyle,
};
```

- [ ] **Step 6: Pass artStyle to generateChapter call**

Find the `generateChapter({` call (around line 179). Add `artStyle: state.artStyle`:

```ts
generateChapter({
  inputs: state.inputs,
  story: state.story,
  entities: state.entities,
  chapterNumber: state.chapterNumber,
  previousCliffhanger,
  ageRange: state.ageRange,
  artStyle: state.artStyle,
}).then((result) => {
```

- [ ] **Step 7: Carry artStyle through handleStartNextChapter**

Find `handleStartNextChapter` (around line 412). In the `setState` callback, add `artStyle: s.artStyle` and `ageRange: s.ageRange` (ageRange is currently being reset to the INITIAL_STATE default — fix both here):

```ts
setState((s) => ({
  ...INITIAL_STATE,
  chapterNumber: s.chapterNumber + 1,
  author: s.author,
  entities: s.entities,
  savedChapters: [...s.savedChapters, saved],
  storyId: s.storyId,
  userEmail: s.userEmail,
  ageRange: s.ageRange,
  artStyle: s.artStyle,
}));
```

- [ ] **Step 8: Add artStyle prop to ChapterBody component definition**

Find the `ChapterBody` function definition (around line 833). Add `artStyle` to props:

```ts
function ChapterBody({
  chapter,
  imageUrls,
  regenPrompts,
  artStyle,
  onImageChange,
}: {
  chapter: string;
  imageUrls: string[];
  regenPrompts: string[];
  artStyle: string;
  onImageChange: (slotIdx: number, newUrl: string) => void;
}) {
```

- [ ] **Step 9: Use artStyle in describeRegen**

Find `describeRegen` (around line 874). Update the `buildRegenUrl` call:

```ts
function describeRegen(i: number) {
  if (!promptText.trim()) return;
  const newUrl = buildRegenUrl(promptText.trim(), regenPrompts[i] ?? "", artStyle);
  setUrls((prev) => { const n = [...prev]; n[i] = newUrl; return n; });
  setBlobUrls((prev) => { const n = [...prev]; n[i] = null; return n; });
  setSlots((prev) => { const n = [...prev]; n[i] = "loading"; return n; });
  onImageChange(i, newUrl);
  setOpenPromptIdx(null);
  setPromptText("");
}
```

- [ ] **Step 10: Pass artStyle when rendering ChapterBody**

Find the `<ChapterBody` JSX (around line 589). Add `artStyle={state.artStyle}`:

```tsx
<ChapterBody
  key={currentIdx}
  chapter={displayText}
  imageUrls={displayImageUrls}
  regenPrompts={displayImagePrompts}
  artStyle={state.artStyle}
  onImageChange={(slotIdx, newUrl) => {
    // ... existing handler unchanged
  }}
/>
```

- [ ] **Step 11: Check TypeScript**

```bash
cd /Users/andrewbarlow/talehatch && npx tsc --noEmit 2>&1 | grep -v "bun:test"
```

Expected: no errors.

- [ ] **Step 12: Run tests**

```bash
cd /Users/andrewbarlow/talehatch && bun test lib/imageRegen.test.ts
```

Expected: all tests pass.

- [ ] **Step 13: Commit**

```bash
cd /Users/andrewbarlow/talehatch
git add app/page.tsx
git commit -m "feat: wire artStyle through AppState, ChapterBody, and chapter generation flow"
```

---

## Self-Review

**Spec coverage:**
- ✅ Age range drives baseline style (`AGE_BASE_STYLE` map in Task 1)
- ✅ Genre detected by Claude at chapter 1 (`GENRE:` section in Task 3)
- ✅ Genre maps to style modifier (`GENRE_STYLE_MODIFIER` map in Task 1)
- ✅ Style locked at chapter 1, passed back for chapter 2+ (Task 3 + Task 4 Step 6)
- ✅ Custom prompt regen uses artStyle (Task 4 Step 9)
- ✅ Random regen (seed swap) unaffected — already bakes style into URL
- ✅ artStyle persisted in saved state and restored on resume

**Type consistency:**
- `buildStyleSuffix(ageRange: AgeRange, genre: string): string` — used consistently across all tasks
- `buildRegenPrompt(userText, originalPrompt, artStyle)` — 3-param signature consistent between implementation and tests
- `buildRegenUrl(userText, originalPrompt, artStyle)` — same
- `artStyle: string` in `AppState` — matches `artStyle?: string` in `ChapterResponse` (nullish coalesce on capture)
