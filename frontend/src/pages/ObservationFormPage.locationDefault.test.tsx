import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import ObservationFormPage from "./ObservationFormPage";
import * as api from "../lib/api";
import { useProfile } from "../lib/useProfile";

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    fetchProjects: vi.fn(async () => ({ data: [] })),
    fetchObservation: vi.fn(),
    createObservation: vi.fn(),
  };
});

vi.mock("../lib/useProfile", async () => {
  const actual = await vi.importActual<typeof import("../lib/useProfile")>("../lib/useProfile");
  return {
    ...actual,
    useProfile: vi.fn(),
  };
});

function mockProfile(locationEnabled: boolean | null) {
  vi.mocked(useProfile).mockReturnValue({
    profile: { preferences: { locationEnabled } } as ReturnType<typeof useProfile>["profile"],
    displayName: null,
    email: null,
    avatarUrl: null,
    memberSince: null,
    preferences: locationEnabled === null ? null : { locationEnabled },
    isLoading: false,
    refetch: vi.fn(),
  } as ReturnType<typeof useProfile>);
}

function renderNewObservation() {
  const router = createMemoryRouter(
    [{ path: "/observations/new", element: <ObservationFormPage /> }],
    { initialEntries: ["/observations/new"] }
  );
  return render(<RouterProvider router={router} />);
}

describe("ObservationFormPage — location-capture default (settings refactor 2026-09-07)", () => {
  const originalGeolocation = navigator.geolocation;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // @ts-expect-error restore the (possibly stubbed) geolocation
    Object.defineProperty(navigator, "geolocation", {
      value: originalGeolocation,
      configurable: true,
    });
  });

  function stubGeolocation() {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });
    return getCurrentPosition;
  }

  it("opens the location panel and attempts GPS once when the preference is on", async () => {
    const getCurrentPosition = stubGeolocation();
    mockProfile(true);

    renderNewObservation();

    // Advanced panel (holding the location section) is open — the location
    // toggle is visible and GPS was attempted exactly once.
    await waitFor(() => {
      expect(screen.getByLabelText(/attach geographic location/i)).toBeVisible();
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("leaves the panel closed and never prompts GPS when the preference is off", () => {
    const getCurrentPosition = stubGeolocation();
    mockProfile(false);

    renderNewObservation();

    // Native <details> keeps children in the DOM when closed, so the
    // discriminator is visibility (panel closed) plus no GPS prompt.
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/attach geographic location/i)).not.toBeVisible();
  });

  it("does not auto-capture in edit mode even when the preference is on", () => {
    const getCurrentPosition = stubGeolocation();
    mockProfile(true);
    vi.mocked(api.fetchObservation).mockResolvedValue({
      data: {
        id: "obs_1",
        title: "t",
        description: "d",
        notes: null,
        hypothesis: null,
        observedAt: "2026-09-01T10:00:00Z",
        tags: [],
        measurements: [],
        status: "observed",
        projectId: null,
        mediaCount: 0,
        version: 1,
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-01T10:00:00Z",
      },
    } as never);

    const router = createMemoryRouter(
      [{ path: "/observations/:id/edit", element: <ObservationFormPage /> }],
      { initialEntries: ["/observations/obs_1/edit"] }
    );
    render(<RouterProvider router={router} />);

    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
