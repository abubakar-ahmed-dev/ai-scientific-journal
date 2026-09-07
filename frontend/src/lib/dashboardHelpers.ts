import type { Analysis, Observation, Project, ResearchTask } from "./api";
import type { LucideIcon } from "lucide-react";
import { FileText, FolderKanban, CheckSquare, Sparkles } from "lucide-react";

export interface StatItem {
  label: string;
  /** Page count — never presented as a total; `capped` renders the "+" marker. */
  count: number;
  capped: boolean;
  to: string;
  linkLabel: string;
  icon: LucideIcon;
  iconClass: string;
}

/** Builds the four canonical stat items from dashboard query state. */
export const buildStatItems = (input: {
  observations: number;
  observationsCapped: boolean;
  activeProjects: number;
  projectsCapped: boolean;
  openTasks: number;
  tasksCapped: boolean;
  analyses: number;
  analysesCapped: boolean;
}): StatItem[] => [
  {
    label: "Observations",
    count: input.observations,
    capped: input.observationsCapped,
    to: "/observations",
    linkLabel: "View journal",
    icon: FileText,
    iconClass: "bg-brand-50 text-brand-600",
  },
  {
    label: "Active Projects",
    count: input.activeProjects,
    capped: input.projectsCapped,
    to: "/projects",
    linkLabel: "Manage projects",
    icon: FolderKanban,
    iconClass: "bg-amber-50 text-amber-600",
  },
  {
    label: "Open Tasks",
    count: input.openTasks,
    capped: input.tasksCapped,
    to: "/tasks",
    linkLabel: "Open tasks board",
    icon: CheckSquare,
    iconClass: "bg-emerald-50 text-emerald-600",
  },
  {
    label: "AI Analyses",
    count: input.analyses,
    capped: input.analysesCapped,
    to: "/ask",
    linkLabel: "Review analyses",
    icon: Sparkles,
    iconClass: "bg-purple-50 text-purple-600",
  },
];

/**
 * Pure derivations for the dashboard (plans/UI-polish/dashboard-refactor-plan.md §6).
 * Kept framework-free so the rules are unit-testable without React or react-query.
 */

export type ActivityItem = {
  id: string;
  kind: "observation" | "task" | "analysis";
  label: string;
  detail?: string;
  to: string;
  at: string;
};

export type NextStepSource = "rule" | "analysis";

export type NextStep = {
  text: string;
  to: string;
  source: NextStepSource;
  /** Human label shown above the text ("Suggested next step" vs "From your last analysis"). */
  label: string;
};

export const OPEN_TASK_STATUSES = ["suggested", "planned", "in_progress"] as const;

/** Status priority for the prioritized task summary (in-progress first). */
export const STATUS_PRIORITY: Record<string, number> = {
  in_progress: 0,
  planned: 1,
  suggested: 2,
};

/** Most recently updated active project, or null. */
export const pickCurrentResearch = (projects: Project[]): Project | null =>
  [...projects]
    .filter((p) => p.status === "active")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] || null;

/** Prioritized open-task summary: status priority first, then recency. */
export const summarizeTasks = (openTasks: ResearchTask[], max = 3): ResearchTask[] =>
  [...openTasks]
    .sort((a, b) => {
      const pA = STATUS_PRIORITY[a.status] ?? 9;
      const pB = STATUS_PRIORITY[b.status] ?? 9;
      if (pA !== pB) return pA - pB;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, max);

/** Clickable recent-activity feed built only from real records. */
export const buildActivity = (
  observations: Observation[],
  completedTasks: ResearchTask[],
  analyses: Analysis[],
  max = 6
): ActivityItem[] =>
  [
    ...observations.map<ActivityItem>((o) => ({
      id: `obs-${o.id}`,
      kind: "observation",
      label: o.title,
      to: `/observations/${o.id}`,
      at: o.updatedAt || o.createdAt,
    })),
    ...completedTasks.map<ActivityItem>((t) => ({
      id: `task-${t.id}`,
      kind: "task",
      label: t.title,
      detail: "Completed task",
      to: "/tasks",
      at: t.updatedAt,
    })),
    ...analyses.map<ActivityItem>((a) => ({
      id: `anl-${a.id}`,
      kind: "analysis",
      label: a.type.replace("_", " "),
      detail: a.summary,
      // Analyses live inside their source observation's detail page.
      to: a.observationIds[0] ? `/observations/${a.observationIds[0]}` : "/observations",
      at: a.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, max);

/**
 * Deterministic "suggested next step" for the Research Brief — zero-cost rules,
 * clearly attributed (never presented as AI output). When the latest analysis
 * is newer than the latest observation, its real suggestedNextSteps[0] is
 * preferred and explicitly labeled as coming from that analysis.
 */
export const nextStepSuggestion = (input: {
  observations: Observation[];
  openTasks: ResearchTask[];
  analyses: Analysis[];
  hasActiveProject: boolean;
}): NextStep => {
  const { observations, openTasks, analyses, hasActiveProject } = input;
  const latest = observations[0];
  const latestAnalysis = analyses[0];

  // AI-sourced step, only when the analysis postdates every observation it could
  // have been derived from (i.e. it reflects the current journal state).
  const analysisIsFresh =
    Boolean(latestAnalysis?.suggestedNextSteps?.length) &&
    (!latest || new Date(latestAnalysis.createdAt) > new Date(latest.createdAt));
  if (analysisIsFresh && latestAnalysis) {
    return {
      text: latestAnalysis.suggestedNextSteps[0],
      to: latestAnalysis.observationIds[0]
        ? `/observations/${latestAnalysis.observationIds[0]}`
        : "/observations",
      source: "analysis",
      label: "From your last analysis",
    };
  }

  if (latest && latest.status !== "analyzed") {
    return {
      text: "Analyze your latest observation to surface patterns.",
      to: `/observations/${latest.id}`,
      source: "rule",
      label: "Suggested next step",
    };
  }

  const suggestedCount = openTasks.filter((t) => t.source === "gemini" && t.status === "suggested").length;
  if (suggestedCount > 0) {
    return {
      text: `Review ${suggestedCount} task suggestion${suggestedCount === 1 ? "" : "s"} from your analyses.`,
      to: "/tasks",
      source: "rule",
      label: "Suggested next step",
    };
  }

  if (openTasks.length > 0) {
    return {
      text: `You have ${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}.`,
      to: "/tasks",
      source: "rule",
      label: "Suggested next step",
    };
  }

  if (!hasActiveProject && observations.length > 0) {
    return {
      text: "Group your observations into a project to anchor your research.",
      to: "/projects",
      source: "rule",
      label: "Suggested next step",
    };
  }

  return {
    text: "Record a new observation to keep your journal growing.",
    to: "/observations/new",
    source: "rule",
    label: "Suggested next step",
  };
};
