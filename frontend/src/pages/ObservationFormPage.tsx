import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  fetchObservation,
  createObservation,
  updateObservation,
  fetchProjects,
} from "../lib/api";
import type { Project, Measurement } from "../lib/api";
import { Layout } from "../components/Layout";
import { InlineProjectCreator } from "../components/InlineProjectCreator";
import { MapPin, Loader2, Info } from "lucide-react";

export default function ObservationFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [status, setStatus] = useState<"draft" | "observed" | "archived">("observed");
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0, 16));
  const [hypothesis, setHypothesis] = useState("");
  const [notes, setNotes] = useState("");

  // Location State
  const [hasLocation, setHasLocation] = useState(false);
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [locationLabel, setLocationLabel] = useState("");
  const [precision, setPrecision] = useState<"exact" | "approximate" | "hidden">("exact");
  const [fetchingGps, setFetchingGps] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsMessage({ text: "Geolocation is not supported by your browser.", isError: true });
      return;
    }
    setFetchingGps(true);
    setGpsMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(parseFloat(position.coords.latitude.toFixed(6)));
        setLongitude(parseFloat(position.coords.longitude.toFixed(6)));
        setFetchingGps(false);
        setGpsMessage({
          text: `Captured GPS coordinates (±${Math.round(position.coords.accuracy || 10)}m accuracy).`,
          isError: false,
        });
      },
      (err) => {
        setFetchingGps(false);
        setGpsMessage({
          text: `Location access denied or unavailable: ${err.message}. You may enter coordinates manually.`,
          isError: true,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Measurements State
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  // Tags State
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Version tracking for optimistic locking
  const [expectedVersion, setExpectedVersion] = useState<number | undefined>(undefined);

  useEffect(() => {
    fetchProjects().then((res) => setProjects(res.data || []));

    if (isEdit && id) {
      fetchObservation(id)
        .then((res) => {
          const obs = res.data;
          setTitle(obs.title);
          setDescription(obs.description);
          setProjectId(obs.projectId || "");
          setHypothesis(obs.hypothesis || "");
          setNotes(obs.notes || "");
          setStatus(obs.status === "analyzed" ? "observed" : (obs.status as "draft" | "observed" | "archived"));
          setObservedAt(new Date(obs.observedAt).toISOString().slice(0, 16));
          setTags(obs.tags || []);
          setMeasurements(obs.measurements || []);
          setExpectedVersion(obs.version);

          if (obs.location) {
            setHasLocation(true);
            setLatitude(obs.location.latitude);
            setLongitude(obs.location.longitude);
            setLocationLabel(obs.location.label || "");
            setPrecision(obs.location.precision || "exact");
          }
        })
        .catch((err) => {
          setErrorMessage(err instanceof Error ? err.message : "Failed to load observation");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  function addMeasurement() {
    setMeasurements([
      ...measurements,
      { name: "", value: 0, unit: "", notes: "" },
    ]);
  }

  function updateMeasurementRow(index: number, field: keyof Measurement, val: any) {
    const next = [...measurements];
    next[index] = { ...next[index]!, [field]: val };
    setMeasurements(next);
  }

  function removeMeasurement(index: number) {
    setMeasurements(measurements.filter((_, i) => i !== index));
  }

  function addTag() {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 20) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  }

  function removeTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    const payload: any = {
      title,
      description,
      projectId: projectId || null,
      notes: notes || null,
      hypothesis: hypothesis || null,
      status,
      observedAt: new Date(observedAt).toISOString(),
      tags,
      measurements: measurements.filter((m) => m.name.trim() && m.unit.trim()),
      location: hasLocation
        ? {
            latitude: Number(latitude),
            longitude: Number(longitude),
            label: locationLabel || null,
            precision,
          }
        : null,
    };

    try {
      if (isEdit && id) {
        payload.expectedVersion = expectedVersion;
        await updateObservation(id, payload);
        navigate(`/observations/${id}`);
      } else {
        const res = await createObservation(payload);
        navigate(`/observations/${res.data.id}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("409")) {
        setErrorMessage("Version conflict: this observation was modified in another session. Please reload.");
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Failed to save observation");
      }
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">
            {isEdit ? "Edit Observation" : "New Observation"}
          </h1>
          <Link to="/observations" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Cancel
          </Link>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading form...</div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-lg border border-slate-200 shadow-sm space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="obs-title" className="block text-sm font-medium text-slate-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="obs-title"
                type="text"
                required
                maxLength={200}
                placeholder="e.g. Feeder activity before temperature drop"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="obs-description" className="block text-sm font-medium text-slate-700 mb-1">
                Description / Field Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                id="obs-description"
                required
                rows={5}
                maxLength={20000}
                placeholder="Detailed description of what you observed..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Project & Status & Observed Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="obs-project" className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                <select
                  id="obs-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value="">(Unfiled / None)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <div className="mt-1.5">
                  <InlineProjectCreator
                    onCreated={(project) => {
                      setProjects((prev) => [...prev, project]);
                      setProjectId(project.id);
                    }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="obs-status" className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  id="obs-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value="observed">Observed</option>
                  <option value="draft">Draft</option>
                  {isEdit && <option value="archived">Archived</option>}
                </select>
              </div>

              <div>
                <label htmlFor="obs-observed-at" className="block text-sm font-medium text-slate-700 mb-1">Observed Date/Time</label>
                <input
                  id="obs-observed-at"
                  type="datetime-local"
                  value={observedAt}
                  onChange={(e) => setObservedAt(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>

            {/* Hypothesis & Supplementary Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="obs-hypothesis" className="block text-sm font-medium text-slate-700 mb-1">Hypothesis (Optional)</label>
                <textarea
                  id="obs-hypothesis"
                  rows={3}
                  placeholder="Your initial hypothesis..."
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label htmlFor="obs-notes" className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  id="obs-notes"
                  rows={3}
                  placeholder="Additional context, equipment used..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>

            {/* Measurements Section */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-800">Scientific Measurements</label>
                <button
                  type="button"
                  onClick={addMeasurement}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  + Add Measurement Row
                </button>
              </div>

              {measurements.map((m, idx) => (
                <div key={idx} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Name (e.g. Temp)"
                    value={m.name}
                    onChange={(e) => updateMeasurementRow(idx, "name", e.target.value)}
                    className="w-full sm:w-1/4 px-2.5 py-1.5 border border-slate-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Value"
                    value={m.value}
                    onChange={(e) => updateMeasurementRow(idx, "value", parseFloat(e.target.value) || 0)}
                    className="w-full sm:w-1/4 px-2.5 py-1.5 border border-slate-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Unit (e.g. °C)"
                    value={m.unit}
                    onChange={(e) => updateMeasurementRow(idx, "unit", e.target.value)}
                    className="w-full sm:w-1/4 px-2.5 py-1.5 border border-slate-300 rounded text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeMeasurement(idx)}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            {/* Location Section */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hasLocation"
                    checked={hasLocation}
                    onChange={(e) => setHasLocation(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
                  />
                  <label htmlFor="hasLocation" className="text-sm font-semibold text-slate-800">
                    Attach Geographic Location
                  </label>
                </div>

                {hasLocation && (
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={fetchingGps}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition disabled:opacity-50"
                  >
                    {fetchingGps ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Querying GPS...</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Get Current Location</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {hasLocation && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-md border border-slate-200">
                  {gpsMessage && (
                    <div
                      className={`text-xs p-2 rounded flex items-start gap-1.5 ${
                        gpsMessage.isError
                          ? "bg-amber-50 border border-amber-200 text-amber-800"
                          : "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      }`}
                    >
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{gpsMessage.text}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label htmlFor="loc-lat" className="block text-xs font-medium text-slate-600 mb-1">Latitude</label>
                      <input
                        id="loc-lat"
                        type="number"
                        step="any"
                        min={-90}
                        max={90}
                        value={latitude}
                        onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="loc-lng" className="block text-xs font-medium text-slate-600 mb-1">Longitude</label>
                      <input
                        id="loc-lng"
                        type="number"
                        step="any"
                        min={-180}
                        max={180}
                        value={longitude}
                        onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="loc-label" className="block text-xs font-medium text-slate-600 mb-1">Location Label</label>
                      <input
                        id="loc-label"
                        type="text"
                        placeholder="e.g. Field Station A"
                        value={locationLabel}
                        onChange={(e) => setLocationLabel(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="loc-precision" className="block text-xs font-medium text-slate-600 mb-1">Precision</label>
                      <select
                        id="loc-precision"
                        value={precision}
                        onChange={(e) => setPrecision(e.target.value as "exact" | "approximate" | "hidden")}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      >
                        <option value="exact">Exact Coordinates</option>
                        <option value="approximate">Approximate (Fuzzed)</option>
                        <option value="hidden">Hidden (Private)</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    {precision === "exact" &&
                      "Exact: Coordinates are preserved and plotted precisely on your Research Map."}
                    {precision === "approximate" &&
                      "Approximate: Coordinates are fuzzed (~11 km) on maps to protect sensitive field sites or wildlife habitats."}
                    {precision === "hidden" &&
                      "Hidden: Coordinates remain securely archived in your journal but are NEVER rendered on maps or passed to AI prompts."}
                  </p>
                </div>
              )}
            </div>

            {/* Tags Section */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-sm font-semibold text-slate-800">Tags</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a tag and press Add"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded font-medium"
                >
                  Add Tag
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded text-xs"
                  >
                    #{t}
                    <button type="button" onClick={() => removeTag(t)} className="text-indigo-400 hover:text-indigo-700">
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
              <Link
                to="/observations"
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
              >
                {saving ? "Saving..." : isEdit ? "Update Observation" : "Save Observation"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
