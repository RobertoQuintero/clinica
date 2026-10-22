# User manual ("Ayuda" section)

- In-app help under `/dashboard/ayuda`, written in Markdown and rendered server-side (spec 92). Not a developer doc — it is aimed at the roles that actually operate each module, in plain non-technical Spanish, with the exact on-screen texts. The technical equivalent of a module (its tables, server actions, calculation rules) stays in this `docs/` folder.
- Routes, all Server Components, no `"use client"` anywhere in the tree: `app/dashboard/ayuda/page.tsx` (index of visible modules), `app/dashboard/ayuda/[modulo]/page.tsx` (module index, grouped by section) and `app/dashboard/ayuda/[modulo]/[tema]/page.tsx` (one page). An unknown module or topic calls `notFound()`; a module the role can't see redirects to `/dashboard/ayuda`.

## File layout

```
content/manual/
  <modulo>/
    <tema>.md
```

- `<modulo>` matches a module's `slug` in the registry below (today only `nomina`). `<tema>` is the page's slug.
- Both slugs must match `^[a-z0-9-]+$` (`manualSlugSchema`, `lib/manual/schemas.ts`), validated before touching the disk — this is what stops a `../` in the URL from reading outside `content/manual/`.
- `next.config.ts` has `outputFileTracingIncludes: { "/dashboard/ayuda/**": ["./content/manual/**"] }`. Without it a serverless deploy only ships what Next traces from imports, and `content/manual/` is read from disk at runtime (`lib/manual/content.ts`), so the manual would 404 in production.

## Module registry (`lib/manual/modules.ts`)

- `MANUAL_MODULES: readonly IManualModule[]` (`interfaces/manual.ts`): one entry per module, `{ slug, title, description, allowedRoleIds }`. `allowedRoleIds` should just be the module's existing access constant (e.g. `PAYROLL_ALLOWED_ROLE_IDS` for `nomina`) so the manual's access always moves with the module's.
- This file has **no server-only or `lucide-react` imports** — `proxy.ts` (the middleware) imports it directly for the route gate, and either kind of import would bloat the middleware bundle. The per-module icon lives apart, in `app/dashboard/ayuda/componentes/manualModuleIcons.ts` (`MANUAL_MODULE_ICONS: Record<string, LucideIcon>`).
- `MANUAL_VISIBLE_ROLE_IDS` is the union of every module's `allowedRoleIds` (today `[1, 4]`); `getVisibleManualModules(roleId)` and `canViewManualModule(roleId, moduleSlug)` filter on it.
- `MANUAL_SECTION_LABELS` / `MANUAL_SECTION_ORDER` fix the four sections a module's pages are grouped and sorted into: `primeros-pasos`, `pantallas`, `tutoriales`, `avisos` ("Primeros pasos", "Pantallas", "Tutoriales", "Avisos y preguntas frecuentes").

## Page frontmatter

Every `.md` file starts with a YAML header, read with `gray-matter` and validated with `manualPageFrontmatterSchema` (`lib/manual/schemas.ts`):

```yaml
---
title: "Periodos"
description: "Crear, editar y eliminar los periodos de pago de la sucursal."
section: "pantallas"
order: 1
updated: "2026-10-21"
---
```

- `section` is one of the four values above; `order` is the position inside that section.
- `updated` is a plain `"YYYY-MM-DD"` **string, quoted**. Unquoted, `gray-matter` parses it as a JS `Date`, which this project never allows for dates (see the date rules in the main `CLAUDE.md`) and which the schema rejects. It renders as "21 de octubre de 2026" via `lib/manual/dateFormat.ts` (`formatManualUpdatedDate`, which normalizes with `"T00:00:00"` before formatting, same rule).
- An invalid header (missing field, unquoted `updated`, unknown `section`...) throws from `loadManualPages` with the file name and the offending field — on purpose, so a bad header is caught in development or at `build`, never silently.
- There are no defaults: every field is required.

## Page templates

A "pantalla" page (one per screen) follows this shape:

1. Para qué sirve
2. Antes de empezar
3. Qué ves en la pantalla
4. Cómo… (one subsection per task)
5. Cómo calcula (plain-language rules, with a worked numeric example)
6. Avisos de esta pantalla (a one-line pointer to the module's "Avisos y preguntas frecuentes" page — the notices themselves are documented once, there)
7. Relacionado

A "tutorial" page (an end-to-end flow spanning several screens) follows this one instead:

1. Qué vas a lograr
2. Antes de empezar
3. Pasos (numbered, each step linking to the screen it happens on)
4. Cómo saber que quedó bien
5. Errores comunes

The "primeros pasos" and "avisos" sections are free-form (see `conceptos-basicos.md` and `avisos-y-preguntas.md` for the nómina manual): there's no fixed template, but "avisos" should give every notice component of the module its own heading, with what it means and what to do.

## Callout boxes

A blockquote whose first line is `[!NOTE]`, `[!TIP]` or `[!WARNING]` renders as a "Nota" / "Consejo" / "Atención" box (GitHub's syntax, so it still previews correctly in the repo):

```markdown
> [!WARNING]
> Un periodo en **En cálculo** no se puede editar ni eliminar.
```

Implemented with a small remark plugin, `lib/manual/remarkCallouts.ts` — no MDX, no new blockquote syntax. Any other blockquote renders as a normal quote.

## Capture placeholders

`![Descripción de la captura](captura:nombre-de-archivo)` marks where a screenshot goes. `nombre-de-archivo` follows `^[a-z0-9-]+$` and must match an entry in `public/manual/<modulo>/manifest.json` (spec 93; see `docs/sucursal-demo.md` for how the Nómina manifest and its 16 PNGs are generated from the Sucursal Demo).

- **With a real capture** (the name is in the module's manifest): `ManualMarkdown` renders a `<figure>` — the PNG through `next/image` at its real width/height, wrapped in a link that opens it full-size in a new tab, with the `alt` text as `<figcaption>`. The page's Server Component resolves every marker's capture once via `loadManualCapture` (`lib/manual/captures.ts`) and passes the resolved map to `ManualMarkdown`; the renderer itself never reads the manifest. A standalone image markdown line is wrapped by `ManualMarkdown` in a bare paragraph; its `p` override unwraps that paragraph when the capture renders a `<figure>`, because `<figure>` is not phrasing content and nesting it inside `<p>` is invalid HTML (a hydration error) — keep that unwrap if you touch the `img`/`p` renderers.
- **Without one** (no manifest, or the name isn't in it): in `npm run dev` it renders as a dashed placeholder box with a camera icon, the `alt` text and the capture name; outside development (`NODE_ENV !== "development"`) it renders nothing — a "Captura pendiente" box in production would look like a bug, not a placeholder.
- Every page should carry at least one.

## Internal and screen links

- To another manual page: a relative path, `[Periodos](./periodos)` or, with an anchor, `[Preparar al empleado](./preparar-empleado#horario)`. `ManualMarkdown` resolves these through `buildManualHref` (`lib/manual/links.ts`) into `next/link`, so navigation never does a full page reload.
- To a screen of the app: an absolute path, `[Procesar nómina](/dashboard/nomina/procesar)`.
- Headings get an accent-free, lowercase `id` from `lib/manual/rehypeHeadingIds.ts` ("Días económicos" → `dias-economicos`) — a small rehype plugin written for this, not `rehype-slug`, which keeps the accent and breaks the anchor. Renaming a `##` changes its anchor, so check `lib/manual/links.ts` (`EMPLOYEE_SETUP_ANCHORS` and friends) for anything pointing at the old one.

## Writing rules

- **Non-technical and in Spanish.** No DB table or column names, no spec numbers, no SQL, no `id_role` numbers — name a role by what it does ("quien opera la nómina"), not by its id. The technical version already exists in this `docs/` folder.
- **Exact on-screen text.** Every button, tab, column, card and notice named in the manual must exist with that same text in the app's code — check with Grep before writing it down, and again whenever the screen's text changes.
- **What doesn't exist yet** gets mentioned once (typically in the module's "Conceptos básicos" page) as "todavía no disponible", never implied as working.

## Maintenance rule

Whenever a spec changes a screen that has a manual page, that same spec updates the page's content and its `updated` date — the manual describes the app as it is today, and a stale page is worse than no page. This is also called out in the main `CLAUDE.md`.

## Adding a new module's manual

1. Create `content/manual/<slug>/` with its pages (frontmatter + one of the templates above).
2. Register it in `lib/manual/modules.ts`: add an entry to `MANUAL_MODULES` with the module's existing access constant as `allowedRoleIds`.
3. Add its icon to `MANUAL_MODULE_ICONS` in `app/dashboard/ayuda/componentes/manualModuleIcons.ts`.
4. If the new module reaches a role that had no manual before, drop that role from the "Ayuda" entry's `excludeRoles` in `navConfig.tsx` (today `[2, 3, 5, 6]`, the complement of `MANUAL_VISIBLE_ROLE_IDS`) — and update the comment next to it.
5. If that role is one of the ones `proxy.ts` redirects away before it ever reaches `/dashboard/ayuda` (today roles 5 and 6, sent straight to Tratamientos / Inventario), adjust its exception there too, or the new manual will never be reachable for them.

Nothing else needs touching: the routes, the index, the sidebar entry and the role gate all read from this registry.
