# 65 — Nómina: bono de asistencia

## Header

- **Estado:** Implementado
- **Depende de:**
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md) y [54 — Detalle de percepciones](54-nomina-detalle-percepciones-empleado.md): `calculatePayrollPeriod`, el snapshot `payroll.period_employees`, `buildPerceptionLines`, la pantalla Detalle y "Total percepciones" en Procesar.
  - [51 — Empleado: periodo de pago](51-periodo-pago-empleado.md) y [52 — Nómina: periodos](52-nomina-periodos.md): la frecuencia del periodo (`id_payment_period`) decide qué configuración del bono se usa.
  - [59 — Empleados: horario semanal estructurado](59-empleado-horario-semanal.md): los días con horario son los días hábiles. Un podólogo sin horario no se evalúa.
  - [62 — Nómina: control de faltas](62-nomina-control-faltas.md): faltas injustificadas (`#absences`, `absence_justifications`) y la población controlada `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION` (usuario vinculado activo con `id_role = 2`).
  - [64 — Nómina: bono de puntualidad](64-nomina-bono-puntualidad.md): la pantalla `/dashboard/nomina/bonos`, el patrón de configuración por empresa y frecuencia con bitácora, `incidentSources.ts`, el snapshot congelado y el aviso "Recalcula". **Esta spec modifica la spec 64:**
    - la pantalla Bonos gana el selector `bono=puntualidad|asistencia`;
    - la tarjeta, el modal y la bitácora de configuración pasan a ser componentes genéricos que usan los dos bonos.
- **Modifica base de datos:** Sí.
  - Tabla nueva `payroll.attendance_bonus_settings`: monto y estatus por empresa y frecuencia.
  - Tabla nueva `payroll.attendance_bonus_settings_log`: bitácora de cambios.
  - Columnas nuevas en `payroll.period_employees` para guardar el resultado del bono: resultado, faltas e importe.
- **Fecha:** 2026-10-01
- **Objetivo:** En la nómina operativa, pagar un bono de asistencia configurable por frecuencia a los podólogos (`id_role = 2`) que estuvieron el periodo completo y no tuvieron ninguna falta injustificada en los días hábiles del periodo.
- **Reglas de origen:** `references/docs/asistencia.md` y `references/nomina/reglas_modulo_nomina.md` (sección 2.2).

## Alcance

**Incluye:**

- **Base de datos** (el DDL se documenta en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 64):
  - `payroll.attendance_bonus_settings`: una fila por empresa y frecuencia (`id_payment_period`), con `monto` y `status`. No tiene máximo, porque una sola falta quita el bono. Semillas: empresa 1, semanal (SAT `02`) y quincenal (SAT `04`), $500, activas. Las demás frecuencias no llevan fila.
  - `payroll.attendance_bonus_settings_log`: bitácora de cambios. Un guardado sin cambios no escribe nada.
  - `payroll.period_employees` gana tres columnas para guardar el resultado del bono: resultado, faltas e importe.
- **Quién se evalúa.** Solo el renglón operativo (`'O'`) de la población de Faltas, Retardos y Bonos: `ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS` + `ABSENCE_CONTROLLED_EMPLOYEE_CONDITION`. Un empleado se evalúa solo si cumple todo esto:
  - la frecuencia del periodo tiene fila en `attendance_bonus_settings` con `status = 1`;
  - `fecha_ingreso <= fecha_inicio`, es decir, estuvo el periodo completo;
  - tiene al menos una fila en `RH.empleado_horarios`.

  Si no cumple alguna, el resultado es **"No evaluado"** con su motivo, y el importe es 0. **No depende de `lateness_settings`**, porque los retardos no afectan este bono.
- **Faltas** = faltas injustificadas en las fechas del periodo, con la detección de la spec 62:
  - Un día hábil es un día con horario.
  - Solo cuentan las faltas hasta el día anterior a hoy.
  - Un día con fila en `absence_justifications` (`'J'` o `'N'`) **no cuenta**.
  - Un día que otro periodo ya descontó **sí cuenta**. El candado de descuento no aplica al bono.
  - Los retardos, graves o acumulables, no cuentan.
- **Resultado.**
  - `faltas = 0` → **Conserva**, con importe = `monto`.
  - `faltas >= 1` → **Pierde**, con importe 0.
  - No hay prorrateo.
- **Helper espejo puro** `lib/payroll/attendanceBonus.ts`: elegibilidad, conteo y resultado, sin BD y sin `Date` sobre strings crudos. Alimenta la pantalla y el Detalle. **En el cálculo manda el SQL.**
- **Pantalla Bonos (`/dashboard/nomina/bonos`), con un selector de bono.**
  - El parámetro de URL `bono=puntualidad|asistencia` elige el bono. Sin el parámetro, o con un valor desconocido, abre en puntualidad, así que los enlaces que ya existen siguen funcionando.
  - El selector son pestañas con `Link`, en un Server Component. Al cambiar de pestaña se conservan `periodo`, `resultado` y `q`, y se reinicia `pagina`.
  - El título y el texto de ayuda cambian según el bono elegido.
  - En asistencia, el estado vive en la URL igual que en puntualidad: `periodo`, `resultado=conserva|pierde|no_evaluado`, `q` y `pagina`, con 25 filas por página.
  - Tarjetas de resumen del periodo completo: cuántos conservan, cuántos pierden, cuántos no se evalúan e importe estimado total. No cambian con los filtros.
  - Tabla por podólogo: empleado, faltas, resultado (con el motivo si es "No evaluado") e importe. El número de faltas lleva a `/dashboard/nomina/faltas` con el mismo periodo y el empleado en la búsqueda. Un cero queda como texto.
  - Avisos: "Bono no configurado para {frecuencia}" (sin fila o con `status = 0`) y "Sin horario definido" (`EmployeesWithoutScheduleNotice`).
  - La tarjeta de configuración, el modal y la bitácora de asistencia se pueden editar siempre.
