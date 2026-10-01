# 64 — Nómina: bono de puntualidad

## Header

- **Estado:** Implementado
- **Depende de:**
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md) y [54 — Detalle de percepciones](54-nomina-detalle-percepciones-empleado.md): `calculatePayrollPeriod`, el snapshot `payroll.period_employees`, `buildPerceptionLines`, la pantalla Detalle y "Total percepciones" en Procesar.
  - [51 — Empleado: periodo de pago](51-periodo-pago-empleado.md) y [52 — Nómina: periodos](52-nomina-periodos.md): la frecuencia del periodo (`id_payment_period`) decide qué configuración del bono se aplica.
  - [59 — Empleados: horario semanal estructurado](59-empleado-horario-semanal.md): un podólogo sin horario no cobra el bono.
  - [60](60-nomina-horas-extra-deteccion-autorizacion.md) y [61](61-nomina-horas-extra-pago.md): el patrón de configuración con bitácora (`overtime_settings` / `overtime_settings_log`, `OvertimeSettingsCard`).
  - [62 — Nómina: control de faltas](62-nomina-control-faltas.md): faltas injustificadas (`#absences`, `absence_justifications`) y la población controlada `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION` (usuario vinculado activo con `id_role = 2`).
  - [63 — Nómina: control de retardos](63-nomina-control-retardos.md): retardos injustificados (`#lateness`, `lateness_justifications`) y la tolerancia única `lateness_settings.tolerancia_minutos`. **Esta spec modifica la spec 63:** la regla del retardo pasa de `minutos >= tolerancia` a `minutos > tolerancia`.
- **Modifica base de datos:** Sí.
  - Tabla nueva `payroll.punctuality_bonus_settings`: monto, máximo de incidencias y estatus por empresa y frecuencia.
  - Tabla nueva `payroll.punctuality_bonus_settings_log`: bitácora de cambios.
  - Columnas nuevas en `payroll.period_employees` para congelar el resultado del bono (incidencias, máximo aplicado e importe).
- **Fecha:** 2026-09-30
- **Objetivo:** Pagar en la nómina operativa a los podólogos (`id_role = 2`) que estuvieron el periodo completo un bono de puntualidad configurable por frecuencia, que se pierde cuando sus retardos injustificados más sus faltas injustificadas del periodo superan el máximo de incidencias configurado.
- **Reglas de origen:** `references/docs/puntualidad.md` y `references/nomina/reglas_modulo_nomina.md` (sección 2.2).

## Alcance

**Incluye:**

- **Cambio a la spec 63 (regla del retardo).** Un día es retardo si `minutos_retardo > tolerancia_minutos`, ya no `>=`. Los minutos se siguen truncando: con entrada a las 09:00 y tolerancia de 10, 09:10:59 es puntual y 09:11:00 es retardo. La clasificación grave no cambia (`minutos >= minutos_retardo_grave`). El cambio aplica en todas partes donde se detecta un retardo: el helper `latenessDetection.ts`, `#lateness` en `calculatePayrollPeriod`, `validateDayIsLateness` en las escrituras, `latenessRecalculation.ts` y el texto de la tolerancia en `LatenessSettingsModal`. `CK_period_employee_lateness_valores` (`minutos_retardo > 0`) y la validación `minutos_retardo_grave > tolerancia_minutos` se quedan igual.
- **Base de datos** (DDL documentado en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 63):
  - `payroll.punctuality_bonus_settings`: una fila por empresa y frecuencia (`id_payment_period`), con `monto`, `maximo_incidencias` y `status`. Semillas: empresa 1, semanal (SAT `02`) y quincenal (SAT `04`), $500, máximo 1, activas. Las demás frecuencias no llevan fila.
  - `payroll.punctuality_bonus_settings_log`: bitácora de cambios. Un guardado sin cambios no escribe nada.
  - `payroll.period_employees` gana columnas para congelar el resultado del bono: retardos, faltas, máximo aplicado, resultado e importe.
- **Quién se evalúa.** Solo el renglón operativo (`'O'`) de los empleados que cumplen `ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS` + `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION`, la misma población que Faltas y Retardos. Un empleado se evalúa solo si cumple todo esto:
  - la empresa tiene fila en `lateness_settings`;
  - la frecuencia del periodo tiene fila en `punctuality_bonus_settings` con `status = 1`;
  - `fecha_ingreso <= fecha_inicio`, es decir, estuvo el periodo completo;
  - tiene al menos una fila en `RH.empleado_horarios`.

  Si no cumple alguna, el resultado es **"No evaluado"** con su motivo, y el importe es 0.
- **Incidencias** = retardos injustificados + faltas injustificadas dentro de las fechas del periodo. Se usan las mismas reglas de detección de las specs 62 y 63:
  - Los retardos van hasta `min(fecha_fin, hoy)`, con hoy incluido. Las faltas van hasta el día anterior a hoy.
  - Cada retardo suma 1, sea grave o acumulable. Cada falta suma 1.
  - Un día con fila en `lateness_justifications` o `absence_justifications` (`'J'` o `'N'`) **no cuenta**.
  - **Sí cuentan** los acumulables de una frecuencia sin escalones, y los días que otro periodo ya descontó. El candado de descuento no aplica al bono.
