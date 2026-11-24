# Auditoría de seguridad y riesgos — módulo de Nómina

- **Fecha:** 2026-11-16
- **Commit revisado:** `da5528d` (master)
- **Alcance:** `app/dashboard/nomina/**`, `lib/payroll/**`, `app/api/nomina/cfdi/**`, y las piezas compartidas de las que depende (`lib/payroll/access.ts`, `proxy.ts`, `app/actions/auth.ts`, `app/api/upload`, `database/connection.ts`, `lib/billing/facturapiClient.ts`, webhook del checador).
- **Método:** revisión estática del código. No se ejecutó ningún ataque ni prueba contra la aplicación o la base; cada hallazgo indica el archivo y la línea que lo sustenta.

## Resumen

| Severidad | Cantidad | IDs |
|---|---|---|
| Alta | 6 | A1, A2, B1, B2, B3, C1 |
| Media | 9 | A3, A4, B4, B5, C2, C3, C4, D1, E1 |
| Baja | 5 | B6, D2, D3, D4, E2 |

Los hallazgos están agrupados por tópico (A–E) para poder atenderlos en bloque; dentro de cada grupo van ordenados por severidad. Cada uno tiene un ID estable para referenciarlo en specs o commits.

**Orden sugerido de atención**

1. **Grupo A (A1 + A2)** — un solo cambio en `assertPayrollAccess` cierra los dos.
2. **C1** — autenticar `/api/upload` (afecta a toda la app, no solo a nómina).
3. **Grupo B (B1–B4)** — integridad del timbrado y la cancelación; conviene un solo spec.
4. **E1, C2–C4, A3** — endurecimiento.
5. **A4, D1–D4** — decisiones de negocio y deuda documentada.

---

## Grupo A — Control de acceso y sesión

### A1 · ALTA · La sucursal activa sale de una cookie que nunca se valida

- **Dónde:** `lib/payroll/access.ts:57-58`.
- **Qué pasa:** `assertPayrollAccess()` toma `id_sucursal` de la cookie `sel_sucursal` tal cual. La validación de que la sucursal pertenece al usuario solo existe al *escribir* la cookie (`setSelectedSucursal`, `app/dashboard/sucursales/actions.ts:299-305`), pero el navegador puede mandar cualquier valor. El comentario del archivo dice "nunca del cliente", y una cookie es entrada del cliente.
- **Impacto:** un usuario con rol 1 o 4 puede poner `sel_sucursal=<id>` de cualquier sucursal, incluida la de **otra empresa**, y todas las acciones filtradas solo por `id_sucursal` operan sobre ella: ver salarios y detalle por empleado, crear/borrar periodos, calcular, aprobar, marcar como pagada, reabrir, justificar faltas/retardos, autorizar horas extra, capturar días pendientes y asignar el bono de extensión. Lo que filtra por `id_empresa` (tramos de comisión, PTU, descarga/cancelación de CFDI) sí queda contenido.
- **Corrección:** en `assertPayrollAccess`, validar la cookie contra `dbo.sucursales` (`id_sucursal = @sel AND id_empresa = @id_empresa AND status = 1`) y, si no pasa, caer a `user.id_sucursal`. El mismo patrón está copiado en `app/dashboard/actions.ts`, `citas`, `pacientes`, `usuarios`, `movimientos` y `conteos`: conviene un helper único.

### A2 · ALTA · Sesión de 7 días sin revocación; nómina no revisa `status`

- **Dónde:** `app/actions/auth.ts:127-131` (JWT `7d` con `id_role`, `status`, `id_empresa` dentro), `lib/payroll/access.ts:45-55`.
- **Qué pasa:** el rol y el estatus se leen del token, nunca de la base. Un usuario al que se le quita el rol 1/4, se desactiva o se borra conserva acceso total a nómina hasta que expire su token (hasta 7 días). Además `assertPayrollAccess` no revisa `user.status`, a diferencia de `requireActiveUser` (`lib/auth/session.ts:17`) que sí lo hace para facturación y para las descargas de CFDI. `proxy.ts` solo protege rutas `/dashboard/*`; una server action se despacha por su ID sobre cualquier ruta, así que ese filtro no cubre las acciones.
- **Impacto:** un administrador dado de baja sigue pudiendo calcular, aprobar, pagar, timbrar y cancelar CFDI.
- **Corrección:** en `assertPayrollAccess`, releer `id_role`, `status` y `deleted_at` de `dbo.users` por `id_user` en cada llamada (es una consulta por PK) y rechazar si no cuadra. Opcional: acortar la vida del token o añadir una versión de sesión por usuario.

