# 77 — Nómina: excluir vacaciones de faltas, retardos y bonos

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [62 — Control de faltas](62-nomina-control-faltas.md): `#absences`, `absenceDetection.ts`, `isAbsenceRecalculationNeeded`, la pantalla Faltas y sus escrituras.
  - [63 — Control de retardos](63-nomina-control-retardos.md): `#lateness`, `latenessDetection.ts`, `isLatenessRecalculationNeeded` y las escrituras de Retardos.
  - [64 — Bono de puntualidad](64-nomina-bono-puntualidad.md) y [65 — Bono de asistencia](65-nomina-bono-asistencia.md): leen `#absences` y `#lateness`, y tienen sus propios avisos "Recalcula".
  - [76 — Asignación de vacaciones](76-empleado-asignacion-vacaciones.md): el bloque `fecha_inicio`..`fecha_fin` de `RH.vacation_entitlements`.
- **Modifica base de datos:** No. Solo lee `RH.vacation_entitlements`; el `UNIQUE (id_empleado, anio_servicio)` ya indexa por empleado.
- **Fecha:** 2026-10-14
- **Objetivo:** Que los días dentro de un bloque de vacaciones capturado dejen de detectarse como faltas o retardos, y por lo tanto no descuenten sueldo ni quiten los bonos de asistencia y puntualidad, tanto en el cálculo de nómina como en los avisos "Recalcula" y en las pantallas de Faltas, Retardos y Bonos.
- **Reglas de origen:** spec 76, sección "No incluye" ("Excluir los días de vacaciones de la detección de faltas, retardos y de los bonos…") y el riesgo "Vacaciones detectadas como faltas".

## Alcance

**Incluye:**

- **Regla de exclusión.** Un día es "de vacaciones" para un empleado cuando existe una fila de `RH.vacation_entitlements` con bloque capturado (`fecha_inicio IS NOT NULL`) y el día cae entre `fecha_inicio` y `fecha_fin`, ambos incluidos.
  - Cuenta cualquier estatus derivado del año: `programada`, `en_curso`, `tomada`, y también `por_pagar` o `pagada` cuando hay bloque.
  - Los días pagados en efectivo (`dias_pagados`) no son días de vacaciones.
  - Un bloque cancelado ya no tiene fechas (spec 76), así que deja de excluir.
  - Un bloque reprogramado excluye solo sus fechas nuevas.
- **Faltas.** Un día de vacaciones nunca es falta: ni descuenta sueldo (`'O'` ni `'F'`) ni bloquea el día en `period_employee_absences`.
- **Retardos.** Un día de vacaciones nunca es retardo, aunque tenga una checada `entrada` tarde: **las vacaciones mandan**. Tampoco descuenta sueldo ni bloquea el día en `period_employee_lateness`.
- **Bonos de puntualidad y asistencia.** Los días de vacaciones son neutros: no suman incidencias ni faltas. Un podólogo de vacaciones todo el periodo tiene 0 incidencias y **conserva** ambos bonos. Los motivos de "No evaluado" no cambian.
- **Dónde se aplica** (la regla está copiada en seis lugares y los seis deben coincidir):
  - el SQL de `calculatePayrollPeriod` (`#absences` y `#lateness`), que es la fuente de verdad;
  - los cuatro avisos "Recalcula": `absenceRecalculation.ts`, `latenessRecalculation.ts`, `punctualityBonusRecalculation.ts` y `attendanceBonusRecalculation.ts`;
  - los helpers puros que alimentan las pantallas Faltas, Retardos y las dos pestañas de Bonos, con los días de vacaciones cargados desde `incidentSources.ts`.

  Los avisos "Recalcula" saltan solos en estatus 2 cuando se captura, reprograma o cancela un bloque que toca días de un periodo ya calculado, porque cambia el conjunto de faltas, retardos o resultados.
