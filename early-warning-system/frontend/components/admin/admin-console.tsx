"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAdminSession } from "@/hooks/use-admin-session";
import { AdminApiError } from "@/lib/api/admin";
import { pinSchema } from "@/lib/validation/admin";
import { BlockchainDocsPanel } from "./blockchain-docs-panel";
import { ErrorMessage, fieldClass, labelClass } from "./admin-ui";
import { OverviewPanel } from "./overview-panel";
import { RegistrantsPanel } from "./registrants-panel";

type Task = "overview" | "registrants" | "blockchain";

export function AdminConsole() {
  const session = useAdminSession();
  const [task, setTask] = useState<Task>("overview");

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
    return <PinGate session={session} />;
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

      <nav
        className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm"
        aria-label="Operator tasks"
      >
        <TaskButton active={task === "overview"} onClick={() => setTask("overview")}>
          Status & activity
        </TaskButton>
        <TaskButton active={task === "registrants"} onClick={() => setTask("registrants")}>
          Enrollees
        </TaskButton>
        <TaskButton active={task === "blockchain"} onClick={() => setTask("blockchain")}>
          Blockchain & docs
        </TaskButton>
      </nav>

      {task === "overview" ? <OverviewPanel /> : null}
      {task === "registrants" ? <RegistrantsPanel /> : null}
      {task === "blockchain" ? <BlockchainDocsPanel /> : null}
    </div>
  );
}

function PinGate({ session }: { session: ReturnType<typeof useAdminSession> }) {
  const [showPin, setShowPin] = useState(false);
  const form = useForm<{ pin: string }>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: "" },
  });
  const unlockError = session.unlock.error;
  let message: string | undefined;
  if (unlockError instanceof AdminApiError) {
    if (unlockError.status === 401) message = "Incorrect PIN — try again.";
    else if (unlockError.status === 503) {
      message = "MongoDB is unavailable; a secure operator session cannot be created.";
    } else message = unlockError.message;
  } else if (unlockError instanceof Error) {
    message = unlockError.message;
  } else if (
    session.probeError &&
    session.probeError.status !== 401
  ) {
    message = "The operator service could not be reached. You can retry below.";
  }

  return (
    <div className="page-shell py-12 sm:py-20">
      <Card className="mx-auto max-w-lg !p-6 sm:!p-8">
        <p className="eyebrow">Restricted area</p>
        <h1 className="m-0 text-3xl font-extrabold">Operator PIN</h1>
        <p className="mt-3 text-muted">
          Unlock this workstation with the configured operator PIN. Incorrect
          attempts are slowed by the server.
        </p>
        <form
          className="mt-6 grid gap-4"
          onSubmit={form.handleSubmit(({ pin }) =>
            session.unlock.mutate(pin, {
              onSuccess: () => form.reset(),
              onError: () => form.setValue("pin", ""),
            }),
          )}
        >
          <label className={labelClass}>
            PIN
            <div className="flex gap-2">
              <input
                className={fieldClass}
                type={showPin ? "text" : "password"}
                autoComplete="off"
                maxLength={240}
                autoFocus
                {...form.register("pin")}
              />
              <Button
                className="shrink-0"
                variant="secondary"
                onClick={() => setShowPin((current) => !current)}
                aria-pressed={showPin}
              >
                {showPin ? "Hide" : "Show"}
              </Button>
            </div>
          </label>
          <ErrorMessage message={form.formState.errors.pin?.message ?? message} />
          <Button type="submit" disabled={session.unlock.isPending}>
            {session.unlock.isPending ? "Unlocking…" : "Unlock console"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function TaskButton({
  active,
  children,
  ...props
}: {
  active: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-extrabold transition-colors ${active ? "bg-forest text-white" : "text-ink hover:bg-surface-tint"
        }`}
      aria-current={active ? "page" : undefined}
      {...props}
    >
      {children}
    </button>
  );
}
