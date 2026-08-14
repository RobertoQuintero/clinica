# 17 — Productos de consulta descuentan stock

## Header

- **Estado:** Implementado
- **Depende de:** [[16-ventas-descuentan-stock-sucursal]] (`getSaleProducts`, `ISaleProduct`, movimiento `6` "Salida por venta", `applyStockMovement`), [[13-consumo-automatico-insumos-consulta]] (`inventory.kardex.id_consulta`, patrón de enganchar movimientos de stock desde el flujo de consultas)
- **Fecha:** 2026-08-14
- **Objetivo:** Migrar el catálogo de productos de `TabProductos` (consulta) de la tabla legacy `dbo.productos` a `inventory.Products` (categoría "Venta"), descontando/reajustando `inventory.stock` de la sucursal de la consulta vía `applyStockMovement` (movimiento `6`) al agregar, editar o eliminar un producto, y confirmando que los totales ya conectados en `page.tsx` y `TabGeneral` siguen reflejando estos valores correctamente.

## Alcance

**Incluye:**

- `getProductosCatalogo(id_sucursal)` en `app/dashboard/pacientes/[id]/consultas/[id_consulta]/actions.ts` deja de consultar `dbo.productos` y pasa a llamar a `getSaleProducts(id_sucursal)` (de `app/dashboard/ventas/actions.ts`), devolviendo `ISaleProduct[]` en vez de `ProductoCatalogo[]`.
- `TabProductos.tsx` y `AddProductoForm.tsx` se actualizan para consumir `ISaleProduct` (`id_product`, `name`, `effective_price`, `stock_quantity`, `unit_code`, `id_stock_unit_measurement`) en vez de `ProductoCatalogo` (`id_producto`, `nombre`, `precio`).
- El buscador de `AddProductoForm` muestra, junto a cada opción del `datalist`, el stock disponible (ej. `Curitas (12 en stock)`), y una advertencia visible (no bloqueante) cuando la cantidad capturada supera el `stock_quantity` del producto seleccionado — mismo criterio visual que `VentaModal` (spec 16).
- `addConsultaProducto(id_consulta, id_producto, precio, cantidad)`: dentro de una transacción, además del `INSERT` a `dbo.consulta_productos` ya existente, resuelve `id_sucursal`/`id_empresa` desde la fila de `dbo.consultas` y `id_user` desde el JWT, y llama a `applyStockMovement` con `id_movement = 6`, `quantity = cantidad`, `id_consulta` = la consulta actual, `id_unit_measurement` = `Products.id_stock_unit_measurement`.
- `updateConsultaProducto(id_consulta_producto, precio, cantidad, status)`: dentro de una transacción, lee la fila actual (`id_producto`, `cantidad`, `status`) con bloqueo, calcula el ajuste de stock necesario (ver "Modelo de datos") y lo aplica antes del `UPDATE`.
- `deleteConsultaProducto(id_consulta_producto)`: dentro de una transacción, lee la fila actual con bloqueo, revierte el stock completo (si el producto estaba `activo`) y luego hace el `DELETE`.
- Ambas escrituras (stock + fila de `consulta_productos`) ocurren dentro de la misma `db.transaction`; si el movimiento de stock falla, no se guarda/actualiza/elimina el producto.
- Se permite stock negativo con advertencia visible en UI, sin bloquear el guardado (igual que spec 16).
- `CONSULTA_PRODUCTOS_SELECT` cambia su `LEFT JOIN` de `dbo.productos` a `inventory.Products` para resolver `nombre_producto` de productos agregados desde este spec en adelante (ver "Modelo de datos" y "Plan").
- Verificación de que los totales ya conectados (`TabProductos` → `page.tsx` header y `totalGeneral`; `TabProductos`/`TabGeneral` → "Productos utilizados") siguen mostrando los valores correctos con el nuevo origen de datos — sin cambios de código en `page.tsx` más allá de los ya existentes.

**No incluye:**

