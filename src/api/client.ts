import { getAccessToken } from "../auth/session";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

console.log("PulseFi mobile API:", API_BASE_URL);

type ApiOptions = RequestInit & {
  auth?: boolean;
};

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (options.auth !== false) {
    const token = await getAccessToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    console.log("PulseFi network error:", error);
    throw new Error(`Network request failed. Tried: ${API_BASE_URL}${path}`);
  }

  const text = await response.text();

  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const rawDetail = (data as { detail?: unknown })?.detail;

    let detail = "Request failed. Please try again.";

    if (typeof rawDetail === "string") {
      detail = rawDetail;
    } else if (Array.isArray(rawDetail)) {
      detail = rawDetail
        .map((item) => {
          if (
            item &&
            typeof item === "object" &&
            "msg" in item &&
            typeof item.msg === "string"
          ) {
            return item.msg;
          }

          return JSON.stringify(item);
        })
        .join("\n");
    }

    throw new Error(detail);
  }

  return data as T;
}
