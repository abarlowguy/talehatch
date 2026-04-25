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
} from "@/lib/prompts";
import { suggestions } from "@/lib/suggestions";
import { extractNouns, mergeEntities } from "@/lib/entityExtractor";
import {
  generateStorySegment,
  generateChapter,
  editChapter,
  type ChapterRecord,
} from "@/lib/storyBuilder";

type Mode = "guided" | "building" | "chapter";
type Screen = "landing" | "story";

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
  imageUrl: string;
  // Across chapters
  author: string;
  savedChapters: ChapterRecord[];
  // Persistence
  storyId: string | null;
  userEmail: string | null;
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
  imageUrl: "",
  author: "",
  savedChapters: [],
  storyId: null,
  userEmail: null,
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
    imageUrl: state.imageUrl,
    author: state.author,
    savedChapters: state.savedChapters,
    storyId: state.storyId,
    userEmail: state.userEmail,
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
          chapterTitle: result.chapterTitle,
          chapter: result.chapter,
          cliffhanger: result.cliffhanger,
          imageUrl: result.imageUrl,
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

    const title = buildStoryTitle(s);
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
      imageUrl: (savedState.imageUrl as string) ?? "",
      author: (savedState.author as string) ?? "",
      savedChapters: (savedState.savedChapters as ChapterRecord[]) ?? [],
      storyId: (savedState.storyId as string) ?? null,
      userEmail: (savedState.userEmail as string) ?? (savedState._savedEmail as string) ?? null,
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

    // Build full Q&A history so Claude can see exactly what's been asked and answered
    const conversationHistory = state.promptHistory.map((prompt, i) => ({
      prompt,
      answer: state.inputs[i] ?? "",
    }));

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
    });

    const newStory = result.story ?? state.story;
    const newCovered = result.coveredElements ?? state.coveredElements;

    if (result.nextPrompt) {
      setCurrentPrompt(result.nextPrompt);
    } else {
      setCurrentPrompt(guidedPrompts[nextStep] ?? guidedPrompts[guidedPrompts.length - 1]);
    }

    const shouldBuild =
      (result.readyToWrite && nextStep >= MIN_QUESTIONS) || nextStep >= MAX_QUESTIONS;

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
      imageUrl: state.imageUrl,
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
      />
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          {/* Image */}
          {state.imageUrl && (
            <ChapterImage src={state.imageUrl} />
          )}

          {/* Title */}
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-amber-600 tracking-widest uppercase">
              Chapter {state.chapterNumber}
            </p>
            <h1 className="text-3xl font-bold text-slate-800">{state.chapterTitle}</h1>
            {state.author && (
              <p className="text-slate-500 text-sm">by {state.author}</p>
            )}
          </div>

          {/* Chapter text */}
          <div className="bg-white rounded-2xl shadow p-8">
            <p className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap">
              {state.chapter}
            </p>
          </div>

          {/* Author input (if not yet set) */}
          {!state.author && (
            <AuthorInput onSubmit={(author) => setState((s) => ({ ...s, author }))} />
          )}

          {/* Decision / edit panel */}
          {editMode === "idle" && (
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

          {editMode === "choose" && (
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

          {editMode === "prompt" && (
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

          {editMode === "direct" && (
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
        <p className="text-xs text-slate-400 font-medium">Where your stories hatch.</p>
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

function ChapterImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-lg bg-slate-200">
      {!loaded && !error && (
        <div className="w-full aspect-video flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
          <p>Painting your illustration…</p>
        </div>
      )}
      {error && (
        <div className="w-full aspect-video flex items-center justify-center text-slate-400 text-sm italic">
          Illustration unavailable
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt="Chapter illustration"
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.7s", display: "block" }}
        className="w-full"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
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
