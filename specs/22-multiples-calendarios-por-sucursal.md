# 22 — Múltiples calendarios por sucursal

## Header

- **Estado:** Aprobado
- **Depende de:** ninguno de los specs numerados existentes (toca `app/dashboard/citas/page.tsx`, `app/dashboard/citas/actions.ts`, `app/dashboard/sucursales/actions.ts`, `app/dashboard/sucursales/componentes/SucursalModal.tsx`, `interfaces/sucursal.ts` — todos ya existentes desde antes del sistema de specs numerados)
- **Fecha:** 2026-08-18
- **Objetivo:** Permitir configurar varios calendarios (nombre, id_calendar, iframe, link_calendar) por sucursal en vez de uno solo, y en `/dashboard/citas` poder elegir entre ellos con pestañas, ver su iframe embebido, y abrir su `link_calendar` para crear una cita.

## Alcance

**Incluye:**
- **Nueva tabla `sucursal_calendarios`** (una fila por calendario, N por sucursal): `nombre` (obligatorio), `id_calendar`, `iframe`, `link_calendar`, ligada a `id_sucursal`. Reemplaza el modelo actual de un único calendario por sucursal.
- **Migración de datos existentes**: por cada sucursal con `id_calendar`/`iframe`/`link_calendar` no nulos hoy en `sucursales`, se inserta un registro en `sucursal_calendarios` (nombre por default, p. ej. `"Calendario 1"`) con esos mismos valores. Las columnas `id_calendar`/`iframe`/`link_calendar` en `sucursales` quedan en la tabla (no se borran) pero el código deja de leerlas/escribirlas.
- **Gestión CRUD de calendarios por sucursal**, dentro de `/dashboard/sucursales`: nuevo modal/sub-sección (`SucursalCalendariosModal.tsx`) accesible desde un botón "Calendarios" por fila en la lista de sucursales, donde se agregan, editan y eliminan (soft delete) los calendarios de esa sucursal (nombre, id_calendar, iframe, link_calendar).
- **`SucursalModal.tsx`** deja de tener los campos "ID Calendario" y "Link Calendario" (se mueven a la gestión de calendarios); el resto del formulario de sucursal no cambia.
- **`/dashboard/citas`**: al cargar la sucursal seleccionada, se listan sus calendarios activos como pestañas (nombre de cada calendario). Se muestra el iframe del calendario seleccionado (primero por default) y el botón "+ Nueva cita" abre el `link_calendar` del calendario activo. Si la sucursal no tiene ningún calendario configurado, se muestra un mensaje en vez del iframe/botón.
- Mismos permisos que hoy tiene la gestión de sucursales (sin restricción nueva de rol en `proxy.ts`).

**No incluye:**
- Ningún cambio al guardado interno de citas (`saveCita`, sincronización con Google Calendar vía `createCalendarEvent`/`updateCalendarEvent`/`deleteCalendarEvent`) — sigue usando el `id_calendar` legado de `sucursales` como calendario "principal" de sincronización, sin selector de calendario en el formulario de cita. Ampliar ese flujo a múltiples calendarios queda para una spec futura.
- `getExternalCalendarEvents` (código ya no usado por `page.tsx` actual, solo por `page copy.tsx`) — no se toca ni se extiende a múltiples calendarios.
- Reordenar manualmente las pestañas — se listan en orden de creación (por id).
- Vincular un calendario a un pódologo o sillón específico — es una etiqueta libre (`nombre`) sin relación a otra tabla.
- Borrado físico de calendarios — eliminar es soft delete (`status = 0`), igual que el resto del sistema.
- Eliminar o migrar físicamente las columnas legadas `sucursales.id_calendar`/`iframe`/`link_calendar` — quedan en la tabla sin uso desde el código.

## Modelo de datos

**Nueva tabla — `sucursal_calendarios`:**

```sql
CREATE TABLE [CentroPodologico].[dbo].[sucursal_calendarios] (
    [id_sucursal_calendario] INT           NOT NULL PRIMARY KEY,
    [id_sucursal]            INT           NOT NULL,
    [nombre]                 NVARCHAR(100) NOT NULL,
    [id_calendar]            NVARCHAR(255) NULL,
    [iframe]                 NVARCHAR(MAX) NULL,
    [link_calendar]          NVARCHAR(MAX) NULL,
    [status]                 BIT           NOT NULL DEFAULT 1,
    [created_at]             DATETIME2     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_sucursal_calendarios_sucursales
        FOREIGN KEY ([id_sucursal]) REFERENCES [CentroPodologico].[dbo].[sucursales]([id_sucursal])
);
```

