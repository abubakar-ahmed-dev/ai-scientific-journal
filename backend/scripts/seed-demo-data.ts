import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const projectId = process.env.FIREBASE_PROJECT_ID || "demo-test";
const uid = process.env.DEMO_UID || "demo-researcher-uid";
const email = process.env.DEMO_EMAIL || "demo.researcher@example.test";
const displayName = process.env.DEMO_DISPLAY_NAME || "Dr. Maya Fielding";

process.env.FIREBASE_PROJECT_ID = projectId;
process.env.GOOGLE_CLOUD_PROJECT = projectId;
process.env.GCLOUD_PROJECT = projectId;
process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8082";
process.env.FIREBASE_STORAGE_EMULATOR_HOST =
  process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199";

if (!projectId.startsWith("demo-")) {
  throw new Error(`Refusing to seed non-demo Firebase project: ${projectId}`);
}

if (
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_STORAGE_EMULATOR_HOST
) {
  throw new Error("Refusing to seed without Firebase Auth, Firestore, and Storage emulator hosts.");
}

const storageBucket = process.env.STORAGE_BUCKET || "ai-scientific-journal-media";

initializeApp({ projectId, storageBucket });

const auth = getAuth();
const db = getFirestore();
const bucket = getStorage().bucket(storageBucket);
const userRef = db.collection("users").doc(uid);

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

type ObservationSeed = {
  id: string;
  projectId: string | null;
  title: string;
  description: string;
  notes: string | null;
  hypothesis: string | null;
  observedAt: FirebaseFirestore.Timestamp;
  location: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    label: string;
    precision: "exact" | "approximate" | "hidden";
  } | null;
  tags: string[];
  measurements: Array<{
    id: string;
    name: string;
    value: number;
    unit: string;
    notes?: string | null;
  }>;
  status: "draft" | "observed" | "analyzed" | "archived";
  mediaCount: number;
  version: number;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};

const projects = [
  {
    id: "proj_alpine_microclimate",
    title: "Alpine Microclimate Study",
    description: "Field notes on lichen color, light exposure, and moisture changes along a high-altitude ridge.",
    field: "Ecology",
    status: "active",
    tags: ["alpine", "lichen", "microclimate"],
    createdAt: ts("2026-08-22T08:00:00Z"),
    updatedAt: ts("2026-09-10T14:40:00Z"),
    archivedAt: null,
  },
  {
    id: "proj_wetland_recovery",
    title: "Wetland Recovery Transect",
    description: "Tracking water quality, plant regrowth, and small invertebrates after seasonal flooding.",
    field: "Freshwater Ecology",
    status: "active",
    tags: ["wetland", "water-quality", "restoration"],
    createdAt: ts("2026-08-24T09:15:00Z"),
    updatedAt: ts("2026-09-09T16:05:00Z"),
    archivedAt: null,
  },
  {
    id: "proj_lab_method_notes",
    title: "Lab Method Notes",
    description: "Calibration checks and small process notes that support field measurements.",
    field: "Research Methods",
    status: "completed",
    tags: ["lab", "calibration"],
    createdAt: ts("2026-08-28T10:00:00Z"),
    updatedAt: ts("2026-09-04T11:30:00Z"),
    archivedAt: null,
  },
  {
    id: "proj_urban_heat",
    title: "Urban Heat Island Walk",
    description: "Street-level temperature, shade, and surface observations across a neighborhood walking loop.",
    field: "Urban Climate",
    status: "active",
    tags: ["urban", "temperature", "shade"],
    createdAt: ts("2026-08-30T07:30:00Z"),
    updatedAt: ts("2026-09-11T17:45:00Z"),
    archivedAt: null,
  },
  {
    id: "proj_kitchen_fermentation",
    title: "Kitchen Fermentation Log",
    description: "Small-batch sourdough and vegetable fermentation notes with smell, pH, and timing.",
    field: "Food Science",
    status: "active",
    tags: ["fermentation", "ph", "microbiology"],
    createdAt: ts("2026-09-01T06:45:00Z"),
    updatedAt: ts("2026-09-11T08:15:00Z"),
    archivedAt: null,
  },
  {
    id: "proj_night_sky",
    title: "Backyard Night-Sky Notes",
    description: "Casual astronomy observations, sky clarity, and equipment notes from short evening sessions.",
    field: "Astronomy",
    status: "active",
    tags: ["astronomy", "sky", "visibility"],
    createdAt: ts("2026-09-02T20:00:00Z"),
    updatedAt: ts("2026-09-11T21:35:00Z"),
    archivedAt: null,
  },
] as const;

