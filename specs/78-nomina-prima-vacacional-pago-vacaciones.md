# 78 — Nómina: prima vacacional y pago de vacaciones no disfrutadas

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [53 — Cálculo de salario](53-nomina-calculo-salario.md): `calculatePayrollPeriod`, `payroll.period_employees` y su snapshot de `salario_diario` / `salario_diario_fiscal`.
  - [54 — Detalle por empleado](54-nomina-detalle-percepciones-empleado.md): `buildPerceptionLines` y `PayrollPerceptionsCard`.
  - [61 — Horas extra: pago](61-nomina-horas-extra-pago.md) y [75 — Horas extra fiscal](75-nomina-horas-extra-fiscal.md): el patrón que se copia. Paga en ambas nóminas con el salario de cada tipo, guarda un desglose con `ON DELETE CASCADE` y usa un candado `UNIQUE` para pagar una sola vez por tipo de nómina.
  - [69 — Parámetros fiscales](69-nomina-parametros-fiscales-isr.md): la percepción `id 7` "Prima vacacional" (clave 021, `'U'`, 15 UMA por año) ya está en el catálogo.
  - [70 — ISR](70-nomina-calculo-isr-fiscal.md) y [73 — Motor gravado/exento](73-nomina-motor-gravado-exento.md): la prima y los días pagados entran a `#fiscal_perception_lines`, y lo gravado suma a la base del ISR.
  - [76 — Asignación de vacaciones](76-empleado-asignacion-vacaciones.md): de `RH.vacation_entitlements` se leen `dias_derecho`, `fecha_inicio` del bloque, `fecha_pago` y `dias_pagados`.
  - [77 — Excluir vacaciones de incidencias](77-nomina-excluir-vacaciones-incidencias.md): los días disfrutados ya se pagan dentro del sueldo base porque no son falta. Esta spec no los vuelve a pagar.
- **Modifica base de datos:** Sí.
  - `payroll.period_employees` gana 4 columnas: días e importe de la prima, y días e importe de las vacaciones pagadas.
  - Tabla nueva `payroll.period_employee_vacations`: el desglose por año de derecho, que sirve también de candado de un solo pago.
  - Percepción nueva `id 14` "Vacaciones pagadas" (clave 001, `'N'`), sembrada con un script idempotente.
- **Fecha:** 2026-10-14
- **Objetivo:** Pagar en ambas nóminas, con el salario de cada una, dos conceptos. El primero es la prima vacacional (25% sobre todos los días de derecho), en el periodo donde inicia el bloque o, sin bloque, en el que contiene la fecha de pago. El segundo son los días no disfrutados, en el periodo que contiene su `fecha_pago`. Cada uno se paga una sola vez, con gravado/exento fiscal, aviso "Recalcula" y su estatus en la pestaña Vacaciones.
- **Reglas de origen:** `references/nomina/reglas_modulo_nomina.md` §1.3 (vacaciones y prima se pagan por transferencia) y §2.5 (fórmula de la prima y estatus `PRIMA VACACIONAL PAGADA / PENDIENTE`); spec 76, sección "No incluye"; LFT art. 80; LISR art. 93 fr. XIV (exención de 15 UMA).

## Alcance

**Incluye:**

- **Evento de pago por año de derecho** (`RH.vacation_entitlements`). Se generan dos conceptos:
  - **Prima vacacional.** Su fecha de evento es `fecha_inicio` cuando el año tiene bloque capturado. Si no tiene bloque pero sí `fecha_pago`, la fecha de evento es `fecha_pago`. Si no tiene ninguna de las dos, el año no genera prima.
    - Se calcula sobre **todos** los `dias_derecho`, aunque solo se tome una parte, y se paga **una sola vez** por año.
    - Importe: `ROUND(dias_derecho × salario_diario × 0.25, 2)`. Se multiplica todo antes de redondear.
  - **Vacaciones pagadas** (días no disfrutados). Su fecha de evento es `fecha_pago` y solo existe cuando se marcó el pago (spec 76).
    - Importe: `ROUND(dias_pagados × salario_diario, 2)`.
  - Un año con bloque parcial genera la prima en el periodo de `fecha_inicio` y los días sobrantes en el periodo de `fecha_pago`, que pueden ser periodos distintos.
- **Qué periodo paga.** Paga el periodo cuyo rango `fecha_inicio..fecha_fin` contiene la fecha de evento. Además se exige:
  - que el empleado tenga fila de ese tipo en el periodo, es decir, salario `> 0` en ese tipo (mismas reglas de elegibilidad que la spec 53);
  - que el concepto no esté pagado ya en ese tipo por otro periodo.
- **Ambas nóminas.** La operativa (`'O'`) usa `salario_diario` y la fiscal (`'F'`) usa `salario_diario_fiscal`, cada uno congelado en el snapshot del periodo, igual que las horas extra (spec 75). No hay campo de salario ajustable.
- **Candado de un solo pago.** `UNIQUE (id_vacation_entitlement, concepto, tipo_nomina)` en `payroll.period_employee_vacations`:
  - los conceptos ya pagados por otro periodo se excluyen **antes** de insertar, como en la spec 61;
  - "Recalcular" y "Revertir" liberan los suyos con el `DELETE` que ya ejecutan (`ON DELETE CASCADE`).
