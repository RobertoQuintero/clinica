# 10 — Método de pago en pedidos de compra

## Header

- **Estado:** Aprobado
- **Depende de:** [[09-pedidos-compra-recepcion]] (`inventory.purchase_orders`, `createPurchaseOrders`, `PurchaseCartContext`, `SupplierOrderGroup`), catálogo existente `dbo.metodos_pago` (usado hoy en Ventas)
- **Fecha:** 2026-08-13
- **Objetivo:** Agregar la selección obligatoria de método de pago por proveedor en la pantalla de revisión de pedidos, guardándolo en la orden de compra generada.

## Alcance

**Incluye:**

- Un `<select>` de método de pago dentro de `SupplierOrderGroup.tsx`, junto al nombre del proveedor, poblado desde el catálogo existente `dbo.metodos_pago` (los mismos que usa Ventas: Efectivo, Tarjeta, Transferencia, etc.), filtrado a `activo = 1` y `eliminado = 0`.
- `getMetodosPagos()` (ya existe en `app/dashboard/ventas/actions.ts`) reutilizada desde `revision/page.tsx` — no se duplica la consulta.
- Estado nuevo `paymentMethodBySupplier: Record<number, number>` (clave `id_supplier`, valor `idMetodoPago`) en `PurchaseCartContext`, con su setter `setSupplierPaymentMethod(id_supplier, idMetodoPago)`, persistido en `sessionStorage` junto con `lines`/`estimatedDate`/`notes`, y limpiado en `clearCart()`.
- El botón "Generar Orden de Compra" se deshabilita (mismo patrón que `hasLineWithoutSupplier`) si algún grupo de proveedor no tiene método de pago asignado.
- Nueva columna `id_metodo_pago int NULL` en `inventory.purchase_orders` (FK lógica a `dbo.metodos_pago`, cross-schema como ya hace el join con `dbo.users` en `getPurchaseOrderById`).
- `createPurchaseOrders` recibe el mapa proveedor→método de pago, valida que cada proveedor con líneas tenga uno asignado (rechazo en servidor, no solo en UI) y lo persiste en el `INSERT` de cada orden.
- `getPurchaseOrders` / `getPurchaseOrderById` devuelven `id_metodo_pago` y la descripción del método (`JOIN` a `dbo.metodos_pago`).
- El detalle de la orden (`/dashboard/pedidos/[id]`) muestra el método de pago junto a los demás datos del encabezado (junto a proveedor/totales).

**No incluye:**

- Edición del método de pago después de creada la orden — es fijo, igual que subtotal/tax/total; para corregirlo se cancela y se rehace (regla ya existente).
- Método de pago por línea — es uno solo por orden/proveedor.
- Un catálogo nuevo de métodos de pago específico de compras — se reutiliza `dbo.metodos_pago` tal cual.
- Cambios al flujo de estados (`Pedido → Enviado → Recepción`) ni a la lógica de recepción/kardex — el método de pago es un dato informativo del encabezado, no dispara ninguna transición.
- Selector de método de pago en `/dashboard/pedidos/nuevo` (armado) — se captura únicamente en la revisión, donde ya existe el agrupado por proveedor.

## Modelo de datos

**`inventory.purchase_orders`** — se agrega una columna:

| Columna | Tipo | Notas |
|---|---|---|
| `id_metodo_pago` | `int` NULL | FK lógica a `dbo.metodos_pago.idMetodoPago` (cross-schema, sin FK real — mismo patrón que las demás referencias a catálogos en este módulo). Se congela al generar la orden y no se vuelve a tocar. |

No se crean tablas nuevas: se reutiliza `dbo.metodos_pago` (`idMetodoPago`, `descripcion`, `clave`, `eliminado`, `activo`) tal cual existe hoy para Ventas.

**`interfaces/purchase_order.ts`** — `IPurchaseOrder` agrega `id_metodo_pago: number | null`; `IPurchaseOrderDetailView`/`IPurchaseOrderListItem` (en `app/dashboard/pedidos/actions.ts`) agregan `metodo_pago_descripcion: string | null` para mostrar sin un `JOIN` extra en la UI.

**`contexts/PurchaseCartContext.tsx`** — nuevo estado:

