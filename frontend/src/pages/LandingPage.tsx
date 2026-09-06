import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  NotebookPen,
  Menu,
  X,
  ShieldCheck,
  Lock,
  MapPin,
  FileText,
  Search,
  CheckCircle2,
  ArrowRight,
  Activity,
  Camera,
  ListPlus,
  Sparkles,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../lib/firebase/authContext";
import { FeatureSection } from "../components/landing/FeatureSection";
import {
  ObservationPreview,
  AnalysisPreview,
  StructuredEditorPreview,
  MapPreview,
  AnswerPreview,
} from "../components/landing/previews";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#privacy", label: "Privacy" },
];

const TRUST_POINTS = [
  { icon: FileText, text: "Original records remain unchanged." },
  { icon: Search, text: "Journal answers show supporting observations." },
  { icon: MapPin, text: "You choose location precision." },
  { icon: Lock, text: "Your account's records are private." },
];

const WORKFLOW_STEPS = [
  {
    icon: FileText,
    title: "Record",
    body: "Capture what you observed.",
  },
  {
    icon: Camera,
    title: "Add Evidence",
    body: "Include measurements, media, or location.",
  },
  {
    icon: Activity,
    title: "Analyze",
    body: "Review Gemini's interpretation and uncertainty.",
  },
  {
    icon: ListPlus,
    title: "Investigate",
    body: "Choose whether to add a suggested research task.",
  },
];

/* Decorative background layers (aria-hidden, pointer-events-none, never
   behind long reading text — homepage guidelines §1: faint patterns only). */

/** Fading dot grid anchored to a corner. */
const DotGrid: React.FC<{ className: string; tone?: "teal" | "violet" }> = ({
  className,
  tone = "teal",
}) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute ${className}`}
    style={{
      backgroundImage: `radial-gradient(${
        tone === "teal" ? "rgba(15,118,110,0.28)" : "rgba(109,91,208,0.24)"
      } 1.6px, transparent 1.6px)`,
      backgroundSize: "20px 20px",
      maskImage: "radial-gradient(ellipse at center, black 25%, transparent 72%)",
      WebkitMaskImage:
        "radial-gradient(ellipse at center, black 25%, transparent 72%)",
    }}
  />
);

/** Soft radial glow. */
const Glow: React.FC<{ className: string }> = ({ className }) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute rounded-full ${className}`}
  />
);

