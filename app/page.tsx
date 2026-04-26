"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import AnswerLog from "@/components/AnswerLog";
import PromptBox from "@/components/PromptBox";
import InputBar from "@/components/InputBar";
import ContributionMeter from "@/components/ContributionMeter";
import StoryPicker from "@/components/StoryPicker";
import {
  MIN_QUESTIONS,
  MAX_QUESTIONS,
  TOTAL_COLLECTABLE,
  FIRST_PROMPT,
  NEXT_CHAPTER_FIRST_PROMPT,
  guidedPrompts,
  AGE_RANGE_CONFIG,
} from "@/lib/prompts";
import type { AgeRange } from "@/lib/prompts";
import { suggestions } from "@/lib/suggestions";
import { extractNouns, mergeEntities } from "@/lib/entityExtractor";
import {
  generateStorySegment,
  generateChapter,
  editChapter,
  type ChapterRecord,
} from "@/lib/storyBuilder";
import { buildRegenUrl } from "@/lib/imageRegen";

type Mode = "guided" | "building" | "chapter";
type Screen = "landing" | "age-select" | "story";

interface AppState {
  chapterNumber: number;
  mode: Mode;
  step: number;
  inputs: string[];
  promptHistory: string[];
  story: string;
  entities: string[];
  coveredElements: string[];
  // Current chapter
  chapterTitle: string;
  chapter: string;
  cliffhanger: string;
  imageUrls: string[];
  imagePrompts: string[];
  // Across chapters
  storyTitle: string;
  author: string;
  savedChapters: ChapterRecord[];
  // Persistence
  storyId: string | null;
  userEmail: string | null;
  ageRange: AgeRange;
}

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
  storyTitle: "",
  author: "",
  savedChapters: [],
  storyId: null,
  userEmail: null,
  ageRange: "older",
};

