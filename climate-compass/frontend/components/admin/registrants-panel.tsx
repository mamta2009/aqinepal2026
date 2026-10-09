"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Archive,
  ArchiveRestore,
  KeyRound,
  LoaderCircle,
  MapPinned,
  Send,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminApi, Registrant } from "@/lib/api/admin";
import {
  enrolmentSchema,
  EnrolmentInput,
  passwordSchema,
  RegistrantInput,
  registrantSchema,
} from "@/lib/validation/admin";
import {
  ErrorMessage,
  fieldClass,
  helpClass,
  labelClass,
  TaskDialog,
} from "./admin-ui";

const lines = (value: string) =>
  value
    .split(/[\r\n;,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "The operation failed.";

const compactFieldClass =
  "h-9 min-h-9 w-full rounded-lg border border-border-strong bg-white px-2.5 text-sm text-ink focus:border-forest focus:outline-none";

const ROLE_LABELS: Record<RegistrantInput["contact_type"], string> = {
  health_worker: "Health worker / doctor",
  parent: "Parent / guardian",
  admin: "Administrator",
  government: "Government official",
  school_admin: "School administrator",
};

export function RegistrantsPanel() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [email, setEmail] = useState("");
  const [skip, setSkip] = useState(0);
  const [unmasked, setUnmasked] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Registrant | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Registrant | null>(null);

  const params = { skip, filter, email, unmasked };
  const users = useQuery({
    queryKey: ["admin", "registrants", params],
    queryFn: () => adminApi.registrants(params),
  });
  const cities = useQuery({
    queryKey: ["admin", "cities"],
    queryFn: adminApi.cities,
    staleTime: 30 * 60_000,
  });
  const mutate = useMutation({
    mutationFn: async ({
      action,
      user,
    }: {
      action: "archive" | "restore" | "resend" | "delete";
      user: Registrant;
    }) => {
      if (action === "archive") return adminApi.patchActive(user._id, false);
      if (action === "restore") return adminApi.patchActive(user._id, true);
      if (action === "resend") return adminApi.resendVerification(user._id);
      return adminApi.deleteRegistrant(user._id);
    },
    onSuccess: (_data, { action, user }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "registrants"] });
      const who = user.email || user.name || "Enrollee";
      if (action === "archive") toast.success(`${who} archived.`);
      else if (action === "restore") toast.success(`${who} restored.`);
      else if (action === "resend") toast.success(`Verification code sent to ${who}.`);
      else toast.success(`${who} deleted.`);
    },
    onError: (error, { action }) => {
      const fail =
        action === "archive"
          ? "Could not archive enrollee."
          : action === "restore"
            ? "Could not restore enrollee."
            : action === "resend"
              ? "Could not send verification code."
              : "Could not delete enrollee.";
      toast.error(errorText(error) || fail);
    },
  });

  const deletingId =
    mutate.isPending && mutate.variables?.action === "delete"
      ? mutate.variables.user._id
      : null;
  const rows = users.data?.registrants ?? [];
  const cityNames = cities.data?.cities.map((city) => city.name) ?? [];
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "registrants"] });

  return (
    <>
      <Card className="!p-4 sm:!p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="m-0 text-2xl font-extrabold">Registered enrollees</h2>
            <p className={helpClass}>
              People who signed up for alerts. Add enrollee uses the same details
              as the public registration form. Verification can be skipped here
              when you already know the person.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>Add enrollee</Button>
        </div>

        <form
          className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface px-3 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSkip(0);
            refresh();
          }}
        >
          <label className="grid gap-1 text-xs font-bold text-ink">
            Account status
            <select
              className={compactFieldClass}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setSkip(0);
              }}
            >
              <option value="all">Everyone</option>
              <option value="active">Active only</option>
              <option value="archived">Archived only</option>
            </select>
          </label>
          <label className="grid min-w-56 flex-1 gap-1 text-xs font-bold text-ink">
            Search email
            <input
              className={compactFieldClass}
              type="search"
              value={email}
              placeholder="part of an email address"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="flex h-9 items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={unmasked}
              onChange={(event) => setUnmasked(event.target.checked)}
            />
            Show full phone numbers
          </label>
          <Button type="submit" size="sm" variant="secondary">
            Apply filters
          </Button>
        </form>

        {users.isPending ? <p role="status">Loading registrants…</p> : null}
        {users.isError ? <ErrorMessage message={errorText(users.error)} /> : null}
        {mutate.isError ? <ErrorMessage message={errorText(mutate.error)} /> : null}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[42%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="px-3 py-2 font-extrabold">Name</th>
                <th className="px-3 py-2 font-extrabold">Coverage</th>
                <th className="px-3 py-2 font-extrabold">Status</th>
                <th className="px-3 py-2 font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => {
                const deleting = deletingId === user._id;
                return (
                  <tr key={user._id} className={`border-b border-border align-middle ${deleting ? "bg-red-50/70" : ""}`}>
                    <td className="px-3 py-2.5">
                      <strong className="block truncate">{user.name || "Unnamed enrollee"}</strong>
                      <span className="block truncate text-xs text-muted">{user.email}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {String(user.contact_type || "").replaceAll("_", " ") || "Role not set"}
                        {user.phone_number ? ` · ${user.phone_number}` : ""}
                        {user.active === false ? " · archived" : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{coverageText(user)}</td>
                    <td className="px-3 py-2.5">
                      <StatusChips user={user} />
                    </td>
                    <td className="px-3 py-2.5">
                      {deleting ? (
                        <p className="m-0 flex items-center gap-2 text-xs font-extrabold text-alert-red" role="status">
                          <LoaderCircle className="size-4 animate-spin" aria-hidden />
                          Deleting…
                        </p>
                      ) : (
                        <UserActions
                          user={user}
                          busy={mutate.isPending}
                          onEdit={setEditing}
                          onPassword={setPasswordTarget}
                          onAction={(action) => mutate.mutate({ action, user })}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!users.isPending && !rows.length ? (
          <p className="mt-5 text-center text-muted">
            No registrants match these filters.
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            disabled={skip === 0 || users.isFetching}
            onClick={() => setSkip(Math.max(0, skip - 50))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted" aria-live="polite">
            Showing {rows.length ? skip + 1 : 0}–{skip + rows.length}
          </span>
          <Button
            variant="secondary"
            disabled={!users.data?.has_more || users.isFetching}
            onClick={() => setSkip(skip + 50)}
          >
            Next
          </Button>
        </div>
      </Card>

      <CreateRegistrantDialog
        open={creating}
        onOpenChange={setCreating}
        cities={cityNames}
      />
      <EnrolmentDialog
        user={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        cities={cityNames}
      />
      <PasswordDialog
        user={passwordTarget}
        onOpenChange={(open) => !open && setPasswordTarget(null)}
      />
    </>
  );
}

function coverageText(user: Registrant) {
  const cities = user.cities?.join(", ") || user.city || "No municipality";
  const facilities =
    user.facility_names?.join(", ") || user.facility_name || "";
  return (
    <div className="min-w-0">
      <p className="m-0 text-sm leading-5">{cities}</p>
      {facilities ? (
        <p className="m-0 mt-0.5 text-xs leading-5 text-muted">{facilities}</p>
      ) : null}
    </div>
  );
}

function StatusChips({ user }: { user: Registrant }) {
  const verified = String(user.verification_status || "").toLowerCase() === "verified";
  const approved = String(user.approval_status || "").toLowerCase() === "approved";
  return (
    <ul className="flex flex-wrap gap-1">
      <Chip
        label={verified ? "Verified" : "Pending"}
        tone={verified ? "good" : "pending"}
        detail={verified ? "Email or phone confirmed." : "Code not confirmed yet."}
      />
      <Chip
        label={approved ? "Approved" : "Pending"}
        tone={approved ? "good" : "pending"}
        detail={approved ? "Can receive alerts." : "Not approved for alerts yet."}
      />
    </ul>
  );
}

function Chip({
  label,
  tone,
  detail,
}: {
  label: string;
  tone: "good" | "pending";
  detail: string;
}) {
  return (
    <li>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className={`w-fit cursor-help rounded-md px-2 py-0.5 text-xs font-extrabold ${tone === "good"
              ? "bg-green-100 text-green-900"
              : "bg-yellow-100 text-yellow-900"
              }`}
          >
            {label}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="z-50 max-w-64 rounded-lg bg-ink px-2.5 py-2 text-xs font-semibold leading-5 text-white shadow-lg"
          >
            {detail}
            <Tooltip.Arrow className="fill-ink" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </li>
  );
}

type UserActionProps = {
  user: Registrant;
  busy: boolean;
  onEdit: (user: Registrant) => void;
  onPassword: (user: Registrant) => void;
  onAction: (action: "archive" | "restore" | "resend" | "delete") => void;
};

function UserActions({
  user,
  busy,
  onEdit,
  onPassword,
  onAction,
}: UserActionProps) {
  const archived = user.active === false;
  return (
    <div className="flex flex-wrap gap-2">
      <IconAction label="Edit coverage" onClick={() => onEdit(user)}>
        <MapPinned size={16} />
      </IconAction>
      {String(user.verification_status).toLowerCase() === "pending" ? (
        <IconAction
          label="Resend verification"
          disabled={busy}
          confirm={`Send a fresh verification code to ${user.email || "this enrollee"}?`}
          onClick={() => onAction("resend")}
        >
          <Send size={16} />
        </IconAction>
      ) : null}
      <IconAction
        label={archived ? "Restore account" : "Archive account"}
        disabled={busy}
        confirm={`${archived ? "Restore" : "Archive"} ${user.email || "this enrollee"}?`}
        onClick={() => onAction(archived ? "restore" : "archive")}
      >
        {archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
      </IconAction>
      <IconAction label="Set password" onClick={() => onPassword(user)}>
        <KeyRound size={16} />
      </IconAction>
      <IconAction
        label="Delete permanently"
        disabled={busy}
        danger
        confirm={`Permanently delete ${user.email || user._id}? This cannot be undone.`}
        onClick={() => onAction("delete")}
      >
        <Trash2 size={16} />
      </IconAction>
    </div>
  );
}

function IconAction({
  label,
  children,
  onClick,
  confirm,
  disabled,
  danger,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  confirm?: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={`inline-grid size-8 place-items-center rounded-lg border disabled:opacity-50 ${danger
            ? "border-red-200 bg-red-50 text-alert-red hover:bg-red-100"
            : "border-border bg-white text-ink hover:border-forest hover:text-forest"
            }`}
          disabled={disabled}
          aria-label={label}
          onClick={() => {
            if (confirm && !window.confirm(confirm)) return;
            onClick();
          }}
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          className="z-50 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-white shadow-lg"
        >
          {label}
          <Tooltip.Arrow className="fill-ink" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function CreateRegistrantDialog({
  open,
  onOpenChange,
  cities,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cities: string[];
}) {
  const queryClient = useQueryClient();
  const form = useForm<RegistrantInput>({
    resolver: zodResolver(registrantSchema),
    defaultValues: {
      name: "",
      email: "",
      phone_number: "",
      whatsapp_number: "",
      password: "",
      password_confirmation: "",
      contact_type: "health_worker",
      cities: [],
      facility_names: "",
      school_name: "",
      school_contact: "",
      school_address: "",
      school_information: "",
      facility_id: "",
      preferred_channels: ["sms", "whatsapp", "email"],
      environmental_topics: ["air", "heat"],
      language: "en",
      consent_given: true,
      send_verification: false,
    },
  });
  const contactType = useWatch({ control: form.control, name: "contact_type" });
  const isSchool = contactType === "school_admin";
  const create = useMutation({
    mutationFn: (value: RegistrantInput) => {
      const facilityNames = isSchool
        ? [value.school_name.trim()].filter(Boolean)
        : lines(value.facility_names);
      return adminApi.createRegistrant({
        name: value.name,
        email: value.email,
        phone_number: value.phone_number,
        whatsapp_number: value.whatsapp_number || undefined,
        password: value.password,
        contact_type: value.contact_type,
        cities: value.cities,
        facility_names: facilityNames,
        facility_id: value.facility_id || undefined,
        preferred_channels: value.preferred_channels,
        environmental_topics: value.environmental_topics,
        language: value.language,
        consent_given: value.consent_given,
        send_verification: value.send_verification,
        ...(isSchool
          ? {
            school_contact: value.school_contact.trim() || undefined,
            school_address: value.school_address.trim() || undefined,
            school_information: value.school_information.trim() || undefined,
          }
          : {}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "registrants"] });
      toast.success("Enrollee created.");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorText(error) || "Could not create enrollee."),
  });

  return (
    <TaskDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Add new enrollee"
      description="Same details as public registration. Leave Send verification codes unchecked to activate the account immediately."
    >
      <form
        className="grid gap-5"
        onSubmit={form.handleSubmit((value) => create.mutate(value))}
      >
        <FormSection title="About the person">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Full name" error={form.formState.errors.name?.message} {...form.register("name")} />
            <TextField label="Email" type="email" error={form.formState.errors.email?.message} {...form.register("email")} />
            <TextField
              label="Phone (+ country code)"
              error={form.formState.errors.phone_number?.message}
              {...form.register("phone_number")}
            />
            <TextField
              label="WhatsApp (optional)"
              error={form.formState.errors.whatsapp_number?.message}
              {...form.register("whatsapp_number")}
            />
            <TextField
              label="Dashboard password"
              type="password"
              error={form.formState.errors.password?.message}
              {...form.register("password")}
            />
            <TextField
              label="Confirm password"
              type="password"
              error={form.formState.errors.password_confirmation?.message}
              {...form.register("password_confirmation")}
            />
            <label className={labelClass}>
              Role
              <select className={fieldClass} {...form.register("contact_type")}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Language
              <select className={fieldClass} {...form.register("language")}>
                <option value="en">English</option>
                <option value="ne">Nepali</option>
              </select>
            </label>
          </div>
        </FormSection>

        <FormSection title={isSchool ? "School" : "Facility and coverage"}>
          <fieldset>
            <legend className="text-sm font-bold">Municipality coverage</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {cities.map((city) => (
                <label key={city} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold">
                  <input type="checkbox" value={city} {...form.register("cities")} />
                  {city}
                </label>
              ))}
            </div>
            <ErrorMessage message={form.formState.errors.cities?.message} />
          </fieldset>
          {isSchool ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="School name"
                error={form.formState.errors.school_name?.message}
                {...form.register("school_name")}
              />
              <TextField label="School contact" {...form.register("school_contact")} />
              <TextField label="School address" {...form.register("school_address")} />
              <label className={`${labelClass} sm:col-span-2`}>
                About the school
                <textarea className={fieldClass} rows={3} {...form.register("school_information")} />
              </label>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={`${labelClass} sm:col-span-2`}>
                Facility names (one per line)
                <textarea className={fieldClass} rows={3} {...form.register("facility_names")} />
              </label>
              <TextField label="Facility reference ID (optional)" {...form.register("facility_id")} />
            </div>
          )}
        </FormSection>

        <FormSection title="Alerts">
          <div className="grid gap-4 sm:grid-cols-2">
            <CheckboxGroup
              legend="Alert channels"
              options={[["sms", "SMS"], ["whatsapp", "WhatsApp"], ["email", "Email"]]}
              register={form.register("preferred_channels")}
              error={form.formState.errors.preferred_channels?.message}
            />
            <CheckboxGroup
              legend="Environmental topics"
              options={[["air", "Air quality"], ["heat", "Heat"]]}
              register={form.register("environmental_topics")}
              error={form.formState.errors.environmental_topics?.message}
            />
          </div>
        </FormSection>

        <FormSection title="Activation">
          <label className="flex items-start gap-2 text-sm font-bold">
            <input type="checkbox" className="mt-1" {...form.register("consent_given")} />
            Consent to receive alerts is acknowledged
          </label>
          <label className="flex items-start gap-2 text-sm font-bold">
            <input type="checkbox" className="mt-1" {...form.register("send_verification")} />
            Send verification codes (leave unchecked to activate now)
          </label>
        </FormSection>

        <div>
          <ErrorMessage message={create.isError ? errorText(create.error) : undefined} />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create enrollee"}
          </Button>
        </div>
      </form>
    </TaskDialog>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-surface p-4">
      <h3 className="m-0 text-base font-extrabold">{title}</h3>
      {children}
    </section>
  );
}

function EnrolmentDialog({
  user,
  onOpenChange,
  cities,
}: {
  user: Registrant | null;
  onOpenChange: (open: boolean) => void;
  cities: string[];
}) {
  const queryClient = useQueryClient();
  const form = useForm<EnrolmentInput>({
    resolver: zodResolver(enrolmentSchema),
    values: {
      cities: user?.cities ?? (user?.city ? [user.city] : []),
      facility_names: user?.facility_names?.join("\n") ?? user?.facility_name ?? "",
      facility_id: user?.facility_id ?? "",
    },
  });
  const save = useMutation({
    mutationFn: (value: EnrolmentInput) =>
      adminApi.patchEnrolment(user!._id, {
        ...value,
        facility_names: lines(value.facility_names),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "registrants"] });
      toast.success("Coverage updated.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorText(error) || "Could not update coverage."),
  });
  return (
    <TaskDialog
      open={Boolean(user)}
      onOpenChange={onOpenChange}
      title="Facilities and coverage areas"
    >
      <form className="grid gap-4" onSubmit={form.handleSubmit((value) => save.mutate(value))}>
        <label className={labelClass}>
          Facility names (one per line)
          <textarea className={fieldClass} rows={4} {...form.register("facility_names")} />
        </label>
        <TextField label="Facility reference ID" {...form.register("facility_id")} />
        <fieldset>
          <legend className="text-sm font-bold">Municipality coverage</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {cities.map((city) => (
              <label key={city} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold">
                <input type="checkbox" value={city} {...form.register("cities")} />
                {city}
              </label>
            ))}
          </div>
          <ErrorMessage message={form.formState.errors.cities?.message} />
        </fieldset>
        <ErrorMessage message={save.isError ? errorText(save.error) : undefined} />
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </TaskDialog>
  );
}

function PasswordDialog({
  user,
  onOpenChange,
}: {
  user: Registrant | null;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useForm<{ new_password: string }>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { new_password: "" },
  });
  const save = useMutation({
    mutationFn: ({ new_password }: { new_password: string }) =>
      adminApi.resetPassword(user!._id, new_password),
    onSuccess: () => {
      toast.success("Password updated.");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorText(error) || "Could not update password."),
  });
  return (
    <TaskDialog
      open={Boolean(user)}
      onOpenChange={onOpenChange}
      title="Set a new password"
      description={`For ${user?.email ?? "this enrollee"}. Share it through a secure channel.`}
    >
      <form className="grid gap-4" onSubmit={form.handleSubmit((value) => save.mutate(value))}>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.new_password?.message}
          {...form.register("new_password")}
        />
        <ErrorMessage message={save.isError ? errorText(save.error) : undefined} />
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </TaskDialog>
  );
}

function TextField({
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

function CheckboxGroup({
  legend,
  options,
  register,
  error,
}: {
  legend: string;
  options: readonly (readonly [string, string])[];
  register: ReturnType<ReturnType<typeof useForm<RegistrantInput>>["register"]>;
  error?: string;
}) {
  return (
    <fieldset className="rounded-xl border border-border bg-white p-3">
      <legend className="px-1 text-sm font-bold">{legend}</legend>
      <div className="flex flex-wrap gap-4">
        {options.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input type="checkbox" value={value} {...register} /> {label}
          </label>
        ))}
      </div>
      <ErrorMessage message={error} />
    </fieldset>
  );
}
