# 98 — Timbrar CFDI de nómina fiscal (periodos ordinarios)

## Header

- **Estado:** Aprobado
- **Depende de:**
  - 71 (`empleado-datos-fiscales-cfdi-nomina`): datos del receptor, `getStampingIssues`, `lib/payroll/satCatalogs.ts` (`PAYROLL_RECEIVER_TAX_REGIME = '605'`, `PAYROLL_CFDI_USE = 'CN01'`).
  - 72 (`facturacion-emisor-cfdi-nomina`): la organización emisora activa por empresa (`is_payroll_issuer`, `registro_patronal`, `riesgo_puesto`, `curp_emisor`).
  - 30 / 33 (facturas y CSD): `getOrgClient(uid, idEmpresa)` como único punto de entrada a Facturapi con la llave del modo vigente, y el patrón de descarga de PDF por route handler.
  - 73 (`nomina-motor-gravado-exento`): `period_employee_perceptions` con gravado/exento por línea y la clave SAT del catálogo `payroll.perceptions`.
  - 70 / 91 (ISR e IMSS): `isr_estado`, `subsidio_con_derecho`, `subsidio_causado`, `isr_retenido`, `imss_estado`, `imss_retenido` y las deducciones `001`/`002` en `period_employee_deductions`.
  - 75 (`nomina-horas-extra-fiscal`): `period_employee_overtime`, de donde sale el nodo `HorasExtra` que esa spec dejó fuera.
  - 94 / 96 (`nomina-aprobar-pagar-periodo`, `nomina-reabrir-periodo-pagado`): solo se timbra en estatus 4 (Pagada), y Reabrir se bloquea mientras haya recibos timbrados vigentes.
- **Modifica base de datos:** Sí.
  - Tabla nueva `payroll.period_employee_cfdi` (un recibo vigente por fila fiscal y modo).
  - Acción nueva `payroll_receipt.stamp` en el catálogo de `BILLING.audit_log` (solo código: `BillingAuditAction`; la columna `action` es `nvarchar(60)` sin `CHECK`).
- **Fecha:** 2026-11-10
- **Objetivo:** Timbrar ante el SAT, vía Facturapi, el CFDI 4.0 con complemento Nómina 1.2 de cada empleado fiscal de un periodo ordinario ya pagado, uno por uno o en lote, y poder descargar su XML y PDF.

## Alcance

### Entra

- **Timbrado individual** de la fila fiscal (`tipo_nomina = 'F'`) de un empleado en un periodo **ordinario** (`tipo_periodo = 'O'`) con estatus **4 (Pagada)**: desde la columna "CFDI" de Procesar nómina (vista fiscal) y desde una sección "CFDI" en el Detalle del empleado.
- **Timbrado en lote**: botón "Timbrar pendientes" en Procesar. El cliente recorre las filas timbrables y llama una server action **por empleado**, en secuencia (sin concurrencia). Muestra el progreso ("12/30"), se puede detener y deja el error en cada fila.
- **Reintento**: una fila en error (`'E'`) se vuelve a timbrar sobrescribiendo su registro.
- **Validación previa por fila** (bloquea y muestra el motivo, sin llamar a Facturapi):
  - `getStampingIssues` del empleado vacío (spec 71);
  - `isr_estado = 'C'`;
  - `imss_estado = 'C'`, o `'X'` cuando no aplica;
  - ninguna percepción con exento `'N'`;
  - un emisor de nómina activo en la empresa (spec 72) con CSD vigente.
- **Armado del CFDI** (tipo `N`, complemento `nomina`, `customer` en línea con régimen `605`, uso `CN01`, serie fija `NOM`, folio de Facturapi):
  - **Montos** solo del snapshot congelado del periodo (`period_employees`, `period_employee_perceptions`, `period_employee_deductions`, `period_employee_overtime`).
  - **Identidad del receptor** (RFC, CURP, NSS, CP, cuenta, banco, contrato, régimen, jornada, `fecha_ingreso`) leída **al momento de timbrar**.
  - **Percepciones**: una por línea de `period_employee_perceptions` con importe > 0, con la clave SAT del catálogo y su gravado/exento.
  - **Nodo `HorasExtra`** en toda percepción `019`, armado desde `period_employee_overtime`.
  - **Deducciones**: `001` (IMSS) y `002` (ISR neto retenido), solo si el importe es > 0.
  - **OtroPago `002`** (subsidio para el empleo) con `Importe = 0` y `SubsidioCausado = subsidio_causado` cuando `subsidio_con_derecho = 1`.
  - **Nombre del receptor** en mayúsculas y sin espacios dobles, **conservando acentos y Ñ**.
