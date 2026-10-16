# 84 — Lint: `set-state-in-effect` en cargas de datos (hook compartido de fetch)

## Header

- **Estado:** Implementado
- **Depende de:** 82 (`lint-set-state-in-effect-portales-navegador-derivado`), que dejó el lint con 43 errores, todos `react-hooks/set-state-in-effect` del patrón D, y creó la carpeta `hooks/`. La 82 también dejó cerrada la decisión del hook compartido de fetch (`{ key, data, error }`, `setState` solo en el `.then` y `loading` derivado).
- **Modifica base de datos:** No.
- **Fecha:** 2026-10-15
- **Objetivo:** Eliminar los 43 errores restantes de `react-hooks/set-state-in-effect`, moviendo las cargas de datos de los effects a hooks compartidos en `hooks/` (`useAsyncData`, `useActionData`, `useDebouncedValue`), para que `npm run lint` termine con 0 errores y 0 warnings sin cambios funcionales visibles, salvo que una carga fallida ya no se quede en "Cargando..." para siempre.
- **Línea base (2026-10-15):** 43 errores `react-hooks/set-state-in-effect` en 41 archivos, 0 warnings. Por subpatrón:
  - **D1. Carga de solo lectura** (por sucursal, id o filtros; nunca se recarga a mano): 17.
  - **D2. `fetchX` que se reutiliza para recargar después de guardar o borrar:** 20.
  - **D3. Búsqueda con debounce:** 2.
  - **D4. Carga que llena estado editable** (formulario o lista que se modifica localmente): 4.

  Resultado esperado: **0 errores y 0 warnings.**

## Alcance

**Incluye:**

- **Tres hooks nuevos en `hooks/`**, uno por archivo, todos `"use client"`-safe:
  - `hooks/useAsyncData.ts`: carga genérica (`Promise<T>`) indexada por una `key`. Ofrece `data`, `error` y `loading` (derivado), más `reload()` y `mutate(updater)`. Con `key = null` no carga. El fetcher recibe un `AbortSignal` que se cancela al cambiar la key o al desmontar. Las respuestas de una key vieja se descartan.
  - `hooks/useActionData.ts`: se monta sobre `useAsyncData` y desenvuelve `ActionResult<T>`. Con `ok: true`, el contenido va a `data`; con `ok: false`, `message` va a `error`.
  - `hooks/useDebouncedValue.ts`: devuelve el valor recibido con un retraso de `ms`. Su `setState` corre dentro del `setTimeout`.

- **Comportamiento común al migrar cada carga:**
  - `data` solo existe para la key actual. Al cambiar de sucursal, filtro, página o id, o al llamar `reload()`, `data` es `undefined` y `loading` es `true` hasta que llega la respuesta. Coincide con lo que hoy muestra `if (loading)`.
  - Un rechazo de la promesa se captura en `error` y `loading` termina.
    - Las pantallas que ya muestran un error lo leen de ahí.
    - Las que hoy no muestran nada siguen sin mostrar nada, pero dejan de quedarse en "Cargando..." para siempre.
    - Es el **único cambio de comportamiento permitido**.
  - Los `if (!selectedId) return;` y guardas similares pasan a `key = null`.

- **D1. Carga de solo lectura (17):**
  - `app/dashboard/citas/page.tsx`: `activeCalendarId` deja de forzarse desde la carga. El calendario activo se deriva: es el seleccionado si existe en la lista actual y, si no, el primero.
  - `app/dashboard/componentes/PacientesCumpleanos.tsx`
  - `app/dashboard/componentes/PacientesFaltantes.tsx`: con `dias < 1`, la key es `null` y se muestra el estado vacío en vez de la lista anterior (aceptado).
  - `app/dashboard/conteos/componentes/StockCountsTable.tsx`
  - `app/dashboard/conteos/nuevo/componentes/NewCountForm.tsx` (2 errores): conteo abierto y número de productos contables.
  - `app/dashboard/inventario/page.tsx`
  - `app/dashboard/movimientos/componentes/RegisterMovementModal.tsx`: destinos de traspaso, con key `null` si no es traspaso.
  - `app/dashboard/movimientos/componentes/StockMovementsTable.tsx`
  - `app/dashboard/pacientes/[id]/consultas/[id_consulta]/componentes/TabGeneral.tsx`: los nueve `useState` que llena `getGeneralTabData` pasan a leerse del `data` del hook.
  - `app/dashboard/pacientes/[id]/consultas/[id_consulta]/page.tsx`: la actualización local de `fecha_fin` usa `mutate`.
  - `app/dashboard/pedidos/nuevo/page.tsx`
  - `app/dashboard/pedidos/page.tsx`
  - `app/dashboard/recepciones/page.tsx`
  - `app/dashboard/solicitudes/componentes/PendingRequestsBadge.tsx`
  - `app/dashboard/solicitudes/nueva/componentes/NewRequestForm.tsx`
  - `app/dashboard/solicitudes/page.tsx`

