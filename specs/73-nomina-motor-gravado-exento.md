# 73 — Nómina: motor gravado/exento de la nómina fiscal

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md): los renglones fiscales `'F'`, `importe_salario` y `calculatePayrollPeriod`.
  - [54 — Detalle de percepciones por empleado](54-nomina-detalle-percepciones-empleado.md): `buildPerceptionLines` y la tarjeta "Percepciones totales".
  - [69 — Parámetros fiscales](69-nomina-parametros-fiscales-isr.md): el catálogo `payroll.perceptions` con `CK_perceptions_exencion`, `UMA_DIARIA` en `payroll.tax_parameters` y la regla de vigencia por `fecha_fin`.
  - [70 — Cálculo del ISR](70-nomina-calculo-isr-fiscal.md): `isrSql.ts`, `isrCalculation.ts`, el aviso "Recalcula" y la base gravable, que esta spec cambia.
- **Modifica base de datos:** Sí.
  - Tabla nueva `payroll.period_employee_perceptions`, con FK a `payroll.perceptions`.
  - `payroll.period_employees`: `CK_period_employees_isr` se reemplaza para admitir un motivo nuevo.
- **Fecha:** 2026-10-13
- **Objetivo:** Guardar cada percepción de la nómina fiscal como un renglón propio, con su importe gravado y exento calculado según la regla del catálogo `payroll.perceptions`. La base del ISR pasa a ser la suma de lo gravado. Esta spec no agrega percepciones nuevas: el sueldo entra como el primer renglón, 100% gravado, y el ISR de los periodos actuales no cambia. Las percepciones nuevas (horas extra fiscales, prima dominical, aguinaldo, prima vacacional, PTU) solo tendrán que generar su renglón.
- **Reglas de origen:** LISR art. 93 (fr. I horas extra, fr. XIV gratificación anual, prima vacacional, PTU y prima dominical), el catálogo `c_TipoPercepcion` del complemento de nómina 1.2 (pide `ImporteGravado` e `ImporteExento` por percepción) y `references/nomina/reglas_modulo_nomina.md` (2.4).

## Alcance

**Incluye:**

- **Base de datos.** El DDL se documenta en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 70.
  - `payroll.period_employee_perceptions`: un renglón por percepción y renglón `'F'`, con el importe, el gravado, el exento y la regla de exención congelada. `ON DELETE CASCADE` a `period_employees`.
  - `CK_period_employees_isr` se reemplaza para aceptar el motivo `exemption_not_calculated`.
- **Motor genérico**, sin lógica por concepto. Solo lee del catálogo `tipo_limite_exencion`, `porcentaje_exento`, `umas_limite` y `periodicidad_limite`:

  | Tipo | Exento |
  |---|---|
  | `N` ninguno | 0 |
  | `T` total | `importe` |
  | `P` porcentaje | `ROUND(importe × porcentaje / 100, 2)` |
  | `U` tope en UMA | `min(importe, tope_restante)` |
  | `M` porcentaje con tope | `min(ROUND(importe × porcentaje / 100, 2), tope_restante)` |

  - **Gravado = importe − exento.** El gravado nunca se redondea por separado, así que gravado + exento = importe al centavo.
  - **Tope de la ventana** (`U` y `M`) = `ROUND(umas_limite × UMA_DIARIA × multiplicador, 2)`. El multiplicador es `eventos` en `E`, los días pagados (`pe.dias`) en `D` y 1 en `S`, `M` y `A`.
  - **Tope restante** = `max(0, tope − exento_consumido_previo)`.
  - **`exento_consumido_previo`** depende de la periodicidad:
    - `E`, `D` y `S`: 0. En `E` el tope ya se multiplica por los eventos del renglón, y en `D` por los días. En `S`, la ventana es el periodo, porque solo se acepta en frecuencia semanal (ver "No calculado").
    - `A` (año) y `M` (mes): la suma de `importe_exento` de la **misma** `id_perception` y el **mismo** empleado en renglones `'F'` calculados (`'C'`) de **otros** periodos del mismo año (y del mismo mes, para `M`) de `fecha_fin`. Solo cuentan los periodos **anteriores**: `fecha_fin` menor o, si es igual, `id_period` menor. El acumulado no filtra por sucursal ni por frecuencia, porque el tope es por persona.
  - **UMA:** `UMA_DIARIA` vigente a `fecha_fin`, con la regla de la spec 69. El valor y su `vigente_desde` se congelan en el renglón.
- **"Exento no calculado".** El renglón queda `'N'`, con su motivo y sin gravado ni exento, cuando:
  - el tipo es `U` o `M` y no hay `UMA_DIARIA` vigente a `fecha_fin` (`missing_uma`);
  - la periodicidad es `S` y la frecuencia del periodo no es semanal (`unsupported_frequency`).

  Los tipos `N`, `T` y `P` no usan la UMA, así que siempre se calculan. No hay valores por defecto.
