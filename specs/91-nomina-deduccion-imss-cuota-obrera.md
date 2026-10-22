# 91 — Deducción del IMSS (cuota obrera) en la nómina fiscal

## Header

- **Estado:** Implementado
- **Depende de:**
  - 53 (`nomina-calculo-salario`): `payroll.period_employees`, `calculatePayrollPeriod` y Procesar.
  - 54 (`nomina-detalle-percepciones-empleado`): Detalle por empleado.
  - 62 (`nomina-control-faltas`): `dias_falta`. Las faltas restan días cotizados de IV y CEAV, pero no de EyM.
  - 69 (`nomina-parametros-fiscales-isr`): `payroll.tax_parameters`, la regla de vigencia a `fecha_fin`, `UMA_DIARIA`, `SALARIO_MINIMO_GENERAL` y la bitácora.
  - 70 (`nomina-calculo-isr-fiscal`): `payroll.deductions` (`id_deduction = 1` Seguridad social), `period_employee_deductions`, `PayrollDeductionsCard`, el patrón de estado/motivo (`'X'`/`'C'`/`'N'`) y el aviso "Recalcula".
  - 71 (`empleado-datos-fiscales-cfdi-nomina`): `RH.empleados.nss` y `tipo_regimen`.
  - 87 y 90: el periodo extraordinario (`'E'`), que **no** lleva IMSS.
- **Modifica base de datos:** Sí.
  - Tabla nueva `RH.employee_sbc`, el historial del SBC con `vigente_desde`, y su bitácora `RH.employee_sbc_log`.
  - `CK_tax_parameters_clave` gana 7 claves IMSS, precargadas con `vigente_desde = 2026-01-01`.
  - `payroll.period_employees` gana el estado, el motivo y el total retenido del IMSS, como el ISR.
  - Tabla nueva `payroll.period_employee_imss` con el desglose congelado por ramo.
- **Fecha:** 2026-10-20
- **Objetivo:** Calcular y retener la cuota obrera del IMSS en las filas fiscales de los periodos ordinarios, sobre el SBC que el contador captura en el expediente, con las tasas de la LSS editables en Parámetros fiscales.

### Contexto (2026-10-20)

- Las reglas de origen están en `references/docs/imss.md`. **Su tabla no coincide con la LSS** y esta spec la corrige:
  - le faltan EyM prestaciones en dinero (0.25 %, art. 107) y gastos médicos de pensionados (0.375 %, art. 25);
  - la cuota obrera de CEAV es 1.125 % fija, porque la tabla progresiva de la reforma 2020 solo aplica al patrón;
  - el 2 % de Retiro lo paga íntegro el patrón (art. 168 fr. I), así que no se retiene.
- Con el caso práctico del documento (SBC $530, 15 días, UMA $117.31), la retención correcta es **$199.50** y no $308.81. **El contador debe confirmarlo antes de aprobar la spec.**
- El IMSS retenido debe coincidir con lo que se paga al IMSS cada mes o bimestre. **Las diferencias no se ajustan**: si se retuvo de menos, no se le cobra después al trabajador.
- Hoy `RH.empleados` no tiene SBC. La spec 71 lo dejó pendiente. El contador captura el mismo SBC que reportó en IDSE.
- La cuota obrera **no** cambia la base del ISR. Las dos deducciones son independientes.
- `payroll.deductions` ya tiene `id_deduction = 1` "Seguridad social" (clave SAT 001), reservado desde la spec 70.

## Alcance

**Entra:**

- **Tasas y límites del IMSS como parámetros fiscales.**
  - `CK_tax_parameters_clave` gana 7 claves:
    - `IMSS_OBRERO_EYM_EXCEDENTE` (0.40 %)
    - `IMSS_OBRERO_EYM_DINERO` (0.25 %)
    - `IMSS_OBRERO_EYM_PENSIONADOS` (0.375 %)
    - `IMSS_OBRERO_IV` (0.625 %)
    - `IMSS_OBRERO_CEAV` (1.125 %)
    - `IMSS_UMBRAL_EXCEDENTE_UMAS` (3)
    - `IMSS_TOPE_SBC_UMAS` (25)
  - Se precargan en el script con `vigente_desde = 2026-01-01`. La precarga no escribe en la bitácora.
  - Se editan en la pestaña "Parámetros" de Parámetros fiscales que ya existe, con la misma regla de vigencia a `fecha_fin` y la misma bitácora. `TAX_PARAMETER_KEYS` les da etiqueta y unidad.
- **Historial del SBC en el expediente.**
  - Pestaña nueva **"IMSS"** en `empleados/[id]/`, visible y usable **solo por los roles 1 y 4**. `proxy.ts` ya restringe todo `/dashboard/empleados` a esos roles, y además cada acción llama a `assertPayrollAccess()`.
  - Muestra el SBC vigente hoy, el historial (SBC, `vigente_desde`, quién y cuándo) y la bitácora de cambios.
  - Permite agregar, editar y eliminar. Cada escritura deja su fila en `RH.employee_sbc_log` y un guardado sin cambios no escribe nada (mismo patrón que `tax_parameters_log`).
  - **Validación**, con `zod` y otra vez en SQL:
    - `sbc > 0` con 2 decimales;
    - `vigente_desde` es una fecha real y no es anterior a `fecha_ingreso`;
    - no se repite `vigente_desde` para el mismo empleado.
  - **Aviso ámbar que no bloquea** si el SBC es menor que el `salario_diario_fiscal` actual o menor que el `SALARIO_MINIMO_GENERAL` vigente a `vigente_desde`.
