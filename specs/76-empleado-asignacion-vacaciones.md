# 76 — Empleados: asignación de vacaciones

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [25 — Empleados: alta, listado y detalle](25-empleados-alta-listado-detalle.md): `RH.empleados.fecha_ingreso` y `activo`, el expediente con pestañas (`empleados/[id]/layout.tsx`, `EmployeeTabs`, `EmployeeHeader`), `EmployeesTable` y `EmployeeSummaryCards`.
  - [59 — Empleados: horario semanal estructurado](59-empleado-horario-semanal.md): `RH.empleado_horarios`. Con él se calcula la fecha de regreso saltando los días de descanso; sin horario no se pueden capturar vacaciones.
- **Modifica base de datos:** Sí.
  - Tabla nueva `RH.vacation_days_by_seniority`: catálogo LFT de días por años de servicio.
  - Tabla nueva `RH.vacation_entitlements`: un año de derecho por empleado, con snapshot de días, ventana de solicitud, bloque único y pago.
  - Tabla nueva `RH.vacation_entitlement_log`: bitácora de captura, reprogramación, cancelación, pago y reversión.
- **Fecha:** 2026-10-14
- **Objetivo:** Generar por cada aniversario de un empleado activo su derecho a vacaciones según la tabla de la LFT, y permitir que los roles 1 y 4 registren un único bloque continuo de días por año, lo reprogramen o cancelen con bitácora, y marquen como pagados los días no disfrutados, mostrando el estatus en el expediente y en el listado, sin cálculo en nómina.
- **Reglas de origen:** `references/docs/vacaciones.md` y `references/nomina/reglas_modulo_nomina.md` (§2.5, tabla de antigüedad y estatus); LFT arts. 76, 78, 79 y 81.

## Alcance

**Incluye:**

- **Base de datos** (DDL documentado en `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`):
  - Catálogo `RH.vacation_days_by_seniority` sembrado por script idempotente con la tabla LFT vigente (reforma 2023): 1→12, 2→14, 3→16, 4→18, 5→20, 6–10→22, 11–15→24, 16–20→26, 21–25→28, 26–30→30, y +2 días por cada 5 años hasta 46–50→36. Sin pantalla de edición.
  - `RH.vacation_entitlements`: una fila por empleado y año de servicio (`UNIQUE (id_empleado, anio_servicio)`).
  - `RH.vacation_entitlement_log`: una fila por cada acción sobre un año de derecho.
- **Generación de derechos** (`syncVacationEntitlements`): `INSERT … WHERE NOT EXISTS`, idempotente y por conjunto. Se ejecuta al abrir el listado de empleados y al abrir el expediente.
  - Solo empleados con `activo = 1` y al menos un aniversario cumplido (`fecha_ingreso` + 1 año ≤ hoy, hora de Ciudad de México).
  - **Empleado sin filas:** se genera **solo el año vigente**, es decir, el último aniversario cumplido. No hay backfill de años anteriores.
  - **Empleado con filas:** se generan todos los aniversarios posteriores a su último año registrado hasta hoy, para que ningún año se pierda si nadie abrió la pantalla.
  - Se guarda como snapshot:
    - `dias_derecho`, tomado del catálogo según `anio_servicio`;
    - `fecha_aniversario`;
    - `fecha_limite_solicitud` = aniversario + 6 meses;
    - `fecha_siguiente_aniversario`.
  - Un aniversario el 29 de febrero cae el 28 en años no bisiestos.
  - Corregir `fecha_ingreso` **no altera** los años ya generados. Los cambios de puesto, sucursal o salario no afectan nada porque no se leen.
- **Bloque único por año** (`scheduleVacationBlock`). RH captura `fecha_inicio` y `dias_tomados` (1 ≤ N ≤ `dias_derecho`). El sistema calcula `fecha_fin`, el último día de vacaciones, contando solo los días laborables del **horario actual** (`RH.empleado_horarios`) y saltando los de descanso. Reglas:
  - La captura debe hacerse a más tardar en `fecha_limite_solicitud`. Las fechas del bloque pueden caer después, en el segundo semestre.
  - `fecha_inicio ≥ fecha_aniversario` y `fecha_fin < fecha_siguiente_aniversario` (no acumulativas).
  - Se permiten fechas pasadas dentro del año de derecho, para registrar vacaciones ya disfrutadas antes de que existiera el módulo.
  - Si el empleado no tiene horario definido, no se puede capturar y se muestra el aviso "Sin horario definido".
  - `fecha_fin` es snapshot: cambiar el horario después no la recalcula.
  - Los festivos no se consideran porque no hay catálogo.
