# 80 — Nómina: excluir días económicos de faltas, retardos y bonos

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [62 — Control de faltas](62-nomina-control-faltas.md) y [63 — Control de retardos](63-nomina-control-retardos.md): `#absences`, `#lateness`, `detectEmployeeAbsences`, `detectEmployeeLateness`, las pantallas Faltas y Retardos y sus escrituras.
  - [64 — Bono de puntualidad](64-nomina-bono-puntualidad.md) y [65 — Bono de asistencia](65-nomina-bono-asistencia.md): leen `#absences` y `#lateness` y tienen sus avisos "Recalcula".
  - [77 — Excluir vacaciones de faltas, retardos y bonos](77-nomina-excluir-vacaciones-incidencias.md): `NOT_ON_VACATION_CONDITION` y los seis lugares que la usan, `loadVacationBlocks`, `buildVacationDatesByEmployee`, el estado `"vacation"` de Faltas y `validateDayIsNotOnVacation`. Esta spec repite ese patrón.
  - [79 — Días económicos](79-empleado-dias-economicos.md): `RH.economic_days` (filas con `cancelado_at IS NULL`) y el índice `UX_economic_days_empleado_fecha_activo (id_empleado, fecha)`.
- **Modifica base de datos:** No. Solo lee `RH.economic_days`, y su índice filtrado ya cubre la búsqueda por empleado y fecha.
- **Fecha:** 2026-10-15
- **Objetivo:** Que un día económico activo deje de detectarse como falta o retardo, y por lo tanto se pague como trabajado y no quite los bonos de asistencia y puntualidad, en el cálculo de nómina, en los avisos "Recalcula" y en las pantallas de Faltas, Retardos y Bonos.
- **Reglas de origen:** `references/nomina/reglas_modulo_nomina.md` §2.7 ("computar el día como trabajado"); spec 79, sección "No incluye", y su riesgo "El día económico sigue detectándose como falta".

## Alcance

**Incluye:**

- **Regla de exclusión.** Un día es "día económico" para un empleado cuando existe una fila de `RH.economic_days` con `cancelado_at IS NULL` y `fecha` igual a ese día.
  - Un día cancelado deja de excluir. Al recalcular, vuelve a ser falta si no tiene checada.
  - Cancelar y registrar otra fecha excluye solo la fecha nueva.
- **Faltas.** Un día económico nunca es falta. No descuenta sueldo, ni en `'O'` ni en `'F'`, y no bloquea el día en `period_employee_absences`. Como el salario es días del periodo − `dias_falta`, el día se paga sin percepción nueva: eso es "computar el día como trabajado".
- **Retardos.** Un día económico nunca es retardo, aunque tenga una checada `entrada` tarde: **el día económico manda**. Tampoco descuenta sueldo ni bloquea el día en `period_employee_lateness`.
- **Bonos de puntualidad y asistencia.** Los días económicos son neutros: no suman incidencias ni faltas. Los motivos de "No evaluado" no cambian.
- **Regla SQL compartida** (en `lib/payroll/paidLeaveExclusionSql.ts`):
  - `NOT_ON_ECONOMIC_DAY_CONDITION`, nueva;
  - `NOT_ON_PAID_LEAVE_CONDITION`, que es `NOT_ON_VACATION_CONDITION AND NOT_ON_ECONOMIC_DAY_CONDITION`.

  Los seis lugares de la spec 77 dejan de importar `NOT_ON_VACATION_CONDITION` y pasan a importar solo la combinada:
  - `#absences` y `#lateness` en `calculatePayrollPeriod`;
  - `absenceRecalculation.ts` y `latenessRecalculation.ts`;
  - `punctualityBonusRecalculation.ts` y `attendanceBonusRecalculation.ts`.

  Un futuro catálogo de festivos tocaría solo esta constante.
