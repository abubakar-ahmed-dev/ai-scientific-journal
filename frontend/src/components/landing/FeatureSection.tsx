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
    <section id={id} className="lp scroll-mt-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Text column */}
        <div className={`space-y-5 ${textFirst ? "" : "lg:order-2"}`}>
          <p className="text-sm font-semibold tracking-wide text-lp-primary">{label}</p>
          <h2 className="text-2xl font-semibold leading-snug text-lp-heading sm:text-3xl">
            {heading}
          </h2>
          <p className="max-w-xl leading-relaxed text-lp-muted">{description}</p>
          <ul className="space-y-2.5">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-[15px] text-lp-ink">
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-lp-primary"
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
