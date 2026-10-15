# 79 — Empleados: días económicos

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [25 — Empleados: alta, listado y detalle](25-empleados-alta-listado-detalle.md): `RH.empleados.activo`, el expediente con pestañas (`empleados/[id]/layout.tsx`, `EmployeeTabs`).
  - [59 — Empleados: horario semanal estructurado](59-empleado-horario-semanal.md): `RH.empleado_horarios`. Un día económico solo puede caer en un día laborable del horario actual; sin horario no se puede capturar.
  - [76 — Asignación de vacaciones](76-empleado-asignacion-vacaciones.md): el bloque `fecha_inicio..fecha_fin` de `RH.vacation_entitlements`, para rechazar fechas dentro de vacaciones. También se reusan `assertVacationAccess`, `isoDateString` y `VacationReasonModal` / `JustificationModalFrame`.
- **Modifica base de datos:** Sí.
  - Tabla nueva `RH.economic_days`: un día económico por fila, con su captura y su cancelación (la fila misma es la bitácora).
- **Fecha:** 2026-10-15
- **Objetivo:** Permitir que los roles 1 y 4 registren y cancelen, con motivo obligatorio y bitácora, hasta 3 días económicos por empleado activo en el año calendario en curso, en días laborables de su horario y fuera de sus vacaciones, y consultar el saldo y el historial en una pestaña nueva "Días económicos" del expediente, sin efecto todavía en nómina.
- **Reglas de origen:** `references/nomina/reglas_modulo_nomina.md` §2.7 (3 días económicos al año) y §4.2 (la aprobación de días económicos es exclusiva de Administrador/RH).

## Alcance

**Incluye:**

- **Base de datos** (DDL en `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`, después de lo de la spec 76):
  - tabla `RH.economic_days`, una fila por día económico registrado;
  - cancelar no borra: llena las columnas de cancelación, y la fila queda como bitácora.
- **Límite anual.** La constante `ECONOMIC_DAYS_PER_YEAR = 3` en `lib/economicDays/economicDayRules.ts`. No hay pantalla de configuración ni ajuste por empleado.
  - **Usados** del año = filas no canceladas cuya `fecha` cae en ese año calendario.
  - **Disponibles** = 3 − usados.
  - El saldo se reinicia cada 1 de enero sin proceso ni cron: se deriva del año de `fecha`.
- **Registrar día económico** (`registerEconomicDay`). RH captura `fecha` y `motivo` (obligatorio, máx. 500). Reglas validadas en el servidor:
  - el empleado está activo (`activo = 1`);
  - `fecha` es del año calendario en curso, hora de Ciudad de México (`addZeroToday(new Date())`). Puede ser pasada o futura;
  - `fecha` es un día laborable según `RH.empleado_horarios`. Sin horario no se puede capturar y se muestra "Sin horario definido";
  - `fecha` no cae dentro de un bloque de vacaciones capturado (spec 76);
  - no hay otro día económico activo en esa misma fecha;
  - el empleado tiene al menos 1 día disponible en el año.

  El conteo y el `INSERT` van en una sola transacción con bloqueo, para que dos capturas simultáneas no pasen de 3.
- **Cancelar día económico** (`cancelEconomicDay`). Funciona con cualquier día activo del año en curso, pasado o futuro, y pide motivo obligatorio. El día vuelve al saldo. Para cambiar la fecha se cancela y se registra otra.
- **Años anteriores:** solo lectura. Un día de diciembre que no se capturó a tiempo ya no se puede regularizar en enero.
- **Empleado inactivo:** la pestaña muestra el historial y oculta las acciones. Las actions rechazan la escritura con `{ ok: false }`.
- **Validación inversa en vacaciones (spec 76).** `scheduleVacationBlock` y `rescheduleVacationBlock` rechazan un bloque cuyo rango `fecha_inicio..fecha_fin` contenga un día económico activo. Mensaje: "El bloque incluye un día económico registrado el {fecha}. Cancélalo primero."
- **UI: pestaña "Días económicos"** (`empleados/[id]/dias-economicos/`), después de "Vacaciones" en `EmployeeTabs`. Es un Server Component; los modales son los únicos Client Components.
  - Tarjeta del año en curso: "Usados N de 3 · Disponibles M", y el botón "Registrar día económico", que se deshabilita con 0 disponibles, sin horario o con el empleado inactivo.
  - Lista de días del año en curso: fecha con día de la semana, motivo, quién y cuándo lo registró, y estado "Registrado" o "Cancelado". Las canceladas muestran motivo, quién y cuándo. "Cancelar" aparece en cada día activo.
  - Historial de años anteriores agrupado por año (`<details>`, sin JS), de solo lectura, con sus usados de 3.
  - Aviso "Sin horario definido" con enlace a la pestaña Horario, igual que Vacaciones.
