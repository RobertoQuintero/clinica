# 89 — Reparto de PTU por empresa y ejercicio

## Header

- **Estado:** Aprobado
- **Depende de:**
  - 53 (`nomina-calculo-salario`): `payroll.period_employees`; las filas `'F'` de periodos ordinarios son la fuente de la precarga (`dias`, `importe_salario`).
  - 71 (`empleado-datos-fiscales-cfdi-nomina`): `RH.empleados.tipo_contrato`, que decide a quién se le exige el mínimo de 60 días.
  - 86 (`empleado-causas-baja`): `RH.employee_terminations`; los dados de baja en el ejercicio entran al reparto.
  - 87 (`nomina-aguinaldo-extraordinaria`): `payroll.periods.tipo_periodo`; esta spec solo lo lee, para dejar fuera de la precarga los periodos `'E'`.
- **Modifica base de datos:** Sí.
  - `RH.empleados` gana `categoria_ptu`.
  - Tablas nuevas en `payroll` para el reparto, sus trabajadores, la PTU de años anteriores y la bitácora de ediciones.
- **Fecha:** 2026-10-20
- **Objetivo:** Calcular por empresa y ejercicio cuánta PTU le toca a cada trabajador (10% de la renta gravable, mitad por días y mitad por salario fiscal), aplicando las exclusiones y los topes de la LFT, en un reparto editable que se cierra para que la spec 90 lo pague.

### Contexto (2026-10-20)

