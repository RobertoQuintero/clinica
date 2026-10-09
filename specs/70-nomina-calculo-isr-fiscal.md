# 70 — Nómina: cálculo del ISR de la nómina fiscal

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md): los renglones fiscales `'F'`, `importe_salario` y `calculatePayrollPeriod`.
  - [54 — Detalle de percepciones por empleado](54-nomina-detalle-percepciones-empleado.md): la pantalla Detalle donde va la tarjeta de deducciones.
  - [62 — Faltas](62-nomina-control-faltas.md) y [63 — Retardos](63-nomina-control-retardos.md): `dias` (días pagados, base del subsidio) e `importe_salario` neto de faltas y retardos.
  - [69 — Parámetros fiscales](69-nomina-parametros-fiscales-isr.md): `tax_parameters`, `tablas_retencion`, la regla de vigencia por `fecha_fin` y `resolveTaxParameterRow` / `findWithholdingBracket`.
- **Modifica base de datos:** Sí.
  - Tabla nueva `payroll.period_employee_deductions`, con FK a `payroll.deductions`.
  - `payroll.period_employees`: columnas del desglose del ISR.
- **Fecha:** 2026-10-09
- **Objetivo:** Calcular y guardar, en cada renglón de la nómina fiscal, el ISR que hay que retener: tarifa del art. 96 sobre el sueldo menos el subsidio para el empleo, sin saldo a favor. El resultado se muestra en Procesar y en Detalle.
- **Reglas de origen:** decreto del subsidio para el empleo (DOF 31-dic-2025), Anexo 8 de la RMF 2026 (tarifa semanal) y `references/nomina/reglas_modulo_nomina.md` (3.3).

## Alcance

**Incluye:**

- **Base de datos.** El DDL se documenta en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 69.
  - `payroll.period_employee_deductions`: una fila por deducción y renglón (`id_period_employee`, `id_deduction` con FK a `payroll.deductions`, `importe`), con `ON DELETE CASCADE` a `period_employees`. En esta spec solo se escribe `id_deduction = 2` (ISR).
  - `payroll.period_employees`: columnas del desglose del ISR (estado y motivo, base, tramo congelado, ISR causado, subsidio causado y aplicado, ISR retenido, y el `vigente_desde` de cada parámetro usado).
- **Cálculo dentro de `calculatePayrollPeriod`**, en el mismo batch SQL y **solo para los renglones `'F'`**:
  - **Base gravable** = `importe_salario`. Hoy es la única percepción fiscal y es gravada al 100%.
  - **Tarifa:** la de `tablas_retencion` con la frecuencia del periodo y `ejercicio` = el año de `fecha_fin`. El tramo es el de mayor `limite_inferior <= base` que contiene la base, la misma regla que `findWithholdingBracket`.
  - **ISR causado** = `ROUND(cuota_fija + (base − limite_inferior) × porcentaje / 100, 2)`. La tarifa del periodo se aplica tal cual, sin prorratear por días.
  - **Subsidio:** los parámetros se resuelven con `fecha_fin`. Hay derecho si `base × SUBSIDIO_FACTOR_DIAS_MES <= SUBSIDIO_TOPE_INGRESO_MENSUAL × dias`. En ese caso, `subsidio_causado = ROUND(SUBSIDIO_MONTO_MENSUAL / factor × dias, 2)`, donde `dias` son los días pagados.
  - **Retenido** = ISR causado − `min(subsidio_causado, ISR causado)`. Nunca es negativo y no hay saldo a favor.
  - **Base 0** (todo el periodo en faltas o retardos): el ISR se calcula y da 0.
- **"ISR no calculado".** El periodo se calcula de todas formas, pero el renglón `'F'` queda en ese estado, con su motivo y sin fila de deducción, cuando:
  - no hay tarifa para la frecuencia y el ejercicio (hoy, todo lo quincenal);
  - la base cae en un hueco de la tarifa;
  - falta alguno de los 3 parámetros del subsidio vigentes a `fecha_fin`.
- **Renglones `'O'`:** sin ISR. Las columnas nuevas quedan vacías y no se escriben deducciones.
- **Helper puro** `lib/payroll/isrCalculation.ts`. Repite la regla en TS para las pantallas y el aviso; si difiere del SQL, manda el SQL.
- **Procesar, vista fiscal:**
  - columnas "ISR" y "Neto";
  - tarjetas de resumen con el total de ISR y el total neto;
  - aviso cuando haya renglones con "ISR no calculado", con su motivo.
- **Detalle, vista fiscal:**
  - tarjeta "Deducciones" con la línea ISR: base, tramo, ISR causado, subsidio, retenido y el `vigente_desde` de cada parámetro;
  - el neto (percepciones − deducciones).