- **Reprogramar** (`rescheduleVacationBlock`): solo si el bloque **no ha empezado** (`fecha_inicio > hoy`). El motivo es obligatorio. Se aplican las mismas reglas de fechas, salvo la de la fecha límite: se puede reprogramar después de ella porque la solicitud se hizo a tiempo. Las fechas anteriores y las nuevas quedan en la bitácora.
- **Cancelar bloque** (`cancelVacationBlock`): solo si no ha empezado. Tiene motivo obligatorio y bitácora, y el año vuelve a `Pendiente` o a `Por pagar` según la fecha. Cancelar después de la fecha límite no permite volver a capturar.
- **Estatus derivado** (helper puro `lib/vacations/vacationStatus.ts`, sin cron). Se calcula con la fecha de hoy y la fila:
  - `Pendiente`: sin bloque y hoy ≤ fecha límite.
  - `Programada`: hay bloque y hoy < `fecha_inicio`.
  - `En curso`: `fecha_inicio` ≤ hoy ≤ `fecha_fin`.
  - `Tomada`: el bloque terminó y `dias_tomados = dias_derecho`.
  - `Por pagar N días`: el bloque terminó con días sobrantes, o venció la fecha límite sin bloque. Con bloque capturado, los días sobrantes se pagan al terminar el bloque.
  - `Pagada`: se registró el pago de los días sobrantes. Si además hubo bloque, se muestra "Tomada X · Pagada Y".
- **Marcar como pagadas** (`markVacationDaysPaid`): solo en `Por pagar`. Registra `fecha_pago`, `dias_pagados` (= días sobrantes, calculado, no capturado) y un comentario. **Revertir pago** (`revertVacationPayment`): motivo obligatorio y bitácora; el año vuelve a `Por pagar`.
- **UI:**
  - **Pestaña "Vacaciones"** (`empleados/[id]/vacaciones/`), Server Component:
    - tarjeta del año vigente (días de derecho, ventana de solicitud, bloque, estatus y acciones);
    - historial de todos los años con su bitácora;
    - si el empleado tiene menos de un año, "Primer derecho: {fecha}".
    - Los modales de captura, reprogramación, cancelación, pago y reversión son los únicos Client Components.
  - **Badge en `EmployeeHeader`** con el estatus del año vigente y los días. Va en ámbar cuando está `Pendiente` y faltan 30 días o menos para la fecha límite, y en rojo cuando está `Por pagar`.
  - **Listado:** badge de estatus en `EmployeeRow` y tarjeta "Vacaciones pendientes: N" en `EmployeeSummaryCards`. Cuenta los empleados con año vigente en `Pendiente` o `Por pagar`.
- **Acceso:** solo los roles 1 y 4, ya cubiertos por `proxy.ts` para `/dashboard/empleados`. Las escrituras validan con `zod` y repiten la condición de estado en el `UPDATE … WHERE … OUTPUT INSERTED`, igual que la pestaña Usuarios, para que una escritura concurrente afecte 0 filas y devuelva `{ ok: false }`.
- **Documentación:** sección "Vacaciones" en `docs/rh-empleados.md`.

**No incluye (otras specs):**

- Cálculo en nómina: importe de los días pagados, prima vacacional (25%), su exención de 15 UMA y su percepción en `payroll.perceptions`.
- Excluir los días de vacaciones de la detección de faltas, retardos y de los bonos de asistencia y puntualidad. Por ahora se siguen marcando "No aplica" a mano en Faltas.
- Pantalla global de vacaciones en Nómina.
- Autoservicio del empleado, flujo de aprobación y notificaciones.
- Varios bloques por año, días sueltos y acumulación entre años.
- Catálogo de días festivos.
- Backfill de años anteriores al vigente.
- Vacaciones proporcionales al terminar la relación laboral (finiquito).
- Historial o vigencias del horario semanal.
- Edición del catálogo LFT desde la UI.

## Modelo de datos

### `RH.vacation_days_by_seniority` (catálogo LFT)

```sql
CREATE TABLE [RH].[vacation_days_by_seniority](
    [id_vacation_days] [int] IDENTITY(1,1) NOT NULL,
    [anio_desde]       [int] NOT NULL,
    [anio_hasta]       [int] NOT NULL,
    [dias]             [int] NOT NULL,
 CONSTRAINT [PK_vacation_days_by_seniority] PRIMARY KEY CLUSTERED ([id_vacation_days] ASC),
 CONSTRAINT [UQ_vacation_days_by_seniority_desde] UNIQUE ([anio_desde]),
 CONSTRAINT [CK_vacation_days_by_seniority_rango] CHECK ([anio_desde] >= 1 AND [anio_hasta] >= [anio_desde]),
 CONSTRAINT [CK_vacation_days_by_seniority_dias]  CHECK ([dias] > 0)
) ON [PRIMARY]
```

