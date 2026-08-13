# 09 — Pedidos de compra y recepción de mercancía

## Header

- **Estado:** Aprobado
- **Depende de:** [[07-proveedores-crud]] (`getSuppliers`), [[08-productos-inventario-crud]] (`inventory.Products`, `IProduct`, `min_stock`, `split`, `pieces`)
- **Fecha:** 2026-08-12
- **Objetivo:** Implementar el ciclo **solicitud de productos → orden de compra → recepción → entrada a stock** del sistema de inventario multisucursal descrito en `references/docs/Inventario.md`, con las pantallas de `references/orders/`, sobre un modelo de datos que soporte a futuro el resto del alcance (salidas por consulta/venta, traspasos, ajustes, kardex y reportes) sin rediseñarse.

## Contexto y decisiones de negocio ya cerradas

Tres reglas se confirmaron con el dueño del producto antes de escribir este plan y condicionan todo el diseño:

1. **Carrito multiproveedor.** Se seleccionan productos libremente; cada línea hereda el proveedor del producto (editable en la revisión). Al confirmar se genera **una orden de compra por proveedor**, todas agrupadas bajo un mismo `id_batch`. Esto resuelve la contradicción entre `pedidos_de_inventario.html` (un select de proveedor) y `revision_de_orden.html` (grupos por proveedor): el select de proveedor de la primera pantalla pasa a ser **filtro** de la tabla, no el proveedor de la orden.
2. **Factura obligatoria antes de recibir.** Flujo estricto `Pedido → Enviado (factura PDF cargada) → Recepción → Stock`. No se puede capturar recepción de una orden en estado `Pedido`.
3. **El rol 5 (podóloga) no accede a ninguna pantalla de inventario.** Aunque `Inventario.md` la nombra como quien pide y quien confirma la llegada, esos pasos los registra administración/suministros dentro del sistema. `proxy.ts` **no se modifica** para el rol 5.

## Alcance

**Incluye:**

- **Modelo de existencias completo**: nuevas tablas `inventory.stock` (existencia actual por producto+sucursal) e `inventory.kardex` (libro mayor append-only de movimientos), más `inventory.purchase_orders`, `inventory.purchase_order_items` e `inventory.purchase_receptions`.
- **Soporte de transacciones** en `database/connection.ts` (`db.transaction`), hoy inexistente y obligatorio para que recepción → kardex → stock sea atómico.
- **Helper reutilizable `lib/inventory/stock.ts`** (`applyStockMovement`) que aplica cualquier movimiento de inventario y devuelve el acumulado, para que las futuras salidas por consulta/venta/traspaso/ajuste no vuelvan a implementar esta lógica.
- **Pantalla de armado de pedido** (`/dashboard/pedidos/nuevo`, desde `pedidos_de_inventario.html`): KPIs, tabs "Sugeridos para pedir" / "Todos los productos", filtros de texto/categoría/proveedor, selección con checkbox, cantidad y precio unitario editables por línea, sidebar con fecha estimada, notas y resumen.
- **Pantalla de revisión** (`/dashboard/pedidos/nuevo/revision`, desde `revision_de_orden.html`): líneas agrupadas por proveedor, stepper de cantidad, resumen consolidado y botón "Generar Orden de Compra" que crea N órdenes (una por proveedor).
- **Historial y detalle de órdenes** (`/dashboard/pedidos`, `/dashboard/pedidos/[id]`): lista filtrable por estado/proveedor/sucursal, detalle con líneas y bitácora de recepciones.
- **Paso "Enviado"**: modal para cargar la factura (PDF) vía el endpoint existente `app/api/upload`, que registra `invoice_url`/`invoice_number`/`invoice_date` y mueve la orden a estado `Enviado`.
- **Lista de recepciones pendientes** (`/dashboard/recepciones`) — pantalla adicional autorizada explícitamente por `Inventario.md`, ya que el mockup solo cubre el detalle.
- **Pantalla de recepción** (`/dashboard/recepciones/[id]`, desde `recepcion_de_compras.html`): cantidad pedida vs. recibida por línea, estado por línea (Completo/Parcial/Pendiente), diferencia, notas y confirmación que **genera los movimientos de kardex (EXC) y actualiza `inventory.stock`**.
- **Recepciones parciales acumulativas**: una orden puede recibirse en varios eventos; el estado de la orden se recalcula (`Enviado → Parcial → Stock`).
- **Conversión de unidades de compra a unidades de stock** basada en `split`/`pieces`, con el factor congelado en la línea de la orden (ver "Mejora de la lógica de `split`").
- **Restricción de `min_stock` a administradores** (roles 1 y 4) en el formulario de productos, según la nota de `Inventario.md` ("El Stock Mínimo solo lo puede ajustar el administrador").
- Nuevos ítems "Pedidos" y "Recepciones" bajo el grupo "Inventario" de `navConfig.tsx`, conservando `excludeRoles: [5]`.

