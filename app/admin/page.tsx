"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [storyCount, setStoryCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [usersRes, storiesRes] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/admin/stories"),
        ]);
        if (!usersRes.ok || !storiesRes.ok) {
          setError("Failed to load stats.");
          return;
        }
        const users = await usersRes.json();
        const stories = await storiesRes.json();
        setUserCount(users.length);
        setStoryCount(stories.length);
      } catch {
        setError("Failed to load stats.");
      }
    }
    load();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">Dashboard</h2>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <Link href="/admin/users">
          <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer">
            <p className="text-sm font-medium text-slate-500 mb-1">
              Total Users
            </p>
            <p className="text-4xl font-bold text-purple-600">
              {userCount === null ? "—" : userCount}
            </p>
          </div>
        </Link>
        <Link href="/admin/stories">
          <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer">
            <p className="text-sm font-medium text-slate-500 mb-1">
              Total Stories
            </p>
            <p className="text-4xl font-bold text-purple-600">
              {storyCount === null ? "—" : storyCount}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
