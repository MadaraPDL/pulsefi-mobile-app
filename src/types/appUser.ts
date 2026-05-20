export type AppUserSession = {
  access_token: string;
  token_type: string;
  account_type: "app_user";
  account_id: string;
  full_name: string;
  email: string;
  username?: string | null;
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