- Fuente de reglas: LFT arts. 117 a 131 (reforma de 2021) y la calculadora de Facturama (https://facturama.mx/calculadoras/ptu) como guía de pantalla. Facturama no aplica el tope de 3 meses ni el del 120% de confianza; esta spec sí.
- La PTU se reparte **por empresa (RFC)**, no por sucursal. El periodo E de la spec 87 es por sucursal, así que el cálculo vive en una entidad aparte (el reparto) y el pago en periodos extraordinarios por sucursal (spec 90).
- El catálogo `payroll.perceptions` ya tiene la PTU (`'U'`, 15 UMA por año). Su exento y su ISR son de la spec 90.
- El módulo de nómina empezó en 2026, así que puede faltar parte del año. Por eso la precarga se puede editar.
- Se dividió en dos specs:
  - **89 (esta):** el reparto.
  - **90:** el pago en nómina extraordinaria, que trae `concepto_extraordinario` en `payroll.periods`, el periodo PTU en el año de pago, el exento de 15 UMA, el ISR del art. 174 RLISR, Procesar, el Detalle y el aviso de fecha límite (30-may persona moral / 29-jun persona física).

## Alcance

**Entra:**

- **Categoría PTU del empleado.**
  - `RH.empleados` gana `categoria_ptu`: `'N'` normal (default), `'C'` confianza, `'X'` excluido (director, administrador o gerente general).
  - Todos los empleados existentes quedan `'N'`.
  - Se edita en el formulario del empleado, en la sección de datos fiscales, con un select y un texto de ayuda sobre la LFT.
- **Reparto por empresa y ejercicio** (`payroll.ptu_distributions`). Uno por `id_empresa` + `ejercicio`, garantizado con un índice único. Se captura:
  - `ejercicio`: el año fiscal de las utilidades, por ejemplo 2026;
  - `tipo_persona` (`'M'` moral / `'F'` física): aquí solo se guarda; la spec 90 lo usa para la fecha límite;
  - `renta_gravable` ≥ 0;
  - `ptu_no_cobrada_anterior` ≥ 0, default 0, que se suma al fondo (LFT art. 122);
  - `factor_tres_meses`: 90 o 91.25.
- **Fondo y mitades.**
  - Fondo = `ROUND(renta_gravable × 10%, 2) + ptu_no_cobrada_anterior`.
  - Mitad por días = `ROUND(fondo / 2, 2)`.
  - Mitad por salario = fondo − mitad por días. Así las dos mitades suman el fondo exacto.
- **Precarga de trabajadores.**
  - Entran los empleados de cualquier sucursal de la empresa con al menos una fila `'F'` de un periodo **ordinario** (`tipo_periodo = 'O'`) cuyo `fecha_fin` cae en el ejercicio. Activos y dados de baja por igual.
  - Por trabajador:
    - `dias` = `SUM(dias)`;
    - `salario` = `SUM(importe_salario)`, sin horas extra, bonos, comisiones, aguinaldo, prima ni vacaciones pagadas;
    - `salario_diario_tope` = el `salario_diario` de su fila `'F'` más reciente del ejercicio.
  - **Volver a precargar** actualiza solo las filas sin la marca `editado` y agrega las nuevas. No borra ninguna fila.
- **Agregar trabajador a mano.** Para quien trabajó en el ejercicio sin tener snapshots, por ejemplo antes del sistema.
  - Se ofrecen los empleados de la empresa con `fecha_ingreso` ≤ 31-dic del ejercicio y sin baja vigente anterior al 1-ene del ejercicio.
  - Entran con días y salario en 0 y `salario_diario_tope` = su `salario_diario_fiscal` actual.
  - Solo las filas agregadas a mano se pueden quitar.
- **Edición por trabajador.**
  - Se pueden editar `dias`, `salario` y `salario_diario_tope`.
  - Cada edición pone `editado = 1` y deja una fila en la bitácora: campo, valor anterior, valor nuevo, quién y cuándo.
- **Elegibilidad.** Cada fila del reparto queda elegible o con un motivo, en este orden:
  - `excluded_category`: `categoria_ptu = 'X'`;
  - `eventual_under_60_days`: `tipo_contrato` distinto de `'01'` y `dias` < 60. Con `tipo_contrato` en `NULL` se trata como `'01'`;
  - `no_days`: `dias` = 0.

  Los no elegibles se listan con PTU $0 y su motivo, y no cuentan en los totales.
- **Tope del 120% para confianza.**
  - `tope_salario_diario_confianza` = `ROUND(1.2 × MAX(salario_diario_tope)` de los elegibles `'N'`, 2)`.
  - El salario de reparto de cada elegible `'C'` es `min(salario, tope × dias)`.
  - Sin elegibles `'N'` no hay tope.
- **Reparto bruto** (las partes se **truncan** a centavos, no se redondean half up):
  - `ptu_dias` = truncado de `mitad_dias × dias / total_dias`.
  - `ptu_salario` = truncado de `mitad_salario × salario_reparto / total_salario_reparto`.
  - Bruto = la suma de los dos.
- **Topes del art. 127 fr. VIII.**
  - `tope_tres_meses` = `ROUND(salario_diario_tope × factor_tres_meses, 2)`.
  - `promedio_tres_anios` = el promedio de la PTU de los ejercicios −1, −2 y −3, dividido **entre los años con dato**. Si no hay ningún dato, no existe.
  - Tope = el mayor de los dos. `ptu_final` = `min(bruto, tope)`.
- **Remanente.** Remanente = fondo − `SUM(ptu_final)`. **No se redistribuye.** Se muestra separado en lo que excede los topes y en la diferencia por redondeo.
- **PTU de años anteriores** (`payroll.ptu_history`).
  - Captura manual por trabajador y ejercicio, desde el reparto.
  - Para un ejercicio que ya tiene un reparto **cerrado** de la misma empresa, se usa el `ptu_final` de ese reparto y la captura manual de ese año se ignora.
- **Recálculo automático.** Cada escritura recalcula todo el reparto en la misma transacción. Eso incluye guardar parámetros, precargar, agregar, quitar, editar y capturar historial. Por eso no hay botón "Calcular" ni un estado desfasado.
- **Ciclo de vida.**
  - Borrador (`'B'`): todo se edita.
  - **Cerrar** (`'C'`) exige `renta_gravable` > 0 y al menos un trabajador elegible. Un reparto cerrado es de solo lectura.
  - **Reabrir** vuelve a `'B'`. En esta spec siempre se permite; la spec 90 lo bloqueará si un periodo PTU ya lo usa.
  - **Eliminar** solo se permite en borrador.
- **Pantallas** (roles 1 y 4, se usa `frontend-design`):
  - `/dashboard/nomina/ptu`: lista de repartos de la empresa por ejercicio, con el fondo, el total repartido, el remanente y el estado, más el modal para crear un reparto.
  - `/dashboard/nomina/ptu/[id]`:
    - parámetros;
    - tarjetas de resumen: fondo, mitades, total de días, total de salario, factores, tope del 120%, total repartido y remanente;
    - la tabla de trabajadores: Nombre, Sucursal, Categoría, Días, Salario, Salario de reparto, PTU días, PTU salario, Bruto, Tope 3 meses, Promedio 3 años, PTU final y Motivo;
    - modales para editar una fila, agregar un trabajador y capturar el historial;
    - la bitácora y las acciones Cerrar, Reabrir y Eliminar.
  - Una entrada "PTU" en la navegación de Nómina.
- **Cálculo puro en TS:** el cálculo completo del reparto en `lib/payroll/`.
- **Permisos y validación:** `assertPayrollAccess()` en todas las acciones, el `id_empresa` sale de la sesión y `zod` valida todas las entradas.
- **Documentación:** `docs/nomina.md` y `docs/rh-empleados.md`, más el DDL en `queries.txt`.

**Fuera de alcance:**

- **Pagar la PTU** (spec 90): el concepto en periodos, el periodo PTU, el exento de 15 UMA, el ISR del art. 174, Procesar, el Detalle y el aviso de fecha límite.
- PTU operativa: solo se usa salario fiscal.
- Calcular la renta gravable desde la declaración, aplicar pérdidas de ejercicios anteriores y la exención de empresas de nueva creación. La renta gravable se captura ya calculada.
- Redistribuir el remanente.
- Llevar la PTU no cobrada de un reparto al siguiente de forma automática. Se captura a mano.
- Registrar incapacidades por maternidad o riesgo de trabajo. Se ajustan editando los días.
- Promediar salario variable.
- La comisión mixta, el proyecto de reparto para objeciones (art. 125) y las constancias.
- Repartir el pago entre las sucursales donde trabajó el empleado.

## Modelo de datos

### SQL (DDL en `queries.txt`: bloque `RECURSOS HUMANOS(EMPLEADOS)` para la columna y bloque `NOMINA PAYROLL`, después de la spec 87, para las tablas)

```sql
-- Spec 89: categoría PTU. Todos los existentes quedan 'N'.
ALTER TABLE [RH].[empleados] ADD [categoria_ptu] [char](1) NOT NULL
    CONSTRAINT [DF_empleados_categoria_ptu] DEFAULT ('N')
    CONSTRAINT [CK_empleados_categoria_ptu] CHECK ([categoria_ptu] IN ('N','C','X'));
GO

