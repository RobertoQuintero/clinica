# 53 — Nómina: cálculo del salario (operativa y fiscal) por periodo

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [52 — Nómina: periodos de nómina](52-nomina-periodos.md): el cálculo se hace sobre un `payroll.periods` y usa su primera transición de estatus (1 Programada → 2 En cálculo).
  - [51 — Empleados: campo periodo de pago](51-periodo-pago-empleado.md): `RH.empleados.id_periodo_pago` decide qué empleados entran a cada periodo según su frecuencia.
  - [38 — Empleados: salario diario fiscal](38-empleado-contactos-referencia-salario-fiscal.md): `salario_diario_fiscal` es la base de la nómina fiscal.
- **Modifica base de datos:** Sí. Crea `payroll.period_employees` en el esquema `payroll`.
- **Fecha:** 2026-09-21
- **Objetivo:** Crear la pantalla `/dashboard/nomina/procesar`, donde los roles 1 y 4 calculan, recalculan o revierten el salario de un periodo. El salario es salario diario × días pagados, en dos variantes: la operativa usa `salario_diario` y la fiscal usa `salario_diario_fiscal`. El resultado se guarda como snapshot por empleado y tipo, sin ninguna otra percepción ni deducción.

Referencias de diseño y negocio: `references/nomina/nomina.html` (pantalla) y `references/nomina/reglas_modulo_nomina.md` (reglamento).

## Alcance

**Incluye:**

- **Base de datos:**
  - Se crea la tabla `payroll.period_employees`: una fila por periodo, empleado y tipo de nómina (`'O'` operativa, `'F'` fiscal).
  - El DDL se documenta en `queries.txt`, al final del bloque `NOMINA PAYROLL`, después de `payroll.periods`.
- **Qué empleados entran.** Se evalúa al momento de calcular. Entra un empleado de `RH.empleados` que cumple todo esto:
  - `status = 1` y `activo = 1`;
  - `id_sucursal` = sucursal del periodo;
  - `id_periodo_pago` = `id_payment_period` del periodo;
  - `fecha_ingreso <= fecha_fin` del periodo.
- **Días pagados:** `fecha_fin − max(fecha_inicio, fecha_ingreso) + 1`, en días naturales. No descuenta faltas ni retardos.
- **Cálculo por tipo:**
  - **Operativa:** `importe_salario = round(salario_diario × dias, 2)`. Solo entran los empleados con `salario_diario > 0`.
  - **Fiscal:** `importe_salario = round(salario_diario_fiscal × dias, 2)`. Solo entran los empleados con `salario_diario_fiscal > 0`.
  - Un empleado puede estar en la operativa y no en la fiscal, o al revés.
- **Snapshot:** cada fila guarda el salario diario usado, los días y el importe. Si después cambia el salario en la ficha del empleado, el resultado ya guardado no cambia hasta que se recalcule.
- **Acciones sobre el periodo** (server actions, con el mismo gate de rol que la spec 52):
  - **Calcular** (estatus 1) y **Recalcular** (estatus 2). En un solo batch con bloqueo se borra el snapshot del periodo, se insertan las filas O y F y el periodo queda en estatus 2 (En cálculo).
  - **Revertir a Programada** (solo en estatus 2). Borra el snapshot y regresa el periodo a estatus 1, para que se puedan volver a editar sus fechas.
  - Mientras el periodo esté en estatus 2, editar y eliminar siguen bloqueados, como ya lo hace la spec 52.
