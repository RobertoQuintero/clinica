# 90 — Pago de la PTU en nómina extraordinaria

## Header

- **Estado:** Implementado
- **Depende de:**
  - 52 (`nomina-periodos`): `payroll.periods`, código, estatus y el modal de periodo.
  - 53 (`nomina-calculo-salario`): `payroll.period_employees`, `calculatePayrollPeriod` y Procesar.
  - 54 (`nomina-detalle-percepciones-empleado`): Detalle por empleado y `buildPerceptionLines`.
  - 73 (`nomina-motor-gravado-exento`): el motor gravado/exento con acumulado anual. Aquí aplica el tope de 15 UMA por año.
  - 87 (`nomina-aguinaldo-extraordinaria`): el periodo `'E'`, la periodicidad 99, el ISR art. 174 RLISR (`period_employee_isr_article174`), la tarifa mensual, el aviso "Recalcula" del periodo E y el patrón del aviso de fecha límite.
  - 89 (`nomina-ptu-reparto`): `payroll.ptu_distributions` y `ptu_distribution_employees`. Solo se pagan repartos **cerrados**, cada fila con su `id_sucursal` y su `salario_diario_tope` congelados.
- **Modifica base de datos:** Sí.
  - `payroll.periods` gana `concepto_extraordinario` (`'A'` aguinaldo, `'P'` PTU), y el índice único del periodo E pasa a incluir el concepto.
  - Tabla nueva que liga cada fila fiscal del periodo PTU con su fila del reparto y congela el desglose de la PTU.
  - `CK_period_employees_montos` se relaja para aceptar filas PTU.
- **Fecha:** 2026-10-20
- **Objetivo:** Pagar la PTU de un reparto cerrado en una nómina extraordinaria fiscal por sucursal en el año de pago, con exento de 15 UMA anuales, ISR por el art. 174 RLISR y un aviso de la fecha límite (30-may para persona moral, 29-jun para persona física).

### Contexto (2026-10-20)

- La spec 89 calcula y cierra el reparto por empresa y ejercicio. Esta spec solo lo **paga**: no recalcula ningún monto del reparto.
- El periodo E de la spec 87 hoy es implícitamente "aguinaldo": un solo E por sucursal y año, y todas las ramas que preguntan `tipo_periodo = 'E'` asumen aguinaldo. Para que quepa la PTU, el periodo E necesita un concepto.
- El catálogo `payroll.perceptions` ya tiene la PTU (clave SAT 003, `'U'`, 15 UMA, periodicidad `'A'`), pero ningún cálculo la genera.
- El motor de la spec 73 y el ISR art. 174 de la spec 87 se reutilizan sin cambios en sus reglas. Solo cambia de dónde salen el importe y el ingreso ordinario.
- La spec 89 dejó pendiente bloquear "Reabrir" cuando un periodo PTU ya usa el reparto. Lo hace esta spec.
- La fecha límite viene de la LFT art. 122: 60 días después de la declaración anual. Para persona moral la declaración vence el 31-mar, así que la PTU se paga a más tardar el 30-may. Para persona física vence el 30-abr y la PTU se paga a más tardar el 29-jun.

## Alcance

**Entra:**

- **Concepto del periodo extraordinario.**
  - `payroll.periods` gana `concepto_extraordinario`: `'A'` aguinaldo, `'P'` PTU. Es `NULL` en los periodos `'O'` y obligatorio en los `'E'`, y lo garantiza un `CHECK`.
  - Los periodos E existentes quedan en `'A'`.
  - El índice único pasa a ser **un periodo E por sucursal, ejercicio y concepto**.
  - El código sigue siendo `NOM-{año}-E{NN}`, con el consecutivo compartido entre los dos conceptos.
  - Todo lo que hoy asume "E = aguinaldo" pasa a preguntar por el concepto: el cálculo, Procesar, el Detalle, el aviso del 20-dic y el aviso "Recalcula".
- **Crear el periodo PTU.** El modal de Periodos cambia su selector a **Ordinaria | Aguinaldo | PTU**. En PTU:
  - se elige el **año de pago**, y el reparto que se paga es el de la empresa con `ejercicio = año − 1`;
  - `fecha_inicio` = 1-ene y `fecha_fin` = 31-dic del año de pago, fijas y no editables;
  - `fecha_pago` se sugiere en la fecha límite del `tipo_persona` del reparto (30-may o 29-jun) y es editable. `fecha_corte` = `fecha_pago`, también editable;
  - si `fecha_pago` cae después de la fecha límite, sale una advertencia ámbar que **no bloquea** el guardado;
  - **precondición:** debe existir el reparto **cerrado** del año − 1, con al menos una fila de la sucursal con `ptu_final > 0`. Si no, los mensajes son "Cierra primero el reparto de PTU {año−1}" o "Nadie de esta sucursal cobra PTU {año−1}";
  - editar y eliminar siguen las reglas actuales: solo en estatus 1, y en un periodo E solo cambian `fecha_pago` y `fecha_corte`.
- **Listado de Periodos.** El badge distingue "Aguinaldo" de "PTU".
- **Calcular el periodo PTU** (una rama nueva para `concepto_extraordinario = 'P'`):
  - **Quién entra:** las filas del reparto cerrado de la empresa del año − 1 cuyo `id_sucursal` congelado es la sucursal del periodo y que tienen `ptu_final > 0`. Entran **también los dados de baja**. No importan el estatus, la frecuencia ni la sucursal actual del empleado.
  - **Solo filas fiscales (`'F'`).** No se genera ninguna fila operativa.
  - **Importe** = `ptu_final` del reparto, tal cual. Se congela el desglose: días, PTU por días, PTU por salario, bruto, tope aplicado y final.
  - **Pago único:** cada fila del reparto se puede pagar una sola vez en toda la historia (`UNIQUE`).
  - El periodo PTU **no genera ningún otro concepto**.
