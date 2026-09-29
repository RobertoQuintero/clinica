# 62 — Nómina: control de faltas

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [59 — Empleados: horario semanal estructurado](59-empleado-horario-semanal.md): `RH.empleado_horarios`. Un día con fila es un día laboral; sin fila es descanso.
  - [39 — Empleados: historial de asistencias](39-empleado-historial-asistencias.md): `RH.asistencias`. Cualquier checada del día, aunque esté incompleta, cuenta como asistencia.
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md): `calculatePayrollPeriod`, `revertPayrollCalculation`, el snapshot `payroll.period_employees` y su columna `dias`, que ahora se reduce por las faltas.
  - [54 — Nómina: detalle de percepciones por empleado](54-nomina-detalle-percepciones-empleado.md): `buildPerceptionLines` y la pantalla de Detalle.
  - [55 — Empleados: vincular usuarios](55-empleado-vincular-usuarios.md): `users.id_empleado`, que decide a quién aplica el control de faltas (empleados con un usuario podólogo, `id_role = 2`, activo).
  - [60](60-nomina-horas-extra-deteccion-autorizacion.md) y [61](61-nomina-horas-extra-pago.md): el patrón que se replica. De la 60: pantalla por periodo con decisiones por empleado y día, sin `id_period`. De la 61: desglose con candado `UNIQUE (id_empleado, fecha)`, `ON DELETE CASCADE` y aviso "Recalcula".
- **Modifica base de datos:** Sí.
  - Tabla nueva `payroll.absence_justifications`: justificante o "no aplica" por empleado y día.
  - Tabla nueva `payroll.period_employee_absences`: desglose de las faltas descontadas por periodo, empleado y tipo de nómina.
  - Columna nueva `dias_falta` en `payroll.period_employees`.
- **Fecha:** 2026-09-29
- **Objetivo:** Para los empleados vinculados a un usuario podólogo (`id_role = 2`), detectar como falta cada día laboral ya transcurrido del periodo en el que no checaron, permitir justificarla con un archivo (PDF, JPG o PNG) o marcarla "no aplica" con comentario en la pantalla nueva "Faltas", y descontar las faltas injustificadas de los días pagados del sueldo base en ambas nóminas.
- **Reglas de origen:** `references/docs/faltas.md` (sección 3.1).

## Alcance

**Incluye:**

- **Base de datos** (DDL documentado en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 61):
  - Tabla nueva `payroll.absence_justifications`: una fila por empleado y día (`UNIQUE (id_empleado, fecha)`), con `estado` `'J'` (justificada con archivo) o `'N'` (no aplica con comentario). **Sin fila, la falta es injustificada.** La tabla no tiene `id_period`, igual que `overtime_authorizations`.
  - Tabla nueva `payroll.period_employee_absences`: una fila por falta descontada, con `tipo_nomina`, `UNIQUE (id_empleado, fecha, tipo_nomina)`, `ON DELETE CASCADE` a `period_employees` y sin FK a `absence_justifications`.
  - `payroll.period_employees` gana `dias_falta` (`NOT NULL DEFAULT 0`, `CHECK >= 0`).
- **Detección de faltas.** Un día es falta si cumple todas estas condiciones:
  - tiene fila en `RH.empleado_horarios` para su día de la semana ISO;
  - está entre `max(fecha_inicio, fecha_ingreso)` y `fecha_fin`;
  - es anterior a hoy (`addZeroToday(new Date())`, hora de Ciudad de México);
  - no tiene **ninguna** checada en `RH.asistencias`.

  Otros criterios:
  - Una checada incompleta cuenta como asistencia.
  - Se usa el horario **actual** para todo el periodo, sin historial de horarios, igual que en la spec 60.
  - Un empleado sin horario no genera faltas y aparece en el aviso "Sin horario definido".
- **Quién se revisa.** Un empleado entra al control de faltas si cumple las dos condiciones:
  - `ELIGIBLE_EMPLOYEE_BASE_CONDITIONS` + (`salario_diario > 0` OR `salario_diario_fiscal > 0`), es decir, entra a alguna de las dos nóminas del periodo;
  - **tiene al menos un usuario vinculado** (`dbo.users.id_empleado`) con `id_role` en `ABSENCE_CONTROL_ROLE_IDS` (`[2]`, podólogo) y `status = 1`.

  La constante `ABSENCE_CONTROL_ROLE_IDS` vive en `lib/payroll/constants.ts`. El fragmento SQL `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION` (un `EXISTS` sobre `dbo.users`) vive en `lib/payroll/eligibleEmployees.ts` y lo usan la pantalla, las escrituras, el cálculo y el aviso "Recalcula", para que haya una sola copia de la regla.
  - El rol se evalúa **en el momento** (al abrir la pantalla, al escribir y al calcular), sin historial.
  - Los demás empleados **no aparecen** en la pantalla Faltas ni en su aviso "Sin horario definido", y su snapshot queda con `dias_falta = 0`.
