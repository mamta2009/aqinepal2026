"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardKicker } from "@/components/ui/card";
import {
  accountKeys,
  useAccountActions,
  useAccountMutation,
  useAccountQueryClient,
} from "@/hooks/use-account";
import { accountApi, type AccountProfile } from "@/lib/api/account";
import {
  deleteAccountSchema,
  type DeleteAccountValues,
} from "@/lib/validation/account";

const actions = [
  { key: "stocked_oxygen", label: "Stocked O₂", details: "✓ Stocked O₂ cylinders" },
  { key: "staff_called", label: "Staff called", details: "✓ Pediatric staff briefed" },
  {
    key: "protocol_reviewed",
    label: "Protocol reviewed",
    details: "✓ Rapid triage protocol reviewed",
  },
] as const;

function sites(profile: AccountProfile) {
  if (profile.facility_names?.length) return profile.facility_names;
  return profile.facility_name
    ? profile.facility_name.split("·").map((item) => item.trim()).filter(Boolean)
    : [];
}

export function ActionsPanel({ profile }: { profile: AccountProfile }) {
  const queryClient = useAccountQueryClient();
  const query = useAccountActions(true);
  const facilityNames = sites(profile);
  const create = useAccountMutation(accountApi.createAction, {
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountKeys.actions }),
  });

  return (
    <Card id="actions">
      <CardKicker>Operational readiness</CardKicker>
      <h2 className="text-2xl font-black text-ink">Preparedness actions</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Log a completed action against the correct facility. Each entry is kept in the
        server audit trail.
      </p>
      {!profile.facility_reporting_ready ? (
        <p className="mt-4 rounded-xl bg-warning-amber/10 p-4 text-sm font-bold text-ink">
          Action logging requires a verified, approved account with a linked facility.
        </p>
      ) : null}
      <div className="mt-4 grid gap-3">
        {facilityNames.length ? (
          facilityNames.map((site) => (
            <section key={site} className="rounded-xl border border-border p-4">
              <h3 className="font-black text-ink">{site}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.map((action) => (
                  <Button
                    key={action.key}
                    size="sm"
                    variant="secondary"
                    disabled={!profile.facility_reporting_ready || create.isPending}
                    onClick={() =>
                      create.mutate({
                        action_type: action.key,
                        details: action.details,
                        facility_site: site,
                      })
                    }
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <p className="rounded-xl bg-mist p-4 text-ink-muted">
            Add a facility before logging preparedness actions.
          </p>
        )}
      </div>
      {create.error ? (
        <p className="mt-3 text-sm font-semibold text-alert-red" role="alert">
          {create.error.message}
        </p>
      ) : create.isSuccess ? (
        <p className="mt-3 text-sm font-semibold text-forest-dark" role="status">
          Action logged.
        </p>
      ) : null}

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-lg font-black text-ink">Recent action log</h3>
        {query.isPending ? (
          <p className="mt-3 text-ink-muted">Loading action history…</p>
        ) : query.error ? (
          <p className="mt-3 text-alert-red">{query.error.message}</p>
        ) : !query.data?.entries.length ? (
          <p className="mt-3 text-ink-muted">No preparedness actions logged yet.</p>
        ) : (
          <ol className="mt-3 divide-y divide-border">
            {query.data.entries.map((entry) => (
              <li key={entry._id} className="flex flex-wrap justify-between gap-2 py-3">
                <span>
                  <strong className="block text-ink">
                    {entry.action_type.replaceAll("_", " ")}
                  </strong>
                  <span className="text-sm text-ink-muted">
                    {entry.facility_site || entry.facility_name || "Facility"}
                  </span>
                </span>
                <time className="text-xs font-semibold text-ink-muted">
                  {entry.timestamp
                    ? new Date(entry.timestamp).toLocaleString()
                    : "Time unavailable"}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

export function DeleteAccountPanel({
  onDeleted,
  defaultOpen = false,
}: {
  onDeleted: () => void;
  defaultOpen?: boolean;
}) {
  const form = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "", confirm: "" as "DELETE" },
  });
  const remove = useAccountMutation(accountApi.deleteAccount, {
    onSuccess: async () => {
      await accountApi.logout();
      onDeleted();
    },
  });
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      id="security"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-2xl border border-alert-red/30 bg-white p-6"
    >
      <summary className="cursor-pointer text-lg font-black text-alert-red">
        Delete account
      </summary>
      <div className="mt-4 max-w-xl">
        <p className="text-sm text-ink-muted">
          This permanently removes your registrant account and associated personal data.
          You must be signed in with your password; an OTP-only session cannot delete it.
        </p>
        <form
          className="mt-4 grid gap-3"
          onSubmit={form.handleSubmit((values) => {
            if (
              window.confirm(
                "Permanently delete your account and personal data? This cannot be undone.",
              )
            ) {
              remove.mutate(values);
            }
          })}
        >
          <label className="grid gap-1.5 text-sm font-bold text-ink">
            Current password
            <input
              className="min-h-11 rounded-xl border border-border-strong px-3"
              type="password"
              autoComplete="current-password"
              {...form.register("password")}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-ink">
            Type DELETE to confirm
            <input
              className="min-h-11 rounded-xl border border-border-strong px-3"
              autoComplete="off"
              {...form.register("confirm")}
            />
          </label>
          <p className="text-sm font-semibold text-alert-red" role="alert">
            {form.formState.errors.password?.message ||
              form.formState.errors.confirm?.message ||
              remove.error?.message}
          </p>
          <Button className="justify-self-start" variant="danger" type="submit" disabled={remove.isPending}>
            {remove.isPending ? "Deleting…" : "Permanently delete account"}
          </Button>
        </form>
      </div>
    </details>
  );
}
