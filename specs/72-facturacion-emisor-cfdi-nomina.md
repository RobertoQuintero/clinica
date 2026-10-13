# 72 — Facturación: organización emisora del CFDI de nómina

## Header

- **Estado:** Implementado
- **Depende de:**
  - [28 — Facturación: cimientos](28-facturacion-cimientos.md): `BILLING.organizations`, `BILLING.audit_log`, `organizationsRepository.ts` y la pestaña General.
  - [33 — Refrescar el RFC local tras subir/eliminar el CSD](33-facturacion-refrescar-tax-id-csd.md): el RFC de cada organización sale de su CSD. Con él se decide si el emisor es persona física.
  - [71 — Empleados: datos fiscales para el CFDI de nómina](71-empleado-datos-fiscales-cfdi-nomina.md): dejó pendientes el registro patronal, el `RiesgoPuesto` y la organización emisora. Además, `CURP_PATTERN` (`payrollStampingReadiness.ts`) y `satCatalogs.ts` se reutilizan.
- **Modifica base de datos:** Sí.
  - `BILLING.organizations` gana tres columnas de datos del emisor de nómina y una columna `is_payroll_issuer`.
  - Índice único filtrado: como máximo una organización activa para nómina por `id_empresa`.
- **Fecha:** 2026-10-12
- **Objetivo:** Capturar en la pestaña General de cada organización de Facturación los datos de emisor que exige el complemento de Nómina 1.2 (registro patronal, clase de riesgo y CURP si el emisor es persona física), y marcar cuál es la única organización que timbra la nómina.
- **Reglas de origen:** Anexo 20 del CFDI 4.0, complemento de Nómina 1.2 rev. E y su guía de llenado (nodo `Nomina12:Emisor`, atributo `Receptor/@RiesgoPuesto`, catálogo `c_RiesgoPuesto`).

## Alcance

**Incluye:**

- **Base de datos.** El DDL se documenta en `queries.txt`, después del bloque de la spec 34 de `BILLING.organizations`.
  - `BILLING.organizations` gana estas columnas:
    - `registro_patronal`, `NULL`;
    - `riesgo_puesto`, `NULL`;
    - `curp_emisor`, `NULL`;
    - `is_payroll_issuer`, `NOT NULL DEFAULT 0`.
  - `CHECK` de formato sobre los tres datos del emisor.
  - Índice único filtrado `UX_organizations_payroll_issuer` sobre `id_empresa` `WHERE is_payroll_issuer = 1`.
- **Catálogo `c_RiesgoPuesto`** (claves 1–5; la 99 "No aplica" se excluye, ver Decisiones) como constante en `lib/payroll/satCatalogs.ts`, junto a los catálogos de la spec 71.
- **Reglas puras** en `lib/billing/payrollIssuer.ts`. Las usan el schema del servidor, el formulario y el indicador de la sección:
  - Formatos:
    - registro patronal: 11 caracteres alfanuméricos en mayúsculas;
    - `riesgo_puesto` dentro del catálogo;
    - CURP con `CURP_PATTERN` de la spec 71.
  - Lo que se necesita para activar la organización:
    - siempre registro patronal y `riesgo_puesto`;
    - la CURP solo si el RFC de la organización es de persona física (13 caracteres).
  - Avisos que no bloquean: la organización no tiene CSD o no está en modo Live.
- **Validación con `zod`** en `lib/billing/schemas.ts` (`PayrollIssuerSchema`).
  - Normaliza antes de validar: registro patronal y CURP en mayúsculas y sin espacios.
  - Los formatos se validan siempre que el campo traiga valor.
  - Si la organización está activa para nómina, no se puede vaciar un dato obligatorio.
- **Acciones en `app/dashboard/facturacion/actions.ts`:**
  - `updatePayrollIssuerData(orgId, input)`: guarda los tres datos del emisor.
  - `setPayrollIssuer(orgId, active)`:
    - Al activar, valida que los datos estén completos. En la misma transacción desactiva la organización que estuviera activa en la empresa.
    - Al desactivar, la empresa queda sin emisor de nómina.
  - Ambas registran su acción en `BILLING.audit_log`.
  - `getOrganizationDetail` devuelve también los cuatro campos nuevos.
  - `deleteOrganization` rechaza eliminar la organización activa para nómina con el mensaje "Es la organización que timbra nómina; desactívala primero".