- **D2. Recarga después de guardar o borrar (20).** Cada `fetchX` se reemplaza por el `reload()` del hook. Los llamadores siguen haciendo `await` igual que hoy.
  - `app/dashboard/componentes/EstadisticasCharts.tsx`:
    - un estado de "filtros aplicados" (fechas + sucursales) que actualiza el handler del botón "Aplicar"; la key se deriva de esos filtros;
    - en modo global, la selección inicial de "todas las sucursales" se deriva en el render y desaparecen el effect y el `ref` `globalInitialized`.
  - `app/dashboard/conteos/[id]/page.tsx`: `values` se inicializa con "ajustar estado durante el render" cuando llega `data` de una key nueva.
  - `app/dashboard/conteos/[id]/revision/page.tsx`: igual con `decisions`.
  - `app/dashboard/enlaces/page.tsx`
  - `app/dashboard/pacientes/[id]/expediente/useExpediente.ts` y `app/dashboard/pacientes/[id]/expediente_medico/useExpedienteMedico.ts`: los nombres que exponen a sus componentes no cambian. Por dentro, cada `fetchX` apunta al `reload` correspondiente.
  - `app/dashboard/pacientes/page.tsx`
  - `app/dashboard/pedidos/[id]/page.tsx`
  - `app/dashboard/pedidos/nuevo/componentes/OrderTemplatesTab.tsx`
  - `app/dashboard/productos/page.tsx`
  - `app/dashboard/proveedores/page.tsx`
  - `app/dashboard/servicios/[id_servicio]/opciones/page.tsx`
  - `app/dashboard/servicios/page.tsx`
  - `app/dashboard/solicitudes/[id]/page.tsx`
  - `app/dashboard/sucursales/componentes/SucursalCalendariosModal.tsx`
  - `app/dashboard/sucursales/componentes/SucursalCheckadoresModal.tsx`
  - `app/dashboard/sucursales/page.tsx`
  - `app/dashboard/tratamientos/page.tsx`: el `setSearched(false)` al cambiar de sucursal pasa a "ajustar estado durante el render".
  - `app/dashboard/usuarios/page.tsx`
  - `app/dashboard/ventas/page.tsx`

- **D3. Búsqueda con debounce (2).** El valor con debounce es la key. `searching` se deriva como `query !== debouncedQuery || loading`.
  - `app/dashboard/movimientos/componentes/RegisterMovementModal.tsx`: búsqueda de productos, 300 ms y mínimo 2 caracteres, igual que hoy.
  - `app/dashboard/facturacion/[id]/products/componentes/ProductFormModal.tsx`: catálogo SAT. Conserva `SAT_SEARCH_DEBOUNCE_MS` y `SAT_SEARCH_MIN_LENGTH`, y el `fetch` usa el `AbortSignal` del hook.

- **D4. Carga que llena estado editable (4):**
  - `app/dashboard/pedidos/nuevo/componentes/EditOrderTemplateModal.tsx`: `name` e `items` se inicializan con "ajustar estado durante el render" cuando llega la plantilla.
  - `app/dashboard/recepciones/[id]/page.tsx`: igual con `quantities`, que por defecto propone lo pendiente.
  - `app/dashboard/pacientes/[id]/consultas/[id_consulta]/componentes/TabProductos.tsx`: agregar, editar y quitar productos usa `mutate`.
  - `app/dashboard/pacientes/[id]/consultas/[id_consulta]/componentes/TabServicios.tsx`: igual con los servicios de la consulta.

- **`eslint-disable`:** se quitan todos los `// eslint-disable-*-line react-hooks/exhaustive-deps` de los effects que esta spec reescribe.
- **`CLAUDE.md`:** la sección `hooks/` agrega `useAsyncData`, `useActionData` y `useDebouncedValue`.

**No incluye:**

- Los effects de carga que el linter **no** marca, aunque vivan en los archivos tocados, como `getSuppliers().then(setSuppliers)`, `getPhoneCodes().then(setPhoneCodes)` y `getCountableCategories` en `NewCountForm`. Se quedan como están.
- Conservar los datos de la key anterior mientras carga la nueva (*stale-while-revalidate*). Se acepta el parpadeo de la tabla paginada de movimientos.
- Una caché compartida entre componentes, deduplicar peticiones, o revalidar al enfocar la ventana o al reconectar.
- Agregar mensajes de error en pantallas que hoy no muestran ninguno.
- Adoptar SWR o TanStack Query, o migrar pantallas a Server Components.
- Paginar o virtualizar listas que hoy no lo están.
- Cambiar reglas de `eslint.config.mjs`, agregar lint a CI o arreglar lo que el linter no reporte.

## Modelo de datos

**Base de datos:** sin cambios. **Datos persistidos:** ninguno. Lo nuevo son los tres hooks y su estado interno.

### `hooks/useAsyncData.ts`

