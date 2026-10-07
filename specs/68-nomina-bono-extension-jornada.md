# 68 — Nómina: bono por extensión de jornada

## Header

- **Estado:** Implementado
- **Depende de:**
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md) y [54 — Detalle de percepciones](54-nomina-detalle-percepciones-empleado.md): `calculatePayrollPeriod`, el snapshot `payroll.period_employees` (con el `salario_diario` operativo congelado), `buildPerceptionLines`, el Detalle y "Total percepciones" en Procesar.
  - [55 — Empleado: vincular usuarios](55-empleado-vincular-usuarios.md) y [62 — Nómina: control de faltas](62-nomina-control-faltas.md): la población controlada `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION` (usuario vinculado activo con `id_role = 2`), los días con checada y `lib/payroll/incidentSources.ts`.
  - [59 — Empleados: horario semanal estructurado](59-empleado-horario-semanal.md): los días con horario son los únicos que pueden contar como trabajados.
  - [64 — Bono de puntualidad](64-nomina-bono-puntualidad.md) y [65 — Bono de asistencia](65-nomina-bono-asistencia.md): la pantalla `/dashboard/nomina/bonos`, `BonusKindTabs`, `readBonusKind`, `BonusResultToolbar` y `PayrollRecalculationNotice`. **Esta spec modifica la spec 65:** el selector de bono gana una tercera pestaña, `bono=extension`.
- **Modifica base de datos:** Sí.
  - Tabla nueva `payroll.shift_extension_assignments`: qué empleados tienen el bono asignado.
  - Tabla nueva `payroll.shift_extension_assignments_log`: bitácora de las asignaciones.
  - Columnas nuevas en `payroll.period_employees`: asignado, días trabajados e importe.
- **Fecha:** 2026-10-07
- **Objetivo:** En la nómina operativa, pagar a los podólogos que un administrador asignó deliberadamente un bono por extensión de jornada de `(salario_diario / 8) × 2` por cada día con horario en el que checaron dentro del periodo.
- **Reglas de origen:** `references/docs/bono-extension.md`.

## Alcance

**Incluye:**

- **Base de datos.** El DDL se documenta en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 65.
  - `payroll.shift_extension_assignments`: una fila por empleado con `activo`, `updated_by` y `updated_at`. **Sin fila o con `activo = 0`, el empleado no tiene el bono.** No hay vigencias ni semillas.
  - `payroll.shift_extension_assignments_log`: una fila por cada vez que se asigna o se quita el bono.
  - `payroll.period_employees` gana tres columnas para guardar el resultado del bono: asignado, días trabajados e importe.
- **Quién cobra.** Solo el renglón operativo (`'O'`) de un empleado que cumple las dos condiciones:
  - pertenece a la población controlada de Faltas, Retardos y Bonos (`ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS` + `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION`);
  - tiene en `shift_extension_assignments` una fila con `activo = 1` **al momento de calcular**.

  La asignación aplica a todo el periodo. Los renglones `'F'` quedan sin asignar y en 0.
- **Días trabajados.** Se cuentan las fechas que cumplen todo esto:
  - están dentro de `max(fecha_inicio, fecha_ingreso)`..`fecha_fin`;
  - tienen fila en `RH.empleado_horarios` para su día ISO de la semana;
  - tienen al menos una checada en `RH.asistencias`, de cualquier tipo. Una checada incompleta cuenta.

  Además:
  - Un día de descanso con checada **no** cuenta.
  - Un día sin checada no cuenta, aunque tenga justificante (`'J'`) o esté marcado "No aplica" (`'N'`).
  - Los retardos no afectan.
  - Hoy cuenta si ya tiene checada, y los días futuros nunca la tienen.
  - Se usa el horario actual para todo el periodo.
- **Importe.** `ROUND(salario_diario × 2 / 8 × días_trabajados, 2)`, con el `salario_diario` operativo congelado en el snapshot. La tarifa intermedia nunca se redondea.
  - Las constantes `SHIFT_EXTENSION_HOURS_PER_DAY = 1` y `SHIFT_EXTENSION_PAY_MULTIPLIER = 2` van en `lib/payroll/constants.ts`. Son fijas y no se configuran.
  - Hay prorrateo natural: quien ingresó a mitad del periodo solo suma los días desde su ingreso.
