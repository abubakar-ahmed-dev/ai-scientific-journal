import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RetrievalService } from "../../src/ai/retrieval/retrievalService";

// Mock Firestore and observationRepository
const mockSearchDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
const mockCanonicalObservations: Array<Record<string, unknown>> = [];

vi.mock("../../src/lib/firebaseAdmin", () => ({
  getFirebaseFirestore: () => ({
    collection: () => ({
      doc: () => ({
        collection: () => ({
          orderBy: () => ({
            limit: () => ({
              get: async () => ({
                empty: mockSearchDocs.length === 0,
                size: mockSearchDocs.length,
                docs: mockSearchDocs,
              }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("../../src/repository/observationRepository", () => ({
  observationRepository: {
    findByIds: async () => mockCanonicalObservations,
  },
}));

describe("RetrievalService.retrieve() pipeline", () => {
  let service: RetrievalService;

  beforeEach(() => {
    service = new RetrievalService();
    mockSearchDocs.length = 0;
    mockCanonicalObservations.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty candidates for an empty query", async () => {
    const result = await service.retrieve("uid-1", "", { limit: 10, minScore: 0.05 });
    expect(result.candidates).toEqual([]);
    expect(result.totalIndexed).toBe(0);
  });

  it("drops deleted observations via canonical re-check", async () => {
    // Index has 2 docs but only 1 exists canonically
    mockSearchDocs.push(
      { id: "obs-exists", data: () => ({ searchableText: "falcon diving hunting cliff prey" }) },
      { id: "obs-deleted", data: () => ({ searchableText: "falcon nesting behavior cliff" }) },
    );

    // Only obs-exists is in canonical collection (obs-deleted was deleted)
    mockCanonicalObservations.push({
      id: "obs-exists",
      title: "Falcon Hunting",
      observedAt: "2026-06-01T10:00:00Z",
      projectId: null,
    });

    const result = await service.retrieve("uid-1", "falcon cliff", { limit: 10, minScore: 0.01 });

    expect(result.totalIndexed).toBe(2);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.observationId).toBe("obs-exists");
    // obs-deleted must NOT appear
    expect(result.candidates.find((c) => c.observationId === "obs-deleted")).toBeUndefined();
  });

  it("filters by specific projectId", async () => {
    mockSearchDocs.push(
      { id: "obs-proj-a", data: () => ({ searchableText: "lichen growth granite rocks forest" }) },
      { id: "obs-proj-b", data: () => ({ searchableText: "lichen coverage stone wall garden" }) },
    );

    mockCanonicalObservations.push(
      { id: "obs-proj-a", title: "Lichen on Granite", observedAt: "2026-01-01T00:00:00Z", projectId: "proj-alpha" },
      { id: "obs-proj-b", title: "Lichen on Wall", observedAt: "2026-02-01T00:00:00Z", projectId: "proj-beta" },
    );

    const result = await service.retrieve("uid-1", "lichen", {
      limit: 10,
      minScore: 0.01,
      projectId: "proj-alpha",
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.observationId).toBe("obs-proj-a");
  });

  it("filters unfiled observations (projectId = null) when projectId is 'unfiled'", async () => {
    mockSearchDocs.push(
      { id: "obs-filed", data: () => ({ searchableText: "hawk soaring mountain ridge" }) },
      { id: "obs-unfiled", data: () => ({ searchableText: "hawk nesting tree branch" }) },
    );

    mockCanonicalObservations.push(
      { id: "obs-filed", title: "Hawk on Mountain", observedAt: "2026-03-01T00:00:00Z", projectId: "proj-x" },
      { id: "obs-unfiled", title: "Hawk Nesting", observedAt: "2026-04-01T00:00:00Z", projectId: null },
    );

    const result = await service.retrieve("uid-1", "hawk", {
      limit: 10,
      minScore: 0.01,
      projectId: "unfiled",
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.observationId).toBe("obs-unfiled");
  });

  it("respects the limit parameter and returns at most limit candidates", async () => {
    // Seed 5 index docs all matching the query
    for (let i = 1; i <= 5; i++) {
      mockSearchDocs.push({
        id: `obs-${i}`,
        data: () => ({ searchableText: `weather station temperature measurement reading ${i}` }),
      });
      mockCanonicalObservations.push({
        id: `obs-${i}`,
        title: `Reading ${i}`,
        observedAt: `2026-01-0${i}T00:00:00Z`,
        projectId: null,
      });
    }

    const result = await service.retrieve("uid-1", "temperature measurement", {
      limit: 2,
      minScore: 0.01,
    });

    expect(result.candidates.length).toBeLessThanOrEqual(2);
    expect(result.totalIndexed).toBe(5);
  });

  it("uses canonical title and observedAt, not index-derived values", async () => {
    mockSearchDocs.push({
      id: "obs-canonical",
      data: () => ({ searchableText: "sparrow feeding morning seeds grain" }),
    });

    // Canonical doc has different title than what the index stores
    mockCanonicalObservations.push({
      id: "obs-canonical",
      title: "Updated: Sparrow Feeding Habits",
      observedAt: "2026-07-15T08:00:00Z",
      projectId: "proj-birds",
    });

    const result = await service.retrieve("uid-1", "sparrow feeding", { limit: 10, minScore: 0.01 });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.title).toBe("Updated: Sparrow Feeding Habits");
    expect(result.candidates[0]!.observedAt).toBe("2026-07-15T08:00:00Z");
    expect(result.candidates[0]!.projectId).toBe("proj-birds");
  });

  it("returns candidates sorted by score descending", async () => {
    mockSearchDocs.push(
      { id: "obs-low", data: () => ({ searchableText: "some rain measurement taken during storm afternoon" }) },
      { id: "obs-high", data: () => ({ searchableText: "rain rain rain measurement measurement storm heavy downpour" }) },
    );

    mockCanonicalObservations.push(
      { id: "obs-low", title: "Light Rain", observedAt: "2026-01-01T00:00:00Z", projectId: null },
      { id: "obs-high", title: "Heavy Rain", observedAt: "2026-01-02T00:00:00Z", projectId: null },
    );

    const result = await service.retrieve("uid-1", "rain measurement", { limit: 10, minScore: 0.01 });

    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result.candidates[0]!.score).toBeGreaterThanOrEqual(result.candidates[1]!.score);
  });

  it("returns empty candidates when no index docs match above minScore", async () => {
    mockSearchDocs.push({
      id: "obs-irrelevant",
      data: () => ({ searchableText: "solar panel battery voltage discharge evening" }),
    });

    mockCanonicalObservations.push({
      id: "obs-irrelevant",
      title: "Solar Panel",
      observedAt: "2026-01-01T00:00:00Z",
      projectId: null,
    });

    const result = await service.retrieve("uid-1", "lichen granite spores", { limit: 10, minScore: 0.05 });

    expect(result.candidates).toHaveLength(0);
    expect(result.totalIndexed).toBe(1);
  });
});
