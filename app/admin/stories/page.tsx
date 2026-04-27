"use client";

import { useEffect, useState } from "react";

interface Story {
  id: string;
  user_email: string;
  author: string;
  title: string;
  chapter_count: number;
  created_at: string;
  updated_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminStoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stories");
      if (!res.ok) {
        setError("Failed to load stories.");
        return;
      }
      const data = await res.json();
      setStories(data);
    } catch {
      setError("Failed to load stories.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(story: Story) {
    const confirmed = window.confirm(
      `Delete "${story.title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/admin/stories?id=${encodeURIComponent(story.id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setStories((prev) => prev.filter((s) => s.id !== story.id));
    } else {
      alert("Failed to delete story.");
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">Stories</h2>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : stories.length === 0 ? (
        <p className="text-sm text-slate-500">No stories yet.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Title</th>
                <th className="px-4 py-3 font-medium text-slate-600">Author</th>
                <th className="px-4 py-3 font-medium text-slate-600">User</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">
                  Chapters
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">Created</th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  Last Updated
                </th>
                <th className="px-4 py-3 font-medium text-slate-600"></th>
              </tr>
            </thead>
            <tbody>
              {stories.map((story) => (
                <tr
                  key={story.id}
                  className="border-b border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium">
                    <a
                      href={`/?story=${story.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-800 hover:underline"
                    >
                      {story.title}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{story.author || <span className="text-slate-400 italic">—</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{story.user_email}</td>
                  <td className="px-4 py-3 text-slate-800 text-right">
                    {story.chapter_count}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(story.created_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(story.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(story)}
                      className="text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
