# 66 — Costo total de consulta finalizada se actualiza al editar

## Header

- **Estado:** Implementado
- **Depende de:**
  - [17 — Productos de consulta descuentan stock](17-productos-consulta-descuentan-stock.md): es el flujo de agregar, editar y quitar productos de una consulta (`addConsultaProducto`, `updateConsultaProducto`, `deleteConsultaProducto`).
- **Modifica base de datos:** No. Solo se actualiza el valor de `consultas.costo_total`, que ya existe.
- **Fecha:** 2026-10-05
- **Objetivo:** Que la columna "Costo total" de `ConsultaFila` muestre el monto vigente cuando un admin (`id_role` 1 o 4) modifica los servicios o productos de una consulta ya finalizada.

## Alcance

**Incluye:**

- Un helper de servidor en `app/dashboard/pacientes/[id]/consultas/[id_consulta]/actions.ts` que recalcula `consultas.costo_total` desde la BD como:
  - la suma de `consulta_servicios.precio_aplicado` de la consulta,
  - más la suma de `precio × cantidad` de los `consulta_productos` de la consulta con `status = 1` (activos).
- El helper solo escribe cuando se cumplen las dos condiciones siguientes. Si no, no cambia nada:
  - la consulta está finalizada (`fecha_fin IS NOT NULL`);
  - ningún pago activo de la consulta está facturado (`pagos.status = 1 AND pagos.facturado = 1`).
- Llamar al helper dentro de la transacción de cada acción que modifica servicios o productos: `selectServicioOpcion`, `addConsultaProducto`, `updateConsultaProducto` y `deleteConsultaProducto`.
- Envolver `selectServicioOpcion` en `db.transaction`, porque hoy hace un `DELETE` y un `INSERT` sueltos. Las otras tres acciones ya usan transacción.
- Antes de finalizar, `costo_total` sigue guardándose al registrar el pago, como hoy.
- Corregir `TabProductos` y `TabGeneral` para que su total excluya los productos inactivos y coincida con el guardado.
- Un aviso en `app/dashboard/pacientes/[id]/consultas/[id_consulta]/page.tsx`, visible cuando la consulta está finalizada y tiene un pago activo facturado: "Esta consulta tiene un pago facturado. El costo total no se actualiza al modificar servicios o productos." Se calcula con los `pagos` que la página ya carga, sin consulta nueva.
- La columna "Costo total" de `ConsultaFila` muestra el valor actualizado la próxima vez que se carga el expediente. No requiere cambios en su código, porque ya lee `costo_total`.

**No incluye (para otros specs):**

- Un monto de "total a pagar" editable a mano, por ejemplo un descuento.
- Crear, ajustar o eliminar pagos cuando cambia el total. El saldo puede quedar distinto de cero y eso no se corrige aquí.
- Re-emitir o corregir CFDI cuando el total de una consulta facturada debería cambiar.
- Actualizar `ConsultaFila` al instante si el expediente está abierto en otra pantalla.
- Cambiar quién puede editar una consulta finalizada. `locked` y los roles 1 y 4 quedan como están.
- Cambiar el guardado de `costo_total` en `handlePagoSubmit` para consultas no finalizadas.
- Recalcular consultas finalizadas históricas cuyo `costo_total` ya esté desfasado.

## Modelo de datos

Esta spec no introduce tablas ni columnas nuevas. Reutiliza las existentes de `[CentroPodologico].[dbo]`:

- `consultas.costo_total`: el valor que se recalcula. `consultas.fecha_fin` indica que la consulta está finalizada.
- `consulta_servicios.precio_aplicado`: un servicio por fila, ligado a la consulta por `id_consulta`.
- `consulta_productos.precio`, `.cantidad` y `.status`: `status = 1` es activo. Solo los activos suman.
- `pagos.status` y `pagos.facturado`: un pago activo y facturado bloquea el recálculo.

Fórmula del recálculo:

    costo_total = SUM(consulta_servicios.precio_aplicado)
                + SUM(consulta_productos.precio * consulta_productos.cantidad)  -- solo status = 1

Convenciones:

- Si la consulta no tiene servicios o productos, esa parte de la suma es 0 (`ISNULL(SUM(...), 0)`).
- El helper tiene la firma `recalculateFinalizedConsultaTotal(transaction, id_consulta)` y se llama dentro de la transacción de cada acción. No devuelve datos.
- El `UPDATE` lleva `AND [fecha_fin] IS NOT NULL` y `AND NOT EXISTS (SELECT 1 FROM [pagos] WHERE [id_consulta] = @id_consulta AND [status] = 1 AND [facturado] = 1)`. Si alguna no se cumple, no cambia nada.
- No intervienen fechas: no hace falta `toDBString` ni `CONVERT`.

