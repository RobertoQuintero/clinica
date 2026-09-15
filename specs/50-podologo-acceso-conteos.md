# 50 — Acceso del Podólogo (rol 2) a Conteos

## Header

- **Estado:** Implementado
- **Depende de:**
  - [[48-pre-solicitudes-productos-podologo]] — patrón de gating por rol (`navConfig.tsx` + `proxy.ts`) que esta spec extiende: agrega "Conteos" a la lista de hijos de Inventario visibles para el rol 2.
  - [[46-rol-compras-acceso-inventario]] — origen del patrón `excludeRoles` / `INVENTORY_PATH_PREFIXES`.
- **Modifica base de datos:** No.
- **Fecha:** 2026-09-15
- **Objetivo:** Permitir que el rol 2 (Podólogo) acceda a la sub-sección "Conteos" de Inventario con el mismo nivel de acceso que hoy tienen los roles 3 y 6 (crear conteos, capturar 1er/2do conteo, ver el listado sin columna de diferencias), sin abrir ninguna otra sub-sección de Inventario ni la pantalla de revisión/cierre.

## Alcance

**Incluye:**

- En `navConfig.tsx`: quitar `excludeRoles: [2]` del hijo `{ href: "/dashboard/conteos", label: "Conteos", icon: ClipboardCheck }` dentro del grupo "Inventario". El rol 2 verá en el sidebar "Solicitudes" y "Conteos" (los otros 5 hijos siguen ocultos para él).
- En `proxy.ts`: el redirect server-side que manda al rol 2 a `/dashboard/solicitudes` al visitar cualquier ruta de Inventario deja de aplicar a `/dashboard/conteos`. Se logra separando la lista usada para ese chequeo de `INVENTORY_PATH_PREFIXES` (que debe seguir intacta para el gate del rol 6), quitando `/dashboard/conteos` solo de la copia usada para el rol 2.
- El chequeo ya existente en `proxy.ts` que restringe `/dashboard/conteos/[id]/revision` a roles 1 y 4 sigue aplicando sin cambios — por lo tanto el rol 2 queda automáticamente bloqueado de revisar/cerrar conteos, sin tocar ese bloque.
- Sin cambios en `app/dashboard/conteos/actions.ts`: la creación y captura de conteos ya está abierta a cualquier usuario autenticado con acceso a la ruta (gate es solo por rol de sidebar/proxy), y el listado ya oculta `items_with_difference` para quien no sea supervisor (roles 1/4) — el rol 2 hereda ese mismo comportamiento sin código nuevo.

**No incluye:**

- **Ningún cambio a otras sub-secciones de Inventario** (Inventario Actual, Productos, Proveedores, Pedidos, Recepciones, Movimientos) — siguen redirigiendo al rol 2 a `/dashboard/solicitudes`.
- **Acceso del rol 2 a `/dashboard/conteos/[id]/revision`** — sigue exclusivo de roles 1 y 4, sin cambios en ese bloque de `proxy.ts` ni en `assertSupervisorRole`/`SUPERVISOR_ROLE_IDS` de `actions.ts`.
- **Cambios a `SUPERVISOR_ROLE_IDS` o a cualquier lógica de `conteos/actions.ts`** — el rol 2 usa exactamente el mismo camino de código que hoy usan los roles 3 y 6.
- **Badge, notificaciones o contadores nuevos para Conteos** — no existe hoy ese badge para ningún rol; esta spec no lo introduce.
- **Cambios a los roles 1, 3, 4, 5 y 6** — sin regresiones; ninguno de ellos cambia su acceso actual.
- **Cambios al modelo de datos** (`inventory.stock_counts`, `stock_count_items`, etc.) — no aplica.

## Plan de implementación

1. **`navConfig.tsx` — abrir "Conteos" al rol 2.**
   Quitar `excludeRoles: [2]` del hijo `{ href: "/dashboard/conteos", label: "Conteos", icon: ClipboardCheck }` dentro del grupo "Inventario" (línea 61 actual). El resto de los hijos del grupo no cambia.

   *Verificación:* con un usuario rol 2, el grupo "Inventario" del sidebar muestra "Solicitudes" y "Conteos"; los otros 5 hijos siguen ocultos.

