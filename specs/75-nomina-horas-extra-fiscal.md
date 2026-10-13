# 75 — Nómina: horas extra en la nómina fiscal

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [61 — Pago de horas extra](61-nomina-horas-extra-pago.md): `#overtime_days`, el reparto cronológico doble/triple, las cinco columnas del snapshot, `payroll.period_employee_overtime` con su candado, `overtimePay.ts`, `isOvertimeRecalculationNeeded` y `PayrollOvertimeDaysList`.
  - [73 — Motor gravado/exento](73-nomina-motor-gravado-exento.md): `#fiscal_perception_lines`, la periodicidad `'S'` (solo en frecuencia semanal) y la base del ISR como suma de lo gravado.
  - [74 — Horas extra dobles y triples en el catálogo](74-nomina-horas-extra-dobles-triples-catalogo.md): `OVERTIME_DOUBLE_PERCEPTION_ID = 5` (`'M'` 50%, 5 UMA por semana), `OVERTIME_TRIPLE_PERCEPTION_ID = 13` (`'N'`) y sus entradas en `PERCEPTION_LINE_KEY_BY_ID`.
  - [70 — Cálculo del ISR](70-nomina-calculo-isr-fiscal.md): el ISR de los renglones `'F'`, que ahora suma las horas extra gravadas.
  - [62](62-nomina-control-faltas.md) y [63](63-nomina-control-retardos.md): el patrón de candado por `tipo_nomina` que se replica en el desglose de horas extra.
- **Modifica base de datos:** Sí.
  - `payroll.period_employee_overtime`: columna nueva `tipo_nomina`, y el candado pasa de `(id_empleado, fecha)` a `(id_empleado, fecha, tipo_nomina)`.
- **Fecha:** 2026-10-13
- **Objetivo:** Pagar en la nómina fiscal las mismas horas extra autorizadas y el mismo reparto doble/triple de la operativa, a `salario_diario_fiscal / 8 × 2|3`, y generarlas como percepciones 5 y 13 para que su parte gravada entre a la base del ISR.
- **Reglas de origen:** `references/docs/horas_extras.md` ("estas reglas también se van a aplicar utilizando el salario_diario_fiscal"), `references/nomina/reglas_modulo_nomina.md` (2.4) y LISR art. 93 fr. I.

## Alcance

**Incluye:**

- **Base de datos.** El DDL se documenta en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 74.
  - `payroll.period_employee_overtime` gana `tipo_nomina char(1) NOT NULL`, con `CHECK IN ('O','F')`. Las filas existentes quedan en `'O'`.
  - El candado `UQ_period_employee_overtime_empleado_fecha (id_empleado, fecha)` se reemplaza por `UQ_period_employee_overtime_empleado_fecha_tipo (id_empleado, fecha, tipo_nomina)`. Un día se paga una sola vez por tipo de nómina en toda la historia.
- **Cálculo en `calculatePayrollPeriod`:**
  - **`#overtime_days` por tipo.** Las mismas autorizaciones que hoy (`'A'`, en el rango, `fecha >= fecha_ingreso`, empresa con `overtime_settings`, `ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS`) se cruzan con los dos tipos.
    - El `NOT EXISTS` del candado compara también `tipo_nomina`.
    - El reparto cronológico se particiona por `(id_empleado, tipo_nomina)`, con el mismo `limite_horas_dobles_periodo` para los dos tipos.
    - El importe de cada día usa el salario del tipo: `salario_diario` en `'O'` y `salario_diario_fiscal` en `'F'`. Se redondea por día igual que en la spec 61.
  - **Snapshot.** El `OUTER APPLY` de horas extra deja de filtrar `tipo_nomina = 'O'` y une por tipo. `limite_horas_dobles_aplicado` se congela también en `'F'`.
  - **Desglose.** El `INSERT` en `period_employee_overtime` toma las filas de los dos tipos y las une al renglón `'O'` o `'F'` recién creado.
    - Los días de un empleado sin renglón de ese tipo no se pagan ni se bloquean en ese tipo.
    - Un empleado con `salario_diario_fiscal = 0` no tiene renglón `'F'`.
  - **Percepciones fiscales.** `#fiscal_perception_lines` gana dos `UNION ALL`:
    - `OVERTIME_DOUBLE_PERCEPTION_ID` (5) con `importe_horas_extra_dobles`;
    - `OVERTIME_TRIPLE_PERCEPTION_ID` (13) con `importe_horas_extra_triples`;
    - cada uno solo si es mayor que 0, con `eventos = NULL`.

    El motor de la spec 73 calcula el gravado y el exento; el ISR suma lo gravado.
  - **Periodos no semanales.** El importe se paga igual. La percepción 5 queda `'N'` / `unsupported_frequency`, y el ISR del empleado queda `'N'` / `exemption_not_calculated`. Es el comportamiento de la spec 73, sin código nuevo.
  - `describePayrollCalculationError` reconoce el nombre nuevo del candado, con el mismo mensaje de la spec 61.
