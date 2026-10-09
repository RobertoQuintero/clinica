# 69 — Nómina: parámetros fiscales anuales para el ISR

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [52 — Nómina: periodos](52-nomina-periodos.md): `payroll.periods` (`ejercicio`, `id_payment_period`, `fecha_fin`) y `PAYROLL_ALLOWED_ROLE_IDS`.
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md): los renglones fiscales `'F'` y `salario_diario_fiscal`.
  - [56 — Comisión por consultas](56-nomina-comision-consultas.md): patrón de catálogo editable por rangos sin traslapes.
  - [60 — Horas extra: detección y autorización](60-nomina-horas-extra-deteccion-autorizacion.md): patrón de configuración con bitácora.
  - [61 — Horas extra: pago](61-nomina-horas-extra-pago.md): separación dobles/triples, que define cuánto de horas extra es exento.
- **Modifica base de datos:** Sí.
  - Tablas nuevas `payroll.tax_parameters` y `payroll.tax_parameters_log`.
  - `payroll.tablas_retencion`: índice único, sin cambiar columnas.
  - `payroll.perceptions`: llave primaria y columnas de tope de exención.
- **Fecha:** 2026-10-09
- **Objetivo:** Guardar y poder editar, por ejercicio, los datos fiscales que cambian cada año (UMA, salario mínimo, subsidio para el empleo, tarifa semanal del ISR y topes de exención) para que el cálculo del ISR de la nómina fiscal los consuma, sin calcular todavía el ISR.
- **Reglas de origen:** `references/nomina/reglas_modulo_nomina.md` (2.4 horas extra y 3.3 deducciones). Los montos los captura el usuario desde DOF, INEGI y SAT.

## Alcance

**Incluye:**

- **Base de datos.** El DDL se documenta en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 68.
  - `payroll.tax_parameters`: una fila por parámetro y vigencia (`clave`, `valor`, `vigente_desde`). Sin valores precargados; el usuario los captura.
  - `payroll.tax_parameters_log`: una fila por cada alta, cambio o baja.
  - `payroll.tablas_retencion`: se conservan las columnas y se agrega `UNIQUE (ejercicio, id_payment_period, limite_inferior)`.
  - `payroll.perceptions`: `id_perception` pasa a `NOT NULL` con PK y gana `tipo_limite_exencion`, `umas_limite`, `porcentaje_exento` y `periodicidad_limite`. `exempt_limit` (texto libre) se conserva y ya no se consulta.
- **Parámetros en `tax_parameters`**, cada uno con `vigente_desde`:
  - `UMA_DIARIA`, `UMA_MENSUAL`, `UMA_ANUAL` (cambian el 1 de febrero).
  - `SALARIO_MINIMO_GENERAL` y `SALARIO_MINIMO_FRONTERA` (cambian el 1 de enero).
  - `SUBSIDIO_MONTO_MENSUAL`, `SUBSIDIO_TOPE_INGRESO_MENSUAL` y `SUBSIDIO_FACTOR_DIAS_MES` (30.4).
  - `DIAS_ANIO` (365 o 366).
- **Vigencia.** El valor aplicable es el de la fila con `vigente_desde <= fecha_fin` del periodo, la más reciente. Sin fila vigente, el resolutor devuelve `null` y el cálculo se niega, sin valores por defecto.
- **Tarifa ISR semanal** en `tablas_retencion`, editable por ejercicio. Solo la frecuencia semanal (`id_payment_period` de la clave SAT 02).
- **Topes de exención en `perceptions`**, estructurados:
  - `tipo_limite_exencion`: `'N'` sin exención, `'T'` totalmente exenta, `'U'` tope en UMA, `'P'` porcentaje del importe, `'M'` porcentaje con tope en UMA.
  - `periodicidad_limite`: `'D'` día, `'S'` semana, `'M'` mes, `'A'` año, `'E'` evento.
  - Se captura el catálogo completo: sueldo, horas extra (50% con tope de 5 UMA por semana, `'M'`), prima dominical, prima vacacional, aguinaldo y PTU.
