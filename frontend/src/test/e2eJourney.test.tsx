import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LandingPage from "../pages/LandingPage";
import DashboardPage from "../pages/DashboardPage";
import ObservationDetailPage from "../pages/ObservationDetailPage";
import { AskMyJournalPage } from "../pages/AskMyJournalPage";
import * as api from "../lib/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockSignIn = vi.fn();
let mockCurrentUser: { uid: string; email: string; displayName?: string } | null = null;

vi.mock("../lib/firebase/authContext", () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
    loading: false,
    signInWithGoogle: mockSignIn,
    signOut: vi.fn(),
  }),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual("../lib/api");
  return {
    ...actual,
    fetchObservations: vi.fn(),
    fetchObservation: vi.fn(),
    createObservation: vi.fn(),
    fetchObservationVersions: vi.fn(),
    fetchProjects: vi.fn(),
    fetchResearchTasks: vi.fn(),
    createResearchTask: vi.fn(),
    fetchConversations: vi.fn(),
    createConversation: vi.fn(),
    fetchAnalyses: vi.fn(),
    generateAnalysis: vi.fn(),
    askMyJournal: vi.fn(),
    searchObservations: vi.fn(),
    fetchObservationMedia: vi.fn(),
  };
});

describe("Stubbed-AI E2E Researcher Journey (TESTING.md §8)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = null;
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("completes full scientific journey: auth → dashboard → observation detail → AI analysis → task acceptance → RAG query → version history", async () => {
    // -------------------------------------------------------------------------
    // Step 1: Researcher Lands and Authenticates
    // -------------------------------------------------------------------------
    const { unmount: unmountLanding } = render(
      <MemoryRouter initialEntries={["/"]}>
        <LandingPage />
      </MemoryRouter>
    );

    const signInBtn = screen.getByRole("button", { name: /sign in with google/i });
    expect(signInBtn).toBeInTheDocument();
    fireEvent.click(signInBtn);
    expect(mockSignIn).toHaveBeenCalledTimes(1);

    // Simulate successful login
    mockCurrentUser = {
      uid: "user_scientist_1",
      email: "elena@alpine-research.org",
      displayName: "Dr. Elena Rostova",
    };
    unmountLanding();

    // -------------------------------------------------------------------------
    // Step 2: Dashboard Overview with Aggregated Metrics & Shortcuts
    // -------------------------------------------------------------------------
    vi.mocked(api.fetchObservations).mockResolvedValue({
      data: [
        {
          id: "obs_e2e_1",
          ownerId: "user_scientist_1",
          projectId: "proj_alpine",
          title: "Alpine Lichen Photosynthesis under UV",
          description: "Assayed Xanthoria elegans pigmentation and chlorophyll fluorescence.",
          notes: "Observed red parietin pigment saturation.",
          hypothesis: "UV radiation induces protective carotenoid synthesis.",
          observedAt: "2026-09-02T11:30:00Z",
          location: { latitude: 46.54, longitude: 8.01, precision: "exact", label: "Jungfraujoch Ridge" },
          tags: ["lichen", "uv", "alpine"],
          measurements: [{ name: "PAR", value: 1850, unit: "umol/m2/s" }],
          status: "recorded",
          mediaCount: 1,
          version: 2,
          createdAt: "2026-09-02T11:30:00Z",
          updatedAt: "2026-09-02T13:00:00Z",
        },
      ],
      meta: { limit: 6 },
    });

    vi.mocked(api.fetchProjects).mockResolvedValue({
      data: [
        {
          id: "proj_alpine",
          ownerId: "user_scientist_1",
          title: "High Altitude Flora Study",
          description: "Alpine resilience",
          field: "Botany",
          tags: ["alpine"],
          status: "active",
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-01T10:00:00Z",
        },
      ],
      meta: { limit: 20 },
    });

    vi.mocked(api.fetchResearchTasks).mockResolvedValue({ data: [], meta: { limit: 5 } });
    vi.mocked(api.fetchConversations).mockResolvedValue({ data: [], meta: { limit: 5 } });
    vi.mocked(api.fetchAnalyses).mockResolvedValue({ data: [], meta: { limit: 5 } });

    const { unmount: unmountDashboard } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Alpine Lichen Photosynthesis under UV")).toBeInTheDocument();
    });

    expect(screen.getByText("Jungfraujoch Ridge")).toBeInTheDocument();
    expect(screen.getByText("1 files attached")).toBeInTheDocument();
    unmountDashboard();

    // -------------------------------------------------------------------------
    // Step 3: Observation Detail Inspection & AI Structured Analysis
    // -------------------------------------------------------------------------
    vi.mocked(api.fetchObservation).mockResolvedValue({
      data: {
        id: "obs_e2e_1",
        ownerId: "user_scientist_1",
        projectId: "proj_alpine",
        title: "Alpine Lichen Photosynthesis under UV",
        description: "Assayed Xanthoria elegans pigmentation and chlorophyll fluorescence.",
        notes: "Observed red parietin pigment saturation.",
        hypothesis: "UV radiation induces protective carotenoid synthesis.",
        observedAt: "2026-09-02T11:30:00Z",
        location: { latitude: 46.54, longitude: 8.01, precision: "exact", label: "Jungfraujoch Ridge" },
        tags: ["lichen", "uv", "alpine"],
        measurements: [{ name: "PAR", value: 1850, unit: "umol/m2/s" }],
        status: "recorded",
        mediaCount: 1,
        version: 2,
        createdAt: "2026-09-02T11:30:00Z",
        updatedAt: "2026-09-02T13:00:00Z",
      },
    });

    vi.mocked(api.fetchObservationMedia).mockResolvedValue([]);
    vi.mocked(api.searchObservations).mockResolvedValue([]);

    // Mock AI Analysis pipeline output
    const mockAnalysisOutput = {
      id: "anl_e2e_99",
      ownerId: "user_scientist_1",
      projectId: "proj_alpine",
      observationIds: ["obs_e2e_1"],
      conversationId: null,
      type: "analysis" as const,
      summary: "High UV irradiance correlates with concentrated parietin screening pigment.",
      keyFindings: [
        "PAR intensity of 1850 umol/m2/s triggers photoprotective mechanism",
        "Fluorescence recovery is rapid under shade",
      ],
      hypotheses: [
        {
          statement: "Secondary metabolite synthesis scales logarithmically with elevation UV index",
          confidence: "high" as const,
          supportingObservationIds: ["obs_e2e_1"],
        },
      ],
      uncertainties: ["UV-A vs UV-B spectrum was not independently isolated"],
      suggestedQuestions: ["How does moisture modulate pigment synthesis?"],
      openQuestions: [],
      suggestedNextSteps: ["Isolate parietin extract via HPLC chromatography"],
      model: "gemini-2.5-flash",
      promptVersion: "observation-analysis-v1",
      createdAt: "2026-09-02T14:00:00Z",
      sourceSummaries: [{ observationId: "obs_e2e_1", found: true, title: "Alpine Lichen Photosynthesis under UV" }],
    };

    vi.mocked(api.generateAnalysis).mockResolvedValue({ data: mockAnalysisOutput });
    vi.mocked(api.createResearchTask).mockResolvedValue({ data: { id: "task_accepted_1" } as any });

    vi.mocked(api.fetchObservationVersions).mockResolvedValue({
      data: [
        {
          id: "ver_1",
          version: 1,
          title: "Alpine Lichen Draft",
          description: "Initial observation draft before spectrometer calibration.",
          hypothesis: null,
          measurements: [],
          editedAt: "2026-09-02T11:30:00Z",
          editedBy: "user_scientist_1",
          changeReason: "Initial record creation",
        },
      ],
    });

    const { unmount: unmountDetail } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/observations/obs_e2e_1"]}>
          <Routes>
            <Route path="/observations/:id" element={<ObservationDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Alpine Lichen Photosynthesis under UV")).toBeInTheDocument();
    });

    // Trigger AI Analysis
    const analyzeBtn = screen.getByRole("button", { name: /analyze with ai/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText(/High UV irradiance correlates with concentrated parietin/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Isolate parietin extract via HPLC chromatography")).toBeInTheDocument();

    // Step 4: Accept AI Suggestion as Research Task
    const acceptTaskBtn = screen.getByRole("button", { name: /\+ accept as task/i });
    fireEvent.click(acceptTaskBtn);

    await waitFor(() => {
      expect(screen.getByText("Added to Tasks")).toBeInTheDocument();
    });

    expect(api.createResearchTask).toHaveBeenCalledWith({
      source: "gemini",
      sourceAnalysisId: "anl_e2e_99",
      suggestionIndex: 0,
      projectId: "proj_alpine",
    });

    // Step 5: Version History Snapshot Inspection
    const versionHistoryBtn = screen.getByRole("button", { name: /view version history/i });
    fireEvent.click(versionHistoryBtn);

    await waitFor(() => {
      expect(screen.getByText("Alpine Lichen Draft")).toBeInTheDocument();
    });

    const inspectSnapshotBtn = screen.getByRole("button", { name: /inspect snapshot & compare/i });
    fireEvent.click(inspectSnapshotBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Revision Snapshot v1/i })).toBeInTheDocument();
      expect(
        screen.getAllByText("Initial observation draft before spectrometer calibration.")[0]
      ).toBeInTheDocument();
    });

    // Close modal
    fireEvent.click(screen.getByRole("button", { name: /close inspector/i }));
    unmountDetail();

    // -------------------------------------------------------------------------
    // Step 6: Ask My Journal (RAG Grounded Q&A)
    // -------------------------------------------------------------------------
    vi.mocked(api.askMyJournal).mockResolvedValue({
      answer: "Based on your journal records, alpine lichen Xanthoria elegans adapts to high UV radiation via parietin pigment synthesis.",
      evidence: [
        {
          observationId: "obs_e2e_1",
          title: "Alpine Lichen Photosynthesis under UV",
          observedAt: "2026-09-02T11:30:00Z",
          note: "Jungfraujoch field notes documented PAR values of 1850 umol/m2/s with red pigment saturation.",
        },
      ],
      uncertainties: ["UV-A vs UV-B spectrum contribution remains unseparated in field data."],
      model: "gemini-2.5-flash",
      promptVersion: "ask-grounded-v1",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/ask"]}>
          <AskMyJournalPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const questionInput = screen.getByPlaceholderText(/Have I observed any hawks or falcons/i);
    fireEvent.change(questionInput, {
      target: { value: "How does UV radiation affect alpine lichen pigmentation?" },
    });

    const submitQuestionBtn = screen.getByRole("button", { name: /ask journal/i });
    fireEvent.click(submitQuestionBtn);

    await waitFor(() => {
      expect(screen.getByText(/adapts to high UV radiation via parietin pigment synthesis/i)).toBeInTheDocument();
    });

    // Verify evidence citation linking to observation
    expect(screen.getByRole("link", { name: /Jungfraujoch field notes/i })).toHaveAttribute(
      "href",
      "/observations/obs_e2e_1"
    );
    expect(screen.getByText("gemini-2.5-flash")).toBeInTheDocument();
    expect(screen.getByText("ask-grounded-v1")).toBeInTheDocument();
  });
});