- **Snapshot.** `payroll.period_employees` gana `dias_prima_vacacional`, `importe_prima_vacacional`, `dias_vacaciones_pagadas` e `importe_vacaciones_pagadas`. Son los totales del periodo, porque en un mismo periodo puede haber conceptos de más de un año de derecho. Los snapshots anteriores a esta spec quedan en 0.
- **Fiscal (motor de la spec 73).** Se agregan dos `UNION ALL` a `#fiscal_perception_lines`, cada uno solo cuando su importe es `> 0` y con `eventos = NULL`:
  - `id 7` (prima, `'U'`, 15 UMA, periodicidad `'A'`), con el importe de la prima. Su exención acumulada por año la resuelve el motor sin lógica nueva.
  - `id 14` "Vacaciones pagadas" (clave 001, `'N'`, 100% gravada), con el importe de las vacaciones pagadas. Se siembra con un script idempotente, como la `id 13` de la spec 74.

  Lo gravado de ambas suma a la base del ISR (spec 70). Se agregan las constantes `VACATION_PREMIUM_PERCEPTION_ID = 7` y `PAID_VACATION_PERCEPTION_ID = 14`, y sus entradas en `PERCEPTION_LINE_KEY_BY_ID`.
- **Cambios después de calcular.** Las acciones de la spec 76 (cancelar, reprogramar, revertir pago y volver a marcar) **no se bloquean**. El aviso nuevo "Recalcula" (`isVacationPayRecalculationNeeded`, solo en estatus 2) salta cuando:
  - hay un concepto con fecha de evento dentro del periodo, sin pagar en ese tipo;
  - un concepto guardado ya no corresponde: el bloque se canceló o se movió fuera del rango, el pago se revirtió o cambió de fecha, o cambiaron los días.
- **Bloques retroactivos.** Si el periodo que contiene la fecha de evento no existe o nunca se calcula, el concepto no se paga en ningún otro periodo y se muestra "Pendiente".
- **Procesar.** Columna nueva "Vacaciones" después de "Horas extra", en ambas vistas:
  - muestra el importe de la prima más el de las vacaciones pagadas;
  - el texto secundario es "Prima $X · N días $Y" (se omite la parte que esté en 0);
  - "Total percepciones", la tarjeta de resumen y el pie la suman.
- **Detalle.** `buildPerceptionLines` agrega dos líneas, cada una omitida cuando su importe es 0:
  - `prima_vacacional`: "N días × $X × 25%";
  - `vacaciones_pagadas`: "N días × $X".

  En la vista fiscal, cada línea muestra su gravado, su exento y la regla aplicada (spec 73).
- **Pestaña Vacaciones (spec 76), solo lectura.** Por año, en la tarjeta del año vigente y en el historial:
  - **Prima:** "Pagada en {código}", "Pendiente" (ya tiene fecha de evento y ningún periodo la pagó) o "—" (sin fecha de evento).
  - **Días no disfrutados:** "Pagados en {código}" o "Marcados, sin nómina calculada".

  Si los tipos `'O'` y `'F'` se pagaron en periodos distintos, se muestran ambos códigos.
- **Modal "Marcar como pagadas" (spec 76).** Cuando hay un periodo de la sucursal y la frecuencia del empleado que contiene la fecha elegida, muestra "Se pagará en {código}". Si no lo hay, muestra un aviso ámbar: "Ningún periodo contiene esta fecha". Se puede guardar en ambos casos.
- **Documentación:** sección "Vacaciones y prima vacacional (spec 78)" en `docs/nomina.md` y actualización de la sección "Vacaciones" en `docs/rh-empleados.md`.

**No incluye (otras specs):**

- Campo ajustable de "salario base específico de cálculo" para la prima o los días pagados.
- Pagar en otro periodo la prima de un bloque retroactivo, o registrarla como "pagada fuera de nómina".
- Opción del art. 174 RLISR para pagos extraordinarios: la prima gravada suma directo a la base semanal del ISR.
- Integración al SBC del IMSS.
- Bloqueos o reversiones en periodos Aprobados o Pagados (estatus 3/4).
- Badges de prima en el header del expediente o en el listado de empleados.
- Vacaciones proporcionales y prima en el finiquito.
- Aguinaldo y prima dominical.
- Nodo de vacaciones en el CFDI de nómina y timbrado.
- Desglose de los días de vacaciones disfrutados como línea propia en el Detalle: se siguen pagando dentro del sueldo base.

## Modelo de datos

### `payroll.period_employees`: 4 columnas nuevas