- **Resultado.** `incidencias <= maximo_incidencias` → **Conserva**, con importe = `monto`. `incidencias > maximo_incidencias` → **Pierde**, con importe 0. No hay prorrateo.
- **Helper espejo puro** `lib/payroll/punctualityBonus.ts`: elegibilidad, conteo y resultado, sin BD y sin `Date` sobre strings crudos. Alimenta la pantalla. **En el cálculo manda el SQL.**
- **Pantalla nueva `/dashboard/nomina/bonos`**:
  - `page.tsx` es un Server Component. El estado vive en la URL: `periodo`, `resultado=conserva|pierde|no_evaluado`, `q` y `pagina`, con 25 filas por página.
  - Tarjetas de resumen del periodo completo: cuántos conservan, cuántos pierden, cuántos no se evalúan e importe estimado total. No cambian con los filtros.
  - Tabla por podólogo: empleado, retardos, faltas, incidencias, máximo, resultado (con el motivo si es "No evaluado") e importe. Los números de retardos y faltas llevan a `/dashboard/nomina/retardos` y `/dashboard/nomina/faltas` con el mismo periodo y la búsqueda del empleado, porque ahí se justifica.
  - Avisos: "Bono no configurado para {frecuencia}" (sin fila o con `status = 0`), "Sin configuración de retardos" y "Sin horario definido" (se reusa `EmployeesWithoutScheduleNotice`).
  - Tarjeta de configuración con modal: una fila por frecuencia activa, con monto, máximo de incidencias y estatus. La bitácora va en un `<details>`, como `OvertimeSettingsCard`. La configuración se puede editar siempre.
  - Se agrega "Bonos" a la sección Nómina de `NAV_LINKS`, después de "Retardos". `proxy.ts` ya protege `/dashboard/nomina`.
- **Server actions** en `nomina/bonos/actions.ts`: `getPunctualityBonusPage`, `getPunctualityBonusSettingsLog` y `updatePunctualityBonusSettings`. Todas pasan por `assertPayrollAccess()`, toman la sucursal y la empresa de la sesión, y validan con `zod` en `lib/payroll/schemas.ts`. `updatePunctualityBonusSettings` valida `monto > 0` con 2 decimales como máximo, y `maximo_incidencias` entero `>= 0`.
- **Cálculo** dentro del batch de `calculatePayrollPeriod`, después de `#lateness`. Se cuentan las incidencias por empleado con las reglas de arriba, sin el filtro de escalones ni el candado. Se llenan las columnas del bono en `'O'`. Los renglones `'F'` quedan en 0 y como "No evaluado".
- **Aviso "Recalcula"** (`lib/payroll/punctualityBonusRecalculation.ts`, server-only, solo en estatus 2). Se muestra con `PayrollRecalculationNotice` en Procesar y en Bonos, con el texto "Hay bonos de puntualidad que no coinciden con el último cálculo. Recalcula la nómina.", cuando pasa cualquiera de estas cosas:
  - el resultado de hoy (retardos, faltas, resultado o importe) de algún renglón `'O'` es distinto del snapshot;
  - `punctuality_bonus_settings.updated_at` de la frecuencia del periodo es posterior al `calculated_at`.
- **Procesar:** columna "Bono punt." después de "Horas extra". "Total percepciones", la tarjeta de resumen y el pie de la tabla lo suman.
- **Detalle:** `buildPerceptionLines` agrega la línea `bono_puntualidad`:
  - Conserva: "Bono de puntualidad", "N incidencias de M permitidas", con el importe.
  - Pierde: la misma línea con $0 y "Perdido: N incidencias (máximo M)", para que se entienda por qué no se cobró.
  - No evaluado: la línea se omite.
- **Documentación:** sección "Bono de puntualidad (spec 64)" en `docs/nomina.md`. También se actualizan el párrafo inicial y la regla del retardo en la sección de la spec 63.

**No incluye:**

- **Bono de asistencia** ("por no faltar"). Va en otra spec, aunque puede vivir en la misma pantalla Bonos.
- **Una tolerancia propia del bono.** Se usa la de Retardos.
- **Prorrateo** para quien ingresó a mitad del periodo. Ese empleado no se evalúa.
- **"Las demás condiciones de la política"** de `puntualidad.md`. No hay ninguna concreta.
- **Nómina fiscal**, clave SAT, ISR y `payroll.perceptions`.
- **Separar el pago en efectivo** del de transferencia (dispersión, recibos).
- **Configuración por sucursal, por empleado o para otros roles.**
- **Justificar desde la pantalla Bonos.** Se justifica en Faltas y en Retardos.
- **Otorgar o quitar el bono a mano**, y recalcular solo el bono.
- **Vigencias o historial** de la configuración, más allá de la bitácora.
- **Cambios retroactivos** en periodos aprobados (3) o pagados (4).
- **Retardos del segundo bloque** (`hora_entrada_2`) y **salidas anticipadas**. La salida no afecta el bono.

## Modelo de datos

**Cambios en BD.** El DDL va en `queries.txt`, bloque `NOMINA PAYROLL`, después de las tablas de la spec 63. La spec 63 no cambia su DDL: el paso de `>=` a `>` es solo lógica.

