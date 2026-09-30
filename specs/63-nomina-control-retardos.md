# 63 — Nómina: control de retardos

## Header

- **Estado:** Implementado
- **Depende de:**
  - [59 — Empleados: horario semanal estructurado](59-empleado-horario-semanal.md): `RH.empleado_horarios.hora_entrada_1` es la hora contra la que se mide el retardo. Un día sin fila es descanso y no se evalúa.
  - [39 — Empleados: historial de asistencias](39-empleado-historial-asistencias.md): `RH.asistencias`. La primera checada `entrada` del día es la hora de llegada.
  - [51 — Empleado: periodo de pago](51-periodo-pago-empleado.md) y [52 — Nómina: periodos](52-nomina-periodos.md): la frecuencia del periodo (`id_payment_period`) decide qué escalones de acumulación se aplican.
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md) y [54 — Detalle de percepciones](54-nomina-detalle-percepciones-empleado.md): `calculatePayrollPeriod`, el snapshot `payroll.period_employees`, `buildPerceptionLines` y la pantalla de Detalle.
  - [55 — Empleados: vincular usuarios](55-empleado-vincular-usuarios.md): `users.id_empleado`.
  - [60](60-nomina-horas-extra-deteccion-autorizacion.md) y [61](61-nomina-horas-extra-pago.md): el patrón de configuración por empresa con bitácora (`overtime_settings` / `overtime_settings_log`) y el criterio de "primera `entrada` del día".
  - [62 — Nómina: control de faltas](62-nomina-control-faltas.md): el patrón que se replica casi completo. Se reusan `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION` (solo `id_role = 2` activo), el esquema de justificante `'J'` / `'N'`, `utils/documentUpload.ts`, los modales, el desglose con candado por `tipo_nomina` y el aviso `PayrollRecalculationNotice`. De esta spec también se toma `dias`, que ya son días netos después de las faltas.
- **Modifica base de datos:** Sí.
  - Tabla nueva `payroll.lateness_settings`: tolerancia, umbral del retardo grave y su descuento, con una fila por empresa.
  - Tabla nueva `payroll.lateness_tiers`: escalones de acumulación por empresa y frecuencia.
  - Tabla nueva `payroll.lateness_settings_log`: bitácora de cambios a la configuración y a los escalones.
  - Tabla nueva `payroll.lateness_justifications`: justificante o "no aplica" por empleado y día.
  - Tabla nueva `payroll.period_employee_lateness`: desglose de los retardos descontados por periodo, empleado y tipo de nómina.
  - Columnas nuevas `dias_retardo decimal(4,1)` y `dias_retardo_sin_tope decimal(5,1)` en `payroll.period_employees`.
- **Fecha:** 2026-09-29
- **Objetivo:** Para los empleados vinculados a un usuario podólogo (`id_role = 2`), detectar los retardos contra `hora_entrada_1`, permitir justificarlos o marcarlos "no aplica" en la pantalla nueva "Retardos", y descontar del sueldo base, en ambas nóminas, medio día por cada retardo grave más los días que marquen los escalones configurables de acumulación por frecuencia.
- **Reglas de origen:** `references/docs/faltas.md` (sección 3.2).

## Alcance

**Incluye:**

- **Base de datos** (DDL documentado en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 62):
  - `payroll.lateness_settings`: una fila por empresa con `tolerancia_minutos` (semilla 10), `minutos_retardo_grave` (semilla 30) y `dias_descuento_retardo_grave` (semilla 0.5).
  - `payroll.lateness_tiers`: escalones por empresa y frecuencia (`id_payment_period`, `retardos`, `dias_descuento`). Semillas: semanal (SAT `02`) {1 → 0.5, 2 → 1} y quincenal (SAT `04`) {2 → 0.5, 4 → 1}.
  - `payroll.lateness_settings_log`: bitácora de cambios a la configuración y a los escalones. Un guardado sin cambios no escribe nada.
  - `payroll.lateness_justifications`: igual que `absence_justifications`, con `UNIQUE (id_empleado, fecha)`, sin `id_period`, `'J'` con archivo o `'N'` con comentario. **Sin fila, el retardo es injustificado.**
  - `payroll.period_employee_lateness`: una fila por retardo descontado, con `minutos_retardo` y `clasificacion` (`'G'` grave / `'A'` acumulable) congelados, `UNIQUE (id_empleado, fecha, tipo_nomina)` y `ON DELETE CASCADE` a `period_employees`.
  - `payroll.period_employees` gana `dias_retardo decimal(4,1)` y `dias_retardo_sin_tope decimal(5,1)` (`NOT NULL DEFAULT 0`).
- **Quién se revisa.** Las mismas reglas de Faltas: `ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS` + `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION` (al menos un usuario vinculado con `id_role = 2` y `status = 1`, evaluado en el momento). No se crea una constante nueva: los retardos y las faltas aplican a la misma población.
- **Detección de retardos.** Un día es retardo si cumple todas estas condiciones:
  - tiene fila en `RH.empleado_horarios` para su día de la semana ISO;
  - está entre `max(fecha_inicio, fecha_ingreso)` y `min(fecha_fin, hoy)`, **hoy incluido**;
  - tiene al menos una checada con `tipo` `entrada`, y la **primera** es la hora de llegada;
  - `minutos_retardo = floor((llegada − hora_entrada_1) / 60 s)`, truncando segundos, es `>= tolerancia_minutos`.

  Otros criterios:
  - Solo se compara `hora_entrada_1`. El regreso del segundo bloque no se evalúa.
  - Un día sin ninguna `entrada` (solo `salida`) no se evalúa. Un día sin checadas es asunto de Faltas.
  - Se usa el horario **actual** para todo el periodo, igual que en las specs 60 y 62.
  - Un empleado sin horario no genera retardos y aparece en el aviso "Sin horario definido".
- **Clasificación.** `minutos_retardo >= minutos_retardo_grave` → **Grave**. Si no → **Acumulable**. Son excluyentes: un grave no suma a la acumulación.
- **Descuento por empleado y tipo de nómina** (solo retardos injustificados que ningún otro periodo ya descontó para ese `tipo_nomina`):
  - Graves: `G × dias_descuento_retardo_grave`.
  - Acumulables, con los escalones de la frecuencia del periodo, en ciclo: `ciclo` = el `retardos` más alto; `floor(A / ciclo) × dias_descuento del escalón más alto` + `dias_descuento del escalón más alto con retardos <= A mod ciclo` (0 si ninguno).
  - `dias_retardo = min(graves + acumulables, dias)`, donde `dias` son los días netos después de faltas. El sueldo nunca queda negativo.
  - `importe_salario = ROUND(salario × (dias − dias_retardo), 2)`. Aplica a `'O'` y a `'F'`.
  - Una empresa sin fila en `lateness_settings` no descuenta nada, sin default silencioso (igual que horas extra). Una frecuencia sin escalones solo descuenta los graves, y la pantalla muestra el aviso "Sin escalones para {frecuencia}".
