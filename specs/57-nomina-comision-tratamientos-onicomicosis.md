# 57 — Nómina: comisión por tratamientos de onicomicosis

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md): `payroll.period_employees`, `calculatePayrollPeriod` y la pantalla Procesar.
  - [54 — Nómina: detalle de percepciones por empleado](54-nomina-detalle-percepciones-empleado.md): `buildPerceptionLines` y la tarjeta "Percepciones totales".
  - [55 — Empleados: vincular usuarios del sistema](55-empleado-vincular-usuarios.md): `users.id_empleado`, el puente que permite atribuirle el tratamiento a un empleado.
  - [56 — Nómina: comisión por pacientes atendidos](56-nomina-comision-consultas.md): la pantalla `/dashboard/nomina/comisiones`, las columnas de comisión en Procesar y el patrón de cálculo en SQL con su restatement en TS.
- **Modifica base de datos:** Sí. Tres tablas nuevas (`payroll.treatment_commission_settings`, `payroll.treatment_commission_settings_log`, `payroll.period_employee_treatments`) y tres columnas nuevas en `payroll.period_employees`.
- **Fecha:** 2026-09-24
- **Objetivo:** Pagar a cada empleado, en la nómina operativa, un importe fijo por cada tratamiento de onicomicosis que registraron sus usuarios vinculados y que quedó liquidado dentro del periodo. El importe por tratamiento y el umbral de liquidación se editan con bitácora, y cada tratamiento se paga una sola vez.

Un tratamiento queda **liquidado** en la fecha del pago parcial (tipo 2, `status = 1`) con el que la suma acumulada de sus parciales alcanza el umbral (hoy $5,000). La 55 es dependencia dura: sin `users.id_empleado` no hay a quién atribuirle el tratamiento. La 56 es dependencia blanda: esta spec reusa su pantalla y renombra su columna "Comisión" a "Com. consultas".

Reglas de origen: `references/docs/tratamiento_onicomicosis.md`.

## Alcance

**Incluye:**

- **Base de datos, configuración por empresa.** Tabla nueva `payroll.treatment_commission_settings` con una fila por `id_empresa`: `importe_por_tratamiento` y `umbral_liquidacion`, más `updated_by` y `updated_at`. Semilla para la empresa 1: $500 por tratamiento y umbral de $5,000.
- **Base de datos, bitácora.** Tabla nueva `payroll.treatment_commission_settings_log`. Cada guardado que cambia algún valor inserta una fila con los valores anteriores y los nuevos de los dos campos, `updated_by` y `updated_at`. Un guardado sin cambios no escribe nada.
- **Base de datos, desglose y candado anti doble pago.** Tabla nueva `payroll.period_employee_treatments` con una fila por tratamiento pagado: el renglón de `period_employees` al que pertenece, `id_tratamiento`, fecha de liquidación y suma de parciales al liquidar. Lleva `UNIQUE (id_tratamiento)`, así que **un tratamiento se paga una sola vez en toda la historia**, sin importar periodo, frecuencia ni sucursal.
- **Base de datos, tres columnas en `payroll.period_employees`:**
  - `tratamientos_onicomicosis INT NOT NULL DEFAULT 0`
  - `importe_por_tratamiento DECIMAL(12,2) NOT NULL DEFAULT 0`: el importe unitario congelado al calcular.
  - `importe_comision_tratamientos DECIMAL(12,2) NOT NULL DEFAULT 0`
- **Atribución.** El tratamiento se le atribuye al empleado cuando `Tratamiento_onicomicosis.id_usuario` es uno de los `users.id_user` vinculados a él (`users.id_empleado`). No se usa `id_especialista` ni el `id_podologo` de la consulta.
- **Qué tratamiento cuenta:**
  - `id_stage <> 6` (no cancelado), evaluado al momento de calcular.
  - Su fecha de liquidación cae en `[fecha_inicio, fecha_fin]` del periodo, en rango medio abierto.
  - No aparece ya en `payroll.period_employee_treatments` de **otro** periodo.
  - La fecha de liquidación es el `created_at` del pago con `id_tratamiento_pago_tipo = 2` y `status = 1` en el que la suma acumulada de esos pagos, ordenados por `created_at` y luego `id_tratamiento_pago`, llega a `umbral_liquidacion` o lo supera. Los pagos tipo 1 (anticipo) y los pagos con `status = 0` no suman.
- **Sin filtro de sucursal** ni de `status` del usuario, igual que la spec 56.
- **Importe:** `tratamientos_onicomicosis × importe_por_tratamiento`, sin prorrateo ni tope.
- **Solo nómina operativa.** Las filas `'F'` quedan en `0 / 0 / 0` y no generan desglose. Un empleado sin salario operativo no entra a la nómina, así que no comisiona y sus tratamientos no se marcan como pagados.
- **El cálculo vive en SQL,** dentro del batch de `calculatePayrollPeriod`: primero borra el desglose del periodo, luego el snapshot, luego inserta. `lib/payroll/` restata en TS puro la regla de liquidación y el importe; si divergen, **el SQL es la fuente de verdad**.
- **Sin descuento retroactivo.** Si un tratamiento se cancela, o se borran sus pagos, después de que un periodo lo pagó, ese periodo no cambia. Solo lo excluye un "Recalcular" de ese mismo periodo.
- **Pantalla `/dashboard/nomina/comisiones`:** sección nueva "Comisión por tratamiento de onicomicosis" con:
  - los dos valores vigentes, quién los cambió por última vez y cuándo;
  - un botón "Editar" que abre un modal;
  - la bitácora de cambios, del más reciente al más antiguo.
  Roles 1 y 4, detrás de `assertPayrollAccess()`, acotado a la `id_empresa` de la sesión. Validación con `zod` y escritura más bitácora en una sola transacción.