- **Componentes de configuración genéricos (cambio a la spec 64).** `PunctualityBonusSettingsCard`, `PunctualityBonusSettingsModal` (con `EditPunctualityBonusSettingsButton`) y `PunctualityBonusSettingsLog` se convierten en componentes de bono genéricos.
  - La columna o el campo "Máximo de incidencias" es opcional: lo usa puntualidad y asistencia no.
  - Con puntualidad, se ven y se comportan exactamente igual que hoy.
- **Server actions** en `nomina/bonos/actions.ts`: `getAttendanceBonusPage`, `getAttendanceBonusSettingsLog` y `updateAttendanceBonusSettings`.
  - Pasan por `assertPayrollAccess()`, toman la sucursal y la empresa de la sesión, y validan con `zod` en `lib/payroll/schemas.ts`.
  - `updateAttendanceBonusSettings` valida `monto > 0` con 2 decimales como máximo y acepta solo frecuencias activas. Escribe en una transacción con `UPDLOCK, HOLDLOCK`, hace upsert solo de las frecuencias que cambiaron y escribe una fila de bitácora por cada una.
- **Cálculo** dentro del batch de `calculatePayrollPeriod`, después de `#absences`.
  - Cuenta las faltas de `#absences` por empleado, sin el candado de descuento, y llena las tres columnas en `'O'`. Los renglones `'F'` quedan en `'N'` / 0.
  - Los fragmentos SQL viven en `lib/payroll/attendanceBonusSql.ts`, y los usan el cálculo y el aviso "Recalcula".
- **Aviso "Recalcula"** (`lib/payroll/attendanceBonusRecalculation.ts`, server-only, solo en estatus 2). Se muestra con `PayrollRecalculationNotice` en Procesar y en la pestaña asistencia de Bonos, con el texto "Hay bonos de asistencia que no coinciden con el último cálculo. Recalcula la nómina.", cuando pasa cualquiera de estas cosas:
  - el resultado de hoy (faltas, resultado o importe) de algún renglón `'O'` es distinto del snapshot;
  - `attendance_bonus_settings.updated_at` de la frecuencia del periodo es posterior al `calculated_at`.
- **Procesar:** columna "Bono asist." después de "Bono punt.", con el importe y "Perdido" debajo cuando el resultado es `'P'`. "Total percepciones", la tarjeta de resumen y el pie de la tabla lo suman.
- **Detalle:** `buildPerceptionLines` agrega la línea `bono_asistencia`:
  - Conserva: "Bono de asistencia", "Sin faltas en el periodo", con el importe.
  - Pierde: la misma línea con $0 y "Perdido: N faltas".
  - No evaluado, o vista fiscal: la línea se omite.
- **Documentación:**
  - sección "Bono de asistencia (spec 65)" en `docs/nomina.md`;
  - en el párrafo inicial, el bono pasa de "no construido" a concepto calculado;
  - se ajustan la sección UI y la sección de la spec 64, que mencionaba el bono de asistencia como pendiente.

**No incluye:**

- **Máximo de faltas permitidas.** La regla dice "ninguna".
- **Que las faltas justificadas (`'J'`) quiten el bono.** Una falta justificada no cuenta.
- **Prorrateo** para quien ingresó a mitad del periodo. Ese empleado no se evalúa.
- **Nómina fiscal**, clave SAT, ISR y `payroll.perceptions`.
- **Separar el pago en efectivo** del de transferencia (dispersión, recibos).
- **Configuración por sucursal, por empleado o para otros roles.**
- **Justificar desde la pantalla Bonos.** Se justifica en Faltas.
- **Otorgar o quitar el bono a mano**, y recalcular solo el bono.
- **Vigencias o historial** de la configuración, más allá de la bitácora.
- **Cambios retroactivos** en periodos aprobados (3) o pagados (4).
- **Catálogo de días festivos o vacaciones.** Esos días se marcan "No aplica" en Faltas.
- **Una vista combinada** de los dos bonos en una sola tabla.

## Modelo de datos

**Cambios en BD.** El DDL va en `queries.txt`, bloque `NOMINA PAYROLL`, después de las tablas de la spec 64. Las tablas de la spec 64 no cambian.

