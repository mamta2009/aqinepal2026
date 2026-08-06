"use client";

import { CircleHelp } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export function DefinitionHelp({
  label,
  children,
  align = "start",
}: {
  label: string;
  children: ReactNode;
  /** Panel horizontal alignment relative to the icon. */
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span className="relative inline-flex shrink-0" ref={rootRef}>
      <button
        type="button"
        className={`inline-grid size-6 cursor-pointer place-items-center rounded-full border border-forest/45 bg-white text-forest-dark transition hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest/25 ${open ? "" : "help-hint-pulse"}`}
        aria-label={`What does ${label} mean?`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <CircleHelp aria-hidden size={14} />
      </button>
      {open ? (
        <span
          id={panelId}
          role="dialog"
          aria-label={`${label} definition`}
          className={`absolute top-full z-40 mt-2 w-64 rounded-xl border border-border bg-white p-3 text-left text-sm leading-relaxed text-ink shadow-lg sm:w-72 ${align === "end" ? "right-0 left-auto" : "left-0"
            }`}
        >
          <span className="block font-extrabold text-ink">{label}</span>
          <span className="mt-1.5 block text-muted">{children}</span>
        </span>
      ) : null}
    </span>
  );
}
