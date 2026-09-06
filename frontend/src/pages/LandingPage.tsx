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
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-lp-primary px-6 py-3 text-base font-semibold text-white shadow-xs transition hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
    >
      Open Dashboard
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => signInWithGoogle()}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-lp-primary px-6 py-3 text-base font-semibold text-white shadow-xs transition hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2 disabled:opacity-60"
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
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-lp-primary text-white"
            >
              <NotebookPen className="h-4.5 w-4.5" />
            </span>
            <span className="text-lg font-semibold text-lp-heading">AI Scientific Journal</span>
          </div>

          <nav aria-label="Site" className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-lp-muted transition hover:text-lp-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
              >
                {link.label}
              </a>
            ))}
            {currentUser ? (
              <Link
                to="/dashboard"
                className="rounded-lg bg-lp-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
              >
                Open Dashboard
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                disabled={loading}
                className="rounded-lg bg-lp-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2 disabled:opacity-60"
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
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
                  className="rounded-md px-2 py-2.5 text-sm font-medium text-lp-ink hover:bg-lp-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary"
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
                  className="block rounded-lg bg-lp-primary px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary"
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
                  className="w-full rounded-lg bg-lp-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-lp-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary disabled:opacity-60"
                >
                  Sign in with Google
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main-content">
        {/* Hero */}
        <section className="border-b border-lp-border">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[42fr_58fr] lg:gap-12 lg:pb-20 lg:pt-16">
            {/* Message */}
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-lp-primary">
                Your personal research notebook
              </p>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-lp-heading sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
                Turn observations into evidence-backed research.
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-lp-muted">
                Capture notes, measurements, and location. Explore your
                observations with Gemini, review supporting evidence, and decide
                what to investigate next.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {primaryCta}
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-lp-border bg-lp-surface px-6 py-3 text-base font-semibold text-lp-ink transition hover:border-lp-primary/40 hover:text-lp-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
                >
                  See how it works
                </a>
              </div>
              <p className="text-sm text-lp-muted">
                Your original observations stay yours. AI analysis stays separate.
              </p>
            </div>

            {/* Product preview: analysis overlaps observation on wide screens */}
            <div className="relative">
              <div className="lg:pr-14">
                <ObservationPreview className="shadow-lg" />
              </div>
              <AnalysisPreview className="relative z-10 mx-auto -mt-6 w-[92%] shadow-lg sm:w-[85%] lg:absolute lg:-bottom-10 lg:left-10 lg:mt-0 lg:w-[70%]" />
            </div>
          </div>
        </section>

        {/* Compact trust strip */}
        <section aria-label="What the journal guarantees" className="border-b border-lp-border">
          <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-x-8 gap-y-3 px-5 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            {TRUST_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm text-lp-ink">
                <Icon className="h-4 w-4 shrink-0 text-lp-primary" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </section>

        {/* Workflow */}
        <section id="how-it-works" className="scroll-mt-20 border-b border-lp-border">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl font-semibold text-lp-heading sm:text-3xl">
                From field note to next investigation.
              </h2>
              <p className="text-lg text-lp-muted">
                Record what happened, review what it might mean, and choose your
                next step.
              </p>
            </div>

            <ol className="mt-10 grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW_STEPS.map(({ icon: Icon, title, body }, i) => (
                <li
                  key={title}
                  className="relative flex gap-4 border-lp-border py-5 lg:border-l lg:py-2 lg:pl-6 lg:pr-4 lg:first:border-l-0"
                >
                  {/* Numbered marker */}
                  <span
                    aria-hidden="true"
                    className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-lp-border bg-lp-surface text-sm font-semibold text-lp-primary"
                  >
                    {i + 1}
                  </span>
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 font-semibold text-lp-ink">
                      <Icon className="h-4 w-4 text-lp-primary" aria-hidden="true" />
                      {title}
                    </p>
                    <p className="text-sm leading-relaxed text-lp-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-8 rounded-lg border border-lp-border bg-lp-surface px-4 py-3 text-sm text-lp-muted">
              Gemini suggests investigations; you create a task by accepting one.
              Suggestions are never turned into tasks on their own.
            </p>
          </div>
        </section>

        {/* Feature showcase */}
        <div id="features" className="scroll-mt-20 space-y-16 border-b border-lp-border bg-lp-surface py-16 lg:space-y-24 lg:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl font-semibold text-lp-heading sm:text-3xl">
                Built for real research work.
              </h2>
              <p className="text-lg text-lp-muted">
                Three capabilities, each honest about what it shows.
              </p>
            </div>
          </div>

          <div className="mx-auto max-w-6xl space-y-16 px-5 sm:px-8 lg:space-y-24">
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
        <section id="privacy" className="scroll-mt-20 border-b border-lp-border">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-20">
            <div className="space-y-5">
              <h2 className="text-2xl font-semibold text-lp-heading sm:text-3xl">
                Your records are the source of truth.
              </h2>
              <ul className="space-y-3">
                {[
                  "User-authored observations remain separate from AI interpretations.",
                  "AI output is clearly labeled.",
                  "Supporting observations and uncertainty are visible.",
                  "Suggested tasks require user acceptance.",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[15px] text-lp-ink">
                    <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-lp-primary" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
              {/* Provenance example — sample values, labeled as such */}
              <p className="rounded-lg border border-lp-ai/30 bg-lp-ai-surface/40 px-3 py-2 text-xs text-lp-muted">
                <span className="font-semibold text-lp-ai-text">Gemini analysis</span>
                {" · "}Example sources{" · "}Generation details
              </p>
            </div>

            <div className="space-y-5">
              <h3 className="text-xl font-semibold text-lp-heading">Private by design.</h3>
              <ul className="space-y-3">
                {[
                  "Google sign-in protects access.",
                  "Each account's records are isolated.",
                  "Location precision is controlled by the user.",
                  "Server-side secrets are not exposed in the browser.",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[15px] text-lp-ink">
                    <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-lp-primary" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>

              <details className="group rounded-lg border border-lp-border bg-lp-surface">
                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-lp-ink marker:content-none focus:outline-none focus-visible:ring-2 focus-visible:ring-lp-primary [&::-webkit-details-marker]:hidden">
                  How privacy works
                </summary>
                <div className="border-t border-lp-border px-4 py-3 text-sm leading-relaxed text-lp-muted">
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
        <section className="bg-lp-primary-soft">
          <div className="mx-auto max-w-6xl px-5 py-16 text-center sm:px-8 lg:py-20">
            <h2 className="text-2xl font-semibold text-lp-heading sm:text-3xl">
              Start with one observation.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-lp-muted">
              Build a research journal you can return to, question, and grow.
            </p>
            <div className="mt-7">{primaryCta}</div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-lp-border bg-lp-bg">
        <div className="mx-auto max-w-6xl space-y-1.5 px-5 py-8 text-center text-sm text-lp-muted sm:px-8">
          <p className="font-semibold text-lp-heading">AI Scientific Journal</p>
          <p>Built with Google Cloud Run, Firebase, and Gemini.</p>
        </div>
      </footer>
    </div>
  );
}
