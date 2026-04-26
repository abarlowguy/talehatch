"use client";

import { useState, useEffect, useRef } from "react";

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
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [emailError, setEmailError] = useState("");
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [resumeLoading, setResumeLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

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
      const res = await fetch(`/api/stories/${storyId}?email=${encodeURIComponent(email.trim())}`);
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
      const res = await fetch(`/api/stories/${storyId}?email=${encodeURIComponent(email.trim())}`, { method: "DELETE" });
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
    function revealEmail() {
      setShowEmailForm(true);
      setTimeout(() => emailInputRef.current?.focus(), 80);
    }

    return (
      <div
        className="relative h-screen flex flex-col overflow-hidden"
        style={{
          backgroundImage: "url('/background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      >
        {/* ── NAV ── */}
        <nav
          style={{
            position: "relative",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 72,
            padding: "0 28px",
            flexShrink: 0,
          }}
        >
          {/* Logo */}
          <div
            style={{
              fontFamily: "var(--font-fredoka), sans-serif",
              fontSize: "clamp(22px, 2.5vw, 36px)",
              fontWeight: 700,
              color: "#120933",
              textShadow: "0 1px 8px rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            Talehatch
            <span style={{ color: "#ffb000", fontSize: "0.55em" }}>✦</span>
          </div>

          {/* Nav links */}
          <div
            className="hidden md:flex"
            style={{ gap: 38, fontWeight: 700, fontSize: 14, color: "#0d1a3a" }}
          >
            {["About", "How It Works", "Explore Stories", "For Parents"].map((l) => (
              <span key={l} className="cursor-pointer hover:opacity-60 transition-opacity">{l}</span>
            ))}
          </div>

          {/* Sign In */}
          <button
            onClick={revealEmail}
            className="hover:bg-white/10 transition"
            style={{
              color: "white",
              border: "2px solid rgba(255,255,255,0.8)",
              padding: "10px 28px",
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 14,
              backdropFilter: "blur(6px)",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Sign In
          </button>
        </nav>

        {/* ── CENTER CONTENT ── */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 24px",
            marginTop: -36,
          }}
        >
          {/* Hatching egg with cracks and light beams */}
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
            {/* Spinning light rays */}
            <div
              className="animate-ray-spin"
              style={{
                position: "absolute",
                width: 270,
                height: 270,
                backgroundImage: "repeating-conic-gradient(rgba(255,215,60,0.20) 0deg 13deg, transparent 13deg 45deg)",
                borderRadius: "50%",
                filter: "blur(6px)",
              }}
            />
            {/* Ambient core glow */}
            <div
              className="animate-glow-pulse"
              style={{
                position: "absolute",
                width: 175,
                height: 175,
                background: "radial-gradient(circle, rgba(255,250,180,1) 0%, rgba(255,200,40,0.8) 35%, rgba(255,130,0,0.3) 65%, transparent 80%)",
                borderRadius: "50%",
                filter: "blur(22px)",
              }}
            />

            {/* SVG egg — wobble wrapper */}
            <div className="animate-egg-hatch" style={{ position: "relative", zIndex: 2 }}>
              <svg viewBox="-20 -50 200 240" width="145" height="170" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient id="eggFill" cx="48%" cy="38%" r="55%">
                    <stop offset="0%" stopColor="#fffbee" />
                    <stop offset="55%" stopColor="#f2d98a" />
                    <stop offset="100%" stopColor="#e0b84a" />
                  </radialGradient>
                  <radialGradient id="innerGlow" cx="50%" cy="32%" r="58%">
                    <stop offset="0%" stopColor="rgba(255,248,130,0.95)" />
                    <stop offset="45%" stopColor="rgba(255,200,50,0.55)" />
                    <stop offset="100%" stopColor="rgba(255,140,0,0)" />
                  </radialGradient>
                  <filter id="crackGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>
                    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  <filter id="beamBlur" x="-40%" y="-20%" width="180%" height="150%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="5"/>
                  </filter>
                </defs>

                {/* ── BEAMS — drawn before egg so shell masks their base ── */}
                {/* Center beam: straight up from top crack peak */}
                <g className="animate-beam-pulse">
                  <polygon points="72,46 88,46 106,-46 54,-46" fill="rgba(255,235,70,0.40)" filter="url(#beamBlur)"/>
                  <polygon points="76,46 84,46 94,-46 66,-46"  fill="rgba(255,248,130,0.60)"/>
                </g>
                {/* Left beam: up-left from left crack section */}
                <g className="animate-beam-pulse" style={{ animationDelay: "0.5s" }}>
                  <polygon points="47,72 63,62 56,-42 -10,-38" fill="rgba(255,235,70,0.34)" filter="url(#beamBlur)"/>
                  <polygon points="51,70 60,63 50,-40  6,-38"  fill="rgba(255,248,130,0.52)"/>
                </g>
                {/* Right beam: up-right from right crack section */}
                <g className="animate-beam-pulse" style={{ animationDelay: "1.0s" }}>
                  <polygon points="100,60 116,52 164,-38 124,-44" fill="rgba(255,235,70,0.34)" filter="url(#beamBlur)"/>
                  <polygon points="103,59 113,53 157,-39 130,-44" fill="rgba(255,248,130,0.52)"/>
                </g>

                {/* ── EGG BODY ── */}
                <path
                  d="M 80 10 C 113 10 135 45 135 83 C 135 125 112 153 80 153 C 48 153 25 125 25 83 C 25 45 47 10 80 10 Z"
                  fill="url(#eggFill)"
                  stroke="#c8a040"
                  strokeWidth="1.5"
                />
                {/* Warm inner-light overlay */}
                <path
                  d="M 80 10 C 113 10 135 45 135 83 C 135 125 112 153 80 153 C 48 153 25 125 25 83 C 25 45 47 10 80 10 Z"
                  fill="url(#innerGlow)"
                  className="animate-glow-pulse"
                />

                {/* ── CRACKS ── */}
                {/* Main zigzag crack — shadow layer */}
                <path d="M 47 72 L 57 61 L 53 52 L 64 43 L 76 54 L 81 44 L 91 54 L 103 61 L 113 52 L 122 63"
                  fill="none" stroke="#7a5010" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                {/* Main zigzag crack — glowing light layer */}
                <path d="M 47 72 L 57 61 L 53 52 L 64 43 L 76 54 L 81 44 L 91 54 L 103 61 L 113 52 L 122 63"
                  fill="none" stroke="rgba(255,242,90,1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  filter="url(#crackGlow)" className="animate-beam-pulse"/>

                {/* Branch crack: center peak up to top of shell */}
                <path d="M 81 44 L 78 33 L 80 22 L 78 12"
                  fill="none" stroke="#7a5010" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M 81 44 L 78 33 L 80 22 L 78 12"
                  fill="none" stroke="rgba(255,242,90,0.95)" strokeWidth="1.2" strokeLinecap="round"
                  filter="url(#crackGlow)" className="animate-beam-pulse" style={{ animationDelay: "0.3s" }}/>

                {/* Left branch crack */}
                <path d="M 64 43 L 60 34 L 54 24"
                  fill="none" stroke="#7a5010" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M 64 43 L 60 34 L 54 24"
                  fill="none" stroke="rgba(255,242,90,0.85)" strokeWidth="1" strokeLinecap="round"
                  filter="url(#crackGlow)" className="animate-beam-pulse" style={{ animationDelay: "0.7s" }}/>
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1
            style={{
              fontFamily: "var(--font-fredoka), sans-serif",
              fontSize: "clamp(60px, 9.5vw, 140px)",
              fontWeight: 700,
              lineHeight: 0.9,
              color: "#180642",
              textShadow: "0 3px 16px rgba(255,255,255,0.4)",
              margin: "6px 0 0",
            }}
          >
            Talehatch
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontSize: "clamp(20px, 3vw, 40px)",
              fontWeight: 700,
              color: "#d95f0a",
              margin: "12px 0 14px",
              lineHeight: 1.1,
            }}
          >
            Where your stories hatch.
          </p>

          {/* Sub-copy */}
          <p
            style={{
              fontSize: "clamp(14px, 1.7vw, 22px)",
              fontWeight: 800,
              lineHeight: 1.5,
              color: "#120933",
              margin: 0,
            }}
          >
            You bring the ideas.<br />
            We help them grow.<br />
            The adventure is all yours.
          </p>

          {/* CTA */}
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", maxWidth: 300 }}>
            {showEmailForm ? (
              <>
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); setFetchError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                  placeholder="Enter your email to begin"
                  style={{
                    width: "100%",
                    borderRadius: 999,
                    border: "2px solid rgba(100,60,200,0.35)",
                    background: "rgba(255,255,255,0.88)",
                    backdropFilter: "blur(8px)",
                    padding: "13px 22px",
                    fontSize: 16,
                    color: "#180642",
                    textAlign: "center",
                    outline: "none",
                  }}
                />
                {(emailError || fetchError) && (
                  <p style={{ color: "#b91c1c", fontSize: 13, fontWeight: 700, margin: 0 }}>
                    {emailError || fetchError}
                  </p>
                )}
                <button
                  onClick={handleEmailSubmit}
                  disabled={loading}
                  className="hover:brightness-110 active:scale-95 transition"
                  style={{
                    width: "100%",
                    background: "linear-gradient(180deg, #7d4cf2 0%, #4b23bb 100%)",
                    color: "white",
                    padding: "17px 40px",
                    borderRadius: 999,
                    fontSize: 19,
                    fontWeight: 900,
                    border: "none",
                    cursor: loading ? "wait" : "pointer",
                    boxShadow: "0 10px 28px rgba(72,35,172,0.4)",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? "Loading…" : "Begin Your Story →"}
                </button>
              </>
            ) : (
              <button
                onClick={revealEmail}
                className="hover:brightness-110 active:scale-95 transition"
                style={{
                  width: "100%",
                  background: "linear-gradient(180deg, #7d4cf2 0%, #4b23bb 100%)",
                  color: "white",
                  padding: "19px 56px",
                  borderRadius: 999,
                  fontSize: 21,
                  fontWeight: 900,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 10px 28px rgba(72,35,172,0.4)",
                }}
              >
                Start Your Story
              </button>
            )}

          </div>
        </div>

        {/* ── FEATURE STRIP ── */}
        <div
          style={{
            position: "relative",
            zIndex: 20,
            flexShrink: 0,
            background: "rgba(10,5,40,0.96)",
            borderTop: "1px solid rgba(255,255,255,0.10)",
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        >
          <div
            style={{
              maxWidth: 960,
              margin: "0 auto",
              padding: "14px 52px",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            {[
              { icon: "💡", title: "Your Ideas",            sub: "You imagine it." },
              { icon: "🌱", title: "We Help It Grow",       sub: "We shape it." },
              { icon: "📖", title: "Your Story",            sub: "You own it." },
              { icon: "⭐", title: "Endless Possibilities", sub: "Creativity has no limits." },
            ].map((item) => (
              <div key={item.title} style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, alignItems: "center" }}>
                <span style={{ gridRow: "span 2", fontSize: 32 }}>{item.icon}</span>
                <strong style={{ color: "#f7e66c", fontSize: 15, fontWeight: 700 }}>{item.title}</strong>
                <small style={{ color: "rgba(255,255,255,0.70)", fontSize: 13 }}>{item.sub}</small>
              </div>
            ))}
          </div>
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