- **Pantalla `/dashboard/nomina/parametros-fiscales`**, solo roles 1 y 4.
  - Selector de ejercicio en la URL.
  - Pestañas: Parámetros, Tarifa ISR y Percepciones.
  - Bitácora de parámetros en un `<details>`.
  - Acción "Copiar ejercicio anterior" para la tarifa, que falla si el ejercicio destino ya tiene tramos.
- **Server actions** en `nomina/parametros-fiscales/actions.ts`, todas con `assertPayrollAccess()` y validación `zod`. Las escrituras de parámetros y tramos corren en transacción con `UPDLOCK, HOLDLOCK`.
- **Resolutor puro** `lib/payroll/taxParameters.ts` (`resolveTaxParameter`, `findWithholdingBracket`), sin BD, que usará la spec 70.
- **Documentación:** sección "Parámetros fiscales (spec 69)" en `docs/nomina.md`.

**No incluye (para otras specs):**

- **El cálculo del ISR**, el subsidio aplicado y la retención por renglón (spec 70).
- **Tarifas de otras frecuencias** (quincenal, mensual) ni la tarifa anual del art. 152. Se cargan cuando se usen.
- **IMSS** (SBC, topes, cuotas obrera y patronal).
- **Subsidio por rangos** de años anteriores a 2025.
- **Calcular** aguinaldo, prima vacacional, PTU o finiquito: solo se guardan sus topes de exención.
- **Timbrado CFDI** y catálogos SAT de deducciones y otros pagos.
- **Carga automática** desde DOF, INEGI o SAT.
- **Parámetros por sucursal o empresa.** Los datos fiscales son nacionales.
- **Cambios retroactivos** en periodos ya calculados.

## Modelo de datos

**Cambios en BD.** El DDL va en `queries.txt`, bloque `NOMINA PAYROLL`, después de lo de la spec 68. Antes de crear el índice único y la PK, hay que revisar duplicados y nulos (paso 1 del plan).

