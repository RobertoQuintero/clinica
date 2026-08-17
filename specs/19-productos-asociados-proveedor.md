# 19 — Productos asociados en detalle de proveedor

## Header

- **Estado:** Aprobado
- **Depende de:** [[07-proveedores-crud]] (página de detalle del proveedor), [[08-productos-inventario-crud]] (`inventory.Products`, `getCategories`, `getUnitsMeasurement`), [[09-pedidos-compra-recepcion]] (`inventory.purchase_order_items`, `inventory.purchase_orders`, `inventory.kardex`, `/dashboard/pedidos`)
- **Fecha:** 2026-08-17
- **Objetivo:** Agregar la sección "Productos Asociados" a `/dashboard/proveedores/[id]`, mostrando en una tabla buscable los productos de `inventory.Products` ligados a ese proveedor (categoría, unidad, precio y última compra recibida), con un botón "Ver Historial de Pedidos" que enlaza al historial de pedidos filtrado por ese proveedor, siguiendo el diseño de `references/suppliers/asociados.html`.

## Alcance

**Incluye:**
- Nueva sección **"Productos Asociados"** en `/dashboard/proveedores/[id]`, debajo del bento grid actual (Información General / Contacto / Ubicación), replicando la estructura de `asociados.html`: encabezado con título + subtítulo, buscador de texto y tabla.
- **Tabla de productos**: columnas Producto (nombre + `product_code` como subtítulo), Categoría (badge, mismo estilo genérico que `ProductRow.tsx`), Unidad (nombre de `inventory.units_measurement`), Precio Unitario (`price`, mismo formato `Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })` que `ProductRow`) y Última Compra (fecha, o "—" si nunca se ha recibido una compra de ese producto a este proveedor).
- **Fuente de "Última Compra":** `MAX(kardex.created_at)` para el producto, uniendo `inventory.kardex` → `inventory.purchase_order_items` → `inventory.purchase_orders`, filtrando `kardex.id_movement = 1` (EXC, entrada por compra) y `purchase_orders.id_supplier = este proveedor`.
- **Buscador de texto client-side** sobre nombre y `product_code`, sin recargar la página (mismo patrón que pacientes/productos/proveedores).
- **Botón "Ver Historial de Pedidos"** en el header de la página de detalle (junto a "Editar Datos"), que navega a `/dashboard/pedidos?proveedor={id_proveedor}`; se agrega soporte en `/dashboard/pedidos/page.tsx` para preseleccionar el filtro de proveedor desde ese query param al cargar.
- Productos listados: solo `inventory.Products` con `id_supplier = este proveedor` y `status = 1` (no eliminados), sin filtrar por `activo`.
- Nueva interfaz `interfaces/supplier_product.ts` (`ISupplierProduct`) y nueva función `getSupplierProducts(id_proveedor)` en `app/dashboard/proveedores/actions.ts`.
- Nuevo componente cliente leaf `app/dashboard/proveedores/[id]/componentes/AssociatedProductsTable.tsx` (recibe la lista ya resuelta del server component y maneja el buscador en cliente).

**No incluye:**
- Paginación real ni el texto "Mostrando X de Y productos" del mockup — se muestra la lista completa filtrada, sin controles de página.
- Filtro por categoría en esta tabla (el mockup solo tiene buscador de texto en esta pantalla).
- Edición o eliminación de productos desde esta tabla — es de solo lectura; para editar un producto se usa `/dashboard/productos`.
- Cambios al modelo de `inventory.purchase_orders`/`kardex` — solo se consultan, no se modifican.
- Diferenciar el color del badge de Categoría por tipo de categoría (el mockup usa colores distintos por categoría médica/medicamento/instrumental); se mantiene el badge genérico único ya usado en `ProductRow.tsx`.
- Cualquier cambio a `/dashboard/pedidos/nuevo` o al flujo de recepción — el enlace de "Historial de Pedidos" solo añade un query param opcional a la lista ya existente.

## Modelo de datos

No se crean tablas nuevas — se reutilizan `inventory.Products`, `inventory.categories`, `inventory.units_measurement`, `inventory.kardex`, `inventory.purchase_order_items` e `inventory.purchase_orders`, ya existentes desde los specs 08 y 09.

**Nueva interfaz `interfaces/supplier_product.ts`:**

```ts
export interface ISupplierProduct {
  id_product:    number;
  name:          string;
  product_code:  string;
  category_name: string | null;
  unit_name:     string | null;
  price:         number;
  last_purchase: string | null; // "YYYY-MM-DD", CONVERT(varchar(10), …, 120)
}
```

**Nueva función `getSupplierProducts(id_proveedor: number): Promise<ISupplierProduct[]>`** en `app/dashboard/proveedores/actions.ts`:

```sql
SELECT p.[id_product],
       p.[name],
       p.[product_code],
       c.[name] AS category_name,
       u.[name] AS unit_name,
       p.[price],
       CONVERT(varchar(10), lp.[last_purchase], 120) AS last_purchase
  FROM [CentroPodologico].[inventory].[Products] p
  LEFT JOIN [CentroPodologico].[inventory].[categories] c ON c.[id_category] = p.[id_category]
  LEFT JOIN [CentroPodologico].[inventory].[units_measurement] u ON u.[id_unit_measurement] = p.[id_unit_measurement]
  OUTER APPLY (
      SELECT MAX(k.[created_at]) AS last_purchase
        FROM [CentroPodologico].[inventory].[kardex] k
        JOIN [CentroPodologico].[inventory].[purchase_order_items] poi ON poi.[id_purchase_order_item] = k.[id_purchase_order_item]
        JOIN [CentroPodologico].[inventory].[purchase_orders] po ON po.[id_purchase_order] = poi.[id_purchase_order]
       WHERE k.[id_product] = p.[id_product]
         AND k.[id_movement] = 1
         AND po.[id_supplier] = p.[id_supplier]
  ) lp
 WHERE p.[id_supplier] = @id_proveedor
   AND p.[status] = 1
 ORDER BY p.[name]
```

Filtra por `id_empresa` del usuario autenticado igual que el resto de consultas de `productos`/`proveedores` (vía `getActiveUser()`), agregando `AND p.[id_empresa] = @id_empresa`.

## Plan de implementación

1. Crear `interfaces/supplier_product.ts` con `ISupplierProduct` (sección "Modelo de datos").
2. En `app/dashboard/proveedores/actions.ts`, agregar `getSupplierProducts(id_proveedor: number): Promise<ISupplierProduct[]>` con la consulta definida arriba (scoping por `id_empresa` vía `getActiveUser()`).
3. Crear `app/dashboard/proveedores/[id]/componentes/AssociatedProductsTable.tsx` (client component leaf): recibe `products: ISupplierProduct[]` por props, mantiene un `useState` de texto de búsqueda que filtra por `name`/`product_code` en el cliente, y renderiza la tabla (Producto, Categoría, Unidad, Precio Unitario, Última Compra) con el estilo visual de `asociados.html` adaptado a la paleta ya usada en el resto de `proveedores/[id]/page.tsx` (clases `#0b1c30`/`#44474f`/`eff4ff`/`dark:zinc-*`, igual criterio que el resto de la página). Formatea el precio con `Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })` (mismo helper que `ProductRow.tsx`) y la fecha de "Última Compra" normalizando el string antes de mostrarla (regla de fechas del proyecto), mostrando "—" si es `null`.
4. En `app/dashboard/proveedores/[id]/page.tsx` (Server Component): agregar `getSupplierProducts(id_proveedor)` al `Promise.all` existente, y renderizar la sección "Productos Asociados" (título + subtítulo + `AssociatedProductsTable`) debajo del bento grid.
5. En el header de `app/dashboard/proveedores/[id]/page.tsx`, agregar el botón "Ver Historial de Pedidos" (ícono `History` de `lucide-react`, mismo estilo secundario que tenía en el mockup original) junto a `EditSupplierButton`, como `Link` a `/dashboard/pedidos?proveedor=${id_proveedor}`.
6. En `app/dashboard/pedidos/page.tsx`, leer el query param `proveedor` con `useSearchParams()` (`next/navigation`) y usarlo como valor inicial de `supplierFilter` al montar el componente.
7. Verificar manualmente: abrir el detalle de un proveedor con productos asociados y sin ninguno (estado vacío de la tabla), confirmar que categoría/unidad/precio se muestran correctamente, que el buscador filtra en el cliente, que "Última Compra" muestra la fecha correcta tras recibir una compra (o "—" si no hay ninguna) y que "Ver Historial de Pedidos" abre `/dashboard/pedidos` con el proveedor ya filtrado; revisar modo claro/oscuro.
8. Ejecutar `npm run build` y confirmar que no hay errores de TypeScript.

## Criterios de aceptación