/** Diagonal crosshatch band, very faint. */
const Crosshatch: React.FC<{ className: string }> = ({ className }) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute ${className}`}
    style={{
      backgroundImage:
        "repeating-linear-gradient(45deg, rgba(18,61,54,0.05) 0 1px, transparent 1px 12px)",
      maskImage: "linear-gradient(to bottom, black, transparent)",
      WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
    }}
  />
);

/** Gradient hairline used as a section break. */
const SectionBreak: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div
    aria-hidden="true"
    className={`mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-lp-border to-transparent ${className}`}
  />
);

/** Mid-page CTA as a styled arrow link (no button weight). */
const ArrowCta: React.FC<{
  href?: string;
  to?: string;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ href, to, onClick, children }) => {
  const className =
    "cursor-pointer group inline-flex items-center gap-2 text-lg font-bold text-lp-primary transition-colors hover:text-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2 rounded-md";
  const inner = (
    <>
      <span className="border-b-2 border-lp-primary/30 pb-0.5 transition-colors group-hover:border-lp-primary-hover">
        {children}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1"
      />
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <a
      href={href}
      onClick={
        onClick
          ? (e) => {
              e.preventDefault();
              onClick();
            }
          : undefined
      }
      className={className}
    >
      {inner}
    </a>
  );
};

/**
 * Public landing page ("Modern Field Research Notebook", homepage guidelines).
 * Scoped lp- tokens keep the authenticated app untouched. Static previews are
 * labeled sample data; no live AI, map, or network calls.
 */
export default function LandingPage() {
  const { currentUser, loading, signInWithGoogle } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap + Escape for the mobile menu (same pattern as the app drawer).
  useEffect(() => {
    if (!menuOpen) return;
    const focusable = menuPanelRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
        return;
      }
      if (e.key === "Tab" && menuPanelRef.current && focusable && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  const primaryCta = currentUser ? (
    <Link
      to="/dashboard"
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-lp-primary px-8 py-4 text-lg font-bold text-white shadow-md shadow-lp-primary/20 transition hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
    >
      Open Dashboard
      <ArrowRight className="h-5 w-5" aria-hidden="true" />
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => signInWithGoogle()}
      disabled={loading}
      className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-lp-primary px-8 py-4 text-lg font-bold text-white shadow-md shadow-lp-primary/20 transition hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {loading ? "Signing in…" : "Start Your Journal"}
    </button>
  );

  return (
    <div className="lp min-h-screen bg-lp-bg text-lp-ink">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-lp-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-lp-border bg-lp-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            to={currentUser ? "/dashboard" : "/"}
            aria-label="AI Scientific Journal — home"
            className="flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-lp-primary text-white"
            >
              <NotebookPen className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-bold text-lp-heading">
              AI Scientific Journal
            </span>
          </Link>

          <nav aria-label="Site" className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[15px] font-semibold text-lp-muted transition hover:text-lp-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
              >
                {link.label}
              </a>
            ))}
            {currentUser ? (
              <Link
                to="/dashboard"
                className="rounded-lg bg-lp-primary px-5 py-2.5 text-[15px] font-bold text-white transition hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
              >
                Open Dashboard
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                disabled={loading}
                className="cursor-pointer rounded-lg bg-lp-primary px-5 py-2.5 text-[15px] font-bold text-white transition hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2 disabled:opacity-60"
              >
                Sign in with Google
              </button>
            )}
          </nav>

          {/* Mobile menu trigger */}
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="cursor-pointer rounded-md p-2 text-lp-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary md:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu panel */}
        {menuOpen && (
          <div
            ref={menuPanelRef}
            id="landing-mobile-menu"
            aria-label="Mobile menu"
            className="border-b border-lp-border bg-lp-surface px-5 pb-4 pt-2 md:hidden"
          >
            <nav aria-label="Site sections" className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-2 py-3 text-base font-semibold text-lp-ink hover:bg-lp-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-2 border-t border-lp-border pt-3">
              {currentUser ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg bg-lp-primary px-4 py-3 text-center text-base font-bold text-white hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary"
                >
                  Open Dashboard
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    signInWithGoogle();
                  }}
                  disabled={loading}
                  className="cursor-pointer w-full rounded-lg bg-lp-primary px-4 py-3 text-center text-base font-bold text-white hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary disabled:opacity-60"
                >
                  Sign in with Google
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main-content">
        {/* Hero — single centered column, no product cards */}
        <section className="relative overflow-hidden">
          <Glow className="-left-40 -top-40 h-[480px] w-[480px] bg-[radial-gradient(circle,rgba(15,118,110,0.14),transparent_65%)]" />
          <Glow className="-right-48 top-24 h-[560px] w-[560px] bg-[radial-gradient(circle,rgba(109,91,208,0.12),transparent_65%)]" />
          <DotGrid className="left-8 top-16 h-64 w-64 sm:h-80 sm:w-80" />
          <DotGrid tone="violet" className="bottom-10 right-8 h-64 w-64 sm:h-80 sm:w-80" />
          <FileText
            aria-hidden="true"
            className="pointer-events-none absolute left-[7%] top-[42%] hidden h-10 w-10 -rotate-12 text-lp-primary/15 lg:block"
            strokeWidth={1.5}
          />
          <MapPin
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[18%] right-[6%] hidden h-12 w-12 rotate-12 text-lp-primary/15 lg:block"
            strokeWidth={1.5}
          />
          <Sparkles
            aria-hidden="true"
            className="pointer-events-none absolute right-[12%] top-[14%] hidden h-9 w-9 text-lp-ai/20 lg:block"
            strokeWidth={1.5}
          />

          <div className="relative mx-auto max-w-4xl px-5 pb-20 pt-16 text-center sm:px-8 sm:pt-20 lg:pb-24 lg:pt-24">
            <p className="text-base font-bold uppercase tracking-[0.18em] text-lp-primary">
              Your Personal Research Notebook
            </p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.15] tracking-tight text-lp-heading sm:text-6xl lg:text-[4.25rem]">
              Turn Observations Into{" "}
              <span className="relative inline-block text-lp-primary">
                Evidence
                <svg
                  aria-hidden="true"
                  viewBox="0 0 220 12"
                  fill="none"
                  preserveAspectRatio="none"
                  className="absolute -bottom-2 left-0 h-3 w-full"
                >
                  <path
                    d="M3 9 C 60 2, 150 2, 217 7"
                    stroke="#0F766E"
                    strokeOpacity="0.45"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span>-Backed</span> Research.
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-xl leading-relaxed text-lp-muted">
              Capture notes, measurements, and location. Explore your
              observations with Gemini, review supporting evidence, and decide
              what to investigate next.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {primaryCta}
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-lp-border bg-lp-surface px-8 py-4 text-lg font-bold text-lp-ink transition hover:border-lp-primary/50 hover:text-lp-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
              >
                See How It Works
              </a>
            </div>
            <p className="mt-6 text-base font-medium text-lp-muted">
              Your original observations stay yours. AI analysis stays separate.
            </p>
          </div>
        </section>

        <SectionBreak />

        {/* Compact trust strip */}
        <section aria-label="What the journal guarantees" className="relative overflow-hidden py-14">
          <Crosshatch className="inset-x-0 top-0 h-20" />
          <ul className="relative mx-auto grid max-w-6xl grid-cols-1 gap-x-8 gap-y-6 px-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            {TRUST_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3.5 text-[15px] font-semibold text-lp-ink">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lp-primary-soft">
                  <Icon className="h-5.5 w-5.5 text-lp-primary" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        {/* Workflow */}
        <section
          id="how-it-works"
          className="relative scroll-mt-20 overflow-hidden border-y border-lp-border bg-lp-surface"
        >
          <DotGrid className="right-0 top-0 h-72 w-72 opacity-70" />
          <Glow className="left-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 bg-[radial-gradient(circle,rgba(15,118,110,0.06),transparent_65%)]" />
          <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="mx-auto max-w-2xl space-y-4 text-center">
              <p className="inline-flex items-center gap-2.5 text-sm font-bold uppercase tracking-[0.16em] text-lp-primary">
                <span aria-hidden="true" className="h-px w-8 bg-lp-primary/50" />
                How It Works
                <span aria-hidden="true" className="h-px w-8 bg-lp-primary/50" />
              </p>
              <h2 className="text-4xl font-bold leading-[1.15] tracking-tight text-lp-heading sm:text-5xl">
                From Field Note to Next Investigation.
              </h2>
              <p className="text-xl text-lp-muted">
                Record what happened, review what it might mean, and choose your
                next step.
              </p>
            </div>

            <ol className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {WORKFLOW_STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="relative flex flex-col items-center space-y-5 text-center">
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-gradient-to-br from-lp-primary to-lp-primary-hover text-white shadow-lg shadow-lp-primary/25"
                    >
                      <Icon className="h-9 w-9" aria-hidden="true" />
                    </span>
                    <span
                      aria-hidden="true"
                      className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-lp-surface bg-lp-heading text-xs font-bold text-white"
                    >
                      {i + 1}
                    </span>
                    {/* connector (desktop) */}
                    {i < WORKFLOW_STEPS.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute left-full top-9 hidden h-0.5 w-[calc(100%-3.5rem)] translate-x-4 bg-gradient-to-r from-lp-primary/40 to-transparent lg:block"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-display text-xl font-bold text-lp-ink">{title}</p>
                    <p className="mx-auto max-w-[240px] text-[15px] leading-relaxed text-lp-muted">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Suggest → accept callout, styled as a provenance strip */}
        <section aria-label="How suggestions become tasks" className="relative overflow-hidden py-14">
          <div className="mx-auto max-w-4xl px-5 sm:px-8">
            <div className="relative overflow-hidden rounded-2xl bg-lp-heading px-7 py-6 shadow-lg shadow-lp-heading/20">
              <DotGrid tone="violet" className="-right-6 -top-6 h-40 w-40 opacity-50" />
              <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10"
                >
                  <ClipboardList className="h-6 w-6 text-white" />
                </span>
                <div className="flex-1 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lp-primary-soft">
                    You Stay in Control
                  </p>
                  <p className="text-lg font-semibold leading-snug text-white">
                    Gemini suggests investigations — you create a task by
                    accepting one.
                  </p>
                  <p className="text-sm text-white/70">
                    Suggestions are never turned into tasks on their own.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SectionBreak />

        {/* Inside the journal — sample previews */}
        <section
          id="features"
          className="relative scroll-mt-20 overflow-hidden bg-lp-surface py-20 lg:py-28"
        >
          <Glow className="left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(15,118,110,0.07),transparent_65%)]" />
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl space-y-4 text-center">
              <p className="inline-flex items-center gap-2.5 text-sm font-bold uppercase tracking-[0.16em] text-lp-primary">
                <span aria-hidden="true" className="h-px w-8 bg-lp-primary/50" />
                Inside the Journal
                <span aria-hidden="true" className="h-px w-8 bg-lp-primary/50" />
              </p>
              <h2 className="text-4xl font-bold leading-[1.15] tracking-tight text-lp-heading sm:text-5xl">
                Built for Real Research Work.
              </h2>
              <p className="text-xl text-lp-muted">
                Two examples from an actual workflow — sample data, honestly
                labeled.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 items-start gap-8 px-0 md:grid-cols-2 lg:gap-10">
              <ObservationPreview />
              <AnalysisPreview className="md:mt-12" />
            </div>

            <div className="mt-12 flex justify-center">
              <ArrowCta
                to={currentUser ? "/dashboard" : undefined}
                onClick={currentUser ? undefined : () => signInWithGoogle()}
                href={currentUser ? undefined : "#"}
              >
                {currentUser ? "Open Your Journal" : "Start Your Journal"}
              </ArrowCta>
            </div>
          </div>
        </section>

        {/* Feature showcase */}
        <div className="relative border-y border-lp-border py-20 lg:py-32">
          <DotGrid className="left-0 top-24 h-72 w-72 opacity-60" tone="violet" />
          <div className="relative mx-auto max-w-6xl space-y-24 px-5 sm:px-8 lg:space-y-32">
            <FeatureSection
              index={0}
              label="01 · Structured Observations"
              heading="Capture the Details That Matter."
              description="Start with a simple note. Add scientific detail when your research needs it."
              points={[
                { icon: CheckCircle2, text: "Projects, hypotheses, measurements, and location stay optional." },
                { icon: Activity, text: "Measurements stay structured, so patterns stay comparable later." },
              ]}
              preview={<StructuredEditorPreview />}
            />

            <FeatureSection
              index={1}
              label="02 · Research Map"
              heading="See Your Research in Context."
              description="Explore where observations happened while controlling how precisely locations appear."
              points={[
                { icon: MapPin, text: "Approximate locations render as an area, never exact coordinates." },
                { icon: ShieldCheck, text: "Hidden locations never appear as pins." },
              ]}
              preview={<MapPreview />}
            />

            <FeatureSection
              index={2}
              label="03 · Ask My Journal"
              heading="Ask Questions. Follow the Evidence."
              description="Explore your own observations with answers that show their sources and limitations."
              points={[
                { icon: Search, text: "Answers cite the observations they rely on." },
                { icon: CheckCircle2, text: "Insufficient evidence is stated plainly, never papered over." },
              ]}
              preview={<AnswerPreview />}
            />
          </div>
        </div>

        {/* Scientific integrity + privacy */}
        <section
          id="privacy"
          className="relative scroll-mt-20 overflow-hidden border-b border-lp-border bg-lp-surface"
        >
          <DotGrid className="bottom-0 left-0 h-72 w-72 opacity-60" />
          <Crosshatch className="inset-x-0 top-0 h-24 opacity-70" />
          <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="mx-auto max-w-2xl space-y-4 text-center">
              <p className="inline-flex items-center gap-2.5 text-sm font-bold uppercase tracking-[0.16em] text-lp-primary">
                <span aria-hidden="true" className="h-px w-8 bg-lp-primary/50" />
                Integrity &amp; Privacy
                <span aria-hidden="true" className="h-px w-8 bg-lp-primary/50" />
              </p>
              <h2 className="text-4xl font-bold leading-[1.15] tracking-tight text-lp-heading sm:text-5xl">
                Your Records Are the Source of Truth.
              </h2>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
              {/* Integrity card */}
              <div className="rounded-2xl border border-lp-border bg-lp-bg p-8">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-lp-primary-soft"
                >
                  <CheckCircle2 className="h-6 w-6 text-lp-primary" />
                </span>
                <h3 className="mt-5 font-display text-2xl font-bold text-lp-heading">
                  Integrity First
                </h3>
                <ul className="mt-5 space-y-4">
                  {[
                    "User-authored observations remain separate from AI interpretations.",
                    "AI output is clearly labeled.",
                    "Supporting observations and uncertainty are visible.",
                    "Suggested tasks require user acceptance.",
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-3 text-[16px] leading-relaxed text-lp-ink">
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-lp-primary" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 inline-flex items-center gap-2 rounded-lg border border-lp-ai/30 bg-lp-ai-surface/50 px-3.5 py-2 text-xs font-medium text-lp-muted">
                  <span className="font-bold text-lp-ai-text">Gemini Analysis</span>
                  {" · "}Example Sources{" · "}Generation Details
                </p>
              </div>

              {/* Privacy card with styled accordion */}
              <div className="rounded-2xl border border-lp-border bg-lp-bg p-8">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-lp-primary-soft"
                >
                  <ShieldCheck className="h-6 w-6 text-lp-primary" />
                </span>
                <h3 className="mt-5 font-display text-2xl font-bold text-lp-heading">
                  Private by Design
                </h3>
                <ul className="mt-5 space-y-4">
                  {[
                    "Google sign-in protects access.",
                    "Each account's records are isolated.",
                    "Location precision is controlled by the user.",
                    "Server-side secrets are not exposed in the browser.",
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-3 text-[16px] leading-relaxed text-lp-ink">
                      <Lock className="mt-1 h-5 w-5 shrink-0 text-lp-primary" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>

                <details className="group mt-6 rounded-xl border border-lp-border bg-lp-surface transition-colors open:border-lp-primary/40">
                  <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-bold text-lp-ink marker:content-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lp-primary [&::-webkit-details-marker]:hidden">
                    How Privacy Works
                    <ChevronDown
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 text-lp-muted transition-transform duration-200 group-open:rotate-180 group-open:text-lp-primary"
                    />
                  </summary>
                  <div className="border-t border-lp-border px-5 py-4 text-[15px] leading-relaxed text-lp-muted">
                    Your journal lives under your account in Firestore, and
                    access is enforced server-side on every request — the
                    interface alone never decides who can read a record.
                    Evidence media is stored privately and reached only through
                    short-lived authorized links. Logs carry operational
                    metadata, never journal content.
                  </div>
                </details>
              </div>
            </div>

            <div className="mt-12 flex justify-center">
              <ArrowCta href="#how-it-works">Review the Workflow</ArrowCta>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden bg-lp-primary-soft">
          <DotGrid className="left-10 top-6 h-48 w-48 opacity-80" />
          <DotGrid tone="violet" className="bottom-6 right-10 h-48 w-48 opacity-80" />
          <div className="relative mx-auto max-w-6xl px-5 py-20 text-center sm:px-8 lg:py-28">
            <h2 className="text-4xl font-bold leading-[1.15] tracking-tight text-lp-heading sm:text-5xl">
              Start With One Observation.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-xl text-lp-muted">
              Build a research journal you can return to, question, and grow.
            </p>
            <div className="mt-9">{primaryCta}</div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative overflow-hidden bg-lp-heading text-white">
        <Crosshatch className="inset-x-0 top-0 h-16 opacity-20" />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row md:items-start">
            {/* Brand */}
            <div className="flex flex-col items-center gap-3 text-center md:items-start md:text-left">
              <Link
                to={currentUser ? "/dashboard" : "/"}
                aria-label="AI Scientific Journal — home"
                className="flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"
                >
                  <NotebookPen className="h-5 w-5 text-white" />
                </span>
                <span className="font-display text-lg font-bold text-white">
                  AI Scientific Journal
                </span>
              </Link>
              <p className="max-w-xs text-sm leading-relaxed text-white/60">
                A calm, evidence-oriented research notebook for field and lab
                work.
              </p>
            </div>

            {/* Section links */}
            <nav aria-label="Footer" className="flex flex-col items-center gap-2.5 md:items-start">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                Explore
              </p>
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-white/80 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Attribution */}
            <div className="flex flex-col items-center gap-2.5 text-center md:items-start md:text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                Built With
              </p>
              <p className="text-sm font-medium text-white/80">
                Google Cloud Run · Firebase · Gemini
              </p>
              <p className="text-xs text-white/50">© 2026 AI Scientific Journal</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
