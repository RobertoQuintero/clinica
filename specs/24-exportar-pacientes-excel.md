# 24 — Exportar pacientes de la sucursal a Excel

## Header

- **Estado:** Aprobado
- **Depende de:** Ninguno (feature aislada, no modifica specs previos)
- **Fecha:** 2026-08-19
- **Objetivo:** Agregar en `/dashboard/pacientes` un botón "Exportar a Excel" que descarga un `.xlsx` con nombre completo, WhatsApp y sucursal de todos los pacientes de la sucursal seleccionada.

## Alcance

**Incluye:**

- Botón **"Exportar a Excel"** en `/dashboard/pacientes`, ubicado en la barra superior junto a "+ Nuevo paciente".
- El botón solo es **visible** para usuarios con `id_role` 1 o 4 (mismo criterio que `canSeeWhatsapp`); para el resto de roles no se renderiza (no solo deshabilitado).
- Nuevo Server Action `exportPacientesSucursal()` en `app/dashboard/pacientes/actions.ts` que consulta **todos** los pacientes de la sucursal activa (sin `TOP 20`), filtrando por `id_sucursal`/`id_empresa` igual que `getPacientes()` (misma resolución vía cookie `sel_sucursal` / JWT). Devuelve nombre completo (concatenado), WhatsApp, sucursal, y el nombre de la sucursal para armar el nombre del archivo.
- Generación del `.xlsx` **en el cliente** con la librería `xlsx` (SheetJS), a partir de los datos que regresa `exportPacientesSucursal()`.
- Columnas del archivo (encabezados en español): **Nombre completo**, **WhatsApp** (solo si `canSeeWhatsapp`), **Sucursal**.
- El botón/columna WhatsApp respeta el mismo permiso que la tabla en pantalla: `canSeeWhatsapp = user?.id_role === 1 || user?.id_role === 4`. Si el usuario no tiene el permiso, el archivo se genera igual pero sin la columna WhatsApp.
- Nombre del archivo: `pacientes_{nombre_sucursal_slug}_{YYYY-MM-DD}.xlsx`, usando `addZeroToday(new Date())` para la fecha y una versión "slug" del nombre de sucursal (sin espacios/acentos/caracteres especiales problemáticos para nombre de archivo).
- Estado de carga en el botón mientras se obtienen los datos del server action (deshabilitado + texto tipo "Exportando…").
- **Sucursal sin pacientes:** no se genera archivo. Se muestra un aviso (mensaje inline junto al botón, o alert) indicando que no hay pacientes para exportar, y el flujo se detiene ahí.
- Agregar `xlsx` a `package.json` (dependencia nueva).

**No incluye (para specs futuras):**

- Exportar otras entidades (citas, ventas, tratamientos, etc.) — solo pacientes.
- Exportar más columnas que nombre completo, WhatsApp y sucursal (fecha nacimiento, dirección, patologías, etc. quedan fuera).
- Exportar pacientes de **todas** las sucursales a la vez (solo la sucursal actualmente seleccionada).
- Filtros de exportación (por fecha, por rango, por búsqueda) — siempre exporta el universo completo de la sucursal.
- Programar/agendar exportaciones automáticas o envío por correo del archivo.
- Formato/estilos visuales avanzados del Excel (colores, anchos de columna automáticos, logo, etc.) — hoja simple con encabezados.

## Modelo de datos

No se agregan tablas ni columnas nuevas en la base de datos. Solo se introduce un tipo de vista para la respuesta del export, en `app/dashboard/pacientes/actions.ts` (mismo patrón que otras interfaces de vista del repo, ej. `IStockCountListItem` en spec 23):

```ts
/** Fila para exportar a Excel. Sin datos sensibles más allá de whatsapp. */
export interface IPacienteExportRow {
  nombre_completo: string;  // nombre + apellido_paterno + apellido_materno
  whatsapp:        string;
  nombre_sucursal: string;
}

export interface IPacienteExportResult {
  rows:            IPacienteExportRow[];
  nombre_sucursal: string;  // para armar el nombre del archivo, aunque no haya filas
}
```

