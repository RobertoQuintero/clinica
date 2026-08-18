# 20 — IVA por línea en pedidos de compra

## Header

- **Estado:** Aprobado
- **Depende de:** [[09-pedidos-compra-recepcion]] (`inventory.purchase_order_items`, `PurchaseCartContext`, `/dashboard/pedidos/nuevo`, `createPurchaseOrders`), [[18-plantillas-de-pedido]] (`replaceLines`, carga de plantillas)
- **Fecha:** 2026-08-17
- **Objetivo:** Permitir marcar por línea, al armar un pedido, si un producto tiene IVA o no, y calcular/mostrar el IVA de la orden solo sobre las líneas marcadas en vez de aplicarlo de forma plana al 16% sobre todo el subtotal.

## Alcance

**Incluye:**
- **Nuevo campo `applies_iva` (boolean) en `IPurchaseCartLine`** (`contexts/PurchaseCartContext.tsx`), con default `true` al agregar un producto al carrito (`toggleProduct`). Nueva función `setLineAppliesIva(id_product, applies_iva)` en el contexto.
- **Toggle "Tiene IVA" por línea** en `SuggestedProductsTable.tsx` (columna nueva junto a Precio unit.) y en `SupplierOrderGroup.tsx` (revisión), habilitado solo cuando la línea está seleccionada, igual que cantidad/precio.
- **Recalculo del IVA por línea**, no plano sobre todo el subtotal: `PurchaseCartSummary.tsx`, `revision/page.tsx`, `SupplierOrderGroup.tsx` (subtotal por línea sigue sin IVA) y el server action `createPurchaseOrders`. El IVA de la orden = Σ(`quantity × unit_price × 16%`) solo de las líneas con `applies_iva = true`.
- **Persistencia por línea**: nuevas columnas `applies_iva bit NOT NULL DEFAULT 1` y `tax_amount decimal(18,2) NOT NULL DEFAULT 0` en `inventory.purchase_order_items`, calculadas/validadas en el servidor (nunca desde el cliente).
- **Detalle de orden** (`/dashboard/pedidos/[id]/page.tsx`): badge por línea ("IVA" / "Exento") en la tabla "Productos pedidos", consistente con lo capturado al armar el pedido.
- **Envío del flag al server action**: `ICreatePurchaseOrderLineInput` y `createPurchaseOrders` reciben `applies_iva` por línea, y el servidor recalcula `tax`/`total` de cada orden sumando solo el IVA de las líneas marcadas (nunca confía en el `tax`/`total` que mandara el cliente, igual que ya hace con `subtotal`).

**No incluye:**
- Ningún cambio a `inventory.Products` ni al formulario de productos (`/dashboard/productos`) — el flag es una decisión manual por línea de pedido, no un atributo del catálogo (decidido en la Fase 2).
- Cambios a `purchase_order_template_items` ni a la lógica de plantillas (spec 18) — al usar una plantilla, todas las líneas cargadas entran con `applies_iva = true` por default, igual que hoy se recalcula `unit_price` desde el catálogo actual y no desde la plantilla.
- Cambios al flujo de recepción (`/dashboard/recepciones`) — la recepción ya no toca montos/IVA, solo cantidades recibidas.
- IVA por línea en ningún otro módulo del sistema (ventas, consultas) — queda acotado a `/dashboard/pedidos`.
- Tasas de IVA distintas de 16% o exenciones parciales — el toggle es binario (aplica el 16% completo o no aplica nada), `tax_rate` de la orden sigue siendo un único valor de 16% ya existente.
- Migrar o recalcular órdenes ya generadas antes de este cambio — sus totales quedan como están; el nuevo comportamiento aplica solo a órdenes creadas después del cambio.

## Modelo de datos

**Cambio a tabla existente — `inventory.purchase_order_items`:**

```sql
ALTER TABLE [CentroPodologico].[inventory].[purchase_order_items]
  ADD [applies_iva] [bit] NOT NULL DEFAULT 1,
      [tax_amount]  [decimal](18,2) NOT NULL DEFAULT 0;
```