- **Pantalla Procesar:**
  - la columna "Comisión" pasa a llamarse "Com. consultas";
  - columna nueva "Com. onicomicosis" con el número de tratamientos como texto secundario;
  - "Total percepciones" y las tarjetas de resumen suman sueldo + las dos comisiones.
- **Detalle del empleado:**
  - `buildPerceptionLines` gana la línea `comision_tratamientos`, "Comisión por tratamientos de onicomicosis", con la descripción "N tratamientos × $X". Se omite cuando el importe es 0.
  - Debajo va la lista de tratamientos pagados: paciente, fecha de liquidación y enlace a `/dashboard/tratamientos/[id]`.
- **Documentación:** `docs/nomina.md` gana la sección "Comisión por tratamientos de onicomicosis (spec 57)".

**No incluye (fuera de alcance, para specs futuras):**

- Descuento o reverso de una comisión ya pagada cuando el tratamiento se cancela o se le borran pagos después.
- Comisión para `id_especialista` (médico externo) o para el podólogo de la consulta.
- Comisión en la nómina fiscal, su clave SAT y el consumo de `payroll.perceptions`.
- Importe distinto por sucursal, puesto, rol o tipo de tratamiento.
- Vigencias de la configuración: el cambio aplica al siguiente cálculo y el snapshot congela lo ya pagado.
- Contar los pagos tipo 1 (anticipo) para llegar al umbral.
- Ajuste manual de la comisión de un empleado en un periodo.
- Liberar a mano un tratamiento ya pagado para que vuelva a comisionar.
- Recalcular solo la comisión sin recalcular el periodo completo.
- Empleados pagados a pura comisión (el `CHECK` `salario_diario > 0` se queda).
- Reporte global de tratamientos pagados o pendientes de liquidar fuera del detalle por empleado.

Dos consecuencias de estas reglas, incluidas a propósito:

- **Quien registró el tratamiento y no está en la nómina operativa de ese periodo** (por ejemplo, por no tener salario operativo) no lo cobra. El tratamiento tampoco queda marcado como pagado; como su fecha de liquidación ya no cae en ningún periodo futuro, en la práctica nunca comisiona.
- **Si cambia el umbral**, la fecha de liquidación de los tratamientos que aún no se pagan se recalcula con el umbral nuevo en el siguiente cálculo.

## Modelo de datos

**La base de datos cambia:** tres tablas nuevas y tres columnas en el snapshot.

### Tabla nueva `payroll.treatment_commission_settings`

```sql
-- Spec 57: importe por tratamiento de onicomicosis y umbral de liquidación, por empresa.
CREATE TABLE [payroll].[treatment_commission_settings](
    [id_empresa]              [int]           NOT NULL,
    [importe_por_tratamiento] [decimal](12,2) NOT NULL,   -- se paga por cada tratamiento liquidado
    [umbral_liquidacion]      [decimal](12,2) NOT NULL,   -- suma de parciales (tipo 2, status 1) para considerarlo pagado
    [updated_by]              [int]           NOT NULL,
    [updated_at]              [datetime2](0)  NOT NULL,
 CONSTRAINT [PK_treatment_commission_settings] PRIMARY KEY CLUSTERED ([id_empresa] ASC),
 CONSTRAINT [CK_treatment_commission_settings_montos] CHECK (
     [importe_por_tratamiento] >= 0 AND [umbral_liquidacion] > 0)
) ON [PRIMARY]
GO

INSERT INTO [payroll].[treatment_commission_settings]
    ([id_empresa],[importe_por_tratamiento],[umbral_liquidacion],[updated_by],[updated_at])
VALUES (1, 500.00, 5000.00, 1, '2026-09-24 00:00:00')
GO
```

La PK es `id_empresa`: una fila por empresa, sin columna identidad. `importe_por_tratamiento = 0` se permite y sirve para apagar la comisión sin borrar nada. Sin fila para la empresa, nadie comisiona por tratamiento.

### Tabla nueva `payroll.treatment_commission_settings_log`

```sql
-- Spec 57: bitácora de cambios a la configuración de comisión por tratamiento.
CREATE TABLE [payroll].[treatment_commission_settings_log](
    [id_log]                           [int] IDENTITY(1,1) NOT NULL,
    [id_empresa]                       [int]           NOT NULL,
    [importe_por_tratamiento_anterior] [decimal](12,2) NULL,       -- NULL: no había configuración
    [importe_por_tratamiento_nuevo]    [decimal](12,2) NOT NULL,
    [umbral_liquidacion_anterior]      [decimal](12,2) NULL,
    [umbral_liquidacion_nuevo]         [decimal](12,2) NOT NULL,
    [updated_by]                       [int]           NOT NULL,
    [updated_at]                       [datetime2](0)  NOT NULL,
 CONSTRAINT [PK_treatment_commission_settings_log] PRIMARY KEY CLUSTERED ([id_log] ASC)
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_treatment_commission_settings_log_empresa]
    ON [payroll].[treatment_commission_settings_log] ([id_empresa], [updated_at] DESC)
GO
```

La semilla no escribe en la bitácora: la primera fila de la bitácora es el primer cambio hecho desde la pantalla.

### Tabla nueva `payroll.period_employee_treatments`

