# 23 — Conteo físico de inventario con autorización del supervisor

## Header

- **Estado:** Aprobado
- **Depende de:** [[09-pedidos-compra-recepcion]] (`inventory.kardex`, `inventory.stock`, `applyStockMovement`), [[08-productos-inventario-crud]] (`inventory.Products`, `IProduct`, `inventory.product_categories`), [[14-movimientos-almacen]] (catálogo `inventory.movements`, patrón de pantalla y de server actions de inventario)
- **Fecha:** 2026-08-18
- **Objetivo:** Agregar a Inventario el proceso de conteo físico en dos etapas, donde quien cuenta captura cantidades sin ver el stock del sistema y un supervisor (rol 1 o 4) decide línea por línea si aumentar, disminuir o dejar el stock, aplicando los ajustes al cerrar el conteo.

> Nota de traducción: `references/conteo-inventario.md` llama "podólogo" a quien cuenta, pero el rol 5 no tiene acceso a Inventario. En todo este spec ese actor se nombra **"quien captura el conteo"** (roles 1, 2, 3, 4): la podóloga cuenta físicamente en el anaquel, otro usuario captura en el sistema.

## Alcance

**Incluye:**

- **Nueva ruta `/dashboard/conteos`** dentro del grupo **Inventario** del sidebar (`navConfig.tsx`, después de "Movimientos", `excludeRoles: [5]`), con cuatro pantallas:
  - `/dashboard/conteos` — listado de conteos de la sucursal seleccionada (`SucursalContext`), con folio, tipo, categoría, usuario que lo capturó, fecha/hora, estado y acción según estado y rol.
  - `/dashboard/conteos/nuevo` — elegir tipo (general o por categoría) y generar el conteo.
  - `/dashboard/conteos/[id]` — captura del primer y segundo conteo. **Nunca muestra stock del sistema ni diferencias.**
  - `/dashboard/conteos/[id]/revision` — revisión del supervisor. Única pantalla que muestra stock del sistema, diferencias y decisiones.
- **Dos tablas nuevas:** `inventory.stock_counts` (encabezado) e `inventory.stock_count_items` (una fila por producto contado).
- **Generación del conteo:** al crearlo se congela un **snapshot** (`system_quantity`) del stock de cada producto en esa sucursal. Los productos incluidos son los que tienen fila en `inventory.stock` para la sucursal (activos de la empresa); si es por categoría, solo los de **una** categoría (`Products.id_category`).
- **Primer conteo:** tabla de captura producto / cantidad contada, sin ninguna columna de stock del sistema. Se puede **guardar a medias y retomar después** (`en_captura`). Al finalizar el primer conteo, el sistema calcula internamente las diferencias contra el snapshot.
- **Segundo conteo:** si hubo diferencias, el conteo pasa a `segundo_conteo` y se pide recontar **solo** los productos con diferencia, mostrando únicamente el nombre del producto (no la primera cantidad capturada, ni el stock del sistema). El segundo conteo es **definitivo**, aunque siga difiriendo.
- **Sin diferencias en el primer conteo:** se salta el segundo conteo y el conteo pasa directo a `pendiente_revision`, visible para el supervisor como "sin diferencias" (queda el registro de auditoría).
- **Cero botón "actualizar stock" para quien captura.** Al finalizar, el conteo queda en `pendiente_revision` y aparece en la bandeja del supervisor.
- **Revisión del supervisor (roles 1 y 4, gate en `proxy.ts`):** lista solo las líneas con diferencia, mostrando conteo final, stock del snapshot, stock **actual** y diferencia. Tres decisiones por línea — `aumentar`, `disminuir`, `dejar_igual` — más una **nota opcional por línea**. Las decisiones se guardan parcialmente y se puede volver después.
- **Cierre del conteo:** el botón "Cerrar inventario" exige que **todas** las líneas con diferencia tengan decisión y aplica, en **una sola transacción**, un movimiento de kardex por cada línea con decisión `aumentar` o `disminuir`; las de `dejar_igual` no generan movimiento pero conservan su diferencia registrada. Estado final `cerrado`, **inmutable**.
- **Ajuste calculado contra el stock vivo:** la cantidad del movimiento es `|conteo_final − stock_actual_al_cerrar|`, no la diferencia contra el snapshot, para no pisar ventas, consultas o recepciones ocurridas entre el conteo y la autorización. Si al cerrar el stock actual ya coincide con el conteo, no se genera movimiento para esa línea.
- **Dos tipos de movimiento nuevos en `inventory.movements`:** `11` "Entrada por conteo físico" (`increases_storage = 1`) y `12` "Salida por conteo físico" (`increases_storage = 0`), con su badge propio en `/dashboard/movimientos`. (`id_movement = 10` ya existe en la BD como "Descuento por consumo" — no está libre.)
- **Trazabilidad en el kardex:** nueva columna `inventory.kardex.id_stock_count` (`int NULL`) para saber qué conteo originó cada ajuste; `notes` guarda la nota del supervisor.
- **Un solo conteo abierto por sucursal a la vez** (estado distinto de `cerrado`/`cancelado`).
- **Cancelación:** tanto quien capturó como el supervisor pueden cancelar un conteo no cerrado (`status = cancelado`, sin borrado físico).
- **Folio derivado del id:** `INV-` + `id_stock_count` a 5 dígitos (`INV-00025`), sin columna extra, igual que `MOV-{id_kardex}`.
- **Quien captura nunca ve stock del sistema ni diferencias**, ni durante ni después de la revisión; en el listado solo ve folio, tipo, fecha y estado.
- Anexar los `CREATE TABLE`, `INSERT` de catálogo y `ALTER TABLE` a `queries.txt`, siguiendo la convención del repo.