```sql
-- Spec 64: bono de puntualidad por empresa y frecuencia. Sin fila o status = 0 = no hay bono.
-- Sin fila en lateness_settings tampoco hay bono: sin tolerancia no se detectan retardos.
CREATE TABLE [payroll].[punctuality_bonus_settings](
    [id_empresa]         [int]           NOT NULL,
    [id_payment_period]  [smallint]      NOT NULL,
    [monto]              [decimal](12,2) NOT NULL,   -- importe total del bono en el periodo
    [maximo_incidencias] [smallint]      NOT NULL,   -- incidencias <= máximo conservan el bono
    [status]             [bit]           NOT NULL,   -- 1 aplica | 0 no aplica
    [updated_by]         [int]           NOT NULL,
    [updated_at]         [datetime2](0)  NOT NULL,
 CONSTRAINT [PK_punctuality_bonus_settings] PRIMARY KEY CLUSTERED ([id_empresa] ASC, [id_payment_period] ASC),
 CONSTRAINT [FK_punctuality_bonus_settings_payment_period] FOREIGN KEY ([id_payment_period])
     REFERENCES [RH].[payment_periods] ([id_payment_period]),
 CONSTRAINT [CK_punctuality_bonus_settings_valores] CHECK (
     [monto] > 0 AND [maximo_incidencias] >= 0)
) ON [PRIMARY]
GO

-- Semillas: semanal (SAT 02) y quincenal (SAT 04), $500, máximo 1 incidencia, activas.
INSERT INTO [payroll].[punctuality_bonus_settings]
    ([id_empresa],[id_payment_period],[monto],[maximo_incidencias],[status],[updated_by],[updated_at])
SELECT 1, pp.[id_payment_period], 500.00, 1, 1, 1, '2026-09-30 00:00:00'
FROM [RH].[payment_periods] pp
WHERE pp.[clave_sat] IN ('02', '04')
GO

-- Spec 64: bitácora. Una fila por frecuencia que cambió en el guardado.
CREATE TABLE [payroll].[punctuality_bonus_settings_log](
    [id_log]                      [int] IDENTITY(1,1) NOT NULL,
    [id_empresa]                  [int]            NOT NULL,
    [id_payment_period]           [smallint]       NOT NULL,
    [monto_anterior]              [decimal](12,2)  NULL,   -- NULL: no había fila para esa frecuencia
    [monto_nuevo]                 [decimal](12,2)  NOT NULL,
    [maximo_incidencias_anterior] [smallint]       NULL,
    [maximo_incidencias_nuevo]    [smallint]       NOT NULL,
    [status_anterior]             [bit]            NULL,
    [status_nuevo]                [bit]            NOT NULL,
    [updated_by]                  [int]            NOT NULL,
    [updated_at]                  [datetime2](0)   NOT NULL,
 CONSTRAINT [PK_punctuality_bonus_settings_log] PRIMARY KEY CLUSTERED ([id_log] ASC)
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_punctuality_bonus_settings_log_empresa]
    ON [payroll].[punctuality_bonus_settings_log] ([id_empresa], [updated_at] DESC)
GO

-- Spec 64: resultado congelado del bono por renglón de nómina.
-- 'C' conserva | 'P' pierde | 'N' no evaluado (fiscal, sin configuración, ingreso a mitad, sin horario).
-- Los snapshots anteriores quedan en 'N' con importe 0.
ALTER TABLE [payroll].[period_employees] ADD
    [bono_puntualidad_resultado] [char](1)       NOT NULL CONSTRAINT [DF_period_employees_bono_puntualidad_resultado] DEFAULT ('N'),
    [bono_puntualidad_retardos]  [smallint]      NOT NULL CONSTRAINT [DF_period_employees_bono_puntualidad_retardos]  DEFAULT (0),
    [bono_puntualidad_faltas]    [smallint]      NOT NULL CONSTRAINT [DF_period_employees_bono_puntualidad_faltas]    DEFAULT (0),
    [bono_puntualidad_maximo]    [smallint]      NULL,     -- máximo aplicado; NULL si 'N'
    [importe_bono_puntualidad]   [decimal](12,2) NOT NULL CONSTRAINT [DF_period_employees_importe_bono_puntualidad]   DEFAULT (0)
GO
ALTER TABLE [payroll].[period_employees] WITH CHECK
    ADD CONSTRAINT [CK_period_employees_bono_puntualidad] CHECK (
        ([bono_puntualidad_resultado] = 'N'
            AND [bono_puntualidad_maximo] IS NULL AND [importe_bono_puntualidad] = 0
            AND [bono_puntualidad_retardos] = 0 AND [bono_puntualidad_faltas] = 0)
     OR ([bono_puntualidad_resultado] = 'C'
            AND [tipo_nomina] = 'O' AND [bono_puntualidad_maximo] IS NOT NULL
            AND [bono_puntualidad_retardos] + [bono_puntualidad_faltas] <= [bono_puntualidad_maximo]
            AND [importe_bono_puntualidad] > 0)
     OR ([bono_puntualidad_resultado] = 'P'
            AND [tipo_nomina] = 'O' AND [bono_puntualidad_maximo] IS NOT NULL
            AND [bono_puntualidad_retardos] + [bono_puntualidad_faltas] > [bono_puntualidad_maximo]
            AND [importe_bono_puntualidad] = 0))
GO
```

No hay tabla de desglose ni candado: el bono se paga una vez por renglón `'O'` del periodo, y el snapshot ya es único por periodo, empleado y tipo.

**Tipos** (archivo nuevo `interfaces/payroll_punctuality_bonus.ts`):

