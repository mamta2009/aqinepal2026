/** `GET /api/runtime-config` response (`main.py`). */
export interface RuntimeConfigResponse {
  public_api_origin: string | null;
  api_path_prefix: string;
  dashboard: {
    pm25_alert_threshold_ugm3: number;
    storage: string;
    note: string;
  };
  facility_actions: {
    auth_required: boolean;
    dashboard_login_endpoint: string;
    dashboard_me_endpoint: string;
    facility_login_endpoint: string;
    facility_token_endpoint: string;
    approval_required: boolean;
    auto_approve_note: string;
  };
  integrations: Record<string, unknown>;
}
