# 16 — Ventas descuentan stock por sucursal

## Header

- **Estado:** Implementado
- **Depende de:** [[08-productos-inventario-crud]] (`inventory.Products`, `IProduct`, `getProducts`), [[12-precio-venta-productos-paquete]] (`sale_price`), [[09-pedidos-compra-recepcion]] / [[14-movimientos-almacen]] (`applyStockMovement`, `inventory.stock`, `inventory.kardex`, movimiento `6` "Salida por venta" ya sembrado y sin uso)
- **Fecha:** 2026-08-14
- **Objetivo:** Reconectar `/dashboard/ventas` para vender productos de categoría "Venta" (`inventory.Products`) descontando `inventory.stock` por sucursal vía kardex (movimiento `6`), mostrando el stock disponible al elegir producto y reajustando el stock al editar/eliminar una venta, dejando de usar por completo `dbo.productos`.

## Alcance

**Incluye:**

- `app/dashboard/ventas/page.tsx`, `VentaModal.tsx` y `VentaFila.tsx` dejan de usar `IProducto`/`getProductos` (`dbo.productos`) y pasan a usar productos de `inventory.Products` filtrados a **categoría "Venta" (`id_category = 4`)**, activos (`activo = 1`, `status = 1`) de la empresa del usuario.
- Nueva función `getSaleProducts(id_sucursal)` en `app/dashboard/ventas/actions.ts`: lee `inventory.Products` (categoría Venta, activos) `LEFT JOIN inventory.stock` por la sucursal seleccionada, devolviendo por producto su **precio efectivo de venta** (`sale_price` si `split = 1`, si no `price`) y su **stock actual** en esa sucursal (`0` si no hay fila en `inventory.stock`).
- El selector de producto del modal (`VentaModal`) muestra, junto a cada opción, el precio efectivo y el stock disponible (ej. `Curitas — $25.00 (12 en stock)`).
- **`dbo.Ventas` gana columna `id_sucursal`** (propia, ya no derivada de `dbo.productos`), obligatoria en toda venta nueva, tomada de `SucursalContext` en el cliente y validada/usada en el server action.
- **Al guardar una venta nueva:** dentro de una transacción, se inserta la fila en `dbo.Ventas` (con `id_sucursal`) y se aplica `applyStockMovement` con movimiento `6` ("Salida por venta") sobre `inventory.stock`/`inventory.kardex`, para el producto/sucursal/cantidad de la venta. `id_unit_measurement` se toma de `Products.id_stock_unit_measurement`.
- **Al editar una venta existente** (cambia producto y/o cantidad): dentro de una transacción, se calcula y aplica el ajuste de stock necesario para dejarlo consistente con los nuevos valores (ver "Modelo de datos" para el detalle del cálculo), antes de actualizar la fila de `dbo.Ventas`.
- **Al eliminar una venta** (soft-delete `status = 0`): dentro de una transacción, se revierte por completo el stock que esa venta había descontado, antes de marcar `status = 0`.
- **Reversas de stock (edición/eliminación) usan movimiento `7` "Entrada por ajuste"**; incrementos adicionales de cantidad en una edición usan movimiento `6` igual que una venta nueva. Ver detalle en "Modelo de datos".
- **Stock negativo permitido con advertencia:** si la cantidad vendida deja el stock por debajo de cero (al crear o al aumentar la cantidad en una edición), el modal muestra una advertencia visible pero **no bloquea** el guardado — mismo criterio que spec 14.
- **Trazabilidad:** `inventory.kardex` gana columna `id_venta` (nullable), poblada en los movimientos `6`/`7` generados desde Ventas; `IApplyStockMovementInput`/`applyStockMovement` se extienden con `id_venta?: number | null`.
- `interfaces/venta.ts` (`IVenta`) gana `id_sucursal: number`.
- `dbo.productos`/`IProducto`/`getProductos` quedan sin ningún consumidor tras este spec (se eliminan de `app/dashboard/productos/actions.ts` y de `interfaces/producto.ts` se documenta como no usada — ver Decisiones).
- Anexar los `ALTER TABLE` a `queries.txt`, siguiendo la convención del repo.

**No incluye:**

