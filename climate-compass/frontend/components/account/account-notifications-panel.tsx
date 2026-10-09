"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardKicker } from "@/components/ui/card";
import { useAccountNotifications } from "@/hooks/use-account";
import type { NotificationEntry } from "@/lib/api/account";

function NotificationDetail({ entry }: { entry: NotificationEntry }) {
  return (
    <div className="grid gap-3 text-sm">
      <p>
        <strong>Sent:</strong>{" "}
        {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "Unknown"}
      </p>
      <p>
        <strong>Channel:</strong> {entry.channel || "—"} ·{" "}
        <strong>Status:</strong> {entry.status || "—"}
      </p>
      <p>
        <strong>Context:</strong>{" "}
        {[entry.city, entry.alert_level].filter(Boolean).join(" · ") || "—"}
      </p>
      <div className="rounded-xl bg-mist p-4 whitespace-pre-wrap break-words text-ink">
        {entry.message || entry.message_preview || entry.error || "No content recorded."}
      </div>
    </div>
  );
}

export function NotificationsPanel() {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<NotificationEntry | null>(null);
  const query = useAccountNotifications(page, true);
  const entries = query.data?.entries || [];
  const total = query.data?.total ?? query.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / 10));

  return (
    <Card id="notifications">
      <CardKicker>Delivery history</CardKicker>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-ink">Notification inbox</h2>
        <Button size="sm" variant="secondary" onClick={() => query.refetch()}>
          Refresh
        </Button>
      </div>
      {query.isPending ? (
        <p className="mt-4 text-ink-muted" role="status">
          Loading notifications…
        </p>
      ) : query.error ? (
        <p className="mt-4 text-alert-red" role="alert">
          {query.error.message}
        </p>
      ) : entries.length === 0 ? (
        <p className="mt-4 rounded-xl bg-mist p-4 text-ink-muted">
          No notification deliveries are recorded yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {entries.map((entry, index) => (
            <li key={entry._id || `${entry.timestamp}-${index}`} className="py-3">
              <button
                className="grid w-full gap-1 rounded-lg p-2 text-left hover:bg-mist focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest/25"
                onClick={() => setSelected(entry)}
              >
                <span className="flex flex-wrap justify-between gap-2 font-black text-ink">
                  <span>{entry.channel?.toUpperCase() || "Alert"} · {entry.status || "unknown"}</span>
                  <time className="text-xs font-semibold text-ink-muted">
                    {entry.timestamp
                      ? new Date(entry.timestamp).toLocaleString()
                      : "Time unavailable"}
                  </time>
                </span>
                <span className="line-clamp-2 text-sm text-ink-muted">
                  {entry.message || entry.message_preview || entry.error || "View details"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <nav className="mt-4 flex items-center justify-between" aria-label="Notification pages">
        <Button
          size="sm"
          variant="secondary"
          disabled={page === 0 || query.isFetching}
          onClick={() => setPage((value) => Math.max(0, value - 1))}
        >
          <ChevronLeft size={16} aria-hidden /> Previous
        </Button>
        <span className="text-sm font-bold text-ink-muted">
          Page {page + 1} of {pages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page + 1 >= pages || query.isFetching}
          onClick={() => setPage((value) => value + 1)}
        >
          Next <ChevronRight size={16} aria-hidden />
        </Button>
      </nav>

      <Dialog.Root open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/55" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl focus:outline-none">
            <Dialog.Title className="pr-10 text-2xl font-black text-ink">
              Notification details
            </Dialog.Title>
            <Dialog.Description className="mt-1 mb-5 text-sm text-ink-muted">
              Full delivery record for this account.
            </Dialog.Description>
            {selected ? <NotificationDetail entry={selected} /> : null}
            <Dialog.Close
              className="absolute top-4 right-4 rounded-full p-2 text-ink hover:bg-mist"
              aria-label="Close notification details"
            >
              <X aria-hidden />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Card>
  );
}
