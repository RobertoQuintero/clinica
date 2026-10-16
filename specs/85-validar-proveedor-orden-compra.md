# 85 — Validar el proveedor al crear la orden de compra

## Header

- **Estado:** Implementado
- **Depende de:**
  - 09 (`pedidos-compra-recepcion`): `createPurchaseOrders` y la pantalla de revisión.
  - 47 (`carrito-pedidos-por-sucursal`): `PurchaseCartContext` guarda `id_supplier` por línea en `sessionStorage`.
- **Modifica base de datos:** Sí, pero solo los datos. Un `UPDATE` pone `id_supplier = NULL` en los productos de `inventory.Products` cuyo proveedor no existe. El esquema no cambia.
- **Fecha:** 2026-10-15
- **Objetivo:** Impedir que se cree una orden de compra con un proveedor que no existe, está eliminado o inactivo, o es de otra empresa. Se valida en `createPurchaseOrders` y en la pantalla de revisión. Además, se limpia el `id_supplier` del producto 26 y de los otros 32 productos que apuntan a proveedores inexistentes.

### Contexto (diagnóstico del 2026-10-15, base de desarrollo de `.env.local`)

- `createPurchaseOrders` (`app/dashboard/pedidos/actions.ts`) solo revisa que `id_supplier` no sea `null`. No revisa que el proveedor exista, que sea de la empresa ni que esté activo.
- En `inventory.proveedores` solo hay 4 proveedores (1 Dermoinsumos MX Test, 2 Walmart, 3 Mercado libre, 4 Amazon). En cambio, **33 productos** apuntan a `id_supplier` del 5 al 11, que no existen. Entre ellos está el producto 26 ("Agua Oxigenada"), con `id_supplier = 6`.
- La falla ya pasó: **PO-2026-0028** se creó con `id_supplier = 6` y una línea del producto 26. Después se canceló (`id_status = 5`) y no tiene recepciones.
- En la revisión, el `<select>` de proveedor no tiene ninguna opción con el 6. Por eso la línea muestra "Sin proveedor", pero el estado guarda un 6. El grupo sale como "Proveedor sin nombre" y el botón "Generar Orden" queda habilitado.

## Alcance

**Entra:**

- **`app/dashboard/pedidos/actions.ts` → `createPurchaseOrders`:** dentro de la transacción, junto a la validación de productos que ya existe, se agrega un `SELECT … IN (…)` sobre `inventory.proveedores` con los `id_supplier` distintos de las líneas. Cada uno debe cumplir cuatro cosas:
  - que exista;
  - `status = 1`;
  - `activo = 1`;
  - `id_empresa` igual al del usuario.

  Si alguno falla, la transacción se aborta y no se inserta nada. El mensaje nombra los productos afectados: *"El proveedor asignado a «Agua Oxigenada» no existe o está inactivo. Asigna otro proveedor y vuelve a intentar."* Si hay varios, los nombres se separan con comas.
- **`app/dashboard/pedidos/nuevo/revision/page.tsx`:**
  - La lista de proveedores de la revisión se filtra a `activo = true`. `getSuppliers()` ya excluye los eliminados.
  - Una vez cargada la lista, una línea cuyo `id_supplier` no está en ella se trata como **"Sin proveedor"**:
    - se agrupa en `sin-proveedor`;
    - no cuenta para método de pago ni envío;
    - bloquea "Generar Orden de Compra", igual que una línea con `null`.
  - Esto se calcula al renderizar. El carrito en `sessionStorage` no se reescribe, y la línea se corrige al elegir otro proveedor en el `<select>`.
- **`SupplierOrderGroup.tsx`:** recibe la lista ya filtrada, así que el `<select>` solo ofrece proveedores activos.
- **Datos:** un `UPDATE` pone `id_supplier = NULL` en todo producto de `inventory.Products` cuyo `id_supplier` no corresponde a ningún proveedor existente de su empresa. El filtro va por esa condición, no por IDs fijos. En la base de hoy son 33 productos, entre ellos el 26 ("Agua Oxigenada"). El SQL va en la spec y en `queries.txt`, y lo corre el usuario a mano.

**Fuera de alcance (para otras specs):**

