# 14 — Movimientos de almacén (entradas, salidas y traspasos)

## Header

- **Estado:** Aprobado
- **Depende de:** [[09-pedidos-compra-recepcion]] (`inventory.kardex`, `inventory.stock`, `applyStockMovement`, `inventory.movements`), [[08-productos-inventario-crud]] (`inventory.Products`, `IProduct`), [[13-consumo-automatico-insumos-consulta]] (`auto_consume`, movimiento 5)
- **Fecha:** 2026-08-13
- **Objetivo:** Crear la página `/dashboard/movimientos` dentro de Inventario para consultar el kardex de la sucursal seleccionada y registrar manualmente movimientos que afectan stock (ajustes, mermas, devoluciones y traspasos entre sucursales) de productos que no se descuentan automáticamente por consulta o venta.

## Alcance

**Incluye:**

- Nueva ruta `/dashboard/movimientos` (Server Component de página + componentes cliente en `componentes/`), con su entrada "Movimientos" en el grupo **Inventario** de `navConfig.tsx`, visible para los mismos roles que el resto del grupo (excluye rol 5).
- **Listado del kardex de la sucursal seleccionada** (`SucursalContext`), con paginación en servidor (25 por página), ordenado de más reciente a más antiguo (`id_kardex DESC`). Columnas: ID movimiento (`MOV-{id_kardex}`), fecha y hora, tipo (badge por color), producto (nombre + `product_code`), cantidad con signo, origen/destino, responsable (`dbo.users.nombre`), comentarios (`kardex.notes`).
- El listado muestra **todos** los movimientos del kardex, incluidos los generados automáticamente (1 compra, 5 consulta, 6 venta) — son de solo lectura.
- **Filtros:** buscador de texto (nombre de producto o `product_code`), filtro por tipo de movimiento, y rango de fechas **con el día actual por defecto**. Los filtros se aplican en servidor junto con la paginación.
- **KPIs de cabecera:** "Entradas hoy" y "Salidas hoy" como **suma de unidades** de los movimientos del día en la sucursal seleccionada (agrupados por `movements.increases_storage`), sin comparativo contra ayer.
- **Modal "Registrar movimiento"** con campos: tipo de movimiento, producto (buscador sobre `inventory.Products` activos de la empresa, **sin excluir** los `auto_consume = 1`), cantidad (en unidades de stock, mostrando la unidad del producto), sucursal destino (solo si el tipo es traspaso) y comentarios. La fecha se toma del momento del registro (`buildDate(new Date())`), no es editable.
- **Tipos seleccionables manualmente** en el modal: `2` Salida por devolución, **Traspaso** (opción única que genera `4` + `3`), `7` Entrada por ajuste, `8` Salida por ajuste, `9` Salida por daño/merma. Los tipos `1`, `5` y `6` nunca son seleccionables.
- **Traspaso atómico:** una sola operación genera, en la misma transacción, la salida (mov `4`) en la sucursal origen y la entrada (mov `3`) en la sucursal destino, ambas ligadas por `id_transfer` y con `id_sucursal_counterpart` cruzado. La sucursal destino se elige entre **todas las sucursales activas de la empresa**, excluyendo la origen.
- **Dos columnas nuevas en `inventory.kardex`:** `id_sucursal_counterpart` (`int NULL`) e `id_transfer` (`varchar(36) NULL`).
- **Stock negativo permitido con advertencia:** si la salida deja el stock por debajo de cero, el modal muestra una advertencia visible antes de confirmar, pero **no bloquea** el guardado.
- Reutilización de `applyStockMovement` (`lib/inventory/stock.ts`) para toda la escritura de stock/kardex, extendiéndolo con los dos campos nuevos.
- Anexar los `ALTER TABLE` a `queries.txt`, siguiendo la convención del repo.

**No incluye:**

