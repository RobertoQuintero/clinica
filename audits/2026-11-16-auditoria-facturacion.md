# Auditoría de seguridad y riesgos — módulo de Facturación

- **Fecha:** 2026-11-16
- **Commit revisado:** `da5528d` (master)
- **Alcance:** `app/dashboard/facturacion/**`, `lib/billing/**`, `app/api/facturacion/**`, `lib/auth/session.ts`, y las piezas compartidas de las que depende (`proxy.ts`, `app/actions/auth.ts`, `next.config.ts`, SDK `facturapi` 4.20.0, y las acciones de pagos de consultas y tratamientos que alimentan "Por facturar").
- **Método:** revisión estática del código. No se ejecutó ningún ataque ni prueba contra la aplicación, la base o Facturapi; cada hallazgo indica el archivo y la línea que lo sustenta.
- **Relación con la auditoría de nómina** (`audits/2026-11-16-auditoria-nomina.md`): los hallazgos compartidos se referencian por su ID de allá (p. ej. "Nómina A2") en vez de repetirse.

## Resumen

| Severidad | Cantidad | IDs |
|---|---|---|
| Alta | 7 | A1, A2, A3, A4, A5, B1, C1 |
| Media | 8 | A6, A7, A8, B2, B3, B4, D1, E1 |
| Baja | 7 | A9, B5, C2, D2, D3, E2, F1 |

Los hallazgos están agrupados por tópico (A–F) para atenderlos en bloque; dentro de cada grupo van ordenados por severidad. Cada uno tiene un ID estable para referenciarlo en specs o commits.

**Orden sugerido de atención**

1. **C1** — validar el formato de los IDs de Facturapi. Es un cambio pequeño en `lib/billing/schemas.ts` y cierra el único camino encontrado para tocar la organización de otra empresa.
2. **A1 + A2** — un solo spec de "timbrado y cancelación seguros" (idempotencia + estado de cancelación).
3. **A3 + A4** — reglas de "Por facturar": no estampar cobros reales en Test y fijar el importe con IVA incluido.
4. **A5** — proteger los pagos ya facturados (toca `pacientes/` y `tratamientos/`, fuera del módulo).
5. **B1** — sesión; se resuelve junto con Nómina A2.
6. **A6–A8, B2–B4, D1, E1** — endurecimiento.
7. **Bajas** — deuda y decisiones documentadas.

---

## Grupo A — Timbrado y cancelación de CFDI de ingreso

### A1 · ALTA · Cancelar devuelve el cobro a "pendiente" aunque el CFDI siga vigente

- **Dónde:** `app/dashboard/facturacion/[id]/invoices/actions.ts:165-185`.
- **Qué pasa:** después de `client.invoices.cancel(...)` se llama siempre a `clearInvoiceStamp`, sin leer `invoice.status` ni `invoice.cancellation_status`. Una cancelación que requiere aceptación del receptor queda en `cancellation_status = "pending"` (el SDK lo expone: `node_modules/facturapi/dist/types/invoice.d.ts:40`) y el CFDI sigue vigente hasta que el receptor acepte o venza el plazo; también puede terminar en `rejected`.
- **Impacto:** el cobro reaparece en "Por facturar" y se puede timbrar otra vez: dos CFDI de ingreso vigentes por el mismo cobro. La bitácora registra `invoice.cancel` aunque la factura no esté cancelada.
- **Corrección:** limpiar el estampado solo cuando `invoice.status === "canceled"`. Si queda `pending`/`verifying`, dejar el cobro marcado y resolverlo con una acción "Consultar estado" (el mismo patrón `'X'` que ya usa nómina).

### A2 · ALTA · El timbrado no es idempotente: doble clic, dos usuarios o un fallo posterior duplican el CFDI