```sql
ALTER TABLE [payroll].[period_employees]
    ADD [dias_prima_vacacional]      [int]           NOT NULL CONSTRAINT [DF_period_employees_prima_vac_dias]    DEFAULT (0),
        [importe_prima_vacacional]   [decimal](12,2) NOT NULL CONSTRAINT [DF_period_employees_prima_vac_importe] DEFAULT (0),
        [dias_vacaciones_pagadas]    [int]           NOT NULL CONSTRAINT [DF_period_employees_vac_pag_dias]      DEFAULT (0),
        [importe_vacaciones_pagadas] [decimal](12,2) NOT NULL CONSTRAINT [DF_period_employees_vac_pag_importe]   DEFAULT (0)
GO

ALTER TABLE [payroll].[period_employees] WITH CHECK
    ADD CONSTRAINT [CK_period_employees_vacaciones] CHECK (
        [dias_prima_vacacional] >= 0 AND [importe_prima_vacacional] >= 0
        AND [dias_vacaciones_pagadas] >= 0 AND [importe_vacaciones_pagadas] >= 0)
GO
```

- Son las sumas del desglose del periodo. Si en un mismo periodo caen conceptos de más de un año de derecho, se suman.
- Los snapshots anteriores a esta spec quedan en 0 hasta que se recalculen.

### `payroll.period_employee_vacations`: desglose y candado

```sql
-- Spec 78: prima vacacional y vacaciones pagadas por renglón de nómina y año de derecho.
-- UNIQUE (id_vacation_entitlement, concepto, tipo_nomina) impide pagar dos veces el mismo concepto en el mismo tipo.
CREATE TABLE [payroll].[period_employee_vacations](
    [id_period_employee_vacation] [int] IDENTITY(1,1) NOT NULL,
    [id_period_employee]      [int]           NOT NULL,
    [id_vacation_entitlement] [int]           NOT NULL,
    [tipo_nomina]             [char](1)       NOT NULL,   -- 'O' | 'F', copiado de period_employees (lo necesita el UNIQUE)
    [concepto]                [char](1)       NOT NULL,   -- 'P' prima vacacional | 'D' días no disfrutados pagados
    [fecha_evento]            [date]          NOT NULL,   -- congelada: fecha_inicio del bloque o fecha_pago
    [dias]                    [int]           NOT NULL,   -- 'P': dias_derecho | 'D': dias_pagados (congelados)
    [importe]                 [decimal](12,2) NOT NULL,   -- 'P': ROUND(dias × salario × 25 / 100, 2) | 'D': ROUND(dias × salario, 2)
 CONSTRAINT [PK_period_employee_vacations] PRIMARY KEY CLUSTERED ([id_period_employee_vacation] ASC),
 CONSTRAINT [UQ_period_employee_vacations_entitlement_concepto_tipo]
     UNIQUE ([id_vacation_entitlement], [concepto], [tipo_nomina]),
 CONSTRAINT [FK_period_employee_vacations_period_employee] FOREIGN KEY ([id_period_employee])
     REFERENCES [payroll].[period_employees] ([id_period_employee]) ON DELETE CASCADE,
 CONSTRAINT [FK_period_employee_vacations_entitlement] FOREIGN KEY ([id_vacation_entitlement])
     REFERENCES [RH].[vacation_entitlements] ([id_vacation_entitlement]),
 CONSTRAINT [CK_period_employee_vacations_valores] CHECK (
     [tipo_nomina] IN ('O','F') AND [concepto] IN ('P','D')
     AND [dias] > 0 AND [importe] >= 0)
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_period_employee_vacations_period_employee]
    ON [payroll].[period_employee_vacations] ([id_period_employee])
GO
```

- **Lleva FK a `RH.vacation_entitlements`**, a diferencia de `period_employee_overtime`. Los años de derecho nunca se borran: cancelar o revertir solo pone columnas en `NULL` (spec 76). Por eso la FK no choca con ninguna acción.
- `fecha_evento` y `dias` se congelan. Con ellos, el aviso "Recalcula" compara contra el estado actual del año: si el bloque se movió o se canceló, si se revirtió el pago o si cambiaron los días.
- No guarda el salario: ya está congelado en `period_employees.salario_diario` del mismo renglón.
- `ON DELETE CASCADE`: "Recalcular" y "Revertir" liberan el candado con el `DELETE` que ya ejecutan. `revertPayrollCalculation` no cambia.

### Catálogo `payroll.perceptions`: id 14

Es un script de solo datos, idempotente, con el mismo patrón que la spec 74:

- `THROW 50078` si la `id 7` no es `021` / `'U'`;
- `THROW 50078` si la 14 está ocupada por otra percepción;
- `INSERT` de `(14, '001', 'Vacaciones pagadas', @id_gravado, …, 'N', NULL, NULL, NULL)`, que copia `is_billed` y `status` de la `id 1`.

### Constantes: `lib/payroll/constants.ts`

```ts
// Spec 78: prima vacacional (ya existía en el catálogo) y días no disfrutados pagados.
export const VACATION_PREMIUM_PERCEPTION_ID = 7;    // 021, 'U' 15 UMA por año
export const PAID_VACATION_PERCEPTION_ID    = 14;   // 001, 'N' 100% gravada
export const VACATION_PREMIUM_PERCENT       = 25;   // LFT art. 80

// PERCEPTION_LINE_KEY_BY_ID agrega:
//   [VACATION_PREMIUM_PERCEPTION_ID]: "prima_vacacional",
//   [PAID_VACATION_PERCEPTION_ID]:    "vacaciones_pagadas",
```

### Tipos TypeScript