- **Modo Test y Live**: se timbra con el modo vigente de la organización emisora. Cada recibo guarda `livemode`; uno de prueba se muestra como "Prueba" y no cuenta como timbrado para los candados. En una organización en Live, una fila con solo recibo de prueba cuenta como pendiente.
- **Descarga** del XML y del PDF por route handlers (`app/api/nomina/cfdi/[id]/xml` y `/pdf`), pidiéndolos a Facturapi con el `org_uid` guardado en el recibo. Validan rol 1/4 e `id_empresa`.
- **Candado en Reabrir (spec 96)**: `reopenPayrollPeriod` se niega si el periodo tiene al menos un recibo timbrado vigente en Live. Los recibos de Test no bloquean: al reabrir y recalcular se borran por cascada junto con la fila.
- **Bitácora**: `payroll_receipt.stamp` en `BILLING.audit_log` en cada timbrado exitoso.
- **Documentación**: actualizar `docs/nomina.md`, `docs/facturacion.md` (catálogo de `audit_log`) y `docs/rh-empleados.md`.

### No entra

- **Cancelación y sustitución** de un CFDI de nómina (spec propia). Mientras no exista, un recibo Live timbrado no se puede deshacer desde la app y bloquea Reabrir.
- **Periodos extraordinarios** (aguinaldo, PTU; ISR art. 174) y **finiquito**.
- **Nómina operativa**: nunca se timbra.
- **Envío por correo** del recibo al empleado y portal del empleado.
- **Guardar XML/PDF localmente** o en un almacenamiento propio (Facturapi es el sistema de registro).
- **Normalización automática** del nombre (acentos, nombres compuestos) y validación del RFC, nombre o CP contra el SAT antes de timbrar.
- **Timbrado en paralelo**, en segundo plano o programado.
- **Nodos** `Incapacidades`, `SeparacionIndemnizacion`, `JubilacionPensionRetiro`, `SubContratacion`, `EntidadSNCF`, `RfcPatronOrigen`, y otros OtroPago distintos de `002`.
- **Varios registros patronales** por organización, o un emisor distinto por sucursal.
- **Bloquear el cambio de emisor** con recibos timbrados en el periodo: cada recibo guarda su `org_uid` y con eso basta.
- **Manual de usuario** (`content/manual/nomina`): spec aparte, según la regla vigente.

## Modelo de datos

### Tabla nueva `payroll.period_employee_cfdi`

Un recibo por fila fiscal y por modo. Es la fila "vigente": un reintento la sobrescribe y nunca se acumulan intentos.

| Columna | Tipo | Nota |
|---|---|---|
| `id_period_employee_cfdi` | `int IDENTITY` | PK |
| `id_period_employee` | `int NOT NULL` | FK → `period_employees` **`ON DELETE CASCADE`** (solo filas `tipo_nomina = 'F'`, validado en la action) |
| `livemode` | `bit NOT NULL` | modo de la organización al timbrar |
| `estado` | `char(1) NOT NULL` | `'P'` en proceso, `'T'` timbrado, `'E'` error |
| `org_uid` | `nvarchar(255) NOT NULL` | emisor con el que se timbró; las descargas usan este, no el emisor actual |
| `facturapi_id` | `nvarchar(50) NULL` | id del CFDI en Facturapi |
| `uuid` | `char(36) NULL` | folio fiscal |
| `serie` | `nvarchar(25) NULL` | siempre `NOM` |
| `folio` | `int NULL` | el que asigna Facturapi |
| `total` | `decimal(12,2) NULL` | total del CFDI devuelto por Facturapi |
| `fecha_timbrado` | `datetime2(0) NULL` | hora local de Ciudad de México, escrita como string con `toDBString` |
| `mensaje_error` | `nvarchar(1000) NULL` | mensaje del PAC o de Facturapi, tal cual |
| `stamped_by` | `int NOT NULL` | usuario del último intento |
| `created_at` / `updated_at` | `datetime2(0) NOT NULL` | `buildDate(new Date())` |

