# 61 — Nómina: pago de horas extra

## Header

- **Estado:** Implementado
- **Depende de:**
  - [60 — Nómina: horas extra (detección, autorización y configuración)](60-nomina-horas-extra-deteccion-autorizacion.md): `payroll.overtime_authorizations` (solo se pagan los días con `estado = 'A'`), `payroll.overtime_settings.limite_horas_dobles_periodo`, la pantalla `/dashboard/nomina/horas-extra` y el fragmento SQL compartido de empleados elegibles en `lib/payroll/`. **La spec 60 tiene que estar implementada antes.**
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md): `calculatePayrollPeriod`, `revertPayrollCalculation` y el snapshot `payroll.period_employees`, con el `salario_diario` operativo congelado del que sale la tarifa por hora.
  - [54 — Nómina: detalle de percepciones por empleado](54-nomina-detalle-percepciones-empleado.md): `buildPerceptionLines` y la pantalla de Detalle, donde se agregan las líneas nuevas.
  - [57](57-nomina-comision-tratamientos-onicomicosis.md) y [58](58-nomina-comision-venta-productos.md): el patrón de desglose con candado de pago único (`UNIQUE`, `ON DELETE CASCADE`, sin FK a la tabla origen) y de columnas nuevas del snapshot, que se replica aquí.
- **Modifica base de datos:** Sí.
  - Cinco columnas nuevas en `payroll.period_employees`: `horas_extra_dobles`, `horas_extra_triples`, `importe_horas_extra_dobles`, `importe_horas_extra_triples` y `limite_horas_dobles_aplicado`.
  - Una tabla nueva: `payroll.period_employee_overtime`.
- **Fecha:** 2026-09-25
- **Objetivo:** Pagar en la nómina operativa las horas extra autorizadas de cada empleado en el periodo: las primeras `limite_horas_dobles_periodo` horas, en orden cronológico, al doble (`salario_diario / 8 × 2`), y el resto al triple (`× 3`). Se congelan en el snapshot con un desglose por día que impide pagar un día dos veces, y se muestran en Procesar y en Detalle.
- **Reglas de origen:** `references/docs/horas_extras.md`.

## Alcance

**Incluye:**

- **Base de datos** (DDL documentado en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 60):
  - `payroll.period_employees` gana cinco columnas, todas `NOT NULL DEFAULT 0` con `CHECK >= 0`: `horas_extra_dobles`, `horas_extra_triples`, `importe_horas_extra_dobles`, `importe_horas_extra_triples` y `limite_horas_dobles_aplicado`.
  - Tabla nueva `payroll.period_employee_overtime`: una fila por día pagado, con las horas autorizadas, su reparto entre dobles y triples y el importe congelados.
    - `UNIQUE (id_empleado, fecha)`: **un día se paga una sola vez en toda la historia**, sea cual sea el periodo, la frecuencia o la sucursal.
    - `ON DELETE CASCADE` a `period_employees`.
    - Sin FK a `overtime_authorizations`.
- **Cálculo** dentro del mismo batch de `calculatePayrollPeriod`, después de `#product_sales`:
  - **`#overtime_days`:** las autorizaciones con `estado = 'A'` y `fecha` en `[fecha_inicio, fecha_fin]`, de empleados de una empresa **con** fila en `payroll.overtime_settings`, con `fecha >= fecha_ingreso` y cuyo `(id_empleado, fecha)` no esté ya en `period_employee_overtime`.
  - **Reparto por empleado en orden cronológico:** con la suma acumulada de las horas de los días anteriores del periodo (`SUM() OVER`):
    - `horas_dobles = max(0, min(horas, limite − acumulado_previo))`;
    - `horas_triples = horas − horas_dobles`.

    El día que cruza el límite se parte.
  - **Importe por día:**
    - `ROUND(horas_dobles × salario_diario × 2 / 8, 2)`;
    - `ROUND(horas_triples × salario_diario × 3 / 8, 2)`.

    Se usa el `salario_diario` operativo que se congela en el mismo snapshot.
  - **Snapshot:** el `INSERT` de `period_employees` llena las cinco columnas con un `OUTER APPLY` sobre `#overtime_days`, solo cuando `tipo_nomina = 'O'`. `limite_horas_dobles_aplicado` es el límite vigente, o 0 si no hay configuración.
  - **Desglose:** `INSERT` en `period_employee_overtime` desde `#overtime_days`, unido a las filas `'O'` recién creadas. Snapshot y desglose salen del mismo conjunto, así que no pueden diferir.
  - Los días de un empleado que no entra a la nómina operativa del periodo no se pagan ni se bloquean.
  - `describePayrollCalculationError` agrega el mensaje de choque del `UNIQUE`: "Otro cálculo tomó algunas de estas horas extra al mismo tiempo. Intenta de nuevo."
  - `revertPayrollCalculation` no cambia: el cascade libera los días.