- **Cancelar, revertir, editar o eliminar movimientos.** El kardex sigue siendo append-only (spec 09); un error se corrige registrando un ajuste. El menú `more_vert` del HTML de referencia no se implementa.
- **Estado "en tránsito" ni confirmación de recepción en traspasos.** El traspaso impacta ambas sucursales al instante; no hay tabla `inventory.transfers` ni flujo de aprobación.
- **Captura en paquetes/cajas.** La cantidad se captura siempre en unidades de stock; no se usa `pieces`/`conversion_factor` como en Recepciones.
- **Costo unitario, número de lote y fecha de caducidad** en la captura manual — `kardex.unit_cost` queda `NULL` en estos movimientos.
- **Movimientos de varias líneas.** Un movimiento = un producto.
- **Restricción de roles adicional para registrar.** Cualquier rol con acceso a Inventario (1, 2, 3, 4) puede registrar movimientos; no se agrega gate por rol en `proxy.ts` más allá de la exclusión ya existente del rol 5.
- **Ver movimientos de otras sucursales** desde esta pantalla — siempre es la sucursal seleccionada en `SucursalContext`.
- **KPI comparativo vs. ayer, exportación a CSV/Excel, ni gráficas.**
- **Cambios a Recepciones, Pedidos, Ventas o Consultas** — esos flujos siguen escribiendo en el kardex exactamente igual que hoy.

## Modelo de datos

**Columnas nuevas en `[CentroPodologico].[inventory].[kardex]`** (tabla ya existente):

| Columna | Tipo | Notas |
|---|---|---|
| `id_sucursal_counterpart` | `int` NULL | Sucursal contraparte del movimiento. Solo se llena en traspasos: en la fila de salida (mov `4`) guarda la sucursal destino; en la de entrada (mov `3`) guarda la sucursal origen. `NULL` en cualquier otro tipo. |
| `id_transfer` | `varchar(36)` NULL | UUID que agrupa el par de filas de un mismo traspaso. `NULL` en cualquier otro tipo. |

```sql
ALTER TABLE [CentroPodologico].[inventory].[kardex]
  ADD [id_sucursal_counterpart] [int] NULL,
      [id_transfer] [varchar](36) NULL;
GO
CREATE INDEX [IX_kardex_transfer] ON [CentroPodologico].[inventory].[kardex] ([id_transfer] ASC);
GO
```

**`interfaces/kardex.ts` — se agregan dos campos a `IKardexEntry`:**

```ts
export interface IKardexEntry {
  // …campos actuales…
  id_consulta:             number | null;
  id_sucursal_counterpart: number | null;  // nuevo
  id_transfer:             string | null;  // nuevo
  id_user:                 number;
  created_at:              Date | string;
}
```

**Nuevas interfaces de vista (en `app/dashboard/movimientos/actions.ts`, siguiendo el patrón de `IPendingReception`):**

```ts
/** Fila del listado: kardex + datos desnormalizados para pintar la tabla. */
export interface IStockMovementListItem {
  id_kardex:               number;
  created_at:              string;          // "YYYY-MM-DD HH:mm:ss" (CONVERT 120)
  id_movement:             number;
  movement_name:           string;
  increases_storage:       boolean;
  id_product:              number;
  product_name:            string;
  product_code:            string;
  quantity:                number;          // siempre positiva; el signo lo da increases_storage
  balance_after:           number;
  unit_code:               string | null;   // units_measurement.code
  counterpart_name:        string | null;   // nombre de la sucursal contraparte (solo traspasos)
  user_name:               string;
  notes:                   string | null;
}

/** Respuesta paginada del listado. */
export interface IStockMovementsPage {
  items:       IStockMovementListItem[];
  total:       number;
  page:        number;
  page_size:   number;
}

/** KPIs de cabecera: unidades entradas/salidas del día en la sucursal. */
export interface IStockMovementsSummary {
  units_in_today:  number;
  units_out_today: number;
}

/** Filtros del listado (todos opcionales salvo la sucursal). */
export interface IStockMovementsFilter {
  id_sucursal: number;
  search:      string | null;   // nombre de producto o product_code
  id_movement: number | null;
  date_from:   string | null;   // "YYYY-MM-DD"; default: hoy
  date_to:     string | null;   // "YYYY-MM-DD"; default: hoy
  page:        number;
  page_size:   number;          // default 25
}

/** Payload del modal de captura. */
export interface IRegisterMovementInput {
  id_movement:            number;         // 2 | 4 (traspaso) | 7 | 8 | 9
  id_product:             number;
  quantity:               number;         // > 0, en unidades de stock
  id_sucursal_destination: number | null; // requerido solo si id_movement === 4
  notes:                  string | null;
}
```

