import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProjectDetailPage from "./ProjectDetailPage";
import * as api from "../lib/api";

vi.mock("../lib/firebase/authContext", () => ({
  useAuth: () => ({
    currentUser: { uid: "user_test", email: "scientist@lab.edu" },
    loading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("../components/ui/Toast", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("../lib/api", () => ({
  fetchProject: vi.fn(),
  fetchObservations: vi.fn(),
  fetchResearchTasks: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));

describe("ProjectDetailPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders project details, observations, and switches to tasks tab", async () => {
    vi.mocked(api.fetchProject).mockResolvedValue({
      data: {
        id: "proj_123",
        ownerId: "user_test",
        title: "Alpine Flora Adaptation",
        description: "Studying elevation tolerance in high-altitude plants.",
        status: "active",
        field: "Botany",
        tags: ["alpine", "flora"],
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-01T10:00:00Z",
      },
    });

    vi.mocked(api.fetchObservations).mockResolvedValue({
      data: [
        {
          id: "obs_101",
          ownerId: "user_test",
          projectId: "proj_123",
          title: "Saxifraga stellaris sample at 2800m",
          description: "Found thriving in scree slope.",
          notes: null,
          hypothesis: null,
          observedAt: "2026-09-01T12:00:00Z",
          location: null,
          tags: ["plant"],
          measurements: [],
          status: "recorded",
          mediaCount: 0,
          version: 1,
          createdAt: "2026-09-01T12:00:00Z",
          updatedAt: "2026-09-01T12:00:00Z",
        },
      ],
      meta: { limit: 50 },
    });

    vi.mocked(api.fetchResearchTasks).mockResolvedValue({
      data: [
        {
          id: "task_501",
          ownerId: "user_test",
          projectId: "proj_123",
          relatedObservationIds: ["obs_101"],
          title: "Soil nitrogen assay at high altitude",
          description: "Sample nitrogen saturation across gradients.",
          status: "planned",
          source: "user",
          sourceAnalysisId: null,
          createdAt: "2026-09-01T12:00:00Z",
          updatedAt: "2026-09-01T12:00:00Z",
        },
      ],
      meta: { limit: 50 },
    });

    render(
      <MemoryRouter initialEntries={["/projects/proj_123"]}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Alpine Flora Adaptation")).toBeInTheDocument();
    });

    expect(screen.getByText("Studying elevation tolerance in high-altitude plants.")).toBeInTheDocument();
    expect(screen.getByText("Botany")).toBeInTheDocument();
    expect(screen.getByText("Saxifraga stellaris sample at 2800m")).toBeInTheDocument();

    // Switch to Tasks Tab
    const tasksTab = screen.getByRole("button", { name: /research tasks \(1\)/i });
    fireEvent.click(tasksTab);

    expect(screen.getByText("Soil nitrogen assay at high altitude")).toBeInTheDocument();
  });
});
