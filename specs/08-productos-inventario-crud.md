# 08 — Productos (inventario) CRUD

## Header

- **Estado:** Aprobado
- **Depende de:** [[07-proveedores-crud]] (reutiliza `getSuppliers` de `app/dashboard/proveedores/actions.ts` para el select de Proveedor)
- **Fecha:** 2026-08-11
- **Objetivo:** Reimplementar desde cero la sección Productos (lista y formulario crear/editar) usando las tablas `inventory.Products`, `inventory.categories` y `inventory.units_measurement` ya creadas en BD, con el diseño visual de `references/products/` adaptado a la paleta de `references/DESIGN.md` con soporte claro/oscuro, reemplazando por completo la versión anterior basada en `dbo.productos`.

## Alcance

**Incluye:**
- Reemplazo completo de la página **Productos** (`/dashboard/productos`) usando `inventory.Products` como tabla de datos, con el mismo patrón de componente cliente que `proveedores`/`pacientes` (fetch en `useEffect`, sin fetch server-side).
- **Lista de productos**: tabla con No. Producto (`product_code`), Producto (nombre + marca/presentación como subtítulo), Categoría (badge), Proveedor (nombre corto), Precio Unit., Talla/Medida, Estado (badge Activo/Inactivo) y Acciones (editar, eliminar) — replicando `products.html`.
- **Filtros funcionales client-side**: buscador de texto por nombre, select de Categoría y select de Proveedor, todos filtrando la tabla en el cliente sin recargar (igual patrón que el buscador ya usado en pacientes/productos/proveedores).
- **Crear/editar producto**: modal `ProductModal` con todos los campos del mockup `product_form.html`: Nombre (único obligatorio), Categoría (select), Marca, Presentación, Unidad de Medida (select), Talla/Tamaño, Precio Unitario, No. Producto/Código de Barras (`product_code`, texto libre opcional, no autogenerado), Proveedor (select), URL Producto, Piezas por Producto, checkbox "Producto Activo" (`activo`), Descripción, checkbox "Dividir Unidad" (`split`, se persiste sin lógica adicional).
- Los selects de Categoría, Unidad de Medida y Proveedor son `<select>` nativos poblados desde BD (conservando el ícono de búsqueda del mockup solo como estilo visual, sin typeahead real).
- **Eliminar producto**: soft-delete (`status = 0`) desde el ícono de basura en la lista, con confirmación previa; el producto deja de aparecer en lista y filtros.
- Productos compartidos a nivel empresa (`id_empresa`), sin scoping por sucursal (coincide con el esquema real de `inventory.Products`, que no tiene `id_sucursal`).
- Nueva interfaz `interfaces/product.ts` (`IProduct`, nombre en inglés) y nuevo `app/dashboard/productos/actions.ts` reescrito por completo con: `getProducts`, `getCategories` (lectura de `inventory.categories`), `getUnitsMeasurement` (lectura de `inventory.units_measurement`, filtrando `status = 1`), `saveProduct`, `deleteProduct`; reutiliza `getSuppliers` de `app/dashboard/proveedores/actions.ts` (no se duplica esa consulta).
- Nuevos componentes `app/dashboard/productos/componentes/ProductRow.tsx` y `ProductModal.tsx` (nombres en inglés), reemplazando `ProductoFila.tsx`/`ProductoModal.tsx`.
- Paleta y tipografía de `references/DESIGN.md` vía Tailwind, con contraparte `dark:` consistente con `ThemeContext` (mismo patrón que proveedores).
- El ítem "Productos" del sidebar (`navConfig.tsx`) no cambia: ya apunta a `/dashboard/productos` con `minRole: 0`, `excludeRoles: [5]`, ícono `Box`.

**No incluye:**
- Página de detalle (`/dashboard/productos/[id]`) — el mockup solo contempla lista + modal de edición.
- CRUD de Categorías ni de Unidades de Medida — se usan como catálogo de solo lectura ya sembrado en BD (`inventory.categories`, `inventory.units_measurement`); su administración queda diferida a otro spec.
- CRUD de Proveedores — ya existe (spec 07), este spec solo lo consume vía `getSuppliers`.
- Combobox/autocomplete real para los selects del formulario.
- Paginación real server-side.
- Cualquier lógica de descuento automático por consulta, kardex, movimientos, órdenes de compra o stock mínimo/actual descrita en `references/docs/Inventario.md` — fuera del alcance de "Catálogo de Productos".
- Migración, borrado o backfill de datos de la tabla vieja `[CentroPodologico].[dbo].[productos]`; queda intacta en BD pero sin uso desde la app.
- Autogeneración de `product_code`.

## Modelo de datos

**Tabla `[CentroPodologico].[inventory].[Products]`** (ya existe en BD, sin cambios de esquema):