- **Dónde:** `[id]/pending/actions.ts:153-186`, `[id]/invoices/actions.ts:126-139`.
- **Qué pasa:**
  - `resolveBillableOperation` lee sin bloqueo y `markOperationInvoiced` corre después de `invoices.create`. Dos peticiones simultáneas sobre el mismo cobro pasan ambas la validación y timbran las dos; la segunda sobrescribe `uuid_cfdi`.
  - Si Facturapi timbra y luego falla la transacción local (o se pierde la respuesta), el cobro queda como "falso pendiente" (riesgo aceptado en el comentario de la línea 171-174) y el siguiente clic lo timbra de nuevo.
  - En la factura manual, `writeAuditEntry` va fuera de transacción después de timbrar: si ese `INSERT` falla, la acción devuelve error con la factura ya emitida y el usuario reintenta.
  - Ninguno de los dos payloads lleva `idempotency_key` ni `external_id`, que el SDK instalado admite (`invoice.d.ts:41-42`).
- **Impacto:** CFDI de ingreso duplicados en Live, con solo uno ligado al cobro.
- **Corrección:** en "Por facturar", reservar el cobro antes de llamar a Facturapi (marcar las filas con un estado "en proceso" dentro de una transacción con `UPDLOCK`, o una tabla `BILLING.invoice_attempts` con índice único por `source` + `source_id`) y mandar `idempotency_key` derivado de esa reserva. En la factura manual, generar la llave en el cliente al abrir el modal. Mismo enfoque que Nómina B1.

### A3 · ALTA · En modo Test, "Por facturar" marca cobros reales como facturados

- **Dónde:** `[id]/pending/actions.ts:158-186`; `[id]/pending/componentes/BillableInvoiceModal.tsx:109-113` (solo pide confirmación en Live).
- **Qué pasa:** con la organización en Test, el CFDI se emite con la llave de prueba (sin validez fiscal) pero `markOperationInvoiced` escribe `facturado = 1` y `uuid_cfdi` sobre las filas reales de `dbo.pagos` / `dbo.Tratamiento_onicomicosis_pagos`. No hay columna que distinga un estampado Test de uno Live.
- **Impacto:** cobros reales desaparecen de "Por facturar" sin tener CFDI válido; la consulta queda con `costo_total` congelado (`consultas/[id_consulta]/actions.ts:128-132`). Para revertirlo hay que cancelar la factura de prueba estando en Test (ver A7).
- **Corrección:** en Test, timbrar sin estampar (o estampar en una columna/tabla aparte con `livemode`), y que el listado solo excluya cobros con CFDI Live. Como mínimo, guardar `livemode` junto a `uuid_cfdi`.

### A4 · ALTA · El total del CFDI depende de `tax_included` del producto por defecto

- **Dónde:** `[id]/pending/actions.ts:98-116` (copia `tax_included` y `taxes` del producto); `[id]/products/componentes/ProductFormModal.tsx:46` (el alta de producto propone `tax_included: false`).
- **Qué pasa:** `price` es la suma cobrada al paciente. Si el producto por defecto tiene `tax_included = false`, Facturapi agrega 16 % encima: el CFDI sale por 1.16 × lo cobrado. Nada en `setDefaultProductAction` ni en el timbrado lo valida o avisa.
- **Impacto:** todas las facturas de "Por facturar" con un total distinto al cobro real, en silencio y dependiendo de una casilla de otra pestaña.
- **Corrección:** mandar siempre `tax_included: true` en `toFacturapiBillablePayload` (el importe cobrado ya es el total), y comprobar tras timbrar que `invoice.total` coincide con el total resuelto.

### A5 · ALTA · Los cobros ya facturados se pueden editar, eliminar o cancelar, y esas acciones no validan sesión

- **Dónde (fuera del módulo, pero es su fuente de datos):**
  - `app/dashboard/pacientes/[id]/consultas/[id_consulta]/actions.ts:1267-1307` (`editarPago`) y `1311-1342` (`eliminarPago`).
  - `app/dashboard/tratamientos/actions.ts:395-410` (`deletePagoTratamiento`) y `412-437` (`updatePagoTratamiento`).
  - `app/dashboard/pacientes/[id]/expediente/actions.ts:82-98` (`cancelarConsulta`).