- **Cálculo dentro de `calculatePayrollPeriod`**, en el mismo batch y solo para los renglones `'F'`, **después** del `INSERT` del snapshot y **antes** del `UPDATE` del ISR:
  1. Se arma `#fiscal_perception_lines (id_period_employee, id_perception, importe, eventos)`. Hoy solo lleva el sueldo: `id_perception = 1` (`SALARY_PERCEPTION_ID`), `importe = importe_salario`, solo si es mayor que 0. Las specs de percepciones nuevas agregan su `UNION ALL` aquí.
  2. `INSERT` en `period_employee_perceptions` con el desglose del motor.
- **ISR (spec 70):**
  - **Base gravable** = `ISNULL(SUM(importe_gravado), 0)` de los renglones de percepción. Sin renglones (sueldo 0), la base es 0, como hoy.
  - Si algún renglón de percepción del empleado quedó `'N'`, el ISR queda `'N'` / `exemption_not_calculated` con la base en `NULL`. Orden de los motivos: `no_withholding_table`, `missing_subsidy_parameters`, `exemption_not_calculated` y `income_in_gap`.
  - El derecho al subsidio sigue comparando la base, que ahora es la gravada.
- **Helper puro** `lib/payroll/exemptionCalculation.ts`. Repite la regla en TS con enteros escalados, como `isrCalculation.ts`. Si difiere del SQL, manda el SQL.
- **Detalle, vista fiscal:**
  - la tarjeta "Percepciones totales" gana las columnas "Gravado" y "Exento" por línea;
  - debajo de cada línea, una nota con la regla aplicada;
  - los totales gravado y exento al pie. El total gravado es la base que muestra la tarjeta "Deducciones".
- **Aviso "Recalcula"** en estatus 2. Recalcula hoy el exento de cada renglón guardado y lo compara. Detecta cambios en el catálogo, en la UMA o en lo exentado en periodos anteriores. Un renglón `'F'` con sueldo y sin renglón de percepción (calculado antes de esta spec) también lo dispara.
- **Parámetros fiscales, pestaña Percepciones:** una nota fija: "La nómina fiscal usa estas reglas al calcular. Un cambio solo aplica a los periodos que se recalculen."
- **Documentación:** en `docs/nomina.md`, sección "Gravado/exento (spec 73)", y actualizar "Taxable base" de la sección ISR y el párrafo inicial.

**No incluye (para otras specs):**

- **Percepciones fiscales nuevas:** horas extra, prima dominical, aguinaldo, prima vacacional, PTU, bonos y comisiones en fiscal. Cada una genera su renglón en `#fiscal_perception_lines`.
- **Separar horas extra dobles y triples en el catálogo.** Hoy `id_perception = 5` es `'M'` y cubre solo las dobles. La spec de horas extra fiscales debe agregar un renglón de catálogo "Horas extra triples" (`019`, `'N'`), como ya pasa con las tres comisiones `028`.
- **El art. 174 del RLISR** (cálculo opcional del ISR de pagos extraordinarios). Requiere marcar en el catálogo qué percepciones son extraordinarias.
- **Exención del trabajador de salario mínimo** (horas extra 100% exentas) y cualquier regla por empleado.
- **El límite general de previsión social** (art. 93, penúltimo párrafo) y los vales de despensa.
- **IMSS** e integración al SBC. Es otro motor, con otras reglas; no reutiliza `importe_exento`.
- **Tarifas de otras frecuencias**, Aprobada/Pagada, recibos y timbrado CFDI.
- **Bitácora del catálogo `payroll.perceptions`.** El renglón congela la regla usada.
- **Gravado/exento en la nómina operativa.**

## Modelo de datos

**Cambios en BD.** El DDL va en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 70.

