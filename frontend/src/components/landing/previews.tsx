import React from "react";
import {
  Paperclip,
  MapPin,
  Sparkles,
  AlertTriangle,
  BookOpen,
  HelpCircle,
} from "lucide-react";

/*
 * Static, read-only product previews for the public landing page
 * (homepage guidelines §3, §6). All content is clearly labeled illustrative
 * sample data — no fake focusable controls, no live AI/map/network calls.
 */

const PREVIEW_CARD =
  "rounded-xl border border-lp-border bg-lp-surface p-5 text-left shadow-sm";

/* ------------------------------------------------------------------ */
/* Hero previews                                                       */
/* ------------------------------------------------------------------ */

/** Hero: sample observation card with a semantic measurement table. */
export const ObservationPreview: React.FC<{ className?: string }> = ({ className = "" }) => (
  <article className={`${PREVIEW_CARD} ${className}`} aria-label="Example observation (sample data)">
    <p className="text-xs font-medium uppercase tracking-wide text-lp-muted">
      Example observation — sample data
    </p>
    <h3 className="mt-2 text-lg font-semibold text-lp-ink">
      Pollinator activity after rainfall
    </h3>
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-lp-muted">
      <span>Observed 14 May 2026</span>
      <span className="inline-flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        Approximate location · Meadow edge
      </span>
    </p>
    <p className="mt-3 flex gap-2">
      <span className="rounded-full border border-lp-border bg-lp-bg px-2.5 py-0.5 text-xs font-medium text-lp-muted">
        pollinators
      </span>
      <span className="rounded-full border border-lp-border bg-lp-bg px-2.5 py-0.5 text-xs font-medium text-lp-muted">
        rainfall
      </span>
    </p>
    <p className="mt-3 text-[15px] leading-relaxed text-lp-ink">
      Light rain ended around 09:40. Bumblebees resumed foraging on comfrey
      within minutes; honeybees returned noticeably later.
    </p>

    <table className="mt-4 w-full text-sm">
      <caption className="sr-only">Sample measurements for this observation</caption>
      <thead>
        <tr className="border-b border-lp-border text-left text-xs text-lp-muted">
          <th scope="col" className="py-1.5 pr-3 font-medium">Measurement</th>
          <th scope="col" className="py-1.5 pr-3 text-right font-medium">Value</th>
          <th scope="col" className="py-1.5 text-left font-medium">Unit</th>
        </tr>
      </thead>
      <tbody className="text-lp-ink">
        <tr className="border-b border-lp-border/60">
          <th scope="row" className="py-1.5 pr-3 font-normal">Air temperature</th>
          <td className="py-1.5 pr-3 text-right font-mono text-[13px]">17.5</td>
          <td className="py-1.5">°C</td>
        </tr>
        <tr className="border-b border-lp-border/60">
          <th scope="row" className="py-1.5 pr-3 font-normal">Relative humidity</th>
          <td className="py-1.5 pr-3 text-right font-mono text-[13px]">86</td>
          <td className="py-1.5">%</td>
        </tr>
        <tr>
          <th scope="row" className="py-1.5 pr-3 font-normal">Bee count</th>
          <td className="py-1.5 pr-3 text-right font-mono text-[13px]">12</td>
          <td className="py-1.5">individuals</td>
        </tr>
      </tbody>
    </table>
  </article>
);