- **Qué pasa:** ninguna revisa `facturado`, y ninguna llama a un helper de sesión ni filtra por empresa: actualizan por llave primaria con lo que llegue. `eliminarPago` además recibe `id_usuario` del cliente.
- **Impacto:**
  - Cambiar el monto o el método de un pago facturado deja el CFDI con un importe o forma de pago que ya no corresponde al cobro.
  - Eliminar un pago facturado (`status = 0`) hace que el `NOT EXISTS (... status = 1 AND facturado = 1)` de `billableOperations.ts:125-128` deje de bloquear: si después se registra otro pago, la operación vuelve a "Por facturar" y se timbra un segundo CFDI con el primero aún vigente.
  - Al ser server actions sin verificación de sesión, se pueden invocar sin los controles de `proxy.ts` (que solo cubre rutas `/dashboard/*`, no el despacho de acciones).
- **Corrección:** rechazar edición/eliminación de pagos con `facturado = 1` y la cancelación de consultas con pagos facturados (primero cancelar el CFDI); añadir `requireActiveUser()` y filtro por `id_empresa` a esas cinco acciones, tomando el usuario del JWT.

### A6 · MEDIA · Se estampa y se factura lo que haya en la tabla en ese instante, no lo que se validó

- **Dónde:** `lib/billing/billableOperations.ts:355-378` (`markOperationInvoiced`), `233-251` (`resolveFromPaymentRows`).
- **Qué pasa:**
  - `payment_ids` se calcula pero nunca se usa: el `UPDATE` marca todos los pagos activos de la operación al momento de estampar. Un pago registrado entre la validación y el estampado queda como facturado sin estar en el importe del CFDI.
  - El total facturado es la suma pagada, no el total esperado: un sobrepago o un pago duplicado por error se factura completo.
  - La suma se hace en punto flotante sin redondear a 2 decimales antes de mandarla como `price`.
- **Corrección:** estampar con `WHERE id IN (@payment_ids)`; decidir (negocio) si un sobrepago se factura o bloquea; redondear el total a centavos.

### A7 · MEDIA · Las facturas del otro modo quedan inaccesibles; una cancelación a medias deja el cobro atascado

- **Dónde:** `lib/billing/facturapiClient.ts:45-79`; `[id]/invoices/actions.ts:166-185`.
- **Qué pasa:** `getOrgClient` usa la llave del modo actual. Tras pasar a Live no se pueden listar, descargar ni cancelar las facturas Test (y viceversa), incluidas las que estamparon cobros (A3). Aparte, si `invoices.cancel` tiene éxito y la transacción local falla, el cobro sigue marcado y reintentar la cancelación falla en Facturapi porque ya está cancelada.
- **Impacto:** cobros que no se pueden liberar desde la UI. No hay riesgo de timbrar en el modo equivocado. Es el mismo problema que Nómina B5.
- **Corrección:** guardar el modo junto al estampado y permitir a `getOrgClient` recibir el `livemode` de un documento existente (nunca para crear); hacer la cancelación tolerante a "ya cancelada" (consultar `retrieve` y limpiar el estampado si `status === "canceled"`).

### A8 · MEDIA · Serie y folio libres en la factura manual; el siguiente folio se puede mover hacia atrás

- **Dónde:** `[id]/invoices/actions.ts:44-45` (`series`, `folio_number` del formulario); `[id]/customize/actions.ts:143-152`; `lib/billing/schemas.ts:274-286, 426-438`.
- **Qué pasa:** cualquier usuario con acceso puede emitir una factura con una serie y folio arbitrarios, o fijar `next_folio` a un número ya usado. Solo se valida que sea entero positivo. `updateSeriesGroup` además reescribe el folio del otro modo con un valor leído instantes antes.
- **Impacto:** folios duplicados o con huecos en Live; complica la conciliación contable (la bitácora identifica las facturas por folio, ver E1).
- **Corrección:** quitar `folio_number` de la factura manual (o limitarlo a rol 1); en Personalizar, rechazar un `next_folio` menor al actual en Live y mandar a Facturapi solo el campo del modo activo.

