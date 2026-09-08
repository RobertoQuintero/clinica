# 42 — Producto: campo Stock Máximo (max_stock)

## Header

- **Estado:** Implementado
- **Depende de:** [[11-min-stock-por-sillones]] (fórmula de escalado por `seats` que `max_stock` reutiliza), [[09-pedidos-compra-recepcion]] (`getSuggestedProducts`, `ISuggestedProduct`)
- **Modifica base de datos:** Sí. Nueva columna `inventory.Products.max_stock` (`decimal(18,2) NULL`), vía `ALTER TABLE`.
- **Fecha:** 2026-09-07
- **Objetivo:** Agregar el campo `max_stock` (stock máximo) al catálogo de productos, capturable en `ProductModal.tsx` con la misma restricción de rol que `min_stock`, visible en `ProductViewModal.tsx`, y usado como tope de `suggested_quantity` en `getSuggestedProducts` (escalado por sillones de sucursal igual que `min_stock`).

## Alcance

**Incluye:**

- **Nueva columna `max_stock`** (`decimal(18,2)`, nullable) en `[CentroPodologico].[inventory].[Products]`, mismo tipo que `min_stock`.
- **`IProduct`** (`interfaces/product.ts`): agregar `max_stock: number | null`.
- **`ProductModal.tsx` — campo `max_stock`:**
  - Input numérico "Stock Máximo", junto al de "Stock Mínimo", con la misma restricción de rol (`canEditMinStock` → se reutiliza/renombra para cubrir ambos campos, o se agrega una variable análoga; deshabilitado y con el mismo mensaje de ayuda para roles no autorizados).
  - Validación de guardado: si ambos `min_stock` y `max_stock` tienen valor, bloquear el guardado cuando `max_stock < min_stock`, con mensaje de error.
- **`app/dashboard/productos/actions.ts` (`saveProduct`):**
  - Aplicar la misma lógica de "solo administrador puede ajustar" que ya existe para `min_stock` (ignorar lo enviado por roles no autorizados y conservar el valor previo o `null` en producto nuevo).
  - Validación server-side equivalente (`max_stock < min_stock` → rechazar) como respaldo de la validación de cliente.
  - Incluir `max_stock` en `SELECT` (`getProducts`), `INSERT` y `UPDATE`.
- **`page.tsx`**: agregar `max_stock` a `EMPTY`, `openEdit` y a la lista `numericFields` de `handleChange`.
- **`ProductViewModal.tsx`**: nuevo `Field` "Stock Máximo" junto a "Stock Mínimo", mostrando el valor o "—".
- **`ISuggestedProduct`** (`interfaces/suggested_product.ts`): agregar `max_stock_effective: number | null`.
- **`getSuggestedProducts`** (`app/dashboard/pedidos/actions.ts`):
  - Seleccionar `p.[max_stock]` junto a `p.[min_stock]`.
  - Calcular `maxStockEffective` con la misma fórmula/escalado que `minStockEffective`: `row.product_max_stock != null ? Math.ceil(Number(row.product_max_stock) * seatsEffective) : null`.
  - Topar `suggested_quantity`: cuando `maxStockEffective` no es `null`, la cantidad sugerida no debe hacer que `current_stock + suggested_quantity * conversionFactor` exceda `maxStockEffective`. Si `current_stock >= maxStockEffective`, `suggested_quantity = 0` (aunque `below_minimum` siga siendo `true`, ya que el mínimo y el máximo son datos independientes de mostrar aunque el tope ya se haya alcanzado).

**No incluye:**

- Alertas de "sobre-stock" (producto con `current_stock > max_stock_effective`) en el listado de productos, KPIs de pedidos o conteos — el alcance de esta spec es captura + tope en sugeridos, no una nueva señal visual de exceso de inventario.
- Cambios a `SuggestedProductsTable.tsx` para mostrar una columna nueva de "máximo" — solo se ajusta el cálculo interno de `suggested_quantity`; la UI de la tabla no se toca.
- Migración o recálculo de órdenes de compra ya generadas.
- Exponer `max_stock` en `ProductRow.tsx` (tabla de listado) — igual que `min_stock`, que tampoco tiene columna propia ahí (solo aparece en el modal de edición y en `ProductViewModal.tsx`).
- Cualquier cambio a `ProductViewModal.tsx` fuera de agregar el `Field` de `max_stock` (esto se cubre en la spec separada de exponer el modal en otras pantallas).