```sql
-- Spec 73: una fila por percepción de cada renglón fiscal, con su gravado y exento y la regla congelada.
-- exencion_estado: 'C' calculado, 'N' no calculado (sin gravado ni exento).
CREATE TABLE [payroll].[period_employee_perceptions](
    [id_period_employee_perception] [int] IDENTITY(1,1) NOT NULL,
    [id_period_employee]            [int]           NOT NULL,
    [id_perception]                 [smallint]      NOT NULL,
    [importe]                       [decimal](12,2) NOT NULL,
    [eventos]                       [smallint]      NULL,     -- solo periodicidad 'E'
    [exencion_estado]               [char](1)       NOT NULL,
    [exencion_motivo]               [varchar](30)   NULL,     -- solo 'N'
    [tipo_limite_exencion]          [char](1)       NOT NULL, -- regla congelada del catálogo
    [umas_limite]                   [decimal](9,4)  NULL,
    [porcentaje_exento]             [decimal](5,2)  NULL,
    [periodicidad_limite]           [char](1)       NULL,
    [uma_diaria]                    [decimal](18,4) NULL,     -- solo 'U' y 'M' calculados
    [uma_vigente_desde]             [date]          NULL,
    [tope_exento]                   [decimal](12,2) NULL,     -- tope de la ventana, solo 'U' y 'M'
    [exento_consumido_previo]       [decimal](12,2) NULL,     -- solo 'U' y 'M'; 0 salvo en 'A' y 'M'
    [importe_exento]                [decimal](12,2) NULL,
    [importe_gravado]               [decimal](12,2) NULL,
 CONSTRAINT [PK_period_employee_perceptions] PRIMARY KEY CLUSTERED ([id_period_employee_perception] ASC),
 CONSTRAINT [UQ_period_employee_perceptions] UNIQUE ([id_period_employee], [id_perception]),
 CONSTRAINT [FK_period_employee_perceptions_period_employee] FOREIGN KEY ([id_period_employee])
    REFERENCES [payroll].[period_employees] ([id_period_employee]) ON DELETE CASCADE,
 CONSTRAINT [FK_period_employee_perceptions_perception] FOREIGN KEY ([id_perception])
    REFERENCES [payroll].[perceptions] ([id_perception]),
 CONSTRAINT [CK_period_employee_perceptions_importe] CHECK ([importe] > 0),
 CONSTRAINT [CK_period_employee_perceptions_eventos] CHECK (
    ([periodicidad_limite] = 'E' AND [eventos] IS NOT NULL AND [eventos] > 0)
 OR (([periodicidad_limite] IS NULL OR [periodicidad_limite] <> 'E') AND [eventos] IS NULL)),
 -- La misma forma que CK_perceptions_exencion (spec 69), con IS NOT NULL explícito.
 CONSTRAINT [CK_period_employee_perceptions_regla] CHECK (
    ([tipo_limite_exencion] IN ('N','T','P') AND [umas_limite] IS NULL AND [periodicidad_limite] IS NULL
        AND [uma_diaria] IS NULL AND [tope_exento] IS NULL AND [exento_consumido_previo] IS NULL
        AND (([tipo_limite_exencion] = 'P' AND [porcentaje_exento] IS NOT NULL)
          OR ([tipo_limite_exencion] IN ('N','T') AND [porcentaje_exento] IS NULL)))
 OR ([tipo_limite_exencion] IN ('U','M') AND [umas_limite] IS NOT NULL AND [periodicidad_limite] IS NOT NULL
        AND (([tipo_limite_exencion] = 'M' AND [porcentaje_exento] IS NOT NULL)
          OR ([tipo_limite_exencion] = 'U' AND [porcentaje_exento] IS NULL)))),
 CONSTRAINT [CK_period_employee_perceptions_exencion] CHECK (
    ([exencion_estado] = 'C' AND [exencion_motivo] IS NULL
        AND [importe_exento] IS NOT NULL AND [importe_exento] >= 0
        AND [importe_gravado] IS NOT NULL AND [importe_gravado] >= 0
        AND [importe_exento] + [importe_gravado] = [importe]
        AND ([tipo_limite_exencion] NOT IN ('U','M')
          OR ([uma_diaria] IS NOT NULL AND [uma_vigente_desde] IS NOT NULL
              AND [tope_exento] IS NOT NULL AND [exento_consumido_previo] IS NOT NULL
              AND [exento_consumido_previo] >= 0)))
 OR ([exencion_estado] = 'N' AND [exencion_motivo] IS NOT NULL
        AND [exencion_motivo] IN ('missing_uma','unsupported_frequency')
        AND [importe_exento] IS NULL AND [importe_gravado] IS NULL))
) ON [PRIMARY]
GO

-- El acumulado anual/mensual busca por percepción y empleado en otros periodos.
CREATE NONCLUSTERED INDEX [IX_period_employee_perceptions_perception]
    ON [payroll].[period_employee_perceptions] ([id_perception], [id_period_employee])
    INCLUDE ([exencion_estado], [importe_exento])
GO

-- Spec 73: el ISR admite 'exemption_not_calculated', con la base en NULL (no se conoce).
ALTER TABLE [payroll].[period_employees] DROP CONSTRAINT [CK_period_employees_isr]
GO
ALTER TABLE [payroll].[period_employees] WITH CHECK ADD CONSTRAINT [CK_period_employees_isr] CHECK (
    ([isr_estado] = 'X'
        AND [isr_motivo] IS NULL AND [isr_base_gravable] IS NULL AND [isr_causado] IS NULL
        AND [isr_retenido] IS NULL AND [subsidio_causado] IS NULL AND [subsidio_aplicado] IS NULL)
 OR ([isr_estado] = 'N' AND [tipo_nomina] = 'F'
        AND [isr_motivo] IS NOT NULL
        AND (([isr_motivo] IN ('no_withholding_table','income_in_gap','missing_subsidy_parameters')
                AND [isr_base_gravable] IS NOT NULL AND [isr_base_gravable] >= 0)
          OR ([isr_motivo] = 'exemption_not_calculated' AND [isr_base_gravable] IS NULL))
        AND [isr_causado] IS NULL AND [isr_retenido] IS NULL
        AND [subsidio_causado] IS NULL AND [subsidio_aplicado] IS NULL)
 OR ([isr_estado] = 'C' AND [tipo_nomina] = 'F'
        -- … sin cambios respecto a la spec 70 …
    ))
GO
```

