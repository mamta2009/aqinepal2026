"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRegistration } from "@/hooks/use-registration";
import {
  CHANNELS,
  CITIES,
  CONTACT_TYPES,
  registrationSchema,
  TOPICS,
  type RegistrationParsed,
  type RegistrationValues,
} from "@/validation/registration";
import { VerificationPanel } from "./verification-panel";

const ROLE_LABELS: Record<(typeof CONTACT_TYPES)[number], string> = {
  health_worker: "Health worker / doctor",
  parent: "Parent / guardian",
  admin: "Administrator",
  government: "Government official",
};

const CHANNEL_LABELS = { sms: "SMS", whatsapp: "WhatsApp", email: "Email" };
const TOPIC_LABELS = { air: "Air quality", heat: "Heat" };

export function RegistrationForm() {
  const { cities: citiesResponse, citiesLoading, devReset, register, resetTestData } =
    useRegistration();
  const [result, setResult] = useState<{
    email: string;
    contactId: string;
    message: string;
    warnings: string[];
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [devPhrase, setDevPhrase] = useState("");
  const [devApiKey, setDevApiKey] = useState("");
  const [devStatus, setDevStatus] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const {
    register: field,
    control,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationValues, unknown, RegistrationParsed>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: "",
      email: "",
      phone_number: "",
      whatsapp_number: "",
      password: "",
      password_confirmation: "",
      contact_type: undefined,
      facility_names_text: "",
      cities: [],
      language: "en",
      preferred_channels: ["sms", "whatsapp", "email"],
      environmental_topics: ["air", "heat"],
      consent_given: false,
      privacy_accepted: false,
      research_data_use: false,
    },
  });

  const selectedCities = useWatch({ control, name: "cities" });
  const cityNames = useMemo(() => {
    const source = citiesResponse?.cities;
    if (Array.isArray(source)) {
      const names = source.map((city) => city.name).filter(Boolean);
      return names.length ? names : [...CITIES];
    }
    if (source && typeof source === "object") {
      const names = Object.keys(source);
      return names.length ? names : [...CITIES];
    }
    return [...CITIES];
  }, [citiesResponse]);

  const facilityIdeas = useMemo(() => {
    const presets = citiesResponse?.facility_presets_by_city || {};
    return [
      ...new Set(
        (selectedCities || []).flatMap((city) => presets[city] || []),
      ),
    ];
  }, [citiesResponse, selectedCities]);

  async function onSubmit(values: RegistrationParsed) {
    setSubmitError(null);
    try {
      const response = await register(values);
      const next = {
        email: values.email,
        contactId: response.contact_id || "",
        message: response.message || "Registration received. Check for your code.",
        warnings: response.warnings || [],
      };
      setResult(next);
      try {
        sessionStorage.setItem("ew_reg_email", next.email);
        if (next.contactId) {
          sessionStorage.setItem("ew_reg_contact_id", next.contactId);
        }
      } catch {
        // Storage can be blocked; the visible verification fields still work.
      }
      reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Registration failed. Please try again.",
      );
    }
  }

  function appendFacility(name: string) {
    const current = getValues("facility_names_text") || "";
    const lines = current
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.includes(name)) lines.push(name);
    setValue("facility_names_text", lines.join("\n"), { shouldDirty: true });
  }

  async function runDevReset() {
    if (!devReset?.enabled) return;
    setDevBusy(true);
    setDevStatus(null);
    try {
      const response = await resetTestData(devPhrase, devApiKey || undefined);
      setDevStatus(
        `${response.message || "Test data cleared."} Contacts: ${response.contacts_deleted ?? "?"}; consent records: ${response.consent_records_deleted ?? "?"}.`,
      );
      setDevPhrase("");
    } catch (error) {
      setDevStatus(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setDevBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      {result && (
        <div className="rounded-2xl border border-leaf bg-surface-tint p-5" role="status">
          <h2 className="text-xl font-extrabold text-forest-dark">
            Registration successful
          </h2>
          <p className="mt-1">{result.message}</p>
          {result.contactId && (
            <p className="mt-2 text-sm">
              Reference ID: <code>{result.contactId}</code>
            </p>
          )}
          {result.warnings.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm text-amber-900">
              {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <Section number="1" title="About you">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" error={errors.name?.message}>
              <input {...field("name")} autoComplete="name" className={inputClass} />
            </FormField>
            <FormField label="Email address" error={errors.email?.message}>
              <input
                {...field("email")}
                type="email"
                autoComplete="email"
                className={inputClass}
                placeholder="sita@example.com"
              />
            </FormField>
            <FormField
              label="Phone number"
              error={errors.phone_number?.message}
              help="Use international E.164 format, for example +9779812345678"
            >
              <input
                {...field("phone_number")}
                type="tel"
                autoComplete="tel"
                className={inputClass}
                placeholder="+9779812345678"
              />
            </FormField>
            <FormField
              label="WhatsApp number (optional)"
              error={errors.whatsapp_number?.message}
              help="Leave blank to use your phone number."
            >
              <input
                {...field("whatsapp_number")}
                type="tel"
                autoComplete="tel"
                className={inputClass}
                placeholder="+9779812345678"
              />
            </FormField>
            <FormField label="Dashboard password" error={errors.password?.message}>
              <div className="relative mt-1">
                <input
                  {...field("password")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="min-h-11 w-full rounded-xl border border-border-strong bg-white px-3 py-2 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-ink"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff className="size-5" aria-hidden />
                  ) : (
                    <Eye className="size-5" aria-hidden />
                  )}
                </button>
              </div>
            </FormField>
            <FormField
              label="Confirm password"
              error={errors.password_confirmation?.message}
            >
              <div className="relative mt-1">
                <input
                  {...field("password_confirmation")}
                  type={showPasswordConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  className="min-h-11 w-full rounded-xl border border-border-strong bg-white px-3 py-2 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm((value) => !value)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-ink"
                  aria-label={
                    showPasswordConfirm
                      ? "Hide password confirmation"
                      : "Show password confirmation"
                  }
                  aria-pressed={showPasswordConfirm}
                >
                  {showPasswordConfirm ? (
                    <EyeOff className="size-5" aria-hidden />
                  ) : (
                    <Eye className="size-5" aria-hidden />
                  )}
                </button>
              </div>
            </FormField>
          </div>
        </Section>

        <Section number="2" title="Your facility or workplace">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Your role" error={errors.contact_type?.message}>
              <select {...field("contact_type")} className={inputClass}>
                <option value="">Select your role</option>
                {CONTACT_TYPES.map((type) => (
                  <option key={type} value={type}>{ROLE_LABELS[type]}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Preferred language">
              <select {...field("language")} className={inputClass}>
                <option value="en">English</option>
                <option value="ne">नेपाली (Nepali)</option>
              </select>
            </FormField>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-bold">Municipality / coverage area</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {cityNames.map((city) => (
                <label key={city} className={choiceClass}>
                  <input
                    type="checkbox"
                    value={city}
                    {...field("cities")}
                    disabled={!CITIES.includes(city as (typeof CITIES)[number])}
                  />
                  {city}
                </label>
              ))}
            </div>
            {citiesLoading && <p className="mt-2 text-xs text-muted">Loading current city presets…</p>}
            <ErrorText>{errors.cities?.message}</ErrorText>
          </fieldset>

          <FormField
            label="Facility name(s)"
            error={errors.facility_names_text?.message}
            help="Optional for some roles. Enter one hospital, clinic, health post, office, school, or site per line."
          >
            <textarea
              {...field("facility_names_text")}
              rows={4}
              className={inputClass}
              placeholder={"Patan Academy of Health Sciences\nWard 12 municipal clinic"}
            />
          </FormField>
          {facilityIdeas.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-muted">
                Illustrative name ideas for selected municipalities
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {facilityIdeas.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => appendFacility(name)}
                    className="rounded-full border border-border-strong bg-white px-3 py-1.5 text-xs font-bold hover:border-forest"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section number="3" title="How should we contact you?">
          <CheckboxGroup
            items={CHANNELS}
            labels={CHANNEL_LABELS}
            register={field("preferred_channels")}
          />
          <ErrorText>{errors.preferred_channels?.message}</ErrorText>
        </Section>

        <Section number="4" title="Which conditions matter to you?">
          <CheckboxGroup
            items={TOPICS}
            labels={TOPIC_LABELS}
            register={field("environmental_topics")}
          />
          <ErrorText>{errors.environmental_topics?.message}</ErrorText>
        </Section>

        <Section number="5" title="Consent and preferences">
          <div className="space-y-3">
            <Consent error={errors.consent_given?.message}>
              <input type="checkbox" {...field("consent_given")} />
              <span>I consent to receive alerts through the channels and topics selected above.</span>
            </Consent>
            <Consent error={errors.privacy_accepted?.message}>
              <input type="checkbox" {...field("privacy_accepted")} />
              <span>
                I agree to the{" "}
                <Link href="/privacy-policy" className="font-bold text-link underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </Consent>
            <Consent>
              <input type="checkbox" {...field("research_data_use")} />
              <span>I allow respiratory case data to support research (optional).</span>
            </Consent>
          </div>
        </Section>

        {submitError && (
          <p className="rounded-xl bg-red-50 p-4 text-red-800" role="alert">
            {submitError}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Registering…" : "Register & verify"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              reset();
              setSubmitError(null);
            }}
            disabled={isSubmitting}
          >
            Clear form
          </Button>
        </div>
      </form>

      <VerificationPanel
        key={`${result?.email || ""}:${result?.contactId || ""}`}
        initialEmail={result?.email}
        initialContactId={result?.contactId}
      />

      {devReset?.enabled && (
        <details className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <summary className="cursor-pointer font-extrabold text-amber-950">
            Development tools — clear registration test data
          </summary>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-amber-950">
              This deletes every contact and consent record. Type exactly:{" "}
              <strong>{devReset.confirmation_phrase}</strong>
            </p>
            <input
              value={devPhrase}
              onChange={(event) => setDevPhrase(event.target.value)}
              className={inputClass}
              placeholder={devReset.confirmation_phrase}
            />
            <input
              type="password"
              value={devApiKey}
              onChange={(event) => setDevApiKey(event.target.value)}
              className={inputClass}
              placeholder="NOTIFICATION_API_KEY (only if configured)"
            />
            <Button variant="danger" onClick={runDevReset} disabled={devBusy}>
              {devBusy ? "Clearing…" : "Clear contacts and consent records"}
            </Button>
            {devStatus && <p role="status" className="text-sm">{devStatus}</p>}
          </div>
        </details>
      )}
    </div>
  );
}

const inputClass =
  "mt-1 min-h-11 w-full rounded-xl border border-border-strong bg-white px-3 py-2";
const choiceClass =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-bold has-checked:border-forest has-checked:bg-surface-tint";

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="space-y-4">
      <h2 className="text-2xl font-extrabold">
        <span className="mr-2 inline-grid size-8 place-items-center rounded-full bg-forest text-sm text-white">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

function FormField({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-bold">
      {label}
      {children}
      {help && <span className="mt-1 block text-xs font-normal text-muted">{help}</span>}
      <ErrorText>{error}</ErrorText>
    </label>
  );
}

function ErrorText({ children }: { children?: React.ReactNode }) {
  return children ? <span className="mt-1 block text-xs text-red-700">{children}</span> : null;
}

function Consent({
  children,
  error,
}: {
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block rounded-xl border border-border bg-surface p-4">
      <span className="flex items-start gap-3 text-sm">{children}</span>
      <ErrorText>{error}</ErrorText>
    </label>
  );
}

function CheckboxGroup<T extends readonly string[]>({
  items,
  labels,
  register,
}: {
  items: T;
  labels: Record<T[number], string>;
  register: UseFormRegisterReturn;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <label key={item} className={choiceClass}>
          <input type="checkbox" value={item} {...register} />
          {labels[item as T[number]]}
        </label>
      ))}
    </div>
  );
}
