# 45 — Inventario actual (vista general por sucursal)

## Header

- **Estado:** Aprobado
- **Depende de:** [[09-pedidos-compra-recepcion]] (`getSuggestedProducts`, `ISuggestedProduct`), [[42-producto-max-stock]] (`max_stock_effective`), [[44-stock-min-max-conversion-piezas]] (cálculo correcto de min/max en piezas), [[43-producto-quick-view-boton]] (`ProductQuickViewButton`), [[11-min-stock-por-sillones]] (escalado por sillones)
- **Modifica base de datos:** No.
- **Fecha:** 2026-09-07
- **Objetivo:** Crear la página `/dashboard/inventario` (nuevo hijo "Vista general" del grupo del sidebar "Inventario"), con una tabla de solo lectura "Inventario actual" para la sucursal seleccionada — Producto (+ ícono Ver), Categoría, Stock, Stock mín., Stock máx. — reutilizando `getSuggestedProducts` sin agregar columnas ni acciones nuevas al servidor.

## Alcance

**Incluye:**

- **Nueva ruta `/dashboard/inventario`** (`app/dashboard/inventario/page.tsx`, client component, mismo patrón que `productos/page.tsx`/`movimientos/page.tsx`):
  - Usa `useSucursal()` (`SucursalContext`) para obtener `selectedId`.
  - Llama `getSuggestedProducts(selectedId)` (de `app/dashboard/pedidos/actions.ts`, ya existente) y `getCategories()` (de `app/dashboard/productos/actions.ts`, ya existente) — sin nuevas server actions.
  - Buscador por nombre/código de producto y filtro por categoría, igual estilo que `productos/page.tsx` y `pedidos/nuevo/page.tsx`.
  - Título/encabezado propio ("Inventario actual" o equivalente) y estado de carga/"Sin registros", consistente con el resto del módulo.
- **Nuevo componente `CurrentInventoryTable.tsx`** (`app/dashboard/inventario/componentes/`): tabla de solo lectura con columnas Producto (+ `ProductQuickViewButton`), Categoría, Stock, Stock mín., Stock máx. — mismo estilo visual que `SuggestedProductsTable.tsx` pero sin checkbox, cantidad a pedir, unidad, precio, IVA, subtotal ni badge "En Curso".
  - Recibe `products: ISuggestedProduct[]` (ya filtrados/buscados en la página) y `categoryNameById: Map<number, string>`.
  - Muestra **todo el catálogo** de la sucursal (no solo `below_minimum`), a diferencia de la tab "Sugeridos para pedir" de pedidos.
  - Coloreado de `Stock` (rojo si `below_minimum`, verde si no) igual que `SuggestedProductsTable.tsx`.
- **`navConfig.tsx`**: agregar `{ href: "/dashboard/inventario", label: "Vista general", icon: Warehouse }` como primer `NavChild` del grupo "Inventario" (antes de "Productos").
- **`proxy.ts`**: ninguna regla nueva — hereda el comportamiento general (autenticado + `status` aprobado); igual que `/dashboard/productos` y `/dashboard/movimientos`, que hoy no tienen restricción propia en `proxy.ts` más allá de `excludeRoles` del sidebar.

**No incluye:**

- Nuevas server actions ni cambios a `getSuggestedProducts`/`ISuggestedProduct` — se consume tal cual existe hoy (ya corregido por specs 42/44).
- Badge "En Curso" (`PendingOrderBadge`) ni cualquier indicador de pedido pendiente — excluido explícitamente por decisión del usuario.
- Selector de sucursal propio — reutiliza el selector global ya presente en el layout del dashboard (`SucursalContext`), sin uno adicional en esta página.
- Navegación por tabs — la página no tiene selector de pestañas; es una sola vista.
- Acciones de edición/eliminación de producto, exportación, paginación/virtualización, o cualquier acción de escritura — es una vista de consulta únicamente.
- Cambios a `proxy.ts` para restricciones de rol adicionales a las ya existentes en el módulo de inventario.
- Cambios a `/dashboard/pedidos/nuevo` o a `SuggestedProductsTable.tsx` — se reutiliza su patrón visual pero no se modifica ese archivo.

## Modelo de datos

No se introducen estructuras de datos nuevas (ni columnas, ni interfaces, ni server actions). Se documentan únicamente las props del componente nuevo, que reutiliza tipos ya existentes:

```ts
// app/dashboard/inventario/componentes/CurrentInventoryTable.tsx
import { ISuggestedProduct } from "@/interfaces/suggested_product"; // ya existente

interface Props {
  products:         ISuggestedProduct[];   // catálogo completo de la sucursal (sin filtrar por below_minimum)
  categoryNameById: Map<number, string>;   // igual que en SuggestedProductsTable.tsx
}
```

