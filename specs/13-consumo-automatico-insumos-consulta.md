# 13 — Consumo automático de insumos por consulta

## Header

- **Estado:** Aprobado
- **Depende de:** [[08-productos-inventario-crud]] (`inventory.Products`, `IProduct`, `ProductModal`, `saveProduct`), [[09-pedidos-compra-recepcion]] (`inventory.stock`, `inventory.kardex`, `applyStockMovement`, movimiento 5 "Salida por consulta")
- **Fecha:** 2026-08-13
- **Objetivo:** Marcar en el catálogo de Productos qué insumos se consumen automáticamente en cada consulta y con qué cantidad (cubrebocas 1, guantes 1, campos 2), y descontarlos del stock de la sucursal — con su fila en kardex bajo el movimiento 5 "Salida por consulta" — en el momento en que se crea una consulta.

## Alcance

**Incluye:**

- Dos columnas nuevas en `[CentroPodologico].[inventory].[Products]`:
  - `auto_consume bit NOT NULL DEFAULT 0` — el producto se descuenta solo en cada consulta.
  - `consumption_per_consultation decimal(18,4) NULL` — cuántas unidades de stock se descuentan por consulta.
- Dos campos nuevos en `interfaces/product.ts` (`IProduct`), con los mismos nombres.
- Una columna nueva `id_consulta int NULL` en `[CentroPodologico].[inventory].[kardex]`, como origen del movimiento (mismo rol que `id_reception` para recepciones).
- En `ProductModal.tsx`: checkbox "Consumo automático por consulta" y, cuando está activo, input numérico "Cantidad por consulta". Ambos editables **solo por roles 1 y 4**, misma restricción que `min_stock` (spec 09). Disponible para **cualquier categoría**, sin condicionar.
- Validación server-side en `saveProduct`: si `auto_consume = true`, `consumption_per_consultation` es obligatorio y debe ser `> 0`; si `auto_consume = false`, se guarda `NULL`.
- Columna nueva en la tabla del listado de `/dashboard/productos` mostrando la cantidad por consulta (vacío cuando `auto_consume = false`).
- Nueva función `applyConsultationConsumption(id_consulta, id_sucursal, id_empresa, id_user)` en `lib/inventory/` que, dentro de una transacción, lee todos los productos con `auto_consume = 1` de la empresa y llama a `applyStockMovement` por cada uno con `id_movement = 5` ("Salida por consulta") y `quantity = consumption_per_consultation`.
- Enganche de esa función en los **tres** puntos donde nace una consulta, solo en el `INSERT`: `crearConsultaDesdeCita` (`app/dashboard/actions.ts`), `saveConsulta` con `id_consulta === 0` (`app/dashboard/pacientes/[id]/expediente/actions.ts`) y `createConsultaOnicomicosis` (`app/dashboard/tratamientos/actions.ts`).
- Comportamiento *best-effort*: si el descuento falla, la consulta queda creada igual y el error se registra en log del servidor, sin bloquear ni revertir.
- Se permite stock negativo: si la sucursal no tiene existencia, se descuenta igual y el kardex refleja el saldo negativo.
- Anexar los tres `ALTER TABLE` a `queries.txt` (convención del repo, sin migraciones).

**No incluye:**

- Cantidades distintas por sucursal — la cantidad por consulta es global del producto.
- Reversar el consumo cuando una consulta se cancela (`cancelada = 1`) o se borra (`deleted_at`): lo descontado se queda descontado, porque el material ya se abrió.
- Descontar al **editar** una consulta existente: solo se descuenta en la creación, nunca en el `UPDATE`.
- Cualquier UI para consultar "qué se consumió en esta consulta" — el dato queda en `kardex.id_consulta` pero no se expone en pantalla todavía.
- Bloquear la creación de consultas por falta de stock, o cualquier alerta/notificación de stock insuficiente.
- Relacionar este consumo con `dbo.consulta_productos` (productos cobrados al paciente) — son cosas distintas y esa tabla no se toca.
- Variar la cantidad según el tipo de consulta, el tratamiento o el servicio aplicado — es una cantidad fija por producto.
- Cambios a recepciones, pedidos, ventas o cualquier otro flujo que ya mueve stock.