```sql
-- Spec 69: parámetros fiscales con vigencia. Sin valores precargados: el usuario los captura.
CREATE TABLE [payroll].[tax_parameters](
    [id_tax_parameter] [int] IDENTITY(1,1) NOT NULL,
    [clave]            [varchar](40)    NOT NULL,
    [valor]            [decimal](18,4)  NOT NULL,
    [vigente_desde]    [date]           NOT NULL,
    [updated_by]       [int]            NOT NULL,
    [updated_at]       [datetime2](0)   NOT NULL,
 CONSTRAINT [PK_tax_parameters] PRIMARY KEY CLUSTERED ([id_tax_parameter] ASC),
 CONSTRAINT [UQ_tax_parameters_clave_vigencia] UNIQUE ([clave], [vigente_desde]),
 CONSTRAINT [CK_tax_parameters_clave] CHECK ([clave] IN (
    'UMA_DIARIA','UMA_MENSUAL','UMA_ANUAL',
    'SALARIO_MINIMO_GENERAL','SALARIO_MINIMO_FRONTERA',
    'SUBSIDIO_MONTO_MENSUAL','SUBSIDIO_TOPE_INGRESO_MENSUAL','SUBSIDIO_FACTOR_DIAS_MES',
    'DIAS_ANIO')),
 CONSTRAINT [CK_tax_parameters_valor] CHECK ([valor] > 0)
) ON [PRIMARY]
GO

-- Spec 69: bitácora. Una fila por alta, cambio o baja.
CREATE TABLE [payroll].[tax_parameters_log](
    [id_log]         [int] IDENTITY(1,1) NOT NULL,
    [clave]          [varchar](40)   NOT NULL,
    [vigente_desde]  [date]          NOT NULL,
    [valor_anterior] [decimal](18,4) NULL,   -- NULL: alta
    [valor_nuevo]    [decimal](18,4) NULL,   -- NULL: baja
    [updated_by]     [int]           NOT NULL,
    [updated_at]     [datetime2](0)  NOT NULL,
 CONSTRAINT [PK_tax_parameters_log] PRIMARY KEY CLUSTERED ([id_log] ASC)
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IX_tax_parameters_log_fecha]
    ON [payroll].[tax_parameters_log] ([updated_at] DESC)
GO

-- Spec 69: un tramo por ejercicio + frecuencia + límite inferior.
ALTER TABLE [payroll].[tablas_retencion] ADD CONSTRAINT [UQ_tablas_retencion_tramo]
    UNIQUE ([ejercicio], [id_payment_period], [limite_inferior])
GO

-- Spec 69: llave primaria y tope de exención estructurado en perceptions.
ALTER TABLE [payroll].[perceptions] ALTER COLUMN [id_perception] [smallint] NOT NULL
GO
ALTER TABLE [payroll].[perceptions] ADD CONSTRAINT [PK_perceptions] PRIMARY KEY CLUSTERED ([id_perception])
GO
ALTER TABLE [payroll].[perceptions] ADD
    [tipo_limite_exencion] [char](1)      NOT NULL CONSTRAINT [DF_perceptions_tipo_limite] DEFAULT ('N'),
    [umas_limite]          [decimal](9,4) NULL,
    [porcentaje_exento]    [decimal](5,2) NULL,
    [periodicidad_limite]  [char](1)      NULL
GO
-- IS NOT NULL explícito: en un CHECK, `NULL > 0` es UNKNOWN y SQL Server lo acepta.
ALTER TABLE [payroll].[perceptions] WITH CHECK ADD CONSTRAINT [CK_perceptions_exencion] CHECK (
    ([tipo_limite_exencion] IN ('N','T') AND [umas_limite] IS NULL AND [porcentaje_exento] IS NULL AND [periodicidad_limite] IS NULL)
 OR ([tipo_limite_exencion] = 'U'
        AND [umas_limite] IS NOT NULL AND [umas_limite] > 0
        AND [porcentaje_exento] IS NULL
        AND [periodicidad_limite] IS NOT NULL AND [periodicidad_limite] IN ('D','S','M','A','E'))
 OR ([tipo_limite_exencion] = 'P'
        AND [porcentaje_exento] IS NOT NULL AND [porcentaje_exento] > 0 AND [porcentaje_exento] <= 100
        AND [umas_limite] IS NULL AND [periodicidad_limite] IS NULL)
 OR ([tipo_limite_exencion] = 'M'
        AND [porcentaje_exento] IS NOT NULL AND [porcentaje_exento] > 0 AND [porcentaje_exento] <= 100
        AND [umas_limite] IS NOT NULL AND [umas_limite] > 0
        AND [periodicidad_limite] IS NOT NULL AND [periodicidad_limite] IN ('D','S','M','A','E')))
GO
```

`tablas_retencion.id_tarifa` no es `IDENTITY`: las altas calculan `MAX(id_tarifa) + 1` dentro de la misma transacción, con `UPDLOCK, HOLDLOCK`.

**Tipos** (archivo nuevo `interfaces/payroll_tax_parameters.ts`):

```ts
export type TaxParameterKey =
  | "UMA_DIARIA" | "UMA_MENSUAL" | "UMA_ANUAL"
  | "SALARIO_MINIMO_GENERAL" | "SALARIO_MINIMO_FRONTERA"
  | "SUBSIDIO_MONTO_MENSUAL" | "SUBSIDIO_TOPE_INGRESO_MENSUAL" | "SUBSIDIO_FACTOR_DIAS_MES"
  | "DIAS_ANIO";

export interface ITaxParameter {
  id_tax_parameter: number;
  clave:            TaxParameterKey;
  valor:            number;
  vigente_desde:    string;   // "YYYY-MM-DD"
  updated_by_name:  string;
  updated_at:       string;   // "YYYY-MM-DD HH:mm:ss"
}

export interface IWithholdingBracket {
  id_tarifa:            number;
  ejercicio:            number;
  id_payment_period:    number;
  limite_inferior:      number;
  limite_superior:      number | null;   // null: tramo abierto
  cuota_fija:           number;
  porcentaje_excedente: number;
}

export type ExemptionLimitType = "N" | "T" | "U" | "P" | "M";
export type ExemptionPeriodicity = "D" | "S" | "M" | "A" | "E";

export interface IPerception {
  id_perception:        number;
  clave_sat:            string;
  description:          string;
  id_taxed_exempt:      number | null;
  tipo_limite_exencion: ExemptionLimitType;
  umas_limite:          number | null;
  porcentaje_exento:    number | null;
  periodicidad_limite:  ExemptionPeriodicity | null;
  is_billed:            boolean;
  status:               boolean;
}

export interface ITaxParametersLogEntry {
  id_log:          number;
  clave:           TaxParameterKey;
  vigente_desde:   string;
  valor_anterior:  number | null;
  valor_nuevo:     number | null;
  updated_by_name: string;
  updated_at:      string;
}
```