- **Pantalla Faltas:**
  - Los días de vacaciones que **habrían sido falta** (tienen horario, no tienen checada, anteriores a hoy) aparecen como filas de solo lectura con estado **"Vacaciones"**, sin acciones ni badge "Descontada en".
  - Hay un filtro nuevo `estado=vacaciones` y una tarjeta de resumen "Días de vacaciones: N", que cubre el periodo completo y no cambia con los filtros.
  - Si ese día además tiene una justificación previa (`'J'` o `'N'`), se muestra como "Vacaciones": las vacaciones mandan.
- **Pantalla Retardos:** los días de vacaciones simplemente no aparecen. No hay fila ni tarjeta.
- **Escrituras.** `justifyAbsence`, `markAbsenceNotApplicable`, `justifyLateness` y `markLatenessNotApplicable` rechazan un día de vacaciones con `{ ok: false, message }`. `clearAbsenceJustification` y `clearLatenessJustification` siguen sin validar el día, para poder limpiar justificaciones viejas.
- **Datos existentes.** Las justificaciones "No aplica" que ya se marcaron a mano en días de vacaciones se quedan como están, sin migración.
- **Documentación.** Se actualizan las secciones Faltas, Retardos, Bono de puntualidad y Bono de asistencia de `docs/nomina.md`: se quitan los avisos "marcar vacaciones como No aplica". También se actualiza la sección Vacaciones de `docs/rh-empleados.md` (el "known gap").

**No incluye (otras specs):**

- Cambio retroactivo en periodos Aprobados o Pagados (3/4). Si se capturan vacaciones sobre días ya descontados en esos periodos, no se revierte nada, igual que con las justificaciones. La captura de vacaciones tampoco avisa ni bloquea en ese caso.
- Bono por extensión de jornada (spec 68): no se toca. Un día de vacaciones no tiene checada y no cuenta como día trabajado.
- Horas extra en días de vacaciones con checada.
- Prima vacacional, pago de los días de vacaciones en nómina y su percepción.
- Mostrar las vacaciones en la pestaña Asistencia del expediente, en Procesar o en el Detalle de nómina.
- Catálogo de días festivos.
- Historial del horario semanal.
- Mostrar en Bonos cuántos días se excluyeron por vacaciones.

## Modelo de datos

**Base de datos:** sin cambios. Solo se lee `RH.vacation_entitlements` (spec 76). La búsqueda por empleado ya la cubre `UQ_vacation_entitlements_empleado_anio (id_empleado, anio_servicio)`.

### Fragmento SQL compartido: `lib/payroll/vacationExclusionSql.ts` (`server-only`)

Es una sola condición que se pega en el `WHERE` de los seis lugares. Supone los alias que ya usan todos: `e` para `RH.empleados` y `d` para `period_days`.

```ts
/** Spec 77: un día dentro de un bloque de vacaciones capturado no es falta ni retardo. */
export const NOT_ON_VACATION_CONDITION = `
          NOT EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[vacation_entitlements] ve
                       WHERE ve.[id_empleado] = e.[id_empleado]
                         AND ve.[fecha_inicio] IS NOT NULL
                         AND d.[fecha] BETWEEN ve.[fecha_inicio] AND ve.[fecha_fin])`;
```

- `fecha_inicio IS NOT NULL` basta para saber que hay bloque: el `CHECK` "todo o nada" de la spec 76 garantiza que entonces `fecha_fin` también está lleno.
- No se filtra por estatus ni por `fecha_pago`: el bloque capturado es lo único que cuenta.

### Fuente compartida: `lib/payroll/incidentSources.ts`

```ts
export interface IVacationBlockRow {
  id_empleado:  number;
  fecha_inicio: string;   // "YYYY-MM-DD"
  fecha_fin:    string;   // "YYYY-MM-DD"
}

/** Bloques capturados de los empleados con control que se traslapan con el periodo. */
export async function loadVacationBlocks(
  idSucursal: number,
  period: IIncidentPeriodRange,
): Promise<IVacationBlockRow[]>;
// WHERE REVIEWED_EMPLOYEE_CONDITIONS
//   AND ve.fecha_inicio IS NOT NULL
//   AND ve.fecha_inicio <= @fecha_fin AND ve.fecha_fin >= @fecha_inicio
// Fechas con CONVERT(varchar(10), …, 120).
```

