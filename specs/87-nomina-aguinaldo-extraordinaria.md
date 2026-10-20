# 87 — Aguinaldo anual en nómina extraordinaria

## Header

- **Estado:** Implementado
- **Depende de:**
  - 52 (`nomina-periodos`): `payroll.periods`, código, estatus, modal de periodo.
  - 53 (`nomina-calculo-salario`): `payroll.period_employees`, `calculatePayrollPeriod`, Procesar.
  - 54 (`nomina-detalle-percepciones-empleado`): Detalle por empleado, `buildPerceptionLines`.
  - 69 (`nomina-parametros-fiscales-isr`): `tax_parameters` (UMA), `tablas_retencion`, catálogo `perceptions` (aguinaldo `'U'` 30 UMA por año).
  - 70 (`nomina-calculo-isr-fiscal`): patrón de ISR, `period_employee_deductions`, avisos "No calculado" y "Recalcula".
  - 73 (`nomina-motor-gravado-exento`): motor gravado/exento con acumulado anual entre periodos.
  - 86 (`empleado-causas-baja`): los dados de baja quedan fuera (su aguinaldo irá en el finiquito, spec 88).
- **Modifica base de datos:** Sí.
  - `payroll.periods` gana `tipo_periodo` (`'O'` ordinaria / `'E'` extraordinaria).
  - `payroll.period_employees` gana las columnas del aguinaldo; tabla nueva para el ISR art. 174 RLISR.
  - `tablas_retencion` empieza a recibir la tarifa **mensual**.
- **Fecha:** 2026-10-16
- **Objetivo:** Calcular el aguinaldo anual (15 días de salario diario, proporcional a los días del año) en una nómina extraordinaria por sucursal, operativa y fiscal, con exento de 30 UMA anuales e ISR por el art. 174 RLISR.

### Contexto (2026-10-16)

- Reglas de origen: `references/docs/aguinaldo.md`.
- Hoy `payroll.periods` solo tiene periodos ordinarios por frecuencia, y la periodicidad SAT 99 nunca se ofrece.
- El catálogo `payroll.perceptions` ya tiene el aguinaldo (clave SAT 002, `'U'`, 30 UMA, periodicidad `'A'`), pero ningún cálculo lo genera.
- El motor de la spec 73 ya acumula el exento anual entre periodos del mismo año (`exento_consumido_previo`). Con eso, un pago futuro en dos exhibiciones no excedería las 30 UMA.
- La tarifa ISR solo está cargada para la frecuencia semanal (spec 69).
- Se dividió el doc de origen en tres:
  - **87 (esta):** aguinaldo anual.
  - **88:** finiquito y liquidación al dar de baja.
  - **Posteriores:** ISN de CDMX y timbrado del CFDI extraordinario.

## Alcance

**Entra:**

- **Tipo de periodo.**
  - `payroll.periods` gana `tipo_periodo` (`'O'` ordinaria, el default de todos los periodos existentes; `'E'` extraordinaria).
  - Un periodo E usa la periodicidad SAT **99** y su código es `NOM-{ejercicio}-E{consecutivo}` (p. ej. `NOM-2026-E01`).
  - Solo puede haber **un periodo E por sucursal y ejercicio**, garantizado con un índice único filtrado.
- **Crear el periodo E.** El modal de Periodos gana un selector "Ordinaria | Extraordinaria (aguinaldo)". En extraordinaria:
  - se elige el año y se oculta la frecuencia;
  - `fecha_inicio` = 1-ene y `fecha_fin` = 31-dic, fijas y no editables;
  - `fecha_pago` se sugiere el 20-dic y es editable; `fecha_corte` = `fecha_pago`, también editable;
  - si `fecha_pago` > 20-dic, el modal muestra una advertencia ámbar pero **no bloquea** el guardado.
  - Editar y eliminar siguen las reglas actuales (solo en estatus 1).
- **Listado de Periodos.** Badge "Extraordinaria" en las filas E.
- **Calcular el periodo E** (`calculatePayrollPeriod` se bifurca por `tipo_periodo`).
  - **Quién entra:** empleados con `status = 1`, `activo = 1`, la sucursal del periodo, **cualquier frecuencia de pago (incluso sin `id_periodo_pago`)**, `fecha_ingreso ≤ fecha_fin` y salario > 0 del tipo (`salario_diario` en `'O'`, `salario_diario_fiscal` en `'F'`).
  - **Días** = `fecha_fin − max(fecha_inicio, fecha_ingreso) + 1`. Cuenta como laborado hasta el 31-dic aunque se calcule antes, y **no descuenta faltas**.
  - **Importe** = `ROUND(salario_diario × 15 × días / 365, 2)` con el salario del tipo. Se usa 365 fijo, también en año bisiesto.
  - El periodo E **no genera ningún otro concepto**: sueldo, comisiones, bonos, horas extra, faltas, retardos y vacaciones quedan en 0.
- **Fiscal (`'F'`):**
  - una línea de percepción **aguinaldo (clave 002)** pasa por el motor de la spec 73: exento hasta 30 UMA **por año**, acumulado entre periodos del mismo año, y gravado el excedente;
  - **ISR por el art. 174 RLISR** sobre el gravado, con la tarifa **mensual** del año de `fecha_fin` y un ingreso ordinario mensual = `salario_diario_fiscal × 30.4`;
  - **sin subsidio al empleo**;
  - gravado 0 → ISR calculado en 0;
  - sin tarifa mensual → ISR "No calculado" con su motivo;
  - el ISR se guarda como deducción `id_deduction = 2`.
  - La operativa no tiene ISR: su neto es el aguinaldo.
