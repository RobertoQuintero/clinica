# 97 — Días pendientes de pago en la nómina

## Header

- **Estado:** Aprobado
- **Depende de:**
  - 53 (`nomina-calculo-salario`): `calculatePayrollPeriod`, `payroll.period_employees`, el patrón de snapshot + tabla de desglose y `getPayrollProcessPage`.
  - 61 / 75 (`nomina-horas-extra-pago`, `nomina-horas-extra-fiscal`): el patrón completo que esta spec copia — captura por empleado y fecha, pago en las dos nóminas cada una a su tarifa diaria, candado `UNIQUE (id_empleado, fecha, tipo_nomina)` en el desglose y lista en el Detalle.
  - 73 (`nomina-motor-gravado-exento`): `#fiscal_perception_lines`, `payroll.perceptions` y `PERCEPTION_LINE_KEY_BY_ID`, donde entra la percepción nueva.
  - 78 (`nomina-prima-vacacional-pago-vacaciones`): el precedente de alta de una percepción clave 001 100% gravada (`id_perception = 14`) con su script idempotente.
  - 70 (`nomina-calculo-isr-fiscal`): la base gravable crece con la percepción nueva, sin tocar `pe.dias` ni el subsidio.
  - 94 / 96 (`nomina-aprobar-pagar-periodo`, `nomina-reabrir-periodo-pagado`): `validateJustificationTarget` como candado de estatus, `collectRecalculationFlags` (hoy doce banderas, aquí trece) y Reabrir como única salida para corregir un periodo pagado.
- **Modifica base de datos:** Sí.
  - Tabla nueva `payroll.pending_day_payments` (la captura).
  - Tabla nueva `payroll.period_employee_pending_days` (el desglose pagado y el candado de pago único).
  - Dos columnas nuevas en `payroll.period_employees` (`dias_pendientes`, `importe_dias_pendientes`) con su `CHECK`.
  - Una fila nueva en el catálogo `payroll.perceptions`: "Días pendientes de pago", clave SAT 001, `tipo_limite_exencion = 'N'` (100% gravada), por script idempotente.
- **Fecha:** 2026-11-03
- **Objetivo:** Capturar a mano los días ya trabajados que no se le pagaron a un empleado y pagarlos en un periodo de nómina ordinario, en las dos nóminas y cada una a su propia tarifa diaria.

### Contexto (2026-11-03)

- **Hoy el cálculo solo mira días dentro del rango del periodo.** `calculatePayrollPeriod` paga `fecha_fin − max(fecha_inicio, fecha_ingreso) + 1` menos faltas: un día trabajado antes de `fecha_inicio` que nadie pagó no tiene forma de entrar a ninguna nómina.
- **La spec 96 dejó este caso anotado como candidata a su propia spec** ("Pagar días retroactivos en el periodo siguiente", en sus alternativas descartadas y en su lista de fuera de alcance). Esta es esa spec.
- **Reabrir no cubre todos los casos.** La spec 96 permite reabrir un periodo pagado y recalcularlo, pero eso recomputa a todos los empleados y mueve montos ya dispersados. Cuando lo único que falta es pagarle N días a una persona, pagarlos en el periodo vigente es la práctica normal de nómina y no toca nada ya transferido.
- **No es una falta justificada ni un bono.** Las faltas (spec 62) descuentan días del periodo en curso y los días económicos y de vacaciones (specs 77, 80) se pagan por no ser faltas. Ninguno de los dos mecanismos sabe pagar un día de un periodo pasado.
- **La captura es el único dato manual de dinero del módulo.** Todo lo demás (comisiones, horas extra, bonos, ISR, IMSS) se deriva de otra tabla. Por eso la captura lleva motivo obligatorio, autor y fecha, y por eso vive bajo los mismos candados de estatus que el resto.
- **El manual de usuario no se toca.** Es la regla acordada para Nómina: `content/manual/nomina/` se actualiza en una spec de manual aparte, con sus capturas.

## Alcance

**Entra:**

- **Pantalla nueva: Días pendientes de pago** (`/dashboard/nomina/dias-pendientes`, Server Component).
  - Roles 1 y 4, los tres candados del módulo (`proxy.ts`, `navConfig.tsx`, `assertPayrollAccess()`), sucursal activa desde la cookie `sel_sucursal`.
  - Estado en la URL (`periodo`, `q`, `pagina`), reutilizando `PayrollPeriodFilterToolbar`, `PayrollPagerFooter` y `PayrollEmptyState` de `nomina/componentes/`.
  - El **selector solo ofrece periodos ordinarios** de la sucursal; el periodo seleccionado es el que pagará lo capturado.
  - Tabla de capturas del periodo: empleado, fecha, tarifa operativa, tarifa fiscal, importe estimado de cada nómina, motivo, autor y fecha de captura, y el badge "Pagado en {código}" cuando el día ya está en el desglose.
  - Tarjetas de resumen del periodo: días capturados, total estimado operativa, total estimado fiscal (no cambian con el buscador).
- **Captura por rango, en un solo modal** (`PendingDayPaymentModal`, cliente):
  - empleado (buscador entre los empleados activos de la sucursal), **fecha inicial y fecha final** (se genera **una fila por día** del rango, inclusive), **tarifa diaria operativa** y **tarifa diaria fiscal** precargadas con el `salario_diario` y el `salario_diario_fiscal` actuales del empleado y **editables**, y **motivo obligatorio** (5–200 caracteres).
  - **Tarifa en 0 = no se paga en esa nómina.** Las dos en 0 se rechaza.
  - **Fechas rechazadas:** posteriores a `fecha_fin` del periodo que paga, anteriores a `fecha_ingreso` del empleado, y cualquier fecha del rango que ya tenga captura para ese empleado (el error dice qué fechas chocan y no guarda ninguna).
  - **Aviso ámbar, sin bloquear:** cuando una fecha del rango cae dentro de un periodo en estatus 2, 3 o 4 ("Esa fecha pertenece a {código}, ya calculado"). Es justo el caso que esta spec resuelve, así que informa y deja guardar.
  - **Aviso ámbar, sin bloquear:** cuando el empleado no tiene salario del tipo (`> 0`), porque esa nómina no le va a pagar el día.
