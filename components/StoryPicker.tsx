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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

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

  async function handleDeleteStory(storyId: string) {
    setDeleteLoading(storyId);
    setFetchError("");
    try {
      const res = await fetch(`/api/stories/${storyId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setStories((prev) => prev.filter((s) => s.id !== storyId));
      setDeleteConfirm(null);
    } catch {
      setFetchError("Could not delete that story. Please try again.");
    } finally {
      setDeleteLoading(null);
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
            <div
              key={story.id}
              className="w-full rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden"
            >
              {deleteConfirm === story.id ? (
                <div className="p-5 space-y-3">
                  <p className="text-white text-sm font-medium">Delete "{story.title}"?</p>
                  <p className="text-slate-400 text-xs">This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      disabled={deleteLoading === story.id}
                      className="flex-1 py-2 rounded-xl border border-slate-600 text-slate-400 text-sm hover:border-slate-500 transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteStory(story.id)}
                      disabled={deleteLoading === story.id}
                      className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition disabled:opacity-50"
                    >
                      {deleteLoading === story.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-stretch">
                  <button
                    onClick={() => handlePickStory(story.id)}
                    disabled={resumeLoading !== null || deleteLoading !== null}
                    className="flex-1 text-left p-5 hover:bg-slate-700 transition disabled:opacity-50 space-y-1"
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
                  <button
                    onClick={() => setDeleteConfirm(story.id)}
                    disabled={resumeLoading !== null || deleteLoading !== null}
                    className="px-4 text-slate-600 hover:text-rose-400 hover:bg-slate-700 transition disabled:opacity-50 border-l border-slate-700 text-lg"
                    aria-label="Delete story"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
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