- **`organizationsRepository.ts`:**
  - lectura de las columnas nuevas;
  - `updatePayrollIssuerData`;
  - `setPayrollIssuer`, transaccional;
  - `BillingAuditAction` gana `org.update_payroll_issuer` y `org.set_payroll_issuer`.
- **UI, pestaña General:** sección nueva `OrganizationPayrollIssuerSection.tsx`, entre `OrganizationLegalSection` y `OrganizationCertificateSection`.
  - Campos: registro patronal, clase de riesgo (select del catálogo) y CURP. La CURP solo se muestra obligatoria si el emisor es persona física.
  - Interruptor "Usar esta organización para timbrar nómina":
    - deshabilitado mientras falten datos, con la lista de lo que falta;
    - al activarlo avisa qué organización se desactiva.
  - Avisos no bloqueantes de "Sin CSD" y "En modo Test".
- **Listado de organizaciones:** badge "Timbra nómina" en `OrganizationsTable.tsx` para la organización activa.
- **Documentación:** sección "Emisor de nómina (spec 72)" en `docs/facturacion.md`, y la tabla del catálogo de `audit_log` actualizada.

**No incluye (para otras specs):**

- **El timbrado del CFDI de nómina:** armado del payload de Facturapi, envío, cancelación, recibos y dispersión.
- **Mostrar el emisor activo en el módulo de nómina**, o el aviso "No hay organización activa", en periodos o procesar. Llega con la spec de timbrado.
- **Varios registros patronales por organización** o un registro por sucursal.
- **`RfcPatronOrigen`** (subcontratación) y **`EntidadSNCF`** (entes de gobierno).
- **Prima de riesgo de trabajo en porcentaje** y cuotas patronales del IMSS. Van en la spec del IMSS.
- **Validar el registro patronal contra el IMSS** o la CURP contra RENAPO.
- **Mandar estos datos a Facturapi como parte de la organización.** Se guardan solo en local y viajan en cada recibo de nómina.
- **Exigir CSD o modo Live para activar.** Solo se avisa.

## Modelo de datos

**Cambios en BD.** El DDL va en `queries.txt`, después del bloque de la spec 34 de `BILLING.organizations`. Se ejecuta a mano contra la BD.

```sql
-- Spec 72: datos del emisor para el complemento de Nómina 1.2.
ALTER TABLE [CentroPodologico].[BILLING].[organizations] ADD
    [registro_patronal] [varchar](11) NULL,   -- Nomina12:Emisor/@RegistroPatronal
    [riesgo_puesto]     [varchar](2)  NULL,   -- c_RiesgoPuesto, va en Receptor/@RiesgoPuesto
    [curp_emisor]       [varchar](18) NULL,   -- Nomina12:Emisor/@Curp, solo persona física
    [is_payroll_issuer] [bit]         NOT NULL
        CONSTRAINT [DF_organizations_is_payroll_issuer] DEFAULT (0);
GO

ALTER TABLE [CentroPodologico].[BILLING].[organizations] ADD
    CONSTRAINT [CK_organizations_registro_patronal] CHECK ([registro_patronal] IS NULL
        OR (LEN([registro_patronal]) = 11 AND [registro_patronal] NOT LIKE '%[^A-Z0-9]%')),
    CONSTRAINT [CK_organizations_riesgo_puesto] CHECK ([riesgo_puesto] IS NULL
        OR [riesgo_puesto] IN ('1','2','3','4','5')),
    CONSTRAINT [CK_organizations_curp_emisor] CHECK ([curp_emisor] IS NULL OR [curp_emisor] LIKE
        '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][0-9][0-9][HMX][A-Z][A-Z][A-Z][A-Z][A-Z][A-Z0-9][0-9]'),
    CONSTRAINT [CK_organizations_payroll_issuer_completo] CHECK ([is_payroll_issuer] = 0
        OR ([registro_patronal] IS NOT NULL AND [riesgo_puesto] IS NOT NULL));
GO

-- Como máximo una organización emisora de nómina por empresa.
CREATE UNIQUE INDEX [UX_organizations_payroll_issuer]
    ON [CentroPodologico].[BILLING].[organizations] ([id_empresa])
    WHERE [is_payroll_issuer] = 1;
GO
```