| Columna | Tipo | Notas |
|---|---|---|
| `id_product` | `int` | PK. Patrón `MAX(id_product)+1` en el INSERT, no identity. |
| `name` | `varchar(100)` | **Obligatorio.** |
| `id_category` | `smallint` NULL | FK lógica a `inventory.categories`. |
| `brand` | `varchar(100)` NULL | |
| `presentation` | `varchar(100)` NULL | |
| `id_unit_measurement` | `smallint` NULL | FK lógica a `inventory.units_measurement`. |
| `size` | `varchar(50)` NULL | Talla/Tamaño. |
| `price` | `decimal(18,6)` NULL | Precio Unitario. |
| `product_code` | `varchar(100)` NULL | No. Producto/Código de Barras, texto libre. |
| `id_supplier` | `int` NULL | FK lógica a `inventory.proveedores` (`id_proveedor`). |
| `pieces` | `int` NULL | Piezas por Producto. |
| `id_empresa` | `int` NULL | Scoping por empresa, igual que proveedores. |
| `description` | `varchar(250)` NULL | |
| `created_at` | `datetime` NULL | Se escribe con `buildDate(new Date())`, se lee con `CONVERT(varchar(19), …, 120)`. |
| `activo` | `bit` NULL | Toggle de negocio (badge Activo/Inactivo), independiente del borrado. |
| `status` | `bit` NULL | Soft-delete: `0` = eliminado, oculto de listas. |
| `split` | `bit` NULL | "Dividir Unidad"; se guarda sin lógica adicional. |
| `url_product` | `varchar(250)` NULL | |

**Tablas de catálogo (solo lectura en este spec):** `inventory.categories` (`id_category`, `name`, `status`, `activo`, `id_empresa`) e `inventory.units_measurement` (`id_unit_measurement`, `id_type`, `name`, `code`, `value`, `status`) — ambas ya sembradas en BD.