- `applies_iva`: si esta línea paga IVA. Default `1` para no alterar el comportamiento de nada creado antes de este cambio (aunque, como aclara el alcance, este spec no recalcula órdenes viejas).
- `tax_amount`: `round2(quantity * unit_price * tax_rate / 100)` si `applies_iva = 1`, si no `0`. Se calcula y persiste en el servidor junto con `line_total`, para que el detalle de la orden pueda mostrar el badge sin tener que recalcular en cliente.

**`interfaces/purchase_order.ts` — `IPurchaseOrderItem`:**

```ts
export interface IPurchaseOrderItem {
  id_purchase_order_item: number;
  id_purchase_order:      number;
  id_product:              number;
  product_name:            string | null;
  product_code:            string | null;
  brand:                   string | null;
  id_unit_measurement:    number | null;
  conversion_factor:      number;
  quantity:                number;
  quantity_received:      number;
  unit_price:              number;
  discount:                number;
  line_total:              number;
  applies_iva:             boolean; // nuevo
  tax_amount:               number; // nuevo
  created_at:              Date | string;
}
```

**`contexts/PurchaseCartContext.tsx` — `IPurchaseCartLine`:**

```ts
export interface IPurchaseCartLine {
  id_product:          number;
  product_name:        string;
  product_code:        string;
  brand:               string;
  id_unit_measurement: number | null;
  id_supplier:         number | null;
  pieces:               number | null;
  split:                boolean;
  quantity:             number;
  unit_price:           number;
  applies_iva:          boolean; // nuevo, default true en toggleProduct
}
```

Nuevo método del contexto: `setLineAppliesIva(id_product: number, applies_iva: boolean): void`.

**`app/dashboard/pedidos/actions.ts` — `ICreatePurchaseOrderLineInput`:**

```ts
interface ICreatePurchaseOrderLineInput {
  id_product:   number;
  id_supplier:  number | null;
  quantity:     number;
  unit_price:   number;
  applies_iva:  boolean; // nuevo
}
```

`createPurchaseOrders` recalcula por orden (agrupada por proveedor):

```ts
const lineTaxAmount = item.applies_iva ? round2(lineTotal * (TAX_RATE / 100)) : 0;
// ...
const tax = round2(itemsToInsert.reduce((sum, item) => sum + item.lineTaxAmount, 0));
const total = round2(subtotal + tax); // subtotal sigue sin IVA, sin cambios
```

## Plan de implementación

1. **Esquema en BD.** Ejecutar `ALTER TABLE inventory.purchase_order_items ADD applies_iva bit NOT NULL DEFAULT 1, tax_amount decimal(18,2) NOT NULL DEFAULT 0` directamente contra la base, y anexar el DDL a `queries.txt`. *Verificación:* `SELECT applies_iva, tax_amount FROM inventory.purchase_order_items` responde sin error, con `1`/`0` en las filas existentes.

2. **Interfaces.** Agregar `applies_iva: boolean` y `tax_amount: number` a `IPurchaseOrderItem` (`interfaces/purchase_order.ts`) y `applies_iva: boolean` a `IPurchaseCartLine` (`contexts/PurchaseCartContext.tsx`). Sistema funcional (nada lo usa aún).

3. **`PurchaseCartContext.tsx`.** En `toggleProduct`, agregar `applies_iva: true` al construir `newLine`. Agregar `setLineAppliesIva(id_product, applies_iva)` que actualiza esa línea (mismo patrón que `setLineUnitPrice`), y exponerlo en el contexto. *Verificación:* `npm run build` compila.

4. **`SuggestedProductsTable.tsx`.** Agregar columna "IVA" (checkbox o toggle pequeño) entre "Precio unit." y "Subtotal", deshabilitada cuando la línea no está seleccionada (mismo criterio que cantidad/precio), usando `line?.applies_iva ?? true` como valor y `setLineAppliesIva` en el `onChange`.

5. **`SupplierOrderGroup.tsx`.** Agregar el mismo toggle "Tiene IVA" junto al precio unitario de cada línea, usando `setLineAppliesIva` del contexto (ya se importa `usePurchaseCart` ahí).

6. **Recalculo del resumen en cliente.** En `PurchaseCartSummary.tsx` y `revision/page.tsx`: `tax = lines.reduce((sum, line) => sum + (line.applies_iva ? round2(line.quantity * line.unit_price * TAX_RATE / 100) : 0), 0)` en vez de `subtotal * TAX_RATE / 100`; `subtotal` no cambia. Extraer `round2` a un helper compartido (p. ej. `utils/`) reutilizado por ambos archivos y por el server action, en vez de triplicar la función redondeando distinto en cada lugar.

