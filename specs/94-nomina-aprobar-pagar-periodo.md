# 94 — Aprobar y pagar periodos de nómina

## Header

- **Estado:** Aprobado
- **Depende de:**
  - 52 (`nomina-periodos`): `payroll.periods`, `CK_periods_status` (1..4), `PAYROLL_PERIOD_STATUS`, el listado y el badge de estatus.
  - 53 (`nomina-calculo-salario`): `calculatePayrollPeriod`, `revertPayrollCalculation`, el patrón `BEGIN TRAN` + `UPDLOCK, HOLDLOCK` y `PayrollCalculationActions`.
  - 60, 62, 63 (`horas-extra`, `faltas`, `retardos`): los candados `status !== 1 && status !== 2` que ya congelan esas pantallas.
  - 70, 73, 87, 90, 91: los once avisos "Recalcula" (`is*RecalculationNeeded`), que solo se evalúan en estatus 2.
- **Modifica base de datos:** Sí.
  - `payroll.periods` gana cuatro columnas de sello (`approved_by`, `approved_at`, `paid_by`, `paid_at`) y un `CHECK` que las amarra al estatus.
  - Tabla nueva `payroll.period_status_log` con el historial de cambios de estatus y el motivo de cada desaprobación.
  - **No** cambia `CK_periods_status`: ya acepta 1..4.
- **Fecha:** 2026-10-22
- **Objetivo:** Hacer alcanzables los estatus Aprobada (3) y Pagada (4) de un periodo de nómina, con desaprobación justificada (3 → 2), sello de quién y cuándo, y bitácora de cada cambio.

### Contexto (2026-10-22)

- `PAYROLL_PERIOD_STATUS` declara los cuatro estatus desde la spec 52, pero **nadie escribe 3 ni 4**: el periodo llega a 2 al calcular y vuelve a 1 al revertir. `CK_periods_status CHECK ([status] BETWEEN 1 AND 4)` ya los permite, así que el estatus en sí no necesita DDL.
- Todos los candados existentes están escritos como lista blanca de 1 y 2 (`status !== 1 && status !== 2` en TypeScript, `status IN (1, 2)` o `status = 2` en SQL), nunca como `>= 3`. Consecuencia: **el día que un periodo llegue a 3, Horas extra, Faltas, Retardos, Recalcular, Revertir, Editar y Eliminar quedan congelados solos**, sin tocar esos archivos. Esta spec lo verifica, no lo reescribe.
- `PayrollCalculationActions` decide qué botones muestra con `ACTIONS_BY_STATUS = { 1: ["calculate"], 2: ["recalculate", "revert"] }` y devuelve `null` para cualquier otro estatus. Es el punto de extensión natural: ya tiene el diálogo `role="alertdialog"`, el manejo de `{ ok: false, message }` y el `router.refresh()`.
- Los once avisos "Recalcula" consultan `WHERE id_period = @id_period AND status = 2`, así que **se apagan solos al aprobar**. Por eso el candado de aprobación es precisamente "no debe haber ningún aviso Recalcula pendiente": es la última ventana en la que el sistema puede detectar que el snapshot quedó viejo.
- `findPtuDistributionPayrollUsage` ya bloquea "Reabrir" un reparto de PTU con `p.status >= 2`, así que aprobar y pagar lo mantienen bloqueado. Esto cierra el riesgo que la spec 90 dejó anotado ("Revertir después de pagar fuera del sistema"): en estatus 3 ya no se puede revertir sin desaprobar antes, y en 4 no se puede en absoluto.
- Nada consume todavía el estatus Pagada: no existen recibos, dispersión ni timbrado. Esta spec solo cierra el ciclo de vida del periodo; el valor inmediato es que el snapshot deja de poder cambiar y queda registrado quién lo autorizó.
- El manual de usuario afirma hoy en cinco páginas que Aprobada y Pagada "todavía no están disponibles". Se corrige en una spec de manual aparte, no aquí.

## Alcance

**Entra:**

- **Transiciones.** Tres, y solo tres:
  - **Aprobar**: 2 → 3.
  - **Marcar como pagada**: 3 → 4.
  - **Desaprobar**: 3 → 2, con comentario obligatorio.
  - **Pagada (4) es definitiva.** No hay 4 → 3 ni ninguna salida; un periodo pagado no se recalcula, no se revierte, no se edita y no se elimina.
- **Permisos.** Los mismos de todo Nómina: `id_role` 1 y 4 (`PAYROLL_ALLOWED_ROLE_IDS`), con los tres candados de siempre (`proxy.ts`, `navConfig.tsx`, `assertPayrollAccess()`). Las tres acciones son idénticas en permisos: quien aprueba también puede pagar y desaprobar.
- **Candado para aprobar.** Un periodo no se puede aprobar si **algún aviso "Recalcula" está activo**. Se revisa en el servidor con las mismas once funciones que pinta la pantalla, y el botón aparece deshabilitado con el motivo.
- **Advertencias que no bloquean** (se listan en el modal de confirmación, en ámbar):
  - filas fiscales con ISR o IMSS "No calculado" (`isr_estado = 'N'` / `imss_estado = 'N'`), con el conteo de empleados;
  - el periodo no tiene ningún empleado calculado;
  - al pagar, `fecha_pago` todavía no llega ("La fecha de pago del periodo es el DD/MM/AAAA; aún no llega").
