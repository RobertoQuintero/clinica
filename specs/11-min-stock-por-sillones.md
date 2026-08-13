# 11 — Stock mínimo por sillones de sucursal

## Header

- **Estado:** Aprobado
- **Depende de:** [[09-pedidos-compra-recepcion]] (`getSuggestedProducts`, `ISuggestedProduct`, `inventory.stock`, `inventory.Products.min_stock`)
- **Fecha:** 2026-08-13
- **Objetivo:** Sustituir el mínimo efectivo de `getSuggestedProducts` (hoy `COALESCE(stock.min_stock, Products.min_stock)`) por `CEILING(Products.min_stock * COALESCE(NULLIF(sucursales.seats, 0), 1))`, para que el stock mínimo de pedidos escale según el número de sillones de cada sucursal.

## Alcance

**Incluye:**

- Cambiar el cálculo de `min_stock_effective` en `getSuggestedProducts` (`app/dashboard/pedidos/actions.ts`): reemplazar `COALESCE(stock.min_stock, Products.min_stock)` por `CEILING(Products.min_stock * COALESCE(NULLIF(sucursales.seats, 0), 1))`. Aplica igual en la tab "Sugeridos para pedir" y en "Todos los productos", ya que ambas leen el mismo campo.
- `JOIN` de `dbo.sucursales` (por `id_sucursal`) dentro de esa consulta para leer `seats`.
- Fallback `seats = 1` cuando la columna es `NULL` o `0` (vía `COALESCE(NULLIF(...))`), para que ninguna sucursal quede con mínimo efectivo en cero o indefinido por falta de dato.
- Redondeo hacia arriba (`CEILING`) del resultado, consistente con que el stock se maneja en unidades enteras/discretas.
- Dejar de leer `inventory.stock.min_stock` (override manual por sucursal) en `getSuggestedProducts`: la columna se queda en la tabla sin uso (no se elimina de la BD), documentado como deuda/decisión explícita.

**No incluye:**

- Eliminar físicamente la columna `inventory.stock.min_stock` de la BD — queda sin lectura, pero no se hace `ALTER TABLE ... DROP COLUMN` (evita tocar esquema sin necesidad y no rompe nada si se reutiliza a futuro).
- Ninguna UI para editar `seats` — el campo ya existe y ya es editable desde `/dashboard/sucursales` (spec previo). Este spec solo lo **consume**.
- Cambios a `ProductModal.tsx` ni a la restricción de roles sobre `min_stock` (sigue siendo el mínimo base "por sillón", editable solo por roles 1 y 4, sin cambios de spec 09).
- Cambios a `inventory.kardex`, `applyStockMovement`, recepciones, órdenes de compra o cualquier otro cálculo fuera de `getSuggestedProducts`/`getPurchaseOrdersSummary` (que consume `getSuggestedProducts` internamente y hereda el cambio sin tocarse directamente).
- Recalcular o migrar órdenes de compra ya generadas — el cambio solo afecta al cálculo de "sugeridos" hacia adelante, no reescribe históricos.

## Modelo de datos

Este spec no introduce estructuras nuevas. Reutiliza columnas ya existentes:

- `dbo.sucursales.seats` (ya agregada, spec previo — `ISucursal.seats: number | null`).
- `inventory.Products.min_stock` (ya existente).

No se crean tablas, columnas ni interfaces nuevas.

## Plan de implementación

1. En `app/dashboard/pedidos/actions.ts`, dentro de `getSuggestedProducts`, agregar un `LEFT JOIN` a `[CentroPodologico].[dbo].[sucursales]` (alias `suc`) por `suc.[id_sucursal] = @id_sucursal`, seleccionando `suc.[seats]`. Ya no se selecciona `s.[min_stock] AS branch_min_stock`.
2. Reemplazar el cálculo de `minStockEffective` en el `map`:
   - Quitar la rama que prioriza `branch_min_stock`.
   - Calcular `seatsEffective = Number(row.seats) > 0 ? Number(row.seats) : 1`.
   - `minStockEffective = row.product_min_stock !== null && row.product_min_stock !== undefined ? Math.ceil(Number(row.product_min_stock) * seatsEffective) : null` (si el producto no tiene `min_stock` base, el mínimo efectivo sigue siendo `null`, igual que hoy).
