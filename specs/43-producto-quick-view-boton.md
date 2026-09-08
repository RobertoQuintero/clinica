# 43 — Botón de vista rápida de producto (ProductQuickViewButton)

## Header

- **Estado:** Draft
- **Depende de:** [[41-producto-imagen-overwrite-url-compra]] (`ProductViewModal.tsx`), [[42-producto-max-stock]] (los campos que ese modal mostrará ya incluyen `max_stock` una vez implementada)
- **Modifica base de datos:** No.
- **Fecha:** 2026-09-07
- **Objetivo:** Agregar un ícono "ver producto" reutilizable (`ProductQuickViewButton`) en los 7 puntos del sistema donde se lista o referencia un producto fuera de `/dashboard/productos`, que cargue el detalle completo bajo demanda y abra `ProductViewModal`.

## Alcance

**Incluye:**

- **Nuevo componente `ProductQuickViewButton`** (`app/dashboard/componentes/ProductQuickViewButton.tsx`, client component):
  - Prop `id_product: number`.
  - Renderiza un botón ícono (`Eye`, mismo ícono/estilo que ya usa `ProductRow.tsx`).
  - Al hacer click, llama a la nueva server action `getProductDetail(id_product)`.
  - Mientras la petición está en curso, el ícono se sustituye por un spinner inline (botón deshabilitado).
  - Si la respuesta es exitosa, monta `ProductViewModal` con los datos recibidos.
  - Si falla (`ok: false` o excepción), no abre el modal; muestra un mensaje de error breve junto al ícono (texto inline con auto-ocultado, sin bloquear la pantalla).
- **Nueva server action `getProductDetail`** (`app/dashboard/productos/actions.ts`):
  - Recibe `id_product: number`.
  - Devuelve `ActionResult<{ product: IProduct; categoryName: string; supplierName: string; unitName: string }>`, resolviendo categoría/proveedor/unidad de medida en el propio query (joins), sin depender de que la pantalla llamante ya tenga esos catálogos cargados.
  - Filtra por `id_empresa` del usuario activo, igual que el resto de acciones de productos.
- **Integración del botón en los 7 puntos confirmados**, cada uno pasando su `id_product` disponible:
  1. `SuggestedProductsTable.tsx` — junto al nombre del producto en cada fila.
  2. `SupplierOrderGroup.tsx` — junto al nombre del producto en cada línea del carrito de pedido.
  3. `EditOrderTemplateModal.tsx` — junto al nombre del producto en cada item de la plantilla.
  4. `AssociatedProductsTable.tsx` — junto al nombre del producto en cada fila.
  5. `VentaModal.tsx` — junto al nombre del producto en cada línea ya agregada al ticket (no en el `<select>` del picker).
  6. `RegisterMovementModal.tsx` — junto al producto ya seleccionado (debajo del buscador, donde se muestra su nombre/stock), y junto a cada resultado en la lista de sugerencias del buscador (son botones propios, no `<option>` nativo).
  7. `ProductoRow.tsx` (consultas de paciente) — junto al nombre del producto en cada fila, en su variante de solo lectura y en la de edición.

**No incluye:**

- Cambios a `AddProductoForm.tsx` (usa `<datalist>` nativo) ni al `<select>` de agregar producto en `VentaModal.tsx` — el navegador no permite insertar un ícono dentro de sus opciones; fuera de alcance técnico.
- Cambios a `OrderTemplatesTab.tsx`, `OrderTemplateCard.tsx` ni `SaveCartAsTemplateModal.tsx` — solo muestran un conteo de productos, no filas individuales referenciables.
- Rediseño de `VentaFila.tsx` (listado de ventas) para desglosar el resumen de productos por fila — el resumen sigue siendo un texto concatenado; no se agrega el botón ahí en esta spec.
- Cualquier cambio a `ProductViewModal.tsx` propio de datos (ya cubierto por specs 41/42) — esta spec solo lo reutiliza tal cual existe.
- Cambios a `ProductRow.tsx` (`/dashboard/productos`) — ya tiene su propio `Eye`/`ProductViewModal` con los datos completos ya cargados en esa pantalla; no se migra a `ProductQuickViewButton` para no tocar código que ya funciona sin necesidad de un fetch adicional.
- Caché o reutilización del detalle entre clicks — cada click siempre vuelve a pedir `getProductDetail` (sin memorizar resultados entre aperturas), consistente con que el stock/precio pueden cambiar entre una apertura y otra.

## Modelo de datos

No se crean tablas ni columnas nuevas. Se documentan las formas de datos nuevas a nivel de código (tipo de retorno de la acción y props del componente):

### `getProductDetail` — forma de retorno

```ts
// app/dashboard/productos/actions.ts
interface IProductDetail {
  product:       IProduct;
  categoryName:  string;
  supplierName:  string;
  unitName:      string;
}

export async function getProductDetail(
  id_product: number
): Promise<ActionResult<IProductDetail>>
```

