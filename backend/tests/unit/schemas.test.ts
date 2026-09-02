import { describe, it, expect } from "vitest";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
} from "../../src/schemas/projectSchema";
import {
  CreateObservationSchema,
  UpdateObservationSchema,
  MeasurementSchema,
  LocationSchema,
} from "../../src/schemas/observationSchema";
import {
  encodeCursor,
  decodeCursor,
} from "../../src/schemas/paginationSchema";

describe("Project Schemas", () => {
  it("validates valid project create payload", () => {
    const input = {
      title: "Urban Bird Study",
      description: "Observing urban birds",
      field: "Ornithology",
      tags: ["birds", "urban"],
    };
    const parsed = CreateProjectSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe("Urban Bird Study");
    }
  });

  it("rejects project with empty title or title exceeding 200 chars", () => {
    expect(CreateProjectSchema.safeParse({ title: "" }).success).toBe(false);
    expect(CreateProjectSchema.safeParse({ title: "a".repeat(201) }).success).toBe(false);
  });

  it("rejects unknown properties on project create", () => {
    const input = {
      title: "Project",
      ownerId: "hacked",
    };
    expect(CreateProjectSchema.safeParse(input).success).toBe(false);
  });

  it("validates project update with status change", () => {
    const parsed = UpdateProjectSchema.safeParse({
      status: "archived",
      title: "New Title",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("Observation Schemas", () => {
  it("validates valid observation create payload with location & measurements", () => {
    const input = {
      title: "Feeder activity spike",
      description: "High feeder activity before temperature drop",
      observedAt: new Date().toISOString(),
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracyMeters: 5,
        label: "Backyard",
        precision: "exact",
      },
      tags: ["birds", "weather"],
      measurements: [
        {
          name: "temperature",
          value: 15.5,
          unit: "°C",
        },
      ],
      status: "observed",
    };
    const parsed = CreateObservationSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it("validates freeform journal entry (observation with optional fields unpopulated)", () => {
    const input = {
      title: "Personal Reflection",
      description: "Reflected on today's research findings.",
    };
    const parsed = CreateObservationSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.projectId).toBe(null);
      expect(parsed.data.measurements).toEqual([]);
      expect(parsed.data.tags).toEqual([]);
    }
  });

  it("rejects observation with invalid latitude/longitude or missing precision", () => {
    expect(
      LocationSchema.safeParse({
        latitude: 100, // Invalid: > 90
        longitude: 0,
        precision: "exact",
      }).success
    ).toBe(false);

    expect(
      LocationSchema.safeParse({
        latitude: 45,
        longitude: 45,
        // missing precision
      }).success
    ).toBe(false);
  });

  it("rejects non-finite measurement values", () => {
    expect(
      MeasurementSchema.safeParse({
        name: "test",
        value: NaN,
        unit: "m",
      }).success
    ).toBe(false);

    expect(
      MeasurementSchema.safeParse({
        name: "test",
        value: Infinity,
        unit: "m",
      }).success
    ).toBe(false);
  });

  it("rejects observedAt more than 5 minutes in future", () => {
    const farFuture = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const parsed = CreateObservationSchema.safeParse({
      title: "Future note",
      description: "Testing future timestamp rejection",
      observedAt: farFuture,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects server-managed fields on observation create", () => {
    const input = {
      title: "Attempt overwrite",
      description: "Trying to supply server-managed version",
      version: 5,
    };
    expect(CreateObservationSchema.safeParse(input).success).toBe(false);
  });

  it("validates update observation schema with expectedVersion", () => {
    const parsed = UpdateObservationSchema.safeParse({
      title: "Updated Title",
      expectedVersion: 2,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("Pagination and Cursor Helpers", () => {
  it("encodes and decodes cursor payload correctly", () => {
    const payload = {
      id: "doc_123",
      sortField: "updatedAt",
      sortValue: "2026-09-02T12:00:00.000Z",
    };
    const cursor = encodeCursor(payload);
    expect(typeof cursor).toBe("string");

    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual(payload);
  });

  it("returns null on malformed cursor string", () => {
    expect(decodeCursor("invalid-base64-!!!")).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
});