const observations: ObservationSeed[] = [
  {
    id: "obs_alpine_lichen_uv",
    projectId: "proj_alpine_microclimate",
    title: "Bright lichen pigment after high UV exposure",
    description:
      "Orange lichen patches on the exposed ridge face appeared more saturated after a clear morning with strong sunlight.",
    notes:
      "Photo series shows the brightest patches on rocks with no afternoon shade. Nearby shaded samples were duller.",
    hypothesis:
      "Stronger UV exposure may increase visible protective pigment in the lichen surface layer.",
    observedAt: ts("2026-09-10T10:20:00Z"),
    location: {
      latitude: 46.5472,
      longitude: 7.9854,
      accuracyMeters: 9,
      label: "North ridge transect",
      precision: "exact",
    },
    tags: ["lichen", "uv", "pigment", "alpine"],
    measurements: [
      { id: "m_uv_index", name: "UV index", value: 8.1, unit: "index", notes: "Portable meter, sun-facing rock" },
      { id: "m_surface_temp", name: "surface temperature", value: 18.6, unit: "C", notes: "Measured at lichen edge" },
    ],
    status: "analyzed",
    mediaCount: 2,
    version: 2,
    createdAt: ts("2026-09-10T10:35:00Z"),
    updatedAt: ts("2026-09-10T14:40:00Z"),
  },
  {
    id: "obs_alpine_moss_moisture",
    projectId: "proj_alpine_microclimate",
    title: "Moss moisture drop after noon wind shift",
    description:
      "Moss cushions near the ridge path dried quickly once the wind turned downslope around midday.",
    notes:
      "Soil at the protected side of the boulder stayed damp. Exposed samples became crisp at the surface.",
    hypothesis:
      "Wind exposure may explain the moisture difference more strongly than direct sunlight alone.",
    observedAt: ts("2026-09-10T12:45:00Z"),
    location: {
      latitude: 46.5481,
      longitude: 7.9871,
      accuracyMeters: 16,
      label: "Boulder shelter plot",
      precision: "approximate",
    },
    tags: ["moss", "moisture", "wind", "alpine"],
    measurements: [
      { id: "m_moisture_exposed", name: "surface moisture exposed", value: 21, unit: "%", notes: null },
      { id: "m_moisture_sheltered", name: "surface moisture sheltered", value: 46, unit: "%", notes: null },
    ],
    status: "observed",
    mediaCount: 0,
    version: 1,
    createdAt: ts("2026-09-10T13:10:00Z"),
    updatedAt: ts("2026-09-10T13:10:00Z"),
  },
  {
    id: "obs_alpine_evening_temp",
    projectId: "proj_alpine_microclimate",
    title: "Evening temperature inversion at lower marker",
    description:
      "Temperature at the lower marker fell below the ridge marker after sunset, even though it had been warmer all afternoon.",
    notes: "The shift began shortly after cloud cover broke. Repeat tomorrow if conditions match.",
    hypothesis: null,
    observedAt: ts("2026-09-09T18:25:00Z"),
    location: {
      latitude: 46.5408,
      longitude: 7.9768,
      accuracyMeters: 20,
      label: "Lower marker B",
      precision: "approximate",
    },
    tags: ["temperature", "inversion", "evening"],
    measurements: [
      { id: "m_lower_temp", name: "lower marker temperature", value: 6.4, unit: "C", notes: "18:25 reading" },
      { id: "m_ridge_temp", name: "ridge marker temperature", value: 8.2, unit: "C", notes: "Same sensor model" },
    ],
    status: "observed",
    mediaCount: 0,
    version: 1,
    createdAt: ts("2026-09-09T18:40:00Z"),
    updatedAt: ts("2026-09-09T18:40:00Z"),
  },
  {
    id: "obs_wetland_ph_shift",
    projectId: "proj_wetland_recovery",
    title: "Wetland pH lower near new reed growth",
    description:
      "Water near the new reed growth measured slightly lower pH than the open-water sampling point.",
    notes:
      "Both samples were taken within fifteen minutes. Water was still after a calm morning.",
    hypothesis:
      "Plant growth and decomposing organic matter may be creating a small local pH difference.",
    observedAt: ts("2026-09-08T09:50:00Z"),
    location: {
      latitude: 52.1416,
      longitude: 0.1342,
      accuracyMeters: 12,
      label: "Reed bed transect",
      precision: "exact",
    },
    tags: ["wetland", "ph", "reeds", "water-quality"],
    measurements: [
      { id: "m_ph_reed", name: "pH reed edge", value: 6.7, unit: "pH", notes: null },
      { id: "m_ph_open", name: "pH open water", value: 7.2, unit: "pH", notes: null },
    ],
    status: "analyzed",
    mediaCount: 2,
    version: 1,
    createdAt: ts("2026-09-08T10:05:00Z"),
    updatedAt: ts("2026-09-08T12:45:00Z"),
  },
  {
    id: "obs_wetland_invertebrates",
    projectId: "proj_wetland_recovery",
    title: "More invertebrates in shaded sweep sample",
    description:
      "A shaded sweep sample along the reed edge contained more visible invertebrates than the open-water sweep.",
    notes:
      "The sample was not preserved. Count is field estimate from tray inspection, so treat as approximate.",
    hypothesis:
      "Shade and reed structure may provide shelter that increases visible invertebrate density.",
    observedAt: ts("2026-09-08T11:35:00Z"),
    location: {
      latitude: 52.1421,
      longitude: 0.1351,
      accuracyMeters: 14,
      label: "Shaded reed margin",
      precision: "approximate",
    },
    tags: ["wetland", "invertebrates", "shade", "reeds"],
    measurements: [
      { id: "m_shaded_count", name: "shaded tray count", value: 34, unit: "organisms", notes: "Field estimate" },
      { id: "m_open_count", name: "open-water tray count", value: 12, unit: "organisms", notes: "Field estimate" },
    ],
    status: "observed",
    mediaCount: 0,
    version: 1,
    createdAt: ts("2026-09-08T12:00:00Z"),
    updatedAt: ts("2026-09-08T12:00:00Z"),
  },
  {
    id: "obs_wetland_turbidity_after_rain",
    projectId: "proj_wetland_recovery",
    title: "Turbidity remained high one day after rain",
    description:
      "The main channel stayed visibly cloudy one day after rain, while the side pool cleared more quickly.",
    notes:
      "May need a flow reading next visit. The side pool has less disturbance from the footpath.",
    hypothesis: null,
    observedAt: ts("2026-09-06T15:20:00Z"),
    location: {
      latitude: 52.1398,
      longitude: 0.1327,
      accuracyMeters: 30,
      label: "Main channel bend",
      precision: "approximate",
    },
    tags: ["wetland", "turbidity", "rainfall"],
    measurements: [
      { id: "m_main_turbidity", name: "main channel turbidity", value: 42, unit: "NTU", notes: null },
      { id: "m_pool_turbidity", name: "side pool turbidity", value: 18, unit: "NTU", notes: null },
    ],
    status: "observed",
    mediaCount: 0,
    version: 1,
    createdAt: ts("2026-09-06T15:40:00Z"),
    updatedAt: ts("2026-09-06T15:40:00Z"),
  },
  {
    id: "obs_lab_sensor_calibration",
    projectId: "proj_lab_method_notes",
    title: "Handheld sensor calibration check",
    description:
      "Compared the handheld temperature and moisture sensor against the lab reference before packing field gear.",
    notes:
      "Temperature offset was small. Moisture probe drifted high in the second cup and should be checked again.",
    hypothesis: null,
    observedAt: ts("2026-09-04T10:10:00Z"),
    location: null,
    tags: ["lab", "calibration", "sensor"],
    measurements: [
      { id: "m_temp_offset", name: "temperature offset", value: 0.3, unit: "C", notes: "Handheld minus reference" },
      { id: "m_moisture_offset", name: "moisture offset", value: 4, unit: "%", notes: "Second cup reading" },
    ],
    status: "observed",
    mediaCount: 0,
    version: 1,
    createdAt: ts("2026-09-04T10:25:00Z"),
    updatedAt: ts("2026-09-04T10:25:00Z"),
  },
  {
    id: "obs_unfiled_reflection",
    projectId: null,
    title: "Field day reflection and next packing note",
    description:
      "The best notes came from recording short observations immediately after each stop instead of waiting until evening.",
    notes:
      "Pack spare labels, lens cloth, and a small clipboard. Add a reminder to log weather before the first transect.",
    hypothesis: null,
    observedAt: ts("2026-09-03T19:15:00Z"),
    location: {
      latitude: 46.551,
      longitude: 7.991,
      accuracyMeters: 100,
      label: "Field station",
      precision: "hidden",
    },
    tags: ["reflection", "workflow", "field-notes"],
    measurements: [],
    status: "draft",
    mediaCount: 0,
    version: 1,
    createdAt: ts("2026-09-03T19:30:00Z"),
    updatedAt: ts("2026-09-03T19:30:00Z"),
  },
  {
    id: "obs_urban_asphalt_heat",
    projectId: "proj_urban_heat",
    title: "Asphalt stayed warmer than shaded sidewalk",
    description:
      "The exposed asphalt section held more heat than the shaded concrete sidewalk during the late afternoon walk.",
    notes:
      "The difference was easiest to feel near parked cars where airflow was low. Repeat on a cloudy day.",
    hypothesis:
      "Dark exposed surfaces retain afternoon heat longer than shaded pedestrian surfaces.",
    observedAt: ts("2026-09-11T16:40:00Z"),
    location: {
      latitude: 24.8607,
      longitude: 67.0011,
      accuracyMeters: 8,
      label: "Market street crossing",
      precision: "exact",
    },
    tags: ["urban", "asphalt", "surface-temperature", "shade"],
    measurements: [
      { id: "m_asphalt_temp", name: "asphalt surface temperature", value: 43.8, unit: "C", notes: "Direct sun" },
      { id: "m_sidewalk_temp", name: "shaded sidewalk temperature", value: 34.1, unit: "C", notes: "Tree shade" },
      { id: "m_air_temp", name: "air temperature", value: 32.6, unit: "C", notes: "Chest height" },
    ],
    status: "analyzed",
    mediaCount: 3,
    version: 1,
    createdAt: ts("2026-09-11T17:05:00Z"),
    updatedAt: ts("2026-09-11T17:45:00Z"),
  },
  {
    id: "obs_urban_tree_shade",
    projectId: "proj_urban_heat",
    title: "Tree shade cooled the bus stop waiting area",
    description:
      "The bus stop under mature trees felt noticeably cooler than the uncovered stop one block away.",
    notes:
      "Both stops had similar traffic flow. The shaded stop also had lower glare and more people waiting.",
    hypothesis:
      "Continuous canopy shade may lower perceived heat stress at transit stops.",
    observedAt: ts("2026-09-11T17:20:00Z"),
    location: {
      latitude: 24.8622,
      longitude: 67.0045,
      accuracyMeters: 18,
      label: "Shaded bus stop",
      precision: "approximate",
    },
    tags: ["urban", "shade", "transit", "heat"],
    measurements: [
      { id: "m_shaded_air", name: "shaded stop air temperature", value: 31.9, unit: "C", notes: null },
      { id: "m_uncovered_air", name: "uncovered stop air temperature", value: 34.4, unit: "C", notes: null },
    ],
    status: "observed",
    mediaCount: 1,
    version: 1,
    createdAt: ts("2026-09-11T17:35:00Z"),
    updatedAt: ts("2026-09-11T17:35:00Z"),
  },
  {
    id: "obs_fermentation_sourdough_rise",
    projectId: "proj_kitchen_fermentation",
    title: "Sourdough starter doubled faster after warmer proof",
    description:
      "The starter reached double volume sooner when kept near the warm window instead of the cool counter.",
    notes:
      "Aroma was mild and fruity, not sharp. Feeding ratio stayed 1:2:2 by weight.",
    hypothesis:
      "A warmer proofing spot speeds visible fermentation without creating strong acidity in this batch.",
    observedAt: ts("2026-09-11T07:30:00Z"),
    location: null,
    tags: ["fermentation", "sourdough", "temperature", "kitchen"],
    measurements: [
      { id: "m_start_temp", name: "starter temperature", value: 27.2, unit: "C", notes: "Warm window" },
      { id: "m_rise_time", name: "time to double", value: 4.5, unit: "hours", notes: "Marked jar line" },
      { id: "m_starter_ph", name: "starter pH", value: 4.1, unit: "pH", notes: "Strip estimate" },
    ],
    status: "analyzed",
    mediaCount: 0,
    version: 1,
    createdAt: ts("2026-09-11T08:00:00Z"),
    updatedAt: ts("2026-09-11T08:15:00Z"),
  },
  {
    id: "obs_fermentation_brine_bubbles",
    projectId: "proj_kitchen_fermentation",
    title: "Brine bubbles increased on day three",
    description:
      "The vegetable ferment showed steady bubbling after the jar was moved away from direct sun.",
    notes:
      "Brine stayed clear. No surface film. Smell was clean and sour.",
    hypothesis: null,
    observedAt: ts("2026-09-10T18:10:00Z"),
    location: null,
    tags: ["fermentation", "brine", "vegetables", "microbiology"],
    measurements: [
      { id: "m_brine_ph", name: "brine pH", value: 3.8, unit: "pH", notes: "Day three" },
      { id: "m_room_temp", name: "room temperature", value: 25.4, unit: "C", notes: null },
    ],
    status: "observed",
    mediaCount: 0,
    version: 1,
    createdAt: ts("2026-09-10T18:25:00Z"),
    updatedAt: ts("2026-09-10T18:25:00Z"),
  },
  {
    id: "obs_sky_jupiter_moons",
    projectId: "proj_night_sky",
    title: "Four bright points visible beside Jupiter",
    description:
      "Through binoculars, four small bright points appeared in a line close to Jupiter during a clear evening session.",
    notes:
      "Sketch spacing before checking a sky app. Thin haze appeared after 22:00 and reduced contrast.",
    hypothesis:
      "The points were likely the Galilean moons, but the spacing should be checked against the date and time.",
    observedAt: ts("2026-09-11T21:10:00Z"),
    location: {
      latitude: 24.875,
      longitude: 67.04,
      accuracyMeters: 250,
      label: "Backyard viewing spot",
      precision: "hidden",
    },
    tags: ["astronomy", "jupiter", "binoculars", "sky"],
    measurements: [
      { id: "m_sky_clarity", name: "sky clarity", value: 4, unit: "1-5", notes: "Before haze" },
      { id: "m_session_length", name: "session length", value: 35, unit: "minutes", notes: null },
    ],
    status: "observed",
    mediaCount: 2,
    version: 1,
    createdAt: ts("2026-09-11T21:25:00Z"),
    updatedAt: ts("2026-09-11T21:35:00Z"),
  },
  {
    id: "obs_sky_cloud_interruption",
    projectId: "proj_night_sky",
    title: "Cloud band interrupted meteor watch",
    description:
      "A low cloud band moved across the eastern sky and ended the meteor watch earlier than planned.",
    notes:
      "Only two possible meteors were seen before the clouds arrived. Both were short and faint.",
    hypothesis: null,
    observedAt: ts("2026-09-07T23:40:00Z"),
    location: {
      latitude: 24.875,
      longitude: 67.04,
      accuracyMeters: 250,
      label: "Backyard viewing spot",
      precision: "hidden",
    },
    tags: ["astronomy", "clouds", "meteor-watch"],
    measurements: [
      { id: "m_visible_meteors", name: "possible meteors", value: 2, unit: "count", notes: "Before cloud band" },
      { id: "m_cloud_cover", name: "cloud cover", value: 70, unit: "%", notes: "Estimated after interruption" },
    ],
    status: "archived",
    mediaCount: 0,
    version: 1,
    createdAt: ts("2026-09-08T00:05:00Z"),
    updatedAt: ts("2026-09-08T00:05:00Z"),
  },
];

