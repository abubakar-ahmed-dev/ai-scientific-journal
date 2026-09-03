// Location privacy enforcement (SECURITY.md §14, DATABASE_SCHEMA §7).
//
// ONE authoritative sanitizer for every code path that emits an observation
// location outside the owner's own editor: `hidden` coordinates are stripped
// entirely; `approximate` coordinates are fuzzed to 1 decimal place (~11 km);
// `exact` passes through. UI pages and AI context builders must consume the
// sanitized shape rather than re-deriving the rule ad hoc.

export interface LocationLike {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number | null;
  label?: string | null;
  precision?: "exact" | "approximate" | "hidden" | null;
}

export interface SanitizedLocation {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number | null;
  label: string | null;
  precision: "exact" | "approximate" | "hidden";
}

export const APPROXIMATE_FUZZ_DECIMALS = 1;

export function sanitizeLocation(location: LocationLike | null | undefined): SanitizedLocation | null {
  if (!location) return null;

  const label = location.label ?? null;
  const precision = location.precision ?? "exact";

  if (precision === "hidden") {
    // Hidden means no displayable coordinates anywhere outside the owner's editor.
    return { label, precision };
  }

  if (precision === "approximate" && typeof location.latitude === "number" && typeof location.longitude === "number") {
    const factor = Math.pow(10, APPROXIMATE_FUZZ_DECIMALS);
    return {
      latitude: Math.round(location.latitude * factor) / factor,
      longitude: Math.round(location.longitude * factor) / factor,
      accuracyMeters: location.accuracyMeters ?? null,
      label,
      precision,
    };
  }

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracyMeters: location.accuracyMeters ?? null,
    label,
    precision,
  };
}
