# 47 — Carrito de pedidos independiente por sucursal

## Header

- **Estado:** Implementado
- **Depende de:** ninguna spec previa relevante (usa `PurchaseCartContext` y `SucursalContext` ya existentes)
- **Modifica base de datos:** No
- **Fecha:** 2026-09-10
- **Objetivo:** Hacer que el carrito de pedido (`PurchaseCartContext`) guarde sus líneas y datos asociados (fecha estimada, notas, método de pago y envío por proveedor) de forma independiente por sucursal, en vez de un único carrito global compartido entre todas.

## Alcance

**Incluye:**

- **`contexts/PurchaseCartContext.tsx`**: el provider pasa a leer `selectedId` de `useSucursal()` internamente y a mantener el estado del carrito (`lines`, `estimatedDate`, `notes`, `paymentMethodBySupplier`, `shippingCostBySupplier`) **por `id_sucursal`**. Todos los métodos expuestos hoy (`toggleProduct`, `setLineQuantity`, `setLineUnitPrice`, `setLineSupplier`, `setLineAppliesIva`, `removeLine`, `replaceLines`, `setEstimatedDate`, `setNotes`, `setSupplierPaymentMethod`, `setSupplierShippingCost`, `clearCart`, `isProductInCart`) mantienen su misma firma pública, pero internamente leen/escriben sobre el carrito de la sucursal actualmente seleccionada.
- **Persistencia en `sessionStorage`**: se guarda un único blob bajo la misma clave (`purchaseCart`), pero con forma `{ [id_sucursal]: { lines, estimatedDate, notes, paymentMethodBySupplier, shippingCostBySupplier } }`, de modo que cambiar de sucursal y volver conserva lo que ya se había marcado en cada una.
- **`clearCart()`** (llamado tras generar una orden) solo limpia el carrito de la sucursal actualmente seleccionada; los carritos de otras sucursales no se ven afectados.
- **`OrderTemplatesTab` / `SaveCartAsTemplateModal`**: sin cambios de código — al llamar `replaceLines`, seguirán operando sobre "el carrito actual", que ahora es automáticamente el de la sucursal seleccionada gracias al cambio en el contexto.
- **Consumidores existentes** (`pedidos/nuevo/page.tsx`, `SuggestedProductsTable.tsx`, `pedidos/nuevo/revision/page.tsx`, `SupplierOrderGroup.tsx`, `PurchaseCartSummary.tsx`) — **sin cambios**, ya que siguen usando `usePurchaseCart()` con la misma API; simplemente ahora `lines` refleja el carrito de la sucursal activa.

**No incluye:**

- Cambios a `app/dashboard/pedidos/nuevo/page.tsx` ni `SuggestedProductsTable.tsx` más allá de lo que ya está en curso (el diff sin commitear de ordenar productos con check arriba) — esta spec no lo toca.
- Migración de datos del formato viejo de `sessionStorage` (`{ lines, estimatedDate, ... }` plano) al nuevo formato por sucursal — al ser `sessionStorage` (se borra al cerrar pestaña/sesión) y una feature en desarrollo activo, no hay carritos "viejos" que preservar; si el JSON no matchea la forma nueva, simplemente se ignora y arranca vacío (mismo comportamiento de manejo de errores que ya existe hoy).
- Advertencias o confirmaciones al cambiar de sucursal con un carrito activo — el comportamiento elegido es que cada sucursal simplemente tenga su propio carrito silenciosamente, sin modales de aviso.
- Persistencia entre sesiones de navegador (seguirá siendo `sessionStorage`, no `localStorage` ni base de datos) — fuera de alcance cambiar el mecanismo de persistencia.
- Comportamiento de `/dashboard/pedidos/nuevo/revision` cuando el usuario cambia de sucursal *estando en esa pantalla* más allá del guard que ya existe hoy (si `lines.length === 0` redirige a `/dashboard/pedidos/nuevo`) — al cambiar de sucursal en revisión, ese guard ya se dispara si la nueva sucursal no tiene carrito, comportamiento que se considera aceptable y no requiere lógica nueva.

## Modelo de datos

No se introducen interfaces ni tipos nuevos exportados — se reutiliza `IPurchaseCartLine` tal cual existe hoy. Solo cambia la forma interna del estado y de lo persistido en `sessionStorage`.

```ts
// contexts/PurchaseCartContext.tsx

/** Estado del carrito de una sola sucursal (mismos campos que hoy, antes planos en el contexto). */
interface IPurchaseCartState {
  lines:                   IPurchaseCartLine[];
  estimatedDate:           string;
  notes:                   string;
  paymentMethodBySupplier: Record<number, number>;
  shippingCostBySupplier:  Record<number, number>;
}

// Estado interno del provider: un carrito por id_sucursal.
// (no se expone como tipo público; PurchaseCartContextType conserva su forma actual)
type PurchaseCartBySucursal = Record<number, IPurchaseCartState>;

const EMPTY_CART_STATE: IPurchaseCartState = {
  lines: [],
  estimatedDate: "",
  notes: "",
  paymentMethodBySupplier: {},
  shippingCostBySupplier: {},
};
```

