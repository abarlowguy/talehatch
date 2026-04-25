"use client";

import { useState, useEffect } from "react";

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
  initialEmail?: string;
}

type View = "landing" | "hub";

export default function StoryPicker({ onStart, onResume, initialEmail }: Props) {
  const [view, setView] = useState<View>("landing");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [emailError, setEmailError] = useState("");
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [resumeLoading, setResumeLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!initialEmail) return;
    setLoading(true);
    fetch(`/api/stories?email=${encodeURIComponent(initialEmail)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: StorySummary[]) => { setStories(data); setView("hub"); })
      .catch(() => setFetchError("Could not load your stories. Please try again."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validateEmail(value: string): boolean {
    return value.includes("@") && value.trim().length > 3;
  }

  async function handleEmailSubmit() {
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    setLoading(true);
    setFetchError("");

    try {
      const res = await fetch(`/api/stories?email=${encodeURIComponent(email.trim())}`);
      if (!res.ok) throw new Error();
      const data: StorySummary[] = await res.json();
      setStories(data);
      setView("hub");
    } catch {
      setFetchError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePickStory(storyId: string) {
    setResumeLoading(storyId);
    setFetchError("");
    try {
      const res = await fetch(`/api/stories/${storyId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      onResume({ ...data.state, _savedEmail: email.trim() });
    } catch {
      setFetchError("Could not load that story. Please try again.");
      setResumeLoading(null);
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

        <div className="w-full max-w-xs space-y-3">
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(""); setFetchError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
            placeholder="Enter your email to begin"
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 text-center"
          />
          {emailError && <p className="text-sm text-rose-400 text-center">{emailError}</p>}
          {fetchError && <p className="text-sm text-rose-400 text-center">{fetchError}</p>}
          <button
            onClick={handleEmailSubmit}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-amber-400 hover:bg-amber-500 text-white font-semibold text-lg transition disabled:opacity-50"
          >
            {loading ? "Loading…" : "Continue →"}
          </button>
        </div>
      </div>
    );
  }

  // ── HUB ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-slate-950 px-6 py-12 gap-6">
      <div className="text-center space-y-1">
        <h1 className="text-4xl font-bold text-white tracking-tight">Talehatch</h1>
        <p className="text-slate-500 text-sm">{email}</p>
      </div>

      {fetchError && <p className="text-rose-400 text-sm">{fetchError}</p>}

      {/* Start a new story */}
      <div className="w-full max-w-md">
        <button
          onClick={() => onStart(email.trim())}
          className="w-full py-4 rounded-2xl bg-amber-400 hover:bg-amber-500 text-white font-semibold text-lg transition"
        >
          ✨ Start a New Story
        </button>
      </div>

      {/* Existing stories */}
      {stories.length > 0 && (
        <div className="w-full max-w-md space-y-3">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider px-1">
            Your Stories
          </p>
          {stories.map((story) => (
            <button
              key={story.id}
              onClick={() => handlePickStory(story.id)}
              disabled={resumeLoading !== null}
              className="w-full text-left p-5 rounded-2xl bg-slate-800 border border-slate-700 hover:border-amber-400 hover:bg-slate-700 transition disabled:opacity-50 space-y-1"
            >
              <p className="text-white font-semibold text-base">{story.title}</p>
              <p className="text-slate-400 text-sm">
                {story.chapter_count === 0
                  ? "In progress"
                  : `${story.chapter_count} chapter${story.chapter_count !== 1 ? "s" : ""}`}
                {" · "}Last updated {formatDate(story.updated_at)}
              </p>
              {resumeLoading === story.id && (
                <p className="text-amber-400 text-xs">Loading…</p>
              )}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => { setView("landing"); setEmail(""); setStories([]); setFetchError(""); }}
        className="text-slate-500 hover:text-slate-300 text-sm transition mt-2"
      >
        ← Use a different email
      </button>
    </div>
  );
}