- Reutiliza el mismo `SELECT` de `getProducts` (todas las columnas de `IProduct`, incluyendo `max_stock` una vez implementada la spec 42) pero acotado a un solo `id_product` y con `JOIN`s a categorías, proveedores y unidades de medida para resolver los tres nombres en una sola consulta — evita que cada pantalla llamante tenga que cargar esos tres catálogos solo para poder abrir el modal.
- Si `id_product` no existe o no pertenece al `id_empresa` del usuario activo, devuelve `{ ok: false, message: "Producto no encontrado" }`.

### `ProductQuickViewButton` — props

```ts
// app/dashboard/componentes/ProductQuickViewButton.tsx
interface Props {
  id_product: number;
}
```

- Sin más props: el componente es autosuficiente (fetch, estado de carga, estado de error y montaje del modal viven dentro de él), para que cada uno de los 7 puntos de integración solo necesite `<ProductQuickViewButton id_product={...} />`.

## Plan de implementación

1. **`app/dashboard/productos/actions.ts`**: agregar `getProductDetail(id_product)` según el modelo de datos — `SELECT` de un producto por `id_product` + `id_empresa`, con `LEFT JOIN` a categorías/proveedores/unidades de medida para resolver los tres nombres.

   *Verificación:* llamar la acción con un `id_product` existente devuelve `{ ok: true, data: { product, categoryName, supplierName, unitName } }` con los mismos valores que se ven en `/dashboard/productos`; con un `id_product` inexistente o de otra empresa devuelve `{ ok: false, message: "Producto no encontrado" }`.

2. **`app/dashboard/componentes/ProductQuickViewButton.tsx`** (nuevo, client component):
   - Estado local: `loading`, `error`, `detail` (resultado de `getProductDetail`).
   - Botón ícono `Eye` (mismo estilo que `ProductRow.tsx`); al click, `loading = true` y llama a la acción.
   - Éxito: guarda `detail`, monta `ProductViewModal` con `product`/`categoryName`/`supplierName`/`unitName` del resultado y `onClose` que limpia `detail`.
   - Error: guarda mensaje en `error`, lo muestra brevemente junto al ícono (ej. con `setTimeout` para autolimpiar), no monta el modal.
   - Mientras `loading`, el ícono se reemplaza por un spinner y el botón queda `disabled`.

   *Verificación:* click en el botón en aislamiento (probar directo en una de las pantallas del paso 3) muestra spinner → abre `ProductViewModal` con los datos correctos; forzar un `id_product` inválido muestra el mensaje de error sin abrir el modal.

3. **Integrar `ProductQuickViewButton` en los 7 puntos confirmados**, uno por uno (cada paso deja el sistema compilando y funcional):
   - `SuggestedProductsTable.tsx`
   - `SupplierOrderGroup.tsx`
   - `EditOrderTemplateModal.tsx`
   - `AssociatedProductsTable.tsx`
   - `VentaModal.tsx` (líneas del ticket)
   - `RegisterMovementModal.tsx` (producto seleccionado + resultados del buscador)
   - `ProductoRow.tsx` (consultas de paciente)

   *Verificación por cada punto:* abrir la pantalla correspondiente, hacer click en el ícono junto a un producto y confirmar que el modal muestra los datos correctos de ese producto específico; cerrar el modal regresa a la pantalla sin efectos secundarios (no se pierde el estado del formulario/carrito en el que está inserto el botón).

4. `npm run build` sin errores de TypeScript.

Cada paso deja el sistema funcional y compilando.

## Criterios de aceptación

- [ ] `getProductDetail(id_product)` existe en `app/dashboard/productos/actions.ts` y devuelve `product` + `categoryName` + `supplierName` + `unitName` para un producto válido de la empresa activa.
- [ ] `getProductDetail` devuelve `{ ok: false }` (no lanza excepción sin manejar) para un `id_product` inexistente o de otra empresa.
- [ ] `ProductQuickViewButton` existe en `app/dashboard/componentes/` y solo requiere `id_product` como prop.
- [ ] Al hacer click en el ícono, se muestra un spinner mientras carga y el botón queda deshabilitado hasta que la petición resuelve.
- [ ] En una carga exitosa, se abre `ProductViewModal` con los datos correctos del producto clickeado (nombre, categoría, proveedor, unidad de medida, y el resto de campos del modal).
- [ ] En una carga fallida, no se abre el modal y se muestra un mensaje de error breve junto al ícono, sin romper ni bloquear la pantalla donde vive el botón.
- [ ] Cerrar `ProductViewModal` regresa a la pantalla de origen sin alterar su estado (carrito, formulario, línea en edición, etc. quedan intactos).
- [ ] El ícono "ver producto" aparece y funciona en los 7 puntos confirmados: `SuggestedProductsTable.tsx`, `SupplierOrderGroup.tsx`, `EditOrderTemplateModal.tsx`, `AssociatedProductsTable.tsx`, `VentaModal.tsx` (líneas del ticket), `RegisterMovementModal.tsx` (producto seleccionado y resultados del buscador), `ProductoRow.tsx` (consultas de paciente).
- [ ] `AddProductoForm.tsx`, el `<select>` de agregar producto en `VentaModal.tsx`, `OrderTemplatesTab.tsx`, `OrderTemplateCard.tsx`, `SaveCartAsTemplateModal.tsx` y `VentaFila.tsx` no se modifican.
- [ ] `ProductRow.tsx` sigue usando su `ProductViewModal` directo (sin migrar a `ProductQuickViewButton`), sin cambio de comportamiento visible.
- [ ] La pantalla se ve correctamente en modo claro y oscuro, consistente con el resto de la app.
- [ ] `npm run build` compila sin errores ni warnings nuevos.

