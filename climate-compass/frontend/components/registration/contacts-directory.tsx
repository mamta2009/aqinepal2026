"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type DirectoryContact,
  useRegistration,
} from "@/hooks/use-registration";

export function ContactsDirectory() {
  const { loadDirectory } = useRegistration();
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [unmasked, setUnmasked] = useState(false);
  const [contacts, setContacts] = useState<DirectoryContact[] | null>(null);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!passphrase.trim()) {
      setStatus("Enter the directory passphrase.");
      return;
    }
    setLoading(true);
    setStatus(null);
    setContacts(null);
    try {
      const result = await loadDirectory(passphrase, unmasked);
      setContacts(result.contacts || []);
      setCount(result.count ?? result.contacts?.length ?? 0);
      setStatus("List loaded. The passphrase was not stored.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not load the directory.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="directory-passphrase" className="block text-sm font-bold">
            Directory passphrase
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                id="directory-passphrase"
                type={showPassphrase ? "text" : "password"}
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                autoComplete="off"
                className="min-h-11 w-full rounded-xl border border-border-strong px-3 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase((value) => !value)}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted"
                aria-label={`${showPassphrase ? "Hide" : "Show"} passphrase`}
                aria-pressed={showPassphrase}
              >
                {showPassphrase ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Loading…" : "Load list"}
            </Button>
          </div>
          <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
            <input
              type="checkbox"
              checked={unmasked}
              onChange={(event) => setUnmasked(event.target.checked)}
              className="mt-1"
            />
            Show full phone and WhatsApp numbers. Use only on a trusted device.
          </label>
          {status && <p role="status" className="text-sm text-muted">{status}</p>}
        </form>
      </Card>

      {contacts && (
        <Card className="overflow-hidden p-0">
          <p className="border-b border-border px-5 py-3 text-sm font-bold">
            Showing {count} contact{count === 1 ? "" : "s"}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
              <thead className="bg-surface">
                <tr>
                  {[
                    "Name", "Email", "Phone", "WhatsApp", "Type", "Topics",
                    "Coverage areas", "Facility", "Verified", "Approval",
                  ].map((heading) => (
                    <th key={heading} scope="col" className="px-4 py-3 font-extrabold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact, index) => (
                  <tr key={`${contact.email || "contact"}-${index}`} className="border-t border-border align-top">
                    {directoryCells(contact).map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3">{cell}</td>
                    ))}
                  </tr>
                ))}
                {contacts.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-5 py-10 text-center text-muted">
                      No contacts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function directoryCells(contact: DirectoryContact) {
  const topics = Array.isArray(contact.environmental_topics)
    ? contact.environmental_topics.length
      ? contact.environmental_topics.join(", ")
      : "(none)"
    : "air & heat (default)";
  const cities = contact.cities?.length
    ? contact.cities.join(", ")
    : contact.city || "";
  const facilities = contact.facility_names?.length
    ? contact.facility_names.join(" · ")
    : contact.facility_name || contact.facility_id || "";

  return [
    contact.name || "",
    contact.email || "",
    contact.phone_number || "",
    contact.whatsapp_number || "",
    contact.contact_type || "",
    topics,
    cities,
    facilities,
    contact.verification_status === "verified"
      ? "yes"
      : contact.verification_status || "",
    contact.approval_status || "(legacy)",
  ];
}