- **Tarifa mensual.** La pestaña "Tarifa ISR" de Parámetros fiscales gana un selector **Semanal | Mensual**. Captura, validación (sin traslapes, huecos marcados) y "Copiar de {año-1}" funcionan **por frecuencia**.
- **Procesar con un periodo E.** Columnas:
  - en la operativa: Días, Salario diario y Aguinaldo;
  - en la fiscal: además Gravado, Exento, ISR y Neto.

  Las tarjetas de resumen y el pie suman lo mismo. Se reutilizan el aviso de excluidos y el de ISR no calculado.
- **Detalle con un periodo E.**
  - Línea "Aguinaldo" con "15 días × N/365 × $X" y la nota "Ingresó el DD/MM/AAAA, proporcional" cuando aplica.
  - En la fiscal, el gravado/exento con su regla y una tarjeta de ISR art. 174 con cada paso congelado: ordinario mensual, parte mensualizada, ISR de cada tarifa, diferencia, tasa e ISR retenido.
- **Pantallas solo ordinarias.** Horas extra, Faltas, Retardos y Bonos **no listan periodos E** en su selector ni los resuelven como "periodo actual".
- **Aviso del 20 de diciembre.** Del 1-dic en adelante, Periodos y Procesar muestran "Aguinaldo {año}: debe pagarse a más tardar el 20 de diciembre" mientras la sucursal **no tenga creado** el periodo E de ese año. Es ámbar hasta el 20-dic y rojo ("venció el 20 de diciembre") después.
- **Aviso "Recalcula" del periodo E** (solo en estatus 2), cuando cambió:
  - el salario diario del tipo o la `fecha_ingreso` respecto del snapshot;
  - la UMA o la regla del catálogo (el aviso de exento de la spec 73 ya lo ve);
  - la tarifa mensual o el ingreso ordinario usados por el ISR art. 174.

  El aviso de ISR de la spec 70 **ignora los periodos E**.
- **TS espejo, puro:** aguinaldo e ISR art. 174 en `lib/payroll/`. Si difieren del SQL, gana el SQL.
- **Permisos y validación:** roles 1 y 4 (los tres candados actuales) y `zod` en todas las entradas.
- **Documentación:** `docs/nomina.md` y el DDL en `queries.txt`.

**Fuera de alcance:**

- **Finiquito y liquidación** (spec 88): aguinaldo, vacaciones y prima proporcionales al dar de baja, indemnizaciones y prima de antigüedad.
- **Salario variable:** la base es solo salario diario × 15, sin promediar comisiones ni bonos.
- Pagar en varias exhibiciones o por porcentaje (un solo periodo E al 100%).
- Descontar faltas, incapacidades o permisos de los días del aguinaldo.
- Subsidio al empleo (no aplica por regla), IMSS (el SBC ya integra el factor) e ISN de CDMX.
- Timbrado del CFDI extraordinario, recibos, dispersión y los estatus Aprobada/Pagada.
- Ajuste manual del importe o de los días, y ajuste anual de ISR (art. 97).
- Otros conceptos extraordinarios (PTU).
- Tarifas de otras frecuencias además de la semanal y la mensual.
- Repartir el aguinaldo entre sucursales cuando el empleado cambió de sucursal en el año: cobra todo en la actual.
- Aguinaldo de los dados de baja en el año o del registro anterior de un reingreso.
- Bloquear una `fecha_pago` posterior al 20-dic (solo se advierte).

## Modelo de datos

### SQL (DDL en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 78)