## Decisiones tomadas y descartadas

- **Componente compartido con fetch bajo demanda (`ProductQuickViewButton` + `getProductDetail`), en vez de extender cada interfaz angosta con todos los campos de `IProduct`.** Decisión del usuario, tras detectar que ninguno de los 7 puntos tiene hoy el producto completo: extender `ISuggestedProduct`, `ISupplierProduct`, `IMovementProductOption`, `ConsultaProductoExtended`, `IPurchaseCartLine`, `IPurchaseOrderTemplateItemDetail` y `ISaleProduct` habría inflado 7 queries distintas con columnas que esas pantallas no usan, y habría duplicado la resolución de nombres de categoría/proveedor/unidad en cada `actions.ts`.
- **Ubicación del componente en `app/dashboard/componentes/`, no dentro de `productos/componentes/`.** Sigue el patrón ya usado por `ConfirmModal` y `QuantityStepper` (componentes verdaderamente cross-feature viven en la carpeta compartida del dashboard), en vez de que 6 features distintas importen algo que vive dentro de la carpeta de otro feature.
- **Sin caché del detalle entre clicks.** Se descartó memorizar el resultado de `getProductDetail` por `id_product` (ej. en un `Map` a nivel de módulo o contexto) porque el stock/precio de un producto puede cambiar entre una apertura del modal y otra dentro de la misma sesión (especialmente en `RegisterMovementModal` y `VentaModal`, donde el usuario puede estar registrando movimientos en ese mismo momento); simplicidad y datos frescos ganan sobre ahorrar una petición.
- **Ícono con spinner inline en vez de abrir el modal de inmediato con esqueleto de carga.** Decisión del usuario: evita tener que enseñarle a `ProductViewModal` (que hoy asume datos completos y ya resueltos) un estado de "cargando" o "error" que no necesita en su único otro consumidor (`ProductRow.tsx`, que nunca tiene esos estados porque ya tiene los datos).
- **Error breve inline junto al ícono, sin abrir el modal.** Decisión del usuario: mantiene a `ProductViewModal` con una sola responsabilidad (mostrar un producto ya cargado), en vez de convertirlo en un componente que también maneja estados de error de red.
- **`ProductRow.tsx` no se migra al nuevo componente.** Ya tiene los datos completos cargados en la página de Productos (sin necesidad de un fetch adicional); migrarlo agregaría una petición de red innecesaria donde hoy no existe ninguna, sin beneficio.
- **`VentaFila.tsx`, `AddProductoForm.tsx`, el picker de `VentaModal.tsx`, y los componentes de plantillas que solo muestran conteos, quedan fuera de alcance.** Justificado en la sección de Alcance: limitación técnica de los elementos nativos (`<select>`/`<datalist>`) o ausencia de una fila por producto donde insertar el ícono. Forzar estos casos requeriría un rediseño de UI no solicitado.

## Riesgos identificados

- **7 puntos de integración implementados de forma manual e independiente.** Al no existir un patrón previo de "columna de acción reutilizable" en tablas tan distintas entre sí (filas de tabla, tarjetas, líneas de carrito, resultados de buscador), hay riesgo de inconsistencia visual sutil entre integraciones (espaciado, tamaño del ícono) si no se revisan una por una contra el estilo de `Eye` en `ProductRow.tsx`.
- **Carga de red repetida por cada click, sin caché.** En pantallas con muchas filas (ej. `SuggestedProductsTable.tsx` con el catálogo completo), un usuario que abre varios productos seguidos genera una petición nueva por cada uno; aceptado por la decisión de mantener datos frescos, pero si el catálogo crece mucho podría notarse una pequeña latencia repetida (mitigable a futuro con una caché de corta duración si se vuelve molesto).
- **`RegisterMovementModal.tsx` mezcla dos ubicaciones del botón** (resultados del buscador + producto ya seleccionado) en el mismo componente; hay riesgo de que el ícono en la lista de resultados interfiera con el click de "seleccionar producto" (ambos viven en el mismo `<button>` hoy) si no se separan cuidadosamente los manejadores de evento (`stopPropagation` en el ícono).
- **`ProductViewModal` sigue asumiendo datos siempre completos y correctos.** Si en el futuro `getProductDetail` cambiara de forma (ej. campos opcionales adicionales) sin actualizar el modal, el error aparecería silenciosamente como "—" en vez de una alerta explícita — mismo comportamiento que ya tiene hoy el modal en `ProductRow.tsx`, no es una regresión introducida por esta spec.
