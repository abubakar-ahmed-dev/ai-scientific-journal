import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Layout } from "./Layout";

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
    expect(screen.getByRole("navigation", { name: /mobile navigation/i })).toBeInTheDocument();

    // Clicking close toggles it back
    fireEvent.click(screen.getByRole("button", { name: /close navigation menu/i }));
    expect(screen.queryByRole("navigation", { name: /mobile navigation/i })).not.toBeInTheDocument();
  });

  it("triggers signOut when clicking Sign Out button", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Layout>
          <div>Content</div>
        </Layout>
      </MemoryRouter>
    );

    const signOutBtn = screen.getAllByRole("button", { name: /sign out/i })[0];
    fireEvent.click(signOutBtn);
    expect(mockSignOut).toHaveBeenCalled();
  });
});
