# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Next.js (App Router) admin/clinic-management app for "Centro Podológico" — patients, treatments, appointments, sales, products, branches, and users, backed by SQL Server. UI text and identifiers are largely in Spanish (pacientes, citas, tratamientos, sucursales, ventas).

No test suite is configured in this repo.

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

- `database/connection.ts` exports a singleton `db` with `query(sql)` and `queryParams(sql, params)`. Always prefer `queryParams` for anything with user input — it maps JS values to typed SQL parameters (`sql.Bit`, `sql.Int`, `sql.DateTime2`, else `sql.NVarChar(sql.MAX)`), which is the only SQL-injection protection in place.
- All tables live under `[CentroPodologico].[dbo]`. There is no migration tool — schema changes happen directly against the DB.
- `queries.txt` at repo root has ad hoc SQL used during development.

### Mutations go through Server Actions, not API routes

- Almost all data mutation/reads happen via Next.js Server Actions (`"use server"` files named `actions.ts`), one per dashboard feature: `app/dashboard/<feature>/actions.ts` (citas, enlaces, pacientes, productos, servicios, sucursales, tratamientos, usuarios, ventas) plus `app/dashboard/actions.ts` and `app/actions/auth.ts`.
- `app/api/` only has a single real REST route (`app/api/upload`, for file/image upload to Cloudinary). Don't add new REST endpoints for CRUD — follow the server-action pattern instead.
- Actions commonly return a discriminated union like `ActionResult<T> = { ok: true; data: T } | { ok: false; message: string }` (see `app/actions/auth.ts`) — follow this convention for new actions so client code can branch on `result.ok`.

### Auth & authorization

- JWT-based auth using `jose`, stored in an `auth_token` cookie. Payload shape is `IAuthUser` (`interfaces/auth.ts`): includes `id_role`, `status` (approval state), `id_sucursal`, `id_empresa`, `sucursales_string` (comma-separated branch IDs the user can access).
- `proxy.ts` (used as Next.js middleware) verifies the JWT and does route-level redirects:
  - Unauthenticated → `/login`; authenticated-but-pending (`status` false) → `/pending`.
  - `id_role === 5` is restricted to `/dashboard/tratamientos` only.
  - `/dashboard/usuarios` is restricted to `id_role` 1 and 4.
  - When adding new role-gated routes, extend `proxy.ts` rather than gating purely client-side.
- `contexts/AuthContext.tsx` wraps client state around the server actions in `app/actions/auth.ts` (`loginAction`, `logoutAction`, `registerAction`, `getMeAction`).
- `lib/rateLimiter.ts` implements IP/email based lockout for login and registration (thresholds/windows imported into `auth.ts`).

### Multi-branch (sucursal) context

- `contexts/SucursalContext.tsx` tracks the currently selected branch (`id_sucursal`) client-side, seeded from an initial value and persisted via `setSelectedSucursal` (`app/dashboard/sucursales/actions.ts`). If a user only has access to one branch (`sucursales_string` has one entry), that branch is forced.
- Each branch (`sucursal`) has its own linked Google Calendar (`link_calendar` column) for scheduling citas — see `lib/googleCalendar.ts`.

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

### Directory conventions

- `app/dashboard/<feature>/` — one folder per feature (citas, pacientes, productos, servicios, sucursales, tratamientos, usuarios, ventas, enlaces), each with `page.tsx`, `actions.ts`, and a `componentes/` subfolder for feature-local components.
- `interfaces/` — one file per domain entity (`paciente.ts`, `cita.ts`, `tratamiento.ts`, etc.), plain TS interfaces mirroring DB rows/DTOs.
- `contexts/` — global client providers: `AuthContext`, `SucursalContext`, `ThemeContext`.
- `lib/` — cross-cutting server-side integrations (Google Calendar, rate limiter), as opposed to `utils/` which holds small pure helpers (date formatting, random ids).
- Path alias `@/*` maps to the repo root (see `tsconfig.json`).