**Constantes** (`lib/payroll/constants.ts`): `TAX_PARAMETER_KEYS` (las 9 claves con etiqueta y unidad) y `TAX_PARAMETERS_LOG_PAGE_SIZE = 20`.

**Convenciones:**

- **Fechas.** `vigente_desde` se lee con `CONVERT(varchar(10), ..., 120)` y `updated_at` con `CONVERT(varchar(19), ..., 120)`. `updated_at` se escribe con `buildDate(new Date())`.
- **Decimales.** Al leer, `decimal` pasa por `CAST(... AS float)`, como en las specs 64 a 68.
- **Vigencia.** El valor aplicable es el de la fila con `vigente_desde <= fecha_fin` del periodo, la más reciente. Sin fila, el resolutor devuelve `null` y el cálculo (spec 70) se niega.
- **Tramos.** Se validan con `zod` y otra vez en SQL dentro de la transacción: `limite_inferior >= 0`, `limite_superior > limite_inferior` o `NULL`, `cuota_fija >= 0`, `porcentaje_excedente` entre 0 y 100, sin traslapes y a lo más un tramo abierto. **Los huecos no se bloquean al guardar** (decisión del Paso 6): con traslapes y huecos bloqueados fila por fila no se podría editar un tramo intermedio. La pantalla señala los huecos y `findWithholdingBracket` devuelve `null` en ellos, así que el cálculo (spec 70) se niega.

## Plan de implementación

1. **Revisión previa de datos.** Sin cambiar nada, correr en la BD:
   - duplicados por `(ejercicio, id_payment_period, limite_inferior)` en `tablas_retencion`;
   - filas de `perceptions` con `id_perception` nulo o repetido;
   - si `perceptions` y `cat_taxed_exempt` ya tienen datos.

   Verificación: el resultado se anota en la sección "Registro" de esta spec. Si hay duplicados o nulos, se corrigen a mano antes del paso 2.

2. **BD.** Correr el DDL del Modelo de datos y documentarlo en `queries.txt`, bloque `NOMINA PAYROLL`, después de la spec 68. No cambia código: la app sigue igual.
   - Verificación: `tax_parameters` rechaza un `valor` de 0, una `clave` desconocida y una `(clave, vigente_desde)` repetida.
   - Verificación: `perceptions` rechaza `tipo_limite_exencion = 'U'` sin `umas_limite`.

3. **Tipos, constantes y resolutor puro.**
   - Crear `interfaces/payroll_tax_parameters.ts` y agregar las constantes a `lib/payroll/constants.ts`.
   - Crear `lib/payroll/taxParameters.ts` con `resolveTaxParameter` y `findWithholdingBracket`, sin BD y sin `Date` sobre strings crudos.
   - Verificación manual: con dos filas de `UMA_DIARIA` (desde 2026-01-01 y desde 2026-02-01), una `fecha_fin` de 2026-01-31 resuelve la primera y una de 2026-02-01 la segunda. Sin fila anterior a la fecha devuelve `null`.
   - Verificación manual: un ingreso igual a un `limite_inferior` cae en ese tramo, y uno mayor que el último `limite_superior` cae en el tramo abierto.

