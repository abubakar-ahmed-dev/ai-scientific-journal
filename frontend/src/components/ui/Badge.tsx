import React from "react";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "emerald"
  | "amber"
  | "purple"
  | "blue"
  | "sky";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-600 border-app-border",
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
};

interface BadgeProps {
  variant?: BadgeVariant;
  /** sm for dense meta rows, md for card-header pills. */
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}

/** Shared status/meta pill so list cards speak one visual language instead of
 * each page hand-rolling `px-2 py-0.5 bg-*` class strings. */
export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  size = "md",
  className = "",
  children,
}) => (
  <span
    className={`inline-flex max-w-full items-center gap-1 rounded-full border font-medium ${
      size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs"
    } ${VARIANTS[variant]} ${className}`}
  >
    {children}
  </span>
);
