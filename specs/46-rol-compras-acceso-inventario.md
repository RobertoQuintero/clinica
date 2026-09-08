# 46 — Rol Compras: acceso exclusivo a Inventario

## Header

- **Estado:** Implementado
- **Depende de:** [[45-inventario-actual]] (ruta `/dashboard/inventario`, primer hijo del grupo "Inventario")
- **Modifica base de datos:** No (el rol 6 "Compras" ya existe en la tabla de roles; esta spec es solo enrutamiento/UI).
- **Fecha:** 2026-09-08
- **Objetivo:** Restringir al rol 6 (Compras) a únicamente el grupo "Inventario" (sus 7 sub-secciones), tanto en el sidebar como server-side en `proxy.ts`, dejando intactas las restricciones admin-only ya existentes dentro de ese módulo (Stock Mínimo, revisión/cierre de Conteos).

## Alcance

**Incluye:**

- **`app/dashboard/componentes/navConfig.tsx`**: agregar `6` al array `excludeRoles` de todos los `NavLink` de nivel superior excepto "Inventario": Dashboard, Pacientes, Citas, Servicios, Sucursales, Enlaces, Ventas, Tratamientos, Empleados, Usuarios. El grupo "Inventario" (y sus 7 `NavChild`: Inventario Actual, Productos, Proveedores, Pedidos, Recepciones, Movimientos, Conteos) queda visible para el rol 6 sin cambios.
- **`proxy.ts`**: nueva regla, siguiendo el mismo patrón que la de `id_role === 5`: si `userPayload?.id_role === 6` y la ruta no empieza con ninguna de `/dashboard/inventario`, `/dashboard/productos`, `/dashboard/proveedores`, `/dashboard/pedidos`, `/dashboard/recepciones`, `/dashboard/movimientos`, `/dashboard/conteos`, redirigir a `/dashboard/inventario`. Esto cubre automáticamente `/`, `/dashboard` y cualquier otra ruta fuera de Inventario (mismo mecanismo de redirección en cascada que ya usa el rol 5 hacia `/dashboard/tratamientos`).
- El rol 6 puede editar libremente dentro de Productos, Proveedores, Pedidos, Recepciones, Movimientos y Conteos (crear/editar/eliminar registros, generar pedidos, registrar recepciones, capturar conteos), igual que cualquier otro rol con acceso hoy — sin gates nuevos de escritura.

**No incluye:**

- Cambios a las restricciones admin-only ya existentes dentro de Inventario: `canEditMinStock` (`app/dashboard/productos/actions.ts`, solo `id_role` 1 y 4) y `SUPERVISOR_ROLE_IDS` (`app/dashboard/conteos/actions.ts`, solo 1 y 4, más su gate en `proxy.ts` para `/dashboard/conteos/[id]/revision`). El rol 6 queda igual de limitado ahí que cualquier usuario no-admin con acceso a Inventario.
- Cambios a la tabla de roles en base de datos — el rol 6 "Compras" ya existe según lo indicado por el usuario.
- Cambios a `interfaces/auth.ts`, `interfaces/roles.ts` o `UsuarioModal.tsx` — `id_role` ya es `number` genérico y el selector de roles en Usuarios ya lista roles dinámicamente desde la BD, así que el rol 6 aparece ahí sin tocar código.
- Cualquier permiso nuevo sobre `/dashboard/usuarios`, `/dashboard/empleados` o `/dashboard/facturacion` para el rol 6 — quedan fuera de su alcance, igual que el resto de secciones no-Inventario.
- Cambios a `/dashboard/inventario` (Inventario Actual) en sí — sigue siendo una vista de solo consulta (spec 45), sin acciones de edición que otorgar ahí.

## Modelo de datos

No se introducen estructuras de datos nuevas (ni columnas, ni interfaces, ni server actions, ni cambios al rol 6 en base de datos — ya existe). Esta spec solo modifica arrays de configuración (`excludeRoles` en `navConfig.tsx`) y lógica de enrutamiento (`proxy.ts`), por lo que se omite el resto de esta sección.

## Plan de implementación

1. **`app/dashboard/componentes/navConfig.tsx`**: agregar `6` al `excludeRoles` de cada `NavLink` de nivel superior salvo "Inventario":
   - `Dashboard` → `[5]` a `[5, 6]`
   - `Pacientes` → `[5]` a `[5, 6]`
   - `Citas` → `[5]` a `[5, 6]`
   - `Servicios` → `[5]` a `[5, 6]`
   - `Sucursales` → `[5]` a `[5, 6]`
   - `Enlaces` → `[3, 5]` a `[3, 5, 6]`
   - `Ventas` → `[5]` a `[5, 6]`
   - `Tratamientos` → `[]` a `[6]`
   - `Empleados` → `[2, 3, 5]` a `[2, 3, 5, 6]`
   - `Usuarios` → `[2, 3, 5]` a `[2, 3, 5, 6]`
   - "Inventario" (grupo) queda sin cambios: `excludeRoles: [5]`.

   *Verificación:* con un usuario de rol 6, el sidebar solo muestra el grupo "Inventario" con sus 7 hijos; ningún otro `NavLink` es visible.