- **No es hora extra.** El bono no pasa por `overtime_authorizations`. Tampoco consume `limite_horas_dobles_periodo` ni aparece en Horas extra.
- **Helper espejo puro** `lib/payroll/shiftExtensionBonus.ts`: conteo de días, importe y textos, sin BD y sin `Date` sobre strings crudos. Alimenta la pantalla y el Detalle. **En el cálculo manda el SQL.**
- **Pestaña "Extensión de jornada" en `/dashboard/nomina/bonos`** (`bono=extension`).
  - `BonusKindTabs` gana la tercera pestaña y `readBonusKind` acepta `extension`. Un valor desconocido sigue abriendo puntualidad.
  - El estado vive en la URL: `periodo`, `asignacion=asignado|sin_asignar`, `q` y `pagina`, con 25 filas por página.
  - Tarjetas de resumen del periodo completo: cuántos asignados y el importe estimado total. No cambian con los filtros.
  - Tabla por podólogo controlado: empleado, días con horario, días trabajados, asignado sí o no, importe estimado y un botón "Asignar" o "Quitar".
  - El botón pide confirmación dentro de la interfaz, sin `confirm()` nativo.
  - El importe estimado usa el `salario_diario` actual del empleado.
  - Avisos: `EmployeesWithoutScheduleNotice` y el aviso "Recalcula".
  - La bitácora de asignaciones va en un `<details>`.
- **Server actions** en `nomina/bonos/actions.ts`: `getShiftExtensionBonusPage`, `getShiftExtensionAssignmentsLog` y `setShiftExtensionAssignment`.
  - Pasan por `assertPayrollAccess()`, toman la sucursal y la empresa de la sesión y validan con `zod` en `lib/payroll/schemas.ts`.
  - `setShiftExtensionAssignment` solo acepta empleados activos de la sucursal activa que sean podólogos controlados.
  - Escribe en una transacción con `UPDLOCK, HOLDLOCK`: hace upsert y escribe una fila de bitácora. Si el valor no cambia, no escribe nada.
  - La asignación se puede cambiar siempre.
- **Cálculo** dentro del batch de `calculatePayrollPeriod`.
  - Cuenta los días trabajados por empleado y llena las tres columnas en `'O'`.
  - Los fragmentos SQL viven en `lib/payroll/shiftExtensionBonusSql.ts`. Los comparten el cálculo y el aviso "Recalcula".
- **Aviso "Recalcula"** (`lib/payroll/shiftExtensionBonusRecalculation.ts`, server-only, solo en estatus 2).
  - Se muestra con `PayrollRecalculationNotice` en Procesar y en la pestaña, con el texto "Hay bonos por extensión de jornada que no coinciden con el último cálculo. Recalcula la nómina."
  - Aparece cuando lo que daría el cálculo hoy (asignado, días o importe) de algún renglón `'O'` es distinto del snapshot.
- **Procesar:** columna "Bono ext." después de "Bono asist.", con el importe y "N días" debajo cuando es mayor que 0. "Total percepciones", la tarjeta de resumen y el pie de la tabla lo suman.
- **Detalle:** `buildPerceptionLines` agrega la línea `bono_extension_jornada`, "Bono por extensión de jornada", con "N días × $X" (`$X` es `salario_diario × 2 / 8`). La línea se omite en tres casos: el empleado no tiene el bono asignado, el importe es 0, o es la vista fiscal.
- **Documentación:**
  - sección "Bono por extensión de jornada (spec 68)" en `docs/nomina.md`;
  - se actualizan el párrafo inicial, la sección UI y la lista de líneas del Detalle;
  - se anota que el horario del podólogo se captura **con la hora extendida incluida**, para que Horas extra no la detecte.

**No incluye:**

- **Vigencias o fechas de asignación.** La asignación vale para todo el periodo que se calcula.
- **Hora y multiplicador configurables**, o un monto fijo por empleado.
- **Descontar automáticamente la hora de extensión** de lo que detecta Horas extra.
- **Tabla de desglose de días y candado de pago único.**
- **Asignar el bono desde el expediente del empleado.**
- **Otros roles** que no sean podólogo (`id_role = 2`).
- **Nómina fiscal**, clave SAT, ISR y `payroll.perceptions`.
- **Separar el pago en efectivo** del de transferencia.
- **Ajustar el bono a mano o recalcular solo el bono.**
- **Cambios retroactivos** en periodos aprobados (3) o pagados (4).
- **Asignación masiva** ("asignar a todos").

## Modelo de datos

**Cambios en BD.** El DDL va en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 65. Las tablas de las specs 64 y 65 no cambian.

