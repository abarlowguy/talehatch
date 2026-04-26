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
                placeholder="e.g. Being brave means helping others even when it's scary"
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
