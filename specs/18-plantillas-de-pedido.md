# 18 — Plantillas de pedido

## Header

- **Estado:** Aprobado
- **Depende de:** [[09-pedidos-compra-recepcion]] (`inventory.Products`, `inventory.purchase_orders`, `PurchaseCartContext`, `PurchaseCartSummary`, `/dashboard/pedidos/nuevo`), [[08-productos-inventario-crud]] (`Products.price`, `Products.activo`, `Products.id_supplier`), [[10-metodo-pago-pedidos]] (patrón de `ActionResult` y validación server-side en `app/dashboard/pedidos/actions.ts`)
- **Fecha:** 2026-08-17
- **Objetivo:** Implementar la pestaña "Plantillas de pedido" de `/dashboard/pedidos/nuevo` con persistencia en BD a nivel empresa, permitiendo guardar el carrito actual como plantilla nombrada, listarlas en grid con su valor estimado, editarlas (cantidades, proveedor, quitar líneas), eliminarlas lógicamente y cargarlas al carrito con un clic.

## Alcance

**Incluye:**

- **Dos tablas nuevas** en el esquema `inventory`: `purchase_order_templates` (encabezado) y `purchase_order_template_items` (líneas). Las plantillas son **de empresa** (`id_empresa`): visibles desde cualquier sucursal.
- **Guardar carrito como plantilla**: botón nuevo en `PurchaseCartSummary`, debajo de "Revisar y generar orden", deshabilitado con el carrito vacío. Abre un modal que solo pide el **nombre**; guarda una línea por cada línea del carrito con `id_product`, `quantity` e `id_supplier`. No guarda `unit_price`, ni fecha estimada, ni notas, ni métodos de pago.
- **Pestaña "Plantillas de pedido"** habilitada en `app/dashboard/pedidos/nuevo/page.tsx` (hoy `disabled` con `title="Próximamente"`). Al activarla:
  - Se **oculta** la barra de filtros de productos (buscar / categoría / proveedor) y se muestra un **buscador propio** que filtra plantillas por nombre, client-side.
  - Se oculta `SuggestedProductsTable` y se muestra el grid de plantillas (`grid-cols-1 lg:grid-cols-2`), según `references/orders/plantilla.html`.
  - El **sidebar del carrito (`PurchaseCartSummary`) permanece visible**.
- **Card de plantilla** con: nombre, número de productos, "Última actualización" (`updated_at`), **valor estimado sin IVA** (Σ `quantity × Products.price` **actual**, calculado server-side), y tres acciones: Editar, Eliminar, "Usar para Pedido".
- **Card punteada "Crear Nueva Plantilla"** siempre presente al final del grid: al hacer clic cambia a la pestaña "Sugeridos para pedir"; su texto explica que se arma el carrito y se guarda como plantilla.
- **Editar** (modal): renombrar, editar `quantity` de cada línea, cambiar el `id_supplier` de cada línea, y quitar líneas. **No** permite agregar productos nuevos. Guardar actualiza `updated_at`.
- **Eliminar**: borrado **lógico** (`status = 0`) previa confirmación en modal.
- **"Usar para Pedido"**: carga las líneas de la plantilla al `PurchaseCartContext`. Si el carrito ya tiene líneas, **pregunta antes** (confirmación) y reemplaza; si está vacío, carga directo. `unit_price` de cada línea se toma del `Products.price` **actual**, no de la plantilla. Los productos que ya no existen, están inactivos o no son de la empresa se **omiten con aviso visible** indicando cuántos y cuáles. Si no queda ninguna línea utilizable, no se toca el carrito y se avisa.
- **Nombres únicos por empresa**, comparación case-insensitive, validada server-side tanto al crear como al renombrar; devuelve `{ ok: false, message }`.
- Server actions nuevas en `app/dashboard/pedidos/actions.ts`, siguiendo el patrón `ActionResult<T>` y resolviendo `id_empresa`/`id_user` desde el JWT (`getActiveUser`), nunca desde el cliente.

**No incluye:**