```sql
-- Spec 87: tipo de periodo. Todos los existentes quedan 'O'.
ALTER TABLE [payroll].[periods] ADD [tipo_periodo] [char](1) NOT NULL
    CONSTRAINT [DF_periods_tipo_periodo] DEFAULT ('O');
GO
ALTER TABLE [payroll].[periods] ADD
    CONSTRAINT [CK_periods_tipo_periodo] CHECK ([tipo_periodo] IN ('O','E')),
    -- El periodo E cubre exactamente el año de su ejercicio.
    CONSTRAINT [CK_periods_extraordinaria_fechas] CHECK (
        [tipo_periodo] = 'O'
     OR ([fecha_inicio] = DATEFROMPARTS([ejercicio], 1, 1)
         AND [fecha_fin] = DATEFROMPARTS([ejercicio], 12, 31)));
GO
-- Un solo periodo E por sucursal y ejercicio (también se revisa en la transacción de alta).
CREATE UNIQUE NONCLUSTERED INDEX [UX_periods_extraordinaria_sucursal_ejercicio]
    ON [payroll].[periods] ([id_sucursal], [ejercicio])
    WHERE [tipo_periodo] = 'E';
GO

-- Snapshot del aguinaldo. En filas de periodos 'O' siempre 0.
ALTER TABLE [payroll].[period_employees] ADD
    [dias_aguinaldo]    [smallint]      NOT NULL CONSTRAINT [DF_period_employees_dias_aguinaldo]    DEFAULT (0),
    [importe_aguinaldo] [decimal](18,2) NOT NULL CONSTRAINT [DF_period_employees_importe_aguinaldo] DEFAULT (0);
GO
ALTER TABLE [payroll].[period_employees] ADD
    CONSTRAINT [CK_period_employees_aguinaldo] CHECK (
        [dias_aguinaldo] BETWEEN 0 AND 366 AND [importe_aguinaldo] >= 0);
GO

-- ISR art. 174 RLISR: una fila por fila 'F' de un periodo E. Las columnas isr_* de la
-- spec 70 se quedan en 'X' en esas filas; esta tabla es la fuente de su ISR.
CREATE TABLE [payroll].[period_employee_isr_article174](
    [id_period_employee]          [int]           NOT NULL,
    [isr_estado]                  [char](1)       NOT NULL,   -- 'C' calculado, 'N' no calculado
    [isr_motivo]                  [varchar](30)   NULL,       -- solo 'N'
    [base_gravable]               [decimal](18,2) NULL,       -- gravado del aguinaldo; NULL con exemption_not_calculated
    [ingreso_ordinario_mensual]   [decimal](18,2) NULL,       -- ROUND(salario_diario_fiscal × 30.4, 2)
    [parte_mensualizada]          [decimal](18,2) NULL,       -- ROUND(base_gravable / 365 × 30.4, 2)
    [ejercicio_tarifa]            [int]           NULL,       -- YEAR(fecha_fin)
    -- Tramo del ordinario solo
    [limite_inferior_ordinario]   [decimal](18,2) NULL,
    [cuota_fija_ordinario]        [decimal](18,2) NULL,
    [porcentaje_ordinario]        [decimal](5,2)  NULL,
    [isr_ordinario]               [decimal](18,2) NULL,
    -- Tramo del ordinario + parte mensualizada
    [limite_inferior_total]       [decimal](18,2) NULL,
    [cuota_fija_total]            [decimal](18,2) NULL,
    [porcentaje_total]            [decimal](5,2)  NULL,
    [isr_total]                   [decimal](18,2) NULL,
    [diferencia_isr]              [decimal](18,2) NULL,       -- isr_total − isr_ordinario
    [tasa]                        [decimal](9,6)  NULL,       -- ROUND(diferencia / parte_mensualizada, 6); 0 si la parte es 0
    [isr_retenido]                [decimal](18,2) NULL,       -- ROUND(base_gravable × tasa, 2)
 CONSTRAINT [PK_period_employee_isr_article174] PRIMARY KEY CLUSTERED ([id_period_employee] ASC),
 CONSTRAINT [FK_period_employee_isr_article174_row] FOREIGN KEY ([id_period_employee])
     REFERENCES [payroll].[period_employees] ([id_period_employee]) ON DELETE CASCADE,
 CONSTRAINT [CK_period_employee_isr_article174] CHECK (
     ([isr_estado] = 'N'
        AND [isr_motivo] IS NOT NULL
        AND [isr_motivo] IN ('no_monthly_withholding_table','income_in_gap','exemption_not_calculated')
        AND [isr_retenido] IS NULL)
  OR ([isr_estado] = 'C'
        AND [isr_motivo] IS NULL
        AND [base_gravable] IS NOT NULL AND [ingreso_ordinario_mensual] IS NOT NULL
        AND [parte_mensualizada] IS NOT NULL AND [ejercicio_tarifa] IS NOT NULL
        AND [isr_ordinario] IS NOT NULL AND [isr_total] IS NOT NULL
        AND [diferencia_isr] IS NOT NULL AND [tasa] IS NOT NULL AND [isr_retenido] IS NOT NULL
        AND [diferencia_isr] = [isr_total] - [isr_ordinario]
        AND [isr_retenido] >= 0))
) ON [PRIMARY]
GO
```

**Script de datos, idempotente** (mismo patrón que la spec 78, `THROW 50087`):

- Confirma que la percepción de aguinaldo del catálogo es `clave_sat = '002'`, `'U'`, `umas_limite = 30` y `periodicidad_limite = 'A'`. Su id queda en `CHRISTMAS_BONUS_PERCEPTION_ID`. Si no hay exactamente una fila así, detiene el script.
- Si `RH.payment_periods` no tiene `clave_sat = '99'`, la inserta con `status = 0`, para que nunca se ofrezca como frecuencia de un empleado. El periodo E la resuelve por `clave_sat` sin mirar `status`.

**Sin DDL:**

- La tarifa mensual va en `payroll.tablas_retencion`, con el `id_payment_period` de `clave_sat = '05'` resuelto en SQL. `UQ_tablas_retencion_tramo` ya cubre `(ejercicio, id_payment_period, limite_inferior)`.
- El ISR del aguinaldo se guarda en `payroll.period_employee_deductions` (`id_deduction = 2`) **solo en filas 'C'**, aunque sea 0.

### En las filas de un periodo E

- `dias` y `dias_falta` son 0. `importe_salario` y todos los conceptos ordinarios son 0.
- `salario_diario` congela el salario del tipo, que es la base del aguinaldo.
- `isr_estado` es `'X'`.
- Las filas `'F'` tienen una fila en `period_employee_perceptions` (aguinaldo, si `importe_aguinaldo > 0`) y una en `period_employee_isr_article174`.

### TypeScript

- `interfaces/payroll_period.ts`:
  - `export type PayrollPeriodType = "O" | "E";`
  - `IPayrollPeriod` gana `tipo_periodo: PayrollPeriodType`.
- El tipo del snapshot de Procesar/Detalle gana `dias_aguinaldo: number` e `importe_aguinaldo: number`.
- `interfaces/payroll_christmas_bonus.ts` (nuevo):