- `interfaces/payroll_calculation.ts`:
  - `IPayrollEmployeeRow` e `IPayrollEmployeeSnapshot` ganan `dias_prima_vacacional`, `importe_prima_vacacional`, `dias_vacaciones_pagadas` e `importe_vacaciones_pagadas`.
  - `IPayrollProcessPage.totals` gana `importeVacaciones`.
- `interfaces/vacation.ts`:

```ts
export type VacationPayConcept = "P" | "D";
export type VacationPremiumStatus = "pagada" | "pendiente" | "sin_evento";

/** Un concepto pagado por la nómina para un año de derecho (lectura de period_employee_vacations + periods). */
export interface IVacationPayrollPayment {
  concepto:       VacationPayConcept;
  tipo_nomina:    "O" | "F";
  id_period:      number;
  codigo_periodo: string;   // "NOM-2026-S38"
}

// IVacationEntitlementView gana:
//   payroll_payments:     IVacationPayrollPayment[];
//   premium_status:       VacationPremiumStatus;
//   paid_days_in_payroll: boolean;   // dias_pagados ya entró a algún periodo calculado
```

### Helpers puros: `lib/payroll/vacationPay.ts`

No usan BD ni `Date`, solo strings y centavos en enteros escalados, como `overtimePay.ts`.

- `getVacationPremiumEventDate(entitlement)`: devuelve `fecha_inicio`, o `fecha_pago` cuando no hay bloque, o `null`.
- `calculateVacationPremiumAmount(dias_derecho, salario_diario)`: `ROUND(dias × salario × 25 / 100, 2)`, con redondeo half-up igual al de `ROUND`.
- `calculatePaidVacationAmount(dias_pagados, salario_diario)`.
- `getVacationPremiumStatus(entitlement, payments)`.

Si alguno diverge del SQL, **gana el SQL**.

### Fragmento SQL compartido: `lib/payroll/vacationPaySql.ts` (`server-only`)

`VACATION_PAY_EVENTS_SQL` arma los eventos pagables de un periodo con forma `(id_empleado, id_vacation_entitlement, concepto, fecha_evento, dias)`:

- prima: `fecha_evento = ISNULL(fecha_inicio, fecha_pago)`, solo cuando no es `NULL`;
- días: solo cuando `fecha_pago IS NOT NULL`;
- en ambos casos, `fecha_evento` debe caer entre `@fecha_inicio` y `@fecha_fin` del periodo.

Lo usan `calculatePayrollPeriod` y `isVacationPayRecalculationNeeded`, para que los dos lugares no se separen, como en la spec 77.

## Plan de implementación

Cada paso deja el sistema compilando (`npm run build`) y funcional.

1. **Base de datos.** En `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 75, se agregan:
   - el `ALTER` de `payroll.period_employees` (4 columnas + `CK_period_employees_vacaciones`);
   - el DDL de `payroll.period_employee_vacations` con su índice;
   - el script idempotente de la percepción `id 14`.

   Se ejecuta contra la BD y se verifica con:
   - correr el script de siembra dos veces: queda una sola fila 14;
   - un `INSERT` de prueba con `concepto = 'X'` o `dias = 0`, que el `CHECK` debe rechazar;
   - dos `INSERT` con el mismo `(id_vacation_entitlement, concepto, tipo_nomina)`, que el `UNIQUE` debe rechazar.

   Las filas existentes quedan en 0 y nada las lee todavía.

2. **Constantes, tipos y helpers puros.**
   - En `lib/payroll/constants.ts`: `VACATION_PREMIUM_PERCEPTION_ID`, `PAID_VACATION_PERCEPTION_ID`, `VACATION_PREMIUM_PERCENT` y las dos entradas de `PERCEPTION_LINE_KEY_BY_ID`.
   - En `interfaces/payroll_calculation.ts`: los 4 campos en `IPayrollEmployeeRow` e `IPayrollEmployeeSnapshot`, y `importeVacaciones` en `totals`.
   - En `interfaces/vacation.ts`: `VacationPayConcept`, `VacationPremiumStatus`, `IVacationPayrollPayment` y los campos nuevos de `IVacationEntitlementView`.
   - `lib/payroll/vacationPay.ts`: `getVacationPremiumEventDate`, `calculateVacationPremiumAmount`, `calculatePaidVacationAmount` y `getVacationPremiumStatus`.
   - `lib/payroll/vacationPaySql.ts`: `VACATION_PAY_EVENTS_SQL`.

   Todavía no los usa nadie.

3. **Cálculo en `calculatePayrollPeriod`** (`nomina/procesar/actions.ts`).
   - Después de `#overtime_days` se arma `#vacation_pay` desde `VACATION_PAY_EVENTS_SQL`:
     - cada evento se cruza con `('O', salario_diario)` y `('F', salario_diario_fiscal)` del empleado, y un tipo con salario 0 no genera filas;
     - se excluyen, **antes** de calcular, los conceptos ya presentes en `period_employee_vacations` de **otro** periodo para el mismo tipo;
     - se calcula el `importe` por fila.
   - El `INSERT` del snapshot llena las 4 columnas con un `OUTER APPLY` sobre `#vacation_pay`, unido por tipo.
   - Después se inserta el desglose desde la misma tabla temporal, unida al renglón nuevo del mismo tipo.
   - `describePayrollCalculationError` agrega el mensaje de colisión del `UNIQUE`: "Otro cálculo tomó la prima o las vacaciones de este empleado al mismo tiempo. Intenta de nuevo."
   - Se verifica comparando el snapshot de un periodo ya calculado antes y después del cambio:
     - sin vacaciones en el rango, todas las columnas existentes quedan idénticas;
     - con un bloque que inicia en el rango, aparece la prima en `'O'` y en `'F'`.

