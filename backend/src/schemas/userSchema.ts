import { z } from "zod";

export const UserPreferencesSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    timezone: z.string().min(1, "Timezone string cannot be empty").optional(),
    locationEnabled: z.boolean().optional(),
    aiSuggestionsEnabled: z.boolean().optional(),
  })
  .strict();

export const UpdateUserSchema = z
  .object({
    displayName: z.string().min(1).max(100).optional(),
    photoURL: z.string().url().max(2048).startsWith("https://", "photoURL must be a valid HTTPS URL").optional(),
    preferences: UserPreferencesSchema.optional(),
  })
  .strict();

export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>;
