# 60 — Nómina: horas extra (detección, autorización y configuración)

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [39 — Empleados: historial de asistencias](39-empleado-historial-asistencias.md): `RH.asistencias` (checadas `entrada` / `salida` con `fecha_hora` local) y el criterio de día incompleto de `attendancePairing.ts`.
  - [52 — Nómina: periodos](52-nomina-periodos.md): `payroll.periods` (rango, sucursal, frecuencia y estatus) que delimita qué días se revisan.
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md): las reglas de elegibilidad para la nómina operativa (sucursal, frecuencia, activo, `salario_diario > 0`, `fecha_ingreso`), que esta spec reutiliza para decidir a quién se le detecta extra.
  - [57 — Comisión por tratamientos de onicomicosis](57-nomina-comision-tratamientos-onicomicosis.md): el patrón de configuración por empresa con bitácora (`treatment_commission_settings` + `_log`) que se replica aquí.
  - [59 — Empleados: horario semanal estructurado](59-empleado-horario-semanal.md): `RH.empleado_horarios`, la jornada programada contra la que se compara cada día.
- **Modifica base de datos:** Sí. Tres tablas nuevas en el esquema `payroll`: `overtime_settings`, `overtime_settings_log` y `overtime_authorizations`. No se modifica ninguna tabla existente.
- **Fecha:** 2026-09-25
- **Objetivo:** Detectar, para cada periodo de nómina, las horas extra por empleado y día al comparar sus checadas contra su horario programado, y permitir que el admin las autorice (ajustando las horas), las rechace o deje pendientes en una pantalla nueva "Horas extra", con el límite de horas dobles por periodo y el tope de horas por día configurables por empresa.
- **Siguiente spec:** 61 — Horas extra: pago en nómina (reparto entre dobles y triples, snapshot y pago en `calculatePayrollPeriod`).
- **Reglas de origen:** `references/docs/horas_extras.md`.

## Alcance

**Incluye:**

- **Base de datos** (DDL documentado en `queries.txt`, bloque `NOMINA PAYROLL`):
  - `payroll.overtime_settings`: una fila por empresa con `limite_horas_dobles_periodo` (semilla 9) y `tope_horas_dia` (semilla 16).
  - `payroll.overtime_settings_log`: bitácora de cambios de esa configuración, con el patrón de `treatment_commission_settings_log`.
  - `payroll.overtime_authorizations`: una fila por empleado y fecha (`UNIQUE`) con la decisión del admin (autorizada o rechazada), las horas autorizadas, las horas detectadas al momento de decidir, el comentario opcional y la auditoría.
- **Reglas de detección**, en un helper puro `lib/payroll/overtimeDetection.ts` (sin BD y sin `Date` sobre strings crudos):
  - **Checadas del día:** agrupadas por la fecha de `fecha_hora`. El día es **incompleto** con el mismo criterio de `summarizeAttendanceEvents` (`attendancePairing.ts`), que se reutiliza. Un día incompleto no genera extra detectada, pero se lista como "Checada incompleta".
  - **Día con horario:** extra = `max(0, hora_entrada_1 − primera entrada)` + `max(0, última salida − salida del último bloque)`, donde el último bloque es `hora_salida_2` si existe o `hora_salida_1` si no. El retardo no se descuenta.
  - **Día de descanso** (sin fila para ese `dia_semana`): extra = `última salida − primera entrada`.
  - **Redondeo:** el total del día se redondea hacia abajo a bloques de 30 minutos (2 h 17 min → 2.0 h), sin mínimo.
  - **Sin horario:** un empleado sin ninguna fila en `RH.empleado_horarios` no genera detección.
- **Quién se revisa:** los empleados elegibles para la nómina operativa del periodo, con las mismas reglas de la spec 53: `status = 1`, `activo = 1`, sucursal y frecuencia del periodo, `salario_diario > 0` y `fecha_ingreso <= fecha_fin`. Solo se revisan los días entre `max(fecha_inicio, fecha_ingreso)` y `fecha_fin`.
- **Pantalla nueva `/dashboard/nomina/horas-extra`** (Server Component, estado en la URL: `periodo`, `estado`, `q`, `pagina`):
  - Selector de periodo de la sucursal activa, resuelto igual que en Procesar: el pedido, el vigente o el más reciente.
  - **Texto fijo informativo:** "Las horas autorizadas se pagarán cuando se integre el cálculo de horas extra en la nómina." Se retira con la spec 61.
  - **Tarjeta de configuración** arriba, con el límite de horas dobles por periodo y el tope por día, un botón "Editar" (modal cliente) y la bitácora con los últimos 20 cambios.
  - **Tarjetas resumen:** días pendientes, horas detectadas y horas autorizadas del periodo.
  - **Lista por empleado y día:**
    - Qué días entran: con extra detectada > 0, con checada incompleta o con una decisión ya guardada, aunque hoy su detección sea 0.
    - Columnas: empleado, fecha, horario programado (o "Descanso"), primera entrada y última salida reales, horas detectadas, estado (Pendiente, Autorizada, Rechazada), horas autorizadas y comentario.
    - Filtro por estado y búsqueda por nombre o código. Paginación de 25 filas.
  - **Aviso de "Sin horario definido"**, con la lista de empleados elegibles que no tienen horario y un enlace a su pestaña Horario.
  - **Marca "Detectado cambió: X → Y"** cuando las horas detectadas hoy difieren de las guardadas al decidir. La autorización conserva sus horas.