- **Acceso:** roles 1 y 4, ya cubiertos por `proxy.ts` en `/dashboard/empleados`. Las escrituras repiten el gate con `assertVacationAccess` y validan con `zod`.
- **Documentación:** sección "Días económicos (spec 79)" en `docs/rh-empleados.md` y la pestaña nueva en la lista de pestañas.

**No incluye (otras specs):**

- Que el día económico deje de detectarse como falta o retardo y no quite los bonos de asistencia y puntualidad, es decir, "computar el día como trabajado" (§2.7). Va en la siguiente spec, como 76 → 77. Mientras tanto se marca "No aplica" a mano en Faltas.
- Desactivar la validación en el checador biométrico.
- Flujo de solicitud y aprobación, autoservicio del empleado y notificaciones.
- Medios días.
- Días proporcionales al ingreso o antigüedad mínima.
- Pago o acumulación de los días no usados.
- Límite configurable por empresa o por empleado.
- Edición de años anteriores.
- Archivo adjunto con la autorización.
- Saldo en `EmployeeHeader`, en el listado o en `EmployeeSummaryCards`.
- Catálogo de días festivos.

## Modelo de datos

### `RH.economic_days`

```sql
-- Spec 79: un día económico por fila. Cancelar no borra: llena las columnas de cancelación (la fila es la bitácora).
CREATE TABLE [RH].[economic_days](
    [id_economic_day]    [int] IDENTITY(1,1) NOT NULL,
    [id_empleado]        [int]           NOT NULL,
    [fecha]              [date]          NOT NULL,
    [motivo]             [nvarchar](500) NOT NULL,
    [created_by]         [int]           NOT NULL,
    [created_at]         [datetime2](0)  NOT NULL,   -- buildDate(new Date())
    -- Cancelación (todo NULL o todo lleno)
    [cancelado_by]       [int]           NULL,
    [cancelado_at]       [datetime2](0)  NULL,
    [motivo_cancelacion] [nvarchar](500) NULL,
 CONSTRAINT [PK_economic_days] PRIMARY KEY CLUSTERED ([id_economic_day] ASC),
 CONSTRAINT [FK_economic_days_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado]),
 CONSTRAINT [CK_economic_days_motivo] CHECK (LEN(LTRIM(RTRIM([motivo]))) > 0),
 CONSTRAINT [CK_economic_days_cancelacion] CHECK (
     ([cancelado_by] IS NULL AND [cancelado_at] IS NULL AND [motivo_cancelacion] IS NULL)
  OR ([cancelado_by] IS NOT NULL AND [cancelado_at] IS NOT NULL AND [motivo_cancelacion] IS NOT NULL
          AND LEN(LTRIM(RTRIM([motivo_cancelacion]))) > 0))
) ON [PRIMARY]
GO

-- Un solo día económico activo por empleado y fecha; también sirve para contar los usados del año.
CREATE UNIQUE NONCLUSTERED INDEX [UX_economic_days_empleado_fecha_activo]
    ON [RH].[economic_days] ([id_empleado], [fecha])
    WHERE [cancelado_at] IS NULL
GO
```

- **No hay columna de año.** El año sale de `fecha`, y el saldo cuenta con `fecha >= 'YYYY-01-01' AND fecha < 'YYYY+1-01-01'`, que usa el índice.
- **El límite de 3 no está en la BD**, porque un `CHECK` no puede contar filas. Se valida en `registerEconomicDay` con un solo `INSERT … SELECT … WHERE (SELECT COUNT(*) … WITH (UPDLOCK, HOLDLOCK)) < 3 … OUTPUT INSERTED`. Si afecta 0 filas, la action devuelve `{ ok: false }`, igual que el patrón de la spec 76.
- **Índice único filtrado.** Permite volver a registrar una fecha que se canceló antes; dos filas activas en la misma fecha chocan.
- **No hay FK** de `created_by` ni de `cancelado_by` a `dbo.users`, igual que `solicitado_by` en `vacation_entitlements`.
- **Cancelar** es un `UPDATE … SET cancelado_* … WHERE cancelado_at IS NULL AND fecha` del año en curso `… OUTPUT INSERTED`.