- **Migración ni backfill de datos históricos** de `dbo.Ventas`/`dbo.productos` — ambas tablas nunca tuvieron uso real en producción (confirmado por el usuario), así que `id_sucursal` se agrega `NULL`-able sin backfill y no se preserva ningún dato viejo.
- **Borrar físicamente** `dbo.productos` ni `dbo.Ventas` — quedan intactas en BD (mismo criterio que spec 08 con la tabla vieja de productos), simplemente sin código que las use.
- **Selector de sucursal dentro del modal de venta** — la sucursal es siempre la seleccionada en `SucursalContext`, igual que hoy filtra el listado.
- **Conversión de unidades (paquete → pieza) al vender.** La cantidad se descuenta siempre en unidades de stock (`id_stock_unit_measurement`), sin usar `pieces`/`conversion_factor` — mismo criterio que spec 14 (Movimientos).
- **Costo unitario (`unit_cost`) en el kardex de ventas** — queda `NULL`, igual que ajustes/traspasos manuales; el costo solo tiene origen confiable en recepciones (spec 09).
- **Cambios a Recepciones, Pedidos, Movimientos o Consultas** — sus flujos de kardex no cambian.
- **Facturación (`facturado`, `uuid_cfdi`)** — sin cambios, sigue siendo un campo de captura manual sin lógica nueva.
- **Reporte o pantalla de "productos más vendidos" / valuación de inventario** — fuera de alcance.

## Modelo de datos

**Columna nueva en `[CentroPodologico].[dbo].[Ventas]`** (tabla ya existente):

| Columna | Tipo | Notas |
|---|---|---|
| `id_sucursal` | `int` NULL | Sucursal donde se registró la venta. Se llena en toda venta nueva desde `SucursalContext`; `NULL` únicamente en filas preexistentes (sin uso real). |

```sql
ALTER TABLE [CentroPodologico].[dbo].[Ventas] ADD [id_sucursal] [int] NULL;
GO
```

**Columna nueva en `[CentroPodologico].[inventory].[kardex]`** (tabla ya existente):

| Columna | Tipo | Notas |
|---|---|---|
| `id_venta` | `int` NULL | Venta que originó el movimiento. Se llena en los movimientos `6`/`7` generados desde Ventas; `NULL` en cualquier otro origen (recepciones, consultas, traspasos, ajustes manuales). |

```sql
ALTER TABLE [CentroPodologico].[inventory].[kardex] ADD [id_venta] [int] NULL;
GO
CREATE INDEX [IX_kardex_id_venta] ON [CentroPodologico].[inventory].[kardex] ([id_venta] ASC);
GO
```

**`interfaces/venta.ts` (`IVenta`) — se agrega un campo:**

```ts
export interface IVenta {
  id_venta:            number;
  id_producto:         number;
  id_sucursal:          number;   // nuevo
  cantidad:            number;
  idMetodoPago:        number;
  total:               number;
  created_at:          string;
  id_usuario:          number;
  status:              number;
  webid:               string | null;
  facturado:           number | null;
  uuid_cfdi:           string | null;
  // joined
  nombre_producto?:    string;
  descripcion_metodo?: string;
}
```

**`lib/inventory/stock.ts` (`IApplyStockMovementInput`) — se agrega un campo, mismo patrón que `id_consulta`/`id_reception`:**

```ts
export interface IApplyStockMovementInput {
  // …campos actuales…
  id_consulta?:             number | null;
  id_venta?:                number | null;   // nuevo
  id_sucursal_counterpart?: number | null;
  id_transfer?:             string | null;
  notes?:                   string | null;
  id_user:                  number;
}
```

El `INSERT` de `applyStockMovement` hacia `inventory.kardex` agrega `[id_venta]` a la lista de columnas/valores, con default `null`. Los llamadores existentes (recepciones, consumo por consulta, movimientos manuales) no cambian — el campo es opcional.

**Nueva interfaz de vista, en `app/dashboard/ventas/actions.ts`, análoga a `IProductForMovement`/`IPendingReception`:**

```ts
/** Producto vendible (categoría Venta) con precio efectivo y stock actual en la sucursal. */
export interface ISaleProduct {
  id_product:             number;
  name:                   string;
  effective_price:        number;   // sale_price si split=1, si no price
  id_stock_unit_measurement: number | null;
  unit_code:              string | null;   // units_measurement.code
  stock_quantity:         number;   // 0 si no hay fila en inventory.stock
}
```