- **Helper espejo puro** `lib/payroll/latenessDetection.ts`: detección, clasificación y cálculo del ciclo, sin BD y sin `Date` sobre strings crudos. Alimenta la pantalla. **En el cálculo manda el SQL.**
- **Pantalla nueva `/dashboard/nomina/retardos`**:
  - `page.tsx` es un Server Component. El estado vive en la URL: `periodo`, `estado=injustificado|justificado|no_aplica`, `tipo=grave|acumulable`, `q` y `pagina`, con 25 filas por página.
  - Tarjetas de resumen del periodo completo: graves injustificados, acumulables injustificados, justificados y no aplica. No cambian con los filtros.
  - Resumen por empleado: graves, acumulables y días estimados a descontar (antes del tope). Tampoco cambia con los filtros.
  - Tabla con: empleado, fecha y día de la semana, hora programada, primera entrada, minutos tarde, clasificación, estado, archivo o comentario, y el distintivo "Descontado en {código del periodo}".
  - Las mismas tres acciones de Faltas: subir o reemplazar justificante (PDF, JPG o PNG, 5 MB, carpeta `clinica/empleados/retardos`), marcar no aplica con comentario obligatorio, y volver a injustificado.
  - Tarjeta de configuración con modal (tolerancia, umbral grave, descuento grave y escalones por frecuencia) y la bitácora en un `<details>`, como `OvertimeSettingsCard`.
  - Se puede editar con el periodo en estatus 1 o 2. En estatus 3 o 4 queda de solo lectura y las acciones devuelven `{ ok: false }`. La configuración es por empresa y se puede editar siempre.
  - Se agrega "Retardos" a la sección Nómina de `NAV_LINKS`, después de "Faltas". `proxy.ts` ya protege `/dashboard/nomina`.
- **Reuso de componentes.** Los modales de Faltas (`AbsenceModalFrame`, `AbsenceJustificationModal`, `AbsenceNotApplicableModal`, `ClearAbsenceJustificationButton`) se generalizan y se mueven a `nomina/componentes/`. Reciben por props la action, la carpeta de subida y los textos. Faltas y Retardos los usan.
- **Server actions** en `nomina/retardos/actions.ts`: `getLatenessPage`, `getLatenessSettingsLog`, `updateLatenessSettings`, `justifyLateness`, `markLatenessNotApplicable` y `clearLatenessJustification`.
  - Todas pasan por `assertPayrollAccess()`, toman la sucursal y la empresa de la sesión, y validan con `zod` (en `lib/payroll/schemas.ts`).
  - Justificar y "no aplica" vuelven a validar dentro de la transacción: sucursal y estatus del periodo, rango, empleado elegible y controlado, `fecha >= fecha_ingreso`, `fecha <= hoy`, que el día tenga horario y que sea retardo hoy. `clear` omite las validaciones del día.
  - `updateLatenessSettings` valida: `tolerancia_minutos` entero > 0, `minutos_retardo_grave > tolerancia_minutos` y `dias_descuento_retardo_grave` múltiplo de 0.5 entre 0.5 y 1. En los escalones: `retardos` entero > 0 y sin repetir por frecuencia, `dias_descuento` múltiplo de 0.5 y > 0, y no decreciente cuando `retardos` crece.
- **Cálculo** dentro del batch de `calculatePayrollPeriod`, después de `#absences`: se arma `#lateness`, un `OUTER APPLY` llena `dias_retardo`, `dias_retardo_sin_tope` e `importe_salario` en `'O'` y en `'F'`, y se inserta el desglose. `describePayrollCalculationError` agrega el mensaje del choque del `UNIQUE`: "Otro cálculo tomó algunos de estos retardos al mismo tiempo. Intenta de nuevo."
- **Aviso "Recalcula"** (`lib/payroll/latenessRecalculation.ts`, server-only, solo para estatus 2). Se muestra en Procesar y en Retardos con `PayrollRecalculationNotice` y el texto "Hay retardos que no coinciden con el último cálculo. Recalcula la nómina." cuando pasa cualquiera de estas cosas:
  - el conjunto de retardos que se descontaría hoy, con su clasificación, es distinto del desglose;
  - `lateness_settings.updated_at` es posterior al `calculated_at` del periodo (se cambió la configuración o los escalones).
- **Procesar:** la columna "Días" muestra como texto secundario "R retardo" cuando `dias_retardo > 0`, junto a "F faltas".
- **Detalle:**
  - La línea `sueldo_base` dice "11.5 días (15 − 2 faltas − 1.5 por retardos) × $X diarios". Si se aplicó el tope, agrega "(tope aplicado)".
  - `PayrollLatenessList` (Server Component) lista los retardos descontados del tipo seleccionado: fecha, entrada, minutos y clasificación. Se oculta si no hay ninguno.
- **Documentación:** sección "Retardos (spec 63)" en `docs/nomina.md`, y actualizar el párrafo inicial del módulo.

**No incluye:**

- **Regreso del segundo bloque** (`hora_entrada_2`) y **salidas anticipadas**.
- **Bono de puntualidad** y bono de asistencia.
- **Retardos en días de descanso** (sin fila de horario) y días con checada pero sin `entrada`.
- **Configuración por sucursal o por empleado.** Es por empresa.
- **Control de retardos para otros roles.** Se reusa la población de Faltas (`id_role = 2`).
- **Aprobación del justificante** por un segundo usuario, y justificación masiva.
- **Historial de horarios** o vigencias. Se usa el horario actual.
- **Descuento retroactivo** en periodos aprobados (3) o pagados (4).
- **Borrar archivos** de Cloudinary.
- **Mostrar los retardos en la pestaña Asistencia** del empleado.
- **Catálogo de festivos** y reglamento interno precargado.
- **Deducciones como concepto propio** (IMSS, ISR, "Total a pagar").

## Modelo de datos

**Cambios en BD.** El DDL va en `queries.txt`, bloque `NOMINA PAYROLL`, después de las tablas de la spec 62.

