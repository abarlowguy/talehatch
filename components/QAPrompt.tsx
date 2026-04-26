"use client";

import { useState, useEffect, useRef } from "react";

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface QAPromptProps {
  prompt: string;
  chapterNumber: number;
  questionIndex: number;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
  onRephrase: () => Promise<string>;
  onFetchHints: () => Promise<string[]>;
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
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const committedAnswerRef = useRef("");

  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    setCurrentPrompt(prompt);
    setAnswer("");
    setHints([]);
    setHintsOpen(false);
    setRephraseUsed(false);
    setRephraseLoading(false);
    recognitionRef.current?.stop();
    setIsListening(false);
  }, [prompt]);

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    committedAnswerRef.current = answer;
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setAnswer(committedAnswerRef.current + (final || interim));
      if (final) committedAnswerRef.current += final;
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  const showFinalChapterOption = chapterNumber >= 2 && questionIndex === 0;

  async function handleToggleHints() {
    if (hintsOpen) { setHintsOpen(false); return; }
    if (hints.length > 0) { setHintsOpen(true); return; }
    setHintsLoading(true);
    try {
      const result = await onFetchHints();
      setHints(result);
      setHintsOpen(true);
    } catch {
      // leave hintsOpen false so user can retry
    } finally {
      setHintsLoading(false);
    }
  }

  async function handleToggleMoralHints() {
    if (moralHintsOpen) { setMoralHintsOpen(false); return; }
    if (moralHints.length > 0) { setMoralHintsOpen(true); return; }
    setMoralHintsLoading(true);
    try {
      const result = await onFetchMoralHints();
      setMoralHints(result);
      setMoralHintsOpen(true);
    } catch {
      // leave moralHintsOpen false so user can retry
    } finally {
      setMoralHintsLoading(false);
    }
  }

  async function handleRephrase() {
    if (rephraseUsed || rephraseLoading) return;
    setRephraseLoading(true);
    try {
      const newPrompt = await onRephrase();
      setCurrentPrompt(newPrompt);
      setRephraseUsed(true);
      setHints([]);
      setHintsOpen(false);
    } catch {
      // rephraseUsed stays false — user can retry
    } finally {
      setRephraseLoading(false);
    }
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
      {/* Prompt + Rephrase + Skip on one line */}
      <div className="flex items-start gap-3">
        <p className="text-base leading-relaxed text-slate-800 flex-1">{currentPrompt}</p>
        <div className="flex items-center gap-3 shrink-0 pt-0.5">
          <button
            onClick={handleRephrase}
            disabled={rephraseUsed || rephraseLoading}
            className={`text-sm font-medium transition ${
              rephraseUsed
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {rephraseLoading ? "⏳" : "🔄 Rephrase"}
          </button>
          <button
            onClick={onSkip}
            disabled={isLoading}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            ⏭ Skip
          </button>
        </div>
      </div>

      {/* Answer input */}
      <textarea
        value={answer}
        onChange={(e) => { setAnswer(e.target.value); committedAnswerRef.current = e.target.value; }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Type your answer..."
        rows={3}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
      />

      {/* Need ideas + mic on same row */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleToggleHints}
          className="text-sm text-purple-600 hover:text-purple-800 font-medium"
        >
          {hintsLoading ? "Loading ideas..." : hintsOpen ? "▾ Need ideas?" : "▸ Need ideas?"}
        </button>
        {speechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              isListening ? "text-red-500 animate-pulse" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="text-base">{isListening ? "🔴" : "🎤"}</span>
            <span>{isListening ? "Stop listening" : "Speak your answer"}</span>
          </button>
        )}
      </div>

      {/* Hint items */}
      <div>
        {hintsOpen && hints.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {hints.map((hint, i) => (
              <button
                key={i}
                onClick={() => setAnswer(hint)}
                className="text-left text-sm rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 hover:bg-purple-50 hover:border-purple-200 transition"
              >
                {hint}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!answer.trim() || isLoading}
        className="w-full rounded-xl bg-purple-600 py-3 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-40 transition"
      >
        Submit →
      </button>

      {/* Final chapter option — only Q0 of chapter 2+ */}
      {showFinalChapterOption && (
        <div className="border-t border-slate-200 pt-3 flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFinalChapter}
              onChange={(e) => handleFinalChapterToggle(e.target.checked)}
              className="accent-purple-500"
            />
            <span className="text-sm text-slate-600">Make this the final chapter</span>
          </label>

          {isFinalChapter && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-purple-600 font-semibold">Final Chapter</p>
              <p className="text-sm leading-relaxed text-slate-700">What lesson or message should this story leave with your reader?</p>
              <textarea
                value={storyMoral}
                onChange={(e) => { onMoralChange(e.target.value); setMoralSaved(false); }}
                placeholder="e.g. Being brave means helping others even when it's scary"
                rows={2}
                className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:border-purple-400"
              />

              {/* Moral hints */}
              <div>
                <button
                  onClick={handleToggleMoralHints}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                >
                  {moralHintsLoading ? "Loading ideas..." : moralHintsOpen ? "▾ Need ideas?" : "▸ Need ideas?"}
                </button>
                {moralHintsOpen && moralHints.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2">
                    {moralHints.map((hint, i) => (
                      <button
                        key={i}
                        onClick={() => { onMoralChange(hint); setMoralSaved(false); }}
                        className="text-left text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 hover:bg-purple-50 hover:border-purple-200 transition"
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