- **Sello en `payroll.periods`.** Cuatro columnas nuevas con el estado actual: `approved_by` / `approved_at` y `paid_by` / `paid_at`, amarradas al estatus por un `CHECK`. Desaprobar limpia el sello de aprobación; el historial queda en la bitácora.
- **Bitácora `payroll.period_status_log`.** Una fila por cambio de estatus de los tres anteriores, con estatus anterior y nuevo, comentario, `changed_by` y `changed_at`. Un `CHECK` acepta solo las tres transiciones y exige comentario cuando el nuevo estatus es 2.
- **UI, toda en Procesar** (`/dashboard/nomina/procesar`):
  - los botones **Aprobar**, **Marcar como pagada** y **Desaprobar** viven en `PayrollCalculationActions`, junto a Calcular / Recalcular / Revertir, cada uno con su confirmación propia (sin `confirm()` nativo);
  - el modal de **Desaprobar** incluye un `<textarea>` con el motivo (5 a 200 caracteres, obligatorio);
  - en el encabezado, el **sello**: "Aprobada por {nombre} el DD/MM/AAAA HH:mm" y, en estatus 4, también "Pagada por {nombre} el …";
  - un `<details>` **"Historial de estatus"** con todos los cambios, su autor, su fecha y el motivo de las desaprobaciones, siguiendo el patrón de `OvertimeSettingsLog`.
- **Listado de Periodos.** Sin cambios funcionales: el badge ya distingue Aprobada (ámbar) y Pagada (verde), el filtro de estatus ya ofrece los cuatro y las acciones de la fila ya se limitan a estatus 1.
- **Refactor de reutilización.** Las once llamadas `is*RecalculationNeeded` se extraen de `getPayrollProcessPage` a `lib/payroll/recalculationChecks.ts` (`collectRecalculationFlags`), de modo que la pantalla y la acción de aprobar usen **una sola copia** de la regla.
- **Validación.** `zod` para las tres entradas; el comentario se valida en el schema y otra vez en el `CHECK`.
- **Documentación.** `docs/nomina.md` (sección "Status", nueva sección "Aprobación y pago (spec 94)", y el "Out of scope" de las specs 70, 73, 77, 80, 87, 89, 90 y 91 donde dicen "los estatus Aprobada/Pagada") y el DDL en `queries.txt`.

**Fuera de alcance:**

- **Manual de usuario.** No se toca `content/manual/nomina/`. Las cinco páginas que hoy dicen "todavía no disponible" (`conceptos-basicos.md`, `periodos.md`, `procesar-nomina.md`, `avisos-y-preguntas.md`, `tutorial-nomina-ordinaria.md`) se actualizan en una spec de manual aparte.
- Recibos de nómina, timbrado del CFDI, dispersión bancaria y layouts para el banco.
- Aprobar o pagar **por tipo de nómina** (operativa y fiscal por separado), por empleado o por grupo: el estatus es del periodo completo.
- Aprobar o pagar **varios periodos a la vez** desde el listado.
- Captura de datos del pago real (fecha efectiva, referencia de transferencia, lote, método). Pagar solo registra quién y cuándo.
- Un flujo de dos firmas (que apruebe un rol y pague otro), notificaciones o correos.
- Bloquear `setShiftExtensionAssignment` (Bonos) cuando el día cae en un periodo aprobado: hoy la asignación se puede cambiar siempre. Queda anotado como riesgo.
- Cambiar los candados existentes de Horas extra, Faltas y Retardos: ya congelan en 3 y 4; esta spec solo lo verifica.
- Registrar en la bitácora las transiciones 1 → 2 y 2 → 1 (calcular y revertir).
- Reabrir un periodo pagado por cualquier vía, incluida una corrección contable posterior.
- Avisos de "periodo listo para aprobar" o de "periodo aprobado sin pagar desde hace N días".

## Modelo de datos

### SQL (DDL en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 91)