```ts
/** 'C' | 'P' | 'N' en BD. */
export type PunctualityBonusResult = "keeps" | "loses" | "not_evaluated";

/** Por qué un empleado no se evalúa. Las dos primeras aplican a todo el periodo. */
export type PunctualityBonusSkipReason =
  | "no_lateness_settings"      // la empresa no tiene lateness_settings
  | "bonus_not_configured"      // frecuencia sin fila o con status = 0
  | "joined_mid_period"         // fecha_ingreso > fecha_inicio
  | "no_schedule";              // sin filas en RH.empleado_horarios

export interface IPunctualityBonusSetting {
  id_payment_period:  number;
  clave_sat:          string;
  frequencyName:      string;         // descripción de RH.payment_periods
  monto:              number;
  maximo_incidencias: number;
  status:             boolean;
  updated_by_name:    string | null;  // null: la frecuencia no tiene fila
  updated_at:         string | null;  // "YYYY-MM-DD HH:mm:ss"
}

export interface IPunctualityBonusSettingsLogEntry {
  id_log:                      number;
  frequencyName:               string;
  monto_anterior:              number | null;
  monto_nuevo:                 number;
  maximo_incidencias_anterior: number | null;
  maximo_incidencias_nuevo:    number;
  status_anterior:             boolean | null;
  status_nuevo:                boolean;
  updated_by_name:             string;
  updated_at:                  string;
}

/** Resultado del helper puro para un empleado en un periodo. */
export interface IPunctualityBonusEvaluation {
  lateCount:        number;                            // retardos injustificados (graves + acumulables)
  absenceCount:     number;                            // faltas injustificadas
  incidentCount:    number;                            // lateCount + absenceCount
  maximumIncidents: number | null;                     // null si not_evaluated
  result:           PunctualityBonusResult;
  skipReason:       PunctualityBonusSkipReason | null; // solo con not_evaluated
  amount:           number;                            // monto o 0
}

export interface IPunctualityBonusEmployeeRow extends IPunctualityBonusEvaluation {
  id_empleado:     number;
  codigo_empleado: string;
  nombre_completo: string;
}

export interface IPunctualityBonusFilters {
  idPeriod: number | null;
  result:   "all" | PunctualityBonusResult;
  search:   string;
  page:     number;
}

export interface IPunctualityBonusPage {
  period:                   IPayrollPeriod | null;
  periodOptions:            Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  settings:                 IPunctualityBonusSetting[];        // una por frecuencia activa, con o sin fila
  periodSetting:            IPunctualityBonusSetting | null;   // la de la frecuencia del periodo
  hasLatenessSettings:      boolean;
  rows:                     IPunctualityBonusEmployeeRow[];
  totalRows:                number;
  summary: { keeps: number; loses: number; notEvaluated: number; estimatedAmount: number };
  employeesWithoutSchedule: { id_empleado: number; nombre_completo: string }[];
  recalculationNeeded:      boolean;
}
```

**Cambios en tipos existentes** (`interfaces/payroll_calculation.ts`): `IPayrollEmployeeRow` e `IPayrollEmployeeSnapshot` ganan:

```ts
bono_puntualidad_resultado: "C" | "P" | "N";
bono_puntualidad_retardos:  number;
bono_puntualidad_faltas:    number;
bono_puntualidad_maximo:    number | null;
importe_bono_puntualidad:   number;
```

**Convenciones:**

- **URL.** `resultado=conserva|pierde|no_evaluado` se mapea a `keeps|loses|not_evaluated`.
- **Decimales.** `monto` viaja como número y se castea con `CAST(@monto AS decimal(12,2))`, igual que `importe_por_tratamiento` (spec 57). Al leer se usa `CAST(... AS float)`.
- **Ingreso a mitad.** Se compara `fecha_ingreso > fecha_inicio` como string `"YYYY-MM-DD"` en TS, y como `date` en SQL.
- **"Hoy"** llega como string desde `addZeroToday(new Date())`. En SQL nunca se usa `GETDATE()`. Retardos hasta `min(fecha_fin, hoy)` inclusive; faltas hasta el día anterior a hoy.
- **`updated_at` por frecuencia.** Solo se toca en las filas que cambiaron. El aviso "Recalcula" compara la fila de la frecuencia del periodo.
- **La regla del retardo (spec 63)** queda en TS como `minutes > tolerance` y en SQL como `DATEDIFF(second, hora_entrada_1, llegada) / 60 > tolerancia_minutos`.

## Plan de implementación

1. **BD.** Correr el DDL del Modelo de datos, con las semillas, y documentarlo en `queries.txt`, bloque `NOMINA PAYROLL`. No cambia nada de código: las columnas nuevas quedan en `'N'` / 0 por defecto y la app sigue igual. Verificación: el `SELECT` de `punctuality_bonus_settings` regresa 2 filas (semanal y quincenal, $500, máximo 1, activas).
2. **Regla del retardo `>` (cambio a la spec 63).** Cambiar `>=` por `>` contra `tolerancia_minutos` en:
   - `lib/payroll/latenessDetection.ts`;
   - `#lateness` en `calculatePayrollPeriod`;
   - `validateDayIsLateness`;
   - `lib/payroll/latenessRecalculation.ts`.

   Ajustar el texto de la tolerancia en `LatenessSettingsModal` ("Es retardo a partir del minuto tolerancia + 1"). Verificación: con entrada a las 08:00 y tolerancia 10, una llegada a las 08:10:59 ya no aparece en Retardos, y una a las 08:11:00 aparece con 11 minutos. Un periodo en estatus 2 con un retardo de exactamente 10 minutos descontado muestra el aviso "Recalcula" de Retardos.
3. **Tipos.** Crear `interfaces/payroll_punctuality_bonus.ts`. Agregar las cinco columnas del bono a `IPayrollEmployeeRow` e `IPayrollEmployeeSnapshot`, y leerlas en los SELECT de `getPayrollProcessPage` y `getPayrollEmployeeDetail`. Verificación: la app compila y Procesar se ve igual.
4. **Helper puro** `lib/payroll/punctualityBonus.ts`, sin BD y sin `Date` sobre strings crudos:
   - `evaluatePunctualityBonus({ hasLatenessSettings, setting, fechaIngreso, fechaInicio, hasSchedule, lateCount, absenceCount })` devuelve `IPunctualityBonusEvaluation`. Los motivos de "No evaluado" se revisan en el orden de `PunctualityBonusSkipReason`.
   - `describePunctualityBonus(snapshot)` da los textos de la línea del Detalle.

   Verificación manual: con máximo 1, 0 + 1 conserva y 1 + 1 pierde. Con máximo 2 salen los tres ejemplos de `puntualidad.md` (1 + 1 conserva, 1 + 2 pierde, 0 + 3 pierde). Con `fecha_ingreso` un día después de `fecha_inicio` el resultado es `not_evaluated` / `joined_mid_period`.