**No incluye:**

- `order_templates` (plantillas de pedido): la tab "Plantillas de pedido" se renderiza **deshabilitada**; el modelo se deja preparado pero sin tabla ni lógica.
- Salidas de inventario de cualquier tipo: consulta (`SXC`), venta (`SXV`), traspasos (`EXT`/`SXT`), devoluciones (`SXD`), ajustes (`EXA`/`SXA`) y merma. El catálogo `inventory.movements` ya las contempla y `applyStockMovement` las soportará, pero **no se construye UI ni disparadores para ellas en este spec**.
- Descuento automático de producto por consulta iniciada (`Inventario.md` lo marca explícitamente como diferido).
- Servicio de afilado de instrumental y sus alertas de mantenimiento periódico.
- Kardex como pantalla consultable, reportes y "productos por agotarse" como vistas propias (los datos quedan registrados; su visualización es otro spec).
- Cancelación/devolución de órdenes ya recibidas (sí se incluye cancelar una orden **no recibida**).
- Lista de precios por proveedor (`supplier_products`): la línea de la orden ya guarda el precio histórico; la lista de precios negociados queda diferida.
- Migración de `dbo.productos` (Ventas) al catálogo de inventario — sigue como deuda abierta del spec 08.

## Modelo de datos

Todo lo nuevo vive en el esquema `inventory`. **Desviación deliberada del patrón del repo:** las tablas nuevas usan `IDENTITY` en vez del patrón `MAX(id)+1` usado en `Products`/`proveedores`, porque bajo concurrencia real (dos usuarios generando pedidos a la vez) `MAX+1` produce colisiones de PK. Al ser tablas nuevas no hay compatibilidad que romper.

### `inventory.stock` — existencia actual (snapshot)

| Columna | Tipo | Notas |
|---|---|---|
| `id_stock` | `int IDENTITY` | PK. |
| `id_product` | `int` NOT NULL | FK lógica a `inventory.Products`. |
| `id_sucursal` | `int` NOT NULL | La existencia **siempre** es por sucursal. |
| `quantity` | `decimal(18,4)` NOT NULL DEFAULT 0 | En **unidades de stock** (ver conversión). |
| `min_stock` | `decimal(18,2)` NULL | Override por sucursal; si es `NULL` se usa `Products.min_stock`. |
| `updated_at` | `datetime` NULL | |

Único sobre (`id_product`, `id_sucursal`). Es un derivado cacheado del kardex, no la fuente de verdad — se puede reconstruir con un `SUM` sobre `inventory.kardex`.

### `inventory.kardex` — libro mayor de movimientos (append-only)

| Columna | Tipo | Notas |
|---|---|---|
| `id_kardex` | `bigint IDENTITY` | PK. |
| `id_product` | `int` NOT NULL | |
| `id_sucursal` | `int` NOT NULL | |
| `id_empresa` | `int` NOT NULL | |
| `id_movement` | `smallint` NOT NULL | FK lógica a `inventory.movements`; su `increases_storage` define el signo. |
| `quantity` | `decimal(18,4)` NOT NULL | **Siempre positiva**, en unidades de stock. El signo lo aporta el movimiento. |
| `balance_after` | `decimal(18,4)` NOT NULL | El `acumulado` de `Inventario.md`, tras aplicar el movimiento. |
| `id_unit_measurement` | `smallint` NULL | Unidad de stock (snapshot). |
| `unit_cost` | `decimal(18,6)` NULL | Costo unitario de la entrada, para costeo futuro. |
| `id_purchase_order_item` | `int` NULL | Origen, cuando el movimiento viene de una compra. |
| `id_reception` | `int` NULL | Agrupa las filas generadas por un mismo evento de recepción. |
| `notes` | `varchar(500)` NULL | |
| `id_user` | `int` NOT NULL | Quien guardó el registro. |
| `created_at` | `datetime` NOT NULL | |

Índices: `(id_product, id_sucursal, id_kardex DESC)` para el kardex por producto y `(id_reception)` para el detalle de una recepción.

**Nunca se hace UPDATE ni DELETE sobre esta tabla.** Un error se corrige con un movimiento de ajuste en sentido contrario.