- **Fiscal.**
  - Una línea de percepción **PTU (clave 003)** pasa por el motor de la spec 73: exento hasta 15 UMA **por año** de `fecha_fin` (el año de pago), acumulado entre periodos, y gravado el excedente.
  - **ISR por el art. 174 RLISR** sobre el gravado, con la tarifa mensual del año de pago e ingreso ordinario mensual = `ROUND(salario_diario_tope × 30.4, 2)`, donde `salario_diario_tope` es el congelado en la fila del reparto.
  - Sin subsidio al empleo. Se reutilizan `period_employee_isr_article174`, la deducción `id_deduction = 2` y los motivos "No calculado" de la spec 87.
- **Candado sobre el reparto.** "Reabrir" un reparto se rechaza mientras algún periodo PTU calculado (estatus ≥ 2) tenga filas ligadas a él, con el mensaje "El reparto ya se usa en la nómina {código} de {sucursal}". "Revertir" ese periodo lo libera.
- **Procesar con un periodo PTU.**
  - Se oculta el toggle Operativa/Fiscal y se fuerza `tipo=fiscal`.
  - Columnas: Días, PTU por días, PTU por salario, PTU (con marca "Topado" si `ptu_final < ptu_bruto`), Gravado, Exento, ISR y Neto.
  - Las tarjetas de resumen y el pie suman lo mismo que las filas. Se reutiliza el aviso de ISR no calculado.
- **Detalle con un periodo PTU.**
  - Línea "PTU {año−1}" con "Por días $X + por salario $Y = $Z". Cuando hubo tope, la nota dice "Topada a $W ({tope de 3 meses | promedio de 3 años})".
  - Se muestran el gravado/exento con su regla y la tarjeta del art. 174 ya existente.
  - Se ocultan las listas de periodo ordinario.
- **Aviso de fecha límite de la PTU** (en Periodos y Procesar). Aparece cuando la empresa tiene el reparto del año − 1 **cerrado**, la sucursal tiene filas con `ptu_final > 0` y todavía **no creó** su periodo PTU del año:
  - en ámbar desde 30 días antes ("PTU {año−1}: debe pagarse a más tardar el {30 de mayo | 29 de junio}"), es decir, desde el 30-abr para persona moral y desde el 30-may para persona física;
  - en rojo desde el día siguiente a la fecha límite ("venció el …");
  - sin reparto cerrado no hay aviso.
- **Aviso "Recalcula" del periodo E generalizado.** `isChristmasBonusRecalculationNeeded` pasa a cubrir ambos conceptos. En PTU compara el art. 174 de hoy con el guardado (tarifa mensual). El aviso de exento de la spec 73 se reutiliza tal cual.
- **Script de datos idempotente** (`THROW 50090`): confirma que hay exactamente una percepción `clave_sat = '003'`, `'U'`, 15 UMA, `'A'`, y su id queda en `PTU_PERCEPTION_ID`.
- **Permisos y validación:** roles 1 y 4 (los tres candados de siempre) y `zod` en todas las entradas.
- **Documentación:** `docs/nomina.md` y el DDL en `queries.txt`.

**Fuera de alcance:**

- Recalcular, editar o ajustar a mano montos del reparto desde el periodo. Lo que se paga es el `ptu_final` cerrado.
- PTU en la nómina operativa.
- Pagar en varias exhibiciones o repartir el pago de un trabajador entre sucursales. Cobra todo en la sucursal congelada.
- **PTU no cobrada:** marcar como no cobrado lo de un trabajador que no se presentó y llevarlo al reparto siguiente. Sigue capturándose a mano en la spec 89.
- Pagar a los dados de baja fuera de la nómina, o en un finiquito (spec 88).
- Subsidio al empleo, IMSS (la PTU no integra al SBC) e ISN de CDMX.
- Timbrado del CFDI extraordinario, recibos y dispersión. (Aprobada/Pagada: construido en la spec 94.)
- Bloquear una `fecha_pago` posterior a la fecha límite (solo se advierte).
- Avisar cuando no existe un reparto cerrado, por ejemplo una empresa sin utilidades.
- Cambiar las reglas del aguinaldo: la spec 87 solo se adapta al nuevo concepto.

## Modelo de datos

### SQL (DDL en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 89)