- Validar el proveedor al **guardar un producto** (`productos/actions.ts`) o una **plantilla de pedido** (`createPurchaseOrderTemplate` / `updatePurchaseOrderTemplate`).
- **Impedir que se borre un proveedor que tiene productos asignados.** Es la causa probable de los huérfanos.
- Recrear los proveedores 5–11 o averiguar por qué faltan.
- Corregir **PO-2026-0028**, que ya está cancelada y no tiene recepciones, o cualquier otra orden histórica.
- Cambiar `getSuppliers()`, porque la usan otras pantallas.
- Las pantallas `/dashboard/pedidos/nuevo` (sugeridos y todos los productos), el filtro de proveedor de esas tablas, las plantillas y el historial de pedidos.
- Correr el `UPDATE` en producción. No se ha revisado esa base. Como el `WHERE` filtra por condición, el mismo script sirve ahí si algún día se necesita.

## Modelo de datos

Esta spec **no agrega tablas, columnas, interfaces ni tipos exportados**. Usa `inventory.proveedores`, `inventory.Products` e `ISupplier` como están. Solo agrega una consulta de validación, un `UPDATE` de datos y valores que la revisión calcula al renderizar.

**1. Validación en `createPurchaseOrders`**, dentro de `db.transaction`, después de validar productos:

```sql
SELECT [id_proveedor]
  FROM [CentroPodologico].[inventory].[proveedores]
 WHERE [id_empresa] = @id_empresa
   AND [status] = 1
   AND [activo] = 1
   AND [id_proveedor] IN (@id_supplier_0, @id_supplier_1, …)
```

- Los placeholders se arman igual que `productPlaceholders`, con un parámetro por cada `id_supplier` distinto en las líneas.
- Si un `id_supplier` no vuelve en el resultado, sus líneas son inválidas. El mensaje toma el nombre de `productById`, es decir, el de la BD y no el que mandó el cliente:

```ts
throw new Error(
  `El proveedor asignado a ${productNames} no existe o está inactivo. Asigna otro proveedor y vuelve a intentar.`
);
// productNames = "«Agua Oxigenada», «Alcohol (Desnaturalizado)»"
```

**2. Valores calculados en `revision/page.tsx`** (nombres en inglés, según `CLAUDE.md`):

```ts
// null = todavía no se carga; así no se marcan líneas como inválidas mientras llega la respuesta
const [suppliers, setSuppliers] = useState<ISupplier[] | null>(null);

const activeSuppliers = useMemo(
  () => (suppliers ?? []).filter((supplier) => supplier.activo),
  [suppliers]
);
const validSupplierIds = useMemo(
  () => new Set(activeSuppliers.map((supplier) => supplier.id_proveedor)),
  [activeSuppliers]
);

/** id_supplier que cuenta para agrupar y validar: null si la línea no tiene proveedor
 *  o si, ya cargada la lista, su proveedor no está entre los activos. */
const getEffectiveSupplierId = (line: IPurchaseCartLine): number | null =>
  line.id_supplier !== null && (suppliers === null || validSupplierIds.has(line.id_supplier))
    ? line.id_supplier
    : null;
```

- `groupedBySupplier`, `hasLineWithoutSupplier`, `hasSupplierWithoutPaymentMethod` y `shipping` usan `getEffectiveSupplierId(line)` en vez de `line.id_supplier`.
- `SupplierOrderGroup` recibe `activeSuppliers` y no la lista completa.

**3. `UPDATE` de datos.** Va en la spec y al final de `queries.txt`, y se corre a mano. Primero el `SELECT` de vista previa, luego el `UPDATE` con el mismo `WHERE`:

```sql
-- Spec 85: productos cuyo id_supplier no existe en proveedores de su empresa
SELECT p.[id_product], p.[name], p.[id_supplier]
  FROM [CentroPodologico].[inventory].[Products] p
 WHERE p.[id_supplier] IS NOT NULL
   AND NOT EXISTS (
         SELECT 1
           FROM [CentroPodologico].[inventory].[proveedores] s
          WHERE s.[id_proveedor] = p.[id_supplier]
            AND s.[id_empresa]   = p.[id_empresa]
       );

UPDATE p
   SET p.[id_supplier] = NULL
  FROM [CentroPodologico].[inventory].[Products] p
 WHERE p.[id_supplier] IS NOT NULL
   AND NOT EXISTS (
         SELECT 1
           FROM [CentroPodologico].[inventory].[proveedores] s
          WHERE s.[id_proveedor] = p.[id_supplier]
            AND s.[id_empresa]   = p.[id_empresa]
       );
```

