# Image Regeneration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-illustration regeneration with custom prompt to Talehatch story chapters, working on all chapters (current and past).

**Architecture:** Store raw Claude image prompts alongside Pollinations URLs in state and ChapterRecord. A new `lib/imageRegen.ts` utility builds the blended Pollinations URL client-side (no API call). ChapterBody gains two always-visible buttons — random re-roll and describe-it — plus a prompt bar below the image. Changes write back to AppState via an `onImageChange` callback, triggering autoSave.

**Tech Stack:** Next.js 16 (App Router), TypeScript, React, Bun (test runner), Pollinations AI

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/storyBuilder.ts` | Modify | Add `imagePrompts: string[]` to `ChapterResponse` and `ChapterRecord` |
| `pages/api/chapter.ts` | Modify | Return `imagePrompts` in JSON response (already computed, just not returned) |
| `lib/imageRegen.ts` | Create | Pure functions: `buildRegenPrompt`, `buildRegenUrl` |
| `lib/imageRegen.test.ts` | Create | Unit tests for imageRegen utilities |
| `app/page.tsx` | Modify | AppState type, INITIAL_STATE, serializeState, handlePickerResume, handleStartNextChapter, chapter generation callback, ChapterBody component, Home render |

---

### Task 1: Add `imagePrompts` to shared types

**Files:**
- Modify: `lib/storyBuilder.ts`

- [ ] **Step 1: Add `imagePrompts` to `ChapterRecord` and `ChapterResponse`**

`ChapterRecord` (around line 52) becomes:

```ts
export interface ChapterRecord {
  chapterNumber: number;
  title: string;
  chapter: string;
  imageUrls: string[];
  imagePrompts: string[];
  cliffhanger: string;
}
```

`ChapterResponse` (around line 32) becomes:

```ts
export interface ChapterResponse {
  chapterTitle: string;
  chapter: string;
  cliffhanger: string;
  imageUrls: string[];
  imagePrompts: string[];
  storyTitle?: string;
  error?: string;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/andrewbarlow/talehatch && bun run tsc --noEmit 2>&1 | head -30
```

Expected: errors about `imagePrompts` missing from callers (fine — fixed in later tasks). No unrelated new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/storyBuilder.ts
git commit -m "feat: add imagePrompts to ChapterRecord and ChapterResponse types"
```

---

### Task 2: Return `imagePrompts` from chapter API

**Files:**
- Modify: `pages/api/chapter.ts`

The variable `imagePromptTexts` is already computed at line 137 — it just isn't returned. One line change.

- [ ] **Step 1: Add `imagePrompts` to the JSON response**

Find line 147 in `pages/api/chapter.ts`:
```ts
return res.status(200).json({ chapterTitle, chapter, cliffhanger, imageUrls, storyTitle });
```

Replace with:
```ts
return res.status(200).json({ chapterTitle, chapter, cliffhanger, imageUrls, imagePrompts: imagePromptTexts, storyTitle });
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/andrewbarlow/talehatch && bun run tsc --noEmit 2>&1 | head -30
```

Expected: one fewer error than Task 1 (ChapterResponse now satisfied).

- [ ] **Step 3: Commit**

```bash
git add pages/api/chapter.ts
git commit -m "feat: return imagePrompts from chapter API"
```

---

### Task 3: Create `lib/imageRegen.ts` (TDD)

**Files:**
- Create: `lib/imageRegen.test.ts`
- Create: `lib/imageRegen.ts`

The style suffix must exactly match the one in `pages/api/chapter.ts` line 143: `", children's book illustration, watercolour and ink, warm and magical, highly detailed"`.

- [ ] **Step 1: Write the failing tests**

Create `lib/imageRegen.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { buildRegenPrompt, buildRegenUrl } from "./imageRegen";

describe("buildRegenPrompt", () => {
  it("places user text before the original prompt", () => {
    const result = buildRegenPrompt("make it rainy", "Zara stands in a cave, warm glow");
    expect(result).toMatch(/^make it rainy — Zara stands in a cave, warm glow/);
  });

  it("appends the style suffix", () => {
    const result = buildRegenPrompt("darker", "forest scene");
    expect(result).toContain("children's book illustration");
    expect(result).toContain("watercolour and ink");
    expect(result).toContain("warm and magical");
    expect(result).toContain("highly detailed");
  });

  it("handles empty user text by using only original prompt + suffix", () => {
    const result = buildRegenPrompt("", "original scene");
    expect(result).toMatch(/^original scene/);
    expect(result).toContain("children's book illustration");
  });
});

describe("buildRegenUrl", () => {
  it("returns a Pollinations URL", () => {
    const url = buildRegenUrl("make it rainy", "Zara stands in a cave");
    expect(url).toMatch(/^https:\/\/image\.pollinations\.ai\/prompt\//);
  });

  it("includes width, height, model, and seed params", () => {
    const url = buildRegenUrl("darker", "forest");
    expect(url).toContain("width=768");
    expect(url).toContain("height=512");
    expect(url).toContain("model=turbo");
    expect(url).toMatch(/seed=\d+/);
  });

  it("percent-encodes spaces and special chars in the prompt path", () => {
    const url = buildRegenUrl("make it rainy", "Zara's cave");
    const path = url.split("?")[0];
    expect(path).not.toContain(" ");
    expect(path).not.toContain("'");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd /Users/andrewbarlow/talehatch && bun test lib/imageRegen.test.ts
```

Expected: FAIL — `Cannot find module './imageRegen'`

- [ ] **Step 3: Create `lib/imageRegen.ts`**

```ts
const STYLE_SUFFIX = ", children's book illustration, watercolour and ink, warm and magical, highly detailed";

export function buildRegenPrompt(userText: string, originalPrompt: string): string {
  const prefix = userText.trim() ? `${userText.trim()} — ` : "";
  return `${prefix}${originalPrompt}${STYLE_SUFFIX}`;
}

export function buildRegenUrl(userText: string, originalPrompt: string): string {
  const prompt = buildRegenPrompt(userText, originalPrompt);
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=512&model=turbo&seed=${seed}`;
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd /Users/andrewbarlow/talehatch && bun test lib/imageRegen.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/imageRegen.ts lib/imageRegen.test.ts
git commit -m "feat: add imageRegen utility with buildRegenPrompt and buildRegenUrl"
```

---

### Task 4: Update `AppState` and related state functions

**Files:**
- Modify: `app/page.tsx`

Six targeted edits, all in `app/page.tsx`. Read each diff carefully — the file is large.

- [ ] **Step 1: Add `imagePrompts` to `AppState` interface**

Find the `AppState` interface (around line 31). Add `imagePrompts: string[]` after `imageUrls: string[]`:

```ts
imageUrls: string[];
imagePrompts: string[];
```

- [ ] **Step 2: Add `imagePrompts` to `INITIAL_STATE`**

Find `INITIAL_STATE` (around line 55). Add after `imageUrls: []`:

```ts
imageUrls: [],
imagePrompts: [],
```

- [ ] **Step 3: Add `imagePrompts` to `serializeState`**

Find `serializeState` (around line 93). Add after `imageUrls: state.imageUrls`:

```ts
imageUrls: state.imageUrls,
imagePrompts: state.imagePrompts,
```

- [ ] **Step 4: Add `imagePrompts` to `handlePickerResume`**

Find the `restored: AppState` block (around line 262). Add after the `imageUrls` line:

```ts
imageUrls: (savedState.imageUrls as string[]) ?? (savedState.imageUrl ? [savedState.imageUrl as string] : []),
imagePrompts: (savedState.imagePrompts as string[]) ?? [],
```

- [ ] **Step 5: Add `imagePrompts` to chapter generation callback**

Find the `generateChapter` `.then` callback (around line 188). The `next: AppState` block currently ends with `imageUrls: result.imageUrls ?? []`. Add after it:

```ts
imageUrls: result.imageUrls ?? [],
imagePrompts: result.imagePrompts ?? [],
```

- [ ] **Step 6: Add `imagePrompts` to `handleStartNextChapter`**

Find the `saved: ChapterRecord` object (around line 409). Add after `imageUrls: state.imageUrls`:

```ts
imageUrls: state.imageUrls,
imagePrompts: state.imagePrompts,
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd /Users/andrewbarlow/talehatch && bun run tsc --noEmit 2>&1 | head -30
```

Expected: errors only about `ChapterBody` missing the new props (fixed in Task 5). No other new errors.

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add imagePrompts to AppState, INITIAL_STATE, serialization, resume, and chapter callbacks"
```

---

### Task 5: Update `ChapterBody` component

**Files:**
- Modify: `app/page.tsx` (the `ChapterBody` function, currently lines 795–890)

- [ ] **Step 1: Import `buildRegenUrl`**

At the top of `app/page.tsx`, add to the existing imports:

```ts
import { buildRegenUrl } from "@/lib/imageRegen";
```

- [ ] **Step 2: Update `ChapterBody` props and add local state**

Replace the current function signature:

```ts
function ChapterBody({ chapter, imageUrls }: { chapter: string; imageUrls: string[] }) {
```

With:

```ts
function ChapterBody({
  chapter,
  imageUrls,
  regenPrompts,
  onImageChange,
}: {
  chapter: string;
  imageUrls: string[];
  regenPrompts: string[];
  onImageChange: (slotIdx: number, newUrl: string) => void;
}) {
```

Add two new state declarations immediately after the existing ones (`slots`, `blobUrls`, `urls`):

```ts
const [openPromptIdx, setOpenPromptIdx] = useState<number | null>(null);
const [promptText, setPromptText] = useState("");
```

- [ ] **Step 3: Update `regenerate` to call `onImageChange`**

The existing `regenerate` function only updates local state. Add `onImageChange` call:

```ts
function regenerate(i: number) {
  const base = urls[i].replace(/&seed=\d+/, "");
  const newUrl = `${base}&seed=${Math.floor(Math.random() * 999999)}`;
  setUrls((prev) => { const n = [...prev]; n[i] = newUrl; return n; });
  setBlobUrls((prev) => { const n = [...prev]; n[i] = null; return n; });
  setSlots((prev) => { const n = [...prev]; n[i] = "loading"; return n; });
  onImageChange(i, newUrl);
}
```

- [ ] **Step 4: Add `describeRegen` function**

Add immediately after `regenerate`:

```ts
function describeRegen(i: number) {
  if (!promptText.trim()) return;
  const newUrl = buildRegenUrl(promptText.trim(), regenPrompts[i] ?? "");
  setUrls((prev) => { const n = [...prev]; n[i] = newUrl; return n; });
  setBlobUrls((prev) => { const n = [...prev]; n[i] = null; return n; });
  setSlots((prev) => { const n = [...prev]; n[i] = "loading"; return n; });
  onImageChange(i, newUrl);
  setOpenPromptIdx(null);
  setPromptText("");
}
```

- [ ] **Step 5: Replace hover-only button with two always-visible buttons**

Find the `slot === "done"` branch (around line 865). Replace:

```tsx
<>
  <img
    src={blobSrc}
    alt="Chapter illustration"
    className="w-full"
    style={{ display: "block" }}
  />
  <button
    onClick={() => regenerate(i)}
    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-white text-xs font-medium"
  >
    ↻ New illustration
  </button>
</>
```

With:

```tsx
<>
  <img
    src={blobSrc}
    alt="Chapter illustration"
    className="w-full"
    style={{ display: "block" }}
  />
  <div className="absolute bottom-2 right-2 flex gap-1.5">
    <button
      onClick={() => regenerate(i)}
      className="px-2.5 py-1 rounded-lg bg-black/50 hover:bg-black/70 text-white text-xs font-semibold transition"
    >
      ↻ Random
    </button>
    <button
      onClick={() => setOpenPromptIdx(openPromptIdx === i ? null : i)}
      className="px-2.5 py-1 rounded-lg bg-amber-400/90 hover:bg-amber-500 text-amber-900 text-xs font-semibold transition"
    >
      🎨 Describe it
    </button>
  </div>
</>
```

- [ ] **Step 6: Add prompt bar below each image container**

The image container is the `<div className="w-full rounded-2xl overflow-hidden shadow-lg bg-slate-200 relative group">`. Add the prompt bar immediately after its closing `</div>`, still inside the outer `<div key={i} className="space-y-4">`:

```tsx
{openPromptIdx === i && (
  <div className="bg-white border border-amber-300 rounded-xl p-3 space-y-2 shadow-sm">
    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Describe the change</p>
    <div className="flex gap-2">
      <input
        autoFocus
        value={promptText}
        onChange={(e) => setPromptText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && describeRegen(i)}
        placeholder="e.g. make it stormy and darker…"
        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
      />
      <button
        onClick={() => describeRegen(i)}
        disabled={!promptText.trim()}
        className="px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-amber-900 text-sm font-semibold transition disabled:opacity-40"
      >
        ✨ Redraw
      </button>
    </div>
    <p className="text-xs text-slate-400">The story's original scene will be used as context — just describe what to change.</p>
  </div>
)}
```

- [ ] **Step 7: Check dev server for errors**

Watch the terminal running `bun dev` for any TypeScript or runtime errors. Fix before proceeding.

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx
git commit -m "feat: update ChapterBody with two-button regen UI and describe-it prompt bar"
```

---

### Task 6: Wire `onImageChange` in `Home`

**Files:**
- Modify: `app/page.tsx` (the chapter view render block, around line 497)

- [ ] **Step 1: Add `displayImagePrompts`**

Find the block where `displayImageUrls` is set (around line 512). Add immediately after it:

```ts
const displayImagePrompts = isViewingCurrent
  ? state.imagePrompts
  : (state.savedChapters[currentIdx].imagePrompts ?? []);
```

- [ ] **Step 2: Update the `<ChapterBody>` call**

Find `<ChapterBody key={currentIdx} chapter={displayText} imageUrls={displayImageUrls} />` (around line 579) and replace with:

```tsx
<ChapterBody
  key={currentIdx}
  chapter={displayText}
  imageUrls={displayImageUrls}
  regenPrompts={displayImagePrompts}
  onImageChange={(slotIdx, newUrl) => {
    if (isViewingCurrent) {
      setState((s) => {
        const newUrls = [...s.imageUrls];
        newUrls[slotIdx] = newUrl;
        const next = { ...s, imageUrls: newUrls };
        autoSave(next);
        return next;
      });
    } else {
      setState((s) => {
        const newChapters = [...s.savedChapters];
        const ch = { ...newChapters[currentIdx] };
        const newUrls = [...(ch.imageUrls ?? [])];
        newUrls[slotIdx] = newUrl;
        ch.imageUrls = newUrls;
        newChapters[currentIdx] = ch;
        const next = { ...s, savedChapters: newChapters };
        autoSave(next);
        return next;
      });
    }
  }}
/>
```

- [ ] **Step 3: Verify TypeScript — expect clean**

```bash
cd /Users/andrewbarlow/talehatch && bun run tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire onImageChange in Home for current and past chapter image persistence"
```

---

### Task 7: Manual end-to-end verification

No code changes — verification only.

- [ ] **Step 1: Generate a fresh story**

Open http://localhost:3000, enter an email, pick an age, answer all Q&A prompts until a chapter generates. Confirm illustrations load.

- [ ] **Step 2: Confirm buttons are always visible (not hover-only)**

On a loaded image, confirm both "↻ Random" and "🎨 Describe it" are visible without hovering. On a touch device or with DevTools mobile emulation, confirm they remain visible.

- [ ] **Step 3: Test "↻ Random"**

Click "↻ Random" on any image. Confirm loading state appears and a different image loads.

- [ ] **Step 4: Test "🎨 Describe it" — open and cancel**

Click "🎨 Describe it". Confirm the prompt bar appears below the image. Click it again — confirm the bar toggles closed.

- [ ] **Step 5: Test prompt submission**

Click "🎨 Describe it", type "make it darker and stormy", press Enter (or click "✨ Redraw"). Confirm the bar closes, loading state appears, and a new image loads. The resulting image should reflect the prompt.

- [ ] **Step 6: Test on a past chapter**

Click "📖 Write Chapter 2" and go through the Q&A. When Chapter 2 loads, use the chapter nav arrows to go back to Chapter 1. Confirm both regen buttons appear and function on Chapter 1 images.

- [ ] **Step 7: Verify persistence**

Regenerate an image on Chapter 1. Navigate to My Stories hub, then resume the story. Navigate to Chapter 1. Confirm the regenerated image URL was persisted (the regenerated image loads, not the original).

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "feat: image regeneration with custom prompt — complete"
```