- El script de siembra es idempotente: `INSERT … WHERE NOT EXISTS` por `anio_desde`. Inserta 14 rangos: 1, 2, 3, 4, 5, 6–10, …, 46–50.
- La BD no impide que los rangos se traslapen; los controla el script.
- Si un empleado tiene más de 50 años de servicio, no hay rango para él y no se le genera el año (ver Riesgos).

### `RH.vacation_entitlements` (año de derecho)

```sql
CREATE TABLE [RH].[vacation_entitlements](
    [id_vacation_entitlement]     [int] IDENTITY(1,1) NOT NULL,
    [id_empleado]                 [int]           NOT NULL,
    [anio_servicio]               [int]           NOT NULL,   -- 1 = primer aniversario
    [fecha_aniversario]           [date]          NOT NULL,   -- DATEADD(YEAR, anio_servicio, fecha_ingreso)
    [fecha_limite_solicitud]      [date]          NOT NULL,   -- DATEADD(MONTH, 6, fecha_aniversario)
    [fecha_siguiente_aniversario] [date]          NOT NULL,   -- DATEADD(YEAR, anio_servicio + 1, fecha_ingreso)
    [dias_derecho]                [int]           NOT NULL,   -- snapshot del catálogo
    -- Bloque único (todo NULL o todo lleno)
    [fecha_inicio]                [date]          NULL,
    [fecha_fin]                   [date]          NULL,       -- último día de vacaciones, calculado con el horario
    [dias_tomados]                [int]           NULL,
    [solicitado_by]               [int]           NULL,
    [solicitado_at]               [datetime2](0)  NULL,       -- captura original; NO cambia al reprogramar
    -- Pago de días sobrantes (todo NULL o todo lleno)
    [fecha_pago]                  [date]          NULL,
    [dias_pagados]                [int]           NULL,
    [comentario_pago]             [nvarchar](500) NULL,
    [pagado_by]                   [int]           NULL,
    [pagado_at]                   [datetime2](0)  NULL,
    [created_at]                  [datetime2](0)  NOT NULL,   -- buildDate(new Date())
 CONSTRAINT [PK_vacation_entitlements] PRIMARY KEY CLUSTERED ([id_vacation_entitlement] ASC),
 CONSTRAINT [UQ_vacation_entitlements_empleado_anio] UNIQUE ([id_empleado], [anio_servicio]),
 CONSTRAINT [FK_vacation_entitlements_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado]),
 CONSTRAINT [CK_vacation_entitlements_ventana] CHECK (
     [anio_servicio] >= 1 AND [dias_derecho] > 0
     AND [fecha_limite_solicitud] > [fecha_aniversario]
     AND [fecha_siguiente_aniversario] > [fecha_limite_solicitud]),
 CONSTRAINT [CK_vacation_entitlements_bloque] CHECK (
     ([fecha_inicio] IS NULL AND [fecha_fin] IS NULL AND [dias_tomados] IS NULL
          AND [solicitado_by] IS NULL AND [solicitado_at] IS NULL)
  OR ([fecha_inicio] IS NOT NULL AND [fecha_fin] IS NOT NULL AND [dias_tomados] IS NOT NULL
          AND [solicitado_by] IS NOT NULL AND [solicitado_at] IS NOT NULL
          AND [dias_tomados] BETWEEN 1 AND [dias_derecho]
          AND [fecha_inicio] >= [fecha_aniversario]
          AND [fecha_fin] >= [fecha_inicio]
          AND [fecha_fin] < [fecha_siguiente_aniversario])),
 CONSTRAINT [CK_vacation_entitlements_pago] CHECK (
     ([fecha_pago] IS NULL AND [dias_pagados] IS NULL AND [pagado_by] IS NULL AND [pagado_at] IS NULL)
  OR ([fecha_pago] IS NOT NULL AND [dias_pagados] IS NOT NULL AND [pagado_by] IS NOT NULL AND [pagado_at] IS NOT NULL
          AND [dias_pagados] = [dias_derecho] - ISNULL([dias_tomados], 0)
          AND [dias_pagados] > 0))
) ON [PRIMARY]
```

- Los `CHECK` de "todo o nada" escriben `IS NOT NULL` explícitamente. Un `CHECK` que da `UNKNOWN` pasa, igual que en `empleado_horarios`.
- **Cancelar un bloque** pone en `NULL` sus cinco columnas. **Revertir un pago** pone en `NULL` las suyas. El rastro queda en la bitácora.
- **No hay FK** de `solicitado_by` ni de `pagado_by` a `dbo.users`, igual que `decided_by` en `overtime_authorizations`.
- Las fechas `DATEADD` de SQL Server recortan el 29 de febrero al 28 y el día 31 a fin de mes. El helper TS replica ese recorte.
- Si hay un pago registrado, no se puede reprogramar ni cancelar el bloque: no se puede pagar antes de que el bloque termine, y un bloque terminado ya no se puede tocar. La regla se valida en el `WHERE` de las acciones.