```sql
-- Spec 63: configuración de retardos por empresa. Sin fila = no se descuenta ningún retardo.
CREATE TABLE [payroll].[lateness_settings](
    [id_empresa]                   [int]          NOT NULL,
    [tolerancia_minutos]           [smallint]     NOT NULL,   -- minutos tarde a partir de los cuales hay retardo
    [minutos_retardo_grave]        [smallint]     NOT NULL,   -- a partir de aquí el retardo es grave
    [dias_descuento_retardo_grave] [decimal](2,1) NOT NULL,   -- días que descuenta cada grave
    [updated_by]                   [int]          NOT NULL,
    [updated_at]                   [datetime2](0) NOT NULL,   -- también cambia al editar solo los escalones
 CONSTRAINT [PK_lateness_settings] PRIMARY KEY CLUSTERED ([id_empresa] ASC),
 CONSTRAINT [CK_lateness_settings_valores] CHECK (
     [tolerancia_minutos] > 0
     AND [minutos_retardo_grave] > [tolerancia_minutos]
     AND [dias_descuento_retardo_grave] IN (0.5, 1.0))
) ON [PRIMARY]
GO

INSERT INTO [payroll].[lateness_settings]
    ([id_empresa],[tolerancia_minutos],[minutos_retardo_grave],[dias_descuento_retardo_grave],[updated_by],[updated_at])
VALUES (1, 10, 30, 0.5, 1, '2026-09-29 00:00:00')
GO

-- Spec 63: escalones de acumulación por empresa y frecuencia. Se aplican en ciclo:
-- ciclo = MAX(retardos); descuento = floor(A / ciclo) × días del escalón más alto
--                                  + días del escalón más alto con retardos <= A mod ciclo.
CREATE TABLE [payroll].[lateness_tiers](
    [id_lateness_tier]  [int] IDENTITY(1,1) NOT NULL,
    [id_empresa]        [int]          NOT NULL,
    [id_payment_period] [smallint]     NOT NULL,
    [retardos]          [smallint]     NOT NULL,
    [dias_descuento]    [decimal](3,1) NOT NULL,
 CONSTRAINT [PK_lateness_tiers] PRIMARY KEY CLUSTERED ([id_lateness_tier] ASC),
 CONSTRAINT [UQ_lateness_tiers_empresa_frecuencia_retardos] UNIQUE ([id_empresa], [id_payment_period], [retardos]),
 CONSTRAINT [FK_lateness_tiers_settings] FOREIGN KEY ([id_empresa])
     REFERENCES [payroll].[lateness_settings] ([id_empresa]),
 CONSTRAINT [FK_lateness_tiers_payment_period] FOREIGN KEY ([id_payment_period])
     REFERENCES [RH].[payment_periods] ([id_payment_period]),
 CONSTRAINT [CK_lateness_tiers_valores] CHECK (
     [retardos] > 0 AND [dias_descuento] > 0
     AND [dias_descuento] * 2 = FLOOR([dias_descuento] * 2))
     -- "no decreciente" se valida en zod y en la action: un CHECK no ve otras filas
) ON [PRIMARY]
GO

-- Semillas: semanal (SAT 02) {1 → 0.5, 2 → 1}; quincenal (SAT 04) {2 → 0.5, 4 → 1}.
INSERT INTO [payroll].[lateness_tiers] ([id_empresa],[id_payment_period],[retardos],[dias_descuento])
SELECT 1, pp.[id_payment_period], v.[retardos], v.[dias_descuento]
FROM [RH].[payment_periods] pp
JOIN (VALUES ('02', 1, 0.5), ('02', 2, 1.0), ('04', 2, 0.5), ('04', 4, 1.0))
     v([clave_sat], [retardos], [dias_descuento]) ON v.[clave_sat] = pp.[clave_sat]
GO

-- Spec 63: bitácora. Los escalones van como JSON porque su número varía:
-- [{"id_payment_period":2,"retardos":1,"dias_descuento":0.5}, ...]
CREATE TABLE [payroll].[lateness_settings_log](
    [id_log]                                [int] IDENTITY(1,1) NOT NULL,
    [id_empresa]                            [int]           NOT NULL,
    [tolerancia_minutos_anterior]           [smallint]      NULL,   -- NULL: no había configuración
    [tolerancia_minutos_nuevo]              [smallint]      NOT NULL,
    [minutos_retardo_grave_anterior]        [smallint]      NULL,
    [minutos_retardo_grave_nuevo]           [smallint]      NOT NULL,
    [dias_descuento_retardo_grave_anterior] [decimal](2,1)  NULL,
    [dias_descuento_retardo_grave_nuevo]    [decimal](2,1)  NOT NULL,
    [escalones_anteriores]                  [nvarchar](max) NULL,
    [escalones_nuevos]                      [nvarchar](max) NOT NULL,
    [updated_by]                            [int]           NOT NULL,
    [updated_at]                            [datetime2](0)  NOT NULL,
 CONSTRAINT [PK_lateness_settings_log] PRIMARY KEY CLUSTERED ([id_log] ASC),
 CONSTRAINT [CK_lateness_settings_log_json] CHECK (
     ISJSON([escalones_nuevos]) = 1
     AND ([escalones_anteriores] IS NULL OR ISJSON([escalones_anteriores]) = 1))
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_lateness_settings_log_empresa]
    ON [payroll].[lateness_settings_log] ([id_empresa], [updated_at] DESC)
GO

-- Spec 63: justificación de un retardo por empleado y día. Sin fila = retardo injustificado.
-- Misma forma que absence_justifications. Sin id_period.
CREATE TABLE [payroll].[lateness_justifications](
    [id_lateness_justification] [int] IDENTITY(1,1) NOT NULL,
    [id_empleado]  [int]            NOT NULL,
    [fecha]        [date]           NOT NULL,
    [estado]       [char](1)        NOT NULL,   -- 'J' justificado con archivo | 'N' no aplica
    [url]          [varchar](500)   NULL,
    [mime_type]    [varchar](100)   NULL,
    [size_bytes]   [int]            NULL,
    [comentario]   [nvarchar](500)  NULL,       -- obligatorio con 'N', opcional con 'J'
    [decided_by]   [int]            NOT NULL,
    [decided_at]   [datetime2](0)   NOT NULL,   -- buildDate(new Date())
 CONSTRAINT [PK_lateness_justifications] PRIMARY KEY CLUSTERED ([id_lateness_justification] ASC),
 CONSTRAINT [UQ_lateness_justifications_empleado_fecha] UNIQUE ([id_empleado], [fecha]),
 CONSTRAINT [FK_lateness_justifications_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado]),
 CONSTRAINT [CK_lateness_justifications_estado] CHECK (
     ([estado] = 'J' AND [url] IS NOT NULL AND [mime_type] IS NOT NULL
          AND [mime_type] IN ('application/pdf', 'image/jpeg', 'image/png')
          AND [size_bytes] IS NOT NULL AND [size_bytes] > 0 AND [size_bytes] <= 5242880)
  OR ([estado] = 'N' AND [url] IS NULL AND [mime_type] IS NULL AND [size_bytes] IS NULL
          AND [comentario] IS NOT NULL AND LEN([comentario]) > 0))
) ON [PRIMARY]
GO

-- Spec 63: días descontados por retardos. importe_salario = ROUND(salario × (dias − dias_retardo), 2).
ALTER TABLE [payroll].[period_employees] ADD
    [dias_retardo]          [decimal](4,1) NOT NULL CONSTRAINT [DF_period_employees_dias_retardo] DEFAULT (0),
    [dias_retardo_sin_tope] [decimal](5,1) NOT NULL CONSTRAINT [DF_period_employees_dias_retardo_sin_tope] DEFAULT (0)
GO
ALTER TABLE [payroll].[period_employees] WITH CHECK
    ADD CONSTRAINT [CK_period_employees_dias_retardo] CHECK (
        [dias_retardo] >= 0 AND [dias_retardo] <= [dias]
        AND [dias_retardo] * 2 = FLOOR([dias_retardo] * 2)
        AND [dias_retardo_sin_tope] >= [dias_retardo])
GO

-- Spec 63: retardos descontados por renglón de nómina. Mismo candado que period_employee_absences.
-- Sin FK a lateness_justifications: justificar un día ya descontado no debe chocar.
CREATE TABLE [payroll].[period_employee_lateness](
    [id_period_employee_lateness] [int] IDENTITY(1,1) NOT NULL,
    [id_period_employee]  [int]      NOT NULL,
    [id_empleado]         [int]      NOT NULL,   -- redundante, necesario para el UNIQUE
    [tipo_nomina]         [char](1)  NOT NULL,   -- redundante, necesario para el UNIQUE
    [fecha]               [date]     NOT NULL,
    [hora_entrada_1]      [time](0)  NOT NULL,   -- horario congelado al calcular
    [hora_llegada]        [time](0)  NOT NULL,   -- primera checada 'entrada'
    [minutos_retardo]     [smallint] NOT NULL,
    [clasificacion]       [char](1)  NOT NULL,   -- 'G' grave | 'A' acumulable
 CONSTRAINT [PK_period_employee_lateness] PRIMARY KEY CLUSTERED ([id_period_employee_lateness] ASC),
 CONSTRAINT [UQ_period_employee_lateness_empleado_fecha_tipo] UNIQUE ([id_empleado], [fecha], [tipo_nomina]),
 CONSTRAINT [FK_period_employee_lateness_period_employee] FOREIGN KEY ([id_period_employee])
     REFERENCES [payroll].[period_employees] ([id_period_employee]) ON DELETE CASCADE,
 CONSTRAINT [CK_period_employee_lateness_valores] CHECK (
     [tipo_nomina] IN ('O', 'F') AND [clasificacion] IN ('G', 'A') AND [minutos_retardo] > 0)
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_period_employee_lateness_period_employee]
    ON [payroll].[period_employee_lateness] ([id_period_employee])
GO
```