- Cambios a `dbo.productos` ni a su borrado físico — queda intacta y sin consumidores tras este spec (como ya documentaba spec 16, ahora sí de forma correcta).
- Cambios de esquema en `dbo.consulta_productos` — `id_producto` simplemente pasa a apuntar semánticamente a `inventory.Products.id_product`, sin migración de datos históricos (las consultas ya registradas con productos de `dbo.productos` quedan con `nombre_producto` sin resolver, igual que se aceptó para `dbo.Ventas` en spec 16).
- Selector de sucursal en `TabProductos` — la sucursal siempre es la de la consulta (`consultas.id_sucursal`), no la del `SucursalContext`.
- Conversión de unidades (paquete → pieza) — se descuenta en unidades de stock, igual que spec 16.
- `unit_cost` en el kardex — queda `NULL`, igual que ventas.
- Bloquear la creación/edición de la consulta por falta de stock, o cualquier notificación fuera de la advertencia visible ya descrita.
- Tocar el flujo de `applyConsultationConsumption` (spec 13, insumos auto-consumidos) — es un mecanismo distinto y no se modifica.
- Cambiar el producto de una fila de `consulta_productos` ya creada (no existía esa capacidad antes de este spec y no se agrega aquí).
- Cambios al diseño visual de `TabProductos`/`AddProductoForm` más allá de mostrar stock y la advertencia — sin rediseño.

## Modelo de datos

No se agregan tablas ni columnas — todo lo necesario ya existe (`inventory.kardex.id_consulta` de spec 13, `applyStockMovement`/`IApplyStockMovementInput` de spec 09/13/16, `getSaleProducts`/`ISaleProduct` de spec 16).

**`app/dashboard/pacientes/[id]/consultas/[id_consulta]/actions.ts` — cambio de tipo, no de esquema:**

```ts
// antes
export type ProductoCatalogo = { id_producto: number; nombre: string; precio: number };
export async function getProductosCatalogo(id_sucursal: number): Promise<ProductoCatalogo[]> { ... }

// después
import { getSaleProducts, ISaleProduct } from "@/app/dashboard/ventas/actions";

export async function getProductosCatalogo(id_sucursal: number): Promise<ISaleProduct[]> {
  return getSaleProducts(id_sucursal);
}
```

`AddProductoForm.tsx` y `TabProductos.tsx` reemplazan sus referencias a `ProductoCatalogo`/`nombre`/`precio` (del catálogo) por `ISaleProduct`/`name`/`effective_price`/`stock_quantity`. **No se toca** `ConsultaProductoExtended` ni `IConsultaProducto` — `precio`/`cantidad` siguen siendo el snapshot histórico ya cobrado, tal como hoy.

**`CONSULTA_PRODUCTOS_SELECT`** cambia de:

```sql
LEFT JOIN [CentroPodologico].[dbo].[productos] p ON p.[id_producto] = cp.[id_producto]
```

a:

```sql
LEFT JOIN [CentroPodologico].[inventory].[Products] p ON p.[id_product] = cp.[id_producto]
```

(y `p.[nombre]` por `p.[name]` en el `SELECT`).

**Resolución de `id_sucursal`/`id_empresa` para el movimiento de stock**, dentro de `addConsultaProducto`/`updateConsultaProducto`/`deleteConsultaProducto`:

```sql
SELECT [id_sucursal], [id_empresa]
  FROM [CentroPodologico].[dbo].[consultas] WITH (NOLOCK)
 WHERE [id_consulta] = @id_consulta
```
(en `updateConsultaProducto`/`deleteConsultaProducto`, que reciben `id_consulta_producto` sin `id_consulta`, se obtiene con un `JOIN`/subselect a `dbo.consulta_productos` por `id_consulta_producto`).

**Cálculo del ajuste de stock al editar** (dentro de una sola `db.transaction`, análogo a spec 16 pero sin cambio de producto — `AddProductoForm`/`ProductoRow` no permiten cambiar el producto de una fila ya creada, solo cantidad/precio/status):

