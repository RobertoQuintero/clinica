# Nómina (payroll)

- Module under `app/dashboard/nomina/`. Today it only has **Periodos** (`nomina/periodos/`); `nomina/page.tsx` redirects to it. Calculation, receipts, dispersion and CFDI stamping are not built (specs 52+).
- Lives in the `payroll` schema (separate from `RH`, like `BILLING`). Besides `payroll.periods`, the schema holds catalogs not yet consumed: `cat_taxed_exempt`, `perceptions`, `tablas_retencion` (keyed by `id_payment_period` + `ejercicio`).

## Access

- Only `id_role` 1 and 4 (`PAYROLL_ALLOWED_ROLE_IDS` in `lib/payroll/constants.ts`).
- Gated in three places: `proxy.ts` (anything under `/dashboard/nomina` -> `/dashboard`), `navConfig.tsx` (`excludeRoles: [2, 3, 5, 6]`, the complement of the constant) and `assertPayrollAccess()` in `nomina/periodos/actions.ts` (every action returns `{ ok: false }` for other roles).
- The active branch comes from the `sel_sucursal` cookie with JWT fallback, never from client input. Each period belongs to a single branch.

## `payroll.periods`

- One row per period per branch: `id_sucursal`, `id_payment_period` (FK to `RH.payment_periods`, the SAT `c_PeriodicidadPago` catalog), `codigo`, `ejercicio`, `consecutivo`, four `date` columns (`fecha_inicio`, `fecha_fin`, `fecha_corte`, `fecha_pago`), `status`, and audit (`created_by`, `created_at`, `updated_at`).
- DDL is in `queries.txt` (block `NOMINA PAYROLL`). `CK_periods_fechas` enforces `inicio <= corte <= fin` and `pago >= corte`; `CK_periods_status` restricts `status` to 1..4.
- Types: `interfaces/payroll_period.ts`. All dates are plain strings (see the date/time rules in `CLAUDE.md`); SELECTs use `CONVERT(varchar(10|19), ..., 120)`.

## Frequencies

Only SAT keys with a code letter and a date rule are offered (`PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY`): 01 D, 02 S, 03 C, 04 Q, 05 M, 06 B, 10 X. Keys 07, 08, 09 and 99 are never offered. A frequency must also be active (`status = 1`) in `RH.payment_periods`. The frequency cannot be changed after creation.

## Period code

`NOM-{ejercicio}-{letter}{consecutivo, min. 2 digits}`, e.g. `NOM-2026-S38`.

- `ejercicio` is the year of `fecha_inicio`; a period crossing New Year counts in the year it starts.
- `consecutivo` is `MAX + 1` per branch + ejercicio + frequency, computed inside the create batch.
- The code is generated on the server, read-only, and never regenerated on edit.
- **Gaps are expected and the consecutivo is never reused**: deleting S05 means the next one is S07 if S06 already exists. The code is an identifier, not a fiscal folio.

## Suggested dates (`lib/payroll/periodDates.ts`)

`suggestPeriodDates(satKey, previousEndDate, today)` works on `"YYYY-MM-DD"` strings only.

- **Start:** day after the last period's end for that frequency in the branch. With no previous period: Monday of the current week (weekly), day 1 or 16 (biweekly), day 1 (monthly), today otherwise.
- **End:** weekly = start + 6; biweekly = day 15 or last day of month; monthly = last day of month; others = start + fixed length (01: 1, 03: 14, 06: 60, 10: 10).
- **Payment:** last Friday <= end. **Cutoff:** payment - 2 days (Wednesday), never before the start.
- Periods shorter than 7 days: payment = end and cutoff = end.
- The four dates are always editable; the suggestion is only a starting point.

## Validation and concurrency

- `lib/payroll/schemas.ts` (zod) validates date format, real calendar dates and order. Errors return as `ActionResult` and show in the modal.
- Overlap is rejected between periods of the **same frequency in the same branch**; different frequencies may overlap.
- `createPayrollPeriod` and `updatePayrollPeriod` run one SQL batch with `BEGIN TRAN` and `UPDLOCK, HOLDLOCK` (`db` does the check and write together; the explicit transaction is what keeps the locks held). `UQ_periods_consecutivo` is the last barrier; a race surfaces as "Intenta de nuevo", never a 500.

## Status

`status`: 1 Programada, 2 En cálculo, 3 Aprobada, 4 Pagada (`PAYROLL_PERIOD_STATUS`). Periods are only created as 1; there are no transitions yet.

- **Edit** changes only the four dates and `updated_at`, and only while `status = 1`.
- **Delete** is a physical `DELETE`, only while `status = 1`.
- Both re-check `id_sucursal` and `status = 1` inside the statement itself, so a stale UI cannot change a period that already moved on.

## UI

- `nomina/periodos/page.tsx` is a Server Component; filters live in the URL (`frecuencia`, `estatus`, `ejercicio`, `q`, `pagina`), 20 rows per page.
- Client components are limited to `PayrollPeriodsFilterBar`, `PayrollPeriodModal`, `PayrollPeriodActions` and `DeletePayrollPeriodButton`; the active-period card and the table are server-rendered.