**Tipos** (archivo nuevo `interfaces/payroll_lateness.ts`):

```ts
/** Sin fila en lateness_justifications = "unjustified". */
export type LatenessStatus = "unjustified" | "justified" | "not_applicable";
export type LatenessClassification = "severe" | "accumulable";   // 'G' | 'A' en BD

export interface ILatenessTier {
  id_payment_period: number;
  retardos:          number;
  dias_descuento:    number;   // múltiplo de 0.5
}

export interface ILatenessSettings {
  id_empresa:                   number;
  tolerancia_minutos:           number;
  minutos_retardo_grave:        number;
  dias_descuento_retardo_grave: number;
  tiers:                        ILatenessTier[];
  updated_by_name:              string;
  updated_at:                   string;   // "YYYY-MM-DD HH:mm:ss"
}

export interface ILatenessSettingsLogEntry { /* anterior/nuevo de cada campo + escalones parseados */ }

/** Resultado del helper puro para un empleado y un día con retardo. */
export interface ILatenessDetection {
  fecha:          string;                  // "YYYY-MM-DD"
  hora_entrada_1: string;                  // "HH:mm"
  hora_llegada:   string;                  // "HH:mm:ss"
  minutos:        number;                  // truncado
  classification: LatenessClassification;
}

export interface ILatenessDayRow extends ILatenessDetection {
  id_empleado:             number;
  codigo_empleado:         string;
  nombre_completo:         string;
  status:                  LatenessStatus;
  url:                     string | null;
  mime_type:               string | null;
  comentario:              string | null;
  decided_by_name:         string | null;
  decided_at:              string | null;
  discountedInPeriodCodes: string[];
}

export interface ILatenessEmployeeSummary {
  id_empleado:       number;
  nombre_completo:   string;
  severeCount:       number;   // injustificados, no descontados por otro periodo
  accumulableCount:  number;
  estimatedDays:     number;   // antes del tope
}

export interface ILatenessFilters {
  idPeriod:       number | null;
  status:         "all" | LatenessStatus;
  classification: "all" | LatenessClassification;
  search:         string;
  page:           number;
}

export interface ILatenessPage {
  period:                   IPayrollPeriod | null;
  periodOptions:            Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  canDecide:                boolean;
  settings:                 ILatenessSettings | null;       // null: la empresa no tiene configuración
  periodHasTiers:           boolean;                         // false → aviso "Sin escalones para {frecuencia}"
  rows:                     ILatenessDayRow[];
  totalRows:                number;
  summary: { severeUnjustified: number; accumulableUnjustified: number; justified: number; notApplicable: number };
  employeeSummaries:        ILatenessEmployeeSummary[];
  employeesWithoutSchedule: { id_empleado: number; nombre_completo: string }[];
  recalculationNeeded:      boolean;
}

/** Retardo descontado, para la lista del Detalle. */
export interface IPayrollDiscountedLateness {
  fecha:           string;
  hora_entrada_1:  string;
  hora_llegada:    string;
  minutos_retardo: number;
  classification:  LatenessClassification;
}
```

**Cambios en tipos existentes** (`interfaces/payroll_calculation.ts`):

- `IPayrollEmployeeRow` y `IPayrollEmployeeSnapshot` ganan `dias_retardo: number` y `dias_retardo_sin_tope: number`.
- `IPayrollEmployeeDetail` gana `discountedLateness: IPayrollDiscountedLateness[]`. Viene vacío cuando no hay retardos.

**Convenciones:**

