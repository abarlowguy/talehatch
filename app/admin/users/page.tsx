"use client";

import { useEffect, useState } from "react";

interface User {
  email: string;
  created_at: string;
  story_count: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/users");
        if (!res.ok) {
          setError("Failed to load users.");
          return;
        }
        const data = await res.json();
        // Sort by created_at descending (API already does this, but be safe)
        data.sort(
          (a: User, b: User) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setUsers(data);
      } catch {
        setError("Failed to load users.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">Users</h2>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-slate-500">No users yet.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="px-4 py-3 font-medium text-slate-600">Joined</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">
                  Stories
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.email}
                  className="border-b border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-800">{user.email}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-800 text-right">
                    {user.story_count}
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