## Plan de implementación

1. **Helper de recálculo.** En `app/dashboard/pacientes/[id]/consultas/[id_consulta]/actions.ts`, agregar la función `recalculateFinalizedConsultaTotal(transaction, id_consulta)`, sin exportar (el archivo es `"use server"`). Hace un solo `UPDATE consultas SET costo_total = (suma de servicios + suma de productos activos) WHERE id_consulta = @id_consulta AND fecha_fin IS NOT NULL AND NOT EXISTS (pago activo facturado)`. Todavía nadie la llama, así que el sistema se comporta igual. Verificación: `tsc` sin errores.
2. **Productos.** Llamar al helper al final de la transacción de `addConsultaProducto`, `updateConsultaProducto` y `deleteConsultaProducto`. Verificación manual: en una consulta finalizada, como admin, agregar, cambiar cantidad, desactivar y eliminar un producto. Después de cada paso, `costo_total` en la BD coincide con la fórmula.
3. **Servicios.** Envolver `selectServicioOpcion` en `db.transaction` y llamar al helper antes de cerrarla.
   - La validación de que la opción pertenece a la sucursal pasa antes del `DELETE`, para que un error no borre la selección anterior.
   - Un error dentro de la transacción revierte todo y devuelve `{ ok: false, data: ... }`, como hoy.
   - Verificación manual: en una consulta finalizada, cambiar y quitar un servicio actualiza `costo_total`.
4. **Total en pantalla.** En `TabProductos.tsx` y `TabGeneral.tsx`, excluir de la suma los productos con `status !== "activo"`. Verificación manual: desactivar un producto baja el "Total" del encabezado en la misma cantidad en que baja `costo_total` en la BD.
5. **Aviso de pago facturado.** En `page.tsx`, mostrar el aviso cuando la consulta está finalizada y algún pago activo está facturado. Verificación manual: con un pago facturado el aviso aparece; sin pago facturado, no.
6. **Prueba de extremo a extremo.** Cambiar servicios y productos de una consulta finalizada y abrir `/dashboard/pacientes/[id]/expediente`. Confirmar que la columna "Costo total" muestra el monto nuevo, y que una consulta no finalizada conserva su comportamiento anterior.

## Criterios de aceptación

- [x] `tsc` y el lint del proyecto pasan sin errores nuevos.
- [x] En una consulta finalizada, como rol 1 o 4, agregar un producto sube `consultas.costo_total` en `precio × cantidad`.
- [x] En una consulta finalizada, cambiar la cantidad o el precio de un producto activo deja `costo_total` igual a la fórmula.
- [x] En una consulta finalizada, pasar un producto a inactivo baja `costo_total` en su `precio × cantidad`, y volver a activarlo lo sube.
- [x] En una consulta finalizada, eliminar un producto baja `costo_total` en su `precio × cantidad`.
- [x] En una consulta finalizada, cambiar la opción de un servicio deja `costo_total` con el `precio_aplicado` nuevo.
- [x] En una consulta finalizada, quitar un servicio (opción 0) baja `costo_total` en su `precio_aplicado`.
- [x] Si `selectServicioOpcion` recibe una opción de otra sucursal, devuelve `ok: false` y la selección anterior del servicio se conserva.
- [x] Si falla el recálculo, la modificación del servicio o producto se revierte, incluido el movimiento de stock en las acciones de productos.
- [x] En una consulta no finalizada (`fecha_fin` nulo), modificar servicios o productos no cambia `costo_total`.
- [x] En una consulta finalizada con al menos un pago activo facturado, modificar servicios o productos no cambia `costo_total`.
- [x] Si el único pago facturado de la consulta está eliminado (`status = 0`), modificar servicios o productos sí actualiza `costo_total`.
- [x] El aviso de pago facturado aparece solo en consultas finalizadas con un pago activo facturado.
- [x] Al abrir `/dashboard/pacientes/[id]/expediente` después de una modificación, la columna "Costo total" de `ConsultaFila` muestra el valor de `costo_total` en la BD.
- [x] El "Total" del encabezado de la consulta no incluye productos inactivos, y coincide con `costo_total` tras recargar (salvo en consultas con pago facturado).
- [x] Los pagos de la consulta no cambian (misma cantidad de filas y mismos montos) después de modificar servicios o productos.
- [x] Un usuario con rol distinto de 1 o 4 sigue sin poder editar servicios ni productos de una consulta finalizada desde la interfaz.