- **`dias` no cambia de significado.** Siguen siendo los días netos después de faltas (entero). El sueldo es `ROUND(salario × (dias − dias_retardo), 2)`. Los snapshots anteriores tienen `dias_retardo = 0`, así que su importe sigue siendo correcto.
- **Tope.** `dias_retardo = min(dias_retardo_sin_tope, dias)`. El Detalle muestra "(tope aplicado)" cuando `dias_retardo_sin_tope > dias_retardo`.
- **Minutos tarde en SQL.** `DATEDIFF(second, hora_entrada_1, CAST(llegada AS time)) / 60` (división entera: trunca). En TS se restan segundos enteros desde `"HH:mm:ss"`.
- **Primera entrada.** `MIN(fecha_hora)` de `RH.asistencias` con `tipo` de entrada, por empleado y fecha (el mismo valor de `tipo` que usa `overtimeDetection`).
- **Ciclo.** Los escalones de la frecuencia se ordenan por `retardos`. `ciclo = MAX(retardos)`. Con `A` acumulables: `floor(A / ciclo) × dias_descuento(ciclo) + dias_descuento(del escalón más alto con retardos <= A mod ciclo, o 0)`.
- **"Hoy"** llega como string desde `addZeroToday(new Date())`, y en SQL nunca se usa `GETDATE()`. Todas las fechas y horas son strings. Los SELECT usan `CONVERT(varchar(10|19), ..., 120)` y `CONVERT(varchar(8), [time], 108)`.
- **`lateness_settings.updated_at`** se actualiza en cualquier guardado con cambios, aunque solo cambien los escalones. El aviso "Recalcula" depende de esto.

## Plan de implementación

1. **BD.** Correr el DDL del Modelo de datos, con las semillas, y documentarlo en `queries.txt`, bloque `NOMINA PAYROLL`. No cambia nada de código: `dias_retardo` vale 0 por defecto y la app sigue igual. Verificación: `SELECT` de `lateness_tiers` regresa 4 filas (2 semanales y 2 quincenales).
2. **Tipos.** Crear `interfaces/payroll_lateness.ts`. Agregar `dias_retardo` y `dias_retardo_sin_tope` a `IPayrollEmployeeRow` e `IPayrollEmployeeSnapshot`, y `discountedLateness` a `IPayrollEmployeeDetail`. Leer las dos columnas en los SELECT de `getPayrollProcessPage` y `getPayrollEmployeeDetail`; `discountedLateness` devuelve `[]` por ahora. Verificación: la app compila y Procesar se ve igual.
3. **Helper puro** `lib/payroll/latenessDetection.ts`, sin BD y sin `Date` sobre strings crudos:
   - `detectEmployeeLateness(schedules, firstEntryByDate, rangeStart, rangeEndInclusive, settings)`, con `rangeEndInclusive = min(fecha_fin, hoy)`;
   - `classifyLateness(minutos, settings)`;
   - `calculateLatenessDiscountDays(severeCount, accumulableCount, severeDays, tiers)`, con el ciclo, sin tope.

   Verificación manual: con escalones {1 → 0.5, 2 → 1}, 3 acumulables dan 1.5; con {2 → 0.5, 4 → 1}, 5 acumulables dan 1 y 6 dan 1.5; una llegada a las 08:09:59 con entrada a las 08:00 y tolerancia 10 no es retardo; a las 08:31 con umbral 30 es grave.
4. **Modales compartidos.** Mover y generalizar `AbsenceModalFrame`, `AbsenceJustificationModal`, `AbsenceNotApplicableModal` y `ClearAbsenceJustificationButton` a `nomina/componentes/` (`JustificationModalFrame`, `JustificationUploadModal`, `NotApplicableModal`, `ClearJustificationButton`). Reciben por props la action, `uploadFolder`, el identificador del día y los textos. Faltas pasa a usarlos. Verificación: justificar, marcar "no aplica" y volver a injustificada en Faltas funcionan igual que antes.
5. **Lectura.**
   - Agregar `LATENESS_PAGE_SIZE = 25` a `lib/payroll/constants.ts`.
   - Agregar a `lib/payroll/schemas.ts` los schemas `zod` de filtros, configuración y escrituras. En el justificante, `url` empieza con `https://res.cloudinary.com/`.
   - Crear `nomina/retardos/actions.ts` con `getLatenessPage` y `getLatenessSettingsLog`. `getLatenessPage` hace estos SELECT: configuración y escalones de la empresa, empleados elegibles y controlados (`ABSENCE_CONTROLLED_EMPLOYEE_CONDITION`), horarios, primera entrada por empleado y fecha, justificaciones y días ya descontados con el código del periodo. Después detecta con el helper, arma el resumen por empleado, filtra y pagina. `recalculationNeeded` queda en `false` por ahora.
6. **Página de solo lectura** `/dashboard/nomina/retardos`:
   - `page.tsx`, un Server Component que usa `resolvePeriod`;
   - `LatenessToolbar`, cliente, un wrapper de `PayrollPeriodFilterToolbar` con el filtro extra `tipo`;
   - `LatenessSummaryCards`, `LatenessEmployeeSummaryTable` y `LatenessDaysTable`, Server Components;
   - `LatenessSettingsCard` y `LatenessSettingsLog`, Server Components, todavía sin botón de editar;
   - los avisos "Sin horario definido", "Sin escalones para {frecuencia}" y "Sin configuración de retardos";
   - la entrada "Retardos" en `NAV_LINKS`, después de "Faltas".

   Verificación: la lista coincide con las llegadas tardías de los podólogos según su `hora_entrada_1`.
7. **Editar la configuración.** Crear `updateLatenessSettings`: una transacción que lee la fila con `UPDLOCK, HOLDLOCK`, valida (incluido "no decreciente" por frecuencia), reemplaza los escalones de la empresa, actualiza `lateness_settings.updated_at` con `buildDate(new Date())` y escribe una fila en `lateness_settings_log`. Si no hay cambios, no escribe nada. Crear `LatenessSettingsModal`, cliente, con portal: los tres campos y un editor de escalones por frecuencia activa (agregar y quitar filas). Verificación: cambiar la tolerancia a 15 hace que desaparezcan de la lista los retardos de 10 a 14 minutos, y la bitácora muestra el cambio.
8. **Escrituras** en `nomina/retardos/actions.ts`: `justifyLateness`, `markLatenessNotApplicable` y `clearLatenessJustification`.
   - Cada una corre en una transacción con `UPDLOCK, HOLDLOCK` sobre el periodo.
   - Justificar y "no aplica" revalidan: sucursal, estatus 1 o 2, rango, elegibilidad, `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION`, `fecha >= fecha_ingreso`, `fecha <= hoy`, horario del día y que la primera entrada esté al menos `tolerancia_minutos` tarde.
   - `clear` solo valida sucursal, estatus y rango.
   - Hacen upsert de la fila, o `DELETE` en el caso de clear. `decided_at` sale de `buildDate(new Date())`.
