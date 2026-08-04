function apiUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
  const normalized = path.replace(/^\/+/, "");
  return base ? `${base}/${normalized}` : `/${normalized}`;
}

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

async function browserApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    const detail =
      typeof payload.detail === "string"
        ? payload.detail
        : `Request failed (HTTP ${response.status}).`;
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("admin-session-expired"));
    }
    throw new AdminApiError(detail, response.status);
  }
  return payload as T;
}

const json = (value: unknown) => JSON.stringify(value);

export type JsonObject = Record<string, unknown>;

export interface Registrant extends JsonObject {
  _id: string;
  name?: string;
  email?: string;
  phone_number?: string;
  whatsapp_number?: string;
  active?: boolean;
  verification_status?: string;
  approval_status?: string;
  facility_id?: string;
  facility_name?: string;
  facility_names?: string[];
  city?: string;
  cities?: string[];
}

export interface RegistrantsPage {
  skip: number;
  limit: number;
  filter_status: string;
  has_more: boolean;
  count_this_page: number;
  registrants: Registrant[];
}

export interface BlockchainOverview extends JsonObject {
  polygon_onchain_log?: boolean;
  onchain_network?: string;
  env_blockchain_onchain_network?: string;
  runtime_network_override?: string | null;
  chain_id?: number;
  is_mainnet?: boolean;
  private_key_configured?: boolean;
  rpc_connected?: boolean;
  wallet_address?: string | null;
  balance_native?: string | null;
  explorer_wallet_url?: string | null;
  deploy_note?: string;
  hint?: string;
  testnet_faucets?: { name: string; url: string }[];
}

export interface Anchor extends JsonObject {
  _id?: string;
  timestamp?: string;
  event_type?: string;
  source?: string;
  explorer_url?: string;
  skipped_reason?: string;
  error?: string;
  detail?: JsonObject;
}

export const adminApi = {
  probeSession: () => browserApi<JsonObject>("/api/admin/system-status"),
  unlock: (pin: string) =>
    browserApi<{ success: boolean }>("/api/admin/console-unlock-pin", {
      method: "POST",
      body: json({ pin }),
    }),
  logout: () =>
    browserApi<{ success: boolean }>("/api/admin/console-session-logout", {
      method: "POST",
      body: "{}",
    }),
  runtimeConfig: () => browserApi<JsonObject>("/api/runtime-config"),
  connectionStatus: () =>
    browserApi<JsonObject>("/api/public/connection-status"),
  cities: () => browserApi<{ cities: { name: string }[] }>("/api/cities"),
  patchThreshold: (pm25_alert_threshold_ugm3: number) =>
    browserApi<JsonObject>("/api/admin/dashboard-settings", {
      method: "PATCH",
      body: json({ pm25_alert_threshold_ugm3 }),
    }),
  systemStatus: () => browserApi<JsonObject>("/api/admin/system-status"),
  activitySummary: () => browserApi<JsonObject>("/api/admin/activity/summary"),
  recentLogs: () =>
    browserApi<{ count: number; entries: JsonObject[] }>(
      "/api/admin/activity/recent-action-logs?limit=30",
    ),
  registrants: (params: {
    skip: number;
    filter: string;
    email: string;
    unmasked: boolean;
    limit?: number;
  }) => {
    const query = new URLSearchParams({
      skip: String(params.skip),
      limit: String(params.limit ?? 50),
      filter_status: params.filter,
    });
    if (params.email.trim()) query.set("email_contains", params.email.trim());
    if (params.unmasked) query.set("unmasked_phones", "true");
    return browserApi<RegistrantsPage>(
      `/api/admin/registrants?${query.toString()}`,
    );
  },
  createRegistrant: (payload: JsonObject) =>
    browserApi<JsonObject>("/api/admin/registrants", {
      method: "POST",
      body: json(payload),
    }),
  patchActive: (id: string, active: boolean) =>
    browserApi<JsonObject>(`/api/admin/registrants/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: json({ active }),
    }),
  patchEnrolment: (id: string, payload: JsonObject) =>
    browserApi<JsonObject>(
      `/api/admin/registrants/${encodeURIComponent(id)}/enrolment`,
      { method: "PATCH", body: json(payload) },
    ),
  resetPassword: (id: string, new_password: string) =>
    browserApi<JsonObject>(
      `/api/admin/contacts/${encodeURIComponent(id)}/password`,
      { method: "PATCH", body: json({ new_password }) },
    ),
  resendVerification: (id: string) =>
    browserApi<JsonObject>(
      `/api/admin/registrants/${encodeURIComponent(id)}/resend-verification`,
      { method: "POST" },
    ),
  deleteRegistrant: (id: string) =>
    browserApi<JsonObject>(`/api/admin/registrants/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  blockchainOverview: () =>
    browserApi<BlockchainOverview>("/api/admin/blockchain/overview"),
  patchNetwork: (network: "amoy" | "mainnet" | null) =>
    browserApi<JsonObject>("/api/admin/blockchain/runtime-network", {
      method: "PATCH",
      body: json({ network }),
    }),
  anchors: () =>
    browserApi<{ count: number; anchors: Anchor[] }>(
      "/api/admin/blockchain/anchors?limit=40",
    ),
  smokeTouch: () =>
    browserApi<JsonObject>("/api/admin/blockchain/smoke-touch", {
      method: "POST",
      body: "{}",
    }),
  logOutcome: (payload: JsonObject) =>
    browserApi<JsonObject>("/api/admin/blockchain/log-outcome", {
      method: "POST",
      body: json(payload),
    }),
  privateDocuments: () =>
    browserApi<{ paths: string[]; count: number }>(
      "/api/admin/private-documentation/md-files",
    ),
  privateDocument: (path: string) =>
    browserApi<{ path: string; title: string; html_fragment: string }>(
      `/api/admin/private-documentation/md?path=${encodeURIComponent(path)}`,
    ),
};
