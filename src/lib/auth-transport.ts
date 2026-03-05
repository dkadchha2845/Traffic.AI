/**
 * XHR-based authentication transport with multi-strategy fallback.
 * Handles restrictive network environments where fetch() may fail.
 */

export type AuthTransportOptions = {
  includeAuthorizationHeader?: boolean;
  useFormEncoding?: boolean;
  passApiKeyInQuery?: boolean;
};

export const isFetchFailure = (value: unknown): boolean => {
  const message =
    typeof value === "object" && value && "message" in value
      ? String((value as { message?: unknown }).message ?? "")
      : "";
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("network request failed") ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed")
  );
};

export const xhrAuthRequest = async (
  path: string,
  payload: Record<string, unknown>,
  options: AuthTransportOptions = {}
): Promise<{ data: any; error: { message: string } | null }> => {
  const {
    includeAuthorizationHeader = true,
    useFormEncoding = false,
    passApiKeyInQuery = false,
  } = options;

  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/${path}`;
  const authUrl = passApiKeyInQuery
    ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(anonKey)}`
    : baseUrl;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", authUrl, true);

    if (useFormEncoding) {
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
    } else {
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    }

    if (!passApiKeyInQuery) {
      xhr.setRequestHeader("apikey", anonKey);
    }

    if (includeAuthorizationHeader) {
      xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`);
    }

    xhr.onload = () => {
      let parsed: any = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ data: parsed, error: null });
        return;
      }

      resolve({
        data: null,
        error: {
          message:
            parsed?.msg ||
            parsed?.error_description ||
            parsed?.error ||
            `Auth request failed (${xhr.status})`,
        },
      });
    };

    xhr.onerror = () => {
      resolve({
        data: null,
        error: {
          message:
            "Network error while reaching authentication service. Please check your connection and retry.",
        },
      });
    };

    if (useFormEncoding) {
      const formPayload = new URLSearchParams(
        Object.entries(payload).reduce((acc, [key, value]) => {
          if (value === undefined || value === null) return acc;
          acc[key] = typeof value === "string" ? value : JSON.stringify(value);
          return acc;
        }, {} as Record<string, string>)
      );
      xhr.send(formPayload.toString());
      return;
    }

    xhr.send(JSON.stringify(payload));
  });
};

/** Transport strategies ordered by reliability */
export const SIGN_IN_TRANSPORTS: AuthTransportOptions[] = [
  { includeAuthorizationHeader: true },
  { includeAuthorizationHeader: false },
  { includeAuthorizationHeader: false, useFormEncoding: true, passApiKeyInQuery: true },
];

export const SIGN_UP_TRANSPORTS: AuthTransportOptions[] = [
  { includeAuthorizationHeader: true },
  { includeAuthorizationHeader: false },
];