```sql
-- Spec 57: tratamientos pagados por renglón de nómina; UNIQUE(id_tratamiento) impide el doble pago.
CREATE TABLE [payroll].[period_employee_treatments](
    [id_period_employee_treatment] [int] IDENTITY(1,1) NOT NULL,
    [id_period_employee]           [int]           NOT NULL,
    [id_tratamiento]               [int]           NOT NULL,
    [fecha_liquidacion]            [datetime2](0)  NOT NULL,   -- created_at del pago que cruzó el umbral
    [total_parciales]              [decimal](12,2) NOT NULL,   -- suma acumulada al liquidar
 CONSTRAINT [PK_period_employee_treatments] PRIMARY KEY CLUSTERED ([id_period_employee_treatment] ASC),
 CONSTRAINT [UQ_period_employee_treatments_tratamiento] UNIQUE ([id_tratamiento]),
 CONSTRAINT [FK_period_employee_treatments_period_employee] FOREIGN KEY ([id_period_employee])
     REFERENCES [payroll].[period_employees] ([id_period_employee]) ON DELETE CASCADE
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_period_employee_treatments_period_employee]
    ON [payroll].[period_employee_treatments] ([id_period_employee])
GO
```

Por el `ON DELETE CASCADE`, "Recalcular" y "Revertir" liberan los tratamientos del periodo con el mismo `DELETE` de `period_employees` que ya hacen, sin sentencias nuevas. No hay FK a `dbo.Tratamiento_onicomicosis`: el tratamiento nunca se borra físicamente, y así el esquema `payroll` no queda atado a una tabla del sistema viejo.

### Columnas nuevas en `payroll.period_employees`

```sql
-- Spec 57: comisión por tratamientos de onicomicosis en el snapshot.
ALTER TABLE [payroll].[period_employees]
    ADD [tratamientos_onicomicosis]     [int]           NOT NULL CONSTRAINT [DF_period_employees_tratamientos]     DEFAULT (0),
        [importe_por_tratamiento]       [decimal](12,2) NOT NULL CONSTRAINT [DF_period_employees_importe_tto]      DEFAULT (0),
        [importe_comision_tratamientos] [decimal](12,2) NOT NULL CONSTRAINT [DF_period_employees_comision_tto]     DEFAULT (0)
GO

ALTER TABLE [payroll].[period_employees] WITH CHECK
    ADD CONSTRAINT [CK_period_employees_comision_tto] CHECK (
        [tratamientos_onicomicosis] >= 0 AND [importe_por_tratamiento] >= 0
        AND [importe_comision_tratamientos] >= 0)
GO
```

### Interfaces

**`interfaces/payroll_treatment_commission.ts`** (archivo nuevo):

```ts
export interface ITreatmentCommissionSettings {
  importe_por_tratamiento: number;
  umbral_liquidacion:      number;
  updated_by_nombre:       string;
  updated_at:              string;   // "YYYY-MM-DD HH:mm:ss"
}

export interface ITreatmentCommissionSettingsInput {
  importe_por_tratamiento: number;
  umbral_liquidacion:      number;
}

export interface ITreatmentCommissionSettingsLogEntry {
  id_log:                           number;
  importe_por_tratamiento_anterior: number | null;
  importe_por_tratamiento_nuevo:    number;
  umbral_liquidacion_anterior:      number | null;
  umbral_liquidacion_nuevo:         number;
  updated_by_nombre:                string;
  updated_at:                       string;   // "YYYY-MM-DD HH:mm:ss"
}

/** Tratamiento pagado en un renglón de nómina, para la lista del detalle. */
export interface IPayrollPaidTreatment {
  id_tratamiento:    number;
  nombre_paciente:   string;
  fecha_liquidacion: string;   // "YYYY-MM-DD HH:mm:ss"
  total_parciales:   number;
}
```

**`interfaces/payroll_calculation.ts`** (se amplía):

```ts
export interface IPayrollEmployeeRow {
  // … campos actuales …
  tratamientos_onicomicosis:     number;
  importe_comision_tratamientos: number;
  total_percepciones:            number;   // importe_salario + importe_comision + importe_comision_tratamientos
}

export interface IPayrollEmployeeSnapshot {
  // … campos actuales …
  tratamientos_onicomicosis:     number;
  importe_por_tratamiento:       number;
  importe_comision_tratamientos: number;
}

// totals: { employees; importeSalario; importeComision; importeComisionTratamientos; totalPercepciones }
// IPayrollEmployeeDetail gana: paidTreatments: IPayrollPaidTreatment[]   ([] en fiscal)
```

### Lógica pura: `lib/payroll/treatmentCommission.ts` (archivo nuevo)

```ts
interface ITreatmentPartialPayment {
  id_tratamiento_pago: number;
  created_at:          string;   // "YYYY-MM-DD HH:mm:ss"
  total:               number;
}

/** Pago con el que la suma acumulada (orden created_at, id) alcanza el umbral, o null. Recibe solo parciales tipo 2 con status 1. */
export function findLiquidationPayment(
  partialPayments: ITreatmentPartialPayment[], threshold: number): ITreatmentPartialPayment | null;

/** round(treatmentCount × unitAmount, 2). */
export function calculateTreatmentCommissionAmount(treatmentCount: number, unitAmount: number): number;

/** "3 tratamientos × $500.00" — descripción de la línea del detalle. */
export function describeTreatmentCommission(treatmentCount: number, unitAmount: number): string;
```

Ordena comparando strings `"YYYY-MM-DD HH:mm:ss"`, sin `Date`. Restata la regla del SQL; **si divergen, manda el SQL**.

### Schema `zod` (en `lib/payroll/schemas.ts`)

```ts
export const treatmentCommissionSettingsSchema = z.object({
  importe_por_tratamiento: z.number().min(0).multipleOf(0.01),
  umbral_liquidacion:      z.number().positive().multipleOf(0.01),
});
```

### Server actions (en `app/dashboard/nomina/comisiones/actions.ts`, junto a las de tramos)