const analyses = [
  {
    id: "anl_alpine_uv_pattern",
    projectId: "proj_alpine_microclimate",
    observationIds: ["obs_alpine_lichen_uv", "obs_alpine_moss_moisture", "obs_alpine_evening_temp"],
    conversationId: null,
    type: "analysis",
    summary:
      "The alpine observations suggest that sun exposure, wind, and evening cooling are creating distinct microclimate zones across the ridge.",
    keyFindings: [
      "The brightest lichen pigment was recorded at the most sun-exposed ridge point.",
      "Moss moisture dropped faster where midday wind reached the surface.",
      "The lower marker cooled more quickly after sunset, suggesting a local inversion pattern.",
    ],
    hypotheses: [
      {
        statement: "UV exposure and drying wind may jointly explain the strongest visible stress responses.",
        confidence: "medium",
        supportingObservationIds: ["obs_alpine_lichen_uv", "obs_alpine_moss_moisture"],
      },
    ],
    uncertainties: [
      "The lichen color comparison is visual and should be checked with a repeatable image or pigment measurement.",
      "Only one evening inversion event is recorded so far.",
    ],
    suggestedQuestions: [
      "Does pigment intensity stay high after a cloudy day?",
      "Are moisture changes stronger on wind-exposed rock faces than shaded soil pockets?",
    ],
    openQuestions: ["Would repeated evening readings confirm the inversion pattern?"],
    suggestedNextSteps: [
      "Repeat lichen color photos at the same three rocks after sunny and cloudy mornings.",
      "Add a small wind reading beside each moisture measurement.",
      "Log lower and ridge temperatures every 30 minutes after sunset for two more evenings.",
    ],
    model: "fake-gemini-model",
    promptVersion: "observation-analysis-v1",
    createdAt: ts("2026-09-10T14:42:00Z"),
  },
  {
    id: "anl_wetland_recovery_summary",
    projectId: "proj_wetland_recovery",
    observationIds: ["obs_wetland_ph_shift", "obs_wetland_invertebrates", "obs_wetland_turbidity_after_rain"],
    conversationId: null,
    type: "research_suggestions",
    summary:
      "The wetland records point to small but useful contrasts between reed-edge and open-water sampling points.",
    keyFindings: [
      "The reed-edge sample had lower pH than open water.",
      "The shaded reed margin had more visible invertebrates in the sweep sample.",
      "The main channel stayed more turbid than a nearby side pool after rain.",
    ],
    hypotheses: [
      {
        statement: "Vegetation structure may be creating calmer microhabitats with different chemistry and more shelter.",
        confidence: "medium",
        supportingObservationIds: ["obs_wetland_ph_shift", "obs_wetland_invertebrates"],
      },
    ],
    uncertainties: [
      "The invertebrate counts are estimates rather than preserved lab counts.",
      "Rainfall and flow were not measured during the turbidity observation.",
    ],
    suggestedQuestions: [
      "Does the reed-edge pH difference repeat at different times of day?",
      "Does turbidity track rainfall amount or flow speed more closely?",
    ],
    openQuestions: ["Are shaded sweep counts consistently higher across multiple visits?"],
    suggestedNextSteps: [
      "Repeat paired pH readings at reed-edge and open-water points for three mornings.",
      "Add a simple flow-speed note to each turbidity reading.",
      "Take duplicate sweep samples before estimating invertebrate counts.",
    ],
    model: "fake-gemini-model",
    promptVersion: "research-suggestions-v1",
    createdAt: ts("2026-09-08T12:50:00Z"),
  },
  {
    id: "anl_urban_heat_walk",
    projectId: "proj_urban_heat",
    observationIds: ["obs_urban_asphalt_heat", "obs_urban_tree_shade"],
    conversationId: null,
    type: "analysis",
    summary:
      "The urban walk records show a clear contrast between exposed hard surfaces and shaded pedestrian spaces.",
    keyFindings: [
      "Exposed asphalt was nearly 10 C warmer than the shaded sidewalk.",
      "The shaded bus stop had lower air temperature than the uncovered stop one block away.",
      "Both observations point toward shade as a practical heat-reduction feature.",
    ],
    hypotheses: [
      {
        statement: "Tree canopy reduces both surface heat and perceived heat stress along the walking loop.",
        confidence: "medium",
        supportingObservationIds: ["obs_urban_asphalt_heat", "obs_urban_tree_shade"],
      },
    ],
    uncertainties: [
      "The route was measured on one afternoon only.",
      "Traffic, wind, and humidity were not measured.",
    ],
    suggestedQuestions: [
      "Do shaded stops remain cooler during morning and evening commute hours?",
      "How much does surface material change the temperature gap?",
    ],
    openQuestions: ["Would the same pattern appear on a cloudy day?"],
    suggestedNextSteps: [
      "Repeat the route at 09:00, 14:00, and 18:00 on the same day.",
      "Add humidity and wind notes at each stop.",
      "Compare asphalt, concrete, grass, and shaded paving in the same block.",
    ],
    model: "fake-gemini-model",
    promptVersion: "observation-analysis-v1",
    createdAt: ts("2026-09-11T17:50:00Z"),
  },
  {
    id: "anl_fermentation_batch",
    projectId: "proj_kitchen_fermentation",
    observationIds: ["obs_fermentation_sourdough_rise", "obs_fermentation_brine_bubbles"],
    conversationId: null,
    type: "summary",
    summary:
      "The fermentation notes suggest that temperature changes are affecting both starter rise time and brine activity.",
    keyFindings: [
      "The sourdough starter doubled in 4.5 hours near the warmer window.",
      "The vegetable brine reached pH 3.8 and showed steady bubbling on day three.",
    ],
    hypotheses: [],
    uncertainties: [
      "The pH readings are strip estimates.",
      "Batch size and salt percentage should be recorded more consistently.",
    ],
    suggestedQuestions: [
      "What temperature range gives a reliable rise without overly sharp acidity?",
      "Does moving the brine jar away from sun reduce surface film risk?",
    ],
    openQuestions: ["Was the vegetable ferment mixed at the same salt ratio as previous batches?"],
    suggestedNextSteps: [
      "Record room temperature every 12 hours for the next batch.",
      "Write the salt percentage into each brine observation.",
    ],
    model: "fake-gemini-model",
    promptVersion: "conversation-summary-v1",
    createdAt: ts("2026-09-11T08:20:00Z"),
  },
  {
    id: "anl_night_sky_visibility",
    projectId: "proj_night_sky",
    observationIds: ["obs_sky_jupiter_moons", "obs_sky_cloud_interruption"],
    conversationId: null,
    type: "research_suggestions",
    summary:
      "The night-sky notes show that visibility changed quickly across short backyard sessions.",
    keyFindings: [
      "Jupiter was clear enough for four nearby bright points to be sketched before haze increased.",
      "A later meteor watch ended early because cloud cover rose to roughly 70%.",
    ],
    hypotheses: [
      {
        statement: "Short sessions earlier in the evening may produce more useful observations before haze or cloud bands form.",
        confidence: "low",
        supportingObservationIds: ["obs_sky_jupiter_moons", "obs_sky_cloud_interruption"],
      },
    ],
    uncertainties: [
      "Object identity was not confirmed during the Jupiter observation.",
      "Cloud cover estimates are subjective.",
    ],
    suggestedQuestions: [
      "Which evenings have the best combination of clarity and low cloud cover?",
      "Can sketches be compared with a sky chart after recording?",
    ],
    openQuestions: ["Would a fixed observation checklist improve consistency?"],
    suggestedNextSteps: [
      "Record sky clarity at the beginning and end of every viewing session.",
      "Compare the Jupiter moon sketch with a planetarium app after saving the observation.",
    ],
    model: "fake-gemini-model",
    promptVersion: "research-suggestions-v1",
    createdAt: ts("2026-09-11T21:40:00Z"),
  },
] as const;