- **Avisos "Recalcula".** En estatus 2 saltan solos cuando se registra o cancela un día económico que toca un periodo ya calculado.
- **Pantalla Faltas:**
  - Los días económicos que **habrían sido falta** (con horario, sin checada, anteriores a hoy) aparecen como filas de solo lectura con estado **"Día económico"**. No tienen acciones ni badge "Descontada en".
  - Hay un filtro nuevo, `estado=dia-economico`, y una tarjeta de resumen "Días económicos: N", que cubre el periodo completo y no cambia con los filtros.
  - Si ese día tiene una justificación previa (`'J'` o `'N'`), se muestra como "Día económico".
  - Si por datos viejos un día fuera a la vez vacaciones y día económico (hoy la spec 79 lo impide en ambos sentidos), se clasifica como "Vacaciones".
- **Pantalla Retardos:** los días económicos simplemente no aparecen, sin fila ni tarjeta.
- **Pantalla Bonos** (pestañas de puntualidad y asistencia): solo se excluyen los días, para que los conteos coincidan con el cálculo.
- **Escrituras:**
  - `justifyAbsence`, `markAbsenceNotApplicable`, `justifyLateness` y `markLatenessNotApplicable` rechazan un día económico con `{ ok: false, message: "Ese día es un día económico del empleado; no requiere justificación." }`;
  - `clearAbsenceJustification` y `clearLatenessJustification` siguen sin validar el día.
- **Datos existentes.** Los "No aplica" que ya se marcaron a mano en días económicos se quedan como están, sin migración.
- **Documentación:**
  - en `docs/nomina.md`, una sección "Exclusión de días económicos (spec 80)", y la sección de la spec 77 actualizada para mencionar la constante combinada;
  - en `docs/rh-empleados.md`, sección "Días económicos (spec 79)": se quita la limitación conocida de que todavía cuentan como falta.

**No incluye (otras specs):**

- Bono por extensión de jornada (spec 68): no se toca. Un día económico sin checada no cuenta como día trabajado para ese bono.
- Cambios retroactivos en periodos Aprobados o Pagados (3/4). Registrar o cancelar un día económico sobre días ya descontados en esos periodos no revierte nada, y tampoco avisa ni bloquea en el modal de la spec 79.
- Horas extra en días económicos con checada.
- Bloquear el registro de un día económico en una fecha pasada que ya tiene checadas.
- Mostrar los días económicos en la pestaña Asistencia del expediente, en Procesar o en el Detalle de nómina.
- Mostrar en Bonos cuántos días se excluyeron.
- Desactivar la validación en el checador biométrico.
- Catálogo de días festivos.

## Modelo de datos

**Base de datos:** sin cambios. Solo se lee `RH.economic_days` (spec 79). El índice filtrado `UX_economic_days_empleado_fecha_activo (id_empleado, fecha) WHERE cancelado_at IS NULL` cubre exactamente la búsqueda por empleado y fecha.

### Fragmento SQL compartido: `lib/payroll/paidLeaveExclusionSql.ts` (`server-only`)

Supone los mismos alias que `NOT_ON_VACATION_CONDITION`: `e` para `RH.empleados` y `d` para `period_days`.

```ts
import "server-only";
import { NOT_ON_VACATION_CONDITION } from "@/lib/payroll/vacationExclusionSql";

/** Spec 80: un día económico activo no es falta ni retardo. */
export const NOT_ON_ECONOMIC_DAY_CONDITION = `
          NOT EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[economic_days] ed
                       WHERE ed.[id_empleado] = e.[id_empleado]
                         AND ed.[cancelado_at] IS NULL
                         AND ed.[fecha] = d.[fecha])`;

/** Spec 80: días con goce (vacaciones + días económicos). Es lo único que importan los seis lugares. */
export const NOT_ON_PAID_LEAVE_CONDITION = `${NOT_ON_VACATION_CONDITION}
          AND ${NOT_ON_ECONOMIC_DAY_CONDITION}`;
```

- `vacationExclusionSql.ts` se queda igual. Ahora solo lo importa `paidLeaveExclusionSql.ts`.
- La igualdad `ed.fecha = d.fecha` usa el índice filtrado, y el filtro `cancelado_at IS NULL` coincide con el del índice.

