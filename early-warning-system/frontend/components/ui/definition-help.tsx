"use client";

import { CircleHelp } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

const OPEN_DELAY_MS = 250;
const CLOSE_DELAY_MS = 150;
/** Ignore hover briefly after touch so iOS/Android don’t re-open via synthetic mouse events. */
const TOUCH_HOVER_GUARD_MS = 800;

function useFineHover() {
  const [fineHover, setFineHover] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFineHover(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return fineHover;
}

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
  const fineHover = useFineHover();
  const rootRef = useRef<HTMLSpanElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreHoverUntilRef = useRef(0);
  const lastPointerTypeRef = useRef<string>("mouse");
  const panelId = useId();

  const clearTimers = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => () => clearTimers(), []);

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

  const scheduleOpen = () => {
    if (Date.now() < ignoreHoverUntilRef.current) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (open) return;
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      setOpen(true);
    }, OPEN_DELAY_MS);
  };

  const scheduleClose = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, CLOSE_DELAY_MS);
  };

  return (
    <span
      className="relative inline-flex shrink-0"
      ref={rootRef}
      onMouseEnter={() => {
        if (fineHover) scheduleOpen();
      }}
      onMouseLeave={() => {
        if (fineHover) scheduleClose();
      }}
    >
      <button
        type="button"
        className={`inline-grid size-6 cursor-pointer place-items-center rounded-full border border-forest/45 bg-white text-forest-dark transition hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest/25 ${open ? "" : "help-hint-pulse"}`}
        aria-label={`What does ${label} mean?`}
        aria-expanded={open}
        aria-controls={panelId}
        onPointerDown={(event) => {
          lastPointerTypeRef.current = event.pointerType || "mouse";
        }}
        onClick={() => {
          clearTimers();
          if (lastPointerTypeRef.current === "touch") {
            ignoreHoverUntilRef.current = Date.now() + TOUCH_HOVER_GUARD_MS;
          }
          setOpen((value) => !value);
        }}
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