- `ISuggestedProduct` ya trae `current_stock`, `min_stock_effective`, `max_stock_effective`, `below_minimum`, `id_category`, `id_product`, `name`, `product_code` — todo lo que esta tabla necesita, sin campos adicionales.
- `app/dashboard/inventario/page.tsx` reutiliza `getSuggestedProducts(selectedId)` y `getCategories()` tal como se importan hoy en `pedidos/nuevo/page.tsx` y `productos/page.tsx`, respectivamente — mismas firmas, mismos tipos de retorno (`ActionResult<ISuggestedProduct[]>` / `IProductCategory[]`).
- `navConfig.tsx`: el nuevo `NavChild` sigue la interfaz `NavChild` ya definida (`href`, `label`, `icon`), sin cambios al tipo.

## Plan de implementación

1. **`navConfig.tsx`**: importar el ícono `Warehouse` (lucide-react) y agregar `{ href: "/dashboard/inventario", label: "Vista general", icon: Warehouse }` como primer elemento de `children` en el grupo "Inventario" (antes de "Productos").

   *Verificación:* el sidebar muestra "Vista general" como primer hijo de "Inventario"; el link resalta como activo al visitar `/dashboard/inventario` (una vez creada en el paso 3); rol 5 sigue sin ver el grupo completo (hereda `excludeRoles: [5]` del padre).

2. **`app/dashboard/inventario/componentes/CurrentInventoryTable.tsx`** (nuevo, client component): tabla con columnas Producto (+ `ProductQuickViewButton`), Categoría, Stock, Stock mín., Stock máx., copiando estructura/estilos de `SuggestedProductsTable.tsx` pero eliminando checkbox, cantidad a pedir, unidad, precio, IVA, subtotal y `PendingOrderBadge`. Mismo coloreado rojo/verde de `Stock` según `below_minimum`. Estado vacío: "Sin productos que coincidan con los filtros".

   *Verificación:* montar el componente con datos de prueba (`ISuggestedProduct[]`) renderiza las 5 columnas esperadas, con `ProductQuickViewButton` funcional junto a cada nombre.

3. **`app/dashboard/inventario/page.tsx`** (nuevo, client component): igual patrón que `productos/page.tsx`/`pedidos/nuevo/page.tsx` —
   - `useSucursal()` para `selectedId`.
   - `useEffect` que llama `getSuggestedProducts(selectedId)` y `getCategories()` (recarga al cambiar `selectedId`).
   - Buscador (`search`) por `name`/`product_code` y `<select>` de categoría (`categoryFilter`), filtrando en memoria igual que `pedidos/nuevo/page.tsx`.
   - Encabezado ("Inventario actual") + estado de carga/error, y renderiza `CurrentInventoryTable` con el resultado filtrado.

   *Verificación:* al entrar a `/dashboard/inventario` con una sucursal seleccionada, se ve el catálogo completo de esa sucursal (no solo los productos bajo mínimo); cambiar de sucursal en el selector global recarga la tabla; buscar por nombre/código y filtrar por categoría acota los resultados correctamente.

4. **Verificación manual de permisos**: iniciar sesión con un usuario de rol 5 (podóloga) y confirmar que ni el grupo "Inventario" ni `/dashboard/inventario` son accesibles (comportamiento heredado, sin cambios a `proxy.ts`).

5. `npm run build` sin errores de TypeScript.

Cada paso deja el sistema funcional y compilando.

## Criterios de aceptación

- [ ] Existe la ruta `/dashboard/inventario` y aparece "Vista general" como primer hijo del grupo "Inventario" en el sidebar, con ícono `Warehouse`.
- [ ] La tabla muestra el catálogo **completo** de la sucursal seleccionada (no solo productos bajo mínimo), con columnas Producto, Categoría, Stock, Stock mín., Stock máx.
- [ ] Cada fila tiene el ícono "Ver" (`ProductQuickViewButton`) junto al nombre del producto, que abre `ProductViewModal` con los datos correctos al hacer click.
- [ ] La columna "Stock" se muestra en rojo cuando `below_minimum` es `true` y en verde cuando es `false`, igual que en `SuggestedProductsTable.tsx`.
- [ ] "Stock mín." y "Stock máx." muestran `min_stock_effective`/`max_stock_effective` (o "—" cuando son `null`), ya corregidos por la fórmula de piezas (spec 44).
- [ ] Cambiar la sucursal seleccionada (selector global) recarga la tabla con el catálogo de la nueva sucursal.
- [ ] El buscador filtra por nombre o código de producto; el filtro de categoría acota por `id_category`; ambos combinables.
- [ ] Un catálogo vacío o sin coincidencias de filtro muestra el mensaje "Sin productos que coincidan con los filtros" (o equivalente), sin error.
- [ ] La tabla **no** muestra checkbox, cantidad a pedir, unidad, precio, IVA, subtotal ni badge "En Curso".
- [ ] Un usuario con rol 5 no ve el grupo "Inventario" en el sidebar ni puede acceder a `/dashboard/inventario` (comportamiento heredado, sin cambios a `proxy.ts`).
- [ ] No se agregan server actions, columnas de BD ni cambios a `getSuggestedProducts`, `ISuggestedProduct` o `SuggestedProductsTable.tsx`.
- [ ] La pantalla se ve correctamente en modo claro y oscuro, consistente con el resto de la app.
- [ ] `npm run build` compila sin errores ni warnings nuevos.

