import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ObservationsPage from "@/pages/ObservationsPage";

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
