import { z } from "zod";

export const AskRequestSchema = z
  .object({
    question: z.string().trim().min(1, "Question cannot be empty").max(2000, "Question too long"),
    conversationId: z.string().trim().min(1).optional(),
  })
  .strict();

export type AskRequestDTO = z.infer<typeof AskRequestSchema>;

export const SearchRequestSchema = z
  .object({
    query: z.string().trim().min(1, "Query cannot be empty").max(500, "Query too long"),
    limit: z.coerce.number().int().min(1).max(25).optional(),
    projectId: z.string().trim().min(1).optional(),
  })
  .strict();

export type SearchRequestDTO = z.infer<typeof SearchRequestSchema>;

export const GroundedAnswerOutputSchema = z
  .object({
    answer: z.string().trim().min(1, "Answer cannot be empty"),
    evidence: z
      .array(
        z.object({
          observationId: z.string().trim().min(1, "Observation ID required"),
          note: z.string().trim().optional(),
        })
      )
      .default([]),
    uncertainties: z.array(z.string().trim().min(1)).default([]),
    // Model self-report that it could not find sufficient evidence (ask-grounded-v2).
    // Optional so older/adversarial outputs still validate; the route treats a
    // missing field as `false` (fixing-plan #18).
    insufficientEvidence: z.boolean().optional(),
  })
  .strict();

export type GroundedAnswerOutput = z.infer<typeof GroundedAnswerOutputSchema>;