- **Borrar una captura** mientras el periodo esté en estatus 1 o 2, con confirmación en UI (sin `confirm()` nativo). Es un `DELETE` físico; editar no existe (se borra y se vuelve a capturar).
- **Candado de estatus.** Capturar y borrar solo en estatus 1 y 2, con `validateJustificationTarget` (el mismo que usan Horas extra, Faltas y Retardos): en 3 y 4 la pantalla queda de solo lectura y el servidor responde "El periodo ya no admite cambios". Corregir algo ya pagado es Reabrir (spec 96) o capturarlo en el periodo siguiente.
- **Pago en el cálculo** (`calculatePayrollPeriod`, solo periodos ordinarios):
  - `payroll.period_employees` gana `dias_pendientes` e `importe_dias_pendientes`, por tipo de nómina.
  - Desglose por día y tipo en `payroll.period_employee_pending_days`, con la tarifa congelada y el importe de ese día.
  - **Importe** = `ROUND(tarifa_del_tipo, 2)` por día, sumado por empleado y tipo. Un día con tarifa 0 en un tipo no genera fila ni suma en ese tipo.
  - **Candado de pago único:** `UNIQUE (id_empleado, fecha, tipo_nomina)` en el desglose, igual que horas extra (spec 75): un día se paga una sola vez por tipo en toda la historia, sea cual sea el periodo, la frecuencia o la sucursal.
  - Una captura cuyo empleado **no tiene fila** del tipo en el periodo no se paga ni se bloquea en ese tipo: se arregla capturando el salario y recalculando.
- **Fiscal (motor de la spec 73, sin lógica nueva).** Un `UNION ALL` más en `#fiscal_perception_lines` con la percepción nueva **"Días pendientes de pago"** (clave SAT 001, `'N'`, 100% gravada), solo cuando el importe es `> 0`, con `eventos = NULL`. Lo gravado suma a la base del ISR (spec 70). **No toca `pe.dias`**, así que el subsidio, los topes por día del gravado/exento y los días de IMSS no se mueven.
- **Aviso trece "Recalcula"** (`lib/payroll/pendingDaysRecalculation.ts`, solo estatus 2): hay una captura del periodo que ningún tipo pagó, hay una fila del desglose cuya captura ya no existe, o su tarifa capturada difiere de la congelada. Entra a `IRecalculationFlags` / `collectRecalculationFlags`, así que **bloquea Aprobar sin código nuevo**.
- **Aviso de capturas que no se pagarán** (`PendingDaysNotCoveredNotice`, Server Component en Procesar y en la pantalla nueva): lista las capturas del periodo cuyo empleado no tiene fila del tipo, con nombre, código y enlace a la ficha, siguiendo la forma de `MissingEmployeesNotice` (spec 96). No bloquea nada.
- **UI del resto del módulo:**
  - Procesar: columna "Días pendientes" (importe, con "N días" como texto secundario) en las dos vistas, sumada a "Total percepciones", al pie y a la tarjeta de resumen.
  - Detalle: línea `dias_pendientes` en `buildPerceptionLines` ("N días × $X diarios", omitida con importe 0) y `PayrollPendingDaysList` (Server Component) con fecha, tarifa, importe, motivo y total, oculta sin días pagados.
  - `navConfig.tsx`: entrada "Días pendientes" en Nómina, con el mismo `excludeRoles` que el resto del módulo.
- **Validación.** `zod` para la captura y el borrado (`lib/payroll/pendingDaysSchemas.ts`), y los `CHECK` y `UNIQUE` de la base como segunda línea.
- **Documentación.** Sección nueva "Días pendientes de pago (spec 97)" en `docs/nomina.md`, los doce avisos pasan a trece, la lista de conceptos del encabezado crece en uno, y el DDL completo va a `queries.txt` (bloque `NOMINA PAYROLL`, después de la spec 96).

**Fuera de alcance:**

- **Manual de usuario.** No se toca `content/manual/nomina/`; va en una spec de manual aparte, con sus capturas.
- **Periodos extraordinarios.** Aguinaldo (spec 87) y PTU (spec 90) no aceptan días pendientes: su cálculo, su tabla en Procesar y su Detalle son otros.
- **Flujo de autorización en dos pasos** (pendiente → autorizada → rechazada), como horas extra. Capturar es autorizar.
- **Editar una captura.** Se borra y se vuelve a capturar mientras el periodo lo permita.
- **Bitácora de capturas borradas.** La captura guarda autor y fecha, y solo se puede borrar antes de pagarse.
- **Detectar automáticamente los días no pagados** (cruzar checadas o faltas contra los snapshots ya calculados). Queda como candidata a su propia spec.
- **Descuentos**: días a restar, tarifas negativas o cualquier deducción manual.
- **Importe libre sin días**, y un catálogo de motivos.
- **Que los días pendientes sumen a `dias`**, al SBC del IMSS, al aguinaldo, a la PTU, a la prima vacacional o a cualquier base derivada de días.
- **El artículo 174 del RLISR** para el retroactivo: lo gravado entra completo a la base de la semana, como el resto de las percepciones ordinarias.
- **Pagarle a un empleado dado de baja.** Nunca tiene fila en el snapshot, así que la captura queda registrada y avisada pero no se paga; su caso es el finiquito (spec 88).
- **Recibos, timbrado del CFDI, dispersión bancaria** y la referencia de la transferencia correctiva.
- **Topes** de días o de importe por captura, y una segunda firma para montos grandes.
- **Capturar días de empleados de otra sucursal**, o pagar una captura en un periodo de otra sucursal.
- **Recalcular solo los días pendientes** sin recalcular el periodo completo.

## Modelo de datos

### SQL (DDL en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 96)

