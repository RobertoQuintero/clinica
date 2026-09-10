# 48 — Pre-solicitudes de productos por el Podólogo

## Header

- **Estado:** Aprobado
- **Depende de:**
  - [[45-inventario-actual]] — el grupo "Inventario" y sus sub-secciones donde se agrega "Solicitudes".
  - [[46-rol-compras-acceso-inventario]] — patrón de gating por rol (`navConfig.tsx` + `proxy.ts`) que esta spec replica para el rol 2.
  - [[47-carrito-pedidos-por-sucursal]] — el carrito (`PurchaseCartContext`) es por sucursal; confirmar una solicitud carga sus líneas en el carrito de la sucursal de la solicitud.
- **Modifica base de datos:** Sí — dos tablas nuevas (`inventory.purchase_requests`, `inventory.purchase_request_items`).
- **Fecha:** 2026-09-10
- **Objetivo:** Permitir que el rol 2 (Podólogo) cree pre-solicitudes de productos con solo cantidades (sin precios ni proveedor) desde una nueva sub-sección "Solicitudes" de Inventario —única sección de Inventario a la que tendrá acceso—, para que los roles 1, 4 y 6 las revisen y, al confirmarlas, sus líneas se fusionen en el carrito de pedidos de esa sucursal y sigan el flujo de orden de compra ya existente.

## Alcance

**Incluye:**

**Base de datos (2 tablas nuevas en el schema `inventory`)**

- `inventory.purchase_requests` — cabecera: `folio` (`SOL-YYYY-NNNN`), `id_empresa`, `id_sucursal`, `id_status_request`, `notes`, `rejection_reason`, `id_user_created`, `id_user_reviewed`, `created_at`, `reviewed_at`, `status`.
- `inventory.purchase_request_items` — líneas: `id_purchase_request`, `id_product`, snapshot (`product_name`, `product_code`, `brand`, `id_unit_measurement`), `quantity`, `created_at`. **Sin precio, sin proveedor, sin IVA, sin totales.**
- Script DDL agregado a `queries.txt` (no hay herramienta de migraciones).

**Nueva sub-sección `app/dashboard/solicitudes/`**

- `page.tsx` — listado de solicitudes **pendientes de la sucursal seleccionada** (mismo listado para rol 2 y para roles 1/4/6; cambian las acciones disponibles). Muestra folio, quién la creó, fecha, nº de productos.
- `nueva/page.tsx` — armado de la solicitud: tabla de **todos los productos activos** de la empresa con buscador + filtro por categoría, `QuantityStepper` por línea (reutilizando `app/dashboard/componentes/QuantityStepper.tsx`), columna de **stock actual** de la sucursal como referencia, y campo de **notas** de cabecera. Sin columnas de precio/proveedor/IVA.
- `[id]/page.tsx` — detalle: rol 2 (si es `Pendiente`) puede editar cantidades/notas o cancelar; roles 1/4/6 pueden **Confirmar** o **Rechazar** (con motivo obligatorio).
- `actions.ts` — server actions con validación `zod` (patrón `lib/billing/schemas.ts`) y retorno `ActionResult<T>`: `getProductsForRequest`, `getPendingPurchaseRequests`, `getPurchaseRequestDetail`, `createPurchaseRequest`, `updatePurchaseRequest`, `cancelPurchaseRequest`, `confirmPurchaseRequest`, `rejectPurchaseRequest`, `getPendingRequestsCount`.
- `componentes/` — `PurchaseRequestRow.tsx`, `RequestProductsTable.tsx`, `RequestStatusBadge.tsx`, `RejectRequestModal.tsx`.
- `interfaces/purchase_request.ts` — `IPurchaseRequest`, `IPurchaseRequestItem`, `IPurchaseRequestDetail`, `IRequestProduct`.

**Confirmación → carrito**