- Plantillas privadas por usuario o filtradas por sucursal — `id_sucursal` se guarda **solo como referencia informativa** de dónde se creó y no filtra ni condiciona nada.
- Guardar precio unitario, fecha estimada de entrega, notas o método de pago dentro de la plantilla — todo eso se captura al armar el pedido.
- Agregar productos nuevos desde el modal de edición (entran por el flujo del carrito).
- Duplicar/clonar plantillas, plantillas favoritas, ordenamiento configurable, o paginación del grid.
- Sumar/mergear la plantilla al carrito existente — la carga siempre **reemplaza** (previa confirmación).
- Crear plantillas automáticamente a partir de una orden de compra ya generada (`/dashboard/pedidos/[id]` → "Guardar como plantilla").
- Restringir estas acciones por rol más allá de lo que ya hace `proxy.ts` para `/dashboard/pedidos` — sin cambios a `proxy.ts`.
- Recuperar plantillas eliminadas desde la UI (el `status = 0` solo se revierte por SQL directo).
- Cambios visuales a `SuggestedProductsTable`, a las KPI cards del encabezado o al flujo de revisión/generación de la orden.

## Modelo de datos

### Tablas nuevas (SQL Server, esquema `inventory`)

```sql
CREATE TABLE [inventory].[purchase_order_templates](
    [id_purchase_order_template] [int] IDENTITY(1,1) NOT NULL,
    [name]            [varchar](150) NOT NULL,
    [id_empresa]      [int] NOT NULL,
    [id_sucursal]     [int] NULL,      -- solo referencia informativa de dónde se creó; no filtra
    [id_user_created] [int] NOT NULL,
    [created_at]      [datetime] NOT NULL,
    [updated_at]      [datetime] NOT NULL,
    [status]          [bit] NOT NULL DEFAULT 1,  -- 0 = eliminada lógicamente
 CONSTRAINT [PK_purchase_order_templates] PRIMARY KEY CLUSTERED ([id_purchase_order_template] ASC)
);

CREATE TABLE [inventory].[purchase_order_template_items](
    [id_purchase_order_template_item] [int] IDENTITY(1,1) NOT NULL,
    [id_purchase_order_template]      [int] NOT NULL,
    [id_product]                      [int] NOT NULL,
    [id_supplier]                     [int] NULL,
    [quantity]                        [decimal](18, 2) NOT NULL,
 CONSTRAINT [PK_purchase_order_template_items] PRIMARY KEY CLUSTERED ([id_purchase_order_template_item] ASC)
);

CREATE INDEX [IX_pot_empresa_status] ON [inventory].[purchase_order_templates]([id_empresa],[status]);
CREATE INDEX [IX_poti_template]      ON [inventory].[purchase_order_template_items]([id_purchase_order_template]);
```

Notas de diseño:

- **No hay snapshots de producto** en las líneas (a diferencia de `purchase_order_items`, que congela `product_name`/`brand`/`conversion_factor`): una plantilla es una *intención de compra recurrente*, así que nombre y precio deben leerse siempre actuales desde `inventory.Products`. Ese es exactamente el motivo por el que un producto borrado se omite al usar la plantilla.
- **`unit_price` no se guarda.** El valor estimado y el `unit_price` del carrito salen de `Products.price` vigente.
- La unicidad de `name` por empresa **no** se impone con índice único (el borrado lógico dejaría nombres "ocupados" por plantillas eliminadas): se valida en el server action contra `status = 1`.

### Interfaces (`interfaces/purchase_order_template.ts`)

```ts
export interface IPurchaseOrderTemplate {
  id_purchase_order_template: number;
  name:            string;
  id_empresa:      number;
  id_sucursal:     number | null;
  id_user_created: number;
  created_at:      string;   // "YYYY-MM-DD HH:mm:ss" (CONVERT varchar(19), 120)
  updated_at:      string;
  status:          boolean;
}

export interface IPurchaseOrderTemplateItem {
  id_purchase_order_template_item: number;
  id_purchase_order_template:      number;
  id_product:                      number;
  id_supplier:                     number | null;
  quantity:                        number;
}

/** Fila del grid: encabezado + agregados calculados server-side sobre precios actuales. */
export interface IPurchaseOrderTemplateListItem extends IPurchaseOrderTemplate {
  items_count:    number;   // solo líneas con producto activo de la empresa
  estimated_value: number;  // Σ quantity × Products.price actual, SIN IVA
}

/** Línea resuelta para el modal de edición y para cargar al carrito. */
export interface IPurchaseOrderTemplateItemDetail extends IPurchaseOrderTemplateItem {
  product_name:        string;
  product_code:        string;
  brand:               string;
  id_unit_measurement: number | null;
  pieces:              number | null;
  split:               boolean;
  price:               number;   // Products.price actual
  is_available:        boolean;  // producto existe, activo = 1, status = 1 y de la empresa
}
```

