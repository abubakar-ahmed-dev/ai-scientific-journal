// Location privacy enforcement (SECURITY.md §14) — the single authority for
// how observation locations may be DISPLAYED. Map components must render the
// sanitized shape, never raw stored coordinates: `hidden` coordinates are
// stripped entirely; `approximate` coordinates are fuzzed to 1 decimal place
// (~11 km) so the rendered marker/popup cannot reveal the precise point;
// `exact` passes through.

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
  label: string | null;
  precision: "exact" | "approximate" | "hidden";
}

export const APPROXIMATE_FUZZ_DECIMALS = 1;

export function sanitizeLocation(location: LocationLike | null | undefined): SanitizedLocation | null {
  if (!location) return null;

  const label = location.label ?? null;
  const precision = location.precision ?? "exact";

  if (precision === "hidden") {
    return { label, precision };
  }

  if (
    precision === "approximate" &&
    typeof location.latitude === "number" &&
    typeof location.longitude === "number"
  ) {
    const factor = Math.pow(10, APPROXIMATE_FUZZ_DECIMALS);
    return {
      latitude: Math.round(location.latitude * factor) / factor,
      longitude: Math.round(location.longitude * factor) / factor,
      label,
      precision,
    };
  }

  return { latitude: location.latitude, longitude: location.longitude, label, precision };
}