```sql
-- Spec 65: bono de asistencia por empresa y frecuencia. Sin fila o status = 0 = no hay bono.
-- No hay máximo: una sola falta injustificada lo quita.
CREATE TABLE [payroll].[attendance_bonus_settings](
    [id_empresa]        [int]           NOT NULL,
    [id_payment_period] [smallint]      NOT NULL,
    [monto]             [decimal](12,2) NOT NULL,   -- importe total del bono en el periodo
    [status]            [bit]           NOT NULL,   -- 1 aplica | 0 no aplica
    [updated_by]        [int]           NOT NULL,
    [updated_at]        [datetime2](0)  NOT NULL,
 CONSTRAINT [PK_attendance_bonus_settings] PRIMARY KEY CLUSTERED ([id_empresa] ASC, [id_payment_period] ASC),
 CONSTRAINT [FK_attendance_bonus_settings_payment_period] FOREIGN KEY ([id_payment_period])
     REFERENCES [RH].[payment_periods] ([id_payment_period]),
 CONSTRAINT [CK_attendance_bonus_settings_valores] CHECK ([monto] > 0)
) ON [PRIMARY]
GO

-- Semillas: semanal (SAT 02) y quincenal (SAT 04), $500, activas.
INSERT INTO [payroll].[attendance_bonus_settings]
    ([id_empresa],[id_payment_period],[monto],[status],[updated_by],[updated_at])
SELECT 1, pp.[id_payment_period], 500.00, 1, 1, '2026-10-01 00:00:00'
FROM [RH].[payment_periods] pp
WHERE pp.[clave_sat] IN ('02', '04')
GO

-- Spec 65: bitácora. Una fila por frecuencia que cambió en el guardado.
CREATE TABLE [payroll].[attendance_bonus_settings_log](
    [id_log]            [int] IDENTITY(1,1) NOT NULL,
    [id_empresa]        [int]            NOT NULL,
    [id_payment_period] [smallint]       NOT NULL,
    [monto_anterior]    [decimal](12,2)  NULL,   -- NULL: no había fila para esa frecuencia
    [monto_nuevo]       [decimal](12,2)  NOT NULL,
    [status_anterior]   [bit]            NULL,
    [status_nuevo]      [bit]            NOT NULL,
    [updated_by]        [int]            NOT NULL,
    [updated_at]        [datetime2](0)   NOT NULL,
 CONSTRAINT [PK_attendance_bonus_settings_log] PRIMARY KEY CLUSTERED ([id_log] ASC)
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_attendance_bonus_settings_log_empresa]
    ON [payroll].[attendance_bonus_settings_log] ([id_empresa], [updated_at] DESC)
GO

-- Spec 65: resultado congelado del bono por renglón de nómina.
-- 'C' conserva | 'P' pierde | 'N' no evaluado (fiscal, sin configuración, ingreso a mitad, sin horario).
-- Los snapshots anteriores quedan en 'N' con importe 0.
ALTER TABLE [payroll].[period_employees] ADD
    [bono_asistencia_resultado] [char](1)       NOT NULL CONSTRAINT [DF_period_employees_bono_asistencia_resultado] DEFAULT ('N'),
    [bono_asistencia_faltas]    [smallint]      NOT NULL CONSTRAINT [DF_period_employees_bono_asistencia_faltas]    DEFAULT (0),
    [importe_bono_asistencia]   [decimal](12,2) NOT NULL CONSTRAINT [DF_period_employees_importe_bono_asistencia]   DEFAULT (0)
GO
ALTER TABLE [payroll].[period_employees] WITH CHECK
    ADD CONSTRAINT [CK_period_employees_bono_asistencia] CHECK (
        ([bono_asistencia_resultado] = 'N'
            AND [bono_asistencia_faltas] = 0 AND [importe_bono_asistencia] = 0)
     OR ([bono_asistencia_resultado] = 'C'
            AND [tipo_nomina] = 'O' AND [bono_asistencia_faltas] = 0 AND [importe_bono_asistencia] > 0)
     OR ([bono_asistencia_resultado] = 'P'
            AND [tipo_nomina] = 'O' AND [bono_asistencia_faltas] > 0 AND [importe_bono_asistencia] = 0))
GO
```

No hay tabla de desglose ni candado. Las faltas que explican el resultado ya se ven en Faltas.

**Tipos compartidos por los dos bonos** (archivo nuevo `interfaces/payroll_bonus.ts`):

```ts
export type BonusKind = "punctuality" | "attendance";

/** 'C' | 'P' | 'N' en BD. `PunctualityBonusResult` pasa a ser un alias de este tipo. */
export type BonusResult = "keeps" | "loses" | "not_evaluated";

/** Fila de configuración que dibujan la tarjeta y el modal genéricos. */
export interface IBonusSetting {
  id_payment_period:   number;
  clave_sat:           string;
  frequencyName:       string;
  monto:               number;
  maximo_incidencias?: number;          // solo puntualidad
  status:              boolean;
  updated_by_name:     string | null;   // null: la frecuencia no tiene fila
  updated_at:          string | null;   // "YYYY-MM-DD HH:mm:ss"
}

/** Fila de la bitácora genérica. Los campos de máximo solo vienen en puntualidad. */
export interface IBonusSettingsLogEntry {
  id_log:                       number;
  frequencyName:                string;
  monto_anterior:               number | null;
  monto_nuevo:                  number;
  maximo_incidencias_anterior?: number | null;
  maximo_incidencias_nuevo?:    number;
  status_anterior:              boolean | null;
  status_nuevo:                 boolean;
  updated_by_name:              string;
  updated_at:                   string;
}
```

`IPunctualityBonusSetting` e `IPunctualityBonusSettingsLogEntry` (spec 64) ya cumplen estas formas, así que no cambian.

**Tipos del bono de asistencia** (archivo nuevo `interfaces/payroll_attendance_bonus.ts`):

```ts
export type AttendanceBonusSkipReason =
  | "bonus_not_configured"   // frecuencia sin fila o con status = 0
  | "joined_mid_period"      // fecha_ingreso > fecha_inicio
  | "no_schedule";           // sin filas en RH.empleado_horarios

export type IAttendanceBonusSetting = Omit<IBonusSetting, "maximo_incidencias">;
export type IAttendanceBonusSettingsLogEntry =
  Omit<IBonusSettingsLogEntry, "maximo_incidencias_anterior" | "maximo_incidencias_nuevo">;

export interface IAttendanceBonusEvaluation {
  absenceCount: number;                              // faltas injustificadas
  result:       BonusResult;
  skipReason:   AttendanceBonusSkipReason | null;    // solo con not_evaluated
  amount:       number;                              // monto o 0
}

export interface IAttendanceBonusEmployeeRow extends IAttendanceBonusEvaluation {
  id_empleado:     number;
  codigo_empleado: string;
  nombre_completo: string;
}

export interface IAttendanceBonusFilters {
  idPeriod: number | null;
  result:   "all" | BonusResult;
  search:   string;
  page:     number;
}

export interface IAttendanceBonusPage {
  period:                   IPayrollPeriod | null;
  periodOptions:            Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  settings:                 IAttendanceBonusSetting[];        // una por frecuencia activa, con o sin fila
  periodSetting:            IAttendanceBonusSetting | null;   // la de la frecuencia del periodo
  rows:                     IAttendanceBonusEmployeeRow[];
  totalRows:                number;
  summary: { keeps: number; loses: number; notEvaluated: number; estimatedAmount: number };
  employeesWithoutSchedule: { id_empleado: number; nombre_completo: string }[];
  recalculationNeeded:      boolean;
}
```