5. **Fuentes compartidas de incidencias.** Extraer a `lib/payroll/incidentSources.ts` (server-only) los SELECT que hoy repiten `getAbsencePage` y `getLatenessPage`: empleados controlados, horarios, checadas por día, primera entrada y justificaciones. Faltas y Retardos pasan a usarlos. Verificación: Faltas y Retardos muestran exactamente las mismas filas, tarjetas y resúmenes que antes, para el mismo periodo.
6. **Lectura.**
   - Agregar `PUNCTUALITY_BONUS_PAGE_SIZE = 25` a `lib/payroll/constants.ts`.
   - Agregar a `lib/payroll/schemas.ts` los schemas `zod` de filtros y configuración.
   - Crear `nomina/bonos/actions.ts` con `getPunctualityBonusPage` y `getPunctualityBonusSettingsLog`. `getPunctualityBonusPage` carga la configuración de todas las frecuencias activas, `lateness_settings` y las fuentes del paso 5. Detecta faltas y retardos con los helpers de las specs 62 y 63 (sin quitar los días que otro periodo ya descontó), evalúa con el helper del paso 4, arma el resumen, filtra y pagina. `recalculationNeeded` queda en `false` por ahora.
7. **Página de solo lectura** `/dashboard/nomina/bonos`:
   - `page.tsx`, un Server Component que usa `resolvePeriod`;
   - `PunctualityBonusToolbar`, cliente, un wrapper de `PayrollPeriodFilterToolbar` con `extraFilter` para `resultado`;
   - `PunctualityBonusSummaryCards` y `PunctualityBonusEmployeesTable`, Server Components, con los enlaces a Retardos y Faltas;
   - `PunctualityBonusSettingsCard` y `PunctualityBonusSettingsLog`, Server Components, todavía sin botón de editar;
   - los avisos "Bono no configurado para {frecuencia}", "Sin configuración de retardos" y `EmployeesWithoutScheduleNotice`;
   - la entrada "Bonos" en `NAV_LINKS`, después de "Retardos".

   Verificación: en un periodo quincenal, un podólogo con 1 retardo aparece como "Conserva $500" y uno con 1 retardo y 1 falta aparece como "Pierde".
8. **Editar la configuración.** Crear `updatePunctualityBonusSettings`: una transacción que lee las filas de la empresa con `UPDLOCK, HOLDLOCK`. Solo acepta frecuencias activas de `PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY`. Hace upsert solo de las frecuencias que cambiaron, con `updated_at = buildDate(new Date())`, y escribe una fila de bitácora por cada una. Sin cambios, no escribe nada. Crear `PunctualityBonusSettingsModal`, cliente, con portal: una fila por frecuencia activa con monto, máximo y un interruptor de estatus. Verificación: bajar el máximo quincenal a 0 hace que el podólogo con 1 retardo pase a "Pierde", y la bitácora muestra el cambio.
9. **Cálculo.** En el batch de `calculatePayrollPeriod`:
   - Ampliar `#lateness` para que incluya también los acumulables de frecuencias sin escalones, con una columna `cuenta_para_descuento`. El `OUTER APPLY` del descuento y el `INSERT` de `period_employee_lateness` filtran por ella, así el descuento de la spec 63 no cambia.
   - Después de `#lateness`, un `OUTER APPLY` sobre el renglón `'O'` cuenta los retardos de `#lateness` y las faltas de `#absences` del empleado dentro de las fechas del periodo, sin el filtro del candado. Evalúa en orden: `lateness_settings`, la fila de `punctuality_bonus_settings` de la frecuencia con `status = 1`, `fecha_ingreso <= fecha_inicio` y la existencia de horario. Después llena las cinco columnas.
   - Los renglones `'F'` quedan en `'N'` / 0.
   - Los fragmentos SQL del conteo viven en `lib/payroll/punctualityBonusSql.ts`, para reusarlos en el paso 11.

   Verificación: comparar el snapshot de un periodo ya calculado antes y después de este paso. Debe quedar idéntico salvo las columnas del bono, `calculated_at` y `calculated_by` (en particular `dias_retardo` e `importe_salario`).
10. **Procesar y Detalle.**
    - `getPayrollProcessPage` suma `importe_bono_puntualidad` a "Total percepciones", a la tarjeta de resumen y al pie de la tabla.
    - `PayrollEmployeesTable` agrega la columna "Bono punt." después de "Horas extra": el importe, más el texto secundario "Perdido" cuando `resultado = 'P'`.
    - `buildPerceptionLines` agrega `bono_puntualidad` con `describePunctualityBonus`: se muestra con 'C' y con 'P' ($0 y "Perdido: N incidencias (máximo M)"), y se omite con 'N'.
11. **Aviso "Recalcula".** Crear `lib/payroll/punctualityBonusRecalculation.ts` con `isPunctualityBonusRecalculationNeeded(idPeriod)`, server-only y solo para estatus 2. Es un `SELECT` con `EXISTS` que usa los fragmentos del paso 9 y busca:
    - un renglón `'O'` cuyo resultado, retardos, faltas, máximo o importe de hoy sean distintos del snapshot;
    - `punctuality_bonus_settings.updated_at` de la frecuencia del periodo posterior a `MIN(calculated_at)` del periodo.

    Se muestra con `PayrollRecalculationNotice` en Procesar y en Bonos. Verificación: justificar en Retardos el único retardo de un podólogo que perdió el bono muestra el aviso en Procesar y en Bonos, y el aviso desaparece después de "Recalcular".