- **Pantalla `/dashboard/nomina/procesar`** (Server Component, basada en `nomina.html`):
  - Breadcrumb "Nómina › Procesar Nómina", título y badge del estatus del periodo.
  - **Selector de periodo** de la sucursal activa, guardado en la URL (`periodo`). Si no viene, se abre el periodo activo en curso; si no hay, el más reciente.
  - **Selector Operativa | Fiscal** en la URL (`tipo`, por defecto `operativa`).
  - **Tarjetas:** periodo (rango y frecuencia), fecha de pago, número de empleados calculados y total de sueldos del tipo seleccionado.
  - **Tabla:** Empleado (nombre y código), Puesto, Salario D., Días y Sueldo, con una fila de totales al pie. Los totales siempre suman todo el tipo, sin importar los filtros.
  - **Filtros en la URL:** select de puesto (`puesto`) y búsqueda por nombre o código (`q`).
  - **Aviso de excluidos:** empleados de la frecuencia y sucursal del periodo que no tienen capturado el salario del tipo seleccionado. Se calcula al vuelo.
  - **Estados:**
    - estatus 1: estado vacío con el botón "Calcular nómina";
    - estatus 2: tabla con los botones "Recalcular" y "Revertir a Programada", ambos con confirmación dentro de la UI;
    - sin periodos en la sucursal: estado vacío con un enlace a Periodos.
- **Navegación:**
  - En `navConfig.tsx`, el grupo "Nómina" gana el hijo "Procesar nómina".
  - En la tabla de Periodos, cada fila tiene un enlace "Procesar" a `/dashboard/nomina/procesar?periodo=ID`.
  - `proxy.ts` ya cubre `/dashboard/nomina/*`, así que no cambia.
- **Documentación:** se actualizan `docs/nomina.md` (cálculo, tabla y transiciones 1 ↔ 2) y la lista de actions en `CLAUDE.md`.

**No incluye (fuera de alcance, para specs futuras):**

- Cualquier percepción distinta del salario: bonos, comisiones, horas extra, vacaciones, prima vacacional, aguinaldo y despensa.
- Deducciones: faltas, retardos, IMSS e ISR (tampoco `tablas_retencion`), y por lo tanto el neto.
- El descuento de días por asistencias o checador, y los días económicos.
- La separación entre transferencia y efectivo, la dispersión bancaria y el modal "Procesar y Dispersar".
- Las transiciones a Aprobada (3) y Pagada (4).
- El detalle por empleado (`nomina_detalle.html`), los recibos, la firma digital y el timbrado CFDI.
- Exportar (Excel o PDF), el donut y el "Resumen consolidado" de percepciones y deducciones.
- La selección manual de empleados ("Personal programado").
- El prorrateo por baja a mitad de periodo: no existe una `fecha_baja`, así que los inactivos simplemente no entran.
- Los montos en la tabla de Periodos (columnas Percepciones, Deducciones, etc.).

## Modelo de datos

**`payroll.period_employees`.** Es una tabla nueva y se documenta en `queries.txt`, al final del bloque `NOMINA PAYROLL`. Sigue las mismas convenciones de la spec 52: el nombre de la tabla va en inglés, las columnas de negocio en español y los tipos de las FK coinciden con los reales (`int` en `payroll.periods` y en `RH.empleados`).

```sql
-- Spec 53: snapshot del cálculo de salario por periodo, empleado y tipo de nómina.
CREATE TABLE [payroll].[period_employees](
    [id_period_employee] [int] IDENTITY(1,1) NOT NULL,
    [id_period]          [int]           NOT NULL,
    [id_empleado]        [int]           NOT NULL,
    [tipo_nomina]        [char](1)       NOT NULL,   -- 'O' operativa, 'F' fiscal
    [salario_diario]     [decimal](12,2) NOT NULL,   -- salario usado: salario_diario (O) o salario_diario_fiscal (F)
    [dias]               [smallint]      NOT NULL,   -- días naturales pagados
    [importe_salario]    [decimal](12,2) NOT NULL,   -- round(salario_diario * dias, 2)
    [calculated_by]      [int]           NOT NULL,
    [calculated_at]      [datetime2](0)  NOT NULL,
 CONSTRAINT [PK_period_employees] PRIMARY KEY CLUSTERED ([id_period_employee] ASC),
 CONSTRAINT [UQ_period_employees] UNIQUE ([id_period], [id_empleado], [tipo_nomina]),
 CONSTRAINT [CK_period_employees_tipo] CHECK ([tipo_nomina] IN ('O', 'F')),
 CONSTRAINT [CK_period_employees_montos] CHECK ([salario_diario] > 0 AND [dias] > 0 AND [importe_salario] >= 0),
 CONSTRAINT [FK_period_employees_period] FOREIGN KEY ([id_period])
     REFERENCES [payroll].[periods] ([id_period]),
 CONSTRAINT [FK_period_employees_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado])
) ON [PRIMARY]
GO
```