### `RH.vacation_entitlement_log` (bitácora)

```sql
CREATE TABLE [RH].[vacation_entitlement_log](
    [id_log]                  [int] IDENTITY(1,1) NOT NULL,
    [id_vacation_entitlement] [int]           NOT NULL,
    [accion]                  [char](1)       NOT NULL,   -- 'C' captura | 'R' reprogramación | 'X' cancelación | 'P' pago | 'V' reversión de pago
    [fecha_inicio_anterior]   [date]          NULL,
    [fecha_fin_anterior]      [date]          NULL,
    [dias_tomados_anterior]   [int]           NULL,
    [fecha_inicio_nueva]      [date]          NULL,
    [fecha_fin_nueva]         [date]          NULL,
    [dias_tomados_nueva]      [int]           NULL,
    [fecha_pago]              [date]          NULL,       -- 'P' y 'V'
    [dias_pagados]            [int]           NULL,       -- 'P' y 'V'
    [motivo]                  [nvarchar](500) NULL,       -- obligatorio en 'R', 'X', 'V'; comentario en 'P'
    [created_by]              [int]           NOT NULL,
    [created_at]              [datetime2](0)  NOT NULL,
 CONSTRAINT [PK_vacation_entitlement_log] PRIMARY KEY CLUSTERED ([id_log] ASC),
 CONSTRAINT [FK_vacation_entitlement_log_entitlement] FOREIGN KEY ([id_vacation_entitlement])
     REFERENCES [RH].[vacation_entitlements] ([id_vacation_entitlement]),
 CONSTRAINT [CK_vacation_entitlement_log_accion] CHECK ([accion] IN ('C','R','X','P','V')),
 CONSTRAINT [CK_vacation_entitlement_log_motivo] CHECK (
     [accion] IN ('C','P') OR ([motivo] IS NOT NULL AND LEN(LTRIM(RTRIM([motivo]))) > 0))
) ON [PRIMARY]

CREATE NONCLUSTERED INDEX [IX_vacation_entitlement_log_entitlement]
    ON [RH].[vacation_entitlement_log] ([id_vacation_entitlement], [created_at] DESC)
```

Cada escritura del año y su fila de bitácora van juntas en `db.transaction`.

### TypeScript — `interfaces/vacation.ts`

```ts
export type VacationStatus =
  | "pendiente" | "programada" | "en_curso" | "tomada" | "por_pagar" | "pagada";

export type VacationLogAction = "C" | "R" | "X" | "P" | "V";

/** Fila de RH.vacation_entitlements; todas las fechas como "YYYY-MM-DD", nunca Date. */
export interface IVacationEntitlement {
  id_vacation_entitlement:     number;
  id_empleado:                 number;
  anio_servicio:               number;
  fecha_aniversario:           string;
  fecha_limite_solicitud:      string;
  fecha_siguiente_aniversario: string;
  dias_derecho:                number;
  fecha_inicio:                string | null;
  fecha_fin:                   string | null;
  dias_tomados:                number | null;
  solicitado_at:               string | null;   // "YYYY-MM-DD HH:mm:ss"
  fecha_pago:                  string | null;
  dias_pagados:                number | null;
  comentario_pago:             string | null;
}

export interface IVacationLogEntry {
  id_log:                number;
  accion:                VacationLogAction;
  fecha_inicio_anterior: string | null;
  fecha_fin_anterior:    string | null;
  dias_tomados_anterior: number | null;
  fecha_inicio_nueva:    string | null;
  fecha_fin_nueva:       string | null;
  dias_tomados_nueva:    number | null;
  fecha_pago:            string | null;
  dias_pagados:          number | null;
  motivo:                string | null;
  created_by_name:       string | null;   // LEFT JOIN dbo.users
  created_at:            string;
}

/** Año de derecho + estatus derivado + bitácora, para la pestaña y el badge. */
export interface IVacationEntitlementView extends IVacationEntitlement {
  status:         VacationStatus;
  dias_por_pagar: number;          // dias_derecho - dias_tomados cuando aplica; 0 si no
  log:            IVacationLogEntry[];
}
```

### Helpers puros — `lib/vacations/` (se importan desde cliente y servidor)