| Action | Devuelve | Qué hace |
|---|---|---|
| `getTreatmentCommissionSettings()` | `ActionResult<ITreatmentCommissionSettings \| null>` | Configuración de la empresa de la sesión, con el nombre de quien la cambió por última vez; `null` si no hay fila. |
| `getTreatmentCommissionSettingsLog()` | `ActionResult<ITreatmentCommissionSettingsLogEntry[]>` | Las últimas 20 entradas de la bitácora de la empresa, `ORDER BY updated_at DESC, id_log DESC`. |
| `updateTreatmentCommissionSettings(input)` | `ActionResult<null>` | Valida con `zod`. En un batch `BEGIN TRAN` lee la fila `WITH (UPDLOCK, HOLDLOCK)`. Si ningún valor cambió, no escribe nada. Si cambió algo, hace `UPDATE` (o `INSERT` si no había fila) e inserta la bitácora con los valores anterior y nuevo. `updated_at = buildDate(new Date())`. |

Las tres llaman a `assertPayrollAccess()` y se acotan a su `id_empresa`. La de escritura hace `revalidatePath("/dashboard/nomina/comisiones")`.

### El cálculo, en el batch de `calculatePayrollPeriod`

Orden dentro del batch, después de leer el periodo con `UPDLOCK, HOLDLOCK`:

1. `DELETE period_employees` del periodo (ya existe). El cascade libera sus tratamientos.
2. **Tratamientos liquidados en el rango**, a una tabla temporal `#liquidated`:

```sql
;WITH partials AS (
    SELECT p.[id_tratamiento], p.[id_tratamiento_pago], p.[created_at],
           SUM(p.[total]) OVER (PARTITION BY p.[id_tratamiento]
                                ORDER BY p.[created_at], p.[id_tratamiento_pago]
                                ROWS UNBOUNDED PRECEDING) AS acumulado
      FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis_pagos] p
     WHERE p.[id_tratamiento_pago_tipo] = 2 AND p.[status] = 1
)
SELECT u.[id_empleado], t.[id_tratamiento], liq.[created_at] AS fecha_liquidacion, liq.acumulado
  INTO #liquidated
  FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis] t
  JOIN [CentroPodologico].[dbo].[users] u   ON u.[id_user] = t.[id_usuario]
  JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = u.[id_empleado]
  JOIN [CentroPodologico].[payroll].[treatment_commission_settings] s ON s.[id_empresa] = e.[id_empresa]
 CROSS APPLY (SELECT TOP 1 pa.[created_at], pa.acumulado
                FROM partials pa
               WHERE pa.[id_tratamiento] = t.[id_tratamiento] AND pa.acumulado >= s.[umbral_liquidacion]
               ORDER BY pa.[created_at], pa.[id_tratamiento_pago]) liq
 WHERE ISNULL(t.[id_stage], 0) <> 6
   AND liq.[created_at] >= @fecha_inicio
   AND liq.[created_at] <  DATEADD(day, 1, @fecha_fin)
   AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_treatments] pet
                    WHERE pet.[id_tratamiento] = t.[id_tratamiento]);
```

3. El `INSERT ... SELECT` de `period_employees` gana un `OUTER APPLY` que cuenta `#liquidated` por `id_empleado` (solo cuando `tipo_nomina = 'O'`) y un `LEFT JOIN` a `treatment_commission_settings` por `e.id_empresa`. Llena `tratamientos_onicomicosis`, `importe_por_tratamiento` y `ROUND(conteo × importe, 2)`. Las filas `'F'` quedan en `0, 0, 0`.
4. `INSERT INTO period_employee_treatments` desde `#liquidated` con `JOIN period_employees` por `id_period`, `id_empleado` y `tipo_nomina = 'O'`. El tratamiento de un empleado que no entró a la nómina operativa no se inserta, así que queda libre.

**Convenciones que esto respeta:**

- `NOT EXISTS` sobre **todo** `period_employee_treatments` basta, porque el paso 1 ya liberó los tratamientos de este mismo periodo. El `UNIQUE` es la última barrera si dos sucursales calculan a la vez.
- Rango medio abierto sobre `created_at` (datetime); las fechas del periodo viajan como strings `"YYYY-MM-DD"`.
- `ISNULL(t.id_stage, 0) <> 6`: un `id_stage` nulo cuenta como no cancelado, en lugar de caerse en silencio por un `NULL <> 6`.
- `JOIN users` sin filtrar `status` y sin condición de sucursal, igual que la spec 56.
- Las lecturas nuevas (`fecha_liquidacion`, `updated_at`) salen con `CONVERT(varchar(19), …, 120)`.

## Plan de implementación

1. **Base de datos.**
   - Ejecutar contra `CentroPodologico`:
     - `CREATE TABLE` de `treatment_commission_settings` (con su semilla), `treatment_commission_settings_log` (con su índice) y `period_employee_treatments` (con su índice);
     - el `ALTER TABLE [payroll].[period_employees]` con las tres columnas y su `CHECK`.
   - Agregar la misma DDL al final de `queries.txt`, bajo `-- Spec 57: …` y después del bloque de la spec 56.

   *Verificación:*
   - `SELECT * FROM [payroll].[treatment_commission_settings]` devuelve `(1, 500.00, 5000.00, …)`.
   - Los snapshots existentes quedan en `0 / 0 / 0` en las columnas nuevas.
   - Un `INSERT` de prueba con el mismo `id_tratamiento` dos veces en `period_employee_treatments` falla por el `UNIQUE`.
   - La app sigue funcionando sin cambios de código.