- **Cálculo** dentro de `calculatePayrollPeriod`, solo en filas `'F'` de periodos `tipo_periodo = 'O'`, en cualquier frecuencia, después del ISR:
  - **Quién:** empleados con `tipo_regimen = '02'`. Con otro régimen la fila queda "No aplica" (`'X'`) y no lleva deducción.
  - **SBC:** el vigente a `fecha_fin`, aplicado a todo el periodo. **SBC topado** = `min(SBC, ROUND(IMSS_TOPE_SBC_UMAS × UMA_DIARIA, 2))`.
  - **Días:**
    - EyM usa días calendario desde el ingreso (`dias + dias_falta`);
    - IV y CEAV usan los días pagados (`dias`), sin faltas;
    - los retardos no restan días.
  - **Cuota por ramo** = `ROUND(base diaria × días × tasa / 100, 2)`:

    | Ramo | Base diaria | Días |
    |---|---|---|
    | EyM excedente | `max(0, SBC topado − IMSS_UMBRAL_EXCEDENTE_UMAS × UMA_DIARIA)` | EyM |
    | EyM prestaciones en dinero | SBC topado | EyM |
    | EyM gastos médicos pensionados | SBC topado | EyM |
    | Invalidez y Vida | SBC topado | IV/CEAV |
    | CEAV | SBC topado | IV/CEAV |

  - **Cuota causada** = la suma de los 5 ramos.
  - **Salario mínimo (art. 36 LSS):** si el `salario_diario` de la fila `'F'` es `<=` al `SALARIO_MINIMO_GENERAL` vigente a `fecha_fin`, la retención es $0. La cuota causada se calcula y se guarda igual, con la marca de exención.
  - **Tope al neto:** retenido = `min(causada, max(0, total percepciones − ISR retenido))`. El ISR cuenta como 0 si no está calculado. Lo que no alcanza lo absorbe el patrón y no se cobra después.
  - **"No calculado" (`'N'`)**, con motivo, en este orden:
    1. régimen 02 sin NSS;
    2. sin SBC vigente a `fecha_fin`;
    3. sin UMA;
    4. falta alguna de las 7 claves IMSS;
    5. sin salario mínimo.

    No hay valores por omisión. El periodo se calcula de todos modos.
  - **Deducción:** una fila `id_deduction = 1` en `period_employee_deductions` **solo para `'C'`, aunque sea $0**. El neto ya la resta, porque suma todas las deducciones.
  - **Snapshot:** `period_employees` guarda estado, motivo y total retenido. `period_employee_imss` congela el desglose completo: SBC y su `vigente_desde`, SBC topado, UMA, umbral, tope, salario mínimo, días, y tasa e importe de cada ramo, más la cuota causada, las marcas de exención y de tope al neto, y el retenido.
- **Procesar (solo vista fiscal):**
  - columna "IMSS" entre "ISR" y "Neto", también en el pie (`'N'` muestra "No calculado" y `'X'` muestra "—");
  - tarjeta "IMSS retenido";
  - aviso `ImssNotCalculatedNotice` con el conteo por motivo y un enlace a la pestaña IMSS del empleado o a Parámetros fiscales.
- **Detalle (solo vista fiscal):**
  - línea "IMSS" en `PayrollDeductionsCard`, con el desglose por ramo (base, días, tasa e importe), el SBC usado, el SBC topado, la UMA y el `vigente_desde` de cada dato;
  - una nota cuando aplicó la exención por salario mínimo o el tope al neto;
  - el motivo cuando es `'N'`.
- **Aviso "Recalcula":** `isImssRecalculationNeeded` compara el desglose guardado con el de hoy. Detecta cambios de tasa, UMA, salario mínimo, SBC, régimen o NSS, y también los snapshots anteriores a esta spec.

**No entra (para specs futuras):**

- Las cuotas patronales: EyM cuota fija, Retiro, CEAV patronal progresivo, guarderías, riesgo de trabajo e INFONAVIT 5 %.
- Calcular el SBC: factor de integración, parte variable bimestral, avisos de modificación.
- Generar archivos SUA o IDSE, conciliar contra la liquidación real, o ajustar diferencias.
- Partir el periodo por días cuando el SBC cambia dentro de él.
- Incapacidades, y el límite de 7 días de ausentismo por mes (art. 31 LSS).
- Descuentos de crédito INFONAVIT o FONACOT.
- IMSS en la nómina operativa, en periodos extraordinarios (aguinaldo, PTU) y en el finiquito (spec 88).
- Salario mínimo de la zona fronteriza.
- Reportar la deducción 001 en el CFDI de nómina (timbrado).
- Bloquear la aprobación del periodo con filas `'N'`. La spec 94 decidió lo contrario: advertir en el modal de Aprobar, con el conteo de empleados, pero no bloquear.
- Capturar el SBC desde el modal de alta del empleado.

## Modelo de datos

### SQL (DDL en `queries.txt`: bloque `RECURSOS HUMANOS(EMPLEADOS)` para el SBC y bloque `NOMINA PAYROLL`, después de la spec 90, para lo demás)