- Los `CHECK` se crean sin `WITH NOCHECK`: las columnas son nuevas y todas las filas quedan en `NULL`/`0`.
- **La BD no exige la CURP del emisor cuando es persona física.** El RFC lo trae Facturapi en vivo, y la copia local `tax_id` puede estar desincronizada. Esa regla vive en `zod` y en `payrollIssuer.ts`.
- `CK_organizations_payroll_issuer_completo` es la red de seguridad: ni un `UPDATE` directo puede activar una organización sin registro patronal ni clase de riesgo.

**`interfaces/organization.ts`**

```ts
// IOrganizationRecord gana:
registro_patronal: string | null;
riesgo_puesto:     string | null;   // clave c_RiesgoPuesto
curp_emisor:       string | null;
is_payroll_issuer: boolean;

/** Datos del emisor de nómina capturados en la sección (spec 72). */
export type PayrollIssuerInput = Pick<
  IOrganizationRecord,
  "registro_patronal" | "riesgo_puesto" | "curp_emisor"
>;
```

`IOrganizationDetail` (`app/dashboard/facturacion/actions.ts`) gana:

```ts
payrollIssuer: PayrollIssuerInput & { isActive: boolean };
/** `name` local de la organización activa para nómina si es otra; null si no hay o es esta. */
currentPayrollIssuerName: string | null;
```

**`lib/payroll/satCatalogs.ts`** (se agrega)

```ts
export const SAT_JOB_RISK_CLASSES: ReadonlyArray<{ key: string; label: string }>;
// c_RiesgoPuesto: "1" Clase I … "5" Clase V
```

**`lib/billing/payrollIssuer.ts`** (puro, se puede importar en cliente y en servidor)

```ts
export const EMPLOYER_REGISTRATION_PATTERN: RegExp;   // /^[A-Z0-9]{11}$/
// CURP_PATTERN se importa de lib/payroll/payrollStampingReadiness.ts (spec 71).

export type PayrollIssuerField = "registro_patronal" | "riesgo_puesto" | "curp_emisor";

export interface PayrollIssuerIssue {
  field:  PayrollIssuerField;
  reason: "missing" | "invalid";
  label:  string;   // ej. "Falta el registro patronal"
}

export type PayrollIssuerWarning = "no_certificate" | "test_mode";

export function isIndividualTaxId(taxId: string | null): boolean;   // RFC de 13 caracteres
export function getRequiredPayrollIssuerFields(taxId: string | null): PayrollIssuerField[];
export function getPayrollIssuerIssues(
  input: PayrollIssuerInput,
  taxId: string | null,
): PayrollIssuerIssue[];   // [] = se puede activar
export function getPayrollIssuerWarnings(
  hasCertificate: boolean,
  isLive: boolean,
): PayrollIssuerWarning[];
```

**`lib/billing/schemas.ts`** (se agrega)

```ts
// Normaliza (mayúsculas y sin espacios; "" → null) y valida formatos.
// La obligatoriedad depende de is_payroll_issuer y del RFC, así que la action
// la aplica con getPayrollIssuerIssues después del parse.
export const PayrollIssuerSchema: z.ZodType<PayrollIssuerInput>;
```

**`lib/billing/organizationsRepository.ts`** (se agrega)

```ts
export async function updatePayrollIssuerData(
  uid: string, idEmpresa: number, input: PayrollIssuerInput,
): Promise<void>;

/** Activa (desactivando la anterior en la misma transacción) o desactiva.
 *  Devuelve el uid de la organización que se desactivó en automático, o null. */
export async function setPayrollIssuer(
  uid: string, idEmpresa: number, active: boolean,
): Promise<{ deactivatedUid: string | null }>;

export async function getPayrollIssuerUid(idEmpresa: number): Promise<string | null>;

// BillingAuditAction gana: "org.update_payroll_issuer" | "org.set_payroll_issuer"
```