```sql
-- Spec 97: captura manual de días ya trabajados que no se pagaron.
-- Lleva id_period: la fecha cae fuera del rango del periodo, así que el cálculo no puede
-- encontrarla por fecha; la captura declara qué periodo la paga.
CREATE TABLE [payroll].[pending_day_payments](
    [id_pending_day_payment] [int] IDENTITY(1,1) NOT NULL,
    [id_period]        [int]            NOT NULL,   -- periodo que la pagará
    [id_empleado]      [int]            NOT NULL,
    [fecha]            [date]           NOT NULL,   -- el día trabajado que se debe
    [tarifa_operativa] [decimal](12,2)  NOT NULL,   -- 0 = no se paga en la operativa
    [tarifa_fiscal]    [decimal](12,2)  NOT NULL,   -- 0 = no se paga en la fiscal
    [motivo]           [nvarchar](200)  NOT NULL,
    [created_by]       [int]            NOT NULL,
    [created_at]       [datetime2](0)   NOT NULL,   -- buildDate(new Date())
 CONSTRAINT [PK_pending_day_payments] PRIMARY KEY CLUSTERED ([id_pending_day_payment] ASC),
 -- Un día se debe una sola vez en toda la historia, sea cual sea el periodo que lo pague.
 CONSTRAINT [UQ_pending_day_payments_empleado_fecha] UNIQUE ([id_empleado], [fecha]),
 CONSTRAINT [FK_pending_day_payments_period] FOREIGN KEY ([id_period])
     REFERENCES [payroll].[periods] ([id_period]) ON DELETE CASCADE,
 CONSTRAINT [FK_pending_day_payments_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado]),
 CONSTRAINT [CK_pending_day_payments_tarifas] CHECK (
     [tarifa_operativa] >= 0 AND [tarifa_fiscal] >= 0
     AND ([tarifa_operativa] > 0 OR [tarifa_fiscal] > 0)),
 CONSTRAINT [CK_pending_day_payments_motivo] CHECK (LEN(LTRIM(RTRIM([motivo]))) >= 5)
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_pending_day_payments_period]
    ON [payroll].[pending_day_payments] ([id_period], [id_empleado], [fecha])
GO

-- Spec 97: dos columnas de snapshot, por tipo de nómina.
ALTER TABLE [payroll].[period_employees] ADD
    [dias_pendientes]          [smallint]      NOT NULL CONSTRAINT [DF_period_employees_dias_pend]    DEFAULT (0),
    [importe_dias_pendientes]  [decimal](12,2) NOT NULL CONSTRAINT [DF_period_employees_imp_dias_pend] DEFAULT (0)
GO
ALTER TABLE [payroll].[period_employees] WITH CHECK
    ADD CONSTRAINT [CK_period_employees_dias_pendientes] CHECK (
        [dias_pendientes] >= 0 AND [importe_dias_pendientes] >= 0
        AND ([dias_pendientes] > 0 OR [importe_dias_pendientes] = 0))
GO

-- Spec 97: desglose de los días pendientes pagados, por renglón de nómina.
-- UNIQUE(id_empleado, fecha, tipo_nomina) impide el doble pago en toda la historia (spec 75).
-- Sin FK a pending_day_payments: borrar una captura no debe chocar con un día ya pagado.
CREATE TABLE [payroll].[period_employee_pending_days](
    [id_period_employee_pending_day] [int] IDENTITY(1,1) NOT NULL,
    [id_period_employee] [int]           NOT NULL,
    [id_empleado]        [int]           NOT NULL,   -- redundante, necesario para el UNIQUE
    [fecha]              [date]          NOT NULL,
    [tipo_nomina]        [char](1)       NOT NULL,   -- 'O' | 'F', copiado del renglón
    [tarifa_diaria]      [decimal](12,2) NOT NULL,   -- congelada de la captura al calcular
    [importe]            [decimal](12,2) NOT NULL,   -- ROUND(tarifa_diaria, 2)
    [motivo]             [nvarchar](200) NOT NULL,   -- congelado: la captura se puede borrar
 CONSTRAINT [PK_period_employee_pending_days] PRIMARY KEY CLUSTERED ([id_period_employee_pending_day] ASC),
 CONSTRAINT [UQ_period_employee_pending_days_empleado_fecha_tipo]
     UNIQUE ([id_empleado], [fecha], [tipo_nomina]),
 CONSTRAINT [FK_period_employee_pending_days_period_employee] FOREIGN KEY ([id_period_employee])
     REFERENCES [payroll].[period_employees] ([id_period_employee]) ON DELETE CASCADE,
 CONSTRAINT [CK_period_employee_pending_days_tipo] CHECK ([tipo_nomina] IN ('O','F')),
 CONSTRAINT [CK_period_employee_pending_days_valores] CHECK (
     [tarifa_diaria] > 0 AND [importe] > 0)
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_period_employee_pending_days_period_employee]
    ON [payroll].[period_employee_pending_days] ([id_period_employee])
GO
```

**Percepción nueva** (script idempotente, mismo patrón que la 14 de la spec 78): `id_perception = 15`, `clave_sat = '001'`, `description = 'Días pendientes de pago'`, `tipo_limite_exencion = 'N'` (100% gravada), `umas_limite`, `porcentaje_exento` y `periodicidad_limite` en `NULL`, con `id_taxed_exempt`, `is_billed` y `status` copiados de la percepción 1. Lanza `THROW 50097` si el id 15 ya está ocupado por otra percepción o si la 1 no es el sueldo.

**Sin DDL:** `payroll.perceptions` no cambia de forma, `period_employee_perceptions` tampoco (la fila nueva usa la estructura de la spec 73) y ningún `CHECK` existente se recrea.

### TypeScript

`interfaces/payroll_pending_days.ts` (nuevo):

```ts
/** Una captura de un día pendiente, con lo que la pantalla necesita mostrar. */
export interface IPendingDayPaymentRow {
  id_pending_day_payment: number;
  id_period:              number;
  id_empleado:            number;
  codigo_empleado:        string;
  nombre_completo:        string;
  fecha:                  string;   // "YYYY-MM-DD"
  tarifa_operativa:       number;
  tarifa_fiscal:          number;
  motivo:                 string;
  created_at:             string;   // "YYYY-MM-DD HH:mm:ss"
  capturado_por:          string;
  periodo_de_la_fecha:    string | null;   // código del periodo que contiene la fecha, si existe
  estatus_de_la_fecha:    PayrollPeriodStatus | null;
  pagado_en:              string | null;   // código del periodo que ya la pagó
  sin_salario_operativa:  boolean;
  sin_salario_fiscal:     boolean;
}

/** Un día pendiente ya pagado, como lo lee el Detalle. */
export interface IPayrollPendingDayRow {
  fecha:          string;
  tipo_nomina:    PayrollType;
  tarifa_diaria:  number;
  importe:        number;
  motivo:         string;
}
```

`payroll.period_employees` (en `interfaces/payroll_calculation.ts`) gana `dias_pendientes: number` e `importe_dias_pendientes: number`; el payload de `getPayrollProcessPage` gana `importeDiasPendientes` en sus totales y `pendingDaysNotCovered: IPendingDayPaymentRow[]`.

### Constantes (`lib/payroll/constants.ts`)

```ts
export const PENDING_DAYS_PERCEPTION_ID = 15;   // 001, 'N' 100% gravada
export const PENDING_DAY_MOTIVE_MIN_LENGTH = 5;
export const PENDING_DAY_MOTIVE_MAX_LENGTH = 200;
export const PENDING_DAYS_PAGE_SIZE = 25;
```

`PERCEPTION_LINE_KEY_BY_ID` gana `[PENDING_DAYS_PERCEPTION_ID]: "dias_pendientes"`.

### Módulos de `lib/payroll/`