No se crean tablas nuevas. En `IRegisterMovementInput` el traspaso viaja como `id_movement = 4` (salida) + `id_sucursal_destination`; el server action deriva la fila espejo con mov `3`.

## Plan de implementación

1. **BD.** Ejecutar el `ALTER TABLE` + `CREATE INDEX` de "Modelo de datos" contra `[CentroPodologico].[inventory].[kardex]` y anexarlos a `queries.txt` bajo el encabezado `-- spec 14 — movimientos de almacén`.

2. **`interfaces/kardex.ts`.** Agregar `id_sucursal_counterpart: number | null` e `id_transfer: string | null` a `IKardexEntry`.

3. **`lib/inventory/stock.ts`.** Extender `IApplyStockMovementInput` con `id_sucursal_counterpart?: number | null` e `id_transfer?: string | null` (default `null`), y agregarlos al `INSERT` de kardex. Ningún llamador existente (recepciones, consumo por consulta) cambia — los campos son opcionales.

4. **`app/dashboard/movimientos/actions.ts`** (`"use server"`), todas las funciones devolviendo `ActionResult<T>`:
   - `getStockMovements(filter: IStockMovementsFilter)`: `SELECT` sobre `inventory.kardex k` con `JOIN inventory.movements m`, `JOIN inventory.Products p`, `JOIN dbo.users u`, `LEFT JOIN inventory.units_measurement um ON um.id_unit_measurement = k.id_unit_measurement`, `LEFT JOIN dbo.sucursales sc ON sc.id_sucursal = k.id_sucursal_counterpart`. Filtra por `k.id_sucursal = @id_sucursal`, rango de fechas, `@id_movement` (opcional) y `@search` (`p.name LIKE` o `p.product_code LIKE`). Paginación con `ORDER BY k.id_kardex DESC OFFSET/FETCH NEXT`, más un `COUNT(*)` para `total`. **Fechas:** `CONVERT(varchar(19), k.[created_at], 120) AS created_at`; los límites del rango se construyen con `toDBString(date_from + " 00:00:00")` y `toDBString(date_to + " 23:59:59")` — nunca objetos `Date`.
   - `getMovementsSummary(id_sucursal)`: suma de `quantity` del día actual (`addZeroToday(new Date())`) agrupada por `m.increases_storage`, devolviendo `IStockMovementsSummary`.
   - `getMovementTypes()`: catálogo de `inventory.movements` activos, para el filtro (todos) y el select del modal (solo los manuales, filtrado en cliente sobre la misma lista).
   - `searchProductsForMovement(id_sucursal, search)`: productos activos de la empresa que hacen match, devolviendo `id_product`, `name`, `product_code`, `id_stock_unit_measurement`, `unit_code` y el **stock actual** en esa sucursal (`LEFT JOIN inventory.stock`), necesario para la advertencia de stock negativo. Sin excluir `auto_consume = 1`.
   - `getTransferDestinations(id_sucursal_origin, id_empresa)`: sucursales activas de la empresa excluyendo la origen.
   - `registerStockMovement(input: IRegisterMovementInput)`: valida `id_movement ∈ {2, 4, 7, 8, 9}`, `quantity > 0`, y — si `id_movement === 4` — que `id_sucursal_destination` exista, sea distinta de la origen y pertenezca a la empresa. Toma `id_sucursal`, `id_empresa` e `id_user` del JWT (nunca del cliente). Dentro de **una sola** `db.transaction`:
     - Movimientos `2`, `7`, `8`, `9`: un `applyStockMovement` con `id_unit_measurement = Products.id_stock_unit_measurement`, `unit_cost: null`, `notes`.
     - Movimiento `4` (traspaso): genera `id_transfer = randomUUID()` y ejecuta **dos** `applyStockMovement` — salida mov `4` en la sucursal origen con `id_sucursal_counterpart = destino`, y entrada mov `3` en la destino con `id_sucursal_counterpart = origen`; ambas con el mismo `id_transfer` y las mismas `notes`. Si cualquiera falla, la transacción revierte ambas.
     - Al terminar, `revalidatePath("/dashboard/movimientos")`.

