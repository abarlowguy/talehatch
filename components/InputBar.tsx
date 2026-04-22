"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  onSubmit: (value: string) => void;
  onNeedIdeas: () => void;
  isLoading: boolean;
  showIdeasButton: boolean;
  ideasHighlighted: boolean;
  injectedText: string;
}

export default function InputBar({
  onSubmit,
  onNeedIdeas,
  isLoading,
  showIdeasButton,
  ideasHighlighted,
  injectedText,
}: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Inject suggestion text when selected
  useEffect(() => {
    if (injectedText) {
      setValue(injectedText);
      inputRef.current?.focus();
    }
  }, [injectedText]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit() {
    if (value.trim().length < 10) {
      setError("Give me just one detail—anything.");
      return;
    }
    setError("");
    onSubmit(value.trim());
    setValue("");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-rose-500 font-medium pl-1">{error}</p>
      )}

      <div className="flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={handleKey}
          disabled={isLoading}
          rows={2}
          placeholder="Type your answer here…"
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50 transition"
        />

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="h-12 px-5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold text-base disabled:opacity-50 transition-colors"
        >
          {isLoading ? "…" : "Go"}
        </button>
      </div>

      {showIdeasButton && (
        <button
          onClick={onNeedIdeas}
          className={`w-full py-2 rounded-xl text-sm font-medium border transition-all duration-300 ${
            ideasHighlighted
              ? "bg-amber-100 border-amber-400 text-amber-700 scale-[1.01]"
              : "bg-white border-slate-200 text-slate-500 hover:border-amber-300"
          }`}
        >
          💡 Need ideas?
        </button>
      )}
    </div>
  );
}
