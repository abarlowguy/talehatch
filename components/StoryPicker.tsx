"use client";

import { useState } from "react";

interface StorySummary {
  id: string;
  title: string;
  chapter_count: number;
  created_at: string;
  updated_at: string;
}

interface Props {
  onStart: (email: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onResume: (storyState: Record<string, any>) => void;
}

type View = "landing" | "email-new" | "email-resume" | "story-list";

export default function StoryPicker({ onStart, onResume }: Props) {
  const [view, setView] = useState<View>("landing");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  function validateEmail(value: string): boolean {
    return value.includes("@") && value.trim().length > 3;
  }

  function handleNewStoryEmailSubmit() {
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    onStart(email.trim());
  }

  async function handleResumeEmailSubmit() {
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    setLoading(true);
    setFetchError("");

    try {
      const res = await fetch(`/api/stories?email=${encodeURIComponent(email.trim())}`);
      if (!res.ok) throw new Error("Could not fetch stories.");
      const data: StorySummary[] = await res.json();
      setStories(data);
      setView("story-list");
    } catch {
      setFetchError("Could not load your stories. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePickStory(storyId: string) {
    setLoading(true);
    setFetchError("");

    try {
      const res = await fetch(`/api/stories/${storyId}`);
      if (!res.ok) throw new Error("Could not load story.");
      const data = await res.json();
      onResume({ ...data.state, _savedEmail: email.trim() });
    } catch {
      setFetchError("Could not load that story. Please try again.");
      setLoading(false);
    }
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // ── LANDING ──────────────────────────────────────────────────
  if (view === "landing") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 gap-10">
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold text-white tracking-tight">Talehatch</h1>
          <p className="text-slate-400 text-lg">Where your stories hatch.</p>
        </div>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={() => setView("email-new")}
            className="w-full py-4 rounded-2xl bg-amber-400 hover:bg-amber-500 text-white font-semibold text-lg transition"
          >
            ✨ Start a New Story
          </button>
          <button
            onClick={() => setView("email-resume")}
            className="w-full py-4 rounded-2xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-lg transition"
          >
            📖 Resume a Story
          </button>
        </div>
      </div>
    );
  }

  // ── EMAIL INPUT (new story) ───────────────────────────────────
  if (view === "email-new") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 gap-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-white">First, what's your email?</h2>
          <p className="text-slate-400 text-base max-w-xs">
            We'll save your story as you go so you can always come back to it.
          </p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleNewStoryEmailSubmit()}
            placeholder="your@email.com"
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {emailError && <p className="text-sm text-rose-400">{emailError}</p>}

          <button
            onClick={handleNewStoryEmailSubmit}
            className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition"
          >
            Let's go →
          </button>
          <button
            onClick={() => { setView("landing"); setEmailError(""); setEmail(""); }}
            className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── EMAIL INPUT (resume) ──────────────────────────────────────
  if (view === "email-resume") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 gap-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-white">Resume a Story</h2>
          <p className="text-slate-400 text-base">Enter the email you used when you started.</p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(""); setFetchError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleResumeEmailSubmit()}
            placeholder="your@email.com"
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {emailError && <p className="text-sm text-rose-400">{emailError}</p>}
          {fetchError && <p className="text-sm text-rose-400">{fetchError}</p>}

          <button
            onClick={handleResumeEmailSubmit}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition disabled:opacity-50"
          >
            {loading ? "Loading…" : "Find My Stories"}
          </button>
          <button
            onClick={() => { setView("landing"); setEmailError(""); setEmail(""); setFetchError(""); }}
            className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── STORY LIST ───────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-slate-950 px-6 py-12 gap-6">
      <div className="text-center space-y-1">
        <h2 className="text-3xl font-bold text-white">Your Stories</h2>
        <p className="text-slate-400 text-sm">{email}</p>
      </div>

      {fetchError && <p className="text-rose-400 text-sm">{fetchError}</p>}

      {stories.length === 0 ? (
        <div className="text-center space-y-4 mt-8">
          <p className="text-slate-400">No stories found for this email.</p>
          <button
            onClick={() => setView("email-resume")}
            className="text-amber-400 hover:text-amber-300 text-sm underline"
          >
            Try a different email
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-3">
          {stories.map((story) => (
            <button
              key={story.id}
              onClick={() => handlePickStory(story.id)}
              disabled={loading}
              className="w-full text-left p-5 rounded-2xl bg-slate-800 border border-slate-700 hover:border-amber-400 hover:bg-slate-700 transition disabled:opacity-50 space-y-1"
            >
              <p className="text-white font-semibold text-base">{story.title}</p>
              <p className="text-slate-400 text-sm">
                {story.chapter_count === 0
                  ? "No chapters yet"
                  : `${story.chapter_count} chapter${story.chapter_count !== 1 ? "s" : ""}`}
                {" · "}Updated {formatDate(story.updated_at)}
              </p>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => { setView("landing"); setEmail(""); setStories([]); setFetchError(""); }}
        className="text-slate-500 hover:text-slate-300 text-sm transition mt-4"
      >
        ← Back to home
      </button>
    </div>
  );
}