- **Modal de decisión por día** (Client Component):
  - **Autorizar** con las horas que decida el admin: en pasos de 0.5 h, mayor que 0 y hasta `tope_horas_dia`. Pueden ser más que lo detectado.
  - **Rechazar.** Tanto al autorizar como al rechazar se puede dejar un comentario opcional.
  - **"Volver a pendiente"**, que borra la decisión.
  - Solo se puede decidir con el periodo en estatus 1 o 2. Con cualquier otro estatus, la lista queda en solo lectura.
- **Server actions** en `app/dashboard/nomina/horas-extra/actions.ts`, todas detrás de `assertPayrollAccess()`, con la sucursal tomada de la sesión y validación con zod (`lib/payroll/schemas.ts`):
  - `getOvertimePage(filters)`
  - `getOvertimeSettings`
  - `getOvertimeSettingsLog`
  - `updateOvertimeSettings`
  - `decideOvertimeDay`, que autoriza o rechaza
  - `clearOvertimeDecision`

  Las escrituras validan dentro de la misma transacción el estatus del periodo, la sucursal y que el empleado sea elegible.
- **Navegación:** entrada "Horas extra" en el grupo Nómina de `navConfig.tsx`, con los mismos `excludeRoles`. No hay cambios en `proxy.ts`, porque `/dashboard/nomina` ya está protegido.
- **Documentación:** sección "Horas extra (spec 60)" en `docs/nomina.md`.

**No incluye (queda para la spec 61 u otras):**

- **Pago en nómina** (spec 61):
  - reparto entre dobles y triples, tarifa `salario_diario / 8 × 2|3`;
  - columnas en `payroll.period_employees`, desglose y candado de pago (`payroll.period_employee_overtime`);
  - cambios en Procesar y en Detalle;
  - aviso "Recalcula la nómina" al cambiar una decisión con el periodo en estatus 2.
- **Reglas fiscales:** ISR (exento las primeras 9 h, gravado después) y nómina fiscal (`'F'`).
- **Otros cálculos y conceptos:** descuento por retardos o faltas, tolerancias, prima dominical, días festivos y descanso trabajado como concepto separado.
- **Turnos y horario:** turnos que cruzan la medianoche, historial o vigencia del horario (se usa el horario **actual** del empleado para todo el periodo), extra durante la comida o entre bloques.
- **Captura manual:** "Autorizar todo lo detectado" en masa y agregar días que no aparecen en la lista.
- **Multiplicadores configurables:** 2 y 3 quedan fijos.

## Modelo de datos

**Tres tablas nuevas en `payroll`.** El DDL va en `queries.txt`, bloque `NOMINA PAYROLL`, después de `payroll.period_employee_product_sales`.