- **El `ON DELETE CASCADE`** hace que "Recalcular" y "Revertir" borren los renglones de percepción con el `DELETE` que ya ejecutan; `revertPayrollCalculation` no cambia. Al recalcular un periodo, sus propios renglones ya no existen cuando se calcula el acumulado, así que nunca se cuenta a sí mismo.
- **No hay candado de "pagar una vez".** El renglón pertenece a su periodo. El acumulado de `A` y `M` solo lee, no bloquea.
- **`UQ (id_period_employee, id_perception)`:** una percepción aparece una vez por renglón. Lo que se repite dentro del periodo (domingos trabajados) se expresa con `eventos`, no con varios renglones.
- **`importe > 0`:** una percepción en 0 no genera renglón, igual que el CFDI no la reporta.
- **`id_taxed_exempt` y `exempt_limit`** del catálogo siguen sin leerse; el motor solo usa los campos estructurados de la spec 69.
- **`status` del catálogo no se lee.** Desactivar una percepción no cambia cómo se calcula; el sueldo siempre usa `id_perception = 1`.

**Tipos.**

- Archivo nuevo `interfaces/payroll_exemption.ts`:

```ts
import type { ExemptionLimitType, ExemptionPeriodicity } from "@/interfaces/payroll_tax_parameters";

export type ExemptionStatus = "C" | "N";
export type ExemptionSkipReason = "missing_uma" | "unsupported_frequency";

export interface IPeriodEmployeePerception {
  id_perception:           number;
  clave_sat:               string;
  description:             string;
  importe:                 number;
  eventos:                 number | null;
  exencion_estado:         ExemptionStatus;
  exencion_motivo:         ExemptionSkipReason | null;
  tipo_limite_exencion:    ExemptionLimitType;
  umas_limite:             number | null;
  porcentaje_exento:       number | null;
  periodicidad_limite:     ExemptionPeriodicity | null;
  uma_diaria:              number | null;
  uma_vigente_desde:       string | null;   // "YYYY-MM-DD"
  tope_exento:             number | null;
  exento_consumido_previo: number | null;
  importe_exento:          number | null;
  importe_gravado:         number | null;
}
```

- `interfaces/payroll_isr.ts`: `IsrSkipReason` gana `"exemption_not_calculated"`.
- `interfaces/payroll_calculation.ts`: `IPayrollPerceptionLine` gana `taxBreakdown: { taxed: number | null; exempt: number | null; note: string } | null` (`null` en operativa). La respuesta del Detalle gana `totalTaxed` y `totalExempt`.

**Constantes** (`lib/payroll/constants.ts`):

- `SALARY_PERCEPTION_ID = 1`.
- `PERCEPTION_LINE_KEY_BY_ID: Record<number, string> = { 1: "sueldo_base" }`. Liga cada renglón guardado con su línea de `buildPerceptionLines`. Cada spec de percepción nueva agrega su entrada.
- `EXEMPTION_SKIP_REASON_LABELS` y el texto de `exemption_not_calculated` en `ISR_SKIP_REASON_LABELS`.

**Convenciones:**

- **Redondeo.** El tope y el exento por porcentaje se redondean a 2 decimales cada uno; el gravado es la resta. El tope multiplica antes de redondear (`umas × uma × multiplicador`).
- **Fechas.** `uma_vigente_desde` se lee con `CONVERT(varchar(10), ..., 120)`; los `decimal`, con `CAST(... AS float)`, como en las specs 64 a 70.
- **Año y mes del acumulado:** los de `fecha_fin`, igual que la tarifa del ISR (spec 70). Ver "Decisiones".
- **Frecuencia semanal:** `RH.payment_periods.clave_sat = '02'`, resuelta en SQL, nunca un id fijo (como la spec 69).

## Plan de implementación

1. **BD.** Correr el DDL y documentarlo en `queries.txt`. No cambia código: sin renglones de percepción, el ISR actual sigue igual hasta recalcular.
   - Verificación con rollback de `CK_period_employee_perceptions_exencion`: rechaza `'C'` con exento + gravado ≠ importe, `'C'` de tipo `U` sin `tope_exento`, `'N'` con gravado y `'N'` sin motivo.
   - Verificación con rollback de `CK_period_employee_perceptions_regla`: rechaza `'U'` sin `umas_limite`, `'P'` sin porcentaje y `'E'` sin `eventos`.
   - Verificación: rechaza una segunda fila de la misma percepción en el mismo renglón y un `id_perception` fuera del catálogo.
   - Verificación: el nuevo `CK_period_employees_isr` acepta `'N'` / `exemption_not_calculated` con base `NULL` y lo rechaza con base. Los renglones existentes de `NOM-2026-S01` siguen siendo válidos.