- **Lecturas de `period_employee_overtime`.** Todas filtran por `tipo_nomina`:
  - el Detalle carga los días del tipo seleccionado;
  - la marca "Pagada en {código}" de la pantalla Horas extra solo lee `'O'`;
  - el aviso "Recalcula" lee cada tipo contra su renglón.
- **Aviso "Recalcula"** (`isOvertimeRecalculationNeeded`). Los cuatro casos de la spec 61 se evalúan para los renglones `'O'` y `'F'`, cada uno contra el desglose de su tipo. Así también salta en un periodo en estatus 2 calculado antes de esta spec: su renglón `'F'` no tiene desglose aunque haya días autorizados. El texto no cambia.
- **Detalle, vista fiscal:**
  - "Horas extra dobles" y "Horas extra triples" muestran "X h × $tarifa" con el `salario_diario_fiscal` del snapshot, más el gravado, el exento y la nota de la regla de la spec 73;
  - `PayrollOvertimeDaysList` aparece también en fiscal, con los días e importes del desglose `'F'`.
- **Procesar, vista fiscal.** No hay cambios de UI. La columna "Horas extra", "Total percepciones", "ISR" y "Neto" ya leen el snapshot.
- **Documentación.** En `docs/nomina.md`:
  - sección "Horas extra: pago (spec 61)": el desglose por tipo y el candado nuevo;
  - sección "Gravado/exento (spec 73)": las percepciones 5 y 13 ya se generan;
  - párrafo inicial: las horas extra ya no son solo operativas.

**No incluye (para otras specs):**

- El nodo `HorasExtra` del CFDI (`Dias`, `TipoHoras`, `HorasExtra`, `ImportePagado`) y el timbrado.
- Horas extra simples (`TipoHoras = 03`) y la exención del trabajador de salario mínimo.
- Pagar horas extra fiscales a quien solo tiene `salario_diario_fiscal > 0`. La pantalla Horas extra no lo revisa, así que no tiene autorizaciones.
- Un límite de horas dobles distinto para la fiscal, o fijo en 9 h.
- Partir periodos no semanales en semanas calendario para el tope de 5 UMA.
- IMSS e integración al SBC.
- Cambios en la pantalla Horas extra, y columnas nuevas (exento, gravado) en Procesar.
- Cambios en la nómina operativa: sus importes, su reparto y su candado quedan igual.

## Modelo de datos

**Cambios en BD.** El DDL va en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 74. Sigue el patrón de `period_employee_absences` y `period_employee_lateness` (specs 62 y 63).

```sql
-- Spec 75: el desglose de horas extra se separa por tipo de nómina. Las filas existentes son operativas.
-- El default solo sirve para llenar las filas viejas; se quita para que cada INSERT diga su tipo.
ALTER TABLE [payroll].[period_employee_overtime]
    ADD [tipo_nomina] [char](1) NOT NULL
        CONSTRAINT [DF_period_employee_overtime_tipo] DEFAULT ('O')
GO
ALTER TABLE [payroll].[period_employee_overtime] DROP CONSTRAINT [DF_period_employee_overtime_tipo]
GO
ALTER TABLE [payroll].[period_employee_overtime] WITH CHECK
    ADD CONSTRAINT [CK_period_employee_overtime_tipo] CHECK ([tipo_nomina] IN ('O', 'F'))
GO

-- Un día se paga una sola vez por tipo de nómina en toda la historia.
ALTER TABLE [payroll].[period_employee_overtime] DROP CONSTRAINT [UQ_period_employee_overtime_empleado_fecha]
GO
ALTER TABLE [payroll].[period_employee_overtime]
    ADD CONSTRAINT [UQ_period_employee_overtime_empleado_fecha_tipo] UNIQUE ([id_empleado], [fecha], [tipo_nomina])
GO
```