## Modelo de datos

**Columnas nuevas en `[CentroPodologico].[inventory].[Products]`** (tabla existente, solo se agregan columnas):

| Columna | Tipo | Notas |
|---|---|---|
| `auto_consume` | `bit` NOT NULL DEFAULT 0 | El producto se descuenta automáticamente en cada consulta. |
| `consumption_per_consultation` | `decimal(18,4)` NULL | Unidades de **stock** descontadas por consulta. Obligatorio (`> 0`) solo cuando `auto_consume = 1`; en cualquier otro caso `NULL`. |

Se usa `decimal(18,4)` para ser consistente con `inventory.stock.quantity` y `inventory.kardex.quantity`, aunque los casos reales de hoy sean enteros (1, 1, 2).

**Columna nueva en `[CentroPodologico].[inventory].[kardex]`:**

| Columna | Tipo | Notas |
|---|---|---|
| `id_consulta` | `int` NULL | Origen del movimiento cuando viene de una consulta. Mismo rol que `id_reception` para recepciones. `NULL` en todos los movimientos que no son de consulta. |

**`interfaces/product.ts` (`IProduct`) — dos campos nuevos:**

```ts
export interface IProduct {
  // ...campos existentes...
  min_stock:                     number | null;
  auto_consume:                  boolean;        // nuevo
  consumption_per_consultation:  number | null;  // nuevo
  // ...resto sin cambios...
}
```

**`interfaces/kardex.ts` — un campo nuevo:** `id_consulta: number | null`.

**`IApplyStockMovementInput` (`lib/inventory/stock.ts`) — un campo opcional nuevo:**

```ts
id_consulta?: number | null;   // default null, se escribe en kardex.id_consulta
```

**Criterio de selección de productos a descontar** (dentro de `applyConsultationConsumption`):

```sql
WHERE [auto_consume] = 1
  AND [consumption_per_consultation] > 0
  AND [id_empresa] = @id_empresa
  AND [activo] = 1
  AND [status] = 1
```

**Valores con los que se llama a `applyStockMovement`** por cada producto seleccionado:

| Campo | Valor |
|---|---|
| `id_movement` | `5` (Salida por consulta, `increases_storage = 0`) |
| `quantity` | `consumption_per_consultation` (positiva; el signo lo aporta el movimiento) |
| `id_sucursal` / `id_empresa` | los de la consulta recién creada |
| `id_unit_measurement` | `Products.id_stock_unit_measurement` (unidad de stock, spec 09) |
| `id_user` | `id_podologo` de la consulta |
| `id_consulta` | `id_consulta` recién creado |
| `unit_cost`, `id_purchase_order_item`, `id_reception` | `null` |
| `notes` | `null` (la trazabilidad vive en `id_consulta`, no en texto) |

No se crean tablas ni interfaces nuevas.

## Plan de implementación

1. Ejecutar contra la BD y anexar a `queries.txt` bajo un encabezado `-- spec 13 — consumo automático de insumos por consulta`:
   ```sql
   ALTER TABLE [CentroPodologico].[inventory].[Products]
     ADD [auto_consume] [bit] NOT NULL DEFAULT 0,
         [consumption_per_consultation] [decimal](18,4) NULL;
   ALTER TABLE [CentroPodologico].[inventory].[kardex]
     ADD [id_consulta] [int] NULL;
   ```
2. Agregar `auto_consume: boolean` y `consumption_per_consultation: number | null` a `IProduct` (`interfaces/product.ts`), y `id_consulta: number | null` a `interfaces/kardex.ts`.
3. En `lib/inventory/stock.ts`: agregar `id_consulta?: number | null` a `IApplyStockMovementInput`, desestructurarlo con default `null` e incluirlo en el `INSERT` a `inventory.kardex`. Verificación: una recepción existente sigue funcionando y graba `id_consulta = NULL`.
4. En `app/dashboard/productos/actions.ts`:
   - `getProducts()`: agregar `[auto_consume]` y `[consumption_per_consultation]` al `SELECT`, con casteo numérico consistente con `min_stock`.
   - `saveProduct()`: desestructurar ambos campos; validar server-side que si `auto_consume === true` entonces `consumption_per_consultation > 0` (si no, `return { ok: false, message: "La cantidad por consulta es obligatoria y debe ser mayor a 0 cuando el producto se consume automáticamente" }`); forzar `consumption_per_consultation = null` cuando `auto_consume === false`; incluir ambos en `commonParams`, `INSERT` y `UPDATE`.