### Firmas de los server actions nuevos (`app/dashboard/pedidos/actions.ts`)

```ts
getPurchaseOrderTemplates(): Promise<ActionResult<IPurchaseOrderTemplateListItem[]>>
getPurchaseOrderTemplateById(id): Promise<ActionResult<{ template: IPurchaseOrderTemplate; items: IPurchaseOrderTemplateItemDetail[] }>>
createPurchaseOrderTemplate(input: { name: string; id_sucursal: number | null; lines: { id_product: number; id_supplier: number | null; quantity: number }[] }): Promise<ActionResult<{ id_purchase_order_template: number }>>
updatePurchaseOrderTemplate(input: { id_purchase_order_template: number; name: string; lines: { id_product: number; id_supplier: number | null; quantity: number }[] }): Promise<ActionResult<null>>
deletePurchaseOrderTemplate(id: number): Promise<ActionResult<null>>
```

Todos resuelven `id_empresa`/`id_user` con `getActiveUser()` y filtran por `id_empresa` en cada `WHERE`. `createPurchaseOrderTemplate`/`updatePurchaseOrderTemplate` corren dentro de una `db.transaction` (encabezado + líneas), validan que cada `id_product` exista, esté activo y sea de la empresa, que `quantity > 0`, y que el nombre no colisione (case-insensitive) con otra plantilla `status = 1` de la misma empresa. `updatePurchaseOrderTemplate` reemplaza las líneas completas (`DELETE` + `INSERT`) y sella `updated_at = buildDate(new Date())`.

**Fechas:** `created_at`/`updated_at` se escriben con `buildDate(new Date())` y se leen con `CONVERT(varchar(19), [col], 120)`; en la card se formatean normalizando el string (`replace(" ", "T")`), nunca `new Date(raw)` directo.

## Plan de implementación

1. **Esquema en BD.** Ejecutar el DDL de `inventory.purchase_order_templates`, `inventory.purchase_order_template_items` y sus dos índices directamente contra la base (no hay migraciones), y anexar el mismo DDL a `queries.txt` siguiendo el formato de las tablas de spec 09. *Verificación:* `SELECT * FROM inventory.purchase_order_templates` responde vacío sin error.

2. **`interfaces/purchase_order_template.ts`.** Crear el archivo con `IPurchaseOrderTemplate`, `IPurchaseOrderTemplateItem`, `IPurchaseOrderTemplateListItem` e `IPurchaseOrderTemplateItemDetail` tal como quedaron en "Modelo de datos". Sistema funcional (nada lo consume aún).

3. **Server actions de lectura** en `app/dashboard/pedidos/actions.ts`:
   - `getPurchaseOrderTemplates()`: `SELECT` de encabezados `status = 1` de la empresa, con `OUTER APPLY` que agrega `items_count` y `estimated_value` (`SUM(i.quantity * p.price)`) uniendo a `inventory.Products` con `p.status = 1 AND p.activo = 1 AND p.id_empresa = @id_empresa` — las líneas de productos ya no disponibles quedan fuera de ambos agregados. Fechas con `CONVERT(varchar(19), ..., 120)`. Orden por `updated_at DESC`.
   - `getPurchaseOrderTemplateById(id)`: encabezado + líneas con `LEFT JOIN` a `Products` para resolver `product_name`, `product_code`, `brand`, `id_unit_measurement`, `pieces`, `split`, `price` e `is_available`. Filtra por `id_empresa` del JWT.

4. **Server actions de escritura** en el mismo archivo: `createPurchaseOrderTemplate`, `updatePurchaseOrderTemplate` y `deletePurchaseOrderTemplate`, con las validaciones descritas en "Modelo de datos" (nombre no vacío, nombre único case-insensitive entre `status = 1` de la empresa, al menos una línea, `quantity > 0`, productos existentes/activos/de la empresa), corriendo encabezado+líneas dentro de una sola `db.transaction`. `deletePurchaseOrderTemplate` hace `UPDATE ... SET status = 0` filtrando por `id_empresa`. Todas terminan con `revalidatePath("/dashboard/pedidos/nuevo")`. *Verificación:* invocables desde la UI del paso siguiente; hasta aquí `npm run build` compila sin consumidores.