```sql
-- 1. Parámetros fiscales: 7 claves nuevas (se recrea el CHECK con las 16).
ALTER TABLE [payroll].[tax_parameters] DROP CONSTRAINT [CK_tax_parameters_clave];
ALTER TABLE [payroll].[tax_parameters] ADD CONSTRAINT [CK_tax_parameters_clave] CHECK ([clave] IN (
    'UMA_DIARIA','UMA_MENSUAL','UMA_ANUAL',
    'SALARIO_MINIMO_GENERAL','SALARIO_MINIMO_FRONTERA',
    'SUBSIDIO_MONTO_MENSUAL','SUBSIDIO_TOPE_INGRESO_MENSUAL','SUBSIDIO_FACTOR_DIAS_MES',
    'DIAS_ANIO',
    'IMSS_OBRERO_EYM_EXCEDENTE','IMSS_OBRERO_EYM_DINERO','IMSS_OBRERO_EYM_PENSIONADOS',
    'IMSS_OBRERO_IV','IMSS_OBRERO_CEAV',
    'IMSS_UMBRAL_EXCEDENTE_UMAS','IMSS_TOPE_SBC_UMAS'));

-- Precarga idempotente (solo inserta las claves que no tengan fila en 2026-01-01). No escribe bitácora.
-- updated_by = @seed_user_id, declarado al inicio del script con el id_user del administrador que lo corre.
--   IMSS_OBRERO_EYM_EXCEDENTE   0.4000   (% sobre el excedente de 3 UMA, art. 106)
--   IMSS_OBRERO_EYM_DINERO      0.2500   (% sobre SBC, art. 107)
--   IMSS_OBRERO_EYM_PENSIONADOS 0.3750   (% sobre SBC, art. 25)
--   IMSS_OBRERO_IV              0.6250   (% sobre SBC, art. 147)
--   IMSS_OBRERO_CEAV            1.1250   (% sobre SBC, art. 168)
--   IMSS_UMBRAL_EXCEDENTE_UMAS  3.0000   (UMA)
--   IMSS_TOPE_SBC_UMAS         25.0000   (UMA, art. 28)

-- 2. Historial del SBC. Una fila por empleado + vigente_desde.
CREATE TABLE [RH].[employee_sbc](
    [id_employee_sbc] [int] IDENTITY(1,1) NOT NULL,
    [id_empleado]     [int]           NOT NULL,
    [sbc]             [decimal](12,2) NOT NULL,
    [vigente_desde]   [date]          NOT NULL,   -- fecha del movimiento en IDSE
    [updated_by]      [int]           NOT NULL,
    [updated_at]      [datetime2](0)  NOT NULL,   -- buildDate(new Date())
 CONSTRAINT [PK_employee_sbc] PRIMARY KEY CLUSTERED ([id_employee_sbc] ASC),
 CONSTRAINT [FK_employee_sbc_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado]),
 CONSTRAINT [UQ_employee_sbc_vigencia] UNIQUE ([id_empleado], [vigente_desde]),
 CONSTRAINT [CK_employee_sbc_sbc] CHECK ([sbc] > 0)
) ON [PRIMARY]

-- Bitácora: una fila por alta, cambio o baja. Mismo patrón que tax_parameters_log.
CREATE TABLE [RH].[employee_sbc_log](
    [id_log]        [int] IDENTITY(1,1) NOT NULL,
    [id_empleado]   [int]           NOT NULL,
    [vigente_desde] [date]          NOT NULL,
    [sbc_anterior]  [decimal](12,2) NULL,   -- NULL: alta
    [sbc_nuevo]     [decimal](12,2) NULL,   -- NULL: baja
    [updated_by]    [int]           NOT NULL,
    [updated_at]    [datetime2](0)  NOT NULL,
 CONSTRAINT [PK_employee_sbc_log] PRIMARY KEY CLUSTERED ([id_log] ASC),
 CONSTRAINT [FK_employee_sbc_log_empleado] FOREIGN KEY ([id_empleado])
     REFERENCES [RH].[empleados] ([id_empleado])
) ON [PRIMARY]
CREATE NONCLUSTERED INDEX [IX_employee_sbc_log_empleado]
    ON [RH].[employee_sbc_log] ([id_empleado], [updated_at] DESC)

-- 3. Estado y total del IMSS en el snapshot, como el ISR.
-- imss_estado: 'X' no aplica (operativa, periodo E, régimen distinto de 02 o snapshot anterior a esta spec),
--              'C' calculado, 'N' no calculado.
ALTER TABLE [payroll].[period_employees] ADD
    [imss_estado]   [char](1)       NOT NULL CONSTRAINT [DF_period_employees_imss_estado] DEFAULT ('X'),
    [imss_motivo]   [varchar](30)   NULL,   -- solo 'N'
    [imss_retenido] [decimal](12,2) NULL;   -- solo 'C'

-- IS NOT NULL explícito en cada rama (lección de la spec 69).
ALTER TABLE [payroll].[period_employees] WITH CHECK ADD CONSTRAINT [CK_period_employees_imss] CHECK (
    ([imss_estado] = 'X' AND [imss_motivo] IS NULL AND [imss_retenido] IS NULL)
 OR ([imss_estado] = 'N' AND [tipo_nomina] = 'F'
        AND [imss_motivo] IS NOT NULL
        AND [imss_motivo] IN ('missing_nss','missing_sbc','missing_uma',
                              'missing_imss_parameters','missing_minimum_wage')
        AND [imss_retenido] IS NULL)
 OR ([imss_estado] = 'C' AND [tipo_nomina] = 'F'
        AND [imss_motivo] IS NULL
        AND [imss_retenido] IS NOT NULL AND [imss_retenido] >= 0));

-- 4. Desglose congelado. Solo existe para filas 'C', así que todas las columnas son NOT NULL.
CREATE TABLE [payroll].[period_employee_imss](
    [id_period_employee]           [int]           NOT NULL,
    -- Datos usados, con su vigencia
    [sbc]                          [decimal](12,2) NOT NULL,
    [sbc_vigente_desde]            [date]          NOT NULL,
    [uma_diaria]                   [decimal](18,4) NOT NULL,
    [uma_vigente_desde]            [date]          NOT NULL,
    [salario_minimo]               [decimal](18,4) NOT NULL,
    [salario_minimo_vigente_desde] [date]          NOT NULL,
    [parametros_vigente_desde]     [date]          NOT NULL,   -- el vigente_desde más reciente de las 7 claves IMSS
    [tope_sbc_umas]                [decimal](18,4) NOT NULL,
    [umbral_excedente_umas]        [decimal](18,4) NOT NULL,
    -- Bases
    [tope_sbc]                     [decimal](12,2) NOT NULL,   -- ROUND(tope_sbc_umas × uma, 2)
    [sbc_topado]                   [decimal](12,2) NOT NULL,   -- min(sbc, tope_sbc)
    [umbral_excedente]             [decimal](12,2) NOT NULL,   -- ROUND(umbral_excedente_umas × uma, 2)
    [excedente_diario]             [decimal](12,2) NOT NULL,   -- max(0, sbc_topado − umbral_excedente)
    [dias_eym]                     [int]           NOT NULL,   -- dias + dias_falta
    [dias_iv_ceav]                 [int]           NOT NULL,   -- dias
    -- Ramos: tasa en % (congelada) e importe = ROUND(base × días × tasa / 100, 2)
    [tasa_eym_excedente]           [decimal](18,4) NOT NULL,
    [importe_eym_excedente]        [decimal](12,2) NOT NULL,
    [tasa_eym_dinero]              [decimal](18,4) NOT NULL,
    [importe_eym_dinero]           [decimal](12,2) NOT NULL,
    [tasa_eym_pensionados]         [decimal](18,4) NOT NULL,
    [importe_eym_pensionados]      [decimal](12,2) NOT NULL,
    [tasa_iv]                      [decimal](18,4) NOT NULL,
    [importe_iv]                   [decimal](12,2) NOT NULL,
    [tasa_ceav]                    [decimal](18,4) NOT NULL,
    [importe_ceav]                 [decimal](12,2) NOT NULL,
    -- Resultado
    [cuota_causada]                [decimal](12,2) NOT NULL,   -- suma de los 5 importes
    [exento_salario_minimo]        [bit]           NOT NULL,   -- art. 36 LSS
    [tope_neto]                    [decimal](12,2) NOT NULL,   -- max(0, percepciones − ISR retenido)
    [topado_al_neto]               [bit]           NOT NULL,
    [imss_retenido]                [decimal](12,2) NOT NULL,
 CONSTRAINT [PK_period_employee_imss] PRIMARY KEY CLUSTERED ([id_period_employee] ASC),
 CONSTRAINT [FK_period_employee_imss_row] FOREIGN KEY ([id_period_employee])
     REFERENCES [payroll].[period_employees] ([id_period_employee]) ON DELETE CASCADE,
 CONSTRAINT [CK_period_employee_imss] CHECK (
        [cuota_causada] = [importe_eym_excedente] + [importe_eym_dinero] + [importe_eym_pensionados]
                        + [importe_iv] + [importe_ceav]
    AND [dias_iv_ceav] <= [dias_eym]
    AND (   ([exento_salario_minimo] = 1 AND [topado_al_neto] = 0 AND [imss_retenido] = 0)
         OR ([exento_salario_minimo] = 0 AND [topado_al_neto] = 0
                AND [cuota_causada] <= [tope_neto] AND [imss_retenido] = [cuota_causada])
         OR ([exento_salario_minimo] = 0 AND [topado_al_neto] = 1
                AND [cuota_causada] >  [tope_neto] AND [imss_retenido] = [tope_neto])))
) ON [PRIMARY]
```