### A9 · BAJA · La sucursal de "Por facturar" llega del cliente sin validar

- **Dónde:** `[id]/pending/actions.ts:47-53, 131-153`.
- **Qué pasa:** `id_sucursal` viene de `SucursalContext`. El límite real es `id_empresa` (del JWT), así que no hay fuga entre empresas; un usuario 1/4 restringido a una sucursal puede listar y facturar cobros de otra sucursal de su empresa. Documentado como aceptado en `docs/facturacion.md`.
- **Corrección:** validar contra las sucursales del usuario con el helper único que propone Nómina A1.

---

## Grupo B — Control de acceso y sesión

### B1 · ALTA · Sesión de 7 días sin revocación: rol y estatus salen del token

- **Dónde:** `lib/auth/session.ts:15-40`, `app/actions/auth.ts:281-292` (`getMeAction` solo hace `jwtVerify`).
- **Qué pasa:** `requireBillingAccess()` confía en `id_role`, `status` e `id_empresa` del JWT; nunca consulta `dbo.users`. Es Nómina A2 aplicado a este módulo.
- **Impacto:** un administrador dado de baja o degradado conserva hasta 7 días la capacidad de timbrar en Live, renovar o revocar la llave Live, borrar el CSD y eliminar organizaciones.
- **Corrección:** releer `id_role`, `status` y `deleted_at` por `id_user` dentro de `requireActiveUser()` (una consulta por PK). Al vivir en el helper compartido, arregla facturación y las descargas de CFDI de nómina a la vez.

### B2 · MEDIA · Sin segregación ni segunda confirmación para operaciones irreversibles

- **Dónde:** `app/dashboard/facturacion/actions.ts` — `deleteOrganization` (362), `deleteCertificate` (553), `renewLiveApiKey` (622), `deleteLiveApiKey` (660), `setOrgMode` (719).
- **Qué pasa:** los roles 1 y 4 tienen exactamente los mismos permisos sobre todo el módulo. Las confirmaciones (escribir el nombre, "¿activar Live?") existen solo en el navegador; el servidor ejecuta con una sola llamada. No se pide contraseña de nuevo.
- **Impacto:** una sesión robada o un error de un usuario rol 4 basta para dejar a la empresa sin poder facturar (CSD borrado, llave revocada) o para emitir en Live.
- **Corrección (decisión de negocio):** reservar a rol 1 las operaciones de llaves, CSD, modo y eliminación; pedir la contraseña del usuario en esas acciones.

### B3 · MEDIA · Eliminar una organización no revisa si tiene comprobantes emitidos

- **Dónde:** `app/dashboard/facturacion/actions.ts:362-393`.
- **Qué pasa:** solo se bloquea si es el emisor de nómina **activo**. No se revisa `is_live`, si hay cobros estampados con sus CFDI, ni si hay recibos de nómina timbrados con ese `org_uid` (`lib/payroll/cfdi/payrollCfdiRepository.ts:50, 346-351`) — una organización que fue emisora y se desactivó se puede borrar.
- **Impacto:** se pierden la fila local y sus llaves; los recibos de nómina y facturas de esa organización ya no se pueden descargar, cancelar ni consultar desde la app, y los cobros quedan marcados con un `uuid_cfdi` que no se puede revertir.
- **Corrección:** rechazar el borrado si existen `payroll.period_employee_cfdi` con ese `org_uid` o pagos con `uuid_cfdi` de la organización; exigir pasar a Test primero.

### B4 · MEDIA · Una sola cuenta de Facturapi para todas las empresas

