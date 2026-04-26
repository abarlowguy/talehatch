# Image Regeneration with Custom Prompt

**Date:** 2026-04-25  
**Status:** Approved  
**Scope:** Per-illustration regeneration with user-supplied prompt, works on all chapters

---

## Problem

The existing "↻ New illustration" button is hover-only (`opacity-0 group-hover:opacity-100`), making it invisible on touch devices. It also only does a random seed swap — no way for a kid to guide what changes. The feature should let kids say "make it stormier" and get a new image that still matches the story's aesthetic.

---

## Design

### Interaction

Two always-visible buttons sit in the bottom-right corner of every illustration:

- **↻ Random** — dark translucent pill; seed swap only, no prompt (existing behavior)
- **🎨 Describe it** — amber pill; tapping opens the prompt bar

When "🎨 Describe it" is tapped, a compact prompt bar slides in immediately below the image:
- Label: "Describe the change"
- Input placeholder: `e.g. make it stormy and darker…`
- Submit button: "✨ Redraw"
- Helper text: "The story's original scene will be used as context — just describe what to change."
- Tapping "✨ Redraw" closes the bar and starts the image load

Works on all chapters — current and past — not just the current one.

### Prompt Construction (client-side)

```
"${userText} — ${originalScenePrompt}, children's book illustration, watercolour and ink, warm and magical, highly detailed"
```

User intent leads; original scene prompt provides context; style suffix locks aesthetic consistency. A new random seed is appended. No API call — URL built entirely client-side.

### Persistence

When an image is regenerated, the new Pollinations URL is written back to parent state:
- Current chapter: `state.imageUrls[i]`
- Past chapter: `state.savedChapters[idx].imageUrls[i]`

`autoSave` fires after each regen, persisting the change to the DB.

---

## Data Model Changes

### `ChapterRecord` (lib/storyBuilder.ts)
```ts
imagePrompts: string[]   // added alongside existing imageUrls
```

### `ChapterResponse` (lib/storyBuilder.ts)
```ts
imagePrompts: string[]   // added alongside existing imageUrls
```

### `AppState` (app/page.tsx)
```ts
imagePrompts: string[]   // added alongside existing imageUrls
```
`INITIAL_STATE` defaults to `[]`.

---

## Files Changed

| File | Change |
|------|--------|
| `pages/api/chapter.ts` | Return `imagePrompts` (raw Claude-generated strings) in response JSON |
| `lib/storyBuilder.ts` | Add `imagePrompts: string[]` to `ChapterResponse` and `ChapterRecord` |
| `app/page.tsx` — `AppState` | Add `imagePrompts: string[]`; update `INITIAL_STATE`, `serializeState`, `handlePickerResume` |
| `app/page.tsx` — `Home` | Pass `regenPrompts` and `onImageChange` to `ChapterBody`; add handler that updates state and calls `autoSave` |
| `app/page.tsx` — `ChapterBody` | Replace hover-only button with always-visible two-button row; add prompt bar UI and `describeRegen` logic |

---

## Component: ChapterBody

### New props
```ts
regenPrompts: string[]
onImageChange: (slotIdx: number, newUrl: string) => void
```

### New local state
```ts
openPromptIdx: number | null   // which slot's prompt bar is open
promptText: string             // current input value
```

### Logic
- `regenerate(i)` — unchanged; strips seed, adds new random seed, resets slot
- `describeRegen(i)` — builds new URL from `promptText + " — " + regenPrompts[i] + style suffix + new seed`; resets slot; calls `onImageChange(i, newUrl)`; closes prompt bar

### UI changes
- Remove `opacity-0 group-hover:opacity-100` from existing button
- Replace with two always-visible buttons (dark "↻ Random" + amber "🎨 Describe it") in bottom-right corner of image container
- Prompt bar renders below image when `openPromptIdx === i`

---

## Error Handling

No change from current behavior. If the image fetch fails, slot falls to `"error"` state, showing "Try again" which calls `regenerate(i)` (random seed re-roll).

---

## Out of Scope

- Undo / image history
- Prompt character limit enforcement (Pollinations handles gracefully)
- Server-side Claude prompt blending (could be a future upgrade)
