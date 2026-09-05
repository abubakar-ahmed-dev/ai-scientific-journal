import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResearchTasksPage } from "@/pages/ResearchTasksPage";
import * as api from "@/lib/api";

vi.mock("../lib/firebase/authContext", () => ({
  useAuth: () => ({
    currentUser: { uid: "test-user", email: "test@example.com" },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("../lib/api", () => ({
  fetchResearchTasks: vi.fn().mockResolvedValue({
    data: [
      {
        id: "task-1",
        ownerId: "test-user",
        projectId: null,
        title: "Deploy barometric pressure sensor array",
        description: "Accepted AI research suggestion: measure ambient pressure continuously for 5 days.",
        source: "gemini",
        sourceAnalysisId: "anl-1",
        status: "suggested",
        relatedObservationIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    meta: { hasMore: false, nextCursor: null },
  }),
  fetchProjects: vi.fn().mockResolvedValue({ data: [] }),
  createResearchTask: vi.fn(),
  updateResearchTask: vi.fn().mockResolvedValue({ data: { id: "task-1" } }),
  deleteResearchTask: vi.fn(),
}));

describe("ResearchTasksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders research tasks header and task cards", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ResearchTasksPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: /^research tasks$/i })).toBeInTheDocument();
    expect(
      await screen.findByText("Deploy barometric pressure sensor array")
    ).toBeInTheDocument();
    expect(screen.getByText("AI Suggested")).toBeInTheDocument();
  });

  it("opens the edit modal with prefilled fields and submits a patch", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ResearchTasksPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByText("Deploy barometric pressure sensor array");

    fireEvent.click(screen.getByTitle("Edit task"));

    const titleInput = await screen.findByDisplayValue("Deploy barometric pressure sensor array");
    expect(titleInput).toBeInTheDocument();

    fireEvent.change(titleInput, {
      target: { value: "Deploy barometric sensors for 7 days" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(api.updateResearchTask).toHaveBeenCalledWith("task-1", {
        title: "Deploy barometric sensors for 7 days",
      });
    });
  });

  it("offers only valid status transitions in the card status select", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ResearchTasksPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByText("Deploy barometric pressure sensor array");

    // Task is "suggested": select should offer current + planned/dismissed only.
    const statusSelect = screen.getByRole("combobox", {
      name: /change status for task/i,
    }) as HTMLSelectElement;
    const options = Array.from(statusSelect.options).map((o) => o.value);
    expect(options).toEqual(["suggested", "planned", "dismissed"]);

    fireEvent.change(statusSelect, { target: { value: "planned" } });
    await waitFor(() => {
      expect(api.updateResearchTask).toHaveBeenCalledWith("task-1", { status: "planned" });
    });
  });
});
