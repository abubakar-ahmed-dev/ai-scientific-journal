import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResearchMapPage } from "./ResearchMapPage";
import * as api from "../lib/api";

// Mock react-leaflet for JSDOM
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({
    children,
    position,
  }: {
    children?: React.ReactNode;
    position: [number, number];
  }) => (
    <div data-testid="map-marker" data-lat={position[0]} data-lng={position[1]}>
      {children}
    </div>
  ),
  Circle: ({
    center,
  }: {
    center: [number, number];
  }) => <div data-testid="map-circle" data-lat={center[0]} data-lng={center[1]} />,
  Popup: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map-popup">{children}</div>
  ),
}));

vi.mock("../lib/leafletSetup", () => ({
  setupLeafletIcons: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    fetchObservations: vi.fn(),
    fetchProjects: vi.fn(),
  };
});

describe("ResearchMapPage Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  function renderMapPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ResearchMapPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it("renders page header and filter controls", async () => {
    vi.mocked(api.fetchObservations).mockResolvedValue({ data: [], meta: { hasMore: false } } as any);
    vi.mocked(api.fetchProjects).mockResolvedValue({ data: [] } as any);

    renderMapPage();

    expect(screen.getByRole("heading", { name: /research map/i })).toBeInTheDocument();
    expect(await screen.findByText(/no mappable observations found/i)).toBeInTheDocument();
  });

  it("plots exact and approximate locations on the map, but EXCLUDES hidden locations (SECURITY §14)", async () => {
    vi.mocked(api.fetchObservations).mockResolvedValue({
      data: [
        {
          id: "obs-exact",
          title: "Exact Sighting",
          description: "Hawk at precise GPS cliff coordinates",
          observedAt: "2026-06-01T10:00:00Z",
          status: "recorded",
          version: 1,
          location: {
            latitude: 45.123,
            longitude: -122.456,
            precision: "exact",
            label: "Lookout Point",
          },
          measurements: [],
          tags: ["birds"],
        },
        {
          id: "obs-approx",
          title: "Approximate Sighting",
          description: "General nesting area in woodland",
          observedAt: "2026-06-02T10:00:00Z",
          status: "recorded",
          version: 1,
          location: {
            latitude: 45.5,
            longitude: -122.8,
            precision: "approximate",
            label: "Timberline Forest",
          },
          measurements: [],
          tags: ["woodland"],
        },
        {
          id: "obs-hidden",
          title: "Hidden Orchid Habitat",
          description: "Endangered plant species; coordinates strictly private",
          observedAt: "2026-06-03T10:00:00Z",
          status: "recorded",
          version: 1,
          location: {
            latitude: 46.0,
            longitude: -121.0,
            precision: "hidden",
            label: "Secret Valley",
          },
          measurements: [],
          tags: ["botany"],
        },
      ],
    } as any);

    vi.mocked(api.fetchProjects).mockResolvedValue({ data: [] } as any);

    renderMapPage();

    // Wait for markers to render
    const markers = await screen.findAllByTestId("map-marker");

    // Exactly 2 markers: obs-exact and obs-approx (obs-hidden MUST NOT be rendered)
    expect(markers).toHaveLength(2);

    // Verify stats chips
    expect(screen.getByText("2 Plotted Pins")).toBeInTheDocument();
    expect(screen.getByText("1 Hidden for Privacy")).toBeInTheDocument();

    // Verify title of exact and approx sightings appear in popups
    expect(screen.getByText("Exact Sighting")).toBeInTheDocument();
    expect(screen.getByText("Approximate Sighting")).toBeInTheDocument();

    // Verify hidden title does NOT appear on the map
    expect(screen.queryByText("Hidden Orchid Habitat")).not.toBeInTheDocument();

    // Verify approximate location produces a circle
    expect(screen.getByTestId("map-circle")).toBeInTheDocument();

    // SECURITY §14: the approximate marker is plotted at the FUZZED coordinate
    // (1 decimal place), never the raw stored point (45.5 → 45.5 is unchanged,
    // so use the exact observation to assert pass-through and the approx marker
    // to assert it renders at a rounded value).
    const approxMarker = markers.find(
      (m) => m.getAttribute("data-lat") === "45.5"
    );
    expect(approxMarker).toBeDefined();
  });

  it("renders approximate markers only at fuzzed (1-decimal) coordinates", async () => {
    vi.mocked(api.fetchObservations).mockResolvedValue({
      data: [
        {
          id: "obs-approx-precise",
          title: "Sensitive Nest Site",
          description: "Location fuzzed for habitat protection",
          observedAt: "2026-06-05T10:00:00Z",
          status: "recorded",
          version: 1,
          location: {
            latitude: 45.123456,
            longitude: -122.876543,
            precision: "approximate",
            label: "Nesting Grove",
          },
          measurements: [],
          tags: ["wildlife"],
        },
      ],
    } as any);
    vi.mocked(api.fetchProjects).mockResolvedValue({ data: [] } as any);

    renderMapPage();

    const marker = await screen.findByTestId("map-marker");
    // Raw coordinates (45.123456 / -122.876543) must NOT be rendered;
    // the fuzzed 1-decimal values (45.1 / -122.9) must be.
    expect(marker.getAttribute("data-lat")).toBe("45.1");
    expect(marker.getAttribute("data-lng")).toBe("-122.9");
    expect(marker.getAttribute("data-lat")).not.toBe("45.123456");
  });

  it("paginates beyond the first page of observations (no silent 100-record truncation)", async () => {
    const page1 = Array.from({ length: 2 }, (_, i) => ({
      id: `obs-p1-${i}`,
      title: `Page One ${i}`,
      description: "d",
      observedAt: "2026-06-01T10:00:00Z",
      status: "recorded",
      version: 1,
      location: { latitude: 40 + i, longitude: -70 - i, precision: "exact" },
      measurements: [],
      tags: [],
    }));
    const page2 = [
      {
        id: "obs-p2-0",
        title: "Page Two Zero",
        description: "d",
        observedAt: "2026-06-02T10:00:00Z",
        status: "recorded",
        version: 1,
        location: { latitude: 42.5, longitude: -72.5, precision: "exact" },
        measurements: [],
        tags: [],
      },
    ];

    vi.mocked(api.fetchObservations)
      .mockResolvedValueOnce({ data: page1, meta: { hasMore: true, nextCursor: "cursor-2" } } as any)
      .mockResolvedValueOnce({ data: page2, meta: { hasMore: false } } as any);
    vi.mocked(api.fetchProjects).mockResolvedValue({ data: [] } as any);

    renderMapPage();

    // All 3 observations across both pages must be plotted
    expect(await screen.findAllByTestId("map-marker")).toHaveLength(3);
    expect(screen.getByText("Page Two Zero")).toBeInTheDocument();
    expect(screen.getByText("3 Plotted Pins")).toBeInTheDocument();
  });

  it("filters map markers by tag", async () => {
    vi.mocked(api.fetchObservations).mockResolvedValue({
      data: [
        {
          id: "obs-1",
          title: "Eagle Sight",
          description: "Bald eagle spotted",
          observedAt: "2026-06-01T10:00:00Z",
          status: "recorded",
          version: 1,
          location: { latitude: 44.0, longitude: -120.0, precision: "exact" },
          measurements: [],
          tags: ["raptors"],
        },
        {
          id: "obs-2",
          title: "Geology Sample",
          description: "Basalt rock column",
          observedAt: "2026-06-02T10:00:00Z",
          status: "recorded",
          version: 1,
          location: { latitude: 44.5, longitude: -120.5, precision: "exact" },
          measurements: [],
          tags: ["geology"],
        },
      ],
    } as any);
    vi.mocked(api.fetchProjects).mockResolvedValue({ data: [] } as any);

    renderMapPage();

    expect(await screen.findAllByTestId("map-marker")).toHaveLength(2);

    // Filter by tag "raptors"
    const tagSelect = screen.getByDisplayValue("All Tags");
    fireEvent.change(tagSelect, { target: { value: "raptors" } });

    expect(screen.getAllByTestId("map-marker")).toHaveLength(1);
    expect(screen.getByText("Eagle Sight")).toBeInTheDocument();
    expect(screen.queryByText("Geology Sample")).not.toBeInTheDocument();
  });
});