- **Aviso "Recalcula"** en estatus 2. Recalcula hoy el ISR de los renglones `'F'` y lo compara con el snapshot, así que detecta cambios de tarifa, de parámetros o de vigencia.
- **Documentación:** sección "ISR (spec 70)" en `docs/nomina.md`, y actualizar el párrafo inicial.

**No incluye (para otras specs):**

- **El motor gravado/exento** que lee los topes de `payroll.perceptions`. Llega cuando la nómina fiscal tenga percepciones distintas del sueldo (horas extra, prima dominical, aguinaldo…).
- **Tarifas de otras frecuencias** (quincenal) y la tarifa anual del art. 152. La pantalla de la spec 69 solo captura la semanal.
- **IMSS** (`id_deduction = 1`): SBC, cuotas obrera y patronal.
- **Ajuste mensual o anual del ISR**, y el prorrateo de la tarifa por días.
- **ISR de la nómina operativa.**
- **Bloquear la aprobación** de un periodo con renglones "ISR no calculado". Le toca a la spec que construya el estatus 3 (Aprobada).
- **Recibos, timbrado CFDI** y el reporte del subsidio como "otros pagos".
- **Captura manual o ajuste a mano** del ISR de un empleado.
- **Cambios retroactivos** en periodos aprobados o pagados.

## Modelo de datos

**Cambios en BD.** El DDL va en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 69.

```sql
-- Spec 70: desglose del ISR por renglón. Solo los renglones 'F' calculados llevan datos.
-- isr_estado: 'X' no aplica (operativa o snapshot anterior a la spec 70), 'C' calculado, 'N' no calculado.
ALTER TABLE [payroll].[period_employees] ADD
    [isr_estado]                      [char](1)       NOT NULL CONSTRAINT [DF_period_employees_isr_estado] DEFAULT ('X'),
    [isr_motivo]                      [varchar](30)   NULL,   -- solo 'N'
    [isr_base_gravable]               [decimal](12,2) NULL,
    [isr_ejercicio_tarifa]            [smallint]      NULL,
    [isr_limite_inferior]             [decimal](18,2) NULL,   -- tramo congelado; NULL si la base es 0
    [isr_cuota_fija]                  [decimal](18,2) NULL,
    [isr_porcentaje_excedente]        [decimal](5,2)  NULL,
    [isr_causado]                     [decimal](12,2) NULL,
    [subsidio_monto_mensual]          [decimal](18,4) NULL,   -- parámetros congelados con su vigencia
    [subsidio_monto_vigente_desde]    [date]          NULL,
    [subsidio_tope_ingreso_mensual]   [decimal](18,4) NULL,
    [subsidio_tope_vigente_desde]     [date]          NULL,
    [subsidio_factor_dias_mes]        [decimal](18,4) NULL,
    [subsidio_factor_vigente_desde]   [date]          NULL,
    [subsidio_con_derecho]            [bit]           NULL,
    [subsidio_causado]                [decimal](12,2) NULL,
    [subsidio_aplicado]               [decimal](12,2) NULL,
    [isr_retenido]                    [decimal](12,2) NULL
GO

-- IS NOT NULL explícito en cada rama: en un CHECK, `NULL >= 0` es UNKNOWN y SQL Server lo acepta (lección de la spec 69).
ALTER TABLE [payroll].[period_employees] WITH CHECK ADD CONSTRAINT [CK_period_employees_isr] CHECK (
    ([isr_estado] = 'X'
        AND [isr_motivo] IS NULL AND [isr_base_gravable] IS NULL AND [isr_causado] IS NULL
        AND [isr_retenido] IS NULL AND [subsidio_causado] IS NULL AND [subsidio_aplicado] IS NULL)
 OR ([isr_estado] = 'N' AND [tipo_nomina] = 'F'
        AND [isr_motivo] IS NOT NULL
        AND [isr_motivo] IN ('no_withholding_table','income_in_gap','missing_subsidy_parameters')
        AND [isr_base_gravable] IS NOT NULL AND [isr_base_gravable] >= 0
        AND [isr_causado] IS NULL AND [isr_retenido] IS NULL
        AND [subsidio_causado] IS NULL AND [subsidio_aplicado] IS NULL)
 OR ([isr_estado] = 'C' AND [tipo_nomina] = 'F'
        AND [isr_motivo] IS NULL
        AND [isr_base_gravable] IS NOT NULL AND [isr_base_gravable] >= 0
        AND [isr_ejercicio_tarifa] IS NOT NULL
        AND ([isr_limite_inferior] IS NOT NULL OR [isr_base_gravable] = 0)
        AND [isr_causado] IS NOT NULL AND [isr_causado] >= 0
        AND [subsidio_con_derecho] IS NOT NULL
        AND [subsidio_monto_mensual] IS NOT NULL AND [subsidio_tope_ingreso_mensual] IS NOT NULL
        AND [subsidio_factor_dias_mes] IS NOT NULL
        AND [subsidio_causado] IS NOT NULL AND [subsidio_causado] >= 0
        AND [subsidio_aplicado] IS NOT NULL AND [subsidio_aplicado] >= 0
        AND [subsidio_aplicado] <= [subsidio_causado] AND [subsidio_aplicado] <= [isr_causado]
        AND [isr_retenido] IS NOT NULL AND [isr_retenido] = [isr_causado] - [subsidio_aplicado]))
GO

-- Spec 70: deducciones por renglón, ligadas al catálogo payroll.deductions. Hoy solo id_deduction = 2 (ISR).
CREATE TABLE [payroll].[period_employee_deductions](
    [id_period_employee_deduction] [int] IDENTITY(1,1) NOT NULL,
    [id_period_employee]           [int]           NOT NULL,
    [id_deduction]                 [smallint]      NOT NULL,
    [importe]                      [decimal](12,2) NOT NULL,
 CONSTRAINT [PK_period_employee_deductions] PRIMARY KEY CLUSTERED ([id_period_employee_deduction] ASC),
 CONSTRAINT [UQ_period_employee_deductions] UNIQUE ([id_period_employee], [id_deduction]),
 CONSTRAINT [FK_period_employee_deductions_period_employee] FOREIGN KEY ([id_period_employee])
    REFERENCES [payroll].[period_employees] ([id_period_employee]) ON DELETE CASCADE,
 CONSTRAINT [FK_period_employee_deductions_deduction] FOREIGN KEY ([id_deduction])
    REFERENCES [payroll].[deductions] ([id_deduction]),
 CONSTRAINT [CK_period_employee_deductions_importe] CHECK ([importe] >= 0)
) ON [PRIMARY]
GO
```

