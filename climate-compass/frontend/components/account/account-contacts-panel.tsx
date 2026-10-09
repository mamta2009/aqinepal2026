"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardKicker } from "@/components/ui/card";
import {
  accountKeys,
  useAccountContacts,
  useAccountMutation,
  useAccountQueryClient,
} from "@/hooks/use-account";
import {
  accountApi,
  AccountApiError,
  type SharedContact,
} from "@/lib/api/account";
import {
  contactSchema,
  notifySchema,
  type ContactValues,
} from "@/lib/validation/account";

const inputClass =
  "min-h-11 w-full rounded-xl border border-border-strong bg-white px-3 text-ink outline-none focus:border-forest focus:ring-3 focus:ring-forest/15";
const labelClass = "grid gap-1.5 text-sm font-bold text-ink";

export function ContactsPanel() {
  const queryClient = useAccountQueryClient();
  const query = useAccountContacts(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState("");
  const [notifyError, setNotifyError] = useState("");
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      display_name: "",
      channel: "sms",
      phone_e164: "",
      email: "",
    },
  });
  const channel = useWatch({ control: form.control, name: "channel" });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: accountKeys.contacts });

  const save = useAccountMutation(
    (values: ContactValues) => {
      const body = {
        display_name: values.display_name,
        channel: values.channel,
        phone_e164: values.channel === "email" ? null : values.phone_e164,
        email: values.channel === "email" ? values.email : null,
      };
      return editing
        ? accountApi.updateContact(editing, body)
        : accountApi.createContact(body);
    },
    {
      onSuccess: () => {
        setNotice(editing ? "Contact updated." : "Contact added.");
        setEditing(null);
        form.reset();
        refresh();
      },
    },
  );
  const remove = useAccountMutation(accountApi.deleteContact, {
    onSuccess: (_, id) => {
      setSelected((items) => items.filter((item) => item !== id));
      setNotice("Contact removed.");
      refresh();
    },
  });
  const notify = useAccountMutation(accountApi.notifyContacts, {
    onSuccess: (result) => {
      const sent = result.results.filter((item) => item.ok).length;
      setNotice(`Sent to ${sent} of ${result.results.length} selected contacts.`);
      setNotifyError("");
      setMessage("");
      setConsent(false);
      refresh();
      queryClient.invalidateQueries({ queryKey: ["account", "notifications"] });
    },
    onError: (error) => {
      setNotifyError(
        error instanceof AccountApiError && error.status === 429
          ? `${error.message} Please wait until the daily limit resets.`
          : error.message,
      );
    },
  });

  const startEdit = (contact: SharedContact) => {
    setEditing(contact.id);
    form.reset({
      display_name: contact.display_name,
      channel: contact.channel,
      phone_e164: contact.phone_e164 || "",
      email: contact.email || "",
    });
  };
  const send = () => {
    const parsed = notifySchema.safeParse({
      contact_ids: selected,
      message,
      confirm_recipients_consented: consent,
    });
    if (!parsed.success) {
      setNotifyError(parsed.error.issues[0]?.message || "Check the message form.");
      return;
    }
    notify.mutate(parsed.data);
  };
  const limits = query.data?.limits;

  return (
    <Card id="contacts">
      <CardKicker>People you trust</CardKicker>
      <h2 className="text-2xl font-black text-ink">Trusted contacts</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Save friends or family who agreed to receive messages from you.
        {limits
          ? ` ${query.data?.contacts.length || 0}/${limits.max_contacts} saved; ${limits.notify_recipients_sent_today}/${limits.notify_recipients_daily_max} sends used today (UTC).`
          : ""}
      </p>

      <form
        className="mt-5 grid gap-3 rounded-xl border border-border bg-mist/40 p-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
      >
        <label className={labelClass}>
          Display name
          <input className={inputClass} {...form.register("display_name")} />
          <span className="text-xs text-alert-red">
            {form.formState.errors.display_name?.message}
          </span>
        </label>
        <label className={labelClass}>
          Channel
          <select className={inputClass} {...form.register("channel")}>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
        </label>
        {channel === "email" ? (
          <label className={`${labelClass} sm:col-span-2`}>
            Email address
            <input className={inputClass} type="email" {...form.register("email")} />
            <span className="text-xs text-alert-red">
              {form.formState.errors.email?.message}
            </span>
          </label>
        ) : (
          <label className={`${labelClass} sm:col-span-2`}>
            Phone in international format
            <input
              className={inputClass}
              type="tel"
              placeholder="+977…"
              {...form.register("phone_e164")}
            />
            <span className="text-xs text-alert-red">
              {form.formState.errors.phone_e164?.message}
            </span>
          </label>
        )}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Add contact"}
          </Button>
          {editing ? (
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(null);
                form.reset();
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {query.isPending ? (
        <p className="mt-4 text-ink-muted">Loading contacts…</p>
      ) : query.error ? (
        <p className="mt-4 text-alert-red">{query.error.message}</p>
      ) : !query.data?.contacts.length ? (
        <p className="mt-4 rounded-xl bg-mist p-4 text-ink-muted">
          No trusted contacts yet.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {query.data.contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
            >
              <label className="flex min-h-11 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(contact.id)}
                  onChange={(event) =>
                    setSelected((items) =>
                      event.target.checked
                        ? [...items, contact.id]
                        : items.filter((id) => id !== contact.id),
                    )
                  }
                  aria-label={`Select ${contact.display_name}`}
                />
                <span>
                  <strong className="block text-ink">{contact.display_name}</strong>
                  <span className="text-sm text-ink-muted">
                    {contact.channel} · {contact.email || contact.phone_e164}
                  </span>
                </span>
              </label>
              <Button size="sm" variant="ghost" onClick={() => startEdit(contact)}>
                <Pencil size={16} aria-hidden /> Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Remove ${contact.display_name}?`)) {
                    remove.mutate(contact.id);
                  }
                }}
              >
                <Trash2 size={16} aria-hidden /> Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 grid gap-3 border-t border-border pt-5">
        <h3 className="text-lg font-black text-ink">Notify selected contacts</h3>
        <label className={labelClass}>
          Message
          <textarea
            className={`${inputClass} min-h-28 py-3`}
            maxLength={1200}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <label className="flex items-start gap-2 text-sm font-semibold text-ink">
          <input
            className="mt-1"
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          I confirm these recipients agreed to receive this message.
        </label>
        <Button
          className="justify-self-start"
          disabled={notify.isPending}
          onClick={send}
        >
          {notify.isPending ? "Sending…" : `Send to selected (${selected.length})`}
        </Button>
        <p
          className={`text-sm font-semibold ${notifyError ? "text-alert-red" : "text-ink-muted"}`}
          role="status"
        >
          {notifyError || save.error?.message || remove.error?.message || notice}
        </p>
      </div>
    </Card>
  );
}