5. En `app/dashboard/productos/page.tsx`: agregar `auto_consume: false` y `consumption_per_consultation: null` a `EMPTY`, mapearlos en `openEdit`, y agregar `"consumption_per_consultation"` al manejo numérico de `handleChange` (mismo tratamiento decimal que `price`).
6. En `ProductModal.tsx`: agregar el checkbox "Consumo automático por consulta" y, condicionado a que esté activo, el input "Cantidad por consulta" (`required`, `min` mayor que 0). Ambos controles se renderizan solo para roles 1 y 4, reutilizando exactamente la misma condición de rol que ya envuelve a `min_stock`. El input aparece/desaparece en vivo al marcar o desmarcar el checkbox, sin reabrir el modal.
7. En la tabla del listado de `/dashboard/productos`: agregar la columna "Consumo/consulta", que muestra `consumption_per_consultation` cuando `auto_consume` es verdadero y queda vacía en caso contrario. Verificación manual: marcar cubrebocas con cantidad 1 y confirmar que la columna lo refleja tras guardar.
8. Crear `lib/inventory/consultationConsumption.ts` con `applyConsultationConsumption(input)`, que recibe `{ id_consulta, id_sucursal, id_empresa, id_user }`, abre **una sola** `db.transaction`, selecciona los productos con el criterio de la sección "Modelo de datos" y llama a `applyStockMovement` por cada uno con los valores de la tabla de esa misma sección. Si no hay productos marcados, no abre transacción y termina sin efecto. Nunca lanza hacia afuera: envuelve todo en `try/catch` y ante error registra en `console.error` y retorna sin propagar.
9. Enganchar la función en `crearConsultaDesdeCita` (`app/dashboard/actions.ts`), justo después de obtener el `id_consulta` insertado y antes del `return`, con `id_user = id_podologo`.
10. Enganchar la función en `createConsultaOnicomicosis` (`app/dashboard/tratamientos/actions.ts`), en el mismo punto y con el mismo criterio.
11. Enganchar la función en `saveConsulta` (`app/dashboard/pacientes/[id]/expediente/actions.ts`), **solo dentro de la rama `id_consulta === 0`** (creación), nunca en la rama de `UPDATE`.
12. Verificación manual completa: marcar cubrebocas (1), guantes (1) y campos (2) como consumo automático; anotar el stock de los tres en una sucursal; crear una consulta desde una cita en esa sucursal; confirmar que el stock bajó 1, 1 y 2 respectivamente y que hay tres filas nuevas en `inventory.kardex` con `id_movement = 5` y el `id_consulta` correcto. Repetir creando la consulta desde el expediente y desde tratamientos (onicomicosis). Después **editar** esa consulta y confirmar que no se descuenta nada adicional.
13. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [ ] `inventory.Products` tiene las columnas `auto_consume` (`bit` NOT NULL DEFAULT 0) y `consumption_per_consultation` (`decimal(18,4)` NULL), y `inventory.kardex` tiene `id_consulta` (`int` NULL); los tres `ALTER TABLE` están registrados en `queries.txt`.
- [ ] `IProduct` incluye `auto_consume` y `consumption_per_consultation`; `IKardex` incluye `id_consulta`.
- [ ] `getProducts()` devuelve ambos campos nuevos para cada producto.
- [ ] En `ProductModal`, el checkbox "Consumo automático por consulta" y su input de cantidad solo se renderizan para roles 1 y 4; un usuario de otro rol no los ve ni puede modificarlos.
- [ ] El input "Cantidad por consulta" aparece al marcar el checkbox y desaparece al desmarcarlo, sin reabrir el modal.
- [ ] Guardar con `auto_consume = true` y cantidad vacía o `<= 0` es rechazado por `saveProduct` con mensaje de error.
- [ ] Guardar con `auto_consume = false` deja `consumption_per_consultation` en `NULL`, aunque el input hubiera tenido un valor antes de desmarcar.
- [ ] La tabla de `/dashboard/productos` muestra la columna "Consumo/consulta" con el valor cuando `auto_consume` es verdadero, y vacía cuando es falso.
- [ ] Con cubrebocas (1), guantes (1) y campos (2) marcados, crear una consulta **desde una cita** descuenta exactamente 1, 1 y 2 unidades del stock de la sucursal de la consulta.
- [ ] El mismo descuento ocurre al crear una consulta **desde el expediente del paciente** y al crear una consulta **de onicomicosis** desde tratamientos.
- [ ] Cada descuento genera una fila en `inventory.kardex` con `id_movement = 5`, `quantity` positiva, `id_consulta` igual a la consulta creada, `id_user` igual al podólogo y `balance_after` coherente con el nuevo stock.
- [ ] **Editar** una consulta existente (guardar de nuevo desde el expediente) no genera ningún movimiento adicional.
- [ ] Un producto marcado como consumo automático pero con `activo = 0`, `status = 0` o de otra empresa no se descuenta.
- [ ] Si la sucursal no tiene stock del producto, el descuento se aplica igual y el stock queda negativo, sin bloquear la creación de la consulta.
- [ ] Si el descuento falla por un error de BD, la consulta queda creada y el usuario no ve error; el fallo aparece en el log del servidor.
- [ ] Si ningún producto tiene `auto_consume = 1`, crear una consulta no genera filas en kardex ni cambios en stock.
- [ ] Cancelar (`cancelada = 1`) o borrar (`deleted_at`) una consulta no revierte ni altera los movimientos ya generados.
- [ ] Los flujos de recepciones y pedidos siguen funcionando sin cambios, y sus filas de kardex quedan con `id_consulta = NULL`.
- [ ] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Se reutiliza el movimiento 5 "Salida por consulta" (SXC) ya existente en `inventory.movements`.** No se crea un movimiento nuevo: ese registro ya fue sembrado con la descripción exacta de este caso ("Descuenta producto automaticamente al realizar una consulta") y con `increases_storage = 0`, así que el signo del movimiento ya está bien definido.
- **Sí se implementa el descuento real, no solo la marca en el catálogo.** Se descartó partir el spec en "catálogo" + "descuento" porque un campo sin consumidor queda muerto en BD — riesgo ya materializado con `sale_price` (spec 12) y documentado ahí.
- **El descuento ocurre al crear la consulta, no al cerrarla ni al cobrarla.** Es el único momento común a los tres puntos de creación (`crearConsultaDesdeCita`, `saveConsulta`, `createConsultaOnicomicosis`), y refleja la realidad clínica: el cubrebocas y los guantes se abren al iniciar la atención, no al terminarla.
- **Dos columnas (`auto_consume` + `consumption_per_consultation`) en vez de una sola columna nullable.** Se descartó usar `NULL`/`0` como "no aplica" porque un `0` mal capturado sería indistinguible de una desactivación deliberada; el checkbox hace explícita la intención, igual que `split`.
- **Cantidad global del producto, no por sucursal.** Es una regla de protocolo clínico (un cubrebocas por consulta, en cualquier clínica), no un parámetro operativo de sucursal. Se descartó una columna en `inventory.stock` porque habría necesitado UI propia y ya vimos en spec 11 que los overrides por sucursal sin formulario terminan siendo `NULL` para siempre.
- **Aplica a cualquier categoría, sin condicionar el checkbox.** Se descartó limitarlo a Consumibles/Instrumental/Medicamentos porque no hay garantía de que la clasificación del catálogo esté completa, y una restricción por categoría convierte un error de captura de categoría en un insumo que deja de descontarse en silencio.
- **`id_consulta` como columna nueva en `kardex`, no una referencia en `notes`.** Sigue el patrón que ya estableció `id_reception` (spec 09) y es la única forma de responder con un `WHERE` la pregunta "qué se consumió en esta consulta". Una cadena en `notes` no es consultable de forma confiable.
- **Best-effort: si el descuento falla, la consulta se crea igual.** Se descartó envolver consulta y descuento en una sola transacción porque haría que un problema de inventario impidiera registrar una atención clínica ya ocurrida. El registro clínico es el dato crítico; el inventario es corregible después con un ajuste manual (movimientos 7/8).
- **Se permite stock negativo.** Misma razón: el kardex debe reflejar lo que realmente se consumió, aunque el stock estuviera mal capturado. Se descartó "descontar hasta 0" porque enmascara el faltante y rompe la reconstrucción del saldo desde el kardex.
- **El consumo no se revierte al cancelar una consulta.** El material desechable ya se abrió; devolverlo al stock sería registrar existencia que no existe. Se descartó el movimiento de reversa por esta razón, no por costo de implementación.
- **Solo se descuenta en el `INSERT`, nunca en el `UPDATE`.** `saveConsulta` sirve para ambos casos; sin esta distinción, cada guardado de cambios en el expediente descontaría insumos otra vez.
- **Se filtra por `activo = 1` y `status = 1`.** Un producto dado de baja no debe seguir descontándose; desmarcar `activo` es la vía natural para dejar de consumir un insumo descontinuado sin tener que editar su configuración de consumo.
- **Función propia en `lib/inventory/consultationConsumption.ts`, no lógica repetida en los tres server actions.** Hay tres consumidores desde el día uno, que es exactamente el umbral que en spec 11 se consideró insuficiente para extraer un helper — aquí sí se cumple.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| **Consultas creadas por error inflan el consumo.** Cada consulta creada por equivocación descuenta insumos que nunca se usaron, y como no hay reversa el faltante se acumula en silencio. | Ninguna automática. Se corrige con ajustes manuales (movimientos 7/8) y se detecta al comparar stock físico contra sistema. Documentado como consecuencia aceptada de "no revertir". |
| **Fallo silencioso del descuento.** Al ser best-effort, un error de BD no llega al usuario: la consulta se guarda y nadie se entera de que el stock no bajó. | El error queda en `console.error` del servidor. No hay alerta en UI — asumido deliberadamente para no interrumpir la atención clínica. |
| **Stock negativo acumulado.** Al permitir saldos negativos, una sucursal con catálogo mal cargado puede terminar con existencias negativas grandes que distorsionan los sugeridos de pedido (spec 09/11). | El saldo negativo es visible en `/dashboard/pedidos/nuevo` y en el kardex; se corrige con entrada por ajuste. Es el síntoma correcto de un dato mal capturado, no un error del cálculo. |
| **Productos marcados sin querer.** Marcar `auto_consume` en un producto caro (instrumental, medicamento) lo descuenta en **cada** consulta de **todas** las sucursales, sin aviso. | La edición está restringida a roles 1 y 4, y la columna "Consumo/consulta" en el listado permite auditar de un vistazo qué productos están marcados. |
| **`id_stock_unit_measurement` sin capturar.** Si el producto no tiene unidad de stock definida, el kardex graba `NULL` en `id_unit_measurement` y la fila queda sin unidad legible. | No bloquea el descuento (el `quantity` sigue siendo correcto en unidades de stock). El campo ya venía sin UI en Productos desde spec 09 — deuda heredada, no introducida aquí. |
| **Doble descuento si a futuro se agrega un cuarto punto de creación de consultas.** El enganche está replicado manualmente en tres server actions; un flujo nuevo que olvide llamarlo simplemente no descontará, y uno que la llame dos veces descontará doble. | La lógica vive en una sola función (`applyConsultationConsumption`); cualquier flujo nuevo debe llamarla exactamente una vez, justo después del `INSERT` de la consulta. |

## Lo que **no** entra en este spec

- Cantidades de consumo distintas por sucursal.
- Reversa del consumo al cancelar o borrar una consulta.
- Cantidad variable según tipo de consulta, tratamiento o servicio aplicado.
- Pantalla de "insumos consumidos en esta consulta" (el dato existe en `kardex.id_consulta`, pero no se muestra).
- Alertas o bloqueos por stock insuficiente.
- Cualquier relación con `dbo.consulta_productos` (productos cobrados al paciente).

Cada uno de ellos, si llega, va en su propio spec.