**Cambios en tipos existentes** (`interfaces/payroll_calculation.ts`): `IPayrollEmployeeRow` e `IPayrollEmployeeSnapshot` ganan:

```ts
bono_asistencia_resultado: "C" | "P" | "N";
bono_asistencia_faltas:    number;
importe_bono_asistencia:   number;
```

**URLs** (`lib/payroll/punctualityBonusUrls.ts` se renombra a `lib/payroll/bonusUrls.ts`):

- `PUNCTUALITY_BONUS_RESULT_URL_VALUES` → `BONUS_RESULT_URL_VALUES`, y `readPunctualityBonusResult` → `readBonusResult`. El vocabulario es el mismo en los dos bonos.
- Nuevos `BONUS_KIND_URL_VALUES` (`punctuality: "puntualidad"`, `attendance: "asistencia"`) y `readBonusKind(raw)`, que devuelve `"punctuality"` por default.
- `buildIncidentScreenHref` no cambia.

**Convenciones:**

- **Decimales.** `monto` viaja como número. Al escribir se castea con `CAST(@monto AS decimal(12,2))` y al leer con `CAST(... AS float)`, igual que en la spec 64.
- **"Hoy"** llega como string desde `addZeroToday(new Date())`. En SQL nunca se usa `GETDATE()`. Las faltas cuentan hasta el día anterior a hoy.
- **Ingreso a mitad.** Se compara `fecha_ingreso > fecha_inicio` como string `"YYYY-MM-DD"` en TS, y como `date` en SQL.
- **`updated_at` por frecuencia.** Solo se toca en las filas que cambiaron. El aviso "Recalcula" compara la fila de la frecuencia del periodo.
- **Componentes genéricos.** Reciben `bonusKind: BonusKind`. El modal elige con él la action (`updatePunctualityBonusSettings` o `updateAttendanceBonusSettings`) y si muestra el campo "Máximo de incidencias".

## Plan de implementación

1. **BD.** Correr el DDL del Modelo de datos, con las semillas, y documentarlo en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 64. No cambia nada de código: las columnas nuevas quedan en `'N'` / 0 por defecto y la app sigue igual.
   - Verificación: el `SELECT` de `attendance_bonus_settings` regresa 2 filas (semanal y quincenal, $500, activas).
   - Verificación: todos los snapshots existentes tienen `bono_asistencia_resultado = 'N'`.

2. **Tipos y URLs.**
   - Crear `interfaces/payroll_bonus.ts` e `interfaces/payroll_attendance_bonus.ts`.
   - `PunctualityBonusResult` pasa a ser un alias de `BonusResult`.
   - Agregar las tres columnas del bono a `IPayrollEmployeeRow` e `IPayrollEmployeeSnapshot`, y leerlas en los SELECT de `getPayrollProcessPage` y `getPayrollEmployeeDetail`.
   - Renombrar `lib/payroll/punctualityBonusUrls.ts` a `lib/payroll/bonusUrls.ts` (`BONUS_RESULT_URL_VALUES`, `readBonusResult`) y agregar `BONUS_KIND_URL_VALUES` y `readBonusKind`. Actualizar los imports que existen.
   - Verificación: la app compila, y Procesar y Bonos se ven igual.

3. **Helper puro** `lib/payroll/attendanceBonus.ts`, sin BD y sin `Date` sobre strings crudos:
   - `evaluateAttendanceBonus({ setting, fechaIngreso, fechaInicio, hasSchedule, absenceCount })` devuelve `IAttendanceBonusEvaluation`. Los motivos de "No evaluado" se revisan en el orden de `AttendanceBonusSkipReason`.
   - `describeAttendanceBonus(snapshot)` da los textos de la línea del Detalle.
   - `describeAttendanceBonusSkipReason(reason)` da el texto del motivo en la tabla.

   Verificación manual: 0 faltas → `keeps` con el monto; 1 falta → `loses` con 0; `fecha_ingreso` un día después de `fecha_inicio` → `not_evaluated` / `joined_mid_period`; sin configuración → `bonus_not_configured`, aunque el empleado también ingresara a mitad del periodo.

4. **Componentes genéricos de configuración (refactor, sin cambio visible).**
   - En `nomina/bonos/componentes/`, `PunctualityBonusSettingsCard` → `BonusSettingsCard`, `PunctualityBonusSettingsModal` → `BonusSettingsModal` (con `EditBonusSettingsButton`) y `PunctualityBonusSettingsLog` → `BonusSettingsLog`. Todos reciben `bonusKind`, y el campo o la columna "Máximo de incidencias" se muestra solo con `punctuality`.
   - `PunctualityBonusToolbar` → `BonusResultToolbar`: su contenido ya es genérico.
   - Verificación: la pestaña de puntualidad se ve y se comporta exactamente igual. Editar el máximo quincenal sigue guardando y escribiendo la bitácora.