## Modelo de datos

### Cambio de esquema

```sql
ALTER TABLE [CentroPodologico].[inventory].[Products] ADD [max_stock] DECIMAL(18, 2) NULL;
```

- Nullable, sin default: los productos existentes quedan con `max_stock = NULL` (equivalente a "sin tope definido").

### `interfaces/product.ts`

```ts
export interface IProduct {
  // ...campos existentes...
  min_stock:  number | null;
  max_stock:  number | null;
  // ...
}
```

### `interfaces/suggested_product.ts`

```ts
export interface ISuggestedProduct {
  // ...campos existentes...
  min_stock_effective:  number | null;
  max_stock_effective:  number | null;
  suggested_quantity:   number;
  below_minimum:        boolean;
  // ...
}
```

### `getSuggestedProducts` — cálculo del tope

```ts
// SELECT agrega:
p.[max_stock] AS product_max_stock,

// en el map:
const maxStockEffective =
  row.product_max_stock !== null && row.product_max_stock !== undefined
    ? Math.ceil(Number(row.product_max_stock) * seatsEffective)
    : null;

let suggestedQuantity = belowMinimum
  ? Math.max(1, Math.ceil((minStockEffective! - currentStock) / conversionFactor))
  : 0;

if (maxStockEffective !== null) {
  const maxUnitsAllowed = Math.max(0, maxStockEffective - currentStock);
  const maxQuantityAllowed = Math.floor(maxUnitsAllowed / conversionFactor);
  suggestedQuantity = Math.min(suggestedQuantity, maxQuantityAllowed);
}
```

- `below_minimum` no cambia: sigue dependiendo solo de `minStockEffective` (un producto puede seguir marcado como "bajo mínimo" aunque `suggested_quantity` quede en `0` por haber alcanzado ya el máximo — caso borde raro pero posible si el mínimo se sube después de tocar el tope).

### `saveProduct` — validación de rango

```ts
if (
  max_stock !== null && max_stock !== undefined &&
  min_stock !== null && min_stock !== undefined &&
  Number(max_stock) < Number(min_stock)
) {
  return { ok: false, message: "El Stock Máximo no puede ser menor al Stock Mínimo" };
}
```

Se ejecuta antes de aplicar la restricción de rol (`canEditMinStock`), sobre los valores tal como llegan del formulario.

## Plan de implementación

1. **DB**: ejecutar `ALTER TABLE [CentroPodologico].[inventory].[Products] ADD [max_stock] DECIMAL(18, 2) NULL;` contra la base de datos. Registrar la sentencia en `queries.txt`.

   *Verificación:* `SELECT TOP 1 max_stock FROM [CentroPodologico].[inventory].[Products]` no da error; columna nueva es `NULL` en productos existentes.

2. **Interfaces**: agregar `max_stock: number | null` a `IProduct` (`interfaces/product.ts`) y `max_stock_effective: number | null` a `ISuggestedProduct` (`interfaces/suggested_product.ts`).

3. **`app/dashboard/productos/actions.ts` (`getProducts`/`saveProduct`)**:
   - Incluir `[max_stock]` en el `SELECT` de `getProducts`.
   - Desestructurar `max_stock` en `saveProduct`.
   - Agregar la validación `max_stock < min_stock` (rechazo con `ActionResult` de error) antes de aplicar la restricción de rol.
   - Reutilizar la misma restricción de rol que `min_stock` (`canEditMinStock`): si el rol no puede editar, ignorar `max_stock` enviado y conservar el valor previo (o `null` en producto nuevo).
   - Incluir `max_stock`/`effectiveMaxStock` en `commonParams`, en el `INSERT` y en el `UPDATE`.

   *Verificación:* `getProducts()` devuelve `max_stock` (null en productos existentes); guardar con `max_stock < min_stock` devuelve error sin tocar la BD; guardar con un rol no autorizado conserva el valor previo de `max_stock`.