- [ ] `/dashboard/proveedores/[id]` muestra la sección "Productos Asociados" debajo del bento grid, con título y subtítulo como en `asociados.html`.
- [ ] La tabla lista únicamente productos de `inventory.Products` con `id_supplier` igual al proveedor de la página y `status = 1`, de la empresa del usuario autenticado.
- [ ] Cada fila muestra nombre + `product_code`, badge de categoría (o "—" si no tiene), nombre de unidad de medida (o "—" si no tiene), precio unitario formateado en MXN y fecha de última compra (o "—" si nunca se ha recibido una compra de ese producto a este proveedor).
- [ ] "Última Compra" refleja la fecha de la recepción más reciente (`kardex.id_movement = 1`) de ese producto proveniente de una orden de compra a este proveedor, no la fecha del pedido ni la del alta del producto.
- [ ] El buscador de texto filtra la tabla por nombre o `product_code` en el cliente, sin recargar la página.
- [ ] Si el proveedor no tiene productos asociados, la tabla muestra un estado vacío (sin filas, sin error).
- [ ] El botón "Ver Historial de Pedidos" navega a `/dashboard/pedidos?proveedor={id_proveedor}` y esa página carga con el filtro de proveedor ya preseleccionado en el `<select>`.
- [ ] La sección se ve correctamente en modo claro y en modo oscuro.
- [ ] No hay errores de TypeScript ni de build (`npm run build`) tras el cambio.

## Decisiones tomadas y descartadas

- **"Última Compra" desde `kardex` (recepción real), no desde `purchase_orders.created_at` (fecha del pedido):** se decidió así porque un pedido puede quedar en estado `Pedido`/`Enviado`/`Cancelado` sin nunca haber entrado a stock; mostrar la fecha del pedido daría una falsa impresión de que el producto ya se recibió. Se descartó también omitir la columna, ya que el dato es recuperable con el modelo existente del spec 09 sin trabajo adicional relevante.
- **"Ver Historial de Pedidos" sí entra en este spec, a diferencia de lo diferido en el spec 07:** en el spec 07 no existía el módulo de Pedidos; ahora que existe (spec 09) con una lista filtrable por proveedor, conectar el botón es una adición de bajo costo (un query param) que cierra la brecha entre el mockup y la funcionalidad real, en vez de dejarlo indefinidamente fuera de alcance.
- **Filtro de proveedor vía query param `?proveedor=`, no vía contexto o estado compartido:** es el mecanismo más simple para pasar el filtro entre páginas sin introducir un nuevo context ni persistir estado entre navegaciones; sigue el patrón estándar de Next.js App Router para deep-linking de filtros.
- **Sin paginación real, igual que el resto del proyecto:** se descartó replicar los controles de página del mockup (`asociados.html`) porque ninguna otra lista del sistema (pacientes, productos, proveedores, pedidos) los implementa; introducirlos aquí rompería la consistencia sin haber sido solicitado.
- **Solo `status = 1`, sin filtrar por `activo`:** se decidió mostrar también productos inactivos-pero-no-eliminados porque siguen siendo parte del catálogo histórico del proveedor (por ejemplo, para ver su última compra), a diferencia de un producto eliminado (`status = 0`) que ya no debe aparecer en ningún listado.
- **Badge de categoría genérico (mismo estilo que `ProductRow.tsx`), no con colores diferenciados por tipo como en el mockup:** se descartó introducir un mapeo de colores por categoría porque no existe hoy en ningún otro punto del sistema (la lista de Productos del spec 08 ya usa un badge único), y agregarlo aquí generaría inconsistencia visual entre pantallas.
- **Componente cliente leaf (`AssociatedProductsTable`) en vez de convertir toda la página de detalle en client component:** sigue la convención de `CLAUDE.md` de mantener los límites de cliente lo más pequeños posible; el fetch de datos permanece en el Server Component (`page.tsx`), y solo el buscador (estado interactivo) vive en el cliente.

## Riesgos identificados

- **Dependencia dura de las tablas del spec 09 (`inventory.kardex`, `purchase_order_items`, `purchase_orders`):** si ese spec no está desplegado en el entorno donde se instala este, `getSupplierProducts` fallará. Se mitiga documentando la dependencia en el header y verificando su existencia antes de implementar.
- **`OUTER APPLY` por producto para calcular "Última Compra":** con el volumen actual de productos por proveedor el costo es despreciable, pero si el catálogo de un proveedor crece mucho y el kardex acumula miles de filas, la consulta podría volverse más lenta; se acepta porque no hay índice explícito sobre `kardex.id_product`/`id_purchase_order_item` documentado y no está en alcance agregarlo aquí.
- **`purchase_orders.id_supplier` puede diferir del `id_supplier` actual del producto:** si un producto cambió de proveedor designado después de haberse comprado a otro, el filtro `po.id_supplier = p.id_supplier` (evaluado en tiempo de consulta) ignora compras históricas hechas al proveedor anterior — comportamiento intencional (refleja el proveedor *actual* del producto), pero puede sorprender si alguien esperaba ver el historial completo de todos los proveedores que alguna vez surtieron ese producto.
