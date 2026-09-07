import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchObservations,
  fetchProjects,
  fetchResearchTasks,
  fetchAnalyses,
} from "./api";

/**
 * Dashboard data layer (plans/UI-polish/dashboard-refactor-plan.md §6).
 * One react-query query per source replaces the old hand-rolled
 * Promise.allSettled loader: per-section retry comes from each query's own
 * refetch. No staleTime: every visit to the dashboard refetches in the
 * background (cached data still renders instantly), so records created or
 * changed on other pages show up without a manual reload.
 *
 * The conversations fetch from the old dashboard was deleted — its result was
 * never rendered (dead request).
 *
 * Counts are page counts: backend list endpoints expose hasMore but no totals,
 * so every capped number on the dashboard carries an explicit "+" marker
 * instead of posing as a total.
 */
export function useDashboardData() {
  const observations = useQuery({
    queryKey: ["dashboard", "observations"],
    queryFn: () => fetchObservations({ limit: 4 }),
  });

  const projects = useQuery({
    queryKey: ["dashboard", "projects"],
    queryFn: () => fetchProjects({ limit: 50 }),
  });

  // Open tasks are fetched per status so the dashboard's "caught up" claim is
  // based on complete data, not the first unfiltered page. Completed tasks
  // ride along (bounded) for the recent-activity feed only.
  const tasksSuggested = useQuery({
    queryKey: ["dashboard", "tasks", "suggested"],
    queryFn: () => fetchResearchTasks({ status: "suggested", limit: 50 }),
  });
  const tasksPlanned = useQuery({
    queryKey: ["dashboard", "tasks", "planned"],
    queryFn: () => fetchResearchTasks({ status: "planned", limit: 50 }),
  });
  const tasksInProgress = useQuery({
    queryKey: ["dashboard", "tasks", "in_progress"],
    queryFn: () => fetchResearchTasks({ status: "in_progress", limit: 50 }),
  });
  const tasksCompleted = useQuery({
    queryKey: ["dashboard", "tasks", "completed"],
    queryFn: () => fetchResearchTasks({ status: "completed", limit: 6 }),
  });

  const analyses = useQuery({
    queryKey: ["dashboard", "analyses"],
    queryFn: () => fetchAnalyses({ limit: 5 }),
  });

  const allQueries = [
    observations,
    projects,
    tasksSuggested,
    tasksPlanned,
    tasksInProgress,
    tasksCompleted,
    analyses,
  ] as const;

  const openTasks = useMemo(() => {
    const merged = [
      ...(tasksSuggested.data?.data ?? []),
      ...(tasksPlanned.data?.data ?? []),
      ...(tasksInProgress.data?.data ?? []),
    ];
    return merged.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [tasksSuggested.data, tasksPlanned.data, tasksInProgress.data]);

  const completedTasks = useMemo(() => tasksCompleted.data?.data ?? [], [tasksCompleted.data]);

  const isLoading = allQueries.some((q) => q.isLoading);

  const hasError = allQueries.some((q) => q.isError);

  const retryAll = () => {
    allQueries.forEach((q) => {
      if (q.isError) q.refetch();
    });
  };

  return {
    observations,
    projects,
    tasksSuggested,
    tasksPlanned,
    tasksInProgress,
    tasksCompleted,
    analyses,
    openTasks,
    completedTasks,
    isLoading,
    hasError,
    retryAll,
  };
}