- **El `ON DELETE CASCADE`** hace que "Recalcular" y "Revertir" borren las deducciones con el `DELETE` que ya ejecutan, así que `revertPayrollCalculation` no cambia.
- **No hay candado de "pagar una vez".** El ISR pertenece a su renglón y no compite entre periodos.
- **Fila de deducción.** Se inserta solo con `isr_estado = 'C'`, con `importe = isr_retenido` aunque valga 0. Sale del mismo conjunto que llena las columnas, así que no puede diferir de ellas.

**Tipos.**

- Archivo nuevo `interfaces/payroll_isr.ts`:

```ts
export type IsrStatus = "X" | "C" | "N";
export type IsrSkipReason = "no_withholding_table" | "income_in_gap" | "missing_subsidy_parameters";

export interface IIsrBreakdown {
  isr_estado:                    IsrStatus;
  isr_motivo:                    IsrSkipReason | null;
  isr_base_gravable:             number | null;
  isr_ejercicio_tarifa:          number | null;
  isr_limite_inferior:           number | null;
  isr_cuota_fija:                number | null;
  isr_porcentaje_excedente:      number | null;
  isr_causado:                   number | null;
  subsidio_monto_mensual:        number | null;
  subsidio_monto_vigente_desde:  string | null;   // "YYYY-MM-DD"
  subsidio_tope_ingreso_mensual: number | null;
  subsidio_tope_vigente_desde:   string | null;
  subsidio_factor_dias_mes:      number | null;
  subsidio_factor_vigente_desde: string | null;
  subsidio_con_derecho:          boolean | null;
  subsidio_causado:              number | null;
  subsidio_aplicado:             number | null;
  isr_retenido:                  number | null;
}
```

- **`interfaces/payroll_calculation.ts`:**
  - `IPayrollEmployeeSnapshot` extiende `IIsrBreakdown`.
  - `IPayrollEmployeeRow` gana `isr_estado`, `isr_retenido`, `total_deducciones` y `neto`. Los dos últimos se calculan en el SELECT.
  - `IPayrollProcessPage` gana los totales de ISR y neto y el conteo de "no calculado" por motivo.

**Constantes** (`lib/payroll/constants.ts`):

- `ISR_DEDUCTION_ID = 2`.
- `ISR_SKIP_REASON_LABELS`, con los textos en español de cada motivo.

**Convenciones:**

