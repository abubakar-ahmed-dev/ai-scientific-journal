import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Layout } from "./Layout";

// Settings refactor: Layout consumes the shared /me profile via react-query;
// tests stub the hook instead of standing up a QueryClientProvider.
vi.mock("../lib/useProfile", () => ({
  useProfile: () => ({
    profile: null,
    displayName: "Marie Curie",
    email: "tester@example.com",
    avatarUrl: null,
    memberSince: null,
    preferences: null,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useInvalidateProfile: () => vi.fn(),
}));


const mockSignOut = vi.fn();

vi.mock("../lib/firebase/authContext", () => ({
  useAuth: () => ({
    currentUser: { uid: "user_test_123", email: "scientist@lab.edu", displayName: "Marie Curie" },
    loading: false,
    signInWithGoogle: vi.fn(),
    signOut: mockSignOut,
  }),
}));

describe("Layout Component", () => {
  it("renders header, navigation links, and user initial", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByText(/AI Scientific Journal/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Observations" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Research Map" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask Journal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument(); // Initial of Marie Curie
  });

  it("toggles mobile navigation drawer on hamburger click", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Layout>
          <div>Child Page</div>
        </Layout>
      </MemoryRouter>
    );

    const toggleButton = screen.getByRole("button", { name: /open navigation menu/i });
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggleButton);
    expect(screen.getByRole("button", { name: /close navigation menu/i })).toHaveAttribute("aria-expanded", "true");
    // Drawer reuses the grouped nav model; the drawer container is rendered when open.
    expect(screen.getByLabelText(/mobile navigation/i)).toBeInTheDocument();

    // Clicking close toggles it back
    fireEvent.click(screen.getByRole("button", { name: /close navigation menu/i }));
    expect(screen.queryByLabelText(/mobile navigation/i)).not.toBeInTheDocument();
  });

  it("asks for confirmation before signing out", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Layout>
          <div>Content</div>
        </Layout>
      </MemoryRouter>
    );

    // Header pill opens the confirm dialog; session ends only after confirm
    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(mockSignOut).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/sign out\?/i);

    fireEvent.click(within(dialog).getByRole("button", { name: /^sign out$/i }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("collapses the sidebar and persists the preference", () => {
    localStorage.removeItem("asj.sidebar.collapsed");

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Layout>
          <div>Content</div>
        </Layout>
      </MemoryRouter>
    );

    // Expanded by default: labels visible, toggle says "Collapse"
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeInTheDocument();
    expect(screen.getAllByText("Observations").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    // Collapsed: preference persisted, toggle flips, nav labels hidden
    expect(localStorage.getItem("asj.sidebar.collapsed")).toBe("true");
    expect(screen.getByRole("button", { name: /expand sidebar/i })).toBeInTheDocument();
    expect(screen.queryByText("Ask Journal")).not.toBeInTheDocument();
    // Icon-only items keep accessible names
    expect(screen.getAllByRole("link", { name: "Ask Journal" }).length).toBeGreaterThanOrEqual(1);
  });
});
