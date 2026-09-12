import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import ObservationFormPage from "./ObservationFormPage";
import * as api from "../lib/api";

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

// Settings preference under test (DATABASE_SCHEMA.md §5.1): the suite flips
// this value per case instead of standing up a QueryClientProvider.
let mockPreferences: { locationEnabled?: boolean } | null;
vi.mock("../lib/useProfile", () => ({
  useProfile: () => ({
    profile: null,
    displayName: "Test Researcher",
    email: "tester@example.com",
    avatarUrl: null,
    memberSince: null,
    preferences: mockPreferences,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useInvalidateProfile: () => vi.fn(),
}));

function renderNewObservation() {
  const router = createMemoryRouter(
    [{ path: "/observations/new", element: <ObservationFormPage /> }],
    { initialEntries: ["/observations/new"] }
  );
  const view = render(<RouterProvider router={router} />);
  // Both "± Advanced Fields" spans live in the summary; click the element.
  const expandAdvanced = () => userEvent.click(view.container.querySelector("summary")!);
  return { view, expandAdvanced };
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^title/i), "Frost patterns on south-facing window");
  await user.type(
    screen.getByLabelText(/description \/ field notes/i),
    "Feather-like crystals formed overnight near the frame seal."
  );
}

describe("ObservationFormPage — location defaults and validation", () => {
  const originalGeolocation = navigator.geolocation;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPreferences = { locationEnabled: false };
    vi.mocked(api.createObservation).mockResolvedValue({
      data: { id: "obs_new" },
    } as never);
  });

  afterEach(() => {
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

  it("preference ON: opens the advanced panel, attempts GPS once, and attaches location on success", async () => {
    mockPreferences = { locationEnabled: true };
    // GPS succeeds immediately — the location section must switch itself on
    // and fill the captured coordinates without any user interaction.
    const getCurrentPosition = vi.fn((success: (pos: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) =>
      success({ coords: { latitude: 47.3769, longitude: 8.5417, accuracy: 12 } })
    );
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });

    renderNewObservation();

    const locationSwitch = await screen.findByRole("switch", {
      name: /attach geographic location/i,
    });
    await waitFor(() => expect(locationSwitch).toBeVisible());
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText(/^latitude$/i)).toHaveValue(47.3769));
    await waitFor(() => expect(screen.getByLabelText(/^longitude$/i)).toHaveValue(8.5417));
    expect(screen.getByText(/captured gps coordinates/i)).toBeInTheDocument();
  });

  it("preference OFF: keeps the advanced panel closed — no auto GPS prompt", async () => {
    const getCurrentPosition = stubGeolocation();

    renderNewObservation();

    // Panel content is reachable but collapsed; the location toggle is inside
    // it and no GPS capture is attempted on mount.
    expect(screen.getByRole("switch", { name: /attach geographic location/i })).not.toBeVisible();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("blocks submit with empty coordinates when the location toggle is on", async () => {
    const user = userEvent.setup();
    stubGeolocation();

    const { expandAdvanced } = renderNewObservation();
    await fillRequiredFields(user);

    // Expand advanced panel and switch location on — fields start empty (null)
    await expandAdvanced();
    await user.click(screen.getByRole("switch", { name: /attach geographic location/i }));

    const lat = screen.getByLabelText(/^latitude$/i);
    const lng = screen.getByLabelText(/^longitude$/i);
    expect(lat).toHaveValue(null);
    expect(lng).toHaveValue(null);

    await user.click(screen.getByRole("button", { name: /save observation/i }));

    expect(await screen.findByText(/enter both latitude and longitude/i)).toBeInTheDocument();
    expect(api.createObservation).not.toHaveBeenCalled();
  });

  it("accepts entered coordinates and submits them with the observation", async () => {
    const user = userEvent.setup();
    stubGeolocation();

    const { expandAdvanced } = renderNewObservation();
    await fillRequiredFields(user);

    await expandAdvanced();
    await user.click(screen.getByRole("switch", { name: /attach geographic location/i }));

    await user.type(screen.getByLabelText(/^latitude$/i), "46.54");
    await user.type(screen.getByLabelText(/^longitude$/i), "8.01");
    await user.click(screen.getByRole("button", { name: /save observation/i }));

    await waitFor(() => {
      expect(api.createObservation).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.objectContaining({ latitude: 46.54, longitude: 8.01 }),
        })
      );
    });
  });
});