4. **Fiscal.** En el mismo lote, dos `UNION ALL` a `#fiscal_perception_lines`:
   - `id 7` con `importe_prima_vacacional`;
   - `id 14` con `importe_vacaciones_pagadas`.

   Cada uno se agrega solo cuando su importe es `> 0`, con `eventos = NULL`. No se toca el motor ni el ISR. Se verifica que una prima menor que el tope de 15 UMA del año quede 100% exenta, y que la base del ISR solo crezca con lo gravado.

5. **Aviso "Recalcula".**
   - `lib/payroll/vacationPayRecalculation.ts` (`server-only`): `isVacationPayRecalculationNeeded(id_period)`. Solo aplica en estatus 2. Es un `SELECT` con `EXISTS` sobre `VACATION_PAY_EVENTS_SQL` que detecta:
     - un evento del rango sin pagar en el tipo de un renglón existente;
     - una fila guardada cuyo `fecha_evento` o `dias` ya no coincide con el evento actual, o cuyo evento ya no existe.
   - `getPayrollProcessPage` devuelve `vacationPayRecalculationNeeded`.
   - Procesar lo muestra con `PayrollRecalculationNotice`: "Hay vacaciones o primas que no coinciden con el último cálculo. Recalcula la nómina."

6. **Procesar.**
   - `getPayrollProcessPage` lee las 4 columnas y suma `importeVacaciones` a los totales y a `totalPercepciones`.
   - `PayrollEmployeesTable` agrega la columna "Vacaciones" después de "Horas extra", con el texto secundario "Prima $X · N días $Y". El pie y `PayrollProcessSummaryCards` la incluyen.
   - Se verifica en ambas vistas, en modo claro y oscuro.

7. **Detalle.**
   - `getPayrollEmployeeDetail` lee las 4 columnas.
   - `buildPerceptionLines` agrega `prima_vacacional` ("N días × $X × 25%") y `vacaciones_pagadas` ("N días × $X"), cada una omitida cuando su importe es 0.
   - En la vista fiscal, el gravado y el exento salen solos por `PERCEPTION_LINE_KEY_BY_ID`.

8. **Pestaña Vacaciones.**
   - `getEmployeeVacations` (`empleados/[id]/vacaciones/actions.ts`) lee `period_employee_vacations` + `payroll.periods` por año. Con eso arma `payroll_payments`, `premium_status` (con `getVacationPremiumStatus`) y `paid_days_in_payroll`.
   - `VacationCurrentYearCard` y `VacationHistoryTable` muestran, siguen siendo Server Components:
     - "Prima: Pagada en {código}", "Pendiente" o "—";
     - "Días: Pagados en {código}" o "Marcados, sin nómina calculada".

9. **Modal "Marcar como pagadas".**
   - Lectura nueva `getPayrollPeriodForDate(id_empleado, fecha)` en `vacaciones/actions.ts`: busca el periodo de la sucursal y la frecuencia (`id_periodo_pago`) del empleado que contiene la fecha. Es un dato que depende del cliente, porque cambia con el input.
   - `MarkVacationPaidModal` la llama al cambiar la fecha y muestra "Se pagará en {código}" o el aviso ámbar "Ningún periodo contiene esta fecha". No bloquea el guardado.

10. **Documentación.**
    - Sección "Vacaciones y prima vacacional (spec 78)" en `docs/nomina.md`. También se actualizan el párrafo de inicio (conceptos calculados y tablas del esquema) y la lista de líneas de "Detalle por empleado".
    - En `docs/rh-empleados.md`, sección "Vacaciones": la fecha de pago ahora decide el periodo de nómina, y la pestaña muestra el estatus de la prima.
    - `CLAUDE.md` no cambia: no hay feature ni `actions.ts` de primer nivel nuevos.

## Criterios de aceptación

**Base de datos**

- [x] Existen las 4 columnas nuevas en `payroll.period_employees`, con default 0, y la tabla `payroll.period_employee_vacations` con su índice.
- [x] Correr dos veces el script de siembra deja una sola fila `id_perception = 14` (`001`, "Vacaciones pagadas", `'N'`).
- [ ] El script termina con `THROW 50078` si la `id 7` no es `021` / `'U'`, o si la 14 está ocupada por otra percepción.
- [x] El `CHECK` rechaza un `INSERT` con `concepto` fuera de `'P'`/`'D'`, con `tipo_nomina` fuera de `'O'`/`'F'` o con `dias = 0`.
- [x] El `UNIQUE` rechaza un segundo `INSERT` con el mismo `(id_vacation_entitlement, concepto, tipo_nomina)`.

**Cálculo de la prima**