`UQ_period_employees` ya empieza por `id_period`, así que también sirve de índice para leer y borrar el snapshot de un periodo. No hace falta otro índice.

La FK a `payroll.periods` no lleva `ON DELETE CASCADE`: un periodo solo se puede borrar en estatus 1, y en ese estatus no tiene snapshot porque "Revertir" lo borra.

**`interfaces/payroll_calculation.ts`** (archivo nuevo). Todas las fechas son `string`.

```ts
export type PayrollType = "O" | "F";

// Fila de la tabla de Procesar nómina: el snapshot más los datos actuales del empleado, vía JOIN.
export interface IPayrollEmployeeRow {
  id_period_employee: number;
  id_empleado:        number;
  codigo_empleado:    string;
  nombre_completo:    string;
  id_puesto:          number;
  nombre_puesto:      string;
  tipo_nomina:        PayrollType;
  salario_diario:     number;
  dias:               number;
  importe_salario:    number;
  calculated_at:      string;   // "YYYY-MM-DD HH:mm:ss"
}

// Empleado de la frecuencia y sucursal del periodo sin salario capturado para el tipo seleccionado.
export interface IPayrollExcludedEmployee {
  id_empleado:     number;
  codigo_empleado: string;
  nombre_completo: string;
}

export interface IPayrollProcessFilters {
  idPeriod:    number | null;   // null: periodo activo en curso, o el más reciente
  payrollType: PayrollType;     // URL: tipo=operativa|fiscal
  idPuesto:    number | null;
  search:      string;          // nombre o código, coincidencia parcial
}

export interface IPayrollProcessPage {
  period:            IPayrollPeriodRow | null;                        // de interfaces/payroll_period.ts
  periodOptions:     Pick<IPayrollPeriodRow, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  rows:              IPayrollEmployeeRow[];                           // ya filtradas por puesto y búsqueda
  totals:            { employees: number; importeSalario: number };   // de todo el tipo, sin filtros
  puestoOptions:     { id_puesto: number; name: string }[];
  excludedEmployees: IPayrollExcludedEmployee[];
  lastCalculatedAt:  string | null;
}
```

**`lib/payroll/constants.ts`** (se amplía):

```ts
export const PAYROLL_TYPE = {
  O: { label: "Operativa", urlValue: "operativa" },
  F: { label: "Fiscal",    urlValue: "fiscal" },
} as const;
```

**`lib/payroll/salaryCalculation.ts`** (archivo nuevo, funciones puras sobre strings `"YYYY-MM-DD"`, sin que salga ningún `Date` de la función):

- `countPaidDays(fechaInicio, fechaFin, fechaIngreso)` devuelve `fin − max(inicio, ingreso) + 1`, o `0` si `ingreso > fin`.
- `calculateSalaryAmount(salarioDiario, dias)` devuelve `Math.round(salarioDiario * dias * 100) / 100`.

El cálculo real se hace en SQL dentro del batch, con `DATEDIFF` y `ROUND(..., 2)`. Estas funciones puras dejan la regla escrita y verificable, y sirven para comprobar los criterios de aceptación.

**`lib/payroll/schemas.ts`** (se amplía, zod):

- `calculatePayrollPeriodSchema`: `{ id_period: number int > 0 }`. Lo usan "Calcular" y "Recalcular".
- `revertPayrollCalculationSchema`: `{ id_period: number int > 0 }`.

**`RH.empleados` y `payroll.periods` no cambian.** La transición 1 ↔ 2 usa la columna `status` que ya existe.

## Plan de implementación

1. **Base de datos.** Ejecutar contra la BD el `CREATE TABLE [payroll].[period_employees]` y documentarlo en `queries.txt`, al final del bloque `NOMINA PAYROLL`, después de `payroll.periods`.
   *Verificación:* `SELECT * FROM [CentroPodologico].[payroll].[period_employees]` devuelve 0 filas sin error. Un `INSERT` manual con `tipo_nomina = 'X'` lo rechaza `CK_period_employees_tipo`, y uno con un `(id_period, id_empleado, tipo_nomina)` repetido lo rechaza `UQ_period_employees`.