| Transición | Movimiento a aplicar |
|---|---|
| `activo → activo`, cantidad sube (`delta = nueva - vieja > 0`) | mov. `6`, `quantity = delta` |
| `activo → activo`, cantidad baja (`delta < 0`) | mov. `7`, `quantity = abs(delta)` |
| `activo → activo`, cantidad igual | ninguno |
| `activo → inactivo` | mov. `7`, `quantity = cantidad vieja` (reversa completa) |
| `inactivo → activo` | mov. `6`, `quantity = cantidad nueva` (salida completa) |
| `inactivo → inactivo` | ninguno (nunca estuvo descontado) |

**Al eliminar:** si la fila estaba `activo`, mov. `7` con `quantity = cantidad`, antes del `DELETE`. Si estaba `inactivo`, no se aplica movimiento.

**Valores fijos en cada `applyStockMovement`** desde este flujo:

| Campo | Valor |
|---|---|
| `id_product` | `consulta_productos.id_producto` |
| `id_unit_measurement` | `Products.id_stock_unit_measurement` del producto |
| `id_user` | `id_user` del JWT (usuario logueado) |
| `id_consulta` | la consulta dueña de la fila |
| `id_venta`, `unit_cost`, `id_purchase_order_item`, `id_reception` | `null` |
| `notes` | `null` en alta; en reversas por edición/eliminación, texto descriptivo (ej. `"Reversión por edición de producto en consulta #123"` / `"Reversión por eliminación de producto en consulta #123"`) — mismo criterio que spec 16 |

## Plan de implementación

1. **`app/dashboard/ventas/actions.ts`.** Confirmar que `ISaleProduct` está exportado (ya lo está hoy) — sin cambios de código esperados en este paso.

2. **`app/dashboard/pacientes/[id]/consultas/[id_consulta]/actions.ts`:**
   - Eliminar el tipo `ProductoCatalogo` y reescribir `getProductosCatalogo(id_sucursal)` para que llame a `getSaleProducts(id_sucursal)` (importado de `@/app/dashboard/ventas/actions`), devolviendo `ISaleProduct[]`.
   - Agregar un helper `getIdUser()` (mismo patrón que `getIdEmpresa()`) que lea `id_user` del JWT.
   - Reescribir `addConsultaProducto(id_consulta, id_producto, precio, cantidad)` para correr dentro de `db.transaction`: `SELECT` de `id_sucursal`/`id_empresa` de la consulta, `SELECT` de `id_stock_unit_measurement` del producto, `INSERT` a `dbo.consulta_productos` (igual que hoy) y `applyStockMovement` con movimiento `6`, `quantity = cantidad`.
   - Reescribir `updateConsultaProducto(id_consulta_producto, precio, cantidad, status)` para correr dentro de `db.transaction`: `SELECT` con bloqueo (`WITH (UPDLOCK, HOLDLOCK)`) de la fila actual (`id_producto`, `cantidad`, `status`) más `id_sucursal`/`id_empresa` de la consulta dueña, calcular y aplicar el/los `applyStockMovement` según la tabla de transiciones de "Modelo de datos", y luego el `UPDATE` ya existente.
   - Reescribir `deleteConsultaProducto(id_consulta_producto)` para correr dentro de `db.transaction`: `SELECT` con bloqueo de la fila (`id_producto`, `cantidad`, `status`, `id_sucursal`, `id_empresa`), aplicar `applyStockMovement` con movimiento `7` solo si `status = 'activo'`, y luego el `DELETE` ya existente.

2.5. **En `CONSULTA_PRODUCTOS_SELECT`** (mismo archivo): cambiar el `LEFT JOIN [CentroPodologico].[dbo].[productos] p ON p.[id_producto] = cp.[id_producto]` por `LEFT JOIN [CentroPodologico].[inventory].[Products] p ON p.[id_product] = cp.[id_producto]`, y `p.[nombre]` por `p.[name]`. Verificación: `npm run build` no marca `ProductoCatalogo` como usado en ningún otro archivo (buscar referencias antes de borrar el tipo).

