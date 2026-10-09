"use client";

import { CircleHelp } from "lucide-react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export function TermTooltip({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{term}</span>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger
          className="inline-grid size-6 place-items-center rounded-full border border-border-strong bg-white text-link focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest/25"
          aria-label={`What does ${term} mean?`}
        >
          <CircleHelp aria-hidden="true" size={15} />
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={8}
            className="z-50 max-w-72 rounded-xl bg-ink px-3 py-2 text-sm leading-relaxed text-white shadow-lg"
          >
            {children}
            <TooltipPrimitive.Arrow className="fill-ink" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </span>
  );
}