```sql
-- Spec 68: bono por extensión de jornada asignado por empleado. Sin fila o activo = 0 = sin bono.
-- No tiene id_period: la asignación vale para cualquier periodo que se calcule mientras esté activa.
CREATE TABLE [payroll].[shift_extension_assignments](
    [id_empleado] [int]          NOT NULL,
    [activo]      [bit]          NOT NULL,
    [updated_by]  [int]          NOT NULL,
    [updated_at]  [datetime2](0) NOT NULL,
 CONSTRAINT [PK_shift_extension_assignments] PRIMARY KEY CLUSTERED ([id_empleado] ASC),
 CONSTRAINT [FK_shift_extension_assignments_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado])
) ON [PRIMARY]
GO

-- Spec 68: bitácora. Una fila por cada vez que el valor cambia.
CREATE TABLE [payroll].[shift_extension_assignments_log](
    [id_log]          [int] IDENTITY(1,1) NOT NULL,
    [id_empleado]     [int]          NOT NULL,
    [activo_anterior] [bit]          NULL,   -- NULL: el empleado no tenía fila
    [activo_nuevo]    [bit]          NOT NULL,
    [updated_by]      [int]          NOT NULL,
    [updated_at]      [datetime2](0) NOT NULL,
 CONSTRAINT [PK_shift_extension_assignments_log] PRIMARY KEY CLUSTERED ([id_log] ASC)
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_shift_extension_assignments_log_fecha]
    ON [payroll].[shift_extension_assignments_log] ([updated_at] DESC)
GO

-- Spec 68: resultado congelado del bono por renglón de nómina.
-- Los snapshots anteriores quedan sin asignar (0), con 0 días y 0 de importe.
ALTER TABLE [payroll].[period_employees] ADD
    [bono_extension_asignado] [bit]           NOT NULL CONSTRAINT [DF_period_employees_bono_extension_asignado] DEFAULT (0),
    [bono_extension_dias]     [smallint]      NOT NULL CONSTRAINT [DF_period_employees_bono_extension_dias]     DEFAULT (0),
    [importe_bono_extension]  [decimal](12,2) NOT NULL CONSTRAINT [DF_period_employees_importe_bono_extension]  DEFAULT (0)
GO
ALTER TABLE [payroll].[period_employees] WITH CHECK
    ADD CONSTRAINT [CK_period_employees_bono_extension] CHECK (
        ([bono_extension_asignado] = 0
            AND [bono_extension_dias] = 0 AND [importe_bono_extension] = 0)
     OR ([bono_extension_asignado] = 1
            AND [tipo_nomina] = 'O' AND [bono_extension_dias] >= 0 AND [importe_bono_extension] >= 0))
GO
```

No hay tabla de desglose ni candado. Los días se ven en la pestaña Asistencia del empleado.

**La bitácora no tiene `id_empresa` ni `id_sucursal`.** Para filtrarla, se hace JOIN con `RH.empleados` y se usa la sucursal activa, igual que con la población de la pestaña.

**Tipos compartidos** (`interfaces/payroll_bonus.ts`):

```ts
export type BonusKind = "punctuality" | "attendance" | "shift_extension";
```

**Tipos del bono** (archivo nuevo `interfaces/payroll_shift_extension_bonus.ts`):

```ts
export type ShiftExtensionAssignmentFilter = "all" | "assigned" | "unassigned";

export interface IShiftExtensionEmployeeRow {
  id_empleado:     number;
  codigo_empleado: string;
  nombre_completo: string;
  isAssigned:      boolean;
  scheduledDays:   number;   // días con horario en el rango del empleado
  workedDays:      number;   // días con horario y al menos una checada
  dailyRate:       number;   // salario_diario actual × 2 / 8, sin redondear
  estimatedAmount: number;   // 0 si no está asignado
}

export interface IShiftExtensionFilters {
  idPeriod:   number | null;
  assignment: ShiftExtensionAssignmentFilter;
  search:     string;
  page:       number;
}

export interface IShiftExtensionAssignmentLogEntry {
  id_log:          number;
  nombre_completo: string;
  activo_anterior: boolean | null;
  activo_nuevo:    boolean;
  updated_by_name: string;
  updated_at:      string;   // "YYYY-MM-DD HH:mm:ss"
}

export interface IShiftExtensionBonusPage {
  period:                   IPayrollPeriod | null;
  periodOptions:            Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  rows:                     IShiftExtensionEmployeeRow[];
  totalRows:                number;
  summary:                  { assigned: number; estimatedAmount: number };
  employeesWithoutSchedule: { id_empleado: number; nombre_completo: string }[];
  recalculationNeeded:      boolean;
}
```

**Cambios en tipos existentes** (`interfaces/payroll_calculation.ts`). `IPayrollEmployeeRow` e `IPayrollEmployeeSnapshot` ganan:

```ts
bono_extension_asignado: boolean;
bono_extension_dias:     number;
importe_bono_extension:  number;
```

**Constantes** (`lib/payroll/constants.ts`):

```ts
export const SHIFT_EXTENSION_HOURS_PER_DAY = 1;
export const SHIFT_EXTENSION_PAY_MULTIPLIER = 2;
export const SHIFT_EXTENSION_BONUS_PAGE_SIZE = 25;
```

**URLs** (`lib/payroll/bonusUrls.ts`):