**Movimiento `6` "Salida por venta"** (ya sembrado en `inventory.movements`, `increases_storage = 0`): se usa tal cual al crear una venta o al aumentar su cantidad en una edición.

**Movimiento `7` "Entrada por ajuste"** (ya sembrado, `increases_storage = 1`): se reutiliza como mecanismo de reversa cuando una venta se edita a la baja o se elimina — es la misma semántica de corrección ya establecida en spec 14, con `notes` indicando el origen (ej. `"Reversión por edición de venta #123"` / `"Reversión por eliminación de venta #123"`) e `id_venta` ligado a la venta corregida.

**Cálculo del ajuste al editar una venta** (dentro de una sola `db.transaction`, antes del `UPDATE` a `dbo.Ventas`):

- Se lee la fila actual de `dbo.Ventas` (`id_producto`, `id_sucursal`, `cantidad` **antes** del cambio).
- Si `id_producto` **no cambia**: `delta = cantidadNueva - cantidadVieja`.
  - `delta > 0` → un `applyStockMovement` con movimiento `6`, `quantity = delta`, mismo producto/sucursal.
  - `delta < 0` → un `applyStockMovement` con movimiento `7`, `quantity = abs(delta)`, mismo producto/sucursal.
  - `delta === 0` → no se aplica movimiento.
- Si `id_producto` **cambia**: dos `applyStockMovement` — movimiento `7` con `quantity = cantidadVieja` sobre el producto/sucursal viejo (reversa completa), y movimiento `6` con `quantity = cantidadNueva` sobre el producto/sucursal nuevo (salida completa).
- La sucursal de la venta (`id_sucursal`) no es editable desde el modal — coincide siempre con `SucursalContext` al momento de la edición.

**Al eliminar:** un `applyStockMovement` con movimiento `7`, `quantity = cantidad` (la guardada en la venta), mismo producto/sucursal, antes del `UPDATE ... SET status = 0`.

## Plan de implementación

1. **BD.** Ejecutar los dos `ALTER TABLE` + `CREATE INDEX` de "Modelo de datos" (`dbo.Ventas.id_sucursal`, `inventory.kardex.id_venta`) y anexarlos a `queries.txt` bajo el encabezado `-- spec 16 — ventas descuentan stock por sucursal`.

2. **`interfaces/venta.ts`.** Agregar `id_sucursal: number` a `IVenta`, en la posición mostrada en "Modelo de datos".

3. **`lib/inventory/stock.ts`.** Extender `IApplyStockMovementInput` con `id_venta?: number | null` (default `null`) y agregarlo al `INSERT` de kardex. Ningún llamador existente cambia — el campo es opcional.

4. **`app/dashboard/ventas/actions.ts`:**
   - Agregar `getSaleProducts(id_sucursal): Promise<ISaleProduct[]>` — `SELECT` sobre `inventory.Products p` con `LEFT JOIN inventory.stock s ON s.id_product = p.id_product AND s.id_sucursal = @id_sucursal`, `LEFT JOIN inventory.units_measurement um ON um.id_unit_measurement = p.id_stock_unit_measurement`, filtrando `p.id_category = 4`, `p.activo = 1`, `p.status = 1`, `p.id_empresa = @id_empresa`. `effective_price` calculado en SQL (`CASE WHEN p.split = 1 AND p.sale_price IS NOT NULL THEN p.sale_price ELSE p.price END`), `stock_quantity` con `ISNULL(s.quantity, 0)`.
   - `getVentas`: quitar el `INNER JOIN` a `dbo.productos` y su filtro por `id_sucursal`/`id_empresa` de producto; en su lugar, filtrar `v.id_sucursal = @id_sucursal` directamente y hacer `LEFT JOIN inventory.Products p ON p.id_product = v.id_producto` para `nombre_producto` (sigue igual de nombre en la interfaz).
   - `saveVenta(form)`: agregar `id_sucursal` al `VentaForm` y tomarlo del parámetro (viene de `SucursalContext` en cliente); tomar `id_empresa`/`id_user` de `getActiveUser()`. Reescribir para correr dentro de `db.transaction`:
     - **Creación (`id_venta === 0`):** INSERT a `dbo.Ventas` (incluyendo `id_sucursal`) + `applyStockMovement` con movimiento `6`, `quantity = cantidad`, `id_unit_measurement` de `Products.id_stock_unit_measurement` (se resuelve con un `SELECT` previo dentro de la transacción), `id_venta` = el `id_venta` recién generado.
     - **Edición (`id_venta !== 0`):** `SELECT` de la fila actual (`id_producto`, `cantidad`) con bloqueo (`WITH (UPDLOCK, HOLDLOCK)`), aplicar el/los `applyStockMovement` según el cálculo de "Modelo de datos", luego el `UPDATE` a `dbo.Ventas`.
   - `deleteVenta(id_venta)`: reescribir para correr dentro de `db.transaction` — `SELECT` de la fila (`id_producto`, `id_sucursal`, `cantidad`) con bloqueo, `applyStockMovement` con movimiento `7` (reversa completa), luego `UPDATE ... SET status = 0`.
   - `VentaForm` gana `id_sucursal: number`.
   - Se elimina el `import { getProductos } from "@/app/dashboard/productos/actions"` (ya no se usa desde Ventas).

