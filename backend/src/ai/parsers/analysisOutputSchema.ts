import { z } from "zod";

export const HypothesisOutputSchema = z.object({
  statement: z.string().trim().min(1, "Hypothesis statement is required"),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  supportingObservationIds: z.array(z.string()).default([]),
});

export const StructuredAnalysisOutputSchema = z.object({
  summary: z.string().trim().min(1, "Summary is required"),
  keyFindings: z.array(z.string().trim().min(1)).default([]),
  hypotheses: z.array(HypothesisOutputSchema).default([]),
  uncertainties: z.array(z.string().trim().min(1)).default([]),
  suggestedQuestions: z.array(z.string().trim().min(1)).default([]),
  openQuestions: z.array(z.string().trim().min(1)).default([]),
  suggestedNextSteps: z.array(z.string().trim().min(1)).default([]),
});

export type HypothesisOutput = z.infer<typeof HypothesisOutputSchema>;
export type StructuredAnalysisOutput = z.infer<typeof StructuredAnalysisOutputSchema>;