5. **Selector de bono.**
   - Mover el cuerpo actual de `bonos/page.tsx` a `PunctualityBonusView`, un Server Component.
   - Crear `BonusKindTabs`: un Server Component con dos `Link` que conservan `periodo`, `resultado` y `q`, y quitan `pagina`.
   - `page.tsx` lee `bono` con `readBonusKind` y muestra las pestañas y la vista que toca. Por ahora, la vista de asistencia es un `PayrollEmptyState` que dice "Próximamente".
   - Verificación: `/dashboard/nomina/bonos` y `?bono=puntualidad` muestran lo mismo que antes, y `?bono=xyz` abre en puntualidad.

6. **Lectura de asistencia.**
   - Agregar `ATTENDANCE_BONUS_PAGE_SIZE = 25` a `lib/payroll/constants.ts`.
   - Agregar a `lib/payroll/schemas.ts` el schema `zod` de filtros.
   - Crear en `nomina/bonos/actions.ts` las actions `getAttendanceBonusPage` y `getAttendanceBonusSettingsLog`.
   - `getAttendanceBonusPage` hace esto:
     - carga la configuración de las frecuencias activas;
     - usa las fuentes de `lib/payroll/incidentSources.ts` (empleados controlados, horarios, días con checada, justificaciones);
     - detecta las faltas con el helper de la spec 62, sin quitar los días que otro periodo ya descontó;
     - evalúa con el helper del paso 3, arma el resumen, filtra y pagina.
   - `recalculationNeeded` queda en `false` por ahora.

7. **Pestaña de asistencia, solo lectura.** Sustituir el "Próximamente" por `AttendanceBonusView`, un Server Component con:
   - `BonusResultToolbar`;
   - `AttendanceBonusSummaryCards` y `AttendanceBonusEmployeesTable`, Server Components. La tabla lleva el enlace a Faltas en el número de faltas y `bono=asistencia` en la paginación;
   - el aviso "Bono no configurado para {frecuencia}" y `EmployeesWithoutScheduleNotice`;
   - `BonusSettingsCard` y `BonusSettingsLog` con `bonusKind="attendance"`, todavía sin botón de editar.

   Verificación: en un periodo quincenal, un podólogo sin faltas aparece como "Conserva $500" y uno con 1 falta injustificada aparece como "Pierde $0".

8. **Editar la configuración de asistencia.**
   - Agregar el schema `zod` `updateAttendanceBonusSettingsSchema` (`monto > 0` con 2 decimales como máximo, sin frecuencias repetidas).
   - Crear `updateAttendanceBonusSettings`: una transacción que lee las filas de la empresa con `UPDLOCK, HOLDLOCK` y acepta solo frecuencias activas de `PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY`. Hace upsert solo de las frecuencias que cambiaron, con `updated_at = buildDate(new Date())`, y escribe una fila de bitácora por cada una. Sin cambios, no escribe nada.
   - Conectar `BonusSettingsModal` con `bonusKind="attendance"` y mostrar el botón de editar.

   Verificación: apagar el estatus quincenal hace que todos queden "No evaluado" y aparezca el aviso "Bono no configurado para Quincenal". La bitácora muestra el cambio.

9. **Cálculo.**
   - Crear `lib/payroll/attendanceBonusSql.ts` con `ATTENDANCE_BONUS_APPLY_SQL`, `ATTENDANCE_BONUS_COLUMNS`, `ATTENDANCE_BONUS_INSERT_COLUMNS_SQL` y `ATTENDANCE_BONUS_SELECT_SQL`, siguiendo el patrón de `punctualityBonusSql.ts`. Los `APPLY` usan alias propios (`attendance_counts`, `attendance_setting`, `attendance_result`) para no chocar con los de puntualidad.
   - En el batch de `calculatePayrollPeriod`, después de `#absences`, contar las faltas de `#absences` por empleado sin el filtro del candado. Evaluar en orden: la fila de `attendance_bonus_settings` de la frecuencia con `status = 1`, `fecha_ingreso <= fecha_inicio` y la existencia de horario. Después llenar las tres columnas. Solo en `'O'`; los renglones `'F'` quedan en `'N'` / 0.

   Verificación: comparar el snapshot de un periodo ya calculado antes y después de este paso. Debe quedar idéntico salvo las tres columnas nuevas, `calculated_at` y `calculated_by` (en particular `dias_falta`, `importe_salario` y las cinco columnas del bono de puntualidad).

10. **Procesar y Detalle.**
    - `getPayrollProcessPage` suma `importe_bono_asistencia` a "Total percepciones", a la tarjeta de resumen y al pie de la tabla.
    - `PayrollEmployeesTable` agrega la columna "Bono asist." después de "Bono punt.": el importe, más el texto "Perdido" debajo cuando `resultado = 'P'`.
    - `buildPerceptionLines` agrega `bono_asistencia` con `describeAttendanceBonus`:
      - con `'C'`, "Sin faltas en el periodo" y el importe;
      - con `'P'`, $0 y "Perdido: N faltas";
      - con `'N'` y en la vista fiscal, la línea se omite.

11. **Aviso "Recalcula".**
    - Crear `lib/payroll/attendanceBonusRecalculation.ts` con `isAttendanceBonusRecalculationNeeded(idPeriod)`, server-only y solo para estatus 2. Es un `SELECT` con `EXISTS` que usa los fragmentos del paso 9 y busca:
      - un renglón `'O'` cuyo resultado, faltas o importe de hoy sean distintos del snapshot;
      - `attendance_bonus_settings.updated_at` de la frecuencia del periodo posterior a `MIN(calculated_at)` del periodo.
    - Se muestra con `PayrollRecalculationNotice` en Procesar (`attendanceBonusRecalculationNeeded`) y en la pestaña de asistencia (`recalculationNeeded`).

    Verificación: justificar en Faltas la única falta de un podólogo que perdió el bono muestra el aviso en Procesar y en la pestaña, y el aviso desaparece después de "Recalcular".