### `inventory.purchase_orders` — órdenes de compra

| Columna | Tipo | Notas |
|---|---|---|
| `id_purchase_order` | `int IDENTITY` | PK. |
| `folio` | `varchar(20)` NOT NULL | `PO-{AAAA}-{consecutivo}`, único por empresa. |
| `id_batch` | `varchar(36)` NULL | Agrupa las órdenes generadas desde un mismo carrito. |
| `id_empresa`, `id_sucursal`, `id_supplier` | `int` NOT NULL | |
| `id_status` | `smallint` NOT NULL | FK lógica a `inventory.order_statuses`. |
| `subtotal`, `discount`, `tax`, `shipping_cost`, `total` | `decimal(18,2)` NOT NULL DEFAULT 0 | **Calculados en el servidor**, nunca tomados del cliente. |
| `tax_rate` | `decimal(5,2)` NOT NULL DEFAULT 16 | Tasa de IVA aplicada, guardada para que un cambio de tasa no reescriba la historia. |
| `estimated_date`, `delivery_date`, `invoice_date` | `date` NULL | Se leen con `CONVERT(varchar(10), …, 120)`. |
| `invoice_url` | `varchar(1000)` NULL | URL de Cloudinary del PDF de factura. |
| `invoice_number` | `varchar(50)` NULL | |
| `notes` | `varchar(1000)` NULL | Notas del pedido. |
| `id_user_created` | `int` NOT NULL | |
| `created_at` | `datetime` NOT NULL | |
| `sent_at`, `closed_at` | `datetime` NULL | Marcas de tiempo de los saltos de estado. |
| `status` | `bit` NOT NULL DEFAULT 1 | Soft-delete, igual que el resto del sistema. |

Índice de listado: `(id_empresa, id_sucursal, id_status, created_at DESC)`.

### `inventory.purchase_order_items` — líneas de la orden

| Columna | Tipo | Notas |
|---|---|---|
| `id_purchase_order_item` | `int IDENTITY` | PK. |
| `id_purchase_order` | `int` NOT NULL | FK **real** al encabezado (relación padre/hijo). |
| `id_product` | `int` NOT NULL | |
| `product_name`, `product_code`, `brand` | `varchar` NULL | **Snapshots** al momento del pedido, para que la orden histórica siga leyéndose igual si el catálogo cambia. |
| `id_unit_measurement` | `smallint` NULL | Unidad de **compra** (snapshot). |
| `conversion_factor` | `decimal(18,4)` NOT NULL DEFAULT 1 | Unidades de stock por unidad de compra (snapshot). |
| `quantity` | `decimal(18,4)` NOT NULL | Cantidad pedida, en unidades de compra. |
| `quantity_received` | `decimal(18,4)` NOT NULL DEFAULT 0 | Acumulado recibido, en unidades de compra. |
| `unit_price` | `decimal(18,6)` NOT NULL | Editable en el pedido (requisito explícito de `Inventario.md`). |
| `discount` | `decimal(18,2)` NOT NULL DEFAULT 0 | Descuento por línea; columna presente, sin UI en esta fase. |
| `line_total` | `decimal(18,2)` NOT NULL | `quantity * unit_price - discount`, calculado en servidor. |
| `created_at` | `datetime` NOT NULL | |

### `inventory.purchase_receptions` — eventos de recepción

| Columna | Tipo | Notas |
|---|---|---|
| `id_reception` | `int IDENTITY` | PK. |
| `id_purchase_order` | `int` NOT NULL | FK real. |
| `id_sucursal` | `int` NOT NULL | Sucursal donde entra la mercancía. |
| `id_user` | `int` NOT NULL | Quien confirmó la recepción. |
| `notes` | `varchar(1000)` NULL | "Notas de recepción" del mockup. |
| `is_final` | `bit` NOT NULL DEFAULT 0 | `1` si con esta recepción la orden quedó cerrada. |
| `created_at` | `datetime` NOT NULL | |

**No hay tabla de detalle de recepción**: las filas de `inventory.kardex` con ese `id_reception` *son* el detalle. Una línea recibida en 0 simplemente no genera fila.

### Cambios a tablas existentes

- **`inventory.Products`**: agregar `id_stock_unit_measurement smallint NULL` (unidad en la que se lleva el stock, distinta de la de compra cuando `split = 1`).
- **`inventory.order_statuses`**: sembrar dos filas nuevas — `4 = Parcial` ("Recibido parcialmente, faltan piezas por llegar") y `5 = Cancelado`.