9. **Acciones en la tabla.** Conectar los modales compartidos del paso 4 en `LatenessDaysTable`, con `uploadFolder = "clinica/empleados/retardos"`. En estatus 3 o 4 no se muestran las acciones. Verificación: justificar, marcar "no aplica" y volver a injustificado actualizan la fila, las tarjetas y el resumen por empleado.
10. **Cálculo.** En el batch de `calculatePayrollPeriod`, después de `#absences`:
    - Armar `#lateness` con los retardos de los empleados controlados: primera entrada, minutos y clasificación con la configuración de la empresa del periodo. Se excluyen los días con justificación y los que ya descontó otro periodo para ese tipo.
    - En el `INSERT`, un `OUTER APPLY` cuenta graves y acumulables por empleado y tipo. Calcula `dias_retardo_sin_tope` con el ciclo de los escalones de la frecuencia del periodo, y llena `dias_retardo = min(dias_retardo_sin_tope, dias)` e `importe_salario = ROUND(salario × (dias − dias_retardo), 2)`, en `'O'` y en `'F'`.
    - Si la empresa no tiene configuración, todo queda en 0.
    - Se inserta `period_employee_lateness` desde `#lateness`, unido a las filas recién creadas.
    - Se agrega el mensaje del `UNIQUE` a `describePayrollCalculationError`.
    - Verificación: comparar el snapshot de un periodo ya calculado sin retardos antes y después de este paso. Debe quedar idéntico, salvo `calculated_at` y `calculated_by`.
11. **Detalle y Procesar.**
    - `getPayrollEmployeeDetail` llena `discountedLateness`.
    - `buildPerceptionLines` cambia la descripción de `sueldo_base` a "N días (calendario − F faltas − R por retardos) × $X diarios", agregando "(tope aplicado)" cuando corresponde. El importe mostrado es siempre el guardado.
    - Se crea `PayrollLatenessList` (Server Component) en `procesar/[id_empleado]/componentes/`.
    - `PayrollEmployeesTable` muestra "R retardo" debajo de los días.
12. **Aviso "Recalcula."** Crear `lib/payroll/latenessRecalculation.ts` con `isLatenessRecalculationNeeded(idPeriod)`, server-only y solo para estatus 2. Es un `SELECT` con `EXISTS` que busca:
    - por empleado y tipo del snapshot, un retardo que se descontaría hoy y que ningún periodo descontó para ese tipo;
    - un retardo del desglose que ya no se descontaría, o cuya clasificación cambió;
    - `lateness_settings.updated_at > MIN(calculated_at)` del periodo.

    Se muestra con `PayrollRecalculationNotice` en Procesar y en Retardos, con el texto "Hay retardos que no coinciden con el último cálculo. Recalcula la nómina."
13. **Documentación.** Agregar la sección "Retardos (spec 63)" a `docs/nomina.md` y actualizar el párrafo inicial (conceptos calculados, tablas y pantallas) y la sección UI (los modales que ahora viven en `nomina/componentes/`).

## Criterios de aceptación

**Base de datos**

- [x] Las tablas `payroll.lateness_settings`, `lateness_tiers`, `lateness_settings_log`, `lateness_justifications` y `period_employee_lateness` existen, y `payroll.period_employees` tiene `dias_retardo` y `dias_retardo_sin_tope`. Su DDL está en `queries.txt`, bloque `NOMINA PAYROLL`.
- [x] Las semillas dejan la empresa 1 con tolerancia 10, grave 30, descuento grave 0.5, y los escalones semanal {1 → 0.5, 2 → 1} y quincenal {2 → 0.5, 4 → 1}.
- [x] Insertar a mano una fila `'J'` sin `url`, o una fila `'N'` sin `comentario`, en `lateness_justifications` falla por `CK_lateness_justifications_estado`.
- [x] Insertar dos veces el mismo `(id_empleado, fecha, tipo_nomina)` en `period_employee_lateness` falla por el `UNIQUE`.

**Detección (pantalla Retardos)**

- [x] Un podólogo con `hora_entrada_1 = 08:00` y primera entrada a las 08:12 aparece con 12 minutos, clasificación "Acumulable" y estado "Injustificado".
- [x] Una primera entrada a las 08:09:59 **no** aparece (9 minutos, por debajo de la tolerancia de 10).
- [x] Una primera entrada a las 08:30 aparece como "Grave". A las 08:29 aparece como "Acumulable".
- [x] Llegar tarde al regreso del segundo bloque (`hora_entrada_2`) **no** genera retardo.
- [x] Un día con checadas pero sin ninguna `entrada` **no** aparece.
- [x] Un día de descanso (sin fila de horario) **no** aparece, aunque la entrada sea tarde.
- [x] Un retardo de hoy aparece en cuanto existe la checada de entrada. Los días futuros no aparecen.
- [x] Los días anteriores a `fecha_ingreso` no aparecen.
- [x] Un empleado sin usuario vinculado con `id_role = 2` y `status = 1` **no** aparece en la pantalla ni en el aviso "Sin horario definido".
- [x] Un empleado controlado sin ninguna fila de horario aparece en el aviso "Sin horario definido".
- [x] En un periodo mensual (sin escalones) se muestra el aviso "Sin escalones para Mensual".
- [x] Las tarjetas de resumen y el resumen por empleado no cambian al filtrar por estado, clasificación o búsqueda.
- [x] El resumen por empleado muestra 1.5 días estimados para 3 acumulables injustificados en un periodo semanal con las semillas.
- [x] La pantalla aparece en el menú Nómina, después de "Faltas". Un usuario con rol 2, 3, 5 o 6 que entra a `/dashboard/nomina/retardos` es redirigido a `/dashboard`.

**Configuración**

- [x] Cambiar la tolerancia a 15 quita de la lista los retardos de 10 a 14 minutos, y agrega una fila a la bitácora con los valores anterior y nuevo.
- [x] Guardar sin cambios no escribe ninguna fila en la bitácora ni cambia `updated_at`.
- [x] Guardar `minutos_retardo_grave <= tolerancia_minutos` muestra un error en el modal y no guarda nada.
- [x] Guardar escalones decrecientes (por ejemplo, {1 → 1, 2 → 0.5}), `retardos` repetidos en una frecuencia o `dias_descuento` que no sea múltiplo de 0.5 muestra un error y no guarda nada.
- [x] Editar solo los escalones actualiza `lateness_settings.updated_at` y escribe la bitácora con los JSON anterior y nuevo.

**Justificación**