- **Helper espejo** `lib/payroll/overtimePay.ts` con `splitOvertimeHours`, `calculateOvertimeDayAmounts` y `describeOvertimeHours`. Replica la regla en TS con strings y centavos; **si diverge, manda el SQL**.
- **Aviso "Recalcula"** (función server-only en `lib/payroll/`, solo para periodos en estatus 2). Se muestra en Procesar y en Horas extra con el texto "Hay autorizaciones que no coinciden con el último cálculo. Recalcula la nómina." cuando, para los empleados con fila `'O'` en el snapshot:
  - hay un día autorizado en el rango que no está en el desglose del periodo ni pagado por otro periodo;
  - hay un día del desglose que ya no está autorizado (rechazado o vuelto a pendiente);
  - un día del desglose tiene `horas_autorizadas` distintas a la autorización actual;
  - el `limite_horas_dobles_periodo` vigente difiere de `limite_horas_dobles_aplicado`.
- **Pantalla Horas extra (spec 60):**
  - El texto fijo cambia a "Las horas autorizadas se pagan al calcular la nómina del periodo."
  - Cada día que está en `period_employee_overtime` muestra el distintivo **"Pagada en {código del periodo}"**.
  - La decisión se puede seguir cambiando.
- **Procesar:**
  - Columna nueva "Horas extra", después de "Com. Ventas": el importe (dobles + triples) y, como texto secundario, "Xh dobles · Yh triples".
  - El importe se suma a "Total percepciones", a la tarjeta resumen y al pie.
- **Detalle:**
  - `buildPerceptionLines` agrega `horas_extra_dobles` ("Horas extra dobles", "X h × $tarifa") y `horas_extra_triples` ("Horas extra triples"), cada una omitida cuando su importe es 0. La tarifa mostrada es `salario_diario / 8 × 2|3` del snapshot, y el importe es siempre el guardado.
  - `PayrollOvertimeDaysList` (Server Component, sin enlaces) lista cada día pagado con fecha, horas autorizadas, dobles, triples e importe, más una fila de total. Se oculta en fiscal o si no hay días.
- **Fiscal:** las filas `'F'` quedan en 0 y no llevan desglose.
- **Documentación:** sección "Horas extra: pago (spec 61)" en `docs/nomina.md`, y actualizar el párrafo inicial del módulo (conceptos calculados y tablas).

**No incluye:**

- **Reglas fiscales:** ISR (exento las primeras 9 h, gravado después), nómina fiscal, clave SAT y `payroll.perceptions`.
- **Otras formas del límite:** tope de horas triples, límite por semana calendario y multiplicadores configurables.
- **Recálculo:**
  - recalcular sola la parte de horas extra, o recalcular automáticamente al cambiar una autorización;
  - descuento retroactivo: rechazar un día ya pagado en un periodo aprobado (3) o pagado (4) no lo cambia.
- **Otros pagos y reportes:**
  - pagar las horas de quien no entra a la nómina operativa;
  - liberar a mano un día pagado;
  - reporte global de horas pagadas y pendientes;
  - historial del límite aplicado más allá de la bitácora de la spec 60.
- **Retardos, faltas y descansos:** descuento por retardos o faltas, prima dominical y descanso trabajado.

## Modelo de datos

