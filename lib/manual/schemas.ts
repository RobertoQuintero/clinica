import "server-only";
import { z } from "zod";

export const manualPageFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  section: z.enum(["primeros-pasos", "pantallas", "tutoriales", "avisos"]),
  order: z.number().int().positive(),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // nunca Date
});

// Slugs que llegan por la URL: se validan antes de tocar el disco (evita ../).
export const manualSlugSchema = z.string().regex(/^[a-z0-9-]+$/);