- [x] Subir un PDF, JPG o PNG de hasta 5 MB deja la fila en "Justificado", con "Ver archivo". El archivo queda en la carpeta `clinica/empleados/retardos`.
- [x] "Reemplazar" cambia la `url` sin crear una segunda fila.
- [x] "Marcar no aplica" sin comentario muestra un error. Con comentario, deja la fila en "No aplica".
- [x] "Volver a injustificado" borra la fila de `lateness_justifications`.
- [x] Justificar (llamando a la action directamente) un día cuya primera entrada fue puntual devuelve `{ ok: false }`.
- [x] Justificar un día de un empleado sin usuario podólogo activo devuelve `{ ok: false }`.
- [x] Con el periodo en estatus 3 o 4 no se muestran las acciones, y las tres actions de justificación devuelven `{ ok: false }`.
- [x] Justificar, marcar "no aplica" y volver a injustificada en **Faltas** siguen funcionando después de mover los modales a `nomina/componentes/`.

**Cálculo**

- [x] Recalcular un periodo sin retardos ni faltas deja sus filas de `period_employees` idénticas a las anteriores, salvo `calculated_at` y `calculated_by`.
- [x] Un periodo semanal con 1 acumulable injustificado da `dias_retardo = 0.5` e `importe_salario = ROUND(salario × (dias − 0.5), 2)`, en `'O'` y en `'F'`.
- [x] Un periodo semanal con 3 acumulables da `dias_retardo = 1.5`.
- [x] Un periodo quincenal con 5 acumulables da `dias_retardo = 1.0`. Con 6 da `1.5`.
- [x] Un grave y un acumulable en un periodo semanal dan `0.5 + 0.5 = 1.0`. El grave no cuenta para el escalón.
- [x] Un periodo mensual (sin escalones) con 1 grave y 3 acumulables da `dias_retardo = 0.5`.
- [x] Un retardo justificado o "no aplica" no entra a `dias_retardo` ni a `period_employee_lateness`.
- [x] Un empleado con `dias = 2` y descuento de 3 días queda con `dias_retardo = 2`, `dias_retardo_sin_tope = 3` e `importe_salario = 0`.
- [x] Cada retardo descontado tiene una fila en `period_employee_lateness` por cada tipo en el que entra el empleado, con `hora_llegada`, `minutos_retardo` y `clasificacion` correctos.
- [x] "Revertir" deja el periodo sin filas en `period_employee_lateness`.
- [x] Si dos periodos de distinta frecuencia cubren el mismo día, el retardo se descuenta solo en el primero que se calcula, para cada tipo.
- [x] Con la empresa sin fila en `lateness_settings`, `dias_retardo` queda en 0 para todos.

**Procesar y Detalle**

- [x] En Procesar, la columna "Días" muestra "1.5 retardo" debajo de los días cuando `dias_retardo > 0`, junto a "F faltas" si las hay.
- [x] En Detalle, la línea de sueldo dice "11.5 días (15 − 2 faltas − 1.5 por retardos) × $X diarios", y el importe es el guardado.
- [x] Con tope aplicado, la línea agrega "(tope aplicado)".
- [x] `PayrollLatenessList` lista fecha, entrada programada, llegada, minutos y clasificación de los retardos descontados del tipo seleccionado, y se oculta cuando no hay ninguno.
- [x] En Retardos, un retardo descontado muestra el distintivo "Descontado en {código del periodo}".

**Aviso "Recalcula"**

- [x] Con el periodo en estatus 2, justificar un retardo ya descontado muestra el aviso "Hay retardos que no coinciden con el último cálculo. Recalcula la nómina." en Procesar y en Retardos.
- [x] Con el periodo en estatus 2, cambiar la tolerancia o un escalón muestra el aviso.
- [x] Con el periodo en estatus 2, subir `minutos_retardo_grave` de manera que un grave descontado pase a acumulable muestra el aviso.
- [x] Después de "Recalcular", el aviso desaparece.
- [x] Con el periodo en estatus 1, el aviso nunca aparece.
- [x] Faltas y Horas extra siguen mostrando su propio aviso con su texto de siempre.

**Documentación**

- [ ] `docs/nomina.md` tiene la sección "Retardos (spec 63)", y el párrafo inicial menciona el descuento por retardos.

## Decisiones tomadas y descartadas

