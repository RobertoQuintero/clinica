# 82 — Lint: `set-state-in-effect` en portales, APIs del navegador y estado derivado

## Header

- **Estado:** Implementado
- **Depende de:** 81 (`lint-limpieza-errores-warnings`), que dejó el lint con solo 69 errores, todos `react-hooks/set-state-in-effect`. La futura spec 84 (fetch de datos en effects) parte del estado que deja esta.
- **Modifica base de datos:** No.
- **Fecha:** 2026-10-15
- **Objetivo:** Eliminar los 26 errores de `react-hooks/set-state-in-effect` que vienen de portales (`mounted`), lecturas del navegador (`matchMedia`, `localStorage`, `sessionStorage`) y estado derivado de props, usando hooks compartidos en `hooks/` y sin cambios funcionales visibles.
- **Línea base (2026-10-15):** 69 errores `react-hooks/set-state-in-effect` en 61 archivos, 0 warnings. Por patrón:
  - **A. Guarda `mounted` para `createPortal`:** 13.
  - **B. APIs del navegador al montar:** 5.
  - **C. Estado derivado de props o reset por cambio de filtro:** 8.
  - **D. Fetch con `setLoading`/`setError` síncronos:** 43. Fuera de esta spec; es la 84.

  Resultado esperado: **43 errores, todos `set-state-in-effect` y todos del patrón D**, y 0 warnings.

## Alcance

**Incluye:**

- **Carpeta nueva `hooks/`** en la raíz, con un hook por archivo, todos `"use client"`-safe y basados en `useSyncExternalStore`:
  - `hooks/useIsClient.ts`: `false` en el servidor y durante la hidratación, `true` en el cliente.
  - `hooks/useMediaQuery.ts`: `matches` de un media query, que se actualiza al cambiar.
  - `hooks/useStorageValue.ts`: lee y escribe una clave de `localStorage` o `sessionStorage`, notifica a los suscriptores y tiene un valor por defecto en el servidor.

- **Patrón A: guarda `mounted` (13).** `const [mounted, setMounted] = useState(false)` + `useEffect(() => setMounted(true), [])` se reemplaza por `const isClient = useIsClient()`:
  - `app/dashboard/componentes/CambiarPasswordModal.tsx` (el `setTimeout` que da el foco se queda en su effect, sin `setState`);
  - `app/dashboard/componentes/ConfirmModal.tsx`;
  - `app/dashboard/servicios/componentes/ConfirmModal.tsx`;
  - `app/dashboard/empleados/[id]/asistencia/componentes/EmployeeIdentifiersModal.tsx`;
  - `app/dashboard/empleados/[id]/usuarios/componentes/LinkUserModal.tsx`;
  - `app/dashboard/pedidos/[id]/componentes/UploadInvoiceModal.tsx`;
  - `app/dashboard/pedidos/nuevo/componentes/EditOrderTemplateModal.tsx` (solo la guarda; su fetch es de la 84);
  - `app/dashboard/pedidos/nuevo/componentes/SaveCartAsTemplateModal.tsx` (el foco se queda igual que en `CambiarPasswordModal`);
  - `app/dashboard/productos/componentes/ProductViewModal.tsx`;
  - `app/dashboard/solicitudes/componentes/RejectRequestModal.tsx`;
  - `app/dashboard/sucursales/componentes/SucursalCalendariosModal.tsx` (solo la guarda);
  - `app/dashboard/sucursales/componentes/SucursalCheckadoresModal.tsx` (solo la guarda);
  - `app/dashboard/tratamientos/[id_tratamiento]/componentes/ImageSliderModal.tsx`.

- **Patrón B: APIs del navegador (5).**
  - `app/dashboard/citas/componentes/CalendarioCitas.tsx`: `isMobile = useMediaQuery("(max-width: 640px)")`. El `changeView` de FullCalendar al cruzar el breakpoint se queda en un effect sin `setState`, que solo reacciona al *cambio* (no al montar), igual que hoy.
  - `app/dashboard/componentes/EstadisticasCharts.tsx`: se borra el `useIsLargeScreen` local y se usa `useMediaQuery("(min-width: 1024px)")`.
  - `app/dashboard/componentes/Sidebar.tsx`: `collapsed` sale de `useStorageValue` (`localStorage`, clave `sidebar_collapsed`, `false` en el servidor).
  - `contexts/ThemeContext.tsx`: `theme` sale de `useStorageValue` (`localStorage`, clave `theme`). Si no hay valor guardado, usa `prefers-color-scheme`; en el servidor es `"light"`. `toggle` escribe la clave y alterna la clase `dark` en `<html>`. El script inline de `app/layout.tsx` no cambia.
  - `contexts/PurchaseCartContext.tsx`: `cartsBySucursal` pasa a un store externo sobre `sessionStorage` (clave `SESSION_STORAGE_KEY`). La lectura se cachea por el string crudo y la escritura notifica. Se borran los dos effects (cargar y persistir) y el `useState` de carritos. `isHydrated` se sigue exponiendo con el mismo nombre, ahora como `useIsClient()`, así que `pedidos/nuevo/revision/page.tsx` no cambia. Un JSON corrupto se sigue ignorando y el carrito arranca vacío.