**Restricciones**
- `UQ_period_employee_cfdi` `UNIQUE (id_period_employee, livemode)`: a lo más un recibo por fila y modo.
- `CK_period_employee_cfdi_estado`: `estado IN ('P','T','E')`.
- `CK_period_employee_cfdi_coherencia`:
  - `'T'` exige `facturapi_id`, `uuid`, `folio`, `total` y `fecha_timbrado` NOT NULL, y `mensaje_error` NULL;
  - `'E'` exige `mensaje_error` NOT NULL y `uuid` NULL;
  - `'P'` exige `uuid` y `mensaje_error` NULL.
- `UX_period_employee_cfdi_uuid`: único filtrado `WHERE uuid IS NOT NULL`.

**El estado `'P'` (reserva antes de llamar a Facturapi).** La action primero inserta o actualiza la fila a `'P'` en una transacción corta, gracias al `UNIQUE`. Así dos clics o dos pestañas no pueden timbrar dos veces el mismo recibo: el segundo encuentra `'P'` o `'T'` y se niega. Después llama a Facturapi fuera de la transacción y al final escribe `'T'` o `'E'`.
**Una `'P'` atascada** (por ejemplo, el proceso murió a la mitad) solo se puede reintentar si tiene más de 10 minutos. Antes de reintentar se pide confirmación con el aviso "Verifica en Facturapi que no se haya timbrado".

### Sin cambios de esquema en tablas existentes
- El candado de Reabrir es una consulta: `EXISTS (... estado = 'T' AND livemode = 1)` sobre las filas del periodo.
- `BILLING.audit_log`: acción nueva `payroll_receipt.stamp`. `target_id` = `uuid`, `mode` = `test`/`live`, `detail` = `{ id_period, id_empleado, facturapi_id, folio }`.

### Tipos TS (`interfaces/payroll_cfdi.ts`)
- `PayrollCfdiStatus = 'P' | 'T' | 'E'`
- `IPayrollCfdiReceipt` (espejo de la fila, fechas como `string`).
- `PayrollStampingBlockReason`: `'employee_fiscal_data' | 'isr_not_calculated' | 'imss_not_calculated' | 'exemption_not_calculated' | 'no_payroll_issuer' | 'issuer_without_certificate' | 'period_not_paid' | 'period_not_ordinary'`.
- `PayrollCfdiRowState`: para la columna de Procesar → `{ status: 'pendiente' | 'bloqueado' | 'en_proceso' | 'timbrado' | 'prueba' | 'error', reasons?, receipt? }`.

### Mapeo de datos → complemento Nómina 1.2 (sin tablas nuevas)

| Nodo / atributo | Origen |
|---|---|
| `TipoNomina` | `'O'` fijo |
| `FechaPago` / `FechaInicialPago` / `FechaFinalPago` | `periods.fecha_pago` / `fecha_inicio` / `fecha_fin` |
| `NumDiasPagados` | `period_employees.dias` |
| `Emisor/@RegistroPatronal`, `@Curp` | `BILLING.organizations` del emisor activo (spec 72) |
| `Receptor/@RiesgoPuesto` | `organizations.riesgo_puesto` |
| `Receptor/@PeriodicidadPago` | clave SAT del `id_payment_period` del periodo |
| `Receptor/@FechaInicioRelLaboral` / `@Antigüedad` | `RH.empleados.fecha_ingreso`; antigüedad en semanas `P{n}W` hasta `fecha_fin` |
| `Receptor/@NumEmpleado`, `@Puesto` | `codigo_empleado`, nombre del puesto |
| `Receptor/@SalarioBaseCotApor` / `@SalarioDiarioIntegrado` | SBC vigente congelado en `period_employee_imss` (solo cuando IMSS es `'C'`) |
| `Receptor/@ClaveEntFed` | estado de la sucursal (spec 71) |
| Percepciones | `period_employee_perceptions` ⨝ `perceptions.clave_sat`; `Clave` = `id_perception` con ceros a la izquierda |
| `HorasExtra` (en cada `019`) | `period_employee_overtime` de la fila fiscal: un nodo por día y tipo (`01` dobles, `02` triples) con importe > 0; `HorasExtra` = `CEILING` de las horas (el XSD exige entero), `ImportePagado` exacto |
| Deducciones `001` / `002` | `imss_retenido` / `isr_retenido`, si son > 0 |
| OtroPago `002` | `Importe = 0`, `SubsidioCausado = subsidio_causado`, si `subsidio_con_derecho = 1` |