```ts
/** Partes primitivas de la key; se serializa con JSON.stringify para compararla. */
export type AsyncDataKey = readonly (string | number | boolean | null)[] | null;

export interface AsyncDataResult<T> {
  /** Datos de la key actual; `undefined` mientras carga, si falló o si key es null. */
  data: T | undefined;
  /** Mensaje del rechazo de la key actual; `null` si no hubo error. */
  error: string | null;
  /** Derivado: hay key y todavía no llega su respuesta (ni datos ni error). */
  loading: boolean;
  /** Vuelve a pedir la key actual. Se resuelve cuando ya se guardaron los datos nuevos o el error. */
  reload: () => Promise<void>;
  /** Modifica localmente `data` de la key actual, sin ir al servidor. No hace nada si no hay datos. */
  mutate: (updater: (current: T) => T) => void;
}

export function useAsyncData<T>(
  key: AsyncDataKey,
  fetcher: (signal: AbortSignal) => Promise<T>,
): AsyncDataResult<T>;
```

Estado interno: es el `{ key, data, error }` que dejó decidido la 82, más un contador de recargas.

```ts
interface AsyncDataState<T> {
  /** `${JSON.stringify(key)}#${reloadVersion}` de la respuesta guardada. */
  settledKey: string | null;
  data: T | undefined;
  error: string | null;
}
const [reloadVersion, setReloadVersion] = useState(0); // reload() lo incrementa desde un evento
```

- **Petición:** la dispara un effect que depende de la key serializada y de `reloadVersion`. Dentro del effect **no** hay `setState` síncrono. El único `setState` está en el `.then`/`.catch` y solo se aplica si la petición no fue abortada.
- **Fetcher:** se lee con `useEffectEvent` (React 19.2). Así no es dependencia del effect y los llamadores pueden pasarlo en línea sin `useCallback`.
- **`loading`:** se deriva como `key !== null && state.settledKey !== currentRequestKey`.
- **Datos de otra key:** si `settledKey` no coincide con la key actual, `data` y `error` se devuelven como `undefined`/`null`, aunque el estado aún guarde los de la key anterior.
- **Cancelación:** al cambiar la key o al desmontar, el cleanup del effect llama `abort()`, y la respuesta que llegue tarde se descarta.
- **Mensaje de error:** `err instanceof Error ? err.message : "Error inesperado"`. Un abort no cuenta como error.
- **`reload()`:** guarda un resolver por `reloadVersion`. El `.then`/`.catch` de esa versión lo resuelve.

### `hooks/useActionData.ts`

```ts
/** Forma estructural de los ActionResult que define cada actions.ts (no hay un tipo único importable). */
type ActionResultLike<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * Igual que useAsyncData, pero desenvuelve ActionResult:
 * ok:true → data; ok:false → error = message. Un rechazo de la promesa también va a error.
 */
