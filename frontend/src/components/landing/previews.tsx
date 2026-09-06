import React from "react";
import {
  Paperclip,
  MapPin,
  Sparkles,
  AlertTriangle,
  BookOpen,
  HelpCircle,
  Thermometer,
  Droplets,
  Bug,
  ChevronRight,
  Layers,
  Compass,
} from "lucide-react";

/*
 * Static, read-only product previews for the public landing page
 * (homepage guidelines §3, §6). All content is clearly labeled illustrative
 * sample data — no fake focusable controls, no live AI/map/network calls.
 * Designed as product artifacts (journal cards), not as UI forms.
 */

const PREVIEW_CARD =
  "rounded-2xl border border-lp-border bg-lp-surface text-left shadow-xl shadow-lp-primary/10";

/** Journal-style meta row (date · location chip). */
const MetaChip: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-lp-primary-soft px-3 py-1 text-xs font-semibold text-lp-heading">
    {icon}
    {children}
  </span>
);

/* ------------------------------------------------------------------ */
/* Sample observation card — journal entry, not a form                 */
/* ------------------------------------------------------------------ */

export const ObservationPreview: React.FC<{ className?: string }> = ({ className = "" }) => (
  <article
    className={`${PREVIEW_CARD} overflow-hidden ${className}`}
    aria-label="Example observation (sample data)"
  >
    {/* Header band — species-plaque style */}
    <div className="flex items-center justify-between gap-3 border-b border-lp-border bg-gradient-to-r from-lp-primary-soft/70 to-transparent px-5 py-3">
      <span className="text-xs font-bold uppercase tracking-widest text-lp-primary">
        Field entry · Sample
      </span>
      <span className="flex -space-x-1" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-lp-primary" />
        <span className="h-2.5 w-2.5 rounded-full bg-lp-ai/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-lp-border" />
      </span>
    </div>

    <div className="space-y-4 px-5 py-5">
      <div>
        <h4 className="font-display text-xl font-bold text-lp-heading">
          Pollinator Activity After Rainfall
        </h4>
        <p className="mt-2 flex flex-wrap gap-2">
          <MetaChip icon={<BookOpen className="h-3.5 w-3.5" aria-hidden="true" />}>
            14 May 2026
          </MetaChip>
          <MetaChip icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />}>
            Approximate · Meadow edge
          </MetaChip>
        </p>
      </div>

      <p className="text-[15px] leading-relaxed text-lp-ink">
        Light rain ended around 09:40. Bumblebees resumed foraging on comfrey
        within minutes; honeybees returned noticeably later.
      </p>

      {/* Measurement tiles — data at a glance, not table rows */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-lp-muted">
          Measurements
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2.5">
          {[
            { icon: Thermometer, label: "Air temp", value: "17.5", unit: "°C" },
            { icon: Droplets, label: "Humidity", value: "86", unit: "%" },
            { icon: Bug, label: "Bee count", value: "12", unit: "ind." },
          ].map(({ icon: Icon, label, value, unit }) => (
            <div
              key={label}
              className="rounded-xl border border-lp-border bg-lp-bg px-3 py-2.5"
            >
              <Icon className="h-4 w-4 text-lp-primary" aria-hidden="true" />
              <p className="mt-1.5 font-display text-lg font-bold leading-none text-lp-ink">
                {value}
                <span className="ml-1 text-[11px] font-semibold text-lp-muted">{unit}</span>
              </p>
              <p className="mt-1 text-[11px] font-medium text-lp-muted">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </article>
);

/* ------------------------------------------------------------------ */
/* Gemini analysis card — AI interpretation, not a form                */
/* ------------------------------------------------------------------ */

export const AnalysisPreview: React.FC<{ className?: string }> = ({ className = "" }) => (
  <article
    className={`${PREVIEW_CARD} overflow-hidden ${className}`}
    aria-label="Example Gemini analysis (sample data)"
  >
    {/* AI header band */}
    <div className="flex items-center justify-between gap-3 border-b border-lp-ai/20 bg-gradient-to-r from-lp-ai-surface to-transparent px-5 py-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-lp-ai-text">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Gemini Analysis · Sample
      </span>
      <span className="rounded-full border border-lp-ai/30 bg-lp-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lp-ai-text">
        AI
      </span>
    </div>

    <div className="space-y-4 px-5 py-5">
      <p className="text-[15px] leading-relaxed text-lp-ink">
        Bee activity resumed quickly after the rain stopped, with bumblebees
        returning before honeybees in this record.
      </p>

      {/* Uncertainty statement */}
      <div className="rounded-xl border border-lp-uncertainty-text/25 bg-lp-uncertainty-bg/70 px-4 py-3">
        <p className="flex items-start gap-2.5 text-sm leading-relaxed text-lp-uncertainty-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-bold">Uncertainty:</strong> one observation
            cannot establish a pattern — more comparable records are needed.
          </span>
        </p>
      </div>

      {/* Supporting evidence rows */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-lp-muted">
          Supporting Observations
        </p>
        <div className="mt-2 space-y-1.5">
          {[
            "Pollinator Activity After Rainfall",
            "Morning Foraging Delay Before the Storm",
          ].map((title) => (
            <p
              key={title}
              className="flex items-center justify-between gap-2 rounded-lg border border-lp-border bg-lp-bg px-3 py-2 text-sm font-semibold text-lp-link"
            >
              {title}
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-lp-muted" aria-hidden="true" />
            </p>
          ))}
        </div>
      </div>

      <p className="border-t border-lp-border pt-3 text-xs font-medium text-lp-muted">
        Gemini · Example sources · Generation details
      </p>
    </div>
  </article>
);

/* ------------------------------------------------------------------ */
/* §6A: structured observation — layered journal card stack            */
/* ------------------------------------------------------------------ */

export const StructuredEditorPreview: React.FC = () => (
  <div className="relative" aria-label="Example observation record (sample data)">
    {/* Back cards for depth */}
    <div
      aria-hidden="true"
      className="absolute inset-x-6 -top-3 h-full rounded-2xl border border-lp-border bg-lp-surface/70"
    />
    <div
      aria-hidden="true"
      className="absolute inset-x-3 -top-1.5 h-full rounded-2xl border border-lp-border bg-lp-surface/90"
    />

    <div className={`${PREVIEW_CARD} relative space-y-5 p-6`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-xl font-bold text-lp-heading">
            Moss Regrowth on North Wall
          </h4>
          <p className="mt-1 text-sm font-medium text-lp-muted">
            Cleared ivy in March; moss returned on shaded bricks within six weeks.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-lp-primary-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-lp-heading">
          Observed · 2 Jun
        </span>
      </div>

      {/* Hypothesis — quoted, styled as margin note */}
      <figure className="rounded-xl border-l-4 border-lp-ai bg-lp-ai-surface/50 px-4 py-3">
        <blockquote className="text-[15px] italic leading-relaxed text-lp-ink">
          “Shaded brick retains enough moisture for regrowth without watering.”
        </blockquote>
        <figcaption className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-lp-ai-text">
          Hypothesis · Optional
        </figcaption>
      </figure>

      {/* Facts as chips, not inputs */}
      <div className="flex flex-wrap gap-2">
        {[
          { icon: Layers, text: "Unfiled — no project needed" },
          { icon: Compass, text: "Location hidden" },
          { icon: Paperclip, text: "1 evidence photo" },
        ].map(({ icon: Icon, text }) => (
          <span
            key={text}
            className="inline-flex items-center gap-1.5 rounded-full border border-lp-border bg-lp-bg px-3 py-1.5 text-xs font-semibold text-lp-muted"
          >
            <Icon className="h-3.5 w-3.5 text-lp-primary" aria-hidden="true" />
            {text}
          </span>
        ))}
      </div>

      <p className="border-t border-lp-border pt-3 text-xs text-lp-muted">
        Scientific fields are optional — a note is enough to start.
      </p>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* §6B: restrained schematic map                                       */
/* ------------------------------------------------------------------ */

export const MapPreview: React.FC = () => (
  <div className={`${PREVIEW_CARD} overflow-hidden p-0`} aria-label="Illustrative map (sample data)">
    <div
      className="relative h-64 bg-lp-primary-soft sm:h-72"
      role="img"
      aria-label="Illustrative map showing three observation pins and one approximate-location area"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(18,61,54,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(18,61,54,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 400 280" preserveAspectRatio="none">
        <path d="M-10 210 C 90 190, 150 120, 410 90" fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" />
        <path d="M120 290 C 140 200, 240 170, 300 20" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />
      </svg>

      {/* Approximate-location area (no exact coordinates shown) */}
      <span
        aria-hidden="true"
        className="absolute left-[30%] top-[38%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-lp-primary/70 bg-lp-primary/10"
      />
      <span
        aria-hidden="true"
        className="absolute left-[30%] top-[38%] flex h-7 w-7 -translate-x-1/2 -translate-y-[calc(100%+2px)] items-center justify-center"
      >
        <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-lp-primary shadow" />
      </span>
      <span aria-hidden="true" className="absolute left-[62%] top-[62%] h-3 w-3 rounded-full border-2 border-white bg-lp-primary/80 shadow" />
      <span aria-hidden="true" className="absolute left-[76%] top-[30%] h-3 w-3 rounded-full border-2 border-white bg-lp-primary/80 shadow" />

      <span className="absolute bottom-3 left-3 rounded-md border border-lp-border bg-lp-surface/95 px-2 py-1 text-xs font-semibold text-lp-muted">
        Illustrative map
      </span>
      <span className="absolute bottom-3 right-3 rounded-md border border-lp-primary/40 bg-lp-surface/95 px-2 py-1 text-xs font-bold text-lp-primary">
        Approximate Location
      </span>
    </div>

    {/* Selected observation + matching list */}
    <div className="space-y-2.5 border-t border-lp-border p-5">
      <p className="font-display text-lg font-bold text-lp-ink">
        Pollinator Activity After Rainfall
      </p>
      <p className="text-[11px] font-bold uppercase tracking-widest text-lp-muted">
        Matching Observations
      </p>
      <div className="space-y-1.5">
        {["Morning Foraging Delay Before the Storm", "Comfrey Bloom Count, West Hedge"].map(
          (title) => (
            <p
              key={title}
              className="flex items-center justify-between gap-2 rounded-lg border border-lp-border bg-lp-bg px-3 py-2 text-sm font-semibold text-lp-ink"
            >
              {title}
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-lp-muted" aria-hidden="true" />
            </p>
          )
        )}
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* §6C: grounded-answer preview                                        */
/* ------------------------------------------------------------------ */

export const AnswerPreview: React.FC = () => (
  <div className={`${PREVIEW_CARD} space-y-4 p-6`} aria-label="Example journal answer (sample data)">
    <p className="flex items-start gap-2.5 font-display text-lg font-bold leading-snug text-lp-heading">
      <HelpCircle className="mt-1 h-5 w-5 shrink-0 text-lp-primary" aria-hidden="true" />
      “What can my observations tell me about pollinator activity after rain?”
    </p>

    <div className="rounded-xl bg-lp-primary-soft/60 px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-lp-heading">Answer</p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-lp-ink">
        Your records suggest bumblebees resume foraging sooner after rainfall
        than honeybees, based on two observations from May.
      </p>
    </div>

    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-lp-muted">
        Example Sources
      </p>
      <div className="mt-2 space-y-1.5">
        {[
          { title: "Pollinator Activity After Rainfall", date: "14 May 2026" },
          { title: "Morning Foraging Delay Before the Storm", date: "12 May 2026" },
        ].map(({ title, date }) => (
          <p
            key={title}
            className="flex items-center justify-between gap-3 rounded-lg border border-lp-border bg-lp-bg px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2 font-semibold text-lp-ink">
              <BookOpen className="h-4 w-4 shrink-0 text-lp-primary" aria-hidden="true" />
              {title}
            </span>
            <span className="shrink-0 text-xs font-medium text-lp-muted">{date}</span>
          </p>
        ))}
      </div>
    </div>

    <div className="rounded-xl border border-lp-uncertainty-text/25 bg-lp-uncertainty-bg/70 px-4 py-3">
      <p className="flex items-start gap-2.5 text-sm leading-relaxed text-lp-uncertainty-text">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-bold">What Remains Uncertain:</strong> two
          records from one site cannot rule out weather, season, or species
          differences.
        </span>
      </p>
    </div>
  </div>
);
