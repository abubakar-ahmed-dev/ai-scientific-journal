import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResearchTasksPage } from "@/pages/ResearchTasksPage";

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
  updateResearchTask: vi.fn(),
  deleteResearchTask: vi.fn(),
}));

describe("ResearchTasksPage", () => {
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
});