- **`tipo_nomina` es redundante** con `period_employees`, pero hace falta para el `UNIQUE`, igual que `id_empleado` desde la spec 61. Ninguna `CHECK` puede comparar entre tablas; el `INSERT` del cálculo garantiza que coincide con el renglón al que apunta.
- **El nuevo `UNIQUE` sigue sirviendo de índice** para el `NOT EXISTS` del cálculo, para la marca "Pagada en …" y para el aviso. Todos filtran por `(id_empleado, fecha)` y ahora también por `tipo_nomina`.
- **`CK_period_employee_overtime_valores`, la FK con `ON DELETE CASCADE` e `IX_period_employee_overtime_period_employee`** no cambian.
- **`payroll.period_employees` no cambia de esquema.** Las cinco columnas de la spec 61 ya existen en los renglones `'F'`, que hoy quedan en 0. `CK_period_employees_horas_extra` (`horas_extra_dobles <= limite_horas_dobles_aplicado`) aplica igual en `'F'`, por eso el límite también se congela ahí.

**`#overtime_days` (tabla temporal del batch).** Gana `tipo_nomina` y se construye una vez por tipo:

```text
#overtime_days (id_empleado, tipo_nomina, fecha, horas_autorizadas,
                horas_dobles, horas_triples, importe_dobles, importe_triples)
```

- Autorizaciones elegibles (las mismas de la spec 61) `CROSS APPLY (VALUES ('O', e.salario_diario), ('F', e.salario_diario_fiscal))`.
- `NOT EXISTS` en `period_employee_overtime` con el mismo `id_empleado`, `fecha` y `tipo_nomina`.
- `SUM() OVER (PARTITION BY id_empleado, tipo_nomina ORDER BY fecha ROWS UNBOUNDED PRECEDING)` para el reparto.
- Importes: `ROUND(horas_dobles × salario_del_tipo × 2 / 8, 2)` y `ROUND(horas_triples × salario_del_tipo × 3 / 8, 2)`.
- Las filas de un tipo con salario 0 no se generan.

**`#fiscal_perception_lines`.** Sin cambio de forma; solo gana dos `UNION ALL`:

```text
(id_period_employee, OVERTIME_DOUBLE_PERCEPTION_ID = 5,  importe_horas_extra_dobles,  NULL)  -- si > 0
(id_period_employee, OVERTIME_TRIPLE_PERCEPTION_ID = 13, importe_horas_extra_triples, NULL)  -- si > 0
```

**Constantes** (`procesar/actions.ts`): `OVERTIME_DAY_ALREADY_PAID_CONSTRAINT` pasa a `"UQ_period_employee_overtime_empleado_fecha_tipo"`. Las constantes de las percepciones 5 y 13 ya existen desde la spec 74.

**Tipos.** Sin cambios:

- `IPayrollOvertimeDay` ya describe un día de cualquier tipo;
- `IPayrollEmployeeDetail.overtimeDays` deja de ser siempre `[]` en fiscal;
- `IPeriodEmployeePerception` (spec 73) ya cubre los renglones 5 y 13.

**Helper espejo** `lib/payroll/overtimePay.ts`: sin cambios. `splitOvertimeHours`, `calculateOvertimeDayAmounts` y `describeOvertimeHours` ya reciben el salario como parámetro.

## Plan de implementación

1. **Revisar la BD (solo lectura) y elegir los datos de prueba.**
   - Confirmar que `UQ_period_employee_overtime_empleado_fecha` existe y que ningún `(id_empleado, fecha)` está repetido en `period_employee_overtime`.
   - En `NOM-2026-S01` (id 38, semanal, estatus 2), anotar qué empleados tienen `salario_diario > 0` y `salario_diario_fiscal > 0`, y si hay autorizaciones `'A'` en su rango.
     - Si no hay, se autorizan días de prueba desde la pantalla Horas extra para uno de esos empleados (por ejemplo 3, 4, 2.5 y 1 h).
     - Se anota cuáles son, para borrarlos al final.
   - Tomar una foto de `NOM-2026-S01` antes de cualquier cambio: `period_employees`, `period_employee_overtime`, `period_employee_perceptions` y `period_employee_deductions`.
   - Anotar los hallazgos en el Registro.

2. **BD y nombre del candado.**
   - Correr el DDL del Modelo de datos y documentarlo en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 74.
   - Cambiar `OVERTIME_DAY_ALREADY_PAID_CONSTRAINT` al nombre nuevo.
   - El cálculo sigue insertando solo `'O'`, así que todo funciona igual.
   - Verificación:
     - las filas existentes quedan en `'O'`;
     - `DF_period_employee_overtime_tipo` ya no existe;
     - con rollback, se acepta el mismo `(id_empleado, fecha)` en `'O'` y en `'F'`;
     - con rollback, se rechaza un segundo `'O'` con el mismo día, y se rechaza `tipo_nomina = 'X'`;
     - recalcular `NOM-2026-S01` deja todo idéntico a la foto del paso 1, salvo `calculated_at` y `calculated_by`.