- **Redondeo.** `isr_causado` y `subsidio_causado` se redondean a 2 decimales cada uno. Las tasas intermedias (`monto / factor`) no se redondean.
- **Derecho al subsidio sin divisiones:** `base × factor <= tope × dias`. Con 7 días, una base de 2,646.33 tiene derecho y una de 2,646.34 no.
- **Orden de los motivos** cuando falla más de uno: `no_withholding_table`, luego `missing_subsidy_parameters`, luego `income_in_gap`.
- **Base 0:** queda `'C'` con tramo `NULL`, ISR 0, subsidio aplicado 0 y retenido 0. La tarifa empieza en 0.01, así que esto no se trata como hueco.
- **Fechas.** Los `*_vigente_desde` se leen con `CONVERT(varchar(10), ..., 120)`. Los `decimal` pasan por `CAST(... AS float)` al leer, como en las specs 64 a 69.
- **Neto** = `total_percepciones − total_deducciones`, con `total_deducciones = ISNULL(SUM(period_employee_deductions.importe), 0)`. En operativa el neto es igual a las percepciones.

## Plan de implementación

1. **BD.** Correr el DDL del Modelo de datos y documentarlo en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 69. No cambia código: los renglones existentes quedan en `'X'` por el `DEFAULT` y la app sigue igual.
   - Verificación con rollback de `CK_period_employees_isr`: rechaza `'C'` sin `isr_causado`, `'C'` con `isr_retenido <> isr_causado − subsidio_aplicado`, `'N'` sin motivo, y `'C'` o `'N'` en un renglón `'O'`.
   - Verificación: `period_employee_deductions` rechaza un `id_deduction` que no está en el catálogo y una segunda fila ISR para el mismo renglón.

2. **Tipos, constantes y helper puro.**
   - Crear `interfaces/payroll_isr.ts`, agregar `ISR_DEDUCTION_ID` e `ISR_SKIP_REASON_LABELS` a `lib/payroll/constants.ts`, y los campos nuevos a `interfaces/payroll_calculation.ts`.
   - Crear `lib/payroll/isrCalculation.ts`, sin BD y sin `Date`.
     - `calculateIsrBreakdown(base, dias, fechaFin, brackets, parameters)` devuelve un `IIsrBreakdown`. Reutiliza `findWithholdingBracket` y `resolveTaxParameterRow` de la spec 69.
     - `describeIsrSkipReason(reason)` traduce el motivo.
   - Verificación manual: los 5 casos de `NOM-2026-S01` (empleados 2, 5, 6, 1006 y 1007) dan exactamente la tabla de los criterios de aceptación.
     - El borde da subsidio con 2,646.33 y sin subsidio con 2,646.34.
     - La base 0 queda `'C'` con todo en 0.
     - Sin tarifa de la frecuencia da `no_withholding_table`.
     - Sin `SUBSIDIO_MONTO_MENSUAL` vigente da `missing_subsidy_parameters`.

3. **Cálculo en SQL dentro de `calculatePayrollPeriod`.**
   - Crear `lib/payroll/isrSql.ts` con los fragmentos que comparten el cálculo y el aviso:
     - `ISR_PARAMETERS_SQL` resuelve los 3 parámetros del subsidio con `TOP 1 ... vigente_desde <= fecha_fin ORDER BY vigente_desde DESC`.
     - `ISR_BRACKET_APPLY_SQL` toma el tramo de la frecuencia del periodo con `ejercicio = YEAR(fecha_fin)`.
     - `ISR_COLUMNS_SQL` contiene las expresiones de las 18 columnas.
   - En el batch, **después** del `INSERT` del snapshot, porque la base es `importe_salario` y esa columna se calcula en ese mismo `INSERT`:
     - un `UPDATE` de los renglones `'F'` recién insertados que llena el desglose;
     - un `INSERT` en `period_employee_deductions` con los renglones `'F'` en `'C'`.
   - Los renglones `'O'` no se tocan.
   - Verificación: al recalcular `NOM-2026-S01`, los 5 renglones `'F'` coinciden al centavo con los casos de prueba y tienen su fila `id_deduction = 2`. Las columnas anteriores de los renglones `'O'` y `'F'` quedan idénticas antes y después; solo cambian `calculated_at`, `calculated_by` y las columnas nuevas.
   - Verificación: un periodo quincenal se calcula sin error, con sus renglones `'F'` en `'N'` / `no_withholding_table` y sin filas de deducción. "Revertir" borra las deducciones por la cascada.

