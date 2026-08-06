"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardKicker } from "@/components/ui/card";
import { useAccountMutation } from "@/hooks/use-account";
import { accountApi, type AccountProfile, type Channel } from "@/lib/api/account";
import {
  facilitySchema,
  type FacilityValues,
} from "@/lib/validation/account";

const inputClass =
  "min-h-11 w-full rounded-xl border border-border-strong bg-white px-3 text-ink outline-none focus:border-forest focus:ring-3 focus:ring-forest/15";

function sites(profile: AccountProfile) {
  if (profile.facility_names?.length) return profile.facility_names;
  return profile.facility_name
    ? profile.facility_name.split("·").map((name) => name.trim()).filter(Boolean)
    : [];
}

function roleLabel(contactType?: string) {
  switch (contactType) {
    case "health_worker":
      return "Health worker / doctor";
    case "parent":
      return "Parent / guardian";
    case "admin":
      return "Administrator";
    case "government":
      return "Government official";
    case "school_admin":
      return "School administrator";
    default:
      return contactType || "—";
  }
}

export function ProfilePanel({ profile }: { profile: AccountProfile }) {
  const isSchoolAdmin = profile.contact_type === "school_admin";
  const schoolName =
    profile.facility_names?.[0] ||
    profile.facility_name ||
    null;
  const rows: [string, string | undefined | null][] = [
    ["Name", profile.name],
    ["Email", profile.email],
    ["Phone", profile.phone_number],
    ["Role", roleLabel(profile.contact_type)],
    ["Coverage", profile.cities?.join(", ") || profile.city],
    ["Language", profile.language],
    ["Verification", profile.verification_status],
    ["Partner approval", profile.approval_status],
    ["Facility reporting", profile.facility_reporting_ready ? "Ready" : "Not ready"],
  ];

  if (isSchoolAdmin) {
    rows.push(
      ["School name", schoolName],
      ["School contact", profile.school_contact],
      ["School address", profile.school_address],
      ["About the school", profile.school_information],
    );
  }

  return (
    <Card id="profile">
      <CardKicker>Your registration</CardKicker>
      <h2 className="text-2xl font-black text-ink">Profile</h2>
      <dl className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className={
              label === "About the school"
                ? "border-b border-border pb-2 sm:col-span-2"
                : "border-b border-border pb-2"
            }
          >
            <dt className="text-xs font-extrabold tracking-wide text-ink-muted uppercase">
              {label}
            </dt>
            <dd className="mt-1 break-words whitespace-pre-wrap font-bold text-ink">
              {value || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function FacilitiesPanel({
  profile,
  onUpdated,
}: {
  profile: AccountProfile;
  onUpdated: () => void;
}) {
  const facilityNames = sites(profile);
  const [thresholds, setThresholds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      facilityNames.map((name) => [
        name,
        profile.facility_site_pm25_thresholds?.[name]?.toString() || "",
      ]),
    ),
  );
  const [notice, setNotice] = useState("");
  const form = useForm<FacilityValues>({
    resolver: zodResolver(facilitySchema),
    defaultValues: { name: "" },
  });
  const update = useAccountMutation(accountApi.patchPreferences, {
    onSuccess: () => onUpdated(),
  });
  const addFacility = form.handleSubmit(({ name }) => {
    setNotice("");
    update.mutate(
      { add_facility_name: name },
      {
        onSuccess: () => {
          form.reset();
          setNotice("Facility added.");
        },
      },
    );
  });
  const saveThresholds = () => {
    const payload = Object.fromEntries(
      Object.entries(thresholds)
        .filter(([, value]) => value !== "")
        .map(([name, value]) => [name, Number(value)]),
    );
    if (Object.values(payload).some((value) => value < 5 || value > 600)) {
      setNotice("Thresholds must be between 5 and 600 µg/m³.");
      return;
    }
    update.mutate(
      { facility_site_pm25_thresholds: payload },
      { onSuccess: () => setNotice("PM2.5 thresholds saved.") },
    );
  };

  return (
    <Card id="facilities">
      <CardKicker>Facilities and sites</CardKicker>
      <h2 className="text-2xl font-black text-ink">Sites you cover</h2>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={addFacility}>
        <div className="flex-1">
          <label className="sr-only" htmlFor="facility-name">
            Facility or site name
          </label>
          <input
            id="facility-name"
            className={inputClass}
            placeholder="Add a facility or site"
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <p className="mt-1 text-sm text-alert-red">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <Button type="submit" disabled={update.isPending}>
          Add facility
        </Button>
      </form>

      <div className="mt-5 grid gap-3">
        {facilityNames.length ? (
          facilityNames.map((name) => (
            <label
              key={name}
              className="grid gap-2 rounded-xl border border-border bg-mist/40 p-4 sm:grid-cols-[1fr_12rem] sm:items-center"
            >
              <span className="font-black text-ink">{name}</span>
              <span>
                <span className="mb-1 block text-xs font-bold text-ink-muted">
                  PM2.5 alert (µg/m³)
                </span>
                <input
                  className={inputClass}
                  type="number"
                  min={5}
                  max={600}
                  value={thresholds[name] || ""}
                  onChange={(event) =>
                    setThresholds((current) => ({
                      ...current,
                      [name]: event.target.value,
                    }))
                  }
                />
              </span>
            </label>
          ))
        ) : (
          <p className="rounded-xl bg-mist p-4 text-ink-muted">
            No facilities are registered yet. Add the first site above.
          </p>
        )}
      </div>
      {facilityNames.length ? (
        <Button className="mt-4" variant="secondary" onClick={saveThresholds}>
          Save thresholds
        </Button>
      ) : null}
      <p className="mt-3 text-sm font-semibold text-ink-muted" role="status">
        {update.error?.message || notice}
      </p>
    </Card>
  );
}

export function PreferencesPanel({
  profile,
  onUpdated,
}: {
  profile: AccountProfile;
  onUpdated: () => void;
}) {
  const [channels, setChannels] = useState<Channel[]>(
    profile.preferred_channels || [],
  );
  const [topics, setTopics] = useState<string[]>(profile.environmental_topics || []);
  const [consent, setConsent] = useState(profile.consent_given !== false);
  const [notice, setNotice] = useState("");
  const update = useAccountMutation(accountApi.patchPreferences, {
    onSuccess: () => {
      setNotice("Notification preferences saved.");
      onUpdated();
    },
  });

  const toggle = <T extends string>(
    value: T,
    current: T[],
    setter: (next: T[]) => void,
  ) => setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  return (
    <Card id="preferences">
      <CardKicker>Alerts</CardKicker>
      <h2 className="text-2xl font-black text-ink">Notification preferences</h2>
      <fieldset className="mt-4">
        <legend className="font-black text-ink">Channels</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {(["sms", "whatsapp", "email"] as Channel[]).map((channel) => (
            <label key={channel} className="flex min-h-11 items-center gap-2 font-bold text-ink">
              <input
                type="checkbox"
                checked={channels.includes(channel)}
                onChange={() => toggle(channel, channels, setChannels)}
              />
              {channel === "sms" ? "SMS" : channel[0].toUpperCase() + channel.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-4">
        <legend className="font-black text-ink">Environmental topics</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {["air", "heat"].map((topic) => (
            <label key={topic} className="flex min-h-11 items-center gap-2 font-bold text-ink">
              <input
                type="checkbox"
                checked={topics.includes(topic)}
                onChange={() => toggle(topic, topics, setTopics)}
              />
              {topic === "air" ? "Air quality" : "Heat"}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-ink">
        <input
          className="mt-1"
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        I consent to receive alerts through the selected channels.
      </label>
      <Button
        className="mt-4"
        disabled={update.isPending || channels.length === 0}
        onClick={() =>
          update.mutate({
            preferred_channels: channels,
            environmental_topics: topics,
            consent_given: consent,
          })
        }
      >
        {update.isPending ? "Saving…" : "Save preferences"}
      </Button>
      <p className="mt-3 text-sm font-semibold text-ink-muted" role="status">
        {update.error?.message ||
          (channels.length === 0 ? "Select at least one channel." : notice)}
      </p>
    </Card>
  );
}