2. **Extraer el acceso compartido de nómina.**
   - Mover `assertPayrollAccess()`, `IPayrollSession`, el tipo `ActionResult` y la constante `PERIOD_ROW_SELECT` de `nomina/periodos/actions.ts` a un módulo solo de servidor, `lib/payroll/access.ts`.
   - Que `periodos/actions.ts` los importe desde ahí, sin cambiar su comportamiento.

   *Verificación:* `tsc --noEmit` sin errores, y la pantalla de Periodos sigue creando, editando y borrando igual.

3. **Tipos, constantes y lógica pura.**
   - Crear `interfaces/payroll_calculation.ts`.
   - Agregar `PAYROLL_TYPE` a `lib/payroll/constants.ts`.
   - Crear `lib/payroll/salaryCalculation.ts` con `countPaidDays` y `calculateSalaryAmount`.
   - Agregar `calculatePayrollPeriodSchema` y `revertPayrollCalculationSchema` a `lib/payroll/schemas.ts`.

   *Verificación manual con un script temporal en el scratchpad:*
   - `countPaidDays("2026-09-14", "2026-09-20", "2025-01-10")` → 7;
   - `countPaidDays("2026-09-16", "2026-09-30", "2026-09-22")` → 9;
   - con ingreso posterior al fin → 0;
   - `calculateSalaryAmount(315.04, 15)` → 4725.6;
   - `calculateSalaryAmount(333.33, 7)` → 2333.31.

4. **Server action de lectura `getPayrollProcessPage(filters)`** en `app/dashboard/nomina/procesar/actions.ts`:
   - Resuelve el periodo en este orden: `idPeriod` de la sucursal activa; si no viene, el periodo activo en curso (su rango incluye `addZeroToday(new Date())`); si no hay, el de `fecha_inicio` más reciente. Un `idPeriod` de otra sucursal se trata como inexistente.
   - Devuelve `periodOptions`, con los periodos de la sucursal ordenados por `fecha_inicio DESC`.
   - Lee las `rows` del snapshot del `tipo` con JOIN a `RH.empleados` y `RH.puestos`. Aplica los filtros de puesto y búsqueda (`LIKE` sobre nombre completo y `codigo_empleado`) y ordena por apellido.
   - Calcula `totals` sobre todo el tipo, sin filtros.
   - Devuelve `puestoOptions`, con los puestos presentes en el snapshot del tipo.
   - Calcula `excludedEmployees` al vuelo, con la misma regla de elegibilidad de Alcance pero con el salario del tipo `NULL` o `<= 0`.
   - Devuelve `lastCalculatedAt`.
   - Fechas con `CONVERT(varchar(10|19), …, 120)` y montos convertidos a `number`.

   *Verificación:* `tsc --noEmit` sin errores.

5. **Server actions de escritura** en el mismo `procesar/actions.ts`:
   - **`calculatePayrollPeriod(input)`:**
     - Parsea con zod.
     - En **un solo batch SQL** con `BEGIN TRAN` y el periodo leído `WITH (UPDLOCK, HOLDLOCK)`:
       - verifica que el periodo pertenezca a la sucursal activa y tenga `status IN (1, 2)`; si no, `THROW`;
       - hace `DELETE` del snapshot del periodo;
       - hace `INSERT … SELECT` de las filas `'O'` y `'F'` con la regla de elegibilidad, `dias = DATEDIFF(day, max(inicio, ingreso), fin) + 1` y `importe = ROUND(salario * dias, 2)`;
       - hace `UPDATE` del periodo a `status = 2` con `updated_at`.
     - `calculated_by` sale de la sesión y `calculated_at = buildDate(new Date())`.
     - Si el `THROW` es de estatus o de sucursal, devuelve `ActionResult<{ operativa: number; fiscal: number }>` con un mensaje en español.
   - **`revertPayrollCalculation(input)`:** en un batch con `BEGIN TRAN`, con sucursal activa y `status = 2` en el `WHERE`, hace `DELETE` del snapshot y `UPDATE` a `status = 1`. Si no afecta filas, devuelve `{ ok: false }`.
   - Ambas llaman a `revalidatePath` de `/dashboard/nomina/procesar` y `/dashboard/nomina/periodos`.

   *Verificación:* `tsc --noEmit` sin errores.