- **Dónde:** `lib/billing/facturapiClient.ts:22-32` (`FACTURAPI_USER_KEY`), `app/dashboard/facturacion/actions.ts:193-205, 211-224`.
- **Qué pasa:** el aislamiento entre empresas depende por completo de `assertOwnedOrganization`; Facturapi no sabe de tenants (por eso C1 es grave). Además cualquier usuario 1/4 de cualquier empresa puede crear organizaciones sin límite en la cuenta, y `listOrganizations` pide `limit: 50` a nivel cuenta y filtra después: cuando la cuenta pase de 50 organizaciones, las de una empresa pueden dejar de aparecer en su listado.
- **Corrección:** construir el listado desde `BILLING.organizations` (o paginar Facturapi hasta agotar), poner un tope de organizaciones por empresa, y documentar el procedimiento de rotación de `FACTURAPI_USER_KEY`.

### B5 · BAJA · `allowedOrigins` de server actions acepta `*.devtunnels.ms` también en producción

- **Dónde:** `next.config.ts:15-18`.
- **Qué pasa:** la excepción pensada para desarrollo relaja la verificación de origen de las server actions para cualquier subdominio de Dev Tunnels, que cualquiera puede crear. Lo mitiga que la cookie de sesión es `sameSite: strict`.
- **Corrección:** aplicar `allowedOrigins` y `allowedDevOrigins` solo cuando `NODE_ENV !== "production"`.

---

## Grupo C — Validación de entradas

### C1 · ALTA · Los IDs de Facturapi no se validan y el SDK los concatena en la URL: se puede salir de la ruta

- **Dónde:**
  - Con la llave de plataforma: `app/dashboard/facturacion/actions.ts:660-677` (`deleteLiveApiKey`: `keyId` solo pasa por `z.string().min(1)`, y se llama a Facturapi aunque `targetKey` no exista en la lista).
  - Con la llave de la organización: `[id]/invoices/actions.ts:166, 215-216` (`invoiceId`), `[id]/customers/actions.ts:129` (`customerId`, sin validar), `[id]/products/actions.ts:90` (`productId`, sin validar), `app/api/facturacion/organizations/[orgId]/invoices/[invoiceId]/pdf/route.ts:61-62`.
  - SDK: `node_modules/facturapi/dist/index.es.js:219` — `this.client.delete("/organizations/" + e + "/apikeys/live/" + t)`, sin `encodeURIComponent`; `fetch` normaliza los segmentos `..`.
- **Qué pasa:** un `keyId` como `../../../<uid de otra organización>` convierte la llamada en `DELETE /v2/organizations/<otro uid>` ejecutada con la llave de plataforma. `orgId` sí se valida contra la empresa, pero `keyId` no pasa por ningún chequeo de pertenencia. Con `.../<otro uid>/certificate` se borraría el CSD de otra organización. No se probó contra Facturapi; se deduce del código del SDK y de cómo `fetch` resuelve la URL.
- **Impacto:** un usuario 1/4 de una empresa podría eliminar la organización o el CSD de otra empresa si conoce su `uid` (no es secreto: aparece en URLs y en la bitácora). Es el único cruce entre empresas encontrado en el módulo. Con los IDs de factura/cliente/producto el alcance se limita a la propia organización, pero permite operaciones que la UI no ofrece y que la bitácora registra mal (p. ej. `cancelInvoiceAction` con `../customers/<id>` borra un cliente).
- **Corrección:** un `FacturapiIdSchema` estricto (`/^[A-Za-z0-9_-]{1,64}$/`) aplicado a `orgId`, `keyId`, `invoiceId`, `customerId`, `productId` y `default_product_id` en todas las acciones y en la ruta del PDF; en `deleteLiveApiKey`, abortar si `targetKey` no está en `listLiveApiKeys(uid)`.

### C2 · BAJA · Filtros y parámetros primitivos sin `zod`

- **Dónde:** `listInvoicesAction` (`invoices/actions.ts:93-111`: `month`, `status`, `q`), `searchCustomersAction` (`customers/actions.ts:97-103`), `getBillableOperationsAction` (`pending/actions.ts:62-75`: fechas, podólogo, búsqueda), `updateOrganizationCustomization` / `getInvoiceSeriesFolio` (`orgId`), `setDefaultProductAction` (no comprueba que el producto exista en la organización).
- **Qué pasa:** no hay inyección (el SQL va parametrizado y `orgId` se valida contra la empresa), pero un mes inválido quita el filtro de fecha sin avisar, `status` se reenvía tal cual a Facturapi, y un tipo inesperado termina en un error genérico.
- **Corrección:** schemas para los filtros; verificar el producto por defecto con `products.retrieve` al guardarlo.