5. **`contexts/PurchaseCartContext.tsx`.** Agregar `replaceLines(lines: IPurchaseCartLine[]): void` al contexto (setea `lines` de golpe, deja `estimatedDate`/`notes`/`paymentMethodBySupplier` intactos). Es la única API nueva que necesita la carga de plantillas; el resto del contexto no cambia.

6. **`SaveCartAsTemplateModal.tsx`** en `app/dashboard/pedidos/nuevo/componentes/`: modal client-side que pide solo el nombre, muestra cuántas líneas se guardarán, y llama a `createPurchaseOrderTemplate` con las líneas actuales del carrito (`id_product`, `id_supplier`, `quantity`) y el `id_sucursal` del `SucursalContext`. Muestra el `message` del `ActionResult` en error (incluido el nombre duplicado).

7. **`PurchaseCartSummary.tsx`.** Agregar el botón "Guardar como plantilla" debajo de "Revisar y generar orden", con el mismo criterio de `disabled={lines.length === 0}`, que abre `SaveCartAsTemplateModal`. Estilo secundario (borde, no relleno azul) para no competir con la acción primaria. *Verificación:* se puede crear una plantilla desde el carrito y verla en BD.

8. **`OrderTemplateCard.tsx`**: card presentacional del grid (nombre, `items_count` productos, "Última actualización", valor estimado sin IVA formateado con `Intl.NumberFormat("es-MX")`, y los tres botones), traduciendo el HTML de referencia a la paleta que ya usa `page.tsx` (`#0051d5`, `#0b1c30`, `#44474f`, `#c4c6d0`, `#ba1a1a`) con sus variantes `dark:`, e íconos de `lucide-react` (`Package`, `Pencil`, `Trash2`, `ArrowRight`) en vez de Material Symbols. Recibe callbacks `onEdit`/`onDelete`/`onUse` — sin lógica propia.

9. **`EditOrderTemplateModal.tsx`**: carga la plantilla con `getPurchaseOrderTemplateById`, permite renombrar, editar `quantity` por línea, cambiar `id_supplier` por línea (select alimentado con `getSuppliers`) y quitar líneas; marca visualmente las líneas con `is_available = false` como no disponibles y permite quitarlas. Guarda con `updatePurchaseOrderTemplate`. No ofrece agregar productos.

10. **`OrderTemplatesTab.tsx`**: componente client que contiene el buscador propio por nombre (filtrado client-side sobre lo ya cargado), el grid `grid-cols-1 lg:grid-cols-2`, las cards, la card punteada "Crear Nueva Plantilla" (recibe `onCreateNew` y cambia a la pestaña "Sugeridos para pedir"), los estados de carga/vacío/error, y orquesta los tres modales. Reusa `app/dashboard/componentes/ConfirmModal.tsx` para la confirmación de borrado y para la confirmación de reemplazo del carrito.
    La acción **"Usar para Pedido"**: pide las líneas con `getPurchaseOrderTemplateById`, descarta las de `is_available = false`, mapea las restantes a `IPurchaseCartLine` (`unit_price = price` actual), y — si `lines.length > 0` en el carrito — abre el `ConfirmModal` antes de llamar a `replaceLines`. Tras cargar, muestra un aviso con los productos omitidos, si los hubo; si no queda ninguna línea utilizable, no toca el carrito y solo avisa.

11. **`app/dashboard/pedidos/nuevo/page.tsx`**: habilitar el botón de la pestaña "Plantillas de pedido" (quitar `disabled`/`title="Próximamente"` y darle el mismo tratamiento activo/inactivo que las otras dos), condicionar la barra de filtros de productos y `SuggestedProductsTable` a `activeTab !== "plantillas"`, y renderizar `<OrderTemplatesTab onCreateNew={() => setActiveTab("sugeridos")} />` cuando la pestaña esté activa. El sidebar con `PurchaseCartSummary` queda fuera del condicional. Cargar las plantillas dentro de `OrderTemplatesTab` (no en `page.tsx`) para que no se pidan mientras la pestaña no se abre.

