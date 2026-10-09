"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAdminSession } from "@/hooks/use-admin-session";
import { AdminApiError } from "@/lib/api/admin";
import { pinSchema } from "@/lib/validation/admin";
import { ErrorMessage, fieldClass, labelClass } from "./admin-ui";

export function AdminPinGate({
  session,
}: {
  session: ReturnType<typeof useAdminSession>;
}) {
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
      message =
        "MongoDB is unavailable; a secure operator session cannot be created.";
    } else message = unlockError.message;
  } else if (unlockError instanceof Error) {
    message = unlockError.message;
  } else if (session.probeError && session.probeError.status !== 401) {
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
          <ErrorMessage
            message={form.formState.errors.pin?.message ?? message}
          />
          <Button type="submit" disabled={session.unlock.isPending}>
            {session.unlock.isPending ? "Unlocking…" : "Unlock console"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