const researchTasks = [
  {
    id: "task_repeat_lichen_photos",
    projectId: "proj_alpine_microclimate",
    title: "Repeat lichen color photos after sunny and cloudy mornings",
    description:
      "Use the same rocks and camera angle so color changes are easier to compare across weather conditions.",
    source: "gemini",
    sourceAnalysisId: "anl_alpine_uv_pattern",
    status: "suggested",
    relatedObservationIds: ["obs_alpine_lichen_uv"],
    createdAt: ts("2026-09-10T14:50:00Z"),
    updatedAt: ts("2026-09-10T14:50:00Z"),
  },
  {
    id: "task_evening_temperature_log",
    projectId: "proj_alpine_microclimate",
    title: "Log ridge and lower-marker temperature after sunset",
    description:
      "Record both points every 30 minutes for two evenings to check whether the inversion pattern repeats.",
    source: "user",
    sourceAnalysisId: null,
    status: "planned",
    relatedObservationIds: ["obs_alpine_evening_temp"],
    createdAt: ts("2026-09-09T19:00:00Z"),
    updatedAt: ts("2026-09-09T19:00:00Z"),
  },
  {
    id: "task_wetland_ph_pairs",
    projectId: "proj_wetland_recovery",
    title: "Repeat paired pH readings at reed-edge and open-water points",
    description:
      "Take matched readings over three mornings and note water movement, cloud cover, and recent rainfall.",
    source: "gemini",
    sourceAnalysisId: "anl_wetland_recovery_summary",
    status: "in_progress",
    relatedObservationIds: ["obs_wetland_ph_shift"],
    createdAt: ts("2026-09-08T13:05:00Z"),
    updatedAt: ts("2026-09-11T08:30:00Z"),
  },
  {
    id: "task_sensor_probe_check",
    projectId: "proj_lab_method_notes",
    title: "Re-check moisture probe drift before next field visit",
    description:
      "Run the probe against two known moisture samples and mark the offset in the field kit notes.",
    source: "user",
    sourceAnalysisId: null,
    status: "completed",
    relatedObservationIds: ["obs_lab_sensor_calibration"],
    createdAt: ts("2026-09-04T11:00:00Z"),
    updatedAt: ts("2026-09-05T09:20:00Z"),
  },
  {
    id: "task_urban_route_repeat",
    projectId: "proj_urban_heat",
    title: "Repeat the heat walk at three times of day",
    description:
      "Walk the same route at morning, afternoon, and evening to compare surface and air temperature changes.",
    source: "gemini",
    sourceAnalysisId: "anl_urban_heat_walk",
    status: "planned",
    relatedObservationIds: ["obs_urban_asphalt_heat", "obs_urban_tree_shade"],
    createdAt: ts("2026-09-11T18:00:00Z"),
    updatedAt: ts("2026-09-11T18:00:00Z"),
  },
  {
    id: "task_fermentation_salt_ratio",
    projectId: "proj_kitchen_fermentation",
    title: "Write salt percentage into every brine note",
    description:
      "Add the salt ratio to each vegetable ferment observation so future batches can be compared fairly.",
    source: "user",
    sourceAnalysisId: null,
    status: "in_progress",
    relatedObservationIds: ["obs_fermentation_brine_bubbles"],
    createdAt: ts("2026-09-10T19:00:00Z"),
    updatedAt: ts("2026-09-11T08:10:00Z"),
  },
  {
    id: "task_sourdough_temperature_series",
    projectId: "proj_kitchen_fermentation",
    title: "Record starter rise time at three room temperatures",
    description:
      "Compare cool counter, central shelf, and warm window rise times using the same feeding ratio.",
    source: "gemini",
    sourceAnalysisId: "anl_fermentation_batch",
    status: "suggested",
    relatedObservationIds: ["obs_fermentation_sourdough_rise"],
    createdAt: ts("2026-09-11T08:25:00Z"),
    updatedAt: ts("2026-09-11T08:25:00Z"),
  },
  {
    id: "task_jupiter_sketch_compare",
    projectId: "proj_night_sky",
    title: "Compare Jupiter sketch with a sky chart",
    description:
      "Check the saved sketch against the date and time after the observation, without changing the original note.",
    source: "gemini",
    sourceAnalysisId: "anl_night_sky_visibility",
    status: "suggested",
    relatedObservationIds: ["obs_sky_jupiter_moons"],
    createdAt: ts("2026-09-11T21:45:00Z"),
    updatedAt: ts("2026-09-11T21:45:00Z"),
  },
  {
    id: "task_unfiled_pack_checklist",
    projectId: null,
    title: "Create a small field-kit packing checklist",
    description:
      "Turn the reflection note into a checklist for labels, lens cloth, clipboard, and weather logging.",
    source: "user",
    sourceAnalysisId: null,
    status: "planned",
    relatedObservationIds: ["obs_unfiled_reflection"],
    createdAt: ts("2026-09-03T20:00:00Z"),
    updatedAt: ts("2026-09-03T20:00:00Z"),
  },
] as const;

