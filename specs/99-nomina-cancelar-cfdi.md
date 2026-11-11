# 99 — Cancelar CFDI de nómina

## Header

- **Estado:** Implementado
- **Depende de:**
  - 98 (`nomina-timbrar-cfdi-ordinario`): de ahí sale la tabla `payroll.period_employee_cfdi`, el repositorio `lib/payroll/cfdi/payrollCfdiRepository.ts`, `PayrollCfdiStatusCell`, `PayrollCfdiCard`, las descargas `app/api/nomina/cfdi/[id]/*` y el candado `PERIOD_HAS_STAMPED_RECEIPTS`. Esta spec cierra su pendiente "Cancelación".
  - 30 / 33 (facturas y CSD): `getOrgClient(uid, idEmpresa)`, más `CancelInvoiceSchema` y `CANCELLATION_MOTIVE_OPTIONS` como referencia del patrón de cancelación.
  - 96 (`nomina-reabrir-periodo-pagado`): Reabrir se vuelve a habilitar cuando ya no quedan recibos Live vigentes.
- **Modifica base de datos:** Sí.
  - `payroll.period_employee_cfdi`:
    - estados nuevos `'X'` y `'C'`;
    - columnas de cancelación y `id_period` / `id_empleado`;
    - la FK pasa a `ON DELETE SET NULL`;
    - el `UNIQUE` pasa a ser un índice filtrado.
  - Acción nueva `payroll_receipt.cancel` en `BILLING.audit_log` (solo código).
- **Fecha:** 2026-11-10
- **Objetivo:** Cancelar ante el SAT, vía Facturapi y uno por uno, un CFDI de nómina ya timbrado con motivo `02` o `03`. El registro cancelado y su acuse se conservan, y la fila queda libre para timbrarla de nuevo.

## Alcance

### Entra

- **Cancelación individual** de un recibo en estado `'T'` (Test o Live). Se hace desde la celda "CFDI" de Procesar nómina (vista fiscal) y desde `PayrollCfdiCard` en el Detalle del empleado.
- **Motivos permitidos:** solo `02` (comprobante emitido con errores sin relación) y `03` (no se llevó a cabo la operación). El motivo es obligatorio y se elige en el diálogo.
- **Diálogo de confirmación** dentro de la UI (sin `confirm()` nativo). Muestra empleado, UUID, serie-folio, emisor y modo.
  - En **Live**, además hay que escribir el folio (`NOM-{folio}`) para habilitar el botón.
  - En **Test** basta el diálogo.
- **Llamada a Facturapi** con `getOrgClient(receipt.org_uid, idEmpresa).invoices.cancel(facturapi_id, { motive })`. Siempre se usa el emisor guardado en el recibo, no el activo.
- **Resultado de la cancelación:**
  - Si Facturapi responde **cancelado**, la fila pasa a `'C'`.
  - Si responde **pendiente** en el SAT, la fila pasa a `'X'` ("Cancelación en proceso") y aparece el botón **"Consultar estado"**. Ese botón vuelve a preguntar a Facturapi y pasa la fila a `'C'`, o la regresa a `'T'` si el SAT rechazó la cancelación.
  - Si la llamada **falla**, la fila se queda en `'T'` y el error de Facturapi solo se muestra en el diálogo; no se guarda.
- **Volver a timbrar sin reabrir:** con la fila en `'C'`, el empleado vuelve a "Pendiente" en el mismo periodo (estatus 4) y se puede timbrar otra vez con el flujo de la spec 98, de forma individual o con "Timbrar pendientes". El recibo nuevo es una fila nueva; el cancelado no se toca.
- **Conservar el registro cancelado:**
  - La FK a `period_employees` pasa a `ON DELETE SET NULL`.
  - La fila guarda `id_period` e `id_empleado` para seguir ligada aunque se recalcule el periodo.
  - El Detalle del empleado lista los recibos cancelados de ese periodo: UUID, folio, motivo, fecha y quién canceló.
