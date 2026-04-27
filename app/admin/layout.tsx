"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  async function handleSignOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const navLink = (href: string, label: string) => {
    const active = pathname === href || (pathname?.startsWith(href + "/") ?? false);
    return (
      <Link
        href={href}
        className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
          active
            ? "bg-purple-100 text-purple-700"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-6">
        <span className="text-base font-semibold text-slate-800 mr-2">
          TaleHatch Admin
        </span>
        <div className="flex items-center gap-1">
          {navLink("/admin", "Dashboard")}
          {navLink("/admin/users", "Users")}
          {navLink("/admin/stories", "Stories")}
        </div>
        <div className="ml-auto">
          <button
            onClick={handleSignOut}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