- `getPayrollIssuerUid` lo usa el listado (`facturacion/page.tsx`) para el badge. `listOrganizations` sigue devolviendo lo que trae Facturapi, sin cambios.
- `RiesgoPuesto` se guarda en la organización, pero en el XML va en `Nomina12:Receptor`. La spec de timbrado lo copia a cada recibo.
- El `detail` de `org.set_payroll_issuer` guarda `{ active, deactivated_uid }`.

## Plan de implementación

Cada paso compila (`npx tsc --noEmit`) y deja la app funcionando.

1. **BD.**
   - Ejecutar contra la BD el `ALTER TABLE ... ADD` de las 4 columnas, los 4 `CHECK` y el índice `UX_organizations_payroll_issuer`.
   - Documentarlo en `queries.txt`.
   - El código actual no toca las columnas nuevas, así que nada se rompe.
   - Prueba manual:
     - `SELECT` de `BILLING.organizations` muestra todas las filas con `is_payroll_issuer = 0`;
     - un `UPDATE ... SET is_payroll_issuer = 1` directo es rechazado por `CK_organizations_payroll_issuer_completo`.
2. **Catálogo y reglas puras.**
   - Agregar `SAT_JOB_RISK_CLASSES` a `lib/payroll/satCatalogs.ts`.
   - Crear `lib/billing/payrollIssuer.ts` como se describe en el Modelo de datos.
   - Agregar `PayrollIssuerSchema` a `lib/billing/schemas.ts`.
   - Todavía nadie los consume.
3. **Repositorio e interfaces.**
   - `interfaces/organization.ts`: los campos nuevos y `PayrollIssuerInput`.
   - `organizationsRepository.ts`:
     - lectura de las columnas nuevas en `normalizeOrganizationRow`;
     - `updatePayrollIssuerData`, `setPayrollIssuer` (transaccional) y `getPayrollIssuerUid`;
     - las dos acciones nuevas en `BillingAuditAction`.
   - Prueba manual: ninguna pantalla cambia y el detalle de una organización sigue cargando.
4. **Acciones.** En `app/dashboard/facturacion/actions.ts`:
   - `getOrganizationDetail` devuelve `payrollIssuer`.
   - `updatePayrollIssuerData(orgId, input)`:
     - `requireBillingAccess`, `assertOwnedOrganization` y parse con `PayrollIssuerSchema`;
     - si la organización está activa, `getPayrollIssuerIssues` con el `legal.tax_id` de Facturapi;
     - guardado y `audit_log`.
   - `setPayrollIssuer(orgId, active)`:
     - al activar, `getPayrollIssuerIssues` debe dar `[]`;
     - repositorio transaccional;
     - `audit_log` con `deactivated_uid`.
   - `deleteOrganization` rechaza la organización activa para nómina antes de llamar a Facturapi.
   - Ambas acciones hacen `revalidatePath` del detalle y del listado.
   - Prueba manual: llamar `setPayrollIssuer` sobre una organización sin datos devuelve `{ ok: false }` con la lista de faltantes.
5. **Sección "Emisor de nómina" en la pestaña General.**
   - Aplicar el skill `frontend-design`.
   - Crear `[id]/general/componentes/OrganizationPayrollIssuerSection.tsx` con:
     - los tres campos; el asterisco de la CURP sale de `getRequiredPayrollIssuerFields`;
     - el botón de guardar;
     - el interruptor, deshabilitado mientras `getPayrollIssuerIssues` no esté vacío, con la lista de faltantes;
     - los avisos de `getPayrollIssuerWarnings`.
   - Montarla en `general/page.tsx` entre `OrganizationLegalSection` y `OrganizationCertificateSection`. Las páginas siguen siendo Server Components; solo la sección es `"use client"`.
   - Prueba manual: capturar los datos, guardar y activar. La sección muestra "Activa para nómina".
