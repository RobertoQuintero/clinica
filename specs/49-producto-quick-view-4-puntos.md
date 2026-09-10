# 49 — ProductQuickViewButton en recepciones, pedidos, movimientos y solicitudes

## Header

- **Estado:** Aprobado
- **Depende de:** [[43-producto-quick-view-boton]] (reutiliza `ProductQuickViewButton` y `getProductDetail` tal cual, sin modificarlos), [[48-pre-solicitudes-productos-podologo]] (modifica `RequestProductsTable.tsx`, introducida ahí)
- **Modifica base de datos:** No.
- **Fecha:** 2026-09-10
- **Objetivo:** Agregar `ProductQuickViewButton` (con `ProductViewModal`) en los 4 puntos donde aún falta: `ReceptionLineRow.tsx`, `pedidos/[id]/page.tsx`, `StockMovementRow.tsx` y `RequestProductsTable.tsx`.

## Alcance

**Incluye:**

- **`ReceptionLineRow.tsx`** (`app/dashboard/recepciones/[id]/componentes/`): agregar `<ProductQuickViewButton id_product={line.id_product} />` junto a `line.product_name` en la primera celda (mismo patrón visual que las 7 integraciones de spec 43).
- **`pedidos/[id]/page.tsx`** (`app/dashboard/pedidos/[id]/`): agregar `<ProductQuickViewButton id_product={item.id_product} />` junto a `item.product_name` en la celda "Producto" de la tabla "Productos pedidos" (según lo confirmado: junto al nombre, no columna nueva).
- **`StockMovementRow.tsx`** (`app/dashboard/movimientos/componentes/`): agregar `<ProductQuickViewButton id_product={movement.id_product} />` junto a `movement.product_name`.
- **`RequestProductsTable.tsx`** (`app/dashboard/solicitudes/componentes/`): agregar `<ProductQuickViewButton id_product={product.id_product} />` junto a `product.name`, mostrando el modal completo (precio de compra/venta, proveedor, URL de compra) también al rol 2 — revierte conscientemente ese punto de la decisión de spec 48 (documentado en la sección de Decisiones de esta spec).

**No incluye:**

- Cambios a `ProductQuickViewButton.tsx`, `ProductViewModal.tsx` ni a `getProductDetail` (`app/dashboard/productos/actions.ts`) — se reutilizan tal cual, sin nuevas variantes ni props.
- Cambios a `IReceptionLineDetail`, `IPurchaseOrderItem`, `IStockMovementListItem` ni `IRequestProduct` — todos ya exponen `id_product`, no se necesita tocar los `SELECT`s ni las interfaces.
- Ningún cambio a otras pantallas o componentes no listados explícitamente arriba (incluyendo los 7 puntos ya cubiertos por spec 43, que no se tocan).
- Edición del texto/comentarios de spec 48 o del comentario JSDoc en `RequestProductsTable.tsx` que documenta la decisión original — queda como registro histórico; esta spec documenta la reversión de su lado.
- Caché del detalle entre clicks, estados de carga alternativos, o cualquier otro comportamiento del botón/modal — hereda el comportamiento ya definido en spec 43 sin cambios.

## Modelo de datos

No se crean tablas, columnas ni estructuras de datos nuevas. Las cuatro interfaces involucradas (`IReceptionLineDetail`, `IPurchaseOrderItem`, `IStockMovementListItem`, `IRequestProduct`) ya exponen `id_product`, que es lo único que `ProductQuickViewButton` necesita como prop. Se omite esta sección por no aplicar.

## Plan de implementación

1. **`ReceptionLineRow.tsx`**: importar `ProductQuickViewButton` desde `@/app/dashboard/componentes/ProductQuickViewButton` y renderizarlo junto a `line.product_name` en la primera celda.

   *Verificación:* abrir `/dashboard/recepciones/[id]` de una orden con líneas pendientes, click en el ícono junto a un producto abre `ProductViewModal` con sus datos correctos; el stepper de cantidad de esa fila sigue funcionando sin interferencia.

2. **`pedidos/[id]/page.tsx`**: importar `ProductQuickViewButton` y renderizarlo junto a `item.product_name` en la celda "Producto" de la tabla "Productos pedidos".

   *Verificación:* abrir el detalle de una orden de compra, click en el ícono junto a un producto abre el modal con sus datos; el resto de la página (botones de cargar factura/cancelar/recibir, bitácora de recepciones) sigue funcionando igual.

3. **`StockMovementRow.tsx`**: importar `ProductQuickViewButton` y renderizarlo junto a `movement.product_name`.

   *Verificación:* abrir `/dashboard/movimientos`, click en el ícono junto a un producto en cualquier fila del kardex abre el modal con sus datos correctos.

