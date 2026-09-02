import { z } from "zod";

export const CreateProjectSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title cannot exceed 200 characters"),
    description: z.string().max(5000, "Description cannot exceed 5000 characters").nullish(),
    field: z.string().max(100, "Field label cannot exceed 100 characters").nullish(),
    tags: z
      .array(z.string().trim().min(1).max(50, "Each tag must be between 1 and 50 characters"))
      .max(20, "Cannot have more than 20 tags")
      .default([]),
  })
  .strict();

export const UpdateProjectSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title cannot exceed 200 characters").optional(),
    description: z.string().max(5000, "Description cannot exceed 5000 characters").nullish(),
    field: z.string().max(100, "Field label cannot exceed 100 characters").nullish(),
    tags: z
      .array(z.string().trim().min(1).max(50, "Each tag must be between 1 and 50 characters"))
      .max(20, "Cannot have more than 20 tags")
      .optional(),
    status: z.enum(["active", "archived", "completed"]).optional(),
  })
  .strict();

export const ListProjectsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(["active", "archived", "completed"]).optional(),
});

export type CreateProjectDTO = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectDTO = z.infer<typeof UpdateProjectSchema>;
export type ListProjectsQueryDTO = z.infer<typeof ListProjectsQuerySchema>;