2. **Tipos, constantes y helper puro.**
   - Crear `interfaces/payroll_exemption.ts`, agregar las constantes y el motivo nuevo del ISR.
   - Crear `lib/payroll/exemptionCalculation.ts`, sin BD y sin `Date`:
     - `calculatePerceptionExemption({ importe, rule, eventos, diasPagados, umaDiaria, isWeeklyFrequency, consumedBefore })` devuelve el desglose (estado, motivo, tope, exento, gravado). Trabaja en centavos enteros, con el mismo redondeo que `ROUND` de SQL (mitad hacia arriba en positivos).
     - `describePerceptionExemption(line)` arma la nota del Detalle: "Gravado al 100%", "Exento al 100%", "Exento 50%", "Exento 50% hasta 5 UMA por semana (tope $586.55)", "Exento hasta 30 UMA al año: tope $3,519.30, usado antes $0.00 (UMA desde 2026-02-01)" o el motivo de "No calculado".
   - Verificación manual con `UMA_DIARIA` = 117.31; los casos esperados están en "Criterios de aceptación".

3. **SQL del motor.**
   - Crear `lib/payroll/exemptionSql.ts` (server-only), al estilo de `isrSql.ts:1`:
     - `EXEMPTION_PARAMETERS_SQL`: declara `@exemption_uma_daily` y `@exemption_uma_daily_since` (`TOP 1 … vigente_desde <= @fecha_fin ORDER BY vigente_desde DESC`) y `@exemption_is_weekly` (la frecuencia del periodo tiene `clave_sat = '02'`).
     - `EXEMPTION_APPLY_SQL`: `APPLY`s sobre una línea `fl` (con `importe`, `eventos`, `id_perception`), su `pe` y la regla `rule`. Calcula el multiplicador, el tope, el acumulado previo (solo `A` y `M`, con la condición de "periodo anterior"), el motivo, el exento y el gravado.
     - `EXEMPTION_COLUMNS_SQL`: las columnas del renglón con su expresión, para el `INSERT` y para el aviso.
   - En `calculatePayrollPeriod` (`app/dashboard/nomina/procesar/actions.ts:1104`), entre el `INSERT` del snapshot y `ISR_PARAMETERS_SQL`:
     - armar `#fiscal_perception_lines` con el sueldo de los renglones `'F'` con `importe_salario > 0`;
     - `INSERT INTO period_employee_perceptions` desde `#fiscal_perception_lines` unido a `pe` y a `payroll.perceptions`, con `EXEMPTION_APPLY_SQL`. La regla se lee del catálogo en ese momento y queda congelada.
   - Verificación: al recalcular `NOM-2026-S01` aparecen 5 renglones `id_perception = 1`, `'C'`, tipo `N`, exento 0 y gravado = `importe_salario`.

4. **ISR sobre la base gravada.**
   - En `isrSql.ts`, `ISR_BRACKET_APPLY_SQL` empieza con un `CROSS APPLY isr_base` que suma `importe_gravado` de `period_employee_perceptions` del renglón y marca si hay alguno en `'N'`. `pe.[importe_salario]` se reemplaza por `isr_base.gravable` en el tramo, el ISR causado y el derecho al subsidio.
   - `isr_skip` agrega `exemption_not_calculated` en su lugar del orden. `isr_base_gravable` queda en `NULL` en ese caso.
   - `isrCalculation.ts`: `calculateIsrBreakdown` recibe la base gravable (ya no el sueldo) y un indicador de exento pendiente.
   - Verificación: después de recalcular `NOM-2026-S01`, las 18 columnas del ISR y las filas de `period_employee_deductions` son idénticas a las de antes (tabla de la spec 70). Solo cambian `calculated_at`, `calculated_by` y los renglones nuevos.

5. **Detalle, vista fiscal.**
   - `getPayrollEmployeeDetail` lee los renglones de percepción del snapshot `'F'` (con `clave_sat` y `description` del catálogo) y llena `taxBreakdown` de cada línea por `PERCEPTION_LINE_KEY_BY_ID`. Un renglón guardado sin línea correspondiente se agrega al final con la descripción del catálogo, para que el Detalle nunca esconda un importe.
   - La tarjeta "Percepciones totales" muestra las columnas "Gravado" y "Exento" solo en fiscal, la nota de `describePerceptionExemption` y los totales. En `'N'` muestra "No calculado" y el motivo. Un snapshot sin renglones (calculado antes de esta spec) muestra "—" y "Recalcula la nómina para ver el gravado y exento".
   - Verificación: el Detalle fiscal del empleado 2 en `NOM-2026-S01` muestra el sueldo 2,275.00, gravado 2,275.00, exento 0.00, "Gravado al 100%", y el total gravado igual a la base de la tarjeta "Deducciones". La vista operativa no cambia.

6. **Aviso "Recalcula".**
   - Crear `lib/payroll/exemptionRecalculation.ts` (server-only) con `isExemptionRecalculationNeeded(id_period)`. Solo actúa en estatus 2.
   - Recalcula cada renglón guardado con el catálogo, la UMA y los acumulados de hoy, sobre el `importe` y `eventos` guardados, y compara con `EXISTS (SELECT guardado EXCEPT SELECT hoy)`. También dispara con un renglón `'F'` con `importe_salario > 0` y sin su renglón de sueldo.
   - Se muestra con `PayrollRecalculationNotice` en Procesar: "Hay percepciones cuyo exento no coincide con el catálogo, la UMA o lo exentado en periodos anteriores. Recalcula la nómina."
   - Verificación: con `NOM-2026-S01` recalculado, cambiar la percepción 1 de `N` a `P` 50% en el catálogo muestra el aviso; devolverla lo quita.