**No incluye (para specs futuras):**

- **Acceso del rol 5 (podóloga) a la pantalla de conteo.** La podóloga cuenta físicamente; el usuario de sucursal/administración captura. No se toca la restricción existente en `proxy.ts`.
- **Tercer conteo ni regla de "recontar hasta que dos conteos coincidan".** El segundo conteo cierra la participación de quien captura.
- **Reabrir un conteo cerrado, editar decisiones o revertir sus ajustes.** El error se corrige registrando un movimiento manual en `/dashboard/movimientos` (spec 14).
- **Impedir que un usuario rol 1 o 4 revise el conteo que él mismo capturó.** Se permite explícitamente.
- **Conteo por varias categorías a la vez, por proveedor, por marca o por rango de anaqueles.** Solo general o una categoría.
- **Conteo de productos sin fila en `inventory.stock`** de esa sucursal (nunca movidos ahí).
- **Conteo por lotes, caducidades o número de serie.** No existe ese modelo en el sistema.
- **Captura en paquetes/cajas.** La cantidad se captura siempre en unidades de stock, igual que en Movimientos.
- **Costo unitario en los ajustes por conteo** — `kardex.unit_cost` queda `NULL`.
- **Exportación a CSV/Excel, impresión de hoja de conteo en papel, ni captura offline/móvil.**
- **Notificaciones al supervisor** (correo, badge, push) cuando queda un conteo pendiente de revisión.
- **Reporte de exactitud de inventario** (% de aciertos por usuario o por sucursal) a partir del histórico de conteos.
- **Bloquear ventas, consultas o recepciones mientras hay un conteo abierto.** El stock sigue moviéndose normalmente; por eso el ajuste se calcula contra el stock vivo.

## Modelo de datos

**Nueva tabla — `[CentroPodologico].[inventory].[stock_counts]`** (encabezado del conteo):

```sql
CREATE TABLE [inventory].[stock_counts](
    [id_stock_count]   [int] IDENTITY(1,1) NOT NULL,
    [id_sucursal]      [int] NOT NULL,
    [id_empresa]       [int] NOT NULL,
    [count_type]       [varchar](20) NOT NULL,  -- 'general' | 'category'
    [id_category]      [int] NULL,              -- obligatorio si count_type = 'category'
    [status]           [varchar](20) NOT NULL,  -- ver estados abajo
    [id_user_counter]  [int] NOT NULL,          -- quien generó y capturó el conteo
    [id_user_reviewer] [int] NULL,              -- supervisor que cerró
    [created_at]       [datetime2](7) NOT NULL,
    [counted_at]       [datetime2](7) NULL,     -- momento en que pasó a pendiente_revision
    [closed_at]        [datetime2](7) NULL,     -- momento del cierre o cancelación
    CONSTRAINT [PK_stock_counts] PRIMARY KEY CLUSTERED ([id_stock_count] ASC)
);
GO
CREATE INDEX [IX_stock_counts_sucursal_status]
    ON [inventory].[stock_counts] ([id_sucursal] ASC, [status] ASC, [id_stock_count] DESC);
GO
```

**Estados válidos de `stock_counts.status`:**

| Estado | Significado | Quién lo provoca |
|---|---|---|
| `en_captura` | Primer conteo abierto, se puede retomar. | Al generar el conteo. |
| `segundo_conteo` | Hubo diferencias; falta recontar solo esos productos. | Al finalizar el primer conteo con ≥1 diferencia. |
| `pendiente_revision` | Terminó la participación de quien captura. | Al finalizar el segundo conteo, o el primero si no hubo diferencias. |
| `cerrado` | El supervisor decidió todo y se aplicaron los ajustes. Inmutable. | "Cerrar inventario". |
| `cancelado` | Conteo abandonado. No aplica ajustes. | Quien capturó o el supervisor. |

**Nueva tabla — `[CentroPodologico].[inventory].[stock_count_items]`** (una fila por producto incluido, con o sin diferencia):

```sql
CREATE TABLE [inventory].[stock_count_items](
    [id_stock_count_item] [int] IDENTITY(1,1) NOT NULL,
    [id_stock_count]      [int] NOT NULL,
    [id_product]          [int] NOT NULL,
    [system_quantity]     [decimal](18, 4) NOT NULL,  -- snapshot al generar el conteo
    [first_count]         [decimal](18, 4) NULL,      -- NULL mientras no se captura
    [second_count]        [decimal](18, 4) NULL,      -- solo en líneas con diferencia
    [needs_second_count]  [bit] NOT NULL DEFAULT 0,
    [decision]            [varchar](20) NULL,         -- 'aumentar' | 'disminuir' | 'dejar_igual'
    [reviewer_notes]      [nvarchar](500) NULL,
    [id_kardex]           [int] NULL,                 -- movimiento generado al cerrar, si lo hubo
    CONSTRAINT [PK_stock_count_items] PRIMARY KEY CLUSTERED ([id_stock_count_item] ASC),
    CONSTRAINT [FK_stock_count_items_counts]
        FOREIGN KEY ([id_stock_count]) REFERENCES [inventory].[stock_counts]([id_stock_count])
);
GO
CREATE UNIQUE INDEX [UQ_stock_count_items_count_product]
    ON [inventory].[stock_count_items] ([id_stock_count] ASC, [id_product] ASC);
GO
```