- [ ] Caso: un empleado con `salario_diario` 315.04, `dias_derecho = 12` y un bloque de 12 días que inicia dentro del periodo. Al calcular, la fila `'O'` tiene `dias_prima_vacacional = 12` e `importe_prima_vacacional = 945.12`.
- [x] La fila `'F'` del mismo empleado calcula la prima con su `salario_diario_fiscal`.
- [x] Con un bloque parcial (8 de 12 días), la prima del periodo de `fecha_inicio` se calcula sobre los 12 días.
- [ ] Un año sin bloque y con `fecha_pago` dentro del periodo paga en ese periodo la prima (12 días) y las vacaciones pagadas.
- [ ] Un año sin bloque y sin `fecha_pago` no genera prima en ningún periodo.
- [ ] Un bloque que inicia en el periodo A y termina en el periodo B paga la prima solo en A.
- [ ] Un empleado sin `salario_diario_fiscal` recibe la prima solo en `'O'`, y el concepto queda sin pagar y sin candado en `'F'`.

**Cálculo de las vacaciones pagadas**

- [ ] Un año con `dias_pagados = 4` y `fecha_pago` dentro del periodo genera en `'O'` `dias_vacaciones_pagadas = 4` e `importe_vacaciones_pagadas = 1260.16` (con salario 315.04).
- [x] Un bloque de 8 días en el periodo A y un pago de 4 días con `fecha_pago` en el periodo C dejan la prima en A y los 4 días en C.
- [ ] Un año marcado como pagado con una `fecha_pago` que ningún periodo contiene no se paga en ningún periodo.

**Candado y recálculo**

- [x] Una prima pagada en el periodo A no se paga otra vez en un periodo B que también cubre su fecha de evento (por ejemplo, otra frecuencia): B la excluye y sus demás conceptos se calculan normal.
- [x] "Recalcular" un periodo borra y vuelve a generar su desglose. "Revertir" lo borra y libera el candado.
- [x] Recalcular un periodo sin vacaciones en su rango deja todas las columnas del snapshot anteriores a esta spec iguales al cálculo previo.
- [ ] En un periodo en estatus 2 que ya pagó una prima, aparece el aviso "Hay vacaciones o primas que no coinciden con el último cálculo. Recalcula la nómina." en estos casos:
  - cancelar el bloque;
  - reprogramarlo fuera del rango;
  - revertir el pago de los días;
  - capturar un bloque nuevo cuya `fecha_inicio` cae en el rango.

  Después de "Recalcular" el aviso desaparece.
- [ ] Las acciones de la spec 76 (cancelar, reprogramar, revertir pago) siguen funcionando aunque un periodo calculado haya pagado el concepto.

**Fiscal**

- [x] Cuando la prima es mayor que cero, la fila `'F'` tiene un renglón `id_perception = 7` en `period_employee_perceptions` con `tipo_limite_exencion = 'U'` y `periodicidad_limite = 'A'`.
- [x] Una prima menor que el tope anual queda 100% exenta.
- [ ] Una segunda prima en el mismo año de `fecha_fin` (por ejemplo, otro año de derecho) solo exenta lo que falta del tope de 15 UMA.
- [x] Las vacaciones pagadas generan un renglón `id_perception = 14`, 100% gravado.
- [x] La base del ISR (`isr_base_gravable`) aumenta exactamente en la suma de lo gravado de los renglones 7 y 14.
- [ ] Una prima en un periodo fiscal no semanal se guarda en `'C'`: la periodicidad `'A'` no cae en `unsupported_frequency`.

**UI**

- [x] Procesar muestra la columna "Vacaciones" después de "Horas extra", en operativa y fiscal:
  - el importe es la suma de la prima y las vacaciones pagadas;
  - el texto secundario es "Prima $X · N días $Y" y omite la parte en 0;
  - "Total percepciones", el pie y la tarjeta de resumen la incluyen y no cambian con los filtros de puesto o búsqueda.
- [ ] El Detalle muestra "Prima vacacional" ("12 días × $315.04 × 25%") y "Vacaciones pagadas" ("4 días × $315.04"), cada una omitida en 0. En fiscal, cada una muestra su gravado, su exento y la regla aplicada.
- [ ] La pestaña Vacaciones muestra por año, en la tarjeta y en el historial:
  - "Prima: Pagada en {código}", "Pendiente" o "—";
  - "Días: Pagados en {código}" o "Marcados, sin nómina calculada".
- [ ] Un bloque retroactivo cuyo periodo no existe muestra "Prima: Pendiente".
- [ ] El modal "Marcar como pagadas" muestra "Se pagará en {código}" cuando un periodo de la sucursal y la frecuencia del empleado contiene la fecha, y el aviso ámbar "Ningún periodo contiene esta fecha" cuando no. En los dos casos se puede guardar.
- [ ] No se agrega `"use client"` a ningún componente nuevo ni modificado, salvo `MarkVacationPaidModal`, que ya lo era.
- [ ] Todo se ve correctamente en modo claro y oscuro, y a 375 px de ancho.
- [ ] Ninguna fecha viaja como `Date`: las lecturas usan `CONVERT(varchar(10), …, 120)`.

**General**