```sql
-- Spec 90: concepto del periodo extraordinario. Los E existentes son aguinaldo.
ALTER TABLE [payroll].[periods] ADD [concepto_extraordinario] [char](1) NULL;
GO
UPDATE [payroll].[periods] SET [concepto_extraordinario] = 'A' WHERE [tipo_periodo] = 'E';
GO
ALTER TABLE [payroll].[periods] ADD CONSTRAINT [CK_periods_concepto_extraordinario] CHECK (
    ([tipo_periodo] = 'O' AND [concepto_extraordinario] IS NULL)
 OR ([tipo_periodo] = 'E' AND [concepto_extraordinario] IS NOT NULL
                          AND [concepto_extraordinario] IN ('A','P')));
GO
-- Un periodo E por sucursal, ejercicio y concepto (también se revisa en la transacción de alta).
DROP INDEX [UX_periods_extraordinaria_sucursal_ejercicio] ON [payroll].[periods];
GO
CREATE UNIQUE NONCLUSTERED INDEX [UX_periods_extraordinaria_sucursal_ejercicio_concepto]
    ON [payroll].[periods] ([id_sucursal], [ejercicio], [concepto_extraordinario])
    WHERE [tipo_periodo] = 'E';
GO

-- Importe de PTU en el snapshot. En cualquier fila que no sea PTU, siempre 0.
ALTER TABLE [payroll].[period_employees] ADD
    [importe_ptu] [decimal](18,2) NOT NULL CONSTRAINT [DF_period_employees_importe_ptu] DEFAULT (0);
GO
ALTER TABLE [payroll].[period_employees] DROP CONSTRAINT [CK_period_employees_montos];
GO
ALTER TABLE [payroll].[period_employees] ADD CONSTRAINT [CK_period_employees_montos] CHECK (
    [salario_diario] > 0 AND [importe_salario] >= 0 AND [importe_ptu] >= 0
    AND ([dias] > 0
      OR ([dias] = 0 AND [importe_salario] = 0
          AND ([dias_aguinaldo] > 0 OR [importe_ptu] > 0))));
GO

-- Liga cada fila 'F' de un periodo PTU con su fila del reparto y congela el desglose.
-- El UNIQUE sobre la fila del reparto hace que se pague una sola vez en toda la historia.
CREATE TABLE [payroll].[period_employee_ptu](
    [id_period_employee]            [int]           NOT NULL,
    [id_ptu_distribution_employee]  [int]           NOT NULL,
    [id_ptu_distribution]           [int]           NOT NULL,
    [ejercicio_reparto]             [smallint]      NOT NULL,   -- año de las utilidades (año del periodo − 1)
    [dias]                          [smallint]      NOT NULL,
    [ptu_dias]                      [decimal](18,2) NOT NULL,
    [ptu_salario]                   [decimal](18,2) NOT NULL,
    [ptu_bruto]                     [decimal](18,2) NOT NULL,
    [tope_tres_meses]               [decimal](18,2) NOT NULL,
    [promedio_tres_anios]           [decimal](18,2) NULL,
    [anios_promedio]                [tinyint]       NULL,
    [ptu_final]                     [decimal](18,2) NOT NULL,
 CONSTRAINT [PK_period_employee_ptu] PRIMARY KEY CLUSTERED ([id_period_employee] ASC),
 CONSTRAINT [UQ_period_employee_ptu_distribution_employee] UNIQUE ([id_ptu_distribution_employee]),
 CONSTRAINT [FK_period_employee_ptu_row] FOREIGN KEY ([id_period_employee])
     REFERENCES [payroll].[period_employees] ([id_period_employee]) ON DELETE CASCADE,
 CONSTRAINT [FK_period_employee_ptu_distribution_employee] FOREIGN KEY ([id_ptu_distribution_employee])
     REFERENCES [payroll].[ptu_distribution_employees] ([id_ptu_distribution_employee]),
 CONSTRAINT [FK_period_employee_ptu_distribution] FOREIGN KEY ([id_ptu_distribution])
     REFERENCES [payroll].[ptu_distributions] ([id_ptu_distribution]),
 CONSTRAINT [CK_period_employee_ptu] CHECK (
     [ptu_final] > 0
     AND [ptu_bruto] = [ptu_dias] + [ptu_salario]
     AND [ptu_final] <= [ptu_bruto]
     AND ([promedio_tres_anios] IS NULL OR [anios_promedio] IS NOT NULL))
) ON [PRIMARY]
GO
```

Script de datos idempotente (mismo patrón que las specs 78 y 87; `THROW 50090`):

- Confirma que el catálogo tiene **exactamente una** percepción con `clave_sat = '003'`, `tipo_limite_exencion = 'U'`, `umas_limite = 15` y `periodicidad_limite = 'A'`. Su id queda en `PTU_PERCEPTION_ID`. Si no hay exactamente una, detiene el script.

**Sin DDL:**

- El ISR se guarda en `period_employee_isr_article174` y en `period_employee_deductions` (`id_deduction = 2`), igual que en la spec 87.
- El bloqueo de "Reabrir" del reparto es una consulta: `EXISTS` sobre `period_employee_ptu` con `id_ptu_distribution`.

### En las filas de un periodo PTU

- Solo existen filas `'F'`.
- `dias`, `dias_falta`, `importe_salario`, `dias_aguinaldo`, `importe_aguinaldo` y todos los conceptos ordinarios quedan en 0.
- `salario_diario` = el `salario_diario_tope` de la fila del reparto. Es la base del ingreso ordinario del art. 174 (`ROUND(× 30.4, 2)`), y así el SQL de la spec 87 (`isrArticle174Sql.ts`, que lee `pe.salario_diario`) se usa sin cambios.
- `importe_ptu` = `ptu_final`. Los días de la PTU viven en `period_employee_ptu.dias`, no en `period_employees.dias`.
- `isr_estado` = `'X'`. Cada fila tiene una percepción PTU en `period_employee_perceptions`, una fila en `period_employee_isr_article174` y una en `period_employee_ptu`.
- **Salario diario tope en 0:** si alguna fila pagable del reparto tiene `salario_diario_tope = 0`, "Calcular" **no corre** y responde "El reparto de PTU {año−1} tiene trabajadores sin salario diario tope: {nombres}. Reábrelo, corrígelo y ciérralo de nuevo". Como el periodo todavía no está calculado, reabrir el reparto se permite.

### TypeScript

- `interfaces/payroll_period.ts`:
  - `export type ExtraordinaryConcept = "A" | "P";`
  - `IPayrollPeriod` gana `concepto_extraordinario: ExtraordinaryConcept | null`.
- El tipo del snapshot de Procesar y Detalle gana `importe_ptu: number` y `ptu: IPtuPaymentBreakdown | null`.
- `interfaces/payroll_ptu.ts` gana:

```ts
export interface IPtuPaymentBreakdown {
  id_ptu_distribution: number;
  ejercicio_reparto: number;
  dias: number;
  ptu_dias: number;
  ptu_salario: number;
  ptu_bruto: number;
  tope_tres_meses: number;
  promedio_tres_anios: number | null;
  anios_promedio: number | null;
  ptu_final: number;
}

export type PtuPaymentDeadlineState = "none" | "upcoming" | "overdue";
```

### Constantes (`lib/payroll/constants.ts`)

```ts
export const EXTRAORDINARY_CONCEPT_LABELS: Record<ExtraordinaryConcept, string> = {
  A: "Aguinaldo",
  P: "PTU",
};
// PAYROLL_PERIOD_TYPE_LABELS.E pasa de "Extraordinaria (aguinaldo)" a "Extraordinaria".

export const PTU_PERCEPTION_ID = /* id confirmado por el script */;
export const PTU_PERCEPTION_SAT_KEY = "003";
export const PTU_PAYMENT_DEADLINE_MONTH_DAY: Record<PtuTaxpayerType, string> = {
  M: "05-30",   // 60 días después del 31-mar (declaración de persona moral)
  F: "06-29",   // 60 días después del 30-abr (declaración de persona física)
};
export const PTU_PAYMENT_WARNING_DAYS = 30;
```