- `PurchaseCartProvider` guarda `const [cartsBySucursal, setCartsBySucursal] = useState<PurchaseCartBySucursal>({})` en vez de los 5 `useState` planos actuales.
- `const { selectedId } = useSucursal();` dentro del provider para saber qué carrito exponer.
- `const currentCart = (selectedId != null ? cartsBySucursal[selectedId] : undefined) ?? EMPTY_CART_STATE;` — el valor expuesto por el contexto (`lines`, `estimatedDate`, etc.) sale de `currentCart`.
- Todos los setters (`toggleProduct`, `setEstimatedDate`, `clearCart`, etc.) actualizan `cartsBySucursal` inmutablemente en la clave `selectedId`, dejando las demás sucursales intactas. Si `selectedId` es `null`/`undefined` (aún no hay sucursal seleccionada), los setters no hacen nada (no hay dónde escribir) — mismo caso borde que hoy no se maneja explícitamente pero que no debería ocurrir en la práctica porque `SucursalContext` siempre fuerza una sucursal.
- `sessionStorage` sigue usando la clave `"purchaseCart"`, pero el valor serializado pasa de ser el carrito plano a ser `cartsBySucursal` completo (`PurchaseCartBySucursal`). Al leer al montar, si el JSON no tiene la forma esperada (por ejemplo `.lines` en la raíz, formato viejo), se ignora y arranca con `{}` — mismo `try/catch` que ya existe.

## Plan de implementación

1. **`contexts/PurchaseCartContext.tsx`**: reestructurar el estado interno.
   - Importar `useSucursal` de `@/contexts/SucursalContext`.
   - Reemplazar los 5 `useState` planos (`lines`, `estimatedDate`, `notes`, `paymentMethodBySucursal`, `shippingCostBySupplier`) por un único `useState<PurchaseCartBySucursal>({})` (`cartsBySucursal`).
   - Definir `EMPTY_CART_STATE` y derivar `currentCart` a partir de `cartsBySucursal[selectedId]` (con fallback a `EMPTY_CART_STATE`).
   - Agregar un helper interno `updateCurrentCart(updater: (cart: IPurchaseCartState) => IPurchaseCartState)` que, si `selectedId != null`, hace `setCartsBySucursal(current => ({ ...current, [selectedId]: updater(current[selectedId] ?? EMPTY_CART_STATE) }))`; si `selectedId == null`, no hace nada.
   - Reescribir `isProductInCart`, `toggleProduct`, `setLineQuantity`, `setLineUnitPrice`, `setLineSupplier`, `setLineAppliesIva`, `removeLine`, `replaceLines`, `setEstimatedDate`, `setNotes`, `setSupplierPaymentMethod`, `setSupplierShippingCost` para usar `currentCart`/`updateCurrentCart` en vez de los setters planos de antes.
   - `clearCart()` usa `updateCurrentCart(() => EMPTY_CART_STATE)` (solo resetea la sucursal actual) y, además, borra del objeto persistido en `sessionStorage` solo la entrada de `selectedId` (no todo `cartsBySucursal`) — igual criterio que en memoria.
   - El `useEffect` de hidratación inicial (`sessionStorage.getItem`) ahora parsea directo a `cartsBySucursal` (con `try/catch` que cae a `{}` si el formato no matchea).
   - El `useEffect` de persistencia serializa `cartsBySucursal` completo cada vez que cambia.
   - El valor expuesto por el `Provider` (`lines`, `estimatedDate`, `notes`, `paymentMethodBySupplier`, `shippingCostBySupplier`) sale de `currentCart`, sin cambiar la forma de `PurchaseCartContextType`.

   *Verificación:* `npm run build` sin errores de TypeScript; ningún archivo consumidor (`pedidos/nuevo/page.tsx`, `SuggestedProductsTable.tsx`, `revision/page.tsx`, `SupplierOrderGroup.tsx`, `PurchaseCartSummary.tsx`, `OrderTemplatesTab.tsx`, `SaveCartAsTemplateModal.tsx`) necesita cambios, porque la API pública de `usePurchaseCart()` no cambia de forma.

