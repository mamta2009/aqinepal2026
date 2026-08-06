"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
  ConfirmButton,
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "registrants"] }),
  });

  const rows = users.data?.registrants ?? [];
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "registrants"] });

  return (
    <>
      <Card className="!p-4 sm:!p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-2xl font-extrabold">Registered enrollees</h2>
            <p className={helpClass}>
              Search, update coverage, manage verification, or archive accounts.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>Add enrollee</Button>
        </div>

        <form
          className="mt-5 grid gap-3 rounded-xl bg-surface-tint p-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSkip(0);
            refresh();
          }}
        >
          <label className={labelClass}>
            Status
            <select
              className={fieldClass}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setSkip(0);
              }}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className={labelClass}>
            Email contains
            <input
              className={fieldClass}
              type="search"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 self-end text-sm font-bold">
            <input
              type="checkbox"
              checked={unmasked}
              onChange={(event) => setUnmasked(event.target.checked)}
            />
            Show full phone numbers
          </label>
          <Button className="self-end" type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>

        {users.isPending ? <p role="status">Loading registrants…</p> : null}
        {users.isError ? <ErrorMessage message={errorText(users.error)} /> : null}
        {mutate.isError ? <ErrorMessage message={errorText(mutate.error)} /> : null}
        {mutate.isSuccess ? (
          <p className="mt-3 text-sm font-bold text-aq-good" role="status">
            Enrollee operation completed.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 md:hidden">
          {rows.map((user) => (
            <RegistrantCard
              key={user._id}
              user={user}
              busy={mutate.isPending}
              onEdit={setEditing}
              onPassword={setPasswordTarget}
              onAction={(action) => mutate.mutate({ action, user })}
            />
          ))}
        </div>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="p-3">Identity</th>
                <th className="p-3">Facility / cities</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user._id} className="border-b border-border align-top">
                  <td className="p-3">
                    <strong>{user.email}</strong>
                    <br />
                    <span className="text-muted">{user.name}</span>
                    <br />
                    <code className="text-xs text-muted">{user._id}</code>
                  </td>
                  <td className="p-3">{facilityText(user)}</td>
                  <td className="p-3">{statusText(user)}</td>
                  <td className="p-3">
                    <UserActions
                      user={user}
                      busy={mutate.isPending}
                      onEdit={setEditing}
                      onPassword={setPasswordTarget}
                      onAction={(action) => mutate.mutate({ action, user })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!users.isPending && !rows.length ? (
          <p className="mt-5 text-center text-muted">No registrants match these filters.</p>
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
            Rows {rows.length ? skip + 1 : 0}–{skip + rows.length}
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
        cities={cities.data?.cities.map((city) => city.name) ?? []}
      />
      <EnrolmentDialog
        user={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        cities={cities.data?.cities.map((city) => city.name) ?? []}
      />
      <PasswordDialog
        user={passwordTarget}
        onOpenChange={(open) => !open && setPasswordTarget(null)}
      />
    </>
  );
}

function facilityText(user: Registrant) {
  const facilities =
    user.facility_names?.join(", ") || user.facility_name || "No facility";
  const cities = user.cities?.join(", ") || user.city || "No municipality";
  return (
    <>
      <strong>{facilities}</strong>
      {user.facility_id ? <div className="text-xs text-muted">ID: {user.facility_id}</div> : null}
      <div className="mt-1 text-muted">{cities}</div>
    </>
  );
}

function statusText(user: Registrant) {
  return (
    <>
      <strong className={user.active === false ? "text-alert-red" : "text-aq-good"}>
        {user.active === false ? "Archived" : "Active"}
      </strong>
      <div>Verification: {user.verification_status || "—"}</div>
      <div>Approval: {user.approval_status || "—"}</div>
    </>
  );
}

function RegistrantCard(props: UserActionProps) {
  return (
    <article className="rounded-xl border border-border p-4">
      <h3 className="font-extrabold break-all">{props.user.email}</h3>
      <p className="text-sm text-muted">{props.user.name}</p>
      <div className="my-3 text-sm">{facilityText(props.user)}</div>
      <div className="mb-3 text-sm">{statusText(props.user)}</div>
      <UserActions {...props} />
    </article>
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
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => onEdit(user)}>
        Sites / area
      </Button>
      {String(user.verification_status).toLowerCase() === "pending" ? (
        <ConfirmButton
          size="sm"
          variant="secondary"
          disabled={busy}
          prompt={`Send a fresh verification code to ${user.email || "this enrollee"}?`}
          onConfirm={() => onAction("resend")}
        >
          Resend verify
        </ConfirmButton>
      ) : null}
      <ConfirmButton
        size="sm"
        variant="secondary"
        disabled={busy}
        prompt={`${user.active === false ? "Restore" : "Archive"} ${user.email || "this enrollee"}?`}
        onConfirm={() => onAction(user.active === false ? "restore" : "archive")}
      >
        {user.active === false ? "Restore" : "Archive"}
      </ConfirmButton>
      <Button size="sm" onClick={() => onPassword(user)}>
        Password
      </Button>
      <ConfirmButton
        size="sm"
        variant="danger"
        disabled={busy}
        prompt={`Permanently delete ${user.email || user._id}? This cannot be undone.`}
        onConfirm={() => onAction("delete")}
      >
        Delete
      </ConfirmButton>
    </div>
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
      contact_type: "health_worker",
      cities: [],
      facility_names: "",
      facility_id: "",
      preferred_channels: ["sms", "email"],
      environmental_topics: ["air", "heat"],
      language: "en",
      consent_given: false,
      send_verification: false,
    },
  });
  const create = useMutation({
    mutationFn: (value: RegistrantInput) =>
      adminApi.createRegistrant({
        ...value,
        whatsapp_number: value.whatsapp_number || undefined,
        facility_id: value.facility_id || undefined,
        facility_names: lines(value.facility_names),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "registrants"] });
      form.reset();
      onOpenChange(false);
    },
  });
  return (
    <TaskDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add new enrollee"
      description="Creates the same account as public registration. Verification is immediate unless sending codes is selected."
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
        <TextField label="Name" error={form.formState.errors.name?.message} {...form.register("name")} />
        <TextField label="Email" type="email" error={form.formState.errors.email?.message} {...form.register("email")} />
        <TextField label="Phone (+ country code)" error={form.formState.errors.phone_number?.message} {...form.register("phone_number")} />
        <TextField label="WhatsApp (optional)" error={form.formState.errors.whatsapp_number?.message} {...form.register("whatsapp_number")} />
        <TextField label="Password" type="password" error={form.formState.errors.password?.message} {...form.register("password")} />
        <label className={labelClass}>
          Role
          <select className={fieldClass} {...form.register("contact_type")}>
            <option value="health_worker">Health worker</option>
            <option value="parent">Parent</option>
            <option value="admin">Administrator</option>
            <option value="government">Government</option>
            <option value="school_admin">School administrator</option>
          </select>
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Facility names (one per line)
          <textarea className={fieldClass} rows={2} {...form.register("facility_names")} />
        </label>
        <TextField label="Facility reference ID" {...form.register("facility_id")} />
        <TextField label="Language code" {...form.register("language")} />
        <label className={`${labelClass} sm:col-span-2`}>
          Municipality coverage
          <select className={`${fieldClass} min-h-36`} multiple {...form.register("cities")}>
            {cities.map((city) => <option key={city}>{city}</option>)}
          </select>
          <ErrorMessage message={form.formState.errors.cities?.message} />
        </label>
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
        />
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" {...form.register("consent_given")} /> Consent acknowledged
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" {...form.register("send_verification")} /> Send verification codes
        </label>
        <div className="sm:col-span-2">
          <ErrorMessage message={create.isError ? errorText(create.error) : undefined} />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create enrollee"}
          </Button>
        </div>
      </form>
    </TaskDialog>
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
      onOpenChange(false);
    },
  });
  return (
    <TaskDialog open={Boolean(user)} onOpenChange={onOpenChange} title="Facilities and coverage areas">
      <form className="grid gap-4" onSubmit={form.handleSubmit((value) => save.mutate(value))}>
        <label className={labelClass}>
          Facility names (one per line)
          <textarea className={fieldClass} rows={4} {...form.register("facility_names")} />
        </label>
        <TextField label="Facility reference ID" {...form.register("facility_id")} />
        <label className={labelClass}>
          Municipality coverage
          <select className={`${fieldClass} min-h-36`} multiple {...form.register("cities")}>
            {cities.map((city) => <option key={city}>{city}</option>)}
          </select>
          <ErrorMessage message={form.formState.errors.cities?.message} />
        </label>
        <ErrorMessage message={save.isError ? errorText(save.error) : undefined} />
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>
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
      form.reset();
      onOpenChange(false);
    },
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
    <fieldset className="rounded-xl border border-border p-3">
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
