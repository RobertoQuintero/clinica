# 71 — Empleados: datos fiscales para el CFDI de nómina

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [25 — Empleados: alta, listado y expediente](25-empleados-alta-listado-detalle.md): `RH.empleados`, `EmployeeModal.tsx`, `createEmployee` / `updateEmployee`.
  - [38 — Contactos de referencia y salario fiscal](38-empleado-contactos-referencia-salario-fiscal.md): `salario_diario_fiscal`, que decide si un empleado es fiscal.
  - [51 — Periodo de pago del empleado](51-periodo-pago-empleado.md): `id_periodo_pago` → `RH.payment_periods.clave_sat` (`PeriodicidadPago`).
  - [53 — Nómina: cálculo de salario](53-nomina-calculo-salario.md): un empleado entra a la nómina fiscal solo si `salario_diario_fiscal > 0`.
- **Modifica base de datos:** Sí.
  - Tabla nueva `RH.cat_bancos` (catálogo SAT `c_Banco`).
  - `RH.empleados`: columnas nuevas de datos fiscales, `CHECK` de formato creados `WITH NOCHECK` y un `UPDATE` único con valores por defecto.
- **Fecha:** 2026-10-12
- **Objetivo:** Capturar y validar en el formulario de empleado todos los datos del receptor que exigen el CFDI 4.0 y el complemento de Nómina 1.2, obligatorios cuando el empleado está en la nómina fiscal, y mostrar en el expediente qué le falta para poder timbrar.
- **Reglas de origen:** Anexo 20 del CFDI 4.0, complemento de Nómina 1.2 rev. E y su guía de llenado (catálogos `c_TipoContrato`, `c_TipoRegimen`, `c_TipoJornada`, `c_Banco`, `c_Estado`).

## Alcance

**Incluye:**

- **Base de datos.** El DDL se documenta en `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`, después de lo de la spec 51.
  - Tabla nueva `RH.cat_bancos` con el catálogo `c_Banco` completo, sembrado con `INSERT`.
  - `RH.empleados` gana estas columnas, todas `NULL`:
    - `codigo_postal_fiscal`
    - `tipo_regimen`
    - `tipo_contrato`
    - `tipo_jornada`
    - `sindicalizado`
    - `banco`, con FK a `RH.cat_bancos`
  - `CHECK` de formato sobre `rfc`, `curp`, `nss`, `codigo_postal_fiscal`, `cuenta_bancaria` y las claves SAT. Se crean `WITH NOCHECK` para no rechazar los datos actuales.
  - `UPDATE` único que pone `tipo_regimen = '02'`, `tipo_contrato = '01'`, `tipo_jornada = '01'` y `sindicalizado = 0` a los empleados existentes.
- **Catálogos SAT en TypeScript.** `lib/payroll/satCatalogs.ts` guarda `c_TipoContrato`, `c_TipoRegimen` y `c_TipoJornada` como constantes. También guarda las claves fijas del receptor (`RegimenFiscalReceptor = '605'`, `UsoCFDI = 'CN01'`), aunque esta spec no las usa todavía.
- **Reglas puras** en `lib/payroll/payrollStampingReadiness.ts`. Las usan el schema del servidor, el modal y el expediente:
  - formatos (RFC de persona física, CURP, NSS, CP y cuenta de 10, 11, 16 o 18 dígitos);
  - qué es obligatorio para un empleado fiscal (`salario_diario_fiscal > 0`):
    - **siempre:** RFC, CURP, CP fiscal, `tipo_contrato`, `tipo_regimen` e `id_periodo_pago`;
    - **si `tipo_regimen` es 02, 03 o 04:** también NSS y `tipo_jornada`;
    - **si la cuenta tiene 10, 11 o 16 dígitos:** `banco`;
    - **si la cuenta es CLABE (18 dígitos):** sin `banco`;
  - regla cruzada: `tipo_contrato` 01–08 exige `tipo_regimen` 02–04, y `tipo_contrato` 09, 10 o 99 exige `tipo_regimen` 05–13 o 99;
  - "La sucursal no tiene estado": `ClaveEntFed` sale de `dbo.Cat_states.state_key` de la sucursal del empleado.