- **Helper espejo puro** `lib/payroll/absenceDetection.ts`. Detecta en TypeScript para la pantalla, sin BD y sin `Date` sobre strings crudos. **En el cálculo manda el SQL.**
- **Pantalla nueva `/dashboard/nomina/faltas`**:
  - `page.tsx` es un Server Component. El estado vive en la URL: `periodo`, `estado=injustificada|justificada|no_aplica`, `q` y `pagina`, con 25 filas por página.
  - Tarjetas de resumen del periodo completo (injustificadas, justificadas, no aplica). No cambian con los filtros.
  - Tabla con: empleado, fecha y día de la semana, horario programado, estado, archivo ("Ver archivo") o comentario, y el distintivo "Descontada en {código del periodo}".
  - Tres acciones por fila:
    - **Subir justificante:** PDF, JPG o PNG de máximo 5 MB, a través del `/api/upload` que ya existe. También sirve para reemplazar el archivo.
    - **Marcar no aplica:** el comentario es obligatorio.
    - **Volver a injustificada:** borra la fila de justificación.
  - Se puede editar con el periodo en estatus 1 o 2. En estatus 3 o 4 queda de solo lectura y las acciones devuelven `{ ok: false }`.
  - Reusa el aviso `EmployeesWithoutScheduleNotice`, que se mueve de `horas-extra/componentes/` a `nomina/componentes/`.
  - Se agrega "Faltas" a la sección Nómina de `NAV_LINKS`, con los mismos `excludeRoles`. `proxy.ts` ya protege `/dashboard/nomina`.
- **Server actions** en `nomina/faltas/actions.ts`: `getAbsencePage`, `justifyAbsence`, `markAbsenceNotApplicable` y `clearAbsenceJustification`.
  - Todas pasan por `assertPayrollAccess()`, toman la sucursal de la sesión y validan con `zod` (en `lib/payroll/schemas.ts`).
  - Las escrituras vuelven a validar dentro de la transacción: sucursal y estatus del periodo, `fecha` en el rango, empleado elegible y con control de faltas (usuario podólogo activo), `fecha >= fecha_ingreso`, fecha anterior a hoy, día con horario y sin checadas.
- **Cálculo** dentro del batch de `calculatePayrollPeriod`:
  - Se arma `#absences` con las faltas detectadas de los empleados con control de faltas, que no tienen fila en `absence_justifications` y que ningún otro periodo ya descontó para ese mismo `tipo_nomina`.
  - Por tipo: `dias = días_calendario − dias_falta` y `importe_salario = ROUND(salario × dias, 2)`. Aplica a `'O'` y a `'F'`.
  - Se inserta el desglose de las dos filas de tipo.
  - `describePayrollCalculationError` agrega un mensaje para el choque del `UNIQUE`: "Otro cálculo tomó algunas de estas faltas al mismo tiempo. Intenta de nuevo."
  - `revertPayrollCalculation` no cambia, porque el cascade ya libera el desglose.
- **Aviso "Recalcula"** (`lib/payroll/absenceRecalculation.ts`, server-only, solo para periodos en estatus 2). Se muestra cuando el conjunto de faltas que se descontaría hoy es distinto del desglose del periodo. Casos típicos:
  - se justificó o se marcó "no aplica" un día ya descontado;
  - se regresó a injustificada un día que no se descontó;
  - pasó un día nuevo;
  - llegaron checadas o cambió el horario;
  - un empleado ganó o perdió un usuario podólogo activo (vinculación, rol o `status`).

  `OvertimeRecalculationNotice` se generaliza a `PayrollRecalculationNotice`, con el mensaje como prop, y se muestra en Procesar, Horas extra y Faltas.
- **Procesar:** la columna "Días" muestra como texto secundario "F faltas" cuando `dias_falta > 0`.
- **Detalle:**
  - La línea `sueldo_base` dice "13 días (15 − 2 faltas) × $X diarios" cuando hay faltas.
  - `PayrollAbsencesList` (Server Component) lista las faltas descontadas del tipo seleccionado. Se oculta si no hay ninguna.
- **Documentación:** sección "Faltas (spec 62)" en `docs/nomina.md`, y actualizar el párrafo inicial del módulo.

**No incluye:**

- **Retardos** (sección 3.2): el descuento por 30 minutos o más, la acumulación quincenal de 2 o 4 retardos y sus justificantes.
- **Bonos:** bono de asistencia y bono de puntualidad.
- **Catálogos:** días festivos, vacaciones, incapacidades y "días económicos". Por ahora se cubren con "No aplica".
- **Reglamento:** el reglamento interno precargado en la plataforma.
- **Aprobación del justificante** por un segundo usuario.
- **Control de faltas para otros roles**, o elegir desde pantalla a qué roles o empleados aplica. Hoy es la constante `ABSENCE_CONTROL_ROLE_IDS = [2]`.
- **Historial de horarios** o vigencias. Se usa el horario actual.
- **Justificación masiva** (por rango de fechas o "todo el periodo") y registrar a mano faltas que no se detectaron.
- **Descuento retroactivo:** justificar un día ya descontado en un periodo aprobado (3) o pagado (4) no cambia nada.
- **Borrar el archivo** de Cloudinary al reemplazarlo o al volver a injustificada.
- **Mostrar las faltas en la pestaña Asistencia** del empleado o en su calendario.
- **Deducciones como concepto propio** (IMSS, ISR, "Total a pagar").

