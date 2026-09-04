import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import * as authContext from "../lib/firebase/authContext";

vi.mock("../lib/firebase/authContext", () => ({
  useAuth: vi.fn(),
}));

describe("LandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the product title, hero section, and sign in CTA buttons", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(screen.getAllByText(/ai scientific journal/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/The Intelligent Field & Lab Notebook/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /sign in with google/i }).length).toBeGreaterThan(0);
  });

  it("renders the 4 core pillars of the scientific journal (Plan §2.1)", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Field Observations")).toBeInTheDocument();
    expect(screen.getByText("Multi-Modal Media")).toBeInTheDocument();
    expect(screen.getByText("Research Map & GPS")).toBeInTheDocument();
    expect(screen.getByText("Ask My Journal (RAG)")).toBeInTheDocument();
  });

  it("renders the 4-step scientific workflow progression", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Record Observation")).toBeInTheDocument();
    expect(screen.getByText("AI Synthesis")).toBeInTheDocument();
    expect(screen.getByText("Plan Research Tasks")).toBeInTheDocument();
    expect(screen.getByText("Synthesize with RAG")).toBeInTheDocument();
  });

  it("redirects authenticated researchers directly to /dashboard (Plan §2.1 / F10)", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: { uid: "user_active_scientist", email: "scientist@alps.ch" } as any,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard-target">Dashboard Landed</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("dashboard-target")).toBeInTheDocument();
  });
});
