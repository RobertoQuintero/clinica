# 15 — Badge de pedido pendiente en Sugeridos para pedir

## Header

- **Estado:** Implementado
- **Depende de:** [[09-pedidos-compra-recepcion]] (`purchase_orders`, `purchase_order_items`, `ISuggestedProduct`, `getSuggestedProducts`)
- **Fecha:** 2026-08-14
- **Objetivo:** Mostrar en `SuggestedProductsTable` un badge "Pedido pendiente" sobre los productos que ya tienen una orden de compra abierta (Pedido/Enviado/Parcial) sin recibirse por completo, para evitar que se vuelva a solicitar el mismo producto.

## Alcance

**Incluye:**

- Extender `getSuggestedProducts(id_sucursal)` en `app/dashboard/pedidos/actions.ts` para calcular, por producto, si existe al menos una línea pendiente (`quantity - quantity_received > 0`) en una orden de compra de esa sucursal con `id_status IN (1, 2, 4)` (Pedido, Enviado, Parcial), y los folios de esas órdenes.
- Agregar a `ISuggestedProduct` (`interfaces/suggested_product.ts`) los campos `has_pending_order: boolean` y `pending_order_folios: string[]`.
- Nuevo componente `PendingOrderBadge.tsx` en `app/dashboard/pedidos/nuevo/componentes/`, con estilo ámbar/naranja distinto de `OrderStatusBadge` y de las categorías, mostrado junto al nombre/código del producto en `SuggestedProductsTable.tsx`.
- El badge lleva `title`/tooltip nativo con los folios de las órdenes abiertas (ej. `PO-2026-0004, PO-2026-0007`).
- El badge aparece igual en ambas tabs ("Sugeridos para pedir" y "Todos los productos"), ya que ambas usan `SuggestedProductsTable`.
- El badge es puramente informativo: no bloquea seleccionar el producto ni agregarlo de nuevo al carrito.

**No incluye:**

- Cantidad pendiente numérica en el badge (solo folios en el tooltip).
- Navegación/enlace del badge al detalle de la orden.
- Cambios a `/dashboard/pedidos` (historial), `/dashboard/recepciones` ni a la máquina de estados de órdenes — solo lectura adicional.
- Nueva columna dedicada en la tabla — el badge vive junto al nombre del producto.
- Cualquier lógica de bloqueo o advertencia al confirmar un pedido duplicado — el spec 09 no cambia su validación de servidor.

## Modelo de datos

No se crean tablas nuevas. Solo se extiende una interfaz existente.

**`interfaces/suggested_product.ts` — dos campos nuevos en `ISuggestedProduct`:**

```ts
export interface ISuggestedProduct {
  id_product:           number;
  name:                 string;
  id_category:          number | null;
  brand:                string;
  product_code:         string;
  id_unit_measurement:  number | null;
  price:                number;
  id_supplier:          number | null;
  pieces:               number | null;
  split:                boolean;
  current_stock:        number;
  min_stock_effective:  number | null;
  suggested_quantity:   number;
  below_minimum:        boolean;
  has_pending_order:      boolean;   // nuevo
  pending_order_folios:   string[];  // nuevo — folios de órdenes abiertas con línea pendiente de este producto
}
```

`has_pending_order` es `true` cuando existe al menos una fila en `inventory.purchase_order_items` (unida a `inventory.purchase_orders` de la misma sucursal y `id_status IN (1, 2, 4)`) con `quantity - quantity_received > 0` para ese `id_product`. `pending_order_folios` trae el/los `folio` de esas órdenes, para el tooltip del badge.

## Plan de implementación

1. **`interfaces/suggested_product.ts`.** Agregar `has_pending_order: boolean` y `pending_order_folios: string[]` a `ISuggestedProduct`.

2. **`app/dashboard/pedidos/actions.ts` — `getSuggestedProducts(id_sucursal)`.** Extender el `SELECT` existente con un `LEFT JOIN` (o subconsulta correlacionada) contra `inventory.purchase_order_items poi` `JOIN inventory.purchase_orders po ON po.id_purchase_order = poi.id_purchase_order`, filtrando `po.id_sucursal = @id_sucursal`, `po.id_empresa = @id_empresa`, `po.status = 1`, `po.id_status IN (1, 2, 4)` y `poi.quantity > poi.quantity_received`. Agregar de forma agregada (`STRING_AGG(po.folio, ', ')` o equivalente) el/los folios por `id_product`, y derivar `has_pending_order` de si hubo al menos una fila. Mapear ambos campos nuevos en el `data.map(...)` que arma `ISuggestedProduct[]`.

3. **`app/dashboard/pedidos/nuevo/componentes/PendingOrderBadge.tsx`** (nuevo, cliente o server según uso — sin estado ni interactividad, puede ser Server Component). Recibe `folios: string[]`, renderiza un badge ámbar/naranja "Pedido pendiente" con `title={folios.join(", ")}` como tooltip nativo. No se renderiza si `folios` está vacío (el padre ya controla eso con `has_pending_order`).