7. **Parámetros fiscales y documentación.**
   - Nota fija en la pestaña Percepciones (Server Component, sin estado).
   - `docs/nomina.md`:
     - sección "Gravado/exento (spec 73)";
     - "Taxable base" de la sección ISR pasa a `SUM(importe_gravado)`;
     - quitar el motor de los "Out of scope" de las specs 69 y 70;
     - el párrafo inicial y la lista de tablas.

## Criterios de aceptación

**Base de datos**

- [x] Existe `payroll.period_employee_perceptions` con sus FK, `UQ` e índice. Rechaza:
  - `'C'` con exento + gravado distinto del importe, o con exento o gravado negativo;
  - `'C'` de tipo `U` o `M` sin UMA, tope o acumulado;
  - `'N'` con gravado o exento, o sin motivo, o con un motivo fuera de la lista;
  - una regla que no cumple la forma de `CK_perceptions_exencion`, y `'E'` sin `eventos`;
  - `importe` 0 o negativo;
  - una segunda fila de la misma percepción para el mismo renglón.
- [x] `CK_period_employees_isr` acepta `'N'` / `exemption_not_calculated` solo con la base en `NULL`, y sigue rechazando lo que rechazaba en la spec 70.
- [x] El DDL está en `queries.txt`, bloque `NOMINA PAYROLL`.

**Motor (helper puro, `UMA_DIARIA` = 117.31)**

| Caso | Regla | Importe | Otros | Exento | Gravado |
|---|---|---|---|---|---|
| Sueldo | `N` | 2,275.00 | — | 0.00 | 2,275.00 |
| Total | `T` | 500.00 | — | 500.00 | 0.00 |
| Porcentaje, redondeo | `P` 50% | 1,234.57 | — | 617.29 | 617.28 |
| Horas extra bajo el tope | `M` 50%, 5 UMA, `S` | 800.00 | semanal | 400.00 | 400.00 |
| Horas extra sobre el tope | `M` 50%, 5 UMA, `S` | 1,500.00 | semanal | 586.55 | 913.45 |
| Prima dominical, tope gana | `U` 1 UMA, `E` | 300.00 | 2 eventos | 234.62 | 65.38 |
| Prima dominical, importe gana | `U` 1 UMA, `E` | 300.00 | 3 eventos | 300.00 | 0.00 |
| Aguinaldo, primer pago | `U` 30 UMA, `A` | 5,000.00 | previo 0 | 3,519.30 | 1,480.70 |
| Aguinaldo, tope parcial | `U` 30 UMA, `A` | 2,000.00 | previo 3,000.00 | 519.30 | 1,480.70 |
| Aguinaldo, tope agotado | `U` 30 UMA, `A` | 2,000.00 | previo 3,519.30 | 0.00 | 2,000.00 |

- [ ] `calculatePerceptionExemption` da exactamente la tabla anterior.
- [ ] Sin UMA, `U` y `M` quedan `'N'` / `missing_uma`, y `N`, `T` y `P` se calculan.
- [ ] `S` en una frecuencia que no es semanal queda `'N'` / `unsupported_frequency`.

**Cálculo**

- [ ] Al recalcular `NOM-2026-S01`, cada uno de los 5 renglones `'F'` (empleados 2, 5, 6, 1006 y 1007) tiene exactamente un renglón `id_perception = 1`, `'C'`, tipo `N`, exento 0.00 y gravado = `importe_salario`.
- [ ] Las 18 columnas del ISR y las filas de deducción de `NOM-2026-S01` son idénticas antes y después de recalcular (empleado 2: base 2,275.00, retenido 41.54; empleado 6: base 3,900.00, retenido 402.95).
- [ ] Las columnas de los renglones `'O'` y las columnas de `'F'` anteriores a esta spec no cambian; ningún renglón `'O'` tiene renglones de percepción.
- [ ] **Prueba de integración con el catálogo cambiado.** Se cambia la percepción 1 a `U` 15 UMA `A` y se recalcula `NOM-2026-S01`. Cada renglón queda con exento 1,759.65 y gravado: 515.35 (2), 40.35 (5), 2,140.35 (6), 445.63 (1006) y 690.35 (1007). El ISR se calcula sobre ese gravado. Se devuelve la percepción a `N`, se recalcula y todo vuelve a los valores originales.
- [ ] **Acumulado.** Con la misma regla temporal, se crea y calcula `NOM-2026-S02`. Sus renglones tienen `exento_consumido_previo` = 1,759.65, exento 0.00 y gravado = el sueldo. Recalcular después `NOM-2026-S01` no cambia S01 (S02 no es anterior). Al terminar, se revierte y se borra S02, se devuelve el catálogo y se recalcula S01.
- [ ] Sin `UMA_DIARIA` vigente (rollback) y con una percepción `U` en un renglón, ese renglón queda `'N'` / `missing_uma` y el ISR del empleado queda `'N'` / `exemption_not_calculated`, sin fila de deducción.
- [ ] "Revertir" borra los renglones de percepción del periodo.
- [ ] El helper TS y el SQL dan el mismo resultado en la prueba de integración.

