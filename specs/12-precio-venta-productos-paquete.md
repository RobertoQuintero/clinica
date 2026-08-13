# 12 — Precio de venta individual para productos de paquete/caja

## Header

- **Estado:** Implementado
- **Depende de:** [[08-productos-inventario-crud]] (`inventory.Products`, `IProduct`, `ProductModal`, `saveProduct`), [[09-pedidos-compra-recepcion]] (semántica de `split`/`pieces` como conversión paquete→pieza)
- **Fecha:** 2026-08-13
- **Objetivo:** Agregar el campo `sale_price` (precio de venta por pieza individual) a `inventory.Products` y al formulario de `/dashboard/productos`, visible y obligatorio únicamente cuando el producto es de categoría "Venta" y tiene `split` activo, para reflejar que ese producto se compra por paquete/caja (`price`, `pieces`) pero se vende individualmente en mostrador.

## Alcance

**Incluye:**

- Nueva columna `sale_price` en `[CentroPodologico].[inventory].[Products]` (`decimal(18,6) NULL`, mismo tipo que `price`): precio al que se vende cada pieza individual en mostrador.
- Nuevo campo `sale_price: number | null` en `interfaces/product.ts` (`IProduct`).
- En `ProductModal.tsx`: nuevo input "Precio de Venta (pieza)", visible **solo cuando** `id_category === 4` (Venta) **y** `split === true`. Fuera de esa combinación el campo no se muestra ni se envía (permanece `null`).
- Validación en el formulario y en `saveProduct` (server-side, no solo cliente): si `id_category === 4` y `split === true`, `sale_price` es obligatorio y debe ser `> 0`; si no se cumple, se bloquea el guardado con mensaje de error.
- Relabeling condicional (solo cuando `id_category === 4` y `split === true`, sin afectar el resto de categorías):
  - "Precio Unitario" → "Precio de Compra (paquete/caja)"
  - "Piezas por Producto" → "Piezas por Paquete/Caja"
- `saveProduct`/`getProducts` en `app/dashboard/productos/actions.ts`: leer/escribir `sale_price` igual que el resto de columnas (INSERT, UPDATE, SELECT con cast numérico consistente con `price`).
- Anexar el `ALTER TABLE` de `sale_price` a `queries.txt` (convención del repo, sin migraciones).

**No incluye:**

- Ningún cambio a `/dashboard/ventas`, `dbo.productos` ni al flujo de venta en mostrador — `sale_price` queda capturado en el catálogo pero no se consume desde Ventas todavía (deuda ya documentada en spec 08: Ventas sigue en `dbo.productos`).
- Ninguna columna nueva en la tabla del listado de `/dashboard/productos` — `sale_price` solo se ve/edita dentro de `ProductModal`.
- Exponer `id_stock_unit_measurement` en el formulario de Productos — ya se lee correctamente en Recepciones (spec 09) sin UI aquí; queda fuera de alcance.
- Cualquier lógica de conversión, kardex o descuento de stock — eso ya existe (`split`/`pieces`/`conversion_factor`, spec 09) y no se toca.
- Renombrar "Precio Unitario"/"Piezas por Producto" para categorías distintas a Venta, o cuando `split = false` — conservan su etiqueta y significado actuales en Consumibles/Instrumental/Medicamentos.

## Modelo de datos

**Columna nueva en `[CentroPodologico].[inventory].[Products]`** (tabla ya existente, solo se agrega la columna):

| Columna | Tipo | Notas |
|---|---|---|
| `sale_price` | `decimal(18,6)` NULL | Precio de venta por pieza individual. Obligatorio (`> 0`) solo cuando `id_category = 4` (Venta) y `split = 1`; en cualquier otro caso queda `NULL`. |

**`interfaces/product.ts` (`IProduct`) — se agrega un campo:**

```ts
export interface IProduct {
  id_product:           number;
  name:                 string;
  id_category:          number | null;
  brand:                string;
  presentation:         string;
  id_unit_measurement:  number | null;
  size:                 string;
  price:                number;
  sale_price:           number | null;   // nuevo
  product_code:         string;
  id_supplier:          number | null;
  pieces:               number | null;
  min_stock:            number | null;
  id_empresa:            number;
  description:          string;
  created_at:           Date | string;
  activo:               boolean;
  status:               boolean;
  split:                boolean;
  url_product:          string;
}
```

