import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardPage from "./DashboardPage";
import { ToastProvider } from "../components/ui/Toast";
import * as api from "../lib/api";

// Layout consumes the shared /me profile via react-query; tests stub the hook
// instead of standing up the full Firebase-authenticated provider tree.
vi.mock("../lib/useProfile", () => ({
  useProfile: () => ({
    profile: null,
    displayName: "Test Researcher",
    email: "tester@example.com",
    avatarUrl: null,
    memberSince: null,
    preferences: null,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useInvalidateProfile: () => vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual("../lib/api");
  return {
    ...actual,
    fetchObservations: vi.fn(),
    fetchProjects: vi.fn(),
    fetchResearchTasks: vi.fn(),
    fetchAnalyses: vi.fn(),
    createObservation: vi.fn(),
  };
});

// Mock Auth Context
vi.mock("../lib/firebase/authContext", () => ({
  useAuth: () => ({
    currentUser: { uid: "user_test", email: "scientist@fast.edu" },
    loading: false,
    signOut: vi.fn(),
  }),
}));

/** Renders the quick-capture hand-off state so tests can assert the prefill. */
function NewObservationProbe() {
  const loc = useLocation();
  const prefill = (loc.state as { quickCapture?: { title?: string } } | null)?.quickCapture;
  return <div>prefill:{prefill?.title ?? "none"}</div>;
}

function renderPage(initialPath = "/dashboard") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            {/* Quick Capture routes to the created draft's edit page on success */}
            <Route path="/observations/:id/edit" element={<div>edit-stub</div>} />
            <Route path="/observations/new" element={<NewObservationProbe />} />
          </Routes>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const OBSERVATION = {
  id: "obs_1",
  ownerId: "user_test",
  projectId: "proj_1",
  title: "Microbial Colony Formation",
  description: "Noticed rapid bacterial growth at 37C incubator.",
  notes: null,
  hypothesis: null,
  observedAt: "2026-09-01T10:00:00Z",
  location: { latitude: 34.05, longitude: -118.24, precision: "exact" as const, label: "Lab Station 3" },
  tags: ["biology"],
  measurements: [{ name: "Temperature", value: 37, unit: "C" }],
  status: "recorded" as const,
  mediaCount: 1,
  version: 1,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-01T10:00:00Z",
};

const PROJECT = {
  id: "proj_1",
  ownerId: "user_test",
  title: "Enzyme Kinetics Study",
  description: "Active research project",
  field: "Biochemistry",
  tags: [],
  status: "active" as const,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-01T10:00:00Z",
};

const TASK = {
  id: "task_1",
  ownerId: "user_test",
  projectId: "proj_1",
  relatedObservationIds: ["obs_1"],
  title: "Replicate assay with control group",
  description: "Ensure reproducibility of colony growth.",
  status: "planned" as const,
  source: "user" as const,
  sourceAnalysisId: null,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-01T10:00:00Z",
};

const ANALYSIS = {
  id: "analysis_1",
  ownerId: "user_test",
  projectId: null,
  observationIds: ["obs_1"],
  conversationId: null,
  type: "analysis" as const,
  summary: "Exponential growth detected.",
  keyFindings: [],
  hypotheses: [],
  uncertainties: [],
  suggestedQuestions: [],
  openQuestions: [],
  suggestedNextSteps: ["Replicate the growth assay with a control group"],
  model: "gemini-2.5-flash",
  promptVersion: "observation-analysis-v1",
  createdAt: "2026-09-01T09:00:00Z",
};

type ListResult<T> = { data: T[]; meta: { limit: number; hasMore?: boolean } };

/** Feed call (limit 4, no projectId) vs brief call (projectId-scoped). */
function mockObservations(feed: ListResult<typeof OBSERVATION>, brief?: ListResult<typeof OBSERVATION>) {
  vi.mocked(api.fetchObservations).mockImplementation(async (params) => {
    if (params?.projectId) {
      return (brief ?? { data: [OBSERVATION], meta: { limit: 50 } }) as ListResult<typeof OBSERVATION>;
    }
    return feed;
  });
}

function mockApis(overrides: {
  observations?: ListResult<typeof OBSERVATION>;
  briefObservations?: ListResult<typeof OBSERVATION>;
  projects?: ListResult<typeof PROJECT>;
  tasks?: ListResult<typeof TASK>;
  analyses?: ListResult<typeof ANALYSIS>;
} = {}) {
  mockObservations(
    overrides.observations ?? { data: [OBSERVATION], meta: { limit: 4, hasMore: true } },
    overrides.briefObservations
  );
  vi.mocked(api.fetchProjects).mockResolvedValue(
    overrides.projects ?? ({ data: [PROJECT], meta: { limit: 50, hasMore: false } } as ListResult<typeof PROJECT>)
  );
  vi.mocked(api.fetchResearchTasks).mockImplementation(async (params) => {
    const wanted = (params as { status?: string } | undefined)?.status ?? TASK.status;
    const data = wanted === TASK.status ? [TASK] : [];
    return (overrides.tasks ?? { data, meta: { limit: 50, hasMore: false } }) as ListResult<typeof TASK>;
  });
  vi.mocked(api.fetchAnalyses).mockResolvedValue(
    overrides.analyses ?? ({ data: [ANALYSIS], meta: { limit: 5, hasMore: false } } as ListResult<typeof ANALYSIS>)
  );
}

describe("DashboardPage — returning-user state (dashboard refactor 2026-09-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders research brief with real per-project counts, stats row, AI row, and feeds", async () => {
    // Brief count differs from the feed page count to prove per-project truth.
    mockApis({
      briefObservations: {
        data: [OBSERVATION, { ...OBSERVATION, id: "obs_2" }],
        meta: { limit: 50 },
      },
    });

    renderPage();

    // Greeting header + non-count subtext (no capped numbers in the header)
    expect(
      screen.getByRole("heading", { name: /good (morning|afternoon|evening)/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/continue your research where you left off/i)).toBeInTheDocument();

    // Brief: real per-project count "2" (not the 4-row feed filter). The new
    // mini-stat layout splits number and label into separate elements.
    await waitFor(() => {
      expect(screen.getByText("Enzyme Kinetics Study")).toBeInTheDocument();
    });
    const briefObsLabel = screen.getByText(
      (content, element) => element?.tagName === "P" && element.textContent === "Observations"
    );
    await waitFor(() => {
      expect(briefObsLabel.previousElementSibling).toHaveTextContent("2");
    });
    expect(screen.getByText("Open task", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Last activity")).toBeInTheDocument();

    // Deterministic next step: analysis is stale (older than the observation),
    // latest observation is unanalyzed → analyze rule
    expect(screen.getByText(/analyze your latest observation/i)).toBeInTheDocument();

    // Stats row (returning users only): link-only secondary lines + cap marker
    expect(screen.getByRole("link", { name: /view journal/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage projects/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open tasks board/i })).toBeInTheDocument();
    expect(screen.getByText("Review analyses")).toBeInTheDocument();
    expect(screen.getByText("+")).toBeInTheDocument();

    // AI band: conversations row + analysis review (headings — sidebar shares names)
    expect(screen.getByRole("heading", { name: "Ask Journal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI Chat" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review Analyses" })).toBeInTheDocument();

    // Feeds
    expect(screen.getAllByText("Microbial Colony Formation").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Replicate assay with control group")).toBeInTheDocument();
  });

  it("labels a fresh analysis suggestion as AI-sourced in the brief", async () => {
    mockApis({
      analyses: {
        data: [{ ...ANALYSIS, createdAt: "2026-09-05T10:00:00Z" }],
        meta: { limit: 5 },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/from your last analysis/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/replicate the growth assay with a control group/i)).toBeInTheDocument();
  });

  it("shows the Review Analyses empty variant when no analyses exist", async () => {
    mockApis({ analyses: { data: [], meta: { limit: 5 } } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no analyses yet/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("Review Analyses")).not.toBeInTheDocument();
  });

  it("handles partial fetch failure with banner + section error + working retry", async () => {
    vi.mocked(api.fetchObservations).mockRejectedValue(new Error("Network connection lost"));
    vi.mocked(api.fetchProjects).mockResolvedValue({ data: [PROJECT], meta: { limit: 50 } });
    vi.mocked(api.fetchResearchTasks).mockResolvedValue({ data: [], meta: { limit: 50 } });
    vi.mocked(api.fetchAnalyses).mockResolvedValue({ data: [], meta: { limit: 5 } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/some research data could not be loaded/i)).toBeInTheDocument();
    });

    // Section error state, never a false empty state
    expect(screen.getByText("Failed to load recent observations.")).toBeInTheDocument();
    expect(screen.queryByText(/no observations logged yet/i)).not.toBeInTheDocument();

    // Retry refetches only and the feed recovers
    mockObservations({ data: [OBSERVATION], meta: { limit: 4, hasMore: false } });
    fireEvent.click(screen.getByRole("button", { name: /^retry$/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Microbial Colony Formation").length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("DashboardPage — new-user state (dashboard refactor 2026-09-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchObservations).mockResolvedValue({ data: [], meta: { limit: 4 } });
    vi.mocked(api.fetchProjects).mockResolvedValue({ data: [], meta: { limit: 50 } });
    vi.mocked(api.fetchResearchTasks).mockResolvedValue({ data: [], meta: { limit: 50 } });
    vi.mocked(api.fetchAnalyses).mockResolvedValue({ data: [], meta: { limit: 5 } });
  });

  it("shows observation-first onboarding with quick capture, readiness, previews — no stat tiles", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/start with one observation/i)).toBeInTheDocument();
    });

    // Observation is the primary CTA; project creation secondary
    const primary = screen.getByRole("link", { name: /record first observation/i });
    expect(primary).toBeInTheDocument();

    // Quick Capture form present
    expect(screen.getByLabelText(/observation title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what did you observe\?/i)).toBeInTheDocument();

    // Workspace readiness + feature previews
    expect(screen.getByText(/workspace ready/i)).toBeInTheDocument();
    expect(screen.getByText(/no observations yet/i)).toBeInTheDocument();
    expect(screen.getByText(/ai analysis/i)).toBeInTheDocument();

    // Old onboarding noise and returning-state furniture stay gone
    expect(screen.queryByText(/1\. create your first project/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/current research/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Active Projects", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText(/analyze your latest observation/i)).not.toBeInTheDocument();
  });

  it("saves a real draft via quick capture and routes to the edit page", async () => {
    vi.mocked(api.createObservation).mockResolvedValue({
      data: { ...OBSERVATION, id: "obs_new", status: "draft" as const },
    } as never);

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/observation title/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/observation title/i), {
      target: { value: "Fungal growth after rainfall" },
    });
    fireEvent.change(screen.getByLabelText(/what did you observe\?/i), {
      target: { value: "Pale caps appeared overnight near the north bed." },
    });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    // Success routes to the created draft's edit page (reviewer decision)
    await waitFor(() => {
      expect(screen.getByText("edit-stub")).toBeInTheDocument();
    });
    expect(api.createObservation).toHaveBeenCalledWith(
      expect.objectContaining({ status: "draft", title: "Fungal growth after rainfall" })
    );
  });

  it("blocks empty quick-capture submission with inline validation", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save draft/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/describe what you observed/i)).toBeInTheDocument();
    expect(api.createObservation).not.toHaveBeenCalled();
  });

  it("Open Full Form carries typed values via router state without saving a draft", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/observation title/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/observation title/i), {
      target: { value: "Carried into the form" },
    });

    fireEvent.click(screen.getByRole("button", { name: /open full form/i }));

    expect(await screen.findByText("prefill:Carried into the form")).toBeInTheDocument();
    expect(api.createObservation).not.toHaveBeenCalled();
  });
});