## Modelo de datos

**Cambios en BD.** El DDL va en `queries.txt`, bloque `NOMINA PAYROLL`, después de las tablas de la spec 61.

```sql
-- Spec 62: justificación de una falta por empleado y día. Sin fila = falta injustificada.
-- Sin id_period: la justificación pertenece al día del empleado, no al periodo (igual que overtime_authorizations).
CREATE TABLE [payroll].[absence_justifications](
    [id_absence_justification] [int] IDENTITY(1,1) NOT NULL,
    [id_empleado]  [int]            NOT NULL,
    [fecha]        [date]           NOT NULL,
    [estado]       [char](1)        NOT NULL,   -- 'J' justificada con archivo | 'N' no aplica
    [url]          [varchar](500)   NULL,       -- Cloudinary; solo con 'J'
    [mime_type]    [varchar](100)   NULL,       -- 'application/pdf' | 'image/jpeg' | 'image/png'; solo con 'J'
    [size_bytes]   [int]            NULL,       -- solo con 'J'
    [comentario]   [nvarchar](500)  NULL,       -- obligatorio con 'N', opcional con 'J'
    [decided_by]   [int]            NOT NULL,
    [decided_at]   [datetime2](0)   NOT NULL,   -- buildDate(new Date())
 CONSTRAINT [PK_absence_justifications] PRIMARY KEY CLUSTERED ([id_absence_justification] ASC),
 CONSTRAINT [UQ_absence_justifications_empleado_fecha] UNIQUE ([id_empleado], [fecha]),
 CONSTRAINT [FK_absence_justifications_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado]),
 CONSTRAINT [CK_absence_justifications_estado] CHECK (
     ([estado] = 'J' AND [url] IS NOT NULL AND [mime_type] IS NOT NULL
          AND [mime_type] IN ('application/pdf', 'image/jpeg', 'image/png')
          AND [size_bytes] IS NOT NULL AND [size_bytes] > 0 AND [size_bytes] <= 5242880)
  OR ([estado] = 'N' AND [url] IS NULL AND [mime_type] IS NULL AND [size_bytes] IS NULL
          AND [comentario] IS NOT NULL AND LEN([comentario]) > 0))
) ON [PRIMARY]
GO

-- Spec 62: días netos pagados. `dias` pasa a ser días calendario − dias_falta.
ALTER TABLE [payroll].[period_employees]
    ADD [dias_falta] [int] NOT NULL CONSTRAINT [DF_period_employees_dias_falta] DEFAULT (0)
GO
ALTER TABLE [payroll].[period_employees] WITH CHECK
    ADD CONSTRAINT [CK_period_employees_dias_falta] CHECK ([dias_falta] >= 0 AND [dias] >= 0)
GO

-- Spec 62: faltas descontadas por renglón de nómina. UNIQUE por tipo: el mismo día se descuenta
-- una vez en la operativa y una vez en la fiscal, nunca dos veces en el mismo tipo.
-- Sin FK a absence_justifications: justificar un día ya descontado no debe chocar.
CREATE TABLE [payroll].[period_employee_absences](
    [id_period_employee_absence] [int] IDENTITY(1,1) NOT NULL,
    [id_period_employee] [int]     NOT NULL,
    [id_empleado]        [int]     NOT NULL,   -- redundante con period_employees, necesario para el UNIQUE
    [tipo_nomina]        [char](1) NOT NULL,   -- redundante con period_employees, necesario para el UNIQUE
    [fecha]              [date]    NOT NULL,
 CONSTRAINT [PK_period_employee_absences] PRIMARY KEY CLUSTERED ([id_period_employee_absence] ASC),
 CONSTRAINT [UQ_period_employee_absences_empleado_fecha_tipo] UNIQUE ([id_empleado], [fecha], [tipo_nomina]),
 CONSTRAINT [FK_period_employee_absences_period_employee] FOREIGN KEY ([id_period_employee])
     REFERENCES [payroll].[period_employees] ([id_period_employee]) ON DELETE CASCADE,
 CONSTRAINT [CK_period_employee_absences_tipo] CHECK ([tipo_nomina] IN ('O', 'F'))
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_period_employee_absences_period_employee]
    ON [payroll].[period_employee_absences] ([id_period_employee])
GO
```

**Tipos** (archivo nuevo `interfaces/payroll_absence.ts`):

