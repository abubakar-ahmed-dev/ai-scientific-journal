import { z } from "zod";

export const MeasurementSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Measurement name is required").max(50),
    value: z.number().refine((v) => Number.isFinite(v), "Measurement value must be a valid number"),
    unit: z.string().trim().min(1, "Unit is required").max(50),
    observedAt: z.string().datetime().nullish(),
    notes: z.string().max(1000).nullish(),
  })
  .strict();

export const LocationSchema = z
  .object({
    latitude: z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
    longitude: z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
    accuracyMeters: z.number().positive().nullish(),
    label: z.string().max(200).nullish(),
    precision: z.enum(["exact", "approximate", "hidden"]),
  })
  .strict();

function validateObservedAt(dateStr?: string | null): boolean {
  if (!dateStr) return true;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return false;
  // Plausibility check: not > 5 minutes in the future
  const now = new Date();
  const maxAllowedFuture = new Date(now.getTime() + 5 * 60 * 1000);
  return parsed <= maxAllowedFuture;
}

export const CreateObservationSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title cannot exceed 200 characters"),
    description: z.string().trim().min(1, "Description is required").max(20000, "Description cannot exceed 20000 characters"),
    projectId: z.string().nullish().default(null),
    notes: z.string().max(5000).nullish(),
    hypothesis: z.string().max(5000).nullish(),
    observedAt: z
      .string()
      .datetime({ message: "observedAt must be a valid ISO-8601 timestamp" })
      .refine(validateObservedAt, "observedAt cannot be more than 5 minutes in the future")
      .optional(),
    location: LocationSchema.nullish(),
    tags: z
      .array(z.string().trim().min(1).max(50))
      .max(20, "Cannot have more than 20 tags")
      .default([]),
    measurements: z
      .array(MeasurementSchema)
      .max(50, "Cannot have more than 50 measurements")
      .default([]),
    status: z.enum(["draft", "observed"]).default("observed"),
  })
  .strict();

export const UpdateObservationSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(20000).optional(),
    projectId: z.string().nullish(),
    notes: z.string().max(5000).nullish(),
    hypothesis: z.string().max(5000).nullish(),
    observedAt: z
      .string()
      .datetime({ message: "observedAt must be a valid ISO-8601 timestamp" })
      .refine(validateObservedAt, "observedAt cannot be more than 5 minutes in the future")
      .optional(),
    location: LocationSchema.nullish(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    measurements: z.array(MeasurementSchema).max(50).optional(),
    status: z.enum(["draft", "observed", "archived"]).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export const ListObservationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  sort: z.enum(["updated", "observed"]).default("updated"),
  projectId: z.string().optional(),
  status: z.enum(["draft", "observed", "analyzed", "archived"]).optional(),
  tag: z.union([z.string(), z.array(z.string())]).optional(),
  q: z.string().optional(),
});

export type MeasurementDTO = z.infer<typeof MeasurementSchema>;
export type LocationDTO = z.infer<typeof LocationSchema>;
export type CreateObservationDTO = z.infer<typeof CreateObservationSchema>;
export type UpdateObservationDTO = z.infer<typeof UpdateObservationSchema>;
export type ListObservationsQueryDTO = z.infer<typeof ListObservationsQuerySchema>;
