# Nómina (payroll)

- Module under `app/dashboard/nomina/`. It has **Periodos** (`nomina/periodos/`, spec 52), **Procesar nómina** (`nomina/procesar/`, spec 53) and the per-employee **Detalle** (`nomina/procesar/[id_empleado]/`, spec 54); `nomina/page.tsx` redirects to Periodos. Only the base salary is calculated. Bonuses, deductions (IMSS/ISR), attendance discounts, approval/payment, receipts, dispersion and CFDI stamping are not built.
- Lives in the `payroll` schema (separate from `RH`, like `BILLING`). Besides `payroll.periods` and `payroll.period_employees`, the schema holds catalogs not yet consumed: `cat_taxed_exempt`, `perceptions`, `tablas_retencion` (keyed by `id_payment_period` + `ejercicio`).

## Access

- Only `id_role` 1 and 4 (`PAYROLL_ALLOWED_ROLE_IDS` in `lib/payroll/constants.ts`).
- Gated in three places: `proxy.ts` (anything under `/dashboard/nomina` -> `/dashboard`), `navConfig.tsx` (`excludeRoles: [2, 3, 5, 6]`, the complement of the constant) and `assertPayrollAccess()` in `lib/payroll/access.ts` (server-only; every action in `periodos/actions.ts` and `procesar/actions.ts` returns `{ ok: false }` for other roles). `access.ts` also holds `ActionResult`, `IPayrollSession` and `PERIOD_ROW_SELECT`; it is not a `"use server"` file so none of it is exposed as a public action.
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

`status`: 1 Programada, 2 En cálculo, 3 Aprobada, 4 Pagada (`PAYROLL_PERIOD_STATUS`). Periods are created as 1. Today the only transitions are 1 -> 2 (calculate) and 2 <-> 2 / 2 -> 1 (recalculate / revert), see "Salary calculation". Approved (3) and Paid (4) are not reachable yet.

- **Edit** changes only the four dates and `updated_at`, and only while `status = 1`.
- **Delete** is a physical `DELETE`, only while `status = 1`.
- Both re-check `id_sucursal` and `status = 1` inside the statement itself, so a stale UI cannot change a period that already moved on. While a period is 2 (En cálculo) it can be neither edited nor deleted; revert it to 1 first.

## Salary calculation (spec 53)

Screen `/dashboard/nomina/procesar`; actions in `nomina/procesar/actions.ts`.

- **Table `payroll.period_employees`** (DDL in `queries.txt`): one snapshot row per period + employee + type (`tipo_nomina`: `'O'` operativa, `'F'` fiscal), with `salario_diario` used, `dias`, `importe_salario`, `calculated_by`, `calculated_at`. `UQ_period_employees` prevents duplicates and doubles as the index by `id_period`. The FK to `payroll.periods` has no cascade: a period can only be deleted at status 1, where it has no snapshot.
- **Who is included** (evaluated at calculation time): `RH.empleados` with `status = 1`, `activo = 1`, `id_sucursal` = the period's branch, `id_periodo_pago` = the period's `id_payment_period` and `fecha_ingreso <= fecha_fin`. **An employee without `id_periodo_pago` never enters payroll**, not even the excluded notice: capture the frequency in the employee record first.
- **Days:** `fecha_fin - max(fecha_inicio, fecha_ingreso) + 1`, calendar days. Absences and lateness are not discounted (future spec). No `fecha_baja` exists, so inactive employees are simply not included.
- **Amount:** `ROUND(salary * dias, 2)` per employee. Operativa uses `salario_diario`, fiscal uses `salario_diario_fiscal`; there is **no fallback** between them. An employee only enters a type when its salary is `> 0`, so they can be in one and not the other. Screen totals add the already-rounded amounts.
- **Snapshot:** it stores the salary used, so editing the employee record afterwards does not change a saved result until the period is recalculated.
- **Transitions** (each one is a single SQL batch with `BEGIN TRAN` and the period read `WITH (UPDLOCK, HOLDLOCK)`, checking branch and status inside the batch):
  - `calculatePayrollPeriod`: status 1 or 2 -> deletes the period's snapshot, inserts the `'O'` and `'F'` rows and leaves the period at 2. Used for both "Calcular" (1) and "Recalcular" (2).
  - `revertPayrollCalculation`: status 2 -> deletes the snapshot and returns the period to 1 so its dates can be edited again.
- **The calculation lives in SQL** (`INSERT ... SELECT`); `lib/payroll/salaryCalculation.ts` (`countPaidDays`, `calculateSalaryAmount`) restates the rule as pure string-based functions. If they diverge, the SQL is the source of truth.
- **Read side:** `getPayrollProcessPage(filters)` resolves the period (requested id in the active branch; otherwise the one whose range includes today; otherwise the most recent), returns the snapshot rows with puesto/search filters, unfiltered totals, puesto options and the "excluded" employees (eligible by branch and frequency but without the salary of the selected type, computed on the fly).