- **Validación con `zod`** en `app/dashboard/empleados/schemas.ts` (`server-only`).
  - Reemplaza a `validateRequiredFields` en `createEmployee` y `updateEmployee`.
  - Normaliza antes de validar: RFC y CURP en mayúsculas y sin espacios, y la cuenta sin espacios ni guiones.
  - Los formatos se validan siempre que el campo traiga valor, sea el empleado fiscal o no.
  - Si un empleado fiscal no cumple las reglas, la acción devuelve `{ ok: false, message }` y no guarda.
- **`app/dashboard/empleados/actions.ts`:**
  - SELECT, INSERT y UPDATE de las columnas nuevas.
  - El detalle trae también `state_key` de la sucursal (`LEFT JOIN dbo.Cat_states`).
  - `getEmployeeCatalogs` agrega los bancos activos.
- **`EmployeeModal.tsx`:**
  - Sección nueva **"Datos fiscales (CFDI de nómina)"** con RFC, CURP y NSS (se mueven a ella), CP fiscal, tipo de régimen, tipo de contrato, tipo de jornada y sindicalizado.
  - La cuenta bancaria y el selector de banco se quedan en "Información laboral". El banco se deshabilita y se limpia cuando la cuenta tiene 18 dígitos.
  - Los asteriscos de obligatorio aparecen y desaparecen según `salario_diario_fiscal` y `tipo_regimen`.
  - En el alta se prellenan los mismos valores por defecto que pone el `UPDATE`.
- **Expediente:**
  - `EmployeeHeader.tsx`: badge "Datos fiscales completos" o "Faltan N datos fiscales". Solo aparece si el empleado es fiscal.
  - `EmployeeGeneralInfo.tsx`: tarjeta "Datos fiscales" con:
    - los valores capturados, con la descripción del catálogo;
    - el nombre fiscal derivado (`nombre + apellidos` en mayúsculas), de solo lectura;
    - la `ClaveEntFed` derivada;
    - la lista de lo que falta.
- **Documentación:** sección "Datos fiscales (spec 71)" en `docs/rh-empleados.md`.

**No incluye (para otras specs):**

- **El timbrado del CFDI de nómina** (armado del XML o del payload de Facturapi, envío al PAC, cancelación), los recibos y la dispersión.
- **Datos del patrón:** registro patronal, `RiesgoPuesto`, RFC emisor y la organización de Facturapi que emite la nómina.
- **SDI y SBC** (`SalarioDiarioIntegrado`, `SalarioBaseCotApor`). Llegan con la spec del IMSS.
- **Un campo `nombre_fiscal`** y la normalización de acentos o caracteres del nombre para el PAC. Se decide en la spec de timbrado.
- **Validar RFC, nombre y CP contra el SAT** (lista LCO o constancia de situación fiscal). Lo rechaza el PAC al timbrar.
- **Columna o filtro de completitud** en el listado de empleados.
- **Domicilio estructurado:** `direccion` sigue siendo texto libre.
- **Subcontratación** (nodo `SubContratacion`).
- **Limpiar a mano** el RFC y la CURP que hoy están mal capturados. Se corrigen al editar al empleado.

## Modelo de datos

**Cambios en BD.** El DDL va en `queries.txt`, bloque `RECURSOS HUMANOS(EMPLEADOS)`, después de lo de la spec 51. Se ejecuta a mano contra la BD.