No se crean tablas ni interfaces nuevas — solo esta columna y este campo.

## Plan de implementación

1. Ejecutar contra la BD: `ALTER TABLE [CentroPodologico].[inventory].[Products] ADD [sale_price] [decimal](18,6) NULL`. Anexar el statement a `queries.txt`, siguiendo la convención del repo (sin migraciones).
2. Agregar `sale_price: number | null` a `interfaces/product.ts` (`IProduct`), en la posición mostrada en "Modelo de datos".
3. En `app/dashboard/productos/actions.ts`:
   - `getProducts()`: agregar `[sale_price]` al `SELECT`.
   - `saveProduct()`: desestructurar `sale_price` del `form`; agregar validación server-side — si `id_category === 4` y `split === true`, exigir `sale_price !== null && Number(sale_price) > 0` (si no, `return { ok: false, message: "El precio de venta es obligatorio para productos de categoría Venta que se dividen en piezas" }`); incluir `sale_price` en `commonParams`, en el `INSERT` y en el `UPDATE`.
4. En `app/dashboard/productos/page.tsx`: agregar `sale_price: null` a `EMPTY`; agregar `sale_price: product.sale_price` en `openEdit`; agregar `"sale_price"` a `numericFields` en `handleChange` (mismo tratamiento que `price`, permitiendo decimales — o bien un parseo propio con `parseFloat`, igual que `price`).
5. En `ProductModal.tsx`:
   - Calcular `const isVentaSplit = form.id_category === 4 && form.split;` dentro del componente.
   - Envolver el input de "Precio de Venta (pieza)" en un bloque condicional `{isVentaSplit && (...)}`, ubicado junto al input de "Precio Unitario"; `required` cuando `isVentaSplit` es verdadero.
   - Cambiar la etiqueta de "Precio Unitario" a "Precio de Compra (paquete/caja)" cuando `isVentaSplit` (texto condicional, mismo input/name `price`).
   - Cambiar la etiqueta de "Piezas por Producto" a "Piezas por Paquete/Caja" cuando `isVentaSplit` (texto condicional, mismo input/name `pieces`).
   - Nota: como `split` es parte del mismo formulario, el bloque condicional debe reaccionar en vivo si el usuario marca/desmarca "Dividir Unidad" o cambia la categoría, sin necesidad de reabrir el modal.