### Helper puro: `lib/payroll/vacationExclusion.ts`

Se importa desde el servidor; usa solo strings.

```ts
/** id_empleado -> conjunto de fechas "YYYY-MM-DD" de vacaciones, recortado al rango del periodo. */
export function buildVacationDatesByEmployee(
  blocks: IVacationBlockRow[],
  rangeStart: string,
  rangeEnd: string,
): Map<number, Set<string>>;
```

Los helpers de detección reciben las fechas a excluir como parámetro nuevo, con valor por defecto vacío para no romper a quien no lo pase:

```ts
detectEmployeeAbsences(schedules, checadaDates, rangeStart, rangeEndExclusive, vacationDates = new Set<string>())
detectEmployeeLateness(schedules, firstEntryByDate, rangeStart, rangeEnd, settings, vacationDates = new Set<string>())
```

- `detectEmployeeLateness` descarta los días de vacaciones sin más.
- `detectEmployeeAbsences` también los descarta.
- Para las filas "Vacaciones" de Faltas, la acción llama al helper **sin** exclusión y separa las fechas que están en el conjunto. Así se obtienen exactamente "los días que habrían sido falta" sin duplicar la regla.

### Tipos: `interfaces/payroll_absence.ts`

```ts
export type AbsenceStatus = "unjustified" | "justified" | "not_applicable" | "vacation";

// IAbsencePage.summary gana:
summary: { unjustifiedDays: number; justifiedDays: number; notApplicableDays: number; vacationDays: number };
```

- En una fila `"vacation"`, `url`, `mime_type`, `comentario`, `decided_by_name` y `decided_at` van en `null` aunque el día tenga una justificación vieja, y `discountedInPeriodCodes` va en `[]`.
- `lib/payroll/absenceUrls.ts`: `ABSENCE_STATUS_URL_VALUES.vacation = "vacaciones"`.

Retardos y Bonos no cambian de tipos.

## Plan de implementación

Cada paso deja el sistema compilando (`npm run build`) y funcional.

1. **Fragmento SQL y fuente de datos.**
   - Crear `lib/payroll/vacationExclusionSql.ts` con `NOT_ON_VACATION_CONDITION`.
   - Agregar `IVacationBlockRow` y `loadVacationBlocks` a `lib/payroll/incidentSources.ts`.
   - Crear `lib/payroll/vacationExclusion.ts` con `buildVacationDatesByEmployee`.

   Todavía nadie los usa.

2. **Cálculo de nómina (fuente de verdad).** En `calculatePayrollPeriod` (`nomina/procesar/actions.ts`), agregar `AND ${NOT_ON_VACATION_CONDITION}` al `WHERE` de `#absences` y de `#lateness`.
   - Con eso cambian solos el descuento por faltas y retardos, los candados (`period_employee_absences` y `period_employee_lateness`) y los dos bonos, porque leen esas tablas temporales.
   - Prueba manual: en una transacción que se revierte, recalcular un periodo **sin** vacaciones y comparar su snapshot antes y después (debe quedar idéntico). Luego, con un bloque capturado en el periodo, comprobar que `dias_falta` baja y que el bono se conserva.

3. **Avisos "Recalcula".** Agregar la misma condición al `#absences` de `absenceRecalculation.ts`, `punctualityBonusRecalculation.ts` y `attendanceBonusRecalculation.ts`, y al `#lateness` de `latenessRecalculation.ts` y `punctualityBonusRecalculation.ts`.
   - Prueba manual: con un periodo en estatus 2 ya calculado, capturar un bloque sobre una falta descontada. Deben aparecer los avisos de Faltas, Asistencia y, si aplica, Puntualidad. Al recalcular, desaparecen.

4. **Helpers puros.**
   - `detectEmployeeAbsences` y `detectEmployeeLateness` ganan el parámetro opcional `vacationDates`, que por defecto es un conjunto vacío.
   - Sin el parámetro, el comportamiento es idéntico al actual.

