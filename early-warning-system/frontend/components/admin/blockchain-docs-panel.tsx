"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminApi, Anchor, JsonObject } from "@/lib/api/admin";
import { outcomeSchema, OutcomeInput } from "@/lib/validation/admin";
import {
  ConfirmButton,
  ErrorMessage,
  fieldClass,
  helpClass,
  labelClass,
} from "./admin-ui";

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "The operation failed.";

export function BlockchainDocsPanel() {
  return (
    <div className="grid gap-5">
      <BlockchainPanel />
      <PrivateDocsPanel />
    </div>
  );
}

function BlockchainPanel() {
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ["admin", "blockchain", "overview"],
    queryFn: adminApi.blockchainOverview,
  });
  const anchors = useQuery({
    queryKey: ["admin", "blockchain", "anchors"],
    queryFn: adminApi.anchors,
  });
  const facilities = useQuery({
    queryKey: ["admin", "outcome-facilities"],
    queryFn: () =>
      adminApi.registrants({
        skip: 0,
        limit: 400,
        filter: "active",
        email: "",
        unmasked: false,
      }),
  });
  const network = useMutation({
    mutationFn: adminApi.patchNetwork,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin", "blockchain"],
      });
    },
  });
  const smoke = useMutation({
    mutationFn: adminApi.smokeTouch,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin", "blockchain"],
      });
    },
  });
  const form = useForm<OutcomeInput>({
    resolver: zodResolver(outcomeSchema),
    defaultValues: {
      facility_id: "",
      facility_display_name: "",
      day: new Date().toISOString().slice(0, 10),
      respiratory_cases: 0,
      severe_cases: 0,
    },
  });
  const outcome = useMutation({
    mutationFn: (value: OutcomeInput) =>
      adminApi.logOutcome(value as unknown as JsonObject),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["admin", "blockchain", "anchors"],
      }),
  });
  const overviewError = overview.isError ? errorText(overview.error) : undefined;
  const operationError = network.error ?? smoke.error;

  return (
    <Card className="!p-4 sm:!p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-2xl font-extrabold">Polygon operations</h2>
          <p className={helpClass}>
            Runtime network changes reset when the API process restarts.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() =>
            queryClient.invalidateQueries({
              queryKey: ["admin", "blockchain"],
            })
          }
        >
          Refresh
        </Button>
      </div>
      <ErrorMessage message={overviewError ?? (operationError ? errorText(operationError) : undefined)} />
      {overview.isPending ? (
        <p role="status">Checking signer and RPC…</p>
      ) : overview.data ? (
        <div className="mt-4 rounded-xl border border-border bg-surface-tint p-4">
          <div className="flex flex-wrap items-center gap-2">
            <strong className={overview.data.is_mainnet ? "text-alert-red" : "text-aq-good"}>
              {overview.data.is_mainnet ? "MAINNET" : String(overview.data.onchain_network ?? "testnet").toUpperCase()}
            </strong>
            <span>Chain {overview.data.chain_id ?? "—"}</span>
            <span>· RPC {overview.data.rpc_connected ? "online" : "offline"}</span>
            <span>· transaction logging {overview.data.polygon_onchain_log ? "on" : "off"}</span>
          </div>
          <p className="mt-2 break-all text-sm">
            Signer: <code>{overview.data.wallet_address || "Not configured"}</code>
          </p>
          <p className="text-sm">Native balance: {overview.data.balance_native ?? "—"}</p>
          {overview.data.hint ? <ErrorMessage message={overview.data.hint} /> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {overview.data.testnet_faucets?.map((faucet) => (
              <a
                key={faucet.url}
                className="font-bold text-link underline"
                href={faucet.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {faucet.name}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Runtime network">
        <Button size="sm" onClick={() => network.mutate("amoy")} disabled={network.isPending}>
          Use Amoy
        </Button>
        <ConfirmButton
          size="sm"
          variant="danger"
          disabled={network.isPending}
          prompt="Switch this API process to Polygon mainnet? Mainnet uses real POL."
          onConfirm={() => network.mutate("mainnet")}
        >
          Use mainnet
        </ConfirmButton>
        <Button size="sm" variant="secondary" onClick={() => network.mutate(null)} disabled={network.isPending}>
          Follow environment
        </Button>
        <ConfirmButton
          size="sm"
          variant="secondary"
          disabled={smoke.isPending}
          prompt={
            overview.data?.is_mainnet
              ? "This smoke test may spend real POL on mainnet. Continue?"
              : overview.data?.polygon_onchain_log
                ? "Send a test transaction using test POL?"
                : "On-chain logging is off; this will only create a Mongo audit row. Continue?"
          }
          onConfirm={() => smoke.mutate()}
        >
          {smoke.isPending ? "Submitting…" : "Run smoke test"}
        </ConfirmButton>
      </div>
      {smoke.isSuccess ? (
        <p className="mt-3 text-sm font-bold text-aq-good" role="status">
          Smoke test completed. Review the anchors below.
        </p>
      ) : null}

      <OutcomeForm
        form={form}
        pending={outcome.isPending}
        error={outcome.error}
        success={outcome.isSuccess}
        facilities={facilities.data?.registrants ?? []}
        onSubmit={(value) => outcome.mutate(value)}
      />

      <div className="mt-7">
        <h3 className="text-xl font-extrabold">Recent anchors</h3>
        {anchors.isPending ? <p role="status">Loading anchors…</p> : null}
        {anchors.isError ? <ErrorMessage message={errorText(anchors.error)} /> : null}
        <div className="mt-3 grid gap-3 md:hidden">
          {anchors.data?.anchors.map((anchor) => (
            <AnchorCard key={anchor._id || `${anchor.timestamp}-${anchor.event_type}`} anchor={anchor} />
          ))}
        </div>
        <div className="hidden max-h-96 overflow-auto md:block">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-border">
                <th className="p-3">Time (UTC)</th>
                <th className="p-3">Type</th>
                <th className="p-3">Source</th>
                <th className="p-3">Chain / detail</th>
              </tr>
            </thead>
            <tbody>
              {anchors.data?.anchors.map((anchor) => (
                <tr key={anchor._id || `${anchor.timestamp}-${anchor.event_type}`} className="border-b border-border align-top">
                  <td className="p-3 whitespace-nowrap">{anchor.timestamp || "—"}</td>
                  <td className="p-3">{anchor.event_type || "—"}</td>
                  <td className="p-3">{anchor.source || "—"}</td>
                  <td className="max-w-md p-3 break-words"><AnchorDetail anchor={anchor} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!anchors.isPending && !anchors.data?.anchors.length ? (
          <p className="text-muted">No anchor rows yet.</p>
        ) : null}
      </div>
    </Card>
  );
}

function OutcomeForm({
  form,
  pending,
  error,
  success,
  facilities,
  onSubmit,
}: {
  form: ReturnType<typeof useForm<OutcomeInput>>;
  pending: boolean;
  error: Error | null;
  success: boolean;
  facilities: Awaited<ReturnType<typeof adminApi.registrants>>["registrants"];
  onSubmit: (value: OutcomeInput) => void;
}) {
  return (
    <form className="mt-7 rounded-xl border border-border p-4" onSubmit={form.handleSubmit(onSubmit)}>
      <h3 className="text-xl font-extrabold">Log outcome measurement</h3>
      <label className={labelClass}>
        Fill from an active facility
        <select
          className={fieldClass}
          defaultValue=""
          onChange={(event) => {
            const selected = facilities.find((item) => item.facility_id === event.target.value);
            if (!selected) return;
            form.setValue("facility_id", selected.facility_id ?? "");
            form.setValue(
              "facility_display_name",
              selected.facility_names?.join(", ") || selected.facility_name || "",
            );
          }}
        >
          <option value="">Choose or enter manually below</option>
          {facilities.filter((item) => item.facility_id).map((item) => (
            <option key={item._id} value={item.facility_id}>
              {item.facility_names?.join(", ") || item.facility_name || item.name} — {item.facility_id}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <OutcomeField label="Facility name" error={form.formState.errors.facility_display_name?.message} {...form.register("facility_display_name")} />
        <OutcomeField label="Facility ID" error={form.formState.errors.facility_id?.message} {...form.register("facility_id")} />
        <OutcomeField label="Date" type="date" error={form.formState.errors.day?.message} {...form.register("day")} />
        <OutcomeField label="Respiratory cases" type="number" min={0} error={form.formState.errors.respiratory_cases?.message} {...form.register("respiratory_cases", { valueAsNumber: true })} />
        <OutcomeField label="Severe cases" type="number" min={0} error={form.formState.errors.severe_cases?.message} {...form.register("severe_cases", { valueAsNumber: true })} />
      </div>
      <ErrorMessage message={error ? errorText(error) : undefined} />
      {success ? <p className="text-sm font-bold text-aq-good">Outcome recorded.</p> : null}
      <Button className="mt-3" type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit outcome"}</Button>
    </form>
  );
}

function OutcomeField({
  label,
  error,
  ...props
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={labelClass}>
      {label}
      <input className={fieldClass} {...props} />
      <ErrorMessage message={error} />
    </label>
  );
}

function AnchorDetail({ anchor }: { anchor: Anchor }) {
  return (
    <>
      {anchor.explorer_url ? (
        <a className="font-bold text-link underline" href={anchor.explorer_url} target="_blank" rel="noopener noreferrer">
          Polygon transaction
        </a>
      ) : (
        <span>{anchor.skipped_reason || anchor.error || "—"}</span>
      )}
      {anchor.detail ? (
        <pre className="mt-1 overflow-auto text-xs whitespace-pre-wrap text-muted">
          {JSON.stringify(anchor.detail, null, 2)}
        </pre>
      ) : null}
    </>
  );
}

function AnchorCard({ anchor }: { anchor: Anchor }) {
  return (
    <article className="rounded-xl border border-border p-4 text-sm">
      <strong>{anchor.event_type || "Event"}</strong>
      <span className="ml-2 text-muted">{anchor.timestamp || "—"}</span>
      <p>{anchor.source || "—"}</p>
      <AnchorDetail anchor={anchor} />
    </article>
  );
}

function PrivateDocsPanel() {
  const [selected, setSelected] = useState("");
  const files = useQuery({
    queryKey: ["admin", "private-documents"],
    queryFn: adminApi.privateDocuments,
  });
  const document = useQuery({
    queryKey: ["admin", "private-document", selected],
    queryFn: () => adminApi.privateDocument(selected),
    enabled: Boolean(selected),
  });
  return (
    <Card className="!p-4 sm:!p-6">
      <h2 className="m-0 text-2xl font-extrabold">Private documentation</h2>
      <p className={helpClass}>
        Partner-restricted Markdown rendered as server-sanitized HTML.
      </p>
      {files.isError ? <ErrorMessage message={errorText(files.error)} /> : null}
      <label className={`${labelClass} mt-4 max-w-2xl`}>
        Document
        <select
          className={fieldClass}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          disabled={files.isPending}
        >
          <option value="">{files.isPending ? "Loading…" : "Choose a file"}</option>
          {files.data?.paths.map((path) => <option key={path}>{path}</option>)}
        </select>
      </label>
      {document.isPending && selected ? <p role="status">Opening document…</p> : null}
      {document.isError ? <ErrorMessage message={errorText(document.error)} /> : null}
      {document.data ? (
        <article className="mt-5 max-h-[36rem] overflow-auto rounded-xl border border-border bg-white p-5">
          <h3 className="text-xl font-extrabold">{document.data.title}</h3>
          <div
            className="mt-4 space-y-3 [&_a]:text-link [&_a]:underline [&_h1]:text-2xl [&_h2]:text-xl [&_li]:ml-5 [&_li]:list-disc [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-slate-950 [&_pre]:p-3 [&_pre]:text-white"
            // The API uses guide_documents.markdown_to_html_fragment, which sanitizes this fragment.
            dangerouslySetInnerHTML={{ __html: document.data.html_fragment }}
          />
        </article>
      ) : null}
    </Card>
  );
}
