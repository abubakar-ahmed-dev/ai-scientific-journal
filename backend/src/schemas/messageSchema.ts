import { z } from "zod";

export const CreateMessageSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Message content cannot be empty")
      .max(8000, "Message content cannot exceed 8000 characters"),
  })
  .strict();

export const ListMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export type CreateMessageDTO = z.infer<typeof CreateMessageSchema>;
export type ListMessagesQueryDTO = z.infer<typeof ListMessagesQuerySchema>;
