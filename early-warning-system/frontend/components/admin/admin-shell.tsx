"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAdminSession } from "@/hooks/use-admin-session";
import { AdminNav } from "./admin-nav";
import { AdminPinGate } from "./admin-pin-gate";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const session = useAdminSession();

  if (session.isProbing) {
    return (
      <div className="page-shell py-16">
        <Card className="mx-auto max-w-lg text-center" aria-live="polite">
          <h1 className="text-2xl font-extrabold">Operator console</h1>
          <p className="text-muted">Checking your secure operator session…</p>
        </Card>
      </div>
    );
  }

  if (!session.isAuthenticated) {
    return <AdminPinGate session={session} />;
  }

  return (
    <div className="page-shell py-8 sm:py-12">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Secure operations</p>
          <h1 className="m-0 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Operator console
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            Manage service health, enrolment, audit anchors, and restricted
            guidance. Authentication stays in an HttpOnly server session.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={session.logout.isPending}
          onClick={() => session.logout.mutate()}
        >
          {session.logout.isPending ? "Locking…" : "Lock console"}
        </Button>
      </header>
      <AdminNav />
      {children}
    </div>
  );
}