```sql
-- Spec 60: límites de horas extra por empresa.
CREATE TABLE [payroll].[overtime_settings](
    [id_empresa]                  [int]          NOT NULL,
    [limite_horas_dobles_periodo] [decimal](5,1) NOT NULL,   -- horas autorizadas del periodo que se pagan dobles; el resto, triples (spec 61)
    [tope_horas_dia]              [decimal](4,1) NOT NULL,   -- máximo de horas autorizables por empleado y día
    [updated_by]                  [int]          NOT NULL,
    [updated_at]                  [datetime2](0) NOT NULL,
 CONSTRAINT [PK_overtime_settings] PRIMARY KEY CLUSTERED ([id_empresa] ASC),
 CONSTRAINT [CK_overtime_settings_valores] CHECK (
     [limite_horas_dobles_periodo] >= 0
     AND [tope_horas_dia] > 0 AND [tope_horas_dia] <= 24
     AND [limite_horas_dobles_periodo] * 2 = FLOOR([limite_horas_dobles_periodo] * 2)
     AND [tope_horas_dia] * 2 = FLOOR([tope_horas_dia] * 2))
) ON [PRIMARY]
GO

INSERT INTO [payroll].[overtime_settings]
    ([id_empresa],[limite_horas_dobles_periodo],[tope_horas_dia],[updated_by],[updated_at])
VALUES (1, 9.0, 16.0, 1, '2026-09-25 00:00:00')
GO

-- Spec 60: bitácora de cambios a la configuración de horas extra.
CREATE TABLE [payroll].[overtime_settings_log](
    [id_log]                               [int] IDENTITY(1,1) NOT NULL,
    [id_empresa]                           [int]          NOT NULL,
    [limite_horas_dobles_periodo_anterior] [decimal](5,1) NULL,     -- NULL: no había configuración
    [limite_horas_dobles_periodo_nuevo]    [decimal](5,1) NOT NULL,
    [tope_horas_dia_anterior]              [decimal](4,1) NULL,
    [tope_horas_dia_nuevo]                 [decimal](4,1) NOT NULL,
    [updated_by]                           [int]          NOT NULL,
    [updated_at]                           [datetime2](0) NOT NULL,
 CONSTRAINT [PK_overtime_settings_log] PRIMARY KEY CLUSTERED ([id_log] ASC)
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_overtime_settings_log_empresa]
    ON [payroll].[overtime_settings_log] ([id_empresa], [updated_at] DESC)
GO

-- Spec 60: decisión del admin sobre las horas extra de un empleado en una fecha.
-- Sin fila = Pendiente. Se sobrescribe al volver a decidir (sin historial de decisiones).
CREATE TABLE [payroll].[overtime_authorizations](
    [id_overtime_authorization] [int] IDENTITY(1,1) NOT NULL,
    [id_empleado]               [int]           NOT NULL,
    [fecha]                     [date]          NOT NULL,
    [estado]                    [char](1)       NOT NULL,   -- 'A' autorizada | 'R' rechazada
    [horas_autorizadas]         [decimal](4,1)  NULL,       -- solo con 'A'; puede superar lo detectado
    [horas_detectadas]          [decimal](4,1)  NOT NULL,   -- detección al momento de decidir (0 si checada incompleta)
    [comentario]                [nvarchar](500) NULL,
    [decided_by]                [int]           NOT NULL,
    [decided_at]                [datetime2](0)  NOT NULL,   -- buildDate(new Date())
 CONSTRAINT [PK_overtime_authorizations] PRIMARY KEY CLUSTERED ([id_overtime_authorization] ASC),
 CONSTRAINT [UQ_overtime_authorizations_empleado_fecha] UNIQUE ([id_empleado], [fecha]),
 CONSTRAINT [FK_overtime_authorizations_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado]),
 CONSTRAINT [CK_overtime_authorizations_estado] CHECK (
     ([estado] = 'A' AND [horas_autorizadas] > 0 AND [horas_autorizadas] <= 24
          AND [horas_autorizadas] * 2 = FLOOR([horas_autorizadas] * 2))
  OR ([estado] = 'R' AND [horas_autorizadas] IS NULL)),
 CONSTRAINT [CK_overtime_authorizations_detectadas] CHECK (
     [horas_detectadas] >= 0 AND [horas_detectadas] * 2 = FLOOR([horas_detectadas] * 2))
) ON [PRIMARY]
GO
```

**Qué valida cada lado:**

- El `UNIQUE (id_empleado, fecha)` también sirve de índice para leer las decisiones de un periodo (`WHERE id_empleado IN (…) AND fecha BETWEEN …`).
- En la BD se valida: horas en múltiplos de 0.5, rechazada sin horas y autorizada con horas entre 0 y 24.
- El tope configurable (`tope_horas_dia`) no puede ser un `CHECK`, porque cambia. Se valida con zod y otra vez en SQL dentro de la transacción que escribe. Si el tope baja, las autorizaciones ya guardadas no cambian.
- `overtime_authorizations` no tiene FK a `payroll.periods` ni columna `id_period`. La decisión es del día del empleado, no del periodo, así que sobrevive si un periodo se borra y se vuelve a crear. La spec 61 la encuentra por rango de fechas.

**Lectura y escritura (regla de strings):**

- `fecha` se lee con `CONVERT(varchar(10), [fecha], 120)`, y `decided_at` / `updated_at` con `CONVERT(varchar(19), …, 120)`.
- Las checadas se leen como en la spec 39 (`fecha_hora` como string) y el horario como en la spec 59 (`CONVERT(varchar(5), …, 108)`).
- El día de la semana de una fecha `"YYYY-MM-DD"` se calcula desde sus partes numéricas con `Date.UTC(...)`, nunca con `new Date(dbValue)` directo.
- Las horas y minutos se restan como minutos enteros, a partir de `"HH:mm"`.

**Interfaz nueva `interfaces/payroll_overtime.ts`:**