### Mejora de la lógica de `split` (petición explícita de `Inventario.md`)

Hoy `split` es un booleano suelto sin semántica ejecutable. La propuesta lo convierte en una regla de conversión de dos unidades:

| Campo | Significado |
|---|---|
| `id_unit_measurement` | Unidad en la que se **compra** (caja, paquete, frasco). |
| `id_stock_unit_measurement` | Unidad en la que se **lleva el stock y se descuenta** (pieza, mililitro). |
| `pieces` | Piezas por unidad de compra. |
| `split` | `1` = el stock se lleva en la unidad de stock (se fracciona); `0` = el stock se lleva en la unidad de compra. |

Regla única, aplicable en todo el sistema:

```
conversion_factor = split ? (pieces || 1) : 1
cantidad_en_stock = cantidad_en_compra * conversion_factor
```

Ejemplo: 1 caja de cubrebocas (`pieces = 100`, `split = 1`) recibida → `quantity = 1` en la línea de compra, `quantity = 100` en el kardex y en `stock`, y el descuento por consulta (spec futuro) resta `1` sin conversiones extra.

**El factor se congela en `purchase_order_items.conversion_factor`.** Si mañana alguien corrige `pieces` de 100 a 50 en el catálogo, las órdenes ya recibidas conservan el cálculo con el que realmente entraron.

### Nuevas interfaces (`interfaces/`)

- `purchase_order.ts` → `IPurchaseOrder`, `IPurchaseOrderItem`, `IPurchaseOrderDetail` (encabezado + líneas + recepciones).
- `purchase_reception.ts` → `IPurchaseReception`, `IReceptionLineInput`.
- `kardex.ts` → `IKardexEntry`.
- `stock.ts` → `IStockLevel` (`id_product`, `id_sucursal`, `quantity`, `min_stock_effective`).
- `order_status.ts` → `IOrderStatus`; `movement.ts` → `IMovement`.
- `suggested_product.ts` → `ISuggestedProduct` (producto + stock actual + mínimo efectivo + cantidad sugerida + proveedor por defecto).

Todas siguen la convención de fechas del proyecto: los campos de fecha se tipan `string` y se leen ya convertidos desde SQL.

## Máquina de estados

```
                  (subir factura PDF)        (recepción incompleta)
   ┌─────────┐         ┌──────────┐              ┌──────────┐
   │ Pedido  │ ──────► │ Enviado  │ ──────────►  │ Parcial  │ ──┐
   │  (1)    │         │   (2)    │              │   (4)    │ ◄─┘ (más recepciones)
   └────┬────┘         └────┬─────┘              └────┬─────┘
        │                   │  (recepción completa)   │  (se completa)
        │                   └──────────┬──────────────┘
        │                              ▼
        │                        ┌──────────┐
        │                        │  Stock   │
        │                        │   (3)    │
        │                        └──────────┘
        ▼
   ┌───────────┐
   │ Cancelado │   solo desde Pedido o Enviado, sin recepciones registradas
   │    (5)    │
   └───────────┘
```

Reglas que el servidor debe imponer (no solo la UI):

- `Pedido → Enviado` exige `invoice_url` no vacío. Sella `sent_at`.
- Cualquier recepción exige que la orden esté en `Enviado` o `Parcial`. Desde `Pedido` se rechaza con mensaje explícito.
- Tras cada recepción: si **toda** línea cumple `quantity_received >= quantity` → `Stock` (+ `closed_at`, `delivery_date`, `is_final = 1`); si no → `Parcial`.
- No se permite recibir más de lo pedido por línea (`quantity_received + recibido <= quantity`); el excedente se maneja como entrada por ajuste, fuera de este flujo.
- `Cancelado` solo si no existe ninguna fila en `purchase_receptions` para esa orden.

## Plan de implementación

### Fase 0 — Base de datos e infraestructura