export function useActionData<T>(
  key: AsyncDataKey,
  action: (signal: AbortSignal) => Promise<ActionResultLike<T>>,
): AsyncDataResult<T>;
```

- El tipo es estructural porque `ActionResult` está redefinido localmente en cada `actions.ts` (conteos, movimientos, empleados, etc.). El hook no importa nada de `app/`.

### `hooks/useDebouncedValue.ts`

```ts
/** Devuelve `value` después de `delayMs` sin cambios. El primer render devuelve `value` tal cual. */
export function useDebouncedValue<T>(value: T, delayMs: number): T;
```

- El `setState` vive dentro del callback del `setTimeout`, no en el cuerpo del effect, así que no infringe la regla.

### Convenciones para las pantallas migradas

- **Key:** solo primitivos (`selectedId`, `id_*`, filtros como string o número, `page`). Nunca objetos ni arreglos recreados en el render.
- **Listas:** se leen como `data ?? []`. Los objetos, como `data?.campo`.
- **"Ajustar estado durante el render"** (D2 con formulario y D4): se guarda la key de los datos con los que se inicializó el formulario (`initializedForKey`). Cuando llega `data` para otra key, se reinicializa en el render, con el mismo patrón que usó la 82 en los autocompletes.
  - `initializedForKey` compara la **key base** (`JSON.stringify(key)`), sin `reloadVersion`. Una recarga no reinicializa el formulario; solo lo hace un cambio de key (otro id u otra sucursal).

## Plan de implementación

Cada paso deja el sistema compilando (`npm run build`) y funcional. Después de cada paso, `npm run lint` muestra el conteo indicado, solo con errores `set-state-in-effect` y ninguno en archivos que antes no tenían.

1. **Hooks y documentación.** *(Lint: 43, sin cambios.)*
   - Crear `hooks/useAsyncData.ts`, `hooks/useActionData.ts` y `hooks/useDebouncedValue.ts` con la API del modelo de datos.
   - Agregar los tres hooks a la sección `hooks/` de `CLAUDE.md`.
   - Los hooks nuevos no deben generar errores de lint propios.

2. **D1 de inventario y solicitudes con `useActionData` (9).** *(Lint: 34.)* Este paso valida el hook en las pantallas más simples:
   - `StockCountsTable`, `inventario/page`, `recepciones/page`, `solicitudes/page`, `NewRequestForm` y `PendingRequestsBadge`;
   - `pedidos/page` (key con los filtros), `StockMovementsTable` (key con filtros y `page`) y `pedidos/nuevo/page` (dos actions en un fetcher con `Promise.all`).
   - Prueba manual:
     - `inventario` y `pedidos` cargan una vez y recargan al cambiar de sucursal;
     - en `pedidos`, cambiar un filtro recarga;
     - en movimientos, cambiar de página carga la nueva sin bucles en Network.

3. **El resto de D1 (8).** *(Lint: 26.)*
   - `citas/page` (calendario activo derivado), `PacientesCumpleanos`, `PacientesFaltantes` (`dias < 1` → key `null`) y `NewCountForm` (2);
   - destinos de traspaso de `RegisterMovementModal`, `TabGeneral` (los nueve `useState` pasan a leerse de `data`) y `consultas/[id_consulta]/page` (`fecha_fin` con `mutate`).
   - Prueba manual:
     - Citas: cambiar de sucursal muestra su primer calendario, y elegir otro sigue funcionando.
     - En una consulta, la pestaña General se ve completa, y finalizarla actualiza la fecha sin recargar.

4. **D3: búsquedas con debounce (2).** *(Lint: 24.)*
   - Búsqueda de productos en `RegisterMovementModal` y catálogo SAT en `ProductFormModal`, con `useDebouncedValue` y `searching` derivado.
   - El `fetch` del SAT usa el `AbortSignal` del hook.
   - Prueba manual:
     - escribir rápido lanza una sola petición después del debounce;
     - con menos de 2 caracteres no busca y limpia los resultados;
     - el indicador "buscando" aparece y desaparece igual que hoy.

5. **D4: estado editable (4).** *(Lint: 20.)*
   - `EditOrderTemplateModal` y `recepciones/[id]`: "ajustar estado durante el render" con `initializedForKey`.
   - `TabProductos` y `TabServicios`: altas, ediciones y bajas locales con `mutate`.
   - Prueba manual:
     - Recepción: propone las cantidades pendientes y deja editarlas.
     - Plantilla: carga nombre e items y deja editarlos.
     - Consulta: agregar, editar y quitar productos o servicios se refleja al instante y en el total de la pestaña Pagar.

6. **D2: catálogos con CRUD (12).** *(Lint: 8.)* Cada `fetchX` se reemplaza por `reload()`:
   - `enlaces`, `pacientes/page`, `productos`, `proveedores`, `servicios`, `servicios/[id_servicio]/opciones`, `sucursales`, `SucursalCalendariosModal`, `SucursalCheckadoresModal`, `usuarios`, `ventas`;
   - `tratamientos`, con `setSearched(false)` ajustado durante el render.
   - Prueba manual en Servicios:
     - guardar, borrar y "Copiar servicios" recargan la lista;
     - cambiar de sucursal recarga.

7. **D2: detalles de inventario (5).** *(Lint: 3.)*
   - `pedidos/[id]`, `OrderTemplatesTab` y `solicitudes/[id]`;
   - `conteos/[id]` (`values` con `initializedForKey`) y `conteos/[id]/revision` (`decisions`, igual).
   - Prueba manual:
     - Conteo: los valores capturados no se borran al guardar el avance, salvo que la recarga traiga datos nuevos de otra key.
     - Pedido: cancelar recarga el detalle.

8. **D2: expedientes (2).** *(Lint: 1.)*
   - `useExpediente` y `useExpedienteMedico`: por dentro usan el hook, y los nombres que exponen a sus componentes no cambian.
   - Prueba manual: crear o editar una consulta y un antecedente recarga sus listas.

9. **`EstadisticasCharts` (1).** *(Lint: 0.)*
   - Estado de "filtros aplicados" que actualiza el botón "Aplicar", con la key derivada de ese estado.
   - En modo global, la selección inicial de todas las sucursales se deriva en el render, y desaparecen el effect y `globalInitialized`.
   - Prueba manual:
     - escribir fechas no recarga; "Aplicar" sí;
     - cambiar de sucursal recarga (modo no global);
     - en modo global arranca con todas las sucursales.

10. **Cierre.**
    - Quitar los `eslint-disable-*-line react-hooks/exhaustive-deps` que hayan quedado en los effects reescritos.
    - Confirmar `npm run lint` (0/0) y `npm run build`.
    - Anotar en la spec qué pruebas manuales se ejecutaron y cuáles no, como en la 81.

## Criterios de aceptación

**Lint y build**

- [x] `npm run lint` reporta **0 errores y 0 warnings**.
- [x] `npm run build` termina sin errores de tipos ni de compilación. *(Todos los builds de la rama imprimen `[billing] Error: No autenticado` durante el prerender, que viene de `lib/billing/errors.ts`. Ningún archivo de esta spec toca código de servidor de facturación. No se comparó contra un build del commit base: Turbopack no acepta un `node_modules` enlazado fuera del proyecto en un worktree temporal.)*

**Sin atajos**

- [x] `git diff` no agrega ningún `eslint-disable`, `@ts-ignore` ni `@ts-expect-error`.
- [x] `eslint.config.mjs` no cambia.
- [x] `grep -rn "eslint-disable.*exhaustive-deps"` sobre los 41 archivos tocados no encuentra ninguno en un effect reescrito por esta spec. *(Quedan seis, todos en effects que esta spec no reescribe: los que reportan totales en `TabGeneral` (2), `TabProductos` y `TabServicios`; la confirmación de pre-solicitud en `pedidos/nuevo/page`; y los productos editables en `solicitudes/[id]`.)*
- [x] Ninguno de los 41 archivos conserva un `useEffect` que llame `setLoading(true)`, `setError(null)` o un setter equivalente de forma síncrona antes de una carga.

**Hooks**

- [x] Existen `hooks/useAsyncData.ts`, `hooks/useActionData.ts` y `hooks/useDebouncedValue.ts`, con las firmas del modelo de datos y sin `any` escrito a mano.
- [x] `useActionData` no importa nada de `app/`.
- [x] `CLAUDE.md` lista los tres hooks en la sección `hooks/`.

**Comportamiento común (prueba manual)**

- [x] Las pantallas probadas cargan una sola vez al entrar, y en la pestaña Network no hay peticiones repetidas en bucle.
- [x] Al cambiar de sucursal, cada pantalla probada recarga con los datos de la nueva sucursal y nunca muestra los de la anterior.
- [ ] Al forzar el fallo de una server action, por ejemplo con un `throw` temporal en `getSuggestedProducts`, la pantalla deja de mostrar "Cargando...". Si ya tenía UI de error, el mensaje aparece ahí.

**Por subpatrón (muestra de prueba manual)**

- [x] **D1, `inventario` y `pedidos`:** cargan, recargan al cambiar de sucursal y, en `pedidos`, al cambiar cualquier filtro.
- [x] **D1, `StockMovementsTable`:** cambiar de página o de filtro carga los datos correctos; el parpadeo durante la carga es aceptado.
- [x] **D1, `citas/page`:** al cambiar de sucursal se muestra su primer calendario, y se puede elegir otro.
- [ ] **D1, `PacientesFaltantes`:** con `dias` vacío o menor que 1 se muestra el estado vacío (aceptado). Con un valor válido, carga.
- [ ] **D1, consulta:**
  - la pestaña General muestra antecedentes, servicios, productos, podólogo, sucursal y patologías igual que antes;
  - finalizar la consulta actualiza `fecha_fin` sin recargar la página.
- [ ] **D3, `RegisterMovementModal` y `ProductFormModal`:**
  - escribir rápido lanza una sola petición después del debounce;
  - con menos de 2 caracteres no busca y limpia los resultados;
  - el indicador de búsqueda se comporta igual que hoy.
- [ ] **D3, `ProductFormModal`:** cerrar el modal o seguir escribiendo cancela la búsqueda en curso (petición `canceled` en Network).
- [ ] **D4, `recepciones/[id]`:** propone las cantidades pendientes y deja editarlas.
- [ ] **D4, `EditOrderTemplateModal`:** carga el nombre y los items de la plantilla y deja editarlos.
- [ ] **D4, `TabProductos` / `TabServicios`:** agregar, editar y quitar se refleja al instante en la lista y en el total de la pestaña Pagar.
- [ ] **D2, `servicios`:** guardar, borrar y "Copiar servicios" recargan la lista.
- [ ] **D2, `conteos/[id]`:** guardar el avance no borra los valores capturados.
- [ ] **D2, `pedidos/[id]`:** cancelar el pedido recarga el detalle con el nuevo estado.
- [ ] **D2, expediente:** crear o editar una consulta o un antecedente recarga su lista.
- [ ] **`EstadisticasCharts`:**
  - escribir fechas no recarga y "Aplicar" sí;
  - en modo no global, cambiar de sucursal recarga;
  - en modo global arranca con todas las sucursales seleccionadas.

**Resto de pantallas**

- [ ] Las pantallas tocadas que no están en la muestra abren sin errores en la consola y muestran sus datos (vistazo rápido).
- [x] La spec registra qué pruebas manuales se ejecutaron y cuáles no.

### Verificación (2026-10-15)

- **Ejecutado (automático):** `npm run lint` (0/0), `npx tsc --noEmit` y `npm run build` después de cada paso. Los conteos de lint coincidieron con el plan en todos los pasos: 43 → 43 → 34 → 26 → 24 → 20 → 8 → 3 → 1 → 0. *(En el paso 6 hubo un 9 intermedio, que se corrigió dentro del mismo paso; ver Decisiones, `usuarios`.)*
- **Ejecutado en navegador (2026-10-15, `localhost:3000`, usuario Superadmin / rol 4, contando los POST de server actions con un wrapper de `fetch`):**
  - **Pedidos:** filtro de estado = 1 petición; limpiarlo recarga las 10 filas; cambiar de sucursal muestra otros pedidos; 0 peticiones en reposo.
  - **Inventario:** carga 51 productos y recarga al cambiar de sucursal.
  - **Movimientos:** en la sucursal 1, página 1 de 2 (37) → página 2 con 1 petición y filas distintas; 0 en reposo. El parpadeo no se llegó a observar a los 300 ms.
  - **Citas:** las sucursales 1 y 2 muestran su único calendario; la 5 muestra el 1.º y se puede elegir el 2.º.
  - **EstadisticasCharts (modo global):** arranca con las 8 casillas marcadas; escribir fechas = 0 peticiones; "Aplicar" = 1.
  - **Servicios:** carga 3 servicios y recarga al cambiar de sucursal; 0 peticiones en reposo.
  - **Consulta #1 del paciente 1:** la pestaña General se ve completa (paciente, antecedentes, valoración); Servicios, Productos y Pagar abren sin quedarse en "Cargando"; 0 peticiones en reposo.
  - **Vistazo (14 pantallas):** pacientes, productos, proveedores, sucursales, usuarios, ventas, tratamientos, enlaces, conteos, conteos/nuevo, recepciones, solicitudes, solicitudes/nueva y pedidos/nuevo muestran datos y ninguna se queda en "Cargando". **No se leyó la consola.**
- **Sin ejecutar** (por eso siguen sin marcar): el `throw` temporal en `getSuggestedProducts`; `PacientesFaltantes` (no aparece en el dashboard del usuario probado); `EstadisticasCharts` en modo no global (el usuario es rol 4); los debounce de `RegisterMovementModal` y `ProductFormModal` y la cancelación `canceled`; D4 de `recepciones/[id]` y `EditOrderTemplateModal`; agregar/editar/quitar y finalizar en la consulta; guardar/borrar/copiar en Servicios; guardar avance en `conteos/[id]`; cancelar un pedido; crear/editar consulta o antecedente. Casi todas modifican datos reales.

## Decisiones

**Tomadas:**

- **Hook compartido de fetch, con estado `{ key, data, error }` y `loading` derivado.** Quedó decidido en la 82 y aquí no se reabrió. Evita arreglar 43 effects a mano con 43 variantes del mismo patrón.
- **Una sola spec con los 43 errores**, en vez de dividirla en 84/86/87 por subpatrón como se propuso. Lo decidió el usuario. El riesgo de tocar unas 40 pantallas se mitiga con un plan de pasos pequeños, cada uno con su conteo de lint, que empieza por las cargas de solo lectura para validar el hook antes de las pantallas con mutaciones.
- **`data` solo existe para la key actual.** No se conservan los datos de la key anterior mientras carga la nueva.
  - Hoy casi todas las pantallas ocultan los datos con `if (loading)`, así que se ve igual.
  - Es más simple y nunca muestra datos de otra sucursal.
  - Se acepta el parpadeo de la tabla paginada de movimientos.
- **`reload()` se comporta igual que un cambio de key:** `data` pasa a `undefined` y `loading` a `true`. Es lo que hacen hoy las `fetchX` con `setLoading(true)` (se verificó en las 19 de D2). Devuelve una `Promise` para que los `await fetchX()` después de guardar sigan funcionando igual.
- **El hook captura los rechazos y los expone en `error`.** Es el único cambio de comportamiento permitido: elimina el "Cargando..." infinito cuando una server action truena. No se agrega UI de error donde hoy no hay.
- **Dos variantes: `useAsyncData` (genérico) y `useActionData` (desenvuelve `ActionResult`).** Las pantallas de inventario repiten el mismo `if (result.ok) ... else setError(result.message)`, que pasa a vivir en un solo lugar.
- **`ActionResultLike` es estructural.** `ActionResult` está redefinido en cada `actions.ts` y no existe un tipo único. Un tipo estructural evita que un hook de cliente importe de `app/`.
- **`key = null` significa "no cargar"**, como el `useSWR(null)` convencional. Reemplaza los `if (!selectedId) return;`.
- **Key como arreglo de primitivos, serializada con `JSON.stringify`.** Las pantallas no tienen que armar un string. Los primitivos garantizan que la key no cambie en cada render.
- **`useEffectEvent` para leer el fetcher.** Es estable en React 19.2.3. Los llamadores pueden pasar el fetcher en línea sin `useCallback`, y el effect solo depende de la key.
- **`AbortSignal` en el fetcher.** Conserva la cancelación que ya tiene `ProductFormModal` con el catálogo SAT. Las server actions lo ignoran, y la respuesta tardía se descarta de todos modos por la key.
- **`mutate` para listas editadas localmente** (`TabProductos`, `TabServicios`, `fecha_fin` de la consulta). Evita duplicar en otro `useState` los datos que ya viven en el hook.
- **"Ajustar estado durante el render" con `initializedForKey` para formularios** (`values`, `decisions`, `quantities`, `name`/`items`). Lo que el usuario escribe es estado suyo, no del servidor, y no debe vivir en la caché ni pisarse con `mutate`. Es el mismo patrón que usó la 82.
- **`initializedForKey` compara la key base, sin `reloadVersion`.** Así, guardar el avance de un conteo y recargar no reinicializa lo capturado; solo un cambio de id o de sucursal lo hace.
- **`useDebouncedValue` como hook aparte**, en vez de una opción `debounceMs` en `useAsyncData`. Separa dos responsabilidades, se puede reusar fuera de las búsquedas, y `searching` se deriva sin estado propio.
- **`EstadisticasCharts` usa "filtros aplicados" en estado, que actualiza el botón.** Conserva la regla de que escribir fechas no recarga. La selección global inicial se deriva, y desaparecen el effect y el `ref`.
- **Los effects que el linter no marca se quedan como están**, aunque vivan en los archivos tocados. Así el diff queda auditable contra la línea base, el mismo criterio de la 81.
- **Prueba manual por muestra de subpatrón más un vistazo al resto**, en vez de probar a fondo las ~40 pantallas. Se registra qué se ejecutó y qué no, como en la 81.
- **`PacientesFaltantes` muestra el estado vacío con `dias < 1`**, en vez de la lista anterior. Lo aceptó el usuario.

**Tomadas durante la implementación:**

- **`consultas/[id_consulta]/page`: todo lo cargado vive en el hook.** La página llenaba más que `fecha_fin`. `valoracion`, `patologia`, `pagos`, `archivos`, `proceso` y `consulta` se actualizan con `mutate`. Los cuatro formularios (valoración, patología y los dos detalles de dedos) se llenan con `initializedForKey`. Lo eligió el usuario.
- **`conteos/[id]`: `initializedForKey` incluye `header.status`.** Es una excepción a "solo la key base".
  - Al finalizar el primer conteo, la recarga puede traer `segundo_conteo`, cuyo `second_count` está vacío. Hoy la segunda captura empieza vacía, y con la key base arrancaría con los números del primer conteo.
  - Una recarga con el mismo estado sigue sin pisar lo capturado.
  - Lo eligió el usuario.
- **`pedidos/nuevo/page` usa `useAsyncData`, no `useActionData`.** Así, si fallan los sugeridos, el resumen se sigue mostrando, como antes.
- **`usuarios`, `useExpediente` y `useExpedienteMedico` migran todo el effect marcado.** Al quitar solo la carga con `setLoading`, el linter marcaba lo que quedaba del mismo effect (roles y sucursales; paciente, antecedentes, podólogos y sucursales), así que esas cargas también pasaron al hook.
  - En `useExpediente`, la lista filtrada de podólogos por sucursal vive en un estado aparte, `podologosForSucursal`, en lugar de reemplazar el `data` del hook.
  - `usuarios` y `useExpediente` conservan "Cargando" mientras no hay usuario (`!user || loading`).
- **`tratamientos`: la búsqueda en BD guarda sus resultados en su propio estado**, en lugar de sobrescribir la lista del hook. `searched` decide qué se muestra. `especialistaId` (rol 5) entra en la key, porque el fetcher lo lee.
- **`EstadisticasCharts`:** en modo no global, cambiar de sucursal usa las fechas **aplicadas**, no las escritas sin aplicar. "Aplicar" con filtros que dan la misma key llama a `reload()`, porque antes siempre volvía a pedir los datos.
- **`ProductFormModal`:** con menos de 2 caracteres en el campo no se muestran resultados ni "Buscando…", aunque el debounce no haya alcanzado al texto, igual que hoy. La búsqueda en curso se aborta cuando cambia el término con debounce o cuando se cierra el modal, no en cada tecla.
- **Vacíos estables** (`NO_PAGOS`, `NO_PRODUCTOS`, etc.) donde un effect, un `useMemo` o una comparación en el render dependen de la identidad de la lista. Un `?? []` nuevo en cada render dejaría, por ejemplo, a `TabPagar` en un bucle de renders si la carga falla.
- **`useAsyncData`**, en dos puntos que el modelo de datos no detallaba:
  - Al desmontar resuelve todas las recargas pendientes, incluidas las pedidas en el mismo evento que el desmontaje.
  - Un fetcher que lanza de forma síncrona también termina en `error`.
- **La rama se creó desde `spec-85-validar-proveedor-orden-compra`**, así que incluye su commit `162c429`.

**Descartadas:**

- *Dividir en 84 (D1), 86 (D2) y 87 (D3 + D4):* el usuario prefirió una sola spec.
- *SWR o TanStack Query:* agregan una dependencia y una caché global que no hacen falta. Ya se había descartado en la 82.
- *Migrar las pantallas a Server Components:* la mayoría depende de `SucursalContext`, que es estado del cliente. Cada migración sería su propia spec.
- *Conservar los datos de la key anterior (stale-while-revalidate):* agrega complejidad y puede mostrar por un momento datos de otra sucursal.
- *`reload()` que conserve los datos y exponga `reloading`:* sería inconsistente con el cambio de key y cambiaría lo que hoy se ve después de guardar.
- *Dejar que los rechazos sigan sin capturarse:* conserva el "Cargando..." infinito.
- *Agregar mensajes de error donde hoy no hay:* es un cambio de UI fuera del objetivo de lint.
- *Un solo hook que detecte `ActionResult` en tiempo de ejecución:* el tipo del resultado no se podría inferir bien, y adivinar por la forma del objeto es frágil.
- *Opción `debounceMs` dentro de `useAsyncData`:* mezcla dos responsabilidades y complica `loading`.
- *`mutate` también para los formularios:* mezcla el estado del usuario con el del servidor, y un `reload()` borraría lo capturado.
- *Envolver cada fetcher en `useCallback`:* es más ruido en ~40 archivos y es fácil equivocarse con las dependencias. `useEffectEvent` lo resuelve en el hook.

## Riesgos

- **Datos viejos porque falta un valor en la key.** Con `useEffectEvent`, el fetcher siempre lee los valores actuales, pero solo vuelve a pedir datos cuando cambia la key. Si el fetcher usa un filtro que no está en la key, cambiar ese filtro no recarga, y ningún lint lo detecta (`exhaustive-deps` no revisa la key).
  - *Mitigación:* regla de implementación: **todo valor que lea el fetcher debe estar en la key.** De preferencia, el fetcher arma sus argumentos solo con valores que también estén en ella.
  - Cada paso del plan revisa esto archivo por archivo, y la prueba manual cambia cada filtro.

- **Un `await reload()` que nunca se resuelve.** Si la key cambia o el componente se desmonta antes de que llegue la respuesta, el resolver de esa recarga podría quedar pendiente. Un handler que hace `await reload()` antes de cerrar un modal se quedaría colgado.
  - *Mitigación:* el cleanup del effect (abort) resuelve los resolvers pendientes de esa versión.

- **Un `reload()` que pisa lo que el usuario capturó.** En `conteos/[id]` y `revision`, si el formulario se reinicializara con cada respuesta nueva, guardar el avance y recargar reemplazaría los valores escritos.
  - *Mitigación:* `initializedForKey` compara la **key base**, sin `reloadVersion`. Una recarga no reinicializa el formulario; solo lo hace un cambio de key (otro id u otra sucursal).

- **Doble petición por *Strict Mode* en desarrollo.** El effect se monta, se desmonta y se vuelve a montar, así que la primera petición se aborta.
  - *Mitigación:* un abort no cuenta como error ni escribe estado. Ya pasa hoy con los effects actuales, sin abort, y no es una regresión.

- **`mutate` mientras hay una recarga en curso.** Con `data = undefined`, `mutate` no hace nada, y el cambio local se pierde hasta que llega la respuesta del servidor.
  - *Mitigación:* en `TabProductos`, `TabServicios` y la consulta, `mutate` se llama después de que la server action ya guardó, así que la recarga trae el mismo dato. No hay flujos que llamen `reload()` y `mutate` en el mismo evento.

- **`useEffectEvent` y el plugin de lint.** Si la versión de `eslint-plugin-react-hooks` que trae `eslint-config-next` 16.1.6 se queja de su uso, el paso 1 no cerraría limpio.
  - *Mitigación:* se valida en el paso 1, antes de migrar pantallas. Plan B: un `ref` actualizado en `useLayoutEffect`. Si hay que usarlo, se anota en Decisiones.

- **Regresión en alguna de las ~40 pantallas por un diff grande.** La spec no se dividió y la prueba manual es por muestra.
  - *Mitigación:*
    - pasos agrupados por subpatrón, cada uno con su conteo de lint esperado y su propio commit;
    - pantallas fuera de la muestra con un vistazo rápido;
    - en la spec queda registrado qué se probó y qué no.

- **El conteo intermedio no coincide con el plan.** Reescribir un effect podría quitar o agregar errores en otro lugar del mismo archivo.
  - *Mitigación:* el criterio de fondo es llegar a **0** al final. Si un paso intermedio no coincide, se anota la razón al cerrar la spec.

## Lo que **no** incluye esta spec

- Los effects de carga que el linter no marca.
- Stale-while-revalidate, caché compartida, deduplicación o revalidación al enfocar.
- Mensajes de error nuevos en pantallas que hoy no muestran ninguno.
- SWR, TanStack Query o migración a Server Components.
- Paginación o virtualización nuevas.
- Cambios en `eslint.config.mjs`, lint en CI o arreglos que el linter no reporte.

Si alguno de estos puntos se hace, va en su propia spec.