- `BONUS_KIND_URL_VALUES` gana `shift_extension: "extension"`.
- Nuevos `SHIFT_EXTENSION_ASSIGNMENT_URL_VALUES` (`assigned: "asignado"`, `unassigned: "sin_asignar"`) y `readShiftExtensionAssignmentFilter(raw)`, que devuelve `"all"` por default.
- `BonusKindTabs` conserva `periodo` y `q` entre todas las pestañas. `resultado` solo se pasa entre puntualidad y asistencia, y `asignacion` no sale de la pestaña de extensión.

**Convenciones:**

- **Días trabajados en SQL.** Se reusa el CTE recursivo `period_days` con `OPTION (MAXRECURSION 400)`, el día ISO `(DATEDIFF(day, '19000101', fecha) % 7) + 1` y un `EXISTS` sobre `RH.asistencias` en el rango `[fecha, fecha + 1 día)`.
- **Importe.** El SQL usa `ROUND(salario_diario * SHIFT_EXTENSION_PAY_MULTIPLIER * SHIFT_EXTENSION_HOURS_PER_DAY / 8 * dias, 2)`, con las constantes interpoladas desde TS como números literales. Al leer, `decimal` pasa por `CAST(... AS float)`, como en las specs 64 y 65.
- **"Hoy"** llega como string desde `addZeroToday(new Date())`, aunque el conteo no lo necesita: los días futuros no tienen checada. En SQL nunca se usa `GETDATE()`.
- **Fechas.** `updated_at` se escribe con `buildDate(new Date())` y se lee con `CONVERT(varchar(19), ..., 120)`.

## Plan de implementación

1. **BD.** Correr el DDL del Modelo de datos y documentarlo en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 65. No cambia nada de código: las columnas nuevas quedan en 0 por defecto y la app sigue igual.
   - Verificación: todos los snapshots existentes tienen `bono_extension_asignado = 0` e `importe_bono_extension = 0`.
   - Verificación: insertar a mano un renglón `'F'` con `bono_extension_asignado = 1` falla por `CK_period_employees_bono_extension`.

2. **Tipos, constantes y URLs.**
   - Crear `interfaces/payroll_shift_extension_bonus.ts` y agregar `"shift_extension"` a `BonusKind`.
   - Agregar las tres columnas a `IPayrollEmployeeRow` e `IPayrollEmployeeSnapshot`, y leerlas en los SELECT de `getPayrollProcessPage` y `getPayrollEmployeeDetail`.
   - Agregar las tres constantes a `lib/payroll/constants.ts`.
   - En `lib/payroll/bonusUrls.ts`, agregar `shift_extension: "extension"`, `SHIFT_EXTENSION_ASSIGNMENT_URL_VALUES` y `readShiftExtensionAssignmentFilter`.
   - Verificación: la app compila, y Procesar, Detalle y Bonos se ven igual.

3. **Helper puro** `lib/payroll/shiftExtensionBonus.ts`, sin BD y sin `Date` sobre strings crudos:
   - `countShiftExtensionWorkedDays({ fechaInicio, fechaFin, fechaIngreso, scheduledIsoWeekdays, checkInDates })` devuelve `{ scheduledDays, workedDays }`.
   - `calculateShiftExtensionDailyRate(salarioDiario)` devuelve `salarioDiario × 2 / 8`, sin redondear.
   - `calculateShiftExtensionAmount(salarioDiario, workedDays)` redondea solo el total, a centavos.
   - `describeShiftExtensionBonus(snapshot)` da el texto "N días × $X" del Detalle.

   Verificación manual:
   - con salario $315.04 y 12 días, el importe es $945.12;
   - un domingo con checada y sin horario no cuenta;
   - un día con horario y sin checada no cuenta;
   - con `fecha_ingreso` a mitad del periodo, solo se cuentan los días desde el ingreso.

4. **Pestaña vacía.**
   - `BonusKindTabs` agrega "Extensión de jornada", con el manejo de `resultado` y `asignacion` del Modelo de datos.
   - `bonos/page.tsx` muestra `ShiftExtensionBonusView` con `bono=extension`. Por ahora, la vista es un `PayrollEmptyState` que dice "Próximamente".
   - Verificación: `?bono=extension` abre la pestaña nueva. Puntualidad y asistencia se ven igual, y `?bono=xyz` sigue abriendo puntualidad.

5. **Lectura.**
   - Agregar a `lib/payroll/schemas.ts` el schema `zod` de filtros.
   - Crear en `nomina/bonos/actions.ts` las actions `getShiftExtensionBonusPage` y `getShiftExtensionAssignmentsLog` (las últimas 20 filas de la sucursal activa).
   - `getShiftExtensionBonusPage` hace esto:
     - usa las fuentes de `lib/payroll/incidentSources.ts` (empleados controlados, horarios, días con checada);
     - lee las asignaciones y el `salario_diario` actual;
     - cuenta los días con el helper del paso 3, arma el resumen, filtra y pagina.
   - `recalculationNeeded` queda en `false` por ahora.