1. Escribir el DDL de `inventory.stock`, `inventory.kardex`, `inventory.purchase_orders`, `inventory.purchase_order_items` e `inventory.purchase_receptions`, más `ALTER TABLE inventory.Products ADD id_stock_unit_measurement` y los dos `INSERT` de `order_statuses` (4 Parcial, 5 Cancelado). Ejecutarlo directamente contra la BD (no hay migraciones) y **anexarlo a `queries.txt`**, que es donde el repo lleva el registro del esquema.
2. Agregar `transaction<T>(work)` a `database/connection.ts`: abre `sql.Transaction`, expone un cliente con la misma firma `queryParams(sql, params)` atado a esa transacción, hace `commit` al terminar y `rollback` ante cualquier excepción. Mantener el mapeo de tipos actual e **incorporar `sql.Decimal`** para los parámetros numéricos no enteros (hoy todo número cae en `sql.Int`, lo que truncaría cantidades y precios — es un bug latente que este módulo destapa).
3. Crear `lib/inventory/stock.ts` con `applyStockMovement(tx, { id_product, id_sucursal, id_empresa, id_movement, quantity, ... })`, que dentro de la transacción:
   - lee `increases_storage` del movimiento para determinar el signo;
   - aplica el delta a `inventory.stock` con `UPDATE … WITH (UPDLOCK, HOLDLOCK) … OUTPUT inserted.quantity`, y si `@@ROWCOUNT = 0` hace el `INSERT` inicial con `OUTPUT`;
   - inserta la fila de `inventory.kardex` usando ese valor como `balance_after`;
   - devuelve el acumulado.
   Tomar el acumulado del `OUTPUT` (y no de un `SELECT` previo) es lo que hace el cálculo correcto bajo concurrencia.
4. Crear las interfaces listadas en "Modelo de datos".

### Fase 1 — Armado del pedido

5. `app/dashboard/pedidos/actions.ts`:
   - `getSuggestedProducts(id_sucursal)`: `LEFT JOIN` de `Products` con `stock` de esa sucursal; devuelve stock actual, mínimo efectivo (`COALESCE(stock.min_stock, Products.min_stock)`), cantidad sugerida (`CEILING((mínimo − actual) / conversion_factor)`, mínimo 1) y proveedor por defecto. Marca cuáles están por debajo del mínimo.
   - `getPurchaseOrdersSummary(id_sucursal)` para los tres KPIs del encabezado (productos bajo mínimo, sugeridos, último pedido).
   - Ambas siguen el `ActionResult<T>` del proyecto.
6. `contexts/PurchaseCartContext.tsx`: estado del carrito (líneas con `id_product`, `id_supplier`, `quantity`, `unit_price`, snapshots), persistido en `sessionStorage` para sobrevivir la navegación entre armado y revisión. **No se persisten borradores en BD** — evita basura de carritos abandonados.
7. `app/dashboard/pedidos/nuevo/page.tsx` + `componentes/`: `SuggestedProductsTable.tsx` (checkbox, cantidad y precio editables), `PurchaseCartSummary.tsx` (sidebar: fecha estimada, notas, subtotal/IVA/total en vivo) y filtros client-side reutilizando el patrón ya usado en `productos/page.tsx`. La tab "Plantillas de pedido" se renderiza deshabilitada con tooltip.
8. `app/dashboard/pedidos/nuevo/revision/page.tsx`: lee el carrito del contexto, lo agrupa por proveedor con `SupplierOrderGroup.tsx`, permite ajustar cantidad con el `QuantityStepper` compartido y cambiar el proveedor de una línea. Si el carrito está vacío, redirige a `/dashboard/pedidos/nuevo`.
9. `createPurchaseOrders(input)` en `app/dashboard/pedidos/actions.ts`: **una sola transacción** que valida las líneas contra la BD (producto existe, activo, de la empresa), **recalcula todos los importes en el servidor**, genera un `id_batch` compartido, y por cada proveedor genera folio e inserta encabezado + líneas con sus snapshots y `conversion_factor`. Devuelve los folios creados; la UI limpia el carrito y navega al historial.

### Fase 2 — Historial, detalle y paso "Enviado"

10. `getPurchaseOrders(filtros)` y `getPurchaseOrderById(id)` (encabezado + líneas + recepciones). Todas las fechas con `CONVERT(varchar(19)/varchar(10), …, 120)`.
11. `app/dashboard/pedidos/page.tsx`: historial con filtros por estado, proveedor y rango de fechas, y `PurchaseOrderRow.tsx`. Componente compartido `OrderStatusBadge.tsx` en `app/dashboard/componentes/` (lo consumen pedidos y recepciones).
12. `app/dashboard/pedidos/[id]/page.tsx`: detalle de la orden, líneas, totales, bitácora de recepciones y acciones según estado.
13. `UploadInvoiceModal.tsx` + `markOrderAsShipped(id, { invoice_url, invoice_number, invoice_date })`: sube el PDF al endpoint existente `POST /api/upload?folder=clinica/facturas` (ya valida MIME y magic bytes) y mueve la orden a `Enviado`. La acción rechaza si la orden no está en `Pedido` o si falta `invoice_url`.
14. `cancelPurchaseOrder(id)` con confirmación vía el `ConfirmModal` existente; rechaza si ya hay recepciones.