- `confirmPurchaseRequest(id)` transiciona la solicitud `Pendiente → Confirmada` en BD (falla si ya no está pendiente) y **devuelve sus líneas** listas para el carrito, tomando proveedor y precio por defecto **del producto** (`id_supplier`, `price`) como punto de partida editable.
- El botón "Confirmar" navega a `/dashboard/pedidos/nuevo?solicitud=<id>`; esa página (que sí vive dentro del `PurchaseCartProvider`) llama a `confirmPurchaseRequest` y **fusiona** las líneas devueltas en el carrito de esa sucursal, luego limpia el query param.
- **Nuevo método `mergeLines(lines)` en `PurchaseCartContext`**: si el producto ya está en el carrito, **suma** la cantidad; si no, agrega la línea. No toca fecha estimada, notas, métodos de pago ni envío.

**Gating del rol 2**

- `NavChild` gana un campo opcional `excludeRoles?: number[]`, y `Sidebar.tsx` filtra los hijos por rol (en el submenú expandido y en el flyout colapsado).
- En `navConfig.tsx`: nuevo hijo `{ href: "/dashboard/solicitudes", label: "Solicitudes", icon: ClipboardPlus }` sin exclusiones; los otros 6 hijos del grupo Inventario reciben `excludeRoles: [2]`. El grupo "Inventario" mantiene `excludeRoles: [5]` (sin cambio — el rol 2 debe seguir viéndolo).
- En `proxy.ts`: nueva regla — si `id_role === 2` y la ruta empieza con alguno de los 6 prefijos de Inventario distintos de `/dashboard/solicitudes`, redirigir a `/dashboard/solicitudes`. El resto del sistema (Pacientes, Citas, Tratamientos, Ventas, Servicios, Sucursales) **queda intacto para el rol 2**.
- Las acciones de confirmar/rechazar validan `id_role ∈ {1, 4, 6}` **server-side**, no solo en UI.

**Badge de pendientes**

- Contador de solicitudes pendientes de la sucursal seleccionada junto al hijo "Solicitudes" del sidebar, visible solo para roles 1, 4 y 6 (componente cliente `PendingRequestsBadge` que consume `getPendingRequestsCount(selectedId)`).

**No incluye:**

- **Precios, proveedor, IVA, método de pago o envío en la solicitud** — nada de eso existe en el modelo; se define después, en el carrito/orden de compra, por el rol de compras.
- **Historial de solicitudes** (confirmadas/rechazadas/canceladas) — decisión explícita: el listado muestra **solo pendientes**. Las no-pendientes quedan en BD pero sin pantalla que las liste.
- **Enlace solicitud ↔ orden de compra generada** — la solicitud se marca `Confirmada` al pasar al carrito; no se guarda a qué `purchase_order` acabó dando lugar.
- **Ajuste de cantidades por parte de compras al confirmar** — se confirma tal cual; el ajuste se hace después en el carrito, que ya es editable.
- **Notas por línea** — solo notas de cabecera.
- **Notificaciones fuera de la app** (correo, WhatsApp, push) — únicamente el badge del sidebar.
- **Límite de solicitudes pendientes simultáneas** — un podólogo puede tener las que quiera abiertas.
- **Cambios a `purchase_orders`, `order_status`, recepciones, movimientos o conteos** — el flujo de compra existente no se toca; la solicitud muere al entrar al carrito.
- **Restricciones nuevas al rol 2 fuera de Inventario** — sigue con exactamente el mismo acceso que hoy en el resto del sistema.
- **Cambios al rol 5 y al rol 6** — sin regresiones, no se les da ni se les quita nada.

## Modelo de datos

**DDL (a agregar en `queries.txt`)**

