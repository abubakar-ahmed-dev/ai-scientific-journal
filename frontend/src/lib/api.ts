const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export type ApiEnvelope<T> = { data: T; meta?: { nextCursor?: string | null; hasMore?: boolean; limit?: number } };
export type ApiErrorBody = { error?: { code: string; message: string; requestId: string } };

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

// User types & API
export interface UserProfile {
  ownerId: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  role: string;
  accountStatus: string;
  preferences: {
    theme: "light" | "dark" | "system";
    timezone: string;
    locationEnabled: boolean;
    aiSuggestionsEnabled: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export async function fetchMe() {
  return api<UserProfile>("/me");
}

export async function updateMe(patch: Partial<UserProfile>) {
  return api<UserProfile>("/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// Project types & API
export interface Project {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  field: string | null;
  status: "active" | "archived" | "completed";
  tags: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export async function fetchProjects(params: { limit?: number; cursor?: string; status?: string } = {}) {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.status) query.set("status", params.status);
  const qStr = query.toString();
  return api<Project[]>(`/projects${qStr ? `?${qStr}` : ""}`);
}

export async function fetchProject(projectId: string) {
  return api<Project>(`/projects/${projectId}`);
}

export async function createProject(data: { title: string; description?: string | null; field?: string | null; tags?: string[] }) {
  return api<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(projectId: string, data: Partial<Project>) {
  return api<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteProject(projectId: string) {
  const token = await tokenProvider();
  const res = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new ApiRequestError("INTERNAL_ERROR", "Failed to delete project", undefined, res.status);
  }
}

// Observation types & API
export interface Measurement {
  id?: string;
  name: string;
  value: number;
  unit: string;
  observedAt?: string | null;
  notes?: string | null;
}

export interface ObservationLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  label?: string | null;
  precision: "exact" | "approximate" | "hidden";
}

export interface Observation {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string;
  description: string;
  notes: string | null;
  hypothesis: string | null;
  observedAt: string;
  location: ObservationLocation | null;
  tags: string[];
  measurements: Measurement[];
  status: "draft" | "observed" | "analyzed" | "archived";
  mediaCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ObservationVersion {
  id: string;
  version: number;
  title: string;
  description: string;
  hypothesis: string | null;
  measurements: Measurement[];
  editedAt: string;
  editedBy: string;
  changeReason: string | null;
}

export async function fetchObservations(params: {
  limit?: number;
  cursor?: string;
  sort?: "updated" | "observed";
  projectId?: string;
  status?: string;
  tag?: string;
  q?: string;
} = {}) {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.sort) query.set("sort", params.sort);
  if (params.projectId) query.set("projectId", params.projectId);
  if (params.status) query.set("status", params.status);
  if (params.tag) query.set("tag", params.tag);
  if (params.q) query.set("q", params.q);
  const qStr = query.toString();
  return api<Observation[]>(`/observations${qStr ? `?${qStr}` : ""}`);
}

export async function fetchObservation(observationId: string) {
  return api<Observation>(`/observations/${observationId}`);
}

export async function createObservation(data: Partial<Observation>) {
  return api<Observation>("/observations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateObservation(observationId: string, data: Partial<Observation> & { expectedVersion?: number }) {
  return api<Observation>(`/observations/${observationId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteObservation(observationId: string) {
  const token = await tokenProvider();
  const res = await fetch(`${API_BASE}/observations/${observationId}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new ApiRequestError("INTERNAL_ERROR", "Failed to delete observation", undefined, res.status);
  }
}

export async function fetchObservationVersions(observationId: string, params: { limit?: number; cursor?: string } = {}) {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  const qStr = query.toString();
  return api<ObservationVersion[]>(`/observations/${observationId}/versions${qStr ? `?${qStr}` : ""}`);
}

export async function fetchObservationVersion(observationId: string, versionId: string) {
  return api<ObservationVersion>(`/observations/${observationId}/versions/${versionId}`);
}