6. **Pestaña de solo lectura.** Sustituir el "Próximamente" por:
   - `ShiftExtensionToolbar`, un wrapper de `PayrollPeriodFilterToolbar` con `extraFilter` para `asignacion`;
   - `ShiftExtensionSummaryCards`, `ShiftExtensionEmployeesTable` y `ShiftExtensionAssignmentsLog` (un `<details>`), todos Server Components;
   - `EmployeesWithoutScheduleNotice`.

   La tabla todavía no tiene el botón.

   Verificación: en un periodo quincenal se listan los podólogos controlados con sus días con horario y días trabajados. Todos aparecen como "Sin asignar" con $0.

7. **Asignar y quitar.**
   - Agregar el schema `zod` `setShiftExtensionAssignmentSchema` (`id_empleado` entero > 0 y `activo` booleano).
   - Crear `setShiftExtensionAssignment`: una transacción que revisa que el empleado sea activo, de la sucursal activa y podólogo controlado, y lee la fila con `UPDLOCK, HOLDLOCK`. Si el valor cambia, hace upsert con `updated_at = buildDate(new Date())` y escribe la bitácora. Si no cambia, no escribe nada.
   - Crear `ShiftExtensionAssignmentButton`, un componente cliente con "Asignar" o "Quitar" y confirmación dentro de la interfaz. Llama a la action y refresca la ruta.

   Verificación: asignar a un podólogo muestra "Asignado" con su importe estimado, y la bitácora agrega una fila. Quitarlo agrega otra fila.

8. **Cálculo.**
   - Crear `lib/payroll/shiftExtensionBonusSql.ts` con `SHIFT_EXTENSION_BONUS_APPLY_SQL` y `SHIFT_EXTENSION_BONUS_COLUMNS`, siguiendo el patrón de `attendanceBonusSql.ts`. Los `APPLY` usan alias propios (`extension_*`).
   - En el batch de `calculatePayrollPeriod`, construir `#shift_extension_days` (empleado y fecha con horario y checada) y llenar las tres columnas solo en `'O'` de empleados controlados con asignación activa. Los renglones `'F'` quedan en 0 / 0 / 0.

   Verificación: comparar el snapshot de un periodo ya calculado antes y después de este paso. Debe quedar idéntico salvo las tres columnas nuevas, `calculated_at` y `calculated_by`.

9. **Procesar y Detalle.**
   - `getPayrollProcessPage` suma `importe_bono_extension` a "Total percepciones", a la tarjeta de resumen y al pie de la tabla.
   - `PayrollEmployeesTable` agrega la columna "Bono ext." después de "Bono asist.": el importe, más "N días" debajo cuando es mayor que 0.
   - `buildPerceptionLines` agrega `bono_extension_jornada` con `describeShiftExtensionBonus`. La línea se omite si el empleado no está asignado, si el importe es 0 o en la vista fiscal.

10. **Aviso "Recalcula".**
    - Crear `lib/payroll/shiftExtensionBonusRecalculation.ts` con `isShiftExtensionBonusRecalculationNeeded(idPeriod)`, server-only y solo para estatus 2.
    - Es un `SELECT` con `EXISTS` que usa los fragmentos del paso 8. Busca un renglón `'O'` cuyo asignado, días o importe de hoy sean distintos del snapshot. El importe de hoy se calcula con el `salario_diario` del snapshot.
    - Se muestra con `PayrollRecalculationNotice` en Procesar (`shiftExtensionBonusRecalculationNeeded`) y en la pestaña (`recalculationNeeded`).

    Verificación: con el periodo en estatus 2, quitar el bono a un podólogo que lo cobró muestra el aviso en Procesar y en la pestaña. El aviso desaparece después de "Recalcular".

11. **Documentación.** En `docs/nomina.md`:
    - agregar la sección "Bono por extensión de jornada (spec 68)", con la nota de capturar el horario con la hora extendida incluida;
    - actualizar el párrafo inicial con el concepto, las tablas y la pestaña;
    - actualizar la sección UI y la lista de líneas del Detalle.

## Criterios de aceptación

**Base de datos**

- [x] Existen `payroll.shift_extension_assignments` y `payroll.shift_extension_assignments_log`.
- [x] `payroll.period_employees` tiene `bono_extension_asignado`, `bono_extension_dias` e `importe_bono_extension`.
- [x] El DDL está en `queries.txt`, bloque `NOMINA PAYROLL`.
- [x] Los snapshots calculados antes de esta spec tienen `bono_extension_asignado = 0`, `bono_extension_dias = 0` e `importe_bono_extension = 0`.
- [x] Insertar a mano cualquiera de estos renglones falla por `CK_period_employees_bono_extension`:
  - un renglón `'F'` con `bono_extension_asignado = 1`;
  - un renglón con `bono_extension_asignado = 0` y `bono_extension_dias = 3`.