```sql
-- Spec 71: catálogo SAT c_Banco (clave de 3 dígitos).
CREATE TABLE [RH].[cat_bancos](
    [clave]        [char](3)      NOT NULL,
    [nombre]       [varchar](100) NOT NULL,   -- nombre corto, ej. 'BANAMEX'
    [razon_social] [varchar](250) NULL,
    [status]       [bit]          NOT NULL CONSTRAINT [DF_cat_bancos_status] DEFAULT (1),
 CONSTRAINT [PK_cat_bancos] PRIMARY KEY CLUSTERED ([clave] ASC),
 CONSTRAINT [CK_cat_bancos_clave] CHECK ([clave] LIKE '[0-9][0-9][0-9]')
) ON [PRIMARY]
GO
-- INSERT con el catálogo c_Banco completo, tal como lo publica el SAT.

-- Spec 71: datos del receptor para el CFDI de nómina.
ALTER TABLE [RH].[empleados] ADD
    [codigo_postal_fiscal] [char](5)    NULL,   -- DomicilioFiscalReceptor
    [tipo_regimen]         [varchar](2) NULL,   -- c_TipoRegimen
    [tipo_contrato]        [varchar](2) NULL,   -- c_TipoContrato
    [tipo_jornada]         [varchar](2) NULL,   -- c_TipoJornada
    [sindicalizado]        [bit]        NULL,   -- NULL se envía como 'No'
    [banco]                [char](3)    NULL
        CONSTRAINT [FK_empleados_banco] FOREIGN KEY REFERENCES [RH].[cat_bancos] ([clave]);
GO

-- Formatos y valores de catálogo. WITH NOCHECK: los datos actuales no se validan,
-- pero todo INSERT/UPDATE posterior sí. Ojo: el UPDATE de un empleado con RFC
-- o CURP mal capturados fallará hasta que se corrijan.
ALTER TABLE [RH].[empleados] WITH NOCHECK ADD
    CONSTRAINT [CK_empleados_rfc] CHECK ([rfc] IS NULL OR [rfc] LIKE
        '[A-ZÑ&][A-ZÑ&][A-ZÑ&][A-ZÑ&][0-9][0-9][0-9][0-9][0-9][0-9][A-Z0-9][A-Z0-9][A-Z0-9]'),
    CONSTRAINT [CK_empleados_curp] CHECK ([curp] IS NULL OR [curp] LIKE
        '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][0-9][0-9][HMX][A-Z][A-Z][A-Z][A-Z][A-Z][A-Z0-9][0-9]'),
    CONSTRAINT [CK_empleados_nss] CHECK ([nss] IS NULL OR (LEN([nss]) = 11 AND [nss] NOT LIKE '%[^0-9]%')),
    CONSTRAINT [CK_empleados_cp_fiscal] CHECK ([codigo_postal_fiscal] IS NULL
        OR [codigo_postal_fiscal] LIKE '[0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT [CK_empleados_cuenta_bancaria] CHECK ([cuenta_bancaria] IS NULL
        OR (LEN([cuenta_bancaria]) IN (10, 11, 16, 18) AND [cuenta_bancaria] NOT LIKE '%[^0-9]%')),
    CONSTRAINT [CK_empleados_banco_sin_clabe] CHECK ([banco] IS NULL
        OR ([cuenta_bancaria] IS NOT NULL AND LEN([cuenta_bancaria]) <> 18)),
    CONSTRAINT [CK_empleados_tipo_regimen] CHECK ([tipo_regimen] IS NULL OR [tipo_regimen] IN
        ('02','03','04','05','06','07','08','09','10','11','12','13','99')),
    CONSTRAINT [CK_empleados_tipo_contrato] CHECK ([tipo_contrato] IS NULL OR [tipo_contrato] IN
        ('01','02','03','04','05','06','07','08','09','10','99')),
    CONSTRAINT [CK_empleados_tipo_jornada] CHECK ([tipo_jornada] IS NULL OR [tipo_jornada] IN
        ('01','02','03','04','05','06','07','08','99')),
    CONSTRAINT [CK_empleados_contrato_regimen] CHECK ([tipo_contrato] IS NULL OR [tipo_regimen] IS NULL
        OR ([tipo_contrato] IN ('01','02','03','04','05','06','07','08') AND [tipo_regimen] IN ('02','03','04'))
        OR ([tipo_contrato] IN ('09','10','99') AND [tipo_regimen] NOT IN ('02','03','04')));
GO

-- Valores por defecto para los empleados existentes (una sola vez).
UPDATE [RH].[empleados]
   SET [tipo_regimen]  = ISNULL([tipo_regimen],  '02'),
       [tipo_contrato] = ISNULL([tipo_contrato], '01'),
       [tipo_jornada]  = ISNULL([tipo_jornada],  '01'),
       [sindicalizado] = ISNULL([sindicalizado], 0);
GO
```

- Las columnas `rfc varchar(13)`, `curp varchar(18)`, `nss varchar(15)` y `cuenta_bancaria varchar(100)` **no cambian de tipo**. Solo ganan `CHECK`.
- **Las reglas de "obligatorio si es fiscal" no van en la BD.** Dependen de `salario_diario_fiscal` y de la combinación de campos, y se validan en `zod` y en `payrollStampingReadiness.ts`. La BD solo garantiza formato y coherencia entre campos.
- `ClaveEntFed` no se guarda. Se deriva de `dbo.sucursales.id_state` → `dbo.Cat_states.state_key`, que ya contiene la clave `c_Estado`.

**`interfaces/employee.ts`**