## UI

- `nomina/periodos/page.tsx` is a Server Component; filters live in the URL (`frecuencia`, `estatus`, `ejercicio`, `q`, `pagina`), 20 rows per page.
- Client components are limited to `PayrollPeriodsFilterBar`, `PayrollPeriodModal`, `PayrollPeriodActions` and `DeletePayrollPeriodButton`; the active-period card and the table are server-rendered. Each row of the table also links to Procesar (`/dashboard/nomina/procesar?periodo=ID`).
- `nomina/procesar/page.tsx` is a Server Component; state lives in the URL (`periodo`, `tipo=operativa|fiscal`, `puesto`, `q`). Server components: `PayrollProcessSummaryCards`, `PayrollEmployeesTable`, `ExcludedEmployeesNotice`. Client components: `PayrollProcessToolbar` (period select, type toggle, puesto select, debounced search) and `PayrollCalculationActions` (Calcular / Recalcular / Revertir, each behind an in-UI confirmation modal, no native `confirm()`).
- In `PayrollEmployeesTable` the employee name and a trailing "Ver detalle" icon column link to the detail below, keeping `periodo`, `tipo`, `puesto` and `q`. The table stays a Server Component.

## Detalle por empleado (spec 54)

Screen `/dashboard/nomina/procesar/[id_empleado]?periodo=ID&tipo=operativa|fiscal&puesto=&q=`; action `getPayrollEmployeeDetail(filters)` in `nomina/procesar/actions.ts`. Read-only: it only reads `payroll.period_employees`, `payroll.periods`, `RH.empleados` and `RH.puestos`.

- **Parameters:** `periodo` is required (no "current period" guessing). `tipo` defaults to `operativa`. `puesto` and `q` are only carried over for "Regresar" and Anterior / Siguiente. URLs are built with `buildPayrollProcessHref` / `buildPayrollEmployeeDetailHref` in `lib/payroll/processUrls.ts` (which also holds the `searchParams` readers shared with Procesar); empty or `null` params are omitted.
- **404 (`notFound()`)**: missing or non-numeric `periodo` or `id_empleado`, a period from another branch or nonexistent, or an employee that is neither from the period's branch nor has a snapshot row in the period. The snapshot rule keeps the detail reachable for someone who changed branch after the calculation.
- **What it shows:** breadcrumb, "Detalle de Nómina" with the period code, "Regresar", Anterior / Siguiente, the Operativa | Fiscal toggle (links, in the URL), the employee card (`EmployeeAvatar`, name, code, puesto, `EmployeeStatusBadge`, daily salary of the selected type from the snapshot, period range and payment date) and the "Percepciones totales" card (total, concept count, one row per line).
- **Perception lines:** built by `buildPerceptionLines(snapshot, fechaIngreso, fechaInicio)` in `lib/payroll/perceptionLines.ts`. Today it returns only `sueldo_base` ("N días × $X diarios", amount = `importe_salario` as stored, never recalculated in TS) with the note "Ingresó el DD/MM/AAAA, proporcional" when `fecha_ingreso > fecha_inicio` (string comparison, no `Date`). **New concepts (bonuses, commissions, …) are added there as new lines**; the card iterates the list and needs no layout change.
- **States:**
  - Period at status 1: notice "Esta nómina aún no se calcula" with a link to Procesar; no perceptions card and no Anterior / Siguiente.
  - No snapshot row for the selected type (status 2+): notice "Este empleado no está en la nómina {operativa|fiscal} de este periodo"; the toggle and employee card stay, daily salary shows "—", no Anterior / Siguiente.
- **Anterior / Siguiente:** `LAG`/`LEAD` over the snapshot of the same period and type, with the same puesto/search conditions (`buildPayrollEmployeeConditions`, shared with `getPayrollProcessPage`) and the same `ORDER BY` (`PAYROLL_EMPLOYEE_ORDER_BY`: `apellido_paterno, apellido_materno, nombre, id_empleado`). At either end the button is a non-link `<span aria-disabled="true">`. If the employee is not in the filtered set, there is no navigation.
- **Components** (`procesar/[id_empleado]/componentes/`, all Server Components, no `"use client"`): `PayrollEmployeeProfileCard`, `PayrollPerceptionsCard`, `PayrollTypeToggle`, `PayrollEmployeeNavigation`, `PayrollDetailNotice`. `EmployeeAvatar` lives in `empleados/componentes/` and is shared with the employee record header.