### TypeScript: `interfaces/economic_day.ts`

```ts
/** Fila de RH.economic_days; fechas como string, nunca Date. */
export interface IEconomicDay {
  id_economic_day:    number;
  id_empleado:        number;
  fecha:              string;          // "YYYY-MM-DD"
  motivo:             string;
  created_by_name:    string | null;   // LEFT JOIN dbo.users
  created_at:         string;          // "YYYY-MM-DD HH:mm:ss"
  cancelado_by_name:  string | null;
  cancelado_at:       string | null;
  motivo_cancelacion: string | null;
}

/** Días de un año calendario, con su saldo. */
export interface IEconomicDaysYear {
  year:          number;
  usedDays:      number;   // no cancelados
  availableDays: number;   // ECONOMIC_DAYS_PER_YEAR - usedDays (mínimo 0)
  days:          IEconomicDay[];   // incluye cancelados, ordenados por fecha
}
```

### Helpers puros: `lib/economicDays/economicDayRules.ts` (se importan desde cliente y servidor)

- `ECONOMIC_DAYS_PER_YEAR = 3`.
- `getCalendarYearRange(year)` devuelve `{ start: "YYYY-01-01", endExclusive: "YYYY+1-01-01" }`.
- `groupEconomicDaysByYear(days, currentYear)` devuelve `IEconomicDaysYear[]` de más reciente a más antiguo. Siempre incluye el año en curso, aunque no tenga días.
- `isWorkingDate(fecha, workingIsoWeekdays)` reusa `getIsoWeekday` de `lib/vacations/vacationDates.ts`.

### Fragmento SQL compartido: `lib/economicDays/economicDaySql.ts` (`server-only`)

- `ACTIVE_ECONOMIC_DAY_IN_RANGE_SQL` encuentra el primer día económico activo de un empleado en un rango de fechas. Lo usan `scheduleVacationBlock` y `rescheduleVacationBlock`, y la siguiente spec, la de exclusión en nómina.
- La comprobación de vacaciones en `registerEconomicDay` es un `EXISTS` sobre `RH.vacation_entitlements` con `fecha BETWEEN fecha_inicio AND fecha_fin`. Es la misma regla que `NOT_ON_VACATION_CONDITION` de la spec 77, y se reusa ese fragmento si encaja.

## Plan de implementación

Cada paso deja el sistema compilando (`npm run build`) y funcional.

1. **Base de datos.** En `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`, después de lo de la spec 76, se agrega el DDL de `RH.economic_days` y de `UX_economic_days_empleado_fecha_activo`. Se ejecuta contra la BD y se verifica que:
   - un `INSERT` con motivo vacío, o con la cancelación a medio llenar, falla por `CHECK`;
   - dos filas activas en la misma fecha chocan con el índice, y si una está cancelada, no.

2. **Tipos y helpers puros.**
   - `interfaces/economic_day.ts`.
   - `lib/economicDays/economicDayRules.ts`: `ECONOMIC_DAYS_PER_YEAR`, `getCalendarYearRange`, `groupEconomicDaysByYear`, `isWorkingDate`.

   Todavía no se usan desde la UI.

3. **Lectura.** `app/dashboard/empleados/[id]/dias-economicos/actions.ts` con `getEmployeeEconomicDays(id_empleado)`:
   - todas las filas del empleado;
   - `CONVERT(varchar(10), fecha, 120)` y `CONVERT(varchar(19), …, 120)` para `created_at` y `cancelado_at`;
   - dos `LEFT JOIN dbo.users` para los nombres.

   Los días laborables se leen con `getEmployeeWorkingWeekdays` de `vacaciones/actions.ts`, sin duplicarla.

4. **Pestaña de solo lectura.**
   - Se agrega `{ href: …/dias-economicos, label: "Días económicos" }` a `TABS` en `EmployeeTabs.tsx`, después de Vacaciones.
   - Se extrae el aviso "Sin horario definido" del `vacaciones/page.tsx` actual a `empleados/[id]/componentes/EmployeeWithoutScheduleNotice.tsx` (Server Component, con la acción bloqueada como prop). Vacaciones pasa a usarlo sin cambio visual.
   - `dias-economicos/page.tsx` (Server Component): valida `id`, `getEmployeeById`, lee los días y los días laborables, y agrupa con `groupEconomicDaysByYear`.
   - Componentes en `dias-economicos/componentes/`:
     - `EconomicDaysCurrentYearCard.tsx`: "Usados N de 3 · Disponibles M" y la lista de días del año en curso con su estado;
     - `EconomicDaysHistory.tsx`: años anteriores en `<details>`, de solo lectura.