### A3 · MEDIA · Parámetros fiscales, tarifa ISR y catálogo de percepciones son globales

- **Dónde:** `app/dashboard/nomina/parametros-fiscales/actions.ts` (ninguna escritura filtra por empresa; `payroll.tax_parameters`, `tablas_retencion` y `perceptions` no tienen `id_empresa`).
- **Qué pasa:** cualquier rol 1/4 de cualquier empresa —incluida la empresa Demo— edita UMA, subsidio, cuotas IMSS, tramos del ISR y reglas de exención que usa el cálculo fiscal de **todas** las empresas. El catálogo de percepciones además no tiene bitácora (`savePerception`).
- **Impacto:** un cambio accidental o malicioso desde la empresa Demo altera retenciones reales en el siguiente recálculo.
- **Corrección:** restringir estas escrituras a un rol o empresa concretos (p. ej. solo `id_role = 1` de la empresa principal) y añadir bitácora a `perceptions`.

### A4 · MEDIA · Sin segregación de funciones ni topes en capturas que generan pago

- **Dónde:** `procesar/actions.ts` (calcular, aprobar, pagar, reabrir, timbrar con el mismo usuario); `dias-pendientes/actions.ts:195-280`; `lib/payroll/pendingDaysSchemas.ts:5` (tarifa hasta 9,999,999,999.99); `horas-extra/actions.ts:267-282`.
- **Qué pasa:**
  - La misma persona puede calcular, aprobar y pagar un periodo; no hay segunda firma.
  - Días pendientes: tarifa diaria libre sin relación con el salario, rango de fechas sin tope de días, y el borrado es físico y sin bitácora.
  - Horas extra: se pueden autorizar más horas que las detectadas (solo limita `tope_horas_dia`), y "Volver a pendiente" borra la decisión sin dejar rastro.
  - Justificaciones de faltas/retardos y tramos de comisión: borrado o sobrescritura sin historial.
- **Impacto:** un solo usuario con rol 1/4 puede inflar un pago y borrar la evidencia de cómo se generó. Es riesgo de fraude interno, no una falla técnica; parte está documentada como "no construido" en `docs/nomina.md`.
- **Corrección (decisión de negocio):** aprobar ≠ quien calculó; tope de tarifa relativo al salario del empleado; bitácora de borrados en `pending_day_payments`, `overtime_authorizations` y las dos tablas de justificaciones.

---

## Grupo B — Timbrado y cancelación de CFDI

### B1 · ALTA · El timbrado no es idempotente: un fallo después de timbrar permite duplicar el CFDI

- **Dónde:** `procesar/actions.ts:2425-2449`, `lib/payroll/cfdi/payrollCfdiRepository.ts:356-372`.
- **Qué pasa:** `invoices.create` y `completePayrollReceipt` están en el mismo `try`. Si Facturapi timbra pero la respuesta se pierde (timeout de red) o falla la transacción local, el `catch` marca el recibo en `'E'` y la UI ofrece "Reintentar", que vuelve a llamar a `invoices.create`. Lo mismo ocurre con una `'P'` de más de 10 minutos confirmada con `confirmStaleRetry`. El payload no lleva `idempotency_key` ni `external_id` (el SDK instalado los admite: `node_modules/facturapi/dist/types/invoice.d.ts:41-42`).
- **Impacto:** dos CFDI de nómina Live vigentes ante el SAT por el mismo pago, con solo uno registrado localmente.
- **Corrección:** enviar `idempotency_key` derivado del recibo (p. ej. `id_period_employee_cfdi` + contador de intento que solo cambie tras un rechazo confirmado del PAC) y `external_id`; ante un error que no sea un rechazo explícito, dejar la fila en `'P'` y reconciliar consultando Facturapi antes de permitir otro intento.

### B2 · ALTA · Reabrir un periodo no bloquea recibos con cancelación en proceso (`'X'`)