| Archivo | Qué es |
|---|---|
| `pendingDaysSql.ts` (`server-only`) | `PENDING_DAYS_TEMP_TABLE_SQL` (`#pending_days`), `PENDING_DAYS_APPLY_SQL` (alias `pending_*`) y `PENDING_DAYS_COLUMNS_SQL`. Compartidos por el cálculo y el aviso trece, como hace `overtimeRecalculation` con `overtimePay`. |
| `pendingDaysPay.ts` (puro, solo strings) | `expandDateRange(desde, hasta)` (una fecha por día, sin `Date`), `calculatePendingDayAmount(tarifa)`, `sumPendingDays(rows)` y `describePendingDays(dias, tarifa)` ("N días × $X diarios"). Si difiere del SQL, **manda el SQL**. |
| `pendingDaysRecalculation.ts` (`server-only`) | `isPendingDaysRecalculationNeeded(id_period)`, solo estatus 2. |
| `pendingDaysSchemas.ts` (`zod`) | `createPendingDayPaymentsSchema` (`id_period`, `id_empleado`, `fecha_desde`, `fecha_hasta`, `tarifa_operativa`, `tarifa_fiscal`, `motivo`) y `deletePendingDayPaymentSchema`. El motivo deriva de un `pendingDayMotiveSchema`. |
| `pendingDaysUrls.ts` | `readPendingDaysSearchParams` y `buildPendingDaysHref`, como `absenceUrls.ts` y `latenessUrls.ts`. |

### Cálculo (`calculatePayrollPeriod`, periodos ordinarios)

Orden dentro del batch, **después de `#vacation_pay`** y antes del `INSERT` del snapshot:

1. `#pending_days`: las capturas del periodo cruzadas con `CROSS APPLY (VALUES ('O', p.tarifa_operativa), ('F', p.tarifa_fiscal))`, descartando tarifa `= 0` y, con un `NOT EXISTS` sobre `period_employee_pending_days`, los días que **otro** periodo ya pagó en ese tipo.
2. El `INSERT` del snapshot llena `dias_pendientes` e `importe_dias_pendientes` con un `OUTER APPLY` sobre `#pending_days` unido por `(id_empleado, tipo_nomina)`.
3. El desglose se inserta desde la **misma** `#pending_days` unida a los renglones nuevos de su tipo, así que snapshot y desglose no pueden diferir.
4. `#fiscal_perception_lines` gana su `UNION ALL` con `id_perception = 15` e `importe = importe_dias_pendientes`, solo cuando es `> 0` y con `eventos = NULL`.

`revertPayrollCalculation` no cambia: el `DELETE FROM period_employees` libera el desglose por cascada y las capturas sobreviven, listas para el siguiente cálculo.

### Acciones (`app/dashboard/nomina/dias-pendientes/actions.ts`)

```ts
export async function getPendingDaysPage(filters: unknown): Promise<IPendingDaysPagePayload>;
export async function createPendingDayPayments(input: unknown): Promise<ActionResult<number>>;  // días creados
export async function deletePendingDayPayment(input: unknown): Promise<ActionResult<null>>;
```

- Las dos escrituras: `assertPayrollAccess()`, `zod`, sucursal de la sesión, un solo batch con `BEGIN TRAN` y la lectura del periodo `WITH (UPDLOCK, HOLDLOCK)` validando `id_sucursal`, `tipo_periodo = 'O'` y `status IN (1, 2)` con `validateJustificationTarget`, y `revalidatePayrollPaths()` al cerrar.
- `createPendingDayPayments` expande el rango en SQL, valida contra `fecha_fin` del periodo y `fecha_ingreso` del empleado, e inserta todo o nada: si alguna fecha choca con `UQ_pending_day_payments_empleado_fecha`, responde cuáles y no guarda ninguna.
- Marcadores nuevos en `describePayrollCalculationError`:

| Marcador | Mensaje |
|---|---|
| `PENDING_DAY_ALREADY_CAPTURED` | "Estos días ya están capturados para el empleado: {fechas}" |
| `PENDING_DAY_DATE_OUT_OF_RANGE` | "La fecha no puede ser posterior al fin del periodo ni anterior al ingreso del empleado" |
| `UQ_period_employee_pending_days_empleado_fecha_tipo` | "Otro cálculo tomó algunos de estos días al mismo tiempo. Intenta de nuevo." |

### Componentes

- `dias-pendientes/page.tsx` (Server Component) con `PendingDaysSummaryCards`, `PendingDayPaymentsTable` y los avisos (Server Components).
- Cliente, solo las hojas: `PendingDayPaymentModal` (empleado, rango, dos tarifas, motivo con contador, avisos ámbar) y `DeletePendingDayPaymentButton` (confirmación en UI).
- `nomina/componentes/PendingDaysNotCoveredNotice.tsx` (Server Component, compartido con Procesar).
- `procesar/[id_empleado]/componentes/PayrollPendingDaysList.tsx` (Server Component, oculto sin días).

### Convenciones

- Todas las fechas viajan como string; `CONVERT(varchar(10), [fecha], 120)` al leer, `toDBString` al escribir, `buildDate(new Date())` en `created_at`.
- Nombres de código en inglés (`createPendingDayPayments`, `isPendingDaysRecalculationNeeded`, `PendingDayPaymentModal`), etiquetas y mensajes en español.

## Plan de implementación