```sql
-- Spec 94: sello de aprobación y de pago del periodo. Los periodos existentes quedan sin sello.
ALTER TABLE [payroll].[periods] ADD
    [approved_by] [int]          NULL,
    [approved_at] [datetime2](0) NULL,
    [paid_by]     [int]          NULL,
    [paid_at]     [datetime2](0) NULL;
GO
ALTER TABLE [payroll].[periods] ADD
    CONSTRAINT [FK_periods_approved_by] FOREIGN KEY ([approved_by]) REFERENCES [dbo].[users] ([id_user]),
    CONSTRAINT [FK_periods_paid_by]     FOREIGN KEY ([paid_by])     REFERENCES [dbo].[users] ([id_user]),
    -- El sello y el estatus no pueden contradecirse: 1 y 2 sin sello, 3 aprobado, 4 aprobado y pagado.
    CONSTRAINT [CK_periods_sello_estatus] CHECK (
        ([status] <= 2 AND [approved_by] IS NULL AND [approved_at] IS NULL
                       AND [paid_by] IS NULL AND [paid_at] IS NULL)
     OR ([status] = 3  AND [approved_by] IS NOT NULL AND [approved_at] IS NOT NULL
                       AND [paid_by] IS NULL AND [paid_at] IS NULL)
     OR ([status] = 4  AND [approved_by] IS NOT NULL AND [approved_at] IS NOT NULL
                       AND [paid_by] IS NOT NULL AND [paid_at] IS NOT NULL));
GO

-- Spec 94: bitácora de cambios de estatus del periodo. Solo las tres transiciones de aprobación.
-- Se borra junto con el periodo (que solo se puede borrar en estatus 1, donde no tiene filas).
CREATE TABLE [payroll].[period_status_log](
    [id_period_status_log] [int] IDENTITY(1,1) NOT NULL,
    [id_period]            [int]           NOT NULL,
    [status_anterior]      [tinyint]       NOT NULL,
    [status_nuevo]         [tinyint]       NOT NULL,
    [comentario]           [nvarchar](200) NULL,     -- obligatorio al desaprobar (3 -> 2)
    [changed_by]           [int]           NOT NULL,
    [changed_at]           [datetime2](0)  NOT NULL,
 CONSTRAINT [PK_period_status_log] PRIMARY KEY CLUSTERED ([id_period_status_log] ASC),
 CONSTRAINT [FK_period_status_log_period] FOREIGN KEY ([id_period])
     REFERENCES [payroll].[periods] ([id_period]) ON DELETE CASCADE,
 CONSTRAINT [FK_period_status_log_user] FOREIGN KEY ([changed_by])
     REFERENCES [dbo].[users] ([id_user]),
 CONSTRAINT [CK_period_status_log_transicion] CHECK (
     ([status_anterior] = 2 AND [status_nuevo] = 3)     -- aprobar
  OR ([status_anterior] = 3 AND [status_nuevo] = 4)     -- marcar como pagada
  OR ([status_anterior] = 3 AND [status_nuevo] = 2)),   -- desaprobar
 CONSTRAINT [CK_period_status_log_comentario] CHECK (
     [status_nuevo] <> 2
  OR ([comentario] IS NOT NULL AND LEN(LTRIM(RTRIM([comentario]))) >= 5))
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_period_status_log_period]
    ON [payroll].[period_status_log] ([id_period], [changed_at] DESC)
GO
```

**Sin DDL:**

- `CK_periods_status` no cambia: ya es `BETWEEN 1 AND 4`.
- No se añade ninguna columna a `payroll.period_employees`: el snapshot no cambia al aprobar.

### TypeScript

- `interfaces/payroll_period.ts`:

```ts
// Spec 94: sello del ciclo de vida. Null mientras el periodo no llega a ese estatus.
export interface IPayrollPeriod {
  // …campos actuales…
  approved_by: number | null;
  approved_at: string | null;   // "YYYY-MM-DD HH:mm:ss"
  paid_by:     number | null;
  paid_at:     string | null;
}

export type PeriodStatusTransition = "approve" | "pay" | "unapprove";

// Sello con nombres resueltos, para el encabezado de Procesar.
export interface IPayrollPeriodStatusStamp {
  approved_by_name: string | null;
  approved_at:      string | null;
  paid_by_name:     string | null;
  paid_at:          string | null;
}

export interface IPayrollPeriodStatusLogEntry {
  id_period_status_log: number;
  status_anterior:      PayrollPeriodStatus;
  status_nuevo:         PayrollPeriodStatus;
  comentario:           string | null;
  changed_by_name:      string;
  changed_at:           string;   // "YYYY-MM-DD HH:mm:ss"
}
```

- `PERIOD_ROW_SELECT` (`lib/payroll/access.ts`) gana las cuatro columnas, con `CONVERT(varchar(19), …, 120)` en las dos fechas. Es la única copia del SELECT de periodos, así que Periodos, `resolvePeriod` y Procesar las reciben de una vez.
- El payload de `getPayrollProcessPage` gana `statusStamp: IPayrollPeriodStatusStamp | null` (solo se consulta en estatus 3 y 4) y `recalculationNeeded: boolean` (el `or` de las once banderas, que ya devuelve una por una).

### Constantes y lógica pura

`lib/payroll/periodStatus.ts` (nuevo, puro, sin DB):

```ts
export const PERIOD_STATUS_TRANSITIONS: Record<
  PeriodStatusTransition,
  { from: PayrollPeriodStatus; to: PayrollPeriodStatus }
> = {
  approve:   { from: 2, to: 3 },
  pay:       { from: 3, to: 4 },
  unapprove: { from: 3, to: 2 },
};

/** Transiciones posibles desde un estatus. El 1 y el 4 no tienen ninguna. */
export function getAvailableStatusTransitions(status: PayrollPeriodStatus): PeriodStatusTransition[];

export const UNAPPROVE_COMMENT_MIN_LENGTH = 5;
export const UNAPPROVE_COMMENT_MAX_LENGTH = 200;
```