/** Hero: sample Gemini analysis card with uncertainty and provenance. */
export const AnalysisPreview: React.FC<{ className?: string }> = ({ className = "" }) => (
  <article
    className={`${PREVIEW_CARD} border-lp-ai/30 bg-lp-ai-surface/40 ${className}`}
    aria-label="Example Gemini analysis (sample data)"
  >
    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-lp-ai-text">
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      Gemini analysis — sample data
    </p>
    <p className="mt-2 text-[15px] leading-relaxed text-lp-ink">
      Bee activity resumed quickly after the rain stopped, with bumblebees
      returning before honeybees in this record.
    </p>

    <div className="mt-3 rounded-lg border border-lp-uncertainty-text/30 bg-lp-uncertainty-bg p-3">
      <p className="flex items-start gap-2 text-sm leading-relaxed text-lp-uncertainty-text">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Uncertainty:</strong> One observation
          cannot establish a pattern. More comparable records are needed.
        </span>
      </p>
    </div>

    <div className="mt-3">
      <p className="text-xs font-medium text-lp-muted">Supporting observations</p>
      <ul className="mt-1 space-y-1 text-sm">
        <li>
          <span className="font-medium text-lp-link underline decoration-lp-link/40 underline-offset-2">
            Pollinator activity after rainfall
          </span>
        </li>
        <li>
          <span className="font-medium text-lp-link underline decoration-lp-link/40 underline-offset-2">
            Morning foraging delay before the storm
          </span>
        </li>
      </ul>
    </div>

    <footer className="mt-4 border-t border-lp-border pt-2.5 text-xs text-lp-muted">
      Gemini · Example sources · Generation details
    </footer>
  </article>
);

/* ------------------------------------------------------------------ */
/* Feature section previews                                            */
/* ------------------------------------------------------------------ */

/** §6A: static read-only observation editor illustration. */
export const StructuredEditorPreview: React.FC = () => (
  <div
    className={`${PREVIEW_CARD} space-y-4`}
    aria-label="Example observation editor (sample data)"
  >
    <p className="text-xs font-medium uppercase tracking-wide text-lp-muted">
      Example observation form — sample data
    </p>

    <div>
      <p className="text-sm font-medium text-lp-muted">Title</p>
      <p className="mt-1 rounded-lg border border-lp-border bg-lp-bg px-3 py-2 text-[15px] text-lp-ink">
        Moss regrowth on north wall after clearing
      </p>
    </div>

    <div>
      <p className="text-sm font-medium text-lp-muted">Description</p>
      <p className="mt-1 rounded-lg border border-lp-border bg-lp-bg px-3 py-2 text-[15px] leading-relaxed text-lp-ink">
        Cleared ivy in March; moss visible again on shaded bricks within six
        weeks.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="text-sm font-medium text-lp-muted">Observed date</p>
        <p className="mt-1 rounded-lg border border-lp-border bg-lp-bg px-3 py-2 text-[15px] text-lp-ink">
          2 June 2026
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-lp-muted">Project (optional)</p>
        <p className="mt-1 rounded-lg border border-dashed border-lp-border bg-lp-bg px-3 py-2 text-[15px] text-lp-muted">
          Unfiled
        </p>
      </div>
    </div>

    <div>
      <p className="text-sm font-medium text-lp-muted">Hypothesis (optional)</p>
      <p className="mt-1 rounded-lg border border-lp-border bg-lp-bg px-3 py-2 text-[15px] text-lp-ink">
        Shaded brick retains enough moisture for regrowth without watering.
      </p>
    </div>

    <table className="w-full text-sm">
      <caption className="sr-only">Sample measurements</caption>
      <thead>
        <tr className="border-b border-lp-border text-left text-xs text-lp-muted">
          <th scope="col" className="py-1.5 pr-3 font-medium">Measurement</th>
          <th scope="col" className="py-1.5 pr-3 text-right font-medium">Value</th>
          <th scope="col" className="py-1.5 text-left font-medium">Unit</th>
        </tr>
      </thead>
      <tbody className="text-lp-ink">
        <tr>
          <th scope="row" className="py-1.5 pr-3 font-normal">Wall shade hours</th>
          <td className="py-1.5 pr-3 text-right font-mono text-[13px]">5</td>
          <td className="py-1.5">h/day</td>
        </tr>
      </tbody>
    </table>

    <p className="flex items-center gap-2 border-t border-lp-border pt-3 text-sm text-lp-muted">
      <Paperclip className="h-4 w-4" aria-hidden="true" />
      1 evidence photo attached (not shown)
    </p>
  </div>
);