## Plan de implementación

Cada paso deja el sistema funcionando. La UI de timbrado aparece hasta el paso 7; antes de eso nada es visible para el usuario.

1. **Esquema y tipos.**
   - DDL de `payroll.period_employee_cfdi` en `queries.txt` (bloque `NOMINA PAYROLL`) con sus `CHECK`, el `UNIQUE` y el índice filtrado de `uuid`. Lo aplica el usuario a mano.
   - `interfaces/payroll_cfdi.ts` con `PayrollCfdiStatus`, `IPayrollCfdiReceipt`, `PayrollStampingBlockReason` y `PayrollCfdiRowState`.
   - `BillingAuditAction` (`lib/billing/organizationsRepository.ts`) gana `'payroll_receipt.stamp'`.

2. **Reglas puras** (`lib/payroll/cfdi/`, importables desde cliente y servidor, sin SQL):
   - `payrollStampingBlockers.ts`: `getPayrollStampingBlockReasons(input)` → `PayrollStampingBlockReason[]` (`[]` = timbrable). Reutiliza `getStampingIssues` (spec 71).
   - `payrollCfdiPayload.ts`: `buildPayrollCfdiPayload(source)` → el cuerpo de `invoices.create` tipo `N`:
     - `customer` en línea, serie `NOM`, uso `CN01`;
     - percepciones con importe > 0, `HorasExtra` con `CEILING` en las horas, deducciones > 0, OtroPago `002`;
     - antigüedad `P{n}W` y nombre normalizado (mayúsculas, espacios simples, acentos intactos).
     - No llama a Facturapi.

3. **Repositorio** (`lib/payroll/cfdi/payrollCfdiRepository.ts`, `server-only`, siempre con `queryParams`):
   - `loadPayrollStampingSource(idPeriodEmployee, idEmpresa)`: arma el snapshot fiscal, la identidad actual del empleado y el emisor activo, con fechas vía `CONVERT(varchar, …, 120)`.
   - `reservePayrollReceipt(tx, …)`: `'P'`, se niega si encuentra `'T'` o una `'P'` de menos de 10 min.
   - `completePayrollReceipt(tx, …)`: `'T'` más el `audit_log` en la misma transacción.
   - `failPayrollReceipt(…)`: `'E'`.
   - `loadPeriodPayrollCfdiStates(idPeriod, idSucursal)`.
   - `hasLiveStampedReceipts(idPeriod)`.

4. **Server actions** en `app/dashboard/nomina/procesar/actions.ts` (zod + `ActionResult`, roles 1/4):
   - `stampPayrollReceipt({ idPeriod, idEmpleado, confirmStaleRetry? })`:
     1. valida que el periodo sea `'O'` y esté en estatus 4;
     2. calcula los bloqueos;
     3. reserva el recibo;
     4. llama a `getOrgClient(org_uid, idEmpresa).invoices.create(payload)`;
     5. guarda `'T'` o `'E'` con el mensaje de Facturapi;
     6. devuelve el `PayrollCfdiRowState` nuevo.
   - `getPayrollStampingQueue({ idPeriod })`: ids de las filas timbrables pendientes (sin recibo en el modo actual, o en `'E'`), en el orden de la tabla.

5. **Candado en Reabrir.** `reopenPayrollPeriod` consulta `hasLiveStampedReceipts` dentro de su transacción y se niega con el marcador `PERIOD_HAS_STAMPED_RECEIPTS` y el mensaje "El periodo tiene recibos timbrados; cancélalos antes de reabrir". El botón Reabrir queda deshabilitado con `aria-describedby` cuando el periodo ya los tiene.

6. **Descargas.** Route handlers `app/api/nomina/cfdi/[id]/xml/route.ts` y `.../pdf/route.ts`:
   - validan sesión, rol 1/4 e `id_empresa` (por la fila → periodo → sucursal → empresa);
   - piden el archivo con `getOrgClient(receipt.org_uid, …)` y lo devuelven como adjunto `NOM-{folio}-{codigo_empleado}.xml|pdf`;
   - solo responden para recibos `'T'`.