12. **Documentación.** Agregar la sección "Bono de puntualidad (spec 64)" a `docs/nomina.md`. Actualizar el párrafo inicial (conceptos calculados, tablas y pantallas), la regla del retardo en "Retardos (spec 63)" (`>` en lugar de `>=`), la sección UI y la lista de componentes del Detalle.

## Criterios de aceptación

**Base de datos**

- [x] Las tablas `payroll.punctuality_bonus_settings` y `payroll.punctuality_bonus_settings_log` existen, y `payroll.period_employees` tiene `bono_puntualidad_resultado`, `bono_puntualidad_retardos`, `bono_puntualidad_faltas`, `bono_puntualidad_maximo` e `importe_bono_puntualidad`. Su DDL está en `queries.txt`, bloque `NOMINA PAYROLL`.
- [x] Las semillas dejan a la empresa 1 con semanal (`02`) y quincenal (`04`): $500, máximo 1, activas.
- [x] Los snapshots calculados antes de esta spec tienen `bono_puntualidad_resultado = 'N'` e `importe_bono_puntualidad = 0`.
- [x] Insertar a mano un renglón `'F'` con resultado `'C'`, o un `'C'` con `retardos + faltas > maximo`, falla por `CK_period_employees_bono_puntualidad`.
- [x] Insertar `monto = 0` o `maximo_incidencias = -1` en `punctuality_bonus_settings` falla por `CK_punctuality_bonus_settings_valores`.

**Regla del retardo (cambio a la spec 63)**

- [x] Con entrada a las 08:00 y tolerancia 10, una primera entrada a las 08:10:59 **no** aparece en Retardos, y una a las 08:11:00 aparece con 11 minutos.
- [x] Justificar (llamando a la action directamente) un día con llegada a las 08:10 devuelve `{ ok: false }`.
- [x] Calcular un periodo con una llegada a las 08:10 no la descuenta ni la agrega a `period_employee_lateness`.
- [x] Una llegada a las 08:30 con umbral grave 30 sigue siendo "Grave".
- [x] Con el periodo en estatus 2 y un retardo de exactamente 10 minutos ya descontado, Retardos y Procesar muestran el aviso "Recalcula" de retardos.

**Fuentes compartidas**

- [x] Después de extraer `lib/payroll/incidentSources.ts`, Faltas y Retardos muestran las mismas filas, tarjetas y resúmenes que antes para el mismo periodo, salvo los retardos de exactamente la tolerancia (por la regla `>`).

**Evaluación (pantalla Bonos)**

- [x] En un periodo quincenal con las semillas, un podólogo con 0 incidencias aparece como "Conserva" con $500.
- [x] Con 1 retardo acumulable aparece "Conserva".
- [x] Con 1 retardo y 1 falta aparece "Pierde" con $0.
- [x] Con 2 faltas aparece "Pierde".
- [x] Un retardo grave cuenta como 1 incidencia, igual que uno acumulable.
- [x] Un retardo o una falta con justificante (`'J'`) o marcado "No aplica" (`'N'`) no cuenta como incidencia.
- [x] Un retardo acumulable en una frecuencia **sin escalones** sí cuenta como incidencia.
- [x] Un retardo o una falta que otro periodo ya descontó sí cuenta como incidencia en este periodo.
- [x] La falta de hoy no cuenta (todavía no es falta), y el retardo de hoy sí cuenta en cuanto existe la checada de entrada.
- [x] Un podólogo con `fecha_ingreso` posterior a `fecha_inicio` aparece como "No evaluado — Ingresó a mitad del periodo" con $0.
- [x] Un podólogo sin horario aparece como "No evaluado — Sin horario" y en el aviso "Sin horario definido".
- [x] Un empleado sin usuario vinculado con `id_role = 2` y `status = 1` **no** aparece en la pantalla.
- [x] En un periodo mensual (sin fila de bono) todos aparecen como "No evaluado" y se muestra "Bono no configurado para Mensual". Pasa lo mismo con una frecuencia que tiene fila con `status = 0`.
- [x] Con la empresa sin fila en `lateness_settings`, todos aparecen como "No evaluado" y se muestra "Sin configuración de retardos".
- [x] Las tarjetas de resumen (conservan, pierden, no evaluados e importe estimado) no cambian al filtrar por resultado o búsqueda.
- [x] Hacer clic en el número de retardos o de faltas lleva a Retardos o a Faltas con el mismo periodo y el empleado en la búsqueda.
- [x] La pantalla aparece en el menú Nómina, después de "Retardos". Un usuario con rol 2, 3, 5 o 6 que entra a `/dashboard/nomina/bonos` es redirigido a `/dashboard`.

**Configuración**

- [x] El modal muestra una fila por frecuencia activa, tenga o no configuración.
- [x] Cambiar el máximo quincenal de 1 a 0 hace que un podólogo con 1 incidencia pase a "Pierde", y agrega una fila a la bitácora para la frecuencia quincenal (y ninguna para la semanal).
- [x] Guardar sin cambios no escribe ninguna fila en la bitácora ni cambia `updated_at`.
- [x] Guardar `monto = 0`, un monto con 3 decimales o un máximo negativo o no entero muestra un error en el modal y no guarda nada.
- [x] Configurar por primera vez una frecuencia sin fila (por ejemplo, mensual) crea la fila y escribe la bitácora con los valores anteriores en `NULL`.
- [x] Poner `status = 0` en una frecuencia hace que sus periodos muestren "Bono no configurado para {frecuencia}".

**Cálculo**