`PERCEPTION_LINE_KEY_BY_ID` gana `[PTU_PERCEPTION_ID]: "ptu"`.

### Módulos nuevos o cambiados (`lib/payroll/`)

| Archivo | Tipo | Contenido |
|---|---|---|
| `ptuPaymentSql.ts` (nuevo) | `server-only` | `PTU_PAYMENT_SNAPSHOT_SQL`: inserta las filas `'F'` desde el reparto cerrado y `period_employee_ptu`, y llena `#fiscal_perception_lines` con la línea PTU |
| `ptuPaymentSource.ts` (nuevo) | `server-only` | `loadPtuPaymentSource(id_empresa, id_sucursal, paymentYear)`: reparto cerrado del año − 1, `tipo_persona`, filas pagables de la sucursal y filas con tope 0. Lo usan el alta del periodo, el cálculo y el aviso |
| `ptuPaymentDeadline.ts` (nuevo) | puro | `getPtuPaymentDeadline(paymentYear, taxpayerType)` → `"YYYY-MM-DD"` y `getPtuPaymentDeadlineState(today, deadline, hasPtuPeriod)` → `PtuPaymentDeadlineState` |
| `christmasBonusRecalculation.ts` → `extraordinaryRecalculation.ts` | `server-only` | `isExtraordinaryRecalculationNeeded(id_period)`. Aguinaldo: igual que hoy. PTU: solo compara el art. 174 de hoy contra el guardado |
| `perceptionLines.ts` | puro | `buildPerceptionLines` gana la rama PTU (línea `ptu` con su fórmula y la nota del tope) |
| `schemas.ts` | — | La rama `'E'` de las uniones gana `concepto_extraordinario: "A" \| "P"` |

### Convenciones

- **Año del reparto** = `ejercicio` del periodo PTU − 1. **Empresa** = la de la sucursal del periodo (`sucursales.id_empresa`), nunca la del cliente.
- **Fecha límite** = `{año de pago}-{PTU_PAYMENT_DEADLINE_MONTH_DAY[tipo_persona]}`. El aviso ámbar empieza en fecha límite − 30 días: 30-abr para persona moral y 30-may para persona física.
- El exento, el acumulado anual y la tarifa del ISR usan `YEAR(fecha_fin)` = el año de pago, sin cambios en el motor.
- Todas las fechas viajan como strings `"YYYY-MM-DD"`, y "hoy" sale de `addZeroToday(new Date())`.

## Plan de implementación

1. **DDL y script de datos.**
   - Se agregan a `queries.txt`, en el bloque `NOMINA PAYROLL` después de la spec 89:
     - `concepto_extraordinario` con su `CHECK`, el relleno de los E existentes y el cambio de índice único;
     - `importe_ptu` y el nuevo `CK_period_employees_montos`;
     - la tabla `period_employee_ptu`;
     - el script idempotente (`THROW 50090`) que confirma la percepción 003.
   - Se ejecuta contra la base de desarrollo.
   - *Verificación:*
     - Todos los periodos E existentes quedan en `'A'` y los ordinarios en `NULL`.
     - Insertar a mano un periodo `'O'` con concepto, o uno `'E'` sin concepto, falla por `CK_periods_concepto_extraordinario`.
     - En la misma sucursal y año, un segundo E `'A'` falla por el índice, pero un E `'P'` sí entra.
     - Correr el script dos veces no cambia nada la segunda vez.

2. **Tipos, constantes, lógica pura y adaptación del aguinaldo al concepto, sin UI nueva.**
   - `ExtraordinaryConcept`, `IPtuPaymentBreakdown`, las constantes de la spec y `lib/payroll/ptuPaymentDeadline.ts`.
   - `PERIOD_ROW_SELECT` y las lecturas de periodos devuelven `concepto_extraordinario`.
   - Todo lo que hoy significa "E = aguinaldo" pasa a filtrar por `concepto_extraordinario = 'A'`:
     - la revisión de duplicado en `createPayrollPeriod`;
     - `ChristmasBonusDeadlineNotice`;
     - la bifurcación de `calculatePayrollPeriod`, de Procesar y del Detalle.
   - *Verificación:*
     - `npx tsc --noEmit` y `npm run lint` quedan limpios.
     - Un periodo de aguinaldo se crea, calcula, muestra y revierte igual que antes, y su snapshot es idéntico antes y después del cambio.
     - Con un script temporal en el scratchpad, para el año de pago 2027:
       - persona moral: 29-abr → `none`, 30-abr → `upcoming`, 30-may → `upcoming`, 31-may → `overdue`;
       - persona física: 29-may → `none`, 30-may → `upcoming`, 29-jun → `upcoming`, 30-jun → `overdue`;
       - con periodo PTU creado → `none`.

3. **Crear y administrar el periodo PTU, todavía sin cálculo.**
   - `lib/payroll/ptuPaymentSource.ts` (`loadPtuPaymentSource`).
   - `createPayrollPeriod` con `'E'` / `'P'`:
     - resuelve la periodicidad 99 y fija 1-ene / 31-dic del año de pago;
     - genera `NOM-{año}-E{NN}` con el consecutivo compartido;
     - dentro de la transacción (`UPDLOCK, HOLDLOCK`) revisa el duplicado ("Ya existe la nómina de PTU de {año}", también si salta el índice) y la precondición ("Cierra primero el reparto de PTU {año−1}" o "Nadie de esta sucursal cobra PTU {año−1}").
   - `PayrollPeriodModal`:
     - selector **Ordinaria | Aguinaldo | PTU**;
     - en PTU: año de pago, fechas de inicio y fin de solo lectura, y pago sugerido en la fecha límite según el `tipo_persona` del reparto;
     - advertencia ámbar si el pago cae después de la fecha límite, sin bloquear.
   - El badge de `PayrollPeriodsTable` muestra "Aguinaldo" o "PTU".
   - `calculatePayrollPeriod` responde `{ ok: false, message: "El cálculo de la PTU aún no está disponible" }` para `'P'`.
   - Se usa `frontend-design` para el modal.
   - *Verificación:*
     - Con el reparto 2026 cerrado y filas pagables en la sucursal, se crea el periodo PTU 2027, que sugiere el 30-may (moral) o el 29-jun (física).
     - Sin reparto cerrado, o sin filas de la sucursal, sale el mensaje correspondiente.
     - Un segundo periodo PTU 2027 en la misma sucursal se rechaza.
     - Editar el pago a una fecha posterior a la fecha límite guarda y muestra la advertencia.
     - El periodo PTU no aparece en Horas extra, Faltas, Retardos ni Bonos.

