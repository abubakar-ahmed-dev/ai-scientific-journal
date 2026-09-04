import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Compass,
  FileText,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  Camera,
} from "lucide-react";
import { useAuth } from "../lib/firebase/authContext";

export default function LandingPage() {
  const { currentUser, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate("/dashboard", { replace: true });
    }
  }, [currentUser, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-8 h-8 rounded-lg bg-linear-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              AI
            </span>
            <span className="text-xl font-bold bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              AI Scientific Journal
            </span>
          </div>

          <div>
            <button
              onClick={() => signInWithGoogle()}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-md transition shadow-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center gap-2"
            >
              Sign In with Google
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28 border-b border-slate-200 bg-linear-to-b from-white to-slate-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Grounded Intelligence for Empirical Science</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              AI Scientific Journal
              <span className="block text-2xl sm:text-3xl lg:text-4xl text-slate-600 font-semibold mt-3">
                The Intelligent Field & Lab Notebook for{" "}
                <span className="bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  Modern Researchers
                </span>
              </span>
            </h1>

            <p className="max-w-3xl mx-auto text-lg sm:text-xl text-slate-600 leading-relaxed">
              Capture empirical observations with multi-modal evidence, explore field data across an interactive geospatial map, and derive grounded hypotheses using Gemini AI with citation verification.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => signInWithGoogle()}
                disabled={loading}
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg transition shadow-md hover:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 flex items-center justify-center gap-2"
              >
                <span>Enter Research Journal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Zero-Write AI Safety</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Multi-Tenant User Isolation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Grounded RAG Evidence</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Private Multi-Modal Media</span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Pillars Grid */}
        <section className="py-16 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Built on Principles of Scientific Integrity
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Every feature respects empirical observations as authoritative truth. AI accelerates analysis without ever overwriting researcher records.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs hover:shadow-sm transition space-y-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Field Observations</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Log structured notes, custom measurements, tagged phenomena, hypotheses, and revision snapshots with version tracking.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs hover:shadow-sm transition space-y-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Multi-Modal Media</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Attach images, audio recordings, and field videos directly to observations stored in private observation-scoped buckets.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs hover:shadow-sm transition space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Research Map & GPS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Plot observations geographically using Leaflet with privacy controls honoring exact, approximate, or hidden locations.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs hover:shadow-sm transition space-y-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Ask My Journal (RAG)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Query your entire corpus of observations with answers strictly grounded in your notes, transparent citations, and honest caveats.
              </p>
            </div>
          </div>
        </section>

        {/* Scientific Workflow Progression */}
        <section className="py-16 bg-slate-100 border-t border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                The Researcher Workflow
              </h2>
              <p className="text-sm text-slate-600">
                From field observation to actionable experimental plan in four integrated steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Step 1</div>
                <h4 className="font-semibold text-slate-900 text-sm">Record Observation</h4>
                <p className="text-xs text-slate-600">
                  Log field data with coordinates, measurements, notes, and photos in an immutable user-isolated record.
                </p>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Step 2</div>
                <h4 className="font-semibold text-slate-900 text-sm">AI Synthesis</h4>
                <p className="text-xs text-slate-600">
                  Run structured AI analysis pipelines to uncover hidden correlations, suggest hypotheses, and highlight uncertainties.
                </p>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Step 3</div>
                <h4 className="font-semibold text-slate-900 text-sm">Plan Research Tasks</h4>
                <p className="text-xs text-slate-600">
                  One-click accept AI-suggested next steps into your structured research task board with complete lifecycle tracking.
                </p>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Step 4</div>
                <h4 className="font-semibold text-slate-900 text-sm">Synthesize with RAG</h4>
                <p className="text-xs text-slate-600">
                  Ask cross-cutting research questions across your historical notes and inspect your journal on the interactive map.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Architecture Reassurance */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-xs flex flex-col md:flex-row items-center gap-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="space-y-2 text-left">
              <h3 className="text-lg font-bold text-slate-900">
                Architectural Integrity & Strict User Privacy
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Authentication is strictly bounded by Firebase Auth. Authorization is enforced by application code and Firestore Rules. Gemini AI is treated as an untrusted computation engine with zero direct database write permissions. Your research data is private, encrypted, and strictly isolated.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 space-y-2">
          <p>© 2026 AI Scientific Journal — Built for Empirical Research</p>
          <p>Powered by Google Cloud Run, Firebase Auth & Firestore, and Gemini AI</p>
        </div>
      </footer>
    </div>
  );
}