```sql
CREATE TABLE [CentroPodologico].[inventory].[purchase_requests] (
  [id_purchase_request] INT IDENTITY(1,1) PRIMARY KEY,
  [folio]               NVARCHAR(20)  NOT NULL,
  [id_empresa]          INT           NOT NULL,
  [id_sucursal]         INT           NOT NULL,
  [id_status_request]   INT           NOT NULL DEFAULT 1,  -- 1 Pendiente, 2 Confirmada, 3 Rechazada, 4 Cancelada
  [notes]               NVARCHAR(MAX) NULL,
  [rejection_reason]    NVARCHAR(500) NULL,
  [id_user_created]     INT           NOT NULL,
  [id_user_reviewed]    INT           NULL,
  [created_at]          DATETIME2     NOT NULL,
  [reviewed_at]         DATETIME2     NULL,
  [status]              BIT           NOT NULL DEFAULT 1
);
CREATE INDEX IX_purchase_requests_pending
  ON [CentroPodologico].[inventory].[purchase_requests] ([id_sucursal], [id_status_request], [status]);

CREATE TABLE [CentroPodologico].[inventory].[purchase_request_items] (
  [id_purchase_request_item] INT IDENTITY(1,1) PRIMARY KEY,
  [id_purchase_request]      INT           NOT NULL
    REFERENCES [CentroPodologico].[inventory].[purchase_requests]([id_purchase_request]),
  [id_product]               INT           NOT NULL,
  [product_name]             NVARCHAR(255) NULL,
  [product_code]             NVARCHAR(50)  NULL,
  [brand]                    NVARCHAR(100) NULL,
  [id_unit_measurement]      INT           NULL,
  [quantity]                 DECIMAL(18,2) NOT NULL,
  [created_at]               DATETIME2     NOT NULL
);
CREATE INDEX IX_purchase_request_items_request
  ON [CentroPodologico].[inventory].[purchase_request_items] ([id_purchase_request]);
```

**`interfaces/purchase_request.ts`**

```ts
/** Estados de una pre-solicitud. Constantes en código, sin tabla catálogo (ver decisiones). */
export const PURCHASE_REQUEST_STATUS = {
  PENDING:   1,
  CONFIRMED: 2,
  REJECTED:  3,
  CANCELLED: 4,
} as const;

export type PurchaseRequestStatusId =
  (typeof PURCHASE_REQUEST_STATUS)[keyof typeof PURCHASE_REQUEST_STATUS];

export interface IPurchaseRequest {
  id_purchase_request: number;
  folio:               string;
  id_empresa:          number;
  id_sucursal:         number;
  id_status_request:   PurchaseRequestStatusId;
  notes:               string | null;
  rejection_reason:    string | null;
  id_user_created:     number;
  id_user_reviewed:    number | null;
  created_at:          string;         // CONVERT(varchar(19), ..., 120)
  reviewed_at:         string | null;  // CONVERT(varchar(19), ..., 120)
  status:              boolean;
}

export interface IPurchaseRequestItem {
  id_purchase_request_item: number;
  id_purchase_request:      number;
  id_product:               number;
  product_name:             string | null;
  product_code:             string | null;
  brand:                    string | null;
  id_unit_measurement:      number | null;
  quantity:                 number;
  created_at:               string;
}

/** Fila del listado: cabecera + nombre de quien la creó + conteo de líneas. */
export interface IPurchaseRequestListItem extends IPurchaseRequest {
  created_by_name: string;
  items_count:     number;
}

export interface IPurchaseRequestDetail extends IPurchaseRequestListItem {
  items: IPurchaseRequestItem[];
}

/**
 * Producto elegible en la pre-solicitud. Deliberadamente SIN `price` ni `id_supplier`:
 * el rol 2 no debe recibir esos datos ni siquiera en el payload.
 */
export interface IRequestProduct {
  id_product:          number;
  name:                string;
  product_code:        string;
  brand:               string;
  id_category:         number | null;
  id_unit_measurement: number | null;
  current_stock:       number;
}
```

**Validación (`zod`, en `app/dashboard/solicitudes/schemas.ts`)**

```ts
const requestLineSchema = z.object({
  id_product: z.number().int().positive(),
  quantity:   z.number().positive(),
});

export const createPurchaseRequestSchema = z.object({
  id_sucursal: z.number().int().positive(),
  notes:       z.string().max(1000).nullable().optional(),
  lines:       z.array(requestLineSchema).min(1),
});

export const updatePurchaseRequestSchema = createPurchaseRequestSchema
  .omit({ id_sucursal: true })
  .extend({ id_purchase_request: z.number().int().positive() });

export const rejectPurchaseRequestSchema = z.object({
  id_purchase_request: z.number().int().positive(),
  rejection_reason:    z.string().trim().min(1).max(500),  // motivo obligatorio
});
```