5. **Registrar.**
   - Se exporta `isoDateString` de `vacaciones/schemas.ts` para reusarlo.
   - `dias-economicos/schemas.ts` (`server-only`, `zod`): `registerEconomicDaySchema` (`id_empleado`, `fecha`, `motivo` de 1 a 500 con trim).
   - `registerEconomicDay`:
     - `assertVacationAccess`;
     - empleado activo;
     - `fecha` del año en curso;
     - `isWorkingDate` con el horario;
     - sin vacaciones en esa fecha.
     - Después, en `db.transaction`, el `INSERT … SELECT … WHERE NOT EXISTS (activo misma fecha) AND (COUNT con UPDLOCK, HOLDLOCK) < 3 OUTPUT INSERTED`.
     - 0 filas devuelve `{ ok: false, message: "Ya no hay días disponibles o la fecha ya está registrada" }`.
   - `RegisterEconomicDayModal.tsx` (Client Component, sobre `JustificationModalFrame`):
     - un `<input type="date">` acotado al año en curso;
     - aviso en vivo si la fecha no es laborable (`isWorkingDate`);
     - motivo obligatorio.
   - El botón se deshabilita con 0 disponibles, sin horario o con el empleado inactivo.

6. **Cancelar.**
   - `cancelEconomicDaySchema` (`id_economic_day`, `id_empleado`, `motivo`).
   - `cancelEconomicDay`:
     - `assertVacationAccess` y empleado activo;
     - `UPDATE … SET cancelado_by, cancelado_at = buildDate(new Date()), motivo_cancelacion WHERE id … AND id_empleado … AND cancelado_at IS NULL AND fecha` del año en curso `OUTPUT INSERTED`.
   - En la UI, "Cancelar" en cada día activo del año en curso. Usa `VacationReasonModal` si sus props son genéricas (título, texto del botón, action). Si no, `CancelEconomicDayModal.tsx` sobre `JustificationModalFrame`.
   - Los cancelados muestran su motivo, quién y cuándo.

7. **Validación inversa en vacaciones.**
   - `lib/economicDays/economicDaySql.ts` con `ACTIVE_ECONOMIC_DAY_IN_RANGE_SQL`.
   - `scheduleVacationBlock` y `rescheduleVacationBlock` lo consultan con `fecha_inicio` y la `fecha_fin` que calcula el servidor, antes del `UPDATE`.
   - Si encuentra un día, devuelve `{ ok: false, message: "El bloque incluye un día económico registrado el {fecha}. Cancélalo primero." }`.
   - El mensaje de `assertVacationAccess` se generaliza a "No tienes permisos para administrar RH".

8. **Documentación.**
   - Sección "Días económicos (spec 79)" en `docs/rh-empleados.md`: reglas, tabla, actions y la limitación conocida de que todavía cuentan como falta, que se marca "No aplica" a mano hasta la siguiente spec.
   - La pestaña nueva en la lista de pestañas.
   - En `CLAUDE.md` no hace falta cambiar nada: `dias-economicos/` vive dentro de `empleados/[id]/`, como `vacaciones/`.

## Criterios de aceptación

**Base de datos**

- [x] `RH.economic_days` existe y su DDL está en `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`.
- [x] Un `INSERT` con `motivo` vacío o de solo espacios falla por `CK_economic_days_motivo`.
- [x] Un `UPDATE` que llena `cancelado_at` sin `motivo_cancelacion` falla por `CK_economic_days_cancelacion`.
- [x] Dos filas activas del mismo empleado en la misma fecha chocan con `UX_economic_days_empleado_fecha_activo`. Si la primera está cancelada, la segunda se inserta.

**Pestaña**

- [x] El expediente muestra la pestaña "Días económicos" después de "Vacaciones".
- [x] Un empleado sin días registrados en 2026 muestra "Usados 0 de 3 · Disponibles 3".
- [x] Un empleado con días en 2025 los muestra en el historial, dentro de un `<details>` "2025", sin botones de acción.
- [ ] Un empleado sin horario muestra el aviso "Sin horario definido" con el enlace a Horario, y el botón "Registrar día económico" está deshabilitado. (aviso y enlace verificados; falta el botón, paso 5)
- [ ] Un empleado inactivo muestra su historial, pero ni "Registrar" ni "Cancelar". (historial verificado; faltan los botones, paso 5)
- [x] La pestaña Vacaciones sigue mostrando su aviso "Sin horario definido" igual que antes, ahora con el componente compartido.

