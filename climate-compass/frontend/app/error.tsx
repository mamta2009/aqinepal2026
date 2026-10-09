"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="page-shell section-space text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="section-title">Climate Compass could not load this page.</h1>
      <p className="section-lede mx-auto mt-4">
        Check your connection and try again. Existing official guidance should
        be followed while data is unavailable.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </section>
  );
}