- **Patrón C: estado derivado o reset (8).**
  - **Autocompletes editables:** el texto del input se sincroniza con "ajustar estado durante el render cuando cambia la prop" (guardar el valor previo de la prop en estado y compararlo en el render):
    - `app/dashboard/citas/componentes/CitaModal.tsx` (`pacienteQuery` ← `form.id_paciente`, `pacientes`);
    - `app/dashboard/pacientes/[id]/consultas/[id_consulta]/componentes/TabPagar.tsx` (`mpSearch` ← `pagoForm.idMetodoPago`, `metodoPagoOptions`);
    - `app/dashboard/pacientes/[id]/expediente/componentes/ConsultaModal.tsx` (`sucursalInput` ← `form.id_sucursal`; `podologoInput` ← `form.id_podologo`);
    - `app/dashboard/sucursales/componentes/SucursalModal.tsx` (`query` ← `form.id_state`, `states`).
  - **`ConsultaModal`, rol 2 (podólogo):**
    - el texto del podólogo se deriva en el render de `currentUser.nombre` (el input ya está bloqueado);
    - la llamada `onPodologoChange(currentUser.id_user)` al padre se queda en un effect, sin `setState` local, con guarda `form.id_podologo !== currentUser.id_user` para no ciclar;
    - con esa guarda, las dependencias quedan completas y se quita su `eslint-disable-next-line`.
  - **`app/dashboard/pacientes/[id]/expediente/componentes/ConsultaFila.tsx`:**
    - `expanded` ← `expandAll` con "ajustar estado durante el render";
    - el detalle se carga en un effect que depende de `expanded && detalle === null`, llama `setState` solo dentro del `.then` y cancela si se desmonta;
    - `loadingDetalle` se deriva (`expanded && detalle === null`) en vez de guardarse;
    - `toggleExpanded` queda en un solo `setExpanded`;
    - se quita su `eslint-disable-next-line`.
  - **`app/dashboard/movimientos/componentes/StockMovementsTable.tsx`:** el `setPage(1)` al cambiar `selectedId`, `search`, `movementFilter`, `dateFrom` o `dateTo` pasa a "ajustar estado durante el render", con una clave de filtros guardada como valor previo.
  - **`contexts/SucursalContext.tsx`:** si `user.sucursales_string` tiene una sola sucursal, `selectedId` se **deriva** en el render (esa sucursal tiene prioridad sobre el estado) en vez de forzarse con un effect. El tipo y la forma del contexto no cambian.

- **`eslint-disable`:** se quitan los `// eslint-disable-*-line react-hooks/exhaustive-deps` de los effects que esta spec reescribe, cuando dejan de hacer falta.

**No incluye:**

- **Patrón D: los 43 effects de fetch.** Es la spec 84, que ya tiene decidido usar un hook compartido (`{ key, data, error }`, con `setState` solo en el `.then` y `loading` derivado). También quedan intactos los effects de fetch que conviven en archivos de esta spec (`EditOrderTemplateModal`, `Sucursal*Modal`, el primer effect de `SucursalContext`), con sus `eslint-disable`.
- Guardar el tema o el sidebar en cookie para que el servidor los pinte. Se siguen aplicando tras hidratar, como hoy (el tema ya lo cubre el script inline).
- Mover la asignación del podólogo de rol 2 a los padres de `ConsultaModal` (`expediente` y `tratamientos/[id_tratamiento]`).
- Unificar los dos `ConfirmModal` duplicados (`app/dashboard/componentes/` y `servicios/componentes/`), ni crear un `<ClientPortal>` compartido. Se anota como deuda.
- Quitar la guarda de cliente en modales que el padre solo monta tras un clic, siguiendo el precedente de `nomina/`. Aquí se usa `useIsClient()` en los 13, de forma uniforme.
- Cambiar reglas de `eslint.config.mjs`, agregar lint a CI o arreglar lo que el linter no reporte.

## Modelo de datos

**Base de datos:** sin cambios. **Datos persistidos:** las mismas claves de hoy, con el mismo formato:

| Clave | Almacenamiento | Formato |
|---|---|---|
| `theme` | `localStorage` | `"light"` / `"dark"` |
| `sidebar_collapsed` | `localStorage` | `"true"` / `"false"` |
| `SESSION_STORAGE_KEY` del carrito | `sessionStorage` | JSON de `PurchaseCartBySucursal` |

Lo nuevo son los tres hooks y la forma interna del estado en los archivos del patrón C.

### `hooks/useIsClient.ts`

```ts
/** false en el servidor y durante la hidratación; true una vez en el cliente. */
export function useIsClient(): boolean;
// useSyncExternalStore(subscribeNoop, () => true, () => false)
```

### `hooks/useMediaQuery.ts`

```ts
/**
 * `matches` del media query, que se actualiza en cada `change`.
 * En el servidor y durante la hidratación devuelve `serverValue`.
 */
export function useMediaQuery(query: string, serverValue?: boolean): boolean; // serverValue = false
```

### `hooks/useStorageValue.ts`

```ts
type StorageKind = "local" | "session";
type StorageValueUpdate = string | null | ((current: string | null) => string | null);

/**
 * Lee y escribe una clave de localStorage/sessionStorage como string crudo.
 * - Snapshot del servidor: `serverValue`.
 * - Escribir `null` borra la clave.
 * - El setter acepta un updater funcional que lee el valor actual del storage, no el del
 *   último render, para que dos escrituras seguidas en el mismo evento no se pisen.
 * - Notifica a los demás componentes de la misma pestaña que usan esa clave, mediante un
 *   registro de listeners a nivel de módulo, indexado por `${kind}:${key}`.
 * - Si el storage lanza (modo privado, cuota llena), la lectura devuelve `serverValue` y la
 *   escritura se ignora sin romper la pantalla.
 */
export function useStorageValue(
  kind: StorageKind,
  key: string,
  serverValue: string | null,
): [string | null, (update: StorageValueUpdate) => void];
```

- Devuelve el string crudo; cada llamador hace su `parse`. Como el snapshot es un primitivo, `useSyncExternalStore` no re-renderiza en bucle.
- **No** escucha el evento `storage` de otras pestañas. Hoy tampoco se sincroniza entre pestañas.

### Uso en los contextos del patrón B

```ts
// Sidebar
const [collapsedRaw, setCollapsedRaw] = useStorageValue("local", COLLAPSED_STORAGE_KEY, null);
const collapsed = collapsedRaw === "true";

// ThemeContext
const [savedTheme, setSavedTheme] = useStorageValue("local", "theme", null);
const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
const theme: Theme = savedTheme === "dark" || savedTheme === "light"
  ? savedTheme
  : prefersDark ? "dark" : "light";

// PurchaseCartContext
const [cartsRaw, setCartsRaw] = useStorageValue("session", SESSION_STORAGE_KEY, null);
const cartsBySucursal = useMemo<PurchaseCartBySucursal>(() => parseCarts(cartsRaw), [cartsRaw]);
// parseCarts: JSON.parse en try/catch; si es null o corrupto devuelve {}.
const isHydrated = useIsClient();
// updateCurrentCart: setCartsRaw((current) => JSON.stringify({ ...parseCarts(current), [selectedId]: updater(...) }))
```

### Estado previo para "ajustar estado durante el render" (patrón C)

Todos los casos del patrón C siguen la misma forma:

```ts
const [previousPacienteId, setPreviousPacienteId] = useState(form.id_paciente);
const [previousPacientes, setPreviousPacientes] = useState(pacientes);
if (form.id_paciente !== previousPacienteId || pacientes !== previousPacientes) {
  setPreviousPacienteId(form.id_paciente);
  setPreviousPacientes(pacientes);
  setPacienteQuery(labelFor(form.id_paciente, pacientes));
}
```

| Archivo | Valor previo que se guarda | Estado que se ajusta |
|---|---|---|
| `CitaModal` | `form.id_paciente`, `pacientes` | `pacienteQuery` |
| `TabPagar` | `pagoForm.idMetodoPago`, `metodoPagoOptions` | `mpSearch` |
| `ConsultaModal` | `form.id_sucursal`, `sucursales` / `form.id_podologo`, `podologos` | `sucursalInput` / `podologoInput` (rol ≠ 2) |
| `SucursalModal` | `form.id_state`, `states` | `query` |
| `ConsultaFila` | `expandAll` | `expanded` (solo si `expandAll !== undefined`) |
| `StockMovementsTable` | `filterKey = JSON.stringify([selectedId, search, movementFilter, dateFrom, dateTo])` | `page` → `1` |