`lib/payroll/constants.ts` gana `PERIOD_STATUS_TRANSITION_LABELS` (`approve: "Aprobar"`, `pay: "Marcar como pagada"`, `unapprove: "Desaprobar"`).

`lib/payroll/recalculationChecks.ts` (nuevo, `server-only`): `collectRecalculationFlags(period)` devuelve el objeto con las once banderas que hoy arma `getPayrollProcessPage` en su `Promise.all`, respetando las mismas condiciones por tipo de periodo (`isOrdinaryPeriod ? … : false` y la rama extraordinaria).

`lib/payroll/periodStatusLog.ts` (nuevo, `server-only`): `loadPeriodStatusStamp(idPeriod)` y `loadPeriodStatusLog(idPeriod)`, ambos con `LEFT JOIN [dbo].[users] u ON u.id_user = …` e `ISNULL(u.nombre, '')`, igual que los demás lectores de bitácora del módulo.

### Acciones (`app/dashboard/nomina/procesar/actions.ts`)

```ts
export async function approvePayrollPeriod(input: unknown): Promise<ActionResult<null>>;
export async function payPayrollPeriod(input: unknown): Promise<ActionResult<null>>;
export async function unapprovePayrollPeriod(input: unknown): Promise<ActionResult<null>>;
export async function getPayrollPeriodStatusLog(idPeriod: number): Promise<ActionResult<IPayrollPeriodStatusLogEntry[]>>;
```

Schemas en `lib/payroll/schemas.ts`: `approvePayrollPeriodSchema` y `payPayrollPeriodSchema` (copia de `calculatePayrollPeriodSchema`) y `unapprovePayrollPeriodSchema`, que añade `comentario: z.string().trim().min(5, …).max(200, …)`.

Cada una corre un solo batch con el patrón de `revertPayrollCalculation`:

```sql
SET XACT_ABORT ON;
BEGIN TRAN;

IF NOT EXISTS (
  SELECT 1 FROM [CentroPodologico].[payroll].[periods] WITH (UPDLOCK, HOLDLOCK)
   WHERE id_period = @id_period AND id_sucursal = @id_sucursal AND status = @from_status
)
  THROW 50005, '<MARCADOR>', 1;

UPDATE [CentroPodologico].[payroll].[periods]
   SET status = @to_status, approved_by = …, approved_at = …, updated_at = CAST(@changed_at AS datetime2(0))
 WHERE id_period = @id_period;

INSERT INTO [CentroPodologico].[payroll].[period_status_log]
  (id_period, status_anterior, status_nuevo, comentario, changed_by, changed_at)
VALUES (@id_period, @from_status, @to_status, @comentario, @changed_by, @changed_at);

COMMIT;
```

Marcadores y mensajes, siguiendo `describePayrollCalculationError`:

| Marcador | Mensaje |
|---|---|
| `PERIOD_NOT_APPROVABLE` | "El periodo no existe en esta sucursal o ya no está en estatus En cálculo" |
| `PERIOD_NOT_PAYABLE` | "El periodo no existe en esta sucursal o ya no está en estatus Aprobada" |
| `PERIOD_NOT_UNAPPROVABLE` | "El periodo no existe en esta sucursal o ya no está en estatus Aprobada" |
| `PERIOD_NEEDS_RECALCULATION` | "Recalcula la nómina antes de aprobarla: el cálculo guardado ya no coincide con los datos actuales" |

Las tres llaman `revalidatePayrollPaths()` al terminar. `approvePayrollPeriod` corre `collectRecalculationFlags` **antes** de abrir la transacción y aborta con `PERIOD_NEEDS_RECALCULATION` si alguna bandera es verdadera.

### Convenciones

- El estatus de origen y la sucursal se validan **dentro** de la lectura bloqueada, nunca con lo que mande el cliente; `id_user` sale de `assertPayrollAccess()`.
- `changed_at` y `updated_at` se generan con `buildDate(new Date())` y viajan como string.
- `approved_at` / `paid_at` se leen con `CONVERT(varchar(19), …, 120)` y se muestran con `formatDateTimeSlashed` (`lib/payroll/moneyFormat.ts`).
- Desaprobar pone `approved_by` y `approved_at` en `NULL` en el mismo `UPDATE`, para no violar `CK_periods_sello_estatus`.

## Plan de implementación