- [x] Recalcular un periodo ya calculado deja `dias`, `dias_falta`, `dias_retardo`, `dias_retardo_sin_tope`, `importe_salario` y las columnas de comisiones y horas extra idénticas a las anteriores.
- [x] Un podólogo quincenal con 0 o 1 incidencia queda con `'C'` e `importe_bono_puntualidad = 500` en su renglón `'O'`.
- [x] Con 2 incidencias queda con `'P'`, `importe_bono_puntualidad = 0` y `bono_puntualidad_retardos` y `bono_puntualidad_faltas` correctos.
- [x] El renglón `'F'` del mismo podólogo queda con `'N'` e importe 0.
- [x] Un empleado no controlado (sin usuario podólogo activo) queda con `'N'` en `'O'`.
- [x] Con `fecha_ingreso > fecha_inicio`, sin horario, sin fila o con `status = 0` en la frecuencia, o sin `lateness_settings`, queda con `'N'` e importe 0.
- [x] Un periodo semanal sin escalones de acumulación: un acumulable no descuenta sueldo (`dias_retardo = 0`) y no entra a `period_employee_lateness`, pero sí cuenta para el bono.
- [x] Un periodo calculado a mitad de su rango y recalculado después de que aparece una falta nueva cambia de `'C'` a `'P'`.
- [x] "Revertir" deja el periodo sin snapshot, y al calcular de nuevo el bono se evalúa desde cero.

**Procesar y Detalle**

- [x] En Procesar, la columna "Bono punt." muestra $500 para quien conserva, y $0 con "Perdido" para quien pierde. "Total percepciones", la tarjeta y el pie incluyen el bono y no cambian con los filtros de puesto o búsqueda.
- [x] En Detalle (operativa), quien conserva ve la línea "Bono de puntualidad" con "N incidencias de M permitidas" y $500.
- [x] Quien pierde ve la línea con $0 y "Perdido: N incidencias (máximo M)".
- [x] Con resultado `'N'`, o en la vista fiscal, la línea no aparece.
- [x] El importe mostrado siempre es el guardado en el snapshot.

**Aviso "Recalcula"**

- [x] Con el periodo en estatus 2, justificar en Retardos el único retardo de un podólogo que perdió el bono muestra el aviso "Hay bonos de puntualidad que no coinciden con el último cálculo. Recalcula la nómina." en Procesar y en Bonos.
- [x] Con el periodo en estatus 2, cambiar el monto, el máximo o el estatus de la frecuencia del periodo muestra el aviso. Cambiar otra frecuencia no lo muestra.
- [x] Una falta nueva que cambia el resultado muestra el aviso.
- [x] Después de "Recalcular", el aviso desaparece.
- [x] Con el periodo en estatus 1, el aviso nunca aparece.
- [x] Faltas, Retardos y Horas extra siguen mostrando su propio aviso con su texto de siempre.

**Documentación**

- [x] `docs/nomina.md` tiene la sección "Bono de puntualidad (spec 64)". La sección "Retardos (spec 63)" dice `minutos > tolerancia`, y el párrafo inicial menciona el bono como concepto calculado.

## Decisiones tomadas y descartadas