### Fuente compartida: `lib/payroll/incidentSources.ts`

```ts
export interface IEconomicDayRow {
  id_empleado: number;
  fecha:       string;   // "YYYY-MM-DD"
}

/** Spec 80: días económicos activos de los empleados con control dentro del periodo. */
export async function loadEconomicDays(
  idSucursal: number,
  period: IIncidentPeriodRange,
): Promise<IEconomicDayRow[]>;
// WHERE REVIEWED_EMPLOYEE_CONDITIONS
//   AND ed.cancelado_at IS NULL
//   AND ed.fecha BETWEEN CAST(@fecha_inicio AS date) AND CAST(@fecha_fin AS date)
// fecha con CONVERT(varchar(10), …, 120).
```

### Helpers puros: `lib/payroll/paidLeaveExclusion.ts`

Se importan desde el servidor y usan solo strings.

```ts
/** id_empleado -> fechas "YYYY-MM-DD" de días económicos activos (ya vienen recortadas al periodo por el SQL). */
export function buildEconomicDayDatesByEmployee(
  rows: IEconomicDayRow[],
): Map<number, Set<string>>;

/** id_empleado -> unión de fechas de vacaciones y días económicos, recortada al rango. Para Retardos y Bonos. */
export function buildPaidLeaveDatesByEmployee(
  vacationBlocks: IVacationBlockRow[],
  economicDays: IEconomicDayRow[],
  rangeStart: string,
  rangeEnd: string,
): Map<number, Set<string>>;
// Reusa buildVacationDatesByEmployee y le suma buildEconomicDayDatesByEmployee.
```

**Helpers de detección.** Cambia solo el nombre del parámetro; el comportamiento no cambia.

```ts
detectEmployeeAbsences(schedules, checadaDates, rangeStart, rangeEndExclusive, paidLeaveDates = new Set<string>())
detectEmployeeLateness(schedules, firstEntryByDate, rangeStart, rangeEnd, settings, paidLeaveDates = new Set<string>())
```

`vacationDates` pasa a llamarse `paidLeaveDates`. Ahora recibe la unión, y los comentarios JSDoc se actualizan.

### Tipos: `interfaces/payroll_absence.ts`

```ts
export type AbsenceStatus = "unjustified" | "justified" | "not_applicable" | "vacation" | "economic_day";

// IAbsencePage.summary gana:
summary: { unjustifiedDays: number; justifiedDays: number; notApplicableDays: number; vacationDays: number; economicDays: number };
```

- Una fila `"economic_day"` se arma igual que una `"vacation"`:
  - `url`, `mime_type`, `comentario`, `decided_by_name` y `decided_at` en `null`;
  - `discountedInPeriodCodes: []`.
- `lib/payroll/absenceUrls.ts`: `ABSENCE_STATUS_URL_VALUES.economic_day = "dia-economico"`.
- Orden de clasificación en `getAbsencePage`: vacaciones → día económico → justificación.

Retardos y Bonos no cambian de tipos.

### Escrituras: `lib/payroll/justificationWrites.ts`

```ts
/** Spec 80: un día económico activo ya está excluido de faltas y retardos; justificarlo no tendría efecto. */
export async function validateDayIsNotOnEconomicDay(
  transaction: ITransactionClient,
  idEmpleado: number,
  fecha: string,
): Promise<JustificationWriteCheck>;
// SELECT TOP 1 1 FROM RH.economic_days WHERE id_empleado = @id_empleado
//   AND cancelado_at IS NULL AND fecha = CAST(@fecha AS date)
// Mensaje: "Ese día es un día económico del empleado; no requiere justificación."
```

## Plan de implementación

Cada paso deja el sistema compilando (`npm run build`) y funcional.

1. **Fragmento SQL, fuente de datos y helpers puros.**
   - Crear `lib/payroll/paidLeaveExclusionSql.ts` con `NOT_ON_ECONOMIC_DAY_CONDITION` y `NOT_ON_PAID_LEAVE_CONDITION`.
   - Agregar `IEconomicDayRow` y `loadEconomicDays` a `lib/payroll/incidentSources.ts`.
   - Crear `lib/payroll/paidLeaveExclusion.ts` con `buildEconomicDayDatesByEmployee` y `buildPaidLeaveDatesByEmployee`.

   Todavía nadie los usa.