6. **Activación con otra ya activa y bloqueo al eliminar.**
   - Al activar con otra organización ya activa, la sección muestra antes una confirmación que nombra la organización que se va a desactivar.
     - Para eso, `getOrganizationDetail` también devuelve `currentPayrollIssuerName`: el `name` local de la organización activa, si es otra.
   - `DeleteOrganizationSection.tsx` muestra el mensaje de error que devuelve la acción. No requiere cambio si ya muestra `result.message`.
   - Prueba manual: con la organización A activa, activar B deja a A desactivada. Intentar eliminar B muestra "Es la organización que timbra nómina; desactívala primero".
7. **Badge en el listado.**
   - `facturacion/page.tsx` obtiene `getPayrollIssuerUid` y lo pasa a `OrganizationsTable.tsx`.
   - `OrganizationRow.tsx` muestra el badge "Timbra nómina" en la fila correspondiente.
   - Prueba manual: el badge aparece solo en la organización activa y se mueve al activar otra.
8. **Documentación.**
   - En `docs/facturacion.md`, sección "Emisor de nómina (spec 72)":
     - columnas;
     - índice filtrado y `CHECK`;
     - de dónde sale el RFC para decidir persona física;
     - qué copia la spec de timbrado a cada recibo.
   - Agregar `org.update_payroll_issuer` y `org.set_payroll_issuer` a la tabla del catálogo de `audit_log`.

## Criterios de aceptación

**Base de datos**

- [ ] `BILLING.organizations` tiene `registro_patronal`, `riesgo_puesto`, `curp_emisor` e `is_payroll_issuer` (`NOT NULL DEFAULT 0`), y su DDL está en `queries.txt`.
- [ ] Existen `CK_organizations_registro_patronal`, `CK_organizations_riesgo_puesto`, `CK_organizations_curp_emisor`, `CK_organizations_payroll_issuer_completo` y el índice `UX_organizations_payroll_issuer`, documentados en `queries.txt`.
- [ ] Un `UPDATE` directo con `registro_patronal = 'ABC'` es rechazado por `CK_organizations_registro_patronal`.
- [ ] Un `UPDATE` directo con `riesgo_puesto = '99'` es rechazado por `CK_organizations_riesgo_puesto`.
- [ ] Un `UPDATE` directo que pone `is_payroll_issuer = 1` en una fila sin registro patronal es rechazado por `CK_organizations_payroll_issuer_completo`.
- [ ] Un `UPDATE` directo que deja dos filas de la misma `id_empresa` con `is_payroll_issuer = 1` es rechazado por `UX_organizations_payroll_issuer`.

**Validación y acciones**

- [ ] `updatePayrollIssuerData` con un registro patronal de 10 caracteres o con una CURP inválida devuelve `{ ok: false }` con un mensaje que nombra el campo, y no escribe en la BD.
- [ ] Un registro patronal o una CURP capturados en minúsculas o con espacios se guardan en mayúsculas y sin espacios.
- [ ] En una organización no activa, guardar con los tres campos vacíos se acepta.
- [ ] En la organización activa, vaciar el registro patronal o la clase de riesgo devuelve `{ ok: false }` y no escribe.
- [ ] `setPayrollIssuer(orgId, true)` sin registro patronal o sin clase de riesgo devuelve `{ ok: false }` con la lista de faltantes.
- [ ] Con un RFC de 13 caracteres en Facturapi, activar sin CURP del emisor devuelve `{ ok: false }`. Con un RFC de 12 caracteres se activa sin CURP.
- [ ] Activar la organización B con la A activa deja a B con `is_payroll_issuer = 1` y a A con `0`, en una sola transacción.
- [ ] `setPayrollIssuer(orgId, false)` deja a la empresa sin ninguna organización activa para nómina.
- [ ] Una organización sin CSD o en modo Test se puede activar si sus datos están completos.
- [ ] `deleteOrganization` sobre la organización activa devuelve "Es la organización que timbra nómina; desactívala primero" y no llama a Facturapi.
- [ ] Cada guardado deja un registro `org.update_payroll_issuer` en `BILLING.audit_log`.
- [ ] Cada activación o desactivación deja un registro `org.set_payroll_issuer`, con `detail` que incluye `active` y `deactivated_uid`.
- [ ] Una organización de otra `id_empresa` no se puede leer ni modificar con estas acciones (`assertOwnedOrganization`).