- **Sí:** una sola tolerancia, la de `lateness_settings.tolerancia_minutos`. Las incidencias del bono son los mismos retardos de la spec 63. Es decisión del usuario: un día no puede ser puntual para la nómina y tarde para el bono.
- **No:** una tolerancia propia del bono con detección aparte, aunque `puntualidad.md` la ponga como campo del bono. Obligaría a justificar días que no aparecen en Retardos.
- **Sí:** la regla del retardo cambia de `minutos >= tolerancia` a `minutos > tolerancia`. Es decisión del usuario, para cumplir "09:10 → Puntual, 09:11 → Retardo" de `puntualidad.md`. **Se aparta de la spec 63**, ya implementada. Los periodos en estatus 2 con retardos de exactamente la tolerancia van a mostrar el aviso "Recalcula" de retardos.
- **Sí:** los minutos se siguen truncando (09:10:59 es puntual). Es decisión del usuario, y es lo que menos cambia la spec 63.
- **No:** comparar la hora literal (09:10:01 ya es retardo). Contradice el truncado que ya usa la spec 63 y el ejemplo del documento.
- **Sí:** los retardos y las faltas con justificante o "No aplica" no cuentan como incidencia. Es decisión del usuario: el justificante tiene el mismo efecto en el descuento y en el bono.
- **Sí:** grave y acumulable suman 1 cada uno. `puntualidad.md` dice "cada retardo suma 1 incidencia", sin distinguir.
- **Sí:** cuentan también los acumulables de frecuencias sin escalones y los días que otro periodo ya descontó. Es decisión del usuario: el bono mira lo que pasó en las fechas del periodo, y el candado de descuento existe para no descontar dos veces, no para decidir si hubo incidencia.
- **Sí:** `incidencias <= máximo` conserva el bono. El ejemplo 1 de `puntualidad.md` (total 2, máximo 2) lo conserva.
- **Sí:** monto, máximo y estatus **por empresa y frecuencia**. Es decisión del usuario: con un solo monto, un podólogo semanal cobraría el bono de una quincena cada semana.
- **No:** un solo monto y un solo máximo por empresa.
- **Sí:** semillas semanal y quincenal con $500 y máximo 1. Es decisión del usuario.
- **Sí:** sin `lateness_settings` no hay bono ("No evaluado"). Sin tolerancia no se pueden detectar retardos, y pagar el bono contando solo faltas sería un default silencioso, el mismo criterio de las specs 61 y 63.
- **Sí:** un podólogo que ingresó después de `fecha_inicio` no se evalúa. Es decisión del usuario.
- **No:** bono completo ni proporcional para quien ingresó a mitad del periodo.
- **Sí:** un podólogo sin horario no se evalúa. Sin horario no puede tener retardos ni faltas, y "ganaría" el bono por default.
- **Sí:** solo nómina operativa (`'O'`). Es decisión del usuario: `reglas_modulo_nomina.md` pone los bonos en "Pago en Efectivo", igual que las comisiones.
- **Sí:** misma población que Faltas y Retardos (`ABSENCE_CONTROLLED_EMPLOYEE_CONDITION`, `id_role = 2`), sin constante nueva. `puntualidad.md` dice "aplica solo para podólogos".
- **No:** configurar por empleado qué bonos le aplican. La pregunta abierta de `puntualidad.md` se resolvió con "solo podólogos".
- **No:** "las demás condiciones establecidas en la política". No hay ninguna concreta, y queda fuera hasta que alguien la defina.
- **Sí:** pantalla nueva `/dashboard/nomina/bonos`, con vista previa por podólogo. Es decisión del usuario: se puede revisar quién pierde el bono y por qué antes de calcular, y el bono de asistencia puede vivir ahí después.
- **No:** solo una tarjeta de configuración en Comisiones.
- **Sí:** no se justifica desde Bonos. Se enlaza a Retardos y Faltas, que ya tienen los modales y las validaciones.
- **Sí:** columnas en `period_employees` con el resultado, los conteos, el máximo aplicado y el importe, sin tabla de desglose. El bono se paga una vez por renglón `'O'`, y los retardos y faltas que lo explican ya se ven en sus pantallas.
- **No:** una tabla de desglose ni un candado para el bono. No hay nada que pagar dos veces.
- **Sí:** un `CHECK` que amarra el resultado a los números y a `tipo_nomina = 'O'`. Un "Conserva" con más incidencias que el máximo, o un bono en fiscal, no se puede guardar.
- **Sí:** la bitácora escribe una fila por frecuencia que cambió, con columnas anterior y nuevo. El número de campos es fijo.
- **No:** JSON en la bitácora, como en los escalones de la spec 63. Aquí no hace falta.
- **Sí:** en el Detalle, el bono perdido se muestra con $0 y el motivo. **Rompe a propósito la convención** de omitir líneas en 0: el motivo le sirve a quien revisa la nómina. El "No evaluado" sí se omite.
- **Sí:** se extraen a `lib/payroll/incidentSources.ts` los SELECT de Faltas y Retardos, en lugar de copiarlos por tercera vez. Es lo que pide `CLAUDE.md` sobre reuso.
- **Sí:** `#lateness` gana `cuenta_para_descuento`, en lugar de un conteo paralelo solo para el bono. La detección de retardos vive en un solo lugar dentro del batch.
- **Sí:** el aviso "Recalcula" compara el resultado de hoy contra las cinco columnas del snapshot, **más** `punctuality_bonus_settings.updated_at > calculated_at`. El resultado ve justificantes, borrados, checadas nuevas y cambios de tolerancia. La fecha ve los cambios de configuración que no alteran el resultado (por ejemplo, subir el monto de alguien que ya lo perdió).
- **Sí:** el cálculo evalúa en SQL, dentro del mismo batch, y el helper TS solo alimenta la pantalla. **Si difieren, manda el SQL**, como en las specs 53 a 63.
- **Sí:** se usa el horario actual para todo el periodo, igual que en las specs 60, 62 y 63.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| **Calcular antes de que termine el periodo** paga el bono con datos parciales: las faltas solo cuentan hasta ayer y los retardos hasta hoy, así que alguien que falte después del cálculo conserva el bono. | El aviso "Recalcula" aparece en estatus 2 en cuanto cambia el resultado. `docs/nomina.md` remarca: recalcula después de `fecha_fin` antes de aprobar. |
| **Cambiar la regla a `>` modifica periodos ya calculados** (estatus 2) que descontaron retardos de exactamente la tolerancia. | El aviso "Recalcula" de retardos los marca. Los periodos 3 y 4 no se tocan (todavía no existen esas transiciones). |
| **Extraer `incidentSources.ts` y ampliar `#lateness`** tocan Faltas, Retardos y el cálculo, que ya funcionan. | Verificación en los pasos 5 y 9: las pantallas se ven idénticas y el snapshot de un periodo ya calculado queda igual salvo las columnas del bono. |
| **Un checador con el reloj desfasado o que manda el `tipo` equivocado** genera retardos falsos en bloque, y ahora también quita el bono a toda la sucursal. | Se ven en Retardos y en Bonos antes de calcular, y se marcan "No aplica". `docs/nomina.md` lo remarca: revisa Retardos, Faltas y Bonos antes de "Calcular". |
| **Un podólogo sin usuario vinculado activo** nunca se controla, así que no cobra bono y no aparece en ningún aviso. | Es el mismo riesgo de las specs 62 y 63. Revisar la pestaña Usuarios del empleado (spec 55) antes de calcular. |
| **Días festivos o vacaciones** sin checada se detectan como faltas y quitan el bono. | Se marcan "No aplica" en Faltas. El catálogo de festivos es otra spec. |
| **Un checador que deja de mandar checadas** hace que todos los podólogos de la sucursal pierdan el bono. | Igual que en Faltas: revisar antes de calcular y marcar "No aplica" con comentario. |
| **Sin rechazo retroactivo:** justificar un día después de que el periodo esté Aprobado (3) o Pagado (4) no devuelve el bono. | Queda documentado. Quien construya los estatus 3 y 4 debe bloquear esas justificaciones, como en las specs 61 a 63. |