12. **Documentación.** En `docs/nomina.md`:
    - agregar la sección "Bono de asistencia (spec 65)";
    - actualizar el párrafo inicial: el bono pasa a ser concepto calculado y se agregan sus tablas y la pestaña;
    - en la sección de la spec 64, cambiar "el bono de asistencia es otra spec" por una referencia a la spec 65, y anotar los componentes genéricos;
    - actualizar la sección UI y la lista de líneas del Detalle.

## Criterios de aceptación

**Base de datos**

- [x] Existen `payroll.attendance_bonus_settings` y `payroll.attendance_bonus_settings_log`.
- [x] `payroll.period_employees` tiene `bono_asistencia_resultado`, `bono_asistencia_faltas` e `importe_bono_asistencia`.
- [x] El DDL está en `queries.txt`, bloque `NOMINA PAYROLL`.
- [x] Las semillas dejan a la empresa 1 con semanal (`02`) y quincenal (`04`) en $500, activas.
- [x] Los snapshots calculados antes de esta spec tienen `bono_asistencia_resultado = 'N'` e `importe_bono_asistencia = 0`.
- [x] Insertar a mano cualquiera de estos renglones falla por `CK_period_employees_bono_asistencia`:
  - un renglón `'F'` con resultado `'C'`;
  - un `'C'` con `bono_asistencia_faltas = 1`;
  - un `'P'` con `bono_asistencia_faltas = 0`.
- [x] Insertar `monto = 0` en `attendance_bonus_settings` falla por `CK_attendance_bonus_settings_valores`.

**Refactor de la spec 64**

- [x] `/dashboard/nomina/bonos` sin parámetro `bono`, con `bono=puntualidad` o con un valor desconocido muestra la pestaña de puntualidad. La tarjeta de configuración, el modal (con el campo "Máximo de incidencias"), la bitácora, la tabla y los avisos se ven igual que antes de esta spec.
- [x] Editar la configuración de puntualidad sigue guardando y escribiendo su propia bitácora, sin tocar `attendance_bonus_settings_log`.

**Selector de bono**

- [x] Las pestañas "Puntualidad" y "Asistencia" se ven arriba de la pantalla Bonos, y la activa está marcada.
- [x] Cambiar de pestaña conserva `periodo`, `resultado` y `q`, y regresa a la página 1.
- [x] En la pestaña de asistencia, la paginación y los filtros conservan `bono=asistencia`.

**Evaluación (pestaña de asistencia)**

- [x] En un periodo quincenal con las semillas, un podólogo sin faltas aparece como "Conserva" con $500.
- [x] Un podólogo con 1 falta injustificada aparece como "Pierde" con $0.
- [x] Una falta con justificante (`'J'`) o marcada "No aplica" (`'N'`) no quita el bono.
- [x] Un podólogo con retardos graves o acumulables y sin faltas aparece como "Conserva".
- [x] Una falta que otro periodo ya descontó sí quita el bono en este periodo.
- [x] Un día de hoy sin checada no cuenta como falta.
- [x] Un podólogo con `fecha_ingreso` posterior a `fecha_inicio` aparece como "No evaluado — Ingresó a mitad del periodo" con $0.
- [x] Un podólogo sin horario aparece como "No evaluado — Sin horario" y en el aviso "Sin horario definido".
- [x] Un empleado sin usuario vinculado con `id_role = 2` y `status = 1` **no** aparece en la pestaña.
- [x] En un periodo mensual (sin fila) todos aparecen como "No evaluado" y se muestra "Bono no configurado para Mensual". Pasa lo mismo con una frecuencia con `status = 0`.
- [x] Con la empresa sin fila en `lateness_settings`, el bono de asistencia se sigue evaluando con normalidad.
- [x] Las tarjetas de resumen (conservan, pierden, no evaluados e importe estimado) no cambian al filtrar por resultado o búsqueda.
- [x] Hacer clic en el número de faltas lleva a `/dashboard/nomina/faltas` con el mismo periodo y el empleado en la búsqueda. Un 0 no es enlace.

**Configuración**

- [x] El modal de asistencia muestra una fila por frecuencia activa, tenga o no configuración, con monto y estatus y **sin** campo de máximo.
- [x] Cambiar el monto quincenal a $600 hace que quien conserva el bono muestre $600. La bitácora de asistencia agrega una fila para la frecuencia quincenal y ninguna para la semanal.
- [x] Guardar sin cambios no escribe ninguna fila en la bitácora ni cambia `updated_at`.
- [x] Guardar `monto = 0` o un monto con 3 decimales muestra un error en el modal y no guarda nada.
- [x] Configurar por primera vez una frecuencia sin fila (por ejemplo, mensual) crea la fila y escribe la bitácora con los valores anteriores en `NULL`.
- [x] Un usuario con rol 2, 3, 5 o 6 que llama a `updateAttendanceBonusSettings` directamente recibe `{ ok: false }`.

**Cálculo**