3. **Cálculo por tipo en `calculatePayrollPeriod`.**
   - `#overtime_days` se arma por tipo, con el salario de cada uno, el `NOT EXISTS` por tipo y el reparto particionado por `(id_empleado, tipo_nomina)`.
   - El `OUTER APPLY` del snapshot une por `tipo_nomina` y deja de forzar 0 en `'F'`. `limite_horas_dobles_aplicado` se llena en los dos tipos.
   - El `INSERT` del desglose lleva `tipo_nomina` y une al renglón del mismo tipo.
   - En este paso la fiscal ya paga las horas extra, pero todavía no entran al ISR.
   - Verificación al recalcular `NOM-2026-S01`:
     - los renglones `'O'` y su desglose son idénticos a la foto del paso 1;
     - el renglón `'F'` del empleado de prueba tiene las mismas horas dobles y triples que su `'O'`, con importes a `salario_diario_fiscal / 8 × 2|3`;
     - el desglose `'F'` tiene un día por cada día `'O'`;
     - los importes coinciden con `calculateOvertimeDayAmounts`;
     - "Revertir" borra el desglose de los dos tipos.

4. **Percepciones fiscales 5 y 13.**
   - Agregar los dos `UNION ALL` a `#fiscal_perception_lines`, con `OVERTIME_DOUBLE_PERCEPTION_ID` y `OVERTIME_TRIPLE_PERCEPTION_ID`.
   - Verificación al recalcular `NOM-2026-S01`:
     - el empleado de prueba tiene los renglones 5 (`'M'`, exento = `min(ROUND(importe × 50%, 2), 586.55)`) y 13 (`'N'`, 100% gravado);
     - la base del ISR es sueldo + gravado de 5 + importe de 13;
     - el ISR coincide con `calculateIsrBreakdown` sobre esa base;
     - los empleados sin horas extra conservan su ISR de la foto del paso 1.
   - Verificación con rollback del caso no semanal: con `@exemption_is_weekly = 0`, el renglón 5 queda `'N'` / `unsupported_frequency`, el 13 se calcula y el ISR queda `'N'` / `exemption_not_calculated`.

5. **Lecturas.**
   - `getPayrollEmployeeDetail` carga `overtimeDays` del tipo seleccionado, en vez de `'O'` fijo.
   - `PayrollOvertimeDaysList` se muestra también en fiscal cuando hay días.
   - `getOvertimePage` filtra la marca "Pagada en …" a `tipo_nomina = 'O'`.
   - Verificación en el navegador (rol 4):
     - el Detalle fiscal del empleado de prueba muestra "Horas extra dobles" y "Horas extra triples" con la tarifa fiscal, su gravado, su exento y la nota de la regla, más la lista de días;
     - el Detalle operativo no cambia;
     - la pantalla Horas extra muestra una sola marca por día.

6. **Aviso "Recalcula" por tipo.**
   - `isOvertimeRecalculationNeeded` evalúa los cuatro casos de la spec 61 para los renglones `'O'` y `'F'`, cada uno contra el desglose de su tipo.
   - Verificación:
     - recién recalculado `NOM-2026-S01`, no hay aviso;
     - al cambiar las horas de un día pagado aparece, y desaparece al recalcular;
     - con rollback, borrar solo el desglose `'F'` de un empleado (simula un periodo calculado antes de esta spec) lo hace aparecer.

7. **Documentación y limpieza.**
   - `docs/nomina.md`:
     - sección "Horas extra: pago (spec 61)": desglose y candado por tipo, y la fiscal con `salario_diario_fiscal`;
     - sección "Gravado/exento (spec 73)": las percepciones 5 y 13 ya se generan;
     - párrafo inicial: las horas extra ya no son solo operativas.
   - Si en el paso 1 se crearon autorizaciones de prueba, se borran y se recalcula `NOM-2026-S01`. Al final, todo queda idéntico a la foto del paso 1.

Cada paso deja el sistema compilando y funcionando.

## Criterios de aceptación

**Base de datos**

- [x] `payroll.period_employee_overtime` tiene `tipo_nomina char(1) NOT NULL` con `CK_period_employee_overtime_tipo` (`'O'`, `'F'`), sin default, y todas las filas anteriores a esta spec quedan en `'O'`.
- [x] `UQ_period_employee_overtime_empleado_fecha` ya no existe. `UQ_period_employee_overtime_empleado_fecha_tipo` acepta el mismo día en `'O'` y en `'F'`, y rechaza un segundo día del mismo tipo (verificado con rollback).
- [x] El DDL está en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 74.