- [ ] `npm run build` y `npm run lint` pasan sin errores nuevos.
- [ ] `docs/nomina.md` tiene la sección "Vacaciones y prima vacacional (spec 78)", y `docs/rh-empleados.md` tiene su sección "Vacaciones" actualizada.

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| La prima se paga en el periodo que contiene `fecha_inicio` del bloque; sin bloque, en el que contiene `fecha_pago` | En el periodo del aniversario / proporcional por día disfrutado | Es la práctica más común y se explica fácil: "la prima llega cuando sales de vacaciones". Proporcional reparte un pago anual en varios periodos y complica el candado. Decisión del usuario. |
| La prima se calcula sobre todos los `dias_derecho`, en un solo pago | Por partes (tomados al tomar, sobrantes al pagar) / solo días disfrutados | Coincide con la fórmula y el ejemplo de las reglas (12 días × $315.04 × 0.25). Un solo evento por año simplifica el candado y el estatus "Pagada / Pendiente". Decisión del usuario. |
| `fecha_pago` de "Marcar como pagadas" (spec 76) decide el periodo que paga los días no disfrutados | Pago automático de todo año `por_pagar` en el siguiente periodo calculado | Reusa el flujo existente y deja a RH decidir cuándo se paga. El automático quitaría ese control y cambiaría el significado de la spec 76. Decisión del usuario. |
| Se paga en ambas nóminas, cada una con su salario congelado | Solo fiscal / solo operativa | Mismo criterio que las horas extra (spec 75). Las reglas ponen vacaciones y prima en "transferencia", igual que el sueldo, que ya va en ambas. Decisión del usuario. |
| Se usa el salario del snapshot del periodo, sin campo ajustable | Ajuste opcional por año de derecho / ajuste en Procesar | El snapshot ya congela el salario y nada de la nómina se edita a mano. El campo ajustable de las reglas queda para otra spec. Decisión del usuario. |
| Percepción nueva `id 14` "Vacaciones pagadas" (clave 001, `'N'`) | Reusar `id 1` (sueldo) / clave 038 | `UQ (id_period_employee, id_perception)` impide un segundo renglón de `id 1`. Sumarlo al sueldo perdería el desglose. Repetir clave SAT ya tiene precedente (`019` y `028`). Decisión del usuario. |
| La prima reusa la `id 7` existente (`021`, `'U'` 15 UMA por año) | Crear una percepción nueva | Ya está en el catálogo desde la spec 69 con su regla de exención. El motor de la spec 73 la aplica sin lógica nueva. |
| Candado `UNIQUE (id_vacation_entitlement, concepto, tipo_nomina)` en una tabla de desglose con `ON DELETE CASCADE` | Marcar en `RH.vacation_entitlements` qué periodo pagó | Es el patrón de la spec 61/75: "Recalcular" y "Revertir" liberan solos con el `DELETE` existente. Escribir en `RH` desde la nómina mezcla esquemas y deja marcas huérfanas al revertir. |
| FK de la tabla de desglose a `RH.vacation_entitlements` | Sin FK, como `period_employee_overtime` | Los años de derecho nunca se borran: cancelar y revertir solo ponen `NULL`. La FK no choca con ninguna acción y da integridad. |
| Columnas de totales en `period_employees` además del desglose | Solo el desglose, sumado al leer | Procesar y el Detalle ya leen importes del snapshot. Las 4 columnas evitan un `APPLY` más en cada lectura y siguen el estilo de las horas extra. |
| Las acciones de la spec 76 no se bloquean; un aviso "Recalcula" detecta las diferencias | Bloquear cancelar, reprogramar o revertir mientras un periodo calculado incluya el concepto | Es el mismo criterio de las specs 61 y 77. Bloquear obligaría a revertir la nómina para corregir un dato de RH. Decisión del usuario. |
| Un bloque retroactivo cuyo periodo no existe deja la prima en "Pendiente" | Pagarla en el siguiente periodo / marcarla "pagada fuera de nómina" | Detectar periodos faltantes es complejo y propenso a pagos dobles. El pago por fuera es otra acción con bitácora y queda para otra spec. Decisión del usuario. |
| `fecha_evento` y `dias` se congelan en el desglose | Comparar `calculated_at` contra la bitácora de vacaciones | La comparación directa ve cancelaciones, reprogramaciones y reversiones sin depender de fechas de auditoría. Mismo razonamiento que la spec 61. |
| Un solo fragmento `VACATION_PAY_EVENTS_SQL`, compartido por el cálculo y el aviso | Copiar la regla en cada lugar | La spec 77 tuvo que mantener seis copias iguales. Un fragmento único evita que el aviso y el cálculo se separen. |
| La prima gravada suma directo a la base semanal del ISR | Art. 174 RLISR para pagos extraordinarios | Las specs 70 y 73 lo dejaron fuera. Aplicarlo es un cambio del motor del ISR y merece su propia spec. |
| Una columna "Vacaciones" en Procesar, con texto secundario | Dos columnas | La tabla ya tiene 12 columnas. Mismo formato que "Horas extra" (dobles · triples). En el Detalle sí van dos líneas. Decisión del usuario. |
| El estatus de la prima y de los días pagados se ve solo en la pestaña Vacaciones | También en el badge del header y en el listado | El badge de la spec 76 ya resume el estado del año; agregar la prima lo satura. Decisión del usuario. |
| El modal "Marcar como pagadas" avisa en qué periodo se pagará, sin bloquear | Exigir un periodo abierto que contenga la fecha | RH puede marcar el pago antes de crear el periodo. El aviso ámbar evita la sorpresa sin bloquear el registro. Decisión del usuario. |
| Los días de vacaciones disfrutados se siguen pagando dentro del sueldo base | Una línea "Vacaciones disfrutadas" separada del sueldo | Desde la spec 77 no son falta y ya están en `dias`. Separarlos cambiaría el cálculo del sueldo y el CFDI. |

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| **ISR alto en la semana de la prima.** La parte gravada de la prima (lo que pasa de 15 UMA en el año) y las vacaciones pagadas, que son 100% gravadas, suman completas a la base semanal sin el art. 174 RLISR. Eso puede subir de tramo y retener mucho más ISR esa semana. | Es la decisión documentada. El Detalle muestra la base y el tramo. Si el contador pide el art. 174, va en su propia spec sobre el motor del ISR. |
| **Bloque reprogramado de un periodo calculado a otro.** El periodo A pagó la prima y el bloque se mueve a fechas del periodo B. Mientras no se recalcule A, el candado sigue tomado y B no paga la prima. | El aviso "Recalcula" de A salta. Al recalcular A se libera el candado, y el aviso de B (si está en estatus 2) salta para que se recalcule también. Esto se documenta en `docs/nomina.md`. |
| **Periodos Aprobados o Pagados (3/4).** Hoy no se puede llegar a esos estatus, pero cuando existan, cancelar un bloque o revertir un pago ya pagado no revertirá nada. | Queda fuera de alcance, igual que en las specs 61 y 77. Quien construya los estatus 3/4 debe bloquear las acciones de la spec 76 sobre conceptos pagados en esos periodos. |
| **Primas retroactivas que nunca se pagan.** Los bloques capturados con fechas anteriores a la nómina en el sistema quedan "Prima: Pendiente" para siempre. | Es la decisión tomada. La pestaña lo hace visible y RH decide si la paga por fuera. Registrarla en el sistema es otra spec. |
| **`fecha_pago` sin periodo.** RH marca el pago con una fecha que ningún periodo de la frecuencia del empleado contiene, por ejemplo porque el periodo aún no se crea o porque la frecuencia cambió. | El modal muestra el aviso ámbar y la pestaña muestra "Marcados, sin nómina calculada". Si el periodo se crea después y contiene la fecha, lo paga al calcularse. |
| **Cambio de frecuencia o sucursal.** Dos periodos de distinta frecuencia cubren la misma fecha de evento. | El candado paga el concepto solo en el primer periodo que se calcule para cada tipo, igual que con las horas extra (spec 61). |
| **Tope de exención acumulado entre periodos.** Recalcular un periodo anterior del mismo año cambia lo exento ya consumido de la prima, y deja desactualizado un periodo posterior. | El aviso de gravado/exento de la spec 73 (`isExemptionRecalculationNeeded`) ya lo detecta. No hace falta nada nuevo. |
| **`calculatePayrollPeriod` encadena un concepto más.** Un error en el `OUTER APPLY` o en el `WHERE` puede alterar conceptos existentes. | El paso 3 exige comparar el snapshot de un periodo ya calculado antes y después del cambio. Las columnas nuevas solo se escriben desde `#vacation_pay`. |
| **Recalcular periodos ya calculados al desplegar.** Los periodos en estatus 2 que contengan bloques o pagos mostrarán el aviso "Recalcula" en cuanto se despliegue. | Es el comportamiento esperado: RH recalcula para incluir la prima. Se menciona en la documentación para que no se lea como error. |
| **Olvidar la UMA de febrero.** La exención de la prima se calcula con la UMA anterior. | Es el riesgo existente de la spec 69: el Detalle muestra el `vigente_desde` usado y el aviso de exención detecta el cambio. |
| **Conflicto con el art. 79 LFT.** Pagar en dinero los días no disfrutados durante la relación laboral contradice la ley. Esto ya estaba en la spec 76, pero ahora el pago entra a la nómina y al CFDI. | El riesgo laboral lo asume el negocio, que es quien pide la regla. El sistema solo calcula lo que RH marca. |

## Lo que **no** está en esta spec

- Campo ajustable de salario base para la prima o los días pagados.
- Pagar en otro periodo la prima de un bloque retroactivo, o registrarla como pagada fuera de nómina.
- Art. 174 RLISR para pagos extraordinarios.
- Integración al SBC del IMSS.
- Bloqueos o reversiones en periodos Aprobados o Pagados (3/4).
- Badges de prima en el header o en el listado de empleados.
- Vacaciones proporcionales y prima en el finiquito.
- Aguinaldo y prima dominical.
- Nodo de vacaciones en el CFDI y timbrado.
- Línea propia para los días de vacaciones disfrutados en el Detalle.

Cada uno de estos puntos, si se hace, va en su propia spec.
