import "server-only";
import { cache } from "react";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

export const manualCaptureManifestSchema = z.object({
  generatedAt: z.string(),
  captures: z.record(
    z.string().regex(/^[a-z0-9-]+$/),
    z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  ),
});

export interface IManualCapture {
  src: string; // "/manual/<moduleSlug>/<name>.png"
  width: number; // pixeles reales; next/image escala con sizes
  height: number;
}

const MANUAL_PUBLIC_ROOT = path.join(process.cwd(), "public", "manual");

/**
 * Lee `public/manual/<moduleSlug>/manifest.json` una vez por request (memoizado con `cache()`).
 * `null` si el módulo no tiene manifiesto. Un manifiesto inválido lanza con el nombre del archivo,
 * como el encabezado YAML de las páginas (`lib/manual/content.ts`).
 */
export const loadManualCaptureManifest = cache(async function loadManualCaptureManifest(
  moduleSlug: string,
): Promise<Record<string, IManualCapture> | null> {
  const manifestPath = path.join(MANUAL_PUBLIC_ROOT, moduleSlug, "manifest.json");
  let rawManifest: string;
  try {
    rawManifest = await fs.readFile(manifestPath, "utf8");
  } catch {
    return null;
  }

  const parsed = manualCaptureManifestSchema.safeParse(JSON.parse(rawManifest));
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new Error(
      `manifest.json inválido en public/manual/${moduleSlug}/manifest.json: campo "${firstIssue.path.join(".")}" — ${firstIssue.message}`,
    );
  }

  const captures: Record<string, IManualCapture> = {};
  for (const [name, { width, height }] of Object.entries(parsed.data.captures)) {
    captures[name] = { src: `/manual/${moduleSlug}/${name}.png`, width, height };
  }
  return captures;
});

/** `null` si no hay manifiesto o si el módulo no tiene esa captura. */
export async function loadManualCapture(moduleSlug: string, captureName: string): Promise<IManualCapture | null> {
  const manifest = await loadManualCaptureManifest(moduleSlug);
  return manifest?.[captureName] ?? null;
}