6. Verificación manual: crear/editar un producto con categoría "Venta" y "Dividir Unidad" activo — confirmar que aparece "Precio de Venta (pieza)" como obligatorio, que las etiquetas cambian, y que intentar guardar sin `sale_price` bloquea con el mensaje de error. Cambiar la categoría a otra distinta de Venta (o desmarcar `split`) — confirmar que el campo desaparece, las etiquetas vuelven a las originales, y el guardado ya no exige `sale_price`. Editar un producto existente de otra categoría — confirmar que sigue guardando sin pedir `sale_price`.
7. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [ ] `inventory.Products` tiene la columna `sale_price` (`decimal(18,6)` NULL), agregada vía `ALTER TABLE` y registrada en `queries.txt`.
- [ ] `IProduct` incluye `sale_price: number | null`.
- [ ] `getProducts()` devuelve `sale_price` para cada producto.
- [ ] En `ProductModal`, el input "Precio de Venta (pieza)" solo aparece cuando `id_category === 4` (Venta) y `split === true`; en cualquier otro caso no se muestra.
- [ ] El campo reacciona en vivo: si el usuario cambia la categoría o marca/desmarca "Dividir Unidad" con el modal abierto, el input aparece/desaparece sin recargar.
- [ ] Al guardar un producto con categoría Venta y `split = true` sin capturar `sale_price` (o con `sale_price <= 0`), `saveProduct` rechaza el guardado con un mensaje de error claro.
- [ ] Al guardar un producto con categoría Venta y `split = true` con `sale_price > 0`, el producto se crea/actualiza correctamente y `sale_price` persiste.
- [ ] Al guardar un producto de cualquier otra categoría, o con `split = false`, el guardado no exige `sale_price` (puede quedar `NULL`).
- [ ] Cuando aplica (categoría Venta + `split = true`), la etiqueta "Precio Unitario" se muestra como "Precio de Compra (paquete/caja)" y "Piezas por Producto" como "Piezas por Paquete/Caja"; en el resto de casos conservan sus etiquetas originales.
- [ ] La tabla/lista de `/dashboard/productos` no cambia — `sale_price` no aparece como columna nueva.
- [ ] `/dashboard/ventas` sigue funcionando sin cambios, sin consumir `sale_price`.
- [ ] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **`sale_price` como columna nueva y separada de `price`, no una reinterpretación de `price`.** Se descartó reutilizar `price` como "precio de venta" cuando `split = true` porque `price` ya está en uso activo como precio de compra en `pedidos` (`unit_price` en líneas de orden, spec 09) — cambiar su significado condicionalmente habría roto esa lógica ya implementada.
- **Visible y obligatorio solo cuando categoría = Venta y `split = true`, no solo por categoría.** Un producto de categoría Venta que no se divide en piezas (se compra y se vende en la misma unidad) no necesita un precio distinto al de compra; forzar el campo ahí habría sido ruido sin utilidad de negocio, y contradice el caso descrito ("algunos" productos de Venta se compran por paquete, no todos).
- **Validación obligatoria server-side en `saveProduct`, no solo en el `required` del input HTML.** Consistente con el patrón ya usado para "Nombre" en el mismo archivo (spec 08) — el `required` del navegador es una ayuda de UX, pero la regla de negocio real vive en el server action.
- **Etiquetas "Precio de Compra"/"Piezas por Paquete/Caja" condicionadas, sin renombrar globalmente.** Se descartó renombrar siempre porque `price`/`pieces` ya tienen un significado establecido y correcto para Consumibles/Instrumental/Medicamentos (insumos de consulta, spec 09); cambiar la etiqueta ahí sin cambiar el comportamiento habría confundido más de lo que aclara.
- **No se toca `/dashboard/ventas` ni `id_stock_unit_measurement` en este spec.** Ambos quedan fuera de alcance explícito (ver "Alcance") para no ampliar un cambio pensado como catálogo hacia flujos de venta o unidades de stock que ya funcionan sin UI en Productos; se acepta como deuda hasta un spec futuro que decida cómo conectar la venta en mostrador a `inventory.Products`.
- **Sin columna nueva en la tabla del listado.** El precio de venta es un dato de captura ocasional (solo aplica a un subconjunto de productos de Venta), no una columna de referencia rápida como "Precio Unit."; se mantiene la tabla actual sin cambios para no ampliar el scroll horizontal ya señalado en `CLAUDE.md` como algo a cuidar.

## Riesgos identificados

- **`sale_price` queda "vivo" en BD pero sin consumidor real todavía.** Ningún flujo de venta lo lee (Ventas sigue en `dbo.productos`); el dato se captura pero no impacta ninguna operación hasta que exista un spec que conecte Ventas a `inventory.Products`. Riesgo de que se capture y quede desactualizado sin que nadie lo note.
- **Cambiar `id_category` o `split` después de haber capturado `sale_price` no lo limpia.** Si un producto pasa de "Venta + split" a otra combinación, `sale_price` queda guardado en BD aunque el campo deje de mostrarse en el formulario; si vuelve a "Venta + split" reaparece con el valor viejo, que puede ya no ser el correcto. Se acepta porque no fue parte del alcance solicitado (no hay pedido de limpiar el campo al cambiar de categoría); documentado aquí para que el usuario lo revise si ocurre.
- **Etiquetas condicionales pueden generar inconsistencia visual momentánea.** Si el usuario alterna rápido entre categorías/`split` mientras llena el formulario, las etiquetas y el campo aparecen/desaparecen en cada cambio; es el comportamiento pedido (reactivo en vivo), pero puede sentirse "parpadeante" si se cambia de categoría muchas veces seguidas.