**Detalle**

- [ ] La vista fiscal muestra "Gravado" y "Exento" por línea, la nota de la regla y los totales; el total gravado es igual a la base de la tarjeta "Deducciones".
- [ ] Un renglón `'N'` muestra "No calculado" y el motivo; un snapshot sin renglones muestra "—" y el aviso de recalcular.
- [ ] La vista operativa no cambia.

**Aviso "Recalcula"**

- [ ] En estatus 2, cambiar la regla de una percepción usada o la `UMA_DIARIA` vigente muestra el aviso; devolverla lo quita; recalcular lo quita.
- [ ] Un renglón `'F'` con sueldo y sin renglón de percepción muestra el aviso.
- [ ] Un periodo en estatus 1 nunca lo muestra.

**Acceso y documentación**

- [ ] Ninguna action nueva o modificada devuelve datos a los roles 2, 3, 5 o 6; todas pasan por `assertPayrollAccess()`.
- [ ] `docs/nomina.md` tiene la sección "Gravado/exento (spec 73)" y la base del ISR actualizada.

## Decisiones tomadas y descartadas

- **Sí:** una tabla de renglones de percepción, con gravado y exento por renglón. El complemento de nómina 1.2 pide esos importes por percepción, y cada concepto nuevo solo agrega un renglón.
- **No:** columnas `gravado_*` / `exento_*` por concepto en `period_employees`, como en la operativa. No escala y obligaría a sumar columnas a mano para la base del ISR y para el CFDI.
- **Sí:** el sueldo también es un renglón (`N`). La base del ISR es una sola suma, sin caso especial para el sueldo.
- **Sí:** un motor genérico guiado por el catálogo. Ninguna línea de código dice "si es aguinaldo". Cambiar un tope legal es editar el catálogo, no el código.
- **Sí:** se congela la regla, la UMA con su vigencia, el tope y el acumulado previo en cada renglón. El Detalle explica el cálculo aunque cambie el catálogo, y el aviso tiene contra qué comparar. Además, el catálogo no tiene bitácora.
- **Sí:** el gravado es la resta del exento. Así gravado + exento = importe al centavo, que es lo que valida el SAT.
- **Sí:** el acumulado de `A` y `M` solo cuenta periodos **anteriores** (`fecha_fin`, luego `id_period`). Así el resultado no depende del orden en que se calcula. Recalcular un periodo anterior puede cambiar lo que debió exentar uno posterior; el aviso "Recalcula" del posterior lo detecta.
- **No:** acumular por fecha de cálculo. Recalcular un periodo viejo cambiaría lo exentado según el día en que alguien apretó el botón.
- **Propuesta, confirmar con el contador:** el año y el mes del acumulado son los de `fecha_fin`, igual que la tarifa del ISR (spec 70). Legalmente el ISR se causa al pago (`fecha_pago`). Las dos fechas solo difieren en un periodo que se paga en diciembre y termina en enero. Si se cambia, se cambian **las dos a la vez** (`ISR_PARAMETERS_SQL` y `EXEMPTION_APPLY_SQL`) para que la tarifa y los topes usen el mismo año.
- **Sí:** el acumulado no filtra por sucursal ni frecuencia. El tope es por persona.
- **No:** limitar el acumulado a periodos Aprobados o Pagados. Esos estatus todavía no existen; cuando existan, la spec del estatus 3 debe decidir si cambia el criterio.
- **Sí:** la periodicidad `S` solo se acepta en frecuencia semanal; en otras queda "No calculado". Partir un periodo quincenal en semanas calendario se hace cuando llegue la tarifa quincenal y haya horas extra fiscales que lo necesiten.
- **Sí:** lo que se repite en el periodo (domingos) va en `eventos` de un solo renglón, con `UQ (id_period_employee, id_perception)`. El CFDI reporta una percepción por tipo.
- **Sí:** si un renglón de percepción no se puede calcular, el ISR del empleado queda `'N'` / `exemption_not_calculated` en lugar de calcularse sobre una base incompleta. Mismo criterio que la spec 70: nunca un valor por defecto en silencio.
- **Sí:** la base del ISR es `NULL` en ese caso. Guardar una base parcial parecería correcta sin serlo.
- **Sí:** el cálculo vive en SQL, con un helper TS que lo repite; si difieren, manda el SQL. Es el patrón de las specs 53 a 70.
- **No:** calcular el exento en TS y escribir los renglones desde Node. Rompería el batch único con `BEGIN TRAN` de `calculatePayrollPeriod` y el aviso, que reutiliza los mismos fragmentos SQL.
- **No:** columnas nuevas en Procesar. Hoy el exento siempre es 0; cuando haya percepciones exentas, la spec que las traiga decide si hace falta.
- **No:** usar `id_taxed_exempt` ni `exempt_limit`. La regla estructurada de la spec 69 los reemplaza.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| **El ISR de los periodos actuales cambia** al pasar la base a la suma de renglones. | Criterio que exige las 18 columnas idénticas antes y después en `NOM-2026-S01`. |
| **Una regla mal capturada en el catálogo** exenta de más o de menos en toda la nómina fiscal, y el catálogo no tiene bitácora. | La regla queda congelada en cada renglón, el Detalle la muestra y el aviso detecta el cambio. Una bitácora del catálogo queda para otra spec si hace falta. |
| **Olvidar la UMA de febrero:** se sigue usando la de enero y los topes salen bajos. | El Detalle muestra `uma_vigente_desde`. Mismo riesgo que la spec 69, ya anotado en la operación anual. |
| **Dependencia entre periodos en `A` y `M`:** recalcular un periodo anterior deja mal el exento de uno posterior ya calculado. | El aviso del posterior lo detecta (compara `exento_consumido_previo`). Cuando exista Aprobada, un periodo aprobado no se recalcula. |
| **Dos cálculos simultáneos** de periodos del mismo empleado leen cada uno el acumulado viejo del otro. | Hoy hay un periodo por frecuencia y sucursal a la vez y el caso es raro. El aviso "Recalcula" lo detecta en el periodo posterior. |
| **El subsidio cambia de comportamiento** cuando haya exentos: el derecho se compara con la base gravada, no con el total pagado. | Es la regla del decreto (ingresos que sirven de base para el impuesto). Confirmar con el contador al llegar la primera percepción exenta. |
| **El SQL y el helper TS divergen** por redondeo. | Los dos redondean igual y en el mismo orden; hay criterios con casos de redondeo y la prueba de integración. Si difieren, manda el SQL. |
| **`calculatePayrollPeriod` encadena un paso más** entre el snapshot y el ISR. | El paso solo inserta en la tabla nueva. Criterio que compara las columnas anteriores antes y después. |
| **Una línea guardada sin entrada en `PERCEPTION_LINE_KEY_BY_ID`** no se vería en el Detalle. | El Detalle agrega al final cualquier renglón guardado sin línea, con la descripción del catálogo. |

