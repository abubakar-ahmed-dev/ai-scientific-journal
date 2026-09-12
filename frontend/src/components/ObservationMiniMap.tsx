import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import { setupLeafletIcons } from "../lib/leafletSetup";
import { sanitizeLocation, APPROXIMATE_FUZZ_DECIMALS } from "../lib/locationPrivacy";
import { MapPin, Shield, EyeOff } from "lucide-react";

interface ObservationMiniMapProps {
  latitude: number;
  longitude: number;
  precision: "exact" | "approximate" | "hidden";
  label?: string | null;
}

export const ObservationMiniMap: React.FC<ObservationMiniMapProps> = ({
  latitude,
  longitude,
  precision,
  label,
}) => {
  useEffect(() => {
    setupLeafletIcons();
  }, []);

  // Render exclusively from the sanitized shape (SECURITY §14): for
  // approximate precision the map shows the fuzzed coordinate — never the
  // raw stored point.
  const safe = useMemo(
    () => sanitizeLocation({ latitude, longitude, label, precision }),
    [latitude, longitude, label, precision]
  );

  if (!safe || safe.precision === "hidden") {
    return (
      <div className="bg-slate-50 border border-app-border rounded-xl p-4 flex items-center gap-3">
        <div className="p-2 bg-slate-200 text-slate-700 rounded-lg">
          <EyeOff className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wide">
              Location Privacy Protected
            </h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
              Hidden
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {safe?.label ? `Label: "${safe.label}". ` : ""}
            Coordinates are stored for your private scientific journal, but are strictly hidden from maps and AI prompts.
          </p>
        </div>
      </div>
    );
  }

  const displayLat = safe.latitude;
  const displayLng = safe.longitude;
  const hasCoords = typeof displayLat === "number" && typeof displayLng === "number";

  return (
    <div className="bg-white border border-app-border rounded-xl shadow-2xs overflow-hidden">
      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-brand-600" />
          <span className="text-xs font-bold text-slate-800">
            {safe.label || "Geographic Location"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500">
            {hasCoords
              ? `${displayLat!.toFixed(APPROXIMATE_FUZZ_DECIMALS * 2)}, ${displayLng!.toFixed(APPROXIMATE_FUZZ_DECIMALS * 2)}`
              : "—"}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
              safe.precision === "exact"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-purple-100 text-purple-800"
            }`}
          >
            {safe.precision}
          </span>
        </div>
      </div>

      <div className="h-86 w-full relative z-0">
        {hasCoords ? (
          <MapContainer
            center={[displayLat!, displayLng!]}
            zoom={safe.precision === "approximate" ? 10 : 12}
            scrollWheelZoom={false}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {safe.precision === "approximate" ? (
              <>
                <Circle
                  center={[displayLat!, displayLng!]}
                  radius={11000}
                  pathOptions={{
                    color: "#9333ea",
                    fillColor: "#d8b4fe",
                    fillOpacity: 0.35,
                  }}
                />
                <Marker position={[displayLat!, displayLng!]}>
                  <Popup>
                    <div className="text-xs">
                      <strong>{safe.label || "Observation Area"}</strong>
                      <p className="text-slate-500 mt-0.5">Approximate area (~11 km fuzzing)</p>
                    </div>
                  </Popup>
                </Marker>
              </>
            ) : (
              <Marker position={[displayLat!, displayLng!]}>
                <Popup>
                  <div className="text-xs">
                    <strong>{safe.label || "Observation Location"}</strong>
                    <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                      {displayLat}, {displayLng}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            No displayable coordinates for this precision setting.
          </div>
        )}
      </div>

      {safe.precision === "approximate" && (
        <div className="p-2.5 bg-purple-50/50 border-t border-purple-100 text-[11px] text-purple-900 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>Approximate area displayed to preserve ecological habitat confidentiality.</span>
        </div>
      )}
    </div>
  );
};