2. **Cálculo de nómina (fuente de verdad).**
   - En `calculatePayrollPeriod` (`nomina/procesar/actions.ts`), reemplazar `NOT_ON_VACATION_CONDITION` por `NOT_ON_PAID_LEAVE_CONDITION` en el `WHERE` de `#absences` y de `#lateness`, y cambiar el import.
   - Con eso cambian solos el descuento por faltas y retardos (`'O'` y `'F'`), los candados y los dos bonos.
   - Prueba manual, en una transacción que se revierte:
     - recalcular un periodo **sin** días económicos y comparar su snapshot antes y después: debe quedar idéntico, salvo `calculated_at` y `calculated_by`;
     - con un día económico activo sobre un día sin checada, `dias_falta` baja en 1, `importe_salario` sube un `salario_diario` y el bono de asistencia se conserva.

3. **Avisos "Recalcula".** Hacer el mismo reemplazo de import y constante en `absenceRecalculation.ts`, `latenessRecalculation.ts`, `punctualityBonusRecalculation.ts` (sus dos usos) y `attendanceBonusRecalculation.ts`.
   - Al terminar, `grep NOT_ON_VACATION_CONDITION` solo debe encontrarse en `vacationExclusionSql.ts` y en `paidLeaveExclusionSql.ts`.
   - Prueba manual: con un periodo en estatus 2 ya calculado, registrar un día económico sobre una falta descontada.
     - Debe aparecer el aviso en Faltas, en Procesar y en la pestaña Asistencia de Bonos.
     - Al recalcular, desaparece.
     - Cancelar el día hace que el aviso vuelva a aparecer.

4. **Helpers de detección.**
   - Renombrar el parámetro `vacationDates` a `paidLeaveDates` en `detectEmployeeAbsences` y `detectEmployeeLateness`, junto con su JSDoc.
   - El comportamiento es idéntico.

5. **Pantallas Retardos y Bonos.**
   - `getLatenessPage` y las dos lecturas de `bonos/actions.ts` (puntualidad y asistencia) cargan también `loadEconomicDays`, en el mismo `Promise.all`, y con la misma guarda que ya tiene `loadVacationBlocks` en Bonos.
   - Cambian `buildVacationDatesByEmployee` por `buildPaidLeaveDatesByEmployee` y pasan la unión a los helpers.
   - Los conteos de pantalla quedan alineados con el SQL.

6. **Pantalla Faltas.**
   - `AbsenceStatus` gana `"economic_day"`, `summary` gana `economicDays` y `ABSENCE_STATUS_URL_VALUES` gana `economic_day: "dia-economico"`.
   - `getAbsencePage` carga `loadEconomicDays` y arma `buildEconomicDayDatesByEmployee`. Sigue detectando sin exclusión, y clasifica cada fecha en este orden: vacaciones → día económico → justificación. La fila `"economic_day"` se arma igual que la de vacaciones.
   - Para no duplicar el objeto, se extrae un pequeño helper local (por ejemplo `buildPaidLeaveAbsenceRow(absence, employee, status)`) que usan ambos casos.
   - Cambios de UI:
     - `AbsenceSummaryCards` agrega la tarjeta "Días económicos";
     - `AbsenceToolbar` agrega la opción "Día económico";
     - `AbsenceDaysTable` agrega el badge "Día económico" y no muestra acciones para esas filas. La guarda `dayRow.status === "vacation"` pasa a cubrir ambos estados.

     Los tres siguen siendo Server Components, salvo `AbsenceToolbar`, que ya es cliente.
   - Se diseña con la skill `frontend-design`, reutilizando los estilos de badge y tarjeta de vacaciones, con un tono distinto.