2. **Interfaces, lógica pura y schema.**
   - `interfaces/payroll_treatment_commission.ts` completo.
   - `interfaces/payroll_calculation.ts` ampliado. Los campos nuevos quedan opcionales solo si hace falta que compile; se vuelven obligatorios en los pasos 6 y 8.
   - `lib/payroll/treatmentCommission.ts` con `findLiquidationPayment`, `calculateTreatmentCommissionAmount` y `describeTreatmentCommission`.
   - `treatmentCommissionSettingsSchema` en `lib/payroll/schemas.ts`.
   - **Sin cambios visibles.**

   *Verificación:*
   - `npx tsc --noEmit` sin errores.
   - Con umbral 5000, `findLiquidationPayment` sobre parciales de 2000, 2000 y 1500 devuelve el tercero.
   - Con 2000 y 2000 devuelve `null`.
   - Con dos pagos del mismo `created_at`, el desempate es por `id_tratamiento_pago`.
   - `calculateTreatmentCommissionAmount(3, 500)` da 1500.

3. **Server actions de la configuración.**
   - `getTreatmentCommissionSettings`, `getTreatmentCommissionSettingsLog` y `updateTreatmentCommissionSettings` en `nomina/comisiones/actions.ts`, detrás de `assertPayrollAccess()`.
   - La escritura corre en un batch `BEGIN TRAN` con `UPDLOCK, HOLDLOCK`: compara, actualiza e inserta en la bitácora.

   *Verificación:*
   - `npx tsc --noEmit` sin errores.
   - Llamadas manuales:
     - guardar `{500, 5000}` sin cambios no agrega fila a la bitácora;
     - guardar `{600, 5000}` agrega una fila con `500 → 600` y `5000 → 5000`;
     - `umbral_liquidacion = 0` devuelve `{ ok: false }`;
     - un rol distinto de 1 o 4 devuelve `{ ok: false }`.

4. **Sección de configuración y bitácora, solo lectura** (usando el skill `frontend-design`).
   - `comisiones/componentes/TreatmentCommissionSettingsCard.tsx` (Server Component): importe por tratamiento, umbral de liquidación, "Modificado por {nombre} el {DD/MM/AAAA HH:mm}". Si no hay fila, muestra el estado "Sin configurar, no se paga comisión por tratamientos".
   - `comisiones/componentes/TreatmentCommissionSettingsLog.tsx` (Server Component): tabla con fecha, usuario, importe anterior → nuevo y umbral anterior → nuevo. Resalta solo el campo que cambió. Estado vacío: "Sin cambios registrados".
   - `comisiones/page.tsx` pide las dos cosas en paralelo junto con los tramos y agrega la sección debajo de la tabla de tramos.

   *Verificación:* con rol 1 o 4 la sección muestra $500 y $5,000 y la bitácora vacía. La tabla de tramos no cambia.

5. **Edición de la configuración** (usando el skill `frontend-design`).
   - `comisiones/componentes/TreatmentCommissionSettingsModal.tsx` (`"use client"`):
     - botón "Editar" y modal con los dos campos, precargados;
     - aviso fijo: "El cambio aplica al siguiente cálculo; las nóminas ya calculadas no cambian hasta que se recalculen";
     - muestra el `message` de un `{ ok: false }` en un `role="alert"`;
     - al guardar hace `router.refresh()`.

   *Verificación:*
   - Editar el importe se refleja en la tarjeta y agrega una fila a la bitácora sin recargar a mano.
   - Guardar sin cambios no agrega fila.
   - Un umbral de 0 se rechaza en el modal y en el servidor.

6. **Cálculo de la comisión.**
   - `nomina/procesar/actions.ts`, `calculatePayrollPeriod`:
     - el paso `#liquidated`;
     - las tres columnas nuevas en el `INSERT ... SELECT`, con `0, 0, 0` en `'F'`;
     - el `INSERT INTO period_employee_treatments`.
   - `describePayrollCalculationError` traduce la violación de `UQ_period_employee_treatments_tratamiento` a "Otro cálculo tomó alguno de estos tratamientos al mismo tiempo. Intenta de nuevo."
   - `getPayrollProcessPage`: `tratamientos_onicomicosis`, `importe_comision_tratamientos` y el `total_percepciones` de tres sumandos en las filas, e `importeComisionTratamientos` en los totales.
   - `revertPayrollCalculation` **no cambia**: el cascade se encarga.
   - **Todavía sin cambios en la UI.**

   *Verificación:* calcular un periodo y comparar contra SQL a mano.
   - Un empleado con dos tratamientos liquidados en el rango queda con `2 / 500 / 1000` y dos filas de desglose.
   - Un tratamiento con parciales que suman 4,999 no aparece.
   - Uno con `id_stage = 6` no aparece.
   - Uno ya pagado en otro periodo no aparece.
   - "Revertir" deja `period_employee_treatments` sin filas de ese periodo.
   - "Recalcular" reproduce los mismos números.

7. **Pantalla Procesar** (usando el skill `frontend-design`).
   - `PayrollEmployeesTable`:
     - "Comisión" pasa a llamarse "Com. consultas";
     - columna nueva "Com. onicomicosis" con el número de tratamientos como texto secundario;
     - "Total percepciones" con los tres sumandos.
   - `PayrollProcessSummaryCards`: el total suma sueldo + las dos comisiones, con el desglose de los tres conceptos.
   - Ambos siguen siendo Server Components.

   *Verificación:*
   - El total de las tarjetas es igual a la suma de "Total percepciones" de todas las filas del tipo.
   - En fiscal, las dos columnas de comisión muestran $0.

