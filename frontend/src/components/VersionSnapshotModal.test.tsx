import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VersionSnapshotModal } from "./VersionSnapshotModal";
import type { ObservationVersion, Observation } from "../lib/api";

const mockVersion: ObservationVersion = {
  id: "ver_1",
  version: 1,
  title: "Initial Observation Title",
  description: "Initial description recorded in the field.",
  hypothesis: "Higher temperature accelerates reaction rate.",
  measurements: [
    { name: "Temperature", value: 25.5, unit: "°C" },
    { name: "pH", value: 7.2, unit: "pH" },
  ],
  editedAt: "2026-09-01T12:00:00Z",
  editedBy: "user_test_editor",
  changeReason: "Corrected initial measurement values",
};

const mockCurrentObservation: Observation = {
  id: "obs_1",
  ownerId: "user_test",
  projectId: null,
  title: "Updated Observation Title",
  description: "Updated description after secondary assay.",
  notes: null,
  hypothesis: "Confirmed temperature correlation.",
  observedAt: "2026-09-01T12:00:00Z",
  location: null,
  tags: ["chemistry"],
  measurements: [{ name: "Temperature", value: 30, unit: "°C" }],
  status: "recorded",
  mediaCount: 0,
  version: 2,
  createdAt: "2026-09-01T12:00:00Z",
  updatedAt: "2026-09-01T14:00:00Z",
};

describe("VersionSnapshotModal Component", () => {
  it("renders revision snapshot details, title, and measurements table", () => {
    const handleClose = vi.fn();
    render(
      <VersionSnapshotModal
        version={mockVersion}
        currentObservation={mockCurrentObservation}
        onClose={handleClose}
      />
    );

    expect(screen.getByText("Revision Snapshot v1")).toBeInTheDocument();
    expect(screen.getByText("Initial Observation Title")).toBeInTheDocument();
    expect(screen.getByText("Initial description recorded in the field.")).toBeInTheDocument();
    expect(screen.getByText("Higher temperature accelerates reaction rate.")).toBeInTheDocument();
    expect(screen.getByText("Temperature")).toBeInTheDocument();
    expect(screen.getByText("25.5")).toBeInTheDocument();
    expect(screen.getAllByText("pH")[0]).toBeInTheDocument();
  });

  it("switches to comparison tab and displays both historical and current states", () => {
    const handleClose = vi.fn();
    render(
      <VersionSnapshotModal
        version={mockVersion}
        currentObservation={mockCurrentObservation}
        onClose={handleClose}
      />
    );

    const compareTab = screen.getByRole("button", { name: /compare with current/i });
    fireEvent.click(compareTab);

    expect(screen.getByText("Current (v2)")).toBeInTheDocument();
    expect(screen.getByText("Updated Observation Title")).toBeInTheDocument();
    expect(screen.getByText("Initial Observation Title")).toBeInTheDocument();
  });

  it("calls onClose when clicking close button or pressing Escape", () => {
    const handleClose = vi.fn();
    render(
      <VersionSnapshotModal
        version={mockVersion}
        currentObservation={mockCurrentObservation}
        onClose={handleClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /close inspector/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