- **Limpieza explícita al recalcular:** antes de cada `DELETE FROM period_employees` de `procesar/actions.ts` (cuatro lugares), un helper del repositorio borra en la misma transacción los recibos del periodo con `estado <> 'C'`. Así se conserva el comportamiento actual para Test, `'E'` y `'P'`.
- **Candado de Reabrir (spec 96):** ahora bloquea con al menos un recibo Live en `'T'` **o en `'X'`**. Cuando todos los Live están en `'C'`, Reabrir queda habilitado.
- **Descargas:**
  - El XML y el PDF originales siguen disponibles para recibos en `'T'`, `'X'` y `'C'`.
  - Ruta nueva `app/api/nomina/cfdi/[id]/acuse` que devuelve el **acuse de cancelación** del SAT, solo para recibos `'C'`, con la misma validación de rol 1/4 e `id_empresa`.
- **Badges:** "Cancelación en proceso" y "Cancelado" (en Test se distinguen como de prueba, igual que "Prueba" en la spec 98).
- **Bitácora:** `payroll_receipt.cancel` en `BILLING.audit_log` cuando la fila llega a `'C'`, sea directo o al consultar el estado.
- **Roles:** solo 1 y 4, como el timbrado.
- **Documentación:** `docs/nomina.md` (sección de la spec 98, más la cancelación, y quitarla de "Out of scope") y `docs/facturacion.md` (catálogo de `audit_log`).

### No entra

- **Motivo `01` y sustitución** (CFDI sustituto con relación `04`): spec propia.
- **Cancelación en lote** o "Cancelar todos" del periodo.
- **Consulta automática** del estado de cancelación (webhooks de Facturapi o tareas programadas): solo el botón manual "Consultar estado".
- **Guardar el último error de cancelación** en la base de datos.
- **Cancelar recibos de periodos extraordinarios**, que aún no se pueden timbrar.
- **Avisar al empleado** de la cancelación (correo o portal).
- **Manual de usuario** (`content/manual/nomina`): spec aparte, según la regla vigente.

## Modelo de datos

### Cambios en `payroll.period_employee_cfdi`

Se migra con un bloque `ALTER` nuevo en `queries.txt` (bloque `NOMINA PAYROLL`), que el usuario aplica a mano. La DDL original de la tabla también se actualiza para que refleje el estado final.

**Columnas nuevas**

| Columna | Tipo | Nota |
|---|---|---|
| `id_period` | `int NOT NULL` | FK → `payroll.periods` (sin cascade). Se llena desde `period_employees` en la migración. |
| `id_empleado` | `int NOT NULL` | FK → `RH.empleados` (sin cascade). Se llena igual. |
| `motivo_cancelacion` | `char(2) NULL` | `'02'` o `'03'` |
| `cancelacion_solicitada_at` | `datetime2(0) NULL` | cuándo se pidió la cancelación; se escribe con `buildDate(new Date())` |
| `fecha_cancelacion` | `datetime2(0) NULL` | cuándo quedó en `'C'` |
| `cancelled_by` | `int NULL` | usuario que solicitó la cancelación |

**Columnas que cambian**

- `id_period_employee` pasa a `NULL`, y su FK se recrea con **`ON DELETE SET NULL`**. Solo un recibo `'C'` puede quedar con `NULL`; los demás se borran antes con el helper de limpieza.
- `estado` agrega `'X'` (cancelación en proceso) y `'C'` (cancelado).

**Restricciones**