- El `UPDATE` solo toca proveedores que **no existen**. Un producto que apunta a un proveedor eliminado (`status = 0`) o inactivo conserva su `id_supplier`. Esos casos los atrapa la validación (puntos 1 y 2) en el momento de pedir. Hoy no hay ninguno, porque los 4 proveedores están activos.
- En la base de desarrollo de hoy, el `SELECT` devuelve 33 filas, entre ellas la del producto 26.

## Plan de implementación

El orden importa. Los pasos 1 y 2 se prueban con el producto 26 todavía apuntando al proveedor 6, así que el `UPDATE` va al final.

1. **Validación en el servidor (`app/dashboard/pedidos/actions.ts` → `createPurchaseOrders`).**
   - Dentro de `db.transaction`, después del bucle que valida `productById`, sacar `supplierIdsWithLines`, que ya existe arriba.
   - Armar los placeholders `@id_supplier_N` con el mismo patrón que `productPlaceholders` y correr el `SELECT` del Modelo de datos (punto 1).
   - Guardar los IDs válidos en un `Set`. Las líneas cuyo `id_supplier` no esté ahí se juntan y se sacan sus nombres de `productById`, sin repetir.
   - Si hay alguna, `throw new Error(...)` con el mensaje acordado. El `catch` que ya existe lo devuelve como `{ ok: false, message }` y la transacción se revierte.
   - Actualizar el JSDoc de la función: ahora valida productos **y proveedores** contra la BD.
   - *Verificación:*
     - poner el producto 26 en el carrito de una sucursal;
     - ir a revisión. Todavía sin el paso 2, la línea queda en el grupo "Proveedor sin nombre" y el botón sigue habilitado;
     - asignar un método de pago al grupo y generar la orden;
     - debe salir en rojo *"El proveedor asignado a «Agua Oxigenada» no existe o está inactivo…"*, y en `inventory.purchase_orders` no debe aparecer ningún folio nuevo.

2. **Validación en la revisión (`app/dashboard/pedidos/nuevo/revision/page.tsx`).**
   - Cambiar `suppliers` a `useState<ISupplier[] | null>(null)`.
   - Agregar `activeSuppliers`, `validSupplierIds` y `getEffectiveSupplierId`, como en el Modelo de datos (punto 2).
   - En `groupedBySupplier`, `hasLineWithoutSupplier`, `hasSupplierWithoutPaymentMethod` y `shipping`, usar `getEffectiveSupplierId(line)` en vez de `line.id_supplier`.
   - `supplierNameById` se arma con `activeSuppliers`.
   - Pasar `activeSuppliers` a `SupplierOrderGroup` en lugar de `suppliers`. `SupplierOrderGroup.tsx` no cambia de firma, porque sigue recibiendo `ISupplier[]`.
   - `handleGenerateOrder` sigue mandando `line.id_supplier` tal cual. El botón ya está bloqueado cuando hay líneas sin proveedor efectivo, y el paso 1 cubre lo demás.
   - *Verificación:* con el producto 26 en el carrito, abrir revisión:
     - la línea aparece en el grupo "Sin proveedor" y el botón "Generar Orden de Compra" está deshabilitado;
     - al elegir Walmart en el `<select>`, la línea se mueve al grupo de Walmart y el botón se habilita en cuanto el grupo tiene método de pago;
     - generar la orden funciona y crea un folio con `id_supplier = 2`. Después se cancela desde el historial.

3. **Corrección de datos (`queries.txt`).**
   - Agregar al final de `queries.txt` el bloque `SELECT` + `UPDATE` del Modelo de datos (punto 3), con el comentario de la spec.
   - El usuario corre primero el `SELECT` en la base de desarrollo y confirma que salen 33 filas, entre ellas el producto 26 con `id_supplier = 6`. Luego corre el `UPDATE`.
   - *Verificación:*
     - al volver a correr el `SELECT`, sale vacío;
     - `SELECT id_supplier FROM inventory.Products WHERE id_product = 26` devuelve `NULL`;
     - en `/dashboard/pedidos/nuevo`, al marcar el producto 26 en un carrito **nuevo**, la línea llega a revisión como "Sin proveedor".

4. **Cierre.**
   - `npx eslint app/dashboard/pedidos/actions.ts app/dashboard/pedidos/nuevo/revision/page.tsx` sin errores.
   - `npx tsc --noEmit` sin errores nuevos.
   - Marcar los criterios de aceptación.

Cada paso deja el sistema funcionando y se puede commitear por separado. El paso 1 ya cierra el hueco del lado del servidor, el 2 mejora la experiencia y el 3 corrige los datos.