-- Un reparto por empresa y ejercicio. Las columnas derivadas se reescriben en cada recálculo.
CREATE TABLE [payroll].[ptu_distributions](
    [id_ptu_distribution]           [int] IDENTITY(1,1) NOT NULL,
    [id_empresa]                    [int]           NOT NULL,
    [ejercicio]                     [smallint]      NOT NULL,   -- año de las utilidades
    [tipo_persona]                  [char](1)       NOT NULL,   -- 'M' moral, 'F' física (lo usa la spec 90)
    [renta_gravable]                [decimal](18,2) NOT NULL,
    [ptu_no_cobrada_anterior]       [decimal](18,2) NOT NULL CONSTRAINT [DF_ptu_distributions_no_cobrada] DEFAULT (0),
    [factor_tres_meses]             [decimal](5,2)  NOT NULL,   -- 90.00 | 91.25
    [estado]                        [char](1)       NOT NULL CONSTRAINT [DF_ptu_distributions_estado] DEFAULT ('B'),
    -- Derivadas
    [fondo]                         [decimal](18,2) NOT NULL,
    [mitad_dias]                    [decimal](18,2) NOT NULL,
    [mitad_salario]                 [decimal](18,2) NOT NULL,
    [total_dias]                    [int]           NOT NULL,   -- solo elegibles
    [total_salario_reparto]         [decimal](18,2) NOT NULL,   -- solo elegibles, ya con tope 120%
    [tope_salario_diario_confianza] [decimal](18,2) NULL,       -- NULL sin elegibles 'N'
    [total_repartido]               [decimal](18,2) NOT NULL,   -- SUM(ptu_final)
    [remanente_topes]               [decimal](18,2) NOT NULL,   -- SUM(bruto − final)
    [remanente_redondeo]            [decimal](18,2) NOT NULL,   -- fondo − SUM(bruto)
    -- Auditoría
    [created_by]                    [int]           NOT NULL,
    [created_at]                    [datetime2](0)  NOT NULL,
    [updated_at]                    [datetime2](0)  NOT NULL,
    [cerrado_by]                    [int]           NULL,
    [cerrado_at]                    [datetime2](0)  NULL,
 CONSTRAINT [PK_ptu_distributions] PRIMARY KEY CLUSTERED ([id_ptu_distribution] ASC),
 CONSTRAINT [UQ_ptu_distributions_empresa_ejercicio] UNIQUE ([id_empresa], [ejercicio]),
 CONSTRAINT [CK_ptu_distributions_valores] CHECK (
     [tipo_persona] IN ('M','F')
     AND [estado] IN ('B','C')
     AND [factor_tres_meses] IN (90.00, 91.25)
     AND [renta_gravable] >= 0 AND [ptu_no_cobrada_anterior] >= 0
     AND [mitad_dias] + [mitad_salario] = [fondo]
     AND [remanente_topes] >= 0 AND [remanente_redondeo] >= 0
     AND [total_repartido] + [remanente_topes] + [remanente_redondeo] = [fondo]),
 CONSTRAINT [CK_ptu_distributions_cierre] CHECK (
     ([estado] = 'B' AND [cerrado_by] IS NULL AND [cerrado_at] IS NULL)
  OR ([estado] = 'C' AND [cerrado_by] IS NOT NULL AND [cerrado_at] IS NOT NULL))
) ON [PRIMARY]
GO

-- Un renglón por trabajador del reparto.
CREATE TABLE [payroll].[ptu_distribution_employees](
    [id_ptu_distribution_employee]  [int] IDENTITY(1,1) NOT NULL,
    [id_ptu_distribution]           [int]           NOT NULL,
    [id_empleado]                   [int]           NOT NULL,
    [id_sucursal]                   [int]           NOT NULL,   -- la actual del empleado; se congela al cerrar
    [origen]                        [char](1)       NOT NULL,   -- 'P' precarga, 'M' agregado a mano
    [editado]                       [bit]           NOT NULL CONSTRAINT [DF_ptu_distribution_employees_editado] DEFAULT (0),
    -- Entradas (precarga o edición)
    [dias]                          [smallint]      NOT NULL,
    [salario]                       [decimal](18,2) NOT NULL,
    [salario_diario_tope]           [decimal](18,2) NOT NULL,
    -- Congeladas del empleado en cada recálculo
    [categoria_ptu]                 [char](1)       NOT NULL,
    [tipo_contrato]                 [varchar](2)    NULL,
    -- Derivadas
    [elegible]                      [bit]           NOT NULL,
    [motivo]                        [varchar](30)   NULL,
    [salario_reparto]               [decimal](18,2) NULL,
    [ptu_dias]                      [decimal](18,2) NULL,
    [ptu_salario]                   [decimal](18,2) NULL,
    [ptu_bruto]                     [decimal](18,2) NULL,
    [tope_tres_meses]               [decimal](18,2) NULL,
    [promedio_tres_anios]           [decimal](18,2) NULL,       -- NULL sin datos
    [anios_promedio]                [tinyint]       NULL,       -- 1..3; NULL sin datos
    [ptu_final]                     [decimal](18,2) NOT NULL,
 CONSTRAINT [PK_ptu_distribution_employees] PRIMARY KEY CLUSTERED ([id_ptu_distribution_employee] ASC),
 CONSTRAINT [UQ_ptu_distribution_employees] UNIQUE ([id_ptu_distribution], [id_empleado]),
 CONSTRAINT [FK_ptu_distribution_employees_distribution] FOREIGN KEY ([id_ptu_distribution])
     REFERENCES [payroll].[ptu_distributions] ([id_ptu_distribution]) ON DELETE CASCADE,
 CONSTRAINT [FK_ptu_distribution_employees_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado]),
 CONSTRAINT [CK_ptu_distribution_employees_entradas] CHECK (
     [origen] IN ('P','M') AND [categoria_ptu] IN ('N','C','X')
     AND [dias] BETWEEN 0 AND 366 AND [salario] >= 0 AND [salario_diario_tope] >= 0),
 CONSTRAINT [CK_ptu_distribution_employees_reparto] CHECK (
     ([elegible] = 0
        AND [motivo] IS NOT NULL
        AND [motivo] IN ('excluded_category','eventual_under_60_days','no_days')
        AND [ptu_final] = 0)
  OR ([elegible] = 1
        AND [motivo] IS NULL
        AND [salario_reparto] IS NOT NULL AND [ptu_dias] IS NOT NULL
        AND [ptu_salario] IS NOT NULL AND [ptu_bruto] IS NOT NULL
        AND [tope_tres_meses] IS NOT NULL
        AND [ptu_bruto] = [ptu_dias] + [ptu_salario]
        AND [ptu_final] <= [ptu_bruto]
        AND ([promedio_tres_anios] IS NULL OR [anios_promedio] IS NOT NULL)))
) ON [PRIMARY]
GO

