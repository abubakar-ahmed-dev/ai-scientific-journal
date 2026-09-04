import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LandingPage from "../pages/LandingPage";
import DashboardPage from "../pages/DashboardPage";
import ObservationFormPage from "../pages/ObservationFormPage";
import ObservationDetailPage from "../pages/ObservationDetailPage";
import { ChatWindow } from "../components/ChatWindow";
import { AskMyJournalPage } from "../pages/AskMyJournalPage";
import { ResearchMapPage } from "../pages/ResearchMapPage";
import * as api from "../lib/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock Leaflet for JSDOM
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children, position }: any) => (
    <div data-testid="map-marker" data-lat={position[0]} data-lng={position[1]}>
      {children}
    </div>
  ),
  Circle: ({ center }: any) => <div data-testid="map-circle" data-lat={center[0]} data-lng={center[1]} />,
  Popup: ({ children }: any) => <div data-testid="map-popup">{children}</div>,
}));

vi.mock("../lib/leafletSetup", () => ({
  setupLeafletIcons: vi.fn(),
}));

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
    updateObservation: vi.fn(),
    fetchObservationVersions: vi.fn(),
    fetchProjects: vi.fn(),
    fetchResearchTasks: vi.fn(),
    createResearchTask: vi.fn(),
    fetchConversations: vi.fn(),
    createConversation: vi.fn(),
    fetchMessages: vi.fn(),
    sendMessage: vi.fn(),
    fetchAnalyses: vi.fn(),
    fetchAnalysis: vi.fn(),
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

  it("completes full scientific journey: auth → dashboard → record observation → media inspection → AI analysis → task acceptance → version history → chat discussion → map inspection → RAG query (Plan §5.2)", { timeout: 20000 }, async () => {
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
      meta: { limit: 6, hasMore: false },
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
      meta: { limit: 50, hasMore: false },
    });

    vi.mocked(api.fetchResearchTasks).mockResolvedValue({ data: [], meta: { limit: 50, hasMore: false } });
    vi.mocked(api.fetchConversations).mockResolvedValue({ data: [], meta: { limit: 5 } });
    vi.mocked(api.fetchAnalyses).mockResolvedValue({ data: [], meta: { limit: 5, hasMore: false } });

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
    expect(screen.getByRole("link", { name: /research projects/i })).toBeInTheDocument();
    unmountDashboard();

    // -------------------------------------------------------------------------
    // Step 3: Record Field Observation via Form (Plan §5.2 Step 3 / F5)
    // -------------------------------------------------------------------------
    vi.mocked(api.createObservation).mockResolvedValue({
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
        version: 1,
        createdAt: "2026-09-02T11:30:00Z",
        updatedAt: "2026-09-02T11:30:00Z",
      },
    });

    const { unmount: unmountForm } = render(
      <MemoryRouter initialEntries={["/observations/new"]}>
        <Routes>
          <Route path="/observations/new" element={<ObservationFormPage />} />
          <Route path="/observations/:id" element={<div>Observation Created Target</div>} />
        </Routes>
      </MemoryRouter>
    );

    const titleInput = screen.getByPlaceholderText(/feeder activity/i);
    const descInput = screen.getByPlaceholderText(/detailed description of what you observed/i);

    fireEvent.change(titleInput, { target: { value: "Alpine Lichen Photosynthesis under UV" } });
    fireEvent.change(descInput, {
      target: { value: "Assayed Xanthoria elegans pigmentation and chlorophyll fluorescence." },
    });

    const saveObsBtn = screen.getByRole("button", { name: /save observation/i });
    fireEvent.click(saveObsBtn);

    await waitFor(() => {
      expect(api.createObservation).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Alpine Lichen Photosynthesis under UV",
          description: "Assayed Xanthoria elegans pigmentation and chlorophyll fluorescence.",
        })
      );
    });

    unmountForm();

    // -------------------------------------------------------------------------
    // Step 4: Observation Detail Inspection with Media Gallery (Plan §5.2 Step 4 / F5)
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

    vi.mocked(api.fetchObservationMedia).mockResolvedValue([
      {
        id: "med_e2e_1",
        ownerId: "user_scientist_1",
        observationId: "obs_e2e_1",
        fileName: "parietin_fluorescence.jpg",
        type: "image",
        mimeType: "image/jpeg",
        url: "https://storage.mock/parietin_fluorescence.jpg",
        caption: "Fluorescence under UV-A excitation",
        sizeBytes: 245000,
        createdAt: "2026-09-02T11:35:00Z",
      },
    ]);

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
    vi.mocked(api.fetchAnalysis).mockResolvedValue({ data: mockAnalysisOutput });
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

    // Verify Media Gallery attached image
    await waitFor(() => {
      expect(screen.getByText("parietin_fluorescence.jpg")).toBeInTheDocument();
    });

    // -------------------------------------------------------------------------
    // Step 5: AI Structured Analysis & Task Acceptance
    // -------------------------------------------------------------------------
    const analyzeBtn = screen.getByRole("button", { name: /analyze with ai/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText(/High UV irradiance correlates with concentrated parietin/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Isolate parietin extract via HPLC chromatography")).toBeInTheDocument();

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

    // -------------------------------------------------------------------------
    // Step 6: Version History Snapshot Inspection
    // -------------------------------------------------------------------------
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
    // Step 7: Research Assistant Stateful Discussion (Plan §5.2 Step 7 / F5)
    // -------------------------------------------------------------------------
    vi.mocked(api.fetchMessages).mockResolvedValue({
      data: [
        {
          id: "msg_1",
          ownerId: "user_e2e_1",
          conversationId: "conv_e2e_1",
          role: "user",
          content: "Does parietin fluorescence increase linearly with solar altitude?",
          sequence: 1,
          createdAt: "2026-09-02T15:00:00Z",
        },
        {
          id: "msg_2",
          ownerId: "user_e2e_1",
          conversationId: "conv_e2e_1",
          role: "assistant",
          content: "Empirical readings suggest non-linear saturation occurs once PAR exceeds 1500 umol/m2/s.",
          sequence: 2,
          model: "gemini-2.5-flash",
          metadata: {
            latencyMs: 450,
            tokenUsage: { totalTokens: 88 },
          },
          createdAt: "2026-09-02T15:00:02Z",
        },
      ],
      meta: { limit: 100 },
    });

    const { unmount: unmountChat } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ChatWindow
            conversation={{
              id: "conv_e2e_1",
              ownerId: "user_scientist_1",
              projectId: "proj_alpine",
              title: "Lichen Photoprotection Discussion",
              contextType: "observation",
              contextId: "obs_e2e_1",
              status: "active",
              messageCount: 2,
              createdAt: "2026-09-02T15:00:00Z",
              updatedAt: "2026-09-02T15:00:02Z",
            }}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Lichen Photoprotection Discussion")).toBeInTheDocument();
      expect(screen.getByText(/Empirical readings suggest non-linear saturation/i)).toBeInTheDocument();
    });

    // Verify model provenance badge and AI disclaimer
    expect(screen.getByText("gemini-2.5-flash")).toBeInTheDocument();
    expect(screen.getByText(/AI suggestions should be experimentally verified/i)).toBeInTheDocument();
    unmountChat();

    // -------------------------------------------------------------------------
    // Step 8: Research Map Geospatial Inspection (Plan §5.2 Step 9 / F5)
    // -------------------------------------------------------------------------
    const { unmount: unmountMap } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/map"]}>
          <ResearchMapPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Research Map")).toBeInTheDocument();
      expect(screen.getByTestId("map-container")).toBeInTheDocument();
    });

    unmountMap();

    // -------------------------------------------------------------------------
    // Step 9: Ask My Journal (RAG Grounded Q&A)
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
    expect(screen.getByText("ask-grounded-v1")).toBeInTheDocument();
  });
});
