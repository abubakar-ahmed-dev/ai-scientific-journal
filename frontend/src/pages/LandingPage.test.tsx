import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";

describe("LandingPage", () => {
  it("renders the product title", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: /ai scientific journal/i })
    ).toBeInTheDocument();
  });
});
