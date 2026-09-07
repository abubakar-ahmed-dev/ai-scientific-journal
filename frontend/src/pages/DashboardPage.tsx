import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Layout } from "../components/Layout";
import { fetchObservations } from "../lib/api";
import { useDashboardData } from "../lib/useDashboardData";
import {
  pickCurrentResearch,
  summarizeTasks,
  buildActivity,
  nextStepSuggestion,
  buildStatItems,
} from "../lib/dashboardHelpers";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { ResearchBrief } from "../components/dashboard/ResearchBrief";
import { AiActionsRow } from "../components/dashboard/AiActionsRow";
import { StatsRow } from "../components/dashboard/StatsRow";
import { RecentObservationsFeed } from "../components/dashboard/RecentObservationsFeed";
import { TasksPanel } from "../components/dashboard/TasksPanel";
import { ActivityFeed } from "../components/dashboard/ActivityFeed";
import { NewUserDashboard } from "../components/dashboard/NewUserDashboard";

/**
 * Dashboard (plans/UI-polish/dashboard-refactor-plan.md): two states —
 * confirmed-empty workspace gets the observation-first onboarding layout;
 * everyone else gets the research command center. All numbers are real
 * page counts with explicit "+" cap markers (backend exposes hasMore, not
 * totals), and every section owns its loading/error/empty state.
 */
export default function DashboardPage() {
  const dash = useDashboardData();

  const observations = dash.observations.data?.data ?? [];
  const projects = dash.projects.data?.data ?? [];
  const analyses = dash.analyses.data?.data ?? [];

  // New-user onboarding only when the empty workspace is *confirmed* — if the
  // observations or projects fetches failed, an empty list means "unknown",
  // and rendering onboarding would disguise an outage as a fresh account.
  const isEmptyWorkspace =
    !dash.isLoading &&
    !dash.observations.isError &&
    !dash.projects.isError &&
    observations.length === 0 &&
    projects.length === 0;

  const currentResearch = pickCurrentResearch(projects);
  const latestObservation = observations[0] ?? null;

  // Real per-project observation count for the brief (meta has no totals —
  // the hasMore flag carries the "+" cap marker instead).
  const briefObservations = useQuery({
    queryKey: ["dashboard", "brief-observations", currentResearch?.id ?? "none"],
    queryFn: () => fetchObservations({ projectId: currentResearch!.id, limit: 50 }),
    enabled: Boolean(currentResearch),
    staleTime: 60_000,
  });

  if (isEmptyWorkspace) {
    return (
      <Layout>
        <NewUserDashboard
          headerSubtext="Start your first research record."
          readinessRows={[
            // Evidence-based rows only (plan §5.1) — each reflects a real
            // confirmed state, never a decorative check.
            { label: "Private account active", done: true },
            {
              label: "Journal API healthy",
              done: !dash.observations.isError && !dash.projects.isError,
            },
            { label: "AI assistant available", done: !dash.analyses.isError },
            { label: "No observations yet", done: false },
          ]}
        />
      </Layout>
    );
  }

  const nextStep = nextStepSuggestion({
    observations,
    openTasks: dash.openTasks,
    analyses,
    hasActiveProject: Boolean(currentResearch),
  });
  const summaryTasks = summarizeTasks(dash.openTasks, 3);
  const activity = buildActivity(observations, dash.completedTasks, analyses, 6);

  const observationCount = briefObservations.data?.data?.length ?? null;
  const briefObservationsCapped = Boolean(briefObservations.data?.meta?.hasMore);

  const openTaskCount = currentResearch
    ? dash.openTasks.filter((t) => t.projectId === currentResearch.id).length
    : dash.openTasks.length;
  const tasksCapped = [dash.tasksSuggested, dash.tasksPlanned, dash.tasksInProgress].some(
    (q) => Boolean(q.data?.meta?.hasMore)
  );

  const tasksLoading = [dash.tasksSuggested, dash.tasksPlanned, dash.tasksInProgress].some(
    (q) => q.isLoading
  );
  // Any open-status fetch failing makes "all caught up" unverifiable, so the
  // section shows its error state instead of a false empty state.
  const tasksFailed = [dash.tasksSuggested, dash.tasksPlanned, dash.tasksInProgress].some(
    (q) => q.isError
  );

  const latestAnalysis = analyses[0] ?? null;

  return (
    <Layout>
      <div className="space-y-10">
        <DashboardHeader subtext="Continue your research where you left off." />

        {/* Error alert with reachable retry (F6): per-section panels below
            keep working sections visible; this retries only failed queries. */}
        {dash.hasError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Some research data could not be loaded. Please retry below.</span>
            </div>
            <button
              type="button"
              onClick={dash.retryAll}
              className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-amber-300 text-xs font-semibold text-amber-800 rounded-md hover:bg-amber-100 transition shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        <ResearchBrief
          project={currentResearch}
          latestObservation={latestObservation}
          observationCount={observationCount}
          observationsCapped={briefObservationsCapped}
          openTaskCount={openTaskCount}
          tasksCapped={tasksCapped}
          nextStep={nextStep}
        />

        <AiActionsRow
          latestObservationId={latestObservation?.id ?? null}
          latestAnalysisObservationId={latestAnalysis?.observationIds?.[0] ?? null}
          hasAnalyses={analyses.length > 0}
        />

        {!dash.isLoading && (
          <StatsRow
            items={buildStatItems({
              observations: observations.length,
              observationsCapped: Boolean(dash.observations.data?.meta?.hasMore),
              activeProjects: projects.filter((p) => p.status === "active").length,
              projectsCapped: Boolean(dash.projects.data?.meta?.hasMore),
              openTasks: dash.openTasks.length,
              tasksCapped,
              analyses: analyses.length,
              analysesCapped: Boolean(dash.analyses.data?.meta?.hasMore),
            })}
          />
        )}

        {/* Main 2-column feed: observations + tasks; activity moves to its
            own full-width section below (2026-09-07 refinement). */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <RecentObservationsFeed
              observations={observations}
              loading={dash.observations.isLoading}
              failed={dash.observations.isError}
              onRetry={() => dash.observations.refetch()}
            />
          </div>

          <div>
            <TasksPanel
              tasks={summaryTasks}
              loading={tasksLoading}
              failed={tasksFailed}
              onRetry={() => {
                dash.tasksSuggested.refetch();
                dash.tasksPlanned.refetch();
                dash.tasksInProgress.refetch();
              }}
            />
          </div>
        </div>

        <ActivityFeed items={activity} />
      </div>
    </Layout>
  );
}