```ts
export type Article174SkipReason =
  | "no_monthly_withholding_table"
  | "income_in_gap"
  | "exemption_not_calculated";

export interface IArticle174IsrBreakdown {
  isr_estado: "C" | "N";
  isr_motivo: Article174SkipReason | null;
  base_gravable: number | null;
  ingreso_ordinario_mensual: number | null;
  parte_mensualizada: number | null;
  ejercicio_tarifa: number | null;
  limite_inferior_ordinario: number | null;
  cuota_fija_ordinario: number | null;
  porcentaje_ordinario: number | null;
  isr_ordinario: number | null;
  limite_inferior_total: number | null;
  cuota_fija_total: number | null;
  porcentaje_total: number | null;
  isr_total: number | null;
  diferencia_isr: number | null;
  tasa: number | null;
  isr_retenido: number | null;
}
```

### Constantes (`lib/payroll/constants.ts`)

```ts
export const PAYROLL_PERIOD_TYPE_LABELS: Record<PayrollPeriodType, string> = {
  O: "Ordinaria",
  E: "Extraordinaria (aguinaldo)",
};
export const EXTRAORDINARY_PERIOD_SAT_KEY = "99";
export const EXTRAORDINARY_PERIOD_CODE_LETTER = "E";
export const MONTHLY_WITHHOLDING_SAT_KEY = "05";

export const CHRISTMAS_BONUS_PERCEPTION_ID = /* id confirmado por el script */;
export const CHRISTMAS_BONUS_DAYS = 15;
export const CHRISTMAS_BONUS_YEAR_DAYS = 365;            // fijo, también en bisiesto
export const CHRISTMAS_BONUS_DEADLINE_MONTH_DAY = "12-20";
export const CHRISTMAS_BONUS_WARNING_START_MONTH_DAY = "12-01";
export const ARTICLE_174_MONTH_DAYS_FACTOR = 30.4;       // fijado por el art. 174 RLISR

export const ARTICLE_174_SKIP_REASON_LABELS: Record<Article174SkipReason, string> = {
  no_monthly_withholding_table: "No hay tarifa mensual de ISR para el año",
  income_in_gap: "El ingreso cae en un hueco de la tarifa mensual",
  exemption_not_calculated: "No se pudo calcular el exento del aguinaldo",
};
```

`PERCEPTION_LINE_KEY_BY_ID` gana `[CHRISTMAS_BONUS_PERCEPTION_ID]: "aguinaldo"`.

### Módulos nuevos (todos en `lib/payroll/`)

| Archivo | Tipo | Contenido |
|---|---|---|
| `christmasBonus.ts` | puro | `countChristmasBonusDays(fechaInicio, fechaFin, fechaIngreso)`, `calculateChristmasBonusAmount(dailySalary, days)` (enteros en centavos, half up), `describeChristmasBonus(...)` |
| `isrArticle174.ts` | puro | `calculateArticle174Isr(taxedAmount, hasPendingExemption, dailyFiscalSalary, monthlyBrackets)` → `IArticle174IsrBreakdown`. Reutiliza `findWithholdingBracket` |
| `isrArticle174Sql.ts` | `server-only` | `APPLY`s y columnas compartidos entre el cálculo y el aviso "Recalcula" |
| `christmasBonusRecalculation.ts` | `server-only` | `isChristmasBonusRecalculationNeeded(id_period)`: salario/`fecha_ingreso` vs snapshot y art. 174 hoy vs guardado, con `EXCEPT` |
| `christmasBonusDeadline.ts` | puro | `getChristmasBonusDeadlineState(today, hasExtraordinaryPeriod)` → `"none" \| "upcoming" \| "overdue"` |

### Convenciones

- **Tasa:** `ROUND(diferencia_isr / parte_mensualizada, 6)` e `isr_retenido = ROUND(base_gravable × tasa, 2)`. Con `parte_mensualizada = 0`, `tasa = 0` e ISR = 0.
- **ISR por tarifa:** `ROUND(cuota_fija + (ingreso − limite_inferior) × porcentaje / 100, 2)`, igual que la spec 70.
- Todas las fechas viajan como strings `"YYYY-MM-DD"`. "Hoy" se calcula con `addZeroToday(new Date())` (Ciudad de México).

## Plan de implementación

1. **DDL y script de datos.**
   - Se agregan a `queries.txt` (bloque `NOMINA PAYROLL`, después de la spec 78):
     - `tipo_periodo` con sus dos `CHECK` y el índice único filtrado;
     - las dos columnas del aguinaldo en `period_employees`;
     - la tabla `period_employee_isr_article174`;
     - el script idempotente (`THROW 50087`), que confirma la percepción 002 e inserta la periodicidad 99 si falta.
   - Se ejecuta contra la base de desarrollo.
   - *Verificación:*
     - Todos los periodos existentes quedan `'O'`.
     - Insertar a mano un periodo `'E'` con `fecha_inicio` distinta al 1-ene falla por `CK_periods_extraordinaria_fechas`.
     - Un segundo periodo `'E'` de la misma sucursal y ejercicio falla por `UX_periods_extraordinaria_sucursal_ejercicio`.
     - Correr el script dos veces no cambia nada la segunda vez.

2. **Tipos, constantes y lógica pura, sin UI.**
   - `interfaces/payroll_period.ts` (`tipo_periodo`), `interfaces/payroll_christmas_bonus.ts` y las constantes de la spec.
   - `lib/payroll/christmasBonus.ts`, `lib/payroll/isrArticle174.ts` y `lib/payroll/christmasBonusDeadline.ts`.
   - `PERIOD_ROW_SELECT` y las lecturas de periodos devuelven `tipo_periodo`.
   - *Verificación:* `npx tsc --noEmit` y `npm run lint` limpios. Con un script temporal en el scratchpad:
     - Ingreso 1-sep-2026 con $500: `countChristmasBonusDays` = 122 y `calculateChristmasBonusAmount` = **$2,506.85**.
     - Ingreso anterior al 1-ene: 365 días, 15 × salario exacto.
     - Fechas del deadline: 30-nov → `none`; 1-dic sin periodo E → `upcoming`; 21-dic sin periodo E → `overdue`; con periodo E → `none`.