const conversationId = "conv_alpine_planning";
const secondConversationId = "conv_urban_heat_review";
const messages = [
  {
    id: "msg_001",
    role: "user",
    content: "Which alpine observations should I repeat first if I only have one clear morning?",
    sequence: 1,
    createdAt: ts("2026-09-10T15:05:00Z"),
  },
  {
    id: "msg_002",
    role: "assistant",
    content:
      "Start with the lichen pigment observation because it has the clearest link to a repeatable condition: strong morning sunlight. Keep the rocks, camera angle, and time window consistent.",
    sequence: 2,
    model: "fake-gemini-model",
    metadata: {
      latencyMs: 420,
      tokenUsage: { promptTokens: 510, candidatesTokens: 62, totalTokens: 572 },
    },
    createdAt: ts("2026-09-10T15:05:02Z"),
  },
  {
    id: "msg_003",
    role: "user",
    content: "Should I include moss moisture in the same visit?",
    sequence: 3,
    createdAt: ts("2026-09-10T15:06:20Z"),
  },
  {
    id: "msg_004",
    role: "assistant",
    content:
      "Yes, if it does not slow the photo series. A paired moisture reading will help separate light exposure from drying wind, but keep the lichen photo protocol first.",
    sequence: 4,
    model: "fake-gemini-model",
    metadata: {
      latencyMs: 390,
      tokenUsage: { promptTokens: 604, candidatesTokens: 57, totalTokens: 661 },
    },
    createdAt: ts("2026-09-10T15:06:22Z"),
  },
] as const;