**Pestaña General**

- [ ] La sección "Emisor de nómina" aparece entre los datos legales y el certificado.
- [ ] La sección tiene los campos registro patronal, clase de riesgo (select con Clase I a Clase V) y CURP.
- [ ] La CURP muestra asterisco solo si el RFC de la organización tiene 13 caracteres.
- [ ] El interruptor "Usar esta organización para timbrar nómina" está deshabilitado y lista lo que falta mientras haya faltantes.
- [ ] Con otra organización activa, activar pide confirmación y nombra la organización que se va a desactivar.
- [ ] Una organización sin CSD muestra el aviso "Sin CSD", y una en modo Test muestra "En modo Test". Ninguno de los dos deshabilita el interruptor.
- [ ] `general/page.tsx` no tiene `"use client"`.

**Listado**

- [ ] El badge "Timbra nómina" aparece solo en la fila de la organización activa.
- [ ] Al activar otra organización, el badge pasa a esa fila tras la revalidación.

**General**

- [ ] `npx tsc --noEmit` no reporta errores.
- [ ] `docs/facturacion.md` tiene la sección "Emisor de nómina (spec 72)", y su tabla de `audit_log` incluye las dos acciones nuevas.

## Decisiones

- **Sí: los datos del emisor de nómina viven en `BILLING.organizations`.** El emisor del CFDI es la organización de Facturapi, así que su registro patronal y su clase de riesgo son atributos de ella.
- **No: guardarlos en el módulo de nómina.** Habría que mantener a mano la relación entre la configuración de nómina y la organización, y dos lugares podrían contradecirse.
- **Sí: una sección propia en la pestaña General (`OrganizationPayrollIssuerSection.tsx`).** Estos datos son solo locales.
- **No: meterlos en `OrganizationLegalSection.tsx`.** Ese formulario sincroniza con Facturapi (`updateLegal`), y mezclar campos que van y que no van confunde.
- **No: mandarlos a Facturapi como datos de la organización.** Facturapi no los guarda ahí: viajan en el complemento de cada recibo.
- **Sí: un registro patronal por organización.** Es el caso actual de la clínica.
- **No: varios registros o uno por sucursal.** Si algún día hace falta, llega en su propia spec con una tabla hija.
- **Sí: clase de riesgo 1–5, sin 99.** En esta spec el registro patronal siempre es obligatorio, y con registro patronal el SAT exige una clase real.
- **Sí: `RiesgoPuesto` en la organización, no en el empleado.** Se define por registro patronal (decisión heredada de la spec 71). La spec de timbrado lo copia a `Nomina12:Receptor` de cada recibo.
- **Sí: CURP del emisor obligatoria solo con RFC de persona física (13 caracteres).** Así lo exige el complemento. Para persona moral el SAT no la admite.
- **Sí: el RFC para decidir persona física sale de Facturapi en vivo (`organization.legal.tax_id`).** La copia local `tax_id` puede estar desincronizada en organizaciones anteriores a la spec 33, y Facturapi es el sistema de registro del RFC (se infiere del CSD).
- **No: exigir la CURP con un `CHECK` en BD.** Dependería de la copia local del RFC. La BD solo valida formato.
- **Sí: registro patronal exacto de 11 caracteres alfanuméricos.** Es el formato que emite el IMSS, y atrapa errores de captura que la regla laxa del SAT (1–20 caracteres) dejaría pasar.
- **Sí: `is_payroll_issuer` con índice único filtrado por `id_empresa`.** La BD garantiza que nunca haya dos emisores activos, aunque dos usuarios activen al mismo tiempo.
- **No: una tabla de configuración aparte con el `uid` del emisor.** Sería otra tabla para un solo dato por empresa, y el índice filtrado da la misma garantía.
- **Sí: al activar una organización, la anterior se desactiva sola en la misma transacción.** Se pide confirmación que la nombra.
- **No: rechazar la activación hasta desactivar a mano la anterior.** Es un paso extra sin beneficio.
- **Sí: se puede dejar la empresa sin emisor de nómina.** Sirve para transiciones, como un cambio de razón social.
- **Sí: bloquear la eliminación de la organización activa.** Así la nómina no queda sin emisor por accidente.
- **Sí: datos completos para activar. Sin CSD o en modo Test solo hay aviso.** Se puede preparar y probar la configuración antes de tener el CSD o pasar a Live. La spec de timbrado exigirá lo que corresponda al momento de timbrar.
- **Sí: `CK_organizations_payroll_issuer_completo` como red de seguridad.** Ni un `UPDATE` manual puede activar una organización sin registro patronal ni clase.
- **Sí: formatos validados aunque la organización no esté activa.** Un dato mal escrito sigue siendo malo, el mismo criterio de la spec 71.
- **Sí: reutilizar `CURP_PATTERN` de `payrollStampingReadiness.ts` y agregar `c_RiesgoPuesto` a `satCatalogs.ts`.** Así hay una sola definición de CURP válida y un solo archivo de catálogos de nómina.
- **Sí: reglas en un helper puro (`lib/billing/payrollIssuer.ts`).** Lo usan el schema, el formulario y la futura spec de timbrado como verificación previa.
- **Sí: dos acciones nuevas en `audit_log`.** `org.update_payroll_issuer` y `org.set_payroll_issuer`, con `deactivated_uid` para reconstruir quién emitía en cada momento.
- **Sí: badge "Timbra nómina" en el listado.** Con varias organizaciones evita tener que entrar a cada una para saber cuál emite.
- **No: mostrar el emisor activo en el módulo de nómina.** Llega con la spec de timbrado, que es donde se consume.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Se cambia el CSD de la organización activa por uno de otro RFC (por ejemplo, de persona moral a física) y la CURP que antes no hacía falta ahora falta. | La sección recalcula los faltantes con el RFC en vivo y los muestra. La spec de timbrado vuelve a correr `getPayrollIssuerIssues` antes de timbrar. |
| Facturapi no responde al guardar o activar, y no se puede leer el RFC. | La acción devuelve `{ ok: false }` con el mensaje de `toUserMessage` y no escribe. Es el mismo comportamiento que el resto de la pestaña General. |
| Se elimina la organización activa directamente en Facturapi, fuera de la app. | Queda la fila local con `is_payroll_issuer = 1` apuntando a un `uid` inexistente. La spec de timbrado falla con un error claro y se desactiva desde la BD. Es un caso fuera del flujo normal. |
| El IMSS emite un registro patronal con un formato distinto a 11 caracteres. | Se cambian `EMPLOYER_REGISTRATION_PATTERN` y `CK_organizations_registro_patronal`, documentados juntos en `queries.txt`. |
| Cambiar de emisor a mitad de un periodo de nómina deja recibos del mismo periodo con emisores distintos. | Fuera de esta spec. La confirmación al activar nombra la organización que se desactiva. La spec de timbrado decide si bloquea el cambio con recibos timbrados en un periodo abierto. |
| Las regex de TS y los `LIKE` de los `CHECK` dejan de coincidir. | Se escriben en la misma spec y la CURP reutiliza el patrón de la spec 71. Si difieren, manda la BD: rechaza el guardado y el usuario ve el error. |

## Lo que **no** incluye esta spec

- Timbrado del CFDI de nómina, recibos y dispersión.
- Indicador del emisor activo en el módulo de nómina.
- Varios registros patronales por organización o por sucursal.
- `RfcPatronOrigen` y `EntidadSNCF`.
- Prima de riesgo en porcentaje y cuotas del IMSS.
- Validación del registro patronal contra el IMSS o de la CURP contra RENAPO.
- Exigir CSD o modo Live para activar la organización emisora.

Si alguno de estos llega, va en su propia spec.