3. **Tarifa mensual en Parámetros fiscales.**
   - La pestaña "Tarifa ISR" gana el selector **Semanal | Mensual**, en la URL como `frecuencia=semanal|mensual`, con default semanal.
   - `saveWithholdingBracket`, `deleteWithholdingBracket` y `copyWithholdingTableFromPreviousYear` reciben la frecuencia, validada con `zod` contra `'02' | '05'` y resuelta por `clave_sat` en SQL.
   - Traslapes, tramo abierto y huecos se validan **por frecuencia**.
   - Se usa la skill `frontend-design` para el selector.
   - *Verificación:*
     - Capturar la tarifa mensual 2026 completa sin tocar la semanal.
     - "Copiar de 2025" en mensual no copia los tramos semanales.
     - Un traslape dentro de la mensual se rechaza; uno entre semanal y mensual no.
     - El ISR semanal de un periodo ya calculado no cambia al recalcularlo.

4. **Crear y administrar el periodo E (todavía sin cálculo).**
   - `lib/payroll/schemas.ts` gana una unión discriminada por `tipo_periodo`.
   - `createPayrollPeriod` con `'E'`:
     - resuelve la periodicidad 99 y fija 1-ene / 31-dic del año elegido;
     - genera `NOM-{año}-E{consecutivo}`;
     - revisa en la transacción (`UPDLOCK, HOLDLOCK`) que no exista otro E de la sucursal y año ("Ya existe la nómina de aguinaldo de {año}" también si salta el índice).
   - `updatePayrollPeriod` con `'E'` solo cambia `fecha_pago` y `fecha_corte`.
   - `PayrollPeriodModal`:
     - selector Ordinaria | Extraordinaria (aguinaldo);
     - en E: año, fechas de inicio y fin de solo lectura, pago sugerido 20-dic;
     - advertencia ámbar si el pago es posterior al 20-dic, sin bloquear.
   - Badge "Extraordinaria" en `PayrollPeriodsTable`.
   - `resolvePeriod` (`lib/payroll/period.ts`) gana una opción para excluir periodos E. La usan Horas extra, Faltas, Retardos y Bonos, tanto en su selector como al resolver el periodo actual. Procesar los lista todos.
   - `calculatePayrollPeriod` responde `{ ok: false, message: "El cálculo del aguinaldo aún no está disponible" }` para periodos E, para que este paso quede funcional.
   - Se usa `frontend-design` para el modal.
   - *Verificación:*
     - Crear `NOM-2026-E01`; uno segundo de 2026 se rechaza en la misma sucursal y se permite en otra.
     - Editar el pago al 22-dic guarda y muestra la advertencia.
     - El periodo E no aparece en Horas extra, Faltas, Retardos ni Bonos.
     - Los periodos ordinarios se crean, editan y calculan igual que antes.

5. **Cálculo del aguinaldo (operativa y fiscal, sin ISR).**
   - `calculatePayrollPeriod` se bifurca por `tipo_periodo`. La rama E, en un solo batch con `BEGIN TRAN` y el periodo leído `WITH (UPDLOCK, HOLDLOCK)`:
     - borra el snapshot;
     - inserta las filas `'O'` y `'F'` de los elegibles (activos, sucursal, cualquier frecuencia, `fecha_ingreso ≤ fecha_fin`, salario > 0 del tipo) con `dias_aguinaldo` e `importe_aguinaldo`, dejando los conceptos ordinarios en 0 e `isr_estado = 'X'`;
     - crea `#fiscal_perception_lines` con solo la línea de aguinaldo (`importe_aguinaldo > 0`) y la pasa por el motor de la spec 73 (`EXEMPTION_PARAMETERS_SQL` / `EXEMPTION_APPLY_SQL` sin cambios).
   - El periodo queda en estatus 2. `revertPayrollCalculation` funciona sin cambios gracias al cascade.
   - *Verificación:*
     - El empleado de ejemplo queda con 122 días y $2,506.85 en `'O'`, y con su salario fiscal en `'F'`.
     - Con un aguinaldo fiscal mayor a 30 UMA, exento = `ROUND(30 × UMA_DIARIA, 2)` y gravado = el resto.
     - Un dado de baja y un empleado sin `id_periodo_pago` activo: el primero no entra y el segundo sí.
     - Revertir regresa el periodo a 1 sin filas.

6. **ISR art. 174 RLISR.**
   - `lib/payroll/isrArticle174Sql.ts` con los `APPLY`s:
     - tarifa mensual de `YEAR(fecha_fin)`;
     - tramo del ordinario y tramo del ordinario + parte mensualizada;
     - motivo, en este orden: `exemption_not_calculated` → `no_monthly_withholding_table` → `income_in_gap`;
     - ISR, diferencia, tasa y retenido.
   - En la rama E, después de las percepciones: `INSERT` en `period_employee_isr_article174` por cada fila `'F'` y en `period_employee_deductions` (`id_deduction = 2`) solo para las `'C'`.
   - *Verificación:*
     - Para tres empleados (todo exento, gravado chico, gravado grande), el desglose guardado coincide al centavo con `calculateArticle174Isr`.
     - Sin tarifa mensual del año, las filas quedan `'N'` / `no_monthly_withholding_table` y el periodo se calcula de todos modos.
     - Antes de pagar, el contador o el simulador del SAT confirma al menos dos casos.