const secondMessages = [
  {
    id: "msg_001",
    role: "user",
    content: "What should I add to the urban heat walk before I repeat it?",
    sequence: 1,
    createdAt: ts("2026-09-11T18:12:00Z"),
  },
  {
    id: "msg_002",
    role: "assistant",
    content:
      "Add humidity, wind, and surface material notes at each stop. That will make it easier to tell whether shade alone explains the cooler bus stop readings.",
    sequence: 2,
    model: "fake-gemini-model",
    metadata: {
      latencyMs: 360,
      tokenUsage: { promptTokens: 430, candidatesTokens: 48, totalTokens: 478 },
    },
    createdAt: ts("2026-09-11T18:12:02Z"),
  },
  {
    id: "msg_003",
    role: "user",
    content: "Should I include photos?",
    sequence: 3,
    createdAt: ts("2026-09-11T18:13:15Z"),
  },
  {
    id: "msg_004",
    role: "assistant",
    content:
      "Yes. One wide photo at each stop will help document shade, surface type, traffic, and nearby buildings without relying only on memory.",
    sequence: 4,
    model: "fake-gemini-model",
    metadata: {
      latencyMs: 335,
      tokenUsage: { promptTokens: 492, candidatesTokens: 42, totalTokens: 534 },
    },
    createdAt: ts("2026-09-11T18:13:17Z"),
  },
] as const;