- **El estado inicial de cada `useState` ajustado se calcula igual que en el ajuste,** para que el primer render ya muestre la etiqueta correcta y no dependa del primer ajuste. Por ejemplo, `useState(() => labelFor(form.id_paciente, pacientes))`.
- **Casos que se derivan sin estado:**
  - `ConsultaModal`, rol 2: `podologoText = isPodologoRole ? currentUser.nombre ?? "" : podologoInput`.
  - `ConsultaFila`: `loadingDetalle = expanded && detalle === null`.
  - `SucursalContext`:

    ```ts
    const userBranchIds = user?.sucursales_string.split(",") ?? [];
    const forcedBranchId = userBranchIds.length === 1 ? Number(userBranchIds[0]) : null;
    const effectiveSelectedId = forcedBranchId ?? selectedId; // se expone como `selectedId`
    ```

## Plan de implementación

Cada paso deja el sistema compilando (`npm run build`) y funcional. Después de cada paso, `npm run lint` debe mostrar el conteo indicado, todos `set-state-in-effect`, sin warnings y sin errores nuevos en archivos que antes no tenían.

1. **Hooks compartidos (69 → 69).**
   - Crear `hooks/useIsClient.ts`, `hooks/useMediaQuery.ts` y `hooks/useStorageValue.ts` con las firmas del modelo de datos.
   - Todavía nadie los usa, así que el conteo no cambia.

2. **Patrón A: guarda `mounted` (69 → 56).**
   - En los 13 modales del alcance, reemplazar `mounted` + su effect por `const isClient = useIsClient()` y usar `isClient` donde se leía `mounted`.
   - En `CambiarPasswordModal` y `SaveCartAsTemplateModal`, el `setTimeout` de foco se queda en un effect sin `setState`.
   - Quitar los imports de `useState`/`useEffect` que queden sin uso.
   - Prueba manual: abrir y cerrar cada modal. Debe aparecer sobre el contenido (portal a `body`), el foco inicial funciona donde lo había y la consola no muestra errores de hidratación.

3. **Patrón B: media queries (56 → 54).**
   - `CalendarioCitas`: `isMobile = useMediaQuery("(max-width: 640px)")`. El `changeView` va en un effect que guarda el valor previo en un `ref` y solo actúa cuando `isMobile` cambia después del montaje.
   - `EstadisticasCharts`: borrar `useIsLargeScreen` y usar `useMediaQuery("(min-width: 1024px)")`.
   - Prueba manual: en Citas y en el dashboard, redimensionar la ventana cruzando 640 px y 1024 px. La vista del calendario cambia (mes ↔ día) y la gráfica de pastel muestra u oculta etiquetas y leyenda, igual que hoy. En móvil (DevTools), Citas abre en vista día.

4. **Patrón B: `localStorage` (54 → 52).**
   - `Sidebar`: `collapsed` desde `useStorageValue("local", COLLAPSED_STORAGE_KEY, null)`. `toggleCollapsed` escribe `"true"`/`"false"`.
   - `ThemeContext`: `theme` derivado como en el modelo de datos. `toggle` escribe la clave `theme`. La clase `dark` de `<html>` se sincroniza con `theme` en un effect sin `setState`.
   - Prueba manual:
     - colapsar el sidebar, recargar y confirmar que sigue colapsado;
     - cambiar el tema, recargar y confirmar que se conserva sin parpadeo;
     - borrar `theme` de `localStorage` y confirmar que sigue la preferencia del sistema.

5. **Patrón B: carrito en `sessionStorage` (52 → 51).**
   - `PurchaseCartContext`:
     - `cartsBySucursal` desde `useStorageValue("session", SESSION_STORAGE_KEY, null)` + `parseCarts`;
     - todas las mutaciones pasan por `setCartsRaw` con updater funcional;
     - `isHydrated = useIsClient()`;
     - borrar los dos effects y los `useState` de carritos e hidratación.
   - `pedidos/nuevo/revision/page.tsx` no se toca.
   - Prueba manual:
     - en Pedidos > Nuevo, armar un carrito, ir a Revisión y regresar: el carrito se conserva;
     - recargar en Revisión: se conserva;
     - cambiar de sucursal: cada una tiene su propio carrito;
     - poner un JSON inválido en la clave de `sessionStorage` y recargar: arranca vacío sin errores;
     - enviar el pedido: el carrito se limpia y Revisión no redirige antes de tiempo.