**Cambios en BD.** El DDL va en `queries.txt`, bloque `NOMINA PAYROLL`, después de las tablas de la spec 60.

```sql
-- Spec 61: horas extra pagadas en el snapshot (solo 'O'; 'F' queda en 0).
ALTER TABLE [payroll].[period_employees]
    ADD [horas_extra_dobles]           [decimal](6,1)  NOT NULL CONSTRAINT [DF_period_employees_he_dobles]        DEFAULT (0),
        [horas_extra_triples]          [decimal](6,1)  NOT NULL CONSTRAINT [DF_period_employees_he_triples]       DEFAULT (0),
        [importe_horas_extra_dobles]   [decimal](12,2) NOT NULL CONSTRAINT [DF_period_employees_he_imp_dobles]    DEFAULT (0),
        [importe_horas_extra_triples]  [decimal](12,2) NOT NULL CONSTRAINT [DF_period_employees_he_imp_triples]   DEFAULT (0),
        [limite_horas_dobles_aplicado] [decimal](5,1)  NOT NULL CONSTRAINT [DF_period_employees_he_limite]        DEFAULT (0)
GO

ALTER TABLE [payroll].[period_employees] WITH CHECK
    ADD CONSTRAINT [CK_period_employees_horas_extra] CHECK (
        [horas_extra_dobles] >= 0 AND [horas_extra_triples] >= 0
        AND [importe_horas_extra_dobles] >= 0 AND [importe_horas_extra_triples] >= 0
        AND [limite_horas_dobles_aplicado] >= 0
        AND [horas_extra_dobles] <= [limite_horas_dobles_aplicado])
GO

-- Spec 61: días de horas extra pagados por renglón de nómina; UNIQUE(id_empleado, fecha) impide el doble pago.
-- Sin FK a payroll.overtime_authorizations: "Volver a pendiente" no debe chocar con un día ya pagado.
CREATE TABLE [payroll].[period_employee_overtime](
    [id_period_employee_overtime] [int] IDENTITY(1,1) NOT NULL,
    [id_period_employee]  [int]           NOT NULL,
    [id_empleado]         [int]           NOT NULL,   -- redundante con period_employees, necesario para el UNIQUE
    [fecha]               [date]          NOT NULL,
    [horas_autorizadas]   [decimal](4,1)  NOT NULL,   -- congeladas de overtime_authorizations al calcular
    [horas_dobles]        [decimal](4,1)  NOT NULL,
    [horas_triples]       [decimal](4,1)  NOT NULL,
    [importe_dobles]      [decimal](12,2) NOT NULL,   -- ROUND(horas_dobles × salario_diario × 2 / 8, 2)
    [importe_triples]     [decimal](12,2) NOT NULL,   -- ROUND(horas_triples × salario_diario × 3 / 8, 2)
 CONSTRAINT [PK_period_employee_overtime] PRIMARY KEY CLUSTERED ([id_period_employee_overtime] ASC),
 CONSTRAINT [UQ_period_employee_overtime_empleado_fecha] UNIQUE ([id_empleado], [fecha]),
 CONSTRAINT [FK_period_employee_overtime_period_employee] FOREIGN KEY ([id_period_employee])
     REFERENCES [payroll].[period_employees] ([id_period_employee]) ON DELETE CASCADE,
 CONSTRAINT [CK_period_employee_overtime_valores] CHECK (
     [horas_autorizadas] > 0
     AND [horas_dobles] >= 0 AND [horas_triples] >= 0
     AND [horas_dobles] + [horas_triples] = [horas_autorizadas]
     AND [importe_dobles] >= 0 AND [importe_triples] >= 0)
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_period_employee_overtime_period_employee]
    ON [payroll].[period_employee_overtime] ([id_period_employee])
GO
```

**Notas sobre las tablas:**