**Ejemplo de referencia** (helper y SQL; `salario_diario_fiscal = 325`, límite 9, `UMA_DIARIA` = 117.31, periodo semanal, días de 3, 4, 2.5 y 1 h)

| Día | Dobles | Triples | Importe dobles | Importe triples |
|---|---|---|---|---|
| 1 | 3 | 0 | 243.75 | 0.00 |
| 2 | 4 | 0 | 325.00 | 0.00 |
| 3 | 2 | 0.5 | 162.50 | 60.94 |
| 4 | 0 | 1 | 0.00 | 121.88 |
| **Total** | **9** | **1.5** | **731.25** | **182.82** |

| Percepción | Importe | Exento | Gravado |
|---|---|---|---|
| 5 Horas extra dobles (`'M'` 50%, tope 586.55) | 731.25 | 365.63 | 365.62 |
| 13 Horas extra triples (`'N'`) | 182.82 | 0.00 | 182.82 |

- [ ] `splitOvertimeHours` y `calculateOvertimeDayAmounts` dan exactamente la primera tabla con salario 325.
- [ ] `calculatePerceptionExemption` da exactamente la segunda tabla. Con un sueldo de 2,275.00, la base gravable es 2,823.44.

**Cálculo** (`NOM-2026-S01` recalculado, con el empleado de prueba del paso 1)

- [x] El renglón `'F'` tiene las mismas `horas_extra_dobles`, `horas_extra_triples` y `limite_horas_dobles_aplicado` que su renglón `'O'`. Sus importes son la suma de los importes diarios a `salario_diario_fiscal / 8 × 2|3`, redondeados por día.
- [ ] El desglose `'F'` tiene los mismos días, horas y reparto que el `'O'`, con los importes del salario fiscal, y coincide al centavo con el helper.
- [x] El renglón `'F'` tiene exactamente un renglón de percepción 5 y uno 13 (cada uno solo si su importe es mayor que 0). El exento y el gravado siguen la regla del catálogo.
- [x] `isr_base_gravable` del renglón `'F'` = `importe_salario` + gravado de la 5 + gravado de la 13. El ISR coincide con `calculateIsrBreakdown` sobre esa base.
- [ ] Los renglones `'O'`, su desglose, y los renglones `'F'` de los empleados sin horas extra son idénticos a la foto del paso 1, salvo `calculated_at` y `calculated_by`.
- [ ] Un empleado con `salario_diario_fiscal = 0` no tiene renglón `'F'` ni desglose `'F'`, y sus horas `'O'` se pagan igual.
- [ ] Un día ya pagado en `'F'` por otro periodo no se vuelve a pagar en `'F'` ni consume horas dobles fiscales del periodo actual.
- [ ] Con rollback, en un periodo no semanal (`@exemption_is_weekly = 0`), el renglón 5 queda `'N'` / `unsupported_frequency`, el 13 queda `'C'` 100% gravado y el ISR queda `'N'` / `exemption_not_calculated` con la base en `NULL`.
- [ ] Recalcular produce el mismo resultado. "Revertir" borra el desglose `'O'` y `'F'`, y los renglones de percepción del periodo.
- [ ] Un choque del candado nuevo responde "Otro cálculo tomó algunas de estas horas extra al mismo tiempo. Intenta de nuevo.", nunca un error 500.

**Detalle y pantallas** (navegador, rol 4)

- [ ] En el Detalle fiscal del empleado de prueba aparecen "Horas extra dobles" y "Horas extra triples":
  - con "X h × $tarifa" calculada del `salario_diario_fiscal`;
  - con su columna "Gravado" y "Exento" y la nota de la regla ("Exento 50% hasta 5 UMA por semana (tope $586.55)" y "Gravado al 100%");
  - y el total gravado igual a la base de la tarjeta "Deducciones".
- [ ] `PayrollOvertimeDaysList` aparece en el Detalle fiscal con los días e importes del desglose `'F'`, y su total es igual a la suma de las dos líneas.
- [ ] El Detalle operativo del empleado de prueba se ve igual que antes de esta spec.
- [ ] En Procesar fiscal, la columna "Horas extra" muestra el importe `'F'` y "Xh dobles · Yh triples", y "Total percepciones", "ISR" y "Neto" lo incluyen. No hay columnas nuevas.
- [ ] La pantalla Horas extra muestra una sola marca "Pagada en {código}" por día.

**Aviso "Recalcula"**