-- PTU de años anteriores capturada a mano. Si el ejercicio tiene un reparto cerrado
-- de la empresa, ese reparto gana y esta fila se ignora.
CREATE TABLE [payroll].[ptu_history](
    [id_empleado]  [int]           NOT NULL,
    [ejercicio]    [smallint]      NOT NULL,
    [importe]      [decimal](18,2) NOT NULL,
    [captured_by]  [int]           NOT NULL,
    [captured_at]  [datetime2](0)  NOT NULL,
 CONSTRAINT [PK_ptu_history] PRIMARY KEY CLUSTERED ([id_empleado], [ejercicio]),
 CONSTRAINT [FK_ptu_history_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado]),
 CONSTRAINT [CK_ptu_history_importe] CHECK ([importe] >= 0)
) ON [PRIMARY]
GO

-- Bitácora del reparto. Se borra junto con un reparto en borrador.
CREATE TABLE [payroll].[ptu_distribution_log](
    [id_ptu_distribution_log] [int] IDENTITY(1,1) NOT NULL,
    [id_ptu_distribution]     [int]           NOT NULL,
    [id_empleado]             [int]           NULL,         -- NULL en acciones del reparto
    [accion]                  [char](1)       NOT NULL,
    [campo]                   [varchar](40)   NULL,
    [valor_anterior]          [nvarchar](100) NULL,
    [valor_nuevo]             [nvarchar](100) NULL,
    [changed_by]              [int]           NOT NULL,
    [changed_at]              [datetime2](0)  NOT NULL,
 CONSTRAINT [PK_ptu_distribution_log] PRIMARY KEY CLUSTERED ([id_ptu_distribution_log] ASC),
 CONSTRAINT [FK_ptu_distribution_log_distribution] FOREIGN KEY ([id_ptu_distribution])
     REFERENCES [payroll].[ptu_distributions] ([id_ptu_distribution]) ON DELETE CASCADE,
 CONSTRAINT [CK_ptu_distribution_log_accion] CHECK ([accion] IN ('P','R','A','Q','E','H','C','O'))
) ON [PRIMARY]
GO
```

Acciones de la bitácora:

| Clave | Acción |
|---|---|
| `P` | Parámetros |
| `R` | Precarga |
| `A` | Agregar trabajador |
| `Q` | Quitar trabajador |
| `E` | Edición de una fila (una entrada por campo) |
| `H` | Historial |
| `C` | Cerrar |
| `O` | Reabrir |

Guardar sin cambios no escribe nada en la bitácora.

### TypeScript

- `interfaces/employee.ts`: `IEmployee` gana `categoria_ptu: PtuCategory`.
- `interfaces/payroll_ptu.ts` (nuevo):

```ts
export type PtuCategory = "N" | "C" | "X";
export type PtuDistributionStatus = "B" | "C";
export type PtuTaxpayerType = "M" | "F";
export type PtuThreeMonthsFactor = 90 | 91.25;
export type PtuIneligibilityReason = "excluded_category" | "eventual_under_60_days" | "no_days";

export interface IPtuDistribution { /* columnas de ptu_distributions, fechas como string */ }
export interface IPtuDistributionEmployee { /* columnas de ptu_distribution_employees + nombre, código y sucursal */ }
export interface IPtuHistoryEntry { ejercicio: number; importe: number; origen: "reparto" | "manual" }
```

### Constantes (`lib/payroll/constants.ts`)

```ts
export const PTU_PROFIT_SHARE_PERCENT = 10;
export const PTU_THREE_MONTHS_FACTORS: readonly PtuThreeMonthsFactor[] = [90, 91.25];
export const PTU_EVENTUAL_MINIMUM_DAYS = 60;
export const PTU_TRUST_SALARY_CAP_FACTOR = 1.2;
export const PTU_PERMANENT_CONTRACT_TYPE = "01";   // c_TipoContrato: tiempo indeterminado
export const PTU_AVERAGE_YEARS = 3;

