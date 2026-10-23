# Sucursal Demo (spec 93)

A development-only demo company ("Empresa Demo" / "Sucursal Demo") that seeds fictitious payroll
data and drives the real app with Playwright to produce the 19 screenshots the Nómina manual
shows in place of its `captura:` markers (see "Capture placeholders" in `docs/manual-usuario.md`).

## What the demo contains

- A company and branch of their own, isolated from the real company by `id_empresa`/`id_sucursal`
  on every table — a real-company user never sees the demo's branch, employees, products, periods
  or PTU distribution in any screen.
- 7 fixed employees (`scripts/demo/constants.ts`, `DEMO_EMPLOYEES`): 3 podólogos (each linked to a
  role-2 user account), a recepcionista, a gerente de recepción (PTU category "C", trust cap), an
  auxiliar de podología hired mid-year (proportional aguinaldo), and a socio-director (PTU
  category "X", excluded). Only the podólogos get a linked user account, per the data model; the
  admin "Usuario Demo" (role 1) captures counter sales and everything a podólogo's account doesn't.
- A full year of deterministic checadas (entrada/salida) for every employee, Monday–Saturday, from
  each employee's `fecha_ingreso` through yesterday, with a handful of scripted scenario days in
  the most recently completed Monday–Saturday week: overtime (2 days), an incomplete punch (entry
  with no exit), lateness (one accumulable, one severe) and absence (one full day, no punch at
  all) for different podólogos, plus a shift-extension assignment.
- Patients, one rotating consulta per workday across the 3 podólogos (with a product line on every
  third one), a dedicated onychomycosis treatment whose partial payments cross the liquidation
  threshold inside that same scenario week, 3 demo products with `bono_venta`, and a counter sale.
- Every weekly period of the current year (including the in-progress one, left "Programada"), the
  year's aguinaldo period, and the year's PTU distribution in draft with its parameters set but not
  yet preloaded.
- Spec 95: of the already-calculated weekly periods, one (the oldest) is left calculated and
  untouched — "En cálculo" with no pending recalculation, for the approve screenshot — a second one
  ends **Aprobada** and stays there, and a third goes through the full approve → desaprobar (with a
  motivo) → re-approve → pay cycle and ends **Pagada**, with its four-row "Historial de estatus".
  The most recently completed week is left alone, with a pending "Recalcula" notice and never
  approved — approving it would freeze the Horas extra/Faltas/Retardos captures that rely on it
  still being editable.

## The lock (`ALLOW_DEMO_SEED`, `DEMO_USER_PASSWORD`)

Both scripts refuse to run without `ALLOW_DEMO_SEED=true` in `.env.local`. With it set, `seed:demo`
prints `DB_HOST`/`DB_NAME` and asks you to type `demo` to continue — a deliberate, unmissable step
before writing to whatever database `.env.local` currently points at. Never set `ALLOW_DEMO_SEED`
in a production environment. `DEMO_USER_PASSWORD` is required by both scripts: `seed:demo` hashes
and stores it on "Usuario Demo", and `capture:manual` uses it to log in as that same user.

## Running it

```bash
npm run seed:demo              # siembra (o reconstruye) la Empresa Demo
npm run dev                    # en otra terminal: la app real que Playwright va a manejar
npm run capture:manual         # abre Chromium, prepara y captura las 19 pantallas
```

`capture:manual` reads `MANUAL_CAPTURE_BASE_URL` (default `http://localhost:3000`), so point it at
whatever `npm run dev` is actually serving. It is idempotent: periods and the PTU distribution it
finds already calculated/closed are left alone, so a failed run can simply be run again.

## Removing it

```bash
npm run seed:demo -- --remove
```

Deletes the Empresa Demo and everything that hangs off it, in foreign-key order
(`scripts/demo/removeDemo.ts`). It resolves the company by the exact name `"Empresa Demo"` **and**
requires the user `demo@centropodologico.test` to belong to it; if a real company happens to be
named "Empresa Demo" without that user, `--remove` (and a fresh `seed:demo`, which removes before
recreating) aborts without deleting anything. Re-running `seed:demo` without `--remove` does the
same removal before seeding again, inside one transaction — a failure partway through leaves the
previous demo exactly as it was.

## Adding a new capture

1. Add the `![Descripción](captura:nombre-nuevo)` marker to the relevant page in
   `content/manual/nomina/*.md`.
2. Add a matching entry to `NOMINA_MANUAL_CAPTURES` in `scripts/manual-captures/nomina.ts`: the
   route to open (`path`, as a function of `IManualCaptureContext`), the crop (`target`: `"content"`
   for the whole content area, or `{ locator }` for one element — add a `data-manual-capture="..."`
   attribute to the component if there's no other reliable selector), and which `preparedState` the
   capture needs.
3. If that `preparedState` isn't one of the six `scripts/manual-captures/prepare.ts` already
   produces (`latestCalculatedPeriod`, `recalculationPending`, `christmasBonusCalculated`,
   `ptuDistributionClosed`, `approvedPeriod`, `paidPeriod`), extend `prepareManualCaptures` to set
   it up and return its id in `periodIdsByState`. A capture that isn't backed by any
   `ManualCapturePreparedState` (for example, one more "plain calculated, untouched" period) can
   instead be added as its own field on `IManualCaptureContext`, the way `readyToApprovePeriodId`
   is — `preparedState` is purely documentation, never read by the capture script itself.
4. If the element needs an interaction before the photo (opening a `<details>`, for example), add
   a `beforeCapture?: (page: Page) => Promise<void>` to its definition; it runs right after the page
   finishes loading and before the element is measured.
5. Run `npm run capture:manual` again — it validates that every marker has a definition and every
   definition has a marker before opening the browser, so a mismatch fails fast with the name.

## The January/February limitation

The seed always starts attendance and the weekly periods at 1 January of the **current** year.
Running it in the first days of January means there is no "most recently completed week" yet
(the current week is the first one of the year), so the scenario days, the onychomycosis
settlement and the counter sale — all anchored to that week — have nowhere to land, and
`capture:manual`'s preparation step will have very little or no calculated history to work with
until at least one full Monday–Saturday week has elapsed in the new year. There is no workaround
beyond waiting a week or two into January before (re)seeding.