**Notas de fechas** (reglas de `CLAUDE.md`): `created_at` y `reviewed_at` se escriben con `buildDate(new Date())` y se leen con `CONVERT(varchar(19), [col], 120)`, nunca como `Date`.

**Folio**: `SOL-<año>-<consecutivo 4 dígitos>`, calculado con `COUNT(*) ... WITH (UPDLOCK, HOLDLOCK)` sobre `id_empresa` + prefijo del año, idéntico al patrón de `PO-` en `createPurchaseOrders`.

**Extensión de `PurchaseCartContext`** (sin tabla ni interfaz nueva):

```ts
/** Fusiona líneas en el carrito de la sucursal actual: suma cantidad si el producto ya está, agrega si no. */
mergeLines: (lines: IPurchaseCartLine[]) => void;
```

## Plan de implementación

1. **Base de datos y tipos.**
   Ejecutar el DDL de las dos tablas contra `[CentroPodologico].[inventory]` y dejarlo registrado en `queries.txt`. Crear `interfaces/purchase_request.ts` con las interfaces y `PURCHASE_REQUEST_STATUS`.

   *Verificación:* las tablas existen y `npm run build` compila.

2. **`app/dashboard/solicitudes/schemas.ts` y `actions.ts`.**
   Escribir los esquemas `zod` y las server actions, todas devolviendo `ActionResult<T>` y leyendo el usuario del JWT (`id_user`, `id_role`, `id_empresa`) como hacen las actions de `pedidos`:
   - `getProductsForRequest(id_sucursal)` — productos activos de la empresa + `current_stock` de la sucursal (vía `lib/inventory/stock.ts`), **sin `price` ni `id_supplier`** en el SELECT.
   - `getPendingPurchaseRequests(id_sucursal)` — solo `id_status_request = 1`, con `created_by_name` e `items_count`.
   - `getPurchaseRequestDetail(id_purchase_request)` — cabecera + líneas, validando que la solicitud pertenezca a la empresa del usuario.
   - `createPurchaseRequest(input)` — transacción: folio con `UPDLOCK, HOLDLOCK`, inserta cabecera en estado `PENDING` + líneas con snapshot del producto.
   - `updatePurchaseRequest(input)` — solo si `id_status_request = PENDING` y `id_user_created = id_user`; reemplaza líneas y notas.
   - `cancelPurchaseRequest(id)` — mismas condiciones; pasa a `CANCELLED`.
   - `confirmPurchaseRequest(id)` — valida `id_role ∈ {1,4,6}`; en una transacción pasa `PENDING → CONFIRMED` (con `UPDATE ... WHERE id_status_request = 1`, fallando si afectó 0 filas) y devuelve las líneas ya mapeadas a `IPurchaseCartLine`, tomando `id_supplier`, `price`, `pieces` y `split` del producto actual.
   - `rejectPurchaseRequest(id, rejection_reason)` — mismo gate de rol; pasa a `REJECTED` guardando motivo, `id_user_reviewed` y `reviewed_at`.
   - `getPendingRequestsCount(id_sucursal)` — `COUNT(*)` de pendientes, para el badge.

   *Verificación:* `npm run build` sin errores; las actions se pueden invocar aunque aún no exista UI.