### Fase 3 — Recepción y entrada a stock

15. `app/dashboard/recepciones/actions.ts`:
    - `getPendingReceptions(id_sucursal)`: órdenes en `Enviado`/`Parcial` con avance (líneas completas vs. totales).
    - `getReceptionDetail(id_purchase_order)`: líneas con pedido, ya recibido y pendiente.
    - `confirmReception(id_purchase_order, lineas[], notes)`: **una transacción** que revalida el estado de la orden, revalida cada cantidad contra lo pendiente en BD (nunca contra lo que envía el cliente), inserta `purchase_receptions`, llama a `applyStockMovement` con el movimiento `1 (EXC)` por cada línea con cantidad > 0 convirtiendo con `conversion_factor`, acumula `quantity_received` y recalcula el estado de la orden. Es **idempotente ante doble envío** porque las cantidades se validan contra el pendiente real dentro de la transacción.
16. `app/dashboard/recepciones/page.tsx` (lista pendiente) y `[id]/page.tsx` (captura, desde `recepcion_de_compras.html`) con `ReceptionLineRow.tsx` (estado Completo/Parcial/Pendiente y diferencia calculados en vivo) y `ReceptionSummary.tsx` (líneas totales/completas/con diferencia, notas, confirmar). "Guardar Borrador" del mockup **no se implementa** y se omite del diseño (ver decisiones).
17. Componente compartido `QuantityStepper.tsx` en `app/dashboard/componentes/`, usado por revisión y recepción (mismo control `− [n] +` en ambos mockups).

### Fase 4 — Cierre

18. `navConfig.tsx`: agregar "Pedidos" (`ShoppingBag`) y "Recepciones" (`PackageCheck`) como hijos de "Inventario", conservando `excludeRoles: [5]`. **No se toca `proxy.ts`.**
19. En `ProductModal.tsx`, deshabilitar el campo `min_stock` cuando `id_role` no sea 1 ni 4, y validar esa misma regla en `saveProduct` (conservando el valor previo si un rol no autorizado intenta cambiarlo).
20. Aplicar paleta y tipografía de `references/DESIGN.md` con contraparte `dark:`, siguiendo el estilo ya establecido en `productos`/`proveedores`.
21. Verificación manual del flujo completo: crear pedido multiproveedor → confirmar que se generan N órdenes con folios distintos y mismo `id_batch` → intentar recibir sin factura (debe rechazarse) → subir factura → recibir parcial → verificar `Parcial`, kardex y `stock` → completar recepción → verificar `Stock`, `closed_at` y acumulados correctos.
22. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

**Pedido**
- [ ] `/dashboard/pedidos/nuevo` lista los productos por debajo del mínimo en la sucursal seleccionada, con stock actual, mínimo y cantidad sugerida, y los KPIs del encabezado coinciden con esos datos.
- [ ] Los filtros de texto, categoría y proveedor operan en el cliente y son combinables.
- [ ] Se pueden seleccionar productos de distintos proveedores en un mismo carrito; cantidad y precio unitario son editables por línea.
- [ ] El carrito sobrevive la navegación entre armado y revisión, y se vacía tras generar las órdenes.
- [ ] La revisión agrupa las líneas por proveedor y permite cambiar el proveedor de una línea.
- [ ] "Generar Orden de Compra" crea **una orden por proveedor**, con folios únicos por empresa y un `id_batch` común, todas en estado `Pedido`.
- [ ] Los importes guardados (`subtotal`, `tax`, `total`, `line_total`) se recalculan en el servidor y no dependen de lo enviado por el cliente.

**Factura / Enviado**
- [ ] El detalle de una orden en `Pedido` ofrece cargar la factura; al subir un PDF válido la orden pasa a `Enviado` con `invoice_url`, `invoice_number`, `invoice_date` y `sent_at`.
- [ ] La acción rechaza archivos no permitidos (lo valida `/api/upload`) y rechaza el cambio de estado sin `invoice_url`.

