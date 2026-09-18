/** On every page, above everything, while the site is an admin-only preview. */
export function PreviewBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-(--preview-bar) items-center justify-center bg-ink px-4 text-center text-xs font-medium text-white">
      <p className="truncate">תצוגה מקדימה — גלוי לאדמין בלבד</p>
    </div>
  );
}

/** The first focusable element: jumps past the header and filters. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-10 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-medium focus:text-ink focus:shadow-field"
    >
      דילוג לתוכן
    </a>
  );
}