- [ ] Recién recalculado `NOM-2026-S01`, no hay aviso.
- [ ] Al cambiar las horas de un día pagado, rechazarlo o cambiar el límite, aparece el aviso; desaparece al recalcular.
- [ ] Con rollback, un renglón `'F'` sin desglose y con días autorizados en el rango hace aparecer el aviso.
- [ ] Con el periodo en estatus 1, nunca aparece.

**Transversal**

- [ ] Ninguna action nueva o modificada devuelve datos a los roles 2, 3, 5 o 6; todas pasan por `assertPayrollAccess()`.
- [ ] Ningún componente nuevo o modificado gana `"use client"`.
- [ ] `tsc --noEmit` termina sin errores.
- [ ] `docs/nomina.md` describe el desglose y el candado por tipo, las percepciones 5 y 13 generadas, y el párrafo inicial actualizado.
- [ ] Las autorizaciones de prueba del paso 1 (si se crearon) están borradas, y `NOM-2026-S01` está recalculado e idéntico a la foto del paso 1.

## Decisiones tomadas y descartadas

- **Sí:** la fiscal paga las mismas autorizaciones y el mismo reparto doble/triple que la operativa; solo cambia el salario. Las dos nóminas pagan siempre las mismas horas, y el reparto cronológico ya está probado desde la spec 61. **No:** un cálculo fiscal independiente con su propio reparto, que podría pagar horas distintas en cada nómina.
- **Sí:** el mismo `limite_horas_dobles_periodo` de `overtime_settings` para los dos tipos. Las reglas piden un límite modificable, y en periodos semanales coincide con el legal de 9 h por semana. **No:** un límite fiscal aparte (otra columna y otra bitácora sin un caso que lo pida). **No:** fijo en 9 h, que contradice "el límite debe ser modificable".
- **Sí:** tarifa `salario_diario_fiscal / 8 × 2|3`, redondeada por día. Es lo que pide `references/docs/horas_extras.md` y el mismo redondeo de la spec 61, así que la lista de días cuadra al centavo.
- **Sí:** en periodos no semanales el importe se paga igual, y la percepción 5 queda "No calculado". El importe no depende del impuesto, y la spec 73 ya decidió no inventar un exento. **No:** dejar de pagar horas extra fiscales fuera de lo semanal, que escondería un pago real. **No:** partir la quincena en semanas calendario; va con la tarifa quincenal.
- **Sí:** `tipo_nomina` en `period_employee_overtime` y candado `(id_empleado, fecha, tipo_nomina)`. Es el patrón de faltas y retardos (specs 62 y 63): cada nómina congela y bloquea sus propios días. **No:** solo las columnas del snapshot `'F'`, sin desglose. El Detalle fiscal no podría listar los días, y nada impediría pagar dos veces el mismo día en fiscal.
- **Sí:** se reutiliza `#overtime_days` cruzado con los dos tipos, con el `NOT EXISTS` y el reparto por tipo. El snapshot y el desglose de cada tipo siguen saliendo del mismo conjunto, en el mismo batch. **No:** una segunda tabla temporal solo para fiscal, con las condiciones duplicadas.
- **Sí:** la elegibilidad sigue siendo la operativa (`ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS`). Solo esos empleados aparecen en la pantalla Horas extra y tienen autorizaciones. **No:** pagar horas fiscales a quien solo tiene `salario_diario_fiscal`; requiere cambiar la pantalla de la spec 60.
- **Sí:** las horas extra entran como percepciones 5 y 13 en `#fiscal_perception_lines`, y el motor de la spec 73 decide el exento. Ninguna línea de código dice "si es horas extra". **No:** calcular el exento de horas extra en código propio.
- **Sí:** el aviso "Recalcula" se extiende a `'F'` con los mismos cuatro casos. Así detecta los periodos en estatus 2 calculados antes de esta spec, cuyo ISR no incluye las horas extra. **No:** dejar esos periodos sin aviso.
- **Sí:** la marca "Pagada en {código}" solo lee `'O'`. Las dos nóminas salen del mismo batch, así que es el mismo periodo. **No:** dos marcas por día.
- **Sí:** `PayrollOvertimeDaysList` se muestra también en fiscal, con el desglose `'F'`. **No:** columnas nuevas en Procesar fiscal; el gravado y el exento ya se ven en el Detalle.
- **Sí:** el default `'O'` solo existe durante el `ALTER` y luego se quita, para que ningún `INSERT` futuro guarde un tipo implícito.
- **Sí (confirmado por el usuario, 2026-10-13):** el derecho al subsidio se compara con la base gravada. Un empleado cuya base sube por las horas extra gravadas puede perder el subsidio; es el resultado correcto, no un error. El Detalle lo muestra como "Sin derecho: ingreso mayor al tope". Así lo calcula la spec 73, sin cambios.
- **Sí (confirmado por el usuario, 2026-10-13):** la fecha que manda es `fecha_fin`, no `fecha_pago`. De ella salen la `UMA_DIARIA` vigente del tope de 5 UMA, la tarifa del ISR y el año y mes de los acumulados. Así lo calculan las specs 70 y 73, sin cambios.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| **Tocar `#overtime_days` y el `INSERT` del snapshot** puede alterar los importes operativos, que hoy son correctos. | La foto del paso 1 y el criterio que exige los renglones `'O'` y su desglose idénticos antes y después de recalcular `NOM-2026-S01`. |
| **El ISR de los periodos en estatus 2 cambia al recalcular**, para quien tenga horas extra. | Es el resultado esperado. El aviso "Recalcula" extendido a `'F'` señala esos periodos, para que nadie pague con el ISR viejo. |
| **Trabajador de salario mínimo:** sus horas extra deberían estar 100% exentas, y esta spec les aplica la regla general (se retiene de más). | En el paso 1 se revisa si algún `salario_diario_fiscal` es igual al salario mínimo vigente y se anota en el Registro. La exención quedó fuera de alcance y va en su propia spec. |
| **En periodos no semanales, el ISR del empleado con horas extra queda "No calculado".** | Hoy el ISR solo se calcula en semanales (spec 70), así que no se pierde nada que hoy funcione. El aviso `IsrNotCalculatedNotice` ya lo muestra. |
| **Cambio de frecuencia:** con candados por tipo, un mismo día podría pagarse en `'O'` en un periodo y en `'F'` en otro. | Solo pasa si dos periodos de distinta frecuencia cubren la misma fecha (ya documentado en la spec 61). Cada tipo lo paga una sola vez; se anota en `docs/nomina.md`. |
| **Otro código usa el nombre del candado viejo** y deja de reconocer el choque. | Solo `OVERTIME_DAY_ALREADY_PAID_CONSTRAINT` lo usa (verificado con búsqueda); se cambia en el mismo paso que el DDL. |
| **El CFDI necesitará `Dias`, `TipoHoras` y `HorasExtra`** por tipo de hora. | El desglose `'F'` congela los días, las horas y el reparto por tipo. La spec de timbrado lo lee sin recalcular nada. |