```ts
/** Sin fila en absence_justifications = "unjustified". */
export type AbsenceStatus = "unjustified" | "justified" | "not_applicable";

/** Resultado del helper puro para un empleado y un día detectado como falta. */
export interface IAbsenceDetection {
  fecha:        string;         // "YYYY-MM-DD"
  scheduledDay: IScheduleDay;   // siempre hay horario: sin horario no hay falta
}

/** Fila de la lista: detección en vivo + justificación guardada. */
export interface IAbsenceDayRow extends IAbsenceDetection {
  id_empleado:                number;
  codigo_empleado:            string;
  nombre_completo:            string;
  status:                     AbsenceStatus;
  url:                        string | null;
  mime_type:                  string | null;
  comentario:                 string | null;
  decided_by_name:            string | null;
  decided_at:                 string | null;    // "YYYY-MM-DD HH:mm:ss"
  discountedInPeriodCodes:    string[];         // "NOM-2026-S38" por cada tipo en que ya se descontó
}

export interface IAbsencePage {
  period:                   IPayrollPeriod | null;
  periodOptions:            Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  canDecide:                boolean;           // periodo en estatus 1 o 2
  rows:                     IAbsenceDayRow[];  // ya filtradas y paginadas
  totalRows:                number;
  summary: { unjustifiedDays: number; justifiedDays: number; notApplicableDays: number };  // sin filtros
  employeesWithoutSchedule: { id_empleado: number; nombre_completo: string }[];
  recalculationNeeded:      boolean;           // solo puede ser true en estatus 2
}

/** Falta descontada, para la lista del Detalle. */
export interface IPayrollDiscountedAbsence {
  fecha: string;   // "YYYY-MM-DD"
}
```

**Cambios en tipos existentes** (`interfaces/payroll_calculation.ts`):

- `IPayrollEmployeeRow` y `IPayrollEmployeeSnapshot` ganan `dias_falta: number`.
- `IPayrollEmployeeDetail` gana `discountedAbsences: IPayrollDiscountedAbsence[]`. Viene vacío cuando no hay faltas.

**Convenciones:**

- **`dias` cambia de significado.** A partir de esta spec, `dias` guarda los días **netos** pagados y `importe_salario = ROUND(salario × dias, 2)`. Los días calendario se obtienen como `dias + dias_falta`. Los snapshots calculados antes de esta spec tienen `dias_falta = 0`, así que su `dias` sigue siendo correcto.
- **Día de la semana ISO.** En SQL se calcula como `(DATEDIFF(day, '19000101', fecha) % 7) + 1`. El 1900-01-01 fue lunes, así que el resultado no depende de `DATEFIRST`. En TS se usa `Date.UTC(...)` sobre las partes numéricas, igual que en la spec 60.
- **"Tiene checada".** Existe una fila en `RH.asistencias` con `fecha_hora >= fecha` y `< fecha + 1 día`, de cualquier `tipo`.
- **"Empleado con control de faltas".** `EXISTS (SELECT 1 FROM [dbo].[users] u WHERE u.[id_empleado] = e.[id_empleado] AND u.[id_role] IN (2) AND u.[status] = 1)`. La lista de roles sale de `ABSENCE_CONTROL_ROLE_IDS`, nunca de la entrada del cliente.
- **"Hoy"** llega como parámetro string desde `addZeroToday(new Date())`. En SQL nunca se usa `GETDATE()`, para no depender de la zona horaria del servidor.
- Todas las fechas son strings. Los SELECT usan `CONVERT(varchar(10|19), ..., 120)`.

## Plan de implementación

1. **BD.** Correr el DDL del Modelo de datos y documentarlo en `queries.txt`, bloque `NOMINA PAYROLL`. No cambia nada de código: `dias_falta` vale 0 por defecto y la app sigue igual.
2. **Tipos.** Crear `interfaces/payroll_absence.ts`. Agregar `dias_falta` a `IPayrollEmployeeRow` e `IPayrollEmployeeSnapshot`, y `discountedAbsences` a `IPayrollEmployeeDetail`. Leer `pe.[dias_falta]` en los SELECT de `getPayrollProcessPage` y `getPayrollEmployeeDetail`; `discountedAbsences` devuelve `[]` por ahora. Verificación: la app compila y Procesar se ve igual.
3. **Helper puro** `lib/payroll/absenceDetection.ts`, con `detectEmployeeAbsences(schedules, checadaDates, rangeStart, rangeEndExclusive)` y `formatIsoWeekday`, sin BD y sin `Date` sobre strings crudos.
   - `rangeStart = max(fecha_inicio, fecha_ingreso)`.
   - `rangeEndExclusive = min(fecha_fin + 1, hoy)`.

   Verificación manual con un empleado de horario L–V en una semana sin checadas el miércoles: debe regresar solo ese miércoles, y nunca el día de hoy.
4. **Componentes compartidos.**
   - Mover `EmployeesWithoutScheduleNotice` de `horas-extra/componentes/` a `nomina/componentes/`.
   - Renombrar `OvertimeRecalculationNotice` a `PayrollRecalculationNotice`, con una prop `message`.
   - Actualizar los imports de Procesar y Horas extra, que deben seguir mostrando el mismo texto.