7. **Procesar con un periodo E.**
   - `getPayrollProcessPage` devuelve `tipo_periodo`, los campos del aguinaldo y, en la fiscal, gravado, exento e ISR art. 174.
   - `PayrollEmployeesTable` y `PayrollProcessSummaryCards` muestran el juego de columnas del periodo E: Días, Salario diario, Aguinaldo y, en la fiscal, Gravado, Exento, ISR y Neto.
   - `IsrNotCalculatedNotice` usa `ARTICLE_174_SKIP_REASON_LABELS` y enlaza a la tarifa mensual.
   - El aviso de ISR de la spec 70 (`isIsrRecalculationNeeded`) excluye los periodos E.
   - Se usa `frontend-design`.
   - *Verificación:*
     - Los totales del pie y de las tarjetas suman las filas.
     - Un periodo ordinario se ve exactamente igual que antes.
     - No aparece el aviso de ISR de la spec 70 en el periodo E.

8. **Detalle con un periodo E.**
   - `buildPerceptionLines` genera solo la línea `aguinaldo` ("15 días × N/365 × $X diarios", más la nota de ingreso proporcional) cuando el periodo es E.
   - En la fiscal, `PayrollPerceptionsCard` muestra el gravado/exento con su regla (sin cambios) y una tarjeta nueva `PayrollArticle174IsrCard` (Server Component) reemplaza a `PayrollDeductionsCard`, con cada paso congelado y "Neto a pagar".
   - Se ocultan las listas de periodo ordinario (tratamientos, productos, horas extra, faltas, retardos).
   - Se usa `frontend-design`.
   - *Verificación:*
     - El detalle del empleado de ejemplo muestra 122 días y $2,506.85.
     - El desglose del art. 174 coincide con la tabla.
     - El detalle de un periodo ordinario no cambia.

9. **Avisos.**
   - `ChristmasBonusDeadlineNotice` (Server Component, `nomina/componentes/`) en Periodos y Procesar:
     - lee si la sucursal tiene periodo E del año actual;
     - usa `getChristmasBonusDeadlineState(addZeroToday(new Date()), ...)`: ámbar `upcoming`, rojo `overdue`, oculto con `none`.
   - `isChristmasBonusRecalculationNeeded(id_period)`, solo en estatus 2 y periodos E, se muestra con `PayrollRecalculationNotice` cuando:
     - cambió el salario del tipo o la `fecha_ingreso` respecto del snapshot;
     - el art. 174 de hoy no coincide con el guardado (tarifa mensual o salario fiscal).

     El aviso de exento de la spec 73 se reutiliza tal cual.
   - *Verificación:*
     - Con la fecha del sistema simulada en el helper: 1-dic sin E → ámbar; 21-dic sin E → rojo; al crear el E desaparece.
     - Cambiar el salario de un empleado tras calcular dispara el aviso; recalcular lo quita.
     - Editar un tramo de la tarifa mensual también lo dispara.

10. **Documentación.**
    - `docs/nomina.md` gana la sección "Aguinaldo (spec 87)" y actualiza:
      - la lista de conceptos y el "Out of scope" de las specs 69, 73 y 78;
      - la sección de Frecuencias (99 solo para E);
      - Parámetros fiscales (tarifa mensual);
      - las pantallas.
    - `docs/rh-empleados.md` corrige "no aguinaldo" en "Bajas (spec 86)", porque el aguinaldo anual ya existe y lo pendiente es el proporcional del finiquito.
    - *Verificación:* el DDL de `queries.txt` coincide con lo ejecutado, y `tsc` y `lint` quedan limpios.

## Criterios de aceptación

**Periodo extraordinario**

- [x] Todos los periodos existentes quedan con `tipo_periodo = 'O'` y se crean, editan, calculan y revierten igual que antes.
- [x] Se puede crear un periodo E por sucursal y año con código `NOM-{año}-E{NN}`, periodicidad SAT 99, `fecha_inicio` 1-ene y `fecha_fin` 31-dic no editables.
- [x] Un segundo periodo E del mismo año en la misma sucursal se rechaza con "Ya existe la nómina de aguinaldo de {año}"; en otra sucursal se permite.
- [x] La `fecha_pago` sugerida es el 20-dic; una posterior guarda y muestra la advertencia ámbar.
- [x] Editar un periodo E solo cambia `fecha_pago` y `fecha_corte`, y solo en estatus 1.
- [x] La periodicidad 99 no aparece como opción de frecuencia en el registro del empleado ni en el alta de periodos ordinarios.
- [x] Horas extra, Faltas, Retardos y Bonos no listan periodos E ni los eligen como periodo actual.

**Cálculo**