- **Conteo final de una línea** = `second_count ?? first_count`. No se guarda una tercera columna redundante.
- `needs_second_count = 1` se calcula al finalizar el primer conteo (`first_count <> system_quantity`).
- Las líneas sin diferencia se guardan igual, con `decision` en `NULL` — no hay nada que decidir en ellas.

**Dos tipos de movimiento nuevos en `[inventory].[movements]`:**

```sql
INSERT [inventory].[movements]
    ([id_movement],[name],[short_name],[status],[activo],[increases_storage],[id_empresa],[description])
VALUES
    (11, N'Entrada por conteo físico', N'EXCF', 1, 1, 1, 1, N'Ajuste positivo autorizado por el supervisor tras un conteo físico'),
    (12, N'Salida por conteo físico',  N'SXCF', 1, 1, 0, 1, N'Ajuste negativo autorizado por el supervisor tras un conteo físico');
GO
```

**Columna nueva en `[inventory].[kardex]`:**

```sql
ALTER TABLE [inventory].[kardex] ADD [id_stock_count] [int] NULL;
GO
```

**`interfaces/kardex.ts`** — se agrega `id_stock_count: number | null` a `IKardexEntry`.

**`lib/inventory/stock.ts`** — `IApplyStockMovementInput` gana `id_stock_count?: number | null` (default `null`), y el `INSERT` de kardex lo incluye. Ningún llamador existente cambia.

**Nueva interfaz `interfaces/stock_count.ts`:**

```ts
export type StockCountStatus =
  | "en_captura" | "segundo_conteo" | "pendiente_revision" | "cerrado" | "cancelado";

export type StockCountType = "general" | "category";

export type StockCountDecision = "aumentar" | "disminuir" | "dejar_igual";

export interface IStockCount {
  id_stock_count:   number;
  id_sucursal:      number;
  id_empresa:       number;
  count_type:       StockCountType;
  id_category:      number | null;
  status:           StockCountStatus;
  id_user_counter:  number;
  id_user_reviewer: number | null;
  created_at:       string;          // "YYYY-MM-DD HH:mm:ss"
  counted_at:       string | null;
  closed_at:        string | null;
}

export interface IStockCountItem {
  id_stock_count_item: number;
  id_stock_count:      number;
  id_product:          number;
  system_quantity:     number;
  first_count:         number | null;
  second_count:        number | null;
  needs_second_count:  boolean;
  decision:            StockCountDecision | null;
  reviewer_notes:      string | null;
  id_kardex:           number | null;
}
```

**Interfaces de vista (en `app/dashboard/conteos/actions.ts`, patrón de `IStockMovementListItem`):**

```ts
/** Fila del listado de conteos. */
export interface IStockCountListItem {
  id_stock_count: number;
  folio:          string;          // "INV-00025", derivado del id
  count_type:     StockCountType;
  category_name:  string | null;
  status:         StockCountStatus;
  counter_name:   string;
  reviewer_name:  string | null;
  created_at:     string;
  items_total:    number;
  items_with_difference: number | null; // null para quien no es supervisor
}

/** Línea que ve QUIEN CAPTURA. Sin stock del sistema, sin diferencia. */
export interface ICountEntryLine {
  id_stock_count_item: number;
  id_product:          number;
  product_name:        string;
  product_code:        string;
  unit_code:           string | null;
  counted_quantity:    number | null;  // first_count o second_count según la etapa
}

/** Línea que ve EL SUPERVISOR. Solo se genera para líneas con diferencia. */
export interface ICountReviewLine {
  id_stock_count_item: number;
  id_product:          number;
  product_name:        string;
  product_code:        string;
  unit_code:           string | null;
  counted_quantity:    number;   // second_count ?? first_count
  system_quantity:     number;   // snapshot al generar
  current_stock:       number;   // stock vivo al momento de abrir la revisión
  difference:          number;   // counted_quantity - system_quantity
  decision:            StockCountDecision | null;
  reviewer_notes:      string | null;
}
```

`ICountEntryLine` es la garantía estructural de la regla central del proceso: la pantalla de captura no puede filtrar el stock del sistema porque el server action **nunca lo envía al cliente**.

## Plan de implementación

1. **BD.** Ejecutar contra `[CentroPodologico]` los `CREATE TABLE` de `inventory.stock_counts` e `inventory.stock_count_items`, el `INSERT` de los movimientos `11` y `12`, y el `ALTER TABLE inventory.kardex ADD id_stock_count`. Anexar todo a `queries.txt` bajo `-- spec 23 — conteo físico de inventario`. *Verificación:* `SELECT * FROM inventory.stock_counts` responde vacío sin error y `SELECT * FROM inventory.movements WHERE id_movement IN (11,12)` devuelve dos filas.

2. **Interfaces.** Crear `interfaces/stock_count.ts` con `IStockCount`, `IStockCountItem` y los tres tipos union. Agregar `id_stock_count: number | null` a `IKardexEntry` en `interfaces/kardex.ts`. Sistema funcional (nada lo usa aún).