- Se elimina el `UQ_period_employee_cfdi`. En su lugar va `UX_period_employee_cfdi_vigente`, un único filtrado sobre `(id_period_employee, livemode) WHERE estado IN ('P','T','E','X')`. Así hay a lo más un recibo vigente por fila y modo, y puede haber cualquier número de cancelados.
- `CK_period_employee_cfdi_estado`: `estado IN ('P','T','E','X','C')`.
- `CK_period_employee_cfdi_coherencia` se recrea:
  - `'P'`, `'T'` y `'E'`: lo mismo que en la spec 98, y además las cuatro columnas de cancelación en `NULL`.
  - `'X'`: los datos de timbrado de `'T'`, más `motivo_cancelacion`, `cancelled_by` y `cancelacion_solicitada_at` NOT NULL; `fecha_cancelacion` NULL.
  - `'C'`: los datos de timbrado de `'T'`, más las cuatro columnas de cancelación NOT NULL.
- `CK_period_employee_cfdi_motivo`: `motivo_cancelacion IS NULL OR motivo_cancelacion IN ('02','03')`.
- `CK_period_employee_cfdi_huerfano`: `id_period_employee IS NOT NULL OR estado = 'C'`.
- `UX_period_employee_cfdi_uuid` no cambia. Un cancelado conserva su UUID, y el recibo nuevo trae otro.
- Índice nuevo `IX_period_employee_cfdi_period_empleado` sobre `(id_period, id_empleado)`, para listar los cancelados en el Detalle.

**Ciclo de vida**

```
P ──► T ──► X ──► C
│     ▲     │
▼     └─────┘   (Facturapi falla, o el SAT rechaza/expira la cancelación)
E
```

- **Reserva `'X'` antes de llamar a Facturapi.** En una transacción corta con `UPDLOCK`, la fila pasa de `'T'` a `'X'` y se guardan motivo, usuario y `cancelacion_solicitada_at`. Así dos clics no mandan dos cancelaciones. Después se llama a Facturapi fuera de la transacción:
  - si cancela → `'C'` + `audit_log`, en una sola transacción;
  - si queda pendiente → se queda en `'X'`;
  - si hay error → regresa a `'T'` y se limpian las cuatro columnas de cancelación.
- **"Consultar estado" en una fila `'X'`.** Llama a `invoices.retrieve(facturapi_id)`:
  - `status = 'canceled'` → `'C'` + `audit_log`;
  - `cancellation_status` en `pending` → sin cambio;
  - en cualquier otro caso (`none`, `rejected` o `expired`) → regresa a `'T'`.

  Esto también rescata una `'X'` que quedó atascada porque el proceso murió a la mitad, sin la regla de los 10 minutos de la `'P'`.
- **Recibos vigentes.** `reservePayrollReceipt` y `loadPeriodPayrollCfdiOverview` solo consideran filas con `estado <> 'C'`. Una fila cuyo único recibo está en `'C'` se ve como "Pendiente" (o "Bloqueado").

### Bitácora

`BillingAuditAction` gana `'payroll_receipt.cancel'`:

- `target_id` = `uuid`;
- `mode` = `test`/`live`;
- `detail` = `{ id_period, id_empleado, facturapi_id, folio, motivo }`.

Se escribe solo al llegar a `'C'`.

### Tipos TS (`interfaces/payroll_cfdi.ts`)

- `PayrollCfdiStatus = 'P' | 'T' | 'E' | 'X' | 'C'`.
- `IPayrollCfdiReceipt` gana `id_period`, `id_empleado`, `motivo_cancelacion`, `cancelacion_solicitada_at`, `fecha_cancelacion` y `cancelled_by`. Las fechas son `string`, e `id_period_employee` pasa a `number | null`.
- `PayrollCfdiCancellationMotive = '02' | '03'`.
- `PayrollCfdiRowState.status` gana `'cancelacion_en_proceso'`. `'C'` nunca es el estado de la fila, porque no es un recibo vigente.
- Tipo nuevo `PayrollCfdiCancelledReceipt` (UUID, serie-folio, `livemode`, motivo, `fecha_cancelacion` y el nombre de quien canceló) para el historial del Detalle.

### Catálogo de motivos