5. **Pantallas Retardos y Bonos.**
   - `getLatenessPage` y las lecturas de puntualidad y asistencia en `bonos/actions.ts` cargan `loadVacationBlocks`. Arman el mapa con `buildVacationDatesByEmployee` y pasan las fechas de cada empleado a los helpers.
   - Los conteos de pantalla quedan alineados con el SQL.

6. **Pantalla Faltas.**
   - `AbsenceStatus` gana `"vacation"`, `summary` gana `vacationDays` y `ABSENCE_STATUS_URL_VALUES` gana `vacaciones`.
   - `getAbsencePage` detecta sin exclusión y clasifica como `"vacation"` las fechas que están en el conjunto, antes de mirar la justificación. Esas filas llevan las columnas de justificación en `null` y `discountedInPeriodCodes: []`.
   - Cambios de UI:
     - `AbsenceSummaryCards` agrega la tarjeta "Días de vacaciones";
     - `AbsenceToolbar` agrega la opción "Vacaciones" al filtro de estado;
     - `AbsenceDaysTable` muestra el badge "Vacaciones" y ninguna acción para esas filas.

     Los tres siguen siendo Server Components, salvo `AbsenceToolbar`, que ya es cliente.
   - Se diseña con la skill `frontend-design`, reutilizando los estilos de badge existentes.

7. **Escrituras.**
   - Agregar en `lib/payroll/justificationWrites.ts` `validateDayIsNotOnVacation(transaction, id_empleado, fecha)`. Devuelve `JustificationWriteCheck` con el mensaje "Ese día está dentro de las vacaciones del empleado; no requiere justificación."
   - Llamarla en `justifyAbsence`, `markAbsenceNotApplicable`, `justifyLateness` y `markLatenessNotApplicable`, dentro de la transacción y después de `validateJustificationTarget`.
   - Las dos acciones `clear*` no la llaman.

8. **Documentación.**
   - En `docs/nomina.md`, agregar una sección "Exclusión de vacaciones (spec 77)" con la regla, los seis lugares sincronizados y lo de "las vacaciones mandan" sobre la checada.
   - En las secciones Faltas, Retardos, Bono de puntualidad y Bono de asistencia, cambiar los textos "A holiday or vacation… mark it No aplica" para que solo hablen de festivos.
   - En `docs/rh-empleados.md`, sección Vacaciones: anotar que los días del bloque ya se excluyen de faltas, retardos y bonos.
   - En la spec 76 no se cambia nada (ya está implementada).

## Criterios de aceptación

**Cálculo**

- [ ] Un podólogo con horario Lun–Sáb, sin checadas y con un bloque de vacaciones del lunes al sábado dentro de un periodo semanal termina con `dias_falta = 0`. Su `importe_salario` es igual al de un periodo sin faltas, y `period_employee_absences` no tiene filas suyas para esos días.
- [ ] En el mismo caso, en el renglón `'F'`, `dias_falta = 0`.
- [ ] Un día de vacaciones con una checada `entrada` 40 minutos tarde no genera fila en `period_employee_lateness` y no suma a `dias_retardo`.
- [ ] Un podólogo de vacaciones el periodo completo queda en `bono_asistencia_resultado = 'C'` y `bono_puntualidad_resultado = 'C'`, con el monto configurado, cuando se cumplen las demás condiciones (configuración activa, `fecha_ingreso <= fecha_inicio`, con horario).
- [ ] Un podólogo con 3 días de vacaciones y 1 falta injustificada fuera del bloque, en el mismo periodo, queda con `dias_falta = 1` y pierde el bono de asistencia (`bono_asistencia_faltas = 1`).
- [ ] Los días de vacaciones pagados en efectivo (año `pagada` sin bloque) **no** se excluyen: un día sin checada sigue siendo falta.
- [ ] Después de cancelar un bloque, sus días vuelven a detectarse como faltas al recalcular. Después de reprogramarlo, solo se excluyen las fechas nuevas.
- [ ] Recalcular un periodo ya calculado en el que ningún empleado tiene vacaciones produce un snapshot idéntico al anterior (comparado dentro de una transacción revertida).

**Avisos "Recalcula"**