- `id_sucursal_calendario` se genera con el mismo patrón manual `MAX+1` que ya usan `sucursales`/`citas` (no `IDENTITY`), para mantener consistencia con el resto del código.
- `status`: soft delete (`1` activo, `0` eliminado), igual que `sucursales.status`.

**Migración de datos existentes (una sola vez, vía `queries.txt`):**

```sql
INSERT INTO [CentroPodologico].[dbo].[sucursal_calendarios]
    ([id_sucursal_calendario], [id_sucursal], [nombre], [id_calendar], [iframe], [link_calendar], [status], [created_at])
SELECT
    ROW_NUMBER() OVER (ORDER BY [id_sucursal]),
    [id_sucursal],
    N'Calendario 1',
    [id_calendar],
    [iframe],
    [link_calendar],
    1,
    GETDATE()
FROM [CentroPodologico].[dbo].[sucursales]
WHERE [id_calendar] IS NOT NULL OR [iframe] IS NOT NULL OR [link_calendar] IS NOT NULL;
```

**`interfaces/sucursal.ts` — nueva interfaz `ISucursalCalendario`:**

```ts
export interface ISucursalCalendario {
    id_sucursal_calendario: number;
    id_sucursal:            number;
    nombre:                 string;
    id_calendar:            string | null;
    iframe:                 string | null;
    link_calendar:          string | null;
    status:                 boolean | number;
    created_at:              Date | string;
}
```

`ISucursal` no cambia (las columnas legadas `id_calendar`/`iframe`/`link_calendar` se quedan en la interfaz y en la tabla, sin uso desde el código nuevo).

**`app/dashboard/sucursales/actions.ts` — nuevas funciones:**

```ts
export async function getSucursalCalendarios(id_sucursal: number): Promise<ISucursalCalendario[]>;

export async function saveSucursalCalendario(
  form: Pick<ISucursalCalendario, "id_sucursal_calendario" | "id_sucursal" | "nombre" | "id_calendar" | "iframe" | "link_calendar">
): Promise<{ ok: boolean; message?: string }>;

export async function deleteSucursalCalendario(id_sucursal_calendario: number): Promise<{ ok: boolean; message?: string }>;
```

Mismo patrón que `saveSucursal`/`deleteSucursal`: `id_sucursal_calendario === 0` → INSERT con `MAX+1`; `deleteSucursalCalendario` hace `UPDATE ... SET status = 0`.

**`app/dashboard/citas/actions.ts`:** se elimina `getSucursalIframe` (queda sin uso — reemplazada por `getSucursalCalendarios`, importada directamente desde `app/dashboard/sucursales/actions.ts`). El tipo `IExternalEvent` y `getExternalCalendarEvents` no se tocan (fuera de alcance).

**`SucursalModal.tsx` — `FormData`:** se le quitan `id_calendar` y `link_calendar` del `Pick`:

```ts
type FormData = Pick<ISucursal, "id_sucursal" | "nombre" | "ciudad" | "direccion" | "telefono" | "id_state" | "seats">;
```

## Plan de implementación

1. **Esquema en BD.** Ejecutar el `CREATE TABLE sucursal_calendarios` y el `INSERT` de migración (sección "Modelo de datos") directamente contra la base, y anexar ambos al `queries.txt`. *Verificación:* `SELECT * FROM sucursal_calendarios` responde sin error, con una fila `"Calendario 1"` por cada sucursal que ya tenía `id_calendar`/`iframe`/`link_calendar` capturado.

2. **Interfaz `ISucursalCalendario`.** Agregarla a `interfaces/sucursal.ts`. Sistema funcional (nada lo usa aún).

3. **Server actions de calendarios.** Agregar `getSucursalCalendarios`, `saveSucursalCalendario` y `deleteSucursalCalendario` a `app/dashboard/sucursales/actions.ts`, siguiendo el mismo patrón (`MAX+1` para insert, `status = 0` para soft delete) que `getSucursales`/`saveSucursal`/`deleteSucursal`. *Verificación:* `npm run build` compila; las funciones son invocables desde una consola/test manual.

4. **`SucursalCalendariosModal.tsx`.** Crear `app/dashboard/sucursales/componentes/SucursalCalendariosModal.tsx` (client component): recibe `id_sucursal`, lista los calendarios activos de esa sucursal (`getSucursalCalendarios`), permite agregar uno nuevo (formulario con nombre/id_calendar/iframe/link_calendar), editar uno existente inline, y eliminarlo (soft delete, con confirmación simple igual que el resto del sistema). Usa `saveSucursalCalendario`/`deleteSucursalCalendario`.