4. **Lectura y pantalla de solo lectura.**
   - Crear `getTaxParametersPage`, `getWithholdingTable`, `getPerceptions` y `getTaxParametersLog` (las últimas 20 filas).
   - Crear la ruta `/dashboard/nomina/parametros-fiscales` con las tres pestañas, el selector de ejercicio y la bitácora en `<details>`.
   - Agregar la entrada al menú (`navConfig.tsx`, con `excludeRoles: [2, 3, 5, 6]`) y confirmar que `proxy.ts` ya bloquea `/dashboard/nomina/*` a los demás roles.
   - Verificación: la pestaña Tarifa ISR muestra los tramos semanales ya existentes del ejercicio actual. Las otras pestañas muestran un estado vacío.

5. **Parámetros: alta, edición y baja.**
   - Agregar el schema `zod` y las actions `saveTaxParameter` y `deleteTaxParameter`. Cada una corre en una transacción que lee la fila con `UPDLOCK, HOLDLOCK`, escribe y escribe la bitácora. Un guardado sin cambios no escribe nada.
   - Crear los componentes cliente `TaxParameterModal` y `DeleteTaxParameterButton`, con confirmación dentro de la interfaz y sin `confirm()` nativo.
   - Verificación: capturar `UMA_DIARIA` con `vigente_desde` 2026-02-01 deja una fila en la bitácora con `valor_anterior = NULL`. Editarla deja `anterior → nuevo` y borrarla deja `valor_nuevo = NULL`.

6. **Tarifa ISR: alta, edición, baja y copiar ejercicio.**
   - Crear `saveWithholdingBracket`, `deleteWithholdingBracket` y `copyWithholdingTableFromPreviousYear`, con la validación de tramos del Modelo de datos.
   - `WithholdingBracketModal` avisa de traslapes antes de enviar (el servidor es la autoridad), siguiendo `tierRangeOverlaps` de la spec 56.
   - Verificación: no se puede guardar un tramo traslapado ni un segundo tramo abierto. Copiar 2026 → 2027 duplica los tramos semanales y falla si 2027 ya los tiene.

7. **Percepciones.**
   - Agregar el schema `zod` que refleja `CK_perceptions_exencion` y la action `savePerception`.
   - `PerceptionModal` muestra solo los campos que aplican al `tipo_limite_exencion` elegido.
   - Verificación: guardar horas extra como `'M'` (50%, 5 UMA, por semana) y prima dominical como `'U'` (1 UMA, por evento) funciona. `'U'` sin UMA se rechaza en el formulario y en SQL.

8. **Documentación.** En `docs/nomina.md`:
   - agregar la sección "Parámetros fiscales (spec 69)";
   - actualizar el párrafo inicial con las tablas nuevas y la pantalla;
   - decir que el ISR queda para la spec 70.

## Criterios de aceptación

**Base de datos**

- [ ] Existen `payroll.tax_parameters` y `payroll.tax_parameters_log`.
- [ ] `tax_parameters` rechaza `valor <= 0`, una `clave` fuera de la lista y una `(clave, vigente_desde)` repetida.
- [ ] `tablas_retencion` rechaza un segundo tramo con el mismo `(ejercicio, id_payment_period, limite_inferior)`.
- [ ] `perceptions.id_perception` es `NOT NULL` con PK.
- [ ] `perceptions` rechaza cada combinación inválida de `CK_perceptions_exencion`:
  - `'N'` con `umas_limite`;
  - `'U'` sin `periodicidad_limite`;
  - `'P'` con `porcentaje_exento` mayor que 100.
- [ ] El DDL está en `queries.txt`, bloque `NOMINA PAYROLL`.

**Acceso**

- [ ] Los roles 1 y 4 abren `/dashboard/nomina/parametros-fiscales`.
- [ ] Un usuario con rol 2, 3, 5 o 6 es redirigido por `proxy.ts` y no ve la entrada del menú.
- [ ] Un usuario con rol 2, 3, 5 o 6 que llama a cualquier action directamente recibe `{ ok: false }`.

**Parámetros**