4. **Cálculo del periodo PTU: snapshot y gravado/exento, sin ISR.**
   - `lib/payroll/ptuPaymentSql.ts`. La rama `'P'` de `calculatePayrollPeriod` corre en un solo batch con `BEGIN TRAN`:
     - lee el periodo y el reparto `WITH (UPDLOCK, HOLDLOCK)` y exige `estado = 'C'`;
     - si alguna fila pagable tiene `salario_diario_tope = 0`, aborta con el mensaje que lista los nombres;
     - borra el snapshot;
     - inserta las filas `'F'` (`salario_diario` = tope, `importe_ptu` = `ptu_final`, todo lo demás en 0, `isr_estado = 'X'`) y `period_employee_ptu`;
     - llena `#fiscal_perception_lines` con la línea PTU y la pasa por el motor de la spec 73 sin cambios.
   - Si choca con `UQ_period_employee_ptu_distribution_employee`, el mensaje es "Alguno de estos trabajadores ya cobró la PTU de {año−1}".
   - *Verificación:* con el caso de referencia de la spec 89 cargado y cerrado (A, B y C en la sucursal del periodo):
     - quedan 3 filas, con **$34,523.80**, **$27,000.00** y **$38,095.23**, y con su desglose congelado;
     - D y E no entran;
     - el exento de cada fila es `min(importe, ROUND(15 × UMA_DIARIA, 2))` y el gravado es el resto;
     - un dado de baja con fila pagable sí entra;
     - un trabajador con tope 0 bloquea el cálculo con su nombre;
     - "Revertir" regresa el periodo a estatus 1 sin filas, y volver a calcular no choca con el `UNIQUE`.

5. **ISR art. 174 en la rama PTU.**
   - Después de las percepciones se reutilizan `isrArticle174Sql.ts` sin cambios y los `INSERT` en `period_employee_isr_article174` y en `period_employee_deductions` (solo filas `'C'`), igual que en la rama de aguinaldo.
   - *Verificación:*
     - Para A, B y C, el desglose guardado coincide al centavo con `calculateArticle174Isr(gravado, false, salario_diario_tope, tarifa mensual 2027)`.
     - El ingreso ordinario guardado es `ROUND(salario_diario_tope × 30.4, 2)`.
     - Sin tarifa mensual de 2027, las filas quedan en `'N'` / `no_monthly_withholding_table` y el periodo se calcula de todos modos.

6. **Candado de "Reabrir" en el reparto.**
   - `reopenPtuDistribution` (`nomina/ptu/actions.ts`), dentro de la transacción que ya bloquea el reparto, rechaza la reapertura si existe alguna fila en `period_employee_ptu` con su `id_ptu_distribution`. El mensaje es "El reparto ya se usa en la nómina {código} de {sucursal}. Revierte ese cálculo para reabrirlo".
   - En la vista del reparto, `PtuDistributionStatusActions` muestra el botón deshabilitado con ese motivo.
   - *Verificación:*
     - Con el periodo PTU calculado, reabrir falla, también desde una pestaña vieja.
     - Después de revertir el periodo, reabrir funciona.
     - Con el periodo PTU solo creado (estatus 1), reabrir funciona.

7. **Procesar con un periodo PTU.**
   - `getPayrollProcessPage` devuelve `concepto_extraordinario`, `importe_ptu` y el desglose PTU.
   - Para un periodo `'P'`, `page.tsx` fuerza `tipo=fiscal` y `PayrollProcessToolbar` oculta el toggle.
   - `PtuPaymentEmployeesTable` es un Server Component nuevo con las columnas Días, PTU por días, PTU por salario, PTU (con marca "Topado"), Gravado, Exento, ISR y Neto. `PayrollProcessSummaryCards` gana las tarjetas "Total de PTU", "ISR retenido" y "Neto a pagar".
   - `IsrNotCalculatedNotice` se reutiliza con los motivos del art. 174.
   - Se usa `frontend-design`.
   - *Verificación:*
     - Las tarjetas y el pie suman lo mismo que las filas.
     - Con `?tipo=operativa` en la URL se ve la fiscal.
     - Un periodo ordinario y uno de aguinaldo se ven exactamente igual que antes.

8. **Detalle con un periodo PTU.**
   - `buildPerceptionLines` genera solo la línea `ptu`:
     - "PTU {año−1}" con "Por días $X + por salario $Y = $Z";
     - si `ptu_final < ptu_bruto`, la nota "Topada a $W (tope de 3 meses | promedio de 3 años)", eligiendo el mayor de los dos como en la spec 89.
   - Se reutilizan `PayrollPerceptionsCard` (gravado/exento) y `PayrollArticle174IsrCard`, y se ocultan las listas de periodo ordinario.
   - Se usa `frontend-design`.
   - *Verificación:*
     - El Detalle de A muestra $16,666.66 + $17,857.14 = $34,523.80, sin nota de tope.
     - El de B muestra la nota "Topada a $27,000.00 (tope de 3 meses)".
     - El desglose del art. 174 coincide con la tabla.