## Registro

- **2026-10-13 — Análisis y especificación.** Se revisó `docs/nomina.md`, las specs 69 y 70, `lib/payroll/isrSql.ts`, `lib/payroll/isrRecalculation.ts`, `lib/payroll/perceptionLines.ts`, `calculatePayrollPeriod` y la BD. Hallazgos:
  - `payroll.perceptions` tiene 12 filas. Ya capturadas: 1 Sueldos `N`; 2 Aguinaldo `U` 30 UMA `A`; 3 PTU `U` 15 UMA `A`; 5 Horas extras `M` 50% 5 UMA `S`; 6 Prima dominical `U` 1 UMA `E`; 7 Prima vacacional `U` 15 UMA `A`. Las comisiones (8, 11, 12, todas `028`) y los premios (4, 10) están en `N`.
  - **9 Vales de despensa** está en `N`, pero su `id_taxed_exempt` legado es 3 ("Gravado y Exento"). El motor solo lee `tipo_limite_exencion`, así que hoy se trata como gravado al 100%. Revisarlo cuando se usen vales (límite de previsión social, fuera de alcance).
  - Solo hay una percepción de horas extra (5, `M`); las triples, que son 100% gravadas, necesitan su propio renglón de catálogo en la spec de horas extra fiscales.
  - `NOM-2026-S01` (id 38, estatus 2, `fecha_fin` 2026-09-20, `fecha_pago` 2026-09-18) tiene 5 renglones `'F'` en `'C'`; sus bases y retenidos coinciden con la tabla de la spec 70. La `UMA_DIARIA` vigente a esa fecha es 117.31 (desde 2026-02-01).
- **Pendiente antes de aprobar:**
  - Confirmar con el contador el criterio de año y mes (`fecha_fin` contra `fecha_pago`).
  - Confirmar que el derecho al subsidio se compara con la base gravada.
- Al terminar cada paso, marcar sus criterios de aceptación; al cerrar la spec, cambiar el estado a "Implementado".

## Lo que no incluye esta spec

- Percepciones fiscales nuevas (horas extra, prima dominical, aguinaldo, prima vacacional, PTU, bonos, comisiones).
- Separar horas extra dobles y triples en el catálogo.
- El art. 174 del RLISR para pagos extraordinarios.
- Exención del trabajador de salario mínimo y reglas por empleado.
- Límite general de previsión social y vales de despensa.
- IMSS e integración al SBC.
- Partir periodos no semanales en semanas para la periodicidad `S`.
- Bitácora del catálogo `payroll.perceptions`.
- Gravado/exento en la nómina operativa.
- Columnas de gravado/exento en Procesar.

Cada uno de estos puntos, si se llega a hacer, va en su propia spec.
