# 06 — Sidebar colapsable

## Header

- **Estado:** Aprobado
- **Depende de:** Ninguno
- **Fecha:** 2026-08-03
- **Objetivo:** Convertir el Navbar superior actual en un sidebar lateral colapsable (rail de iconos ↔ 240px expandido), con el diseño visual de `references/sidebar/`, navegando a las páginas del dashboard existentes y mostrando "Empleados" como item visible sin página funcional aún.

## Alcance

**Incluye:**
- Reemplazar el `Navbar.tsx` actual (barra superior + drawer móvil) por un componente `Sidebar.tsx` con dos modos en desktop/tablet:
  - **Expandido** (240px, ancho fijo del mockup): icono + texto por item.
  - **Colapsado** (rail angosto, solo iconos), con flyout al hacer hover sobre items que tienen submenú.
  - Botón para alternar entre expandido/colapsado, con el estado persistido en `localStorage`.
- En mobile: mantener el comportamiento actual de drawer overlay (oculto por defecto, botón hamburguesa lo abre/cierra), sin el modo rail.
- Header superior simple con lo que ya existe funcionalmente hoy: selector de sucursal, toggle de tema, nombre de usuario (abre modal de cambiar contraseña) y botón de logout. Sin buscador ni notificaciones del mockup.
- Aplicar la paleta de colores, tipografía y estilos (roundedness, shadows) definidos en `references/sidebar/DESIGN.md` al sidebar y header, vía Tailwind (reutilizando el sistema de temas claro/oscuro ya existente en el proyecto).
- Estructura de navegación del sidebar (roles ya existentes vía `id_role` se respetan igual que hoy):
  1. Dashboard → `/dashboard`
  2. Pacientes → `/dashboard/pacientes`
  3. Citas → `/dashboard/citas`
  4. Servicios → `/dashboard/servicios`
  5. Inventario (dropdown) → Productos → `/dashboard/productos`
  6. Sucursales → `/dashboard/sucursales`
  7. Enlaces → `/dashboard/enlaces`
  8. Ventas → `/dashboard/ventas`
  9. Tratamientos → `/dashboard/tratamientos`
  10. Empleados → sin `href` funcional, item visualmente deshabilitado (opacidad reducida, `cursor-not-allowed`, sin navegación al click), mismas reglas de visibilidad de rol que Usuarios (`excludeRoles: [2, 3, 5]`)
  11. Usuarios → `/dashboard/usuarios` (mismas reglas de rol que hoy: `excludeRoles: [2, 3, 5]`)
- Instalar `lucide-react` y usarlo para todos los iconos del sidebar/header (reemplazando los SVG inline del Navbar actual donde aplique).
- Ajustar `app/dashboard/layout.tsx` para el nuevo layout de sidebar fijo + contenido con margen dinámico según estado expandido/colapsado.
- Resaltado de item activo según `pathname` (igual que hoy, incluyendo el caso del submenú Inventario/Productos).

**No incluye:**
- Crear la página `/dashboard/empleados` ni ninguna lógica de backend/servidor relacionada a empleados.
- Buscador funcional ni sistema de notificaciones (no existen esas features; no se agregan versiones "fake" del mockup).
- Cambios a `proxy.ts` / lógica de autorización de rutas (los roles que ya redirigen o bloquean rutas se mantienen igual).
- Rediseño visual de las páginas internas del dashboard (pacientes, citas, etc.) — solo se toca el shell de navegación (sidebar + header).
- Foto de perfil / avatar de usuario real (el mockup usa una imagen; no hay esa funcionalidad hoy).

## Modelo de datos

No aplica — esta spec no introduce ni modifica tablas, columnas ni interfaces de dominio (`interfaces/*.ts`). El único estado nuevo es client-side:

- `localStorage` key `sidebar_collapsed` (`"true"` / `"false"`) para persistir el modo rail/expandido del sidebar entre sesiones.
- Un arreglo de configuración de navegación (análogo al `ALL_NAV_LINKS` actual) que ahora incluye `icon` (componente de `lucide-react`) y, para "Inventario", una lista de `children` para el submenú.

## Plan de implementación

1. Instalar `lucide-react` como dependencia del proyecto.
2. Definir la nueva configuración de navegación (reemplazo de `ALL_NAV_LINKS`): array con `href`, `label`, `icon` (componente de lucide-react), reglas de rol (`minRole`/`excludeRoles` igual que hoy), soporte de `children` para el grupo "Inventario" y flag `disabled` para "Empleados".
3. Renombrar `app/dashboard/componentes/Navbar.tsx` a `app/dashboard/componentes/Sidebar.tsx` y reestructurarlo para que reciba `children` (contenido de la página) y renderice el shell completo: `<aside>` fijo (rail colapsado / 240px expandido), `<header>` superior sticky (sucursal, tema, usuario + modal de cambiar contraseña, logout) y el wrapper de `<main>`, con márgenes izquierdos dinámicos según el ancho actual del aside.
4. Implementar el toggle de colapso: botón en el sidebar, estado `collapsed` persistido en `localStorage` (leído en el primer render del cliente), transición de ancho entre rail y 240px, y flyout/tooltip para "Inventario > Productos" cuando está colapsado.
5. Reimplementar el drawer mobile (breakpoint `<lg`) reutilizando el patrón de overlay + `translate-x` que ya existe hoy, deshabilitando el modo rail en ese breakpoint (mobile siempre usa drawer completo).
6. Aplicar la paleta de colores, tipografía (Inter) y estilos (radios, sombras) de `references/sidebar/DESIGN.md` al sidebar y header vía Tailwind, respetando el `ThemeContext` claro/oscuro ya existente en el proyecto.
7. Actualizar `app/dashboard/layout.tsx` para usar `<Sidebar>{children}</Sidebar>` en lugar de `<Navbar /><main>{children}</main>`.
8. Verificar manualmente en el navegador: login con distintos roles, navegación por cada ruta del sidebar, colapsar/expandir con persistencia tras recargar, submenú Inventario en ambos modos, drawer mobile, y modo claro/oscuro.