## Criterios de aceptación

**Servidor (`createPurchaseOrders`):**

- [x] Si se genera una orden con una línea cuyo `id_supplier` no existe en `inventory.proveedores`, devuelve `{ ok: false }` con el mensaje *"El proveedor asignado a «<producto>» no existe o está inactivo. Asigna otro proveedor y vuelve a intentar."*
- [ ] Se rechaza igual si el proveedor existe pero tiene `status = 0`, `activo = 0` o es de otro `id_empresa`.
- [ ] Si varias líneas tienen proveedor inválido, el mensaje nombra todos esos productos, separados por comas y sin repetir.
- [ ] Cuando se rechaza, no se inserta ninguna fila en `inventory.purchase_orders` ni en `inventory.purchase_order_items`, aunque otras líneas del carrito sí tengan un proveedor válido.
- [x] Una orden con todos sus proveedores activos y de la empresa se sigue creando como antes: un folio por proveedor, mismo `id_batch` y los mismos totales.

**Revisión (`/dashboard/pedidos/nuevo/revision`):**

- [x] Una línea con un `id_supplier` que no está entre los proveedores activos aparece en el grupo "Sin proveedor", no en uno llamado "Proveedor sin nombre".
- [x] Con esa línea en el carrito, el botón "Generar Orden de Compra" está deshabilitado.
- [x] El `<select>` de proveedor solo ofrece proveedores con `activo = 1` que no estén eliminados.
- [x] Al elegir un proveedor válido en esa línea, se mueve a su grupo, y el botón se habilita en cuanto todos los grupos tienen método de pago.
- [ ] Mientras carga la lista de proveedores, ninguna línea con proveedor se marca como "Sin proveedor" ni salta de grupo.
- [ ] El subtotal, el IVA y el total no cambian por mover una línea a "Sin proveedor". El envío de ese grupo deja de sumarse.

**Datos:**

- [x] `queries.txt` tiene al final el bloque `SELECT` + `UPDATE` de la spec 85.
- [x] Después de correr el `UPDATE` en la base de desarrollo, el `SELECT` de vista previa no devuelve filas.
- [x] El producto 26 ("Agua Oxigenada") tiene `id_supplier = NULL`.
- [ ] PO-2026-0028 no cambia: sigue con `id_supplier = 6` e `id_status = 5`.

**Sin cambios fuera de alcance:**

- [x] El diff no toca `getSuppliers()`, `app/dashboard/productos/actions.ts`, las funciones de plantillas de `pedidos/actions.ts` ni `contexts/PurchaseCartContext.tsx`.
- [x] `npx eslint` sobre los archivos tocados no reporta errores.
- [x] `npx tsc --noEmit` no reporta errores nuevos.

## Decisiones

**Tomadas:**

- **Se valida en el servidor y también en la revisión.** El servidor es la protección real: la action la puede llamar cualquier cliente, y el carrito en `sessionStorage` puede traer un `id_supplier` viejo. La revisión evita que el usuario se entere del problema hasta presionar el botón, y muestra la línea donde corresponde ("Sin proveedor") en vez de un grupo "Proveedor sin nombre".
- **Proveedor válido = existe, `status = 1`, `activo = 1` y es del mismo `id_empresa`.** Un proveedor eliminado o desactivado no debería recibir órdenes nuevas. El filtro por empresa evita que un ID ajeno pase solo porque existe.
- **Un proveedor inválido aborta toda la orden, no solo su grupo.** Así el comportamiento coincide con la validación de productos que ya existe, y el usuario no termina con folios a medias de un mismo carrito.
- **El mensaje nombra productos, no IDs de proveedor.** El usuario corrige la línea del producto. Un ID de proveedor que no existe no le dice nada.
- **En la revisión, el proveedor efectivo se calcula al renderizar, sin reescribir el carrito.** No se agrega un `useEffect` que modifique el estado (va en la línea de las specs 81 y 82). El carrito solo se corrige cuando el usuario elige otro proveedor.
- **`suppliers` arranca en `null`.** Así ninguna línea se marca como inválida mientras llega la respuesta de `getSuppliers()`.
- **El `<select>` de revisión se filtra a activos en la página y `getSuppliers()` no se toca.** La usan otras pantallas, como el listado de proveedores, que sí deben mostrar los inactivos.
- **Los 33 productos huérfanos quedan en `NULL`, incluido el 26.** Los proveedores 5–11 no existen y no hay a quién reasignarlos con certeza. Con `NULL`, el proveedor se elige a mano en la revisión. Si algún huérfano se quedaba apuntando a un ID inexistente, volvería a fallar en cuanto alguien lo pidiera.
- **El `UPDATE` filtra con `NOT EXISTS`, no con una lista de IDs.** Se puede volver a correr y sirve en cualquier base sin pisar asignaciones válidas. La base de `.env.local` no es producción.
- **El SQL se corre a mano y se documenta en `queries.txt`.** No hay herramienta de migraciones, y así se sigue la convención del repo.
- **PO-2026-0028 no se toca.** Está cancelada y no tiene recepciones, así que cambiarla solo reescribiría el historial.
- **El número 85 y no el 84.** Las specs 82 y 83 apartaron el 84 para la de effects de fetch.

