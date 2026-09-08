# 44 — Corrección: stock mínimo/máximo efectivo vs. piezas por unidad

## Header

- **Estado:** Implementado
- **Depende de:** [[11-min-stock-por-sillones]] (fórmula de `min_stock_effective` que este spec corrige), [[42-producto-max-stock]] (misma corrección aplica a `max_stock_effective`), [[09-pedidos-compra-recepcion]] (`conversion_factor`/`conversionFactor`, recepciones que incrementan `stock.quantity` en piezas)
- **Modifica base de datos:** No.
- **Fecha:** 2026-09-07
- **Objetivo:** Corregir `min_stock_effective` y `max_stock_effective` en `getSuggestedProducts` para que, en productos `split` (con piezas por unidad), se comparen contra `current_stock` en la misma unidad (piezas), multiplicando ambos por `conversionFactor` — hoy un producto puede mostrarse "por encima del mínimo" tras recibir menos unidades de las esperadas, porque el mínimo se compara en unidades de compra contra un stock que está en piezas.

## Alcance

**Incluye:**

- **`getSuggestedProducts`** (`app/dashboard/pedidos/actions.ts`): mover el cálculo de `conversionFactor` antes del de `minStockEffective`/`maxStockEffective`, y multiplicar ambos por `conversionFactor` (además del `seatsEffective` que ya aplican):
  - `minStockEffective = Math.ceil(min_stock * seatsEffective * conversionFactor)`
  - `maxStockEffective = Math.ceil(max_stock * seatsEffective * conversionFactor)`
- **`belowMinimum`**: sin cambio de lógica (`currentStock < minStockEffective`), pero ahora compara correctamente piezas contra piezas en productos `split`.
- **`suggestedQuantity`**: sin cambio de fórmula — sigue siendo `Math.ceil((minStockEffective - currentStock) / conversionFactor)`, pero como `minStockEffective` ya viene en piezas, el resultado en "unidades de compra" (cajas) queda correcto (ej. min=5 cajas, pieces=100, stock=400 piezas → `minStockEffective=500` → sugiere `1` caja, no `100`).
- **Tope de `suggestedQuantity` por `maxStockEffective`**: misma corrección automática, ya que reutiliza `maxStockEffective` recién corregido.
- Productos con `split = false` (o `pieces` nulo/1): `conversionFactor = 1`, por lo que `minStockEffective`/`maxStockEffective` quedan exactamente igual que hoy — **sin cambio de comportamiento**.

**No incluye:**

- Cambios a `ProductModal.tsx`, `ProductViewModal.tsx` ni la columna `min_stock` de `ProductRow.tsx` — siguen mostrando/capturando `min_stock`/`max_stock` en "unidades de compra" (cajas), no en piezas. Esta spec solo corrige el cálculo interno de comparación en `getSuggestedProducts`.
- Cambios a `recepciones/actions.ts` ni a cómo se incrementa `stock.quantity` al recibir — ya está correcto (incrementa en piezas vía `conversionFactor`); el bug está solo en cómo `pedidos` interpreta el mínimo/máximo al comparar.
- Cambios a `getPurchaseOrdersSummary` — hereda la corrección automáticamente al reusar `getSuggestedProducts`, sin cambios propios.
- Cambios de esquema o migración de datos — `min_stock`/`max_stock` en BD siguen representando "unidades de compra" tal como se capturan hoy; no se reinterpretan ni se migran valores existentes.
- Ninguna etiqueta o aclaración visual nueva en `SuggestedProductsTable.tsx` sobre las unidades (ej. "500 pzas" vs "5 cajas") — fuera de alcance, es una corrección de cálculo, no de UI.

## Modelo de datos

No se introducen estructuras nuevas. Se documenta el cambio de fórmula en `getSuggestedProducts` (`app/dashboard/pedidos/actions.ts`):

### Antes

