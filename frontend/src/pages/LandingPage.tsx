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
    title: "Add evidence",
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
const DotGrid: React.FC<{ className: string }> = ({ className }) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute ${className}`}
    style={{
      backgroundImage:
        "radial-gradient(rgba(15,118,110,0.28) 1.6px, transparent 1.6px)",
      backgroundSize: "20px 20px",
      maskImage: "radial-gradient(ellipse at center, black 25%, transparent 72%)",
      WebkitMaskImage:
        "radial-gradient(ellipse at center, black 25%, transparent 72%)",
    }}
  />
);

/** Soft radial teal/violet glow. */
const Glow: React.FC<{ className: string }> = ({ className }) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute rounded-full ${className}`}
  />
);

/** Broken "field notes" line motif — thin horizontal rule with a gap. */
const BrokenLine: React.FC<{ className: string }> = ({ className }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 220 8"
    fill="none"
    className={`pointer-events-none absolute ${className}`}
  >
    <path d="M0 4 H120" stroke="#0F766E" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
    <path d="M132 4 H172" stroke="#0F766E" strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" />
    <path d="M184 4 H220" stroke="#6D5BD0" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

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
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-lp-primary px-8 py-4 text-lg font-bold text-white shadow-md shadow-lp-primary/20 transition hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {loading ? "Signing in…" : "Start your journal"}
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
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-lp-primary text-white"
            >
              <NotebookPen className="h-5 w-5" />
            </span>
            <span className="text-xl font-bold text-lp-heading">AI Scientific Journal</span>
          </div>

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
                className="rounded-lg bg-lp-primary px-5 py-2.5 text-[15px] font-bold text-white transition hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2 disabled:opacity-60"
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
            className="rounded-md p-2 text-lp-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary md:hidden"
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
                  className="w-full rounded-lg bg-lp-primary px-4 py-3 text-center text-base font-bold text-white hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary disabled:opacity-60"
                >
                  Sign in with Google
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main-content">
        {/* Hero — single centered column with decorative background */}
        <section className="relative overflow-hidden border-b border-lp-border">
          {/* Background: corner glows, fading dot grids, broken lines */}
          <Glow className="-left-40 -top-40 h-[480px] w-[480px] bg-[radial-gradient(circle,rgba(15,118,110,0.14),transparent_65%)]" />
          <Glow className="-right-48 top-24 h-[560px] w-[560px] bg-[radial-gradient(circle,rgba(109,91,208,0.12),transparent_65%)]" />
          <DotGrid className="left-8 top-16 h-64 w-64 sm:h-80 sm:w-80" />
          <DotGrid className="bottom-10 right-8 h-64 w-64 sm:h-80 sm:w-80" />
          <BrokenLine className="left-[6%] top-40 w-40 rotate-[-8deg] sm:w-52" />
          <BrokenLine className="bottom-32 left-[10%] hidden w-44 rotate-[5deg] lg:block" />
          <BrokenLine className="right-[5%] top-28 hidden w-48 rotate-[6deg] lg:block" />
          {/* Floating outline icons (decorative) */}
          <FileText
            aria-hidden="true"
            className="pointer-events-none absolute left-[7%] top-[46%] hidden h-10 w-10 -rotate-12 text-lp-primary/15 lg:block"
            strokeWidth={1.5}
          />
          <MapPin
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[22%] right-[6%] hidden h-12 w-12 rotate-12 text-lp-primary/15 lg:block"
            strokeWidth={1.5}
          />
          <Sparkles
            aria-hidden="true"
            className="pointer-events-none absolute right-[12%] top-[14%] hidden h-9 w-9 text-lp-ai/20 lg:block"
            strokeWidth={1.5}
          />

          <div className="relative mx-auto max-w-4xl px-5 pb-20 pt-16 text-center sm:px-8 sm:pt-20 lg:pb-24 lg:pt-24">
            <p className="text-base font-bold uppercase tracking-[0.18em] text-lp-primary">
              Your personal research notebook
            </p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight text-lp-heading sm:text-6xl lg:text-[4.25rem]">
              Turn observations into{" "}
              <span className="relative inline-block text-lp-primary">
                evidence
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
              <span>-backed</span> research.
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
                See how it works
              </a>
            </div>
            <p className="mt-6 text-base font-medium text-lp-muted">
              Your original observations stay yours. AI analysis stays separate.
            </p>
          </div>

          {/* Product previews side by side below the message — no overlap */}
          <div className="relative mx-auto grid max-w-5xl grid-cols-1 items-start gap-6 px-5 pb-16 sm:px-8 md:grid-cols-2 md:gap-8 lg:pb-20">
            <ObservationPreview className="shadow-xl shadow-lp-primary/10" />
            <AnalysisPreview className="shadow-xl shadow-lp-primary/10 md:mt-10" />
          </div>
        </section>

        {/* Compact trust strip */}
        <section aria-label="What the journal guarantees" className="relative border-b border-lp-border">
          <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-x-8 gap-y-5 px-5 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            {TRUST_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] font-medium text-lp-ink">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lp-primary-soft">
                  <Icon className="h-5 w-5 text-lp-primary" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        {/* Workflow */}
        <section id="how-it-works" className="relative scroll-mt-20 overflow-hidden border-b border-lp-border">
          <DotGrid className="right-0 top-0 h-72 w-72 opacity-70" />
          <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="mx-auto max-w-2xl space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-lp-heading sm:text-4xl">
                From field note to next investigation.
              </h2>
              <p className="text-xl text-lp-muted">
                Record what happened, review what it might mean, and choose your
                next step.
              </p>
            </div>

            <ol className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {WORKFLOW_STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="relative flex flex-col items-center space-y-4 text-center">
                  {/* Solid icon tile + number badge */}
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-lp-primary text-white shadow-md shadow-lp-primary/25"
                    >
                      <Icon className="h-8 w-8" aria-hidden="true" />
                    </span>
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-lp-bg bg-lp-heading text-xs font-bold text-white"
                    >
                      {i + 1}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-lg font-bold text-lp-ink">{title}</p>
                    <p className="text-[15px] leading-relaxed text-lp-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mx-auto mt-14 max-w-2xl rounded-xl border border-lp-border bg-lp-surface px-5 py-4 text-center text-[15px] font-medium text-lp-muted">
              Gemini suggests investigations; you create a task by accepting one.
              Suggestions are never turned into tasks on their own.
            </p>
          </div>
        </section>

        {/* Feature showcase */}
        <div
          id="features"
          className="relative scroll-mt-20 space-y-24 overflow-hidden border-b border-lp-border bg-lp-surface py-24 lg:space-y-32 lg:py-32"
        >
          <Glow className="left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(15,118,110,0.07),transparent_65%)]" />
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-lp-heading sm:text-4xl">
                Built for real research work.
              </h2>
              <p className="text-xl text-lp-muted">
                Three capabilities, each honest about what it shows.
              </p>
            </div>
          </div>

          <div className="relative mx-auto max-w-6xl space-y-24 px-5 sm:px-8 lg:space-y-32">
            <FeatureSection
              index={0}
              label="01 · Structured observations"
              heading="Capture the details that matter."
              description="Start with a simple note. Add scientific detail when your research needs it."
              points={[
                "Projects, hypotheses, measurements, and location are all optional.",
                "Measurements stay structured, so patterns stay comparable later.",
              ]}
              preview={<StructuredEditorPreview />}
            />

            <FeatureSection
              index={1}
              label="02 · Research map"
              heading="See your research in context."
              description="Explore where observations happened while controlling how precisely locations appear."
              points={[
                "Approximate locations render as an area, never exact coordinates.",
                "Hidden locations never appear as pins.",
              ]}
              preview={<MapPreview />}
            />

            <FeatureSection
              index={2}
              label="03 · Ask My Journal"
              heading="Ask questions. Follow the evidence."
              description="Explore your own observations with answers that show their sources and limitations."
              points={[
                "Answers cite the observations they rely on.",
                "Insufficient evidence is stated plainly, never papered over.",
              ]}
              preview={<AnswerPreview />}
            />
          </div>
        </div>

        {/* Scientific integrity + privacy */}
        <section id="privacy" className="relative scroll-mt-20 overflow-hidden border-b border-lp-border">
          <DotGrid className="bottom-0 left-0 h-72 w-72 opacity-60" />
          <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-14 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-28">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight text-lp-heading sm:text-4xl">
                Your records are the source of truth.
              </h2>
              <ul className="space-y-4">
                {[
                  "User-authored observations remain separate from AI interpretations.",
                  "AI output is clearly labeled.",
                  "Supporting observations and uncertainty are visible.",
                  "Suggested tasks require user acceptance.",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-lg text-lp-ink">
                    <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-lp-primary" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
              {/* Provenance example — sample values, labeled as such */}
              <p className="rounded-lg border border-lp-ai/30 bg-lp-ai-surface/40 px-4 py-2.5 text-sm text-lp-muted">
                <span className="font-semibold text-lp-ai-text">Gemini analysis</span>
                {" · "}Example sources{" · "}Generation details
              </p>
            </div>

            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-lp-heading">Private by design.</h3>
              <ul className="space-y-4">
                {[
                  "Google sign-in protects access.",
                  "Each account's records are isolated.",
                  "Location precision is controlled by the user.",
                  "Server-side secrets are not exposed in the browser.",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-lg text-lp-ink">
                    <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-lp-primary" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>

              <details className="group rounded-xl border border-lp-border bg-lp-surface">
                <summary className="cursor-pointer select-none px-5 py-4 text-base font-bold text-lp-ink marker:content-none focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary [&::-webkit-details-marker]:hidden">
                  How privacy works
                </summary>
                <div className="border-t border-lp-border px-5 py-4 text-[15px] leading-relaxed text-lp-muted">
                  Your journal lives under your account in Firestore, and access
                  is enforced server-side on every request — the interface alone
                  never decides who can read a record. Evidence media is stored
                  privately and reached only through short-lived authorized
                  links. Logs carry operational metadata, never journal content.
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden bg-lp-primary-soft">
          <DotGrid className="left-10 top-6 h-48 w-48 opacity-80" />
          <DotGrid className="bottom-6 right-10 h-48 w-48 opacity-80" />
          <div className="relative mx-auto max-w-6xl px-5 py-20 text-center sm:px-8 lg:py-28">
            <h2 className="text-3xl font-bold tracking-tight text-lp-heading sm:text-4xl">
              Start with one observation.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-xl text-lp-muted">
              Build a research journal you can return to, question, and grow.
            </p>
            <div className="mt-9">{primaryCta}</div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-lp-border bg-lp-bg">
        <div className="mx-auto max-w-6xl space-y-1.5 px-5 py-10 text-center text-[15px] text-lp-muted sm:px-8">
          <p className="text-base font-bold text-lp-heading">AI Scientific Journal</p>
          <p>Built with Google Cloud Run, Firebase, and Gemini.</p>
        </div>
      </footer>
    </div>
  );
}