```ts
paymentMethodBySupplier: Record<number, number>; // id_supplier -> idMetodoPago
setSupplierPaymentMethod: (id_supplier: number, idMetodoPago: number) => void;
```

Persistido en el mismo objeto de `sessionStorage` (`{ lines, estimatedDate, notes, paymentMethodBySupplier }`) y reseteado a `{}` en `clearCart()`.

**`ICreatePurchaseOrdersInput`** (`app/dashboard/pedidos/actions.ts`) agrega:

```ts
paymentMethodBySupplier: Record<number, number>;
```

## Plan de implementación

1. **Base de datos**: `ALTER TABLE inventory.purchase_orders ADD id_metodo_pago int NULL`. Ejecutarlo directamente contra la BD y anexarlo a `queries.txt`, siguiendo la convención del repo (sin migraciones).
2. **`interfaces/purchase_order.ts`**: agregar `id_metodo_pago: number | null` a `IPurchaseOrder`.
3. **`contexts/PurchaseCartContext.tsx`**: agregar `paymentMethodBySupplier` y `setSupplierPaymentMethod`, incluirlos en la carga/guardado de `sessionStorage` y en el reset de `clearCart()`.
4. **`app/dashboard/pedidos/nuevo/revision/page.tsx`**:
   - Cargar los métodos de pago con `getMetodosPagos()` (importado desde `app/dashboard/ventas/actions.ts`) junto a `getSuppliers`/`getUnitsMeasurement`.
   - Pasar a cada `SupplierOrderGroup` el método de pago actual del grupo, la lista de métodos disponibles y el setter.
   - Nuevo guard `hasSupplierWithoutPaymentMethod` (mismo patrón que `hasLineWithoutSupplier`) que deshabilita "Generar Orden de Compra" y muestra el mismo tipo de mensaje bajo el botón.
   - Incluir `paymentMethodBySupplier` en el payload que arma `handleGenerateOrder` para `createPurchaseOrders`.
5. **`SupplierOrderGroup.tsx`**: agregar un `<select>` de método de pago junto al nombre del proveedor (en la tarjeta del encabezado del grupo, no por línea), con las mismas clases/estilo que el `<select>` de proveedor por línea. Nuevas props: `paymentMethods: IMetodoPago[]`, `selectedPaymentMethodId: number | null`, `onPaymentMethodChange: (idMetodoPago: number) => void`.
6. **`createPurchaseOrders`** (`app/dashboard/pedidos/actions.ts`):
   - Recibe `paymentMethodBySupplier` en `ICreatePurchaseOrdersInput`.
   - Antes de la transacción, valida que cada `id_supplier` presente en `linesBySupplier` tenga una entrada en `paymentMethodBySupplier`; si falta alguno, rechaza con mensaje explícito (regla de servidor, no solo UI).
   - Incluye `id_metodo_pago` en el `INSERT` de `purchase_orders` de cada proveedor.
7. **`getPurchaseOrders`/`getPurchaseOrderById`**: agregar `po.[id_metodo_pago]` y `mp.[descripcion] AS metodo_pago_descripcion` con `LEFT JOIN [CentroPodologico].[dbo].[metodos_pago] mp ON mp.[idMetodoPago] = po.[id_metodo_pago]` (LEFT JOIN porque las órdenes creadas antes de este spec tendrán `id_metodo_pago = NULL`).
8. **`app/dashboard/pedidos/[id]/page.tsx`**: mostrar `metodo_pago_descripcion` en el encabezado de la orden, junto al proveedor (fila "Método de pago: —" si es `NULL`, para las órdenes históricas).
9. **`app/dashboard/pedidos/componentes/PurchaseOrderRow.tsx`**: revisar si el listado también debe mostrar el método de pago — se agrega solo si hay espacio sin saturar la fila (a criterio del layout existente).
10. Verificación manual: generar un pedido multiproveedor sin elegir método de pago en un grupo → botón deshabilitado; elegir método distinto por proveedor → generar → confirmar en el detalle de cada orden que el método guardado corresponde al proveedor correcto.
11. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [ ] `revision/page.tsx` muestra un selector de método de pago por cada grupo de proveedor, poblado desde `dbo.metodos_pago` (activos, no eliminados).
- [ ] El método de pago elegido persiste en `sessionStorage` vía `PurchaseCartContext` y sobrevive la navegación entre armado y revisión (si el usuario vuelve a `/nuevo` y regresa a `/revision`).
- [ ] "Generar Orden de Compra" está deshabilitado si algún proveedor con líneas en el carrito no tiene método de pago asignado, con el mismo tratamiento visual que el guard de proveedor faltante.
- [ ] `createPurchaseOrders` rechaza la generación en servidor si falta el método de pago para algún proveedor, incluso si se manipula la petición para saltarse el guard de UI.
- [ ] Cada orden generada guarda el `id_metodo_pago` correspondiente a su proveedor; dos proveedores distintos en el mismo carrito pueden quedar con métodos de pago distintos.
- [ ] El detalle de la orden (`/dashboard/pedidos/[id]`) muestra la descripción del método de pago guardado.
- [ ] Las órdenes creadas antes de este cambio (con `id_metodo_pago = NULL`) se siguen mostrando sin error, con el método de pago en blanco/guion.
- [ ] El método de pago no es editable desde el detalle de la orden una vez generada.
- [ ] Las pantallas se ven correctamente en modo claro y oscuro.
- [ ] `npm run build` sin errores.

