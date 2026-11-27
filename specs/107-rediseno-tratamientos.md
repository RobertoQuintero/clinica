# SPEC 107 — Rediseño de tratamientos

> **Estado:** Implementado
> **Depende de:** SPEC 21, SPEC 34 y SPEC 36.
> **Fecha:** 2026-11-27
> **Objetivo:** Rediseñar el listado y el detalle de tratamientos de onicomicosis conforme a `references/DESIGN.md`, conservando sus funcionalidades actuales.

## Alcance

**Entra:**

- Rediseñar el listado de tratamientos y sus filas siguiendo los colores, la tipografía, el espaciado y los radios de `references/DESIGN.md`.
- Rediseñar la estructura del detalle y sus secciones propias: solicitud, pagos, egresos, recetas y consultas, incluidos sus formularios y visor de imágenes.
- Adaptar ambas pantallas a dispositivos móviles y a los temas claro y oscuro.
- Conservar los datos, las acciones, los permisos por rol y sucursal, y el comportamiento de búsqueda existentes.
- Revisar los estados visibles de carga, error y ausencia de datos para integrarlos al diseño.

**No entra:**

- Rediseñar los modales compartidos de cita, consulta y confirmación.
- Cambiar reglas de negocio, permisos, persistencia, estructura de base de datos o integraciones.
- Agregar funciones, filtros o datos nuevos.

## Modelo de datos

Esta especificación no introduce tablas, columnas ni estructuras de datos persistentes. El rediseño reutiliza los modelos, consultas y acciones existentes de tratamientos y conserva sus reglas de acceso por rol y sucursal.

## Plan de implementación

1. **Preparar el diseño.** Identificar los componentes reutilizables y definir la aplicación de los colores, la escala tipográfica, el espaciado y los radios de `references/DESIGN.md` para ambos temas.
2. **Rediseñar el listado.** Actualizar `app/dashboard/tratamientos/page.tsx` y `componentes/TratamientoFila.tsx`, conservando la búsqueda, las columnas, la navegación y los estados existentes.
3. **Rediseñar la estructura del detalle.** Actualizar `app/dashboard/tratamientos/[id_tratamiento]/page.tsx`, manteniendo visibles las acciones y sus condiciones actuales.
4. **Rediseñar las secciones propias.** Adaptar progresivamente solicitud, pagos, egresos, recetas y consultas, incluidos sus formularios y visor de imágenes, sin alterar sus operaciones.
5. **Completar la adaptación visual.** Ajustar los estados de carga, error y ausencia de datos, la presentación móvil y el contraste y foco de los controles en ambos temas.
6. **Actualizar documentación existente.** Si alguna de estas pantallas tiene una página en el manual de usuario, actualizar su contenido y fecha para reflejar el rediseño.

Cada paso debe dejar las pantallas funcionales y conservar las acciones disponibles antes del cambio.

## Criterios de aceptación

- [x] El listado y el detalle aplican los criterios visuales de `references/DESIGN.md` en tema claro.
- [x] Ambas pantallas son utilizables en móvil y en modo oscuro.
- [x] Las secciones, formularios y visor propios del detalle comparten el nuevo diseño.
- [x] La búsqueda, navegación, acciones y permisos existentes funcionan como antes.
- [x] Los estados de carga, error y ausencia de datos son visibles y comprensibles.
- [x] Los controles pueden usarse con teclado y muestran el foco.
- [x] El manual correspondiente, si existe, refleja los cambios.

## Decisiones tomadas y descartadas

- **Sí:** rediseñar listado y detalle para mantener coherencia visual.
- **Sí:** conservar funcionalidades, datos y permisos actuales para limitar el alcance.
- **Sí:** adaptar el modo oscuro, aunque la referencia defina una paleta clara.
- **No:** rediseñar modales compartidos, pues afectan otras áreas.

## Riesgos identificados

- **Regresiones en acciones clínicas o administrativas:** verificar los flujos existentes después del rediseño.
- **Pérdida de legibilidad en móvil o modo oscuro:** revisar ambas pantallas y sus estados en esos contextos.

## Qué no incluye esta spec

Los modales compartidos, los cambios de reglas de negocio o datos y las funciones nuevas.