4. **`ProductModal.tsx`**:
   - Agregar input numérico "Stock Máximo" (`name="max_stock"`) junto al de "Stock Mínimo", con `disabled={!canEditMinStock}` y el mismo mensaje de ayuda ("Solo un administrador puede ajustar..."), ajustando el texto a que cubre ambos campos si aplica.
   - Agregar validación de cliente: si al enviar `max_stock < min_stock` (ambos con valor), mostrar mensaje de error y no llamar a `saveProduct`.

   *Verificación:* con un rol autorizado, el input es editable; con un rol no autorizado, aparece deshabilitado con el mensaje; capturar `max_stock` menor a `min_stock` bloquea el guardado con mensaje visible.

5. **`page.tsx`**:
   - Agregar `max_stock: null` a `EMPTY`.
   - Agregar `max_stock: product.max_stock` en `openEdit`.
   - Agregar `"max_stock"` a `numericFields` en `handleChange`.

   *Verificación:* crear/editar un producto con `max_stock` capturado persiste el valor; recargar el listado y reabrir "Editar" muestra el mismo valor.

6. **`ProductViewModal.tsx`**: agregar `Field` "Stock Máximo" junto a "Stock Mínimo", mostrando `product.max_stock ?? "—"`.

   *Verificación:* ver el detalle de un producto con `max_stock` capturado muestra el valor; un producto sin capturar muestra "—".

7. **`app/dashboard/pedidos/actions.ts` (`getSuggestedProducts`)**:
   - Agregar `p.[max_stock] AS product_max_stock` al `SELECT`.
   - Calcular `maxStockEffective` con la misma fórmula de escalado por `seatsEffective` que `minStockEffective`.
   - Topar `suggestedQuantity` según el modelo de datos (sin exceder `maxStockEffective`, mínimo `0`).
   - Incluir `max_stock_effective: maxStockEffective` en el objeto retornado.

   *Verificación:* en una sucursal con `seats = 2`, un producto con `min_stock = 5`, `max_stock = 8` y `current_stock = 0` sugiere como máximo lo que quepa hasta `16` (8×2) en vez de seguir creciendo sin tope; un producto con `max_stock = NULL` no se ve afectado (comportamiento igual a hoy); `getPurchaseOrdersSummary` sigue funcionando sin cambios propios.

8. `npm run build` sin errores de TypeScript.

Cada paso deja el sistema funcional y compilando.

## Criterios de aceptación

- [x] La columna `max_stock` existe en `[CentroPodologico].[inventory].[Products]` como `DECIMAL(18, 2) NULL`.
- [x] `IProduct` incluye `max_stock: number | null`; `ISuggestedProduct` incluye `max_stock_effective: number | null`.
- [x] `ProductModal.tsx` muestra un input "Stock Máximo" junto a "Stock Mínimo", editable solo por `id_role` 1 o 4 (deshabilitado con mensaje de ayuda para otros roles, igual que `min_stock`).
- [x] Capturar `max_stock` menor a `min_stock` (ambos con valor) bloquea el guardado, tanto en cliente (mensaje visible sin llamar al servidor) como en servidor (`saveProduct` rechaza aunque se hiciera un llamado directo).
- [x] Un rol sin permiso que intenta modificar `max_stock` no logra cambiarlo: el valor guardado es el previo (o `null` en producto nuevo), sin importar lo enviado en el formulario.
- [x] Guardar un producto con `max_stock` capturado persiste el valor; recargar el listado y reabrir "Editar" muestra el mismo valor.
- [x] `ProductViewModal.tsx` muestra un campo "Stock Máximo": el valor capturado o "—" cuando está vacío.
- [x] `getSuggestedProducts` calcula `max_stock_effective` como `CEILING(max_stock * seats)` (mismo `seatsEffective` fallback a `1` que `min_stock_effective`), y `NULL` cuando el producto no tiene `max_stock` capturado.
- [x] Con `max_stock` definido, `suggested_quantity` nunca sugiere una cantidad tal que `current_stock + suggested_quantity * conversionFactor` exceda `max_stock_effective`.
- [x] Si `current_stock` ya es mayor o igual a `max_stock_effective`, `suggested_quantity` es `0` (independientemente de si `below_minimum` es `true`).
- [x] Un producto con `max_stock = NULL` mantiene exactamente el mismo `suggested_quantity` que antes de esta spec (sin tope).
- [x] `getPurchaseOrdersSummary` y las tabs de `/dashboard/pedidos/nuevo` ("Sugeridos para pedir", "Todos los productos") reflejan el nuevo tope sin requerir cambios propios adicionales.
- [x] `npm run build` compila sin errores ni warnings nuevos.

