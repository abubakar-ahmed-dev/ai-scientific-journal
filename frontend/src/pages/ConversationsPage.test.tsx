import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConversationsPage } from "@/pages/ConversationsPage";

vi.mock("../lib/firebase/authContext", () => ({
  useAuth: () => ({
    currentUser: { uid: "test-user", email: "test@example.com" },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("../lib/api", () => ({
  fetchConversations: vi.fn().mockResolvedValue({
    data: [
      {
        id: "conv-1",
        ownerId: "test-user",
        projectId: null,
        title: "Feeder Discussion",
        contextType: "general",
        contextId: null,
        messageCount: 2,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    meta: { hasMore: false, nextCursor: null },
  }),
  fetchMessages: vi.fn().mockResolvedValue({
    data: [
      {
        id: "msg-1",
        ownerId: "test-user",
        conversationId: "conv-1",
        role: "user",
        content: "What causes the feeding spikes?",
        sequence: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: "msg-2",
        ownerId: "test-user",
        conversationId: "conv-1",
        role: "assistant",
        content: "Barometric pressure drops often stimulate bird foraging before fronts.",
        sequence: 2,
        model: "gemini-2.5-flash",
        createdAt: new Date().toISOString(),
      },
    ],
  }),
  fetchObservations: vi.fn().mockResolvedValue({ data: [] }),
  fetchProjects: vi.fn().mockResolvedValue({ data: [] }),
}));

describe("ConversationsPage", () => {
  it("renders conversations list and active chat window with messages", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/conversations?id=conv-1"]}>
          <ConversationsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: /^conversations$/i })).toBeInTheDocument();
    const titles = await screen.findAllByText("Feeder Discussion");
    expect(titles.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("What causes the feeding spikes?")).toBeInTheDocument();
    expect(
      await screen.findByText("Barometric pressure drops often stimulate bird foraging before fronts.")
    ).toBeInTheDocument();
  });
});