5. **Cargador compartido.** Extraer de `EmployeeDocumentUploader` la validación del archivo (PDF, JPG o PNG; 5 MB) y la llamada a `/api/upload` a `utils/documentUpload.ts` (`validateDocumentFile`, `uploadDocumentFile`). `EmployeeDocumentUploader` pasa a usarlo. Verificación: subir un documento en la pestaña Documentos sigue funcionando.
6. **Lectura de la pantalla.** Agregar `ABSENCE_CONTROL_ROLE_IDS = [2]` a `lib/payroll/constants.ts` y `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION` a `lib/payroll/eligibleEmployees.ts`. Agregar a `lib/payroll/schemas.ts` los schemas `zod` de filtros y escrituras. En el schema del justificante, `url` debe empezar con `https://res.cloudinary.com/`. Crear `nomina/faltas/actions.ts` con `getAbsencePage`, que hace estos SELECT: empleados elegibles con control de faltas, horarios, fechas con checada (`DISTINCT CONVERT(varchar(10), fecha_hora, 120)`), justificaciones y días ya descontados con el código del periodo. Después detecta con el helper, filtra y pagina. `recalculationNeeded` queda en `false` por ahora.
7. **Página de solo lectura** `/dashboard/nomina/faltas`:
   - `page.tsx`, un Server Component que usa `resolvePeriod`;
   - `AbsenceToolbar`, cliente: periodo, estado y búsqueda con debounce;
   - `AbsenceSummaryCards` y `AbsenceDaysTable`, Server Components;
   - el aviso "Sin horario definido";
   - la entrada "Faltas" en `NAV_LINKS`.

   Verificación: la lista coincide con los días sin checada del horario.
8. **Escrituras** en `nomina/faltas/actions.ts`: `justifyAbsence`, `markAbsenceNotApplicable` y `clearAbsenceJustification`.
   - Cada una corre en una transacción con `UPDLOCK, HOLDLOCK` sobre el periodo.
   - Revalida sucursal, estatus 1 o 2, rango, elegibilidad, `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION`, `fecha >= fecha_ingreso`, fecha anterior a hoy, horario del día de la semana y ausencia de checadas.
   - Hace upsert de la fila, o `DELETE` en el caso de clear.
   - `decided_at` sale de `buildDate(new Date())`.
9. **Modales de cliente** en `faltas/componentes/`:
   - `AbsenceJustificationModal`: subir o reemplazar el archivo con `utils/documentUpload.ts`, más un comentario opcional;
   - `AbsenceNotApplicableModal`: comentario obligatorio;
   - `ClearAbsenceJustificationButton`: confirmación dentro de la interfaz, sin `confirm()` nativo.

   Los dos modales se renderizan con un portal a `document.body`, igual que `OvertimeDecisionModal`. En estatus 3 o 4 no se muestran las acciones. Verificación: justificar, marcar "no aplica" y volver a injustificada actualizan la fila y las tarjetas.
10. **Cálculo.** En el batch de `calculatePayrollPeriod`, antes del `INSERT` del snapshot, construir `#period_days` (los días del periodo) y `#absences` con las reglas de detección, solo para empleados que cumplen `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION`. Se excluyen los días con justificación y los que ya descontó otro periodo para ese tipo.
    - En el `INSERT`, un `OUTER APPLY` cuenta las faltas por empleado y tipo. Llena `dias_falta`, `dias = días calendario − dias_falta` e `importe_salario = ROUND(salario × dias, 2)`, en `'O'` y en `'F'`.
    - Después se inserta `period_employee_absences` desde `#absences`, unido a las filas recién creadas.
    - Se agrega el mensaje del `UNIQUE` a `describePayrollCalculationError`.
    - Verificación: comparar el snapshot de un periodo ya calculado sin faltas antes y después de este paso. Debe quedar idéntico. Un empleado sin usuario podólogo sin checadas en todo el periodo queda con `dias_falta = 0`.
11. **Detalle y Procesar.**
    - `getPayrollEmployeeDetail` llena `discountedAbsences`.
    - `buildPerceptionLines` cambia la descripción de `sueldo_base` a "N días (N+F − F faltas) × $X diarios" cuando `dias_falta > 0`. El importe mostrado es siempre el guardado.
    - Se crea `PayrollAbsencesList` (Server Component) en `procesar/[id_empleado]/componentes/`.
    - `PayrollEmployeesTable` muestra "F faltas" debajo de los días.
12. **Aviso "Recalcula."** Crear `lib/payroll/absenceRecalculation.ts` con `isAbsenceRecalculationNeeded(idPeriod)`, server-only y solo para estatus 2. Es un `SELECT` con `EXISTS` que compara, por empleado y tipo del snapshot, el conjunto de faltas que se descontaría hoy (con `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION` evaluada hoy) contra `period_employee_absences` del periodo. Se muestra con `PayrollRecalculationNotice` en Procesar y en Faltas, con el texto "Hay faltas que no coinciden con el último cálculo. Recalcula la nómina."
13. **Documentación.** Agregar la sección "Faltas (spec 62)" a `docs/nomina.md` y actualizar el párrafo inicial (conceptos calculados, tablas y pantallas). En `docs/rh-empleados.md`, actualizar la nota "Not implemented yet" del Horario.

## Criterios de aceptación

**Base de datos**