- [ ] En un periodo en estatus 2, capturar un bloque que cubre una falta ya descontada hace aparecer el aviso en Faltas, en Procesar y en la pestaña Asistencia de Bonos. Al recalcular, desaparece.
- [ ] Capturar un bloque que cubre un retardo ya descontado hace aparecer el aviso en Retardos y en Procesar.
- [ ] Capturar un bloque que no toca ningún día del periodo no hace aparecer ningún aviso.

**Pantallas**

- [ ] En Faltas, un día de vacaciones con horario y sin checada aparece con el badge "Vacaciones", sin botones de justificar, "No aplica" ni limpiar, y sin "Descontada en".
- [ ] Un día de vacaciones con una justificación "No aplica" previa se muestra como "Vacaciones", no como "No aplica".
- [ ] `?estado=vacaciones` muestra solo esas filas. La tarjeta "Días de vacaciones" cuenta todo el periodo y no cambia con los filtros ni con la búsqueda.
- [ ] Las tarjetas "Injustificadas", "Justificadas" y "No aplica" ya no cuentan días de vacaciones.
- [ ] En Retardos, un día de vacaciones con entrada tarde no aparece en la lista ni en las tarjetas.
- [ ] En Bonos, los conteos de retardos, faltas e incidencias y el resultado de cada empleado coinciden con lo que guarda el cálculo para el mismo periodo.
- [ ] La tarjeta y el badge nuevos se ven correctamente en modo claro y oscuro, y a 375 px de ancho.

**Escrituras**

- [ ] `justifyAbsence`, `markAbsenceNotApplicable`, `justifyLateness` y `markLatenessNotApplicable` sobre un día de vacaciones devuelven `{ ok: false }` con el mensaje de vacaciones y no escriben nada.
- [ ] `clearAbsenceJustification` sobre un día de vacaciones con una justificación vieja la borra con éxito.

**General**

