import React, { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import { setupLeafletIcons } from "../lib/leafletSetup";
import { sanitizeLocation } from "../lib/locationPrivacy";
import {
  fetchObservations,
  fetchProjects,
} from "../lib/api";
import type { Observation, Project } from "../lib/api";
import {
  MapPin,
  Filter,
  EyeOff,
  Layers,
  Calendar,
  Tag,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

const PAGE_SIZE = 100;

// Fetch every page of observations via cursor pagination (API.md §5) so the
// map reflects the complete journal — a single limit-100 request silently
// dropped observations beyond the first page.
async function fetchAllObservations(): Promise<Observation[]> {
  const all: Observation[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const res = await fetchObservations({ limit: PAGE_SIZE, cursor, sort: "updated" });
    all.push(...(res.data || []));
    const meta = (res as { meta?: { nextCursor?: string | null; hasMore?: boolean } }).meta;
    hasMore = Boolean(meta?.hasMore && meta.nextCursor);
    cursor = meta?.nextCursor ?? undefined;
    if (!cursor) hasMore = false;
  }

  return all;
}

export const ResearchMapPage: React.FC = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  useEffect(() => {
    setupLeafletIcons();
  }, []);

  const observationsQuery = useQuery<Observation[]>({
    queryKey: ["researchMapObservations"],
    queryFn: fetchAllObservations,
  });
  const projectsQuery = useQuery<Project[]>({
    queryKey: ["researchMapProjects"],
    queryFn: async () => (await fetchProjects()).data || [],
  });

  // Stable identities: query data is referentially stable between renders, so
  // downstream useMemo dependencies don't see a fresh array every render.
  const observations = useMemo(() => observationsQuery.data ?? [], [observationsQuery.data]);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const loading = observationsQuery.isLoading || projectsQuery.isLoading;
  const error =
    observationsQuery.error instanceof Error
      ? observationsQuery.error.message
      : projectsQuery.error instanceof Error
        ? projectsQuery.error.message
        : null;

  // Collect all unique tags from loaded observations
  const allTags = useMemo(() => {
    const set = new Set<string>();
    observations.forEach((obs) => {
      (obs.tags || []).forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [observations]);

  // Anchored once at page load: relative date filters ("last 30 days") are
  // measured against when the map was opened. useState initializer keeps the
  // impure Date.now() call out of render.
  const [now] = useState(() => Date.now());

  const { plottableObservations, hiddenCount, totalWithLocation } = useMemo(() => {
    let countWithLoc = 0;
    let countHidden = 0;

    const dayMs = 24 * 60 * 60 * 1000;

    const filtered = observations.filter((obs) => {
      // 1. Project filter
      if (selectedProjectId !== "all") {
        if (selectedProjectId === "unfiled") {
          if (obs.projectId !== null && obs.projectId !== undefined) return false;
        } else if (obs.projectId !== selectedProjectId) {
          return false;
        }
      }

      // 2. Tag filter
      if (selectedTag !== "all") {
        if (!obs.tags || !obs.tags.includes(selectedTag)) return false;
      }

      // 3. Date filter
      if (dateFilter !== "all") {
        const obsDate = new Date(obs.observedAt).getTime();
        if (dateFilter === "30days" && now - obsDate > 30 * dayMs) return false;
        if (dateFilter === "90days" && now - obsDate > 90 * dayMs) return false;
        if (dateFilter === "year" && now - obsDate > 365 * dayMs) return false;
      }

      return true;
    });

    const plottable: Array<Observation & {
      displayLocation: NonNullable<ReturnType<typeof sanitizeLocation>>;
    }> = [];

    filtered.forEach((obs) => {
      if (obs.location) {
        countWithLoc++;
        const safe = sanitizeLocation(obs.location);
        if (!safe || safe.precision === "hidden") {
          countHidden++;
          return;
        }
        if (typeof safe.latitude === "number" && typeof safe.longitude === "number") {
          plottable.push({ ...obs, displayLocation: safe });
        }
      }
    });

    return {
      plottableObservations: plottable,
      hiddenCount: countHidden,
      totalWithLocation: countWithLoc,
    };
  }, [observations, selectedProjectId, selectedTag, dateFilter, now]);

  // Determine initial map center
  const initialCenter: [number, number] = useMemo(() => {
    if (plottableObservations.length > 0) {
      const first = plottableObservations[0]!;
      if (typeof first.displayLocation.latitude === "number") {
        return [first.displayLocation.latitude, first.displayLocation.longitude!] as [number, number];
      }
    }
    // Default to a neutral global location (e.g., center of map)
    return [20, 0];
  }, [plottableObservations]);

  const initialZoom = plottableObservations.length > 0 ? 6 : 2;

  if (error) {
    return (
      <div className="space-y-6">
        <Header plottableCount={0} hiddenCount={0} />
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            observationsQuery.refetch();
            projectsQuery.refetch();
          }}
          className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-app-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-app-heading flex items-center gap-2.5">
            <MapPin className="w-7 h-7 text-brand-600" />
            <span>Research Map</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Interactive geographic visualization of field research records and empirical observations.
          </p>
        </div>

        {/* Stats Chips */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1 bg-brand-50 text-brand-700 font-semibold rounded-full border border-brand-200">
            {plottableObservations.length} Plotted Pins
          </span>
          {hiddenCount > 0 && (
            <span
              className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full flex items-center gap-1 border border-app-border"
              title="Locations hidden by user privacy settings are excluded from map visualization"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>{hiddenCount} Hidden for Privacy</span>
            </span>
          )}
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-app-border shadow-2xs flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wide">
          <Filter className="w-4 h-4 text-brand-600" />
          <span>Filter Map:</span>
        </div>

        {/* Project Filter */}
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <select
            aria-label="Filter by project"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-brand-500 cursor-pointer"
          >
            <option value="all">All Projects</option>
            <option value="unfiled">Unfiled Only</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        {/* Tag Filter */}
        <div className="flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <select
            aria-label="Filter by tag"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-brand-500 cursor-pointer"
          >
            <option value="all">All Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <select
            aria-label="Filter by date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-brand-500 cursor-pointer"
          >
            <option value="all">All Recorded Dates</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="year">Last 12 Months</option>
          </select>
        </div>

        {/* Reset */}
        {(selectedProjectId !== "all" || selectedTag !== "all" || dateFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSelectedProjectId("all");
              setSelectedTag("all");
              setDateFilter("all");
            }}
            className="text-brand-600 hover:text-brand-800 font-semibold cursor-pointer underline ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Map Container */}
      <div className="bg-white rounded-2xl border border-app-border shadow-xs overflow-hidden relative">
        {loading ? (
          <div className="h-[600px] flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <p className="text-sm font-medium">Loading research map tiles and coordinates...</p>
          </div>
        ) : plottableObservations.length === 0 ? (
          <div className="h-[500px] flex flex-col items-center justify-center p-8 text-center space-y-4 bg-slate-50/50">
            <div className="p-4 bg-brand-50 rounded-full text-brand-600">
              <MapPin className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-base font-bold text-app-heading">No Mappable Observations Found</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {totalWithLocation === 0
                  ? "None of your current observations have geographic locations attached. Create a new observation and check 'Attach Geographic Location' to view it here."
                  : "All observations matching the current filters have their location precision set to 'Hidden' or don't match the selected criteria."}
              </p>
            </div>
            <Link
              to="/observations/new"
              className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-2xs transition"
            >
              + Create New Observation
            </Link>
          </div>
        ) : (
          <div className="h-[500px] w-full relative z-0">
            <MapContainer
              center={initialCenter}
              zoom={initialZoom}
              scrollWheelZoom={true}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {plottableObservations.map((obs) => {
                const loc = obs.displayLocation;
                const isApprox = loc.precision === "approximate";
                const lat = loc.latitude as number;
                const lng = loc.longitude as number;

                return (
                  <React.Fragment key={obs.id}>
                    {isApprox && (
                      <Circle
                        center={[lat, lng]}
                        radius={11000}
                        pathOptions={{
                          color: "#9333ea",
                          fillColor: "#d8b4fe",
                          fillOpacity: 0.3,
                        }}
                      />
                    )}

                    <Marker position={[lat, lng]}>
                      <Popup>
                        <div className="p-1 space-y-2 max-w-xs text-slate-800">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                                  isApprox
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {loc.precision}
                              </span>
                              {loc.label && (
                                <span className="text-[10px] text-slate-500 truncate font-medium">
                                  {loc.label}
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-sm text-app-heading leading-snug">
                              {obs.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(obs.observedAt).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>

                          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                            {obs.description}
                          </p>

                          {obs.tags && obs.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {obs.tags.slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="pt-2 border-t border-slate-100 flex justify-end">
                            <Link
                              to={`/observations/${obs.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
                            >
                              <span>View Observation Detail</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  </React.Fragment>
                );
              })}
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
};

function Header({ plottableCount, hiddenCount }: { plottableCount: number; hiddenCount: number }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-app-border pb-5">
      <div>
        <h1 className="text-2xl font-bold text-app-heading flex items-center gap-2.5">
          <MapPin className="w-7 h-7 text-brand-600" />
          <span>Research Map</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Interactive geographic visualization of field research records and empirical observations.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-3 py-1 bg-brand-50 text-brand-700 font-semibold rounded-full border border-brand-200">
          {plottableCount} Plotted Pins
        </span>
        {hiddenCount > 0 && (
          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full flex items-center gap-1 border border-app-border">
            <EyeOff className="w-3.5 h-3.5" />
            <span>{hiddenCount} Hidden for Privacy</span>
          </span>
        )}
      </div>
    </div>
  );
}