- **Sí:** el retardo se mide solo contra `hora_entrada_1`, con la primera checada `entrada` del día. Es decisión del usuario y el mismo criterio de Horas extra.
- **No:** medir el regreso del segundo bloque (`hora_entrada_2`). Duplica la detección, y nadie lo pidió.
- **Sí:** los minutos se truncan (08:09:59 son 9 minutos). "10 minutos o más" se lee en minutos completos.
- **Sí:** un día sin ninguna `entrada` no se evalúa. No hay hora de llegada, y un día sin checadas ya es asunto de Faltas.
- **Sí:** se incluye el día de hoy. A diferencia de una falta, el retardo es definitivo en cuanto existe la checada de entrada.
- **Sí:** grave y acumulable son **excluyentes**. Un retardo de 30 minutos o más descuenta medio día y no suma al escalón. Es decisión del usuario, para no castigar dos veces el mismo día.
- **No:** que el grave también cuente para la acumulación.
- **Sí:** la ventana de acumulación es el **periodo de nómina**, con escalones por frecuencia. Es la lectura de "configurable según el periodo" que eligió el usuario, y cubre la regla semanal nueva y la quincenal original.
- **No:** ventanas de semana calendario dentro de periodos más largos. Complica el cálculo y no encaja con escalones por frecuencia.
- **Sí:** los escalones se aplican **en ciclo** (3 retardos semanales = 1 + 0.5). Es decisión del usuario, y la lectura natural de "2 retardos = 1 falta".
- **No:** un tope en el escalón más alto, ni un valor lineal por retardo. El lineal no puede expresar la regla quincenal (2 → 0.5).
- **Sí:** se siembran las frecuencias semanal (`02`) y quincenal (`04`). La quincenal sale del texto original de `faltas.md`.
- **Sí:** una frecuencia sin escalones solo descuenta los graves, con un aviso en pantalla. Y una empresa sin configuración no descuenta nada. Es el mismo criterio que horas extra: no hay default silencioso.
- **Sí:** la configuración es **por empresa**, con bitácora, como `overtime_settings`. Es decisión del usuario.
- **No:** configuración por sucursal o por empleado.
- **Sí:** el descuento del grave también es configurable (0.5 o 1.0). El documento pide que "límites y tolerancias sean editables".
- **Sí:** los escalones van en la bitácora como JSON. Su número varía por frecuencia, y una tabla hija de log sería excesiva para una bitácora de lectura.
- **Sí:** "no decreciente" se valida en `zod` y en la action. Un `CHECK` no puede comparar filas.
- **Sí:** columna `dias_retardo decimal(4,1)`, aparte de `dias`. Es decisión del usuario. `dias` sigue siendo entero y conserva su significado de la spec 62.
- **No:** convertir `dias` a decimal, ni crear una deducción aparte "Retardos". Lo primero cambia otra vez el significado de `dias`. Lo segundo obligaría a construir el concepto de deducciones antes de tiempo, igual que se descartó en la spec 62.
- **Sí:** se descuenta en **operativa y fiscal**, como las faltas. Es decisión del usuario.
- **Sí:** `dias_retardo` nunca pasa de `dias`, y se guarda `dias_retardo_sin_tope`. Con escalones editables, el sueldo base nunca queda negativo, y el Detalle puede explicar el tope.
- **Sí:** tabla hermana `lateness_justifications` con la misma forma que `absence_justifications`. Es decisión del usuario.
- **No:** reusar `absence_justifications` con una columna `tipo`. Si llega una checada a un día justificado como falta, la fila se leería como justificante de retardo.
- **Sí:** PDF, JPG y PNG, más el estado "No aplica". Igual que Faltas, por decisión del usuario. **Se aparta de la regla original**, que pide solo PDF.
- **Sí:** los modales de Faltas se generalizan y se mueven a `nomina/componentes/`, en lugar de copiarse. Es lo que pide `CLAUDE.md` sobre reuso.
- **Sí:** misma población que Faltas (`ABSENCE_CONTROLLED_EMPLOYEE_CONDITION`), sin constante nueva. El usuario pidió "solo rol 2", y las dos reglas vienen del mismo reglamento.
- **No:** una constante `LATENESS_CONTROL_ROLE_IDS` aparte. Duplicaría la regla. Si algún día divergen, se separa.
- **Sí:** el desglose congela `hora_entrada_1`, `hora_llegada`, `minutos_retardo` y `clasificacion`. El Detalle debe explicar el descuento aunque después cambie el horario o la configuración.
- **Sí:** `UNIQUE (id_empleado, fecha, tipo_nomina)`, igual que en faltas: el mismo día se descuenta una vez por tipo de nómina.
- **Sí:** el aviso "Recalcula" compara el conjunto de retardos con su clasificación contra el desglose, **más** `lateness_settings.updated_at > calculated_at`. El conjunto ve justificaciones, borrados, checadas nuevas y cambios de tolerancia o umbral grave. La fecha ve los cambios de escalones y del descuento grave, que no cambian el conjunto.
- **No:** comparar `decided_at` contra `calculated_at` para los justificantes. No ve los borrados (el mismo motivo que en las specs 61 y 62). Para la configuración sí es válido, porque siempre es un `UPDATE` y nunca un `DELETE`.
- **Sí:** el cálculo detecta en SQL, dentro del mismo batch, y el helper TS solo alimenta la pantalla. **Si difieren, manda el SQL**, como en las specs 53 a 62.
- **Sí:** se usa el horario actual para todo el periodo, igual que en las specs 60 y 62.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| **Un checador con el reloj desfasado** (por ejemplo, 15 minutos adelantado) marca retardos falsos en bloque en toda la sucursal. | Se ven en la pantalla antes de calcular, y se pueden marcar "No aplica" con comentario ("Reloj del checador desfasado"). `docs/nomina.md` lo remarca: revisa Retardos antes de "Calcular". |
| **Un checador que manda el `tipo` equivocado** (una `entrada` registrada como `salida`) hace que el día no se evalúe, o que se tome como llegada una `entrada` posterior (el regreso de comer), lo que da un retardo grave falso. | El día se ve en la lista con su hora de llegada, y se marca "No aplica". El mismo riesgo ya existe en Horas extra. |
| **Cambiar el horario de un empleado cambia la detección de días pasados**, porque no hay historial de horarios. | El aviso "Recalcula" lo detecta en estatus 2 (cambia el conjunto o la clasificación). Los periodos 3 y 4 no se tocan. |
| **Escalones capturados con valores extremos** (por ejemplo, 1 retardo → 3 días) dejan el sueldo base en cero. | Validación de escalones no decrecientes en múltiplos de 0.5, tope `dias_retardo <= dias`, "(tope aplicado)" en el Detalle y bitácora de quién cambió qué. |
| **Cambiar la configuración afecta a todos los periodos en estatus 1 y 2 de la empresa**, no solo al actual. | Es lo esperado mientras no se calculen. En estatus 2, el aviso "Recalcula" lo muestra. La bitácora registra el cambio. |
| **Un empleado cambia de frecuencia** y dos periodos de frecuencias distintas cubren el mismo día. | El candado `UNIQUE` descuenta cada día una sola vez por tipo, y cada periodo aplica los escalones solo a los retardos que toma de verdad. Es el mismo comportamiento que en faltas y horas extra. |
| **Un día a la vez con retardo y falta.** No puede pasar: la falta exige cero checadas y el retardo exige una `entrada`. | Queda documentado. No hace falta código. |
| **`calculatePayrollPeriod` se vuelve más pesado**, porque ahora encadena salario, tres comisiones, horas extra, faltas y retardos. | El paso 10 exige comparar el snapshot de un periodo ya calculado antes y después del cambio. Si el cálculo se vuelve lento, se agrega un índice en `RH.asistencias([id_empleado], [fecha_hora])` sin cambiar la lógica. |
| **Descuento no reversible**: justificar un retardo ya descontado en un periodo aprobado (3) o pagado (4) no lo devuelve. | Hoy los estatus 3 y 4 no son alcanzables. Quien los construya debe bloquear las justificaciones de días descontados en esos periodos, igual que en las specs 61 y 62. |
| **Mover los modales de Faltas a `nomina/componentes/`** podría romper la pantalla de Faltas. | El paso 4 se verifica por separado en Faltas antes de construir Retardos, y hay un criterio de aceptación de regresión. |
| **Archivos huérfanos en Cloudinary** al reemplazar un justificante o volver a injustificado. | Se acepta, igual que en Faltas y Documentos. |

## Lo que **no** incluye esta spec

- Regreso del segundo bloque (`hora_entrada_2`) y salidas anticipadas.
- Bono de puntualidad y bono de asistencia.
- Retardos en días de descanso y días con checada pero sin `entrada`.
- Configuración por sucursal o por empleado.
- Control de retardos para roles distintos al podólogo.
- Aprobación del justificante por un segundo usuario, y justificación masiva.
- Historial o vigencias de horario.
- Descuento retroactivo en periodos aprobados o pagados.
- Borrar archivos de Cloudinary.
- Mostrar los retardos en la pestaña Asistencia del empleado.
- Catálogo de festivos y reglamento interno precargado.
- Deducciones como concepto propio (IMSS, ISR, "Total a pagar").

Cada uno de estos puntos, si llega a hacerse, va en su propia spec.
