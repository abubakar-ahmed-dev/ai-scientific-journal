import { auth } from "./firebase/config";

const API_BASE = "/api/v1";

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    nextCursor?: string | null;
    hasMore?: boolean;
    serverTime?: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: Array<{ field?: string; message: string; code?: string }>;
  };
}

export class ApiRequestError extends Error {
  code: string;
  status: number;
  details?: Array<{ field?: string; message: string; code?: string }>;
  requestId?: string;

  constructor(
    code: string,
    message: string,
    details?: Array<{ field?: string; message: string; code?: string }>,
    status: number = 500,
    requestId?: string
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

let tokenProvider = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
};

export function setAuthTokenProvider(provider: () => Promise<string | null>) {
  tokenProvider = provider;
}

export const setTokenProvider = setAuthTokenProvider;

export async function api<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = await tokenProvider();

  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  if (!response.ok) {
    if (isJson) {
      const errBody: ApiError = await response.json();
      throw new ApiRequestError(
        errBody.error?.code || "UNKNOWN_ERROR",
        errBody.error?.message || "An unexpected error occurred",
        errBody.error?.details,
        response.status,
        errBody.error?.requestId
      );
    } else {
      throw new ApiRequestError(
        "HTTP_ERROR",
        `Request failed with status ${response.status}`,
        undefined,
        response.status
      );
    }
  }

  if (response.status === 204) {
    return { data: null as unknown as T };
  }

  return response.json();
}

// User Profile types & API
export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  timezone?: string;
  locationEnabled?: boolean;
  aiSuggestionsEnabled?: boolean;
}