2. **`proxy.ts`**: dentro del bloque `pathname.startsWith("/dashboard")`, después de la regla del rol 5, agregar:
   ```ts
   const INVENTORY_PATH_PREFIXES = [
     "/dashboard/inventario",
     "/dashboard/productos",
     "/dashboard/proveedores",
     "/dashboard/pedidos",
     "/dashboard/recepciones",
     "/dashboard/movimientos",
     "/dashboard/conteos",
   ];
   // id_role=6 (Compras) solo puede acceder al módulo de Inventario
   if (
     userPayload?.id_role === 6 &&
     !INVENTORY_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
   ) {
     return NextResponse.redirect(new URL("/dashboard/inventario", req.url));
   }
   ```
   (Colocarlo antes de las reglas admin-only existentes de `/dashboard/conteos/[id]/revision`, `/dashboard/usuarios`, etc. — esas siguen aplicando sin cambios, ya que el rol 6 no está en sus listas de `id_role` permitidos.)

   *Verificación:* con un usuario de rol 6, visitar `/`, `/dashboard`, `/dashboard/pacientes`, `/dashboard/tratamientos`, `/dashboard/usuarios`, etc. redirige a `/dashboard/inventario`; visitar cualquiera de las 7 rutas de Inventario carga normalmente; visitar `/dashboard/conteos/<id>/revision` sigue redirigiendo a `/dashboard/conteos` (regla admin-only preexistente, no tocada).

3. **Verificación manual de edición**: con el mismo usuario de rol 6, confirmar que puede crear/editar/eliminar en Productos, Proveedores, Pedidos, Recepciones y Movimientos, y capturar un Conteo — pero que intentar editar el Stock Mínimo de un producto o revisar/cerrar un conteo se comporta igual que para un usuario no-admin hoy (bloqueado).

4. `npm run build` sin errores de TypeScript.

Cada paso deja el sistema funcional y compilando.

## Criterios de aceptación

- [x] Un usuario con `id_role = 6` ve en el sidebar únicamente el grupo "Inventario" con sus 7 hijos (Inventario Actual, Productos, Proveedores, Pedidos, Recepciones, Movimientos, Conteos); ningún otro `NavLink` (Dashboard, Pacientes, Citas, Servicios, Sucursales, Enlaces, Ventas, Tratamientos, Empleados, Usuarios) es visible.
- [x] Un usuario con `id_role = 6` que visita `/`, `/dashboard` o cualquier ruta fuera de las 7 de Inventario es redirigido server-side a `/dashboard/inventario`.
- [x] Un usuario con `id_role = 6` puede acceder libremente a las 7 rutas de Inventario (`/dashboard/inventario`, `/dashboard/productos`, `/dashboard/proveedores`, `/dashboard/pedidos`, `/dashboard/recepciones`, `/dashboard/movimientos`, `/dashboard/conteos`) sin ser redirigido.
- [x] Un usuario con `id_role = 6` puede crear, editar y eliminar registros en Productos, Proveedores, Pedidos, Recepciones y Movimientos, y capturar un Conteo físico, igual que cualquier otro rol con acceso hoy.
- [x] Un usuario con `id_role = 6` **no** puede editar el Stock Mínimo de un producto (sigue reservado a `id_role` 1 y 4 vía `canEditMinStock`).
- [x] Un usuario con `id_role = 6` **no** puede revisar/cerrar un Conteo físico; visitar `/dashboard/conteos/<id>/revision` redirige a `/dashboard/conteos` (sigue reservado a `id_role` 1 y 4 vía `SUPERVISOR_ROLE_IDS` y su gate en `proxy.ts`).
- [x] El rol 6 "Compras" aparece seleccionable en el formulario de creación/edición de usuarios (`UsuarioModal.tsx`) sin cambios de código, listado dinámicamente desde la tabla de roles.
- [x] Los roles 1, 2, 3, 4 y 5 no cambian su comportamiento actual (sin regresiones en `navConfig.tsx` ni `proxy.ts`).
- [x] `npm run build` compila sin errores ni warnings nuevos.

## Decisiones tomadas y descartadas

- **Acceso completo a las 7 sub-secciones de Inventario, no un subconjunto.** Decisión del usuario: el rol 6 "Compras" necesita el módulo completo (incluyendo Inventario Actual, de solo consulta) en vez de solo Productos/Pedidos; evita tener que revisitar esta spec si más adelante necesita, por ejemplo, Recepciones o Conteos.
- **Bloqueo server-side en `proxy.ts`, no solo ocultar del sidebar.** Igual que el rol 5, se decidió no dejar el hueco de que alguien con rol 6 pueda teclear una URL fuera de Inventario y acceder aunque el menú no la muestre — consistente con el nivel de seguridad ya aplicado a rol 5.
- **Redirigir a `/dashboard/inventario` (vista de solo lectura) como landing, no a `/dashboard/productos`.** Mismo patrón que rol 5 → `/dashboard/tratamientos`: aterriza en la vista general del módulo antes de que el usuario elija una sub-sección concreta para editar.
- **Mantener intactas las restricciones admin-only dentro de Inventario (Stock Mínimo, revisión/cierre de Conteos).** Decisión explícita del usuario: el rol 6 puede editar dentro de Inventario, pero no se le otorgan los permisos de supervisor que hoy solo tienen `id_role` 1 y 4 — evita ampliar el alcance de "puedan realizar ediciones" más allá de lo pedido.
- **No se modifica la tabla de roles ni `interfaces/auth.ts`/`interfaces/roles.ts`.** El rol 6 ya existe en base de datos (agregado por el usuario) y `id_role` ya es un `number` genérico en todo el código; no hay un enum de roles que actualizar.
- **Sin cambios a `/dashboard/inventario` (Inventario Actual, spec 45).** Sigue siendo una vista de solo consulta sin acciones de escritura; "puedan realizar ediciones" se cumple a través de las otras 6 sub-secciones del módulo, que ya son editables.