1. **DDL y percepción.**
   - A `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 96: las dos tablas, las dos columnas de `period_employees` con su `CHECK`, los dos índices y el script idempotente de la percepción 15.
   - Se ejecuta contra la base de desarrollo.
   - *Verificación*, escribiendo SQL a mano:
     - una captura con las dos tarifas entra; con las dos en 0 falla; con motivo de 4 caracteres falla;
     - la misma `(id_empleado, fecha)` dos veces falla por `UQ_pending_day_payments_empleado_fecha`, aunque sea para otro periodo;
     - borrar el periodo (estatus 1) borra sus capturas por cascada; borrar un renglón de `period_employees` borra su desglose;
     - dos filas de desglose con la misma `(id_empleado, fecha)` y distinto `tipo_nomina` entran; con el mismo tipo falla;
     - los snapshots existentes quedan en `0` / `0` y el `CHECK` nuevo entra sin `WITH NOCHECK` fallido;
     - el script de la percepción corre dos veces sin duplicar y lanza `50097` si se cambia a mano el id 15 por otra percepción.

2. **Tipos, constantes, lógica pura y schemas. Sin acciones, sin UI, sin cálculo.**
   - `interfaces/payroll_pending_days.ts`, las dos columnas en `interfaces/payroll_calculation.ts`, las cuatro constantes y la entrada en `PERCEPTION_LINE_KEY_BY_ID`.
   - `lib/payroll/pendingDaysPay.ts` (`expandDateRange`, `calculatePendingDayAmount`, `sumPendingDays`, `describePendingDays`), `pendingDaysSchemas.ts` y `pendingDaysUrls.ts`.
   - *Verificación:* `npx tsc --noEmit` y `npm run lint` limpios. `expandDateRange("2026-10-28", "2026-11-02")` devuelve seis fechas en orden, cruza fin de mes y no usa `Date`; invertido devuelve `[]`. El schema rechaza motivo de 4 y de 201 caracteres, tarifas negativas y las dos tarifas en 0. En pantalla no cambia nada.

3. **Acciones de captura y borrado, todavía sin pantalla.**
   - `dias-pendientes/actions.ts` con `createPendingDayPayments`, `deletePendingDayPayment` y los tres marcadores nuevos en `describePayrollCalculationError`.
   - *Verificación*, llamándolas desde el scratchpad con sesión de rol 1 y luego de rol 4:
     - un rango de 5 días crea 5 filas con el mismo motivo y las dos tarifas;
     - una fecha posterior a `fecha_fin` del periodo, o anterior a `fecha_ingreso`, se rechaza y **no guarda ninguna** del rango;
     - un rango que choca en una sola fecha responde cuál y no guarda ninguna;
     - un periodo de otra sucursal, extraordinario, o en estatus 3 o 4, se rechaza sin escribir;
     - borrar funciona en 1 y 2, y se rechaza en 3 y 4;
     - con rol 2, 3, 5 o 6 → `{ ok: false, message: "No tienes permisos…" }`.

4. **Pantalla nueva y entrada en el menú.**
   - `dias-pendientes/page.tsx` (Server Component) con `getPendingDaysPage`, las tarjetas de resumen, la tabla, el modal de captura, el botón de borrar y el estado en la URL (`periodo`, `q`, `pagina`), reutilizando `PayrollPeriodFilterToolbar`, `PayrollPagerFooter` y `PayrollEmptyState`.
   - Entrada "Días pendientes" en `navConfig.tsx` con el `excludeRoles` del módulo.
   - Se usa la skill `frontend-design`.
   - *Verificación:*
     - el selector solo lista periodos ordinarios de la sucursal; el buscador filtra por nombre y código y conserva los demás parámetros;
     - al elegir empleado, las dos tarifas se precargan con su salario actual y se pueden editar y poner en 0;
     - el modal muestra el ámbar "esa fecha pertenece a {código}, ya calculado" y el de "sin salario {tipo}", y **deja guardar**;
     - en estatus 3 y 4 no hay botón de capturar ni de borrar;
     - un rol sin acceso no ve la entrada del menú y `proxy.ts` lo manda a `/dashboard`.

5. **Pago en el cálculo.**
   - `pendingDaysSql.ts` y su uso en `calculatePayrollPeriod`: `#pending_days` con el `NOT EXISTS` del candado, las dos columnas del snapshot por `OUTER APPLY` y el `INSERT` del desglose desde la misma temp table.
   - *Verificación:*
     - se comparan los snapshots de un periodo ya calculado antes y después del cambio: la única diferencia permitida son `calculated_at`, `calculated_by` y las dos columnas nuevas;
     - 3 días a $400 operativa y $300 fiscal dan `3 / $1,200` en `'O'` y `3 / $900` en `'F'`;
     - una captura con tarifa fiscal 0 solo genera fila y suma en `'O'`;
     - un empleado sin salario del tipo no recibe el día y el día **no queda bloqueado** en ese tipo;
     - recalcular dos veces da el mismo resultado; revertir borra el desglose y conserva las capturas;
     - el mismo día capturado para dos periodos distintos (posible solo si la captura se movió) se paga en el primero que calcule y el segundo no lo toma.

6. **Fiscal y Detalle.**
   - El `UNION ALL` de la percepción 15 en `#fiscal_perception_lines`; línea `dias_pendientes` en `buildPerceptionLines`; `PayrollPendingDaysList` en el Detalle.
   - Se usa la skill `frontend-design`.
   - *Verificación:*
     - en la vista fiscal, el Detalle muestra la percepción "Días pendientes de pago" con **gravado = importe** y exento 0, y la nota "Gravado al 100%";
     - la base del ISR crece exactamente ese importe y `pe.dias`, el subsidio y el IMSS **no cambian**;
     - con importe 0 no hay fila en `period_employee_perceptions` ni línea en el Detalle;
     - la lista muestra fecha, tarifa, importe y motivo, y su total cuadra al centavo con la columna del snapshot;
     - borrar la captura después de pagada no vacía la lista: el motivo está congelado en el desglose.

7. **Aviso trece "Recalcula".**
   - `pendingDaysRecalculation.ts`; `IRecalculationFlags` y `collectRecalculationFlags` ganan `pendingDaysRecalculationNeeded`, que entra al `Promise.all` y al `or` de `recalculationNeeded`; `PayrollRecalculationNotice` en Procesar y en la pantalla nueva con "Hay días pendientes de pago que no coinciden con el último cálculo. Recalcula la nómina."
   - *Verificación:*
     - capturar un día en un periodo en estatus 2 enciende el aviso; recalcular lo apaga;
     - borrar una captura ya pagada lo enciende;
     - cambiar la tarifa (borrar y volver a capturar) lo enciende;
     - **Aprobar queda bloqueado sin código nuevo**, con el mensaje de recalcular, y la acción llamada a mano responde lo mismo;
     - en estatus 1, 3 y 4 el aviso no se evalúa, como los otros once.

8. **Procesar: columna, totales y aviso de capturas no cubiertas.**
   - Columna "Días pendientes" en las dos vistas, sumada a "Total percepciones", al pie y a la tarjeta de resumen; `PendingDaysNotCoveredNotice` en Procesar y en la pantalla nueva.
   - *Verificación:*
     - la columna, el pie y la tarjeta cuadran con la suma del snapshot y **no cambian** con los filtros de puesto ni búsqueda;
     - el neto fiscal baja exactamente el ISR que generó el importe nuevo;
     - el aviso lista al empleado con captura y sin fila del tipo, con enlace a su ficha, y desaparece al capturar el salario y recalcular;
     - un periodo extraordinario no muestra la columna ni el aviso.

9. **Documentación.**
   - `docs/nomina.md`: sección "Días pendientes de pago (spec 97)", la lista de conceptos del encabezado, "doce comprobaciones" → trece en todas sus menciones, y la nota de que el concepto no toca `dias` ni el SBC.
   - `queries.txt`: el DDL ejecutado y una **consulta de diagnóstico** para correr a mano, que liste las capturas sin fila en `period_employee_pending_days` de los periodos en estatus 3 y 4 (días capturados que nunca se pagaron).
   - *Verificación:* el DDL documentado coincide con el ejecutado; la consulta de diagnóstico encuentra el caso de prueba del paso 5; `npx tsc --noEmit` y `npm run lint` limpios; `content/manual/nomina/` sin tocar.

