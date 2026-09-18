import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

/** The live site's form fields: 48px high, grey border (darkened to 3:1), rounded 6px. */
export const inputClass =
  "h-12 w-full rounded-md border border-field bg-white px-3 text-base text-ink placeholder:text-muted focus:outline-hidden focus:ring-2 focus:ring-accent aria-invalid:border-danger";

/** A labelled field with its error below; the error is tied to the input with aria-describedby. */
export function Field({ id, label, required, error, children }: { id: string; label: string; required?: boolean; error?: string; children: ReactNode }) {
  const errorId = `${id}-error`;
  const input = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-describedby": errorId,
        "aria-invalid": error ? true : undefined,
      })
    : children;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id}>
        {required ? (
          <>
            <span aria-hidden className="text-danger">
              *{" "}
            </span>
          </>
        ) : null}
        {label}
        {required ? <span className="sr-only"> (חובה)</span> : null}
      </label>
      {input}
      <p id={errorId} className="text-sm font-medium text-danger">
        {error ?? ""}
      </p>
    </div>
  );
}