## Decisiones tomadas y descartadas

- **Reutilizar `dbo.metodos_pago` en vez de un catálogo nuevo.** Es el mismo concepto de negocio (efectivo, tarjeta, transferencia) que ya usa Ventas; duplicar el catálogo solo para compras generaría dos fuentes de verdad que divergirían con el tiempo. El costo aceptado es una referencia cross-schema (`inventory.purchase_orders` → `dbo.metodos_pago`), pero el propio módulo ya hace esto con `dbo.users` en `getPurchaseOrderById`.
- **Método de pago por orden/proveedor, no por línea.** Coincide con el pedido explícito del usuario ("para cada proveedor") y con el resto del modelo: `subtotal`/`tax`/`total` ya son por orden, no por línea, así que agregar granularidad por línea aquí rompería esa consistencia sin un caso de uso que lo pida.
- **Obligatorio en servidor, no solo en UI.** Igual que la regla de proveedor asignado por línea (`hasLineWithoutSupplier` en cliente + validación en `createPurchaseOrders`), un guard solo de UI es evitable manipulando la petición. Se valida en las dos capas.
- **Selector en `revision/page.tsx`, no en `/nuevo`.** El armado (`/nuevo`) trabaja con líneas sueltas sin agrupar por proveedor; la revisión ya agrupa y muestra una tarjeta por proveedor (`SupplierOrderGroup`), que es el lugar natural para una decisión que es "por proveedor".
- **Fijo tras generar la orden, sin acción de edición posterior.** Se descartó agregar una acción `updatePurchaseOrderPaymentMethod` porque el resto del encabezado (montos, proveedor) ya es inmutable tras la creación con la única vía de corrección "cancelar y rehacer" (regla existente de [[09-pedidos-compra-recepcion]]); introducir edición solo para este campo rompería esa consistencia sin necesidad clara.
- **Mapa `paymentMethodBySupplier` separado en el contexto, no repetido dentro de cada línea.** Guardarlo por línea duplicaría el mismo valor N veces (una por producto del proveedor) y abriría la posibilidad de que dos líneas del mismo proveedor terminen con métodos distintos por un bug, contradiciendo la regla de "uno por proveedor".
- **`LEFT JOIN` (no `INNER JOIN`) contra `dbo.metodos_pago` en las lecturas.** Las órdenes creadas antes de este spec tienen `id_metodo_pago = NULL`; un `INNER JOIN` las excluiría silenciosamente del historial.

## Riesgos identificados

- **Órdenes existentes con `id_metodo_pago = NULL`.** Todas las órdenes generadas antes de este spec quedan sin método de pago; no hay forma de inferirlo retroactivamente, así que el detalle debe tolerar el valor nulo sin romperse (ya cubierto en criterios de aceptación).
- **Catálogo compartido con Ventas.** Si alguien desactiva o elimina un método de pago en `dbo.metodos_pago` porque ya no aplica a compras, también deja de estar disponible en Ventas (y viceversa). No se separa el catálogo en este spec porque el usuario decidió reutilizarlo tal cual; si en el futuro surge la necesidad de métodos exclusivos de compras (ej. "Crédito a 30 días"), se resolverá en un spec aparte.