- [x] Entran los empleados activos de la sucursal con salario > 0 del tipo y `fecha_ingreso ≤ 31-dic`, de cualquier frecuencia, incluso sin `id_periodo_pago`; los dados de baja no entran.
- [x] Días = 31-dic − max(1-ene, `fecha_ingreso`) + 1, sin descontar faltas, aunque se calcule antes del 31-dic.
- [x] Importe = `ROUND(salario × 15 × días / 365, 2)`: ingreso 1-sep-2026 con $500 da 122 días y $2,506.85; ingreso anterior a 2026 da 15 × salario.
- [x] La operativa usa `salario_diario` y la fiscal `salario_diario_fiscal`; un empleado sin salario de un tipo no tiene fila de ese tipo.
- [x] Las filas E tienen en 0 sueldo, comisiones, bonos, horas extra, faltas, retardos y vacaciones.
- [x] La fila fiscal tiene una percepción clave 002 con exento = `min(importe, 30 × UMA_DIARIA − exento previo del año)` y gravado = importe − exento, que suman el importe al centavo.
- [x] El ISR art. 174 guardado coincide al centavo con `calculateArticle174Isr` para tres casos: todo exento (ISR 0), gravado chico y gravado grande.
- [x] No se aplica subsidio al empleo en ninguna fila E.
- [x] Sin tarifa mensual del año, el periodo se calcula y las filas fiscales quedan "No calculado: No hay tarifa mensual de ISR para el año", sin deducción.
- [x] Una fila 'C' tiene exactamente una deducción ISR (`id_deduction = 2`), aunque sea 0; neto = aguinaldo − ISR. La operativa no tiene deducciones.
- [x] Revertir el periodo E borra el snapshot, las percepciones, el desglose art. 174 y las deducciones, y lo regresa a estatus 1.

**Tarifa mensual**

- [x] La pestaña "Tarifa ISR" tiene el selector Semanal | Mensual en la URL; capturar, editar, borrar y copiar operan solo sobre la frecuencia elegida.
- [x] Un traslape dentro de la misma frecuencia se rechaza; los mismos límites en semanal y mensual se permiten.
- [x] Recalcular un periodo semanal da el mismo ISR que antes de cargar la tarifa mensual.

**Pantallas**

- [x] Procesar con periodo E muestra Días, Salario diario y Aguinaldo (operativa) y además Gravado, Exento, ISR y Neto (fiscal); tarjetas y pie suman las filas.
- [x] Procesar con periodo ordinario se ve igual que antes.
- [x] El Detalle E muestra la línea "Aguinaldo" con su fórmula y la nota de ingreso proporcional; en fiscal, gravado/exento y la tarjeta del art. 174 con cada paso; no muestra las listas de periodo ordinario.

**Avisos**

- [x] Del 1-dic al 20-dic, sin periodo E del año en la sucursal, Periodos y Procesar muestran el aviso ámbar; del 21-dic en adelante, el rojo; antes del 1-dic o con periodo E creado, ninguno.
- [x] En estatus 2, el aviso "Recalcula" aparece en el periodo E si cambió el salario del tipo, la `fecha_ingreso`, la UMA o la regla del aguinaldo, o la tarifa mensual; recalcular lo quita.
- [x] El aviso de ISR de la spec 70 nunca aparece en un periodo E.

**Calidad**

- [x] Todas las acciones nuevas o modificadas pasan por `assertPayrollAccess()` y validan con `zod`; un rol distinto de 1 y 4 recibe `{ ok: false }`.
- [x] Ninguna fecha viaja como `Date`: las lecturas usan `CONVERT(varchar(10|19), …, 120)`.
- [x] `npx tsc --noEmit` y `npm run lint` sin errores.
- [x] `docs/nomina.md`, `docs/rh-empleados.md` y `queries.txt` actualizados.

## Decisiones

**Tomadas**

| Decisión | Por qué |
|---|---|
| Dividir `aguinaldo.md` en tres specs: 87 aguinaldo anual, 88 finiquito/liquidación, y después ISN CDMX y timbrado | Son dominios distintos; el finiquito además necesita prorratear la nómina del periodo de la baja, que no existe. |
| Nómina extraordinaria como `tipo_periodo = 'E'` en `payroll.periods` | Reutiliza snapshot, estatus, Procesar, Detalle, el motor gravado/exento y el futuro timbrado. Un PTU futuro usaría el mismo tipo. |
| Código `NOM-{año}-E{NN}` con letra `E` | La letra identifica el tipo (extraordinaria), no el concepto. |
| Periodicidad SAT 99 para el periodo E, insertada con `status = 0` si falta | Es la que exige el CFDI extraordinario; con `status = 0` nunca se ofrece como frecuencia de empleado. |
| Fechas fijas 1-ene / 31-dic; pago sugerido 20-dic | El aguinaldo es anual y los días se cuentan contra el año completo. |
| Un solo periodo E por sucursal y año, al 100% | Simplicidad; el motor ya acumula el exento anual, así que varias exhibiciones se pueden agregar después sin rehacer nada. |
| Operativa y fiscal, cada una con su salario diario | Mismo patrón que vacaciones (spec 78). |
| Aguinaldo = salario diario × 15 × días / 365, **sin parte variable** | Decisión del negocio: solo el salario diario. Se descartó la regla de salario variable del doc de origen. |
| Los días cuentan hasta el 31-dic aunque se calcule antes | Regla del doc de origen. |
| No se descuentan faltas | La LFT habla de tiempo de servicio, y las faltas ya se descontaron del sueldo semanal. |
| 365 fijo, también en año bisiesto | Coincide con el doc de origen y es la práctica habitual. |
| Entran todos los activos de la sucursal, de cualquier frecuencia (incluso sin `id_periodo_pago`) | El aguinaldo no depende de la frecuencia; quien no tiene frecuencia capturada no debe quedarse sin aguinaldo. |
| Los dados de baja en el año no entran | Su aguinaldo proporcional va en el finiquito (spec 88). |
| Quien cambió de sucursal cobra todo en la actual | Sin historial de sucursal por empleado; repartirlo es otra spec. |
| Exento hasta 30 UMA por año con el motor de la spec 73 | El catálogo ya tiene la regla (`'U'`, 30, `'A'`); el acumulado anual cubre pagos en varias exhibiciones. |
| ISR por el art. 174 RLISR con la tarifa mensual | Lo pidió el negocio ("tasa media / proporcional"); casi siempre retiene menos que sumarlo al ordinario. |
| Ingreso ordinario mensual = `salario_diario_fiscal × 30.4` | Estable y no depende de que los periodos ordinarios estén calculados. |
| Factor 30.4 constante, no el parámetro `SUBSIDIO_FACTOR_DIAS_MES` | Lo fija el art. 174; el parámetro pertenece al decreto del subsidio. |
| Tasa redondeada a 6 decimales antes de multiplicar | Regla reproducible igual en SQL y TS. |
| ISR del aguinaldo en tabla propia `period_employee_isr_article174` | El `CHECK` de la spec 70 exige datos del subsidio que aquí no aplican; así el ISR ordinario queda intacto. |
| Sin subsidio al empleo | Regla del doc de origen. |
| Tarifa mensual en `tablas_retencion` con selector Semanal \| Mensual | Sin DDL nuevo; la spec 69 ya preveía cargar otras frecuencias cuando se usaran. |
| Pago posterior al 20-dic solo advierte | Pagar tarde es una multa, no algo imposible. |
| Aviso desde el 1-dic; se quita al **crear** el periodo E | Decisión del negocio; Aprobada/Pagada todavía no existen. |
| Horas extra, Faltas, Retardos y Bonos excluyen periodos E | Esas pantallas solo tienen sentido para periodos ordinarios. |