```ts
// IEmployee gana (EmployeeFormInput los hereda por Omit):
codigo_postal_fiscal: string | null;
tipo_regimen:         string | null;   // clave c_TipoRegimen
tipo_contrato:        string | null;   // clave c_TipoContrato
tipo_jornada:         string | null;   // clave c_TipoJornada
sindicalizado:        boolean | null;
banco:                string | null;   // clave c_Banco

// IEmployeeRecord gana:
nombre_banco:         string | null;   // JOIN RH.cat_bancos
clave_estado_sat:     string | null;   // Cat_states.state_key de la sucursal; NULL si no tiene estado
```

**`interfaces/rh_catalogs.ts`**

```ts
export interface IBank {
  clave:        string;
  nombre:       string;
  razon_social: string | null;
  status:       boolean;
}
// IEmployeeCatalogs (empleados/actions.ts) gana: banks: IBank[]
```

**`lib/payroll/satCatalogs.ts`** (constantes, sin BD)

```ts
export const SAT_CONTRACT_TYPES: ReadonlyArray<{ key: string; label: string }>; // c_TipoContrato 01–10, 99
export const SAT_REGIME_TYPES:   ReadonlyArray<{ key: string; label: string }>; // c_TipoRegimen 02–13, 99
export const SAT_WORKDAY_TYPES:  ReadonlyArray<{ key: string; label: string }>; // c_TipoJornada 01–08, 99
export const PAYROLL_RECEIVER_TAX_REGIME = "605";
export const PAYROLL_CFDI_USE = "CN01";
export const DEFAULT_EMPLOYEE_FISCAL_VALUES = {
  tipo_regimen: "02", tipo_contrato: "01", tipo_jornada: "01", sindicalizado: false,
};
```

**`lib/payroll/payrollStampingReadiness.ts`** (puro, se puede importar en cliente y en servidor)

```ts
export const RFC_PERSONA_FISICA_PATTERN: RegExp;
export const CURP_PATTERN: RegExp;
export const NSS_PATTERN: RegExp;           // 11 dígitos
export const POSTAL_CODE_PATTERN: RegExp;   // 5 dígitos
export const BANK_ACCOUNT_PATTERN: RegExp;  // 10, 11, 16 o 18 dígitos

export type StampingField =
  | "rfc" | "curp" | "nss" | "codigo_postal_fiscal" | "tipo_regimen" | "tipo_contrato"
  | "tipo_jornada" | "id_periodo_pago" | "banco" | "cuenta_bancaria" | "estado_sucursal";

export interface StampingIssue {
  field:  StampingField;
  reason: "missing" | "invalid" | "inconsistent";
  label:  string;   // texto en español para la UI, ej. "Falta el código postal fiscal"
}

export function isFiscalEmployee(employee: { salario_diario_fiscal: number | null }): boolean;
export function getRequiredStampingFields(employee: EmployeeFormInput): StampingField[];   // asteriscos del modal
export function getStampingIssues(
  employee: EmployeeFormInput,
  branchStateKey: string | null,
): StampingIssue[];   // [] = listo para timbrar; tarjeta y badge del expediente
```

- El nombre fiscal no se guarda. Se arma en el expediente como `nombre + apellido_paterno + apellido_materno` en mayúsculas, con un solo espacio entre partes, y se reutiliza `buildFullName`.

## Plan de implementación

Cada paso compila (`npx tsc --noEmit`) y deja la app funcionando.

1. **BD, parte 1: catálogo y columnas.**
   - Ejecutar contra la BD el `CREATE TABLE [RH].[cat_bancos]` con el `INSERT` completo de `c_Banco`, el `ALTER TABLE ... ADD` de las 6 columnas y el `UPDATE` de valores por defecto.
   - Documentarlo en `queries.txt`.
   - Los `CHECK` **no** se crean todavía. El código actual no toca las columnas nuevas, así que nada se rompe.
   - Prueba manual: `SELECT` de `RH.empleados` muestra los 5 empleados con `02/01/01/0`, y `RH.cat_bancos` tiene el catálogo.
2. **Catálogos y reglas puras.**
   - Crear `lib/payroll/satCatalogs.ts` y `lib/payroll/payrollStampingReadiness.ts` como se describe en el Modelo de datos.
   - Todavía nadie los consume.