## Registro

- **2026-10-13 — Análisis y especificación.** Se revisaron las specs 61, 73 y 74, `docs/nomina.md` (secciones de horas extra, ISR y gravado/exento), `references/docs/horas_extras.md`, `references/nomina/reglas_modulo_nomina.md` (2.4), el batch de `calculatePayrollPeriod` y las lecturas de `period_employee_overtime`. Hallazgos:
  - `#overtime_days` calcula los importes con `e.salario_diario` y el snapshot fuerza 0 en `'F'` (`salary.tipo_nomina = 'O'` en el `OUTER APPLY` y en `limite_horas_dobles_aplicado`).
  - `period_employee_overtime` se lee en `procesar/actions.ts` (Detalle, con `'O'` fijo), `horas-extra/actions.ts` (marca "Pagada en …") y `lib/payroll/overtimeRecalculation.ts`. El nombre del candado solo aparece en `OVERTIME_DAY_ALREADY_PAID_CONSTRAINT`.
  - `#fiscal_perception_lines` hoy solo lleva el sueldo; las percepciones 5 y 13 ya existen en el catálogo y en `PERCEPTION_LINE_KEY_BY_ID` (spec 74).
  - **No se consultó la BD directamente** durante el análisis; el paso 1 confirma los datos de prueba.