5. **`app/dashboard/movimientos/page.tsx`.** Server Component que renderiza cabecera (título + botón "Registrar movimiento") y monta el componente cliente del listado; el cliente es necesario porque los datos dependen de `SucursalContext`, igual que `/dashboard/recepciones`.

6. **`app/dashboard/movimientos/componentes/`:**
   - `StockMovementsTable.tsx` (cliente): lee `selectedId` de `SucursalContext`, mantiene estado de filtros y página, llama a `getStockMovements`/`getMovementsSummary`, y pinta KPIs, barra de filtros, tabla y paginación. Estados de carga, error y vacío. `key` = `id_kardex`.
   - `StockMovementRow.tsx`: una fila; cantidad con signo y color (`+` verde para entradas, `−` para salidas, rojo para merma), badge de tipo, "Origen/Destino" con `counterpart_name ?? "—"`. Fechas formateadas normalizando la cadena del DB (`replace(" ", "T")`) antes de `new Date`, nunca directo.
   - `MovementTypeBadge.tsx`: badge por tipo, reutilizando el patrón de `OrderStatusBadge`.
   - `RegisterMovementModal.tsx` (cliente): formulario de 5 campos; el select de sucursal destino solo aparece con tipo "Traspaso"; muestra la unidad de stock junto al input de cantidad y, si `cantidad > stock actual` en una salida, una advertencia visible que **no** bloquea el envío. Al confirmar llama a `registerStockMovement` y refresca el listado.

7. **Sidebar.** Agregar `{ href: "/dashboard/movimientos", label: "Movimientos", icon: ArrowLeftRight }` a los `children` de "Inventario" en `navConfig.tsx`, después de "Recepciones".

8. **Diseño.** Aplicar la skill `frontend-design` y los tokens de `references/DESIGN.md`, respetando el modo oscuro ya presente en Recepciones/Pedidos (clases `dark:`), en lugar de copiar literalmente el HTML de referencia (`references/entradas/entradas-salidas.html`, que es light-only y usa Material Symbols).

9. **Verificación manual:** registrar un ajuste de entrada y confirmar que el stock sube y aparece la fila; registrar una merma que deje el stock negativo y confirmar que se advierte pero se guarda; registrar un traspaso y confirmar que aparecen **dos** filas —salida en la sucursal origen y entrada al cambiar a la sucursal destino— con la contraparte correcta en la columna Origen/Destino; verificar que el listado abre filtrado al día de hoy, que la búsqueda y el filtro por tipo funcionan, y que la paginación avanza sin perder filtros.

10. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [ ] `inventory.kardex` tiene las columnas `id_sucursal_counterpart` (`int` NULL) e `id_transfer` (`varchar(36)` NULL), con el índice `IX_kardex_transfer`, registradas en `queries.txt`.
- [ ] `IKardexEntry` incluye `id_sucursal_counterpart` e `id_transfer`.
- [ ] `applyStockMovement` acepta ambos campos como opcionales y los escribe en el kardex; recepciones y consumo por consulta siguen funcionando sin cambios en sus llamadas.
- [ ] Existe la ruta `/dashboard/movimientos` y aparece como "Movimientos" dentro del grupo Inventario del sidebar; el rol 5 no la ve.
- [ ] Al abrir la página, el listado muestra únicamente movimientos de la sucursal seleccionada en `SucursalContext`, filtrados al **día actual** por defecto, ordenados del más reciente al más antiguo.
- [ ] El listado incluye también los movimientos automáticos (tipos 1, 5, 6) como solo lectura.
- [ ] La paginación es en servidor (25 por página) y avanzar de página conserva los filtros activos.
- [ ] El buscador filtra por nombre de producto o `product_code`, y el filtro por tipo de movimiento acota el listado; ambos se aplican en servidor.
- [ ] Los KPIs "Entradas hoy" y "Salidas hoy" muestran la suma de unidades del día en la sucursal seleccionada, sin comparativo contra ayer.
- [ ] El select del modal ofrece únicamente: Salida por devolución, Traspaso, Entrada por ajuste, Salida por ajuste y Salida por daño/merma. Los tipos 1, 5 y 6 no son seleccionables.
- [ ] El buscador de productos del modal incluye productos con `auto_consume = 1`.
- [ ] Registrar un movimiento de ajuste/merma/devolución genera **una** fila de kardex y actualiza `inventory.stock` con el signo que dicta `movements.increases_storage`.
- [ ] El campo "sucursal destino" solo aparece cuando el tipo es Traspaso, ofrece todas las sucursales activas de la empresa excepto la origen, y es obligatorio en ese caso.
- [ ] Registrar un traspaso genera **exactamente dos** filas de kardex en la misma transacción: mov `4` en la sucursal origen y mov `3` en la destino, con el mismo `id_transfer` y `id_sucursal_counterpart` cruzado.
- [ ] Si la escritura de cualquiera de las dos filas del traspaso falla, ninguna de las dos persiste y el stock de ambas sucursales queda intacto.
- [ ] Una salida cuya cantidad supera el stock actual muestra una advertencia visible en el modal pero **permite** guardar, dejando el stock en negativo.
- [ ] La cantidad se captura y guarda en unidades de stock; la unidad del producto se muestra junto al input y `unit_cost` queda `NULL`.
- [ ] `id_sucursal`, `id_empresa` e `id_user` del movimiento se toman del JWT en el server action, no de parámetros enviados por el cliente.
- [ ] La columna "Origen/Destino" muestra la sucursal contraparte en traspasos y `—` en cualquier otro tipo.
- [ ] Ninguna fila del kardex puede editarse, cancelarse ni eliminarse desde la UI.
- [ ] Todas las fechas viajan como cadenas (`CONVERT(varchar(19), …, 120)` al leer, `toDBString`/`buildDate` al escribir); no se construye ningún `Date` que se envíe a `mssql`.
- [ ] La página se ve correctamente en modo claro y oscuro, consistente con Recepciones y Pedidos.
- [ ] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Traspaso atómico e inmediato (una operación, dos filas de kardex), sin estado "en tránsito".** Se descartó el flujo con confirmación de la sucursal destino (tabla `inventory.transfers` con estatus) porque duplicaría la maquinaria de Recepciones (spec 09) para una clínica con pocas sucursales y traspasos esporádicos. Si el material se pierde en el camino, se corrige con un ajuste — que es justamente para lo que existe esta pantalla.
- **El vínculo del traspaso vive en dos columnas de `inventory.kardex` (`id_transfer`, `id_sucursal_counterpart`), no en una tabla nueva.** Un traspaso es de un solo producto y se resuelve en una transacción: no hay encabezado (proveedor, totales, estatus) que justifique una tabla propia, y mantener el par dentro del kardex conserva la propiedad de que **toda** la información de un movimiento se lee de una sola tabla.
- **"Traspaso" es una sola opción del select, no dos ("Entrada por traspaso" / "Salida por traspaso").** Los movimientos `3` y `4` siguen existiendo en el catálogo y se muestran como tales en el listado, pero exponerlos por separado en la captura invitaría a registrar una salida sin su entrada espejo y descuadrar el inventario global.
- **Se permite dejar el stock en negativo, con advertencia.** Se descartó bloquear la salida porque en la práctica el stock del sistema suele estar por debajo del real (hay consumo no registrado), y bloquear dejaría a la gente atorada sin poder capturar una merma legítima. La advertencia deja constancia visual sin impedir la operación.
- **El kardex sigue siendo append-only: no hay cancelar ni revertir.** Se descartó un botón "Revertir" (con `id_kardex_reversal`) porque los movimientos `7`/`8` (ajustes) ya son el mecanismo previsto para corregir errores, y agregar reversas crearía dos caminos para lo mismo, con el riesgo de reversas de reversas. Coherente con el diseño de spec 09.
- **El selector de producto no excluye `auto_consume = 1`.** Aunque la pantalla existe para productos que no se descuentan solos, un insumo de consumo automático también se rompe, caduca o sale descuadrado en un conteo físico. Filtrarlos habría dejado esos productos sin ninguna forma de corregir su stock.
- **Cantidad siempre en unidades de stock, sin conversión desde paquetes/cajas.** Recepciones convierte (`pieces`/`conversion_factor`) porque se compra por caja; aquí se cuenta lo que hay en el anaquel. Se descartó ofrecer ambas unidades para no introducir una fuente de error de captura (multiplicar por 20 lo que debía ser 20 piezas).
- **Sin restricción de rol adicional para registrar movimientos.** Se descartó limitar el registro a roles 1 y 4 (como `min_stock`, spec 11) porque quien detecta una merma o hace el conteo físico es normalmente personal de sucursal; la trazabilidad la aporta `kardex.id_user`, que ya queda registrado en cada fila.
- **Sin costo unitario, lote ni caducidad en la captura manual.** El costo solo tiene un origen confiable (la orden de compra, spec 09); capturarlo a mano en un ajuste produciría valuación inventada. Lote y caducidad requerirían un modelo de inventario por lotes que hoy no existe.
- **Un movimiento = un producto.** Se descartó el movimiento multi-línea porque `applyStockMovement` ya opera fila por fila y agrupar líneas exigiría un encabezado (o un `id_batch`) sin beneficio operativo claro para ajustes y mermas, que por naturaleza son puntuales.
- **La página se construye con los patrones del repo (`lucide-react`, clases `dark:`, tokens de `DESIGN.md`), no copiando el HTML de referencia.** El HTML de `references/entradas/entradas-salidas.html` define la **estructura y jerarquía visual** (KPIs, barra de filtros, tabla), pero es light-only y usa Material Symbols vía CDN; replicarlo literalmente rompería la consistencia con Recepciones y Pedidos.