8. **Detalle del empleado** (usando el skill `frontend-design` para la lista).
   - `getPayrollEmployeeDetail`:
     - trae las tres columnas nuevas del snapshot;
     - trae `paidTreatments`: `period_employee_treatments` → `Tratamiento_onicomicosis` → `consultas` → `pacientes`, ordenado por `fecha_liquidacion`. En fiscal es `[]`.
   - `buildPerceptionLines` gana la línea `comision_tratamientos` ("Comisión por tratamientos de onicomicosis", con la descripción de `describeTreatmentCommission`), omitida cuando el importe es 0.
   - `procesar/[id_empleado]/componentes/PayrollPaidTreatmentsList.tsx` (Server Component): paciente, fecha de liquidación y enlace a `/dashboard/tratamientos/[id]`, debajo de la tarjeta de percepciones. No se muestra si la lista está vacía.

   *Verificación:*
   - Un empleado con tratamientos muestra la línea "N tratamientos × $500.00", y su lista tiene N filas con enlaces que abren el tratamiento.
   - El total de la tarjeta suma los tres conceptos.
   - Un snapshot viejo muestra lo mismo que hoy.

9. **Documentación.**
   - `docs/nomina.md`:
     - sección "Comisión por tratamientos de onicomicosis (spec 57)" con la regla de liquidación, la atribución, el candado de pago único, el cascade, la bitácora y la ausencia de descuento retroactivo;
     - actualizar la frase del encabezado que enumera los conceptos calculados.

   *Verificación:* `npm run build` compila sin errores.

Cada paso deja el sistema compilando y funcional.

## Criterios de aceptación

**Base de datos**

- [ ] Existen `payroll.treatment_commission_settings`, `payroll.treatment_commission_settings_log` y `payroll.period_employee_treatments` con sus PK, `CHECK`, `UNIQUE`, FK e índices.
- [ ] La configuración nace con `(id_empresa = 1, 500.00, 5000.00)` y la bitácora vacía.
- [ ] `payroll.period_employees` tiene `tratamientos_onicomicosis`, `importe_por_tratamiento` e `importe_comision_tratamientos`, todas `NOT NULL DEFAULT 0`.
- [ ] Un `INSERT` con `umbral_liquidacion = 0` o `importe_por_tratamiento < 0` es rechazado por el `CHECK`.
- [ ] Insertar dos veces el mismo `id_tratamiento` en `period_employee_treatments` falla por el `UNIQUE`.
- [ ] Borrar una fila de `period_employees` borra en cascada sus filas de `period_employee_treatments`.
- [ ] La DDL y la semilla de la spec están en `queries.txt`.

**Permisos**

- [ ] Las tres actions de configuración devuelven `{ ok: false }` con roles distintos de 1 y 4, aunque se llamen directamente.
- [ ] Cada action lee y escribe solo la configuración de la `id_empresa` de la sesión.

**Configuración y bitácora**

- [ ] `/dashboard/nomina/comisiones` muestra el importe por tratamiento, el umbral, quién los cambió por última vez y cuándo.
- [ ] Sin fila de configuración, la sección dice "Sin configurar, no se paga comisión por tratamientos".
- [ ] Guardar valores distintos actualiza la fila (`updated_by`, `updated_at`) e inserta **una** entrada en la bitácora con los valores anterior y nuevo de los dos campos.
- [ ] Guardar sin cambiar nada no escribe ni en la configuración ni en la bitácora.
- [ ] `umbral_liquidacion <= 0` o `importe_por_tratamiento < 0` devuelven `{ ok: false }` con mensaje en el modal y no escriben.
- [ ] `importe_por_tratamiento = 0` se puede guardar.
- [ ] La bitácora lista las últimas 20 entradas, de la más reciente a la más antigua, con el nombre del usuario.
- [ ] Cambiar la configuración no altera ningún snapshot existente hasta que se recalcula el periodo.

**Regla de liquidación**

- [ ] Solo suman los pagos con `id_tratamiento_pago_tipo = 2` y `status = 1`. El pago tipo 1 y los pagos con `status = 0` no suman.
- [ ] Parciales de 2,000 + 2,000 + 1,500 liquidan el tratamiento en la fecha del tercer pago. Con 2,000 + 2,000 el tratamiento no está liquidado.
- [ ] Parciales que suman exactamente el umbral **sí** liquidan (`>=`).
- [ ] Un tratamiento liquidado a las 23:30 del `fecha_fin` del periodo **sí** cuenta; uno liquidado a las 00:10 del día siguiente no.
- [ ] Un tratamiento creado antes del periodo pero liquidado dentro de él **sí** cuenta en ese periodo.
- [ ] Un tratamiento con `id_stage = 6` al momento de calcular no cuenta; uno con `id_stage` nulo sí.
- [ ] Con el umbral cambiado a 4,000, un tratamiento con 2,000 + 2,000 pasa a liquidarse en la fecha del segundo pago en el siguiente cálculo.
- [ ] `findLiquidationPayment` en TS y el SQL dan la misma fecha de liquidación para los casos de arriba.

**Atribución**

- [ ] El tratamiento se le atribuye al empleado vinculado a `Tratamiento_onicomicosis.id_usuario`, no al `id_especialista` ni al podólogo de la consulta.
- [ ] Un empleado con dos usuarios vinculados suma los tratamientos de ambos.
- [ ] Un tratamiento cuyo `id_usuario` no tiene `id_empleado` no se le atribuye a nadie.
- [ ] Un tratamiento hecho en otra sucursal **sí** cuenta.
- [ ] Los tratamientos de un usuario que después quedó en `status = 0` siguen contando.

**Cálculo, snapshot y pago único**