- `vacationDates.ts`:
  - `addYearsClamped`, `addMonthsClamped`: aritmética sobre `"YYYY-MM-DD"` con los mismos recortes que `DATEADD`, sin `new Date(string)` crudo.
  - `calculateVacationEndDate(fecha_inicio, dias_tomados, workingIsoWeekdays)`: devuelve el último día laborable del bloque.
  - `getNextAnniversary(fecha_ingreso, today)`: alimenta "Primer derecho: {fecha}".
- `vacationStatus.ts`: `getVacationStatus(entitlement, today)` y `getDaysToPay(entitlement, today)`. Implementan las reglas de estatus del Alcance. **Se usa la fecha de hoy de Ciudad de México** (`addZeroToday(new Date())`).

El listado no recibe la bitácora: usa el estatus del año vigente, que se calcula en el server action con el mismo helper.

## Plan de implementación

Cada paso deja el sistema compilando (`npm run build`) y funcional.

1. **Base de datos.** En `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`, después de lo de la spec 59, se agregan:
   - el DDL de `RH.vacation_days_by_seniority`, `RH.vacation_entitlements` y `RH.vacation_entitlement_log` con sus `CHECK` e índice;
   - el script de siembra idempotente del catálogo LFT (14 rangos).

   Se ejecuta contra la BD y se verifica con:
   - `SELECT * FROM RH.vacation_days_by_seniority` (14 filas);
   - un `INSERT` de prueba con el bloque a medio llenar, que el `CHECK` debe rechazar.

2. **Tipos y helpers puros.**
   - `interfaces/vacation.ts`.
   - `lib/vacations/vacationDates.ts`: `addYearsClamped`, `addMonthsClamped`, `calculateVacationEndDate`, `getNextAnniversary`.
   - `lib/vacations/vacationStatus.ts`: `getVacationStatus`, `getDaysToPay`.

   Todavía no se usan desde la UI.

3. **Sincronización y lecturas.**
   - `lib/vacations/entitlementSync.ts` (`server-only`): `syncVacationEntitlements(id_empresa, id_empleado?)`. Es un solo `INSERT … SELECT … WHERE NOT EXISTS` por conjunto, con el año vigente si el empleado no tiene filas y los aniversarios faltantes si ya las tiene, y el `JOIN` al catálogo para `dias_derecho`.
   - `app/dashboard/empleados/[id]/vacaciones/actions.ts` con dos lecturas:
     - `getEmployeeVacations(id_empleado)`: años con `CONVERT(varchar(10), …, 120)`, estatus derivado y bitácora con `LEFT JOIN dbo.users`;
     - `getEmployeeWorkingWeekdays(id_empleado)`: días ISO con fila en `RH.empleado_horarios`.

4. **Pestaña "Vacaciones" de solo lectura.**
   - Se agrega a `TABS` en `EmployeeTabs.tsx`.
   - `vacaciones/page.tsx` (Server Component) llama a `syncVacationEntitlements` y a las lecturas.
   - Componentes en `vacaciones/componentes/`:
     - `VacationCurrentYearCard.tsx`: año vigente, días de derecho, ventana, bloque, estatus y días por pagar;
     - `VacationHistoryTable.tsx`: todos los años con la bitácora desplegable por año (`<details>`, sin JS);
     - "Primer derecho: {fecha}" cuando aún no hay años;
     - el aviso "Sin horario definido", que reusa `EmployeesWithoutScheduleNotice` si su forma encaja y, si no, un aviso local.
   - `app/dashboard/empleados/componentes/VacationStatusBadge.tsx` (Server Component, compartido con el header y el listado).

5. **Capturar bloque.**
   - `vacaciones/schemas.ts` (`server-only`, `zod`).
   - `scheduleVacationBlock` valida:
     - que el año esté vigente y sin bloque;
     - hoy ≤ `fecha_limite_solicitud`;
     - que el empleado tenga horario;
     - `fecha_inicio ≥ fecha_aniversario`;
     - `1 ≤ dias_tomados ≤ dias_derecho`.

     Recalcula `fecha_fin` en el servidor con `calculateVacationEndDate` (no confía en la del cliente) y valida `fecha_fin < fecha_siguiente_aniversario`. Hace `UPDATE … WHERE fecha_inicio IS NULL AND fecha_pago IS NULL … OUTPUT INSERTED` + `INSERT` de bitácora `'C'` en `db.transaction`.
   - `VacationBlockModal.tsx` (Client Component, modos `schedule` / `reschedule`) usa `JustificationModalFrame` de `nomina/componentes/` y muestra la fecha de regreso calculada en vivo con el mismo helper.