12. **Verificación manual completa:**
    - Armar un carrito con 3 productos de distintos proveedores, guardarlo como plantilla: confirmar filas en ambas tablas con `quantity` e `id_supplier` correctos y `unit_price` ausente.
    - Intentar guardar otra plantilla con el mismo nombre en distinta capitalización: se rechaza con mensaje.
    - Abrir la pestaña: la card muestra el conteo correcto, la fecha de actualización bien formateada y el valor estimado = Σ `quantity × price` **sin IVA**.
    - Cambiar el `price` de un producto en `/dashboard/productos` y recargar: el valor estimado de la card refleja el precio nuevo.
    - Editar: cambiar una cantidad, cambiar un proveedor, quitar una línea, renombrar. Confirmar que `updated_at` avanza y que las líneas quedan como se dejaron.
    - "Usar para Pedido" con el carrito **vacío**: carga directo. Con el carrito **con líneas**: pide confirmación y reemplaza; cancelar no toca el carrito.
    - Desactivar (`activo = 0`) un producto de la plantilla y usarla: se carga el resto y aparece el aviso nombrando el omitido; el conteo y el valor de la card lo excluyen.
    - Eliminar: confirma, desaparece del grid y la fila queda con `status = 0`. El nombre vuelve a estar disponible para una plantilla nueva.
    - Verificar la pestaña en modo claro y oscuro, y en ancho móvil (grid a una columna, sidebar debajo).
    - Cambiar de sucursal en el header: las mismas plantillas siguen visibles (son de empresa).

13. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [ ] Existen en BD `inventory.purchase_order_templates` y `inventory.purchase_order_template_items` con las columnas e índices del DDL, y el DDL quedó anexado a `queries.txt`.
- [ ] `PurchaseCartSummary` muestra el botón "Guardar como plantilla", deshabilitado cuando el carrito está vacío y habilitado cuando tiene al menos una línea.
- [ ] Guardar el carrito como plantilla crea **una** fila de encabezado y **una fila por línea del carrito**, con `id_product`, `id_supplier` y `quantity`; no se persiste `unit_price`, `estimated_date`, `notes` ni método de pago.
- [ ] Intentar crear o renombrar una plantilla con un nombre que ya usa otra plantilla activa de la empresa (ignorando mayúsculas/minúsculas) devuelve `{ ok: false, message }` y la UI muestra ese mensaje; el nombre de una plantilla eliminada **sí** puede reutilizarse.
- [ ] La pestaña "Plantillas de pedido" de `/dashboard/pedidos/nuevo` está habilitada y, al activarse, oculta la barra de filtros de productos y `SuggestedProductsTable`, muestra el grid de plantillas con su buscador por nombre, y mantiene visible `PurchaseCartSummary`.
- [ ] El buscador de plantillas filtra por nombre client-side sobre las plantillas ya cargadas, sin volver a consultar el servidor.
- [ ] Cada card muestra nombre, número de productos, "Última actualización" con `updated_at` formateado desde el string de BD (sin `new Date(raw)` directo), y el valor estimado calculado server-side como Σ `quantity × Products.price` actual **sin IVA**.
- [ ] Cambiar el precio de un producto en `/dashboard/productos` se refleja en el valor estimado de las cards que lo contienen, sin editar la plantilla.
- [ ] Las líneas cuyo producto ya no existe, está inactivo o no es de la empresa quedan excluidas de `items_count` y de `estimated_value`.
- [ ] La card punteada "Crear Nueva Plantilla" aparece siempre al final del grid y al hacer clic cambia a la pestaña "Sugeridos para pedir".
- [ ] El modal de edición permite renombrar, cambiar cantidad, cambiar proveedor y quitar líneas; **no** ofrece agregar productos nuevos. Al guardar, las líneas quedan exactamente como se dejaron y `updated_at` avanza.
- [ ] Eliminar una plantilla pide confirmación (`ConfirmModal` compartido), y al confirmar deja la fila con `status = 0` y la quita del grid; no se borra físicamente ninguna fila.
- [ ] "Usar para Pedido" con el carrito vacío carga las líneas directamente; con el carrito no vacío pide confirmación antes de **reemplazar**, y cancelar deja el carrito intacto.
- [ ] Las líneas cargadas al carrito toman `unit_price` del `Products.price` actual, no de la plantilla.
- [ ] Al usar una plantilla con productos no disponibles, esos se omiten y la UI muestra un aviso indicando cuántos y cuáles; si ninguna línea es utilizable, el carrito no se modifica y solo se avisa.
- [ ] Todas las lecturas y escrituras de plantillas resuelven `id_empresa`/`id_user` desde el JWT vía `getActiveUser()` y filtran por `id_empresa` en el `WHERE`; ningún action confía en un `id_empresa` recibido del cliente.
- [ ] `createPurchaseOrderTemplate` y `updatePurchaseOrderTemplate` escriben encabezado y líneas dentro de una sola `db.transaction`; si falla la inserción de una línea, no queda ni encabezado creado ni líneas parciales.
- [ ] Las plantillas creadas en una sucursal siguen visibles al cambiar de sucursal en el header.
- [ ] Las server actions siguen la convención `ActionResult<T>` y viven en `app/dashboard/pedidos/actions.ts`; no se agregó ninguna ruta REST en `app/api/`.
- [ ] Los nombres de funciones, variables, componentes y tipos nuevos están en inglés y son descriptivos, conforme a `CLAUDE.md`.
- [ ] La pestaña se ve correctamente en modo claro y oscuro, y en ancho móvil el grid colapsa a una columna con el sidebar debajo.
- [ ] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Persistencia en BD, no en `sessionStorage`.** El carrito vive en `sessionStorage` porque es efímero por naturaleza (spec 09 lo decidió así explícitamente), pero una plantilla es justo lo contrario: existe para sobrevivir sesiones y ser compartida entre quienes capturan pedidos. Guardarla en el navegador la volvería inútil el primer día que se pide desde otra computadora.

