"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth/roles";

const TABS: { href: string; label: string; exact?: boolean; admin?: boolean }[] = [
  { href: "/admin", label: "סקירה", exact: true },
  { href: "/admin/texts", label: "טקסטים" },
  { href: "/admin/pins", label: "משרות מוצמדות" },
  { href: "/admin/banners", label: "הודעות באתר" },
  { href: "/admin/applications", label: "הגשות (בדיקה)", admin: true },
  { href: "/admin/users", label: "משתמשים", admin: true },
  { href: "/admin/api", label: "API ומפתחות", admin: true },
  { href: "/admin/connections", label: "חיבורים", admin: true },
  { href: "/admin/audit", label: "יומן שינויים", admin: true },
  { href: "/api-docs", label: "תיעוד API" },
];

/** One sideways-scrolling row on phones, wrapped pills from sm. */
export function AdminTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav aria-label="לשוניות ניהול" className="relative mb-8 border-b-2 border-line pb-3">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {TABS.filter((t) => !t.admin || role === "admin").map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <li key={t.href} className="shrink-0">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-5 text-sm font-medium whitespace-nowrap ${active ? "bg-ink text-white" : "bg-surface text-ink hover:bg-panel"}`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