---

## Grupo D — Secretos y cifrado

### D1 · MEDIA · Una sola llave de cifrado, sin rotación y sin ligar el cifrado a su fila

- **Dónde:** `lib/billing/crypto.ts:47-89`, `lib/billing/organizationsRepository.ts:97-113`.
- **Qué pasa:** AES-256-GCM está bien implementado (IV aleatorio, tag verificado), pero no usa datos autenticados adicionales: el texto cifrado no está atado a `uid` ni a la columna. Quien pueda escribir en `BILLING.organizations` puede copiar la `live_key` cifrada de una organización a otra, o la `test_key` a la columna `live_key`, y el descifrado no lo detecta. El prefijo `v1:` existe, pero no hay procedimiento ni script de re-cifrado si `BILLING_ENCRYPTION_KEY` se filtra.
- **Impacto:** requiere acceso de escritura a la base; el efecto sería facturar a nombre de otra organización o creer que se está en Live usando una llave Test.
- **Corrección:** pasar `uid + ":" + columna` como AAD (`setAAD`) en un formato `v2:`; escribir el script de rotación antes de necesitarlo.

### D2 · BAJA · Conexión a SQL Server sin cifrado

- Es Nómina E1 (`database/connection.ts:24-31`). Aquí afecta a RFC y datos fiscales de clientes y a la bitácora; las llaves de Facturapi viajan ya cifradas.

### D3 · BAJA · `.gitignore` solo ignora `.env.local`

- **Dónde:** `.gitignore:33-34`.
- **Qué pasa:** un `.env` o `.env.production` creado por descuido no quedaría ignorado y podría subirse con `FACTURAPI_USER_KEY` y `BILLING_ENCRYPTION_KEY`. Hoy solo existen `.env.local` (ignorado) y `.env.template`.
- **Corrección:** ignorar `.env*` con excepción de `.env.template`.

---

## Grupo E — Bitácora y trazabilidad

### E1 · MEDIA · La bitácora no es atómica, identifica las facturas por folio y no se puede consultar

- **Dónde:** `writeAuditEntry` fuera de transacción en `invoices/actions.ts:132, 219`, `customers/actions.ts:64, 131`, `products/actions.ts:57, 92`, `customize/actions.ts:88, 156, 245`, y la ruta del PDF (`route.ts:65`); `target_id: String(invoice.folio_number)` en `invoices/actions.ts:136, 182, 224` y `pending/actions.ts:182`.
- **Qué pasa:**
  - Fuera de las operaciones con transacción local, la entrada se escribe después de Facturapi y por separado: puede haber operación sin registro, o error devuelto con la operación ya hecha (ver A2).
  - `target_id` guarda el folio, que se repite entre series y entre Test y Live; no se guarda el `id` ni el `uuid` del CFDI.
  - `setDefaultProductAction` se registra como `org.update_customization` sin detalle; los intentos rechazados (sin permiso, organización ajena) no se registran.
  - No hay pantalla para leerla y es "append-only" solo por convención (el usuario de la app puede hacer `UPDATE`/`DELETE`).
- **Corrección:** guardar `invoice.id` en `target_id` y folio/uuid en `detail`; negar `UPDATE`/`DELETE` sobre `BILLING.audit_log` al usuario de la app; una vista de solo lectura para rol 1.

### E2 · BAJA · Envío de correo y descargas sin límites

- **Dónde:** `invoices/actions.ts:205-232`; `app/api/facturacion/catalogs/products/route.ts`; `.../pdf/route.ts:80-86`.
- **Qué pasa:** `sendInvoiceByEmailAction` se puede llamar sin límite (correo repetido al cliente). El destinatario "fijo" es el correo del cliente, que el mismo usuario puede cambiar con `updateCustomerAction` justo antes (queda rastro como `customer.update`). El buscador del catálogo SAT genera llamadas a Facturapi sin tope por usuario. La respuesta del PDF no lleva `Cache-Control: private, no-store`.
- **Corrección:** límite por usuario con `lib/rateLimiter.ts`; añadir el encabezado de caché.