## Decisiones

- **Sí:** el servidor recalcula `costo_total` desde la BD. El valor no depende de que la pestaña de la consulta siga abierta ni de lo que calcule el cliente.
- **No:** llamar a `updateConsultaCosto` desde el cliente después de cada cambio. Repite el patrón actual y puede dejar un valor desfasado si la pestaña se cierra.
- **Sí:** el recálculo corre dentro de la misma transacción que la modificación. Así no queda un total que no corresponda a los servicios o productos guardados.
- **Sí:** envolver `selectServicioOpcion` en `db.transaction`. Hoy hace un `DELETE` y un `INSERT` sueltos, y un fallo entre ambos dejaba la consulta sin servicio.
- **Sí:** el criterio es que la consulta esté finalizada (`fecha_fin IS NOT NULL`), no el rol de quien edita. Hoy solo los roles 1 y 4 pueden editar una consulta finalizada desde la interfaz, así que no se duplica la validación de roles en cuatro acciones.
- **No:** validar el rol en el servidor dentro de estas acciones. Es una protección que hoy no existe en ningún lado y es otro spec.
- **Sí:** "total a pagar" es la suma de servicios y productos activos.
- **No:** un monto de "total a pagar" editable a mano, como un descuento. Cambia el modelo de datos y el cálculo del saldo, y va en otro spec.
- **Sí:** los productos inactivos no suman. Un producto inactivo ya devolvió su stock, así que no corresponde cobrarlo.
- **Sí:** corregir `TabProductos` y `TabGeneral` para que excluyan los inactivos. Sin eso, el total de pantalla y el guardado difieren.
- **No:** crear, ajustar o eliminar pagos cuando cambia el total. El saldo puede quedar distinto de cero, y corregirlo es decisión de quien administra la consulta.
- **Sí:** no recalcular si la consulta tiene un pago activo facturado, para no desalinear `costo_total` del CFDI ya emitido y de `listBillableOperations`.
- **No:** recalcular siempre y dejar el desajuste a quien factura. Es lo más literal, pero rompe el criterio "pagado >= costo_total" de facturación sin avisar.
- **Sí:** no excluir las consultas con `is_onicomicosis = 1`. `handlePagoSubmit` ya sobrescribe su `costo_total` con servicios más productos, así que se mantiene una sola regla.
- **Sí:** `ConsultaFila` se actualiza al recargar el expediente. Ya lee `costo_total`, así que no necesita cambios.
- **No:** actualizar `ConsultaFila` al instante entre pantallas. Exige estado compartido y es otro spec.
- **No:** recalcular consultas finalizadas históricas con `costo_total` desfasado. Si hace falta, es un script puntual aparte.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| **Facturación.** `lib/billing/billableOperations.ts` considera facturable una consulta cuando `pagado >= costo_total` y usa `costo_total` como total esperado. Un cambio de total en una consulta facturada desalinearía el CFDI emitido. | El helper no recalcula con pagos activos facturados y la pantalla lo avisa. |
| El admin ve el total del encabezado distinto de `costo_total` en una consulta con pago facturado, porque la pantalla suma lo que hay y la BD conserva el valor anterior. | El aviso lo explica. Alinear ambos valores requiere re-facturar y queda fuera de alcance. |
| El primer cambio en una consulta finalizada "salta" el total si el guardado anterior incluía productos inactivos (la pantalla los sumaba). | Es el efecto buscado de la corrección del paso 4. Las consultas que nadie edita conservan su valor. |
| Dos admins editan a la vez la misma consulta. | El recálculo lee de la BD dentro de la transacción, así que el último en guardar deja el total correcto. No hace falta bloqueo adicional. |
| El `DELETE` de `selectServicioOpcion` ya no se ejecuta si falla la validación de sucursal. | Es el comportamiento correcto y se cubre con un criterio de aceptación. |

## Lo que **no** incluye este spec

- Un monto de "total a pagar" editable a mano, como un descuento.
- Crear, ajustar o eliminar pagos cuando cambia el total.
- Re-emitir o corregir CFDI de consultas facturadas.
- Actualizar `ConsultaFila` al instante entre pantallas; solo se ve al recargar el expediente.
- Validar el rol en el servidor dentro de las acciones de servicios y productos.
- Cambiar quién puede editar una consulta finalizada.
- Cambiar el guardado de `costo_total` en `handlePagoSubmit` para consultas no finalizadas.
- Recalcular consultas finalizadas históricas cuyo `costo_total` ya esté desfasado.

Cada uno de esos puntos, si se hace, va en su propio spec.