```ts
const minStockEffective =
  row.product_min_stock !== null && row.product_min_stock !== undefined
    ? Math.ceil(Number(row.product_min_stock) * seatsEffective)
    : null;
const maxStockEffective =
  row.product_max_stock !== null && row.product_max_stock !== undefined
    ? Math.ceil(Number(row.product_max_stock) * seatsEffective)
    : null;
const conversionFactor = row.split ? Number(row.pieces) || 1 : 1;
```

### Después

```ts
const conversionFactor = row.split ? Number(row.pieces) || 1 : 1;
const minStockEffective =
  row.product_min_stock !== null && row.product_min_stock !== undefined
    ? Math.ceil(Number(row.product_min_stock) * seatsEffective * conversionFactor)
    : null;
const maxStockEffective =
  row.product_max_stock !== null && row.product_max_stock !== undefined
    ? Math.ceil(Number(row.product_max_stock) * seatsEffective * conversionFactor)
    : null;
```

- Único cambio: `conversionFactor` se calcula primero y se agrega como tercer factor en ambas multiplicaciones.
- `ISuggestedProduct.min_stock_effective` / `max_stock_effective` no cambian de tipo (`number | null`); solo cambia la unidad implícita en productos `split` (pasan de "unidades de compra escaladas" a "piezas escaladas", consistente con `current_stock`).

## Plan de implementación

1. **`app/dashboard/pedidos/actions.ts` (`getSuggestedProducts`)**: reordenar el cálculo de `conversionFactor` antes de `minStockEffective`/`maxStockEffective`, y agregar `* conversionFactor` a ambas fórmulas, según el modelo de datos.

   *Verificación:* con un producto `split=true`, `pieces=100`, `min_stock=5`, `seats=1` (o `NULL`) y `current_stock=400` (4 cajas recibidas), `min_stock_effective` pasa de `5` a `500`, y `below_minimum` pasa de `false` a `true`. Un producto `split=false` (o `pieces` nulo/1) mantiene exactamente el mismo `min_stock_effective`/`max_stock_effective` que antes del cambio.

2. **Verificación manual en `/dashboard/pedidos/nuevo`**: abrir la sucursal donde está "Caja de Guantes 100pz" y confirmar en la tab "Todos los productos"/"Sugeridos para pedir" que:
   - `Stock mín.` ahora muestra `500` (no `5`).
   - La fila aparece en rojo (`below_minimum = true`) y en la tab "Sugeridos para pedir".
   - `Cantidad a pedir` sugiere `1` (caja), no una cantidad en piezas.
   - Confirmar que `getPurchaseOrdersSummary` (KPI "productos bajo mínimo" del encabezado) incluye este producto tras el cambio.

3. `npm run build` sin errores de TypeScript.

Cada paso deja el sistema funcional y compilando.

## Criterios de aceptación

- [x] En `getSuggestedProducts`, para un producto `split=true` con `pieces=100`, `min_stock=5` y `seats` efectivo `1`, `min_stock_effective` es `500` (no `5`).
- [x] Para ese mismo producto, con `current_stock=400`, `below_minimum` es `true` y la fila aparece en rojo en `SuggestedProductsTable.tsx` (columna "Stock").
- [x] Ese producto aparece en la tab "Sugeridos para pedir" (filtrada por `below_minimum`).
- [x] `suggested_quantity` para ese producto sugiere `1` (unidad de compra/caja), no una cantidad en piezas — `Math.ceil((500 - 400) / 100) = 1`.
- [x] `max_stock_effective` se calcula con la misma corrección (`max_stock * seatsEffective * conversionFactor`) y el tope sobre `suggested_quantity` sigue funcionando sin exceder el máximo en piezas.
- [x] Un producto con `split=false` (o `pieces` nulo/`1`) mantiene exactamente el mismo `min_stock_effective`, `max_stock_effective`, `below_minimum` y `suggested_quantity` que antes de este cambio — sin regresión.
- [x] `getPurchaseOrdersSummary` (KPI "productos bajo mínimo") refleja el nuevo cálculo sin cambios propios, al reusar `getSuggestedProducts` internamente.
- [x] La tab "Todos los productos" de `/dashboard/pedidos/nuevo` muestra `min_stock_effective`/`max_stock_effective` ya corregidos en las columnas "Stock mín."/"Stock máx.".
- [x] `ProductModal.tsx`, `ProductViewModal.tsx` y `ProductRow.tsx` no cambian de comportamiento (siguen mostrando/capturando `min_stock`/`max_stock` en unidades de compra, sin escalar por piezas).
- [x] `npm run build` compila sin errores ni warnings nuevos.