- `exportPacientesSucursal()` devuelve `Promise<IPacienteExportResult>`.
- La concatenación de nombre completo (`nombre + apellido_paterno + apellido_materno`, con espacios simples, sin dobles espacios si algún apellido viene vacío) se hace en el server action, no en el cliente — así el Excel siempre recibe el dato ya formateado.
- El filtrado de la columna WhatsApp por permiso (`canSeeWhatsapp`) ocurre en el cliente al construir la hoja, no en el server action: el action siempre trae `whatsapp` (mismo criterio que `getPacientes()`, que ya lo expone hoy sin filtrar por rol), y es la UI quien decide qué columnas escribe en el archivo.

## Plan de implementación

1. **Dependencia.** Agregar `xlsx` a `package.json` (`npm install xlsx`). *Verificación:* `npm run build` sigue compilando sin errores.

2. **`app/dashboard/pacientes/actions.ts`.** Agregar `exportPacientesSucursal(): Promise<IPacienteExportResult>`:
   - Resuelve `id_sucursal`/`id_empresa` igual que `getPacientes()` (cookie `sel_sucursal` → JWT como fallback).
   - `SELECT` sin `TOP`, trayendo `nombre`, `apellido_paterno`, `apellido_materno`, `whatsapp` y `s.[nombre] AS nombre_sucursal`, con el mismo `WHERE p.[id_sucursal] = @id_sucursal AND p.[id_empresa] = @id_empresa` y el mismo `JOIN` a `sucursales`.
   - Arma `nombre_completo` en JS concatenando los tres campos (trim + un solo espacio entre partes no vacías).
   - Si no hay filas, igual devuelve `{ rows: [], nombre_sucursal }` (el nombre de sucursal se obtiene aparte, con una consulta mínima a `sucursales` o reutilizando el que ya tiene `SucursalContext` en el cliente — ver paso 3).
   *Verificación:* llamar el action manualmente devuelve todas las filas de la sucursal (más de 20 si existen), no solo las últimas 20.

3. **`app/dashboard/pacientes/page.tsx`** — agregar la lógica de exportación (sigue siendo Client Component, ya lo es):
   - Nuevo estado `exporting: boolean`.
   - Handler `handleExport()`: llama `exportPacientesSucursal()`; si `rows.length === 0`, muestra aviso ("No hay pacientes para exportar en esta sucursal") y no continúa; si hay filas, construye el workbook con `xlsx` (`utils.json_to_sheet` sobre un array de objetos con las claves `"Nombre completo"`, opcionalmente `"WhatsApp"` si `canSeeWhatsapp`, y `"Sucursal"`), y descarga con `utils.writeFile` (o `write` + creación de `Blob`/`<a>` si `writeFile` no es compatible con el entorno) usando el nombre `pacientes_{slug(nombre_sucursal)}_{addZeroToday(new Date())}.xlsx`.
   - Función auxiliar `slugifySucursalName(name: string): string` (en el mismo archivo o en `utils/`) que normaliza a minúsculas, quita acentos y sustituye espacios/caracteres no alfanuméricos por `_`.
   - Botón "Exportar a Excel" junto a "+ Nuevo paciente", renderizado condicionalmente solo cuando `canExportExcel = user?.id_role === 1 || user?.id_role === 4` (mismo patrón que `canSeeWhatsapp`); para otros roles el botón no se muestra en el DOM. Mientras `exporting` es `true`, queda deshabilitado y con texto "Exportando…".
   - Importar `xlsx` con `import()` dinámico dentro de `handleExport()`, para no incluirlo en el bundle inicial.
   *Verificación:* clic en el botón descarga un `.xlsx` con el nombre esperado, abre correctamente en Excel/LibreOffice, y las columnas coinciden con lo definido.