3. **`lib/inventory/stock.ts`.** Agregar `id_stock_count?: number | null` a `IApplyStockMovementInput` (default `null`) e incluirlo en el `INSERT` de kardex. Ningún llamador existente cambia. *Verificación:* `npm run build` compila y una recepción sigue registrando stock igual que antes.

4. **`app/dashboard/conteos/actions.ts`** (`"use server"`), parte de lectura/creación, todo devolviendo `ActionResult<T>`:
   - `getStockCounts(id_sucursal)`: listado de conteos de la sucursal, `ORDER BY id_stock_count DESC`, con `JOIN dbo.users` para `counter_name`/`reviewer_name` y `LEFT JOIN inventory.product_categories` para `category_name`. Fechas con `CONVERT(varchar(19), …, 120)`. `items_with_difference` solo se calcula si el usuario del JWT es rol 1 o 4.
   - `getCountableCategories(id_sucursal)`: categorías que tienen al menos un producto con fila en `inventory.stock` de esa sucursal.
   - `createStockCount(count_type, id_category)`: valida que **no exista** otro conteo de la sucursal en estado distinto de `cerrado`/`cancelado`; toma `id_sucursal`, `id_empresa` e `id_user` del JWT. En una transacción, inserta el encabezado (`status = "en_captura"`, `created_at = buildDate(new Date())`) y, con un solo `INSERT … SELECT`, una línea por producto activo con fila en `inventory.stock` de esa sucursal (filtrando por `id_category` si aplica), copiando `stock.quantity` a `system_quantity`.

5. **`app/dashboard/conteos/actions.ts`**, parte de captura:
   - `getCountEntryLines(id_stock_count)`: devuelve `ICountEntryLine[]`. Si el estado es `en_captura`, todas las líneas con `counted_quantity = first_count`; si es `segundo_conteo`, **solo** las de `needs_second_count = 1` con `counted_quantity = second_count`. Nunca selecciona `system_quantity`. Valida que el conteo pertenezca a la sucursal/empresa del JWT.
   - `saveCountProgress(id_stock_count, lines)`: guarda parcialmente las cantidades capturadas en `first_count` o `second_count` según el estado, sin cambiar el estado. Rechaza si el estado no es `en_captura` ni `segundo_conteo`.
   - `finishFirstCount(id_stock_count)`: exige que todas las líneas tengan `first_count` no nulo; marca `needs_second_count = 1` donde `first_count <> system_quantity`. Si hay al menos una, pasa a `segundo_conteo`; si no hay ninguna, pasa a `pendiente_revision` con `counted_at = buildDate(new Date())`.
   - `finishSecondCount(id_stock_count)`: exige `second_count` no nulo en todas las líneas con `needs_second_count = 1`; pasa a `pendiente_revision` con `counted_at`.
   - `cancelStockCount(id_stock_count)`: pone `status = "cancelado"` y `closed_at`; permitido a quien capturó y a roles 1/4, solo si el estado no es `cerrado`.

6. **`app/dashboard/conteos/actions.ts`**, parte de revisión (solo roles 1 y 4, validado dentro del action además del gate de `proxy.ts`):
   - `getCountReview(id_stock_count)`: encabezado + `ICountReviewLine[]` de las líneas con diferencia (`needs_second_count = 1`), con `current_stock` leído en vivo de `inventory.stock`.
   - `saveReviewDecisions(id_stock_count, decisions)`: guarda parcialmente `decision` y `reviewer_notes` por línea. Rechaza si el estado no es `pendiente_revision`.
   - `closeStockCount(id_stock_count)`: exige que **todas** las líneas con `needs_second_count = 1` tengan `decision`. En **una sola** `db.transaction`, por cada línea con `aumentar`/`disminuir`: relee el stock actual, calcula `delta = conteo_final − stock_actual`; si `delta === 0` no genera movimiento; si no, llama `applyStockMovement` con `id_movement = 11` si `delta > 0` u `12` si `delta < 0`, `quantity = Math.abs(delta)`, `id_stock_count`, `notes = reviewer_notes`, `unit_cost: null`, y guarda el `id_kardex` resultante en la línea. Las líneas `dejar_igual` no generan movimiento. Al final, `status = "cerrado"`, `id_user_reviewer`, `closed_at`, y `revalidatePath` de `/dashboard/conteos` y `/dashboard/movimientos`.

7. **`proxy.ts`.** Agregar el gate: `/dashboard/conteos/*/revision` solo para `id_role` 1 y 4; cualquier otro rol se redirige a `/dashboard/conteos`. El resto de `/dashboard/conteos` sigue la regla general del grupo Inventario (rol 5 ya excluido).

8. **`/dashboard/conteos/page.tsx` + `componentes/StockCountsTable.tsx`.** Server Component de página con la cabecera y botón "Nuevo conteo"; el listado es cliente porque depende de `SucursalContext`. Columnas: folio, tipo (general / categoría + nombre), capturado por, fecha, estado (badge) y acción contextual ("Continuar captura", "Segundo conteo", "Revisar" —solo roles 1/4—, "Ver"). `key` = `id_stock_count`.

9. **`/dashboard/conteos/nuevo/page.tsx` + `componentes/NewCountForm.tsx`.** Selector general / por categoría, con el select de categoría visible solo en el segundo caso. Muestra cuántos productos incluirá el conteo antes de generar. Si ya hay un conteo abierto en la sucursal, muestra el aviso y un enlace a ese conteo, en vez del formulario.