`PAYROLL_CFDI_CANCELLATION_MOTIVE_OPTIONS` en `lib/payroll/cfdi/payrollCfdiCancellation.ts` (puro, importable desde el cliente). Se arma filtrando `CANCELLATION_MOTIVE_OPTIONS` (`lib/billing/invoiceCatalogs.ts`) a `02` y `03`, en lugar de duplicar las etiquetas.

### Acuse

`GET /api/nomina/cfdi/[id]/acuse` devuelve el **XML** del acuse (`invoices.downloadCancellationReceiptXml`) como `NOM-{folio}-{codigo_empleado}-acuse.xml`. Solo responde para recibos `'C'`.

## Plan de implementación

Cada paso deja el sistema funcionando. La UI de cancelación aparece hasta el paso 7; antes de eso no hay cambios visibles para el usuario.

1. **Migración y tipos.**
   - Bloque `ALTER` en `queries.txt`, en este orden:
     1. agregar las columnas como `NULL`;
     2. llenar `id_period`/`id_empleado` desde `period_employees`;
     3. pasarlas a `NOT NULL`;
     4. recrear la FK con `ON DELETE SET NULL`;
     5. cambiar `UQ_period_employee_cfdi` por `UX_period_employee_cfdi_vigente`;
     6. recrear los `CHECK` y agregar los nuevos y el índice `(id_period, id_empleado)`.
   - Actualizar el `CREATE TABLE` original.
   - En `interfaces/payroll_cfdi.ts`: los estados `'X'`/`'C'`, los campos nuevos, `PayrollCfdiCancellationMotive`, `PayrollCfdiCancelledReceipt` y `'cancelacion_en_proceso'`.
   - `BillingAuditAction` gana `'payroll_receipt.cancel'`.

2. **El repositorio solo trabaja con recibos vigentes.**
   - Ajustar `payrollCfdiRepository.ts` para que todas las lecturas y bloqueos de "recibo actual" (`reservePayrollReceipt`, `loadPeriodPayrollCfdiOverview`, `hasLiveStampedReceipts`, el lookup de las descargas) filtren `estado <> 'C'`.
   - `reservePayrollReceipt` escribe `id_period`/`id_empleado` al insertar.
   - `hasLiveStampedReceipts` cuenta `'T'` **y** `'X'`.
   - `loadPeriodPayrollCfdiOverview` mapea `'X'` → `'cancelacion_en_proceso'`.

   Verificación: el timbrado de la spec 98 sigue igual.

3. **Limpieza al recalcular.**
   - `deleteNonCancelledPeriodReceipts(tx, idPeriod)` en el repositorio borra `estado <> 'C'` de las filas del periodo.
   - Se llama antes de cada uno de los cuatro `DELETE FROM period_employees` de `procesar/actions.ts`, dentro de la misma transacción.

   Verificación: reabrir y recalcular un periodo con solo recibos de Test los sigue eliminando.

4. **Reglas puras de cancelación** (`lib/payroll/cfdi/payrollCfdiCancellation.ts`, sin SQL):
   - `PAYROLL_CFDI_CANCELLATION_MOTIVE_OPTIONS` (filtrado de `CANCELLATION_MOTIVE_OPTIONS`);
   - el schema zod `cancelPayrollReceiptSchema` (`idReceipt`, `motive` ∈ `02`/`03`, `confirmFolio?`);
   - `resolveCancellationOutcome(invoice)` → `'cancelled' | 'pending' | 'not_cancelled'`, a partir de `status` y `cancellation_status` de Facturapi;
   - `formatPayrollReceiptFolio(receipt)` → `NOM-{folio}`, que usa la confirmación en Live.

5. **Repositorio de cancelación:**
   - `reservePayrollCancellation(tx, …)`: `'T'` → `'X'` con `UPDLOCK`; se niega si la fila no está en `'T'`.
   - `completePayrollCancellation(tx, …)`: `'X'` → `'C'` más `audit_log`.
   - `revertPayrollCancellation(…)`: `'X'` → `'T'` y limpia las columnas de cancelación.
   - `loadCancelledPayrollReceipts(idPeriod, idEmpleado, idEmpresa)` para el historial.

