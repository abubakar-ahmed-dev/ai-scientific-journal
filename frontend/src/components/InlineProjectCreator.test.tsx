import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InlineProjectCreator } from "@/components/InlineProjectCreator";
import * as api from "@/lib/api";
import type { Project } from "@/lib/api";

vi.mock("../lib/api", () => ({
  createProject: vi.fn().mockResolvedValue({
    data: {
      id: "proj-1",
      ownerId: "test-user",
      title: "Urban Bird Ecology",
      description: null,
      field: "ecology",
      status: "active",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Project,
  }),
}));

describe("InlineProjectCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a project and reports it to the parent form", async () => {
    const onCreated = vi.fn();
    render(<InlineProjectCreator onCreated={onCreated} />);

    fireEvent.click(screen.getByRole("button", { name: /new project/i }));
    fireEvent.change(screen.getByPlaceholderText(/project title/i), {
      target: { value: "Urban Bird Ecology" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create & select/i }));

    await waitFor(() => {
      // Regression guard: only schema-legal fields (title, description, field)
      // are sent — `status` is rejected by the backend's strict CreateProjectSchema.
      expect(api.createProject).toHaveBeenCalledWith({
        title: "Urban Bird Ecology",
        field: null,
      });
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "proj-1" }));
    });
  });

  it("shows an error message when creation fails", async () => {
    vi.mocked(api.createProject).mockRejectedValueOnce(new Error("Validation failed"));
    render(<InlineProjectCreator onCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /new project/i }));
    fireEvent.change(screen.getByPlaceholderText(/project title/i), {
      target: { value: "Broken Project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create & select/i }));

    expect(await screen.findByText("Validation failed")).toBeInTheDocument();
  });
});
