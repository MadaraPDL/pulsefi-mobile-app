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