- [x] Recalcular un periodo ya calculado deja idénticas las columnas `dias`, `dias_falta`, `dias_retardo`, `importe_salario`, las de comisiones, las de horas extra y las cinco del bono de puntualidad.
- [x] Un podólogo quincenal sin faltas queda con `'C'` e `importe_bono_asistencia = 500` en su renglón `'O'`.
- [x] Con 2 faltas queda con `'P'`, `bono_asistencia_faltas = 2` e importe 0.
- [x] El renglón `'F'` del mismo podólogo queda con `'N'` e importe 0.
- [x] Un empleado no controlado (sin usuario podólogo activo) queda con `'N'` en `'O'`.
- [x] Con `fecha_ingreso > fecha_inicio`, sin horario, o con la frecuencia sin fila o con `status = 0`, el renglón queda con `'N'` e importe 0.
- [x] Un periodo calculado a mitad de su rango y recalculado después de que aparece una falta nueva cambia de `'C'` a `'P'`.
- [x] "Revertir" deja el periodo sin snapshot. Al calcular de nuevo, el bono se evalúa desde cero.

**Procesar y Detalle**

- [x] En Procesar, la columna "Bono asist." aparece después de "Bono punt.". Muestra $500 para quien conserva y $0 con "Perdido" para quien pierde.
- [x] "Total percepciones", la tarjeta y el pie incluyen el bono de asistencia, y no cambian con los filtros de puesto o búsqueda.
- [x] En el Detalle (operativa), quien conserva ve "Bono de asistencia" con "Sin faltas en el periodo" y $500.
- [x] Quien pierde ve la línea con $0 y "Perdido: N faltas".
- [x] Con resultado `'N'`, o en la vista fiscal, la línea no aparece.
- [x] El importe mostrado siempre es el guardado en el snapshot.

**Aviso "Recalcula"**

- [x] Con el periodo en estatus 2, justificar en Faltas la única falta de un podólogo que perdió el bono muestra "Hay bonos de asistencia que no coinciden con el último cálculo. Recalcula la nómina." en Procesar y en la pestaña de asistencia.
- [x] Con el periodo en estatus 2, cambiar el monto o el estatus de asistencia de la frecuencia del periodo muestra el aviso. Cambiar otra frecuencia no lo muestra, ni tampoco cambiar la configuración de puntualidad.
- [x] Una falta nueva que cambia el resultado muestra el aviso.
- [x] Después de "Recalcular", el aviso desaparece.
- [x] Con el periodo en estatus 1, el aviso nunca aparece.
- [x] Faltas, Retardos, Horas extra y el bono de puntualidad siguen mostrando su propio aviso con su texto de siempre.

**Documentación**

- [x] `docs/nomina.md` tiene la sección "Bono de asistencia (spec 65)".
- [x] El párrafo inicial menciona el bono de asistencia como concepto calculado.
- [x] La sección de la spec 64 ya no lo presenta como pendiente.

## Decisiones tomadas y descartadas