3. **Interfaces y lectura/escritura.**
   - `interfaces/employee.ts` e `interfaces/rh_catalogs.ts`: los campos nuevos y `IBank`.
   - `empleados/actions.ts`:
     - SELECT, INSERT y UPDATE de las 6 columnas;
     - `LEFT JOIN` a `RH.cat_bancos` (`nombre_banco`) y a `dbo.Cat_states` (`clave_estado_sat`) en el detalle;
     - `banks` en `getEmployeeCatalogs`.
   - `EmployeeModal.tsx`: solo `buildEmptyForm()` (con `DEFAULT_EMPLOYEE_FISCAL_VALUES`) y `employeeToFormInput()`, sin UI nueva. Así una edición conserva los valores y no los manda en `NULL`.
   - Prueba manual: editar un empleado y guardar no altera sus columnas fiscales.
4. **Validación con `zod` y `CHECK` en BD.**
   - Crear `app/dashboard/empleados/schemas.ts` (`server-only`). Normaliza los valores y aplica formatos, obligatorios de fiscal y regla cruzada usando `payrollStampingReadiness.ts`.
   - Reemplazar `validateRequiredFields` en `createEmployee` y `updateEmployee`. El primer error vuelve como `{ ok: false, message }`.
   - Después, ejecutar y documentar el `ALTER TABLE ... WITH NOCHECK ADD CONSTRAINT` con todos los `CHECK`.
   - Prueba manual: guardar un empleado fiscal sin CP muestra el error en el modal. Uno no fiscal con RFC de 12 caracteres también lo rechaza por formato.
5. **Sección "Datos fiscales (CFDI de nómina)" en el modal.**
   - Aplicar el skill `frontend-design`.
   - Mover RFC, CURP y NSS a la sección y agregar CP fiscal y los selects de régimen, contrato y jornada (de `satCatalogs.ts`) y sindicalizado.
   - Agregar el select de banco junto a la cuenta en "Información laboral". Se deshabilita y se limpia con 18 dígitos.
   - Los asteriscos salen de `getRequiredStampingFields`.
   - Prueba manual: al cambiar `salario_diario_fiscal` a 0 desaparecen los asteriscos, y al cambiar el régimen a 09 desaparecen los de NSS y jornada.
6. **Expediente.**
   - `EmployeeGeneralInfo.tsx`: tarjeta "Datos fiscales" con los valores (descripción del catálogo), el nombre fiscal derivado, la `ClaveEntFed` y la lista de `getStampingIssues`.
   - `EmployeeHeader.tsx`: badge "Datos fiscales completos" o "Faltan N datos fiscales", solo si el empleado es fiscal.
   - Ambos siguen siendo Server Components.
   - Prueba manual: el empleado con el RFC mal capturado muestra "RFC con formato inválido".
7. **Documentación.** Sección "Datos fiscales (spec 71)" en `docs/rh-empleados.md`: columnas, `CHECK` `WITH NOCHECK`, reglas de obligatoriedad, de dónde sale `ClaveEntFed` y lo que queda pendiente para la spec de timbrado.

## Criterios de aceptación

**Base de datos**

- [ ] `RH.cat_bancos` existe con el catálogo `c_Banco` completo, y su DDL e `INSERT` están en `queries.txt`.
- [ ] `RH.empleados` tiene `codigo_postal_fiscal`, `tipo_regimen`, `tipo_contrato`, `tipo_jornada`, `sindicalizado` y `banco`, con FK de `banco` a `RH.cat_bancos`.
- [ ] Los 5 empleados existentes tienen `tipo_regimen = '02'`, `tipo_contrato = '01'`, `tipo_jornada = '01'` y `sindicalizado = 0`.
- [ ] Los 10 `CHECK` de la spec existen, creados `WITH NOCHECK`, y están documentados en `queries.txt`.
- [ ] Un `UPDATE` directo en SQL con `rfc = 'ABC123'` es rechazado por `CK_empleados_rfc`.
- [ ] Un `UPDATE` directo con `cuenta_bancaria` de 18 dígitos y `banco` no nulo es rechazado por `CK_empleados_banco_sin_clabe`.

**Validación (`createEmployee` / `updateEmployee`)**