7. **Escrituras.**
   - Agregar `validateDayIsNotOnEconomicDay` en `lib/payroll/justificationWrites.ts`.
   - Llamarla en `justifyAbsence`, `markAbsenceNotApplicable`, `justifyLateness` y `markLatenessNotApplicable`, dentro de la transacción y justo después de `validateDayIsNotOnVacation`.
   - Las dos acciones `clear*` no la llaman.

8. **Documentación.**
   - En `docs/nomina.md`:
     - nueva sección "Exclusión de días económicos (spec 80)" después de la de la spec 77, con la regla, la constante combinada, "el día económico manda" sobre la checada, el estado de Faltas, las escrituras y que el bono de extensión no cambia;
     - en la sección de la spec 77, decir que los seis lugares ahora importan `NOT_ON_PAID_LEAVE_CONDITION`, y que el parámetro de los helpers se llama `paidLeaveDates`;
     - en Bono de puntualidad y Bono de asistencia, agregar que los días económicos también son neutros.
   - En `docs/rh-empleados.md`, sección "Días económicos (spec 79)": quitar la limitación conocida de que todavía cuentan como falta y enlazar la spec 80.
   - En la spec 79 no se cambia nada (ya está implementada).

## Criterios de aceptación

**Cálculo**

- [x] Un podólogo con horario L–V, sin checada el miércoles y con un día económico activo ese miércoles, dentro de un periodo semanal:
  - queda con `dias_falta = 0` en `'O'` y en `'F'`;
  - su `importe_salario` es igual al de un periodo sin faltas;
  - `period_employee_absences` no tiene fila suya para ese día.
- [x] Un día económico con una checada `entrada` 40 minutos tarde no genera fila en `period_employee_lateness` y no suma a `dias_retardo`.
- [x] Un podólogo cuya única falta del periodo es un día económico queda en `bono_asistencia_resultado = 'C'`, con el monto configurado, cuando se cumplen las demás condiciones.
- [x] Un podólogo cuyo único retardo del periodo cae en un día económico queda en `bono_puntualidad_resultado = 'C'`, con el monto configurado, cuando se cumplen las demás condiciones.
- [ ] Un podólogo con 1 día económico y 1 falta injustificada en otro día queda con `dias_falta = 1` y pierde el bono de asistencia (`bono_asistencia_faltas = 1`).
- [x] Un día económico **cancelado** sin checada vuelve a ser falta al recalcular.
- [ ] Cancelar un día y registrar otra fecha excluye solo la fecha nueva.
- [x] Un día económico no cambia `bono_extension_dias` ni `importe_bono_extension` (spec 68).
- [x] Recalcular un periodo ya calculado sin días económicos produce un snapshot idéntico al anterior, salvo `calculated_at` y `calculated_by`. Se compara dentro de una transacción revertida.
- [ ] Los casos de vacaciones de la spec 77 siguen dando el mismo resultado: un bloque de vacaciones sigue excluyendo sus días.

**Avisos "Recalcula"**

- [x] En un periodo en estatus 2, registrar un día económico sobre una falta ya descontada hace aparecer el aviso en Faltas, en Procesar y en la pestaña Asistencia de Bonos. Al recalcular, desaparece.
- [ ] Registrar un día económico sobre un retardo ya descontado hace aparecer el aviso en Retardos y en Procesar.
- [x] Cancelar ese día económico después de recalcular hace que el aviso vuelva a aparecer.
- [ ] Registrar un día económico fuera de las fechas del periodo no hace aparecer ningún aviso.

**Pantallas**

- [ ] En Faltas, un día económico con horario y sin checada aparece con el badge "Día económico". No tiene botones de justificar, "No aplica" ni limpiar, ni "Descontada en".
- [ ] Un día económico con una justificación "No aplica" previa se muestra como "Día económico".
- [ ] `?estado=dia-economico` muestra solo esas filas.
- [ ] La tarjeta "Días económicos" cuenta todo el periodo y no cambia con los filtros ni con la búsqueda.
- [ ] Las tarjetas "Injustificadas", "Justificadas", "No aplica" y "Días de vacaciones" no cuentan días económicos.
- [x] En Retardos, un día económico con entrada tarde no aparece en la lista ni en las tarjetas.
- [x] En Bonos (puntualidad y asistencia), los conteos de retardos, faltas e incidencias y el resultado de cada empleado coinciden con lo que guarda el cálculo para el mismo periodo.
- [ ] La tarjeta, el badge y la opción del filtro nuevos se ven correctamente en modo claro y oscuro, y a 375 px de ancho.