4. **Procesar, vista fiscal.**
   - `getPayrollProcessPage` agrega `isr_estado`, `isr_retenido`, `total_deducciones` y `neto` por renglón. También agrega el total de ISR, el total neto y el conteo de `'N'` por motivo, sin filtros de puesto ni de búsqueda, como los demás totales.
   - `PayrollEmployeesTable` muestra las columnas "ISR" y "Neto" solo con `tipo=fiscal`. El ISR muestra "No calculado" cuando el renglón está en `'N'` y "—" cuando está en `'X'`.
   - `PayrollProcessSummaryCards` agrega las tarjetas de ISR y neto en la vista fiscal.
   - Se crea `IsrNotCalculatedNotice` (Server Component). Dice cuántos renglones quedaron sin ISR y por qué, con liga a Parámetros fiscales.
   - Verificación: la vista operativa queda igual que antes. La fiscal de `NOM-2026-S01` muestra el ISR y el neto de cada empleado, y los totales cuadran con la suma de los renglones.

5. **Detalle, vista fiscal.**
   - `getPayrollEmployeeDetail` lee el desglose del snapshot.
   - Se crea `PayrollDeductionsCard` (Server Component, solo en fiscal), con:
     - la línea ISR: base, tramo ("límite inferior $X, cuota $Y, Z% sobre excedente"), ISR causado, subsidio causado y aplicado (con "Sin derecho: ingreso mayor al tope" cuando aplique) e ISR retenido;
     - el `vigente_desde` de cada parámetro y el ejercicio de la tarifa;
     - el total de deducciones y el neto.
   - En `'N'` muestra el motivo. En `'X'` muestra "Recalcula la nómina para ver el ISR".
   - Verificación: el detalle fiscal del empleado 5 muestra subsidio aplicado 113.20 (tope = ISR) y retenido 0. El del empleado 6 muestra "Sin derecho".

6. **Aviso "Recalcula".**
   - Se crea `lib/payroll/isrRecalculation.ts` (server-only) con `isIsrRecalculationNeeded(id_period)`. Solo actúa en estatus 2.
   - Con los mismos fragmentos de `isrSql.ts`, recalcula hoy el desglose de cada renglón `'F'` y lo compara con el snapshot: estado, motivo, ejercicio, tramo, ISR causado, los 3 parámetros con su vigencia, subsidio e ISR retenido.
   - Un renglón `'F'` en `'X'` también dispara el aviso.
   - Se muestra con `PayrollRecalculationNotice` en Procesar: "Hay cálculos de ISR que no coinciden con la tarifa o los parámetros actuales. Recalcula la nómina."
   - Verificación: editar `SUBSIDIO_TOPE_INGRESO_MENSUAL` o un tramo después de calcular muestra el aviso. Dejarlo como estaba lo quita. Recalcular también lo quita.

7. **Documentación.** En `docs/nomina.md`:
   - agregar la sección "ISR (spec 70)";
   - actualizar el párrafo inicial (las tablas, y que el ISR ya se calcula solo para la nómina fiscal semanal);
   - mencionar `PayrollDeductionsCard` en la sección del Detalle.

## Criterios de aceptación

**Base de datos**

- [x] `payroll.period_employees` tiene las 18 columnas del ISR, y `isr_estado` vale `'X'` por defecto.
- [x] `CK_period_employees_isr` rechaza:
  - `'C'` sin `isr_causado`;
  - `'C'` con `isr_retenido` distinto de `isr_causado − subsidio_aplicado`;
  - `subsidio_aplicado` mayor que `isr_causado`;
  - `'N'` sin motivo o con un motivo fuera de la lista;
  - `'C'` o `'N'` en un renglón `'O'`.
- [x] Existe `payroll.period_employee_deductions` y rechaza:
  - un `id_deduction` que no está en `payroll.deductions`;
  - una segunda fila del mismo `id_deduction` para el mismo renglón;
  - un `importe` negativo.
- [x] El DDL está en `queries.txt`, bloque `NOMINA PAYROLL`.

**Cálculo**

- [x] Al recalcular `NOM-2026-S01`, los renglones `'F'` quedan así:

  | Empleado | Base | ISR causado | Subsidio aplicado | ISR retenido |
  |---|---|---|---|---|
  | 2 | 2,275.00 | 164.88 | 123.34 | 41.54 |
  | 5 | 1,800.00 | 113.20 | 113.20 | 0.00 |
  | 6 | 3,900.00 | 402.95 | 0.00 | 402.95 |
  | 1006 | 2,205.28 | 157.29 | 123.34 | 33.95 |
  | 1007 | 2,450.00 | 183.92 | 123.34 | 60.58 |