- **Plantillas a nivel empresa, no por sucursal ni privadas por usuario.** El HTML de referencia ya distingue la sucursal en el propio nombre ("Básicos de Sucursal Norte"), lo que confirma que el corte natural es semántico y no un filtro duro. `id_sucursal` se guarda solo como referencia informativa de dónde se creó: cuesta cero y deja la puerta abierta a filtrar más adelante sin migración.

- **Las líneas guardan `id_supplier` pero no `unit_price`.** El proveedor es una decisión de negocio que el usuario ya toma por línea en la revisión y que vale la pena conservar. El precio no: congelarlo haría que una plantilla de hace seis meses generara pedidos a precios viejos, que es exactamente el error que una plantilla debería evitar. Se descartó también guardar snapshots de nombre/marca — a diferencia de `purchase_order_items`, aquí el dato correcto es siempre el vigente.

- **Creación solo desde el carrito, no con un formulario propio.** El carrito ya resuelve buscar productos, filtrar por categoría/proveedor y capturar cantidades; construir un segundo capturador dentro de un modal habría duplicado toda esa UI para el mismo resultado. Consecuencia aceptada: la card punteada del HTML no abre un formulario, sino que redirige a la pestaña de armado.

- **La edición sí permite quitar líneas y cambiar cantidad/proveedor, pero no agregar productos.** Es el punto medio entre "solo renombrar" (insuficiente: ajustar cantidades es lo que más se hace) y "modal completo con buscador" (que reintroduciría el capturador que acabamos de descartar). Agregar productos se hace por el flujo del carrito, volviendo a guardar.

- **"Usar para Pedido" reemplaza el carrito, con confirmación si no está vacío.** Se descartó mergear porque genera conflictos ambiguos (¿qué pasa con un producto que está en ambos, con distinta cantidad y distinto proveedor?) y se descartó reemplazar en silencio porque destruiría trabajo sin aviso. La confirmación solo aparece cuando hay algo que perder.

- **Productos no disponibles se omiten con aviso, en vez de bloquear la carga.** Bloquear dejaría la plantilla inservible por un solo producto dado de baja, justo cuando el usuario tiene prisa; omitir en silencio haría que se generara un pedido incompleto sin que nadie lo note. El aviso nombra los omitidos para que el usuario decida si los repone a mano.

- **Nombres únicos por empresa validados en el action, no con índice único en BD.** Un índice único sobre `(id_empresa, name)` chocaría con el borrado lógico: una plantilla eliminada seguiría bloqueando su nombre para siempre. La validación contra `status = 1` es la que refleja la regla real.