3. **Pantalla de armado: `solicitudes/nueva/page.tsx` + `componentes/RequestProductsTable.tsx`.**
   Client component (depende de `SucursalContext`): buscador, filtro por categoría, tabla con nombre/código/marca/unidad/**stock actual** y `QuantityStepper` por producto, panel lateral con el resumen de líneas elegidas, campo de notas y botón "Enviar solicitud" → `createPurchaseRequest` → redirige a `/dashboard/solicitudes`.

   *Verificación:* con un usuario rol 2 se crea una solicitud y aparece en BD con su folio `SOL-2026-0001` y sus líneas.

4. **Listado y detalle: `solicitudes/page.tsx`, `[id]/page.tsx` y sus componentes.**
   - Listado: solo pendientes de la sucursal seleccionada, con `PurchaseRequestRow` (folio, creado por, fecha, nº de productos, `RequestStatusBadge`) y botón "Nueva solicitud".
   - Detalle: líneas en solo lectura o editables según rol/estado. Rol 2 dueño y `PENDING` → editar cantidades/notas + "Cancelar solicitud". Roles 1/4/6 → "Confirmar y pasar al carrito" y "Rechazar" (abre `RejectRequestModal` con motivo obligatorio).
   - `key` estable por `id_purchase_request` / `id_purchase_request_item`, nunca índice.

   *Verificación:* crear, editar, cancelar y rechazar una solicitud funcionan de punta a punta; una solicitud rechazada o cancelada desaparece del listado.

5. **`mergeLines` en `contexts/PurchaseCartContext.tsx`.**
   Agregar el método al `PurchaseCartContextType` y al provider: por cada línea entrante, si el producto ya existe en `currentCart.lines` suma `quantity`; si no, la agrega. No toca fecha, notas, métodos de pago ni envío. Un solo `updateCurrentCart` para todo el lote.

   *Verificación:* `npm run build`; ningún consumidor existente se rompe (la firma pública solo crece).

6. **Enganche confirmación → carrito en `app/dashboard/pedidos/nuevo/page.tsx`.**
   Leer `?solicitud=<id>` con `useSearchParams`; si viene, llamar `confirmPurchaseRequest(id)` una sola vez (guardado con un `useRef` para evitar doble ejecución en StrictMode), fusionar las líneas devueltas con `mergeLines`, mostrar un aviso "Solicitud `<folio>` agregada al carrito" y limpiar el query param con `router.replace("/dashboard/pedidos/nuevo")`. Si la action falla (ya no está pendiente), mostrar el mensaje de error sin fusionar nada.

   *Verificación:* confirmar una solicitud desde `/dashboard/solicitudes/<id>` aterriza en `/dashboard/pedidos/nuevo` con los productos ya marcados, con cantidades sumadas si alguno ya estaba en el carrito.

7. **Gating del rol 2 en `navConfig.tsx` + `Sidebar.tsx`.**
   - Agregar `excludeRoles?: number[]` a `NavChild`.
   - Insertar el hijo "Solicitudes" (`/dashboard/solicitudes`, icono `ClipboardPlus`) en el grupo Inventario y poner `excludeRoles: [2]` en los otros 6 hijos.
   - En `Sidebar.tsx`, filtrar `link.children` por rol antes de renderizar, tanto en el submenú expandido como en el flyout colapsado.

   *Verificación:* con rol 2 el grupo Inventario muestra únicamente "Solicitudes"; con roles 1/3/4/6 se ven los 7 hijos.

8. **Gating server-side en `proxy.ts`.**
   Después de la regla del rol 6, agregar: si `id_role === 2` y `pathname` empieza con alguno de los 6 prefijos de Inventario distintos de `/dashboard/solicitudes`, redirigir a `/dashboard/solicitudes`.

   *Verificación:* con rol 2, teclear `/dashboard/productos`, `/dashboard/pedidos`, `/dashboard/conteos`, etc. redirige a `/dashboard/solicitudes`; `/dashboard/pacientes`, `/dashboard/citas` y `/dashboard/tratamientos` siguen cargando normal.

9. **Badge de pendientes: `componentes/PendingRequestsBadge.tsx`.**
   Componente cliente que recibe el `id_sucursal` del `SucursalContext`, consulta `getPendingRequestsCount` y pinta el contador junto a "Solicitudes" en el sidebar; solo se renderiza si `id_role ∈ {1,4,6}` y el conteo es > 0.

   *Verificación:* con una solicitud pendiente en la sucursal, un usuario rol 1/4/6 ve el contador; el rol 2 no.

10. **Verificación manual end-to-end y `npm run build`.**
    Rol 2 crea solicitud → aparece en el listado con badge para compras → rol 6 confirma → líneas en el carrito de esa sucursal → completa proveedor/precio en `/revision` → genera la orden de compra. En paralelo, otra solicitud se rechaza con motivo y desaparece del listado.

Cada paso deja el sistema funcional y compilando.

## Criterios de aceptación

- [ ] Un usuario con `id_role = 2` ve en el grupo "Inventario" del sidebar **únicamente** el hijo "Solicitudes"; los otros 6 (Inventario Actual, Productos, Proveedores, Pedidos, Recepciones, Movimientos, Conteos) no aparecen.
- [ ] Un usuario con `id_role = 2` que visita `/dashboard/productos`, `/dashboard/proveedores`, `/dashboard/pedidos`, `/dashboard/recepciones`, `/dashboard/movimientos`, `/dashboard/conteos` o `/dashboard/inventario` es redirigido server-side a `/dashboard/solicitudes`.
- [ ] Un usuario con `id_role = 2` conserva su acceso actual a Dashboard, Pacientes, Citas, Servicios, Sucursales, Ventas y Tratamientos, sin cambios.
- [ ] En `/dashboard/solicitudes/nueva`, el rol 2 puede buscar entre **todos los productos activos** de la empresa, filtrarlos por categoría, ver el **stock actual** de su sucursal y capturar una cantidad por producto.
- [ ] La pantalla de armado **no muestra en ningún punto** precio, proveedor, IVA, método de pago ni totales, y el payload de `getProductsForRequest` no incluye `price` ni `id_supplier`.
- [ ] Enviar la solicitud crea un registro en `inventory.purchase_requests` con estado `1` (Pendiente), folio consecutivo `SOL-<año>-NNNN` por empresa, y una fila por producto en `inventory.purchase_request_items` con `quantity` y snapshot del producto.
- [ ] Un rol 2 puede **editar cantidades y notas** de una solicitud propia mientras esté `Pendiente`, y **cancelarla**; una vez confirmada, rechazada o cancelada, ya no puede editarla.
- [ ] El listado de `/dashboard/solicitudes` muestra **solo solicitudes pendientes** de la sucursal seleccionada, e incluye las creadas por **cualquier usuario** de esa sucursal, no solo las propias.
- [ ] Cambiar de sucursal en el selector global cambia el listado a las solicitudes pendientes de la nueva sucursal.
- [ ] Un usuario con `id_role` 1, 4 o 6 ve en el detalle los botones "Confirmar y pasar al carrito" y "Rechazar"; un `id_role = 2` no los ve, y la server action los rechaza aunque se invoquen directamente.
- [ ] Rechazar exige un **motivo no vacío**: sin texto, el modal no permite enviar y la action falla con `{ ok: false }`; al rechazar se guardan `rejection_reason`, `id_user_reviewed` y `reviewed_at`.
- [ ] Confirmar una solicitud pasa su estado a `2` (Confirmada), la saca del listado de pendientes, y aterriza al usuario en `/dashboard/pedidos/nuevo` con los productos de la solicitud **ya marcados en el carrito de esa sucursal**, con proveedor y precio por defecto del producto, editables.
- [ ] Si un producto de la solicitud **ya estaba** en el carrito, `mergeLines` **suma** su cantidad en vez de duplicar la línea o reemplazarla.
- [ ] Fusionar líneas **no altera** la fecha estimada, las notas, el método de pago ni el envío que ya tuviera el carrito.
- [ ] Confirmar una solicitud **no vacía ni reemplaza** el carrito preexistente de esa sucursal, ni afecta el carrito de otras sucursales.
- [ ] Confirmar dos veces la misma solicitud (recargando `/dashboard/pedidos/nuevo?solicitud=<id>`) falla con mensaje de error y **no vuelve a fusionar** las líneas.
- [ ] Un usuario con `id_role` 1, 4 o 6 ve junto a "Solicitudes" en el sidebar un contador con el número de solicitudes pendientes de la sucursal seleccionada; el contador no se renderiza cuando es 0 ni para el rol 2.
- [ ] Los roles 1, 3, 4, 5 y 6 no cambian su comportamiento actual en `navConfig.tsx` ni en `proxy.ts` (sin regresiones), y el flujo existente de pedidos → revisión → orden de compra funciona igual que antes cuando no interviene ninguna solicitud.
- [ ] Todas las server actions nuevas validan su entrada con `zod` antes de tocar `queryParams` y devuelven `ActionResult`.
- [ ] `created_at` y `reviewed_at` se escriben con `buildDate(new Date())` y se leen con `CONVERT(varchar(19), [col], 120)`; ninguna fecha viaja como objeto `Date`.
- [ ] `npm run build` compila sin errores de TypeScript ni warnings nuevos.

## Decisiones tomadas y descartadas

- **Tablas nuevas (`purchase_requests` / `purchase_request_items`) en vez de reusar `purchase_orders` con un estado extra.** La pre-solicitud no tiene proveedor, precios, impuestos, método de pago ni totales; meterla en `purchase_orders` obligaba a volver nullable media tabla y a filtrar el estado "pre-solicitud" en todas las consultas de compras, recepciones y reportes ya existentes. Se descartó por contaminar un flujo estable.
- **Nueva sub-sección `/dashboard/solicitudes` en vez de un "modo sin precios" dentro de `/dashboard/pedidos/nuevo`.** Evita condicionales por rol dentro de una pantalla que ya es compleja, permite gatear por ruta en `proxy.ts` sin lógica extra, y deja el ciclo de vida de la solicitud (editar/cancelar/rechazar) con su propio espacio.
- **Estados como constantes en código (`PURCHASE_REQUEST_STATUS`), sin tabla catálogo.** Son cuatro estados fijos del flujo, no configurables por empresa; una tercera tabla y su JOIN no aportan nada frente a un objeto `as const` tipado. Se descartó imitar `order_status` (que sí es catálogo en BD) por ese motivo.
- **Confirmar fusiona (`mergeLines`) en vez de reemplazar el carrito.** Compras puede estar armando un pedido a partir de varias solicitudes o de productos sugeridos; reemplazar destruiría trabajo previo. Si el producto ya está, se suma la cantidad, que es la lectura natural de "dos personas pidieron lo mismo".
- **Compras confirma tal cual y ajusta después en el carrito, sin editar cantidades en la pantalla de confirmación.** El carrito ya es totalmente editable (cantidad, precio, proveedor, IVA); duplicar esa edición en el detalle de la solicitud sería UI redundante.
- **La solicitud pasa a `Confirmada` al entrar al carrito, no al generarse la orden de compra.** Evita tener que enlazar solicitud ↔ `purchase_order` (relación N:M real, porque el carrito mezcla varias solicitudes y se parte en una orden por proveedor). El costo asumido es que no se puede rastrear qué orden nació de qué solicitud — ver riesgos.
- **`confirmPurchaseRequest` cambia el estado en BD y devuelve las líneas en la misma llamada, y el merge ocurre después, en el cliente.** Hace la transición atómica e idempotente (`UPDATE ... WHERE id_status_request = 1`, falla si afectó 0 filas), de modo que recargar la URL no puede fusionar dos veces.
- **El botón "Confirmar" navega a `/dashboard/pedidos/nuevo?solicitud=<id>` en vez de mover el `PurchaseCartProvider` a `app/dashboard/layout.tsx`.** Mantiene el client boundary del carrito acotado al flujo de armado de pedido, como decidió la spec que lo introdujo, en vez de montarlo en todo el dashboard solo para poder confirmar desde otra pantalla.
- **`getProductsForRequest` es una action propia y no reusa `getSuggestedProducts`.** Aunque reusar habría sido menos código, `getSuggestedProducts` devuelve `price` e `id_supplier` en el payload, y la premisa del usuario es que el podólogo trabaje "solo cantidades sin precios" — no basta con no renderizarlos. Además evita el costo extra de calcular sugeridos y folios de órdenes en curso, que aquí no se usan.
- **Se muestra el stock actual de la sucursal, pero no el stock mínimo/máximo ni la cantidad sugerida.** El stock actual le da al podólogo contexto para no pedir de más; mínimos, máximos y sugeridos son criterio de compras y ya viven en `/dashboard/pedidos/nuevo`.
- **El listado muestra solo pendientes, y de toda la sucursal, no solo las propias.** Decisión del usuario: la solicitud es un pendiente operativo de la sucursal, no un expediente personal; una vez resuelta deja de ser accionable y sale de la vista. No se construye pantalla de historial.
- **Motivo de rechazo obligatorio.** Rechazar sin explicación deja al podólogo sin saber si debe corregir la cantidad, esperar, o pedir otra cosa; el costo de un campo de texto obligatorio es mínimo frente a esa ambigüedad.
- **Sin límite de solicitudes pendientes simultáneas.** Forzar "una sola abierta" bloquearía al podólogo cada vez que compras tarde en revisar, sin ganar nada a cambio.
- **Bloqueo del rol 2 solo dentro de Inventario, no global como el rol 6.** El rol 2 es quien hace las consultas: necesita Pacientes, Citas, Tratamientos y Ventas. Se descartó explícitamente replicar el encierro total del rol 6.
- **Bloqueo server-side en `proxy.ts` además de ocultar del sidebar, y validación de rol dentro de las actions de confirmar/rechazar.** Mismo criterio que la spec 46: ocultar el menú no impide teclear la URL, y ocultar un botón no impide invocar la server action.
- **`NavChild` gana `excludeRoles` en vez de duplicar el grupo "Inventario" con dos configuraciones distintas.** Un segundo `NavLink` "Inventario" solo-para-rol-2 habría duplicado etiqueta e icono y roto la lógica de grupo activo del `Sidebar`.
- **Badge de pendientes solo en el sidebar, sin notificaciones externas.** Correo o WhatsApp implican integración, plantillas y manejo de fallos; el badge cubre el caso real (compras entra al sistema a diario) con una consulta `COUNT(*)`.

## Riesgos identificados

- **Ventana entre confirmar y fusionar.** `confirmPurchaseRequest` marca la solicitud como `Confirmada` en el servidor y el merge ocurre después en el cliente. Si el navegador se cierra o falla justo entre ambos, la solicitud queda confirmada pero sus productos nunca entraron al carrito, y —al no haber pantalla de historial— desaparece del listado sin rastro accionable. *Mitigación:* el aviso de éxito solo se muestra tras el merge; si hace falta recuperarla, hoy solo se puede consultando la base de datos. Si esto resulta molesto en uso real, el remedio natural es la pantalla de historial que esta spec deja fuera.

- **No hay trazabilidad solicitud → orden de compra.** Al no guardar el enlace, no se puede responder "¿qué pasó con lo que pedí?" más allá de "fue confirmada". Es una consecuencia aceptada de la decisión de confirmar al entrar al carrito; si más adelante se necesita, requiere una tabla puente `purchase_request_orders` y una spec propia.

- **Snapshot de producto vs. producto actual.** Las líneas guardan `product_name`/`product_code`/`brand` al momento de solicitar, pero al confirmar se toman `id_supplier`, `price`, `pieces` y `split` del producto **actual**. Si el producto se desactiva o se le quita el proveedor entre la solicitud y la confirmación, la línea puede llegar al carrito sin proveedor. *Mitigación:* el guard ya existente en `/revision` (`hasLineWithoutSupplier`) impide generar la orden hasta asignarlo manualmente.

- **Contención en el folio.** El consecutivo de `SOL-` usa `COUNT(*) WITH (UPDLOCK, HOLDLOCK)` sobre año+empresa, igual que `PO-`. Con varios podólogos enviando solicitudes en el mismo instante hay serialización breve, y el patrón hereda el mismo riesgo residual de colisión ya conocido en las órdenes de compra. Se acepta por consistencia con lo existente; el volumen esperado (unas pocas solicitudes al día por sucursal) lo hace irrelevante.

- **El badge consulta desde el `Sidebar`, que está montado en todo el dashboard.** Un `COUNT(*)` por carga de dashboard y por cambio de sucursal, para roles 1/4/6. Es barato con el índice `IX_purchase_requests_pending`, pero es fetching desde un componente cliente —justificado porque depende de `SucursalContext`— y conviene no expandirlo a más datos sin repensar el enfoque.

- **El rol 2 pierde acceso a Inventario que hoy sí tiene.** Actualmente el `id_role = 2` ve el módulo completo y puede generar órdenes de compra reales. Esta spec se lo quita. Si algún podólogo estaba usando Productos o Pedidos como parte de su operación diaria, notará la pérdida el día del despliegue. *Mitigación:* es el cambio pedido explícitamente; conviene avisar a los usuarios de rol 2 antes de publicar.