7. **UI en Procesar nómina** (vista fiscal de un periodo ordinario; usar la skill `frontend-design`):
   - **Columna "CFDI"** en `PayrollEmployeesTable`: `PayrollCfdiStatusCell`, Server Component, muestra un badge por estado; "Bloqueado" lleva su motivo en `title`/tooltip, "Prueba" se distingue de "Timbrado", "Error" lleva el mensaje. La celda tiene un botón mínimo cliente para timbrar o reintentar la fila.
   - **Botón "Timbrar pendientes"** (cliente, junto a `PayrollCalculationActions`, solo en estatus 4):
     - pide la cola y llama `stampPayrollReceipt` en secuencia, mostrando "n/total" y el conteo de errores;
     - botón "Detener" que termina después del recibo en curso; al final, `router.refresh()`;
     - confirmación en la UI (sin `confirm()` nativo) que nombra al emisor y el modo (Test/Live).
   - **Aviso** cuando no hay emisor activo o este no tiene CSD, con link a Facturación.

8. **UI en el Detalle del empleado** (vista fiscal): `PayrollCfdiCard` debajo de `PayrollDeductionsCard`, con estado, UUID, folio, fecha y emisor, el botón Timbrar/Reintentar y los links de descarga XML/PDF. Si la fila está bloqueada, lista los motivos con link al expediente o a Parámetros fiscales, igual que `IsrNotCalculatedNotice`.

9. **Documentación.**
   - `docs/nomina.md`: sección "Timbrado CFDI (spec 98)" y quitar "CFDI stamping" de los "Not built".
   - `docs/facturacion.md`: catálogo de `audit_log` con `payroll_receipt.stamp`.
   - `docs/rh-empleados.md`: quitar el timbrado de "Not implemented yet".
   - No se toca `content/manual/nomina`.

10. **Verificación contra el PAC de pruebas.** Con el emisor en modo Test, timbrar un periodo ordinario pagado que tenga:
    - un empleado con horas extra dobles y triples;
    - uno con subsidio (ISR retenido 0);
    - uno con IMSS topado;
    - uno con acentos o Ñ en el nombre.

    Todos deben quedar `'T'` y el XML descargado debe contener los nodos esperados. Corregir el armado si el PAC rechaza algo antes de cerrar la spec.

## Criterios de aceptación

- [ ] La DDL de `payroll.period_employee_cfdi` se aplica sin errores, y un `UPDATE` manual que deje un `'T'` sin `uuid` falla por `CHECK`.
- [ ] En un periodo con estatus distinto de 4, o extraordinario, no aparece "Timbrar pendientes" y `stampPayrollReceipt` responde `ok: false`.
- [ ] En la vista operativa no aparece la columna "CFDI".
- [ ] Una fila con datos fiscales incompletos, ISR o IMSS `'N'`, o exento `'N'` aparece "Bloqueado" con su motivo, y no se hace ninguna llamada a Facturapi.
- [ ] Sin emisor activo, o con un emisor sin CSD, se muestra el aviso y ninguna fila es timbrable.
- [ ] En modo Test, el timbrado individual deja la fila en `'T'` con `livemode = 0`, la muestra como "Prueba" y escribe `payroll_receipt.stamp` en `audit_log`.
- [ ] "Timbrar pendientes" procesa en secuencia, muestra "n/total", se detiene al pulsar "Detener" y deja cada error en su fila con el mensaje del PAC.
- [ ] Reintentar una fila `'E'` la sobrescribe, sin crear una segunda fila.
- [ ] Dos llamadas simultáneas para la misma fila producen un solo CFDI en Facturapi.
- [ ] Una `'P'` de menos de 10 minutos no se puede reintentar; una más vieja pide confirmación.
- [ ] El XML de un empleado con horas extra trae `HorasExtra` con horas enteras (`CEILING`) e `ImportePagado` exacto.
- [ ] El XML de un empleado con subsidio trae OtroPago `002` con `Importe="0.00"` y su `SubsidioCausado`.
- [ ] El XML omite las deducciones en 0.
- [ ] El nombre del receptor sale en mayúsculas y conserva los acentos y la Ñ.
- [ ] La serie de todos los recibos es `NOM`.
- [ ] La descarga de XML y PDF funciona; devuelve 404/403 para un recibo de otra empresa o que no está en `'T'`, y usa el `org_uid` del recibo aunque haya cambiado el emisor activo.
- [ ] Con al menos un recibo Live `'T'`, Reabrir está deshabilitado y la action se niega con `PERIOD_HAS_STAMPED_RECEIPTS`. Con solo recibos Test, Reabrir funciona y esos recibos desaparecen por cascada.
- [ ] Los cuatro casos del paso 10 timbran contra el PAC de pruebas.
- [ ] `npm run lint` y `npm run build` pasan.
- [ ] `docs/nomina.md`, `docs/facturacion.md` y `docs/rh-empleados.md` están actualizados, y `content/manual/nomina` no se tocó.

