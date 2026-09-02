import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";

vi.mock("../lib/firebase/authContext", () => ({
  useAuth: () => ({
    currentUser: null,
    loading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

describe("LandingPage", () => {
  it("renders the product title and sign in button", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: /ai scientific journal/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in with google/i })
    ).toBeInTheDocument();
  });
});