6. **Patrón C: autocompletes (51 → 46).**
   - `CitaModal`, `TabPagar`, `SucursalModal` y `ConsultaModal`: reemplazar los effects de sincronización por "ajustar estado durante el render", con el estado inicial calculado igual que en el ajuste.
   - `ConsultaModal`, rol 2:
     - el texto del podólogo se deriva de `currentUser.nombre`;
     - el effect que llama `onPodologoChange(currentUser.id_user)` lleva la guarda `form.id_podologo !== currentUser.id_user` y sus dependencias completas;
     - se quita el `eslint-disable-next-line`.
   - Prueba manual:
     - **Citas:** abrir una cita existente muestra el nombre del paciente; escribir filtra; elegir otro paciente actualiza el texto.
     - **Consulta > Pagar:** al registrar un pago, el método de pago se limpia; al editar uno, muestra su descripción.
     - **Sucursales:** editar una sucursal muestra su estado; borrar y elegir otro funciona.
     - **Expediente y Tratamiento > nueva consulta:** como rol 2, el podólogo queda fijo en el usuario actual sin bucle en la pestaña Network ni en la consola. Como otro rol, al cambiar de sucursal se limpia el podólogo y se puede elegir otro.

7. **Patrón C: `ConsultaFila`, `StockMovementsTable` y `SucursalContext` (46 → 43).**
   - `ConsultaFila`:
     - `expanded` se ajusta en el render cuando cambia `expandAll`;
     - el detalle se carga en un effect con `setState` solo en el `.then` y un flag de cancelación;
     - `loadingDetalle` se deriva;
     - `toggleExpanded` queda en `setExpanded(!expanded)`;
     - se quita el `eslint-disable-next-line`.
   - `StockMovementsTable`: `page` vuelve a `1` en el render cuando cambia `filterKey`.
   - `SucursalContext`: exponer `effectiveSelectedId` como `selectedId` y borrar el effect que forzaba la sucursal única.
   - Prueba manual:
     - **Expediente:** expandir una fila carga su detalle una vez; "expandir todo" abre todas y carga las que faltan; "contraer todo" las cierra; volver a expandir no vuelve a pedir lo que ya se cargó.
     - **Movimientos:** estando en la página 3, cambiar cualquier filtro regresa a la página 1, con una sola petición en Network (no dos).
     - **Usuario con una sola sucursal:** el selector y todas las pantallas usan esa sucursal desde la primera carga.

8. **Documentación y verificación final.**
   - `CLAUDE.md`, sección *Directory conventions*: agregar `hooks/` (hooks de cliente reutilizables, uno por archivo).
   - `npm run lint`: 0 warnings y 43 errores, todos `set-state-in-effect` y todos en effects del patrón D.
   - `npm run build`: exitoso.
   - Recorrer en Chrome las pantallas de los pasos 2 a 7 y anotar en la spec lo que no se pudo probar.

## Criterios de aceptación

**Lint y build**

- [x] `npm run lint` reporta **0 warnings**.
- [x] `npm run lint` reporta **43 errores**, todos `react-hooks/set-state-in-effect`.
- [x] Ninguno de los 43 errores está en una de las líneas de los patrones A, B o C de la línea base. Todos corresponden a effects de fetch (patrón D).
- [x] `npm run build` termina sin errores de tipos ni de compilación.

**Sin atajos**

- [x] `git diff` no agrega ningún `eslint-disable`, `@ts-ignore` ni `@ts-expect-error`.
- [x] `eslint.config.mjs` no cambia.
- [x] Ya no hay `eslint-disable` en los effects de `ConsultaModal` (podólogo) ni de `ConsultaFila`. Los de los effects de fetch (`Sucursal*Modal`, primer effect de `SucursalContext`, etc.) siguen intactos.

**Código**

- [x] Existen `hooks/useIsClient.ts`, `hooks/useMediaQuery.ts` y `hooks/useStorageValue.ts`, con las firmas del modelo de datos.
- [x] `grep -rn "setMounted" app contexts` no encuentra nada.
- [x] `grep -rn "useIsLargeScreen" app` no encuentra nada.
- [x] `PurchaseCartContext.tsx` no tiene `useEffect` que lea o escriba `sessionStorage`.
- [x] `PurchaseCartContext.tsx` sigue exponiendo `isHydrated`.
- [x] `pedidos/nuevo/revision/page.tsx` no aparece en el diff.
- [x] `SucursalContext` expone la misma forma (`sucursales`, `selectedId`, `setSelected`).
- [x] `CLAUDE.md` menciona `hooks/` en *Directory conventions*.

**Comportamiento (prueba manual)**