```ts
/** Lo que el admin decidió; sin fila en BD = "pending". */
export type OvertimeDecisionStatus = "pending" | "authorized" | "rejected";

export interface IOvertimeSettings {
  id_empresa:                  number;
  limite_horas_dobles_periodo: number;
  tope_horas_dia:              number;
  updated_by:                  number;
  updated_at:                  string;   // "YYYY-MM-DD HH:mm:ss"
}

export interface IOvertimeSettingsLogEntry {
  id_log:                               number;
  limite_horas_dobles_periodo_anterior: number | null;
  limite_horas_dobles_periodo_nuevo:    number;
  tope_horas_dia_anterior:              number | null;
  tope_horas_dia_nuevo:                 number;
  updated_by_name:                      string;
  updated_at:                           string;
}

/** Resultado del helper puro para un empleado y un día. */
export interface IOvertimeDetection {
  fecha:           string;               // "YYYY-MM-DD"
  scheduledDay:    IScheduleDay | null;  // null = descanso
  firstCheckIn:    string | null;        // "HH:mm"
  lastCheckOut:    string | null;        // "HH:mm"
  isIncomplete:    boolean;
  detectedHours:   number;               // múltiplo de 0.5; 0 si incompleto
}

/** Fila de la lista: detección en vivo + decisión guardada. */
export interface IOvertimeDayRow extends IOvertimeDetection {
  id_empleado:                number;
  codigo_empleado:            string;
  nombre_completo:            string;
  status:                     OvertimeDecisionStatus;
  authorizedHours:            number | null;
  detectedHoursAtDecision:    number | null;   // para la marca "Detectado cambió"
  comentario:                 string | null;
  decided_by_name:            string | null;
  decided_at:                 string | null;
}

export interface IOvertimePage {
  period:                  IPayrollPeriod | null;
  periodOptions:           IPayrollPeriod[];
  canDecide:               boolean;             // periodo en estatus 1 o 2
  rows:                    IOvertimeDayRow[];   // ya filtradas y paginadas
  totalRows:               number;
  summary: { pendingDays: number; detectedHours: number; authorizedHours: number };  // sin filtros
  employeesWithoutSchedule: { id_empleado: number; nombre_completo: string }[];
  settings:                IOvertimeSettings | null;
}
```

**Helper puro `lib/payroll/overtimeDetection.ts`:**

```ts
// detectEmployeeOvertime(schedule: IScheduleDay[], events: IAttendanceEvent[],
//                        fromDate: string, toDate: string): IOvertimeDetection[]
//   → solo días con detectedHours > 0 o isIncomplete; [] si schedule está vacío.
// roundDownToHalfHour(minutes: number): number
// weekdayOfDate(fecha: "YYYY-MM-DD"): WeekdayNumber
```

**Esquemas zod** en `lib/payroll/schemas.ts`:

```ts
// overtimeSettingsSchema    { limite_horas_dobles_periodo: >= 0, múltiplo de 0.5;
//                             tope_horas_dia: > 0, <= 24, múltiplo de 0.5 }
// decideOvertimeDaySchema   { id_period: int+, id_empleado: int+, fecha: "YYYY-MM-DD" real,
//                             decision: "authorized" | "rejected",
//                             horas_autorizadas: múltiplo de 0.5, > 0 (obligatorio solo si authorized),
//                             comentario: string <= 500, opcional }
// clearOvertimeDecisionSchema { id_period, id_empleado, fecha }
```

`id_period` viaja en las escrituras solo para validar dentro de la transacción tres cosas:

- el periodo es de la sucursal activa y está en estatus 1 o 2;
- `fecha` cae dentro de su rango;
- el empleado es elegible para ese periodo.

No se guarda en la tabla.

## Plan de implementación

1. **Base de datos.**
   - Ejecutar contra la BD los `CREATE TABLE` de `payroll.overtime_settings`, `payroll.overtime_settings_log` y `payroll.overtime_authorizations`, con sus constraints e índice, y la semilla de `overtime_settings` (empresa 1: 9.0 / 16.0).
   - Documentarlo en `queries.txt`, bloque `NOMINA PAYROLL`, después de `payroll.period_employee_product_sales`.
   - Prueba manual:
     - Un `INSERT` en `overtime_authorizations` con `'A'` y 2.5 h entra.
     - Estos casos fallan por `CK_overtime_authorizations_estado`:
       - `'A'` sin horas;
       - `'A'` con 2.3 h;
       - `'R'` con horas.
     - Un segundo `INSERT` con el mismo empleado y fecha falla por el `UNIQUE`.
     - En `overtime_settings`, un `tope_horas_dia` de 0 o 25 falla por el `CHECK`.
     - Al terminar, se borran las filas de prueba (menos la semilla).

2. **Tipos y helper de detección.**
   - Crear `interfaces/payroll_overtime.ts` con los tipos del modelo de datos.
   - Crear `lib/payroll/overtimeDetection.ts` con `weekdayOfDate`, `roundDownToHalfHour` y `detectEmployeeOvertime`:
     - reutiliza `summarizeAttendanceEvents` (`attendancePairing.ts`) para decidir si el día está incompleto;
     - aplica las reglas de día con horario, día de descanso y redondeo;
     - regresa `[]` si el horario está vacío.
   - Verificar a mano (script temporal en el scratchpad o `tsx`) con estos casos, y borrar el script al terminar:
     - Horario 08:00–17:00 con checadas 08:00→19:30: 2.5 h.
     - Horario 09:00–18:00 con checadas 10:00→19:00: 1.0 h.
     - Horario 09:00–18:00 con checadas 07:30→18:00: 1.5 h.
     - Descanso con checadas 09:00→13:10: 4.0 h.
     - 2 h 17 min de extra: 2.0 h.
     - Entrada sin salida: incompleto, 0 h.
     - Turno partido 09:00–14:00 / 16:00–20:00 con salida 21:00: 1.0 h.
   - Nada lo consume todavía, así que el sistema compila igual.

