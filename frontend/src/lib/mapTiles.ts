/** Shared Leaflet basemap config so every map uses the same tile source.
 *
 * Uses CARTO's raster Positron basemap (OSM data, CARTO rendering) instead of
 * tile.openstreetmap.org: OSM's volunteer-run servers block tile requests from
 * cloud-hosted app domains (Referer `*.run.app`), which blanked the maps in the
 * deployed build while localhost kept working.
 *
 * Since late August 2026 CARTO requires an API key on raster basemap requests —
 * anonymous tiles are served with an "API KEY REQUIRED" watermark (free key,
 * 5M tiles/month: carto.com/basemaps/apikey). The key is a public client
 * identifier injected at build time like the Firebase web config, never
 * committed to Git.
 */
const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY ?? "";

export const BASEMAP_URL = `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;

export const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