- [ ] **Modales del patrón A (13):**
  - cada uno abre y cierra igual que antes;
  - `CambiarPasswordModal` y `SaveCartAsTemplateModal` siguen enfocando su primer input;
  - la consola no muestra errores de hidratación.
- [ ] **Citas:**
  - cruzar 640 px cambia la vista del calendario (mes ↔ día);
  - en un viewport móvil abre en vista día;
  - el autocompletar de paciente muestra el nombre al editar una cita y filtra al escribir.
- [x] **Dashboard:** cruzar 1024 px muestra u oculta las etiquetas y la leyenda de la gráfica, como antes.
- [x] **Sidebar:** el estado colapsado se conserva al recargar.
- [x] **Tema:**
  - se conserva al recargar, sin parpadeo;
  - sin clave `theme`, sigue la preferencia del sistema.
- [x] **Carrito de pedidos:**
  - se conserva entre armado y revisión, y al recargar;
  - es independiente por sucursal;
  - un JSON corrupto arranca vacío sin errores;
  - después de enviar el pedido, se limpia y Revisión no redirige antes de tiempo.
- [ ] **Consulta > Pagar:** el texto del método de pago se limpia al resetear el formulario y muestra la descripción al editar un pago.
- [x] **Sucursales:** al editar, el autocompletar de estado muestra el estado guardado.
- [ ] **`ConsultaModal`, en Expediente y en Tratamiento:**
  - como rol 2, el podólogo queda fijo en el usuario actual, sin peticiones ni renders en bucle;
  - como otro rol, cambiar de sucursal limpia el podólogo.
- [x] **Expediente, filas de consulta:**
  - expandir una fila carga su detalle una sola vez;
  - "expandir todo" y "contraer todo" funcionan;
  - re-expandir no vuelve a pedir el detalle.
- [x] **Movimientos:** cambiar un filtro estando en una página mayor a 1 regresa a la página 1 con una sola petición.
- [ ] **Usuario con una sola sucursal:** todas las pantallas usan esa sucursal desde la primera carga.

## Notas de implementación (2026-10-15)

Prueba manual hecha en Chrome contra el dev server, con un usuario de rol 4 (Superadmin) y seis sucursales. Las llamadas a server actions se contaron envolviendo `fetch` en la página.

**Lo que no se pudo probar** (criterios que siguen sin marcar):

- **Modales del patrón A: 10 de 13 verificados.** No se pudieron abrir:
  - `EditOrderTemplateModal`: Poza Rica no tiene plantillas de pedido.
  - `RejectRequestModal`: no había solicitudes pendientes.
  - `ImageSliderModal`: el portal sí se monta, pero el `<Image>` de adentro truena. Ver la deuda de Cloudinary abajo.
- **Citas, calendario:** `CalendarioCitas` no se importa en ninguna parte (es código muerto) y la página de Citas usa el calendario embebido de Google. El cambio a `useMediaQuery` se hizo porque el archivo cuenta en el lint, pero el cambio de vista mes ↔ día no se puede probar en la app.
  - El autocompletar de paciente de `CitaModal` sí se probó en Tratamiento > Crear cita: muestra el nombre, conserva lo que se escribe y se actualiza al elegir otro paciente.
- **Consulta > Pagar:** las consultas revisadas estaban pagadas por completo, así que el formulario de pago nuevo no aparece. Además, el reset solo ocurre después de registrar un pago, lo que escribe en la base. La edición de un pago vive en `PagoFila`, que esta spec no toca.
- **`ConsultaModal` con rol 2 (podólogo):** no había un token de rol 2. Con rol 4 sí se verificó, en Tratamiento y en Expediente, que cambiar de sucursal limpia el podólogo.
- **Usuario con una sola sucursal:** no había un token de un usuario así. El selector con varias sucursales sigue funcionando.

**Verificado además de los criterios:**

- **Carrito:** tres mutaciones en el mismo tick (agregar, quitar IVA, agregar) quedaron todas en el storage. Enviar el pedido limpió el carrito y redirigió directo a `/dashboard/pedidos`, sin pasar por `/pedidos/nuevo`. La orden de prueba `PO-2026-0028` se canceló después (`id_status = 5`).
- **Tema:** al recargar, la clase `dark` de `<html>` solo cambia una vez, cuando la pone el script inline. La hidratación ya no la toca.

**Diferencias de comportamiento menores:**

- **`ThemeContext`:** el effect que sincroniza la clase `dark` espera a `useIsClient()`. Así no quita, durante la hidratación, la clase que puso el script inline.
- **`ConsultaFila`:**
  - si la carga del detalle falla, la fila se queda en "Cargando" (antes quedaba vacía);
  - si se contrae mientras carga, esa respuesta se descarta y al volver a expandir se pide de nuevo.