- [ ] Las tablas `payroll.absence_justifications` y `payroll.period_employee_absences` existen, y `payroll.period_employees` tiene `dias_falta`. Su DDL está en `queries.txt`, bloque `NOMINA PAYROLL`.
- [ ] Insertar a mano una fila `'J'` sin `url`, o una fila `'N'` sin `comentario`, falla por `CK_absence_justifications_estado`.
- [ ] Insertar dos veces el mismo `(id_empleado, fecha, tipo_nomina)` en `period_employee_absences` falla por el `UNIQUE`.

**Detección (pantalla Faltas)**

- [ ] Un empleado con horario L–V y sin ninguna checada el miércoles de la semana del periodo aparece con una falta ese miércoles, en estado "Injustificada".
- [ ] Un día con una sola checada (solo entrada o solo salida) **no** aparece como falta.
- [ ] Un día sin fila en `RH.empleado_horarios` (descanso) **no** aparece como falta, aunque no tenga checadas.
- [ ] El día de hoy y los días futuros del periodo **no** aparecen como falta.
- [ ] Los días anteriores a `fecha_ingreso` **no** aparecen como falta.
- [ ] Un empleado elegible sin ninguna fila de horario aparece en el aviso "Sin horario definido" y no genera faltas.
- [ ] Un empleado con `salario_diario = 0`, `salario_diario_fiscal > 0` y un usuario podólogo activo aparece en la pantalla.
- [ ] Un empleado elegible cuyos usuarios vinculados no tienen `id_role = 2` **no** aparece en la pantalla ni en el aviso "Sin horario definido", aunque no tenga checadas.
- [ ] Un empleado cuyo único usuario podólogo tiene `status = 0` **no** aparece en la pantalla.
- [ ] Un empleado sin ningún usuario vinculado **no** aparece en la pantalla.
- [ ] Un empleado con dos usuarios vinculados, uno con rol 3 y otro con rol 2 activo, **sí** aparece en la pantalla.
- [ ] Las tarjetas de resumen no cambian al filtrar por estado o por búsqueda.
- [ ] La pantalla aparece en el menú Nómina. Un usuario con rol 2, 3, 5 o 6 que entra a `/dashboard/nomina/faltas` es redirigido a `/dashboard`.

**Justificación**

- [ ] Subir un PDF, un JPG o un PNG de hasta 5 MB deja la fila en "Justificada", con un enlace "Ver archivo" que abre el archivo.
- [ ] Un archivo de otro formato, o de más de 5 MB, se rechaza con un mensaje en el modal y no se guarda nada.
- [ ] "Reemplazar" cambia la `url` de la fila existente, sin crear una segunda fila.
- [ ] "Marcar no aplica" sin comentario muestra un error. Con comentario, deja la fila en "No aplica" y el comentario se ve en la lista.
- [ ] "Volver a injustificada" borra la fila de `absence_justifications`, y el día vuelve a "Injustificada".
- [ ] Justificar un día que ya tiene una checada (llamando a la action directamente) devuelve `{ ok: false }`.
- [ ] Justificar un día de un empleado sin usuario podólogo activo (llamando a la action directamente) devuelve `{ ok: false }`.
- [ ] Con el periodo en estatus 3 o 4 no se muestran las acciones, y las tres actions devuelven `{ ok: false }`.

**Cálculo**

- [ ] Recalcular un periodo sin faltas deja todas sus filas de `period_employees` idénticas a las anteriores, salvo `calculated_at` y `calculated_by`.
- [ ] Un empleado sin usuario podólogo activo, sin ninguna checada en el periodo, queda con `dias_falta = 0` y sin filas en `period_employee_absences`.
- [ ] Un empleado con usuario podólogo activo, 15 días calendario y 2 faltas injustificadas queda con `dias = 13`, `dias_falta = 2` e `importe_salario = ROUND(salario × 13, 2)`, tanto en `'O'` como en `'F'`.
- [ ] Una falta justificada o marcada "no aplica" no se descuenta: no entra a `dias_falta` ni a `period_employee_absences`.
- [ ] Cada falta descontada tiene una fila en `period_employee_absences` por cada tipo en el que entra el empleado.
- [ ] "Revertir" deja el periodo sin filas en `period_employee_absences`.
- [ ] Si dos periodos de distinta frecuencia cubren el mismo día, la falta se descuenta solo en el primero que se calcula, para cada tipo.

**Procesar y Detalle**

- [ ] En Procesar, la columna "Días" muestra "2 faltas" debajo de "13 d". Sin faltas, no muestra ningún texto secundario.
- [ ] En Detalle, la línea de sueldo dice "13 días (15 − 2 faltas) × $X diarios", y el importe es el guardado.
- [ ] `PayrollAbsencesList` lista las fechas de las faltas descontadas del tipo seleccionado, y se oculta cuando no hay ninguna.
- [ ] En la pantalla Faltas, una falta descontada muestra el distintivo "Descontada en {código del periodo}".

**Aviso "Recalcula"**