6. **Reprogramar y cancelar.**
   - `rescheduleVacationBlock` exige `fecha_inicio > hoy` y un motivo. No exige la fecha límite. Aplica las mismas reglas de fechas y guarda la bitácora `'R'` con lo anterior y lo nuevo.
   - `cancelVacationBlock` exige `fecha_inicio > hoy` y un motivo. Pone el bloque en `NULL` y registra `'X'`.
   - En la UI, `VacationBlockModal` en modo `reschedule` y `VacationReasonModal.tsx` para cancelar, que comparte el marco y lleva motivo obligatorio.

7. **Pagar y revertir.**
   - `markVacationDaysPaid` exige el estatus `por_pagar`. Repite en el `WHERE` la condición: bloque terminado (`fecha_fin < hoy`) o, sin bloque, `fecha_limite_solicitud < hoy`, y `fecha_pago IS NULL`. Calcula `dias_pagados` en el servidor y registra `'P'`.
   - `revertVacationPayment` exige un motivo, pone el pago en `NULL` y registra `'V'` con la fecha y los días revertidos.
   - En la UI, `MarkVacationPaidModal.tsx` (fecha de pago con `addZeroToday` por defecto y comentario) y `VacationReasonModal` para revertir.

8. **Badge en el expediente.**
   - `layout.tsx` llama a `syncVacationEntitlements(id_empresa, id_empleado)`.
   - `getEmployeeById` o una lectura nueva, `getCurrentVacationStatus(id_empleado)`, devuelve el estatus del año vigente.
   - `EmployeeHeader` muestra `VacationStatusBadge`: ámbar si está `pendiente` y faltan 30 días o menos, rojo en `por_pagar`. Sin año vigente no muestra nada.

9. **Listado.**
   - `empleados/page.tsx` llama a `syncVacationEntitlements(id_empresa)`.
   - `getEmployees` agrega, con `OUTER APPLY` sobre el año vigente (el de mayor `anio_servicio`), las columnas necesarias para derivar el estatus en el servidor.
   - `EmployeeRow` muestra `VacationStatusBadge`.
   - `EmployeeSummaryCards` agrega "Vacaciones pendientes: N" (`pendiente` + `por_pagar`).

10. **Documentación.**
    - Sección "Vacaciones (spec 76)" en `docs/rh-empleados.md`, con la pestaña nueva en la lista de pestañas del inicio.
    - En `CLAUDE.md` no hace falta cambiar nada: no hay feature ni `actions.ts` de primer nivel nuevos; `vacaciones/` vive dentro de `empleados/[id]/`, como `horario/`.

## Criterios de aceptación

**Base de datos**

- [ ] Existen las tres tablas; `RH.vacation_days_by_seniority` tiene 14 filas y correr el script de siembra otra vez no agrega ninguna.
- [ ] El catálogo devuelve 12 días para el año 1, 20 para el 5, 22 para el 6 y el 10, 24 para el 11 y 32 para el 31.
- [ ] Un `INSERT`/`UPDATE` con el bloque a medio llenar, `dias_tomados > dias_derecho`, `fecha_fin ≥ fecha_siguiente_aniversario` o `dias_pagados ≠ dias_derecho − dias_tomados` es rechazado por un `CHECK`.
- [ ] Una fila de bitácora `'R'`, `'X'` o `'V'` sin motivo es rechazada por `CK_vacation_entitlement_log_motivo`.

**Generación**

- [ ] Un empleado activo con `fecha_ingreso` 2019-03-10 obtiene, al abrir el listado el 2026-10-14, **una sola** fila: `anio_servicio = 7`, aniversario 2026-03-10, límite 2026-09-10, siguiente aniversario 2027-03-10, `dias_derecho = 22`.
- [ ] Abrir el listado o el expediente varias veces no duplica filas.
- [ ] Un empleado con `fecha_ingreso` 2016-02-29 tiene aniversario 2026-02-28.
- [ ] Un empleado con menos de un año no tiene filas, y su pestaña muestra "Primer derecho: {fecha del primer aniversario}".
- [ ] Un empleado con `activo = 0` no recibe años nuevos, pero su pestaña sigue mostrando los existentes.
- [ ] Si un empleado ya tiene el año 7 y hoy cumplió el 8 y el 9 sin que nadie abriera la pantalla, al abrirla se generan el 8 y el 9.
- [ ] Cambiar `fecha_ingreso`, puesto, sucursal o salario no modifica ninguna fila existente de `RH.vacation_entitlements`.

**Captura**