- **`useStorageValue`:** si el valor nuevo es igual al guardado, no escribe ni notifica.
- **`parseCarts`:** también descarta JSON válido que no sea un objeto.

**Deuda encontrada (fuera de alcance, para otras specs):**

- **`next.config.ts` (spec 81):** `remotePatterns` solo permite la cuenta de Cloudinary que tiene hoy `CLOUDINARY_URL` (`ds7odsbwv`). Las fotos de tratamientos guardadas en `dmq9e2wuv` hacen tronar `ImageSliderModal` con `next/image`. Resuelto en la spec 83.
- **Producto 26 ("Agua Oxigenada"):** apunta a `id_supplier = 6`, que no existe en `inventory.proveedores`.
  - `createPurchaseOrders` no valida el proveedor, así que deja crear la orden.
  - La lista y el detalle de pedidos la ocultan, porque hacen INNER JOIN con `proveedores`.
- **`CitaModal`:** el autocompletar de paciente no filtra cuando se escriben letras. `"".includes("")` es `true` en la comparación por WhatsApp, así que todos coinciden.
- **`CalendarioCitas`:** es código muerto y se puede borrar.

## Decisiones

**Tomadas:**

- **Separar `set-state-in-effect` en dos specs.** Esta (82) cubre portales, APIs del navegador y estado derivado (26 errores, de bajo riesgo). La 84 cubre los 43 effects de fetch, que cambian el comportamiento en tiempo de ejecución de ~40 pantallas. Es el mismo criterio con el que se separó la 81.
- **Para la 84 ya quedó decidido el hook compartido de fetch** (`{ key, data, error }`, `setState` solo en el `.then` y `loading` derivado), en vez de arreglar cada effect a mano, adoptar SWR/TanStack Query o migrar a Server Components. Se anota aquí para que el `/spec` de la 84 no lo reabra.
- **Carpeta nueva `hooks/` en la raíz, con un hook por archivo.** `lib/` es para integraciones del servidor y `utils/` para helpers puros; ninguna de las dos sirve para hooks de cliente. La 84 pondrá su hook en el mismo lugar.
- **`useSyncExternalStore` como base de los tres hooks.** Es la API de React pensada para leer fuentes externas (DOM, storage) sin effects. Además da un snapshot de servidor explícito, así que no hay *hydration mismatch*.
- **`useIsClient()` uniforme en los 13 modales,** aunque algunos solo se montan tras un clic. Es seguro también para modales siempre montados, como `ImageSliderModal`, y evita revisar padre por padre.
- **Tema y sidebar siguen aplicándose tras hidratar.** Pasarlos a cookie para que el servidor los pinte sería un cambio funcional. El parpadeo del tema ya lo evita el script inline de `app/layout.tsx`.
- **`useStorageValue` devuelve el string crudo y no escucha otras pestañas.** El snapshot primitivo evita re-renders en bucle, y cada llamador hace su `parse`. No sincronizar entre pestañas conserva el comportamiento actual.
- **Setter con updater funcional que lee del storage,** no del último render, para que dos mutaciones del carrito en el mismo evento no se pisen.
- **Carrito como store externo sobre `sessionStorage`,** en vez de un inicializador perezoso de `useState`. El inicializador provocaría un *hydration mismatch* en la pantalla de armado cuando hay carrito guardado. `isHydrated` se conserva con el mismo nombre (ahora `useIsClient()`) para no tocar `revision/page.tsx`.
- **"Ajustar estado durante el render" para los autocompletes editables,** en vez de derivar sin estado. El texto también lo escribe el usuario, así que necesita estado propio; solo se resetea cuando cambia la prop de origen.
- **`selectedId` derivado en `SucursalContext`.** La sucursal única es un hecho del usuario, no un estado que haya que forzar. La forma del contexto no cambia para los consumidores.
- **`ConsultaModal`, rol 2: la llamada al padre se queda en un effect con guarda,** en vez de mover la lógica a los dos padres (`expediente` y `tratamientos/[id_tratamiento]`). Cambia menos archivos, y la guarda permite dependencias completas sin bucle.
- **`ConsultaFila` se resuelve completo en la 82,** incluida su carga de detalle con `setState` solo en el `.then`. El error reportado es del patrón C, y el archivo no tiene por qué esperar al hook de la 84.
- **Quitar los `eslint-disable` solo en los effects reescritos.** Los de effects de fetch se quedan para la 84.
- **Documentar `hooks/` en `CLAUDE.md`,** para que futuras features encuentren y reusen los hooks en vez de duplicarlos.