**Nueva interfaz `interfaces/product.ts`:**

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
  product_code:         string;
  id_supplier:          number | null;
  pieces:               number | null;
  id_empresa:            number;
  description:          string;
  created_at:           Date | string;
  activo:               boolean;
  status:               boolean;
  split:                boolean;
  url_product:          string;
}
```

**Nueva interfaz `interfaces/product_category.ts`:**

```ts
export interface IProductCategory {
  id_category: number;
  name:        string;
  status:      boolean;
  activo:      boolean;
  id_empresa:  number;
}
```

**Nueva interfaz `interfaces/unit_measurement.ts`:**

```ts
export interface IUnitMeasurement {
  id_unit_measurement: number;
  id_type:              number | null;
  name:                 string;
  code:                 string;
  value:                number;
  status:               boolean;
}
```

## Plan de implementación

1. Crear `interfaces/product.ts`, `interfaces/product_category.ts` y `interfaces/unit_measurement.ts` con `IProduct`, `IProductCategory`, `IUnitMeasurement` (sección "Modelo de datos"). No se toca `interfaces/producto.ts` (sigue siendo usada por Ventas).
2. En `app/dashboard/productos/actions.ts`: conservar la función `getProductos(id_sucursal)` existente tal cual (consulta `dbo.productos`), porque `app/dashboard/ventas/page.tsx` depende de ella. Eliminar `saveProducto` y `deleteProducto` (sin más consumidores tras el paso 5) y agregar las nuevas funciones sobre `inventory.Products`:
   - `getProducts(): Promise<IProduct[]>` — filtra `id_empresa` y `status = 1`, cast de `created_at` con `CONVERT(varchar(19), …, 120)`.
   - `getCategories(): Promise<IProductCategory[]>` — lectura de `inventory.categories` filtrando `id_empresa` y `status = 1`.
   - `getUnitsMeasurement(): Promise<IUnitMeasurement[]>` — lectura de `inventory.units_measurement` filtrando `status = 1`.
   - `saveProduct(form): Promise<{ ok: boolean; message?: string }>` — INSERT (`id_product = MAX+1`, `status = 1`) o UPDATE según `id_product === 0`, incluyendo `activo`/`split`; `revalidatePath("/dashboard/productos")`.
   - `deleteProduct(id_product: number): Promise<{ ok: boolean; message?: string }>` — soft-delete (`status = 0`).
   - Reutiliza `getSuppliers` importado desde `app/dashboard/proveedores/actions.ts` (no duplicar la consulta a `inventory.proveedores`).
3. Eliminar `app/dashboard/productos/componentes/ProductoFila.tsx` y `ProductoModal.tsx` (sin más consumidores tras el paso 4) y crear `ProductRow.tsx` (fila: `product_code`, nombre + marca/presentación, badge categoría, proveedor, precio, talla/medida, badge activo/inactivo, acciones editar/eliminar) y `ProductModal.tsx` (formulario completo con selects nativos de Categoría/Unidad de Medida/Proveedor, checkboxes "Producto Activo" y "Dividir Unidad").
4. Reescribir `app/dashboard/productos/page.tsx` (client component): fetch de `getProducts`, `getCategories`, `getUnitsMeasurement` y `getSuppliers`; buscador de texto por nombre + selects de filtro por Categoría y Proveedor (todos client-side); tabla con `ProductRow`; botón "Agregar Producto" que abre `ProductModal`; confirmación antes de eliminar.
5. Aplicar la paleta y tipografía de `references/DESIGN.md` vía Tailwind, con contraparte en modo oscuro (`dark:`), en lista y modal.
6. No se requieren cambios en `app/dashboard/componentes/navConfig.tsx` (el ítem "Productos" ya apunta a `/dashboard/productos` con las reglas de rol correctas).
7. Verificar manualmente: crear un producto, verlo en la lista con categoría/proveedor/unidad correctos, editarlo, activar/desactivarlo, eliminarlo (soft-delete) y confirmar que desaparece de lista y filtros; probar los filtros de texto/categoría/proveedor combinados; revisar modo claro/oscuro; confirmar que `/dashboard/ventas` sigue funcionando sin cambios (sigue usando `dbo.productos`).
8. Ejecutar `npm run build` y confirmar que no hay errores de TypeScript.

## Criterios de aceptación

- [ ] `/dashboard/productos` muestra la lista de productos activos (`status = 1`) de la empresa del usuario autenticado, leyendo de `inventory.Products`.
- [ ] Cada fila muestra No. Producto (`product_code`), nombre + marca/presentación, badge de categoría, nombre corto del proveedor, precio unitario, talla/medida y badge Activo/Inactivo.
- [ ] El buscador de texto filtra la lista por nombre en el cliente, sin recargar la página.
- [ ] El select de Categoría y el select de Proveedor filtran la lista en el cliente, combinables entre sí y con el buscador de texto.
- [ ] El botón "Agregar Producto" abre `ProductModal` con el formulario completo; al guardar con solo "Nombre" lleno, `saveProduct` crea el producto correctamente.
- [ ] El formulario no permite guardar sin "Nombre"; el resto de los campos son opcionales.
- [ ] Los selects de Categoría, Unidad de Medida y Proveedor se pueblan desde `inventory.categories`, `inventory.units_measurement` (`status = 1`) e `inventory.proveedores` (vía `getSuppliers`) respectivamente.
- [ ] El checkbox "Producto Activo" controla el campo `activo` y se refleja en el badge de la lista.
- [ ] El checkbox "Dividir Unidad" persiste el campo `split` sin ninguna lógica adicional.
- [ ] El ícono de "editar" en la lista abre `ProductModal` precargado con los datos del producto y persiste los cambios vía `saveProduct`.
- [ ] El ícono de "eliminar" llama a `deleteProduct` (soft-delete, `status = 0`) tras confirmación, y el producto deja de aparecer en la lista y en los filtros.
- [ ] La lista y el modal se ven correctamente en modo claro y en modo oscuro, con la paleta de `references/DESIGN.md`.
- [ ] `/dashboard/ventas` sigue funcionando sin cambios, consumiendo `getProductos`/`IProducto` sobre `dbo.productos` tal como antes.
- [ ] No hay errores de TypeScript ni de build (`npm run build`) tras el cambio.

## Decisiones tomadas y descartadas

- **Productos compartidos a nivel empresa, no por sucursal:** se decidió así porque el esquema real de `inventory.Products` no tiene `id_sucursal` (a diferencia de la tabla vieja `dbo.productos`). Se descartó agregar esa columna porque implicaría modificar una tabla ya creada en BD fuera del alcance de este spec, y porque coincide con el patrón ya adoptado en Proveedores (spec 07).
- **Selects nativos en vez de combobox/autocomplete real:** el mockup usa inputs con ícono de búsqueda para Categoría, Unidad de Medida y Proveedor, pero se decidió implementarlos como `<select>` HTML normal (conservando el ícono solo como estilo visual) porque el catálogo de categorías/unidades/proveedores es pequeño y no justifica un componente typeahead nuevo en el proyecto. Se descartó el combobox real por ser un patrón no usado en ninguna otra parte del sistema.
- **Sin CRUD de Categorías ni Unidades de Medida:** ambas tablas ya están sembradas en BD (`inventory.categories`, `inventory.units_measurement`) y se consumen de solo lectura en los selects del formulario. Se descartó incluir su administración en este spec porque amplía significativamente el alcance sin haber sido parte del pedido original; queda diferido a un spec futuro de "catálogos de inventario".
- **Filtrar `inventory.units_measurement` por `status = 1` aun sabiendo que hoy todas las filas tienen `status = 0`:** se mantiene consistencia con el resto del sistema, donde `status = 1` siempre significa "activo/visible". Se descartó ignorar el filtro porque ocultaría un problema real de datos; el select de Unidad de Medida saldrá vacío hasta que se corrija el seed en BD, lo cual queda documentado como riesgo, no como responsabilidad de este spec.
- **`product_code` de captura libre y opcional, sin autogeneración:** el mockup lo muestra como un campo de texto editable (`XC22345`), sin lógica visible de generación automática; se descartó autogenerarlo por no haber sido solicitado y por no existir un formato de código definido en `Inventario.md`.
- **Único campo obligatorio: Nombre:** mismo criterio usado en Proveedores (spec 07) — simplifica la captura inicial y coincide con que el mockup no marca ningún campo como requerido visualmente.
- **Sin página de detalle (`/dashboard/productos/[id]`):** a diferencia de Proveedores, el mockup de referencia (`references/products/`) solo contempla lista + modal de edición, sin vista de detalle separada. Se descartó agregarla porque no está en el mockup y no fue solicitada.
- **Ventas (`app/dashboard/ventas/`) no se toca en este spec — sigue apuntando a `dbo.productos`:** se descubrió durante la planeación que `ventas/page.tsx` y `VentaModal.tsx` dependen de `getProductos(id_sucursal)` e `IProducto` (por sucursal) para armar el formulario de venta de productos. Migrar Ventas a `inventory.Products` habría ampliado el alcance más allá de "Catálogo de Productos" y arriesgado romper un flujo no solicitado. Se decidió conservar `getProductos`, `saveProducto` es removida (sin otros consumidores) pero `getProductos` y `interfaces/producto.ts` permanecen intactos exclusivamente para uso de Ventas, mientras la nueva sección Productos vive en paralelo con nombres propios (`IProduct`, `getProducts`, etc.) sobre `inventory.Products`. Queda como deuda explícita: dos catálogos de productos coexisten en el sistema (`dbo.productos` para Ventas, `inventory.Products` para el catálogo administrable) hasta un spec futuro que unifique o migre Ventas.
- **`ProductoFila.tsx`/`ProductoModal.tsx` viejos se eliminan, `ProductRow.tsx`/`ProductModal.tsx` nuevos en inglés:** aplica la convención de nombres de `CLAUDE.md`, igual criterio que se usó en Proveedores (`SupplierRow`/`SupplierModal`) sin renombrar retroactivamente otras features existentes.
- **Filtros de Categoría y Proveedor funcionales client-side (no solo visuales):** a diferencia de "Filtros" en Proveedores (que quedó sin lógica), aquí sí se implementan porque el mockup los presenta como parte central de la experiencia de catálogo y los datos para poblarlos (categorías, proveedores) ya están disponibles vía `getCategories`/`getSuppliers`.

## Riesgos identificados

- **Dos catálogos de productos coexistiendo (`dbo.productos` para Ventas, `inventory.Products` para esta sección):** genera confusión potencial para desarrolladores futuros y para el negocio, ya que un producto creado en la nueva sección Productos no aparecerá como opción de venta en `/dashboard/ventas` (que sigue leyendo de la tabla vieja). Se acepta como deuda explícita hasta un spec futuro que decida cómo unificar o migrar Ventas.
- **`inventory.units_measurement` con todas las filas en `status = 0`:** al filtrar por `status = 1` (decisión tomada), el select de Unidad de Medida aparecerá vacío en producción hasta que alguien corrija el seed de datos manualmente en BD. Se mitiga documentándolo aquí explícitamente; no se corrige el dato como parte de este spec.
- **`inventory.categories`, `inventory.units_measurement` e `inventory.proveedores` sin relación declarada (FK física) con `inventory.Products`:** las relaciones son solo lógicas (`id_category`, `id_unit_measurement`, `id_supplier` sin `FOREIGN KEY` en el `CREATE TABLE` visto en `queries.txt`). Un registro eliminado o mal escrito en esas tablas puede dejar productos con referencias huérfanas sin que la BD lo impida; se acepta porque es el mismo patrón (`FK lógica`, sin integridad referencial) usado en el resto del proyecto.
- **Selects nativos en vez de combobox real:** con catálogos pequeños hoy (4 categorías, ~9 unidades) la UX es aceptable, pero si el catálogo de proveedores o categorías crece mucho, un `<select>` largo sin búsqueda dejará de ser cómodo. Se acepta porque no fue parte del alcance solicitado; se puede revisar en un spec futuro si el volumen de datos lo justifica.
- **Eliminación de `saveProducto`/`deleteProducto` viejos:** aunque la búsqueda de referencias confirmó que solo eran usados por los componentes que se reemplazan en este spec, existe un riesgo residual si algún código no detectado por `grep` los importaba dinámicamente; se mitiga con el paso de verificación `npm run build` en el plan de implementación.
