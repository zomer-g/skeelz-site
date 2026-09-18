const intFormat = new Intl.NumberFormat("he-IL");

export const fmtInt = (n: number) => intFormat.format(n);

export function fmtDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeZone: "Asia/Jerusalem" }).format(date);
}

export function formatDateTime(value: Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(value);
}