9. **Avisos.**
   - `PtuPaymentDeadlineNotice` es un Server Component en `nomina/componentes/` y se muestra en Periodos y Procesar. Usa `loadPtuPaymentSource` y `getPtuPaymentDeadlineState(addZeroToday(new Date()), …)`: ámbar en `upcoming`, rojo en `overdue` y oculto en `none`. La parte visual reutiliza `ChristmasBonusDeadlineBanner`, generalizándola para recibir el texto si hoy lo tiene fijo.
   - `christmasBonusRecalculation.ts` se renombra a `extraordinaryRecalculation.ts` (`isExtraordinaryRecalculationNeeded`). En PTU solo compara el art. 174 de hoy contra el guardado. Procesar lo muestra con `PayrollRecalculationNotice`.
   - *Verificación:*
     - Con la fecha simulada en el helper: persona moral, 30-abr-2027 sin periodo PTU → ámbar; 31-may → rojo; al crear el periodo, el aviso desaparece.
     - Sin reparto cerrado de 2026, no hay aviso en ninguna fecha.
     - Editar un tramo de la tarifa mensual 2027 con el periodo PTU calculado dispara "Recalcula", y recalcular lo quita.

10. **Documentación.**
    - `docs/nomina.md` gana la sección "PTU: pago (spec 90)" y actualiza:
      - la lista de conceptos;
      - la sección `payroll.periods` (concepto);
      - "Aguinaldo (spec 87)", que ahora es el concepto `'A'`;
      - el "Out of scope" de las specs 69, 73, 87 y 89;
      - el ciclo de vida del reparto (el candado de "Reabrir");
      - la sección UI.
    - *Verificación:* el DDL de `queries.txt` coincide con lo ejecutado, y `tsc` y `lint` quedan limpios.

## Criterios de aceptación

**Periodo extraordinario y concepto**

- [x] Todos los periodos E existentes quedan con `concepto_extraordinario = 'A'` y los ordinarios con `NULL`. Un `'O'` con concepto o un `'E'` sin concepto se rechaza en la base.
- [x] Un periodo de aguinaldo se crea, calcula, muestra y revierte igual que antes, y su snapshot es idéntico antes y después de la spec.
- [x] En la misma sucursal y año pueden convivir un periodo E de aguinaldo y uno de PTU. Un segundo periodo PTU se rechaza con "Ya existe la nómina de PTU de {año}".
- [x] El código del periodo PTU es `NOM-{año}-E{NN}`, con consecutivo compartido con el aguinaldo del mismo año.
- [x] El modal ofrece **Ordinaria | Aguinaldo | PTU**. En PTU, `fecha_inicio` es 1-ene y `fecha_fin` 31-dic del año de pago, y ninguna de las dos se puede editar.
- [x] La `fecha_pago` sugerida es el 30-may si el reparto es de persona moral y el 29-jun si es de persona física. Una fecha posterior se guarda y muestra la advertencia ámbar.
- [x] Sin reparto cerrado del año − 1, el alta se rechaza con "Cierra primero el reparto de PTU {año−1}". Si la sucursal no tiene filas con `ptu_final > 0`, se rechaza con "Nadie de esta sucursal cobra PTU {año−1}".
- [x] El listado distingue con su badge los periodos "Aguinaldo" y "PTU". Horas extra, Faltas, Retardos y Bonos no listan ninguno de los dos.

**Cálculo**

- [x] Entran exactamente las filas del reparto cerrado del año − 1 cuyo `id_sucursal` congelado es la sucursal del periodo y que tienen `ptu_final > 0`, dados de baja incluidos. Nadie más entra.
- [x] Solo se generan filas `'F'`; el periodo PTU no tiene filas operativas.
- [x] `importe_ptu` = `ptu_final` del reparto, y `period_employee_ptu` congela días, PTU por días, PTU por salario, bruto, tope de 3 meses, promedio y final, iguales al reparto.
- [x] Con el caso de referencia de la spec 89, el periodo tiene exactamente A **$34,523.80**, B **$27,000.00** y C **$38,095.23**, y D y E no aparecen.
- [x] Las filas PTU tienen en 0 sueldo, días, faltas, aguinaldo, comisiones, bonos, horas extra y vacaciones.
- [x] Cada fila tiene una percepción clave 003 con exento = `min(importe, 15 × UMA_DIARIA − exento previo del año de pago)` y gravado = importe − exento, y los dos suman el importe al centavo.
- [x] El ISR art. 174 guardado coincide al centavo con `calculateArticle174Isr`, usando como ingreso ordinario `ROUND(salario_diario_tope × 30.4, 2)` y la tarifa mensual del año de pago.
- [x] No se aplica subsidio al empleo. Sin tarifa mensual del año, las filas quedan en "No calculado: No hay tarifa mensual de ISR para el año" y sin deducción.
- [x] Una fila `'C'` tiene exactamente una deducción ISR (`id_deduction = 2`), aunque sea 0, y neto = PTU − ISR.
- [x] Si alguna fila pagable tiene `salario_diario_tope = 0`, "Calcular" no escribe nada y lista los nombres.
- [x] Una fila del reparto no puede quedar pagada en dos periodos: el `UNIQUE` lo rechaza con "Alguno de estos trabajadores ya cobró la PTU de {año−1}".
- [x] "Revertir" borra el snapshot, las percepciones, el art. 174, las deducciones y `period_employee_ptu`, y regresa el periodo a estatus 1.

**Candado del reparto**

- [x] Con un periodo PTU calculado (estatus ≥ 2) que use el reparto, "Reabrir" se rechaza, también desde una pestaña vieja, con un mensaje que nombra el periodo y la sucursal. La vista muestra el botón deshabilitado con ese motivo.
- [x] Con el periodo solo creado (estatus 1), o después de revertirlo, "Reabrir" funciona.

**Pantallas**

- [x] En Procesar, un periodo PTU siempre muestra la fiscal, aunque la URL diga `tipo=operativa`, y no muestra el toggle.
- [x] La tabla PTU muestra Días, PTU por días, PTU por salario, PTU (con "Topado" cuando `ptu_final < ptu_bruto`), Gravado, Exento, ISR y Neto. Las tarjetas y el pie suman lo mismo que las filas.
- [x] Los periodos ordinarios y de aguinaldo se ven en Procesar y en el Detalle exactamente igual que antes.
- [x] El Detalle PTU muestra "PTU {año−1}" con "Por días $X + por salario $Y = $Z", la nota "Topada a $W (…)" solo cuando hubo tope, el gravado/exento y la tarjeta del art. 174. No muestra las listas de periodo ordinario.