**Pestaña "Extensión de jornada"**

- [x] Bonos muestra tres pestañas: "Puntualidad", "Asistencia" y "Extensión de jornada". La activa está marcada.
- [x] `?bono=extension` abre la pestaña nueva, y sin `bono` o con un valor desconocido se abre puntualidad.
- [x] Puntualidad y asistencia se ven y se comportan igual que antes de esta spec.
- [x] Cambiar de pestaña conserva `periodo` y `q`, y regresa a la página 1.
- [x] La paginación y los filtros de la pestaña nueva conservan `bono=extension`.
- [x] Se listan solo los podólogos controlados del periodo. Un empleado sin usuario vinculado con `id_role = 2` y `status = 1` no aparece.
- [x] El filtro `asignacion=asignado` muestra solo a los asignados, y `sin_asignar` solo a los que no lo están.
- [x] Las tarjetas de resumen (asignados e importe estimado total) no cambian al filtrar por asignación o búsqueda.
- [x] Un podólogo sin horario aparece en el aviso "Sin horario definido" con 0 días trabajados.

**Días trabajados e importe**

- [x] Un día con horario y al menos una checada cuenta como trabajado.
- [x] Un día con horario y una checada incompleta (solo entrada) cuenta como trabajado.
- [x] Un día de descanso (sin horario) con checada **no** cuenta.
- [x] Un día con horario y sin checada no cuenta, aunque esté justificado (`'J'`) o marcado "No aplica" (`'N'`).
- [x] Un día con retardo grave cuenta como trabajado.
- [x] Un podólogo con `fecha_ingreso` a mitad del periodo solo suma los días desde su ingreso.
- [x] Con `salario_diario = 315.04` y 12 días trabajados, el importe es $945.12.
- [x] Un podólogo sin asignar aparece con $0 de importe estimado, aunque tenga días trabajados.

**Asignación**

- [x] "Asignar" pide confirmación dentro de la interfaz y no usa `confirm()` nativo.
- [x] Confirmar "Asignar" cambia la fila a "Asignado" y escribe una fila en la bitácora con `activo_anterior = NULL` y `activo_nuevo = 1`.
- [x] "Quitar" cambia la fila a "Sin asignar" y escribe una fila con `1 → 0`.
- [x] Llamar a `setShiftExtensionAssignment` con el mismo valor que ya tiene no escribe en la bitácora ni cambia `updated_at`.
- [x] Llamar a la action con un empleado de otra sucursal, inactivo o no controlado devuelve `{ ok: false }` y no escribe nada.
- [x] Un usuario con rol 2, 3, 5 o 6 que llama a la action directamente recibe `{ ok: false }`.
- [x] La bitácora muestra solo los cambios de los empleados de la sucursal activa.

**Cálculo**

- [x] Recalcular un periodo ya calculado deja idénticas las columnas `dias`, `dias_falta`, `dias_retardo` e `importe_salario`, las de comisiones, las de horas extra y las de los bonos de puntualidad y asistencia.
- [x] Un podólogo asignado con 12 días trabajados queda en su renglón `'O'` con asignado en 1, `bono_extension_dias = 12` e `importe_bono_extension = ROUND(salario_diario × 2 / 8 × 12, 2)`.
- [x] El renglón `'F'` del mismo podólogo queda con asignado en 0 y 0 / 0.
- [x] Un podólogo sin asignar, o con `activo = 0`, queda con asignado en 0 y 0 / 0.
- [x] Un empleado asignado que ya no es podólogo controlado queda con asignado en 0 y 0 / 0.
- [x] Un podólogo asignado sin días trabajados queda con asignado en 1, 0 días y $0.
- [x] El bono no cambia `horas_extra_dobles`, `horas_extra_triples` ni `limite_horas_dobles_aplicado`, y no aparece en Horas extra.
- [x] "Revertir" deja el periodo sin snapshot. Al calcular de nuevo, el bono se evalúa desde cero.

**Procesar y Detalle**

- [x] En Procesar, la columna "Bono ext." aparece después de "Bono asist." y muestra el importe, con "N días" debajo cuando es mayor que 0.
- [x] "Total percepciones", la tarjeta y el pie incluyen el bono por extensión, y no cambian con los filtros de puesto o búsqueda.
- [x] En el Detalle (operativa), un podólogo asignado con importe mayor que 0 ve "Bono por extensión de jornada" con "N días × $X" y el importe guardado.
- [x] La línea no aparece si el empleado no está asignado, si el importe es 0 o en la vista fiscal.

