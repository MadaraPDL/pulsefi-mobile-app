import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

import { getAccessToken } from "../auth/session";

const DEFAULT_LOCAL_API_BASE_URL = "http://127.0.0.1:8000/api/v1";

type ApiOptions = RequestInit & {
  auth?: boolean;
};

type SourceCodeModule = {
  scriptURL?: string;
};

type WebLocationLike = {
  protocol?: string;
  hostname?: string;
};

type ExpoConstantsLike = {
  expoConfig?: {
    hostUri?: string | null;
  } | null;
  manifest?: {
    hostUri?: string | null;
    debuggerHost?: string | null;
  } | null;
  manifest2?: {
    extra?: {
      expoClient?: {
        hostUri?: string | null;
      } | null;
    } | null;
  } | null;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function extractHostname(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const withoutProtocol = value.trim().replace(/^[a-z]+:\/\//i, "");
  const hostname = withoutProtocol.split(/[/:?#]/)[0];

  return hostname || null;
}

function getWebApiBaseUrl() {
  const location = (globalThis as { location?: WebLocationLike }).location;

  if (!location?.hostname) {
    return null;
  }

  const protocol = location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${location.hostname}:8000/api/v1`;
}

function getExpoConstantsApiBaseUrl() {
  const constants = Constants as ExpoConstantsLike;

  const hostname =
    extractHostname(constants.expoConfig?.hostUri) ??
    extractHostname(constants.manifest2?.extra?.expoClient?.hostUri) ??
    extractHostname(constants.manifest?.hostUri) ??
    extractHostname(constants.manifest?.debuggerHost);

  if (!hostname) {
    return null;
  }

  return `http://${hostname}:8000/api/v1`;
}

function getExpoNativeApiBaseUrl() {
  const sourceCode = NativeModules.SourceCode as SourceCodeModule | undefined;
  const scriptUrl = sourceCode?.scriptURL;
  const hostname = extractHostname(scriptUrl);

  if (!hostname) {
    return null;
  }

  return `http://${hostname}:8000/api/v1`;
}

function getDefaultApiBaseUrl() {
  if (Platform.OS === "web") {
    return getWebApiBaseUrl() ?? DEFAULT_LOCAL_API_BASE_URL;
  }

  return (
    getExpoConstantsApiBaseUrl() ??
    getExpoNativeApiBaseUrl() ??
    DEFAULT_LOCAL_API_BASE_URL
  );
}

const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const API_BASE_URL = trimTrailingSlash(envApiBaseUrl || getDefaultApiBaseUrl());

console.log("PulseFi mobile API:", API_BASE_URL);

function parseApiErrorMessage(data: unknown) {
  const rawDetail = (data as { detail?: unknown })?.detail;
  const rawDetails = (data as { details?: unknown })?.details;
  const message = (data as { message?: unknown })?.message;

  function parseValidationItems(items: unknown[]) {
    return items
      .map((item) => {
        if (!item || typeof item !== "object") {
          return JSON.stringify(item);
        }

        const errorItem = item as {
          msg?: unknown;
          loc?: unknown;
          input?: unknown;
        };

        const msg =
          typeof errorItem.msg === "string"
            ? errorItem.msg
            : JSON.stringify(item);

        const loc = Array.isArray(errorItem.loc)
          ? errorItem.loc.filter((part) => part !== "body").join(".")
          : "";

        return loc ? `${loc}: ${msg}` : msg;
      })
      .join("\n");
  }

  if (Array.isArray(rawDetails)) {
    return parseValidationItems(rawDetails);
  }

  if (typeof rawDetail === "string") {
    return rawDetail;
  }

  if (Array.isArray(rawDetail)) {
    return parseValidationItems(rawDetail);
  }

  if (typeof message === "string") {
    return message;
  }

  return "Request failed. Please try again.";
}

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
    throw new Error(parseApiErrorMessage(data));
  }

  return data as T;
}