**Avisos**

- [x] Con el reparto del año − 1 cerrado, filas pagables en la sucursal y sin periodo PTU creado, Periodos y Procesar muestran:
  - en ámbar, desde el 30-abr (persona moral) o el 30-may (persona física) hasta la fecha límite;
  - en rojo, desde el día siguiente a la fecha límite.
- [x] Antes de la ventana, con el periodo PTU creado o sin reparto cerrado, no hay aviso de PTU.
- [ ] El aviso del 20-dic del aguinaldo solo considera periodos `'A'`: crear el periodo PTU no lo quita.
- [ ] En estatus 2, "Recalcula" aparece en el periodo PTU si cambió la tarifa mensual que usó el art. 174, o la UMA o la regla del catálogo (aviso de exento), y recalcular lo quita.

**Calidad**

- [x] Todas las acciones nuevas o modificadas pasan por `assertPayrollAccess()` y validan con `zod`. Un rol distinto de 1 y 4 recibe `{ ok: false }`.
- [x] La empresa y la sucursal salen de la sesión, nunca del cliente.
- [x] Ninguna fecha viaja como `Date`.
- [x] Las páginas siguen siendo Server Components, y `PtuPaymentEmployeesTable` y `PtuPaymentDeadlineNotice` también.
- [x] `npx tsc --noEmit` y `npm run lint` pasan sin errores.
- [x] `docs/nomina.md` y `queries.txt` quedan actualizados.

## Decisiones

**Tomadas**

| Decisión | Por qué |
|---|---|
| `concepto_extraordinario` (`'A'` / `'P'`) en `payroll.periods`, en lugar de un `tipo_periodo` nuevo | El tipo dice qué nómina es (periodicidad 99, CFDI extraordinario) y el concepto dice qué se paga. La spec 87 ya preveía que la PTU usara el mismo tipo. |
| Índice único por sucursal, ejercicio y concepto | Aguinaldo y PTU conviven en el mismo año, y cada uno sigue siendo uno por sucursal. |
| Código `NOM-{año}-E{NN}` con consecutivo compartido | La letra identifica el tipo, no el concepto (decisión de la spec 87). El badge distingue el concepto. |
| `ejercicio` del periodo = año de pago; reparto = año − 1 | La PTU se paga al año siguiente de las utilidades, y el exento y el ISR son del año en que se paga. |
| Fechas fijas 1-ene / 31-dic del año de pago | Reutiliza `CK_periods_extraordinaria_fechas`. El motor de la spec 73 acumula por `YEAR(fecha_fin)` y el art. 174 toma la tarifa de ese año, sin cambios. |
| Solo nómina fiscal, con el toggle oculto en Procesar | El reparto es fiscal (spec 89). Una operativa vacía solo confundiría. |
| Importe = `ptu_final` del reparto cerrado, sin recalcular | El reparto es el contrato. El periodo solo lo paga y congela su desglose. |
| Los dados de baja cobran en la nómina PTU de su sucursal congelada | Tienen derecho por los días trabajados, y el sistema no tiene otra vía de pago. |
| Se paga en la sucursal congelada al cerrar el reparto, no en la actual | Es una sola fuente, estable y conocida antes de calcular. La spec 89 la congela para esto. |
| Ingreso ordinario del art. 174 = `salario_diario_tope` del reparto × 30.4 | Existe para todos, incluidos los dados de baja, y es el último salario fiscal del ejercicio. Es reproducible y no dispara "Recalcula" por aumentos posteriores. |
| `snapshot.salario_diario` = `salario_diario_tope` | El SQL del art. 174 de la spec 87 lee `pe.salario_diario`, así que se reutiliza sin tocarlo. |
| Bloquear "Calcular" si alguna fila pagable tiene tope 0 | Evita relajar `salario_diario > 0` y un art. 174 con ordinario 0. Corregirlo en el reparto es posible porque todavía no está bloqueado. |
| Tabla propia `period_employee_ptu`, con `UNIQUE` sobre la fila del reparto | Liga el pago con su origen, congela el desglose para el Detalle y garantiza el pago único (patrón de la spec 57). |
| `importe_ptu` en `period_employees` | Mismo patrón que `importe_aguinaldo`. Procesar suma desde el snapshot y el `CHECK` lo usa. |
| "Reabrir" el reparto se bloquea solo con un periodo PTU **calculado** | Crear el periodo no toma datos del reparto. Revertir lo libera. Desde la spec 94, en estatus 3 ya no se puede revertir sin desaprobar antes, y en 4 nunca. |
| Exigir el reparto cerrado y filas pagables de la sucursal al **crear** el periodo | Evita periodos vacíos en la lista. "Calcular" revisa lo mismo otra vez. |
| `fecha_pago` sugerida en la fecha límite; una posterior solo advierte | Pagar tarde es una multa, no algo imposible. Mismo criterio que el aguinaldo. |
| Fecha límite por `tipo_persona` del reparto: 30-may (moral) y 29-jun (física) | LFT art. 122: 60 días después de la declaración anual (31-mar / 30-abr). El dato ya se captura en la spec 89. |
| Aviso de fecha límite desde 30 días antes y solo con reparto cerrado | Mismo patrón que el aguinaldo. Una empresa sin utilidades no puede cerrar un reparto, y el aviso quedaría rojo para siempre. |
| Selector plano Ordinaria \| Aguinaldo \| PTU | Es un clic menos, y cada opción tiene fechas y reglas propias. |
| Generalizar el aviso "Recalcula" del periodo E y renombrarlo a `extraordinaryRecalculation.ts` | La comparación del art. 174 es la misma, y el nombre viejo engañaría. |
| Script de datos que confirma la percepción 003 (`THROW 50090`) | Mismo patrón que las specs 78 y 87: el id del catálogo no se supone. |
| Sin subsidio al empleo | Mismo criterio que el aguinaldo con el art. 174. |

**Descartadas**