- **Dónde:** `procesar/actions.ts:2299-2305` filtra `cfdi.estado = 'T'`. La función correcta, `hasLiveStampedReceipts` (`payrollCfdiRepository.ts:653-662`, `IN ('T','X')`), solo se usa para pintar la UI (`procesar/actions.ts:579`).
- **Qué pasa:** `docs/nomina.md` dice que Reabrir se rechaza con recibos Live en `'T'` **o `'X'`**, pero la acción del servidor solo revisa `'T'`. Con un recibo Live en `'X'` (el SAT aún no confirma, el CFDI sigue vigente) el periodo se reabre; al recalcular o revertir, `DELETE_NON_CANCELLED_PERIOD_RECEIPTS_SQL` borra esa fila.
- **Impacto:** se pierde el registro local de un CFDI vigente; si el SAT rechaza la cancelación queda un CFDI vivo sin recibo en el sistema, y la fila se puede volver a timbrar.
- **Corrección:** cambiar el `IF EXISTS` a `cfdi.estado IN ('T','X')`. Es un cambio de una línea.

### B3 · ALTA · El recálculo borra recibos Live sin distinguir su estado; un timbrado en vuelo queda huérfano

- **Dónde:** `payrollCfdiRepository.ts:45-46` (`DELETE ... WHERE estado <> 'C'`), interpolado en los cuatro batches de cálculo/reversión; `completePayrollReceipt` (`payrollCfdiRepository.ts:395-405`) no comprueba filas afectadas.
- **Qué pasa:** la única defensa de los recibos Live es el candado de Reabrir (B2). Reabrir tampoco bloquea una fila en `'P'`: si un usuario reabre y recalcula mientras otro tiene un timbrado en curso, la fila `'P'` se borra, Facturapi timbra, y el `UPDATE` final no afecta ninguna fila sin que nadie se entere.
- **Impacto:** CFDI Live timbrado sin registro local (mismo efecto que B2), en una carrera poco probable pero sin red de seguridad.
- **Corrección:** que el batch haga `THROW` si existe un recibo `livemode = 1` en `'P'`, `'T'` o `'X'` en vez de borrarlo; que Reabrir también bloquee `'P'` reciente; y que `completePayrollReceipt` falle (y deje evidencia en `audit_log`) si su `UPDATE` afecta 0 filas.

### B4 · MEDIA · La cancelación revierte a `'T'` ante cualquier error, aunque el SAT ya haya cancelado

- **Dónde:** `procesar/actions.ts:2529-2567`, `payrollCfdiRepository.ts:757-766`.
- **Qué pasa:** el `catch` llama a `revertPayrollCancellation` tanto si Facturapi rechazó como si hubo timeout o si falló `completePayrollCancellation` después de una cancelación exitosa. Además `revertPayrollCancellation` no lleva `AND estado = 'X'`, así que una llamada concurrente (dos clics en "Consultar estado", o cancelar + consultar) puede regresar a `'T'` una fila que ya estaba en `'C'`.
- **Impacto:** el sistema muestra "Timbrado" para un CFDI cancelado ante el SAT; no se puede volver a timbrar la fila y la bitácora `payroll_receipt.cancel` no se escribe.
- **Corrección:** revertir solo cuando `resolveCancellationOutcome` diga `not_cancelled`; ante una excepción, dejar la fila en `'X'` (ya existe "Consultar estado" para resolverla). Añadir `AND estado = 'X'` a los `UPDATE` de revertir y completar.

### B5 · MEDIA · El cliente de Facturapi usa el modo actual de la organización, no el del recibo

- **Dónde:** `lib/billing/facturapiClient.ts:45-79`, usado en descargas (`app/api/nomina/cfdi/[id]/*/route.ts`), cancelación y "Consultar estado".
- **Qué pasa:** `getOrgClient` elige la llave Test o Live según `is_live` de hoy. Un recibo Test de una organización que ya pasó a Live (o al revés) se consulta con la llave equivocada.
- **Impacto:** no se pueden descargar, cancelar ni reconciliar los recibos del otro modo; una `'X'` de ese modo queda atascada. No hay riesgo de timbrar en el modo incorrecto.
- **Corrección:** permitir a `getOrgClient` recibir el `livemode` del recibo para operaciones sobre documentos ya existentes (nunca para crear).

### B6 · BAJA · Mensaje crudo del PAC guardado y mostrado

- **Dónde:** `procesar/actions.ts:2445-2446`, `PayrollCfdiCard.tsx:144`, `PayrollCfdiStatusCell.tsx:51`.
- **Qué pasa:** `mensaje_error` guarda `stampError.message` sin pasar por `toUserMessage`, que existe justamente porque esos mensajes traen RFC y datos de certificado (`lib/billing/errors.ts:7-9`). Solo lo ven roles 1/4.
- **Corrección:** aceptarlo como decisión (el mensaje ayuda a corregir el recibo) o acotarlo a una lista de campos.

---

## Grupo C — Archivos y entradas externas

### C1 · ALTA · `/api/upload` no tiene autenticación

