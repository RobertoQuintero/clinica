# 104 — Integridad del timbrado y la cancelación de CFDI de nómina

**Estado:** Implementado  
**Fecha:** 24 de noviembre de 2026  
**Depende de:** 96 (reapertura de periodos pagados), 98 (timbrado de CFDI de nómina) y 99 (cancelación de CFDI de nómina).

**Objetivo:** Resolver B1–B4 evitando que un reintento duplique un CFDI, que la reapertura, el recálculo o la reversión hagan perder el registro de un recibo Live pendiente o vigente, y que una respuesta incierta de cancelación deje un estado local incorrecto.

[Auditoría de nómina, grupo B](../audits/2026-11-16-auditoria-nomina.md#grupo-b--timbrado-y-cancelación-de-cfdi)

## Alcance

### Incluye

- **B1 · Timbrado individual y en lote.** Identificar cada recibo en Facturapi con un `external_id` estable y cada intento con una `idempotency_key`. Si se pierde la respuesta o falla el guardado local, conservar el recibo en `P` (timbrado pendiente) y ofrecer **«Consultar estado»** en Procesar y en el detalle del empleado. Si Facturapi confirma la emisión, recuperar el CFDI y completar el registro local. Solo un rechazo confirmado habilita un nuevo intento con otra clave. La misma regla aplica en Test y Live.
- **B2 y B3 · Protección del periodo.** Bloquear Reabrir, recalcular y revertir mientras el periodo tenga un recibo Live en `P`, `T` (timbrado) o `X` (cancelación en proceso), cualquiera que sea su antigüedad. Mostrar el motivo en la interfaz y comprobar el bloqueo en el servidor dentro de la transacción de cada operación. Conservar los recibos cancelados (`C`) y mantener el comportamiento actual de los recibos Test al reabrir o recalcular.
- **B3 · Confirmación del timbrado.** Si Facturapi confirma la emisión pero la actualización local afecta cero filas, informar que el registro local sigue sin confirmarse y dejar evidencia en `BILLING.audit_log` para rastrear el CFDI.
- **B4 · Cancelación.** Conservar `X` ante un timeout, una respuesta ambigua o un fallo al guardar. **«Consultar estado»** permite pasar de `X` a `C` cuando se confirma la cancelación, o de `X` a `T` ante un rechazo explícito. Dos consultas simultáneas deben conservar el resultado confirmado y registrar la cancelación una sola vez.
- **Recibos Live históricos.** Verificar los `P` y `E` anteriores al cambio cuando se intente reemitir el recibo o realizar una operación que pueda eliminarlo. Si falta un identificador fiable, exigir revisión manual en Facturapi y mantener bloqueada la operación hasta aclarar el resultado.
- **Documentación.** Actualizar la documentación técnica de nómina y facturación, además de las páginas del manual de Nómina afectadas por los cambios en Procesar y en el detalle del empleado.

### Fuera de alcance

B5 y B6, la revisión masiva previa de recibos históricos, las consultas automáticas en segundo plano, los webhooks y los cambios a los motivos de cancelación o al cálculo de importes de nómina.

## Modelo de datos

Agregar dos columnas a `payroll.period_employee_cfdi`. Juntas identifican el recibo ante Facturapi y permiten distinguir un rechazo confirmado de un error histórico cuyo resultado aún se desconoce.

| Columna nueva | Tipo SQL Server | Uso |
|---|---|---|
| `external_id` | `uniqueidentifier NULL` | Identificador estable del recibo. Se genera una vez al reservar la fila y se envía a Facturapi como texto. Un índice único filtrado garantiza su unicidad cuando tiene valor. |
| `intento_timbrado` | `int NULL` | Número del último intento reservado. El primer intento nuevo usa `1`. Solo se incrementa al reservar otro envío después de un rechazo confirmado. |

**Identidad del intento.** La `idempotency_key` se deriva como `nomina-{external_id}-{intento_timbrado}`. La reserva guarda ambos valores antes de llamar a Facturapi. Un timeout conserva la clave, el `org_uid`, el modo y el estado `P`. Al aplicar una respuesta de timbrado se comprueban la fila, el estado y el número de intento para que una respuesta tardía no sobrescriba un resultado posterior. Un nuevo recibo emitido después de una cancelación tiene su propia fila y su propio `external_id`.

**Recibos históricos.** La migración deja ambas columnas en `NULL` en las filas existentes. Para un Live en `P` o `E`, esa combinación indica que hay que aclarar el resultado antes de reintentar o eliminar la fila. Si la revisión identifica el CFDI emitido, se vinculan su `facturapi_id` y su UUID al recibo. Si la revisión confirma que no hubo emisión, la fila pasa a `E` con un `external_id` nuevo e intento `0`. Ese cero significa que la revisión quedó resuelta y que el primer envío con la nueva clave sigue pendiente. Una consulta sin coincidencias, por sí sola, mantiene el bloqueo.

**Restricciones.** Un `CHECK` exige que ambas columnas sean nulas o que ambas tengan valor. Con identidad asignada, el contador debe ser positivo, salvo el `0` reservado para un histórico en `E` con revisión resuelta. Se conserva el índice que limita a una fila vigente por empleado del periodo y modo.

**Cancelación y bitácora.** Se reutilizan `X`, `C`, `T` y las columnas de cancelación existentes. La transición a `C` y su evento `payroll_receipt.cancel` se guardan en la misma transacción. Para la revisión histórica se usa el evento `payroll_receipt.reconcile`, con usuario, recibo, resultado y referencia de la evidencia. Para un timbrado confirmado cuya fila no pudo actualizarse, se usa `payroll_receipt.stamp_conflict`, con recibo, emisor, modo, UUID e ID de Facturapi. Este último evento se escribe fuera de la transacción fallida para que la reversión no borre la evidencia.

## Plan de implementación

1. **Preparar la migración en `queries.txt`.** Agregar `external_id`, `intento_timbrado`, el índice único filtrado y el `CHECK` aprobados. Verificar sobre una base de prueba que las filas existentes conservan su estado y quedan con ambas columnas en `NULL`. Aplicar primero la migración y después desplegar juntos los cambios de aplicación de los pasos 2 a 5.
2. **Proteger la reapertura, el recálculo y la reversión.** En `procesar/actions.ts` y `payrollCfdiRepository.ts`, alinear el indicador de la interfaz con la validación del servidor. Dentro de cada transacción, bloquear la operación si existe un Live en `P`, `T` o `X`. En los cuatro flujos que eliminan filas de cálculo, proteger también los Live históricos en `E` pendientes de revisión. Coordinar la reserva de timbrado y la reapertura sobre el mismo periodo para que dos solicitudes simultáneas no puedan superar ambas validaciones.
3. **Hacer idempotente el timbrado individual y en lote.** Reservar el intento antes de llamar a Facturapi, enviar las claves aprobadas y retirar el reintento basado en diez minutos. Un rechazo explícito permite pasar a `E`. Una respuesta incierta conserva `P` y excluye el recibo de «Timbrar pendientes». Al confirmar la emisión, actualizar únicamente la fila y el intento esperados. Si ya consta el mismo UUID, devolver el resultado guardado. Si falta la fila o hay un resultado incompatible, registrar `payroll_receipt.stamp_conflict` fuera de la transacción revertida.
4. **Incorporar la conciliación en Procesar y en el detalle del empleado.** Conectar **«Consultar estado»** al mismo flujo en ambas vistas. Consultar con el emisor y el modo guardados en el recibo. Si Facturapi confirma la emisión, recuperar sus datos y completar el timbrado local. Si el resultado sigue incierto, mostrar el motivo del bloqueo. Para los Live históricos sin identificador fiable, permitir registrar la revisión manual, su evidencia y su resultado en la misma transacción que actualiza el recibo.
5. **Corregir la cancelación y su consulta.** Conservar `X` ante un timeout o un fallo al guardar. Pasar a `C` solo con cancelación confirmada y volver a `T` solo ante rechazo explícito. Condicionar cada actualización a que la solicitud de cancelación consultada siga vigente. Una respuesta tardía debe respetar tanto una cancelación ya confirmada como una solicitud posterior. Guardar la transición a `C` y `payroll_receipt.cancel` una sola vez.
6. **Actualizar la documentación y verificar B1–B4.** Actualizar `docs/nomina.md`, `docs/facturacion.md` y las páginas afectadas de `content/manual/nomina`, incluida su fecha `updated`. Verificar el contrato de Facturapi con el emisor Test. Usar fallos controlados para simular una respuesta perdida tras la emisión, un fallo SQL y respuestas concurrentes de cancelación. Probar los bloqueos Live con datos locales de prueba, incluidos un `P` antiguo y un `E` histórico. Cerrar con lint y build.

## Criterios de aceptación

- [ ] **B1.** Si se pierde la respuesta tras emitir, el recibo queda en `P` y sale del lote. «Consultar estado» recupera el mismo UUID desde ambas vistas. Solo un rechazo confirmado habilita otro intento con una clave nueva.
- [ ] **B2–B3.** Un Live en `P`, `T` o `X` bloquea reapertura, recálculo y reversión, incluso con solicitudes simultáneas. La antigüedad de `P` no cambia el bloqueo.
- [ ] **B3.** Si falta la fila al guardar un timbrado confirmado, la acción informa el conflicto y la bitácora conserva el UUID.
- [ ] **B4.** Un timeout conserva `X`. Solo un rechazo confirmado devuelve el recibo a `T`. Dos consultas concurrentes de una cancelación confirmada dejan `C` y un único evento de cancelación.
- [ ] **Históricos.** Un Live antiguo en `P` o `E` queda protegido contra reemisión y borrado hasta documentar la revisión. Una búsqueda sin coincidencias mantiene el bloqueo.
- [ ] **Verificación.** Se comprueban el flujo con Facturapi Test y los bloqueos Live con datos locales. Pasan lint y build, y la documentación refleja el flujo aprobado.

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Mantener la clave del intento hasta confirmar su resultado | Reintentar con clave nueva tras diez minutos | Un timeout puede ocurrir después de la emisión. |
| Conciliar desde «Consultar estado» | Consultas en segundo plano | El operador puede resolver el recibo desde las vistas actuales. |
| Bloquear la reapertura con cualquier Live en `P` | Permitirla cuando la reserva envejece | El CFDI puede estar emitido y pendiente de registro local. |
| Revisar los históricos al operar sobre ellos | Revisión masiva previa al despliegue | Cada caso se aclara antes de reemitir o borrar el recibo. |
| Mantener `X` ante una cancelación incierta | Volver a `T` ante cualquier error | Facturapi pudo haber confirmado la cancelación antes del fallo local. |

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Facturapi tarda en mostrar un CFDI emitido. | Conservar `P` y permitir otra consulta. Una búsqueda vacía no habilita el reintento. |
| Un recibo histórico carece de datos suficientes para identificarlo. | Mantener bloqueados la reemisión y el borrado hasta documentar evidencia concluyente. |
| Una caída de SQL Server impide guardar tanto el timbrado como el evento de conflicto. | Recuperar el resultado con el identificador reservado antes del envío y registrar la conciliación al restablecerse la base. |
