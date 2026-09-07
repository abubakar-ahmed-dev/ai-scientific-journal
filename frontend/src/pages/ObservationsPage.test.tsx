import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ObservationsPage from "@/pages/ObservationsPage";

// Settings refactor: Layout consumes the shared /me profile via react-query;
// tests stub the hook instead of standing up a QueryClientProvider.
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


vi.mock("../lib/firebase/authContext", () => ({
  useAuth: () => ({
    currentUser: { uid: "test-user", email: "test@example.com" },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("../lib/api", () => ({
  fetchObservations: vi.fn().mockResolvedValue({
    data: [
      {
        id: "obs-1",
        title: "Test Observation 1",
        description: "Test description",
        status: "observed",
        observedAt: new Date().toISOString(),
        tags: ["test"],
        measurements: [],
        version: 1,
      },
    ],
    meta: { hasMore: false, nextCursor: null },
  }),
  fetchProjects: vi.fn().mockResolvedValue({
    data: [],
  }),
}));

describe("ObservationsPage", () => {
  it("renders page heading and observation list items", async () => {
    render(
      <MemoryRouter>
        <ObservationsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /^observations$/i })).toBeInTheDocument();
    expect(await screen.findByText("Test Observation 1")).toBeInTheDocument();
  });
});