## Criterios de aceptación

**Captura**

- [ ] Un rango de 5 días crea 5 filas, una por día, con el mismo motivo, las mismas dos tarifas, autor y fecha de captura.
- [ ] Las dos tarifas se precargan con el `salario_diario` y el `salario_diario_fiscal` actuales del empleado y se pueden editar.
- [ ] Una tarifa en 0 significa que esa nómina no paga el día; las dos en 0 se rechazan en `zod` y en `CK_pending_day_payments_tarifas`.
- [ ] Un motivo de menos de 5 caracteres útiles o de más de 200 se rechaza en `zod` y en `CK_pending_day_payments_motivo`.
- [ ] Una fecha posterior a `fecha_fin` del periodo que paga, o anterior a `fecha_ingreso` del empleado, se rechaza y **ninguna** fecha del rango se guarda.
- [ ] Capturar una fecha que ya tiene captura para ese empleado se rechaza indicando qué fechas chocan, aunque la captura previa sea de otro periodo, y no guarda ninguna del rango.
- [ ] Una fecha dentro del rango de un periodo en estatus 2, 3 o 4 muestra el aviso ámbar con el código de ese periodo y **se puede guardar**.
- [ ] Un empleado sin salario del tipo muestra el aviso ámbar correspondiente y **se puede guardar**.
- [ ] Capturar y borrar funcionan en estatus 1 y 2 y se rechazan en 3 y 4, también llamando la acción directamente.
- [ ] Un periodo extraordinario (aguinaldo o PTU) no se puede elegir y la acción lo rechaza.
- [ ] Un periodo de otra sucursal no se distingue de uno inexistente.
- [ ] Un rol distinto de 1 y 4 recibe `{ ok: false }` al llamar las acciones, no ve la entrada del menú y `proxy.ts` lo redirige.

**Pago**

- [ ] Calcular paga un día por su tarifa del tipo: 3 días a $400 / $300 dan `3 / $1,200` en `'O'` y `3 / $900` en `'F'`.
- [ ] Una captura con una tarifa en 0 genera fila de desglose y suma **solo** en el otro tipo.
- [ ] `dias`, `dias_falta`, `dias_retardo`, `importe_salario`, el subsidio del ISR y los días de IMSS **no cambian** por un día pendiente.
- [ ] Un día pagado por un periodo no lo vuelve a tomar ningún otro, en ninguna frecuencia ni sucursal, por tipo de nómina.
- [ ] Recalcular dos veces da exactamente el mismo resultado; revertir borra el desglose y **conserva** las capturas.
- [ ] Un empleado con captura y sin fila del tipo no cobra el día y el día **no queda bloqueado** en ese tipo.
- [ ] Comparando los snapshots de un periodo ya calculado antes y después de esta spec, lo único que difiere son `calculated_at`, `calculated_by` y las dos columnas nuevas.
- [ ] Dos cálculos simultáneos que compiten por el mismo día terminan con uno correcto y el otro con "Otro cálculo tomó algunos de estos días al mismo tiempo. Intenta de nuevo.", nunca con un 500.

**Fiscal**

- [ ] La percepción 15 se genera solo con importe `> 0`, con `eventos` en `NULL`, gravado = importe y exento 0.
- [ ] La base gravable del ISR crece exactamente el importe de los días pendientes, y el neto baja exactamente el ISR que eso genera.
- [ ] El Detalle fiscal muestra la línea con su gravado, su exento y la nota "Gravado al 100%".
- [ ] La percepción 15 existe una sola vez en el catálogo, con clave `001` y `tipo_limite_exencion = 'N'`; el script corre dos veces sin duplicarla.

**Pantallas**

- [ ] La tabla muestra empleado, fecha, las dos tarifas, los importes estimados, motivo, autor, fecha de captura y el badge "Pagado en {código}" cuando corresponde.
- [ ] Las tarjetas de resumen y el pie cubren todo el periodo y no cambian con el buscador ni con el filtro de puesto.
- [ ] Procesar muestra la columna "Días pendientes" en las dos vistas, con "N días" como texto secundario, y la suma a "Total percepciones", al pie y a la tarjeta de resumen.
- [ ] El Detalle muestra la línea "N días × $X diarios" y la lista de días con fecha, tarifa, importe, motivo y total, que cuadra al centavo con el snapshot.
- [ ] La línea y la lista se omiten con importe 0 y la lista queda oculta sin días pagados.
- [ ] Borrar una captura ya pagada no vacía la lista del Detalle: el motivo está congelado en el desglose.
- [ ] Un periodo extraordinario no muestra la columna, la línea, la lista ni los avisos.

**Avisos y candados**

- [ ] Capturar, borrar o cambiar la tarifa de un día en un periodo en estatus 2 enciende el aviso "Recalcula", y recalcular lo apaga.
- [ ] El aviso no se evalúa en estatus 1, 3 ni 4.
- [ ] Con el aviso encendido, Aprobar se rechaza en el servidor y el botón aparece deshabilitado con el motivo visible y accesible, sin una línea nueva en `approvePayrollPeriod`.
- [ ] El aviso de capturas no cubiertas lista al empleado con nombre, código y enlace a su ficha, y desaparece al capturar el salario y recalcular.
- [ ] Las doce comprobaciones anteriores siguen bloqueando Aprobar igual que antes.

**Calidad**

- [ ] Las dos escrituras pasan por `assertPayrollAccess()` y `zod`; la sucursal y el `id_user` salen de la sesión, nunca del cliente, y el estatus del periodo se valida dentro de la lectura con `UPDLOCK, HOLDLOCK`.
- [ ] Ninguna fecha viaja como `Date`: se escribe con `toDBString` / `buildDate` y se lee con `CONVERT(varchar(10|19), …, 120)`.
- [ ] La regla de pago tiene una sola copia en SQL (`pendingDaysSql.ts`), compartida por el cálculo y el aviso, y `pendingDaysPay.ts` es puro y sin `Date`.
- [ ] Los únicos componentes cliente nuevos son `PendingDayPaymentModal` y `DeletePendingDayPaymentButton`; todo lo demás es Server Component.
- [ ] Los nombres de funciones, variables, hooks y componentes están en inglés.
- [ ] `npx tsc --noEmit` y `npm run lint` pasan sin errores.
- [ ] `docs/nomina.md` y `queries.txt` quedan actualizados; `content/manual/nomina/` **no** se toca.

## Decisiones

**Tomadas**