- [ ] Se puede capturar, editar y borrar cada una de las 9 claves, con su `vigente_desde`.
- [ ] La pestaña Parámetros muestra solo las filas cuyo `vigente_desde` cae en el ejercicio del selector.
- [ ] Cada alta, cambio o baja escribe una fila en la bitácora.
- [ ] Un guardado sin cambios no escribe en la bitácora ni cambia `updated_at`.
- [ ] La bitácora muestra las últimas 20 entradas.
- [ ] `resolveTaxParameter` devuelve el valor de la fila más reciente con `vigente_desde <= fecha_fin` y `null` si no hay ninguna.

**Tarifa ISR**

- [ ] Se listan los tramos semanales del ejercicio seleccionado, ordenados por `limite_inferior`.
- [ ] No se puede guardar un tramo que traslape a otro.
- [ ] No se puede guardar un segundo tramo abierto.
- [ ] No se puede guardar un tramo con `limite_superior <= limite_inferior`.
- [ ] Dos altas simultáneas no producen el mismo `id_tarifa`.
- [ ] La pantalla señala los huecos de la tarifa (entre qué montos) y los tramos contiguos no los generan.
- [ ] "Copiar ejercicio anterior" copia todos los tramos semanales y falla si el ejercicio destino ya tiene tramos.
- [ ] `findWithholdingBracket` ubica un ingreso en el primer tramo, en el límite exacto entre dos tramos y en el tramo abierto.

**Percepciones**

- [ ] El formulario solo pide los campos que aplican al tipo de límite elegido.
- [ ] Una percepción `'M'` guarda porcentaje, UMA y periodicidad, y una `'T'` o `'N'` no guarda ninguno.
- [ ] Horas extra se puede guardar como `'M'` con 50%, 5 UMA y periodicidad semanal.
- [ ] Prima dominical se puede guardar como `'U'` con 1 UMA y periodicidad por evento.

**Documentación**

- [ ] `docs/nomina.md` tiene la sección "Parámetros fiscales (spec 69)".
- [ ] El párrafo inicial de `docs/nomina.md` menciona las tablas nuevas y dice que el ISR queda para la spec 70.

## Decisiones tomadas y descartadas