3. **`AddProductoForm.tsx`:**
   - Cambiar `catalogo: ProductoCatalogo[]` por `catalogo: ISaleProduct[]` (importado de `../actions`, re-exportado o directamente de `@/app/dashboard/ventas/actions`).
   - `handleSearchChange` compara contra `p.name` en vez de `p.nombre`; al seleccionar, `setPrecio(found.effective_price)`.
   - El `<datalist>` muestra `${p.name} (${p.stock_quantity} en stock)` como label visible, con `value={p.name}` para que el matching siga funcionando.
   - Agregar advertencia visible (no bloqueante) cuando `cantidad > selected.stock_quantity`, mostrando el faltante — mismo texto/estilo que la advertencia de `VentaModal`.

4. **`TabProductos.tsx`:** cambiar `ProductoCatalogo[]` por `ISaleProduct[]` en el estado `catalogo` y en el tipo importado; sin cambios en la lógica de totales (`total`, `onTotalChange`) porque siguen basados en `productos` (`ConsultaProductoExtended`), no en el catálogo.

5. **Verificación manual completa:**
   - Con un producto de categoría "Venta" con stock conocido en la sucursal de una consulta abierta, agregarlo desde `TabProductos`: confirmar que `inventory.stock` baja exactamente la cantidad agregada y que aparece una fila en `inventory.kardex` con `id_movement = 6`, `id_consulta` correcto y `balance_after` coherente.
   - Editar la cantidad hacia arriba y hacia abajo: confirmar movimientos `6`/`7` por la diferencia y que el stock final es consistente.
   - Cambiar el `status` de `activo` a `inactivo` y de vuelta a `activo`: confirmar reversa completa y reaplicación completa respectivamente.
   - Eliminar un producto `activo`: confirmar reversa completa del stock antes del `DELETE`. Eliminar uno `inactivo`: confirmar que no genera movimiento.
   - Agregar una cantidad mayor al stock disponible: confirmar que se advierte en UI pero se permite guardar, dejando stock negativo.
   - Confirmar que el header de `page.tsx` (`Total: $...`) y la sección "Productos utilizados" de `TabGeneral` reflejan correctamente el total tras agregar/editar/eliminar productos.
   - Confirmar que `/dashboard/movimientos` (spec 14) muestra correctamente estas filas de kardex como solo lectura, con `id_consulta` visible.

6. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [x] `getProductosCatalogo(id_sucursal)` devuelve `ISaleProduct[]` llamando internamente a `getSaleProducts`; el tipo `ProductoCatalogo` ya no existe en el código.
- [x] El buscador de `AddProductoForm` solo lista productos de `inventory.Products` con categoría "Venta" (`id_category = 4`), activos, de la empresa del usuario — ningún producto de `dbo.productos` aparece.
- [x] Al seleccionar un producto en `AddProductoForm`, el precio unitario se autocompleta con el `effective_price` (`sale_price` si `split = 1`, si no `price`) y el campo permanece de solo lectura, igual que hoy.
- [x] Cada opción del buscador muestra el stock disponible en la sucursal de la consulta.
- [x] Agregar un producto a la consulta descuenta `inventory.stock` de la sucursal de la consulta exactamente en la cantidad capturada, y genera **una** fila en `inventory.kardex` con `id_movement = 6`, `id_consulta` igual a la consulta actual y `id_venta = NULL`.
- [x] Editar la cantidad de un producto ya agregado (sin cambiar `status`) genera un movimiento `6` adicional si sube o un movimiento `7` si baja, dejando el stock final consistente con la cantidad nueva.
- [x] Cambiar el `status` de un producto de `activo` a `inactivo` revierte por completo el stock que había descontado (movimiento `7`); volver a `activo` lo vuelve a descontar por completo (movimiento `6`).
- [x] Eliminar un producto `activo` revierte por completo su stock (movimiento `7`) antes del `DELETE`; eliminar uno `inactivo` no genera ningún movimiento.
- [x] Si la cantidad agregada o editada deja el stock de la sucursal en negativo, la UI muestra una advertencia visible pero permite guardar.
- [x] Toda escritura de stock/kardex de este flujo (alta, edición, eliminación) ocurre dentro de una única `db.transaction` junto con el cambio a `dbo.consulta_productos`; si el movimiento de stock falla, la fila de `consulta_productos` no se inserta/actualiza/elimina.
- [x] `id_empresa`, `id_user` y `id_sucursal` usados en `applyStockMovement` se resuelven server-side (JWT y `dbo.consultas`), nunca se reciben como parámetro confiado del cliente.
- [x] El total mostrado en `TabProductos` ("Total productos"), en el header de `page.tsx` ("Total: $...") y en "Productos utilizados" de `TabGeneral` reflejan correctamente los productos agregados/editados/eliminados, sin cambios adicionales de código más allá de los ya conectados.
- [x] `/dashboard/movimientos` (spec 14) muestra correctamente, como solo lectura, las filas de kardex generadas desde este flujo. *(las filas aparecen correctamente; `id_consulta` específicamente no se expone como columna — gap preexistente documentado en "Riesgos identificados", aceptado por el usuario.)*
- [x] `dbo.productos`/`ProductoCatalogo` quedan sin ningún consumidor en el código tras este spec.
- [x] `nombre_producto` se resuelve correctamente para productos agregados desde este spec en adelante (vía `inventory.Products`).
- [x] La página se ve correctamente en modo claro y oscuro, consistente con el resto de la consulta.
- [x] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Se reutiliza `getSaleProducts` (spec 16) en vez de duplicar el `SELECT`.** El shape necesario (categoría "Venta", precio efectivo, stock por sucursal) es idéntico al de Ventas; duplicarlo habría violado la convención de reuso de `CLAUDE.md` sin ningún beneficio, y mantiene un solo punto de verdad para "qué es un producto vendible".
- **Se reutiliza el movimiento `6` "Salida por venta", ligado por `id_consulta` en vez de `id_venta`.** Conceptualmente es una venta de producto al paciente, solo que se cobra vía `consulta_productos` en lugar de `dbo.Ventas`. Crear un movimiento nuevo (ej. "Salida por venta en consulta") duplicaría semántica sin beneficio de reporte real, y `kardex.id_consulta` (spec 13) ya es la columna correcta para trazar el origen.
- **`id_sucursal` se resuelve desde `dbo.consultas`, no desde `SucursalContext`.** La consulta ya tiene su propia sucursal guardada (`id_sucursal`), que es la fuente de verdad de dónde ocurrió — usar el contexto del header sería incorrecto si el usuario navega a otra sucursal mientras la consulta sigue abierta.
- **Cambiar `status` de `activo`/`inactivo` se trata como reversa/reaplicación completa de stock.** Se descartó dejarlo sin efecto en stock porque `status = 'inactivo'` ya excluye la fila del cobro (aunque hoy el cálculo de "Total productos" no filtra por status — comportamiento preexistente fuera de este spec); dejar el stock descontado para un producto marcado inactivo generaría un descuento fantasma sin cobro asociado.
- **No se permite cambiar el producto de una fila ya creada.** A diferencia de Ventas (spec 16), `ProductoRow` nunca expuso edición del producto, solo cantidad/precio/status — no se agrega esa capacidad aquí por estar fuera del alcance solicitado; si se necesita a futuro, es un spec propio con su propio cálculo de reversa+alta como en Ventas.
- **Transaccional en las tres operaciones (alta, edición, eliminación), no best-effort.** A diferencia de spec 13 (consumo automático, best-effort porque no debe bloquear el registro clínico), aquí el producto es una venta explícita que el usuario está capturando activamente — igual que Ventas, si el movimiento de stock falla, la operación completa debe fallar para no dejar cobro sin descuento o viceversa.
- **Stock negativo permitido con advertencia, no bloqueo.** Mismo criterio ya adoptado en spec 14 y spec 16: bloquear dejaría a la podóloga atorada ante un desfase de stock que probablemente ya existía, en vez de dejar constancia y permitir continuar la atención.
- **No se migran ni se tocan consultas históricas que ya tienen productos de `dbo.productos`.** Igual que spec 16 con `dbo.Ventas`: no hay backfill; esas filas antiguas quedan con `nombre_producto` sin resolver tras el cambio del `JOIN` (ver riesgo correspondiente).

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| **Productos históricos de consultas quedan sin nombre.** Al cambiar el `JOIN` de `dbo.productos` a `inventory.Products`, cualquier fila de `consulta_productos` capturada antes de este spec (con `id_producto` apuntando a `dbo.productos`) se mostrará como `#id` sin nombre resuelto. | Aceptado, mismo criterio que spec 16 con `dbo.Ventas`: no hay backfill porque el dato histórico no es correlacionable de forma confiable entre ambas tablas de producto. El monto (`precio × cantidad`) sigue correcto porque está guardado como snapshot en `consulta_productos`, solo se pierde el nombre. |
| **Concurrencia en edición/eliminación.** El `SELECT ... WITH (UPDLOCK, HOLDLOCK)` reduce el riesgo, pero si dos usuarios editan la misma fila casi simultáneamente, el segundo espera al primero — no hay optimistic locking adicional. | Mismo riesgo ya aceptado en spec 16 para Ventas; el bloqueo pesimista es suficiente para el volumen de uso de este flujo. |
| **`inventory.Products` sin productos de categoría "Venta" cargados en una sucursal.** El buscador de `AddProductoForm` aparecerá vacío hasta que se capturen productos en `/dashboard/productos` con esa categoría. | No es un bug de este spec — mismo riesgo ya documentado en spec 16 para Ventas, ahora también visible desde Consultas. |
| **Stock negativo acumulado.** Permitir cantidades que superan el stock disponible puede acumular saldos negativos que distorsionan los sugeridos de pedido (spec 11). | Visible en `/dashboard/pedidos/nuevo` y en `/dashboard/movimientos`; se corrige con un ajuste manual. Mismo criterio ya aceptado en spec 14/16. |
| **`id_stock_unit_measurement` sin capturar en el producto.** Si el producto no tiene unidad de stock definida, el kardex graba `id_unit_measurement = NULL`. | No bloquea el descuento (`quantity` sigue correcta en unidades de stock); deuda heredada de spec 09, no introducida aquí. |
| **Reversas por cambios de `status` "van y vienen" quedan ruidosas en el kardex.** Marcar `inactivo`/`activo` varias veces sobre el mismo producto genera una fila `6`/`7` por cada transición. | El saldo final es correcto; mismo riesgo ya aceptado en spec 14/16 para ajustes manuales encadenados. |
| **`/dashboard/movimientos` no expone `id_venta`/`id_consulta` en ninguna columna de la UI.** El criterio de aceptación pide `id_consulta` visible, pero `IStockMovementListItem`/el `SELECT` de `app/dashboard/movimientos/actions.ts` nunca incluyeron esos campos (ni columna dedicada, ni en "Origen/Destino", que es solo para traspasos) — gap preexistente de spec 14/16, no introducido por este spec. Verificado con `getStockMovements`: solo `notes` referencia el origen en texto libre (ej. "Reversión por edición de producto en consulta #278"), nunca como columna estructurada. | Aceptado por el usuario como riesgo preexistente, no bloqueante para este spec — se deja fuera de alcance (ver "No incluye"). Si se requiere resolver, es un ajuste propio a `/dashboard/movimientos` (spec 14/16), no de este spec. |