- `id_empleado` se repite en el desglose porque el candado tiene que ser por empleado y fecha, y `id_period_employee` cambia en cada recálculo. No se agrega FK a `RH.empleados`, porque ya se llega por `period_employees`.
- El `UNIQUE (id_empleado, fecha)` también sirve de índice para marcar los días "Pagada en …" en la pantalla de Horas extra y para el `NOT EXISTS` del cálculo.
- `CK_period_employees_horas_extra` garantiza que nunca se pagan más horas dobles que el límite congelado. Con `limite = 0` (sin configuración) solo cabe `horas_extra_dobles = 0`.
- `horas_extra_dobles` y `horas_extra_triples` son la suma del desglose. Los importes del snapshot son la suma de los importes ya redondeados por día.
- **Snapshots anteriores** a esta spec quedan en 0 (defaults) hasta que se recalculen.

**Lectura (regla de strings):** `fecha` se lee con `CONVERT(varchar(10), [fecha], 120)`. Las horas y los importes llegan como `decimal` y se convierten con `Number(...)`, igual que las comisiones.

**Cambios en `interfaces/payroll_calculation.ts`:**

```ts
// IPayrollEmployeeRow (Procesar) gana:
horas_extra_dobles:  number;
horas_extra_triples: number;
importe_horas_extra: number;   // dobles + triples, calculado en el SELECT
// total_percepciones ya lo incluye.

// IPayrollProcessPage gana:
totals.importeHorasExtra:      number;
overtimeRecalculationNeeded:   boolean;   // aviso "Recalcula"; solo puede ser true en estatus 2

// IPayrollEmployeeSnapshot gana las 5 columnas nuevas.
// IPayrollEmployeeDetail gana:
overtimeDays: IPayrollOvertimeDay[];     // [] en fiscal o sin días pagados
```

**Cambios en `interfaces/payroll_overtime.ts` (spec 60):**

```ts
/** Un día pagado de payroll.period_employee_overtime, para la lista del Detalle. */
export interface IPayrollOvertimeDay {
  fecha:             string;   // "YYYY-MM-DD"
  horas_autorizadas: number;
  horas_dobles:      number;
  horas_triples:     number;
  importe_dobles:    number;
  importe_triples:   number;
}

// IOvertimeDayRow gana:
paidInPeriodCode: string | null;   // "NOM-2026-S38" si el día está en period_employee_overtime

// IOvertimePage gana:
recalculationNeeded: boolean;
```

**Helper espejo `lib/payroll/overtimePay.ts`:**

```ts
// splitOvertimeHours(days: { fecha: string; horas: number }[], limit: number)
//   → { fecha, horas, horasDobles, horasTriples }[]   (orden cronológico por fecha string)
// calculateOvertimeDayAmounts(horasDobles: number, horasTriples: number, salarioDiario: number)
//   → { importeDobles, importeTriples }                (en centavos enteros, luego / 100)
// describeOvertimeHours(horas: number, salarioDiario: number, multiplier: 2 | 3)
//   → "2.5 h × $250.00"
// Si diverge del SQL, manda el SQL.
```

**Función del aviso** (server-only, en `lib/payroll/`, no `"use server"`):

```ts
// isOvertimeRecalculationNeeded(id_period: number): Promise<boolean>
//   → false si el periodo no está en estatus 2; si lo está, un solo SELECT con EXISTS sobre los cuatro casos del Alcance.
```

## Plan de implementación

1. **Base de datos.**
   - Ejecutar contra la BD el `ALTER TABLE` de `payroll.period_employees` (cinco columnas y `CK_period_employees_horas_extra`), el `CREATE TABLE [payroll].[period_employee_overtime]` y su índice.
   - Documentarlo en `queries.txt`, bloque `NOMINA PAYROLL`, después de las tablas de la spec 60.
   - Prueba manual:
     - Los snapshots existentes quedan en 0.
     - Un `INSERT` en el desglose con `horas_dobles + horas_triples <> horas_autorizadas` falla por el `CHECK`.
     - Un segundo `INSERT` con el mismo `(id_empleado, fecha)` falla por el `UNIQUE`.
     - Al terminar, se borran las filas de prueba.