6. **Server actions** en `app/dashboard/nomina/procesar/actions.ts` (zod + `ActionResult`, roles 1/4, recibo validado contra `id_empresa`):
   - `cancelPayrollReceipt({ idReceipt, motive, confirmFolio? })`:
     1. en Live exige que `confirmFolio` coincida;
     2. reserva `'X'`;
     3. llama a `getOrgClient(org_uid, idEmpresa).invoices.cancel(facturapi_id, { motive })`;
     4. resuelve con `resolveCancellationOutcome` → `'C'`, se queda en `'X'`, o revierte;
     5. en caso de error, revierte y devuelve el mensaje de `toUserMessage`;
     6. hace `revalidatePath` de Procesar y del Detalle.
   - `refreshPayrollCancellationStatus({ idReceipt })`: solo para `'X'`; hace `invoices.retrieve` y resuelve igual.

7. **UI en Procesar nómina** (usar la skill `frontend-design`):
   - `PayrollCfdiStatusCell` gana los badges "Cancelación en proceso" y "Cancelado" (Test se distingue).
   - Componente cliente nuevo `PayrollCfdiCancelDialog`, reutilizable en Procesar y en el Detalle:
     - muestra empleado, UUID, `NOM-{folio}`, emisor y modo;
     - tiene el selector de motivo;
     - en Live, un campo para escribir el folio, y el botón queda deshabilitado mientras no coincida;
     - muestra el error de Facturapi dentro del diálogo.
   - Botón mínimo "Cancelar" en las filas `'T'`, y "Consultar estado" en las `'X'`.
   - Revisar que `PayrollStampPendingButton`/`getPayrollStampingQueue` tomen una fila con solo recibos `'C'` como pendiente (debería salir sola del paso 2).

8. **UI en el Detalle del empleado** (`PayrollCfdiCard`):
   - botones Cancelar y Consultar estado, con el mismo diálogo;
   - subsección "Recibos cancelados" (Server Component) con UUID, folio, modo, motivo, fecha y quién canceló, más los links de XML, PDF y acuse.

9. **Descargas.**
   - Las rutas `xml` y `pdf` ahora responden para `'T'`, `'X'` y `'C'`.
   - Ruta nueva `app/api/nomina/cfdi/[id]/acuse/route.ts`: misma validación de sesión, rol e `id_empresa`; solo `'C'`; `invoices.downloadCancellationReceiptXml`; nombre de archivo `NOM-{folio}-{codigo_empleado}-acuse.xml`.

10. **Documentación.**
    - `docs/nomina.md`: subsección "Cancelación CFDI (spec 99)"; quitar "CFDI cancellation" de los "Out of scope" de la spec 98; actualizar la descripción del candado de Reabrir y de la tabla.
    - `docs/facturacion.md`: `payroll_receipt.cancel` en el catálogo de `audit_log`.
    - No se toca `content/manual/nomina`.

11. **Verificación contra el PAC de pruebas.** Con el emisor en modo Test:
    1. cancelar un recibo con `02` y otro con `03`;
    2. descargar el acuse;
    3. volver a timbrar el primero sin reabrir;
    4. reabrir y recalcular un periodo con un recibo cancelado, y confirmar que el cancelado sigue visible en el Detalle.

## Criterios de aceptación