4. **Verificación manual completa:**
   - Sucursal con más de 20 pacientes: el archivo trae **todos**, no solo 20.
   - Sucursal sin pacientes: no descarga nada, se ve el aviso.
   - Usuario con rol 1 o 4: ve el botón "Exportar a Excel" y el archivo incluye columna WhatsApp.
   - Usuario con otro rol (2, 3, 5): **no** ve el botón "Exportar a Excel" en pantalla.
   - Nombre del archivo coincide con `pacientes_{sucursal}_{fecha}.xlsx`, sin acentos/espacios raros.
   - Cambiar de sucursal en `SucursalContext` y volver a exportar: el archivo refleja la nueva sucursal seleccionada.
   - Modo claro y oscuro del botón (visual, sin funcionalidad nueva ahí).

5. `npm run build` sin errores de TypeScript.

## Criterios de aceptación

- [ ] `xlsx` está agregado como dependencia en `package.json` y `npm run build` compila sin errores.
- [ ] `/dashboard/pacientes` muestra el botón "Exportar a Excel" junto a "+ Nuevo paciente" **solo** para usuarios con `id_role` 1 o 4; para el resto de roles el botón no se renderiza.
- [ ] `exportPacientesSucursal()` devuelve **todos** los pacientes de la sucursal activa (no limitado a 20), filtrando por `id_sucursal`/`id_empresa` resueltos igual que `getPacientes()`.
- [ ] El Excel generado contiene las columnas "Nombre completo" y "Sucursal" siempre, y "WhatsApp" únicamente cuando el usuario tiene `id_role` 1 o 4.
- [ ] El nombre completo en el Excel es la concatenación de nombre + apellido paterno + apellido materno, sin espacios dobles cuando algún apellido está vacío.
- [ ] El nombre del archivo descargado sigue el patrón `pacientes_{sucursal_slug}_{YYYY-MM-DD}.xlsx`, con la fecha calculada vía `addZeroToday(new Date())` (no `toISOString()`).
- [ ] Si la sucursal seleccionada no tiene pacientes, no se descarga ningún archivo y se muestra un aviso al usuario.
- [ ] El botón queda deshabilitado y muestra estado de carga ("Exportando…") mientras se obtienen los datos.
- [ ] Exportar refleja la sucursal actualmente seleccionada en `SucursalContext`, no una sucursal distinta ni todas a la vez.
- [ ] El botón y su estado de carga se ven correctamente en modo claro y oscuro.
- [ ] Los nombres de funciones, variables y tipos nuevos están en inglés y son descriptivos, conforme a `CLAUDE.md` (el contenido/encabezados del Excel y el texto del botón sí van en español, por ser UI/salida de cara al usuario).
- [ ] `npm run build` sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Nuevo Server Action sin límite, en vez de reutilizar `getPacientes()` o exportar desde el estado del cliente.** `getPacientes()` trae `TOP 20`, así que el estado `pacientes` en pantalla nunca representa el universo completo de la sucursal. Exportar desde ahí habría producido archivos incompletos en cualquier sucursal con más de 20 pacientes, contradiciendo el pedido explícito de "exportar los pacientes de la sucursal". Se descartó también quitarle el `TOP 20` a `getPacientes()` porque esa función alimenta la tabla en pantalla y cambiar su límite es una decisión aparte, fuera del alcance de este spec.
- **Generación del `.xlsx` en el cliente con `xlsx` (SheetJS), no un endpoint que arme y devuelva el binario.** El repo no tiene libraries de Excel; SheetJS es el estándar de facto, funciona bien en el navegador y evita mantener lógica de streaming/descarga de archivos en el server action (que hoy solo maneja JSON vía `ActionResult`). El server action se limita a traer los datos; el cliente arma el archivo — mismo principio de "server actions para datos, no para binarios" que ya sigue `app/api/upload` (única excepción REST del repo, y es para Cloudinary, no para generar archivos).
- **Filtrado de la columna WhatsApp en el cliente, no en el server action.** `getPacientes()` ya expone `whatsapp` sin filtrar por rol (la tabla en pantalla es la que oculta la columna vía `canSeeWhatsapp`); se mantiene la misma división de responsabilidades para no duplicar lógica de permisos en dos lugares. El dato no es más sensible de lo que ya es en la pantalla actual.
- **Nombre completo concatenado en el servidor, no en el cliente.** Evita que la lógica de formateo del nombre (trim, espacios entre partes vacías) se repita si en el futuro se agrega otro consumidor de `exportPacientesSucursal()`.
- **Bloquear con aviso en vez de generar un Excel vacío cuando la sucursal no tiene pacientes.** Un archivo con solo encabezados es ruido: obliga a abrirlo para confirmar que no hay datos. Un aviso inmediato en pantalla es más claro y evita una descarga inútil.
- **Nombre de archivo con sucursal y fecha (`pacientes_{sucursal}_{fecha}.xlsx`), no un nombre fijo.** El usuario puede exportar varias veces (distintas sucursales, distintos días) y un nombre fijo generaría colisiones/sobrescrituras confusas en su carpeta de descargas.
- **Encabezados del Excel en español.** El archivo lo abre personal administrativo/clínico, no un desarrollador; `CLAUDE.md` exige inglés para nombres de código (funciones, variables, tipos), no para texto de UI ni contenido exportado — mismo criterio que el resto de la app (rutas, columnas de tablas en pantalla, botones, etc., todos en español).
- **Solo tres columnas (nombre completo, WhatsApp, sucursal), sin más campos.** Es exactamente lo pedido; agregar más datos del paciente (fecha de nacimiento, dirección, patologías) es una ampliación que merece su propio spec si se necesita.
- **Botón visible solo para `id_role` 1 y 4, no visible-pero-deshabilitado para otros roles.** Se sigue el mismo criterio de permiso ya usado para `canSeeWhatsapp`, aplicado ahora también a la visibilidad del botón: exportar el listado completo de pacientes (incluyendo WhatsApp para esos roles) es una acción con más alcance que ver la tabla paginada en pantalla, así que se restringe a los mismos roles que hoy pueden ver el WhatsApp. Ocultarlo en vez de deshabilitarlo evita exponer la existencia de la función a roles sin acceso y evita tener que explicar en UI por qué está bloqueado.