/** §6B: restrained schematic map — "Illustrative map", no geographic accuracy. */
export const MapPreview: React.FC = () => (
  <div className={`${PREVIEW_CARD} overflow-hidden p-0`} aria-label="Illustrative map (sample data)">
    <div
      className="relative h-64 bg-lp-primary-soft sm:h-72"
      role="img"
      aria-label="Illustrative map showing three observation pins and one approximate-location area"
    >
      {/* Faint grid — pattern stays behind graphics, never behind reading text */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(18,61,54,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(18,61,54,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Roads (decorative schematic strokes) */}
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 400 280" preserveAspectRatio="none">
        <path d="M-10 210 C 90 190, 150 120, 410 90" fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" />
        <path d="M120 290 C 140 200, 240 170, 300 20" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />
      </svg>

      {/* Approximate-location area (no exact coordinates shown) */}
      <span
        aria-hidden="true"
        className="absolute left-[30%] top-[38%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-lp-primary/70 bg-lp-primary/10"
      />
      {/* Selected pin */}
      <span
        aria-hidden="true"
        className="absolute left-[30%] top-[38%] flex h-7 w-7 -translate-x-1/2 -translate-y-[calc(100%+2px)] items-center justify-center"
      >
        <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-lp-primary shadow" />
      </span>
      {/* Other pins */}
      <span aria-hidden="true" className="absolute left-[62%] top-[62%] h-3 w-3 rounded-full border-2 border-white bg-lp-primary/80 shadow" />
      <span aria-hidden="true" className="absolute left-[76%] top-[30%] h-3 w-3 rounded-full border-2 border-white bg-lp-primary/80 shadow" />

      <span className="absolute bottom-3 left-3 rounded-md border border-lp-border bg-lp-surface/95 px-2 py-1 text-xs font-medium text-lp-muted">
        Illustrative map
      </span>
      <span className="absolute bottom-3 right-3 rounded-md border border-lp-primary/40 bg-lp-surface/95 px-2 py-1 text-xs font-medium text-lp-primary">
        Approximate location
      </span>
    </div>

    {/* Selected observation + matching list */}
    <div className="space-y-2 border-t border-lp-border p-4">
      <p className="text-[15px] font-semibold text-lp-ink">
        Pollinator activity after rainfall
      </p>
      <p className="text-xs font-medium text-lp-muted">Matching observations</p>
      <ul className="space-y-1.5 text-sm text-lp-ink">
        <li className="rounded-lg border border-lp-border bg-lp-bg px-3 py-2">
          Morning foraging delay before the storm
        </li>
        <li className="rounded-lg border border-lp-border bg-lp-bg px-3 py-2">
          Comfrey bloom count, west hedge
        </li>
      </ul>
    </div>
  </div>
);

/** §6C: grounded-answer preview — answer / sources / uncertainty. */
export const AnswerPreview: React.FC = () => (
  <div className={`${PREVIEW_CARD} space-y-4`} aria-label="Example journal answer (sample data)">
    <div className="flex items-start gap-2.5">
      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-lp-muted" aria-hidden="true" />
      <p className="text-[15px] font-medium text-lp-ink">
        “What can my observations tell me about pollinator activity after rain?”
      </p>
    </div>

    <div className="rounded-lg border border-lp-border bg-lp-bg p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-lp-muted">Answer</p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-lp-ink">
        Your records suggest bumblebees resume foraging sooner after rainfall
        than honeybees, based on two observations from May.
      </p>
    </div>

    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-lp-muted">
        Example sources
      </p>
      <ul className="mt-1.5 space-y-1.5 text-sm">
        <li className="flex items-start gap-2 text-lp-ink">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-lp-muted" aria-hidden="true" />
          <span>
            <span className="font-medium">Pollinator activity after rainfall</span>
            <span className="text-lp-muted"> · 14 May 2026</span>
          </span>
        </li>
        <li className="flex items-start gap-2 text-lp-ink">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-lp-muted" aria-hidden="true" />
          <span>
            <span className="font-medium">Morning foraging delay before the storm</span>
            <span className="text-lp-muted"> · 12 May 2026</span>
          </span>
        </li>
      </ul>
    </div>

    <div className="rounded-lg border border-lp-uncertainty-text/30 bg-lp-uncertainty-bg p-3">
      <p className="flex items-start gap-2 text-sm leading-relaxed text-lp-uncertainty-text">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">What remains uncertain:</strong> two
          records from one site cannot rule out weather, season, or species
          differences.
        </span>
      </p>
    </div>
  </div>
);