| Alternativa | Por qué no |
|---|---|
| Letra propia en el código (`NOM-2027-P01`) | Rompe la convención de la spec 87, donde la letra es el tipo de nómina. |
| Fechas inicio = fin = fecha de pago | Obliga a relajar `CK_periods_extraordinaria_fechas` y a cambiar de dónde sale el año del acumulado y de la tarifa. |
| Pagar en la sucursal actual del empleado | Un dado de baja no tiene sucursal actual útil, y el pago dependería del momento del cálculo. |
| Ingreso ordinario con el `salario_diario_fiscal` actual | Puede estar desactualizado o en 0 para un dado de baja, y cambia con aumentos posteriores al reparto. |
| Aceptar `salario_diario = 0` con art. 174 de ordinario 0 | Cambia el `CHECK` del snapshot y el SQL de la spec 87 por un caso raro que se corrige en el reparto. |
| Bloquear "Reabrir" desde que el periodo está solo creado | Un periodo sin calcular no usa ningún dato del reparto. |
| Validar el reparto solo al calcular | Permite periodos PTU vacíos o imposibles en la lista. |
| Avisar también cuando no hay reparto cerrado | Una empresa sin utilidades vería el aviso rojo para siempre. |
| Selector Ordinaria \| Extraordinaria más un sub-selector de concepto | Agrega un paso sin aportar nada. |
| Función de "Recalcula" aparte para la PTU | Duplicaría la comparación del art. 174. |
| Mostrar la operativa con un estado vacío | La PTU no existe en la operativa, así que el toggle no sirve. |

## Riesgos identificados

- **Romper el aguinaldo al introducir el concepto.** Hoy hay unas 48 referencias a `tipo_periodo`, y varias asumen que "E = aguinaldo". Si alguna queda sin filtrar por concepto, un periodo PTU podría entrar al cálculo del aguinaldo o quitar su aviso del 20-dic.
  - Mitigación: el paso 2 revisa todas las referencias antes de que exista ningún periodo PTU, y compara el snapshot de un aguinaldo antes y después.
  - Mientras la rama `'P'` no exista, `calculatePayrollPeriod` responde "aún no disponible" en lugar de caer en la rama de aguinaldo.
- **Reparto mal cerrado.** Una categoría, unos días o una renta gravable equivocados se pagan tal cual, porque el periodo no recalcula nada.
  - Mitigación: crear el periodo exige el reparto cerrado, y mientras no se calcule se puede reabrir y corregir.
  - Antes de calcular, el contador valida el reparto (spec 89).
- **Tarifa mensual del año de pago no capturada.** La PTU de mayo de 2027 necesita la tarifa mensual 2027. Si no está, todas las filas quedan "No calculado".
  - Mitigación: el periodo se calcula de todos modos, el aviso de ISR no calculado enlaza a la tarifa mensual y "Recalcula" detecta cuando se captura.
- **UMA del año de pago.** `fecha_fin` es el 31-dic, así que el exento usa la UMA vigente a esa fecha según la regla de vigencia de la spec 69. Si en mayo todavía no se captura la UMA de febrero, se usa la del año anterior y el exento sale bajo.
  - Mitigación: el Detalle muestra el `vigente_desde` usado y el aviso de exento detecta el cambio.
- **Dados de baja sin cuenta ni contacto.** Cobran en la nómina de su sucursal, pero la dispersión no existe, y quien no se presenta deja PTU no cobrada que el sistema no rastrea.
  - Mitigación: la PTU no cobrada se captura a mano en el reparto siguiente (`ptu_no_cobrada_anterior`, spec 89).
- **Pago adelantado o duplicado entre sucursales.** Cada fila del reparto tiene una sola sucursal congelada y el `UNIQUE` impide pagarla dos veces, aunque dos sucursales calculen al mismo tiempo.
  - Mitigación: si el `UNIQUE` salta, el cálculo responde "Alguno de estos trabajadores ya cobró la PTU de {año−1}" y no escribe nada.
- **Concurrencia entre "Reabrir" y "Calcular".** Si se reabre el reparto mientras otra pestaña calcula, el periodo podría pagar un reparto en borrador.
  - Mitigación: las dos operaciones bloquean la fila del reparto `WITH (UPDLOCK, HOLDLOCK)`. El cálculo exige `estado = 'C'` dentro de su transacción, y la reapertura revisa `period_employee_ptu` dentro de la suya.
- **Revertir después de pagar fuera del sistema.** Sin los estatus Aprobada/Pagada, un periodo PTU ya pagado en la realidad se puede revertir, y eso libera el reparto para reabrirlo.
  - Mitigación: se documenta. Los estatus 3/4 de una spec futura deberán impedir revertir y reabrir. **Resuelto en la spec 94**: en estatus 3 ya no se puede revertir sin desaprobar antes, y en 4 no se puede en absoluto; "Reabrir" el reparto sigue bloqueado porque `findPtuDistributionPayrollUsage` usa `p.status >= 2`.
- **Ingreso ordinario congelado.** El art. 174 usa el último salario fiscal del ejercicio de las utilidades, no el salario vigente al pagar. Esto retiene algo distinto de lo que daría el salario actual.
  - Mitigación: es la decisión tomada. Antes del primer pago, el contador o el simulador del SAT confirma al menos dos casos.

## Lo que **no** entra en esta spec

- Recalcular o ajustar a mano montos del reparto desde el periodo.
- PTU en la nómina operativa.
- Pagar en varias exhibiciones o repartir el pago entre sucursales.
- Rastrear la PTU no cobrada y llevarla automáticamente al reparto siguiente.
- Pagar la PTU de un dado de baja en el finiquito (spec 88).
- Subsidio al empleo, IMSS e ISN de CDMX.
- Timbrado del CFDI extraordinario, recibos y dispersión. (Aprobada/Pagada: construido en la spec 94.)
- Bloquear una `fecha_pago` posterior a la fecha límite.
- Avisar cuando no existe un reparto cerrado.
- Cambiar las reglas del aguinaldo.

Cada uno de esos, si llega, va en su propia spec.