## Riesgos identificados

| Riesgo | Mitigación / nota |
|---|---|
| **Bundle client-side.** `xlsx` es una librería con peso considerable; importarla directamente en `page.tsx` la incluiría en el bundle inicial de `/dashboard/pacientes` aunque el usuario nunca exporte. | Importarla con `import()` dinámico dentro de `handleExport()` (o `next/dynamic` si se extrae a un componente), para que solo se cargue cuando se hace clic en el botón. |
| **Sucursal con muchos pacientes (varios miles).** Sin `TOP`, la consulta y la construcción del workbook en el cliente podrían tardar unos segundos. | Aceptable para el volumen actual de una clínica; el estado de carga ("Exportando…") comunica que la operación está en curso. Si el volumen crece mucho, la salida natural es paginar la exportación o moverla a un job en background — fuera de este spec. |
| **Descarga bloqueada por el navegador o por extensiones.** Algunos navegadores/perfiles pueden bloquear descargas iniciadas por script. | Riesgo general de cualquier descarga client-side en la app; no se agrega manejo especial más allá de que `xlsx.writeFile` usa el mecanismo estándar del navegador. |

## Lo que **no** entra en este spec

- Exportar otras entidades (citas, ventas, tratamientos, etc.).
- Más columnas que nombre completo, WhatsApp y sucursal.
- Exportar todas las sucursales a la vez.
- Filtros de exportación (fecha, búsqueda, rango).
- Envío/programación automática del archivo.
- Estilos avanzados del Excel (colores, anchos automáticos, logo).