2. **Helper espejo y tipos.**
   - Crear `lib/payroll/overtimePay.ts` con `splitOvertimeHours`, `calculateOvertimeDayAmounts` y `describeOvertimeHours`.
   - Agregar los tipos nuevos a `interfaces/payroll_calculation.ts` y `interfaces/payroll_overtime.ts`.
   - Verificar a mano (script temporal en el scratchpad y borrarlo al terminar) con `salario_diario = 400`, es decir $100 la hora doble y $150 la triple, límite 9 y días de 3, 4, 2.5 y 1 h:
     - reparto: 3/0, 4/0, 2/0.5 y 0/1;
     - importes: $300, $400, $200 + $75 y $150;
     - totales: 9 h dobles ($900) y 1.5 h triples ($225).
   - Con límite 0, todo sale triple.

3. **Cálculo en `calculatePayrollPeriod`.**
   - Dentro del mismo batch, después de `#product_sales`, construir `#overtime_days` con los filtros del Alcance: `'A'`, rango del periodo, `fecha >= fecha_ingreso`, empresa con configuración y `NOT EXISTS` en `period_employee_overtime`. El reparto sale de `SUM() OVER (PARTITION BY id_empleado ORDER BY fecha ROWS UNBOUNDED PRECEDING)` y el importe se redondea por día con el `salario_diario` operativo.
   - Agregar las cinco columnas al `INSERT` del snapshot con un `OUTER APPLY` sobre `#overtime_days`, solo cuando `tipo_nomina = 'O'`.
   - Insertar el desglose desde `#overtime_days`, unido a las filas `'O'` nuevas.
   - Sustituir las condiciones de elegibilidad del `WHERE` por el fragmento compartido de la spec 60, sin cambiar su significado.
   - Agregar `UQ_period_employee_overtime_empleado_fecha` a `describePayrollCalculationError`.
   - Prueba manual:
     - Con las autorizaciones del paso 2, el snapshot y el desglose coinciden al centavo con el helper.
     - Las comisiones y el sueldo de todos los empleados salen iguales que antes del cambio.
     - Recalcular produce el mismo resultado.
     - Revertir vacía el desglose.

4. **Lecturas.**
   - `getPayrollProcessPage`:
     - lee las columnas nuevas;
     - agrega `importe_horas_extra` y lo suma a `total_percepciones`;
     - agrega `importeHorasExtra` a los totales sin filtros.
   - `getPayrollEmployeeDetail`: lee las cinco columnas y carga `overtimeDays` desde `period_employee_overtime`, ordenado por `fecha` (solo para `'O'`).

5. **Procesar.**
   - `PayrollEmployeesTable` gana la columna "Horas extra" (importe y "Xh dobles · Yh triples") después de "Com. Ventas", y su celda en el pie.
   - `PayrollProcessSummaryCards` incluye el importe en el total de percepciones.
   - Sigue siendo Server Component.

6. **Detalle.**
   - `buildPerceptionLines` agrega `horas_extra_dobles` y `horas_extra_triples` con `describeOvertimeHours`, cada una omitida si su importe es 0.
   - Crear `PayrollOvertimeDaysList` (Server Component) en `procesar/[id_empleado]/componentes/`, con una fila por día y una fila de total, oculta si `overtimeDays` está vacío.
   - Se aplica la skill `frontend-design` siguiendo el estilo de `PayrollSoldProductsList`.

7. **Aviso "Recalcula".**
   - Crear `isOvertimeRecalculationNeeded(id_period)` en `lib/payroll/` (server-only), con un solo SELECT de `EXISTS` sobre los cuatro casos del Alcance.
   - `getPayrollProcessPage` expone `overtimeRecalculationNeeded` y `getOvertimePage` expone `recalculationNeeded`.
   - Se muestra con un aviso (Server Component) en Procesar y en Horas extra, solo con el periodo en estatus 2.
   - Prueba manual: después de calcular no hay aviso. Aparece al hacer cualquiera de estas cosas, y desaparece al recalcular:
     - rechazar un día pagado;
     - cambiar sus horas;
     - autorizar un día nuevo del rango;
     - cambiar el límite.

