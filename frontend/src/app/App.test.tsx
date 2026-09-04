import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import * as authContext from "../lib/firebase/authContext";

vi.mock("../lib/firebase/authContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../lib/firebase/config", () => ({}));

// Pages are stubbed so only routing behavior is under test.
vi.mock("../pages/LandingPage", () => ({ default: () => <div>Landing Page</div> }));
vi.mock("../pages/DashboardPage", () => ({ default: () => <div>Dashboard Content</div> }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("App routing guards", () => {
  it("renders the landing page for signed-out users at /", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderAt("/");
    expect(screen.getByText("Landing Page")).toBeInTheDocument();
  });

  it("redirects signed-out users from /dashboard to / (logout fix)", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderAt("/dashboard");
    expect(screen.getByText("Landing Page")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();
  });

  it("renders the dashboard for signed-in users", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: { uid: "user_1", email: "s@lab.org" } as never,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderAt("/dashboard");
    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
  });
});