**Descartadas:**

- *Una sola spec con los 69 errores:* mezcla cambios mecánicos con el refactor de fetch de ~40 pantallas.
- *Quitar la guarda de cliente donde el padre monta el modal de forma condicional (precedente de `nomina/`):* obliga a auditar cada padre y deja dos patrones conviviendo.
- *Crear un `<ClientPortal>` compartido o unificar los dos `ConfirmModal`:* es útil, pero es una refactorización de UI fuera del objetivo de lint. Queda como deuda.
- *Inicializadores perezosos de `useState` que lean `localStorage`/`sessionStorage`:* rompen la hidratación.
- *Tema en cookie para SSR:* es un cambio funcional y no le toca a esta spec.
- *Escuchar el evento `storage` entre pestañas:* agrega un comportamiento que hoy no existe.
- *Mover el `setPage(1)` de Movimientos a cada handler de filtro:* `selectedId` viene del contexto, no de un evento local, así que de todas formas haría falta el ajuste en el render.

## Riesgos

- **Bucle de renders por "ajustar estado durante el render".** Si la comparación con el valor previo usa un objeto o arreglo que se vuelve a crear en cada render del padre (por ejemplo, un `pacientes.filter(...)` en línea), el ajuste se dispara en cada render. React lo detecta como "Too many re-renders".
  - *Mitigación:* comparar primitivos (`id_*`) y arreglos que vengan de estado del padre, no recalculados en línea. Antes de implementar cada caso, verificar en el padre que `pacientes`, `metodoPagoOptions`, `sucursales`, `podologos` y `states` son estado o memo.
  - La prueba manual de los pasos 6 y 7 revisa la consola y la pestaña Network.

- **`getSnapshot` que devuelve un valor nuevo en cada llamada.** `useSyncExternalStore` entra en bucle infinito si el snapshot no es estable.
  - *Mitigación:* los tres hooks devuelven primitivos (`boolean`, `string | null`). El `parse` del carrito vive fuera del hook, en un `useMemo` sobre el string crudo.

- **El carrito pierde escrituras o se desincroniza.** Si alguna mutación de `PurchaseCartContext` sigue leyendo el `cartsBySucursal` del render en vez del valor actual del storage, dos cambios seguidos en el mismo evento se pisan. Por ejemplo, marcar un producto y ajustar su cantidad.
  - *Mitigación:* todas las mutaciones pasan por el updater funcional de `setCartsRaw`.
  - La prueba manual del paso 5 incluye agregar varios productos rápido y cambiar cantidades.

- **Storage inaccesible** (modo privado de Safari, cuota llena, bloqueo de cookies). `localStorage`/`sessionStorage` lanzan.
  - *Mitigación:* `useStorageValue` envuelve lectura y escritura en `try/catch`. Si falla, cae al `serverValue` o ignora la escritura, igual que si no hubiera nada guardado.

- **Parpadeo del sidebar o del tema tras hidratar.** El snapshot del servidor (`false` / `"light"`) se pinta primero y luego cambia al valor real.
  - *Mitigación:* es el mismo comportamiento de hoy con el effect. En el tema, el script inline de `app/layout.tsx` ya aplica la clase `dark` antes de pintar. No se considera regresión.

- **`changeView` del calendario al montar.** Si el effect de `CalendarioCitas` reacciona también al primer valor de `isMobile`, cambiaría la vista que el usuario ya ve.
  - *Mitigación:* el effect guarda el valor previo en un `ref` y solo llama `changeView` cuando cambia después del montaje. `initialView` sigue decidiendo la vista inicial.
  - *Matiz:* con `useSyncExternalStore`, el primer render del cliente usa el snapshot del servidor (`false`) para hidratar, y luego `isMobile` pasa a `true` en móvil. Ese cambio post-hidratación también tiene que llamar `changeView` para que móvil abra en vista día. Se valida en la prueba manual del paso 3 con un viewport móvil.

- **`SucursalContext` deja de escribir el `selectedId` forzado en estado.** Si algún código lee el estado interno o llama `setSelected` esperando que el valor forzado ya esté guardado, podría ver otro id.
  - *Mitigación:* el contexto solo expone el valor derivado. La prueba manual del paso 7 cubre a un usuario con una sola sucursal.

- **El conteo final no da exactamente 43.** Algún cambio cerca de un effect de fetch podría agregar o quitar un error.
  - *Mitigación:* el criterio de fondo es que todos los errores restantes sean del patrón D y que no aparezcan nuevos en archivos que no tenían. Si el número varía, se anota en la spec al cerrarla, con la razón.