- [x] La migración se aplica sin errores sobre datos existentes, y todos los recibos actuales quedan con `id_period`/`id_empleado` llenos. (bloque `ALTER` en orden correcto en `queries.txt`; confirmado en vivo: la app funciona sobre la BD ya migrada, sin recibos huérfanos)
- [ ] Un `UPDATE` manual que deje un `'C'` sin `motivo_cancelacion`, o un `'T'` con `id_period_employee` en `NULL`, falla por `CHECK`. (verificado solo lógicamente contra el DDL; no se ejecutó el `UPDATE` real en la BD)
- [x] El timbrado de la spec 98 (individual y en lote) funciona igual que antes. (confirmado en vivo: filas `'P'` siguen mostrando "Timbrar", "Timbrar pendientes" sigue presente)
- [x] Un recibo `'T'` muestra "Cancelar" en la celda CFDI y en `PayrollCfdiCard`; uno en `'P'` o `'E'`, no. (confirmado en vivo en Procesar nómina)
- [x] El selector de motivo solo ofrece `02` y `03`, y la action rechaza cualquier otro con `ok: false`. (confirmado en vivo el diálogo; el rechazo zod confirmado por lectura de código)
- [ ] En Live, el botón de confirmar está deshabilitado hasta escribir el folio exacto, y la action rechaza un `confirmFolio` incorrecto. (no hay recibos Live en este entorno de pruebas; solo verificado por lectura de código, no probado en vivo)
- [x] En Test, cancelar deja la fila en `'C'`, escribe `payroll_receipt.cancel` en `audit_log`, y la celda vuelve a "Pendiente". (`completePayrollCancellation` corregido para que `detail` incluya `{ id_period, id_empleado, facturapi_id, folio, motivo }`, pasando `motive`/`receipt.facturapi_id`/`receipt.folio` desde los dos call-sites en `app/dashboard/nomina/procesar/actions.ts`)
- [ ] Si Facturapi responde con error, la fila sigue en `'T'`, sin columnas de cancelación, y el mensaje se muestra en el diálogo. (no se forzó un error de Facturapi en vivo; solo verificado por lectura de código)
- [ ] En una fila `'X'`, "Consultar estado" la pasa a `'C'` o la regresa a `'T'` según la respuesta de Facturapi. (no se reprodujo un estado `'X'` real contra el PAC de pruebas en esta sesión; solo verificado por lectura de código)
- [x] Después de cancelar, el empleado se puede volver a timbrar sin reabrir. Queda una fila `'T'` nueva y la `'C'` intacta. (probado en vivo: se canceló el recibo de prueba de Victoria Lorena Romero Leyva, la fila volvió a "Pendiente" y el recibo cancelado sigue en "Recibos cancelados" del Detalle)
- [ ] Con un recibo Live en `'T'` o `'X'`, Reabrir está bloqueado. Si todos los Live están en `'C'`, Reabrir funciona. (no hay recibos Live en este entorno; solo verificado por lectura de código, `hasLiveStampedReceipts` filtra `estado IN ('T','X') AND livemode = 1`)
- [ ] Al reabrir y recalcular, los recibos `'C'` sobreviven (`id_period_employee` en `NULL`) y los demás se borran. (no se ejecutó un reabrir+recalcular real en esta verificación para no alterar datos del periodo de prueba; solo verificado por lectura de código)
- [x] El Detalle lista los recibos cancelados del periodo con UUID, folio, motivo, fecha y usuario. (confirmado en vivo en `PayrollCfdiCard`, sección "Recibos cancelados")
- [x] El acuse descarga un XML para recibos `'C'`, y responde 404 para otro estado o para un recibo de otra empresa. El XML y el PDF originales se siguen descargando en `'C'`. (probado en vivo con `curl`: `/api/nomina/cfdi/{id}/acuse` → 200 solo para los recibos `'C'` (9 y 10), 404 para el resto; `/xml` y `/pdf` → 200 también en `'C'`)
- [ ] Los cuatro casos del paso 11 se completan contra el PAC de pruebas. (solo se completó una cancelación con motivo `02` + descarga de acuse + retimbrado sin reabrir; no se probó el caso con motivo `03` ni el de reabrir/recalcular con un cancelado)
- [x] `npm run lint` y `npm run build` pasan.
- [x] `docs/nomina.md` y `docs/facturacion.md` están actualizados, y `content/manual/nomina` no se tocó. (`docs/nomina.md` ok, `content/manual/nomina` intacto, y `docs/facturacion.md:266` ahora coincide con el código real tras corregir el `detail` del `audit_log`)