- **Sí:** el alcance es solo los datos y su captura, y el cálculo del ISR va en la spec 70. Es decisión del usuario: primero tener los datos antes de implementar el cálculo.
- **Sí:** solo la frecuencia semanal por ahora. Es decisión del usuario. Las demás tarifas se cargan cuando se usen, con la misma pantalla.
- **Sí:** `tax_parameters` es una tabla clave-valor con `vigente_desde`. La UMA cambia el 1 de febrero y el salario mínimo el 1 de enero, y un parámetro nuevo no exige cambiar el esquema.
- **No:** una fila por ejercicio con una columna por parámetro. No puede representar la UMA, que cambia a mitad de año.
- **Sí:** el valor se resuelve con la `fecha_fin` del periodo. Es decisión del usuario.
- **No:** `fecha_pago` ni `fecha_corte` como fecha de vigencia. Se consideraron y se descartaron por decisión del usuario.
- **Sí:** sin valores numéricos precargados. Es decisión del usuario: los captura desde DOF, INEGI y SAT, y la spec no se queda desactualizada.
- **Sí:** sin valor vigente, el cálculo se niega y avisa. No hay valores por defecto, porque un ISR calculado con la UMA del año pasado es un error silencioso.
- **Sí:** el subsidio para el empleo se calcula aparte, con tres parámetros (monto mensual, tope de ingreso y factor de 30.4 días). Es decisión del usuario. Desde 2025 es un monto fijo y no una tabla por rangos.
- **No:** añadir una columna de subsidio a `tablas_retencion`.
- **Sí:** la tarifa del ISR se queda en `tablas_retencion`, que ya existe con la semanal.
- **Sí:** `UNIQUE (ejercicio, id_payment_period, limite_inferior)` más validación de traslapes en transacción, como en `commission_tiers`.
- **Sí:** no se permiten huecos en la tarifa. A diferencia de las comisiones (spec 56), la tarifa del SAT es continua y un hueco sería un tramo mal capturado.
- **No:** convertir `id_tarifa` en `IDENTITY`. Cambiarlo en una tabla con PK y datos exige recrearla. Se usa `MAX + 1` dentro de la transacción.
- **Sí:** el tope de exención se estructura en columnas (`tipo_limite_exencion`, `umas_limite`, `porcentaje_exento`, `periodicidad_limite`) con un `CHECK` que amarra cada combinación. El texto libre `exempt_limit` no se puede calcular.
- **Sí:** `exempt_limit` se conserva sin consultarse, para no perder lo ya capturado. Borrarlo se deja para cuando se confirme que no se usa.
- **Sí:** horas extra siguen la regla legal. Es decisión del usuario: las dobles son `'M'` (50% con tope de 5 UMA por semana) y las triples quedan totalmente gravadas.
- **No:** la regla de origen de "primeras 9 horas exentas" (`reglas_modulo_nomina.md`, 2.4). Esa sección del documento queda desactualizada respecto al sistema y conviene corregirla en el documento.
- **Sí:** se captura el catálogo completo de percepciones (sueldo, horas extra, prima dominical, prima vacacional, aguinaldo y PTU). Es decisión del usuario, siguiendo la recomendación: la estructura es barata y evita otra migración cuando se calculen esos conceptos.
- **No:** calcular aguinaldo, prima vacacional o PTU en esta spec. Solo se guardan sus topes.
- **Sí:** "Copiar ejercicio anterior" para la tarifa. Cada año solo cambian los montos, y copiar evita recapturar los tramos.
- **No:** copiar también los parámetros. Cada uno trae su propia fecha de vigencia, y un valor copiado se vería correcto cuando no lo es.
- **Sí:** los datos fiscales son nacionales, sin `id_empresa` ni `id_sucursal`. La bitácora tampoco los lleva.
- **Sí:** solo roles 1 y 4 (`PAYROLL_ALLOWED_ROLE_IDS`), con la misma triple compuerta de nómina: `proxy.ts`, `navConfig.tsx` y `assertPayrollAccess()`.
- **No:** IMSS en esta spec. No entra a la base del ISR y requiere sus propias tablas (SBC, topes, tasas).
- **Sí:** el resolutor es un helper puro en `lib/payroll/taxParameters.ts`, sin BD, para que la pantalla y la spec 70 compartan la misma regla de vigencia y de tramos.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| **Un valor mal capturado** (UMA, tramo, monto del subsidio) produce retenciones incorrectas en toda la nómina fiscal. | La bitácora deja rastro de quién cambió qué. Antes de dar por bueno el cálculo (spec 70), comparar 3 a 5 casos contra el simulador del SAT. |
| **Olvidar capturar la UMA nueva en febrero.** El resolutor sigue usando la de enero y las exenciones salen desfasadas. | El cálculo (spec 70) debe mostrar con qué `vigente_desde` se calculó cada parámetro. Anotar la captura de febrero en la operación anual. |
| **El índice único falla** si `tablas_retencion` ya tiene tramos duplicados. | Paso 1: revisar duplicados antes del DDL y corregirlos a mano. |
| **`ALTER COLUMN ... NOT NULL` o la PK fallan** si `perceptions` tiene `id_perception` nulos o repetidos. | Paso 1: revisar antes y corregir a mano. |
| **Un tramo abierto mal capturado** hace que los ingresos altos no encuentren tarifa. | Validación de a lo más un tramo abierto, y el resolutor devuelve `null` en vez de inventar un tramo. |
| **El documento de origen contradice al sistema** en horas extra exentas (dice 9 horas, el sistema usa la regla legal). | Corregir la sección 2.4 de `references/nomina/reglas_modulo_nomina.md` cuando se implemente. |
| **Los periodos ya calculados no cambian** si se edita un parámetro después. | Es lo esperado. La spec 70 congelará en el snapshot lo que use; mientras tanto, solo "Recalcular" aplica el valor nuevo. |

## Registro