- **Fila de deducción:** `period_employee_deductions` con `id_deduction = 1`, `importe = imss_retenido`, solo para filas `'C'` (aunque sea 0). La tabla ya existe; no cambia.
- **Percepciones** para el tope al neto: `ISNULL(SUM(importe), 0)` de las filas de `period_employee_perceptions` de la fila `'F'` (spec 73). **ISR retenido:** `ISNULL(pe.isr_retenido, 0)`.

### Caso práctico (referencia para las pruebas)

SBC $530.00, UMA $117.31, 15 días sin faltas, salario mayor al mínimo:

| Ramo | Base diaria | Días | Tasa | Importe |
|---|---|---|---|---|
| EyM excedente | 178.07 (530 − 351.93) | 15 | 0.40 % | 10.68 |
| EyM dinero | 530.00 | 15 | 0.25 % | 19.88 |
| EyM pensionados | 530.00 | 15 | 0.375 % | 29.81 |
| IV | 530.00 | 15 | 0.625 % | 49.69 |
| CEAV | 530.00 | 15 | 1.125 % | 89.44 |
| **Cuota causada** | | | | **199.50** |

### TypeScript

```ts
// interfaces/payroll_tax_parameters.ts: TaxParameterKey gana las 7 claves IMSS.

// interfaces/employee_sbc.ts
export interface IEmployeeSbc {
  id_employee_sbc: number;
  id_empleado:     number;
  sbc:             number;
  vigente_desde:   string;   // "YYYY-MM-DD"
  updated_by_name: string;
  updated_at:      string;   // "YYYY-MM-DD HH:mm:ss"
}
export interface IEmployeeSbcLogEntry {
  id_log: number; vigente_desde: string;
  sbc_anterior: number | null; sbc_nuevo: number | null;
  updated_by_name: string; updated_at: string;
}

// interfaces/payroll_imss.ts
export type ImssStatus = "X" | "C" | "N";
export type ImssSkipReason =
  | "missing_nss" | "missing_sbc" | "missing_uma"
  | "missing_imss_parameters" | "missing_minimum_wage";
export interface IImssBreakdown { /* una propiedad por columna de payroll.period_employee_imss, fechas como string */ }

// Las filas de Procesar ganan imss_estado, imss_motivo e imss_retenido.
// El snapshot del Detalle gana imss: IImssBreakdown | null.
```

