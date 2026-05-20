export type DecimalLike = number | string;

export type AppUserSession = {
  access_token: string;
  token_type: "bearer";
  account_type: "app_user";
  account_id: string;
  full_name: string;
  email: string;
  username: string | null;
  role?: string | null;
};

export type CurrentAccount = {
  account_type: "admin" | "app_user";
  account_id: string;
  full_name: string;
  email: string;
  username: string | null;
  role: string | null;
  status: string;
  email_verified_at: string | null;
  mfa_enabled: boolean;
  mfa_required: boolean;
  preferred_mfa_method: string | null;
};

export type AppUserSummary = {
  id: string;
  isp_id: string;
  full_name: string;
  email: string;
  username: string | null;
  phone_number: string | null;
  status: string;
  email_verified_at: string | null;
  created_at: string | null;
  total_subscriptions: number;
  active_subscriptions: number;
};

export type MySubscriptionPlanSummary = {
  id: string;
  plan_name: string;
  monthly_price: DecimalLike;
  data_limit_gb: DecimalLike;
  speed_limit_mbps: DecimalLike | null;
  description: string | null;
  is_active: boolean;
};

export type MySubscription = {
  id: string;
  plan_id: string;
  subscription_label: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
  plan: MySubscriptionPlanSummary;
};

export type MyUsageTotals = {
  upload_mb: DecimalLike;
  download_mb: DecimalLike;
  total_mb: DecimalLike;
  record_count: number;
  first_record_start: string | null;
  last_record_end: string | null;
};

export type MyUsageSummary = {
  user_id: string;
  totals: MyUsageTotals;
};

export type MyUsageRecord = {
  id: string;
  user_subscription_id: string;
  router_id: string;
  device_id: string | null;
  upload_mb: DecimalLike;
  download_mb: DecimalLike;
  total_mb: DecimalLike;
  record_start: string;
  record_end: string;
  source: string | null;
  created_at: string;
};

export type MyDevice = {
  id: string;
  router_id: string;
  device_name: string | null;
  mac_address: string;
  ip_address: string | null;
  device_type: string | null;
  is_trusted: boolean;
  status: string;
  first_seen: string;
  last_seen: string | null;
  updated_at: string;
};

export type MyDeviceUsage = {
  id: string;
  router_id: string;
  device_name: string | null;
  mac_address: string;
  ip_address: string | null;
  device_type: string | null;
  is_trusted: boolean;
  status: string;
  first_seen: string;
  last_seen: string | null;
  updated_at: string;
  usage: MyUsageTotals;
};

export type MyAlert = {
  id: string;
  user_subscription_id: string;
  device_id: string | null;
  connection_log_id: string | null;
  usage_id: string | null;
  prediction_id: string | null;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  read_at: string | null;
  created_at: string;
};

export type MyPrediction = {
  id: string;
  user_subscription_id: string;
  plan_id: string | null;
  prediction_date: string;
  period_start: string;
  period_end: string;
  predicted_usage_gb: DecimalLike;
  confidence_score: DecimalLike | null;
  risk_level: string;
  model_version: string | null;
  created_at: string;
};

export type MyRecommendation = {
  id: string;
  user_subscription_id: string;
  current_plan_id: string | null;
  recommendation_plan_id: string | null;
  prediction_id: string | null;
  recommendation_type: string;
  recommendation_text: string;
  reason: string | null;
  confidence_score: DecimalLike | null;
  status: string;
  created_at: string;
};

export type MyPlanChangeRequest = {
  id: string;
  user_subscription_id: string;
  current_plan_id: string;
  requested_plan_id: string;
  recommendation_id: string | null;
  request_type: string;
  reason: string | null;
  status: string;
  requested_at: string;
  reviewed_by_admin_id: string | null;
  reviewed_at: string | null;
  admin_response: string | null;
  updated_at: string;
};

export type MyDevicePolicy = {
  id: string;
  device_id: string;
  router_id: string;
  policy_type: string;
  bandwidth_limit_mbps: DecimalLike | null;
  priority_level: number | null;
  status: string;
  requested_at: string;
  applied_at: string | null;
  failure_reason: string | null;
  is_active: boolean;
  updated_at: string;
};

export type MyRouterActionLog = {
  id: string;
  router_id: string;
  policy_id: string | null;
  action_type: string;
  command_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  status: string;
  error_message: string | null;
  executed_at: string;
};

export type MyDevicePolicyExecution = {
  policy: MyDevicePolicy;
  action_log: MyRouterActionLog | null;
  message: string;
};