| Decisión | Por qué |
|---|---|
| Un solo concepto, "Días pendientes de pago", sin catálogo de motivos | Los cuatro nombres del negocio (extraordinarios, pendientes, atrasados, retroactivos) describen el mismo hecho: un día ya trabajado que no se pagó. Un catálogo de motivos sería una tabla y una pantalla más para un dato que el motivo de texto ya cuenta mejor. |
| Pantalla propia en Nómina, no captura dentro de Procesar ni del Detalle | Es la forma que ya tienen Horas extra, Faltas y Retardos: selector de periodo, buscador, tabla y modal, con sus componentes compartidos. Procesar y el Detalle quedan donde están: calcular, aprobar y leer. |
| La captura se ata al periodo que la paga (`id_period`) | La fecha pendiente cae fuera del rango del periodo, así que el cálculo no puede encontrarla por fecha como hace con las horas extra o las vacaciones. Que la captura declare su periodo es lo único que vuelve el pago predecible. |
| Fechas concretas, una fila por día, no una cantidad de días | Es lo que permite el candado `UNIQUE (id_empleado, fecha, tipo_nomina)` del desglose y lo que deja demostrar **qué** día se pagó. Sin fechas, nada impediría capturar los mismos cinco días dos veces. |
| Captura por rango en un solo modal | Lo normal es deber una quincena o una semana completa. Un modal por día serían quince modales; la expansión del rango genera filas independientes, así que borrar un día suelto sigue siendo posible. |
| Dos tarifas editables, operativa y fiscal | Un retroactivo real se paga al salario que el empleado tenía entonces, que no es el de hoy. Una sola tarifa haría que la nómina fiscal pagara un diario que no es el fiscal, y eso descuadra el CFDI y el ISR. |
| Tarifa en 0 = no se paga en esa nómina | Es la forma natural de pagar un día solo en una de las dos sin un campo extra, y calza con la regla que el módulo ya tiene: sin salario del tipo no hay fila ni pago. |
| Percepción aparte, sin tocar `dias` | `dias` alimenta el subsidio del ISR, los topes por día del gravado/exento (`'D'`) y los días de IMSS. Sumar días de otro periodo a ese contador movería tres cálculos ajenos y haría imposible distinguir el retroactivo en el Detalle. |
| Percepción nueva id 15, clave 001, 100% gravada | Un día de sueldo atrasado sigue siendo sueldo: el contador espera clave 001. Es el mismo precedente que la spec 78 con "Vacaciones pagadas" (id 14, clave 001, `'N'`), y una percepción propia es lo único que permite distinguirla del sueldo del periodo en el Detalle y en el CFDI. |
| Capturar es autorizar, sin flujo pendiente/autorizada | Solo los roles 1 y 4 entran a Nómina, así que el segundo par de ojos no existe en la práctica. El control real es el motivo obligatorio, el autor, la fecha y que nada se paga sin recalcular. |
| Captura y borrado solo en estatus 1 y 2, con `validateJustificationTarget` | Es el mismo candado de Horas extra, Faltas y Retardos; reutilizarlo mantiene una sola regla de congelamiento en el módulo. Corregir algo ya pagado es Reabrir (spec 96) o capturarlo en el periodo siguiente. |
| Avisar en ámbar, no bloquear, cuando la fecha cae en un periodo ya calculado | Ese **es** el caso que la spec resuelve: el día cayó en un periodo cerrado y no se pagó, porque el empleado quedó fuera del cálculo o se le descontó como falta por error. Bloquear cerraría la puerta que se vino a abrir. |
| Solo periodos ordinarios | Un retroactivo de sueldo se paga en una nómina de sueldo. Aguinaldo y PTU tienen su propio cálculo, su propia tabla en Procesar y su propio Detalle: meterles el concepto sería tocar tres rutas de cálculo para un caso que nadie pidió. |
| Se captura aunque el empleado no tenga fila del tipo, con aviso | Permite registrar lo que se le debe a alguien que todavía no tiene el salario capturado, y el aviso dice que no se pagará. Es lo que ya pasa (en silencio) con las horas extra y los tratamientos de alguien fuera del cálculo; aquí se hace visible. |
| El día de alguien sin fila del tipo **no** se bloquea | Si se bloqueara, arreglar el salario y recalcular ya no lo pagaría nunca. El candado solo lo toma quien efectivamente cobra el día. |
| El desglose congela la tarifa **y el motivo** | La captura se puede borrar; el Detalle de un periodo pagado tiene que seguir explicando por qué se pagó ese día. Es la misma razón por la que el snapshot congela el salario. |
| Sin FK del desglose a la captura | Borrar una captura no debe chocar con un día ya pagado, exactamente como `period_employee_overtime` no tiene FK a `overtime_authorizations`. |
| Borrar sí, editar no | Una captura es un hecho de dinero con autor y fecha; corregirla es borrarla y volver a capturarla, y solo se puede antes de que se pague. Un formulario de edición añadiría un segundo camino de escritura para el mismo dato. |
| Sin bitácora de capturas borradas | Solo se puede borrar mientras el periodo esté en 1 o 2, es decir, antes de pagar: no hay un pago que auditar. Lo que sí queda registrado es la captura viva, con autor y fecha. |
| El aviso trece bloquea Aprobar reutilizando `collectRecalculationFlags` | La bandera entra al `or` existente y `approvePayrollPeriod` ya aborta con cualquier bandera activa. Una sola regla de "no apruebes un snapshot viejo" para los trece avisos. |
| `UNIQUE (id_empleado, fecha)` global en la captura | Un día se debe una sola vez. Dejarlo por periodo permitiría capturar el mismo día en dos periodos y que cada uno creyera que le toca pagarlo. |
| El manual de usuario se actualiza en una spec aparte | Es la regla acordada para Nómina: la pantalla nueva y sus capturas se documentan juntas en una spec de manual. |

**Descartadas**