### Constantes (`lib/payroll/constants.ts`)

- `IMSS_DEDUCTION_ID = 1` (Seguridad social, SAT 001).
- `IMSS_CONTRIBUTION_REGIME = "02"`.
- `IMSS_TAX_PARAMETER_KEYS`: las 7 claves. Si falta una vigente a `fecha_fin`, el motivo es `missing_imss_parameters`.
- `IMSS_SKIP_REASON_LABELS: Record<ImssSkipReason, string>`.
- `TAX_PARAMETER_KEYS` gana las 7 claves con unidad `"% del SBC"`, `"% del excedente"` o `"UMA"`.
- `EMPLOYEE_SBC_LOG_PAGE_SIZE = 20`.

### Módulos nuevos (`lib/payroll/`)

- `imssCalculation.ts` (puro, sin BD ni `Date`, con enteros escalados):
  - `calculateImssBreakdown(input)` devuelve `{ estado, motivo, breakdown }`;
  - `resolveEmployeeSbc(rows, fechaFin)` aplica la misma regla de vigencia que `resolveTaxParameterRow`;
  - `describeImssSkipReason`.

  Si diverge del SQL, **gana el SQL**.
- `imssSql.ts` (server-only), con snippets compartidos por el cálculo y el aviso:
  - `IMSS_PARAMETERS_SQL`: UMA, salario mínimo y las 7 claves vigentes a `@fecha_fin`;
  - `IMSS_APPLY_SQL`: SBC vigente, motivo, bases, ramos, exención, tope y retenido;
  - `IMSS_COLUMNS_SQL`.
- `imssRecalculation.ts` (server-only): `isImssRecalculationNeeded(id_period)`.

### Convenciones

- Tasas en **porcentaje** (0.4000 = 0.40 %), igual que `porcentaje_excedente` de la tarifa del ISR.
- Cada ramo se redondea **por separado** a 2 decimales, con medio hacia arriba como `ROUND`. La cuota causada suma los importes ya redondeados.
- **Editar** un SBC solo cambia el monto. Para moverlo a otra fecha se elimina y se vuelve a crear, igual que en los parámetros fiscales.

## Plan de implementación

1. **Parámetros IMSS.**
   - En `queries.txt`, recrear `CK_tax_parameters_clave` con las 16 claves y agregar la precarga idempotente de las 7 claves IMSS (`vigente_desde = 2026-01-01`).
   - Agregar las 7 claves a `TaxParameterKey` (`interfaces/payroll_tax_parameters.ts`) y a `TAX_PARAMETER_KEYS`, con etiqueta y unidad.
   - *Prueba manual:* en Parámetros fiscales (pestaña Parámetros, 2026) aparecen las 7 claves. Al editar una queda su fila en la bitácora, y guardar el mismo valor no escribe nada.
2. **Historial del SBC: tablas y acciones.**
   - En `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`, crear `RH.employee_sbc` y `RH.employee_sbc_log`, y el tipo en `interfaces/employee_sbc.ts`.
   - Crear `app/dashboard/empleados/[id]/imss/schemas.ts` (`zod`: `sbc > 0` con 2 decimales y `vigente_desde` como fecha real) y `imss/actions.ts` con `getEmployeeSbcHistory`, `getEmployeeSbcLog`, `saveEmployeeSbc` y `deleteEmployeeSbc`.
   - Cada acción pasa por `assertPayrollAccess()` y devuelve `ActionResult`. Las escrituras corren en una transacción con `UPDLOCK, HOLDLOCK`: validan `vigente_desde >= fecha_ingreso`, escriben y registran en la bitácora. Si el valor no cambió, no escriben nada. Al editar solo cambia `sbc`.
   - Sin UI todavía.
3. **Pestaña IMSS en el expediente.**
   - `empleados/[id]/imss/page.tsx` (Server Component) con la tarjeta del SBC vigente hoy, la tabla del historial y la bitácora en un `<details>` con las últimas 20 entradas.
   - Las únicas hojas cliente son `EmployeeSbcModal` y `DeleteEmployeeSbcButton`, con confirmación dentro de la UI y sin `confirm()` nativo.
   - El modal recibe `salario_diario_fiscal` y las filas de `SALARIO_MINIMO_GENERAL`. Con `resolveTaxParameter` (puro) muestra el aviso ámbar sin bloquear el guardado.
   - Se agrega "IMSS" a `EmployeeTabs`.
   - *Prueba manual:* agregar, editar y eliminar un SBC deja su rastro en la bitácora. Un SBC menor al salario fiscal muestra el aviso y aun así se guarda.
