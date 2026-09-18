"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronIcon } from "../icons";

/**
 * A filter pill that opens a panel of checkboxes. Built on <details>, so it
 * works without JavaScript and the checkboxes stay in the search form while
 * closed; this component only adds closing on an outside click and on Escape.
 * On phones the panel spans the whole filter row (the row is the positioned box).
 */
export function FilterDropdown({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (e.key === "Escape" && el?.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className="group min-w-0 sm:relative">
      <summary className="flex h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-full border border-field bg-white ps-4 pe-3 text-ink shadow-field select-none hover:bg-surface sm:min-w-40 [&::-webkit-details-marker]:hidden">
        <span className="truncate">
          {label}
          {count ? (
            <span className="ms-2 inline-flex min-w-6 items-center justify-center rounded-full bg-accent-dark px-1.5 text-xs font-medium text-white">
              {count}
              <span className="sr-only"> נבחרו</span>
            </span>
          ) : null}
        </span>
        <ChevronIcon className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-card border-2 border-line bg-white p-4 shadow-lg sm:inset-x-auto sm:start-0 sm:w-80">
        {children}
      </div>
    </details>
  );
}