## Decisiones tomadas y descartadas

- **`max_stock` es solo informativo + tope de sugeridos, sin alertas de sobre-stock.** Se descartó agregar una señal visual de "producto por encima del máximo" (badge, KPI, filtro) porque no fue pedido y ampliaría el alcance a UI de listado/KPIs; puede vivir en una spec futura si se necesita.
- **`max_stock` escala por `seats` de sucursal, igual que `min_stock` (spec 11).** Decisión del usuario: mantiene consistencia — si el mínimo se interpreta "por sillón", el máximo debe seguir la misma semántica; usar una fórmula distinta para cada extremo del rango sería confuso sin justificación de negocio.
- **Tope duro (`Math.min`) sobre `suggested_quantity`, no "order-up-to" hasta el máximo.** Decisión del usuario: cuando el producto está bajo mínimo, la cantidad sugerida sigue apuntando a alcanzar `min_stock_effective`; `max_stock_effective` solo actúa como límite superior, no como nuevo objetivo. Se descartó cambiar el objetivo a "llenar hasta el máximo" porque cambiaría el comportamiento ya validado en spec 09/11 para todo producto que no tiene `max_stock` capturado o que sí lo tiene pero no lo alcanza.
- **Restricción de rol idéntica a `min_stock` (`id_role` 1 o 4), reutilizando `canEditMinStock`.** Decisión del usuario: `max_stock` y `min_stock` definen juntos el rango de stock del producto, misma sensibilidad de negocio; tener una bandera de permiso separada para cada campo sería una distinción sin diferencia real hoy.
- **Validación `max_stock >= min_stock` en cliente y servidor, no solo advertencia.** Se descartó permitir guardar un rango inconsistente (`max_stock < min_stock`) porque rompería silenciosamente el cálculo de tope en `getSuggestedProducts` (el tope quedaría por debajo del objetivo mínimo, produciendo `suggested_quantity` negativo o confuso sin la validación).
- **Tipo `DECIMAL(18,2) NULL`, igual que `min_stock`.** Consistente con que ambos campos representan la misma unidad de medida del producto (piezas/paquetes fraccionables vía `split`/`pieces`).
- **`max_stock` no se agrega a la tabla de listado (`ProductRow.tsx`) ni a `SuggestedProductsTable.tsx`.** Mismo patrón que `min_stock`, que tampoco tiene columna dedicada en el listado — ambos solo se ven en el modal de edición y en `ProductViewModal.tsx`. Evita agregar columnas a tablas ya densas sin que se haya pedido.

## Riesgos identificados

- **Reinterpretación del catálogo existente.** Todos los productos actuales quedan con `max_stock = NULL` (sin tope). Hasta que alguien capture el valor por producto, el comportamiento de `suggested_quantity` no cambia — el riesgo es que se asuma que el tope "ya está funcionando" en catálogo cuando en realidad nadie ha cargado el dato todavía (mismo patrón de riesgo que `seats` en spec 11).
- **Rango inconsistente entre `min_stock` y `max_stock` para el mismo producto en sucursales con distinto `seats`.** Como ambos escalan por el mismo `seatsEffective`, la proporción se mantiene siempre — no debería producirse un caso donde `max_stock_effective < min_stock_effective` si la validación de captura (`max_stock >= min_stock`) se respetó. El riesgo residual es si `max_stock` se captura hoy y `min_stock` se edita después sin volver a validar contra el máximo ya guardado (la validación solo corre al guardar, comparando los dos valores del formulario en ese momento, así que sigue cubierta).
- **Caso borde: producto marcado `below_minimum = true` con `suggested_quantity = 0`.** Si `current_stock` ya alcanzó `max_stock_effective` pero sigue por debajo de un `min_stock_effective` más alto (configuración atípica, ej. si el máximo se capturó igual al mínimo), el producto aparecerá "bajo mínimo" sin cantidad sugerida — comportamiento intencional según la decisión tomada, pero puede generar confusión visual en "Sugeridos para pedir" si no se explica en la UI (fuera de alcance de esta spec).
- **Sin trazabilidad histórica del tope usado.** Igual que con `min_stock_effective` (spec 11), `max_stock_effective` es un cálculo en vivo que no se persiste en las órdenes de compra generadas; no hay forma de auditar retroactivamente qué tope aplicaba cuando se sugirió una orden pasada.
