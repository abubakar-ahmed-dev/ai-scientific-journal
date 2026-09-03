import { z } from "zod";

export const AnalysisTypeSchema = z.enum([
  "summary",
  "analysis",
  "hypothesis",
  "classification",
  "research_suggestions",
]);

export const SummarizeRequestSchema = z
  .object({
    conversationId: z.string().trim().min(1).optional(),
    observationIds: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
    projectId: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine(
    (data) => {
      const hasConv = Boolean(data.conversationId);
      const hasObs = Boolean(data.observationIds && data.observationIds.length > 0);
      return (hasConv && !hasObs) || (!hasConv && hasObs);
    },
    {
      message: "Exactly one source must be provided: either 'conversationId' or 'observationIds'.",
    }
  );

export const AnalyzeRequestSchema = z
  .object({
    observationIds: z.array(z.string().trim().min(1)).min(1, "At least 1 observation ID required").max(10, "Maximum 10 observation IDs permitted"),
    projectId: z.string().trim().min(1).optional(),
  })
  .strict();

export const SuggestResearchRequestSchema = z
  .object({
    observationIds: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
    analysisId: z.string().trim().min(1).optional(),
    projectId: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine(
    (data) => {
      const hasObs = Boolean(data.observationIds && data.observationIds.length > 0);
      const hasAnalysis = Boolean(data.analysisId);
      return hasObs || hasAnalysis;
    },
    {
      message: "At least one source must be provided: 'observationIds' or 'analysisId'.",
    }
  );

export const ListAnalysesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  type: AnalysisTypeSchema.optional(),
  observationId: z.string().optional(),
  conversationId: z.string().optional(),
  projectId: z.string().optional(),
});

export type SummarizeRequestDTO = z.infer<typeof SummarizeRequestSchema>;
export type AnalyzeRequestDTO = z.infer<typeof AnalyzeRequestSchema>;
export type SuggestResearchRequestDTO = z.infer<typeof SuggestResearchRequestSchema>;
export type ListAnalysesQueryDTO = z.infer<typeof ListAnalysesQuerySchema>;