## Riesgos identificados

- **El traspaso mueve stock en una sucursal que el usuario puede no administrar.** Al ofrecer todas las sucursales activas de la empresa como destino, un usuario puede incrementar el stock de una sucursal a la que no tiene acceso, y esa sucursal verá aparecer una entrada que nadie ahí capturó ni confirmó. Es la consecuencia esperada del traspaso atómico, pero conviene que el personal acuerde los traspasos por fuera del sistema antes de registrarlos.
- **Stock negativo silencioso.** Permitir salidas por debajo de cero significa que el kardex puede acumular `balance_after` negativos que nadie corrige. Como el mínimo efectivo de pedidos (spec 11) compara contra ese `quantity`, una sucursal con stock negativo aparecerá permanentemente "bajo mínimo" y sobredimensionará los sugeridos hasta que alguien haga un ajuste de entrada.
- **Sin reversa, un error de captura solo se corrige con otro movimiento.** Registrar 100 en lugar de 10 deja las dos filas visibles en el kardex (el error y su ajuste compensatorio); el histórico queda correcto en saldo pero ruidoso de leer, y no hay forma de marcar cuál fila fue el error.
- **Un traspaso mal capturado requiere dos correcciones.** Si el usuario elige la sucursal destino equivocada, corregirlo implica registrar ajustes en **ambas** sucursales (o un traspaso inverso), y el `id_transfer` original queda apuntando a un par de filas que ya no reflejan lo que pasó físicamente.
- **`unit_cost` en `NULL` degrada la valuación del inventario.** Las entradas por ajuste y por traspaso entran sin costo, así que cualquier cálculo futuro de costo promedio o valor de inventario tendrá huecos y deberá decidir qué hacer con esas filas. Se acepta porque hoy no existe ningún reporte de valuación.
- **El listado del kardex crece indefinidamente.** La paginación en servidor y el filtro por defecto al día actual lo contienen, pero un rango de fechas amplio combinado con búsqueda de texto (`LIKE '%…%'`, no sargable) puede degradarse conforme el kardex acumule años; el índice existente es `(id_product, id_sucursal, id_kardex DESC)`, que no cubre el filtro por fecha sobre toda la sucursal. Si se vuelve lento, la solución es un índice por `(id_sucursal, created_at)`.
- **Los KPIs "hoy" dependen de la hora del servidor.** Se calculan con `addZeroToday(new Date())` en zona `America/Mexico_City`; si el servidor de despliegue corre en otra zona y el helper no se aplica correctamente, los KPIs pueden mostrar el día equivocado alrededor de la medianoche — el mismo riesgo ya presente en el resto del repo, pero aquí es visible en la primera pantalla.