2. **Verificación manual end-to-end**:
   - Con la sucursal A seleccionada, marcar 2-3 productos en `/dashboard/pedidos/nuevo`, ajustar cantidad/proveedor de alguno.
   - Cambiar a sucursal B (selector global): la tabla y `PurchaseCartSummary` deben mostrar carrito vacío (o el que ya existiera para B).
   - Marcar productos distintos en sucursal B.
   - Volver a sucursal A: deben reaparecer exactamente los productos y ajustes marcados en el paso 1, sin mezclarse con los de B.
   - Generar la orden de compra para sucursal A (`/revision` → "Generar Orden de Compra"): tras crearla, el carrito de A queda vacío, pero el de B (si aún no se ha generado su orden) permanece intacto.
   - Cargar una plantilla de pedido en sucursal B: reemplaza solo el carrito de B.

3. `npm run build` sin errores de TypeScript ni warnings nuevos.

Cada paso deja el sistema funcional y compilando.

## Criterios de aceptación

- [x] Marcar productos en la sucursal A y cambiar a la sucursal B muestra el carrito de B (vacío si nunca se tocó), no los productos marcados en A.
- [x] Volver de la sucursal B a la sucursal A restaura exactamente las líneas, cantidades, proveedor e IVA que se habían marcado antes en A.
- [x] `estimatedDate`, `notes`, `paymentMethodBySupplier` y `shippingCostBySupplier` capturados para una sucursal no se mezclan ni se pierden al cambiar a otra sucursal y volver.
- [x] Generar una orden de compra (`clearCart()`) vacía únicamente el carrito de la sucursal activa en ese momento; el carrito de cualquier otra sucursal con productos marcados permanece intacto.
- [x] Cargar una plantilla de pedido (`OrderTemplatesTab`) reemplaza el carrito de la sucursal actualmente seleccionada, sin afectar el carrito de otras sucursales.
- [x] Cerrar y reabrir la pestaña (dentro de la misma sesión de `sessionStorage`) conserva los carritos de todas las sucursales que se hayan tocado, cada uno con sus propios productos.
- [x] `usePurchaseCart()` mantiene su misma firma pública (`lines`, `estimatedDate`, `notes`, `paymentMethodBySupplier`, `shippingCostBySupplier`, `isHydrated`, y todos los métodos) — ningún componente consumidor requiere cambios de código.
- [x] `npm run build` compila sin errores ni warnings nuevos.

## Decisiones tomadas y descartadas

- **Carrito independiente por sucursal, sin aviso/confirmación al cambiar.** Decisión del usuario: cada sucursal simplemente tiene su propio carrito silencioso; se descartó la alternativa de un único carrito global con un modal de confirmación al cambiar de sucursal, por ser más fricción para un flujo que ya es frecuente (cambiar de sucursal para revisar varias a la vez).
- **Todos los campos del carrito por sucursal (líneas, fecha estimada, notas, método de pago y envío por proveedor), no solo las líneas.** Consistente con que cada sucursal arma su propia orden de principio a fin; separar solo las líneas habría dejado fecha/notas/pago compartidos de forma confusa entre sucursales con carritos distintos.
- **Persistencia bajo una sola clave `sessionStorage` (`"purchaseCart"`) con forma `{ [id_sucursal]: IPurchaseCartState }`, en vez de una clave por sucursal (`purchaseCart_<id>`).** Simplifica la lectura/escritura a un solo `getItem`/`setItem` y evita tener que enumerar claves de `sessionStorage` para limpiar remanentes; el costo (reserializar todas las sucursales en cada cambio) es despreciable dado el tamaño típico de un carrito de pedido.
- **Sin migración del formato viejo de `sessionStorage`.** Al ser `sessionStorage` (efímero, se pierde al cerrar la pestaña) y una feature en desarrollo activo sin usuarios dependiendo de carritos históricos, se decidió que un JSON con la forma vieja simplemente se ignore y arranque vacío, igual que cualquier otro formato inválido ya contemplado por el `try/catch` existente.
- **API pública de `usePurchaseCart()` sin cambios de firma.** Se decidió resolver todo el "scoping" por sucursal dentro del provider (leyendo `useSucursal()` internamente) para no tener que tocar los 7 componentes consumidores existentes — minimiza el diff y el riesgo de regresión en pantallas ya funcionando.
- **Plantillas de pedido (`replaceLines`) aplican a la sucursal activa, sin cambios propios de código.** Como `replaceLines` ya opera sobre "el carrito actual" expuesto por el contexto, automáticamente queda scoped a la sucursal seleccionada sin tocar `OrderTemplatesTab.tsx` ni `SaveCartAsTemplateModal.tsx`.
- **Sin cambios al mecanismo de persistencia (sigue siendo `sessionStorage`, no `localStorage` ni base de datos).** Fuera del problema reportado; cambiar de mecanismo de persistencia es una decisión aparte con implicaciones distintas (persistir entre sesiones/dispositivos) que no se pidió aquí.