4. **`SuggestedProductsTable.tsx`.** Debajo del `<p>` de `product_code` (celda de nombre), renderizar `{product.has_pending_order && <PendingOrderBadge folios={product.pending_order_folios} />}`.

5. **Verificación manual:** crear un pedido de un producto por debajo del mínimo → confirmar que en `/dashboard/pedidos/nuevo` ese producto ahora muestra el badge con el folio correcto en el tooltip, en ambas tabs. Recibir la orden por completo (estado `Stock`) → confirmar que el badge desaparece. Recibir parcialmente (estado `Parcial`) → confirmar que el badge sigue apareciendo. Cancelar una orden → confirmar que el badge desaparece.

6. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [ ] `ISuggestedProduct` incluye `has_pending_order` y `pending_order_folios`.
- [ ] `getSuggestedProducts` marca `has_pending_order = true` únicamente cuando existe una línea con `quantity - quantity_received > 0` en una orden de la misma sucursal con estado Pedido, Enviado o Parcial (`id_status IN (1, 2, 4)`).
- [ ] Un producto con órdenes solo en estado Stock o Cancelado no muestra el badge.
- [ ] El badge aparece junto al nombre/código del producto en `SuggestedProductsTable`, en ambas tabs ("Sugeridos para pedir" y "Todos los productos").
- [ ] El tooltip del badge muestra el/los folios de las órdenes abiertas de ese producto.
- [ ] El badge es visual únicamente: no impide seleccionar el producto, editar su cantidad/precio ni agregarlo al carrito.
- [ ] Recibir una orden por completo (pasa a `Stock`) hace que el badge desaparezca del producto en la siguiente carga de la página.
- [ ] Recibir parcialmente una orden (`Parcial`) conserva el badge.
- [ ] Cancelar una orden hace que el badge desaparezca.
- [ ] El badge usa una paleta ámbar/naranja distinguible tanto de los badges de categoría (azul) como de `OrderStatusBadge`, con contraparte `dark:`.
- [ ] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **El criterio de "pendiente" incluye el estado `Pedido` (1), no solo `Enviado`/`Parcial`.** Se descartó exigir que ya tenga factura cargada porque el objetivo es evitar duplicar la *solicitud*, y esa duplicación ya es posible desde el momento en que la orden existe, aunque aún no se haya enviado al proveedor.
- **El badge no muestra cantidad pendiente, solo el indicador y folios en el tooltip.** Se descartó calcular y mostrar la cantidad pendiente convertida a unidades de stock (requeriría aplicar `conversion_factor` por línea) porque el objetivo del badge es una advertencia rápida de "no vuelvas a pedir esto", no un segundo cálculo de inventario dentro de la misma pantalla — esa cifra ya vive en el detalle de la orden.
- **El dato viaja como parte de `ISuggestedProduct`, no como una consulta/mapa aparte.** Se descartó una segunda `server action` con un `Map<id_product, …>` (como `categoryNameById`) porque `getSuggestedProducts` ya se llama una sola vez por carga de página y el join adicional no cambia su forma de uso; evita un segundo round-trip y mantener dos fuentes de verdad sincronizadas en el cliente.
- **Sin enlace ni navegación desde el badge.** Se descartó linkear a `/dashboard/pedidos/[id]` porque un producto puede tener varias órdenes abiertas simultáneas (no hay un único destino obvio) y el tooltip con folios ya resuelve la necesidad de ubicar la orden manualmente desde el historial.
- **No se agrega columna dedicada a la tabla.** La tabla ya tiene scroll horizontal con 9 columnas; agregar una más angostaría el resto. El badge junto al nombre reutiliza un patrón ya usado (código de producto debajo del nombre) sin ensanchar la tabla.
- **Sin cambios al server action `createPurchaseOrders` ni bloqueo de duplicados al confirmar.** Se descartó impedir agregar al carrito un producto con `has_pending_order = true` porque hay casos legítimos de pedir de nuevo (proveedor tarda, se necesita más volumen); el badge informa, no decide por el usuario.

## Riesgos identificados

- **El join adicional se ejecuta en cada carga de `/dashboard/pedidos/nuevo`, sobre todo el catálogo activo de la empresa.** Con pocas órdenes abiertas el costo es marginal, pero si el volumen de `purchase_order_items` crece mucho conviene revisar el plan de ejecución; no hay índice dedicado a `(id_sucursal, id_status)` sobre `purchase_orders` más allá del ya existente en spec 09 (`id_empresa, id_sucursal, id_status, created_at DESC`), que sí lo cubre.
- **El badge se calcula por sucursal, igual que el resto de `getSuggestedProducts`.** Un producto con orden pendiente en otra sucursal de la misma empresa no mostrará el badge al ver la sucursal actual — es coherente con que todo el resto de la pantalla (stock, mínimo, sugerido) también es por sucursal, pero puede sorprender si alguien espera verlo global.
- **`STRING_AGG` requiere SQL Server 2017+.** Si la instancia del proyecto es más antigua, hay que sustituirlo por `FOR XML PATH` u otra técnica de concatenación; conviene confirmarlo antes de implementar.