**Descartadas:**

- *Validar solo en el servidor:* el usuario arma todo el pedido y se entera del error hasta el final, y la pantalla sigue mostrando "Proveedor sin nombre".
- *Validar solo en el cliente:* la action quedaría expuesta, y cualquier carrito viejo o llamada directa podría insertar órdenes huérfanas.
- *Una llave foránea `Products.id_supplier → proveedores.id_proveedor`:* cambia el esquema, y los borrados de proveedores (la causa probable) siguen siendo otra spec. Se deja para cuando se resuelva cómo se elimina un proveedor.
- *Reasignar los huérfanos a un proveedor existente (por ejemplo Walmart):* sería adivinar. Un proveedor equivocado es peor que ninguno, porque genera órdenes reales a quien no es.
- *Recrear los proveedores 5–11:* no hay datos de quiénes eran.
- *Limpiar el carrito de `sessionStorage` con un effect al detectar un proveedor inválido:* sería otro `set-state-in-effect` y borraría información sin que el usuario lo decida.
- *Rechazar solo los grupos con proveedor inválido y crear los demás:* deja el pedido partido y es confuso, porque el usuario cree que generó un pedido completo.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| **Hay carritos en `sessionStorage` que todavía guardan `id_supplier = 6` (u otro huérfano)** después de correr el `UPDATE`. | La revisión calcula el proveedor efectivo: esas líneas caen en "Sin proveedor" y bloquean el botón. Si algo llega al servidor, lo rechaza. No hace falta limpiar nada. |
| **Hay plantillas de pedido (`purchase_order_template_items`) con proveedores huérfanos.** Al cargarlas, el carrito vuelve a traer IDs inválidos. | Hoy no hay ninguna (se revisó en el diagnóstico). Si aparece alguna, se comporta igual que un carrito viejo: la revisión y el servidor la bloquean. Validar al guardar plantillas queda fuera de alcance. |
| **Se borra otro proveedor y vuelven a aparecer productos huérfanos.** | Ninguna orden nueva sale con ese proveedor, porque la validación lo impide. El `UPDATE` se puede volver a correr cuando haga falta. La causa de fondo, impedir borrar proveedores con productos, va en otra spec. |
| **Se desactiva (`activo = 0`) un proveedor que ya está en carritos abiertos.** | Las líneas pasan a "Sin proveedor" en la revisión y el usuario elige otro. Se espera que pase así. |
| **`getSuppliers()` falla o tarda.** `suppliers` se queda en `null` y no se marca ninguna línea como inválida. | El servidor valida de todas formas. En el peor caso, el usuario ve el error al generar, igual que antes de esta spec, pero sin que se cree una orden huérfana. |
| **Alguien corre el `UPDATE` en producción sin revisar.** | El `WHERE` con `NOT EXISTS` solo toca productos cuyo proveedor no existe, así que no puede pisar asignaciones válidas. Aun así, la spec pide correr primero el `SELECT` de vista previa. |

## Lo que **no** entra en esta spec

- Validar el proveedor al guardar productos o plantillas de pedido.
- Impedir que se borre un proveedor con productos asignados, o agregar una llave foránea `Products.id_supplier`.
- Recrear los proveedores 5–11, reasignar los huérfanos a un proveedor concreto o corregir órdenes históricas (PO-2026-0028).
- Cambios a `getSuppliers()`, a `PurchaseCartContext` o a las pantallas de `/dashboard/pedidos/nuevo` fuera de la revisión.
- Correr el `UPDATE` en producción.

Si alguna de estas llega a hacerse, va en su propia spec.