- [ ] Guardar un empleado con `salario_diario_fiscal > 0` sin RFC, CURP, CP fiscal, tipo de contrato, tipo de régimen o periodo de pago devuelve `{ ok: false }` con un mensaje que nombra el campo, y no escribe en la BD.
- [ ] Con régimen `02` falta NSS o tipo de jornada → rechazado. Con régimen `09` y sin esos dos datos → se guarda.
- [ ] Contrato `01` con régimen `09` → rechazado por la regla cruzada.
- [ ] Cuenta de 10 dígitos sin banco en un empleado fiscal → rechazado.
- [ ] Cuenta de 18 dígitos → se guarda con `banco = NULL` aunque el cliente haya mandado un banco.
- [ ] Un empleado con `salario_diario_fiscal` nulo o 0 se guarda sin ningún dato fiscal.
- [ ] Ese mismo empleado no fiscal es rechazado si captura un RFC, CURP, NSS, CP o cuenta con formato inválido.
- [ ] Un RFC o CURP capturado en minúsculas o con espacios se guarda en mayúsculas y sin espacios.
- [ ] Una cuenta capturada con espacios o guiones se guarda solo con dígitos.
- [ ] `validateRequiredFields` ya no existe en `empleados/actions.ts`.

**Modal**

- [ ] El modal tiene la sección "Datos fiscales (CFDI de nómina)" con RFC, CURP, NSS, CP fiscal, tipo de régimen, tipo de contrato, tipo de jornada y sindicalizado. RFC, CURP y NSS ya no aparecen en otra sección.
- [ ] En un alta nueva, régimen, contrato, jornada y sindicalizado vienen prellenados con `02`, `01`, `01` y "No".
- [ ] Con `salario_diario_fiscal > 0` los campos obligatorios muestran asterisco. Con 0 o vacío no lo muestran.
- [ ] Al cambiar el régimen a `09` desaparecen los asteriscos de NSS y tipo de jornada.
- [ ] Al capturar una cuenta de 18 dígitos, el select de banco se deshabilita y queda vacío.
- [ ] Editar a un empleado existente y guardar sin tocar nada conserva sus valores fiscales.

**Expediente**

- [ ] La tarjeta "Datos fiscales" muestra los valores con la descripción del catálogo (ej. "02 — Sueldos").
- [ ] Muestra el nombre fiscal en mayúsculas, la `ClaveEntFed` de la sucursal y la lista de problemas de `getStampingIssues`.
- [ ] El empleado con el RFC mal capturado muestra "RFC con formato inválido" en la tarjeta y "Faltan N datos fiscales" en el header.
- [ ] Si la sucursal del empleado no tiene `id_state`, la tarjeta muestra "La sucursal no tiene estado" y cuenta como dato faltante.
- [ ] Un empleado fiscal con todo completo muestra el badge "Datos fiscales completos" y la tarjeta sin lista de faltantes.
- [ ] Un empleado no fiscal no muestra el badge.
- [ ] `EmployeeGeneralInfo.tsx` y `EmployeeHeader.tsx` no tienen `"use client"`.

**General**

- [ ] `npx tsc --noEmit` no reporta errores.
- [ ] `docs/rh-empleados.md` tiene la sección "Datos fiscales (spec 71)".

## Decisiones