**Escrituras**

- [ ] `justifyAbsence`, `markAbsenceNotApplicable`, `justifyLateness` y `markLatenessNotApplicable` sobre un día económico activo devuelven `{ ok: false, message: "Ese día es un día económico del empleado; no requiere justificación." }` y no escriben nada.
- [ ] Sobre un día económico **cancelado**, esas mismas acciones funcionan normalmente.
- [ ] `clearAbsenceJustification` sobre un día económico con una justificación vieja la borra con éxito.

**General**

- [x] `NOT_ON_ECONOMIC_DAY_CONDITION` y `NOT_ON_PAID_LEAVE_CONDITION` son las únicas definiciones SQL de la regla: los seis lugares importan `NOT_ON_PAID_LEAVE_CONDITION`, ninguno la reescribe y ninguno importa `NOT_ON_VACATION_CONDITION`.
- [x] Ninguna fecha viaja como `Date`: `loadEconomicDays` usa `CONVERT(varchar(10), …, 120)` y los helpers comparan strings.
- [ ] `npm run build` y `npm run lint` pasan sin errores nuevos.
- [ ] `docs/nomina.md` tiene la sección "Exclusión de días económicos (spec 80)".
- [ ] `docs/rh-empleados.md` ya no menciona que el día económico cuenta como falta.

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| Un día económico es una fila de `RH.economic_days` con `cancelado_at IS NULL` y `fecha` igual al día | Contar también los cancelados, o filtrar por quién lo registró | La cancelación es la forma de corregir (spec 79). Un día cancelado no debe proteger nada. |
| "Computar como trabajado" = no es falta ni retardo. El salario lo paga solo, porque es días del periodo − `dias_falta` | Una percepción nueva "Día económico" en nómina | El sueldo ya incluye los días del calendario. Una percepción aparte pagaría el día dos veces. |
| **El día económico manda** sobre la checada: no es retardo aunque haya entrada tarde | Que la checada mande y el retardo cuente | Decisión del usuario, por consistencia con vacaciones (spec 77). Si se capturó mal, RH lo cancela, cosa que la spec 79 permite en cualquier fecha del año. |
| Días económicos neutros en los bonos de puntualidad y asistencia | "No evaluado" con un motivo nuevo, o prorrateo | Es literal a la regla §2.7 y no agrega motivos ni reglas nuevas. |
| Constante nueva `NOT_ON_ECONOMIC_DAY_CONDITION` y combinada `NOT_ON_PAID_LEAVE_CONDITION`; los seis lugares importan solo la combinada | (a) Pegar las dos condiciones en los seis lugares (12 pegados). (c) Ampliar `NOT_ON_VACATION_CONDITION` | Decisión del usuario (1b). Un solo punto de cambio para futuros permisos con goce, como los festivos, sin que el nombre de la regla de vacaciones mienta. |
| Excluir en `#absences` y `#lateness`, no en cada bono | Agregar la exclusión dentro de los `APPLY` de los bonos | Igual que en la spec 77: una sola regla alimenta el descuento, el candado y los dos bonos. |
| Leer `RH.economic_days` directamente con igualdad de fecha | Materializar los días con goce en una tabla `payroll` | El índice filtrado de la spec 79 ya cubre `(id_empleado, fecha)`. No hay que mantener otra copia. |
| Renombrar el parámetro de los helpers de `vacationDates` a `paidLeaveDates` y pasarles la unión | Un segundo parámetro `economicDayDates` | Para los helpers, la regla es la misma: "estas fechas no cuentan". Un parámetro extra no aporta. |
| En Faltas, filas de solo lectura "Día económico" con filtro y tarjeta | Ocultarlas sin rastro | Decisión del usuario. RH ve que esos días están cubiertos y deja de marcarlos "No aplica" a mano. |
| Precedencia en Faltas: vacaciones → día económico → justificación | Día económico antes que vacaciones | Hoy la spec 79 impide que coincidan. Si ocurre por datos viejos, vacaciones ya era la etiqueta existente y no cambia lo que RH veía. |
| En Retardos, simplemente no aparecen | Fila "Día económico" en Retardos | Es el mismo criterio que vacaciones. Un día económico con entrada es raro. |
| Justificar y "No aplica" rechazan días económicos activos; limpiar no | Permitir justificar días económicos | La justificación no tendría efecto. Limpiar debe seguir funcionando para las filas viejas. |
| Sin migración de los "No aplica" marcados a mano mientras existía la limitación de la spec 79 | Borrarlos con un script | No estorban, porque el día económico se evalúa antes, y conservan el rastro. |
| No tocar el bono por extensión de jornada (spec 68) | Contar el día económico como día trabajado para ese bono | Decisión del usuario. No hubo jornada que extender, y vacaciones tampoco cuenta. |
| Sin cambio retroactivo en periodos 3/4, y sin aviso al registrar o cancelar | Bloquear o avisar en el modal de la spec 79 | Es el mismo criterio que las justificaciones y las vacaciones. En estatus 2, el aviso "Recalcula" ya lo detecta. |
| Sin cambios de BD | Índice nuevo | `UX_economic_days_empleado_fecha_activo` ya es exactamente el índice que necesita la condición. |

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Reemplazar `NOT_ON_VACATION_CONDITION` en los seis lugares rompe la exclusión de vacaciones o altera periodos ya calculados | La combinada incluye la de vacaciones sin cambiarla. Hay prueba de snapshot idéntico dentro de una transacción revertida (sin días económicos), y un criterio explícito de que los casos de la spec 77 siguen igual. |
| La regla queda desincronizada entre el SQL y los helpers de pantalla | Hay una sola constante SQL y una sola función de unión (`buildPaidLeaveDatesByEmployee`). El criterio de Bonos compara la pantalla con el snapshot. Si divergen, **manda el SQL**. |
| Un día económico mal capturado oculta una falta o un retardo real | El día económico manda por decisión explícita. La spec 79 permite cancelarlo en cualquier fecha del año en curso, y el aviso "Recalcula" salta en estatus 2. |
| Se registra o cancela un día económico sobre días de un periodo Aprobado o Pagado (3/4) | No hay reversión ni aviso. Se documenta en `docs/nomina.md`, y quien construya los estatus 3/4 debe considerarlo, igual que con vacaciones. |
| Cancelar un día económico pasado, después de pagar el periodo, convierte el día en falta solo en un recálculo futuro | Los periodos 3/4 no se recalculan. En estatus 2, el aviso lo muestra antes de aprobar. |
| Un día económico de diciembre que cae en un periodo que cruza al año siguiente | No afecta: la exclusión compara la fecha, no el año. El límite anual solo vive en `registerEconomicDay`. |
| Costo del `NOT EXISTS` extra por día y empleado | Es una igualdad sobre el índice filtrado `(id_empleado, fecha)`, y la tabla tiene como máximo 3 filas activas por empleado y año. |

## Lo que **no** está en esta spec

- El bono por extensión de jornada (spec 68).
- Cambios retroactivos en periodos Aprobados o Pagados (3/4), o avisos al registrar o cancelar días económicos sobre días ya descontados.
- Horas extra en días económicos con checada.
- Bloquear el registro de un día económico en una fecha pasada con checadas.
- Días económicos visibles en la pestaña Asistencia del expediente, en Procesar o en el Detalle.
- Conteo en Bonos de los días excluidos.
- Desactivar la validación en el checador biométrico.
- Catálogo de días festivos.

Cada una, si se hace, va en su propia spec.