3. **Lógica compartida de nómina.**
   - Mover `resolvePeriod` de `nomina/procesar/actions.ts` a un archivo server-only de `lib/payroll/` (no `"use server"`, como `access.ts`) y hacer que Procesar lo importe de ahí, sin cambiar su comportamiento.
   - Crear en `lib/payroll/` el fragmento SQL de **empleados elegibles para la nómina operativa de un periodo**, con las mismas condiciones de la spec 53.
   - Esta spec no modifica `calculatePayrollPeriod`: alinearlo con el fragmento compartido le toca a la spec 61.
   - Prueba manual: Procesar sigue resolviendo el periodo igual que antes (el pedido, el vigente o el más reciente).

4. **Configuración: actions y schemas.**
   - Agregar `overtimeSettingsSchema` a `lib/payroll/schemas.ts`.
   - Crear `app/dashboard/nomina/horas-extra/actions.ts` (`"use server"`) con:
     - `getOvertimeSettings`.
     - `getOvertimeSettingsLog`, con los últimos 20 cambios.
     - `updateOvertimeSettings`: valida con zod, y compara, escribe y registra en bitácora dentro de una transacción con `UPDLOCK, HOLDLOCK`. Un guardado sin cambios no escribe en la bitácora.
   - Todo detrás de `assertPayrollAccess()` y con el `id_empresa` de la sesión.

5. **Decisiones: actions y schemas.**
   - Agregar `decideOvertimeDaySchema` y `clearOvertimeDecisionSchema` a `lib/payroll/schemas.ts`.
   - `decideOvertimeDay` hace todo en una transacción:
     - valida con zod;
     - lee el periodo `WITH (UPDLOCK, HOLDLOCK)` y comprueba sucursal, estatus 1 o 2, que `fecha` esté en su rango y que el empleado sea elegible (con el fragmento del paso 3);
     - compara `horas_autorizadas <= tope_horas_dia` contra la configuración vigente, leída en la misma transacción;
     - recalcula en el servidor `horas_detectadas` con `detectEmployeeOvertime` para ese empleado y día. Nunca se confía en el valor que manda el cliente;
     - hace upsert por `(id_empleado, fecha)` con `decided_by` y `decided_at = buildDate(new Date())`.
   - `clearOvertimeDecision` hace las mismas validaciones de periodo y borra la fila.
   - Las dos devuelven `ActionResult` con un mensaje claro para cada caso rechazado ("El periodo ya no admite cambios", "Máximo X h por día", …) y llaman a `revalidatePath("/dashboard/nomina/horas-extra")`.

6. **Lectura de la pantalla (`getOvertimePage`).**
   - Resolver el periodo con `resolvePeriod`, cargar los empleados elegibles, su horario, sus checadas del rango y las decisiones del rango. Son cuatro SELECT en total, no uno por empleado.
   - Correr `detectEmployeeOvertime` por empleado y unir el resultado con las decisiones: aparecen los días con extra, los incompletos y los que ya tienen decisión.
   - Calcular el resumen **sin filtros**, y aplicar después el filtro `estado`, la búsqueda `q` y la paginación de 25 filas.
   - Armar `employeesWithoutSchedule` y `canDecide`.
   - Orden de la lista: apellido, nombre, `id_empleado` y `fecha`.

7. **Pantalla en solo lectura.**
   - Crear `app/dashboard/nomina/horas-extra/page.tsx` (Server Component) con:
     - el texto fijo "Las horas autorizadas se pagarán cuando se integre el cálculo de horas extra en la nómina.";
     - el selector de periodo, el filtro de estado y la búsqueda con debounce, en un Client Component chico `OvertimeToolbar`;
     - las tarjetas resumen;
     - el aviso "Sin horario definido", con enlaces a `/dashboard/empleados/[id]/horario`;
     - la tabla `OvertimeDaysTable`, un Server Component con la marca "Detectado cambió: X → Y";
     - la paginación.
   - Agregar "Horas extra" al grupo Nómina en `navConfig.tsx`, con los mismos `excludeRoles`.
   - Se aplica la skill `frontend-design` con los tokens y los patrones visuales de Procesar y Comisiones.
   - Prueba manual: con una decisión insertada a mano, la pantalla la muestra con el estado correcto.

8. **Tarjeta de configuración.**
   - Crear `OvertimeSettingsCard` y `OvertimeSettingsLog`, ambos Server Components, y el modal cliente `OvertimeSettingsModal`.
   - Se toma como modelo `TreatmentCommissionSettingsCard`, `TreatmentCommissionSettingsLog` y `TreatmentCommissionSettingsModal`, y se extrae lo que se pueda compartir sin forzarlo.
   - Van arriba de la lista.

9. **Modal de decisión.**
   - Crear `OvertimeDecisionModal` (Client Component). Se abre desde un botón por fila, que solo se muestra si `canDecide` es verdadero.
   - Muestra el resumen del día (horario, checadas y detectado).
   - Captura las horas, con `<input type="number" step="0.5">` y el valor detectado como sugerencia, más el comentario opcional.
   - Tiene los botones "Autorizar", "Rechazar" y "Volver a pendiente"; este último solo aparece si ya hay decisión.
   - Valida en el cliente antes de enviar, muestra el `message` si el servidor responde `{ ok: false }`, y al guardar bien cierra el modal y hace `router.refresh()`.