8. **Pantalla Horas extra.**
   - Cambiar el texto fijo a "Las horas autorizadas se pagan al calcular la nómina del periodo."
   - `getOvertimePage` hace `LEFT JOIN` a `period_employee_overtime` → `period_employees` → `periods` para llenar `paidInPeriodCode`, y `OvertimeDaysTable` muestra el distintivo "Pagada en {código}".
   - La decisión sigue disponible con el periodo en estatus 1 o 2.

9. **Documentación.**
   - Agregar a `docs/nomina.md` la sección "Horas extra: pago (spec 61)" con:
     - el reparto;
     - la tarifa y el redondeo;
     - el candado;
     - el aviso;
     - las consecuencias (días de alguien excluido, snapshots anteriores en 0, sin descuento retroactivo).
   - Actualizar el párrafo inicial del módulo, con los cinco conceptos y las tablas nuevas.

Cada paso deja el sistema compilando y funcionando.

## Criterios de aceptación

**Base de datos**

- [x] `payroll.period_employees` tiene las cinco columnas nuevas con sus defaults y `CK_period_employees_horas_extra`, y los snapshots anteriores quedan en 0.
- [x] `payroll.period_employee_overtime` existe con el `UNIQUE (id_empleado, fecha)`, la FK con `ON DELETE CASCADE`, el `CHECK` y el índice, y está documentada en `queries.txt`.
- [x] La BD rechaza un desglose con `horas_dobles + horas_triples <> horas_autorizadas` y un segundo día con el mismo empleado y fecha.

**Cálculo**

Empleado con `salario_diario = 400`, límite 9 y días autorizados de 3, 4, 2.5 y 1 h en el periodo:

- [x] El snapshot `'O'` guarda `horas_extra_dobles = 9.0`, `horas_extra_triples = 1.5`, `importe_horas_extra_dobles = 900.00`, `importe_horas_extra_triples = 225.00` y `limite_horas_dobles_aplicado = 9.0`.
- [x] El desglose tiene cuatro filas en orden de fecha: 3/0, 4/0, 2/0.5 y 0/1, con importes $300, $400, $200 + $75 y $150.

Casos que no entran o se pagan distinto:

- [x] Con límite 0, todas las horas se pagan triples.
- [x] Sin fila en `overtime_settings`, no se paga ninguna hora extra ni se crea desglose, y el límite aplicado queda en 0.
- [x] Quedan fuera del cálculo y del desglose:
  - los días rechazados;
  - los días pendientes (sin fila);
  - los días fuera del rango del periodo;
  - los días anteriores a `fecha_ingreso`.
- [x] Un día ya pagado por otro periodo no se vuelve a pagar, y tampoco consume horas dobles del periodo actual.
- [x] Los días autorizados de un empleado que no entra a la nómina operativa no se pagan ni se bloquean.
- [x] Las filas `'F'` quedan con las cinco columnas en 0 y sin desglose.

Consistencia:

- [x] `horas_extra_dobles + horas_extra_triples` del snapshot es igual a la suma de `horas_autorizadas` de su desglose, y los importes del snapshot son la suma exacta de los importes redondeados por día.
- [x] Al calcular un periodo, el sueldo y las tres comisiones de todos los empleados salen iguales que antes de esta spec.
- [x] Recalcular un periodo en estatus 2 libera y vuelve a tomar los mismos días. Revertir borra el desglose, y esos días se pueden pagar después.
- [x] Dos cálculos simultáneos que compiten por el mismo día terminan con uno correcto y otro con "Otro cálculo tomó algunas de estas horas extra al mismo tiempo. Intenta de nuevo.", nunca con un error 500.
- [x] `splitOvertimeHours` y `calculateOvertimeDayAmounts` dan los mismos valores que el SQL en el caso de ejemplo.

**Procesar**

- [x] La columna "Horas extra" aparece después de "Com. Ventas", con el importe y "9h dobles · 1.5h triples".
- [x] "Total percepciones" de la fila, la tarjeta resumen y el pie incluyen las horas extra.
- [x] La tarjeta resumen y el pie no cambian al filtrar por puesto o búsqueda.
- [x] Un empleado sin horas extra muestra $0.00 en la columna, sin texto secundario.

**Detalle**