4. **`RequestProductsTable.tsx`**: importar `ProductQuickViewButton` y renderizarlo junto a `product.name`.

   *Verificación:* como rol 2, abrir la pantalla de captura de pre-solicitud, click en el ícono junto a un producto abre el modal completo (incluyendo precio y proveedor); el stepper de cantidad de esa fila sigue funcionando sin interferencia.

5. `npm run build` sin errores de TypeScript.

Cada paso deja el sistema funcional y compilando.

## Criterios de aceptación

- [ ] `ReceptionLineRow.tsx` muestra `ProductQuickViewButton` junto al nombre del producto; al hacer click abre `ProductViewModal` con los datos correctos de ese producto.
- [ ] El stepper de cantidad en `ReceptionLineRow.tsx` sigue funcionando normalmente tras el cambio (no hay interferencia de eventos con el nuevo botón).
- [ ] `pedidos/[id]/page.tsx` muestra `ProductQuickViewButton` junto al nombre de cada producto en la tabla "Productos pedidos"; al hacer click abre el modal con los datos correctos.
- [ ] Las acciones existentes de `pedidos/[id]/page.tsx` (cargar factura, cancelar orden, registrar recepción) siguen funcionando sin cambios tras la integración.
- [ ] `StockMovementRow.tsx` muestra `ProductQuickViewButton` junto al nombre del producto en cada fila del kardex; al hacer click abre el modal con los datos correctos.
- [ ] `RequestProductsTable.tsx` muestra `ProductQuickViewButton` junto al nombre del producto en cada fila; al hacer click abre el modal completo (incluyendo precio de compra/venta, proveedor y URL de compra), visible también para el rol 2.
- [ ] El stepper de cantidad en `RequestProductsTable.tsx` sigue funcionando normalmente tras el cambio.
- [ ] Cerrar el modal en cualquiera de los 4 puntos regresa a la pantalla de origen sin alterar su estado (cantidades capturadas, filtros, formulario, etc. quedan intactos).
- [ ] No se modifica `ProductQuickViewButton.tsx`, `ProductViewModal.tsx` ni `getProductDetail`.
- [ ] Las 4 pantallas se ven correctamente en modo claro y oscuro, consistente con el resto de la app.
- [ ] `npm run build` compila sin errores ni warnings nuevos.

## Decisiones tomadas y descartadas

- **Se completan los 4 puntos de integración faltantes de `ProductQuickViewButton` en vez de crear un componente/patrón nuevo.** Decisión del usuario: el componente y la acción de spec 43 ya cubren exactamente esta necesidad (fetch bajo demanda + modal), reutilizarlos evita duplicar lógica.
- **En `RequestProductsTable.tsx` se muestra el modal completo (precio, proveedor, URL de compra) también al rol 2, revirtiendo ese punto de la decisión de spec 48.** Decisión explícita del usuario en esta spec. Spec 48 documentó deliberadamente ocultarle precio/proveedor/totales al rol 2 en esa tabla; aquí se decide que sí puede verlos a través del quick view. No se edita el texto ni el comentario JSDoc de spec 48 (queda como registro histórico de la decisión en su momento); esta spec deja constancia de la reversión de su lado.
- **En `pedidos/[id]/page.tsx` el ícono va junto al nombre del producto, no en una columna nueva.** Decisión del usuario, consistente con el patrón visual usado en las demás integraciones de spec 43 (siempre junto al nombre), en vez de introducir un layout distinto solo para esta tabla.
- **No se reutiliza el comentario/patrón de "columna de acción reutilizable"** porque no existe tal patrón previo (ver riesgos de spec 43); cada integración sigue insertándose manualmente junto al nombre del producto en su fila.

## Riesgos identificados

- **El rol 2 ahora puede ver precio de compra/venta y proveedor a través del quick view en `RequestProductsTable.tsx`**, aunque la tabla misma sigue sin columnas de precio/proveedor. Es una decisión consciente de esta spec, pero vale la pena que quien revise la spec confirme que es aceptable exponer esos datos por esta vía indirecta (un click), ya que reabre parcialmente una restricción de negocio que spec 48 había cerrado explícitamente.
- **Inconsistencia visual sutil entre las 4 integraciones**, igual que el riesgo ya identificado en spec 43: al insertarse manualmente en 4 tablas con estructuras distintas (fila de tabla estándar en 3 de ellas, tabla inline sin componente `*Row` en `pedidos/[id]/page.tsx`), hay riesgo de que el espaciado/tamaño del ícono no quede idéntico si no se revisa contra el estilo ya usado (`p-2`, `size={18}`, `hover:bg-[#dce9ff]`) en las integraciones previas.
- **Ninguna de las 4 pantallas fue de las 7 originales de spec 43, así que no hay verificación previa de que el ícono no choque con otros elementos interactivos de la fila** (ej. el stepper de cantidad en `ReceptionLineRow.tsx` y `RequestProductsTable.tsx`); se mitiga con la verificación puntual del plan de implementación (pasos 1 y 4).