- **Borrado lógico (`status = 0`), consistente con el resto del proyecto.** Todas las tablas de `inventory` y `dbo` usan `status` bit; además una plantilla borrada por error no tiene forma de reconstruirse desde el historial de órdenes. No se expone recuperación en la UI porque nadie la ha pedido.

- **El valor estimado se muestra sin IVA.** Es el subtotal, que es lo comparable contra el `subtotal` de las órdenes ya generadas; el IVA lo agrega el resumen del carrito con su `TAX_RATE`, y duplicarlo en la card sugeriría que la plantilla ya trae un total cerrado, cosa que no hace.

- **Los agregados (`items_count`, `estimated_value`) se calculan server-side en el `SELECT`, no en el cliente.** Evita traer todas las líneas de todas las plantillas solo para pintar el grid, y mantiene el criterio de `CLAUDE.md` de no hacer trabajo de datos en el cliente. Las líneas completas solo se piden al editar o al usar una plantilla concreta.

- **`OrderTemplatesTab` carga sus datos al montarse, no `page.tsx`.** Si `page.tsx` pidiera las plantillas junto con los productos sugeridos, todo usuario pagaría esa consulta aunque nunca abra la pestaña. La página ya es un componente cliente (por `SucursalContext`), así que la mejora posible aquí es acotar *cuándo* se pide, no *dónde*.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| **Plantillas que envejecen mal.** Con el tiempo una plantilla acumula productos descontinuados o cantidades que ya no corresponden al consumo real, y al usarse genera pedidos silenciosamente equivocados en cantidad. | El aviso de productos omitidos y la "Última actualización" visible en la card dan la señal; el modal de edición permite corregir en el momento. No se agrega caducidad automática ni alertas por antigüedad — sería un spec propio. |
| **El valor estimado no coincide con el total del pedido generado.** La card muestra subtotal sin IVA con precios actuales; la orden final agrega IVA y permite editar precios en la revisión. Un usuario puede leer la card como si fuera el costo final. | La etiqueta "Valor Estimado" (no "Total") y la ausencia de IVA en la card lo acotan; el resumen del carrito sigue siendo la única fuente del total real. Riesgo de lectura, no de datos. |
| **Reemplazo del carrito confirmado por error.** Aceptar el `ConfirmModal` descarta las líneas y cantidades ya capturadas, sin deshacer. | El modal es explícito sobre cuántas líneas se van a perder. No se implementa undo: el carrito no tiene historial y agregarlo excede este spec. |
| **Nombres duplicados bajo concurrencia.** La unicidad se valida con un `SELECT` previo dentro del action, no con un índice único; dos usuarios guardando el mismo nombre en el mismo instante podrían pasar ambos. | Volumen de uso mínimo (pocos usuarios de administración, plantillas creadas esporádicamente) y consecuencia trivial (dos plantillas homónimas, ambas usables y renombrables). Se aceptó a cambio de no romper el borrado lógico con un índice único. |
| **Precios `NULL` o en cero en `Products.price`.** El valor estimado saldría subestimado sin que nada lo indique. | `SUM` ignora `NULL` y el resto de la línea sigue siendo utilizable; es deuda heredada del catálogo (spec 08), no introducida aquí. Se corrige capturando el precio en `/dashboard/productos`. |
| **`id_supplier` guardado que ya no atiende ese producto.** La plantilla puede cargar al carrito un proveedor que dejó de venderlo o que se dio de baja. | El proveedor sigue siendo editable por línea en la pantalla de revisión antes de generar la orden, que es donde se valida contra métodos de pago (spec 10). No se valida el proveedor al cargar. |
| **Grid sin paginación.** Con muchas plantillas el grid crece indefinidamente y el `SELECT` con agregados por plantilla se vuelve más pesado. | El buscador por nombre absorbe el caso realista (decenas, no miles). Si el volumen crece, paginar es un cambio acotado al action y al tab, sin tocar el modelo. |
| **Líneas huérfanas si se borra físicamente un producto.** No hay FK real (el proyecto no las usa en `inventory`), así que un `DELETE` directo sobre `Products` dejaría líneas apuntando a la nada. | El flujo de la app solo hace baja lógica (`activo = 0`), que ya está contemplada con `is_available = false`. El caso solo ocurre por SQL manual. |