- [ ] Un empleado con 3 tratamientos liquidados en el rango queda con `3 / 500.00 / 1500.00` y tres filas de desglose.
- [ ] Las filas `'F'` quedan en `0 / 0 / 0` y sin desglose, aunque el empleado tenga tratamientos.
- [ ] Un tratamiento ya presente en el desglose de **otro** periodo no se vuelve a contar, aunque su fecha de liquidación caiga en el rango (pago borrado y recapturado, o periodos traslapados de otra frecuencia o sucursal).
- [ ] "Recalcular" un periodo vuelve a tomar sus propios tratamientos y reproduce los mismos números si nada cambió.
- [ ] "Revertir" libera los tratamientos del periodo: un cálculo posterior de otro periodo que los cubra puede pagarlos.
- [ ] Cancelar un tratamiento o borrarle pagos después de calcular no cambia el snapshot ni el desglose de ese periodo.
- [ ] El tratamiento de un empleado que no entró a la nómina operativa no se paga ni queda en el desglose.
- [ ] Con el catálogo sin fila de configuración, calcular un periodo funciona y deja todo en 0.
- [ ] Dos cálculos simultáneos que compiten por el mismo tratamiento terminan con uno correcto y el otro con el mensaje "Intenta de nuevo", nunca con un error 500.

**Pantalla Procesar**

- [ ] La columna "Comisión" se llama "Com. consultas" y existe la columna "Com. onicomicosis", con el número de tratamientos como texto secundario.
- [ ] "Total percepciones" de cada fila es exactamente `importe_salario + importe_comision + importe_comision_tratamientos`.
- [ ] El total de las tarjetas de resumen es la suma de "Total percepciones" de **todos** los empleados del tipo, sin importar los filtros.
- [ ] En la vista fiscal las dos columnas de comisión muestran $0.

**Detalle del empleado**

- [ ] Un empleado con tratamientos muestra la línea "Comisión por tratamientos de onicomicosis" con la descripción "N tratamientos × $X", y el total suma los tres conceptos.
- [ ] Debajo aparece la lista de tratamientos pagados (paciente, fecha de liquidación, enlace), y cada enlace abre `/dashboard/tratamientos/[id]`.
- [ ] Con `importe_comision_tratamientos = 0` no aparecen ni la línea ni la lista.
- [ ] En fiscal nunca aparecen ni la línea ni la lista.
- [ ] Un snapshot calculado antes de esta spec se ve igual que hoy.

**Técnico**

- [ ] `TreatmentCommissionSettingsCard`, `TreatmentCommissionSettingsLog` y `PayrollPaidTreatmentsList` son Server Components. Solo `TreatmentCommissionSettingsModal` lleva `"use client"`.
- [ ] Todas las queries nuevas usan `db.queryParams`.
- [ ] `updateTreatmentCommissionSettings` parsea con `zod` y compara, escribe y registra en bitácora dentro de una sola transacción.
- [ ] Ninguna query nueva devuelve un `Date` de JS.
- [ ] `docs/nomina.md` tiene la sección de la spec 57.
- [ ] `npm run build` compila sin errores de TypeScript.

## Decisiones tomadas y descartadas

**Atribución y regla de pago**

- **Sí: se atribuye por `Tratamiento_onicomicosis.id_usuario` → `users.id_empleado`.** Es quien registró el tratamiento desde la consulta, y `reglas_modulo_nomina.md` dice que la comisión es para quien lo vende.
- **No: `id_especialista`.** Es el médico externo (rol 5) y ya cobra por `egresos` ("pago_especialista").
- **No: `consultas.id_podologo` de la consulta de origen.** En la práctica suele ser la misma persona, pero `id_usuario` es el registro directo de la venta y no depende de otra tabla.
- **Sí: el periodo se decide por la fecha de liquidación** (el pago tipo 2 que cruza el umbral), no por `created_at` del tratamiento. Con `created_at`, un tratamiento que se termina de pagar en el periodo siguiente nunca cobraría.
- **Sí: el umbral usa `>=`.** El requerimiento dice "5000 o más".
- **Sí: solo pagos tipo 2 con `status = 1`.** Es la regla del documento. El tipo 1 es la valoración/anticipo que nace con el tratamiento.
- **Sí: orden de la suma acumulada por `created_at` y desempate por `id_tratamiento_pago`.** Sin desempate, dos pagos con el mismo segundo darían fechas de liquidación distintas entre corridas.
- **Sí: `id_stage <> 6` se evalúa al calcular, con `ISNULL(id_stage, 0)`.** Un `id_stage` nulo no debe desaparecer en silencio por la lógica de tres valores de SQL.
- **Sí: sin filtro de sucursal ni de `status` del usuario.** Misma regla que la spec 56: el trabajo lo hizo la persona.

**Pago único**

- **Sí: tabla `period_employee_treatments` con `UNIQUE (id_tratamiento)`.** Con solo columnas de conteo, borrar y recapturar un pago, o tener dos periodos traslapados de frecuencias o sucursales distintas, pagaría el mismo tratamiento dos veces. El `UNIQUE` lo impide en la BD, no solo en el código, y de paso guarda el desglose.
- **Sí: `ON DELETE CASCADE` hacia `period_employees`.** "Recalcular" y "Revertir" ya borran el snapshot; con el cascade liberan los tratamientos sin tocar su SQL, y ningún camino futuro puede olvidar hacerlo.
- **No: FK a `dbo.Tratamiento_onicomicosis`.** El tratamiento no se borra físicamente, y no se quiere atar el esquema `payroll` a una tabla del sistema viejo.
- **Sí: el tratamiento de quien no entró a la nómina operativa no se marca como pagado.** Marcarlo sin pagarlo sería registrar un pago que no existió.
- **No: descuento retroactivo** si el tratamiento se cancela o se le borran pagos después de pagado. Lo decidió el usuario: el snapshot es lo que se pagó.