6. **Navegación.**
   - En `navConfig.tsx`, el grupo "Nómina" gana el hijo `{ href: "/dashboard/nomina/procesar", label: "Procesar nómina" }`.
   - Crear un `procesar/page.tsx` mínimo, con solo el título.
   - En `PayrollPeriodsTable.tsx`, agregar a cada fila un enlace `<Link>` "Procesar" a `/dashboard/nomina/procesar?periodo={id_period}`.

   *Verificación:* los roles 1 y 4 ven el hijo y entran. Con el rol 2, `/dashboard/nomina/procesar` redirige a `/dashboard` (ya lo cubre `proxy.ts`).

7. **Pantalla de solo lectura** (usando el skill `frontend-design`, con base en `nomina.html`). `procesar/page.tsx` es un Server Component:
   - lee los `searchParams` (`periodo`, `tipo`, `puesto`, `q`) y llama a `getPayrollProcessPage`;
   - renderiza el encabezado con breadcrumb y badge de estatus (se reusa `PayrollBadges` de `periodos/componentes`), `PayrollProcessSummaryCards` y `PayrollEmployeesTable` con la fila de totales, ambos de servidor;
   - también renderiza `ExcludedEmployeesNotice`, de servidor, y los estados vacíos;
   - los componentes cliente son solo `PayrollProcessToolbar` (selector de periodo, toggle Operativa | Fiscal, select de puesto y búsqueda con debounce, todo con `router.replace`);
   - las fechas se formatean sin `new Date()` sobre el string crudo y los montos con `Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })`.

   Los componentes van en `app/dashboard/nomina/procesar/componentes/`.
   *Verificación:* con un snapshot insertado a mano, el toggle, los filtros, los totales y el aviso de excluidos responden. Cambiar de sucursal refresca la pantalla.

8. **Botones de acción** (usando el skill `frontend-design`):
   - `PayrollCalculationActions` (cliente) muestra "Calcular nómina" en estatus 1, y "Recalcular" y "Revertir a Programada" en estatus 2.
   - Cada botón pide confirmación dentro de la UI (modal propio, sin `confirm()`), llama a su action, muestra `message` si `ok` es `false` y hace `router.refresh()`.

   *Verificación:* calcular, recalcular y revertir desde la UI, de punta a punta, y confirmar que la tabla de Periodos refleja el estatus.

9. **Documentación.**
   - En `docs/nomina.md`, agregar una sección "Cálculo de salario" (tabla, elegibilidad, días, redondeo, snapshot y transiciones 1 ↔ 2) y actualizar la frase "Calculation … not built".
   - En `CLAUDE.md`, agregar `nomina/procesar/actions.ts` a la lista de actions.

   *Verificación:* `npm run build` sin errores.

Cada paso deja el sistema compilando y funcional.

## Criterios de aceptación

**Base de datos**

- [ ] `payroll.period_employees` existe con las columnas, FKs, `UNIQUE` y `CHECK` del Modelo de datos, y está documentada en `queries.txt`, al final del bloque `NOMINA PAYROLL`.
- [ ] Un `INSERT` directo con `tipo_nomina = 'X'`, con `dias = 0` o con un `(id_period, id_empleado, tipo_nomina)` duplicado falla por constraint.

**Permisos y navegación**

- [ ] Los roles 1 y 4 ven "Procesar nómina" dentro del grupo "Nómina" y pueden abrir `/dashboard/nomina/procesar`. Los roles 2, 3, 5 y 6 no lo ven, y si escriben la URL se les redirige a `/dashboard`.
- [ ] Si un rol distinto de 1 o 4 llama a cualquier action de `procesar/actions.ts`, recibe `{ ok: false }` y no se lee ni escribe nada.
- [ ] Cada fila de la tabla de Periodos tiene un enlace "Procesar" que abre `/dashboard/nomina/procesar?periodo={id}` con ese periodo seleccionado.
- [ ] Periodos sigue creando, editando y eliminando igual que antes de extraer `assertPayrollAccess`.

