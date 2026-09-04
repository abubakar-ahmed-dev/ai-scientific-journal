import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AnalysisViewer } from "./AnalysisViewer";
import type { Analysis } from "../lib/api";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual("../lib/api");
  return {
    ...actual,
    createResearchTask: vi.fn().mockResolvedValue({ data: { id: "task_new" } }),
    fetchProject: vi.fn(),
    fetchAnalysis: vi.fn(),
  };
});

const mockAnalysis: Analysis = {
  id: "anl_test_123",
  ownerId: "user_test",
  projectId: null,
  observationIds: ["obs_live", "obs_deleted"],
  conversationId: null,
  type: "analysis",
  summary: "Analysis detected positive correlation with temperature.",
  keyFindings: ["Growth rate doubled above 30C"],
  hypotheses: [
    {
      statement: "Enzyme X activity increases up to 45C",
      confidence: "high",
      supportingObservationIds: ["obs_live", "obs_deleted"],
    },
  ],
  uncertainties: ["Sample size was limited to 3 replicates"],
  suggestedQuestions: ["Does pH modulate this effect?"],
  openQuestions: [],
  suggestedNextSteps: ["Run test at 40C with 10 replicates"],
  model: "gemini-2.5-flash",
  promptVersion: "observation-analysis-v1",
  createdAt: "2026-09-01T12:00:00Z",
  sourceSummaries: [
    { observationId: "obs_live", found: true, title: "Live Culture Assay" },
    { observationId: "obs_deleted", found: false },
  ],
};

describe("AnalysisViewer Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders summary, findings, hypotheses, uncertainties, and suggestions", () => {
    render(
      <MemoryRouter>
        <AnalysisViewer analysis={mockAnalysis} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Analysis detected positive correlation/i)).toBeInTheDocument();
    expect(screen.getByText("Growth rate doubled above 30C")).toBeInTheDocument();
    expect(screen.getByText("Enzyme X activity increases up to 45C")).toBeInTheDocument();
    expect(screen.getByText(/Sample size was limited to 3 replicates/i)).toBeInTheDocument();
    expect(screen.getByText("Does pH modulate this effect?")).toBeInTheDocument();
    expect(screen.getByText("Run test at 40C with 10 replicates")).toBeInTheDocument();
  });

  it("handles dangling deleted observation sources gracefully without crashing", () => {
    render(
      <MemoryRouter>
        <AnalysisViewer analysis={mockAnalysis} />
      </MemoryRouter>
    );

    // The live observation is rendered as a link
    expect(screen.getAllByRole("link", { name: "Live Culture Assay" })[0]).toBeInTheDocument();

    // The deleted observation is rendered as [Observation deleted]
    expect(screen.getByText(/\[Observation deleted\]/i)).toBeInTheDocument();
    expect(screen.getByText(/\[Observation obs_dele\.\.\. deleted\]/i)).toBeInTheDocument();
  });

  it("hydrates sourceSummaries dynamically via fetchAnalysis if not inlined", async () => {
    const analysisWithoutSummaries: Analysis = {
      ...mockAnalysis,
      id: "anl_unhydrated_456",
      sourceSummaries: undefined,
    };

    vi.mocked(api.fetchAnalysis).mockResolvedValue({
      data: {
        ...analysisWithoutSummaries,
        sourceSummaries: [
          { observationId: "obs_live", found: true, title: "Hydrated Live Title" },
          { observationId: "obs_deleted", found: false },
        ],
      },
    });

    render(
      <MemoryRouter>
        <AnalysisViewer analysis={analysisWithoutSummaries} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.fetchAnalysis).toHaveBeenCalledWith("anl_unhydrated_456", true);
    });

    await waitFor(() => {
      expect(screen.getByText("Hydrated Live Title")).toBeInTheDocument();
      expect(screen.getByText(/\[Observation deleted\]/i)).toBeInTheDocument();
    });
  });

  it("handles dangling deleted project gracefully with [Unfiled project] pill (F2)", async () => {
    const analysisWithDeletedProject: Analysis = {
      ...mockAnalysis,
      projectId: "proj_deleted_999",
    };

    // fetchProject fails (404 NOT_FOUND)
    vi.mocked(api.fetchProject).mockRejectedValue(new Error("Project not found"));

    render(
      <MemoryRouter>
        <AnalysisViewer analysis={analysisWithDeletedProject} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.fetchProject).toHaveBeenCalledWith("proj_deleted_999");
    });

    await waitFor(() => {
      expect(screen.getByText(/\[Unfiled project\]/i)).toBeInTheDocument();
    });
  });

  it("renders live project link when project exists", async () => {
    const analysisWithActiveProject: Analysis = {
      ...mockAnalysis,
      projectId: "proj_active_888",
    };

    vi.mocked(api.fetchProject).mockResolvedValue({
      data: {
        id: "proj_active_888",
        ownerId: "user_test",
        title: "Active Glacier Study",
        description: "Studying ice core samples",
        field: "Glaciology",
        tags: ["glacier"],
        status: "active",
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      },
    });

    render(
      <MemoryRouter>
        <AnalysisViewer analysis={analysisWithActiveProject} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Active Glacier Study/i })).toHaveAttribute(
        "href",
        "/projects/proj_active_888"
      );
    });
  });

  it("triggers task creation when clicking + Accept as Task", async () => {
    const onTaskCreated = vi.fn();
    render(
      <MemoryRouter>
        <AnalysisViewer analysis={mockAnalysis} onTaskCreated={onTaskCreated} />
      </MemoryRouter>
    );

    const acceptBtn = screen.getByRole("button", { name: /\+ accept as task/i });
    fireEvent.click(acceptBtn);

    expect(api.createResearchTask).toHaveBeenCalledWith({
      source: "gemini",
      sourceAnalysisId: "anl_test_123",
      suggestionIndex: 0,
      projectId: null,
    });
  });
});
