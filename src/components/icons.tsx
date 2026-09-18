/** Inline icons (no icon font, nothing cross-origin). All decorative: the text beside them carries the meaning. */

type IconProps = { className?: string };

const base = (className = "size-6") => ({ className, "aria-hidden": true as const, focusable: "false" as const });

export function BagIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...base(className)}>
      <path d="M9 6a3 3 0 0 1 6 0v1h3.2a1 1 0 0 1 1 .92l.8 11.5A2 2 0 0 1 18 21.6H6a2 2 0 0 1-2-2.18l.8-11.5A1 1 0 0 1 5.8 7H9V6Zm1.6 1H13.4V6a1.4 1.4 0 0 0-2.8 0v1ZM9 10.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6Zm6 0a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6Z" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...base(className)}>
      <path d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm.9 4.6v4.5l3.3 2.4-1 1.4-4.1-3V7.1h1.8Z" />
    </svg>
  );
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...base(className)}>
      <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Z" />
    </svg>
  );
}

export function DocIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...base(className)}>
      <path d="M6 2.5h8.5L19 7v13.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1Zm2 8v1.6h8v-1.6H8Zm0 3.5v1.6h8V14H8Zm0 3.5v1.6h5v-1.6H8Z" />
    </svg>
  );
}

export function CrownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" {...base(className)}>
      <path d="M4 8.5 8 12l4-6 4 6 4-3.5-1.6 9.5H5.6L4 8.5Z" />
      <path d="M6 20.5h12" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...base(className)}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...base(className)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...base(className)}>
      <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5l-5.4 3 1.2-6-4.5-4.2 6.1-.7L12 3Z" />
    </svg>
  );
}