4. **Regla pura.**
   - `interfaces/payroll_imss.ts` y las constantes IMSS en `lib/payroll/constants.ts`.
   - `lib/payroll/imssCalculation.ts` con `resolveEmployeeSbc`, `calculateImssBreakdown` (enteros escalados) y `describeImssSkipReason`.
   - *Prueba manual:* el caso práctico da 199.50 por ramo y en total.
5. **Cálculo en el periodo.**
   - En `queries.txt`, las columnas `imss_*` con `CK_period_employees_imss` y la tabla `payroll.period_employee_imss`.
   - Crear `lib/payroll/imssSql.ts` (`IMSS_PARAMETERS_SQL`, `IMSS_APPLY_SQL`, `IMSS_COLUMNS_SQL`).
   - En `calculatePayrollPeriod`, solo en la rama ordinaria y **después** del ISR y su deducción:
     1. un `UPDATE` de las filas `'F'` con estado, motivo y retenido;
     2. un `INSERT` del desglose de las filas `'C'`;
     3. un `INSERT` de la deducción `id_deduction = 1` de las filas `'C'`.
   - Las rutas de aguinaldo y PTU no se tocan. "Recalcular" y "Revertir" limpian todo por la cascada.
   - *Prueba manual:* al calcular un periodo, la BD tiene el desglose y la deducción, y el neto en Procesar baja por el IMSS aunque la columna todavía no exista.
6. **Procesar.**
   - `getPayrollProcessPage` devuelve `imss_estado`, `imss_motivo` e `imss_retenido` por fila, y en los totales `importeImss` y los conteos de "No calculado" por motivo.
   - En la vista fiscal de `PayrollEmployeesTable`, la columna "IMSS" entre "ISR" y "Neto", también en el pie.
   - En `PayrollProcessSummaryCards`, la tarjeta "IMSS retenido".
   - `ImssNotCalculatedNotice` (Server Component) con enlace a la pestaña IMSS del empleado (motivos de NSS y SBC) o a Parámetros fiscales (los demás).
7. **Detalle.**
   - `getPayrollEmployeeDetail` lee `period_employee_imss`.
   - `PayrollDeductionsCard` agrega la línea "IMSS" con el desglose por ramo, el SBC y su vigencia, el SBC topado, la UMA, los parámetros y las notas de exención por salario mínimo o de tope al neto. Con `'N'` muestra el motivo, y con `'X'` en una fila de régimen 02 dice "Recalcula la nómina para ver el IMSS".
8. **Aviso "Recalcula".**
   - `lib/payroll/imssRecalculation.ts` con `isImssRecalculationNeeded(id_period)`, solo en estatus 2. Recalcula el estado y el desglose de hoy con los snippets de `imssSql.ts` sobre los días, el salario y las percepciones del snapshot, y compara con `EXISTS (… EXCEPT …)`.
   - Se muestra con `PayrollRecalculationNotice` en Procesar: "Hay cálculos de IMSS que no coinciden con el SBC, las tasas o los parámetros actuales. Recalcula la nómina."
9. **Documentación.**
   - Sección "IMSS (spec 91)" en `docs/nomina.md`.
   - Actualizar la línea de deducciones del resumen y el "Out of scope" de las specs 69, 70 y 73.
   - Sección "SBC (spec 91)" en `docs/rh-empleados.md`, quitando "SDI/SBC (IMSS)" de los pendientes de la spec 71.

## Criterios de aceptación

**Parámetros**

- [x] Después de correr el script, Parámetros fiscales (2026) muestra las 7 claves IMSS con sus valores precargados: 0.40, 0.25, 0.375, 0.625, 1.125, 3 y 25.
- [x] Correr el script una segunda vez no duplica filas ni falla.
- [x] Editar `IMSS_OBRERO_CEAV` deja una fila en `tax_parameters_log`. Guardar el mismo valor no escribe nada.

**SBC en el expediente**

- [x] El expediente muestra la pestaña "IMSS" con el SBC vigente hoy, el historial y la bitácora.
- [x] Agregar, editar y eliminar un SBC escribe una fila en `RH.employee_sbc_log` (`sbc_anterior` es `NULL` en un alta y `sbc_nuevo` es `NULL` en una baja). Guardar el mismo monto no escribe nada.
- [x] Se rechaza, con un mensaje en el modal, un `vigente_desde` repetido para el mismo empleado, un `vigente_desde` anterior a `fecha_ingreso` y un `sbc <= 0`.
- [x] Un SBC menor al `salario_diario_fiscal` o al salario mínimo vigente muestra el aviso ámbar y aun así se guarda.
- [ ] Llamar a las acciones de SBC con un rol distinto de 1 y 4 devuelve `{ ok: false }` y no escribe nada.

**Cálculo** (periodo ordinario, fiscal; UMA $117.31; empleado de régimen 02 con NSS)