**Registrar**

- [ ] Registrar el miércoles 2026-10-21 con motivo, para un empleado con horario L–V, agrega la fila como "Registrado" y el saldo pasa a "Usados 1 de 3 · Disponibles 2".
- [ ] Registrar una fecha pasada del año en curso, como 2026-03-04, se acepta.
- [ ] Registrar el domingo 2026-10-18, para un empleado con horario L–V, devuelve `{ ok: false }` con un mensaje de día no laborable. El modal además lo avisa antes de guardar.
- [ ] Registrar 2025-12-15 o 2027-01-05 devuelve `{ ok: false }`.
- [ ] Registrar sin motivo devuelve un error de validación y no guarda nada.
- [ ] Registrar una fecha dentro de un bloque de vacaciones capturado devuelve `{ ok: false }` con "Ese día está dentro de las vacaciones del empleado".
- [ ] Registrar dos veces la misma fecha activa devuelve `{ ok: false }` en la segunda.
- [ ] Con 3 días activos en 2026, el botón se deshabilita y llamar a la action directamente devuelve `{ ok: false }`.
- [ ] Dos llamadas simultáneas a `registerEconomicDay` con 2 días ya usados dejan exactamente 3 activos: una devuelve `ok: true` y la otra `ok: false`.
- [ ] Llamar a `registerEconomicDay` para un empleado inactivo, o con un usuario sin rol 1 ni 4, devuelve `{ ok: false }`.

**Cancelar**

- [ ] Cancelar un día activo con motivo lo deja como "Cancelado", con motivo, quién y cuándo, y devuelve el día al saldo.
- [ ] Cancelar sin motivo devuelve un error de validación.
- [ ] Cancelar un día de 2025, llamando a la action directamente, devuelve `{ ok: false }`.
- [ ] Después de cancelar 2026-10-21, se puede volver a registrar esa misma fecha.

**Validación inversa en vacaciones**

- [ ] Capturar un bloque de vacaciones que incluya un día económico activo devuelve `{ ok: false }` con "El bloque incluye un día económico registrado el {fecha}. Cancélalo primero."
- [ ] Reprogramar un bloque hacia un rango con un día económico activo devuelve el mismo error.
- [ ] Un día económico cancelado dentro del rango no bloquea la captura de vacaciones.

**Calidad**

- [ ] `npm run build` termina sin errores.
- [ ] Ninguna fecha de este flujo viaja como `Date`: las lecturas usan `CONVERT(…, 120)` y las escrituras usan `buildDate(new Date())` y strings `"YYYY-MM-DD"`.

## Decisiones