- **Dónde:** `app/api/upload/route.ts:64-108`; `proxy.ts:135` (el `matcher` no cubre `/api/*`).
- **Qué pasa:** cualquier persona en internet puede hacer `POST /api/upload` y subir archivos a la cuenta de Cloudinary, eligiendo `folder`, `name` y `overwrite=true`. No hay límite de tamaño en el servidor (los 5 MB solo se validan en el navegador, `utils/documentUpload.ts`).
- **Impacto:** abuso de almacenamiento y costo; sobrescritura de cualquier archivo cuyo `public_id` se conozca o adivine (los justificantes llevan `Date.now()` en el nombre, lo que lo dificulta pero no lo impide para quien haya visto la URL); alojamiento de contenido ajeno bajo la cuenta de la clínica.
- **Corrección:** exigir sesión activa (`requireActiveUser`), lista blanca de carpetas, ignorar `overwrite` del cliente y límite de tamaño en el servidor. Afecta a todos los módulos que suben archivos.

### C2 · MEDIA · La URL del justificante solo se valida por prefijo; tipo y tamaño los declara el cliente

- **Dónde:** `lib/payroll/schemas.ts:285-298`, usada en `justifyAbsence` / `justifyLateness`; se pinta como `href` en `AbsenceDaysTable.tsx:144` y `LatenessDaysTable.tsx:156`.
- **Qué pasa:** se acepta cualquier `https://res.cloudinary.com/...`, de cualquier cuenta. `mime_type` y `size_bytes` son lo que mande el cliente, no lo que se subió.
- **Impacto:** se puede registrar como justificante un archivo que no pasó por la app, o apuntar a contenido externo; el descuento de la falta se anula con evidencia no verificable.
- **Corrección:** validar el prefijo completo con el *cloud name* y la carpeta (`clinica/empleados/faltas|retardos`), o subir el archivo dentro de la propia server action y derivar ahí URL, tipo y tamaño.

### C3 · MEDIA · Justificantes médicos en URLs públicas y sin borrado

- **Dónde:** carpeta `clinica/empleados/retardos` y la de faltas; `docs/nomina.md` ("Cloudinary files aren't deleted on replace").
- **Qué pasa:** los justificantes (con frecuencia recetas o incapacidades: datos de salud del empleado) quedan en URLs públicas permanentes, sin firma ni expiración, y no se eliminan al reemplazar o limpiar la justificación.
- **Corrección:** subirlos como `type: "authenticated"` y servirlos con URL firmada de corta duración; borrar el archivo anterior al reemplazar.

### C4 · MEDIA · Las checadas, que deciden faltas, retardos, horas extra y bonos, se aceptan con solo conocer un número de serie

- **Dónde:** `app/api/asistencias/iclock/cdata/route.ts:55-70`, `lib/zktecoAdms.ts:44-48`.
- **Qué pasa:** el webhook del checador se autentica únicamente con el `SN` en la query (que además se escribe en el log, línea 24). Quien conozca un SN activo puede insertar checadas para cualquier identificador de ese checador.
- **Impacto:** fabricar asistencia (evitar faltas/retardos, conservar bonos, generar horas extra detectadas). Está fuera del módulo, pero es su fuente de datos.
- **Corrección:** secreto compartido por checador o lista de IP permitidas por sucursal; no registrar el SN completo.

---

## Grupo D — Integridad del cálculo y concurrencia

### D1 · MEDIA · Aprobar y pagar validan fuera de la transacción

- **Dónde:** `procesar/actions.ts:2107-2123` (aprobar) y `2171-2184` (pagar).
- **Qué pasa:** `collectRecalculationFlags` y `loadMissingEligibleEmployees` corren antes del `BEGIN TRAN`. Un cambio entre la verificación y el `COMMIT` (una justificación, una checada que llega, un empleado nuevo) deja aprobado o pagado un periodo desactualizado. Riesgo reconocido en el comentario de la acción.
- **Corrección:** tras aprobar, volver a evaluar los avisos y desaprobar automáticamente si alguno se activó, o mover las comprobaciones críticas al batch SQL.

### D2 · BAJA · Riesgos ya documentados que siguen abiertos

Todos constan en `docs/nomina.md`; se listan para que no se pierdan:

- Capturas retroactivas (vacaciones, días económicos, pagos de tratamientos) sobre días de un periodo aprobado o pagado no revierten nada ni se pueden recalcular.
- `setShiftExtensionAssignment` no respeta el estatus del periodo (`bonos/actions.ts:1027`).
- El bono por extensión de jornada paga dos veces los mismos días si dos periodos de distinta frecuencia se traslapan (no tiene candado de pago único).
- Un día pendiente puede capturarse aunque el cálculo normal ya lo haya pagado (solo hay aviso).
- El check de empleados faltantes no corre en estatus 4.
- Dos cálculos simultáneos del mismo empleado pueden leer acumulados de exención desactualizados.

### D3 · BAJA · Rango de días pendientes sin tope

- **Dónde:** `dias-pendientes/actions.ts:243-253` (`OPTION (MAXRECURSION 0)`), `pendingDaysSchemas.ts:37-54`.
- **Qué pasa:** el rango solo está acotado por `fecha_ingreso` y `fecha_fin`; para un empleado antiguo, una captura puede insertar miles de filas de una vez.
- **Corrección:** tope de días por captura en el schema (p. ej. 31).

### D4 · BAJA · Sin pruebas automatizadas sobre un cálculo de ~600 líneas de SQL

- **Dónde:** `procesar/actions.ts:1466-2043`; `CLAUDE.md` ("No test suite is configured").
- **Qué pasa:** el cálculo encadena salario, comisiones, horas extra, faltas, retardos, bonos, vacaciones, exenciones, ISR e IMSS en un solo batch, con espejos en TypeScript que pueden divergir. La única verificación es comparar snapshots a mano.
- **Corrección:** pruebas unitarias sobre los espejos puros de `lib/payroll/*` y una prueba de regresión que compare el snapshot de un periodo de la sucursal Demo antes y después de cada cambio.

---

## Grupo E — Infraestructura

### E1 · MEDIA · Conexión a SQL Server sin cifrado

- **Dónde:** `database/connection.ts:24-31` (`encrypt: false`, `minVersion: 'TLSv1'`, `trustServerCertificate: true`).
- **Qué pasa:** RFC, CURP, NSS, salarios, cuentas bancarias y las llaves cifradas de Facturapi viajan en claro entre la app y la base si no están en el mismo host o en una red privada.
- **Corrección:** `encrypt: true`, TLS 1.2 mínimo y validar el certificado del servidor. Confirmar primero la topología real de despliegue.

### E2 · BAJA · Acciones con parámetros primitivos sin validar

- **Dónde:** `getTaxParametersPage(year)` (`parametros-fiscales/actions.ts:34`), `getPayrollPeriodStatusLog(idPeriod)` (`procesar/actions.ts:2336`).
- **Qué pasa:** reciben el argumento sin `zod`. Van parametrizados, así que no hay inyección; un valor no numérico solo produce un error de SQL atrapado.
- **Corrección:** validarlos como el resto, por consistencia.

---

## Lo que está bien

- Todo el SQL revisado usa `queryParams` con parámetros; los únicos `db.query` del módulo ejecutan SQL constante. Las interpolaciones dentro de SQL son constantes del servidor o uniones cerradas de TypeScript, nunca texto del usuario. No se encontró inyección SQL.
- Todas las server actions del módulo empiezan con `assertPayrollAccess()` y validan su entrada con `zod`.
- Las escrituras re-verifican sucursal y estatus del periodo dentro de la transacción con `UPDLOCK, HOLDLOCK`.
- Las descargas y la cancelación de CFDI validan el tenant por `RH.empleados.id_empresa`; `getOrgClient` nunca recibe el modo desde el cliente.
- Cookies `httpOnly`, `sameSite: strict` y `secure` en producción; login con rate limiting.
- `lib/payroll/access.ts` y los repositorios son `server-only`.

## Lo que no cubrió esta auditoría

- El cuerpo del batch de cálculo (`procesar/actions.ts:1570-2040`), `calculateExtraordinaryPayrollPeriod` y `calculatePtuPaymentPeriod` no se revisaron línea por línea en busca de errores aritméticos o fiscales; solo su control de acceso y su manejo de recibos.
- Las lecturas de Bonos y Retardos, y la mayor parte de `ptu/actions.ts`, se revisaron por muestreo (control de acceso y filtros de empresa), no completas.
- Componentes de UI: solo se buscaron `dangerouslySetInnerHTML` (ninguno) y `href` con datos del usuario (C2).
- No se revisaron dependencias (`npm audit`), variables de entorno, configuración del servidor ni permisos del usuario de base de datos.
- Corrección fiscal de las reglas (ISR, IMSS, PTU, exenciones): fuera de alcance; requiere al contador.