**Descartadas**

| Alternativa | Por qué no |
|---|---|
| Módulo aparte (`payroll.christmas_bonus_runs` + pantalla `nomina/aguinaldo`) | Duplicaría snapshot, detalle, motor gravado/exento y el futuro timbrado. |
| Salario variable (fijo + pagos variables del año / 365) | El negocio decidió base = solo salario diario × 15. |
| Varias exhibiciones o porcentaje por periodo E | Fuera de esta spec; el modelo no lo impide. |
| Art. 96 directo con la tarifa mensual sobre el gravado | Retiene más; el negocio eligió el art. 174. |
| Sumar el aguinaldo al ordinario de la semana | El aguinaldo va en nómina extraordinaria. |
| Ingreso ordinario como promedio de percepciones gravadas reales | Depende de que los periodos estén calculados y varía por comisiones. |
| Reutilizar las columnas `isr_*` de la spec 70 | Su `CHECK` exige subsidio y tarifa de la frecuencia del periodo. |
| Bloquear `fecha_pago` posterior al 20-dic | Un pago tardío sigue siendo un pago válido. |
| Quitar el aviso del 20-dic al **calcular** el periodo E | El negocio eligió quitarlo al crear. |
| 366 días en año bisiesto | Complica sin cambiar el criterio del negocio. |
| Descontar faltas injustificadas del año | La LFT habla de tiempo de servicio y las faltas ya se descontaron del sueldo. |

## Riesgos identificados

- **Dado de baja después de calcular el aguinaldo.** Si alguien se da de baja en diciembre después de calcular el periodo E, ya recibió el aguinaldo por el año completo. El finiquito de la spec 88 deberá restar lo ya pagado en el periodo E (o recalcular este antes de pagar). Mientras tanto, recalcular el periodo E lo saca porque ya no está activo.
- **Tarifa mensual mal capturada u olvidada.** Una tarifa mensual errónea retiene mal a toda la nómina fiscal de aguinaldo; una faltante deja todas las filas "No calculado". `tablas_retencion` no tiene bitácora: el desglose art. 174 congela el tramo usado y el aviso "Recalcula" detecta cambios. Antes de pagar, el contador o el simulador del SAT confirma al menos dos casos.
- **UMA de febrero no actualizada.** Si no se capturó la UMA vigente, el exento sale con la UMA vieja. El Detalle muestra el `vigente_desde` usado (spec 73).
- **Exento consumido por otro periodo del año.** El acumulado anual se calcula por empleado entre periodos con `fecha_fin` en el mismo año. Hoy solo el periodo E genera aguinaldo, pero si el finiquito de la spec 88 paga aguinaldo proporcional a un reingreso del mismo año, ambos registros son empleados distintos y **cada uno tendría sus 30 UMA**. Para la spec 88 queda pendiente decidir si el exento se comparte entre registros de reingreso.
- **Periodicidad 99 ya existente con otro uso.** Si `RH.payment_periods` ya tiene la 99 con `status = 1` y algún empleado la tiene asignada, ese empleado no entraría a ninguna nómina ordinaria. El script lo reporta pero no cambia nada; hay que revisarlo a mano.
- **Cambio de salario a fin de año.** El aguinaldo usa el salario vigente al calcular. Un aumento capturado después del cálculo dispara "Recalcula"; si nadie recalcula, se paga con el salario anterior.
- **Índice único filtrado.** `UX_periods_extraordinaria_sucursal_ejercicio` requiere las opciones `SET` estándar en la conexión que inserta. La spec 86 ya usa índices filtrados con el mismo driver, pero si falla, la revisión dentro de la transacción sigue siendo la barrera principal.
- **Batch de cálculo más grande.** `calculatePayrollPeriod` gana una rama completa. Hay que comparar el snapshot de un periodo ordinario ya calculado antes y después del cambio para confirmar que la rama ordinaria no se alteró.