## Decisiones

| Decisión | Descartado | Por qué |
|---|---|---|
| Solo motivos `02` y `03` | Incluir `01` con sustitución | El sustituto saldría de un periodo que hay que reabrir, y Reabrir está bloqueado mientras exista el original. Va en su propia spec. |
| Volver a timbrar sin reabrir tras cancelar | Exigir reabrir | El caso más común (RFC, CP o nombre mal capturado) no cambia montos |
| Conservar el cancelado con FK `ON DELETE SET NULL` + `id_period`/`id_empleado` | Cascade y depender del `audit_log`; o tabla de historial aparte | El UUID cancelado tiene valor fiscal y debe verse en el Detalle; una sola tabla evita sincronizar dos |
| Borrado explícito de los no-`'C'` antes de recalcular | Trigger en SQL Server | Queda visible en el código; el proyecto no usa triggers |
| Único filtrado `WHERE estado IN ('P','T','E','X')` | Mantener el `UNIQUE` | Permite varios cancelados y un solo vigente por fila y modo |
| Reservar `'X'` antes de llamar a Facturapi | Llamar directo | Evita cancelaciones dobles; una `'X'` atascada se resuelve con "Consultar estado" |
| Error de cancelación solo en el diálogo, la fila sigue `'T'` | Columna `mensaje_cancelacion` | El error es momentáneo y no cambia el estado fiscal |
| "Consultar estado" manual | Webhooks o tareas programadas | Para nómina el SAT no pide aceptación del receptor; lo pendiente es raro |
| `'X'` cuenta para el candado de Reabrir | Solo `'T'` | Mientras el SAT no confirme, el CFDI sigue vigente |
| Escribir el folio para confirmar solo en Live | Siempre, o nunca | Fricción solo donde la acción es irreversible ante el SAT |
| Solo cancelación individual | "Cancelar todos" | Una cancelación masiva irreversible merece su propia spec |
| Cancelar también recibos de Test | Solo Live | Permite probar el flujo completo sin consecuencias |
| Acuse solo en XML | XML y PDF | El XML es el documento fiscal |
| Motivos filtrados de `CANCELLATION_MOTIVE_OPTIONS` | Catálogo propio | Sin etiquetas duplicadas |
| Manual fuera de la spec | Actualizarlo aquí | Regla vigente para nómina |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El proceso muere entre Facturapi y la escritura de `'C'` | La fila queda en `'X'`; "Consultar estado" la concilia con Facturapi |
| La migración falla a la mitad sobre datos existentes | Bloque `ALTER` en pasos ordenados; probarlo primero en la base de pruebas |
| Uno de los cuatro `DELETE FROM period_employees` olvida la limpieza y la FK deja huérfanos no-`'C'` | `CK_period_employee_cfdi_huerfano` hace fallar el `DELETE`, en lugar de dejar datos inconsistentes |
| Se cancela en Live y el empleado queda sin CFDI vigente | Volver a timbrar de inmediato está habilitado; confirmar escribiendo el folio |
| El emisor del recibo ya no tiene CSD vigente al cancelar | Facturapi devuelve el error, se muestra y la fila sigue `'T'` |

## Lo que **no** entra en esta spec

- Motivo `01` y sustitución con relación `04`.
- Cancelación en lote.
- Consulta automática del estado (webhooks o tareas programadas).
- Guardar el error de cancelación en la base de datos.
- Cancelar recibos de periodos extraordinarios.
- Avisar al empleado.
- Manual de usuario de nómina.

Cada uno, si llega, va en su propia spec.