2. **`proxy.ts` — excluir `/dashboard/conteos` del redirect del rol 2.**
   Derivar de `INVENTORY_PATH_PREFIXES` (que se deja intacto, porque el gate del rol 6 sigue necesitando las 7 rutas) una lista separada para el chequeo del rol 2, por ejemplo `ROLE_2_BLOCKED_INVENTORY_PREFIXES = INVENTORY_PATH_PREFIXES.filter((prefix) => prefix !== "/dashboard/conteos")`, y usar esa lista en la condición `if (userPayload?.id_role === 2 && ...)`. El bloque de revisión (`/^\/dashboard\/conteos\/[^/]+\/revision/`, exclusivo de roles 1/4) no se toca.

   *Verificación:* con rol 2, teclear `/dashboard/conteos` y `/dashboard/conteos/nuevo` carga normal; teclear `/dashboard/productos`, `/dashboard/pedidos`, `/dashboard/inventario`, etc. sigue redirigiendo a `/dashboard/solicitudes`; teclear `/dashboard/conteos/<id>/revision` redirige a `/dashboard/conteos` (igual que hoy para roles 3/6).

3. **Verificación manual end-to-end y `npm run build`.**
   Con un usuario rol 2: crear un conteo nuevo, capturar el primer conteo, ver el listado (sin columna de diferencias), y confirmar que no puede acceder a `/revision`. Confirmar que Solicitudes y el resto del sistema (Pacientes, Citas, Tratamientos, Ventas, Servicios, Sucursales) siguen funcionando igual que antes.

Cada paso deja el sistema funcional y compilando.

## Criterios de aceptación

- [x] Un usuario con `id_role = 2` ve en el grupo "Inventario" del sidebar los hijos "Solicitudes" y "Conteos"; los otros 5 (Inventario Actual, Productos, Proveedores, Pedidos, Recepciones, Movimientos) no aparecen.
- [x] Un usuario con `id_role = 2` puede visitar `/dashboard/conteos`, `/dashboard/conteos/nuevo` y `/dashboard/conteos/[id]` sin ser redirigido.
- [x] Un usuario con `id_role = 2` que visita `/dashboard/productos`, `/dashboard/proveedores`, `/dashboard/pedidos`, `/dashboard/recepciones`, `/dashboard/movimientos` o `/dashboard/inventario` sigue siendo redirigido server-side a `/dashboard/solicitudes` (sin cambio respecto a hoy).
- [x] Un usuario con `id_role = 2` que visita `/dashboard/conteos/[id]/revision` es redirigido server-side a `/dashboard/conteos` (mismo comportamiento que hoy tienen los roles 3 y 6).
- [x] Un usuario con `id_role = 2` puede crear un conteo nuevo y capturar el primer/segundo conteo de punta a punta.
- [x] El listado de `/dashboard/conteos` para un usuario con `id_role = 2` no muestra la columna/dato de diferencias (`items_with_difference`), igual que para los roles 3 y 6 hoy.
- [x] Los roles 1, 3, 4, 5 y 6 no cambian su comportamiento actual en `navConfig.tsx` ni en `proxy.ts` (sin regresiones).
- [x] El acceso del rol 2 a Dashboard, Pacientes, Citas, Servicios, Sucursales, Ventas, Tratamientos y Solicitudes queda intacto.
- [x] `npm run build` compila sin errores de TypeScript ni warnings nuevos.

## Decisiones tomadas y descartadas

- **Separar la lista de rutas bloqueadas para el rol 2 de `INVENTORY_PATH_PREFIXES` en vez de modificar ese arreglo directamente.** `INVENTORY_PATH_PREFIXES` también gatea al rol 6 (Compras), que sí debe seguir restringido a las 7 rutas de Inventario incluyendo Conteos. Modificarlo en sitio habría abierto Conteos también para validaciones que no son las del rol 2. Se deriva una lista filtrada solo para el chequeo del rol 2.
- **No tocar el bloqueo de `/revision` a roles 1/4.** Ese chequeo ya es independiente del rol 2 (compara contra `id_role !== 1 && id_role !== 4`), así que abrir Conteos al rol 2 no requiere ningún cambio ahí — el rol 2 queda bloqueado de revisar/cerrar automáticamente, igual que los roles 3 y 6 hoy.
- **No agregar lógica nueva en `conteos/actions.ts`.** La creación y captura de conteos ya está abierta a cualquier usuario autenticado con acceso a la ruta; el gate es puramente de navegación (sidebar + proxy), igual que el patrón que estableció la spec 48 para Solicitudes. Añadir un chequeo de rol ahí sería redundante y divergiría del patrón ya usado por los roles 3/6.
- **Sin badge ni indicador nuevo para el rol 2 en Conteos.** No existe ese badge para ningún rol hoy (a diferencia de Solicitudes); esta spec solo abre acceso, no agrega funcionalidad nueva.
