const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

type ApiEnvelope<T> = { data: T; meta?: unknown };
type ApiErrorBody = { error?: { code: string; message: string; requestId: string } };

export class ApiRequestError extends Error {
  readonly code: string;
  readonly requestId?: string;
  readonly status?: number;

  constructor(code: string, message: string, requestId?: string, status?: number) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.requestId = requestId;
    this.status = status;
  }
}

// Phase 2 replaces this with the Firebase ID token provider.
let tokenProvider: () => Promise<string | null> = async () => null;
export function setAuthTokenProvider(provider: () => Promise<string | null>): void {
  tokenProvider = provider;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const token = await tokenProvider();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const body = (await res.json().catch(() => null)) as
    | ApiEnvelope<unknown>
    | ApiErrorBody
    | null;

  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiRequestError(
      err?.code ?? "INTERNAL_ERROR",
      err?.message ?? "Request failed.",
      err?.requestId,
      res.status
    );
  }
  return body as ApiEnvelope<T>;
}