- [x] El subsidio causado de esos renglones es 123.34 (535.65 / 30.4 × 7), con `subsidio_monto_vigente_desde = 2026-02-01`. El empleado 6 tiene `subsidio_con_derecho = 0`.
- [x] Cada renglón `'F'` en `'C'` tiene exactamente una fila `id_deduction = 2` con `importe = isr_retenido`, incluido el empleado 5 con 0.00.
- [x] Ningún renglón `'O'` tiene columnas de ISR llenas ni filas en `period_employee_deductions`.
- [x] Las columnas anteriores a esta spec de todos los renglones de `NOM-2026-S01` quedan idénticas antes y después de recalcular.
- [x] Un periodo quincenal se calcula sin error. Sus renglones `'F'` quedan en `'N'` / `no_withholding_table`, sin fila de deducción.
- [x] Sin `SUBSIDIO_MONTO_MENSUAL` vigente a `fecha_fin` (probado con rollback), los renglones `'F'` quedan en `'N'` / `missing_subsidy_parameters`.
- [x] Un renglón `'F'` con base 0 queda en `'C'`, con ISR causado, subsidio aplicado e ISR retenido en 0.
- [x] "Revertir" borra las filas de `period_employee_deductions` del periodo.
- [x] `calculateIsrBreakdown` da los mismos resultados que el SQL en los 5 casos.
- [x] `calculateIsrBreakdown` da subsidio con una base de 2,646.33 y 7 días, y no lo da con 2,646.34.

**Procesar**

- [x] La vista operativa no cambia: no aparecen columnas ni tarjetas de ISR.
- [x] La vista fiscal muestra las columnas "ISR" y "Neto". En `NOM-2026-S01`, el neto del empleado 2 es 2,233.46 (2,275.00 − 41.54).
- [x] Las tarjetas de ISR total y neto total son la suma de los renglones y no cambian con los filtros de puesto o búsqueda.
- [x] Con renglones en `'N'`, aparece el aviso con cuántos son, el motivo y una liga a Parámetros fiscales.
- [x] Un renglón `'F'` en `'X'` muestra "—" en ISR.

**Detalle**

- [ ] La vista fiscal muestra la tarjeta "Deducciones" con:
  - base, tramo, ISR causado, subsidio causado y aplicado, e ISR retenido;
  - el `vigente_desde` de los 3 parámetros y el ejercicio de la tarifa;
  - el total de deducciones y el neto.
- [ ] El empleado 6 muestra "Sin derecho: ingreso mayor al tope".
- [ ] Un renglón en `'N'` muestra el motivo, y uno en `'X'` muestra "Recalcula la nómina para ver el ISR".
- [ ] La vista operativa no muestra la tarjeta "Deducciones".

**Aviso "Recalcula"**

- [ ] Con el periodo en estatus 2, cambiar `SUBSIDIO_TOPE_INGRESO_MENSUAL` o un tramo de la tarifa 2026 muestra el aviso en Procesar.
- [ ] Devolver el valor original quita el aviso.
- [ ] Recalcular quita el aviso.
- [ ] Un periodo en estatus 2 con renglones `'F'` en `'X'` muestra el aviso.
- [ ] Un periodo en estatus 1 nunca muestra el aviso.

**Acceso**

- [ ] Ninguna action nueva o modificada devuelve datos a los roles 2, 3, 5 o 6. Todas pasan por `assertPayrollAccess()`.

**Documentación**

- [ ] `docs/nomina.md` tiene la sección "ISR (spec 70)", el párrafo inicial actualizado y `PayrollDeductionsCard` en la sección del Detalle.

## Decisiones tomadas y descartadas