const mediaSeeds = [
  {
    observationId: "obs_alpine_lichen_uv",
    mediaId: "media_lichen_photo",
    sourceFile: "observation.jpg",
    caption: "Exposed orange lichen patch on the north ridge transect.",
    createdAt: ts("2026-09-10T10:38:00Z"),
  },
  {
    observationId: "obs_alpine_lichen_uv",
    mediaId: "media_lichen_detail",
    sourceFile: "create_observation.png",
    caption: "Duplicate demo image used as a close-up evidence attachment.",
    createdAt: ts("2026-09-10T10:39:00Z"),
  },
  {
    observationId: "obs_wetland_ph_shift",
    mediaId: "media_reed_sample",
    sourceFile: "projects.jpg",
    caption: "Paired pH sample taken near new reed growth.",
    createdAt: ts("2026-09-08T09:55:00Z"),
  },
  {
    observationId: "obs_wetland_ph_shift",
    mediaId: "media_reed_duplicate",
    sourceFile: "projects.jpg",
    caption: "Duplicate demo upload for gallery testing.",
    createdAt: ts("2026-09-08T09:56:00Z"),
  },
  {
    observationId: "obs_urban_asphalt_heat",
    mediaId: "media_asphalt_walk",
    sourceFile: "research map.jpg",
    caption: "Exposed asphalt and shaded sidewalk measurement points.",
    createdAt: ts("2026-09-11T17:08:00Z"),
  },
  {
    observationId: "obs_urban_asphalt_heat",
    mediaId: "media_sidewalk_shade",
    sourceFile: "dashboard_returning_user.png",
    caption: "Second attachment for comparing shaded and exposed surfaces.",
    createdAt: ts("2026-09-11T17:09:00Z"),
  },
  {
    observationId: "obs_urban_asphalt_heat",
    mediaId: "media_heat_duplicate",
    sourceFile: "dashboard_returning_user.png",
    caption: "Duplicate image upload to test multiple-file display.",
    createdAt: ts("2026-09-11T17:10:00Z"),
  },
  {
    observationId: "obs_urban_tree_shade",
    mediaId: "media_tree_shade_stop",
    sourceFile: "dashboard_new_user.jpg",
    caption: "Demo image representing the shaded transit stop.",
    createdAt: ts("2026-09-11T17:25:00Z"),
  },
  {
    observationId: "obs_sky_jupiter_moons",
    mediaId: "media_jupiter_sketch",
    sourceFile: "ai chat.jpg",
    caption: "Quick field sketch of bright points near Jupiter before checking a sky chart.",
    createdAt: ts("2026-09-11T21:28:00Z"),
  },
  {
    observationId: "obs_sky_jupiter_moons",
    mediaId: "media_jupiter_duplicate",
    sourceFile: "ai chat.jpg",
    caption: "Duplicate demo attachment for testing repeated image uploads.",
    createdAt: ts("2026-09-11T21:29:00Z"),
  },
] as const;