1. **DDL.**
   - Se agregan a `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 91: las cuatro columnas de sello con sus FK y `CK_periods_sello_estatus`, la tabla `period_status_log` con sus dos `CHECK` y su índice.
   - Se ejecuta contra la base de desarrollo.
   - *Verificación:*
     - Todos los periodos existentes quedan con los cuatro campos en `NULL` y su estatus intacto.
     - A mano: `UPDATE … SET status = 3` sin sello falla por `CK_periods_sello_estatus`; con sello completo entra.
     - Un `INSERT` en la bitácora con transición 1 → 3, o con 3 → 2 sin comentario, falla; las tres transiciones válidas entran.

2. **Tipos, constantes y lógica pura, sin UI ni acciones.**
   - `interfaces/payroll_period.ts` (los cuatro campos, `PeriodStatusTransition`, `IPayrollPeriodStatusStamp`, `IPayrollPeriodStatusLogEntry`).
   - `lib/payroll/periodStatus.ts`, `PERIOD_STATUS_TRANSITION_LABELS` y los tres schemas de `zod`.
   - `PERIOD_ROW_SELECT` devuelve las cuatro columnas.
   - *Verificación:* `npx tsc --noEmit` y `npm run lint` limpios; Periodos y Procesar siguen funcionando igual; `getAvailableStatusTransitions` devuelve `[]` para 1 y 4, `["approve"]` para 2 y `["unapprove", "pay"]` para 3.

3. **Refactor de los avisos "Recalcula" a una sola copia.**
   - `lib/payroll/recalculationChecks.ts` con `collectRecalculationFlags(period)`; `getPayrollProcessPage` lo usa en lugar de su `Promise.all` de once llamadas y expone además `recalculationNeeded`.
   - *Verificación:* con un periodo en estatus 2 y una justificación de falta capturada después del cálculo, el aviso de Faltas sale igual que antes; `recalculationNeeded` es `true`. Sin cambios pendientes, los once avisos están ocultos y `recalculationNeeded` es `false`.

4. **Las tres acciones de servidor, todavía sin botones.**
   - `approvePayrollPeriod`, `payPayrollPeriod`, `unapprovePayrollPeriod` y `getPayrollPeriodStatusLog` en `procesar/actions.ts`, con sus marcadores en `describePayrollCalculationError` y `lib/payroll/periodStatusLog.ts`.
   - *Verificación* (llamándolas desde un script temporal del scratchpad o desde la consola del navegador con sesión de rol 1):
     - estatus 2 sin avisos → aprueba, el sello se llena y la bitácora tiene una fila 2 → 3;
     - estatus 2 con un aviso activo → `{ ok: false }` con el mensaje de recalcular y nada escrito;
     - aprobar dos veces → la segunda falla con "ya no está en estatus En cálculo";
     - pagar desde 3 → sello de pago y fila 3 → 4; desde 2 o 4 falla;
     - desaprobar sin comentario o con 4 caracteres → falla en `zod`; con motivo válido → estatus 2, `approved_by` y `approved_at` en `NULL` y fila 3 → 2 con el motivo;
     - con rol 2, 3, 5 o 6 → `{ ok: false, message: "No tienes permisos…" }`;
     - un periodo de otra sucursal → el mismo mensaje que uno inexistente.

5. **Botones y modales en Procesar.**
   - `PayrollCalculationActions` extiende `ACTIONS_BY_STATUS` a `{ 1: ["calculate"], 2: ["recalculate", "revert", "approve"], 3: ["unapprove", "pay"], 4: [] }` y devuelve `null` cuando la lista está vacía.
   - Nuevos props: `recalculationNeeded`, `warnings: string[]` y `fechaPago`. Con `recalculationNeeded`, **Aprobar** se renderiza deshabilitado con el motivo por `aria-describedby`, igual que `PtuDistributionStatusActions` hace con `reopenBlockedReason`.
   - El modal muestra las advertencias ámbar que correspondan y, para `unapprove`, un `<textarea>` obligatorio con contador de caracteres; el botón de confirmar queda deshabilitado mientras el motivo no llegue a 5 caracteres.
   - Copys: "¿Aprobar {código}?" / "Al aprobar, el cálculo queda congelado: ya no se podrá recalcular, revertir ni cambiar faltas, retardos u horas extra del periodo."; "¿Marcar {código} como pagada?" / "Pagada es definitiva: el periodo no se podrá desaprobar ni revertir."; "¿Desaprobar {código}?" / "El periodo regresa a En cálculo y se podrá recalcular. Escribe el motivo." (variante destructiva).
   - `procesar/page.tsx` pasa los nuevos props y calcula las advertencias con los datos que ya tiene (`isrNotCalculated`, `imssNotCalculated`, `totals`, `fecha_pago`, `today`).
   - Se usa la skill `frontend-design` para el modal y el estado deshabilitado.
   - *Verificación:*
     - en estatus 1 solo se ve Calcular (en el estado vacío) y en 4 no se ve ningún botón ni un contenedor vacío en el encabezado;
     - en 2 se ven Recalcular, Revertir y Aprobar; con un aviso activo, Aprobar está deshabilitado y su motivo es legible con lector de pantalla;
     - al pagar antes de `fecha_pago` sale la advertencia y se puede confirmar;
     - con filas de ISR o IMSS en "No calculado", el modal dice cuántos empleados son;
     - un error del servidor se muestra dentro del modal y el periodo no cambia.

6. **Sello e historial en el encabezado de Procesar.**
   - `PayrollPeriodStatusStamp` (Server Component nuevo en `procesar/componentes/`) muestra "Aprobada por {nombre} el DD/MM/AAAA HH:mm" y, en estatus 4, la línea de pago; se oculta sin sello.
   - `PayrollPeriodStatusLog` (Server Component nuevo) es un `<details>` "Historial de estatus" alimentado por `getPayrollPeriodStatusLog`, con una fila por cambio ("En cálculo → Aprobada", autor, fecha y el motivo cuando existe). Devuelve `null` si no hay filas, así que un periodo que nunca se aprobó no muestra nada.
   - Se usa `frontend-design`.
   - *Verificación:* tras aprobar → desaprobar → aprobar → pagar, el sello muestra la **última** aprobación y el pago, y el historial las cuatro filas en orden descendente con el motivo de la desaprobación.

7. **Verificación del congelamiento (sin cambios de código esperados).**
   - Se recorre cada candado existente con un periodo en 3 y otro en 4.
   - *Verificación:*
     - Procesar: Recalcular y Revertir no se ofrecen y, llamando las acciones a mano, responden que el periodo ya no está en estatus válido;
     - Horas extra, Faltas y Retardos: las tablas pierden la columna "Acciones" y las acciones a mano responden "El periodo ya no admite cambios";
     - Periodos: Editar y Eliminar no aparecen y las acciones a mano responden "…ya no está en estatus Programada";
     - PTU: con el periodo PTU aprobado o pagado, "Reabrir" el reparto sigue bloqueado;
     - el Detalle por empleado se ve igual que en estatus 2;
     - si alguno **no** congela, se corrige aquí y se anota en la spec.

8. **Documentación.**
   - `docs/nomina.md`: la sección "Status" describe las tres transiciones nuevas, el candado del aviso "Recalcula", el sello y la bitácora; se añade "Aprobación y pago (spec 94)"; se actualizan la sección `payroll.periods` (las cuatro columnas), la sección "UI" (los componentes nuevos) y las menciones de "approval/payment … are not built" y "los estatus Aprobada/Pagada" en las specs 70, 73, 77, 80, 87, 89, 90 y 91. En la spec 90 se marca como resuelto el riesgo "Revertir después de pagar fuera del sistema".
   - *Verificación:* el DDL documentado coincide con el ejecutado; `npx tsc --noEmit` y `npm run lint` limpios.

## Criterios de aceptación

**Transiciones**

- [ ] Un periodo en estatus 2 sin avisos "Recalcula" se aprueba y queda en 3.
- [ ] Un periodo en 3 se marca como pagada y queda en 4.
- [ ] Un periodo en 3 se desaprueba con motivo y queda en 2, con `approved_by` y `approved_at` en `NULL`.
- [ ] Desde 1 no se puede aprobar ni pagar; desde 2 no se puede pagar; desde 4 no se puede hacer nada. Cada intento responde con el mensaje de estatus correspondiente y no escribe nada.
- [ ] Dos pestañas que aprueban el mismo periodo a la vez terminan con un éxito y un error de estatus, nunca con dos filas en la bitácora.
- [ ] Un periodo de otra sucursal no se distingue de uno inexistente.

**Candado y advertencias**

- [ ] Con cualquiera de los once avisos "Recalcula" activo, aprobar se rechaza en el servidor y el botón aparece deshabilitado con el motivo visible y accesible.
- [ ] Al recalcular y desaparecer el aviso, el botón se habilita sin recargar a mano (el `router.refresh()` posterior a Recalcular basta).
- [ ] Las filas fiscales en "No calculado" de ISR o IMSS, un periodo sin empleados calculados y una `fecha_pago` futura **advierten** en el modal y **no** impiden confirmar.
- [ ] Desaprobar sin motivo, con menos de 5 caracteres útiles o con más de 200 se rechaza en `zod` y en el `CHECK`.

**Sello y bitácora**

- [ ] `CK_periods_sello_estatus` impide cualquier combinación de estatus y sello incoherente, también escribiendo SQL a mano.
- [ ] La bitácora guarda una fila por transición, con autor, fecha y el motivo de las desaprobaciones, y solo acepta las tres transiciones permitidas.
- [ ] El encabezado de Procesar muestra el sello de la última aprobación y, en 4, el del pago. El `<details>` del historial lista todos los cambios en orden descendente y no se muestra cuando no hay ninguno.
- [ ] Calcular y revertir (1 ↔ 2) no escriben nada en la bitácora.

**Congelamiento**

- [ ] En 3 y en 4: Recalcular, Revertir, Editar y Eliminar el periodo se rechazan tanto en la UI como llamando las acciones directamente.
- [ ] En 3 y en 4: Horas extra, Faltas y Retardos del periodo quedan de solo lectura y sus escrituras responden "El periodo ya no admite cambios".
- [ ] En 3 y en 4: "Reabrir" un reparto de PTU usado por ese periodo sigue bloqueado.
- [ ] Al desaprobar, todo lo anterior vuelve a estar disponible.
- [ ] Un periodo aprobado no muestra ningún aviso "Recalcula" (las once consultas siguen filtrando `status = 2`).

**Calidad**

- [ ] Las tres acciones pasan por `assertPayrollAccess()` y validan con `zod`; un rol distinto de 1 y 4 recibe `{ ok: false }`.
- [ ] La sucursal y el `id_user` salen de la sesión, nunca del cliente, y el estatus de origen se valida dentro de la lectura con `UPDLOCK, HOLDLOCK`.
- [ ] Ninguna fecha viaja como `Date`; todas usan `buildDate` y `CONVERT(varchar(19), …, 120)`.
- [ ] Las once comprobaciones de "Recalcula" tienen una sola copia (`collectRecalculationFlags`), usada por la pantalla y por la aprobación.
- [ ] Los componentes nuevos (`PayrollPeriodStatusStamp`, `PayrollPeriodStatusLog`) son Server Components; el único cliente nuevo es la extensión de `PayrollCalculationActions`.
- [ ] `npx tsc --noEmit` y `npm run lint` pasan sin errores.
- [ ] `docs/nomina.md` y `queries.txt` quedan actualizados; `content/manual/nomina/` **no** se toca.

## Decisiones

**Tomadas**

| Decisión | Por qué |
|---|---|
| Solo tres transiciones: 2 → 3, 3 → 4 y 3 → 2 | Aprobar y pagar son el ciclo real; desaprobar es la única salida al error humano. Más transiciones multiplican los estados a probar sin un caso de negocio. |
| Pagada (4) es definitiva | Marcar pagada representa dinero ya dispersado. Si se pudiera volver atrás, también se podría revertir el cálculo y liberar tratamientos, ventas y repartos ya pagados. |
| Columnas de sello **y** bitácora | Las columnas son el estado actual que leen las pantallas sin un `JOIN` extra; la bitácora es la única forma de saber que un periodo se desaprobó y por qué. |
| Desaprobar limpia `approved_by` / `approved_at` | Si no, el `CHECK` tendría que aceptar estatus 2 con sello, y el sello dejaría de significar "este periodo está aprobado". El historial no se pierde: vive en la bitácora. |
| `CHECK` que amarra sello y estatus | Es el mismo criterio que `CK_periods_concepto_extraordinario` de la spec 90: un estado imposible se rechaza en la base, no solo en la app. |
| Comentario obligatorio al desaprobar (5 a 200) | Desaprobar deshace una autorización; el motivo es lo que hace útil la bitácora. El mínimo de 5 evita el "x" de relleno. |
| Único candado duro: el aviso "Recalcula" | Es el único caso en el que el sistema **sabe** que lo aprobado ya no es lo correcto. Las demás situaciones (ISR sin tarifa, periodo vacío) pueden ser decisiones legítimas del contador. |
| Las once comprobaciones se extraen a `collectRecalculationFlags` | La pantalla y el candado tienen que opinar lo mismo. Dos copias se habrían separado en la primera spec que añada un aviso. |
| Los avisos "Recalcula" siguen filtrando `status = 2` | Un periodo aprobado está congelado: un aviso que no se puede atender solo haría ruido. Aprobar es justo el momento en que se corta la detección. |
| Botones en `PayrollCalculationActions`, no en un componente nuevo | Ya tiene el diálogo, el manejo de `ActionResult`, el `router.refresh()` y el mapa por estatus. Un componente nuevo duplicaría las cuatro cosas. |
| Todo en Procesar; Periodos solo muestra el badge | Se aprueba viendo los montos que se aprueban. El listado no muestra totales. |
| Advertir, no bloquear, al pagar antes de `fecha_pago` | Adelantar el pago por un puente o un viernes festivo es normal; la fecha del periodo es una planeación, no una regla fiscal. |
| Roles 1 y 4 para las tres acciones | Es el permiso de todo el módulo. Una separación de firmas exige que los dos roles existan y estén disponibles siempre, y el equipo de nómina de la clínica es de una o dos personas. |
| Las transiciones 1 ↔ 2 no entran en la bitácora | Calcular y recalcular ya se rastrean con `calculated_at` / `calculated_by` del snapshot. La bitácora es del ciclo de autorización. |
| `ON DELETE CASCADE` de la bitácora al periodo | Igual que `ptu_distribution_log`. En la práctica no se dispara: un periodo con bitácora nunca está en estatus 1, el único en el que se puede borrar. |
| El manual se actualiza en una spec aparte | Es la regla acordada para Nómina. Cinco páginas afirman hoy que la función no existe y conviene reescribirlas juntas, con sus capturas. |
| Marcar pagada no captura fecha real ni referencia | Sin dispersión ni recibos, esos datos no alimentan nada. Cuando exista la dispersión, ella será su dueña. |

**Descartadas**

| Alternativa | Por qué no |
|---|---|
| Permitir 4 → 3 | Deshacer un pago en el sistema no deshace la transferencia, y abriría la puerta a revertir cálculos ya pagados. |
| Estatus 4 reversible solo por rol 1 | Mismo problema con un permiso encima; el rol no cambia que el dinero ya salió. |
| Bloquear también por filas de ISR o IMSS en "No calculado" | Hay nóminas legítimas sin tarifa capturada o con empleados sin NSS; bloquear detendría el pago de todos por un caso que el contador ya conoce. |
| Bloquear por horas extra pendientes de autorizar | Dejar un día pendiente equivale a no pagarlo, y es una decisión válida. El aviso "Recalcula" ya cubre el caso peligroso (autorizar después de calcular). |
| Aprobar la operativa y la fiscal por separado | Son dos vistas del mismo cálculo; dos estatus duplicarían todos los candados y las combinaciones imposibles. |
| Aprobar en lote desde el listado | Aprobar sin ver los montos es exactamente lo que el candado busca evitar. |
| Solo bitácora, sin columnas | Cada pantalla que muestre el sello necesitaría leer el último registro, y el `CHECK` que amarra sello y estatus sería imposible. |
| Solo columnas, sin bitácora | Se perdería el rastro de las desaprobaciones, que es la información más valiosa de este ciclo. |
| Un `ConfirmModal` compartido | No tiene título ni variante no destructiva (el botón es rojo fijo) y Nómina nunca lo usa; el diálogo con título de `PayrollCalculationActions` es el patrón del módulo. |
| Guardar el motivo de la desaprobación solo en `periods` | Se sobrescribiría en la siguiente desaprobación. |
| Bloquear las asignaciones de bono por extensión de jornada en periodos aprobados | Hoy la asignación se puede cambiar siempre a propósito (spec 68). Cambiarlo toca Bonos y merece su propia revisión. |

## Riesgos identificados

- **Un candado que no congela.** Los candados existentes son listas blancas de 1 y 2, pero ninguno se ha ejercitado nunca con un periodo en 3 o 4, porque hasta hoy era inalcanzable. Si alguno estuviera escrito como `=== 1` o `!== 2`, aprobar abriría una pantalla en lugar de cerrarla.
  - Mitigación: el paso 7 recorre uno por uno los nueve puntos de escritura, en la UI y llamando las acciones directamente, antes de considerar la spec terminada.
- **Ventana entre la comprobación de "Recalcula" y el `COMMIT`.** Las once comprobaciones corren antes de abrir la transacción. Si alguien captura una justificación o cambia un parámetro fiscal en ese instante, el periodo se aprueba con el snapshot viejo.
  - Mitigación: la ventana es de milisegundos y desaprobar existe justamente para eso. Meter las once comprobaciones dentro de la transacción exigiría reescribirlas en SQL puro y se descarta.
- **Periodo aprobado sin aviso posible.** Al apagarse los avisos en estatus 3, un cambio posterior en la UMA, en una tarifa de ISR o en el SBC de un empleado deja de notificarse para ese periodo.
  - Mitigación: es la decisión tomada, y es lo que significa congelar. Queda documentado en `docs/nomina.md`, y desaprobar reactiva la detección completa.
- **Cambios retroactivos que ya no revierten nada.** Vacaciones, días económicos y pagos de tratamientos capturados sobre días de un periodo aprobado no cambian ese periodo, y ahora tampoco se podrá recalcular. Las specs 77, 78, 80 y 90 ya anotaban esta consecuencia para los estatus 3 y 4.
  - Mitigación: se documenta junto a cada caso. La salida operativa es desaprobar, corregir, recalcular y volver a aprobar, mientras el periodo no esté pagado.
- **Bono por extensión de jornada en un periodo aprobado.** `setShiftExtensionAssignment` no mira el estatus, así que se puede asignar un bono sobre días ya aprobados; el aviso "Recalcula" que lo detectaría está apagado, de modo que el cambio queda invisible.
  - Mitigación: queda fuera de alcance y anotado en `docs/nomina.md`. Una spec de Bonos puede añadir el candado por rango de fechas.
- **Aprobar un periodo sin empleados.** Un cálculo que no encontró a nadie elegible (por ejemplo, nadie con la frecuencia capturada) se puede aprobar y pagar en $0.
  - Mitigación: el modal lo advierte en ámbar con el conteo a la vista. Bloquearlo haría imposible cerrar una sucursal que de verdad no pagó nada en el periodo.
- **Un usuario borrado o inactivo en el sello.** El sello guarda `id_user`; si ese usuario se desactiva, el nombre sigue leyéndose por el `LEFT JOIN`, pero si se borrara físicamente la FK lo impediría.
  - Mitigación: la FK a `dbo.users` es exactamente la protección que se quiere, y el lector usa `ISNULL(u.nombre, '')` como el resto del módulo.

## Lo que **no** entra en esta spec

- Las páginas del manual de usuario que hoy dicen que Aprobada y Pagada no existen.
- Recibos de nómina, timbrado del CFDI, dispersión bancaria y layouts para el banco.
- Aprobar o pagar por tipo de nómina, por empleado o en lote.
- Captura de la fecha real del pago, su referencia o su método.
- Doble firma, notificaciones y avisos de "aprobado sin pagar".
- Reabrir un periodo pagado por cualquier vía.
- El candado de las asignaciones de bono por extensión de jornada en periodos aprobados.
- Registrar calcular y revertir (1 ↔ 2) en la bitácora.

Cada uno de esos, si llega, va en su propia spec.