**Elegibilidad y cálculo**

- [ ] Solo entran los empleados con `status = 1` y `activo = 1`, de la sucursal del periodo y con `id_periodo_pago` igual a la frecuencia del periodo. Uno de otra sucursal, otra frecuencia, con `id_periodo_pago` `NULL` o inactivo no aparece en ningún tipo.
- [ ] Un empleado semanal con ingreso anterior al periodo `2026-09-14 – 2026-09-20` y `salario_diario = 315.04` aparece en la operativa con 7 días e importe `$2,205.28`.
- [ ] Un empleado quincenal que ingresó el `2026-09-22`, en el periodo `2026-09-16 – 2026-09-30`, aparece con 9 días. Uno que ingresó el `2026-10-01` no aparece.
- [ ] En un periodo quincenal `2026-09-16 – 2026-09-30` (15 días) con `salario_diario = 333.33`, el importe es `$4,999.95`. Los importes se guardan con 2 decimales.
- [ ] La fiscal usa `salario_diario_fiscal`. Un empleado con `salario_diario` capturado y `salario_diario_fiscal` `NULL` o `0` aparece en la operativa, pero no en la fiscal.
- [ ] Un empleado sin `salario_diario` (o con `0`) no aparece en la operativa.
- [ ] Después de calcular, cambiar el `salario_diario` en la ficha del empleado no cambia la tabla. Al pulsar "Recalcular", el importe se actualiza al nuevo salario.

**Transiciones**

- [ ] En estatus 1 (Programada), la pantalla muestra un estado vacío con "Calcular nómina". Al confirmar, el periodo pasa a estatus 2 (En cálculo) y la tabla se llena sin recargar manualmente.
- [ ] En estatus 2, "Recalcular" reemplaza el snapshot: no quedan filas duplicadas ni empleados que ya no son elegibles.
- [ ] En estatus 2, "Revertir a Programada" borra el snapshot del periodo y lo regresa a estatus 1. En la tabla de Periodos vuelven a aparecer editar y eliminar.
- [ ] En estatus 2, el periodo no se puede editar ni eliminar desde Periodos, ni siquiera llamando a la action directamente.
- [ ] Llamar a `calculatePayrollPeriod` sobre un periodo de otra sucursal, o con estatus 3 o 4 (ajustado a mano en la BD), devuelve `{ ok: false }` y no modifica nada.
- [ ] Las confirmaciones de Calcular, Recalcular y Revertir se hacen dentro de la UI, sin diálogos nativos del navegador.

**Pantalla**

- [ ] Sin `?periodo`, se abre el periodo cuyo rango incluye hoy. Si no hay, el más reciente. Si la sucursal no tiene periodos, se muestra un estado vacío con un enlace a Periodos.
- [ ] El selector de periodo solo lista periodos de la sucursal seleccionada. Al cambiar de sucursal, la pantalla se actualiza.
- [ ] El toggle Operativa | Fiscal cambia la tabla, las tarjetas y el total, y queda en la URL (`tipo`).
- [ ] Las tarjetas muestran el rango y la frecuencia, la fecha de pago, el número de empleados calculados y el total de sueldos del tipo seleccionado.
- [ ] La tabla muestra Empleado (nombre y código), Puesto, Salario D., Días y Sueldo, con fila de totales. No hay columnas de bonos, comisiones, deducciones, neto, transferencia ni efectivo.
- [ ] El select de puesto y la búsqueda por nombre o código filtran las filas y quedan en la URL. La fila de totales y las tarjetas no cambian con los filtros.
- [ ] El aviso de excluidos lista a los empleados elegibles por sucursal y frecuencia que no tienen el salario del tipo seleccionado. No se muestra si no hay ninguno.
- [ ] Las fechas mostradas coinciden con la BD, sin corrimiento de un día por UTC, y los montos se muestran en formato `$1,234.56`.

**Técnico**