- [x] La tarjeta de percepciones muestra "Horas extra dobles — 9 h × $100.00 — $900.00" y "Horas extra triples — 1.5 h × $150.00 — $225.00". Una línea con importe 0 no aparece.
- [x] `PayrollOvertimeDaysList` lista los cuatro días con fecha, horas, dobles, triples e importe, más un total igual a la suma de las dos líneas.
- [x] La lista se oculta en fiscal o cuando no hay días pagados.
- [x] Los componentes nuevos no tienen `"use client"`.

**Aviso "Recalcula" y pantalla de Horas extra**

- [x] Recién calculado un periodo, no hay aviso ni en Procesar ni en Horas extra.
- [x] Con el periodo en estatus 2, aparece "Hay autorizaciones que no coinciden con el último cálculo. Recalcula la nómina." en ambas pantallas tras cualquiera de estas acciones, y desaparece al recalcular:
  - rechazar un día pagado;
  - volverlo a pendiente;
  - cambiar sus horas;
  - autorizar un día nuevo del rango;
  - cambiar `limite_horas_dobles_periodo`.
- [x] Con el periodo en estatus 1, nunca aparece el aviso.
- [x] En Horas extra, cada día pagado muestra "Pagada en {código del periodo}", y su decisión se puede seguir cambiando.
- [x] El texto fijo dice "Las horas autorizadas se pagan al calcular la nómina del periodo."

**Transversal**

- [x] Ninguna fecha pasa por `new Date(valorDeBD)`: `fecha` se lee con `CONVERT(varchar(10), …, 120)`.
- [x] `docs/nomina.md` tiene la sección "Horas extra: pago (spec 61)" y el párrafo inicial actualizado.
- [x] `npm run build` (o `tsc --noEmit`) termina sin errores de tipos.

## Decisiones tomadas y descartadas

- **Sí: pagar solo las autorizaciones con `estado = 'A'`.** El cálculo no vuelve a detectar nada de las checadas. **No:** pagar lo detectado cuando no hay decisión.
- **Sí: reparto cronológico dentro del periodo.** Las primeras `limite_horas_dobles_periodo` horas son dobles, el resto triples, y el día que cruza el límite se parte. **No:** asignar primero los días más largos, ni repartir de forma proporcional.
- **Sí: tarifa `salario_diario / 8 × 2|3`,** con el `salario_diario` operativo que se congela en el mismo snapshot. **No:** guardar una columna de tarifa por hora, porque se deriva del salario congelado.
- **Sí: redondeo a centavos por día, y el snapshot suma los importes ya redondeados.** Así la lista del Detalle cuadra al centavo, como en la spec 58. **No:** redondear una sola vez sobre el total del periodo.
- **Sí: candado `UNIQUE (id_empleado, fecha)` en `period_employee_overtime`.** Un día se paga una sola vez en toda la historia. **No:** `UNIQUE (id_overtime_authorization)`: si alguien vuelve el día a pendiente y lo autoriza otra vez, la fila cambia de id y el candado dejaría pagarlo dos veces.
- **Sí: sin FK del desglose a `overtime_authorizations`, con las horas congeladas en el desglose.** "Volver a pendiente" no choca con un día pagado, y lo pagado sobrevive, como en las specs 57 y 58. **No:** una FK que bloquee cambiar la decisión.
- **Sí: `ON DELETE CASCADE` a `period_employees`.** Recalcular y Revertir liberan los días con el `DELETE` que ya ejecutan, sin tocar `revertPayrollCalculation`. **No:** limpiar el desglose a mano en cada transición.
- **Sí: un día pagado se puede seguir cambiando, con la marca "Pagada en …" y el aviso "Recalcula".** **No:** bloquear la decisión de días pagados, que obligaría a revertir el periodo para corregir un error.
- **Sí: el aviso compara las autorizaciones contra el desglose.** Así atrapa rechazos, vuelta a pendiente, horas distintas y días nuevos. También salta si cambió el límite respecto a `limite_horas_dobles_aplicado`. **No:** comparar `decided_at` contra `calculated_at`, que no detecta el borrado de "Volver a pendiente". Tampoco avisar por cambios de salario, igual que el resto de la nómina.
- **Sí: sin fila en `overtime_settings` no se paga ninguna hora extra,** igual que la spec 57 sin configuración. **No:** usar 9 por defecto en silencio.
- **Sí: `limite_horas_dobles_aplicado` se congela en el snapshot, con un `CHECK` que impide pagar más dobles que ese límite.** **No:** leer el límite vigente al mostrar el Detalle.
- **Sí: los días autorizados de quien no entra a la nómina operativa no se pagan ni se bloquean,** como en las specs 57 y 58. El caso ya aparece en "empleados excluidos". **No:** un aviso nuevo en Procesar.
- **Sí: el cálculo vive en SQL dentro del batch de `calculatePayrollPeriod`, y `overtimePay.ts` lo replica en TS.** Si difieren, manda el SQL. **No:** calcular en TS y luego insertar, que rompería la atomicidad del cálculo.
- **Sí: se reutiliza el fragmento de elegibilidad de la spec 60 en el `INSERT` del snapshot.** Así la pantalla de Horas extra y el cálculo usan la misma regla. **No:** mantener dos copias de las condiciones.
- **Sí: una columna "Horas extra" (dobles + triples) en Procesar y dos líneas separadas en Detalle.** La tabla no crece de más, y el detalle explica las dos tarifas. **No:** dos columnas en Procesar.
- **Sí: solo nómina operativa, y las filas `'F'` en 0.** **No:** fiscal ni ISR (exento las primeras 9 h, gravado después). Quedan para otra spec.
- **Sí: el texto fijo de Horas extra cambia a "Las horas autorizadas se pagan al calcular la nómina del periodo."** **No:** quitarlo sin reemplazo.

