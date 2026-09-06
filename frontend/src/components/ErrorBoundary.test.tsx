import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

const ThrowingComponent = () => {
  throw new Error("Simulated rendering failure in test");
};

describe("ErrorBoundary Component", () => {
  it("catches render errors and displays fallback UI", () => {
    // Suppress console.error during expected failure
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Application Error Encountered/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulated rendering failure in test/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to dashboard/i })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("renders normal children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Normal Child Component</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Normal Child Component")).toBeInTheDocument();
  });
});