- **Sí:** solo las faltas **injustificadas** quitan el bono. Un día con justificante (`'J'`) o marcado "No aplica" (`'N'`) no cuenta. Es decisión del usuario, para que funcione igual que el bono de puntualidad y que el descuento de sueldo: el justificante tiene el mismo efecto en todo.
- **No:** que una falta justificada (`'J'`) también quite el bono por ser "por no faltar". Se descartó para no tener dos criterios distintos sobre la misma falta.
- **No:** un máximo de faltas configurable. La regla de `asistencia.md` dice "ninguna falta". Si algún día se quiere tolerar faltas, el campo se agrega en otra spec.
- **Sí:** monto y estatus **por empresa y frecuencia**, con bitácora, igual que en la spec 64.
- **Sí:** semillas semanal y quincenal con $500. Es decisión del usuario, aunque un podólogo semanal cobre más bono al mes que uno quincenal.
- **Sí:** tablas propias (`attendance_bonus_settings`, `attendance_bonus_settings_log`) y columnas propias en `period_employees`. Es decisión del usuario: no toca lo que ya funciona de la spec 64, y los dos bonos tienen campos distintos.
- **No:** una tabla genérica `payroll.bonus_settings` con `tipo_bono`. Obligaría a migrar la spec 64, ya implementada, y llenaría de `NULL` el máximo de asistencia.
- **Sí:** un `CHECK` que amarra el resultado al número de faltas y a `tipo_nomina = 'O'`. Un "Conserva" con faltas, o un bono en la nómina fiscal, no se puede guardar.
- **Sí:** solo nómina operativa (`'O'`). Es decisión del usuario: `reglas_modulo_nomina.md` pone los bonos en "Pago en Efectivo", igual que el de puntualidad.
- **Sí:** misma población que Faltas, Retardos y el bono de puntualidad (`ABSENCE_CONTROLLED_EMPLOYEE_CONDITION`, `id_role = 2`), sin constante nueva. `asistencia.md` dice "solo empleados vinculados a un usuario con rol 2".
- **Sí:** quien ingresó después de `fecha_inicio` no se evalúa, y no hay prorrateo. Es decisión del usuario, con el mismo criterio de la spec 64.
- **Sí:** un podólogo sin horario no se evalúa. Sin horario no puede tener faltas y "ganaría" el bono por default.
- **Sí:** el bono **no depende de `lateness_settings`**. A diferencia del de puntualidad, no necesita tolerancia, porque los retardos no lo afectan.
- **Sí:** los retardos (graves o acumulables) no afectan este bono. La regla solo habla de faltas, y los retardos ya pesan en el bono de puntualidad.
- **Sí:** una falta que otro periodo ya descontó sí quita el bono. Es decisión del usuario: el bono mira lo que pasó en las fechas del periodo, y el candado de descuento existe para no descontar dos veces, no para decidir si hubo falta.
- **Sí:** el bono vive como pestaña dentro de `/dashboard/nomina/bonos` (`bono=puntualidad|asistencia`). Es decisión del usuario: reutiliza la pantalla que la spec 64 dejó preparada, sin mezclar los dos bonos y sin otra entrada en el menú.
- **No:** una sola tabla con columnas de los dos bonos. Mezcla reglas distintas y vuelve más difícil filtrar por resultado.
- **No:** una pantalla aparte para el bono de asistencia.
- **Sí:** sin `bono`, o con un valor desconocido, la pantalla abre en puntualidad. Así los enlaces y marcadores que ya existen siguen funcionando.
- **Sí:** las pestañas son `Link` en un Server Component, sin `"use client"`. Cambiar de bono es navegación, no estado del cliente.
- **Sí:** la tarjeta, el modal y la bitácora de configuración se vuelven genéricos (`BonusSettings*` con `bonusKind`). Es decisión del usuario, porque la configuración es casi idéntica, y es lo que pide `CLAUDE.md` sobre reuso.
- **No:** componentes genéricos para la tabla y las tarjetas de resumen. Las columnas son distintas (retardos, incidencias y máximo solo existen en puntualidad), y un componente con muchos condicionales sería más difícil de mantener que dos sencillos.
- **Sí:** `punctualityBonusUrls.ts` se renombra a `bonusUrls.ts`, porque el vocabulario de `resultado` es el mismo en los dos bonos.
- **Sí:** el cuerpo actual de `bonos/page.tsx` se mueve a `PunctualityBonusView`, y `page.tsx` solo elige la vista. Cada bono tiene su propia carga de datos y no se piden los dos a la vez.
- **Sí:** en el Detalle, el bono perdido se muestra con $0 y "Perdido: N faltas", y el "No evaluado" se omite. Es decisión del usuario, con la misma excepción a la convención de omitir líneas en 0 que hizo la spec 64.
- **Sí:** aviso "Recalcula" propio, con su texto. Compara el resultado de hoy con el snapshot **y** `updated_at > calculated_at` de la frecuencia del periodo, con el mismo razonamiento de la spec 64.
- **Sí:** el cálculo evalúa en SQL, dentro del mismo batch y contando sobre `#absences`, y el helper TS solo alimenta la pantalla. **Si difieren, manda el SQL**, como en las specs 53 a 64.
- **Sí:** los `APPLY` del bono de asistencia usan alias propios (`attendance_*`). Así conviven en el mismo `SELECT` del `INSERT` con los `bonus_*` de puntualidad sin chocar.
- **Sí:** se usa el horario actual para todo el periodo, igual que en las specs 60 a 64.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| **Si se calcula antes de que termine el periodo, el bono se paga con datos parciales.** Las faltas solo cuentan hasta ayer, así que alguien que falte después del cálculo conserva el bono. | El aviso "Recalcula" aparece en estatus 2 en cuanto cambia el resultado. `docs/nomina.md` lo remarca: recalcula después de `fecha_fin` y antes de aprobar. |
| **El refactor de los componentes de configuración y de `bonos/page.tsx`** toca la pantalla del bono de puntualidad, que ya funciona. | Los pasos 4 y 5 son refactors sin cambio visible, con verificación propia. Los criterios "Refactor de la spec 64" lo comprueban antes de agregar asistencia. |
| **Agregar más columnas y `APPLY` al `INSERT` de `calculatePayrollPeriod`**, que ya encadena salario, faltas, retardos, comisiones, horas extra y puntualidad. Un alias repetido o una columna fuera de orden rompe el cálculo de todos. | Los alias son propios (`attendance_*`), y las columnas y expresiones se arman desde `ATTENDANCE_BONUS_COLUMNS` en el mismo orden. Verificación del paso 9: el snapshot de un periodo ya calculado queda idéntico salvo las tres columnas nuevas. |
| **Un día festivo o de vacaciones** sin checada se detecta como falta y quita el bono. Con una sola falta basta, así que afecta a toda la sucursal. | Esos días se marcan "No aplica" en Faltas. `docs/nomina.md` remarca que hay que revisar Faltas y Bonos antes de "Calcular". El catálogo de festivos va en otra spec. |
| **Un checador que deja de mandar checadas** hace que todos los podólogos de la sucursal pierdan el bono. | Igual que en Faltas: revisar antes de calcular y marcar "No aplica" con un comentario. |
| **Un podólogo sin usuario vinculado activo** nunca se controla, así que no cobra el bono y no aparece en ningún aviso. | Es el mismo riesgo de las specs 62 a 64. Revisar la pestaña Usuarios del empleado (spec 55) antes de calcular. |
| **La detección de faltas ahora está copiada en un sitio más:** el cálculo, el helper TS y cuatro módulos "Recalcula". | Los fragmentos SQL del bono viven en un solo archivo (`attendanceBonusSql.ts`), que comparten el cálculo y el aviso. `docs/nomina.md` deja anotado que hay que mantenerlos sincronizados. |
| **No hay cambios retroactivos:** justificar una falta cuando el periodo ya está Aprobado (3) o Pagado (4) no devuelve el bono. | Queda documentado. Quien construya los estatus 3 y 4 debe bloquear esas justificaciones, como en las specs 61 a 64. |

## Lo que no incluye esta spec

- Máximo de faltas permitidas.
- Que las faltas justificadas (`'J'`) quiten el bono.
- Prorrateo para quien ingresó a mitad del periodo.
- Nómina fiscal, clave SAT, ISR y `payroll.perceptions`.
- Separar el pago en efectivo del de transferencia.
- Configuración por sucursal, por empleado o para otros roles.
- Justificar desde la pantalla Bonos.
- Otorgar o quitar el bono a mano, y recalcular solo el bono.
- Vigencias o historial de la configuración, más allá de la bitácora.
- Cambios retroactivos en periodos aprobados (3) o pagados (4).
- Catálogo de días festivos o vacaciones.
- Una vista combinada de los dos bonos en una sola tabla.

Cada uno de estos puntos, si se llega a hacer, va en su propia spec.