export const PTU_CATEGORY_LABELS: Record<PtuCategory, string> = {
  N: "Normal",
  C: "Confianza (tope 120%)",
  X: "Excluido (director, administrador o gerente general)",
};
export const PTU_INELIGIBILITY_REASON_LABELS: Record<PtuIneligibilityReason, string> = {
  excluded_category: "Excluido: director, administrador o gerente general",
  eventual_under_60_days: "Eventual con menos de 60 días",
  no_days: "Sin días trabajados",
};
export const PTU_DISTRIBUTION_STATUS_LABELS: Record<PtuDistributionStatus, string> = { B: "Borrador", C: "Cerrado" };
export const PTU_TAXPAYER_TYPE_LABELS: Record<PtuTaxpayerType, string> = { M: "Persona moral", F: "Persona física" };
```

### Módulos nuevos (todos en `lib/payroll/`)

| Archivo | Tipo | Contenido |
|---|---|---|
| `ptuDistribution.ts` | puro | `calculatePtuDistribution(parameters, rows, historyByEmployee)`: devuelve las columnas derivadas del reparto y de cada fila; trabaja en enteros de centavos. También `resolvePtuIneligibility(row)` y `averagePtuHistory(entries)` |
| `ptuSchemas.ts` | — | `zod`: parámetros, edición de fila, agregar, quitar e historial |
| `ptuDistributionSql.ts` | `server-only` | Consulta de precarga (filas `'F'` de periodos `'O'` del ejercicio, por empresa) y lectura del historial (repartos cerrados + `ptu_history`) |

### Convenciones

- **El cálculo vive en TS**, no en SQL. Cada acción abre `db.transaction`, lee el reparto y sus filas `WITH (UPDLOCK, HOLDLOCK)`, aplica el cambio, llama a `calculatePtuDistribution` y escribe todas las derivadas. **Es el único cálculo y no hay espejo**. Es un cambio respecto de las specs 56 a 87; se justifica en Decisiones.
- **Redondeo de las partes: truncado a centavos**, no half up. Así `SUM(ptu_dias) ≤ mitad_dias` y `SUM(ptu_salario) ≤ mitad_salario`, el `remanente_redondeo` nunca es negativo y nunca se reparte más que el fondo. Fondo, mitades, topes y promedio usan half up.
- **Ejercicios del promedio:** `ejercicio − 1`, `− 2` y `− 3`. Por año se toma el `ptu_final` del reparto cerrado de la empresa si existe; si no, `ptu_history`. Un año sin ninguno de los dos no cuenta.
- **Empresa del empleado:** se toma de `sucursales.id_empresa` de su `id_sucursal` actual. El reparto solo ve empleados de la empresa de la sesión.
- Las fechas viajan como strings; las lecturas usan `CONVERT(varchar(10|19), …, 120)` y las escrituras `buildDate(new Date())`.

## Plan de implementación

1. **DDL.**
   - Se agregan a `queries.txt`:
     - `categoria_ptu` en `RH.empleados`, en el bloque `RECURSOS HUMANOS(EMPLEADOS)`;
     - las cuatro tablas de `payroll`, en el bloque `NOMINA PAYROLL`, después de la spec 87.
   - Se ejecuta contra la base de desarrollo.
   - *Verificación:*
     - Todos los empleados existentes quedan `'N'`.
     - Un segundo reparto con la misma empresa y ejercicio falla por `UQ_ptu_distributions_empresa_ejercicio`.
     - Insertar a mano un reparto con `factor_tres_meses = 92` falla por `CK_ptu_distributions_valores`.
     - Una fila no elegible con `ptu_final > 0` falla por `CK_ptu_distribution_employees_reparto`.

2. **Categoría PTU en el empleado.**
   - `IEmployee` y el esquema `zod` del formulario ganan `categoria_ptu`.
   - `createEmployee` y `updateEmployee` la escriben, y el SELECT del empleado la devuelve.
   - El formulario muestra un select con `PTU_CATEGORY_LABELS` en la sección de datos fiscales, con un texto de ayuda sobre LFT art. 127 fr. I y II.
   - Se usa `frontend-design`.
   - *Verificación:*
     - Crear un empleado sin tocar el campo lo guarda `'N'`.
     - Cambiarlo a `'C'` y recargar la página lo conserva.
     - Mandar `'Z'` desde el cliente devuelve `{ ok: false }`.

3. **Tipos, constantes y cálculo puro, sin UI.**
   - `interfaces/payroll_ptu.ts`, las constantes de la spec, `lib/payroll/ptuSchemas.ts` y `lib/payroll/ptuDistribution.ts` (`calculatePtuDistribution`, `resolvePtuIneligibility`, `averagePtuHistory`).
   - *Verificación:* `npx tsc --noEmit` y `npm run lint` limpios. Se prueba con un script temporal en el scratchpad usando este **caso de referencia**: renta gravable $1,000,000, sin PTU no cobrada, factor 90.

     | Trabajador | Categoría | Contrato | Días | Salario | Salario diario tope |
     |---|---|---|---|---|---|
     | A | N | 01 | 365 | 182,500.00 | 500.00 |
     | B | N | 01 | 365 | 109,500.00 | 300.00 |
     | C | C | 01 | 365 | 365,000.00 | 1,000.00 |
     | D | N | 02 | 45 | 22,500.00 | 500.00 |
     | E | X | 01 | 365 | 730,000.00 | 2,000.00 |

     - El fondo es $100,000.00 y cada mitad $50,000.00.
     - D queda `eventual_under_60_days` y E queda `excluded_category`, los dos con $0.
     - El tope de confianza es 1.2 × 500 = **$600.00 diarios**, así que el salario de reparto de C es **$219,000.00**.
     - Total de días: 1,095. Total de salario de reparto: $511,000.00.
     - PTU por días: **$16,666.66** cada uno.
     - PTU por salario: A **$17,857.14**, B **$10,714.28**, C **$21,428.57**.
     - Bruto: A **$34,523.80**, B **$27,380.94**, C **$38,095.23**.
     - El tope de 3 meses de B es $27,000.00, así que su PTU final es **$27,000.00**.
     - El total repartido es **$99,619.03**, el remanente por topes **$380.94** y el remanente por redondeo **$0.03**. Los tres suman $100,000.00.
     - Si B tiene historial 2025 de $30,000, el promedio es $30,000.00 (1 año). Ese promedio gana, su PTU final vuelve a **$27,380.94** y el remanente por topes queda en $0.
     - Con factor 91.25 el tope de B es $27,375.00 y su PTU final **$27,375.00**.
     - Un reparto sin elegibles deja todas las derivadas en 0 y no truena.

4. **Lista de repartos, alta, edición de parámetros y eliminación.**
   - `app/dashboard/nomina/ptu/actions.ts`: `getPtuDistributions`, `createPtuDistribution`, `updatePtuDistributionParameters` (bitácora `P`) y `deletePtuDistribution` (solo en borrador).
   - Todas pasan por `assertPayrollAccess()`, toman el `id_empresa` de la sesión y validan con `zod`.
   - `createPtuDistribution` revisa el duplicado dentro de la transacción y responde "Ya existe el reparto de PTU de {ejercicio}", también si salta el índice.
   - `page.tsx` es un Server Component con la tabla. Los únicos Client Components son `PtuDistributionModal` y `DeletePtuDistributionButton`, con confirmación en la UI y sin `confirm()` nativo.
   - Se agrega la entrada "PTU" a la navegación de Nómina en `navConfig.tsx`, con los mismos `excludeRoles`. `proxy.ts` ya cubre `/dashboard/nomina/*`.
   - Se usa `frontend-design`.
   - *Verificación:*
     - Crear el reparto de 2026 lo muestra en la lista con fondo $0 y sin trabajadores.
     - Un segundo reparto de 2026 se rechaza.
     - Editar la renta gravable recalcula el fondo y deja una entrada `P` en la bitácora.
     - Un rol 2 recibe `{ ok: false }` y no ve la entrada en la navegación.

5. **Precarga y vista del reparto.**
   - `lib/payroll/ptuDistributionSql.ts` con la consulta de precarga y la lectura del historial.
   - `precargarPtuDistribution` agrega a los que faltan, actualiza las filas con `editado = 0` y recalcula, con una entrada `R` en la bitácora que dice cuántos agregó y cuántos actualizó.
   - `getPtuDistributionDetail(id)` devuelve el reparto, las filas con nombre, código y sucursal, y la bitácora.
   - `ptu/[id]/page.tsx` es un Server Component con:
     - `PtuDistributionSummaryCards`;
     - `PtuDistributionEmployeesTable`, donde los no elegibles muestran su motivo y la fila editada lleva una marca;
     - `PtuDistributionLog`, un `<details>` con las últimas 20 entradas.
   - `notFound()` si el reparto no es de la empresa de la sesión.
   - Se usa `frontend-design`.
   - *Verificación:*
     - Con nómina fiscal de 2026 calculada, la precarga trae a todos los que tienen filas `'F'` ordinarias del año, de todas las sucursales de la empresa, incluso un dado de baja.
     - Los días y el salario coinciden con `SUM(dias)` y `SUM(importe_salario)` hechos a mano en SQL.
     - Las filas de periodos `'E'` (aguinaldo) no suman.
     - Precargar dos veces seguidas no duplica filas ni cambia nada la segunda vez.

6. **Edición de filas, agregar y quitar trabajador.**
   - `updatePtuDistributionEmployee` (días, salario y salario diario tope; pone `editado = 1`; una entrada `E` por campo que cambió).
   - `addPtuDistributionEmployee` (origen `'M'`, en ceros, con `salario_diario_tope` = `salario_diario_fiscal` actual; entrada `A`).
   - `removePtuDistributionEmployee` (solo origen `'M'`; entrada `Q`).
   - Las tres rechazan un reparto cerrado.
   - Client Components: `PtuEmployeeEditModal`, `AddPtuEmployeeModal` (lista los empleados elegibles según el alcance) y `RemovePtuEmployeeButton`.
   - *Verificación:*
     - Editar los días de una fila recalcula los totales y la PTU de **todas** las filas.
     - Volver a precargar después no pisa la fila editada.
     - Un agregado a mano se puede quitar; uno precargado no ofrece "Quitar".
     - Guardar sin cambios no escribe en la bitácora.

7. **Historial de PTU de años anteriores.**
   - `getPtuHistory(id_empleado, ejercicio)` devuelve los tres ejercicios anteriores con su origen: reparto o manual.
   - `savePtuHistory` crea, edita o borra una captura manual (entrada `H`) y recalcula el reparto.
   - `PtuHistoryModal` muestra los años que vienen de un reparto cerrado como solo lectura.
   - *Verificación:*
     - Con el caso del paso 3 cargado en la base, capturar $30,000 de 2025 para B lleva su PTU final de $27,000.00 a $27,380.94.
     - Borrar la captura la regresa a $27,000.00.
     - El promedio muestra "1 año".

8. **Cerrar y reabrir.**
   - `closePtuDistribution` exige `renta_gravable > 0` y al menos un elegible, congela `id_sucursal` y escribe `cerrado_by` y `cerrado_at` (entrada `C`).
   - `reopenPtuDistribution` vuelve a `'B'` y limpia el cierre (entrada `O`).
   - Con el reparto cerrado, la vista oculta todas las acciones de edición y las acciones las rechazan.
   - `PtuDistributionStatusActions` es un Client Component con confirmación en la UI.
   - *Verificación:*
     - Cerrar sin renta gravable da un mensaje claro.
     - Ya cerrado, editar una fila desde una pestaña vieja devuelve `{ ok: false }`.
     - Con el reparto de 2026 cerrado, el historial de un reparto 2027 muestra 2026 como "reparto" y no como captura manual.
     - Reabrir permite editar otra vez.

9. **Documentación.**
   - `docs/nomina.md` gana la sección "PTU: reparto (spec 89)" y actualiza:
     - la lista de pantallas;
     - el "Out of scope" de las specs 69 y 87, donde PTU pasa a "reparto hecho, pago en spec 90";
     - la sección UI.
   - `docs/rh-empleados.md` documenta `categoria_ptu`.
   - *Verificación:* el DDL de `queries.txt` coincide con lo ejecutado, y `tsc` y `lint` quedan limpios.

## Criterios de aceptación

**Categoría del empleado**

- [ ] Todos los empleados existentes quedan con `categoria_ptu = 'N'`, y un empleado nuevo sin el campo se guarda `'N'`.
- [ ] El formulario del empleado permite elegir Normal, Confianza o Excluido. Un valor fuera de `'N' | 'C' | 'X'` devuelve `{ ok: false }`.

**Reparto**

- [ ] Se puede crear un reparto por empresa y ejercicio. Un segundo reparto del mismo ejercicio se rechaza con "Ya existe el reparto de PTU de {ejercicio}".
- [ ] Fondo = `ROUND(renta_gravable × 10%, 2) + ptu_no_cobrada_anterior`, y las dos mitades suman el fondo exacto.
- [ ] El factor de 3 meses solo acepta 90 o 91.25.
- [ ] Un reparto solo muestra empleados de la empresa de la sesión. Abrir el de otra empresa da 404.

**Precarga y edición**

- [ ] La precarga trae a todos los empleados de la empresa, de cualquier sucursal y activos o dados de baja, que tengan al menos una fila `'F'` de un periodo ordinario con `fecha_fin` en el ejercicio.
- [ ] Los días y el salario precargados son `SUM(dias)` y `SUM(importe_salario)` de esas filas. Las filas de periodos `'E'` no cuentan.
- [ ] Precargar de nuevo no duplica filas, no pisa las filas editadas y no borra ninguna.
- [ ] "Agregar trabajador" ofrece solo a los empleados de la empresa con `fecha_ingreso` ≤ 31-dic del ejercicio y sin baja vigente anterior al 1-ene. El agregado entra en ceros.
- [ ] Solo las filas agregadas a mano se pueden quitar.
- [ ] Cada escritura recalcula todo el reparto en la misma transacción. No existe ningún estado en el que las derivadas no correspondan a las entradas.

**Reglas del cálculo**

- [ ] Una fila `'X'` queda no elegible con "Excluido: director, administrador o gerente general" y $0.
- [ ] Una fila con `tipo_contrato` distinto de `'01'` y menos de 60 días queda no elegible con "Eventual con menos de 60 días". Con `'01'` o `NULL` entra aunque tenga menos de 60 días.
- [ ] Una fila con 0 días queda no elegible con "Sin días trabajados".
- [ ] Los no elegibles no suman a `total_dias` ni a `total_salario_reparto`.
- [ ] El salario de reparto de un elegible `'C'` es `min(salario, ROUND(1.2 × máximo salario_diario_tope de los elegibles 'N', 2) × dias)`. Sin elegibles `'N'` no tiene tope.
- [ ] `ptu_dias` y `ptu_salario` se truncan a centavos, así que el total repartido nunca supera el fondo.
- [ ] `ptu_final = min(bruto, max(tope_tres_meses, promedio_tres_anios))`, y el promedio solo divide entre los años con dato.
- [ ] Para un ejercicio con reparto cerrado de la empresa, el historial usa su `ptu_final` e ignora la captura manual.
- [ ] `total_repartido + remanente_topes + remanente_redondeo = fondo` en todo reparto. El remanente no se redistribuye.
- [ ] El caso de referencia del plan (paso 3) da exactamente:
  - A **$34,523.80**, B **$27,000.00**, C **$38,095.23**, y D y E en $0;
  - total repartido **$99,619.03**, remanente por topes **$380.94** y remanente por redondeo **$0.03**;
  - con historial 2025 de $30,000 para B, B queda en **$27,380.94**;
  - con factor 91.25 y sin historial, B queda en **$27,375.00**.

**Ciclo de vida y bitácora**

- [ ] Cerrar exige renta gravable > 0 y al menos un elegible, y congela `id_sucursal`.
- [ ] Un reparto cerrado no acepta ninguna escritura, ni siquiera desde una pestaña vieja.
- [ ] Reabrir regresa el reparto a borrador y permite editar.
- [ ] Solo un reparto en borrador se puede eliminar, y al eliminarlo se borran sus filas y su bitácora.
- [ ] Cada cambio real de parámetros, precarga, agregar, quitar, edición (una entrada por campo), historial, cierre y reapertura deja su entrada en la bitácora. Guardar sin cambios no deja nada.

**Calidad**

- [ ] Todas las acciones nuevas pasan por `assertPayrollAccess()` y validan con `zod`. Un rol distinto de 1 y 4 recibe `{ ok: false }` y no ve "PTU" en la navegación.
- [ ] Ninguna fecha viaja como `Date`.
- [ ] Las páginas son Server Components y solo los modales y botones de acción son `"use client"`.
- [ ] `npx tsc --noEmit` y `npm run lint` sin errores.
- [ ] `docs/nomina.md`, `docs/rh-empleados.md` y `queries.txt` quedan actualizados.

## Decisiones

**Tomadas**

| Decisión | Por qué |
|---|---|
| Dividir PTU en dos specs: 89 reparto y 90 pago en nómina extraordinaria | Son dominios distintos (reglas de la LFT y nómina/ISR). Con la 89 el contador puede validar los montos antes de que exista el pago. |
| El reparto es por **empresa** y ejercicio, no por sucursal | La LFT reparte la PTU por patrón (RFC). Los totales de días y salario son de toda la empresa. |
| Una entidad propia (`payroll.ptu_distributions`) en vez de calcular dentro del periodo E | El periodo E es por sucursal (spec 87). Calcular ahí repartiría mal el fondo. |
| Solo nómina fiscal | La renta gravable es un dato fiscal. La operativa no tiene PTU. |
| Capturar la renta gravable y sacar el 10% en el sistema, más la PTU no cobrada del ejercicio anterior | Es el dato que da la declaración anual. La PTU no cobrada se suma al fondo por el art. 122. |
| Precargar desde los snapshots fiscales ordinarios y dejar editar | El módulo empezó en 2026, y la edición cubre los meses anteriores al sistema y las incapacidades que el sistema no registra. |
| Salario = `SUM(importe_salario)`, sin horas extra, bonos, comisiones, aguinaldo, prima ni vacaciones pagadas | Art. 124 LFT: cuenta la cuota diaria, no las gratificaciones ni los extras. |
| Días = `SUM(dias)` de los snapshots | Ya vienen sin las faltas injustificadas. Las vacaciones disfrutadas cuentan como días pagados. |
| `categoria_ptu` en `RH.empleados` (`N`, `C`, `X`) | Ser de confianza o directivo es un atributo de la persona, no del puesto. Se congela en la fila en cada recálculo. |
| El mínimo de 60 días solo aplica si `tipo_contrato` es distinto de `'01'` | La LFT exige los 60 días solo a los eventuales. `NULL` cuenta como `'01'` para no excluir a nadie por falta de un dato. |
| Los dados de baja en el ejercicio entran | Tienen derecho por los días que trabajaron. |
| Los excluidos y los no elegibles se listan con $0 y su motivo | Deja claro por qué alguien no cobra. |
| Tope de confianza = 1.2 × el salario diario más alto de los elegibles `'N'` | Art. 127 fr. II. Los elegibles `'N'` son los trabajadores de base del reparto. Sin ninguno no hay contra qué topar. |
| Topes del art. 127 fr. VIII: el mayor entre 3 meses y el promedio de 3 años | Es lo que manda la reforma de 2021. Facturama no los aplica. |
| Factor de 3 meses configurable (90 o 91.25) por reparto | Hay dos criterios en uso. Lo decide el contador en cada ejercicio. |
| Promedio de 3 años dividido entre los años con dato | Es lo más favorable al trabajador. Dividir entre 3 fijo castigaría a quien tiene menos de 3 años de historial. |
| Para el historial gana el reparto cerrado del sistema sobre la captura manual | Una sola fuente por año. La captura manual solo cubre lo que pasó antes del sistema. |
| El remanente por topes no se redistribuye y se muestra aparte | Es el criterio más común y el más fácil de auditar. Hay que confirmarlo con el contador. |
| Partes truncadas a centavos | Garantiza que nunca se reparta más que el fondo. La diferencia queda visible como remanente por redondeo. |
| Recálculo automático en cada escritura, sin botón "Calcular" | No puede quedar un estado en el que lo que se ve no corresponda a las entradas. |
| Volver a precargar respeta las filas editadas y nunca borra | Una corrección a mano no se pierde por refrescar. |
| Solo se pueden quitar las filas agregadas a mano | Una precargada volvería con la siguiente precarga. Para sacarla se ponen sus días en 0. |
| Dos estados: Borrador y Cerrado | El cierre es el contrato con la spec 90, que solo pagará repartos cerrados. |
| Reabrir siempre se permite en esta spec | Todavía no hay periodo PTU que lo use. La spec 90 agregará el bloqueo. |
| El cálculo vive en TS, sin espejo en SQL | Son decenas de filas con topes encadenados. Una sola implementación evita las divergencias SQL/TS de las specs 56 a 87, y la transacción con `UPDLOCK, HOLDLOCK` mantiene la consistencia. |
| La sucursal de cada fila es la actual del empleado y se congela al cerrar | Así la spec 90 sabe en qué periodo paga cada uno, incluso a los dados de baja. |
| `tipo_persona` se captura aquí aunque lo use la spec 90 | Es un dato del reparto. Así la spec 90 no tiene que suponerlo. |
| Bitácora con una entrada por campo cambiado | Mismo patrón que las configuraciones de nómina (specs 57, 60 y 69). |

**Descartadas**

| Alternativa | Por qué no |
|---|---|
| Calcular la PTU dentro del periodo E de cada sucursal | El fondo y los totales son de toda la empresa, así que cada sucursal repartiría mal. |
| Una sola spec con reparto y pago | Toca tres zonas del sistema y decisiones en cuatro dominios. |
| PTU también en la operativa | No hay un fondo operativo definido. La obligación es fiscal. |
| Capturar directamente el monto a repartir | Pierde la trazabilidad con la declaración y la PTU no cobrada. |
| Calcular días y salario por calendario (ingreso, baja y salario actual) | Ignora las faltas y los cambios de salario del año. |
| Precarga sin edición | No cubre los meses anteriores al sistema ni las incapacidades. |
| `categoria_ptu` en `RH.puestos` o solo dentro del reparto | El puesto no define la relación de confianza, y marcarlo en cada reparto se olvida. |
| Exigir 60 días a todos, como Facturama | La LFT solo se los exige a los eventuales. |
| No aplicar topes, o solo el de 3 meses | Incumple el art. 127 fr. VIII o le quita al trabajador la opción más favorable. |
| Redistribuir el remanente en vueltas sucesivas | La ley no lo pide, y es más complejo de auditar. |
| Redondeo half up de cada parte | La suma puede pasar el fondo por centavos. |
| Botón "Calcular" explícito | Puede dejar el reparto desfasado de las entradas. |
| Volver a precargar sobrescribiendo todo | Pierde las correcciones manuales. |
| Cálculo en SQL con espejo en TS | Duplica unas reglas encadenadas con riesgo de divergir, para un volumen chico. |
| Promedio de 3 años dividido entre 3 fijo | Desfavorable para quien tiene menos historial. |

## Riesgos identificados

- **Criterio del remanente sin confirmar.** La LFT no dice qué pasa con lo que excede los topes. Si el contador o la STPS piden redistribuirlo, el cálculo cambia. Mitigación: el remanente por topes se guarda aparte y se ve en el resumen; antes de cerrar el primer reparto, el contador confirma el criterio.
- **Renta gravable mal capturada.** Un error en la renta gravable reparte mal a toda la empresa. Mitigación: la bitácora registra quién la cambió y cuándo, el fondo se ve en la primera tarjeta, y el reparto solo se paga después de cerrarlo (spec 90).
- **Año incompleto en el sistema.** Si la nómina fiscal de 2026 empezó a mitad de año, la precarga trae menos días y menos salario de los reales, y la PTU de todos sale distorsionada. Mitigación: hay que completar a mano los meses anteriores al sistema antes de cerrar. Las filas editadas llevan una marca visible.
- **Categoría mal asignada.** Un director que se queda `'N'` cobra PTU, y uno de confianza que se queda `'N'` no se topa y además sube el tope del 120% de los demás. Mitigación: la categoría se ve en cada fila y se congela en el recálculo. Hay que revisarla en el formulario de cada empleado antes de precargar.
- **`tipo_contrato` desactualizado.** La spec 71 dejó a todos los existentes en `'01'`, así que un eventual real nunca pierde la PTU por tener menos de 60 días. Mitigación: hay que revisar `tipo_contrato` de los eventuales. El reparto muestra el contrato congelado de cada fila.
- **Recalcular nómina después de precargar.** Si se recalcula un periodo ordinario del ejercicio después de la precarga, las filas no editadas no se enteran hasta volver a precargar. Mitigación: precargar de nuevo justo antes de cerrar. La precarga es idempotente y respeta lo editado.
- **Cambio de empresa o sucursal.** La empresa de un empleado sale de su sucursal **actual**. Quien se movió a otra empresa del grupo desaparece de la precarga de la empresa anterior aunque haya trabajado ahí. Mitigación: hoy es un caso raro. Se documenta, y repartir entre empresas queda fuera de alcance.
- **Reabrir un reparto que ya se pagó.** En esta spec, reabrir siempre se permite, y aún no hay pago. Mitigación: la spec 90 debe bloquear la reapertura cuando un periodo PTU de ese reparto esté en estatus 2 o más.
- **El historial cambia con un reparto cerrado de otro año.** Cerrar o reabrir el reparto de 2026 cambia el promedio de un reparto 2027 en borrador, pero no lo recalcula hasta su siguiente escritura. Mitigación: la siguiente escritura del reparto 2027 lo recalcula. Si estuviera cerrado, reabrirlo y guardar lo actualiza. Se documenta.
