# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Next.js (App Router) admin/clinic-management app for "Centro Podológico" — patients, treatments, appointments, sales, products, branches, and users, backed by SQL Server. UI text and identifiers are largely in Spanish (pacientes, citas, tratamientos, sucursales, ventas).

No test suite is configured in this repo.

## Naming conventions

Function, variable, and component names must be written in English, be descriptive, and be humanly understandable (avoid abbreviations, single-letter names, or vague names like `data`, `item`, `handleClick2`). This applies even though UI text and domain identifiers elsewhere in the app (routes, DB columns, feature folders like `pacientes`, `citas`, `sucursales`) are in Spanish — code-level names (functions, variables, component names, hooks, types) should still be in English.

## UI/UX design

Always use the `frontend-design` skill when designing or building user interfaces (new UI, or reshaping existing UI).

## Next.js/React best practices (priority)

When writing or modifying any component or page, prioritize idiomatic Next.js (App Router) and React best practices, with performance and component reuse as primary concerns — not an afterthought:

- **Server vs Client Components**: default to Server Components; only add `"use client"` when the component actually needs interactivity, hooks, or browser APIs. Keep client boundaries as small/leaf-level as possible instead of marking whole pages client-side.
- **Reuse over duplication**: before writing a new component, check `app/dashboard/<feature>/componentes/` and any shared component folders for something already doing (or close to doing) the job. Extract shared UI/logic into reusable components/hooks rather than copy-pasting across features.
- **Data fetching**: fetch data in Server Components/Server Actions, not client-side `useEffect` + fetch, unless the data is genuinely client-driven (e.g. depends on client-only state like `SucursalContext`).
- **Avoid unnecessary re-renders/work**: memoize expensive computations (`useMemo`/`useCallback`) only when they demonstrably matter; prefer narrowing state and lifting it correctly over broad context re-renders; avoid prop drilling by leveraging existing contexts appropriately.
- **Lists**: use stable, unique `key` props (never array index for dynamic lists); paginate or virtualize large lists (citas, pacientes, ventas) rather than rendering everything at once.
- **Images/assets**: use `next/image` for images instead of raw `<img>` where practical.
- **Bundle size**: avoid importing large libraries client-side when a server-side or lighter alternative exists; use dynamic imports (`next/dynamic`) for heavy client-only components not needed on initial render.
- When reviewing or refactoring existing code, flag violations of the above (client components that could be server components, duplicated UI that should be a shared component, client-side fetching that should be a server action) even if not explicitly asked.

## Architecture

### Data layer: SQL Server via raw SQL, no ORM

**Always use `queryParams(sql, params)`** for user input — it's the only SQL-injection protection. All tables: `[CentroPodologico].[dbo]`.

### Mutations go through Server Actions, not API routes

- CRUD via Server Actions (`app/dashboard/<feature>/actions.ts`). `app/api/` has only `upload` and `asistencias/iclock/` (external webhooks) — no new REST endpoints for CRUD.
- **ActionResult pattern** (see `app/actions/auth.ts`): `{ ok: true; data: T } | { ok: false; message: string }`
- **Validation**: Use `zod` for any client input; define schemas near the action/route and parse before SQL.

### Auth & authorization

- JWT via `jose`, `auth_token` cookie, payload: `IAuthUser` (`id_role`, `status`, `id_sucursal`, `sucursales_string`).
- **Route gating in `proxy.ts`** (middleware), not client-side: `id_role === 5` → `/dashboard/tratamientos` only; `/dashboard/usuarios` → `id_role` 1 or 4.
- `AuthContext.tsx` wraps `app/actions/auth.ts` actions. Rate limiter in `lib/rateLimiter.ts`.

### Multi-branch (sucursal) context

- `SucursalContext.tsx` tracks selected branch; forced if user has only one. Each branch has a Google Calendar (`link_calendar`) — see `docs/google-calendar.md`.

### Domain modules with detailed docs (loaded on demand)

The sections below used to live inline here but are long and only relevant when a task actually touches that module. They now live under `docs/` — **read the relevant file only when the current task touches that area**; don't load them speculatively:

- HR — Employees (`empleados/`, `RH.empleados`, document/attendance tabs): `docs/rh-empleados.md`
- Attendance / biometric checadores (ZKTeco ADMS webhook, `app/api/asistencias/iclock/*`): `docs/asistencias-biometricas.md`
- Inventory (productos, proveedores, pedidos, recepciones, movimientos, conteos): `docs/inventario.md`
- Google Calendar integration internals (service account JWT, PKCS conversion, env vars): `docs/google-calendar.md`
- Billing / electronic invoicing (Facturapi, `BILLING` schema, API key encryption, audit log): `docs/facturacion.md`
- Payroll (`nomina/`, `payroll` schema, payroll periods, code and date rules): `docs/nomina.md`
- User manual / "Ayuda" section (`app/dashboard/ayuda/`, `content/manual/`, frontmatter, templates, callouts, adding a new module's manual): `docs/manual-usuario.md`
- Sucursal Demo (`npm run seed:demo`, `npm run capture:manual`, the isolated demo company that feeds the Nómina manual's screenshots): `docs/sucursal-demo.md`

### Manual de usuario (user manual)

- Every module-with-a-manual screen is paired with a page under `content/manual/<modulo>/`. **Any spec that changes a screen with a manual page must update that page's content and its `updated` date in the same spec** — the manual documents the app as it stands today, not as it stood when the page was written. See `docs/manual-usuario.md` for the structure, the frontmatter, the page templates, callout boxes, capture placeholders and how to add another module's manual.

### Date/time handling (critical, mssql-specific)

`mssql` shifts JS `Date` objects to UTC on serialization, which corrupts wall-clock times for this Mexico-City-timezone clinic. **All date/datetime values must flow as plain strings, never `Date` objects**, end-to-end. Helpers live in `utils/date_helpper.ts`:

| Helper | Purpose |
|---|---|
| `toDBString(val)` | form/DB string → SQL-Server-safe `"YYYY-MM-DD HH:mm:ss"` (or `null`) |
| `toDateTimeLocal(val)` | DB/ISO string → `<input type="datetime-local">` value `"YYYY-MM-DDTHH:mm"` |
| `addZeroToday(date)` | local `Date` → `"YYYY-MM-DD"` (uses `America/Mexico_City`, not UTC) |
| `buildDate(date)` | local `Date` → `"YYYY-MM-DD HH:mm:ss"` (uses `America/Mexico_City`, not UTC) |

Rules when touching any code with `fecha*`/`created_at`/date fields:

1. **SELECT**: cast date columns with `CONVERT(varchar(19), [col], 120)` (datetime) or `CONVERT(varchar(10), [col], 120)` (date-only) so mssql never returns a JS `Date`.
2. **Server action / write path**: pass fields through `toDBString(String(val ?? ""))`, never `new Date(val)`.
3. **Form inputs**: bind `datetime-local` values with `toDateTimeLocal(...)`; bind `date` values with `String(val ?? "").slice(0, 10)`.
4. **Display/formatting**: never call `new Date(dbValue)` directly on a raw DB string — normalize first (replace `" "` with `"T"`, or append `"T00:00:00"` for date-only) so the browser parses it as local time, not UTC.
5. **New timestamps**: use `buildDate(new Date())`, not `new Date().toISOString()`. For date-only defaults use `addZeroToday(new Date())`, not `.toISOString().slice(0, 10)` (wrong around midnight due to UTC offset).

### Directory conventions (overview)

- **`app/dashboard/<feature>/`** — feature structure: `page.tsx`, `actions.ts`, `componentes/` subfolder. See `[[directory-structure]]` for full layout.
- **`interfaces/`** — one file per domain entity; plain TS interfaces mirroring DB rows.
- **`contexts/`** — global client providers: `AuthContext`, `SucursalContext`, `ThemeContext`.
- **`hooks/`** — reusable client hooks on `useSyncExternalStore`. Check here before reading browser APIs.
- **`lib/`** — server-side integrations; `utils/` for small pure helpers.
- **`content/manual/<modulo>/`** — user manual pages for `/dashboard/ayuda` (see `docs/manual-usuario.md`).
- **Path alias** `@/*` maps to repo root.