- **Sí:** año calendario (1 ene – 31 dic). El saldo se reinicia solo, derivado del año de `fecha`, sin generar filas por año ni cron.
- **No:** año de servicio por aniversario, como vacaciones. Obligaría a sincronizar derechos (`syncVacationEntitlements`) para un beneficio de 3 días.
- **Sí:** los días no usados se pierden. Son un permiso con goce, no una prestación de ley.
- **No:** pagarlos o acumularlos. Pagarlos exigiría una percepción nueva en nómina.
- **Sí:** 3 días completos para cualquier empleado activo, sin importar su fecha de ingreso.
- **No:** prorratear ni exigir antigüedad mínima. Agrega reglas de redondeo sin que lo pida la regla de origen.
- **Sí:** el límite es la constante `ECONOMIC_DAYS_PER_YEAR = 3`.
- **No:** ajuste por empleado ni parámetro por empresa. No hay caso de uso hoy. Si aparece, merece su propia spec.
- **Sí:** captura directa por RH (roles 1 y 4), igual que vacaciones. §4.2 de las reglas reserva la aprobación de días económicos a Administración/RH.
- **No:** flujo de solicitud del empleado con aprobación.
- **Sí:** solo días completos.
- **No:** medios días. Faltas y retardos se detectan por día, y medio día complicaría la siguiente spec.
- **Sí:** solo días laborables según el horario actual. Sin horario no se captura. Un día de descanso no necesita permiso.
- **Sí:** se aceptan fechas pasadas del año en curso, para regularizar días ya tomados.
- **Sí:** solo el año en curso es editable, y los anteriores son de solo lectura. Acepta el costo: un día de diciembre no capturado a tiempo ya no se regulariza.
- **No:** permitir el año anterior.
- **Sí:** se rechaza una fecha dentro de vacaciones, y al revés, se rechaza un bloque de vacaciones que contenga un día económico activo. Así nunca se gasta un día económico en un día que ya es de vacaciones.
- **Sí:** cancelar cualquier día del año en curso, pasado o futuro, con motivo obligatorio. Corregir la fecha es cancelar y registrar otra.
- **No:** solo días futuros, como vacaciones. Sin efecto en nómina todavía, no hay nada calculado que proteger.
- **No:** un `DELETE` sin rastro.
- **Sí:** una sola tabla con cancelación suave, donde la fila es la bitácora. Solo hay dos eventos, captura y cancelación, y caben en la fila.
- **No:** una tabla `economic_day_log` aparte, como en la spec 76. Allí sí hacía falta porque un año de derecho tiene cinco tipos de acción y reprogramaciones.
- **Sí:** índice único filtrado `WHERE cancelado_at IS NULL`, que permite volver a registrar una fecha cancelada.
- **Sí:** el límite de 3 se valida en un `INSERT … SELECT` condicionado con `UPDLOCK, HOLDLOCK` y `OUTPUT INSERTED`. Un `CHECK` no puede contar filas, y el bloqueo evita que dos capturas simultáneas pasen de 3.
- **No:** un trigger. Sería lógica oculta en la BD; el proyecto valida en las actions.
- **Sí:** motivo obligatorio, sin archivo.
- **No:** adjuntar la autorización. Ningún flujo la exige hoy, y se puede sumar con `/api/upload` si hace falta.
- **Sí:** el saldo solo se ve en la pestaña.
- **No:** badge en el header, columna en el listado ni tarjeta de resumen. Es un dato de consulta ocasional, no una alerta.
- **Sí:** se reusa `assertVacationAccess`, con su mensaje generalizado a RH.
- **No:** un gate duplicado para días económicos.
- **Sí:** se extrae `EmployeeWithoutScheduleNotice` para compartir el aviso entre Vacaciones y Días económicos, en vez de copiarlo.
- **Sí:** separar la exclusión en nómina (faltas, retardos y bonos) en la siguiente spec, como 76 → 77. Esta spec queda acotada a RH. Mientras tanto se marca "No aplica" a mano en Faltas.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| **El día económico sigue detectándose como falta** (y quita bonos) hasta que exista la siguiente spec. | Se marca "No aplica" a mano en Faltas, igual que se hacía con vacaciones antes de la spec 77. Queda anotado como limitación conocida en `docs/rh-empleados.md`. |
| **El horario cambia después de registrar** un día futuro, y la fecha deja de ser laborable. | No se revalida: el día queda registrado y consume saldo. RH puede cancelarlo. Igual que `fecha_fin` en vacaciones, la validación es contra el horario del momento de la captura. |
| **El índice único filtrado** necesita `QUOTED_IDENTIFIER` y `ANSI_NULLS` en `ON` en la sesión que escribe. | El driver `mssql`/tedious los usa en `ON` por defecto. El paso 1 lo comprueba con un `INSERT` real desde la app, no solo desde SSMS. |
| **Un día de diciembre capturado tarde** ya no se puede registrar en enero. | Es una decisión aceptada. Se documenta en `docs/rh-empleados.md` para que RH capture antes del cierre del año. |
| **Bloques de vacaciones anteriores a esta spec** que ya contienen un día económico. | Imposible hoy: la tabla nace vacía. Desde el paso 7 ambos lados se validan entre sí. |
| **Festivos:** se puede gastar un día económico en un festivo, porque no hay catálogo. | Se acepta. RH no lo registra o lo cancela. El catálogo de festivos va en su propia spec. |

## Lo que **no** entra en esta spec

- Excluir el día económico de faltas, retardos y bonos de asistencia y puntualidad: la siguiente spec.
- Desactivar la validación en el checador biométrico.
- Solicitud del empleado, aprobación y notificaciones.
- Medios días, días proporcionales y antigüedad mínima.
- Pago o acumulación de los días no usados.
- Límite configurable por empresa o por empleado.
- Edición de años anteriores.
- Archivo adjunto con la autorización.
- Saldo en `EmployeeHeader`, en el listado o en las tarjetas de resumen.
- Catálogo de días festivos.

Cada uno, si llega, va en su propia spec.