5. **Botón "Calendarios" en `sucursales/page.tsx`.** Agregar un botón por fila de la lista de sucursales que abre `SucursalCalendariosModal` para esa sucursal (mismo patrón de apertura/cierre de modal que ya usa `SucursalModal`).

6. **Quitar campos legados de `SucursalModal.tsx`.** Eliminar los inputs "ID Calendario" y "Link Calendario" y actualizar el tipo `FormData` (sección "Modelo de datos"). Ajustar `sucursales/page.tsx` donde arme ese `FormData` para que ya no incluya esos campos. *Verificación:* el formulario de sucursal sigue guardando el resto de campos sin error; `saveSucursal` (que sigue aceptando `id_calendar`/`link_calendar`/`iframe` en su firma) recibe `undefined`/`null` en esos campos desde este formulario, sin romper el guardado.

7. **`/dashboard/citas/actions.ts`.** Eliminar `getSucursalIframe` (ya sin uso tras el paso 8).

8. **`/dashboard/citas/page.tsx`.** Reemplazar el `useEffect` que llama `getSucursalIframe` por uno que llama `getSucursalCalendarios(selectedId)` (importada de `sucursales/actions.ts`). Agregar estado `calendarios: ISucursalCalendario[]` y `activeCalendarId: number | null` (se selecciona el primero al cargar o al cambiar de sucursal). Renderizar una fila de pestañas con el `nombre` de cada calendario; al hacer click en una pestaña se actualiza `activeCalendarId` y el iframe mostrado. El botón "+ Nueva cita" abre `link_calendar` del calendario activo (`window.open`). Si `calendarios.length === 0`, mostrar un mensaje ("No hay calendarios configurados para esta sucursal.") en vez del iframe/botón.

9. **Verificación manual completa:**
   - En `/dashboard/sucursales`, abrir "Calendarios" de una sucursal migrada: aparece "Calendario 1" con los mismos `id_calendar`/`iframe`/`link_calendar` que tenía antes.
   - Agregar un segundo calendario a esa sucursal, editar uno existente, y eliminar uno (soft delete) — confirmar que `sucursal_calendarios.status` cambia a `0` y deja de listarse.
   - En `/dashboard/citas`, seleccionar esa sucursal: aparecen las pestañas de sus calendarios activos, el iframe cambia al hacer click en cada pestaña, y "+ Nueva cita" abre el `link_calendar` correcto según la pestaña activa.
   - Seleccionar una sucursal sin calendarios configurados: se muestra el mensaje en vez de iframe/botón roto.
   - Confirmar que el formulario básico de `SucursalModal` (nombre, estado, ciudad, dirección, teléfono, sillones) sigue guardando correctamente sin los campos de calendario.
   - Revisar modo claro y oscuro.

10. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [ ] La tabla `sucursal_calendarios` existe con las columnas descritas, y el `CREATE TABLE`/`INSERT` de migración quedaron anexados a `queries.txt`.
- [ ] Cada sucursal que ya tenía `id_calendar`/`iframe`/`link_calendar` capturado tiene, tras la migración, un registro `"Calendario 1"` en `sucursal_calendarios` con esos mismos valores.
- [ ] En `/dashboard/sucursales`, cada fila tiene un botón "Calendarios" que abre un modal donde se pueden agregar, editar y eliminar (soft delete) los calendarios de esa sucursal (nombre obligatorio, id_calendar, iframe, link_calendar).
- [ ] Eliminar un calendario desde ese modal marca `status = 0` en BD (no lo borra físicamente) y deja de aparecer en la lista ni en las pestañas de `/dashboard/citas`.
- [ ] `SucursalModal.tsx` ya no tiene los campos "ID Calendario" ni "Link Calendario"; el resto del formulario de sucursal (nombre, estado, ciudad, dirección, teléfono, sillones) sigue funcionando sin cambios.
- [ ] En `/dashboard/citas`, la sucursal seleccionada muestra una pestaña por cada calendario activo, con el `nombre` capturado como etiqueta.
- [ ] Al hacer click en una pestaña, el iframe mostrado cambia al `iframe` de ese calendario, y el botón "+ Nueva cita" abre el `link_calendar` de ese mismo calendario (no el de otro).
- [ ] Si la sucursal seleccionada no tiene ningún calendario activo, `/dashboard/citas` muestra un mensaje en vez de un iframe vacío o un botón roto.
- [ ] `getSucursalIframe` fue eliminada de `app/dashboard/citas/actions.ts` y no queda ninguna referencia a ella en el código.
- [ ] `saveCita` y la sincronización con Google Calendar (`createCalendarEvent`/`updateCalendarEvent`/`deleteCalendarEvent`) siguen funcionando exactamente igual que antes (sin selector de calendario nuevo).
- [ ] Los nombres de funciones, variables, componentes y tipos nuevos están en inglés y son descriptivos, conforme a `CLAUDE.md`.
- [ ] Las pantallas se ven correctamente en modo claro y oscuro.
- [ ] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Tabla nueva `sucursal_calendarios` en vez de columnas repetidas o JSON en `sucursales`.** Un modelo relacional 1-a-N es lo estándar en este código (mismo patrón que `purchase_order_items`, `citas`, etc.), permite CRUD normal por fila y no requiere parsear/serializar JSON en cada lectura/escritura.
- **Calendario como etiqueta libre (`nombre`), no vinculado a pódologo ni sillón.** El usuario decidió que no hay una relación estructural todavía; forzar un FK a `users` o a una tabla de sillones (que ni siquiera existe hoy) sería una ampliación de alcance no pedida. Queda como una anotación libre que el usuario nombra según su propio criterio operativo.
- **Columnas legadas `sucursales.id_calendar`/`iframe`/`link_calendar` se quedan en la tabla, sin borrarse.** No hay migración de esquema en este repo (`CLAUDE.md`: "no hay herramienta de migraciones, los cambios se hacen directo contra la BD"); borrarlas es una operación irreversible que no aporta valor funcional inmediato, y dejarlas evita romper cualquier reporte o query externa (`queries.txt`) que aún las referencie.
- **`saveCita`/sync con Google Calendar fuera de alcance.** Ampliar el flujo de creación de citas para elegir calendario destino es una decisión de UX y de negocio (¿cuál es el calendario "por default" para agendar?) que el usuario explícitamente pidió dejar fuera; este spec solo cubre visualización y el enlace externo de "crear cita" manual.
- **Gestión de calendarios integrada en `/dashboard/sucursales` (modal por fila), no una pantalla dedicada.** Sigue el patrón ya usado en el resto del sistema (modales por fila para operaciones CRUD secundarias) y evita agregar una ruta nueva para una gestión que es claramente subordinada a la sucursal.
- **Sin campo de orden manual — se listan por orden de creación.** No se pidió reordenar, y agregar un campo de orden implica UI de drag-and-drop o inputs numéricos que no aportan valor proporcional al esfuerzo para el caso de uso actual (pocas pestañas por sucursal).
- **`nombre` obligatorio.** Sin nombre, las pestañas de `/dashboard/citas` quedarían sin texto legible, degradando la usabilidad que es justamente el propósito del feature (poder distinguir entre varios calendarios).

## Riesgos identificados

- **Migración corre una sola vez, manualmente.** El `INSERT` de migración (paso 1) no es idempotente tal como está escrito — si se corre dos veces, duplica el "Calendario 1" de cada sucursal. Se acepta porque es una operación única de despliegue, igual que otros `ALTER`/`INSERT` de specs previos en este repo (spec 20), pero hay que tener cuidado de no re-ejecutarlo.
- **`saveSucursal` sigue aceptando `id_calendar`/`link_calendar`/`iframe` en su firma aunque `SucursalModal` ya no los envíe.** Si algún otro caller (actual o futuro) sigue pasando esos campos, se seguirían escribiendo en las columnas legadas de `sucursales` sin que nada los lea — comportamiento inofensivo pero potencialmente confuso. No se toca la firma de `saveSucursal` en este spec para minimizar el radio de cambio sobre código no relacionado directamente al feature.
- **Doble fuente de verdad temporal para el calendario "principal" de sincronización de citas.** Tras la migración, `sucursales.id_calendar` (usado por `saveCita`) y `sucursal_calendarios` (primer registro, usado por la UI de citas) contienen el mismo dato al día del despliegue, pero pueden divergir después: si alguien edita el `id_calendar` del "Calendario 1" en la nueva UI, `sucursales.id_calendar` no se actualiza (y viceversa, ya no hay forma de editarlo). Es un riesgo aceptado explícitamente al dejar `saveCita` fuera de alcance; se documenta aquí para que no se lea como un bug si el calendario de sincronización de citas y el primero mostrado en la pestaña terminan mostrando datos distintos.
- **`iframe` y `link_calendar` son texto libre sin validación de formato.** Igual que hoy, un valor mal formado (URL inválida, HTML pegado por error) puede romper el embed o el `window.open`; no se agrega validación nueva en este spec, siguiendo el mismo nivel de robustez que ya tiene el sistema para estos campos.