- [x] Con SBC $530.00, 15 días y sin faltas, el desglose da EyM excedente 10.68, EyM dinero 19.88, EyM pensionados 29.81, IV 49.69 y CEAV 89.44. La cuota causada y el retenido son **199.50**.
- [x] Con SBC $300.00 (menor a 3 UMA), `excedente_diario` e `importe_eym_excedente` son 0.
- [x] Con SBC $3,500.00, `sbc_topado` = `tope_sbc` = 2,932.75.
- [x] Con 2 faltas injustificadas en una quincena de 15 días, `dias_eym = 15` y `dias_iv_ceav = 13`. Los retardos no cambian ninguno de los dos.
- [x] Si el SBC cambia a mitad del periodo, se usa para todos los días el vigente a `fecha_fin`.
- [x] Con `salario_diario_fiscal` igual al salario mínimo vigente, la cuota causada es mayor que 0, `exento_salario_minimo = 1`, el retenido es 0 y existe la fila de deducción `id_deduction = 1` con importe 0.
- [x] Si la cuota causada es mayor que percepciones − ISR retenido, el retenido es igual a ese tope, `topado_al_neto = 1` y el neto queda en 0.
- [x] Un empleado con régimen distinto de 02 queda en `'X'`, sin desglose ni fila de deducción.
- [x] Régimen 02 sin NSS queda `'N'` / `missing_nss`. Con NSS pero sin SBC vigente a `fecha_fin` queda `'N'` / `missing_sbc`. En los dos casos el periodo se calcula y no hay fila de deducción.
- [x] Si falta una de las 7 claves IMSS vigente a `fecha_fin`, las filas de régimen 02 quedan `'N'` / `missing_imss_parameters`.
- [x] La base gravable y el ISR retenido de cada fila son idénticos antes y después de esta spec.
- [x] Neto = total percepciones − ISR retenido − IMSS retenido.
- [ ] Las filas operativas (`'O'`) y las de periodos de aguinaldo y PTU quedan en `'X'` y su neto no cambia.
- [x] "Revertir" y "Recalcular" eliminan el desglose y la deducción IMSS anteriores. Después de recalcular no quedan duplicados.

**Pantallas**

- [x] La vista fiscal de Procesar muestra la columna "IMSS" entre "ISR" y "Neto": el importe en `'C'`, "No calculado" en `'N'` y "—" en `'X'`. El pie suma la columna.
- [x] La tarjeta "IMSS retenido" suma todo el tipo de nómina y no cambia con los filtros de puesto o búsqueda.
- [x] `ImssNotCalculatedNotice` muestra el conteo por motivo. Los enlaces de `missing_nss` y `missing_sbc` llevan a la pestaña IMSS del empleado y los demás a Parámetros fiscales.
- [x] La vista operativa de Procesar no cambia.
- [x] La tarjeta de deducciones del Detalle fiscal muestra la línea IMSS con los 5 ramos (base, días, tasa e importe), el SBC con su `vigente_desde`, el SBC topado, la UMA y la vigencia de las tasas. Si aplicó la exención o el tope al neto, aparece su nota.
- [x] Después de cambiar el SBC de un empleado de un periodo en estatus 2, Procesar muestra el aviso "Recalcula". Al recalcular, el aviso desaparece.

**Calidad**

- [x] `npx tsc --noEmit` termina sin errores y `npm run lint` no agrega errores ni warnings nuevos.
- [x] `docs/nomina.md` y `docs/rh-empleados.md` describen la spec 91, y "SDI/SBC (IMSS)" ya no aparece como pendiente.

## Decisiones

**Reglas del cálculo**

- **Sí:** cuotas obreras de la LSS (0.40 % excedente, 0.25 %, 0.375 %, 0.625 % y 1.125 %), sin Retiro. `imss.md` incluía el 2 % de Retiro (es patronal), trataba CEAV como variable (lo progresivo es patronal) y omitía dos ramos de EyM. Lo retenido debe coincidir con lo que se paga al IMSS.
- **No:** aplicar `imss.md` al pie de la letra. Retendría $308.81 en lugar de $199.50 en el caso práctico.
- **Sí:** días al estilo SUA: EyM sobre días calendario e IV/CEAV sobre días menos faltas. Es lo que acerca la retención a lo que el SUA liquida.
- **No:** usar los mismos días en todos los ramos. Con días calendario se retiene de más en IV/CEAV, y con días pagados se retiene de menos en EyM.
- **No:** el límite de 7 días de ausentismo por mes (art. 31). Con más de 7 faltas en un mes lo normal es dar de baja, y el caso no justifica la complejidad.
- **Sí:** el SBC vigente a `fecha_fin` para todo el periodo, con la misma regla que la UMA y los parámetros (spec 69).
- **No:** partir los días por vigencia del SBC. Es exacto contra el SUA, pero multiplica el desglose. La diferencia de centavos no se ajusta por regla de origen.
- **Sí:** redondear cada ramo por separado a 2 decimales y sumar los importes redondeados. Así lo hace el caso práctico de origen y el Detalle cuadra al centavo.
- **Sí:** exención por salario mínimo (art. 36) comparando `salario_diario_fiscal <= SALARIO_MINIMO_GENERAL`. Se guarda la cuota causada y el retenido queda en 0, para que se vea cuánto absorbe el patrón.
- **No:** el salario mínimo fronterizo. Ninguna sucursal tiene zona fronteriza capturada.
- **Sí:** topar la retención a percepciones − ISR retenido. Lo que no alcanza lo absorbe el patrón, coherente con "si faltó no se le quita al trabajador". El neto nunca es negativo.
- **No:** acumular lo no retenido para cobrarlo en el siguiente periodo. Contradice la regla de origen.
- **Sí:** la cuota obrera no cambia la base del ISR. Son deducciones independientes.

**Alcance del cálculo**