10. **`/dashboard/conteos/[id]/page.tsx` + `componentes/CountEntryTable.tsx`.** Tabla de captura con una fila por producto (nombre, código, unidad, input numérico). Encabezado con folio, tipo y — cuando el estado es `segundo_conteo` — el mensaje "Se detectaron diferencias en N productos. Realice un segundo conteo." Botones "Guardar avance" y "Finalizar conteo" (con confirmación). En estados `pendiente_revision`/`cerrado`/`cancelado` la pantalla es de solo lectura y **no** muestra cantidades del sistema.

11. **`/dashboard/conteos/[id]/revision/page.tsx` + `componentes/CountReviewTable.tsx` + `componentes/CountDecisionRow.tsx`.** Cabecera con los datos del documento de referencia (folio, sucursal, capturado por, fecha, hora, tipo, categoría, estado). Una fila por diferencia: producto, conteo físico, stock sistema, stock actual, diferencia con signo y color, tres botones de decisión mutuamente excluyentes y un campo de nota opcional. Botones "Guardar decisiones" y "Cerrar inventario" (deshabilitado hasta que todas las líneas tengan decisión, con confirmación que resume cuántas suben, bajan y quedan igual). Si el conteo no tiene diferencias, se muestra el estado "Sin diferencias" y "Cerrar inventario" queda disponible directo.

12. **`componentes/StockCountStatusBadge.tsx`.** Badge por estado, reutilizando el patrón de `OrderStatusBadge`/`MovementTypeBadge`.

13. **Sidebar.** Agregar `{ href: "/dashboard/conteos", label: "Conteos", icon: ClipboardCheck }` a los `children` de "Inventario" en `navConfig.tsx`, después de "Movimientos".

14. **`/dashboard/movimientos`.** Agregar los tipos `11` y `12` a `MovementTypeBadge.tsx` con su color propio; aparecen automáticamente en el filtro por tipo (que lee el catálogo) y **no** deben ser seleccionables en `RegisterMovementModal` (la lista de tipos manuales sigue siendo `2, 4, 7, 8, 9`).

15. **Diseño.** Aplicar la skill `frontend-design` y los tokens de `references/DESIGN.md`, con modo claro y oscuro, consistente con Movimientos y Recepciones.

16. **Verificación manual completa:**
    - Generar un conteo general: se crean tantas líneas como productos con stock en la sucursal, y la pantalla de captura no muestra ninguna cantidad del sistema (confirmar también en la respuesta de red del server action).
    - Capturar la mitad, "Guardar avance", recargar: las cantidades persisten y el conteo sigue en `en_captura`.
    - Finalizar con diferencias en 2 productos: pasa a `segundo_conteo` y pide recontar exactamente esos 2, sin mostrar la cantidad capturada antes.
    - Finalizar el segundo conteo: pasa a `pendiente_revision` y aparece en la bandeja del supervisor.
    - Intentar entrar a `/dashboard/conteos/[id]/revision` con un rol 2 o 3: redirige.
    - Como rol 1: decidir una línea `disminuir` y guardar sin cerrar; recargar y confirmar que la decisión persiste y el stock **no** cambió.
    - Vender o consumir ese mismo producto entre la revisión y el cierre, y confirmar que al cerrar el ajuste se calcula contra el stock vivo (el resultado final queda en el conteo físico, no en `snapshot ± diferencia`).
    - Cerrar el inventario: se generan movimientos `11`/`12` en el kardex visibles en `/dashboard/movimientos` con la nota del supervisor, el stock queda en el valor contado, la línea `dejar_igual` no generó movimiento pero conserva su diferencia, y el conteo queda `cerrado` y de solo lectura.
    - Generar un conteo por categoría con todo cuadrado: salta el segundo conteo, llega a revisión como "sin diferencias" y se puede cerrar sin generar ningún movimiento.
    - Intentar generar un segundo conteo con uno abierto en la misma sucursal: se bloquea con aviso.
    - Cancelar un conteo desde ambos roles y confirmar que no toca stock.
    - Revisar modo claro y oscuro.

17. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [ ] Existen las tablas `inventory.stock_counts` e `inventory.stock_count_items` con las columnas e índices descritos, los movimientos `11` y `12` en `inventory.movements`, y la columna `inventory.kardex.id_stock_count`; todo anexado a `queries.txt`.
- [ ] `IKardexEntry` incluye `id_stock_count`, y `applyStockMovement` lo acepta como opcional y lo escribe; recepciones, ventas y consumo por consulta siguen funcionando sin cambios en sus llamadas.
- [ ] `/dashboard/conteos` aparece como "Conteos" dentro del grupo Inventario del sidebar y el rol 5 no la ve.
- [ ] Generar un conteo **general** crea una línea por cada producto activo con fila en `inventory.stock` de la sucursal seleccionada, con `system_quantity` igual al stock de ese momento.
- [ ] Generar un conteo **por categoría** incluye solo productos de esa categoría; el selector ofrece una sola categoría, no varias.
- [ ] La pantalla de captura (`/dashboard/conteos/[id]`) no muestra en ningún momento `system_quantity`, diferencias ni stock actual, y el server action `getCountEntryLines` no los incluye en su respuesta.
- [ ] "Guardar avance" persiste las cantidades capturadas y permite retomar el conteo después sin perder nada.
- [ ] Al finalizar el primer conteo con diferencias, el conteo pasa a `segundo_conteo` y la pantalla pide recontar **solo** los productos con diferencia, sin mostrar la cantidad capturada en el primer conteo.
- [ ] Al finalizar el primer conteo **sin** diferencias, el conteo salta el segundo conteo y pasa directo a `pendiente_revision`.
- [ ] El segundo conteo es definitivo: aunque siga difiriendo del sistema, el conteo pasa a `pendiente_revision` y no se pide un tercer conteo.
- [ ] No existe en ninguna pantalla de captura un botón que actualice el stock.
- [ ] `/dashboard/conteos/[id]/revision` es accesible solo para `id_role` 1 y 4; con cualquier otro rol `proxy.ts` redirige, y el server action de revisión también lo rechaza.
- [ ] La revisión lista únicamente las líneas con diferencia, mostrando conteo físico, stock del snapshot, stock actual y diferencia con signo.
- [ ] Cada línea con diferencia tiene tres decisiones mutuamente excluyentes (`aumentar`, `disminuir`, `dejar_igual`) y un campo de nota opcional.
- [ ] Las decisiones se pueden guardar parcialmente y recuperar al volver, **sin** que el stock cambie mientras el conteo no se cierre.
- [ ] "Cerrar inventario" está deshabilitado mientras alguna línea con diferencia no tenga decisión.
- [ ] Al cerrar, cada línea `aumentar`/`disminuir` genera un movimiento de kardex tipo `11` u `12` con `id_stock_count` y la nota del supervisor, y `inventory.stock` queda en la cantidad contada.
- [ ] La cantidad del ajuste se calcula como `|conteo_final − stock_actual_al_cerrar|`, no contra el snapshot; si el stock actual ya coincide con el conteo, esa línea no genera movimiento.
- [ ] Una línea con decisión `dejar_igual` **no** genera movimiento, no modifica el stock, y conserva registrada su diferencia y su nota en `stock_count_items`.
- [ ] Todo el cierre ocurre en una sola transacción: si falla un movimiento, ninguno persiste y el conteo sigue en `pendiente_revision`.
- [ ] Un conteo `cerrado` es inmutable: no se puede reabrir, ni cambiar decisiones, ni volver a aplicar ajustes desde la UI.
- [ ] No se puede generar un conteo nuevo en una sucursal que ya tiene uno en estado distinto de `cerrado`/`cancelado`; se muestra aviso con enlace al conteo abierto.
- [ ] Quien capturó el conteo y los roles 1/4 pueden cancelarlo mientras no esté `cerrado`; cancelar deja `status = "cancelado"` sin tocar stock ni borrar filas.
- [ ] Quien capturó el conteo nunca ve stock del sistema ni diferencias, tampoco después de que el supervisor cierra el inventario.
- [ ] El folio se muestra como `INV-` + id a 5 dígitos (`INV-00025`) en listado, captura y revisión.
- [ ] Los movimientos `11` y `12` aparecen en `/dashboard/movimientos` con badge propio y son filtrables por tipo, pero **no** son seleccionables en "Registrar movimiento".
- [ ] Todas las fechas viajan como cadenas (`CONVERT(varchar(19), …, 120)` al leer, `buildDate`/`toDBString` al escribir); no se envía ningún `Date` a `mssql`.
- [ ] `id_sucursal`, `id_empresa` e `id_user` se toman del JWT en los server actions, nunca de parámetros del cliente.
- [ ] Los nombres de funciones, variables, componentes y tipos nuevos están en inglés y son descriptivos, conforme a `CLAUDE.md`.
- [ ] Las cuatro pantallas se ven correctamente en modo claro y oscuro, consistentes con Movimientos y Recepciones.
- [ ] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Quien captura el conteo son los roles con acceso a Inventario (1, 2, 3, 4), no el rol 5.** `references/conteo-inventario.md` nombra "podólogo" al actor que cuenta, pero el rol 5 sigue restringido a `/dashboard/tratamientos` por decisión previa del dueño del proyecto (2026-08-12). Se traduce igual que en el resto del inventario: la podóloga cuenta físicamente en el anaquel, el personal de sucursal/administración captura en el sistema. Se descartó abrir una excepción en `proxy.ts` para el rol 5 porque reabriría una decisión ya cerrada por un solo caso de uso.
- **Supervisor = roles 1 y 4, con gate en `proxy.ts` por ruta.** La autorización del ajuste de stock es la parte sensible del proceso; se le da el mismo tratamiento que a `min_stock` (spec 11). El gate va en `proxy.ts` y **además** en el server action: proteger solo en cliente dejaría el endpoint expuesto, y el server action es el que devuelve las cantidades del sistema.
- **La separación de datos es estructural, no visual.** `getCountEntryLines` devuelve `ICountEntryLine`, que **no tiene** campo de stock del sistema. Se descartó devolver la línea completa y ocultar la columna en el render: cualquiera con las herramientas de desarrollador vería el stock esperado en la respuesta del server action, rompiendo la regla central del proceso.
- **Snapshot del stock al generar el conteo (`system_quantity`), pero ajuste calculado contra el stock vivo al cerrar.** El snapshot es lo que hace reproducible la diferencia que el podólogo generó (y es el número que se audita); el stock vivo es lo que hace correcto el ajuste. Se descartó aplicar literal la diferencia del snapshot (`+2`/`−3`) porque entre el conteo y la autorización pueden pasar horas de ventas, consultas y recepciones legítimas, y aplicar el delta viejo las borraría del saldo. Se descartó también no guardar snapshot y comparar siempre contra el stock vivo, porque entonces la diferencia detectada cambiaría sola entre pantalla y pantalla.
- **Se acepta que el conteo puede quedar "desactualizado" al cerrar.** Consecuencia directa de lo anterior: si alguien vendió 2 piezas después del conteo, el stock final quedará en lo contado, no en lo contado menos 2. Es la interpretación correcta para una clínica donde el conteo se autoriza el mismo día; el caso patológico (conteo autorizado una semana después) se resuelve cancelando y recontando.
- **Tipos de movimiento nuevos `11` y `12`, no reutilizar `7`/`8`.** Un ajuste manual (alguien corrigiendo a ojo) y un ajuste autorizado tras un conteo físico tienen valor de auditoría muy distinto. Con tipos separados, el kardex y `/dashboard/movimientos` los distinguen de un vistazo y se puede filtrar "todo lo que movió el conteo de agosto" sin cruzar tablas. (`id_movement = 10` ya estaba en uso como "Descuento por consumo"; se usan 11 y 12 en su lugar.)
- **`kardex.id_stock_count` como columna, no solo texto en `notes`.** El documento pide poder responder "qué inventario originó este cambio". Una FK lógica lo hace consultable; una cadena `"Inventario INV-00025"` dentro de `notes` obligaría a parsear texto para el mismo fin. Es el mismo criterio con que spec 14 agregó `id_transfer`.
- **El ajuste se aplica todo junto al cerrar, no decisión por decisión.** Con aplicación incremental, un conteo abandonado a la mitad dejaría el stock parcialmente ajustado y sin forma limpia de saber dónde se quedó. Aplicar todo en una transacción al cerrar hace que el conteo sea atómico: o ajustó todo lo que debía, o no ajustó nada.
- **Las decisiones sí se guardan parcialmente, aunque el ajuste no se aplique.** Revisar 40 diferencias de una sentada no es realista; guardar decisiones sin tocar stock separa "ya lo pensé" de "ya lo autoricé", que son dos momentos distintos del trabajo del supervisor.
- **`dejar_igual` deja rastro obligatorio.** La línea conserva su `system_quantity`, su conteo, su diferencia y su nota, aunque no genere movimiento. Es literalmente lo que el documento marca como importante para auditoría: "se detectó una diferencia de −3 y el supervisor decidió no modificar el stock". Se descartó borrar o marcar como resuelta la línea.
- **El segundo conteo no muestra la cantidad capturada en el primero.** Si el sistema mostrara "antes pusiste 17", la persona tendería a confirmar su propio número en vez de recontar, que es exactamente el error humano que el segundo conteo existe para atrapar.
- **El segundo conteo es definitivo, sin tercer conteo.** Se descartó el esquema "recontar hasta que dos conteos coincidan" porque puede no converger nunca (si el stock del sistema simplemente está mal, los conteos coincidirán entre sí pero nunca con el sistema) y dejaría al capturista en un bucle. La diferencia persistente es justamente lo que el supervisor debe resolver.
- **Un solo conteo abierto por sucursal.** Dos conteos simultáneos sobre los mismos productos producirían snapshots distintos y decisiones contradictorias al cerrarse en cualquier orden. La restricción se valida en `createStockCount`, no con un índice único filtrado, para poder dar un mensaje útil con enlace al conteo abierto.
- **Un conteo cerrado es inmutable; no hay reabrir ni revertir.** Mismo criterio que el kardex append-only de spec 09/14: el error se corrige registrando un movimiento manual en `/dashboard/movimientos`, y esa corrección queda visible como lo que es. Permitir reabrir crearía dos caminos para lo mismo y la posibilidad de ajustes duplicados.
- **Se permite que un rol 1 o 4 revise el conteo que él mismo capturó.** Decisión explícita del usuario. En una clínica con pocos usuarios por sucursal, exigir dos personas distintas bloquearía el proceso más de lo que protege; la trazabilidad queda en `id_user_counter` e `id_user_reviewer`, que pueden ser el mismo y eso es auditable.
- **Solo se cuentan productos con fila en `inventory.stock` de la sucursal.** Incluir todo el catálogo de la empresa llenaría la hoja de conteo de productos que esa sucursal nunca ha manejado, con stock 0 esperado y 0 contado — ruido puro. El costo es real y se anota en riesgos: un producto que existe físicamente pero nunca se registró ahí no aparece en el conteo.
- **Cantidad en unidades de stock, sin conversión desde cajas/paquetes.** Igual que en Movimientos (spec 14): se cuenta lo que hay en el anaquel, y ofrecer dos unidades introduce el error de multiplicar por el factor de conversión lo que ya venía en piezas.
- **Sin costo unitario en los ajustes por conteo (`unit_cost = NULL`).** El único origen confiable de costo es la orden de compra (spec 09); inventar costo en un ajuste produciría valuación falsa. Coherente con lo decidido en spec 14.
- **Folio derivado del id (`INV-00025`), sin columna de consecutivo.** Mismo patrón que `MOV-{id_kardex}`. Un consecutivo propio por sucursal/año exigiría una tabla de contadores o un cálculo `MAX+1` con riesgo de colisión, para un beneficio meramente cosmético.
- **El stock no se congela ni se bloquean ventas/consultas durante el conteo.** Bloquear la operación de la clínica para hacer un conteo es inviable; el modelo snapshot + ajuste contra stock vivo existe precisamente para tolerar que el inventario siga moviéndose.

