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

describe("DashboardPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders metric cards and populated recent observation list with 4 quick actions", async () => {
    vi.mocked(api.fetchObservations).mockResolvedValue({
      data: [
        {
          id: "obs_1",
          ownerId: "user_test",
          projectId: null,
          title: "Microbial Colony Formation",
          description: "Noticed rapid bacterial growth at 37C incubator.",
          notes: null,
          hypothesis: null,
          observedAt: "2026-09-01T10:00:00Z",
          location: { latitude: 34.05, longitude: -118.24, precision: "exact", label: "Lab Station 3" },
          tags: ["biology", "bacteria"],
          measurements: [{ name: "Temperature", value: 37, unit: "C" }],
          status: "recorded",
          mediaCount: 1,
          version: 1,
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-01T10:00:00Z",
        },
      ],
      meta: { limit: 6, hasMore: true },
    });

    vi.mocked(api.fetchProjects).mockResolvedValue({
      data: [
        {
          id: "proj_1",
          ownerId: "user_test",
          title: "Enzyme Kinetics Study",
          description: "Active research project",
          field: "Biochemistry",
          tags: ["kinetics"],
          status: "active",
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-01T10:00:00Z",
        },
      ],
      meta: { limit: 50, hasMore: false },
    });

    vi.mocked(api.fetchResearchTasks).mockResolvedValue({
      data: [
        {
          id: "task_1",
          ownerId: "user_test",
          projectId: null,
          relatedObservationIds: ["obs_1"],
          title: "Replicate assay with control group",
          description: "Ensure reproducibility of colony growth.",
          status: "planned",
          source: "user",
          sourceAnalysisId: null,
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-01T10:00:00Z",
        },
      ],
      meta: { limit: 50, hasMore: false },
    });

    vi.mocked(api.fetchConversations).mockResolvedValue({
      data: [],
      meta: { limit: 5 },
    });

    vi.mocked(api.fetchAnalyses).mockResolvedValue({
      data: [
        {
          id: "analysis_1",
          ownerId: "user_test",
          projectId: null,
          observationIds: ["obs_1"],
          conversationId: null,
          type: "analysis",
          summary: "Exponential growth detected in bacterial samples.",
          keyFindings: ["Growth rate 2x higher than baseline"],
          hypotheses: [],
          uncertainties: [],
          suggestedQuestions: [],
          openQuestions: [],
          suggestedNextSteps: [],
          model: "gemini-2.5-flash",
          promptVersion: "observation-analysis-v1",
          createdAt: "2026-09-01T10:00:00Z",
        },
      ],
      meta: { limit: 5 },
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Header
    expect(screen.getByRole("heading", { name: /research dashboard/i })).toBeInTheDocument();

    // Honest metric titles
    expect(screen.getAllByText("Recent Observations")[0]).toBeInTheDocument();
    expect(screen.getByText("Active Projects")).toBeInTheDocument();
    expect(screen.getByText("Pending Tasks")).toBeInTheDocument();
    expect(screen.getAllByText("Recent AI Analyses")[0]).toBeInTheDocument();

    // Wait for observation to load
    await waitFor(() => {
      expect(screen.getByText("Microbial Colony Formation")).toBeInTheDocument();
    });

    // hasMore indicator on observations (1+)
    expect(screen.getByText("+")).toBeInTheDocument();

    // Verify observation details
    expect(screen.getByText("Noticed rapid bacterial growth at 37C incubator.")).toBeInTheDocument();
    expect(screen.getByText("1 files attached")).toBeInTheDocument();
    expect(screen.getByText("Lab Station 3")).toBeInTheDocument();

    // Verify all 4 quick action links (F11)
    expect(screen.getAllByRole("link", { name: /ask my journal/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /research map/i })[0]).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ai scientific chat/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /research projects/i })).toBeInTheDocument();

    // Verify task and analysis loaded
    expect(screen.getByText("Replicate assay with control group")).toBeInTheDocument();
    expect(screen.getByText("Exponential growth detected in bacterial samples.")).toBeInTheDocument();
  });

  it("handles empty states gracefully when no records exist", async () => {
    vi.mocked(api.fetchObservations).mockResolvedValue({ data: [], meta: { limit: 6 } });
    vi.mocked(api.fetchProjects).mockResolvedValue({ data: [], meta: { limit: 50 } });
    vi.mocked(api.fetchResearchTasks).mockResolvedValue({ data: [], meta: { limit: 50 } });
    vi.mocked(api.fetchConversations).mockResolvedValue({ data: [], meta: { limit: 5 } });
    vi.mocked(api.fetchAnalyses).mockResolvedValue({ data: [], meta: { limit: 5 } });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no observations logged yet/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /log first observation/i })).toBeInTheDocument();
  });

  it("handles partial fetch failures with reachable retry banner and section error state (F6)", async () => {
    // Observations fail; other endpoints succeed
    vi.mocked(api.fetchObservations).mockRejectedValue(new Error("Network connection lost"));
    vi.mocked(api.fetchProjects).mockResolvedValue({ data: [], meta: { limit: 50 } });
    vi.mocked(api.fetchResearchTasks).mockResolvedValue({ data: [], meta: { limit: 50 } });
    vi.mocked(api.fetchConversations).mockResolvedValue({ data: [], meta: { limit: 5 } });
    vi.mocked(api.fetchAnalyses).mockResolvedValue({ data: [], meta: { limit: 5 } });

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