## Decisiones

| Decisión | Descartado | Por qué |
|---|---|---|
| Solo periodos ordinarios; cancelación, extraordinarios y correo en specs aparte | Todo en una spec | Cada uno abre su propio dominio (motivos de cancelación SAT, art. 174, entrega) |
| Timbrar solo en estatus 4 (Pagada) | Desde Aprobada (3) | El CFDI ampara un pago hecho, y un periodo pagado ya no se recalcula |
| Reabrir bloqueado con recibos Live timbrados | Advertir y permitir | Evita que el recalculado se aleje de lo timbrado ante el SAT |
| Test y Live, con `livemode` por recibo; Test no cuenta para candados | Solo Live | Permite probar contra el PAC de pruebas sin consecuencias |
| UI en Procesar y Detalle | Pantalla `nomina/timbrado` | Reutiliza filtros y tabla, sin pantallas paralelas |
| Una fila vigente por recibo y modo; el reintento sobrescribe | Historial de intentos | El error útil es el último; la bitácora registra los éxitos |
| Estado `'P'` reservado antes de llamar a Facturapi | Llamar directo | Facturapi no da idempotencia; el `UNIQUE` evita CFDI duplicados |
| XML y PDF bajo demanda desde Facturapi | Guardarlos localmente | Facturapi es el sistema de registro, como en las facturas (spec 30) |
| Lote desde el cliente, una action por empleado | Una sola action | Evita timeouts, da progreso y permite detenerlo |
| `customer` en línea | Clientes de Facturapi por empleado | El empleado no es cliente comercial; no habría que sincronizar nada |
| Montos del snapshot; identidad del empleado al timbrar | Snapshot de la identidad | El recibo refleja lo pagado, y los datos corregidos del expediente aplican sin recalcular |
| ISR neto como deducción `002`; OtroPago `002` con `Importe = 0` | Otras formas de reportar el subsidio | El subsidio nunca se paga en efectivo (spec 70); criterio confirmado por el usuario |
| Omitir conceptos en 0 (excepto OtroPago `002`) | Enviarlos en 0 | Menos nodos, el mismo significado fiscal |
| `HorasExtra` con `CEILING` en las horas | Redondear o bloquear | El XSD exige entero; el importe no cambia |
| Nombre en mayúsculas, conservando acentos y Ñ | Normalización automática | Que el PAC rechace y se corrija en el expediente; normalizar podría ocultar el error |
| Serie fija `NOM` | Serie por defecto | Numeración separada de las facturas comerciales |
| Descargas por route handler | Server action | Un archivo binario se sirve mejor por `Response`; mismo patrón que el PDF de facturas |
| Manual fuera de la spec | Actualizarlo aquí | Regla vigente: el manual de nómina va en su propia spec |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El criterio del subsidio (OtroPago `002`, `Importe = 0`) no coincide con la guía vigente o con el PAC | Se valida en el paso 10 contra el PAC de pruebas antes de pasar a Live; si lo rechaza, se ajusta `buildPayrollCfdiPayload` |
| Un recibo Live mal timbrado no se puede deshacer desde la app | Confirmación que nombra emisor y modo; probar primero en Test; la cancelación llega en su propia spec (mientras tanto, desde el panel de Facturapi) |
| El proceso muere entre Facturapi y la escritura de `'T'`: CFDI timbrado y fila en `'P'` | El reintento de una `'P'` vieja pide confirmar en Facturapi primero; el `audit_log` solo existe si se guardó `'T'` |
| Nombre, RFC o CP del empleado no coinciden con la constancia del SAT | El PAC rechaza la fila con su mensaje y se corrige en el expediente (no se valida antes) |
| Cambiar de emisor a mitad del timbrado de un periodo | Cada recibo guarda su `org_uid`; los recibos del periodo pueden quedar con emisores distintos (aceptado) |
| El timbrado en lote se interrumpe si se cierra la pestaña | Lo que se timbró queda guardado; basta volver a pulsar "Timbrar pendientes" |
| `CEILING` reporta más horas extra que las trabajadas | Solo afecta el atributo informativo; `ImportePagado` es exacto |