3. Verificar que `getPurchaseOrdersSummary` (que llama a `getSuggestedProducts` internamente) sigue funcionando sin cambios adicionales, ya que consume el mismo `min_stock_effective` recalculado.
4. Verificación manual: en una sucursal con `seats = 2`, confirmar que un producto con `min_stock = 10` muestra mínimo efectivo `20` tanto en "Sugeridos para pedir" como en "Todos los productos" de `/dashboard/pedidos/nuevo`, y que la cantidad sugerida (`suggested_quantity`) se recalcula con ese nuevo mínimo. Repetir con una sucursal con `seats = NULL` y confirmar que se comporta como `seats = 1` (mínimo efectivo = `min_stock` base).
5. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [ ] `/dashboard/pedidos/nuevo` calcula `min_stock_effective` como `CEILING(Products.min_stock * seats)` para la sucursal seleccionada, tanto en "Sugeridos para pedir" como en "Todos los productos".
- [ ] Un producto con `min_stock = 10` en una sucursal con `seats = 2` muestra mínimo efectivo `20`.
- [ ] Una sucursal con `seats = NULL` o `seats = 0` usa `seats = 1` como fallback (mínimo efectivo = `min_stock` base, sin multiplicar por 0 ni quedar `NULL`).
- [ ] Un producto sin `min_stock` base (`NULL`) sigue mostrando mínimo efectivo `NULL` y no se marca como `below_minimum`.
- [ ] `suggested_quantity` se recalcula usando el nuevo mínimo efectivo (`CEILING((mínimo_efectivo − stock_actual) / conversion_factor)`, mínimo 1).
- [ ] Los KPIs de `getPurchaseOrdersSummary` (productos bajo mínimo, sugeridos) reflejan el nuevo cálculo sin requerir cambios propios en esa función.
- [ ] `inventory.stock.min_stock` deja de leerse en `getSuggestedProducts` (la columna permanece en la BD sin uso).
- [ ] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **El mínimo efectivo depende exclusivamente de `Products.min_stock * seats`, eliminando el override manual (`inventory.stock.min_stock`).** Spec 09 había diseñado ese override para permitir mínimos distintos por sucursal sin regla explícita. Ahora que existe una regla de negocio explícita (sillones), mantener ambos mecanismos vivos sería ambiguo: ¿cuál gana si un administrador captura un override manual que contradice la fórmula? Se descartó la opción de "el override gana sobre la fórmula" porque ese override nunca tuvo UI para capturarse (columna leída pero no editable desde ningún formulario), así que en la práctica siempre era `NULL` — no hay dato real que se pierda al dejar de leerlo.
- **No se elimina la columna `inventory.stock.min_stock` de la BD.** Se descartó el `DROP COLUMN` por ser un cambio de esquema irreversible y fuera del alcance solicitado; basta con dejar de leerla en código. Si en el futuro se decide reintroducir un override manual, la columna ya está disponible.
- **Fallback `seats = 1` vía `COALESCE(NULLIF(seats, 0), 1)`, en vez de dejar el mínimo en `NULL` cuando falta el dato.** Se descartó "mínimo indefinido si no hay `seats`" porque dejaría sucursales enteras sin alertas de "por debajo del mínimo" silenciosamente — un riesgo operativo mayor que asumir el caso base (1 sillón).
- **Redondeo con `CEILING`, no truncamiento ni decimales.** Consistente con que el stock y las cantidades sugeridas ya se manejan en unidades enteras/discretas en el resto del módulo de pedidos (spec 09).
- **El cambio se hace únicamente en `getSuggestedProducts`, no en una función/helper compartido nuevo.** Es el único punto de cálculo de mínimo efectivo en el sistema hoy (`grep` confirmó que `branch_min_stock` solo se usaba ahí); se descartó extraer un helper `lib/inventory/` porque no hay un segundo consumidor que lo justifique todavía.

## Riesgos identificados

- **Reinterpretación silenciosa de `Products.min_stock`.** Antes de este cambio, `min_stock` se capturaba (implícitamente) como el mínimo real de una sucursal "típica". Con la fórmula nueva pasa a significar "mínimo por sillón", así que los valores ya cargados en catálogo pueden quedar sobre- o sub-dimensionados una vez multiplicados por `seats` (p. ej. un producto con `min_stock = 10` pensado como mínimo total terminará pidiendo `20` o `30` en sucursales grandes sin que nadie lo haya decidido así). Conviene que el dueño del producto revise el catálogo tras liberar el cambio.
- **`seats` sin capturar en sucursales existentes.** Si la mayoría de registros en `dbo.sucursales` tiene `seats = NULL` hoy, el fallback a `1` hace que el comportamiento no cambie ahí — pero también oculta el hecho de que el dato no se ha cargado, dando falsa sensación de que la fórmula ya está "funcionando" en todas las sucursales.
- **Sin trazabilidad del cambio de fórmula en órdenes históricas.** Las órdenes de compra ya generadas no guardan qué mínimo efectivo se usó al sugerirlas (ese dato nunca se persistió, solo se calcula al vuelo); no hay manera de auditar retroactivamente si una orden pasada se generó con el mínimo viejo o el nuevo. Se acepta porque coincide con el diseño de spec 09 (los sugeridos son un cálculo en vivo, no un dato guardado).
- **Columna `inventory.stock.min_stock` queda "muerta" en la BD** sin lectura ni escritura desde la app — riesgo bajo, pero puede confundir a quien inspeccione el esquema más adelante sin conocer esta decisión.