- **Sí:** la base gravable es `importe_salario`. Es decisión del usuario: hoy la nómina fiscal solo trae sueldo, que es gravado al 100%.
- **No:** construir ahora el motor gravado/exento que lee `payroll.perceptions`. Sin percepciones exentas en `'F'` no habría con qué probarlo; llega cuando la nómina fiscal tenga horas extra, primas o aguinaldo.
- **Sí:** las deducciones van en una tabla genérica `payroll.period_employee_deductions` con FK al catálogo `payroll.deductions`, y el desglose del ISR en columnas de `period_employees`. Es decisión del usuario: liga el monto al catálogo y deja lista la fila del IMSS (`id_deduction = 1`).
- **No:** guardar solo columnas en `period_employees`. No aprovecha el catálogo de deducciones y obligaría a sumar columnas a mano con cada deducción nueva.
- **No:** una tabla 1:1 aparte para el desglose del ISR. Agrega un join sin ganar nada, porque el ISR es uno por renglón.
- **Sí:** si falta la tarifa o un parámetro, el periodo se calcula igual y el renglón `'F'` queda "No calculado" con un motivo. Es decisión del usuario: no bloquea la nómina operativa.
- **No:** que falle todo el "Calcular". Impediría calcular cualquier periodo quincenal mientras no exista su tarifa.
- **No:** cargar la tarifa quincenal en esta spec. Va en otra.
- **Sí:** la tarifa se toma del ejercicio = año de `fecha_fin`. Es decisión del usuario y coincide con la regla de vigencia de los parámetros (spec 69). Con `periods.ejercicio` (año de `fecha_inicio`), una semana que cruza el año nuevo usaría la tarifa de un año y el subsidio del otro.
- **Sí:** la tarifa del periodo se aplica tal cual, sin prorratear por días, también a quien ingresó a mitad del periodo. Es decisión del usuario: es la práctica habitual y el caso es raro.
- **Sí:** los días del subsidio son los días pagados (`dias`, ya sin faltas). Es decisión del usuario: las faltas no son días del pago. Los retardos no restan días.
- **No:** usar los días calendario del empleado ni la duración fija del periodo.
- **Sí:** el subsidio solo reduce el ISR hasta 0 y nunca se paga, como manda el decreto vigente desde mayo de 2024. `subsidio_aplicado = min(subsidio_causado, isr_causado)`.
- **Sí:** el derecho al subsidio se compara sin divisiones (`base × factor <= tope × dias`). Así el SQL y el helper de TS no difieren por redondeo en el borde.
- **Sí:** se guardan congelados el tramo, los 3 parámetros del subsidio y su `vigente_desde`. Así el Detalle explica el cálculo aunque después cambie la tarifa, y el aviso "Recalcula" tiene contra qué comparar. Era el riesgo que dejó anotado la spec 69.
- **Sí:** la fila de deducción se inserta aunque el retenido sea 0. Distingue "se calculó y dio 0" de "no se calculó".
- **Sí:** con base 0 el ISR queda calculado en 0, sin tramo. La tarifa empieza en 0.01, y tratarlo como hueco marcaría como error un caso válido.
- **Sí:** el cálculo vive en SQL dentro del batch de `calculatePayrollPeriod`, con un helper puro que repite la regla en TS; si difieren, manda el SQL. Es el mismo patrón de las specs 53 a 68.
- **Sí:** el ISR se calcula con un `UPDATE` después del `INSERT` del snapshot, y no dentro del `INSERT`. La base es `importe_salario`, que se calcula en ese mismo `INSERT`.
- **Sí:** el aviso "Recalcula" vuelve a calcular el ISR de hoy y lo compara con el snapshot. Es decisión del usuario. Comparar `updated_at` no sirve porque `tablas_retencion` no tiene esa columna.
- **Sí:** en esta spec entran las columnas ISR y Neto, las tarjetas en Procesar y la tarjeta "Deducciones" en Detalle, solo en la vista fiscal. Es decisión del usuario. La vista operativa no cambia.
- **No:** bloquear la aprobación con renglones "No calculado". El estatus 3 todavía no existe; le toca a la spec que lo construya.
- **No:** ISR en la nómina operativa. Es el esquema interno y no se entera al SAT.
- **Sí:** los parámetros de 2026 (y la UMA 2025 para enero) se capturaron durante la definición de esta spec, con el usuario 2 y su bitácora. Además se corrigió el último tramo semanal 2026, que tenía `limite_superior = 1,000,000` en lugar de `NULL`. Ver "Registro".

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| **Un parámetro o tramo mal capturado** produce retenciones incorrectas en toda la nómina fiscal. | Los 5 casos de prueba se calcularon con las cifras del DOF, el INEGI y el Anexo 8. Antes de pagar la primera nómina con ISR, que su contador o el simulador del SAT confirme al menos dos. La bitácora de la spec 69 deja rastro de los cambios a parámetros. |
| **Los cambios a la tarifa no dejan rastro**, porque `tablas_retencion` no tiene bitácora ni `updated_at`. | El snapshot congela el tramo usado y el aviso "Recalcula" detecta cualquier diferencia. Una bitácora de la tarifa queda para otra spec si hace falta. |
| **Olvidar capturar la UMA y el subsidio de febrero de 2027.** El resolutor seguiría usando el valor de enero de 2027 o el de 2026. | El Detalle muestra el `vigente_desde` de cada parámetro usado. Anotar la captura de enero y febrero en la operación anual. |
| **Faltan los datos del ejercicio nuevo en enero** (subsidio de enero, tarifa del año). | El renglón queda "No calculado" con su motivo y el aviso en Procesar lo hace visible. No hay valores por defecto. |
| **Se paga un periodo con renglones "No calculado"** (por ejemplo, uno quincenal) sin retener ISR. | El aviso en Procesar. La spec que construya el estatus 3 (Aprobada) debe bloquear la aprobación con renglones `'N'`. |
| **`calculatePayrollPeriod` encadena un concepto más.** Un error en el `UPDATE` podría tocar otras columnas. | El `UPDATE` solo escribe las columnas nuevas de los renglones `'F'` del periodo. Hay un criterio de aceptación que compara las columnas anteriores antes y después de recalcular. |
| **El SQL y `isrCalculation.ts` divergen** por redondeo o por la comparación del tope. | Los dos usan la misma comparación sin divisiones y el mismo orden de redondeo. Hay un criterio que exige el mismo resultado en los 5 casos y en el borde 2,646.33 / 2,646.34. Si difieren, manda el SQL. |
| **El criterio de días del subsidio (días pagados)** podría no coincidir con lo que aplica su contador. | Es una decisión registrada. Cambiarla solo toca la expresión de `dias` en `isrSql.ts` y en el helper. |
| **Cuando la nómina fiscal tenga otras percepciones** (horas extra, aguinaldo), `importe_salario` ya no será toda la base. | Queda fuera de alcance de forma explícita. La spec del motor gravado/exento debe cambiar la base y el criterio de "Base gravable" de esta. |

