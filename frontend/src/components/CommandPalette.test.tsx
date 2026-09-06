import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  fetchProjects: vi.fn().mockResolvedValue({ data: [], meta: { limit: 5 } }),
  fetchObservations: vi.fn().mockResolvedValue({ data: [], meta: { limit: 6 } }),
}));

function renderPalette(open = true, onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <CommandPalette open={open} onClose={onClose} />
    </MemoryRouter>
  );
  return { onClose };
}

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed, lists actions when open", () => {
    const closed = render(
      <MemoryRouter>
        <CommandPalette open={false} onClose={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    closed.unmount();

    renderPalette(true);

    expect(screen.getByRole("dialog", { name: /command palette/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /new observation/i })).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: /^dashboard$/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("filters items by query", () => {
    renderPalette(true);

    fireEvent.change(screen.getByRole("textbox", { name: /search commands/i }), {
      target: { value: "map" },
    });

    expect(screen.getByRole("option", { name: /research map/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /create task/i })).not.toBeInTheDocument();
  });

  it("shows recent projects and observations loaded on open", async () => {
    vi.mocked(api.fetchProjects).mockResolvedValue({
      data: [
        {
          id: "proj_1",
          ownerId: "u",
          title: "Alpine Flora Study",
          description: null,
          field: null,
          status: "active",
          tags: [],
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-01T10:00:00Z",
        },
      ],
      meta: { limit: 5, hasMore: false },
    });
    vi.mocked(api.fetchObservations).mockResolvedValue({
      data: [
        {
          id: "obs_1",
          ownerId: "u",
          projectId: null,
          title: "Lichen UV reading",
          description: "d",
          notes: null,
          hypothesis: null,
          observedAt: "2026-09-01T10:00:00Z",
          location: null,
          tags: [],
          measurements: [],
          status: "recorded",
          mediaCount: 0,
          version: 1,
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-01T10:00:00Z",
        },
      ],
      meta: { limit: 5, hasMore: false },
    });

    renderPalette(true);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /alpine flora study/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("option", { name: /lichen uv reading/i })).toBeInTheDocument();
  });

  it("Escape closes and arrow navigation moves the active option", () => {
    const { onClose } = renderPalette(true);

    const input = screen.getByRole("textbox", { name: /search commands/i });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    const options = screen.getAllByRole("option");
    const selected = options.find((o) => o.getAttribute("aria-selected") === "true");
    expect(selected).toBeTruthy();
    expect(selected).not.toBe(options[0]);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Enter activates the highlighted item", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <CommandPalette open onClose={onClose} />
      </MemoryRouter>
    );

    const input = screen.getByRole("textbox", { name: /search commands/i });
    fireEvent.change(input, { target: { value: "settings" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Activating a command closes the palette.
    expect(onClose).toHaveBeenCalled();
  });
});