function searchableText(observation: ObservationSeed) {
  return [
    observation.title,
    observation.description,
    observation.notes || "",
    observation.hypothesis || "",
    observation.tags.join(" "),
    observation.measurements.map((m) => `${m.name} ${m.value} ${m.unit} ${m.notes || ""}`).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function mediaMimeType(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  return "image/jpeg";
}

function mediaDirCandidates() {
  const explicit = process.env.DEMO_MEDIA_DIR;
  return [
    ...(explicit ? [explicit] : []),
    path.resolve(process.cwd(), "..", "frontend", "dist", "media"),
    path.resolve(process.cwd(), "frontend", "dist", "media"),
  ];
}

async function findMediaDir() {
  for (const candidate of mediaDirCandidates()) {
    try {
      const info = await stat(candidate);
      if (info.isDirectory()) return candidate;
    } catch {
      // Try the next common repo-relative location.
    }
  }
  throw new Error("Could not find frontend/dist/media. Set DEMO_MEDIA_DIR to the image folder.");
}

async function upsertAuthUser() {
  try {
    await auth.updateUser(uid, {
      email,
      emailVerified: true,
      displayName,
      photoURL: undefined,
      providerToLink: {
        providerId: "google.com",
        uid: "demo-google-researcher",
        email,
        displayName,
      },
    });
  } catch (err: any) {
    if (err?.code !== "auth/user-not-found") {
      throw err;
    }
    await auth.createUser({
      uid,
      email,
      emailVerified: true,
      displayName,
    });
    await auth.updateUser(uid, {
      providerToLink: {
        providerId: "google.com",
        uid: "demo-google-researcher",
        email,
        displayName,
      },
    });
  }
}

async function resetUserTree() {
  const existing = await userRef.get();
  if (existing.exists) {
    await db.recursiveDelete(userRef);
  }
}

async function seed() {
  await upsertAuthUser();
  await resetUserTree();

  const mediaDir = await findMediaDir();
  const batch = db.batch();

  batch.set(userRef, {
    ownerId: uid,
    displayName,
    email,
    photoURL: null,
    avatarPath: null,
    role: "user",
    accountStatus: "active",
    preferences: {
      theme: "system",
      timezone: "Asia/Karachi",
      locationEnabled: true,
      aiSuggestionsEnabled: true,
    },
    createdAt: ts("2026-09-01T08:00:00Z"),
    updatedAt: ts("2026-09-11T08:30:00Z"),
    lastLoginAt: FieldValue.serverTimestamp(),
  });

  for (const project of projects) {
    const { id, ...data } = project;
    batch.set(userRef.collection("projects").doc(id), {
      ownerId: uid,
      ...data,
    });
  }

  for (const observation of observations) {
    const { id, ...data } = observation;
    batch.set(userRef.collection("observations").doc(id), {
      ownerId: uid,
      ...data,
    });
    batch.set(userRef.collection("observationSearch").doc(id), {
      ownerId: uid,
      observationId: id,
      searchableText: searchableText(observation),
      observedAt: observation.observedAt,
      indexedAt: observation.updatedAt,
      updatedAt: observation.updatedAt,
    });
  }

  batch.set(
    userRef.collection("observations").doc("obs_alpine_lichen_uv").collection("versions").doc("ver_001"),
    {
      version: 1,
      title: "Lichen color on exposed ridge rocks",
      description:
        "Initial field note: exposed orange lichen looked brighter than nearby shaded samples.",
      hypothesis: "UV exposure may be related to stronger visible pigment.",
      measurements: [{ id: "m_uv_index", name: "UV index", value: 8, unit: "index", notes: "Rounded field note" }],
      editedAt: ts("2026-09-10T14:35:00Z"),
      editedBy: uid,
      changeReason: "Clarified title and added surface temperature measurement.",
    }
  );

  for (const media of mediaSeeds) {
    const filePath = path.join(mediaDir, media.sourceFile);
    const fileBuffer = await readFile(filePath);
    const storagePath = `users/${uid}/observations/${media.observationId}/${media.mediaId}`;
    const mimeType = mediaMimeType(media.sourceFile);

    await bucket.file(storagePath).save(fileBuffer, {
      metadata: { contentType: mimeType },
      resumable: false,
    });

    batch.set(
      userRef.collection("observations").doc(media.observationId).collection("media").doc(media.mediaId),
      {
        ownerId: uid,
        observationId: media.observationId,
        type: "image",
        storagePath,
        fileName: media.sourceFile,
        mimeType,
        sizeBytes: fileBuffer.byteLength,
        caption: media.caption,
        createdAt: media.createdAt,
      }
    );
  }

  for (const analysis of analyses) {
    const { id, ...data } = analysis;
    batch.set(userRef.collection("analyses").doc(id), {
      ownerId: uid,
      ...data,
    });
  }

  for (const task of researchTasks) {
    const { id, ...data } = task;
    batch.set(userRef.collection("researchTasks").doc(id), {
      ownerId: uid,
      ...data,
    });
  }

  batch.set(userRef.collection("conversations").doc(conversationId), {
    ownerId: uid,
    projectId: "proj_alpine_microclimate",
    title: "Planning the next alpine field visit",
    contextType: "project",
    contextId: "proj_alpine_microclimate",
    messageCount: messages.length,
    status: "active",
    createdAt: ts("2026-09-10T15:04:00Z"),
    updatedAt: ts("2026-09-10T15:06:22Z"),
  });

  for (const message of messages) {
    const { id, ...data } = message;
    batch.set(userRef.collection("conversations").doc(conversationId).collection("messages").doc(id), {
      ownerId: uid,
      conversationId,
      ...data,
    });
  }

  batch.set(userRef.collection("conversations").doc(secondConversationId), {
    ownerId: uid,
    projectId: "proj_urban_heat",
    title: "Reviewing the urban heat route",
    contextType: "project",
    contextId: "proj_urban_heat",
    messageCount: secondMessages.length,
    status: "active",
    createdAt: ts("2026-09-11T18:11:00Z"),
    updatedAt: ts("2026-09-11T18:13:17Z"),
  });

  for (const message of secondMessages) {
    const { id, ...data } = message;
    batch.set(userRef.collection("conversations").doc(secondConversationId).collection("messages").doc(id), {
      ownerId: uid,
      conversationId: secondConversationId,
      ...data,
    });
  }

  await batch.commit();
}

seed()
  .then(() => {
    console.log("Demo data seeded in local Firebase emulators.");
    console.log(`Project: ${projectId}`);
    console.log(`UID: ${uid}`);
    console.log(`Email: ${email}`);
    console.log(`Storage bucket: ${storageBucket}`);
    console.log(`Uploaded media files: ${mediaSeeds.length}`);
    console.log("Google provider UID for emulator popup: demo-google-researcher");
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