7. **`app/dashboard/pedidos/actions.ts` — `createPurchaseOrders`.** Agregar `applies_iva` a `ICreatePurchaseOrderLineInput`; al construir `itemsToInsert`, calcular `lineTaxAmount` por línea (paso descrito en "Modelo de datos"); `tax` de cada orden = suma de `lineTaxAmount` de sus líneas (ya no `subtotal * TAX_RATE / 100`); incluir `applies_iva` y `tax_amount` en el `INSERT` de `purchase_order_items`.

8. **`revision/page.tsx` — envío del carrito.** En `handleGenerateOrder`, incluir `applies_iva: line.applies_iva` en el `lines.map(...)` que arma el input de `createPurchaseOrders`.

9. **`app/dashboard/pedidos/[id]/page.tsx`.** Agregar columna/badge "IVA" en la tabla "Productos pedidos": `item.applies_iva ? <span>IVA</span> : <span>Exento</span>`, mismo estilo de badge ya usado en la página (`categoryNameById`/badges existentes como referencia).

10. **Verificación manual completa:**
    - Armar un carrito con productos de un mismo proveedor, algunos con IVA y otros sin IVA; confirmar que el resumen (`PurchaseCartSummary`) calcula el IVA solo sobre las líneas marcadas.
    - Ir a revisión: cambiar el toggle de una línea ahí y confirmar que el resumen se actualiza.
    - Generar la orden: en BD, `purchase_order_items.applies_iva`/`tax_amount` quedan correctos por línea, y `purchase_orders.tax`/`total` coinciden con la suma esperada.
    - Abrir el detalle de la orden: el badge por línea coincide con lo capturado, y el desglose de IVA del total es correcto.
    - Cargar una plantilla (spec 18) al carrito: todas las líneas entran con IVA por default.
    - Revisar modo claro y oscuro.

11. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [ ] `inventory.purchase_order_items` tiene las columnas `applies_iva bit NOT NULL DEFAULT 1` y `tax_amount decimal(18,2) NOT NULL DEFAULT 0`, y el `ALTER TABLE` quedó anexado a `queries.txt`.
- [ ] En `/dashboard/pedidos/nuevo` (pestaña "Sugeridos"/"Todos"), cada línea seleccionada del carrito muestra un toggle "Tiene IVA", con `true` por default al agregarla.
- [ ] Cambiar el toggle de una línea en `SuggestedProductsTable` se refleja de inmediato en el desglose de IVA de `PurchaseCartSummary`.
- [ ] En la pantalla de revisión (`/dashboard/pedidos/nuevo/revision`), cada línea también muestra y permite cambiar el toggle "Tiene IVA", y el resumen del pedido se recalcula en vivo.
- [ ] El IVA mostrado en ambos resúmenes es la suma de `quantity × unit_price × 16%` **solo** de las líneas con `applies_iva = true`; el subtotal sigue siendo la suma de todas las líneas sin IVA.
- [ ] `createPurchaseOrders` recalcula `tax`/`total` en el servidor a partir de `applies_iva` por línea (nunca confía en un `tax`/`total` enviado por el cliente), y guarda `applies_iva`/`tax_amount` en cada fila de `purchase_order_items`.
- [ ] `/dashboard/pedidos/[id]` muestra un badge por línea ("IVA" / "Exento") consistente con lo capturado al generar la orden, y el desglose de IVA del total sigue siendo correcto.
- [ ] Cargar una plantilla de pedido (spec 18) al carrito deja todas las líneas con `applies_iva = true`, sin leer ni escribir nada en `purchase_order_template_items`.
- [ ] `inventory.Products` y el formulario de `/dashboard/productos` no tienen ningún cambio relacionado a este spec.
- [ ] Órdenes generadas antes de este cambio no se recalculan ni se les asigna retroactivamente `applies_iva`/`tax_amount` distinto del default.
- [ ] Los nombres de funciones, variables, componentes y tipos nuevos están en inglés y son descriptivos, conforme a `CLAUDE.md`.
- [ ] Las pantallas se ven correctamente en modo claro y oscuro.
- [ ] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Toggle manual por línea de pedido, no atributo del catálogo (`inventory.Products`).** Se descartó agregar `has_iva` al producto porque el mismo producto puede comprarse con o sin IVA según el proveedor/factura de esa compra en particular; fijarlo en el catálogo obligaría a mantenerlo sincronizado con cada pedido real. El costo es que hay que marcarlo cada vez, pero es consistente con que `unit_price` y `id_supplier` ya son decisiones por línea de pedido, no del catálogo.
- **IVA calculado por línea y sumado, no como un único 16% sobre un subtotal filtrado.** Ambas dan el mismo resultado numérico, pero calcular y persistir `tax_amount` por línea permite mostrar el badge en el detalle de la orden sin recalcular, y dificulta que un futuro cambio (p. ej. tasas distintas por línea) tenga que reescribir la lógica desde cero.
- **Default `applies_iva = true`.** Mantiene el comportamiento actual (todo paga IVA) como caso base; el usuario "opta por sacar" un producto del IVA en vez de tener que marcarlo activamente en cada pedido, que sería el caso más frecuente según el fraseo de la petición ("puede o no tener IVA").
- **Plantillas de pedido no guardan `applies_iva`.** Sigue el mismo criterio ya establecido en el spec 18 para `unit_price`: una plantilla es una intención de compra recurrente, y si esa compra en particular lleva IVA o no es una decisión de esa transacción, no de la plantilla. Guardar y no guardar `unit_price` pero sí `applies_iva` habría sido inconsistente.
- **Toggle binario (aplica el 16% completo o cero), sin tasas parciales ni por producto.** El pedido de la persona usuaria es "puede o no tener IVA", no una tasa configurable; introducir tasas por línea es una ampliación de alcance no solicitada y complica el modelo de datos sin necesidad actual.
- **Sin recalcular órdenes históricas.** Las órdenes ya generadas no tienen `applies_iva`/`tax_amount` reales por línea (nacen en `1`/`0` por el `DEFAULT`); recalcularlas retroactivamente implicaría decidir, sin información real, qué líneas antiguas "debieron" o no llevar IVA — se deja como están.