5. **`app/dashboard/productos/actions.ts`.** Eliminar `getProductos` (sin más consumidores tras el paso 4). `interfaces/producto.ts` se deja documentada como no usada (ver Decisiones) — no se borra el archivo para evitar tocar tipos en cascada fuera de alcance.

6. **`app/dashboard/ventas/page.tsx`:**
   - Reemplazar `getProductos`/`IProducto` por `getSaleProducts`/`ISaleProduct`.
   - `EMPTY` gana `id_sucursal: selectedId` (o se resuelve al abrir el modal); `openNew`/`openEdit` incluyen `id_sucursal`.
   - El cálculo de `total` en `handleChange` usa `ISaleProduct.effective_price` en vez de `IProducto.precio`.
   - `saveVenta` se llama con el `id_sucursal` actual de `SucursalContext`.

7. **`VentaModal.tsx`:**
   - Cambiar `productos: IProducto[]` por `productos: ISaleProduct[]`.
   - El `<option>` de cada producto muestra `{p.name} — {fmtCurrency(p.effective_price)} ({p.stock_quantity} en stock)`.
   - Advertencia visible (no bloqueante) cuando `form.cantidad > stock_quantity` del producto seleccionado, mostrando el faltante.

8. **`VentaFila.tsx`.** Sin cambios funcionales — sigue leyendo `v.nombre_producto`/`v.total` tal cual; solo se beneficia de que ahora vienen de `inventory.Products` vía el `LEFT JOIN` actualizado en `getVentas`.

9. **Verificación manual:** registrar una venta y confirmar que `inventory.stock` baja y aparece una fila de kardex mov. `6` con `id_venta` correcto; editar la cantidad hacia arriba y hacia abajo y confirmar el ajuste correspondiente (mov. `6`/`7`); editar cambiando de producto y confirmar reversa completa en el viejo + salida completa en el nuevo; eliminar una venta y confirmar que el stock se restaura por completo (mov. `7`); vender más cantidad que el stock disponible y confirmar que se advierte pero se permite guardar, dejando stock negativo; confirmar que el selector de producto solo lista categoría "Venta" activos, con precio efectivo y stock correctos; confirmar que `/dashboard/movimientos` (spec 14) muestra correctamente estas filas de kardex como solo lectura.

10. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [x] `dbo.Ventas` tiene la columna `id_sucursal` (`int` NULL) y `inventory.kardex` tiene la columna `id_venta` (`int` NULL) con el índice `IX_kardex_id_venta`, ambas registradas en `queries.txt`.
- [x] `IVenta` incluye `id_sucursal: number`.
- [x] `applyStockMovement`/`IApplyStockMovementInput` aceptan `id_venta` como campo opcional y lo escriben en el kardex; recepciones, consumo por consulta y movimientos manuales siguen funcionando sin cambios en sus llamadas.
- [x] El selector de producto del modal de Ventas solo lista productos de `inventory.Products` con `id_category = 4` (Venta), `activo = 1` y `status = 1` de la empresa del usuario — ningún producto de `dbo.productos` aparece.
- [x] Cada opción del selector muestra el precio efectivo (`sale_price` si `split = 1`, si no `price`) y el stock actual del producto en la sucursal seleccionada.
- [x] El total de la venta se calcula automáticamente con el precio efectivo del producto elegido y la cantidad capturada.
- [x] Registrar una venta nueva inserta la fila en `dbo.Ventas` con el `id_sucursal` actual de `SucursalContext`, y genera **una** fila de kardex con movimiento `6` ("Salida por venta"), con `id_venta` ligado a la venta y `quantity` igual a la cantidad vendida.
- [x] `inventory.stock` del producto/sucursal baja exactamente en la cantidad vendida tras registrar la venta.
- [x] Editar una venta aumentando la cantidad (mismo producto) genera un movimiento `6` adicional por la diferencia; disminuyéndola genera un movimiento `7` por la diferencia; el stock queda consistente con la cantidad final.
- [x] Editar una venta cambiando de producto genera una reversa completa (`7`) sobre el producto/sucursal original y una salida completa (`6`) sobre el producto/sucursal nuevo, dejando ambos stocks correctos.
- [x] Eliminar una venta (soft-delete) genera un movimiento `7` que restaura por completo el stock descontado por esa venta, antes de marcar `status = 0`.
- [x] Si la cantidad vendida (al crear o al aumentar en edición) deja el stock por debajo de cero, el modal muestra una advertencia visible pero **permite** guardar.
- [x] Toda escritura de stock/kardex de una venta (creación, edición, eliminación) ocurre dentro de una única transacción junto con el cambio a `dbo.Ventas`; si el movimiento de stock falla, la venta no se guarda/actualiza/elimina.
- [x] `id_empresa`, `id_user` se toman del JWT en el server action, nunca de parámetros enviados por el cliente; `id_sucursal` se toma de `SucursalContext` en el cliente y viaja explícito al server action (mismo patrón ya usado en el resto de Ventas).
- [x] `getVentas` filtra por `v.id_sucursal` directamente (sin JOIN a `dbo.productos`) y sigue devolviendo `nombre_producto` correctamente para ventas registradas tras este cambio.
- [x] `getProductos`/`IProducto` (`dbo.productos`) ya no tienen ningún consumidor en el código; `dbo.productos` permanece intacta en BD sin usarse.
- [x] La página se ve correctamente en modo claro y oscuro, consistente con el resto de Ventas.
- [x] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Solo productos de categoría "Venta" (`id_category = 4`), no todo `inventory.Products`.** Se descartó permitir vender cualquier producto activo porque mezclaría insumos de consulta (Consumibles/Instrumental/Medicamentos, con `auto_consume`/`min_stock` pensados para consultas) con productos de mostrador; la categoría "Venta" ya existe en el catálogo justamente para esta distinción (spec 12).
- **Precio efectivo = `sale_price` si `split = 1`, si no `price`.** Coincide con la semántica ya definida en spec 12 ("Precio de Venta (pieza)" para productos que se compran por paquete pero se venden por pieza); usar siempre `price` habría ignorado ese campo, dejándolo "vivo pero sin consumidor" tal como spec 12 documentó como riesgo pendiente — este spec lo resuelve.
- **`dbo.Ventas` gana `id_sucursal` propia, sin backfill de datos históricos.** El JOIN indirecto vía `dbo.productos.id_sucursal` deja de ser viable porque `inventory.Products` es compartido a nivel empresa (spec 08). El usuario confirmó que ni `dbo.Ventas` ni `dbo.productos` tuvieron uso real, por lo que no se justifica escribir un `UPDATE` de backfill — la columna simplemente queda `NULL` en filas preexistentes y se llena desde `SucursalContext` en toda venta nueva.
- **Reversas de stock usan movimiento `7` "Entrada por ajuste", no un movimiento nuevo tipo "Entrada por devolución de venta".** Se descartó crear un movimiento `10` dedicado porque `7` ya es el mecanismo de corrección establecido en spec 14 para cualquier caso donde el stock necesita ajustarse manualmente por una razón distinta a compra/traspaso/consumo; agregar un movimiento nuevo solo para esto duplicaría semántica sin beneficio, y las `notes` + `id_venta` ya dejan constancia clara del origen.
- **Editar/eliminar SÍ reajustan stock (transaccional), en vez de dejarlo desalineado.** Alternativa descartada: no tocar stock al editar/eliminar y dejar que el usuario corrija a mano en Movimientos (spec 14). Se descartó porque ahora que Ventas sí descuenta stock, dejar los ajustes fuera de la transacción original introduciría una ventana donde el stock queda incorrecto sin que nadie lo note, contradiciendo el propósito mismo de este spec.
- **Stock negativo permitido con advertencia, no bloqueo.** Mismo criterio ya adoptado en spec 14 (Movimientos): bloquear la venta dejaría al personal de mostrador atorado ante un desfase de stock que probablemente ya existía antes (consumo no registrado), en vez de dejar constancia y permitir continuar.
- **`id_venta` en `inventory.kardex` como columna nullable, mismo patrón que `id_consulta`/`id_reception`, no una tabla de relación aparte.** Consistente con cómo el kardex ya liga cada fila a su origen (compra, consulta, traspaso); una tabla de relación separada sería sobre-ingeniería para un vínculo 1:N simple.
- **`getSaleProducts` vive en `app/dashboard/ventas/actions.ts`, no en `productos/actions.ts`.** Sigue la convención de `CLAUDE.md` de actions por feature; aunque consulta `inventory.Products`, la forma de la consulta (con stock por sucursal y precio efectivo calculado) es específica del flujo de venta, no un CRUD de catálogo.
- **`getProductos`/`IProducto` se eliminan de `productos/actions.ts` pero `interfaces/producto.ts` no se borra.** Spec 08 ya había dejado esta función viva exclusivamente para Ventas; al desaparecer su único consumidor, se elimina la función, pero borrar el archivo de interfaz completo se considera fuera de alcance (riesgo bajo de romper algo no detectado por `grep`, sin beneficio funcional).
- **`unit_cost` en `NULL` para los movimientos de venta.** Igual que ajustes/traspasos manuales (spec 14): el costo solo tiene origen confiable en la orden de compra (spec 09), y una venta no lo determina.