**Recepción y stock**
- [ ] `/dashboard/recepciones` lista solo órdenes en `Enviado` o `Parcial`, con su avance.
- [ ] Intentar recibir una orden en estado `Pedido` es rechazado por el servidor con mensaje claro, aunque se manipule la petición.
- [ ] La pantalla de recepción muestra por línea cantidad pedida, recibida, estado (Completo/Parcial/Pendiente) y diferencia, actualizados en vivo.
- [ ] Confirmar una recepción parcial deja la orden en `Parcial`, acumula `quantity_received` y genera una fila de kardex (`id_movement = 1`) por cada línea con cantidad > 0.
- [ ] Confirmar la recepción restante deja la orden en `Stock`, con `closed_at`, `delivery_date` e `is_final = 1`.
- [ ] `inventory.stock.quantity` de cada producto+sucursal coincide con el `balance_after` de su último movimiento de kardex, y con la suma con signo de todo su kardex.
- [ ] Un producto con `split = 1` y `pieces = 100` recibido en 1 unidad de compra suma **100** unidades de stock, y la línea de la orden conserva `conversion_factor = 100`.
- [ ] El servidor rechaza recibir más de lo pendiente por línea.
- [ ] Un doble envío del formulario de recepción no duplica el ingreso a stock.
- [ ] Recepción, kardex, acumulado en `stock` y cambio de estado ocurren en una sola transacción: si algo falla, no queda ningún registro parcial.

**Transversales**
- [ ] Cantidades y precios con decimales se guardan sin truncarse (parámetros `sql.Decimal`).
- [ ] Ninguna fecha viaja como `Date`: se escriben con `buildDate`/`toDBString` y se leen con `CONVERT(varchar, …, 120)`.
- [ ] El rol 5 no puede alcanzar `/dashboard/pedidos` ni `/dashboard/recepciones` (lo impide `proxy.ts` sin cambios), y esos ítems no aparecen en su sidebar.
- [ ] `min_stock` solo es editable por roles 1 y 4, validado también en el servidor.
- [ ] Las pantallas se ven correctamente en modo claro y oscuro.
- [ ] `npm run build` sin errores.

## Decisiones tomadas y descartadas

- **`inventory.stock` como snapshot + `inventory.kardex` como libro mayor**, en vez de derivar la existencia con un `SUM` sobre el kardex en cada lectura. El `SUM` es la opción "sin duplicar datos", pero la existencia se consulta en cada pantalla de pedido, venta y consulta, y crece sin techo con el histórico de movimientos. Se descartó también guardar **solo** el snapshot (sin kardex), porque destruiría la trazabilidad que `Inventario.md` pide explícitamente. El snapshot es reconstruible desde el kardex, así que la redundancia es segura.
- **`balance_after` tomado del `OUTPUT` del `UPDATE`, no de un `SELECT` previo.** Un `SELECT quantity` seguido de un `INSERT` con `quantity + delta` es una condición de carrera clásica: dos recepciones simultáneas del mismo producto producirían acumulados incorrectos. Se descartó por eso.
- **`IDENTITY` en las tablas nuevas, en vez del patrón `MAX(id)+1` del repo.** Rompe la consistencia estilística, pero `MAX+1` sin bloqueo explícito colisiona bajo concurrencia y este módulo sí tiene escrituras concurrentes reales. Las tablas viejas se quedan como están.
- **Transacciones agregadas a `database/connection.ts`.** Se evaluó encadenar los `queryParams` sueltos y confiar en que no fallen; se descartó porque una falla a media recepción dejaría kardex sin stock (o al revés), que es exactamente el tipo de corrupción imposible de auditar después.
- **Snapshots (`product_name`, `product_code`, `brand`, `id_unit_measurement`, `conversion_factor`) en la línea de la orden.** Se descartó resolver todo por `JOIN` contra el catálogo, porque una orden histórica debe reflejar lo que se pidió realmente; renombrar un producto o corregir `pieces` no puede reescribir compras pasadas.
- **`split` redefinido como regla de dos unidades + factor congelado** (petición explícita del documento). Se descartó dejarlo como bandera suelta interpretada en cada punto de uso, porque la conversión aparecería duplicada en compras, consultas, ventas y traspasos, con alto riesgo de divergencia. Se descartó también una tabla de conversiones genérica producto↔unidad: sobra para un caso donde el factor es siempre "piezas por empaque".
- **Sin tabla de detalle de recepción**: las filas de kardex con el mismo `id_reception` son el detalle. Se descartó `purchase_reception_items` porque sería una copia exacta del kardex con el riesgo de que ambas fuentes se desincronicen.
- **Estados `Parcial` (4) y `Cancelado` (5) agregados al catálogo `order_statuses`.** Los tres estados del documento no cubren la recepción incompleta, que es un caso operativo normal. Se descartó derivar "parcial" en tiempo de consulta comparando líneas, porque el estado se filtra y se pinta en cada listado y conviene que sea un dato explícito e indexable. `Inventario.md` marca esa tabla como "sujeta a cambios".
- **Carrito en `sessionStorage` (contexto de cliente), no borradores en BD.** Se descartó persistir el carrito como orden en estado "borrador" porque generaría registros huérfanos de cada sesión abandonada y obligaría a distinguir borradores de órdenes reales en todos los listados. El costo es que un carrito no se comparte entre dispositivos, algo irrelevante en este flujo.
- **"Guardar Borrador" de la pantalla de recepción se omite.** Con recepciones parciales acumulativas, un borrador es redundante: recibir 350 de 400 ya deja el resto pendiente y reanudable. Se descartó implementar ambos mecanismos porque harían el estado ambiguo.
- **`tax_rate` en el encabezado, no por línea.** Se evaluó IVA por producto (los medicamentos pueden ser tasa 0%), pero el catálogo no tiene hoy ningún campo fiscal y agregarlo excede el alcance. Guardar la tasa aplicada en el encabezado permite migrar a IVA por línea después sin reescribir la historia.
- **`min_stock` con override por sucursal en `inventory.stock`, con fallback al producto.** El mínimo hoy es de empresa, pero una clínica multisucursal termina necesitando mínimos distintos por sede. Se descartó forzar el override desde ya (implicaría sembrar filas y UI nueva); la columna queda disponible y la consulta ya usa el `COALESCE`.
- **Precio del catálogo no se actualiza al comprar.** El precio negociado vive en la línea de la orden. Se descartó sobrescribir `Products.price` con el último precio de compra porque ese campo se usa como precio de referencia/venta y se corrompería. La lista de precios por proveedor (`supplier_products`) queda anotada como extensión futura.
- **FK reales solo en las relaciones padre/hijo del módulo** (orden→líneas, orden→recepciones); las referencias a catálogos (`id_product`, `id_supplier`, `id_movement`, `id_sucursal`) siguen siendo lógicas, como en todo el repo. Se descartó declarar FK a los catálogos por consistencia con el esquema existente y para no romper cargas de datos manuales.
- **El rol 5 queda fuera de inventario**, contra lo que sugiere `Inventario.md`. Decisión del dueño del producto: los pasos que el documento atribuye a la podóloga los registra suministros/administración dentro del sistema.