## Decisiones tomadas y descartadas

- **`min_stock`/`max_stock` capturados en el catálogo siguen siendo "unidades de compra" (cajas), no piezas.** Se descartó reinterpretar/migrar los valores ya guardados en BD a piezas, porque `ProductModal.tsx` los captura junto a "Cantidad a pedir" y "Unidad" en términos de unidad de compra — cambiar el significado del dato capturado confundiría a quien lo llena, y obligaría a recapturar todo el catálogo. En cambio, se corrige solo el punto donde se comparan contra `current_stock` (que sí está en piezas), multiplicando por `conversionFactor` únicamente en ese cálculo derivado.
- **Corrección solo en `getSuggestedProducts`, no un helper compartido en `lib/inventory/`.** Mismo razonamiento que spec 11: es el único punto de cálculo de `min_stock_effective`/`max_stock_effective` en el sistema hoy; no se justifica extraer un helper sin un segundo consumidor.
- **`conversionFactor` se calcula igual que en `createPurchaseOrders`/`recepciones/actions.ts` (`split ? pieces || 1 : 1`), sin introducir una tercera definición.** Reutiliza la misma regla ya usada en tres lugares del módulo de pedidos, evitando divergencia entre "cuántas piezas trae una unidad".
- **No se toca la UI de `SuggestedProductsTable.tsx` para aclarar que "Stock mín."/"Stock máx." ahora están en piezas.** El usuario no pidió una aclaración visual; la columna "Stock" (actual) ya está en piezas hoy, así que las tres columnas (Stock, Stock mín., Stock máx.) simplemente quedan consistentes entre sí después del fix, sin necesitar una etiqueta nueva.
- **Sin cambio a `suggested_quantity`, solo a sus insumos (`minStockEffective`/`maxStockEffective`).** La fórmula ya dividía por `conversionFactor` para convertir de piezas a unidades de compra; el bug estaba únicamente en que el mínimo/máximo no estaban en piezas todavía cuando entraban a esa fórmula. Corregir el insumo basta — no se toca la fórmula de `suggested_quantity` en sí.

## Riesgos identificados

- **Cambio de comportamiento inmediato en catálogo existente con productos `split`.** Cualquier producto `split=true` con `min_stock`/`max_stock` ya capturado va a recalcular su "bajo mínimo"/"sugerido" con un umbral hasta `conversionFactor` veces más alto que antes — productos que hoy no aparecen como bajo mínimo podrían aparecer inmediatamente después de este cambio (es el comportamiento correcto, pero puede sorprender si no se comunica).
- **KPI "productos bajo mínimo" puede subir de golpe.** Al depender de `below_minimum`, el conteo en el encabezado de `/dashboard/pedidos` puede incrementarse para varias sucursales a la vez tras liberar el cambio, sin que haya habido ningún movimiento de inventario real — es la corrección de un dato que ya estaba mal, no una regresión nueva.
- **Sin trazabilidad de qué fórmula se usó en órdenes de compra ya generadas.** Igual que en specs 11 y 42, `min_stock_effective`/`max_stock_effective` son cálculos en vivo, nunca persistidos; no hay forma de auditar retroactivamente si una orden pasada se sugirió con la fórmula vieja (sin `conversionFactor`) o la nueva.
- **Dependencia de que `pieces`/`split` estén bien capturados por producto.** Si un producto es realmente fraccionable pero tiene `split=false` o `pieces=NULL` en el catálogo, `conversionFactor` cae a `1` y el bug persiste para ese producto específico — este spec corrige el cálculo, no la calidad del dato de catálogo.