## Riesgos identificados

- **Órdenes históricas con `tax_amount` que no refleja la realidad.** Todas las líneas creadas antes de este cambio quedan con `applies_iva = 1` y `tax_amount = 0` por el `DEFAULT`, mientras que `purchase_orders.tax` de esas mismas órdenes sí tiene un valor real (calculado con el 16% plano de antes). Si algo llega a sumar `tax_amount` de líneas históricas esperando que cuadre con `purchase_orders.tax`, no va a coincidir. Se acepta porque este spec no reconstruye historia; cualquier reporte futuro que cruce ambos campos debe filtrar por fecha de este cambio.
- **Usuario olvida desmarcar una línea sin IVA.** Como el default es `true`, el riesgo operativo es el opuesto al de antes: en vez de "todo paga IVA sin poder evitarlo", ahora alguien puede olvidar marcar una línea que sí debía ir exenta. Se mitiga con el toggle visible en dos pantallas (armado y revisión), pero no hay validación de negocio que lo fuerce — es una decisión humana, como ya lo son cantidad y precio.
- **Redondeo por línea vs. redondeo sobre el total.** Sumar `tax_amount` ya redondeados por línea puede diferir en centavos de calcular `subtotal_con_iva × 16%` de una sola vez, especialmente con muchas líneas pequeñas. Es una discrepancia de centavos aceptable y estándar en facturación línea por línea; se documenta aquí para que no se lea como un bug si alguien lo nota.
- **Tres lugares (cliente en dos pantallas + servidor) recalculando la misma fórmula.** Si algún cambio futuro toca la fórmula de IVA y solo se actualiza uno de los tres sitios, el resumen mostrado en pantalla se desincroniza del total realmente guardado (aunque el servidor sigue siendo la fuente de verdad para lo persistido). El paso 6 del plan mitiga esto extrayendo un `round2` compartido, pero la fórmula de "sumar solo líneas con IVA" queda duplicada por diseño (cliente para feedback inmediato, servidor por seguridad) — no se centraliza en una sola función cliente/servidor porque el server action ya vive en un archivo `"use server"` separado del cliente.
