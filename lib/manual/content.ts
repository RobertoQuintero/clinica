import "server-only";
import { cache } from "react";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import type { IManualPage, IManualPageSummary, ManualSection } from "@/interfaces/manual";
import { manualPageFrontmatterSchema, manualSlugSchema } from "@/lib/manual/schemas";
import { MANUAL_SECTION_ORDER } from "@/lib/manual/modules";

const MANUAL_CONTENT_ROOT = path.join(process.cwd(), "content", "manual");

function sectionRank(section: ManualSection): number {
  return MANUAL_SECTION_ORDER.indexOf(section);
}

/**
 * Lee todas las páginas `.md` de un módulo, valida su encabezado YAML y las ordena por
 * sección (`MANUAL_SECTION_ORDER`) y luego por `order`. Memoizado con `cache()` de React
 * para leer el disco una sola vez por request, aunque varias piezas de una misma página
 * (índice lateral, Anterior/Siguiente) pidan el índice del mismo módulo.
 */
export const loadManualPages = cache(async function loadManualPages(
  moduleSlug: string
): Promise<IManualPageSummary[]> {
  if (!manualSlugSchema.safeParse(moduleSlug).success) return [];

  const moduleDir = path.join(MANUAL_CONTENT_ROOT, moduleSlug);
  let fileNames: string[];
  try {
    fileNames = await fs.readdir(moduleDir);
  } catch {
    return [];
  }

  const pages: IManualPageSummary[] = [];
  for (const fileName of fileNames) {
    if (!fileName.endsWith(".md")) continue;
    const slug = fileName.slice(0, -3);
    if (!manualSlugSchema.safeParse(slug).success) continue;

    const rawFile = await fs.readFile(path.join(moduleDir, fileName), "utf8");
    const { data } = matter(rawFile);
    const parsed = manualPageFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw new Error(
        `Encabezado inválido en content/manual/${moduleSlug}/${fileName}: campo "${firstIssue.path.join(".")}" — ${firstIssue.message}`
      );
    }

    pages.push({ moduleSlug, slug, ...parsed.data });
  }

  return pages.sort((a, b) => sectionRank(a.section) - sectionRank(b.section) || a.order - b.order);
});

/**
 * Página completa de un módulo, con `previous`/`next` calculados sobre el orden de
 * `loadManualPages`. Devuelve `null` si el módulo, el tema o el slug son inválidos —
 * nunca lanza por un archivo ausente, solo por un encabezado inválido (`loadManualPages`).
 */
export async function loadManualPage(
  moduleSlug: string,
  pageSlug: string
): Promise<IManualPage | null> {
  if (!manualSlugSchema.safeParse(moduleSlug).success) return null;
  if (!manualSlugSchema.safeParse(pageSlug).success) return null;

  const pages = await loadManualPages(moduleSlug);
  const pageIndex = pages.findIndex((page) => page.slug === pageSlug);
  if (pageIndex === -1) return null;

  const filePath = path.join(MANUAL_CONTENT_ROOT, moduleSlug, `${pageSlug}.md`);
  const rawFile = await fs.readFile(filePath, "utf8");
  const { content } = matter(rawFile);

  return {
    ...pages[pageIndex],
    body: content,
    previous: pageIndex > 0 ? pages[pageIndex - 1] : null,
    next: pageIndex < pages.length - 1 ? pages[pageIndex + 1] : null,
  };
}
