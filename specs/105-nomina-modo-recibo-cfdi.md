# SPEC 105 — Modo del recibo en descargas de CFDI de nómina

> **Estado:** Implementado
> **Depende de:** SPEC 98, SPEC 99 y SPEC 104.
> **Modifica base de datos:** No.
> **Fecha:** 2026-11-27
> **Objetivo:** Consultar y descargar los CFDI de nómina con la clave Test o Live correspondiente al modo guardado en cada recibo.

## Alcance

**Entra:**

- Usar el modo `livemode` guardado en el recibo para descargar su XML, PDF y acuse de cancelación.
- Verificar que la cancelación y la consulta de estado sigan usando el modo guardado en el recibo.
- Mantener el modo actual del emisor para crear CFDI nuevos.
- Si falta la clave correspondiente al modo del recibo, rechazar la descarga e indicar qué clave falta, sin usar la clave del otro modo.
- Agregar pruebas para recibos Test y Live cuando el modo actual de la organización sea distinto, y para la ausencia de la clave requerida.
- Registrar en la auditoría la corrección de B5 y la evidencia de verificación.

**No entra:**

- Cambiar las operaciones sobre documentos de otros módulos de Facturación.
- Crear, recuperar o modificar claves de Facturapi.
- Cambiar el esquema de la base de datos.
- Atender B6 u otros hallazgos de la auditoría.

## Modelo de datos

Esta spec no introduce tablas ni columnas. Reutiliza los datos guardados en `payroll.period_employee_cfdi`:

- `org_uid`: identifica el emisor del recibo.
- `livemode`: determina si se utiliza la clave Live (`true`) o Test (`false`) de ese emisor.
- `facturapi_id`: identifica el CFDI que se descargará o consultará.

El servidor obtiene estos datos del recibo autorizado; el navegador no elige el modo.

## Plan de implementación

1. **Corregir las descargas.** Actualizar las rutas de XML, PDF y acuse en `app/api/nomina/cfdi/[id]/` para obtener el cliente de Facturapi con `getOrgClientForStoredMode`, usando el emisor y el modo guardados en el recibo. Conservar las validaciones de acceso y empresa existentes.
2. **Comprobar los errores de configuración.** Cuando falte la clave requerida, devolver un error que indique si falta la clave Test o Live. No intentar la operación con la clave del otro modo.
3. **Agregar pruebas de regresión.** Cubrir las tres descargas con recibos cuyo modo difiera del modo actual de la organización, en ambas direcciones. Comprobar también la ausencia de la clave requerida y que cancelación y consulta de estado usan el modo guardado.
4. **Actualizar la documentación.** Registrar en `audits/2026-11-16-auditoria-nomina.md` la atención de B5 y la evidencia obtenida. Actualizar `docs/nomina.md` y `docs/facturacion.md` cuando corresponda, indicando cualquier verificación real pendiente.

## Criterios de aceptación

- [ ] XML, PDF y acuse usan el modo guardado en el recibo, aunque difiera del modo actual del emisor.
- [ ] Si falta la clave correspondiente, se indica cuál falta y no se usa la del otro modo.
- [ ] Cancelación y consulta de estado conservan el uso del modo guardado.
- [ ] El timbrado nuevo conserva el modo actual del emisor.
- [x] Pasan las pruebas de regresión y la auditoría registra la evidencia.

## Decisiones tomadas y descartadas

- **Sí:** usar la clave del modo guardado para recibos existentes; permite operar tras un cambio de modo.
- **No:** usar la clave del modo actual o la del modo alternativo; puede consultar el entorno equivocado.
- **Sí:** conservar el modo actual del emisor para timbrados nuevos.
- **No:** extender el cambio a otros documentos de Facturación; quedan fuera de B5.

## Riesgos identificados

- **Clave histórica ausente:** la descarga falla e indica qué clave falta hasta que vuelva a estar disponible.
- **Sin recibos de ambos modos para pruebas reales:** se documentará la limitación y se cubrirán los casos mediante pruebas automatizadas.

## Qué no incluye esta spec

Operaciones de otros módulos de Facturación, gestión de claves, cambios de esquema y otros hallazgos de la auditoría.
