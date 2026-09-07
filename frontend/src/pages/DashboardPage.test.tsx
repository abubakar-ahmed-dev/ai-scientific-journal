import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "./DashboardPage";
import * as api from "../lib/api";

// Mock API module
vi.mock("../lib/api", async () => {
  const actual = await vi.importActual("../lib/api");
  return {
    ...actual,
    fetchObservations: vi.fn(),
    fetchProjects: vi.fn(),
    fetchResearchTasks: vi.fn(),
    fetchConversations: vi.fn(),
    fetchAnalyses: vi.fn(),
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
  tags: ["biology", "bacteria"],
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
  tags: ["kinetics"],
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
  summary: "Exponential growth detected in bacterial samples.",
  keyFindings: ["Growth rate 2x higher than baseline"],
  hypotheses: [],
  uncertainties: [],
  suggestedQuestions: [],
  openQuestions: [],
  suggestedNextSteps: ["Replicate the growth assay with a control group"],
  model: "gemini-2.5-flash",
  promptVersion: "observation-analysis-v1",
  createdAt: "2026-09-01T10:00:00Z",
};

type ApiMock<T> = { data: T[]; meta: { limit: number; hasMore?: boolean } };

function mockApis(overrides: {
  observations?: ApiMock<typeof OBSERVATION>;
  projects?: ApiMock<typeof PROJECT>;
  tasks?: ApiMock<typeof TASK>;
  conversations?: ApiMock<never>;
  analyses?: ApiMock<typeof ANALYSIS>;
} = {}) {
  vi.mocked(api.fetchObservations).mockResolvedValue(
    overrides.observations ?? ({ data: [OBSERVATION], meta: { limit: 6, hasMore: true } } as ApiMock<typeof OBSERVATION>)
  );
  vi.mocked(api.fetchProjects).mockResolvedValue(
    overrides.projects ?? ({ data: [PROJECT], meta: { limit: 50, hasMore: false } } as ApiMock<typeof PROJECT>)
  );
  // The dashboard fetches tasks per status (suggested/planned/in_progress/
  // completed); the mock honors the filter so pages don't duplicate entries.
  vi.mocked(api.fetchResearchTasks).mockImplementation(async (params) => {
    const wanted = (params as { status?: string } | undefined)?.status ?? TASK.status;
    const data = wanted === TASK.status ? [TASK] : [];
    return (overrides.tasks ?? { data, meta: { limit: 50, hasMore: false } }) as ApiMock<typeof TASK>;
  });
  vi.mocked(api.fetchConversations).mockResolvedValue(
    overrides.conversations ?? ({ data: [], meta: { limit: 5 } } as ApiMock<never>)
  );
  vi.mocked(api.fetchAnalyses).mockResolvedValue(
    overrides.analyses ?? ({ data: [ANALYSIS], meta: { limit: 5 } } as ApiMock<typeof ANALYSIS>)
  );
}

describe("DashboardPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders greeting, current research hero, honest metrics, and 4 canonical quick actions", async () => {
    mockApis();

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Time-based greeting header (guidelines §10), not a generic title
    expect(
      screen.getByRole("heading", { name: /good (morning|afternoon|evening)/i })
    ).toBeInTheDocument();

    // Current Research hero surfaces the most recent active project with honest stats
    await waitFor(() => {
      expect(screen.getByText("Enzyme Kinetics Study")).toBeInTheDocument();
    });
    expect(screen.getByText("Current Research", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue research/i })).toBeInTheDocument();
    expect(screen.getByText(/last activity:/i)).toBeInTheDocument();

    // Honest metric titles with "+" hasMore indicator on observations
    expect(screen.getByText("Observations", { selector: "span.text-xs" })).toBeInTheDocument();
    expect(screen.getByText("Active Projects", { selector: "span.text-xs" })).toBeInTheDocument();
    expect(screen.getByText("Open Tasks", { selector: "span.text-xs" })).toBeInTheDocument();
    expect(screen.getByText("AI Analyses", { selector: "span.text-xs" })).toBeInTheDocument();
    expect(screen.getByText("+")).toBeInTheDocument();

    // Verify observation details loaded (title appears in list + activity feed)
    expect(screen.getAllByText("Microbial Colony Formation").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Noticed rapid bacterial growth at 37C incubator.")).toBeInTheDocument();
    expect(screen.getByText("1 files attached")).toBeInTheDocument();

    // The 4 canonical quick actions (New Observation / Ask Journal / AI Chat / Add Task)
    expect(screen.getAllByRole("link", { name: /new observation/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: /ask journal search your knowledge/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ai chat work with ai/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add task plan your work/i })).toBeInTheDocument();

    // Prioritized task summary + AI suggestion panel (labeled, not stated as fact)
    expect(screen.getByText("Replicate assay with control group")).toBeInTheDocument();
    expect(screen.getByText("AI suggestion", { selector: "p" })).toBeInTheDocument();
    // Panel surfaces the analysis' first suggested next step
    expect(screen.getByText(/replicate the growth assay with a control group/i)).toBeInTheDocument();
  });

  it("shows the onboarding state when the workspace has no projects and no observations", async () => {
    mockApis({
      observations: { data: [], meta: { limit: 6 } },
      projects: { data: [], meta: { limit: 50 } },
      tasks: { data: [], meta: { limit: 50 } },
      analyses: { data: [], meta: { limit: 5 } },
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/your research workspace is ready/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /create project/i })).toBeInTheDocument();
    expect(screen.getByText("1. Create your first project")).toBeInTheDocument();
    expect(screen.getByText("2. Record your first observation")).toBeInTheDocument();
    expect(screen.getByText("3. Explore the journal AI")).toBeInTheDocument();
    // The regular hero should not render in onboarding mode
    expect(screen.queryByText(/continue research/i)).not.toBeInTheDocument();
  });

  it("handles partial fetch failures with reachable retry banner and section error state (F6)", async () => {
    // Observations fail; other endpoints succeed
    vi.mocked(api.fetchObservations).mockRejectedValue(new Error("Network connection lost"));
    vi.mocked(api.fetchProjects).mockResolvedValue({ data: [PROJECT], meta: { limit: 50 } });
    vi.mocked(api.fetchResearchTasks).mockImplementation(async (params) => {
      const wanted = (params as { status?: string } | undefined)?.status ?? TASK.status;
      return { data: wanted === TASK.status ? [TASK] : [], meta: { limit: 50 } } as ApiMock<typeof TASK>;
    });
    vi.mocked(api.fetchConversations).mockResolvedValue({ data: [], meta: { limit: 5 } });
    vi.mocked(api.fetchAnalyses).mockResolvedValue({ data: [ANALYSIS], meta: { limit: 5 } });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Verify error alert banner appears with Retry button
    await waitFor(() => {
      expect(screen.getByText(/some research data could not be loaded/i)).toBeInTheDocument();
    });

    const retryBannerBtn = screen.getByRole("button", { name: /^retry$/i });
    expect(retryBannerBtn).toBeInTheDocument();

    // Verify section-level error card is shown instead of false empty state
    expect(screen.getByText("Failed to load recent observations.")).toBeInTheDocument();
    expect(screen.queryByText(/no observations logged yet/i)).not.toBeInTheDocument();

    // Clicking retry refetches
    vi.mocked(api.fetchObservations).mockResolvedValue({ data: [], meta: { limit: 6 } });
    fireEvent.click(retryBannerBtn);

    await waitFor(() => {
      expect(api.fetchObservations).toHaveBeenCalledTimes(2);
    });
  });
});