10. **Documentación.**
    - Agregar a `docs/nomina.md` la sección "Horas extra (spec 60)" con:
      - las reglas de detección;
      - quién se revisa;
      - las tres tablas;
      - que "sin fila = pendiente";
      - que la decisión es del día y no del periodo;
      - que se usa el horario actual;
      - que todavía no se paga (spec 61).
    - Actualizar el párrafo inicial del módulo y la lista de `actions.ts` de `CLAUDE.md` para incluir `nomina/horas-extra/`.

Cada paso deja el sistema compilando y funcionando.

## Criterios de aceptación

**Base de datos**

- [ ] `payroll.overtime_settings`, `payroll.overtime_settings_log` y `payroll.overtime_authorizations` existen con las columnas, constraints e índices del modelo de datos, y están documentadas en `queries.txt`.
- [ ] La empresa 1 tiene la semilla: 9.0 horas dobles por periodo y 16.0 horas de tope por día.
- [ ] La BD rechaza un `INSERT` directo en `overtime_authorizations` en cualquiera de estos casos:
  - `'A'` sin horas;
  - horas que no son múltiplo de 0.5;
  - `'R'` con horas;
  - un duplicado de `(id_empleado, fecha)`.
- [ ] No se modificó ninguna tabla existente.

**Detección**

Para cada caso, la fila del día muestra las horas indicadas:

- [ ] Horario 08:00–17:00 con checadas 08:00 → 19:30: **2.5 h**.
- [ ] Horario 09:00–18:00 con checadas 10:00 → 19:00: **1.0 h**. El retardo no la reduce.
- [ ] Horario 09:00–18:00 con checadas 07:30 → 18:00: **1.5 h**.
- [ ] Horario 09:00–18:00 con checadas 08:40 → 18:50: **1.0 h** (20 min + 50 min = 70 min, redondeado a 1.0).
- [ ] Día de descanso con checadas 09:00 → 13:10: **4.0 h**.
- [ ] Turno partido 09:00–14:00 / 16:00–20:00 con checadas 09:00 → 14:00 y 16:00 → 21:00: **1.0 h**. La comida no cuenta.
- [ ] 2 h 17 min de extra se muestran como **2.0 h**, y 25 min como **0 h**. Este último día no aparece en la lista si no tiene decisión.

Casos sin detección:

- [ ] Un día con entrada y sin salida aparece como "Checada incompleta" con 0 h detectadas.
- [ ] Un empleado elegible sin filas en `RH.empleado_horarios` no aparece en la lista, sí aparece en el aviso "Sin horario definido", y el aviso enlaza a su pestaña Horario.
- [ ] No se detecta extra para:
  - días antes de `fecha_ingreso` o fuera del rango del periodo;
  - empleados de otra sucursal u otra frecuencia;
  - empleados inactivos o con `salario_diario` operativo en 0 o `NULL`.

**Autorización**

- [ ] Se puede autorizar un día con horas distintas a las detectadas, incluso mayores: con 2.5 h detectadas, autorizar 4.0 h queda guardado con `horas_autorizadas = 4.0` y `horas_detectadas = 2.5`.
- [ ] Se puede autorizar un día con "Checada incompleta" y guardarlo con `horas_detectadas = 0`.
- [ ] Autorizar más que `tope_horas_dia`, horas que no son múltiplo de 0.5, o 0 horas no se puede ni desde el modal ni con una llamada directa a `decideOvertimeDay`. La llamada directa devuelve `{ ok: false, message }` y no escribe nada.
- [ ] Si el cliente manda un valor de `horas_detectadas`, `decideOvertimeDay` lo ignora y guarda el que recalcula el servidor.
- [ ] Rechazar guarda `'R'` con `horas_autorizadas = NULL`, y el comentario si se capturó.
- [ ] "Volver a pendiente" borra la fila y el día vuelve a "Pendiente". Si su detección actual es 0 y no es incompleto, desaparece de la lista.
- [ ] Decidir otra vez un día ya decidido sobrescribe la misma fila: nunca hay dos filas por empleado y fecha.
- [ ] Con el periodo en estatus 3 o 4, la pantalla no muestra botones de decisión. `decideOvertimeDay` y `clearOvertimeDecision` devuelven `{ ok: false }` si:
  - el periodo no está en estatus 1 o 2;
  - el periodo es de otra sucursal;
  - la fecha está fuera de su rango;
  - el empleado no es elegible.
- [ ] Si llega una checada que cambia lo detectado después de decidir, la fila muestra "Detectado cambió: X → Y" y conserva `horas_autorizadas`.
- [ ] Después de decidir, la lista y las tarjetas resumen se actualizan sin recargar la página a mano.

**Configuración**

- [ ] La tarjeta muestra el límite de horas dobles por periodo y el tope por día vigentes. El modal permite editarlos con validación: límite ≥ 0, tope > 0 y ≤ 24, ambos múltiplos de 0.5.
- [ ] Cada guardado que cambia algún valor agrega una fila a la bitácora con los valores anteriores y nuevos. Un guardado sin cambios no agrega nada.
- [ ] La bitácora muestra los últimos 20 cambios, con usuario y fecha.
- [ ] Bajar el tope por día no modifica autorizaciones ya guardadas.