## Criterios de aceptación

- [ ] El sidebar reemplaza completamente la barra superior anterior; no queda navegación duplicada.
- [ ] En desktop/tablet, el sidebar tiene un botón que alterna entre modo expandido (240px, icono + texto) y modo rail (solo iconos).
- [ ] El estado colapsado/expandido persiste en `localStorage` y se respeta al recargar la página.
- [ ] En modo rail, al hacer hover sobre "Inventario" aparece un flyout con el link a "Productos".
- [ ] En mobile (`<lg`), el sidebar se comporta como drawer overlay (oculto por defecto, se abre con botón hamburguesa, se cierra con overlay o botón X), sin mostrar el modo rail.
- [ ] Todos los links del sidebar (Dashboard, Pacientes, Citas, Servicios, Productos, Sucursales, Enlaces, Ventas, Tratamientos, Usuarios) navegan a su ruta existente correspondiente.
- [ ] El item activo (según `pathname`) se resalta visualmente, incluyendo cuando la ruta activa es `/dashboard/productos` dentro del submenú Inventario.
- [ ] "Empleados" se muestra en el sidebar con estilo deshabilitado (opacidad reducida, `cursor-not-allowed`) y no navega a ningún lado al hacer click.
- [ ] "Empleados" y "Usuarios" están ocultos para los roles en `excludeRoles: [2, 3, 5]`, igual que hoy aplica para "Usuarios".
- [ ] El resto de items respeta las reglas de rol ya existentes (p. ej. `id_role === 5` solo ve Tratamientos, reforzado además por `proxy.ts`).
- [ ] El header superior mantiene: selector de sucursal (cuando hay más de una), toggle de tema, nombre de usuario con acceso al modal de cambiar contraseña, y botón de logout — todos funcionando igual que antes.
- [ ] El sidebar y header respetan el modo claro/oscuro del `ThemeContext`.
- [ ] La paleta de colores y tipografía visualmente se corresponden con `references/sidebar/DESIGN.md` (navy oscuro en el sidebar, Inter, radios de 4-8px).
- [ ] No hay errores de TypeScript ni de build (`npm run build` o equivalente) tras el cambio.

## Decisiones tomadas y descartadas

- **Rail colapsable en vez de ocultar completamente:** se eligió el modo rail (solo iconos) porque mantiene la navegación siempre accesible sin sacrificar espacio de contenido, en línea con el mockup de referencia. Se descartó el ocultamiento total porque perdería la ventaja de navegación rápida que ya tiene el drawer actual en mobile.
- **Header simple funcional, sin buscador ni notificaciones del mockup:** se descartó replicar el buscador/notificaciones del mockup porque no existe funcionalidad real detrás (búsqueda global, sistema de notificaciones) y agregar elementos decorativos sin función violaría la convención del proyecto de no dejar UI a medio implementar.
- **lucide-react en vez de Material Symbols (Google Fonts) o SVGs a mano:** se descartó Material Symbols para evitar dependencia de una fuente externa vía CDN (carga de red adicional, no versionada); se descartó seguir con SVGs inline a mano por la cantidad de iconos nuevos que requiere el sidebar completo (11+ items), donde una librería reduce código repetido.
- **Componente `Sidebar.tsx` envuelve `children` (controla aside + header + main):** se decidió así para poder compartir el estado de colapso entre el ancho del `<aside>` y el margen dinámico del `<header>`/`<main>`, evitando duplicar estado vía Context solo para este propósito.
- **Empleados con las mismas reglas de rol que Usuarios:** se decidió agrupar visibilidad de "Empleados" con "Usuarios" (`excludeRoles: [2, 3, 5]`) porque conceptualmente ambos son de gestión de personal/administración, aunque Empleados no tenga página aún.
- **No se toca `proxy.ts`:** las reglas de autorización de rutas ya existentes (role 5 restringido a Tratamientos, Usuarios restringido a roles 1 y 4) siguen siendo la autoridad real de acceso; el sidebar solo refleja esas reglas visualmente, no las reemplaza.

## Riesgos identificados

- **Hydration mismatch por `localStorage`:** el estado `collapsed` solo puede leerse en el cliente (`useEffect`), por lo que el primer render de servidor no lo conoce. Esto puede causar un salto visual breve (flash expandido→colapsado) al cargar la página si el usuario tenía guardado el modo rail. Se acepta como comportamiento esperado en este spec (mismo patrón que ya usa `ThemeContext`); no se implementa una solución tipo cookie/script anti-flash salvo que se vuelva molesto en la práctica.
- **Componentes que asumen el layout anterior:** al eliminar la barra superior fija y pasar a sidebar lateral, cualquier componente de página que calculara posiciones/alturas asumiendo el header viejo (p. ej. `sticky top-*` con offset fijo) podría necesitar ajuste. Se revisará durante la verificación manual del paso 8 del plan, pero no se audita el código de cada página por adelantado.