- **2026-10-13 — Pendientes de la spec 73, cerrados.** El usuario confirmó que el derecho al subsidio se compara con la base gravada y que la fecha que manda es `fecha_fin`. Ver "Decisiones".
- **2026-10-13 — Paso 1 (revisión de BD, solo lectura).** Hallazgos:
  - `UQ_period_employee_overtime_empleado_fecha` existe y no hay ningún `(id_empleado, fecha)` repetido (3 filas en total). Las columnas actuales no incluyen `tipo_nomina`; `DF_period_employee_overtime_tipo` y `CK_period_employee_overtime_tipo` no existen todavía.
  - `NOM-2026-S01` (id 38, semanal, estatus 2, 2026-09-14 a 2026-09-20), empresa 1 con `limite_horas_dobles_periodo = 9` y `tope_horas_dia = 16`. Empleados con ambos salarios > 0: 2 (400/350), 5 (350/300), 6 (800/600), 1006 (350/315.04) y 1007 (400/350).
  - **Empleado de prueba: 1007.** Ya tiene autorizaciones `'A'` en el rango (16 sep 1 h, 17 sep 2.5 h, 19 sep 2.5 h; el 14 sep está `'R'`) y su desglose `'O'` (ids 347–349, renglón 2026) paga 6 h dobles y 0 triples. No se crearon autorizaciones de prueba, así que no hay nada que borrar al final. Para ejercitar el reparto con triples haría falta autorizar más horas (ejemplo de la spec: 3, 4, 2.5 y 1 h); se decide en el paso 3.
  - **Salario mínimo:** el empleado 1006 tiene `salario_diario_fiscal = 315.04`, igual a `SALARIO_MINIMO_GENERAL` vigente (2026-01-01). Es el caso del riesgo "trabajador de salario mínimo". Hoy no tiene autorizaciones, así que no se ve afectado; si se le autorizan horas, esta spec le aplica la regla general (queda fuera de alcance).
  - **Foto previa** de `NOM-2026-S01` (`period_employees` 10 renglones, `period_employee_overtime` 3, `period_employee_perceptions` 5, `period_employee_deductions` 5) guardada en el scratchpad de la sesión: `foto-NOM-2026-S01.json`. El `calculated_at` de los renglones es 2026-10-13T13:48:58Z.
- **2026-10-13 — Pasos 2, 3 y 4 (BD y cálculo).** Hallazgos:
  - DDL aplicado y verificado con rollback (mismo día en `'O'` y `'F'` aceptado; segundo `'O'` y `'X'` rechazados). Recalcular `NOM-2026-S01` dejó los cuatro conjuntos idénticos a la foto del paso 1.
  - `#overtime_days` por tipo, snapshot y desglose por tipo, y percepciones 5 y 13 en `#fiscal_perception_lines` implementados en `calculatePayrollPeriod`.
  - **Datos de prueba (borrar en el paso 7):** `overtime_authorizations` ids 48, 49 y 50 (empleado 1007, 15 sep 4 h, 18 sep 3 h, 20 sep 1 h, comentario `SPEC75-PRUEBA`). Con las 3 autorizaciones previas dan 9 h dobles y 5 h triples.
  - Resultado en 1007 `'F'` (350/día): dobles 787.50 (350, 87.50, 218.75, 131.25) y triples 656.26 (196.88, 328.13, 131.25). Percepción 5: exento 393.75 (50%, tope 586.55) y gravado 393.75. Percepción 13: gravado 656.26. Base ISR 3,500.01; causado 331.27 en el tramo 3,372.12 de la tarifa semanal (verificado contra `tablas_retencion`, no con el helper); subsidio 0.
  - **Caso no semanal (verificado con datos reales, restaurado después):** periodo 38 y empleado 1007 pasados a quincenal (`id_payment_period` y `id_periodo_pago` = 2) y recalculado; luego restaurados a 1 y recalculado. Resultado en 1007 `'F'`: horas extra pagadas igual (787.50 y 656.26); percepción 5 `'N'` / `unsupported_frequency` con exento y gravado en NULL; percepción 13 `'C'` 100% gravado. **Diferencia con el criterio:** el ISR quedó `'N'` / `no_withholding_table` con base 3,106.26, no `exemption_not_calculated` con base NULL, porque `calculateIsrBreakdown` revisa primero la tabla de retención y no existe tarifa quincenal 2026. Es el orden de la spec 70; con una tarifa quincenal cargada sí sería `exemption_not_calculated`.
  - **Pendientes de verificar:** el caso no semanal resultó con una diferencia respecto al criterio (ver Registro, línea siguiente), `salario_diario_fiscal = 0`, el día ya pagado en otro periodo, y la comparación contra los helpers de TypeScript.
- Al terminar cada paso, marcar sus criterios de aceptación; al cerrar la spec, cambiar el estado a "Implementado".

## Lo que no incluye esta spec

- El nodo `HorasExtra` del CFDI y el timbrado.
- Horas extra simples y la exención del trabajador de salario mínimo.
- Horas extra fiscales de quien solo tiene `salario_diario_fiscal`.
- Un límite de horas dobles propio de la fiscal.
- Partir periodos no semanales en semanas calendario.
- IMSS e integración al SBC.
- Cambios en la pantalla Horas extra y columnas nuevas en Procesar.
- Cambios en la nómina operativa.

Cada uno de estos puntos, si se llega a hacer, va en su propia spec.