**Pantalla y navegación**

- [ ] "Horas extra" aparece en el menú de Nómina solo para los roles 1 y 4, y abre `/dashboard/nomina/horas-extra`.
- [ ] Los demás roles son redirigidos por `proxy.ts` (sin cambios en ese archivo), y las actions les devuelven `{ ok: false }`.
- [ ] La pantalla muestra el texto fijo "Las horas autorizadas se pagarán cuando se integre el cálculo de horas extra en la nómina."
- [ ] Sin `periodo` en la URL se abre el periodo vigente de la sucursal activa, o el más reciente si no hay vigente. Cambiar de sucursal cambia la lista de periodos.
- [ ] El filtro de estado, la búsqueda y la paginación de 25 filas viven en la URL. Las tarjetas resumen no cambian al filtrar.
- [ ] `page.tsx` y la tabla son Server Components. Los únicos archivos con `"use client"` en `horas-extra/` son `OvertimeToolbar`, `OvertimeSettingsModal` y `OvertimeDecisionModal`.
- [ ] Procesar sigue resolviendo el periodo igual que antes del paso 3.
- [ ] `calculatePayrollPeriod` no cambió: calcular un periodo con horas autorizadas da exactamente los mismos importes que antes de esta spec.

**Transversal**

- [ ] Ninguna fecha u hora pasa por `new Date(valorDeBD)`. Las fechas se leen con `CONVERT(..., 120)`, las horas con `CONVERT(varchar(5), ..., 108)`, y el día de la semana sale de las partes numéricas de `"YYYY-MM-DD"`.
- [ ] `docs/nomina.md` tiene la sección "Horas extra (spec 60)", y `CLAUDE.md` menciona `nomina/horas-extra/`.
- [ ] `npm run build` (o `tsc --noEmit`) termina sin errores de tipos.

## Decisiones tomadas y descartadas

- **Sí: partir la feature en dos specs (60 detección y autorización, 61 pago).** Así las autorizaciones se prueban con datos reales antes de tocar `calculatePayrollPeriod`, que ya encadena tres conceptos. **No:** una sola spec, porque tocaría BD, dos pantallas nuevas y el SQL de cálculo en el mismo cambio.
- **Sí: solo nómina operativa.** Las reglas fiscales (ISR exento hasta 9 h y gravado después, filas `'F'`) quedan para otra spec. **No:** incluir lo fiscal ahora. El documento de origen lo marca como posterior.
- **Sí: se calculan dobles y triples sin tope de triples** (el reparto lo hace la spec 61), porque el control lo da la autorización del admin. **No:** limitar a 9 h y descartar el excedente.
- **Sí: la extra es tiempo fuera del horario programado,** antes de la entrada y después de la salida, y el retardo no la compensa. Coincide con el ejemplo del documento ("retardo 1 hora, hora extra 1 hora"). **No:** el neto `horas trabajadas − jornada`, que en ese ejemplo daría 0 h.
- **Sí: llegar antes de la entrada cuenta como extra.** **No:** ignorar la llegada temprana.
- **Sí: en un día de descanso todas las horas son extra.** **No:** excluir los días de descanso ni tratarlos como un concepto aparte (prima dominical o descanso trabajado quedan fuera).
- **Sí: redondeo hacia abajo a bloques de 30 minutos, sin mínimo.** **No:** minutos exactos ni horas completas.
- **Sí: primera entrada y última salida del día. Lo trabajado durante la comida o entre bloques no cuenta, y un día incompleto no detecta extra.** **No:** sumar pares entrada → salida, porque una comida sin checar inflaría o partiría el cálculo.
- **Sí: reutilizar `summarizeAttendanceEvents` para decidir si un día está incompleto.** Así "incompleto" significa lo mismo en el expediente y en nómina. **No:** una regla nueva de emparejamiento.
- **Sí: sin horario capturado no se detecta extra, y hay un aviso con enlace.** **No:** tratar todos los días como descanso, que convertiría todo lo trabajado en extra.
- **Sí: autorización por empleado y día, con horas ajustables, incluso mayores a lo detectado, en pasos de 0.5, con comentario opcional.** Permite cubrir checadas faltantes. **No:** autorizar el total del periodo, solo aprobar o rechazar lo detectado, ni pagar sin autorización.
- **Sí: se listan los días con extra detectada, los incompletos y los que ya tienen decisión.** **No:** un botón "Agregar día" para capturar cualquier fecha, ni listar solo lo detectado.
- **Sí: tres estados, con "Pendiente" = sin fila. "Volver a pendiente" borra la fila.** **No:** una columna de estado con un valor "pendiente", que obligaría a precrear filas.
- **Sí: la decisión se guarda por `(id_empleado, fecha)`, sin `id_period`.** Sobrevive si un periodo se borra y se vuelve a crear. **No:** atarla al periodo con FK.
- **Sí: volver a decidir sobrescribe la fila, y solo queda quién decidió al último y cuándo.** **No:** historial de decisiones.
- **Sí: `horas_detectadas` se guarda al decidir y la recalcula el servidor.** Así se puede marcar "Detectado cambió: X → Y" sin confiar en el cliente. **No:** guardar solo las horas autorizadas.
- **Sí: se puede decidir con el periodo en estatus 1 o 2.** **No:** bloquear las decisiones en cuanto el periodo se calcula. El aviso de "Recalcula" llega con la spec 61.
- **Sí: el límite de 9 h dobles se cuenta por periodo, sin importar su duración** (una quincena también tiene 9). **No:** semana calendario lunes a domingo (la medida de la LFT), ni bloques de 7 días desde el inicio del periodo.
- **Sí: el límite de horas dobles y el tope diario se configuran por empresa, con bitácora,** siguiendo el patrón de la spec 57. **No:** constantes en código. Los multiplicadores 2 y 3 quedan fijos.
- **Sí: la configuración vive en la propia pantalla de Horas extra.** **No:** en `/dashboard/nomina/comisiones`.
- **Sí: el tope diario se valida con zod y en SQL al escribir.** Bajarlo no cambia autorizaciones ya guardadas. **No:** un `CHECK` en BD, porque el valor cambia.
- **Sí: la detección se hace en vivo en TS (helper puro) solo para la pantalla, y la nómina (spec 61) pagará únicamente lo autorizado.** **No:** detectar en SQL dentro de `calculatePayrollPeriod`, que duplicaría una regla compleja en dos lenguajes.
- **Sí: se revisan solo los empleados elegibles para la nómina operativa del periodo, con las reglas de la spec 53.** El fragmento SQL se extrae a `lib/payroll/` y `resolvePeriod` se mueve ahí para reutilizarlo. **No:** duplicar esas condiciones y esa resolución de periodo en la pantalla nueva.
- **Sí: se usa el horario actual del empleado para todo el periodo.** **No:** historial o vigencia del horario (fuera del alcance de la spec 59).
- **Sí: la tarifa será `salario_diario / 8 × 2|3`, siempre entre 8 aunque la jornada sea de 9 h, y congelada en el snapshot** (se implementa en la spec 61). **No:** dividir entre la duración real de la jornada.
- **Sí: un texto fijo en la pantalla avisa que las horas autorizadas todavía no se pagan.** Se retira con la spec 61. **No:** dejar la pantalla sin aviso mientras la 61 no exista.

