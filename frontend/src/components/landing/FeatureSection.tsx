import React from "react";

interface FeatureSectionProps {
  /** Small section label, e.g. "01 · Structured observations". */
  label: string;
  heading: string;
  description: string;
  /** At most two supporting points (guidelines §6). */
  points: string[];
  /** Illustrative product preview rendered beside the text. */
  preview: React.ReactNode;
  /** Even sections place text on the left; odd sections place it on the right. */
  index: number;
  id?: string;
}

/**
 * Reusable feature-showcase section (homepage guidelines §6): label, heading,
 * short paragraph, at most two supporting points, one illustrative preview.
 * Text and preview alternate placement on desktop; text always precedes the
 * preview in mobile reading order.
 */
export const FeatureSection: React.FC<FeatureSectionProps> = ({
  label,
  heading,
  description,
  points,
  preview,
  index,
  id,
}) => {
  const textFirst = index % 2 === 0;

  return (
    <section id={id} className="lp relative scroll-mt-24">
      {/* Fading dot grid drifting off the outer edge, away from reading text */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute top-8 hidden h-56 w-56 lg:block ${
          textFirst ? "-right-10" : "-left-10"
        }`}
        style={{
          backgroundImage:
            "radial-gradient(rgba(15,118,110,0.22) 1.5px, transparent 1.5px)",
          backgroundSize: "18px 18px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
        {/* Text column */}
        <div className={`space-y-6 ${textFirst ? "" : "lg:order-2"}`}>
          <p className="text-base font-bold uppercase tracking-wider text-lp-primary">
            {label}
          </p>
          <h3 className="text-3xl font-bold leading-tight tracking-tight text-lp-heading sm:text-4xl">
            {heading}
          </h3>
          <p className="max-w-xl text-lg leading-relaxed text-lp-muted">{description}</p>
          <ul className="space-y-3.5">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-lg text-lp-ink">
                <span
                  aria-hidden="true"
                  className="mt-[11px] h-2 w-2 shrink-0 rounded-full bg-lp-primary"
                />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Preview column */}
        <div className={textFirst ? "" : "lg:order-1"}>{preview}</div>
      </div>
    </section>
  );
};