- [ ] Con horario Lun–Sáb y fecha de inicio en lunes, 12 días dan como `fecha_fin` el sábado de la segunda semana: se salta un solo domingo.
- [ ] La fecha de fin que guarda el servidor es la que calcula él, aunque el cliente mande otra.
- [ ] Capturar es posible hasta el día de `fecha_limite_solicitud` inclusive; un día después devuelve `{ ok: false }`.
- [ ] Un bloque que empieza antes del límite y termina en el segundo semestre se guarda; uno cuya `fecha_fin` cae en o después del siguiente aniversario es rechazado.
- [ ] Se puede capturar un bloque con fechas pasadas dentro del año de derecho.
- [ ] Un empleado sin horario no puede capturar: el botón está deshabilitado con el aviso, y la acción devuelve `{ ok: false }`.
- [ ] Un segundo intento de captura sobre un año que ya tiene bloque devuelve `{ ok: false }`, también en concurrencia (0 filas afectadas).
- [ ] Cada captura deja una fila `'C'` en la bitácora con las fechas nuevas, el usuario y la fecha y hora.

**Reprogramar y cancelar**

- [ ] Reprogramar o cancelar un bloque con `fecha_inicio ≤ hoy` devuelve `{ ok: false }` y la UI no ofrece la acción.
- [ ] Reprogramar después de `fecha_limite_solicitud` funciona si el bloque aún no empieza, y `solicitado_at` no cambia.
- [ ] La reprogramación deja una fila `'R'` con las fechas y los días anteriores y nuevos, y el motivo; sin motivo es rechazada.
- [ ] Cancelar deja el bloque en `NULL`, registra `'X'` con motivo, y el año queda `pendiente` (antes del límite) o `por_pagar` (después).

**Estatus y pago**

- [ ] `getVacationStatus` devuelve, para cada caso del Alcance, el estatus esperado: `pendiente`, `programada`, `en_curso`, `tomada`, `por_pagar` (sin bloque y vencido, o bloque parcial terminado) y `pagada`.
- [ ] Un bloque de 8 de 12 días que termina ayer deja el año en `por_pagar` con 4 días; antes de terminar, el estatus es `programada` o `en_curso`, sin días por pagar.
- [ ] "Marcar como pagadas" solo aparece y solo funciona en `por_pagar`; guarda `dias_pagados` calculado por el servidor, registra `'P'` y el año queda `pagada`.
- [ ] Revertir el pago exige motivo, pone el pago en `NULL`, registra `'V'` y el año vuelve a `por_pagar`.

**UI**

- [ ] La pestaña "Vacaciones" aparece en el expediente; la tarjeta del año vigente y el historial con su bitácora se ven correctamente en modo claro y oscuro, y a 375 px de ancho.
- [ ] El badge del header está en ámbar en `pendiente` con 30 días o menos para el límite, en rojo en `por_pagar`, y no aparece si el empleado no tiene año vigente.
- [ ] El listado muestra el badge por fila, y la tarjeta "Vacaciones pendientes" cuenta los empleados con año vigente en `pendiente` o `por_pagar`.
- [ ] Solo `VacationBlockModal`, `VacationReasonModal` y `MarkVacationPaidModal` (y sus botones) llevan `"use client"`; la página, la tarjeta, el historial y el badge son Server Components.
- [ ] Ninguna fecha viaja como `Date`: todas las lecturas usan `CONVERT(varchar(…), …, 120)` y ningún helper hace `new Date(string)` sobre un valor crudo.

**General**