- **2026-10-09 — Análisis y especificación.** Se revisó `docs/nomina.md`, el DDL en `queries.txt` (`tablas_retencion`, `perceptions`, `cat_taxed_exempt`) y `references/nomina/reglas_modulo_nomina.md`. Hallazgos:
  - `tablas_retencion` solo cubre la tarifa semanal del art. 96; no hay UMA, salario mínimo, subsidio ni topes de exención en ninguna tabla.
  - `perceptions.exempt_limit` es texto libre y `id_perception` es nullable y sin PK.
  - La regla de horas extra exentas del documento de origen (9 horas) no coincide con el tope legal; se decidió seguir el tope legal.
- **2026-10-09 — Paso 1: revisión previa de datos.** Solo `SELECT`, sin cambios en la BD. Resultado:
  - `tablas_retencion`: 11 filas, **0 duplicados** por `(ejercicio, id_payment_period, limite_inferior)`.
  - `perceptions`: 12 filas, **0** con `id_perception` nulo y **0** repetidos.
  - `cat_taxed_exempt`: 3 filas.
  - Conclusión: el `UNIQUE` y la PK del paso 2 no requieren correcciones previas.
- **2026-10-09 — Paso 2: BD.** DDL aplicado y documentado en `queries.txt`. Al verificar, `CK_perceptions_exencion` aceptaba `'U'` sin `umas_limite` o sin `periodicidad_limite` (y `'P'`/`'M'` con campos nulos): en un `CHECK`, `NULL > 0` y `NULL IN (...)` evalúan a `UNKNOWN` y SQL Server lo acepta. Se recreó la restricción con `IS NOT NULL` explícito en cada rama y se corrigió el DDL de esta spec y de `queries.txt`. Verificado con rollback: rechaza `'U'` sin UMA, `'U'` sin periodicidad, `'P'` sin porcentaje, `'M'` sin UMA o sin porcentaje, `'N'`/`'T'` con campos y `'P'` > 100; acepta `'M'`, `'U'`, `'P'` y `'T'` válidos.
- **2026-10-09 — Paso 3 a 5.** Tipos, constantes, resolutor puro, pantalla de lectura y alta/edición/baja de parámetros. Se corrigió además `tablas_retencion`: las 11 filas de 2026 venían con `id_payment_period = 2` (quincenal) pero son montos semanales; se pasaron a `1` (semanal) para que la pantalla las muestre.
- **2026-10-09 — Paso 6: tarifa ISR.** Decisión del usuario sobre huecos: la regla "sin huecos" de esta spec, aplicada fila por fila junto con "sin traslapes", impide editar un tramo intermedio (subir un superior traslapa con el siguiente; subir antes el inferior del siguiente deja un hueco; borrar un intermedio deja un hueco). Se eligió **bloquear solo traslapes, tramo abierto duplicado y rangos inválidos** al guardar, y **señalar los huecos** en pantalla. Verificado con rollback: copia 2026 → 2027 (11 tramos, ids únicos) y falla si el destino ya tiene tramos o el origen está vacío; traslape (incluido el límite exacto), segundo tramo abierto, `superior <= inferior` y porcentaje 101 rechazados en SQL; edición en dos pasos aceptada; dos altas concurrentes se serializan por `UPDLOCK, HOLDLOCK` sobre `MAX(id_tarifa)`.
- **Pendiente:** pasos 7 y 8 del Plan de implementación. Al terminar cada paso, marcar sus criterios de aceptación; al cerrar la spec, cambiar el estado a "Implementado".

## Lo que no incluye esta spec

- El cálculo del ISR, el subsidio aplicado y la retención por renglón (spec 70).
- Tarifas de otras frecuencias y la tarifa anual del art. 152.
- IMSS (SBC, topes, cuotas obrera y patronal).
- Subsidio por rangos de años anteriores a 2025.
- Cálculo de aguinaldo, prima vacacional, PTU y finiquito.
- Timbrado CFDI y catálogos SAT de deducciones y otros pagos.
- Carga automática desde DOF, INEGI o SAT.
- Parámetros por sucursal o empresa.
- Cambios retroactivos en periodos ya calculados.

Cada uno de estos puntos, si se llega a hacer, va en su propia spec.