function buildStoryTitle(state: AppState): string {
  // Try to form a title from entities or inputs
  const firstEntity = state.entities[0];
  const secondEntity = state.entities[1];
  if (firstEntity && secondEntity) {
    return `${firstEntity}'s Adventure with ${secondEntity}`;
  }
  if (firstEntity) {
    return `${firstEntity}'s Story`;
  }
  if (state.inputs.length > 0) {
    const words = state.inputs[0].split(" ").slice(0, 5).join(" ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return `Chapter ${state.chapterNumber} Story`;
}

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
    storyTitle: state.storyTitle,
    author: state.author,
    savedChapters: state.savedChapters,
    storyId: state.storyId,
    userEmail: state.userEmail,
    ageRange: state.ageRange,
  };
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [ideasHighlighted, setIdeasHighlighted] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  const [currentPrompt, setCurrentPrompt] = useState(FIRST_PROMPT);
  const [buildingStatus, setBuildingStatus] = useState("Hatching your chapter…");

  // Edit mode UI state — "idle" | "choose" | "prompt" | "direct"
  const [editMode, setEditMode] = useState<"idle" | "choose" | "prompt" | "direct">("idle");
  const [editText, setEditText] = useState("");
  const [directText, setDirectText] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [viewingChapterIdx, setViewingChapterIdx] = useState<number | null>(null);

  // Always land on the latest chapter when a new one is generated
  useEffect(() => {
    if (state.mode === "chapter") setViewingChapterIdx(null);
  }, [state.mode]);

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    setIdeasHighlighted(false);
    inactivityTimer.current = setTimeout(() => setIdeasHighlighted(true), 5000);
  }, []);

  useEffect(() => {
    resetInactivityTimer();
    return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
  }, [state.step, resetInactivityTimer]);

  // Trigger chapter generation when entering "building" mode
  useEffect(() => {
    if (state.mode !== "building") return;

    const statuses = [
      "Hatching your chapter…",
      "Weaving your ideas together…",
      "Painting the world you built…",
      "Almost ready…",
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % statuses.length;
      setBuildingStatus(statuses[i]);
    }, 3500);

    // Find the previous chapter's cliffhanger if this is chapter 2+
    const previousCliffhanger =
      state.savedChapters.length > 0
        ? state.savedChapters[state.savedChapters.length - 1].cliffhanger
        : undefined;

    generateChapter({
      inputs: state.inputs,
      story: state.story,
      entities: state.entities,
      chapterNumber: state.chapterNumber,
      previousCliffhanger,
      ageRange: state.ageRange,
    }).then((result) => {
      clearInterval(interval);
      if (result.error) {
        setBuildingStatus("Something went wrong. Refresh to try again.");
        return;
      }
      setState((s) => {
        const next: AppState = {
          ...s,
          mode: "chapter",
          storyTitle: result.storyTitle ?? s.storyTitle,
          chapterTitle: result.chapterTitle,
          chapter: result.chapter,
          cliffhanger: result.cliffhanger,
          imageUrls: result.imageUrls ?? [],
          imagePrompts: result.imagePrompts ?? [],
        };
        // Auto-save fire-and-forget
        autoSave(next);
        return next;
      });
      resetEditState();
    });

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mode]);

  // ── Auto-save helpers ────────────────────────────────────────

  function autoSave(s: AppState): void {
    if (!s.userEmail) return; // no email = local only

    const title = s.storyTitle || buildStoryTitle(s);
    const chapterCount = s.savedChapters.length + (s.mode === "chapter" ? 1 : 0);
    const serialized = serializeState(s);

    if (!s.storyId) {
      // First save — need a new ID. We'll patch state after.
      const newId = crypto.randomUUID();
      setState((prev) => ({ ...prev, storyId: newId }));
      fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: s.userEmail,
          id: newId,
          title,
          state: { ...serialized, storyId: newId },
        }),
      }).catch(() => {/* fire-and-forget */});
    } else {
      fetch(`/api/stories/${s.storyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, chapterCount, state: serialized }),
      }).catch(() => {/* fire-and-forget */});
    }
  }

  // ── Handlers from StoryPicker ────────────────────────────────

  function handlePickerStart(email: string) {
    setState({
      ...INITIAL_STATE,
      storyId: null,
      userEmail: email,
    });
    setCurrentPrompt(FIRST_PROMPT);
    resetEditState();
    setScreen("age-select");
  }

  function handleAgeSelect(range: AgeRange) {
    setState((s) => ({ ...s, ageRange: range }));
    setScreen("story");
  }

  function handlePickerResume(savedState: Record<string, unknown>) {
    // Merge saved state back into AppState, falling back to INITIAL_STATE defaults
    const restored: AppState = {
      chapterNumber: (savedState.chapterNumber as number) ?? INITIAL_STATE.chapterNumber,
      mode: (savedState.mode as Mode) ?? "guided",
      step: (savedState.step as number) ?? 0,
      inputs: (savedState.inputs as string[]) ?? [],
      promptHistory: (savedState.promptHistory as string[]) ?? [],
      story: (savedState.story as string) ?? "",
      entities: (savedState.entities as string[]) ?? [],
      coveredElements: (savedState.coveredElements as string[]) ?? [],
      chapterTitle: (savedState.chapterTitle as string) ?? "",
      chapter: (savedState.chapter as string) ?? "",
      cliffhanger: (savedState.cliffhanger as string) ?? "",
      imageUrls: (savedState.imageUrls as string[]) ?? (savedState.imageUrl ? [savedState.imageUrl as string] : []),
      imagePrompts: (savedState.imagePrompts as string[]) ?? [],
      storyTitle: (savedState.storyTitle as string) ?? "",
      author: (savedState.author as string) ?? "",
      savedChapters: (savedState.savedChapters as ChapterRecord[]) ?? [],
      storyId: (savedState.storyId as string) ?? null,
      userEmail: (savedState.userEmail as string) ?? (savedState._savedEmail as string) ?? null,
      ageRange: (savedState.ageRange as AgeRange) ?? "older",
    };

    // Restore prompt cursor
    const step = restored.step;
    if (restored.mode === "chapter") {
      // Already on a chapter view — no prompt needed
    } else {
      setCurrentPrompt(
        restored.chapterNumber > 1
          ? NEXT_CHAPTER_FIRST_PROMPT
          : (guidedPrompts[step] ?? guidedPrompts[guidedPrompts.length - 1])
      );
    }

    setState(restored);
    resetEditState();
    setScreen("story");
  }

  async function handleGuidedInput(input: string) {
    setIsLoading(true);
    setIdeasOpen(false);
    setSuggestionText("");
    resetInactivityTimer();

    const answeredPrompt = currentPrompt;
    const newEntities = mergeEntities(state.entities, extractNouns(input));
    const newInputs = [...state.inputs, input];
    const newPromptHistory = [...state.promptHistory, answeredPrompt];
    const nextStep = state.step + 1;

    // Find previous cliffhanger for chapter 2+
    const previousCliffhanger =
      state.savedChapters.length > 0
        ? state.savedChapters[state.savedChapters.length - 1].cliffhanger
        : undefined;

    // Build full Q&A history including the current turn so Claude sees all context
    const conversationHistory = newPromptHistory.map((prompt, i) => ({
      prompt,
      answer: newInputs[i] ?? "",
    }));

    const tier = AGE_RANGE_CONFIG[state.ageRange];

    const result = await generateStorySegment({
      story: state.story,
      input,
      entities: newEntities,
      mode: "guided",
      step: state.step,
      coveredElements: state.coveredElements,
      questionCount: state.step,
      chapterNumber: state.chapterNumber,
      previousCliffhanger,
      conversationHistory,
      ageRange: state.ageRange,
    });

    const newStory = result.story ?? state.story;
    const newCovered = result.coveredElements ?? state.coveredElements;

    if (result.nextPrompt) {
      setCurrentPrompt(result.nextPrompt);
    } else {
      const fallbacks = tier.fallbackPrompts;
      setCurrentPrompt(fallbacks[nextStep] ?? fallbacks[fallbacks.length - 1]);
    }

    const shouldBuild =
      (result.readyToWrite && nextStep >= tier.minQuestions) || nextStep >= tier.maxQuestions;

    const nextState: AppState = {
      ...state,
      step: nextStep,
      mode: shouldBuild ? "building" : "guided",
      inputs: newInputs,
      promptHistory: newPromptHistory,
      story: newStory,
      entities: newEntities,
      coveredElements: newCovered,
    };

    setState(nextState);
    autoSave(nextState);
    setIsLoading(false);
  }

  function resetEditState() {
    setEditMode("idle");
    setEditText("");
    setDirectText("");
    setEditError("");
  }

  function handleOpenDirectEdit() {
    setDirectText(state.chapter);
    setEditMode("direct");
  }

  function handleSaveDirectEdit() {
    if (!directText.trim()) return;
    setState((s) => ({ ...s, chapter: directText.trim() }));
    resetEditState();
  }

  async function handleApplyPromptEdits() {
    if (!editText.trim()) return;
    setEditLoading(true);
    setEditError("");

    const result = await editChapter({
      chapter: state.chapter,
      editInstructions: editText.trim(),
      cliffhanger: state.cliffhanger,
    });

    if (result.error) {
      setEditError(result.error);
    } else {
      setState((s) => ({ ...s, chapter: result.chapter }));
      resetEditState();
    }
    setEditLoading(false);
  }

  function handleStartNextChapter() {
    // Save current chapter
    const saved: ChapterRecord = {
      chapterNumber: state.chapterNumber,
      title: state.chapterTitle,
      chapter: state.chapter,
      imageUrls: state.imageUrls,
      imagePrompts: state.imagePrompts,
      cliffhanger: state.cliffhanger,
    };

    setState((s) => ({
      ...INITIAL_STATE,
      chapterNumber: s.chapterNumber + 1,
      author: s.author,
      entities: s.entities, // carry established characters/places
      savedChapters: [...s.savedChapters, saved],
      storyId: s.storyId,
      userEmail: s.userEmail,
    }));

    setCurrentPrompt(NEXT_CHAPTER_FIRST_PROMPT);
    resetEditState();
  }

  function handleGoToHub() {
    setScreen("landing");
  }

  function handleRestart() {
    setState(INITIAL_STATE);
    setCurrentPrompt(FIRST_PROMPT);
    resetEditState();
    setScreen("landing");
  }

  // ── LANDING (StoryPicker) ────────────────────────────────────
  if (screen === "landing") {
    return (
      <StoryPicker
        onStart={(email: string) => handlePickerStart(email)}
        onResume={handlePickerResume}
        initialEmail={state.userEmail ?? undefined}
      />
    );
  }

  // ── AGE SELECT ───────────────────────────────────────────────
  if (screen === "age-select") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 gap-10">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-white">Who is this story for?</h2>
          <p className="text-slate-400 text-base">We'll tailor the story to match their reading level.</p>
        </div>
        <div className="w-full max-w-xs space-y-3">
          {(["tiny", "young", "middle", "older"] as AgeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => handleAgeSelect(range)}
              className="w-full py-4 rounded-2xl bg-slate-800 hover:bg-amber-400 border border-slate-700 hover:border-amber-400 text-white font-semibold text-lg transition"
            >
              {AGE_RANGE_CONFIG[range].label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── BUILDING ──────────────────────────────────────────────────
  if (state.mode === "building") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 gap-6 p-6">
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full bg-amber-400 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <p className="text-2xl font-bold text-white text-center">{buildingStatus}</p>
        <p className="text-slate-400 text-sm text-center max-w-xs">
          Writing Chapter {state.chapterNumber} from {state.inputs.length} of your ideas.
        </p>
      </div>
    );
  }

  // ── CHAPTER ───────────────────────────────────────────────────
  if (state.mode === "chapter") {
    const totalChapters = state.savedChapters.length + 1;
    const currentIdx = viewingChapterIdx ?? (totalChapters - 1);
    const isViewingCurrent = viewingChapterIdx === null;
    const canGoPrev = currentIdx > 0;
    const canGoNext = currentIdx < totalChapters - 1;

    const displayChapterNum = currentIdx + 1;
    const displayTitle = isViewingCurrent
      ? state.chapterTitle
      : state.savedChapters[currentIdx].title;
    const displayText = isViewingCurrent
      ? state.chapter
      : state.savedChapters[currentIdx].chapter;
    const displayImageUrls = isViewingCurrent
      ? state.imageUrls
      : (state.savedChapters[currentIdx].imageUrls ?? []);
    const displayImagePrompts = isViewingCurrent
      ? state.imagePrompts
      : (state.savedChapters[currentIdx].imagePrompts ?? []);

    function goToPrev() {
      const newIdx = currentIdx - 1;
      setViewingChapterIdx(newIdx === totalChapters - 1 ? null : newIdx);
    }
    function goToNext() {
      const newIdx = currentIdx + 1;
      setViewingChapterIdx(newIdx === totalChapters - 1 ? null : newIdx);
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          {/* Nav */}
          {state.userEmail && (
            <button
              onClick={handleGoToHub}
              className="text-sm text-amber-700 hover:text-amber-900 font-medium transition"
            >
              ← My Stories
            </button>
          )}

          {/* Chapter navigation (only shown when there are multiple chapters) */}
          {totalChapters > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={goToPrev}
                disabled={!canGoPrev}
                className="w-9 h-9 rounded-full bg-white shadow text-slate-500 hover:text-slate-800 hover:shadow-md transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-lg"
              >
                ‹
              </button>
              <span className="text-sm font-medium text-slate-500">
                Chapter {displayChapterNum} of {totalChapters}
              </span>
              <button
                onClick={goToNext}
                disabled={!canGoNext}
                className="w-9 h-9 rounded-full bg-white shadow text-slate-500 hover:text-slate-800 hover:shadow-md transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-lg"
              >
                ›
              </button>
            </div>
          )}

          {/* Title */}
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-amber-600 tracking-widest uppercase">
              Chapter {displayChapterNum}
            </p>
            <h1 className="text-3xl font-bold text-slate-800">{displayTitle}</h1>
            {state.author && (
              <p className="text-slate-500 text-sm">by {state.author}</p>
            )}
          </div>

          {/* Chapter text with interspersed images */}
          <div className="bg-white rounded-2xl shadow p-8 space-y-8">
            {displayImageUrls.length === 0 ? (
              <p className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap">
                {displayText}
              </p>
            ) : (
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
            )}
          </div>

          {/* Author input (only on current chapter, only if not yet set) */}
          {isViewingCurrent && !state.author && (
            <AuthorInput onSubmit={(author) => setState((s) => ({ ...s, author }))} />
          )}

          {/* Decision / edit panel — only on the current (latest) chapter */}
          {isViewingCurrent && editMode === "idle" && (
            <div className="space-y-3">
              <p className="text-center text-sm font-medium text-slate-500">
                What would you like to do?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditMode("choose")}
                  className="flex-1 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:border-amber-300 hover:bg-amber-50 transition"
                >
                  ✏️ Edit this chapter
                </button>
                <button
                  onClick={handleStartNextChapter}
                  className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition"
                >
                  📖 Write Chapter {state.chapterNumber + 1}
                </button>
              </div>
            </div>
          )}

          {isViewingCurrent && editMode === "choose" && (
            <div className="space-y-3">
              <p className="text-center text-sm font-medium text-slate-500">
                How would you like to edit?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditMode("prompt")}
                  className="flex-1 py-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:border-amber-300 hover:bg-amber-50 transition text-sm"
                >
                  <span className="block text-xl mb-1">💬</span>
                  Describe changes
                  <span className="block text-xs text-slate-400 mt-0.5">AI rewrites it for you</span>
                </button>
                <button
                  onClick={handleOpenDirectEdit}
                  className="flex-1 py-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:border-amber-300 hover:bg-amber-50 transition text-sm"
                >
                  <span className="block text-xl mb-1">📝</span>
                  Edit directly
                  <span className="block text-xs text-slate-400 mt-0.5">Change the text yourself</span>
                </button>
              </div>
              <button
                onClick={resetEditState}
                className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition"
              >
                Cancel
              </button>
            </div>
          )}

          {isViewingCurrent && editMode === "prompt" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">
                What changes would you like to make?
              </p>
              <textarea
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                disabled={editLoading}
                rows={4}
                placeholder={'e.g. "Make the cliffhanger more intense" or "Change her name to Zara"'}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50"
              />
              {editError && <p className="text-sm text-rose-500">{editError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={resetEditState}
                  disabled={editLoading}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 font-medium hover:border-slate-300 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyPromptEdits}
                  disabled={editLoading || !editText.trim()}
                  className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition disabled:opacity-50"
                >
                  {editLoading ? "Rewriting…" : "Apply edits"}
                </button>
              </div>
            </div>
          )}

          {isViewingCurrent && editMode === "direct" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">
                Edit the chapter directly, then save when you are done.
              </p>
              <textarea
                autoFocus
                value={directText}
                onChange={(e) => setDirectText(e.target.value)}
                rows={20}
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-serif leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <div className="flex gap-3">
                <button
                  onClick={resetEditState}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 font-medium hover:border-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDirectEdit}
                  disabled={!directText.trim()}
                  className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition disabled:opacity-50"
                >
                  Save changes
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          {isViewingCurrent && (
            <div className="flex items-center justify-between text-sm px-1 pb-4">
              <p className="text-amber-600 font-medium">
                ✨ {state.inputs.length} ideas, all yours
              </p>
              <button
                onClick={handleRestart}
                className="text-slate-400 hover:text-slate-600 underline"
              >
                Start a new story
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── GUIDED ───────────────────────────────────────────────────
  const currentSuggestions = suggestions[state.step] ?? [];
  const answerEntries = state.promptHistory.map((prompt, i) => ({
    prompt,
    answer: state.inputs[i] ?? "",
  }));

  return (
    <div className="min-h-screen flex flex-col p-4 gap-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-2xl font-bold text-slate-800 tracking-tight">Talehatch</p>
          {state.chapterNumber > 1 && (
            <p className="text-xs text-amber-500 font-medium">Building Chapter {state.chapterNumber}</p>
          )}
        </div>
        {state.userEmail ? (
          <button
            onClick={handleGoToHub}
            className="text-sm text-amber-700 hover:text-amber-900 font-medium transition"
          >
            ← My Stories
          </button>
        ) : (
          <p className="text-xs text-slate-400 font-medium">Where your stories hatch.</p>
        )}
      </div>

      <AnswerLog entries={answerEntries} isLoading={isLoading} />

      <PromptBox
        prompt={currentPrompt}
        coveredCount={state.coveredElements.length}
        totalCount={TOTAL_COLLECTABLE}
      />

      {ideasOpen && currentSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {currentSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => { setSuggestionText(s); setIdeasOpen(false); }}
              className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 hover:bg-amber-100 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <InputBar
        onSubmit={handleGuidedInput}
        onNeedIdeas={() => setIdeasOpen(!ideasOpen)}
        isLoading={isLoading}
        showIdeasButton={currentSuggestions.length > 0}
        ideasHighlighted={ideasHighlighted}
        injectedText={suggestionText}
      />

      <ContributionMeter
        coveredCount={state.coveredElements.length}
        totalCount={TOTAL_COLLECTABLE}
      />
    </div>
  );
}

type SlotState = "pending" | "loading" | "done" | "error";

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
  const [slots, setSlots] = useState<SlotState[]>(() => imageUrls.map((_, i) => i === 0 ? "loading" : "pending"));
  const [blobUrls, setBlobUrls] = useState<(string | null)[]>(() => imageUrls.map(() => null));
  const [urls, setUrls] = useState<string[]>(() => [...imageUrls]);
  const [openPromptIdx, setOpenPromptIdx] = useState<number | null>(null);
  const [promptText, setPromptText] = useState("");

  const paragraphs = chapter.split("\n\n").filter((p) => p.trim());
  const groupSize = imageUrls.length > 0 ? Math.ceil(paragraphs.length / imageUrls.length) : paragraphs.length;

  function advance(i: number, result: "done" | "error", blob?: string) {
    setSlots((prev) => {
      const next = [...prev];
      next[i] = result;
      if (i + 1 < next.length) next[i + 1] = "loading";
      return next;
    });
    if (blob) {
      setBlobUrls((prev) => { const n = [...prev]; n[i] = blob; return n; });
    }
  }

  function regenerate(i: number) {
    const base = urls[i].replace(/&seed=\d+/, "");
    const newUrl = `${base}&seed=${Math.floor(Math.random() * 999999)}`;
    setUrls((prev) => { const n = [...prev]; n[i] = newUrl; return n; });
    setBlobUrls((prev) => { const n = [...prev]; n[i] = null; return n; });
    setSlots((prev) => { const n = [...prev]; n[i] = "loading"; return n; });
    onImageChange(i, newUrl);
  }

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

  return (
    <>
      {urls.map((imgUrl, i) => {
        const group = paragraphs.slice(i * groupSize, (i + 1) * groupSize);
        const slot = slots[i];
        const blobSrc = blobUrls[i];
        return (
          <div key={i} className="space-y-4">
            <div className="w-full rounded-2xl overflow-hidden shadow-lg bg-slate-200 relative group">
              {(slot === "pending") && (
                <div className="w-full aspect-video flex items-center justify-center text-slate-300 text-xs">
                  Illustration {i + 1} of {urls.length}
                </div>
              )}
              {(slot === "loading") && (
                <div className="w-full aspect-video flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((j) => (
                      <div key={j} className="w-2 h-2 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: `${j * 150}ms` }} />
                    ))}
                  </div>
                  <p>Painting your illustration…</p>
                </div>
              )}
              {slot === "error" && (
                <div className="w-full aspect-video flex flex-col items-center justify-center gap-2 text-slate-400 text-sm italic">
                  <p>Illustration unavailable</p>
                  <button
                    onClick={() => regenerate(i)}
                    className="px-3 py-1 rounded-lg bg-slate-300 hover:bg-slate-400 text-slate-600 text-xs font-medium not-italic transition"
                  >
                    Try again
                  </button>
                </div>
              )}
              {slot === "loading" && (
                <ImageLoader
                  src={imgUrl}
                  onDone={(blob) => advance(i, "done", blob)}
                  onError={() => advance(i, "error")}
                />
              )}
              {slot === "done" && blobSrc && (
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
                      onClick={() => { if (openPromptIdx === i) { setOpenPromptIdx(null); } else { setOpenPromptIdx(i); setPromptText(""); } }}
                      className="px-2.5 py-1 rounded-lg bg-amber-400/90 hover:bg-amber-500 text-amber-900 text-xs font-semibold transition"
                    >
                      🎨 Describe it
                    </button>
                  </div>
                </>
              )}
            </div>
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
            {group.map((para, j) => (
              <p key={j} className="font-serif text-lg leading-relaxed text-slate-800">{para}</p>
            ))}
          </div>
        );
      })}
    </>
  );
}

function ImageLoader({ src, onDone, onError }: { src: string; onDone: (blob: string) => void; onError: () => void }) {
  useEffect(() => {
    let cleanedUp = false;
    const controller = new AbortController();
    const fetchUrl = src.startsWith("https://image.pollinations.ai/")
      ? `/api/image-proxy?url=${encodeURIComponent(src)}`
      : src;
    fetch(fetchUrl, { signal: controller.signal })
      .then((res) => {
        if (cleanedUp) return undefined;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cleanedUp || !blob) return;
        onDone(URL.createObjectURL(blob));
      })
      .catch((err: unknown) => {
        if (cleanedUp) return;
        if (err instanceof Error && err.name === "AbortError") return;
        onError();
      });

    return () => {
      cleanedUp = true;
      controller.abort();
    };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function AuthorInput({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="bg-white rounded-2xl shadow p-6 space-y-3 text-center">
      <p className="text-lg font-bold text-slate-800">Who wrote this story?</p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && name.trim() && onSubmit(name.trim())}
        placeholder="Your name…"
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
      />
      <button
        onClick={() => name.trim() && onSubmit(name.trim())}
        className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition"
      >
        Add my name
      </button>
    </div>
  );
}
