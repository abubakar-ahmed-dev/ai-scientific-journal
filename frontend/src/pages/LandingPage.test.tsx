import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import * as authContext from "../lib/firebase/authContext";

vi.mock("../lib/firebase/authContext", () => ({
  useAuth: vi.fn(),
}));

function renderLanding(initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<div data-testid="dashboard-target">Dashboard Landed</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LandingPage (redesigned)", () => {
  it("renders the headline, product name, and sign-in CTA for signed-out visitors", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderLanding();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Turn observations into evidence-backed research/i
    );
    expect(screen.getAllByText(/AI Scientific Journal/i)[0]).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /sign in with google|start your journal/i }).length
    ).toBeGreaterThan(0);
  });

  it("labels previews as sample data and never implies a live AI call", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderLanding();

    expect(screen.getByText(/Field entry · Sample/i)).toBeInTheDocument();
    expect(screen.getByText(/Gemini Analysis · Sample/i)).toBeInTheDocument();
    expect(screen.getByText(/Illustrative map/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Example sources/i).length).toBeGreaterThan(0);
  });

  it("renders nav anchor links to page sections", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderLanding();

    const nav = screen.getAllByRole("navigation", { name: /site/i })[0];
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /how it works/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^features$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^privacy$/i }).length).toBeGreaterThan(0);
  });

  it("renders the four workflow steps with the suggest-vs-accept distinction", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderLanding();

    expect(screen.getByText("Record")).toBeInTheDocument();
    expect(screen.getByText("Add Evidence")).toBeInTheDocument();
    expect(screen.getByText("Analyze")).toBeInTheDocument();
    expect(screen.getByText("Investigate")).toBeInTheDocument();
    expect(
      screen.getByText(/you create a task by accepting one/i)
    ).toBeInTheDocument();
  });

  it("renders the three feature sections with the approved headings", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderLanding();

    expect(screen.getByRole("heading", { name: /Capture the details that matter/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /See your research in context/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ask questions\. Follow the evidence/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Your records are the source of truth/i })).toBeInTheDocument();
  });

  it("shows Open Dashboard links instead of sign-in buttons for signed-in researchers", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: { uid: "user_active_scientist", email: "scientist@alps.ch" } as any,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderLanding();

    // Signed-in users navigate to the dashboard; no sign-in CTAs remain.
    expect(screen.getAllByRole("link", { name: /open dashboard/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /sign in with google/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start your journal/i })).not.toBeInTheDocument();
  });

  it("keeps a single h1 and provides a skip-to-content link", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderLanding();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /skip to content/i })).toBeInTheDocument();
  });

  it("navigates to the dashboard after a successful Google sign-in (no second click)", async () => {
    // useAuth reads live state so the mock mirrors the real sequence: the
    // popup promise resolves and onAuthStateChanged commits the user.
    let currentUser: { uid: string } | null = null;
    vi.mocked(authContext.useAuth).mockImplementation(
      () =>
        ({
          currentUser,
          loading: false,
          signInWithGoogle: vi.fn(async () => {
            currentUser = { uid: "user_new_1" };
          }),
          signOut: vi.fn(),
        }) as unknown as ReturnType<typeof authContext.useAuth>
    );

    renderLanding();

    fireEvent.click(screen.getAllByRole("button", { name: /start your journal/i })[0]);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-target")).toBeInTheDocument();
    });
  });

  it("stays on the landing page when the sign-in popup is cancelled", async () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      signInWithGoogle: vi.fn(async () => {
        throw new Error("auth/popup-closed-by-user");
      }),
      signOut: vi.fn(),
    });

    renderLanding();

    fireEvent.click(screen.getAllByRole("button", { name: /start your journal/i })[0]);

    // Give the rejection a tick to surface — no navigation, no crash.
    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-target")).not.toBeInTheDocument();
    });
    expect(screen.getAllByRole("heading", { level: 1 })[0]).toBeInTheDocument();
  });
});