| Alternativa | Por qué no |
|---|---|
| Reabrir el periodo pagado y recalcularlo (spec 96) para pagar los días que faltaron | Sirve cuando a un periodo le faltó una persona completa, pero recomputa a todos y mueve montos ya dispersados. Si lo único que falta son N días de alguien, pagarlos en el periodo vigente no toca nada ya transferido. Las dos salidas conviven. |
| Que los días pendientes sumen a `dias` del snapshot | Movería el subsidio del ISR, los topes por día del gravado/exento y los días de IMSS, y borraría la distinción entre el sueldo del periodo y el retroactivo en el Detalle y en el CFDI. |
| Sumar el importe a la percepción de Sueldos (id 1) | `UQ (id_period_employee, id_perception)` obliga a fundirlos en una sola fila, y el Detalle fiscal y el CFDI dejarían de distinguir el retroactivo del sueldo del periodo. |
| Clave SAT 038 "Otros ingresos por salarios" | Un día de sueldo atrasado es sueldo; el contador espera 001, igual que en "Vacaciones pagadas". |
| Importe libre en pesos, sin días | Deja de ser un día pagado: se pierde el "N días × $X" del Detalle y el dato de días que el CFDI pide. Un ajuste genérico es otra spec, si alguna vez hace falta. |
| Una sola tarifa para las dos nóminas | La nómina fiscal pagaría un diario que no es el fiscal: ISR y CFDI mal, sin que nada avise. |
| Flujo de autorización en dos pasos, como horas extra | Con solo los roles 1 y 4 en el módulo, el que captura y el que autoriza serían la misma persona: una máquina de estados sin segundo actor. |
| Bloquear la captura de fechas que caen en un periodo ya calculado | Es justo el caso que la spec existe para resolver. |
| Prohibir fechas dentro del rango del periodo que paga | Suena correcto, pero un día del propio periodo que el cálculo no pagó (el empleado entró al snapshot después, o se le descontó mal) es el mismo problema con la misma solución. El ámbar ya avisa. |
| Permitir capturar en estatus 3 | Rompería el congelamiento que la spec 94 fijó para todo el módulo, y crearía un cuarto camino de corrección junto a Desaprobar, Reabrir y el periodo siguiente. |
| Detectar automáticamente los días no pagados (cruzar checadas y snapshots) | Es una spec propia y más grande: hay que decidir qué cuenta como "no pagado" en periodos nunca calculados, con faltas justificadas y con cambios de frecuencia. Queda anotada como candidata. |
| Días negativos o descuentos manuales | Una deducción manual es otro concepto, con otro catálogo (`payroll.deductions`) y otras reglas de ISR. No se cuela aquí. |
| Guardar el importe calculado en la captura | Se desactualizaría en cuanto se edite la tarifa, y el importe que manda es siempre el congelado en el snapshot. La pantalla lo muestra como estimado, como hace Bonos. |
| Bitácora de capturas borradas | No hay pago que auditar antes del estatus 3, que es donde el borrado deja de ser posible. |
| Editar una captura | Segundo camino de escritura para el mismo dato, con el riesgo de cambiar la tarifa de un día ya pagado sin que el desglose lo refleje. |

## Riesgos identificados

- **Doble pago del mismo día por dos vías distintas.** El candado `UNIQUE (id_empleado, fecha, tipo_nomina)` solo cubre días pendientes contra días pendientes. Nada impide capturar como pendiente un día que el cálculo normal **sí** pagó dentro del rango de su periodo: sería pagar el mismo día dos veces.
  - Mitigación: el aviso ámbar dice a qué periodo pertenece la fecha y en qué estatus está, el badge "Pagado en {código}" marca lo ya pagado como pendiente, y la consulta de diagnóstico de `queries.txt` permite cruzarlo a mano. Es una decisión del capturista, no un error del sistema, y bloquearlo cerraría el caso que la spec resuelve.
- **La tarifa editable es dinero escrito a mano.** Un cero de más en la tarifa paga diez veces el día, y el `CHECK` solo exige `>= 0`.
  - Mitigación: el modal muestra el importe estimado de cada nómina antes de guardar y precarga el salario actual, así que un valor fuera de lugar se ve. La tabla y la tarjeta de resumen lo muestran otra vez antes de calcular, y el Detalle lo explica después. Un tope por captura se evaluó y quedó fuera de alcance: cualquier número que se eligiera sería arbitrario.
- **Lo capturado y no recalculado no se paga, y en estatus 3 o 4 ya no hay vuelta fácil.** Capturar en un periodo en estatus 2 y aprobarlo sin recalcular dejaría el día sin pagar.
  - Mitigación: el aviso trece enciende y **Aprobar queda bloqueado** mientras haya una captura sin pagar, que es exactamente para lo que se reutiliza `collectRecalculationFlags`.
- **Las capturas de un periodo que se borra desaparecen con él.** El `ON DELETE CASCADE` a `periods` borra las capturas sin preguntar, y borrar un periodo es posible en estatus 1.
  - Mitigación: en estatus 1 nada está pagado, así que no se pierde dinero, solo trabajo de captura. La alternativa (FK sin cascada) volvería imposible borrar un periodo con capturas, que es peor.
- **Un retroactivo grande puede brincar de escalón en el ISR semanal.** Lo gravado entra completo a la base de la semana, sin el artículo 174 del RLISR que sí usan el aguinaldo y la PTU.
  - Mitigación: es el mismo tratamiento que ya tienen las horas extra y las vacaciones pagadas (spec 78, que anotó el mismo riesgo), y el Detalle muestra la base y el escalón aplicado. Repartir el retroactivo entre varios periodos es una decisión del contador: puede capturar los días en periodos distintos.
- **Dos periodos de frecuencias distintas que se solapan.** Si un empleado cambia de frecuencia, el día capturado se paga en el primer periodo que calcule cada tipo, no necesariamente en el que lo capturó.
  - Mitigación: es el mismo comportamiento del candado de horas extra (spec 61) y el aviso trece del periodo perdedor lo denuncia. El caso requiere un cambio de frecuencia a media captura.
- **`calculatePayrollPeriod` suma un concepto más a una cadena ya larga.** Cualquier cambio futuro a su `INSERT`, a sus temp tables o a sus `APPLY` puede alterar en silencio otro concepto.
  - Mitigación: el paso 5 del plan exige comparar los snapshots de un periodo ya calculado antes y después, con `calculated_at`, `calculated_by` y las dos columnas nuevas como única diferencia permitida. Es el mismo requisito que las specs 61, 68, 70 y 78 dejaron anotado.

## Lo que **no** entra en esta spec

- Las páginas del manual de usuario de Nómina.
- Días pendientes en periodos de aguinaldo y de PTU.
- Flujo de autorización en dos pasos, y editar una captura.
- Bitácora de capturas borradas.
- Detección automática de días no pagados, anotada como candidata a su propia spec.
- Descuentos, días negativos y cualquier deducción manual.
- Que los días pendientes toquen `dias`, el SBC del IMSS, el aguinaldo, la PTU o la prima vacacional.
- El artículo 174 del RLISR para el retroactivo.
- Pagar a un empleado dado de baja, que es el finiquito (spec 88).
- Recibos, timbrado del CFDI y dispersión bancaria.
- Topes de días o de importe por captura, y una segunda firma para montos grandes.
- Recalcular solo los días pendientes sin recalcular el periodo.

Cada uno de esos, si llega, va en su propia spec.
