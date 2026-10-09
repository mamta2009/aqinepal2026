"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, X } from "lucide-react";
import { AqiHelpChat } from "@/components/aqi-help/aqi-help-chat";

export function FloatingHelpLauncher() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <aside className="fixed right-4 bottom-4 z-50">
      {open ? (
        <div
          className="fixed right-3 bottom-20 flex h-[min(38rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border-strong bg-white shadow-2xl"
          role="dialog"
          aria-modal="false"
          aria-labelledby="floating-help-title"
        >
          <div className="flex min-h-12 shrink-0 items-center justify-between border-b border-border px-3">
            <strong id="floating-help-title" className="inline-flex items-center gap-2 text-sm">
              <Bot className="size-4 text-forest" aria-hidden />
              aqiHelp
            </strong>
            <div className="flex items-center gap-0.5">
              <a
                href="/help/aqi-help/"
                target="_blank"
                rel="noreferrer"
                className="grid size-9 place-items-center rounded-full text-forest hover:bg-surface-tint"
                aria-label="Open full aqiHelp page"
              >
                <ExternalLink className="size-4" />
              </a>
              <button
                ref={closeRef}
                type="button"
                className="grid size-9 place-items-center rounded-full hover:bg-surface"
                onClick={() => setOpen(false)}
                aria-label="Close aqiHelp"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <AqiHelpChat embed />
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid size-14 place-items-center rounded-full bg-forest text-white shadow-xl hover:bg-forest-dark"
        aria-expanded={open}
        aria-label={open ? "Close aqiHelp" : "Open aqiHelp"}
      >
        {open ? <X className="size-6" aria-hidden /> : <Bot className="size-6" aria-hidden />}
      </button>
    </aside>
  );
}