**Configuración**

- **Sí: una fila por empresa**, igual que los tramos de la spec 56. Ni sucursal ni puesto piden un importe distinto.
- **Sí: el umbral también es editable** y queda en la misma bitácora. Lo decidió el usuario. Si cambia, cambia la fecha de liquidación de los tratamientos aún no pagados en el siguiente cálculo.
- **Sí: bitácora con valores anterior y nuevo**, además de `updated_by` y `updated_at` en la fila. El requerimiento pide saber quién cambió y cuándo; con solo la fila, cada cambio borra la huella del anterior.
- **Sí: guardar sin cambios no escribe.** Una bitácora llena de "500 → 500" esconde los cambios reales.
- **Sí: el snapshot congela `importe_por_tratamiento`.** Sin él, "N tratamientos × $X" del detalle mostraría el importe de hoy, no el que se pagó.
- **Sí: `importe_por_tratamiento = 0` se permite.** Apaga la comisión sin borrar la configuración ni perder la bitácora.
- **No: vigencias por fecha.** El snapshot ya congela lo pagado.

**Dónde vive el cálculo y la UI**

- **Sí: en SQL, dentro del batch de `calculatePayrollPeriod`,** con la regla restatada en `lib/payroll/treatmentCommission.ts` y **el SQL como fuente de verdad**. Es la convención de las specs 53 y 56.
- **Sí: tabla temporal `#liquidated` antes del `INSERT`.** El conteo del snapshot y las filas del desglose salen del mismo conjunto, así que no pueden diferir.
- **Sí: solo nómina operativa.** Las comisiones se pagan en efectivo según `reglas_modulo_nomina.md`, y la fiscal no tiene todavía tratamiento SAT del concepto.
- **Sí: dos columnas de comisión separadas en Procesar** ("Com. consultas" y "Com. onicomicosis"). Son conceptos distintos, cada uno con su propio conteo.
- **Sí: lista de tratamientos pagados en el detalle.** Sale directo del desglose y permite verificar de dónde salió el monto.
- **Sí: la sección de configuración vive en `/dashboard/nomina/comisiones`.** Es donde ya se administran las comisiones; una pantalla aparte para dos campos no se justifica.
- **No: tabla genérica de percepciones.** Con tres conceptos ya se está acercando al punto que la spec 56 señaló. Se deja para su propia spec, y estas columnas se migran igual que las de la 56.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| **Se paga un tratamiento que después se cancela o se reembolsa.** No hay descuento retroactivo. | Decisión explícita del usuario. El desglose del detalle deja visible qué tratamiento se pagó y cuándo, para resolverlo por fuera si hace falta. El reverso queda fuera de alcance, para su propia spec. |
| **Un tratamiento nunca comisiona** porque quien lo registró no estaba en la nómina operativa del periodo en que se liquidó (sin salario operativo, sin frecuencia, inactivo). | Es consecuencia de la regla, y queda dicho en el alcance y en `docs/nomina.md`. El empleado ya aparece en "excluidos" si le falta el salario; si se corrige y se recalcula ese periodo, cobra. |
| **Dos sucursales calculan al mismo tiempo** un periodo que cubre el mismo tratamiento (el empleado se movió de sucursal). | El `UNIQUE (id_tratamiento)` hace que el segundo `INSERT` falle, la transacción se revierte completa y `describePayrollCalculationError` muestra "Intenta de nuevo". Al reintentar, el `NOT EXISTS` lo salta. |
| **Doble pago al cambiar de sucursal**, como en la spec 56. | Aquí no aplica: el `UNIQUE` y el `NOT EXISTS` impiden pagar el mismo tratamiento en dos periodos, sin importar sucursal ni frecuencia. |
| **Se edita el total de un pago ya contado**, o se borra y recaptura, y la fecha de liquidación se mueve. | Si el tratamiento ya está en el desglose de un periodo, no se vuelve a pagar. Si todavía no, el siguiente cálculo usa los pagos vigentes. La fecha que se pagó queda congelada en `fecha_liquidacion`. |
| **Cambiar el umbral** mueve la fecha de liquidación de tratamientos aún no pagados, y alguno puede caer en un periodo ya calculado y quedar sin pagar. | Si el cambio adelanta la fecha hacia un periodo ya calculado, basta con recalcular ese periodo. El aviso del modal dice que el cambio aplica al siguiente cálculo, y la bitácora deja registrado cuándo se movió el umbral. |
| **La suma acumulada con `SUM() OVER` sobre toda la tabla de pagos** se vuelve lenta conforme crece. | La CTE filtra por tipo y `status`, y solo se evalúa para los tratamientos de usuarios vinculados. Si tarda, se agrega `IX_tratamiento_pagos_tipo ON [dbo].[Tratamiento_onicomicosis_pagos] ([id_tratamiento], [id_tratamiento_pago_tipo], [status]) INCLUDE ([created_at], [total])`, sin cambiar código. |
| **`Tratamiento_onicomicosis_pagos.total` con un tipo inesperado** (`money` o `varchar`, porque hoy se escribe con `String(total)`). | El paso 1 verifica el tipo real de la columna. Si no es numérico, la CTE agrega un `CAST(... AS decimal(12,2))` explícito, y hay un criterio de aceptación de suma exacta en el umbral. |
| **Snapshots viejos** que parecen "no comisionó onicomicosis". | Quedan en `0 / 0 / 0` por el `DEFAULT` y el detalle no muestra la línea, igual que hoy. Recalcular los llena, siempre que sus tratamientos no los haya tomado ya otro periodo. Queda dicho en `docs/nomina.md`. |