- **Sí:** solo filas fiscales de periodos ordinarios, en todas las frecuencias. A diferencia del ISR, no depende de una tarifa por frecuencia.
- **No:** IMSS en aguinaldo y PTU. No son cuotas por días cotizados, y el aguinaldo ya se integra al SBC.
- **No:** IMSS en la nómina operativa.
- **Sí:** régimen distinto de 02 → `'X'` "No aplica". Régimen 02 sin NSS o sin SBC → `'N'` con motivo, para que un error de captura no quede escondido.
- **Sí:** el régimen y el NSS se leen de `RH.empleados` al calcular, sin congelarlos. El aviso "Recalcula" detecta si cambian.

**Parámetros**

- **Sí:** tasas y límites como 7 claves nuevas en `payroll.tax_parameters`. Reutilizan la pantalla, la vigencia y la bitácora de la spec 69.
- **No:** una tabla `payroll.imss_rates` con pantalla propia. Duplicaría lo que ya existe.
- **No:** tasas como constantes en código. El usuario las quiere editables.
- **Sí:** precargarlas con `vigente_desde = 2026-01-01`. A diferencia de la UMA o la tarifa, son de ley y no caducan cada año, así que la razón de la spec 69 para no precargar no aplica.

**SBC**

- **Sí:** historial `RH.employee_sbc` con `vigente_desde`. El SBC cambia cada bimestre y con los aumentos, y un periodo viejo recalculado debe usar el de su momento.
- **No:** una sola columna `sbc` en `RH.empleados`. Pierde el historial.
- **Sí:** capturarlo en una pestaña "IMSS" del expediente. Es dato del empleado, y `proxy.ts` ya restringe el expediente a los roles 1 y 4.
- **Sí:** editar y eliminar con bitácora. Es dato fiscal que captura un tercero (el contador).
- **Sí:** aviso ámbar que no bloquea si el SBC es menor que el salario fiscal o el mínimo. Puede haber casos legítimos de captura, como un aumento aún no capturado en el expediente.
- **No:** calcular el SBC (factor de integración, variables). Lo captura el contador tal como lo reportó en IDSE.
- **Sí:** nombres en inglés (`employee_sbc`, `employee_sbc_log`), siguiendo las tablas recientes de `RH`.

**Persistencia**

- **Sí:** estado, motivo y total en `period_employees`, como el ISR, más el desglose en `payroll.period_employee_imss`. Procesar lee el total sin JOIN, y `period_employees` no crece con 30 columnas más.
- **Sí:** una fila `id_deduction = 1` (SAT 001) con el total, aunque sea 0. Así se distingue "calculado y 0" de "no calculado", igual que el ISR, y el CFDI reporta Seguridad social como una sola deducción.
- **No:** una deducción por ramo en el catálogo. El CFDI no las separa, y las claves 102 a 105 de `imss.md` no son claves SAT.
- **Sí:** el desglose congela tasas, UMA, salario mínimo y SBC con sus vigencias, para que el Detalle explique el cálculo y el aviso "Recalcula" tenga contra qué comparar.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| El contador no confirma la corrección de las tasas y se esperaban los $308.81 de `imss.md`. | La spec queda en Borrador hasta su confirmación. Como las tasas son editables, un ajuste posterior no requiere código. |
| SBC no capturado para muchos empleados al estrenar la spec. | Quedan `'N'` / `missing_sbc` y no se les retiene nada. `ImssNotCalculatedNotice` los cuenta y enlaza a su pestaña IMSS. |
| SBC mal capturado (por ejemplo, el salario diario sin integrar). | Aviso ámbar al capturar. El Detalle muestra el SBC usado y su vigencia, y la bitácora registra quién lo cambió. |
| Olvidar la UMA de febrero: el umbral y el tope salen con la UMA anterior. | Mismo riesgo que en las specs 69 y 73. El Detalle muestra `uma_vigente_desde`. |
| Diferencias de centavos contra el SUA (cambio de SBC a mitad del periodo, redondeo por periodo en lugar de por mes). | Esperadas y aceptadas: por regla de origen no se ajustan. |
| El tope al neto suma las filas de `period_employee_perceptions`. Una percepción fiscal sin fila (snapshot anterior a la spec 73) daría un tope menor. | Esos snapshots ya disparan el aviso "Recalcula" de la spec 73, y al recalcular se generan sus filas. |
| `calculatePayrollPeriod` encadena un concepto más, después del ISR. | El `UPDATE` solo escribe las columnas `imss_*`. Se verifica comparando el snapshot de un periodo calculado antes y después: el ISR y las percepciones no cambian. |
| Cambiar el régimen o el NSS después de calcular. | `isImssRecalculationNeeded` recalcula el estado de hoy y lo detecta. |

## Lo que **no** entra en esta spec

- Las cuotas patronales: EyM cuota fija, Retiro, CEAV progresivo, guarderías, riesgo de trabajo e INFONAVIT.
- Calcular el SBC (factor de integración, variables bimestrales).
- Generar archivos SUA o IDSE, conciliar contra lo pagado o ajustar diferencias.
- Partir el periodo por cambio de SBC, incapacidades y el límite de 7 días de ausentismo.
- Descuentos de crédito INFONAVIT o FONACOT.
- IMSS en la nómina operativa, en aguinaldo, en PTU y en el finiquito (spec 88).
- Salario mínimo fronterizo.
- Reportar la deducción 001 en el CFDI de nómina.
- Bloquear la aprobación con filas `'N'`. La spec 94 decidió advertir, no bloquear.
- Capturar el SBC desde el modal de alta del empleado.

Cada uno, si llega, va en su propia spec.