## Registro

- **2026-10-09 — Análisis y especificación.** Se revisó `docs/nomina.md`, la spec 69, `references/nomina/reglas_modulo_nomina.md` y la BD. Hallazgos:
  - `payroll.deductions` es un catálogo (`id_deduction`, `clave_sat`, `description`, `is_billed`, `status`) con 2 filas: `1` Seguridad social (SAT 001) y `2` ISR (SAT 002). No guarda montos por empleado.
  - Los renglones `'F'` solo traen `importe_salario`; comisiones, horas extra y bonos son solo operativa.
  - `payroll.tax_parameters` estaba vacía. `tablas_retencion` tenía 11 tramos semanales 2026 que coinciden con el Anexo 8 de la RMF 2026 (DOF 28-dic-2025), salvo el último `limite_superior`.
  - Hay un periodo calculado para probar: `NOM-2026-S01` (2026-09-14 a 2026-09-20, estatus 2, 5 renglones `'F'`).
- **2026-10-09 — Captura de parámetros fiscales (con autorización del usuario).** En una sola transacción, con `updated_by = 2` y `updated_at = 2026-10-09 15:39:14`, se insertaron 13 filas en `payroll.tax_parameters` con su fila de alta en `tax_parameters_log` (la bitácora pasó de 3 a 16 filas):
  - `SUBSIDIO_MONTO_MENSUAL` 536.21 desde 2026-01-01 (transitorio de enero: 15.59% × UMA mensual 2025) y 535.65 desde 2026-02-01 (15.02% × UMA mensual 2026).
  - `SUBSIDIO_TOPE_INGRESO_MENSUAL` 11,492.66 y `SUBSIDIO_FACTOR_DIAS_MES` 30.4, desde 2026-01-01. Fuente: decreto DOF 31-dic-2025.
  - `UMA_DIARIA` / `UMA_MENSUAL` / `UMA_ANUAL`: 113.14 / 3,439.46 / 41,273.52 desde 2025-02-01 y 117.31 / 3,566.22 / 42,794.64 desde 2026-02-01. Fuente: INEGI.
  - `SALARIO_MINIMO_GENERAL` 315.04 y `SALARIO_MINIMO_FRONTERA` 440.87, desde 2026-01-01. Fuente: CONASAMI, DOF 9-dic-2025.
  - `DIAS_ANIO` 365 desde 2026-01-01.
  - **Tarifa:** el tramo semanal 2026 desde 98,009.67 pasó de `limite_superior = 1,000,000` a `NULL` ("en adelante"). `tablas_retencion` no tiene bitácora, así que este cambio solo queda registrado aquí.
- **Pendiente:** confirmar al menos dos casos de prueba con el contador o el simulador del SAT. Al terminar cada paso, marcar sus criterios de aceptación; al cerrar la spec, cambiar el estado a "Implementado".

## Lo que no incluye esta spec

- El motor gravado/exento que lee los topes de `payroll.perceptions`.
- Tarifas de otras frecuencias (quincenal) y la tarifa anual del art. 152.
- IMSS (`id_deduction = 1`).
- Ajuste mensual o anual del ISR, y prorrateo de la tarifa por días.
- ISR de la nómina operativa.
- Bloquear la aprobación de periodos con "ISR no calculado".
- Recibos, timbrado CFDI y reporte del subsidio como "otros pagos".
- Captura manual o ajuste a mano del ISR.
- Cambios retroactivos en periodos aprobados o pagados.

Cada uno de estos puntos, si se llega a hacer, va en su propia spec.
