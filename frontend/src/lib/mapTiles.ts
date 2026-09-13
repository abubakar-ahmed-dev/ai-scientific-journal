/** Shared Leaflet basemap config so every map uses the same tile source.
 *
 * Uses CARTO's public Positron basemap (OSM data, CARTO rendering) instead of
 * tile.openstreetmap.org: OSM's volunteer-run servers block tile requests from
 * cloud-hosted app domains (Referer `*.run.app`), which blanked the maps in the
 * deployed build while localhost kept working. CARTO's basemaps allow app
 * usage with attribution, and `{r}` serves retina tiles on HiDPI screens.
 */
export const BASEMAP_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