- [ ] Con el periodo en estatus 2, justificar una falta ya descontada muestra en Procesar y en Faltas el aviso "Hay faltas que no coinciden con el último cálculo. Recalcula la nómina."
- [ ] Regresar a injustificada un día que no se había descontado también muestra el aviso.
- [ ] Con el periodo en estatus 2, desvincular el usuario podólogo de un empleado con faltas descontadas muestra el aviso.
- [ ] Después de "Recalcular", el aviso desaparece.
- [ ] Con el periodo en estatus 1, el aviso nunca aparece.
- [ ] Horas extra sigue mostrando su propio aviso con su texto de siempre.

**Regresión y documentación**

- [ ] Subir un documento en la pestaña Documentos del empleado sigue funcionando después de extraer `utils/documentUpload.ts`.
- [ ] `docs/nomina.md` tiene la sección "Faltas (spec 62)".

## Decisiones tomadas y descartadas

- **Sí:** una falta es un día laboral ya transcurrido sin **ninguna** checada. Una checada incompleta cuenta como asistencia: el empleado se presentó, y el problema de la checada ya aparece en Horas extra.
- **No:** contar como falta una checada incompleta. Castigaría con un día completo un fallo del checador o un olvido.
- **Sí:** la justificación vale con solo que exista el archivo, sin que nadie lo apruebe. Es lo que dice la regla ("si el sistema valida la presencia del archivo").
- **No:** un flujo de aprobación por un segundo usuario. No lo pide la regla y agrega estados.
- **Sí:** se aceptan PDF, JPG y PNG. **Se aparta de la regla original, que pide solo PDF.** Es decisión del usuario: muchos justificantes llegan como foto, y `/api/upload` ya valida esos tres formatos por sus primeros bytes.
- **Sí:** el estado "No aplica", con comentario obligatorio y sin archivo. **También se aparta de la regla**, que solo exime con un archivo. Cubre festivos, vacaciones y descansos acordados mientras no exista un catálogo, y el comentario deja constancia de quién lo marcó y por qué.
- **No:** un catálogo de festivos, vacaciones e incapacidades. Merece su propia spec; "No aplica" es el puente mientras tanto.
- **Sí:** tabla propia `payroll.absence_justifications` con `UNIQUE (id_empleado, fecha)` y sin `id_period`, igual que `overtime_authorizations`. Así la justificación sobrevive si se borra y se vuelve a crear un periodo.
- **No:** reusar `RH.empleado_documentos` con un tipo nuevo y una columna `fecha`. Mezclaría el expediente del empleado con las incidencias diarias, y no tiene un `UNIQUE` por día.
- **Sí:** la falta se descuenta restando días pagados (`dias = calendario − dias_falta`). Es como se trata una falta en nómina, y no obliga a crear todavía el concepto de deducciones.
- **No:** una deducción aparte "Faltas injustificadas". Obligaría a construir una columna de deducciones, un "Total a pagar" y una tarjeta en Detalle antes de tiempo.
- **Sí:** se aplica en operativa y en fiscal. Con la resta de días cuesta casi lo mismo, y es lo que corresponde legalmente. Rompe a propósito el criterio de "solo operativa" de las specs 56–61.
- **Sí:** el control de faltas aplica **solo a empleados con al menos un usuario vinculado con `id_role = 2` (podólogo) y `status = 1`**. Es decisión del usuario, y la regla de origen no lo dice. Basta con uno de sus usuarios, porque un empleado puede tener varios (spec 55).
- **Sí:** se filtra por `status = 1` del usuario. Esta regla decide *a quién* se le descuenta, no atribuye algo que ya pasó. Una cuenta de podólogo desactivada no debe seguir activando descuentos.
- **No:** ignorar el `status` del usuario, como hacen las comisiones de las specs 56–58. Allá se paga lo que ya se atendió o vendió; aquí se descontaría por una cuenta que ya no se usa.
- **Sí:** el rol se evalúa en el momento, sin historial. Si alguien deja de ser podólogo, el aviso "Recalcula" lo detecta en estatus 2.
- **Sí:** el rol es la constante `ABSENCE_CONTROL_ROLE_IDS = [2]` en `lib/payroll/constants.ts`, más un único fragmento SQL `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION`. Sigue el patrón de `PAYROLL_ALLOWED_ROLE_IDS`, y agregar otro rol después es cambiar una línea.
- **No:** configurar desde pantalla a qué roles o empleados aplica. Nadie lo pidió, y agregaría una tabla y una bitácora.
- **No:** mostrar en la pantalla a los empleados sin control de faltas con una nota. Sería ruido; la pantalla lista solo a quien se le puede descontar.
- **Sí:** entre los podólogos, la pantalla revisa a quien entra a **cualquiera** de las dos nóminas. Si no, a alguien que solo está en la fiscal se le descontaría sin poder justificarle nada.
- **Sí:** un desglose `period_employee_absences` con `UNIQUE (id_empleado, fecha, tipo_nomina)`. El tipo va en la llave porque el mismo día se descuenta una vez en cada nómina. El candado evita descontar dos veces si dos periodos se traslapan, y alimenta la lista del Detalle.
- **No:** un `UNIQUE (id_empleado, fecha)` sin tipo, como en la spec 61. Impediría descontar en la fiscal lo que ya se descontó en la operativa.
- **Sí:** el aviso "Recalcula" compara el conjunto de faltas que se descontaría hoy contra el desglose. Ve todos los casos, incluido "Volver a injustificada", que es un `DELETE` y no deja rastro.
- **No:** comparar `decided_at` contra `calculated_at`. No ve los borrados, por la misma razón que se descartó en la spec 61.
- **Sí:** generalizar `OvertimeRecalculationNotice` a `PayrollRecalculationNotice`, con el mensaje como prop, y extraer el cargador a `utils/documentUpload.ts`. Se reusan en lugar de duplicarse, como pide `CLAUDE.md`.
- **Sí:** el cálculo detecta las faltas en SQL, dentro del mismo batch, y el helper TS solo alimenta la pantalla. **Si difieren, manda el SQL**, como en las specs 53 a 61.
- **Sí:** "hoy" llega como string desde `addZeroToday`, y en SQL no se usa `GETDATE()`. El servidor de BD puede estar en otra zona horaria.
- **Sí:** se usa el horario actual para todo el periodo, igual que en la spec 60.
- **No:** agregar historial o vigencias de horario en esta spec. Queda anotado como riesgo.
- **No:** incluir retardos, bonos, días económicos o el reglamento precargado. Cada uno va en su propia spec. Los retardos probablemente reusen `absence_justifications`, o una tabla hermana.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| **Faltas falsas en bloque** si un checador deja de enviar checadas (sin red, apagado, SN desactivado): todos los empleados de la sucursal aparecen con falta ese día. | Se ven en la pantalla antes de calcular. Se pueden marcar "No aplica" con comentario ("Checador sin conexión"). El documento lo remarca: revisa Faltas antes de "Calcular". |
| **Cambiar el horario de un empleado cambia la detección de días pasados**, porque no hay historial de horarios. | El aviso "Recalcula" lo detecta en periodos en estatus 2. Los periodos 3 y 4 no se tocan. El historial de horarios queda para una spec aparte. |
| **Un empleado sin horario nunca genera faltas**, aunque no se presente. | Aparece en el aviso "Sin horario definido", con un enlace a su pestaña Horario. |
| **Un podólogo sin usuario vinculado** (o con su cuenta desactivada) nunca genera faltas, sin ningún aviso. | Se documenta en `docs/nomina.md`: antes de calcular, revisa en la pestaña Usuarios del empleado (spec 55) que cada podólogo tenga su cuenta vinculada y activa. |
| **Una cuenta compartida con rol 2 vinculada al empleado equivocado** le aplicaría el control de faltas a esa persona. | El mismo riesgo ya existe con las comisiones (spec 58). Revisa los vínculos usuario–empleado antes de calcular. |
| **Días festivos detectados como falta**, porque no hay catálogo. | Se marcan "No aplica". El catálogo queda para otra spec. |
| **Un turno que cruza la medianoche** deja el segundo día sin checada de entrada. Si ese día también tiene horario, podría contar como falta. | Los horarios no permiten cruzar la medianoche (spec 59), así que ese día no tendría horario asignado. Queda documentado. |
| **Cambiar el significado de `dias`** (de días calendario a días netos) podría romper a quien lo lea. | Hoy solo lo leen Procesar, Detalle y `buildPerceptionLines`, que se ajustan en esta spec. `dias_falta` vale 0 en los snapshots anteriores, así que su `dias` sigue siendo correcto. Se documenta en `docs/nomina.md`. |
| **`calculatePayrollPeriod` se vuelve más pesado**, porque encadena salario, tres comisiones, horas extra y ahora faltas. | El paso 10 exige comparar el snapshot de un periodo ya calculado antes y después del cambio. `#period_days` tiene como máximo unos 60 días (bimestral). Si el cálculo se vuelve lento, se agrega un índice en `RH.asistencias([id_empleado], [fecha_hora])` sin cambiar la lógica. |
| **Descuento no reversible**: justificar una falta ya descontada en un periodo aprobado (3) o pagado (4) no la devuelve. | Hoy los estatus 3 y 4 no son alcanzables. Quien los construya debe bloquear las justificaciones de días descontados en esos periodos, igual que lo que la spec 61 pide para las horas extra. |
| **Archivos huérfanos en Cloudinary** al reemplazar un justificante o volver a injustificada. | Se acepta, igual que en Documentos. La limpieza queda fuera del alcance. |

## Lo que **no** incluye esta spec

- Retardos (sección 3.2 de `references/docs/faltas.md`).
- Bono de asistencia y bono de puntualidad.
- Catálogo de festivos, vacaciones, incapacidades y días económicos.
- Reglamento interno precargado.
- Aprobación del justificante por un segundo usuario.
- Control de faltas para roles distintos al podólogo, o configurable desde pantalla.
- Historial o vigencias de horario.
- Justificación masiva o captura manual de faltas no detectadas.
- Descuento retroactivo en periodos aprobados o pagados.
- Borrar archivos de Cloudinary.
- Mostrar las faltas en la pestaña Asistencia del empleado.
- Deducciones como concepto propio (IMSS, ISR, "Total a pagar").

Cada uno de estos puntos, si llega a hacerse, va en su propia spec.
