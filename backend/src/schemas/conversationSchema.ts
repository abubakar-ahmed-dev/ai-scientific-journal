import { z } from "zod";

export const CreateConversationSchema = z
  .object({
    title: z.string().trim().max(200, "Title cannot exceed 200 characters").nullish(),
    projectId: z.string().nullish(),
    contextType: z.enum(["general", "observation", "project", "research"]),
    contextId: z.string().nullish(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.contextType === "general") {
        return !data.contextId;
      }
      return Boolean(data.contextId && data.contextId.trim().length > 0);
    },
    {
      message: "contextId is required when contextType is not 'general', and must be null when contextType is 'general'.",
      path: ["contextId"],
    }
  )
  // `research` context references an analysis (API.md §6.10), but the analyses
  // collection and its read API do not exist until Phase 5 — accepting an
  // unresolvable reference now would create dangling context. Honest deferral.
  .refine((data) => data.contextType !== "research", {
    message: "Conversations with 'research' context are not available yet — analyses arrive in a later phase.",
    path: ["contextType"],
  });

export const UpdateConversationSchema = z
  .object({
    title: z.string().trim().max(200, "Title cannot exceed 200 characters").optional(),
    status: z.enum(["active", "archived"]).optional(),
  })
  .strict();

export const ListConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(["active", "archived"]).optional(),
  projectId: z.string().optional(),
  contextType: z.enum(["general", "observation", "project", "research"]).optional(),
});

export type CreateConversationDTO = z.infer<typeof CreateConversationSchema>;
export type UpdateConversationDTO = z.infer<typeof UpdateConversationSchema>;
export type ListConversationsQueryDTO = z.infer<typeof ListConversationsQuerySchema>;