export interface UserProfile {
  uid: string;
  ownerId?: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  institution?: string | null;
  fieldOfStudy?: string | null;
  role?: string;
  accountStatus?: "active" | "suspended" | "deleted";
  preferences?: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export async function fetchMe() {
  return api<UserProfile>("/me");
}

export const fetchCurrentUser = fetchMe;

export async function updateMe(data: Partial<UserProfile>) {
  return api<UserProfile>("/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export const updateCurrentUser = updateMe;

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

export async function createProject(data: Partial<Project>) {
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
  notes?: string | null;
}

export interface ObservationLocation {
  latitude: number;
  longitude: number;
  precision?: "exact" | "approximate" | "hidden";
  label?: string | null;
}

export interface Observation {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string;
  description: string;
  observedAt: string;
  hypothesis: string | null;
  notes: string | null;
  tags: string[];
  status: "draft" | "recorded" | "analyzed";
  measurements: Measurement[];
  location?: ObservationLocation | null;
  mediaCount?: number;
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

// Conversation types & API
export interface Conversation {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string | null;
  contextType: "general" | "observation" | "project" | "research";
  contextId: string | null;
  messageCount: number;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  ownerId: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  sequence: number;
  model?: string;
  metadata?: {
    latencyMs?: number;
    tokenUsage?: {
      promptTokens?: number;
      candidatesTokens?: number;
      totalTokens?: number;
    };
    finishReason?: string;
  };
  createdAt: string;
}

export async function fetchConversations(
  params: {
    limit?: number;
    cursor?: string;
    status?: string;
    projectId?: string;
    contextType?: string;
  } = {}
) {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.status) query.set("status", params.status);
  if (params.projectId) query.set("projectId", params.projectId);
  if (params.contextType) query.set("contextType", params.contextType);
  const qStr = query.toString();
  return api<Conversation[]>(`/conversations${qStr ? `?${qStr}` : ""}`);
}

export async function fetchConversation(conversationId: string) {
  return api<Conversation>(`/conversations/${conversationId}`);
}

export async function createConversation(data: {
  title?: string | null;
  projectId?: string | null;
  contextType: "general" | "observation" | "project" | "research";
  contextId?: string | null;
}) {
  return api<Conversation>("/conversations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateConversation(
  conversationId: string,
  patch: { title?: string; status?: "active" | "archived" }
) {
  return api<Conversation>(`/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteConversation(conversationId: string) {
  const token = await tokenProvider();
  const res = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new ApiRequestError("INTERNAL_ERROR", "Failed to delete conversation", undefined, res.status);
  }
}

export async function fetchMessages(
  conversationId: string,
  params: { limit?: number; cursor?: string } = {}
) {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  const qStr = query.toString();
  return api<Message[]>(`/conversations/${conversationId}/messages${qStr ? `?${qStr}` : ""}`);
}

export async function sendMessage(conversationId: string, content: string) {
  return api<{ userMessage: Message; assistantMessage: Message }>(
    `/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    }
  );
}

// AI Analyses types & API
export interface Hypothesis {
  statement: string;
  confidence: "low" | "medium" | "high";
  supportingObservationIds: string[];
}

export interface Analysis {
  id: string;
  ownerId: string;
  projectId: string | null;
  observationIds: string[];
  conversationId: string | null;
  type: "summary" | "analysis" | "hypothesis" | "classification" | "research_suggestions";
  summary: string;
  keyFindings: string[];
  hypotheses: Hypothesis[];
  uncertainties: string[];
  suggestedQuestions: string[];
  openQuestions: string[];
  suggestedNextSteps: string[];
  model: string;
  promptVersion: string;
  createdAt: string;
  sourceSummaries?: Array<{
    observationId: string;
    found: boolean;
    title?: string;
    status?: string;
  }>;
}

export async function generateSummary(body: {
  conversationId?: string;
  observationIds?: string[];
  projectId?: string;
}) {
  return api<Analysis>("/ai/summarize", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function generateAnalysis(body: {
  observationIds: string[];
  projectId?: string;
}) {
  return api<Analysis>("/ai/analyze", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function generateResearchSuggestions(body: {
  observationIds?: string[];
  analysisId?: string;
  projectId?: string;
}) {
  return api<Analysis>("/ai/suggest-research", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchAnalyses(params: {
  limit?: number;
  cursor?: string;
  type?: string;
  observationId?: string;
  conversationId?: string;
  projectId?: string;
} = {}) {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.type) query.set("type", params.type);
  if (params.observationId) query.set("observationId", params.observationId);
  if (params.conversationId) query.set("conversationId", params.conversationId);
  if (params.projectId) query.set("projectId", params.projectId);
  const qStr = query.toString();
  return api<Analysis[]>(`/analyses${qStr ? `?${qStr}` : ""}`);
}

export async function fetchAnalysis(analysisId: string, includeSources: boolean = false) {
  return api<Analysis>(`/analyses/${analysisId}${includeSources ? "?includeSources=summary" : ""}`);
}

// Research Tasks types & API
export interface ResearchTask {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string;
  description: string;
  source: "user" | "gemini";
  sourceAnalysisId: string | null;
  status: "suggested" | "planned" | "in_progress" | "completed" | "dismissed";
  relatedObservationIds: string[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchResearchTasks(params: {
  limit?: number;
  cursor?: string;
  status?: string;
  projectId?: string;
} = {}) {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.status) query.set("status", params.status);
  if (params.projectId) query.set("projectId", params.projectId);
  const qStr = query.toString();
  return api<ResearchTask[]>(`/research-tasks${qStr ? `?${qStr}` : ""}`);
}

export async function fetchResearchTask(taskId: string) {
  return api<ResearchTask>(`/research-tasks/${taskId}`);
}

export async function createResearchTask(
  data:
    | {
        source: "user";
        title: string;
        description: string;
        projectId?: string | null;
        relatedObservationIds?: string[];
      }
    | {
        source: "gemini";
        sourceAnalysisId: string;
        suggestionIndex: number;
        projectId?: string | null;
      }
) {
  return api<ResearchTask>("/research-tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateResearchTask(
  taskId: string,
  patch: {
    title?: string;
    description?: string;
    status?: "suggested" | "planned" | "in_progress" | "completed" | "dismissed";
    relatedObservationIds?: string[];
  }
) {
  return api<ResearchTask>(`/research-tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteResearchTask(taskId: string) {
  const token = await tokenProvider();
  const res = await fetch(`${API_BASE}/research-tasks/${taskId}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new ApiRequestError("INTERNAL_ERROR", "Failed to delete task", undefined, res.status);
  }
}

export interface AskResponse {
  answer: string;
  evidence: Array<{
    observationId: string;
    title: string;
    observedAt: string;
    note?: string;
  }>;
  uncertainties: string[];
  model: string;
  promptVersion: string;
}

export interface SearchResponseItem {
  observationId: string;
  title: string;
  observedAt: string;
  score: number;
  snippet: string;
}

export async function askMyJournal(
  body: { question: string; conversationId?: string },
  idempotencyKey?: string
): Promise<AskResponse> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  const res = await api<AskResponse>("/ai/ask", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function searchObservations(
  body: { query: string; limit?: number; projectId?: string }
): Promise<SearchResponseItem[]> {
  const res = await api<SearchResponseItem[]>("/ai/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

// Media types & API (Phase 7 - PRD FR-11, API.md §6.8)
export interface ObservationMedia {
  id: string;
  ownerId: string;
  observationId: string;
  type: "image" | "audio" | "video";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  createdAt: string;
  url?: string;
}

export async function uploadObservationMedia(
  observationId: string,
  file: File,
  caption?: string
): Promise<ObservationMedia> {
  const formData = new FormData();
  formData.append("file", file);
  if (caption) {
    formData.append("caption", caption);
  }

  const res = await api<ObservationMedia>(`/observations/${observationId}/media`, {
    method: "POST",
    body: formData,
  });
  return res.data;
}

export async function fetchObservationMedia(observationId: string): Promise<ObservationMedia[]> {
  const res = await api<ObservationMedia[]>(`/observations/${observationId}/media`);
  return res.data;
}

export async function fetchMediaDetail(
  observationId: string,
  mediaId: string
): Promise<ObservationMedia> {
  const res = await api<ObservationMedia>(`/observations/${observationId}/media/${mediaId}`);
  return res.data;
}

export async function deleteObservationMedia(
  observationId: string,
  mediaId: string
): Promise<void> {
  await api<void>(`/observations/${observationId}/media/${mediaId}`, {
    method: "DELETE",
  });
}