- [ ] `page.tsx`, `PayrollProcessSummaryCards`, `PayrollEmployeesTable` y `ExcludedEmployeesNotice` son Server Components. Solo `PayrollProcessToolbar` y `PayrollCalculationActions` llevan `"use client"`.
- [ ] Ninguna query de `procesar/actions.ts` devuelve un `Date` de JS.
- [ ] `docs/nomina.md` y `CLAUDE.md` están actualizados.
- [ ] `npm run build` compila sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Sí: la operativa usa `salario_diario` y la fiscal usa `salario_diario_fiscal`, sin respaldo entre ellas.** Si falta el salario fiscal, el empleado no entra a la fiscal y aparece en el aviso de excluidos. Usar el operativo como respaldo produciría una nómina fiscal con montos que nadie capturó como fiscales.
- **Sí: días naturales del periodo (`fin − inicio + 1`).** Es la regla del reglamento ("15 días trabajados a cuota fija") y la del mockup ("15 d"). Un quincenal de 16 días paga 16.
- **No: los días fijos del catálogo (`RH.payment_periods.days`).** Ignoran las fechas reales del periodo, que el usuario puede editar.
- **No: los días trabajados según asistencias.** Faltas, retardos y checador son otro dominio, con sus propias reglas de descuento, y merecen su propia spec.
- **Sí: el prorrateo por ingreso a mitad de periodo** (`max(inicio, ingreso)`). No pagar días anteriores a la contratación es lo mínimo correcto, y es barato de calcular.
- **No: el prorrateo por baja.** No existe una `fecha_baja`. Un empleado inactivo al calcular no entra.
- **Sí: entran los empleados por sucursal y frecuencia (`id_periodo_pago`).** Reusa el vínculo que la spec 52 dejó previsto entre empleado y periodo. La selección manual ("Personal programado") queda para otra spec.
- **Sí: snapshot persistido en `payroll.period_employees`.** Guarda el salario, los días y el importe del momento del cálculo. Así, la nómina de un periodo no cambia sola cuando se edita la ficha del empleado, y las siguientes specs (aprobación, recibos, CFDI) tienen una base inmutable.
- **No: cálculo al vuelo sin persistir.** El histórico cambiaría cada vez que se edita un salario.
- **Sí: una fila por periodo, empleado y tipo (`tipo_nomina 'O'/'F'`).** Las dos nóminas van a divergir: la fiscal sumará ISR, IMSS y CFDI, y la operativa, bonos en efectivo. Una fila por tipo permite agregar conceptos a una sin tocar la otra.
- **No: una fila con columnas operativa y fiscal lado a lado.** Duplicaría cada concepto futuro en dos columnas.
- **Sí: se guarda `dias` en el snapshot, aunque se pueda derivar.** Deja explícito qué se pagó, y el futuro descuento por faltas lo modificará.
- **Sí: el cálculo se hace en SQL (`INSERT … SELECT`), dentro de un batch con `BEGIN TRAN` y `UPDLOCK, HOLDLOCK`.** Es atómico: el snapshot y el estatus cambian juntos o no cambian. Sigue el patrón de concurrencia de la spec 52 sin tocar `database/connection.ts`.
- **Sí: `lib/payroll/salaryCalculation.ts` con funciones puras**, aunque el cálculo real viva en SQL. Documenta la regla en TS y permite verificar los criterios con un script. Si el SQL y la función divergen, hay que corregir el SQL.
- **Sí: redondeo a 2 decimales por empleado, con totales que suman los importes redondeados.** El total de la pantalla coincide con la suma de lo que se paga a cada persona.
- **Sí: transiciones Calcular (1 → 2), Recalcular (2 → 2) y Revertir (2 → 1).** Recalcular cubre las correcciones de salario. Revertir permite volver a editar las fechas del periodo sin crear otro.
- **No: Aprobar (3) y Pagar (4) en esta spec.** Congelar el cálculo tiene sentido cuando existan las percepciones, las deducciones y los recibos.
- **Sí: pantalla `/dashboard/nomina/procesar?periodo=ID`, hija del grupo "Nómina".** Coincide con el breadcrumb del mockup ("Nómina › Procesar Nómina") y deja `/procesar/[id_empleado]` libre para `nomina_detalle.html`.
- **No: `/nomina/periodos/[id]`.** Mezclaría la administración del calendario con la operación de la nómina.
- **Sí: el toggle Operativa | Fiscal en la URL, con las mismas columnas.** Una sola tabla que el usuario ya conoce, compartible y recargable.
- **No: columnas lado a lado.** Duplicarían el ancho de la tabla y crecerían mal cuando cada tipo tenga sus propios conceptos.
- **Sí: el aviso de excluidos se calcula al vuelo, no se guarda.** Su función es avisar "captura el salario y recalcula", así que debe reflejar el estado actual de las fichas.
- **Sí: los filtros de puesto y búsqueda no afectan los totales ni las tarjetas.** El total representa la nómina del periodo, no la vista filtrada.
- **No: paginación de la tabla.** Los empleados de una sucursal y una frecuencia son un conjunto acotado (decenas), y paginar partiría la fila de totales. Si el volumen crece, se agrega después.
- **Sí: extraer `assertPayrollAccess` y `PERIOD_ROW_SELECT` a `lib/payroll/access.ts`.** Dos archivos de actions necesitan el mismo gate. Copiarlo haría que los permisos divergieran, y exportarlo desde un archivo `"use server"` lo expondría como action pública.
- **No: mostrar las columnas del mockup sin datos** (bonos, comisiones, deducciones, transferencia, efectivo y neto). Serían columnas vacías hasta que existan esos cálculos. Se mantiene el mismo criterio de la spec 52.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Los días se desfasan uno por conversión a UTC, que es el error clásico de mssql, o `DATEDIFF` se calcula sobre `datetime` con hora. | Las columnas del periodo y `fecha_ingreso` son `date`, así que `DATEDIFF(day, …)` opera sin hora. "Hoy" se obtiene con `addZeroToday(new Date())`. La pantalla recibe las fechas con `CONVERT(varchar(10), …, 120)`. Hay criterios con días concretos (7, 9, 15). |
| Dos usuarios pulsan Calcular a la vez, o uno calcula mientras otro revierte. | Un solo batch con `BEGIN TRAN` y el periodo leído `WITH (UPDLOCK, HOLDLOCK)`: la segunda operación espera y actúa sobre el estado ya cambiado. `UQ_period_employees` es la última barrera contra duplicados. Si falla, la action devuelve "Intenta de nuevo", nunca un 500. |
| La regla en SQL y la de `salaryCalculation.ts` divergen (por ejemplo, SQL `ROUND` contra `Math.round` en los medios centavos). | `ROUND` de SQL Server sobre `decimal` redondea half away from zero, igual que `Math.round` para montos positivos. Los criterios fijan importes exactos, que se verifican contra lo que queda en la BD. Si difieren, se corrige el SQL, que es la fuente de verdad. |
| El snapshot queda desactualizado (se capturó un salario o se dio de alta un empleado después de calcular), y alguien paga con datos viejos. | El aviso de excluidos se calcula al vuelo y la pantalla muestra `lastCalculatedAt`. Recalcular reemplaza todo el snapshot. Congelar formalmente el resultado queda para la spec de Aprobación. |
| Muchos empleados no tienen `id_periodo_pago` (la spec 51 lo dejó opcional y sin migrar datos), así que el cálculo sale vacío o incompleto. | Hay un estado vacío explícito cuando no hay elegibles. En la verificación se revisa que los empleados de prueba tengan la frecuencia capturada. Los que no la tienen no aparecen ni como excluidos: se documenta en `docs/nomina.md` que la frecuencia del empleado es requisito para entrar a la nómina. |
| Al mover `assertPayrollAccess` se rompe la pantalla de Periodos. | Es un paso propio del plan (paso 2), con verificación de punta a punta de Periodos antes de seguir, y un criterio de aceptación dedicado. |
| Revertir borra un cálculo que alguien ya revisó. | Solo existe en estatus 2 (todavía no hay Aprobada), pide confirmación dentro de la UI y el cálculo se regenera con Recalcular en un clic. Cuando exista Aprobada (3), Revertir no se ofrecerá en ese estatus. |