- [ ] `NOT_ON_VACATION_CONDITION` es la única definición SQL de la regla: los seis lugares la importan y ninguno la reescribe.
- [ ] Ninguna fecha viaja como `Date`: `loadVacationBlocks` usa `CONVERT(varchar(10), …, 120)` y los helpers comparan strings.
- [ ] `npm run build` y `npm run lint` pasan sin errores nuevos.
- [ ] `docs/nomina.md` tiene la sección "Exclusión de vacaciones (spec 77)", y ya no recomienda marcar vacaciones como "No aplica".

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| Un día de vacaciones = cualquier fecha entre `fecha_inicio` y `fecha_fin` de un bloque capturado, con cualquier estatus | Solo bloques `en_curso` o `tomada` | El estatus depende de "hoy". Un periodo pasado recalculado debe dar lo mismo sin importar cuándo se recalcule. |
| Los días pagados en efectivo no se excluyen | Excluirlos también | Esos días el empleado sí trabajó; solo cobra el descanso que no tomó. |
| **Las vacaciones mandan** sobre la checada: un día de vacaciones no es falta ni retardo aunque haya entrada tarde | Que la checada mande y el retardo cuente | Decisión del usuario. El empleado no estaba obligado a presentarse, y un bloque mal capturado se corrige reprogramando o cancelando. |
| Días de vacaciones neutros en los bonos: quien estuvo de vacaciones todo el periodo conserva ambos | "No evaluado" con motivo `on_vacation` / prorrateo | Decisión del usuario. Es literal a "excluir de los bonos" y no agrega motivos ni reglas nuevas. |
| Excluir en `#absences` y `#lateness`, no en cada bono | Agregar la exclusión dentro de los `APPLY` de los bonos | Los bonos ya leen esas tablas temporales. Una sola regla alimenta el descuento, el candado y los dos bonos. |
| Una sola condición SQL compartida (`NOT_ON_VACATION_CONDITION`) | Copiar el `NOT EXISTS` en los seis lugares | La regla ya está duplicada seis veces; una constante evita que diverjan. |
| Leer `RH.vacation_entitlements` directamente, sin tabla nueva | Materializar los días de vacaciones en una tabla `payroll` | El bloque es continuo y está indexado por empleado. Un `BETWEEN` basta, y no hay que mantener otra copia sincronizada. |
| En Faltas, filas de solo lectura "Vacaciones" con filtro y tarjeta | Ocultarlas sin rastro / solo una tarjeta con el conteo | Decisión del usuario. RH ve que esos días están cubiertos y deja de marcarlos "No aplica" a mano. |
| En Retardos, simplemente no aparecen | Fila "Vacaciones" también en Retardos | Un día de vacaciones con entrada es raro. Duplicar la UI no aporta. |
| Las filas "Vacaciones" se obtienen detectando sin exclusión y separando las fechas | Una segunda función de detección | Reusa la regla de faltas existente: muestra exactamente "lo que habría sido falta". |
| Las acciones de justificar y "No aplica" rechazan días de vacaciones; las de limpiar no | Permitir justificar días de vacaciones | Una justificación sobre un día ya excluido no tendría efecto y confundiría. Limpiar debe seguir funcionando para las filas viejas. |
| Sin migración de las "No aplica" que ya existen en días de vacaciones | Borrarlas con un script | No estorban (las vacaciones se evalúan antes) y conservan el rastro de quién las marcó. |
| Sin cambio retroactivo en periodos 3/4, y sin aviso al capturar vacaciones sobre días ya descontados | Bloquear o avisar en el modal de vacaciones | Es el mismo criterio que las justificaciones (specs 62–65). En estatus 2, el aviso "Recalcula" ya lo detecta. |
| No tocar el bono por extensión de jornada (spec 68) | Contar los días de vacaciones como días trabajados | No hubo jornada que extender, y el bono ya cuenta solo días con checada. |
| Sin cambios de BD | Índice nuevo sobre `(id_empleado, fecha_inicio, fecha_fin)` | `UQ_vacation_entitlements_empleado_anio` ya empieza por `id_empleado`, y cada empleado tiene pocas filas. |

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| La regla queda desincronizada entre el SQL y los helpers puros, y la pantalla no coincide con el cálculo | `NOT_ON_VACATION_CONDITION` es una sola constante para el SQL. El criterio de aceptación de Bonos compara la pantalla con el snapshot. Si divergen, **manda el SQL**, como en las specs 62–65. |
| Cambiar el `WHERE` de `#absences` y `#lateness` altera periodos ya calculados sin vacaciones | Prueba de snapshot idéntico dentro de una transacción revertida, la misma técnica que en las specs 63 y 64. |
| Se capturan vacaciones con fechas pasadas sobre días ya descontados en periodos Aprobados o Pagados | No hay reversión: el descuento y el bono perdido se quedan. Se documenta en `docs/nomina.md`, y quien construya los estatus 3/4 debe considerarlo. |
| Un bloque mal capturado oculta faltas o retardos reales | Las vacaciones mandan por decisión explícita. La spec 76 permite reprogramar o cancelar solo antes de que empiece el bloque. Un bloque ya iniciado no tiene corrección desde la UI. |
| El empleado cambia de horario después de capturar el bloque, y `fecha_fin` (snapshot) ya no coincide con los días laborables reales | La exclusión usa el rango de fechas, no los días contados. Un día laborable nuevo dentro del rango también se excluye; uno justo después de `fecha_fin` no. Es el mismo riesgo conocido de la spec 76. |
| El costo de la consulta crece con el `NOT EXISTS` extra por día y empleado | `RH.vacation_entitlements` tiene pocas filas por empleado y está indexada por `id_empleado`. Si hace falta, se agrega un índice sin cambiar la lógica. |

## Lo que **no** está en esta spec

- Cambios retroactivos en periodos Aprobados o Pagados (3/4), o avisos al capturar vacaciones sobre días ya descontados.
- El bono por extensión de jornada (spec 68).
- Horas extra en días de vacaciones con checada.
- Prima vacacional y pago de vacaciones en nómina.
- Vacaciones visibles en la pestaña Asistencia del expediente, en Procesar o en el Detalle.
- Catálogo de días festivos.
- Historial del horario semanal.

Cada una, si se hace, va en su propia spec.