- [ ] `npm run build` y `npm run lint` pasan sin errores nuevos.
- [ ] `docs/rh-empleados.md` tiene la sección "Vacaciones (spec 76)".

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| Persistir un año de derecho por empleado y aniversario con `dias_derecho` y fechas como snapshot | Calcularlo al vuelo desde `fecha_ingreso` | "Los cambios no afectan el historial" pide un registro estable; corregir `fecha_ingreso` reescribiría años pasados. |
| Generar al abrir el listado o el expediente con un `INSERT … WHERE NOT EXISTS` idempotente | Tarea programada (cron) | El proyecto no tiene infraestructura de tareas; la escritura es barata, por conjunto y repetible. |
| Solo el año vigente para empleados sin filas | Backfill de todos los aniversarios pasados | No hay datos confiables de años anteriores; se generarían años vencidos ficticios. |
| Catálogo LFT en tabla de BD (`RH.vacation_days_by_seniority`), hasta 50 años | Constante TS / tabla hasta 30 años | Lo pide "agregar tabla de vacaciones"; mismo estilo que `payroll.perceptions`; la LFT sigue sumando 2 días cada 5 años. |
| Un solo bloque continuo por año; el resto se paga | Varios bloques o días sueltos | "Periodo continuo" + "los días restantes serán pagados". |
| Contar días laborables según el horario actual; `fecha_fin` como snapshot | Días naturales / recalcular al cambiar horario | La LFT cuenta días laborables; recalcular movería fechas ya acordadas. |
| Sin horario no se captura | Caer a días naturales | Coherente con Faltas, que tampoco evalúa a quien no tiene horario. |
| La fecha límite (aniversario + 6 meses) aplica a la **captura**; el bloque puede caer en el segundo semestre pero debe terminar antes del siguiente aniversario | Exigir el bloque completo dentro del semestre | Decisión del usuario; "no acumulativas" fija el tope en el siguiente aniversario. |
| Fechas pasadas permitidas dentro del año de derecho | Solo fechas futuras | Permite registrar vacaciones ya disfrutadas antes de que existiera el módulo. |
| Reprogramar y cancelar solo si el bloque no ha empezado, con motivo obligatorio y bitácora; reprogramar se permite tras el límite | Editar bloques en curso o sobrescribir sin rastro | Decisión del usuario; la bitácora alimenta el historial. |
| Estatus derivado de la fila + la fecha de hoy (CDMX), sin columna `estado` | Columna de estado actualizada por proceso | `programada → en_curso → tomada / por_pagar` dependen del calendario; sin cron no habría quién la actualice. |
| Los días sobrantes pasan a `por_pagar` al **terminar** el bloque | Al capturarlo | Mientras no empiece, el bloque se puede reprogramar o cambiar N. |
| Pago manual ("Marcar como pagadas") con fecha y comentario, reversible con motivo | Solo dato informativo "días a pagar" | Cubre el estatus `PAGADAS / PENDIENTES` de las reglas de nómina sin tocar el cálculo de nómina. |
| `dias_pagados` lo calcula el servidor (= derecho − tomados) y lo amarra un `CHECK` | Capturarlo libre | Evita pagos parciales o inconsistentes. |
| Solo roles 1 y 4 capturan; sin aprobación ni autoservicio | Solicitud del empleado + aprobación | Decisión del usuario; `proxy.ts` ya protege `/dashboard/empleados`. |
| La exclusión de vacaciones en faltas, retardos y bonos queda fuera | Integrarlo aquí | Toca el SQL de cálculo de nómina (3 módulos); merece su propia spec. |
| Sin cálculo en nómina (importe, prima vacacional) | Incluirlo | Pedido explícito del usuario: "sin cálculo de percepción en nómina". |
| Reusar `JustificationModalFrame` de `nomina/componentes/` | Duplicar el marco de modal | Regla de reúso de `CLAUDE.md`; moverlo a una carpeta compartida queda fuera. |
| Tablas en inglés, columnas en español, esquema `RH` | Esquema `payroll` | Es un dato del expediente del empleado, no del cálculo de nómina; mismo criterio de nombres que las specs 60–75. |

## Riesgos identificados

- **Conflicto con el art. 79 LFT.** La ley prohíbe compensar las vacaciones con dinero salvo al terminar la relación laboral. "Por pagar" y "Marcar como pagadas" implementan la regla del cliente (`references/docs/vacaciones.md`), no la ley. El art. 81 obliga además a **otorgarlas** dentro de los 6 meses, y aquí la ventana aplica a la captura, no al disfrute. El riesgo laboral lo asume el negocio; el sistema solo registra.
- **Vacaciones detectadas como faltas.** Mientras no exista la spec de integración, un día de vacaciones sin checada genera falta y quita los bonos de asistencia y puntualidad de un podólogo. Hay que seguir marcándolo "No aplica" en Faltas antes de "Calcular".
- **Horario sin historial.** `fecha_fin` se calcula con el horario vigente al capturar. Si después cambia el horario, la fecha de regreso guardada ya no coincide con los días laborables reales; se corrige reprogramando, y solo si el bloque no ha empezado.
- **Sin festivos.** Un festivo dentro del bloque cuenta como día de vacaciones. RH puede ajustar `dias_tomados` al capturar.
- **Escritura durante el render.** `syncVacationEntitlements` escribe al abrir el listado y el expediente. Es idempotente, pero si falla (BD caída o permisos) la página debe seguir mostrando lo existente: el error se registra y no se propaga.
- **Años que nadie ve.** Si nadie abre el listado ni el expediente durante más de un año, ese año se genera tarde y puede aparecer ya `por_pagar`, con la fecha límite vencida sin que nadie haya visto la alerta.
- **Más de 50 años de servicio.** No hay rango en el catálogo, así que no se genera el año. Es improbable, pero se resuelve agregando filas al catálogo.
- **Generación por aniversario y bajas.** No existe fecha de baja (solo `activo`). Un empleado reactivado tras años inactivo recibe todos los aniversarios faltantes desde su último año registrado, y sus fechas límite ya pasaron.
- **Concurrencia.** Dos usuarios capturando, reprogramando o pagando el mismo año al mismo tiempo: la condición de estado en el `UPDATE … WHERE` hace que el segundo afecte 0 filas y reciba `{ ok: false }`. Sin esa condición se perdería una escritura.
