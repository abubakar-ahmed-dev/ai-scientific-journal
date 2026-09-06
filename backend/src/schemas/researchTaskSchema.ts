import { z } from "zod";

export const TaskStatusSchema = z.enum([
  "suggested",
  "planned",
  "in_progress",
  "completed",
  "dismissed",
]);

export const CreateUserTaskSchema = z.object({
  source: z.literal("user"),
  title: z.string().trim().min(1, "Title is required").max(200, "Title cannot exceed 200 characters"),
  description: z.string().trim().min(1, "Description is required").max(5000, "Description cannot exceed 5000 characters"),
  projectId: z.string().trim().min(1).nullish(),
  relatedObservationIds: z.array(z.string().trim().min(1)).max(50).optional(),
});

export const AcceptSuggestionSchema = z.object({
  source: z.literal("gemini"),
  sourceAnalysisId: z.string().trim().min(1, "sourceAnalysisId is required"),
  suggestionIndex: z.number().int().min(0, "suggestionIndex must be a non-negative integer"),
  projectId: z.string().trim().min(1).nullish(),
});

export const CreateResearchTaskSchema = z.discriminatedUnion("source", [
  CreateUserTaskSchema,
  AcceptSuggestionSchema,
]);

export const UpdateResearchTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    status: TaskStatusSchema.optional(),
    // Move task between projects; null files it under "Unfiled".
    // Ownership of the target project is validated in the repository.
    projectId: z.string().trim().min(1).nullish(),
    relatedObservationIds: z.array(z.string().trim().min(1)).max(50).optional(),
  })
  .strict();

export const ListResearchTasksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: TaskStatusSchema.optional(),
  projectId: z.string().optional(),
});

export type CreateResearchTaskDTO = z.infer<typeof CreateResearchTaskSchema>;
export type UpdateResearchTaskDTO = z.infer<typeof UpdateResearchTaskSchema>;
export type ListResearchTasksQueryDTO = z.infer<typeof ListResearchTasksQuerySchema>;