---

## Grupo F — Consistencia con Facturapi

### F1 · BAJA · Operaciones en varios pasos que pueden quedar a medias

- **Dónde y qué pasa:**
  - `deleteLiveApiKey` y `deleteCertificate` no regresan `is_live` a 0 (`actions.ts:553-586, 660-702`): la organización queda en Live sin poder operar. Falla de forma segura (`getOrgClient` rechaza), pero bloquea facturación y nómina hasta que alguien cambie el modo.
  - `renewLiveApiKey` (`actions.ts:631-643`): Facturapi invalida la llave anterior antes de guardar la nueva; si la transacción falla, la llave guardada ya no sirve (se recupera renovando otra vez).
  - `createOrganization` / `deleteOrganization` (`actions.ts:277-287, 376-386`): si falla la limpieza o la transacción local, queda una organización huérfana en un lado; solo se escribe en consola.
  - `updateOrganizationCustomization` (`customize/actions.ts:130-152`): hasta tres llamadas sin reversión; un fallo intermedio deja color cambiado y serie no.
- **Corrección:** pasar a Test dentro de la misma transacción al revocar la llave guardada o borrar el CSD; registrar los huérfanos en `audit_log` para poder reconciliarlos.

---

## Lo que está bien

- Todo el SQL del módulo usa `queryParams`; las únicas interpolaciones son constantes del servidor (nombres de tabla, la columna `test_key`/`live_key` elegida por un tipo cerrado, el fragmento de filtros con parámetros nombrados). No se encontró inyección SQL.
- Todas las server actions y las dos rutas `/api/facturacion/*` empiezan con `requireBillingAccess()`, que también revisa `status`. Cada operación sobre una organización valida `uid` contra `id_empresa` del JWT, y la respuesta es la misma para "no existe" y "es de otra empresa".
- El modo Test/Live nunca llega del cliente: se resuelve dentro de `getOrgClient`, que además exige llave Live y CSD.
- Las llaves de Facturapi se guardan cifradas con AES-256-GCM y nunca se devuelven completas (solo `first_12`); `lib/billing/*` es `server-only`. La contraseña del CSD no se guarda ni se registra.
- Importe, forma de pago y producto de "Por facturar" se recalculan en el servidor; el cliente solo manda el identificador del cobro.
- Archivos (CSD, logo) validados por extensión, tamaño y bytes iniciales. El logo no acepta SVG.
- Los errores pasan por `toUserMessage`: al cliente no llegan mensajes crudos de Facturapi. El error del SDK (`FacturapiError`) no incluye la llave ni los encabezados de la petición, así que el `console.error` del servidor no la filtra.
- El correo de una factura solo se envía al correo registrado del cliente, no a uno libre.
- No hay `dangerouslySetInnerHTML` ni `href` construidos con datos de usuario en los componentes del módulo.

## Lo que no cubrió esta auditoría

- No se probó nada contra Facturapi: C1 y A1 se deducen del código del SDK y de sus tipos, no de una ejecución.
- Componentes de UI: solo se revisaron confirmaciones de modo Live, `dangerouslySetInnerHTML` y `href`; no su lógica completa.
- El timbrado y la cancelación de CFDI de nómina (cubiertos en la auditoría de nómina, grupo B).
- Dependencias (`npm audit`), variables de entorno reales, permisos del usuario de base de datos y configuración del servidor.
- El resto de las acciones de `pacientes/`, `tratamientos/` y `ventas/`: en A5 solo se revisaron las cinco funciones citadas. Que no validen sesión sugiere revisar esos módulos completos.
- Corrección fiscal (uso de CFDI, `PUE`, forma de pago por el pago mayor, plazos de emisión): requiere al contador.