**Aviso "Recalcula"**

- [x] Con el periodo en estatus 2, cualquiera de estos cambios muestra "Hay bonos por extensión de jornada que no coinciden con el último cálculo. Recalcula la nómina." en Procesar y en la pestaña:
  - asignar o quitar el bono a un podólogo del periodo;
  - una checada nueva en un día con horario de un podólogo asignado.
- [x] Cambiar el `salario_diario` del empleado no muestra el aviso.
- [x] Después de "Recalcular", el aviso desaparece.
- [x] Con el periodo en estatus 1, el aviso nunca aparece.
- [x] Los demás avisos "Recalcula" siguen mostrando su propio texto.

**Documentación**

- [x] `docs/nomina.md` tiene la sección "Bono por extensión de jornada (spec 68)", con la nota de capturar el horario con la hora extendida incluida.
- [x] El párrafo inicial menciona el bono como concepto calculado, junto con sus tablas.

## Decisiones tomadas y descartadas

- **Sí:** un día trabajado es **un día con horario en el que hubo al menos una checada**. Es decisión del usuario: es lo único que refleja que de verdad se extendió la jornada.
- **No:** días con horario menos faltas injustificadas. Pagaría la extensión en vacaciones o en días marcados "No aplica".
- **No:** usar `dias - dias_retardo` del snapshot. Son días calendario e incluyen los días de descanso.
- **Sí:** una checada incompleta cuenta como día trabajado. Es el mismo criterio de Faltas: la checada que falta ya se ve en Horas extra.
- **Sí:** los retardos y los justificantes no afectan el conteo. Lo único que importa es si hubo checada en un día con horario.
- **Sí:** el importe es `ROUND(salario_diario × 2 / 8 × días, 2)` y solo se redondea el total. Sigue la regla de origen al pie de la letra, y redondear la tarifa diaria acumularía error de centavos.
- **Sí:** la hora (1) y el multiplicador (×2) son **constantes fijas** en `lib/payroll/constants.ts`. Es decisión del usuario: la regla los define y no pide que se puedan configurar.
- **No:** una configuración por empresa y frecuencia como la de las specs 64 y 65. No hay monto que ajustar, porque el bono depende del salario de cada empleado.
- **Sí:** se usa el `salario_diario` **operativo congelado** en el snapshot. Así el importe es coherente con el sueldo del mismo renglón, y cambiar el salario no cambia un cálculo ya guardado.
- **Sí:** solo nómina operativa (`'O'`). La regla de origen dice "Solo aplica en nómina operativa".
- **Sí:** misma población que Faltas, Retardos y Bonos (`ABSENCE_CONTROLLED_EMPLOYEE_CONDITION`, `id_role = 2`), sin constante nueva. La regla dice "empleados vinculados a un usuario con rol 2".
- **Sí:** la asignación vive en una **tabla propia con bitácora**, `payroll.shift_extension_assignments`. Es decisión del usuario: no mezcla nómina con `RH.empleados` y deja rastro de quién asignó y cuándo.
- **No:** una columna `bit` en `RH.empleados`. No deja bitácora y mete un concepto de nómina en el expediente.
- **Sí:** la asignación **no tiene vigencias**: se evalúa al calcular y vale para todo el periodo. Es decisión del usuario. Si se asigna a mitad del periodo, el bono se paga por todos los días trabajados del periodo.
- **Sí:** el bono se asigna desde una **pestaña de Bonos** (`bono=extension`), con un botón por fila y confirmación dentro de la interfaz. Es decisión del usuario: reusa la pantalla y el selector de las specs 64 y 65.
- **No:** asignarlo desde el expediente del empleado. Agrega otro lugar donde se edita lo mismo.
- **No:** un interruptor que guarda al instante sin confirmar. Un clic accidental cambia lo que cobra alguien.
- **Sí:** solo se puede asignar a podólogos controlados de la sucursal activa. Si después pierden el rol, la asignación se queda pero no cobra. Es decisión del usuario: el cálculo filtra a los no controlados, y la asignación vuelve a valer si se reactiva el rol.
- **Sí:** no es hora extra. No pasa por `overtime_authorizations` ni consume el límite de horas dobles. La regla dice "no se considera como tal ya que es un acuerdo".
- **Sí:** para evitar el doble pago con Horas extra, **el horario del podólogo se captura con la hora extendida incluida**. Es decisión del usuario. No cambia la detección de la spec 60, que ya funciona, y se documenta en `docs/nomina.md`.
- **No:** restar automáticamente 1 h de lo que detecta Horas extra a los asignados. Mete una excepción en la detección y en el pago de la spec 61.
- **Sí:** **no hay tabla de desglose ni candado** de pago único. Es decisión del usuario, igual que en las specs 64 y 65. Los días se ven en la pestaña Asistencia del empleado.
- **Sí:** con importe 0 o sin asignar, la línea del Detalle se omite. Es decisión del usuario: sigue la convención de omitir líneas en 0, y aquí no hay un bono "perdido" que explicar. La regla dice "si el empleado no recibe el bono, no debe mostrarse".
- **Sí:** el snapshot guarda `bono_extension_asignado` aparte de los días. Así se distingue "asignado con 0 días" de "no asignado", y el aviso "Recalcula" detecta que se asignó o se quitó el bono.
- **Sí:** un `CHECK` amarra el asignado a `tipo_nomina = 'O'` y obliga a 0 / 0 cuando no está asignado.
- **Sí:** aviso "Recalcula" propio, que compara lo que daría el cálculo hoy con el snapshot usando el **salario del snapshot**. Un cambio de salario no lo activa, igual que en el resto de la nómina.
- **No:** comparar `updated_at` de la asignación contra `calculated_at`. La comparación del resultado ya ve la asignación, porque el snapshot guarda `bono_extension_asignado`.
- **Sí:** el cálculo vive en SQL dentro del mismo batch, con fragmentos en `shiftExtensionBonusSql.ts` que comparte el aviso. El helper TS solo alimenta la pantalla. **Si difieren, manda el SQL**, como en las specs 53 a 65.
- **Sí:** los `APPLY` del bono usan alias propios (`extension_*`), así conviven con los `bonus_*` y `attendance_*` en el mismo `INSERT`.
- **Sí:** en la pestaña, el importe estimado usa el `salario_diario` actual. Antes de calcular no hay snapshot; después de calcular, Procesar y el Detalle muestran siempre el importe guardado.
- **Sí:** se usa el horario actual para todo el periodo, igual que en las specs 60 a 65.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| **Doble pago con Horas extra** si el horario del podólogo no incluye la hora extendida: Horas extra detecta esa hora todos los días y se puede autorizar además del bono. | `docs/nomina.md` dice que el horario se captura con la extensión incluida. El administrador revisa Horas extra antes de autorizar. |
| **Si se calcula antes de que termine el periodo, el bono se paga con datos parciales:** los días que se trabajen después del cálculo no se cuentan. | El aviso "Recalcula" aparece en estatus 2 en cuanto hay una checada nueva. Recalcular después de `fecha_fin` y antes de aprobar. |
| **Un checador que deja de mandar checadas** hace que los días sin checada no cuenten y baja el bono de todos los asignados de la sucursal. | Revisar Faltas antes de calcular. Una vez que las checadas lleguen, el aviso "Recalcula" lo marca. |
| **Un podólogo asignado que pierde el usuario activo con rol 2** deja de cobrar sin ningún aviso, y desaparece de la pestaña. | Es el mismo riesgo de las specs 62 a 65. Revisar la pestaña Usuarios del empleado (spec 55) antes de calcular. |
| **Dos periodos de distinta frecuencia que se traslapan** (solo pasa si el empleado cambia de frecuencia) pagan dos veces los mismos días, porque no hay candado. | Es la misma limitación de los bonos de las specs 64 y 65. Queda documentada. |
| **Agregar más columnas y `APPLY` al `INSERT` de `calculatePayrollPeriod`**, que ya encadena salario, faltas, retardos, comisiones, horas extra y dos bonos. Un alias repetido o una columna fuera de orden rompe el cálculo de todos. | Los alias son propios (`extension_*`) y las columnas se arman desde `SHIFT_EXTENSION_BONUS_COLUMNS`. Verificación del paso 8: el snapshot de un periodo ya calculado queda idéntico salvo las tres columnas nuevas. |
| **No hay cambios retroactivos:** quitar el bono cuando el periodo ya está Aprobado (3) o Pagado (4) no revierte nada. | Queda documentado. Quien construya los estatus 3 y 4 debe tenerlo en cuenta, como en las specs 61 a 65. |

## Lo que no incluye esta spec

- Vigencias o fechas de asignación.
- Hora y multiplicador configurables, o un monto fijo por empleado.
- Descontar automáticamente la hora de extensión de lo que detecta Horas extra.
- Tabla de desglose de días y candado de pago único.
- Asignar el bono desde el expediente del empleado.
- Otros roles que no sean podólogo.
- Nómina fiscal, clave SAT, ISR y `payroll.perceptions`.
- Separar el pago en efectivo del de transferencia.
- Ajustar el bono a mano o recalcular solo el bono.
- Cambios retroactivos en periodos aprobados (3) o pagados (4).
- Asignación masiva.

Cada uno de estos puntos, si se llega a hacer, va en su propia spec.