## Riesgos identificados

- **El horario no tiene historial.** Si RH cambia el horario de un empleado a mitad del periodo, o después de cerrarlo, la detección de *todo* el periodo se recalcula con el horario nuevo. Las decisiones guardadas no cambian, pero aparecen marcadas con "Detectado cambió".
  - **Mitigación:** la marca hace visible el cambio.
  - **Pendiente:** si se vuelve frecuente, una spec futura agrega vigencia al horario.
- **Checadas mal clasificadas.** `resolveEventType` trata como `entrada` cualquier código que no sea de salida. Un checador mal configurado genera días "incompletos" en masa y deja la detección en 0.
  - **Mitigación:** esos días aparecen en la lista como "Checada incompleta" y el admin puede autorizarlos a mano. No se pierden en silencio.
- **Turnos que cruzan la medianoche.** Las checadas se agrupan por fecha calendario. Alguien que sale a las 00:30 queda con un día "incompleto" y otro con una salida suelta.
  - **Mitigación:** esta spec no los soporta, igual que la 59; el admin autoriza a mano.
- **Autorizar más de lo detectado.** Es intencional, pero no queda un límite contra el error de dedo más allá de `tope_horas_dia`.
  - **Mitigación:** el comentario opcional, `decided_by` / `decided_at`, y el contraste visible entre detectado y autorizado en la lista.
- **Rendimiento de la lectura.** `getOvertimePage` trae todas las checadas del periodo de todos los empleados elegibles y detecta en TS, antes de filtrar y paginar. Con quincenas y sucursales grandes puede crecer.
  - **Mitigación:** son cuatro SELECT acotados por rango y usan el índice existente `IX_asistencias_empleado_fecha`.
  - **Si se vuelve lento:** cachear por periodo o mover el filtro de estado a SQL, sin cambiar la regla.
- **Doble fuente de verdad temporal.** Hasta que exista la spec 61, las decisiones no tienen ningún efecto en la nómina. Alguien podría autorizar horas esperando verlas pagadas en el siguiente cálculo.
  - **Mitigación:** un texto fijo en la pantalla: "Las horas autorizadas se pagarán cuando se integre el cálculo de horas extra en la nómina."
  - **Cuándo se retira:** con la spec 61.
- **Decisiones en periodos que se cruzan.** Como la decisión es por empleado y fecha, sin periodo, si un empleado cambia de frecuencia el mismo día puede caer en dos periodos distintos.
  - **Mitigación:** la spec 61 debe resolverlo con su candado de pago único (`UNIQUE` por autorización en `period_employee_overtime`).