## Decisiones tomadas y descartadas

- **Página nueva `/dashboard/inventario`, no una tab agregada a `productos/` o `movimientos/`.** Decisión del usuario: "Inventario actual" es una vista propia (consulta de existencias por sucursal), distinta del catálogo editable de Productos y del kardex de Movimientos; forzarla como tab de cualquiera de esas dos habría mezclado responsabilidades de una pantalla ya definida.
- **Reutilizar `getSuggestedProducts`/`ISuggestedProduct` tal cual, sin nueva acción ni interface.** Ya expone exactamente los campos necesarios (`current_stock`, `min_stock_effective`, `max_stock_effective`, categoría, `below_minimum`) con las correcciones de piezas/sillones ya aplicadas (specs 42/44); crear una acción paralela solo para omitir columnas de pedidos habría duplicado lógica de escalado sin beneficio real.
- **Vista de solo lectura de la sucursal seleccionada, sin selector de sucursal propio ni vista multi-sucursal.** Consistente con el resto del módulo de inventario (Productos, Movimientos, Conteos), que siempre operan sobre la sucursal activa en `SucursalContext`; una vista multi-sucursal ampliaría el alcance (columna de sucursal, cambio de firma de `getSuggestedProducts`) sin haber sido pedida.
- **Sin badge "En Curso" (`PendingOrderBadge`).** Decisión explícita del usuario: la imagen de referencia lo mostraba, pero se decidió dejarlo fuera de esta vista de solo consulta de existencias; puede agregarse en una spec futura si se necesita.
- **Sin navegación por tabs, ni siquiera con una sola pestaña visible.** Decisión del usuario: no hay una segunda pestaña planeada hoy; agregar un selector de tabs para una sola opción sería UI sin propósito. Si en el futuro se agrega otra vista relacionada, esa spec futura decidirá si conviene introducir tabs en ese momento.
- **Sin restricciones de rol adicionales en `proxy.ts`.** Mismo patrón que `/dashboard/productos` y `/dashboard/movimientos`, que hoy solo se ocultan del sidebar vía `excludeRoles` (rol 5) sin gate server-side propio; no se justifica una regla nueva solo para esta pantalla cuando el resto del módulo no la tiene.
- **Ícono `Warehouse` para el nuevo `NavChild`, sin reutilizar `Package` (ya usado por el grupo padre "Inventario").** Evita que dos niveles del sidebar (grupo e hijo) compartan el mismo ícono, lo que dificultaría distinguirlos visualmente.

## Riesgos identificados

- **Duplicación visual entre esta tabla y "Todos los productos" de `/dashboard/pedidos/nuevo`.** Ambas muestran esencialmente el mismo dataset (`getSuggestedProducts`) con columnas de stock casi idénticas; hay riesgo de que usuarios se confundan sobre cuál usar para qué (una es de consulta, la otra para armar pedidos) si no queda claro por el título/contexto de cada pantalla.
- **Sin indicador de pedido pendiente en esta vista.** Al excluir `PendingOrderBadge`, un producto bajo mínimo con un pedido ya en curso se ve igual aquí que uno sin pedido activo — riesgo de que alguien duplique un pedido por no ver esa señal (mitigado porque "Sugeridos para pedir" en `/dashboard/pedidos/nuevo` sigue mostrando el badge).
- **Dependencia total de la corrección de specs 42/44.** Si en el futuro se modifica la fórmula de `min_stock_effective`/`max_stock_effective` en `getSuggestedProducts` sin actualizar esta spec, la nueva página hereda automáticamente cualquier bug introducido ahí, sin capa propia de validación.
- **Catálogos grandes sin paginación/virtualización.** Igual que `productos/page.tsx` hoy, la tabla renderiza todo el catálogo filtrado de una sola vez; si el catálogo de una sucursal crece mucho, el rendimiento podría degradarse (riesgo preexistente en el patrón que se está replicando, no introducido por esta spec).
- **Nombre "Vista general" podría no comunicar claramente que es inventario actual.** Es una decisión de UI menor; si el usuario final no lo entiende, un ajuste de copy no requeriría tocar la arquitectura de la spec.