## Riesgos identificados

- **Stock negativo silencioso.** Igual que en spec 14: permitir ventas que dejan el stock en negativo significa que puede acumularse sin que nadie lo corrija, y una sucursal con stock negativo aparecerá permanentemente "bajo mínimo" en los sugeridos de pedidos (spec 11) hasta que alguien registre un ajuste de entrada en Movimientos.
- **Editar/eliminar con alta concurrencia.** El `SELECT ... WITH (UPDLOCK, HOLDLOCK)` de la fila de venta antes de calcular el ajuste reduce el riesgo, pero si dos usuarios editan la misma venta casi simultáneamente, el segundo espera al primero; no hay optimistic locking a nivel de fila de `dbo.Ventas` más allá de eso.
- **Reversas encadenadas quedan ruidosas en el kardex.** Cada edición que cambia cantidad/producto dos o más veces genera una fila `6`/`7` por cada operación; el saldo final es correcto, pero el historial de kardex de un producto puede acumular varias correcciones para una sola venta que el usuario terminó de ajustar tras varios intentos — mismo riesgo ya aceptado en spec 14 para ajustes manuales.
- **`getVentas` deja de poder mostrar correctamente ventas anteriores a este cambio.** Las filas preexistentes de `dbo.Ventas` (si las hubiera) tienen `id_sucursal = NULL` y `id_producto` apuntando a `dbo.productos`; con el nuevo filtro por `v.id_sucursal` y el `LEFT JOIN` a `inventory.Products`, esas filas no aparecerán en ningún listado por sucursal y su producto se verá como `#id` sin nombre. Se acepta porque el usuario confirmó que no hay datos reales que preservar.
- **`inventory.Products` sin productos de categoría "Venta" cargados todavía.** Si en producción no existe ningún producto con `id_category = 4`, el selector de Ventas aparecerá vacío hasta que alguien los capture desde `/dashboard/productos` — no es un bug de este spec, pero es la primera vez que su ausencia bloquea un flujo operativo (antes solo afectaba al catálogo).
- **Dos tablas de "producto" siguen coexistiendo en BD (`dbo.productos` sin uso, `inventory.Products` en uso).** Este spec resuelve la deuda que spec 08 había dejado explícita para Ventas, pero `dbo.productos` permanece en BD sin ningún código que la use — queda como candidata a limpieza/borrado en un spec futuro si se decide.
- **`id_stock_unit_measurement` puede venir `NULL` en un producto de categoría Venta.** Si un producto no tiene esa columna capturada, el movimiento de kardex se registra con `id_unit_measurement = NULL`; no bloquea la venta, pero deja esa fila sin unidad visible en Movimientos (spec 14), igual que puede pasar hoy con productos de otras categorías.