## Riesgos identificados

- **La spec 60 no está implementada.** Esta spec depende de sus tablas, de su pantalla y del fragmento de elegibilidad en `lib/payroll/`.
  - **Mitigación:** `/spec-impl 61` no debe empezar hasta que la 60 esté implementada y probada con datos reales.
  - **Si al implementar la 60 cambian nombres o estructuras,** esta spec se ajusta antes de aprobarla.
- **Tocar el `INSERT` del snapshot.** `calculatePayrollPeriod` ya encadena sueldo y tres comisiones, y esta spec cambia sus columnas y su `WHERE` (con el fragmento compartido). Un error puede alterar importes que hoy son correctos.
  - **Mitigación:** el criterio que exige sueldo y comisiones idénticos antes y después, probado sobre un periodo real ya calculado (comparando los snapshots).
- **Un cambio de frecuencia deja días fuera del reparto correcto.** Si un empleado cambia de frecuencia y dos periodos de distinta frecuencia cubren la misma fecha, el candado paga el día solo en el primero que se calcule. El límite de dobles de cada periodo se aplica solo a los días que ese periodo realmente toma.
  - **Mitigación:** es el comportamiento esperado del candado. Se documenta en `docs/nomina.md`.
- **Pagos sin descuento retroactivo.** Rechazar un día ya pagado en un periodo que después pase a Aprobada o Pagada (estatus 3 y 4, que todavía no existen) no revierte nada.
  - **Mitigación:** hoy solo existe el estatus 2, que se puede recalcular.
  - **Pendiente:** cuando se implementen la aprobación y el pago, la spec que lo haga debe bloquear decisiones sobre días pagados en periodos 3 o 4.
- **Rendimiento del aviso "Recalcula".** Se evalúa en cada carga de Procesar y de Horas extra.
  - **Mitigación:** un solo SELECT con `EXISTS`, acotado al periodo y usando los índices `UQ_overtime_authorizations_empleado_fecha` y `UQ_period_employee_overtime_empleado_fecha`.
- **Salarios con muchos decimales.** `salario_diario / 8` puede no ser exacto en centavos.
  - **Mitigación:** se redondea solo el importe final de cada día, nunca la tarifa intermedia. La tarifa que se muestra en el Detalle es informativa, y el importe mostrado es siempre el guardado.