## Riesgos identificados

- **`db.queryParams` mapea todo número a `sql.Int`.** Cantidades y precios decimales se truncarían silenciosamente. El paso 2 lo corrige agregando `sql.Decimal`, pero el cambio toca el helper que **todas** las features del sistema usan: hay que verificar que ninguna consulta existente dependiera del casteo a entero. Es el cambio de mayor radio de este spec.
- **Existencia inicial en cero.** Al liberar, `inventory.stock` estará vacío y todo producto con `min_stock` aparecerá como "por pedir". Hace falta una carga inicial de existencias (inventario físico) vía movimientos de ajuste (`EXA`), que este spec no construye — sin ella la pantalla de sugeridos nace con ruido.
- **`inventory.units_measurement` sigue con todas sus filas en `status = 0`** (riesgo heredado del spec 08): mientras no se corrija el seed, los productos no tendrán unidad de compra ni de stock asignable, y las unidades se mostrarán vacías en pedidos y recepciones. Es un dato a corregir en BD, no código.
- **Productos sin `pieces` con `split = 1`** caerían en `conversion_factor = 1` por el fallback, registrando 1 unidad de stock donde debían ser N. Se mitiga con el fallback explícito y mostrando la unidad resultante en la revisión, pero conviene validar el catálogo antes de operar.
- **Doble catálogo de productos** (`dbo.productos` para Ventas, `inventory.Products` para inventario): las salidas por venta —fuera de este spec— no podrán descontar stock hasta que Ventas migre. El kardex nacerá con entradas pero sin salidas por venta.
- **Folio con consecutivo calculado en la transacción**: bajo alta concurrencia dos órdenes podrían intentar el mismo folio. El índice único lo impide y obliga a reintentar; con el volumen esperado de esta clínica el caso es prácticamente teórico, pero conviene manejar el error de duplicado con un reintento acotado.
- **Alcance amplio para un solo spec.** Son cuatro fases con cambios de infraestructura (transacciones, tipos SQL) más seis pantallas. Si hace falta acortar el ciclo, el corte natural es liberar Fases 0–2 (pedidos y factura) y dejar la Fase 3 (recepción) como spec 10, ya que el modelo de datos queda completo desde la Fase 0.