## Riesgos identificados

| Riesgo | Mitigación / nota |
|---|---|
| **Un producto que existe físicamente pero nunca tuvo movimiento en la sucursal no aparece en la hoja de conteo.** Al incluir solo productos con fila en `inventory.stock`, un artículo que llegó sin registrarse es invisible al conteo y su existencia real nunca se reconcilia. | Se detecta contando y notando el faltante fuera del sistema; se corrige con una entrada por ajuste en `/dashboard/movimientos`, que crea la fila de stock y lo incorpora a los conteos siguientes. |
| **Movimientos entre el conteo y el cierre desplazan el resultado.** El ajuste deja el stock exactamente en lo contado, así que las ventas o consumos ocurridos después del conteo físico quedan absorbidos en el ajuste en vez de restarse encima. | Aceptado por diseño (ver decisiones). Operativamente: cerrar el conteo el mismo día. Si pasó demasiado tiempo, cancelar y recontar en vez de autorizar. |
| **El supervisor autoriza sobre un `current_stock` que puede haber cambiado desde que abrió la pantalla.** La cantidad final del ajuste se recalcula al cerrar, así que el movimiento generado puede no coincidir con la diferencia que el supervisor vio en pantalla al decidir. | `closeStockCount` relee el stock dentro de la transacción, así que el resultado final siempre es correcto. La confirmación de cierre debe resumir cuántas líneas suben, bajan y quedan igual, para que el supervisor vea el efecto real antes de aplicar. |
| **`system_quantity` puede ser negativo.** Spec 14 permite dejar stock negativo; un producto en `−2` producirá una diferencia enorme frente a un conteo físico normal. | Es información válida (indica exactamente el problema que el conteo debe corregir), pero puede alarmar en la pantalla de revisión si nadie explica de dónde salió. |
| **Conteos abiertos que nadie termina bloquean la sucursal.** Como solo puede haber uno abierto, un conteo generado por error y abandonado impide crear cualquier otro hasta que alguien lo cancele. | Cualquiera de los dos actores puede cancelar, y la pantalla de "Nuevo conteo" enlaza directo al conteo abierto en vez de solo mostrar un error. |
| **Un conteo general de una sucursal con muchos productos es una sola tabla larga.** Cientos de inputs numéricos en una pantalla degradan el rendimiento del cliente y hacen incómoda la captura. | "Guardar avance" permite fraccionar el trabajo. Si el volumen lo exige, la salida natural es paginar o virtualizar la tabla de captura, o usar conteos por categoría en vez de generales. |
| **`saveCountProgress` sin control de concurrencia.** Si dos personas abren el mismo conteo en dos dispositivos, el último guardado pisa al anterior sin aviso. | El proceso asume un solo capturista (`id_user_counter`), pero nada lo impide técnicamente en este spec. Si aparece en la práctica, la solución es restringir la captura al usuario que generó el conteo. |
| **El cierre es una transacción proporcional al número de diferencias.** Cada línea ajustada ejecuta un `applyStockMovement` con `UPDLOCK, HOLDLOCK` sobre `inventory.stock`; un conteo con muchas diferencias mantiene bloqueos sobre varios productos a la vez. | En la práctica las diferencias son pocas y la transacción es breve. Si un conteo general saliera con cientos de diferencias, el cierre podría bloquear brevemente ventas y consultas de esos productos. |
| **Los ajustes por conteo entran sin costo (`unit_cost = NULL`).** Igual que en spec 14, cualquier cálculo futuro de costo promedio o valor de inventario tendrá huecos, y el conteo es justamente el flujo que más unidades puede mover de golpe. | Aceptado: hoy no existe ningún reporte de valuación. Cuando exista, deberá decidir explícitamente qué hacer con los movimientos `1`, `11` y `12` sin costo. |
| **`id_stock_count` en el kardex es FK lógica, sin constraint.** Sigue la convención del repo (spec 14 hizo lo mismo con `id_sucursal_counterpart`), pero nada impide un valor huérfano si alguien manipula datos a mano. | Todos los escritores pasan por `applyStockMovement`; el riesgo es de manipulación directa en BD, no del flujo de la aplicación. |
| **Los estados viajan como `varchar` sin constraint `CHECK`.** Un typo en un `UPDATE` manual dejaría el conteo en un estado que ninguna pantalla sabe pintar. | Los valores se escriben siempre desde los server actions con el tipo `StockCountStatus`, que TypeScript valida en compilación. |

## Lo que **no** entra en este spec

- Acceso del rol 5 (podóloga) a cualquier pantalla de conteo.
- Tercer conteo o recuento hasta que dos conteos coincidan.
- Reabrir un conteo cerrado, editar decisiones o revertir sus ajustes.
- Conteo por varias categorías, por proveedor, por marca, por lote o por caducidad.
- Notificaciones al supervisor y reportes de exactitud de inventario.
- Exportación a CSV/Excel, hoja de conteo impresa y captura offline/móvil.
- Bloquear ventas, consultas o recepciones mientras hay un conteo abierto.

Cada uno de esos, si alguna vez entra, va en su propia spec.