- **Sí: obligatorios solo para empleados fiscales (`salario_diario_fiscal > 0`).** Es el mismo criterio con el que la spec 53 decide quién entra a la nómina fiscal, así que solo se le exige a quien se le va a timbrar.
- **No: obligatorios siempre.** Bloquearía el alta de personal que solo está en la nómina operativa.
- **No: todo opcional y validar hasta el timbrado.** El error aparecería semanas después, en la pantalla de nómina, en vez de en el momento de capturar.
- **Sí: el formato se valida aunque el empleado no sea fiscal.** Un RFC mal escrito sigue siendo un dato malo, y así un empleado puede pasar a fiscal sin que haya que limpiarlo.
- **Sí: nombre fiscal derivado de `nombre + apellidos` en mayúsculas.**
- **No: un campo `nombre_fiscal` aparte.** Serían dos versiones del nombre que se desincronizan. Si el PAC rechaza el nombre, se corrige el nombre del empleado. La normalización de acentos se decide en la spec de timbrado.
- **Sí: `c_TipoContrato`, `c_TipoRegimen` y `c_TipoJornada` como constantes TS.** Son pequeños y casi no cambian, y en la BD los respalda un `CHECK ... IN (...)`.
- **Sí: `c_Banco` como tabla `RH.cat_bancos` con FK.** Tiene unas 90 entradas y el SAT lo actualiza. Va en `RH` porque la FK sale de `RH.empleados`.
- **No: deducir el banco de los primeros 3 dígitos de la CLABE.** El SAT prohíbe mandar `Banco` cuando la cuenta es CLABE, así que no hace falta.
- **Sí: `ClaveEntFed` derivada de la sucursal.** `dbo.Cat_states.state_key` ya trae la clave `c_Estado` (verificado contra la BD el 2026-10-12).
- **No: capturar la entidad federativa por empleado.** Duplicaría un dato que ya depende de dónde trabaja.
- **No: `RiesgoPuesto` en el empleado.** Se define por registro patronal y va en la spec de datos del patrón.
- **Sí: `CHECK` de formato `WITH NOCHECK`.** Hoy hay un RFC y una CURP mal capturados. Se corrigen al editar al empleado, no con una limpieza manual previa.
- **Sí: los `CHECK` se crean después de la validación `zod` (paso 4).** Si existieran antes, editar a esos dos empleados daría un error SQL genérico en lugar de un mensaje claro.
- **No: las reglas de "obligatorio si es fiscal" en la BD.** Dependen de varios campos y cambiarían con cada ajuste de la spec de timbrado. La BD solo asegura formato y coherencia.
- **Sí: un `UPDATE` único con `02/01/01/No` para los empleados existentes.** Son los valores reales del caso típico, así que solo quedan por capturar a mano RFC, CURP, CP y NSS.
- **Sí: reglas en un helper puro (`payrollStampingReadiness.ts`).** Lo usan el schema `zod`, los asteriscos del modal y el indicador del expediente, y la futura spec de timbrado lo reutilizará como verificación previa. Así la regla vive en un solo lugar.
- **Sí: reemplazar `validateRequiredFields` por `zod`.** `CLAUDE.md` pide `zod` en toda entrada que cruza una frontera de confianza, y la validación nueva ya no cabe en `if`s sueltos.
- **No: columna o filtro de completitud en el listado.** El listado no se ha tocado desde la spec 38. Con el badge del expediente basta para 5 empleados.
- **Sí: `sindicalizado` nulo se envía como "No".** El SAT lo trata como opcional, y forzarlo no aporta nada.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El SAT agrega o retira bancos en `c_Banco`. | Es una tabla con `status`: se da de alta o se desactiva con un `INSERT`/`UPDATE`, sin desplegar código. |
| El SAT cambia `c_TipoContrato`, `c_TipoRegimen` o `c_TipoJornada`. | Se cambian las constantes de `satCatalogs.ts` y el `CHECK ... IN` correspondiente. Ambos están documentados juntos en `queries.txt`. |
| Las regex de TS y los `LIKE` de los `CHECK` dejan de coincidir (ej. una CURP con `X` aceptada en un lado y no en el otro). | Ambas se escriben en la misma spec, con la misma lista de casos. Si difieren, manda la BD: rechaza el guardado y el usuario ve el error. |
| La collation de la BD distingue mayúsculas o no maneja `Ñ` en `LIKE '[A-ZÑ&]'`. | En el paso 4, probar en SQL un RFC con `Ñ` y uno en minúsculas antes de dar el paso por terminado. `zod` ya guarda en mayúsculas. |
| Al editar a un empleado fiscal con datos incompletos, el modal lo bloquea y RH puede no tener a la mano CURP, NSS o CP. | El mensaje nombra el campo que falta, y el expediente muestra con anticipación la lista completa. La alternativa sería no poder timbrar después. |
| El nombre derivado no coincide con la constancia de situación fiscal (acentos, nombres compuestos). | Fuera de esta spec. El PAC lo rechaza al timbrar y se corrige en el nombre del empleado. La spec de timbrado decide la normalización. |
| Una sucursal sin `id_state` deja a todos sus empleados fiscales como incompletos. | El problema aparece como "La sucursal no tiene estado" y se corrige una vez en la sucursal. |

## Lo que **no** incluye esta spec

- Timbrado del CFDI de nómina, recibos y dispersión.
- Datos del patrón: registro patronal, `RiesgoPuesto`, RFC emisor y organización de Facturapi.
- SDI y SBC (spec del IMSS).
- Campo `nombre_fiscal` y normalización de acentos.
- Validación de RFC, nombre y CP contra el SAT.
- Columna o filtro de completitud en el listado de empleados.
- Domicilio estructurado y nodo `SubContratacion`.

Si alguno de estos llega, va en su propia spec.
