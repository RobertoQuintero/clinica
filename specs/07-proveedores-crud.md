# 07 — Proveedores CRUD

## Header

- **Estado:** Aprobado
- **Depende de:** [[06-sidebar-colapsable]] (usa `navConfig.tsx` y el grupo "Inventario" ahí definido)
- **Fecha:** 2026-08-10
- **Objetivo:** Implementar el CRUD de Proveedores (lista, creación, detalle y edición) con el diseño visual de `references/suppliers/`, adaptado a la paleta de `DESIGN.md` con soporte de modo claro/oscuro, como directorio de proveedores compartido a nivel empresa.

## Alcance

**Incluye:**
- Nueva sección **Proveedores** dentro del grupo "Inventario" del sidebar (junto a "Productos"), en `app/dashboard/componentes/navConfig.tsx`, con las mismas reglas de rol que "Productos" (`minRole: 0`, `excludeRoles: [5]`).
- **Lista de proveedores** (`/dashboard/proveedores`): tabla con Nombre corto, RFC, Teléfono principal, badge Activo/Inactivo y acciones (ver detalle, editar, eliminar), siguiendo el patrón visual del mockup `suppliers.html` pero con la paleta de `DESIGN.md` (light/dark) en vez de sus tokens Tailwind embebidos tal cual. Buscador de texto client-side (nombre corto / RFC), sin paginación real ni botón "Filtros" (igual que pacientes/productos hoy).
- **Crear proveedor**: modal (`SupplierModal`) con el formulario completo de campos del proveedor. Único campo obligatorio: Nombre Corto.
- **Detalle de proveedor** (`/dashboard/proveedores/[id]`): página de solo lectura con tarjetas "Información General", "Contacto" y "Ubicación" (como `supplier-detail.html`), sin la sección "Productos Asociados" ni el botón "Ver Historial de Pedidos". Incluye botón "Editar Datos" que abre el mismo `SupplierModal` en modo edición.
- **Editar proveedor**: mismo `SupplierModal`, accesible desde el ícono de editar en la lista y desde "Editar Datos" en el detalle.
- **Eliminar proveedor**: soft-delete (campo `status`) desde el ícono de basura en la lista; el proveedor deja de aparecer en listas/búsquedas.
- **Toggle Activo/Inactivo**: campo de negocio `activo` independiente del borrado, editable desde el formulario del modal (visible como badge en lista y detalle).
- Nueva tabla `proveedores` en `[CentroPodologico].[dbo]`, nueva interfaz `interfaces/supplier.ts`, y nuevo `app/dashboard/proveedores/actions.ts` con las server actions correspondientes (patrón `ActionResult`/`{ ok, message }` igual que productos/servicios).
- Selector de código de país (reutilizando `phone_code` / `getPhoneCodes`, igual que en pacientes) solo para Teléfono Principal y WhatsApp Principal, con default `52` (México) al crear un proveedor nuevo.
- Proveedor compartido a nivel empresa (`id_empresa`), no ligado a una sucursal específica.

**No incluye:**
- Sección "Productos Asociados" en el detalle del proveedor, ni la columna `id_proveedor` en la tabla `productos` — se difiere a un spec futuro del sistema de inventario/compras.
- Botón "Ver Historial de Pedidos" ni ninguna lógica de órdenes de compra (`purchase_orders`, `product_orders`, `order_templates`) — pertenece al alcance más amplio descrito en `references/docs/Inventario.md`, no a este spec.
- Categorías, unidades de medida, kardex, movimientos, stock mínimo/actual, ni ningún otro elemento del sistema de inventario descrito en `Inventario.md` fuera de Proveedores.
- Paginación real server-side ni botón "Filtros" funcional (se omiten del mockup, igual que se hizo con buscador/notificaciones en el spec del sidebar).
- Selector de código de país para Teléfono Secundario / WhatsApp Secundario (quedan como texto libre).
- Historial de cambios/auditoría del proveedor.

## Modelo de datos

**Tabla `[CentroPodologico].[dbo].[proveedores]`** (nueva):

| Columna | Tipo | Notas |
|---|---|---|
| `id_proveedor` | `int` | PK. Mismo patrón que `productos`/`servicios`: `MAX(id_proveedor)+1` en el INSERT, no identity. |
| `id_empresa` | `int` | FK lógica a empresa; scoping igual que productos/servicios. |
| `nombre_corto` | `nvarchar(255)` | **Obligatorio.** |
| `nombre_legal` | `nvarchar(255)` NULL | |
| `rfc` | `nvarchar(20)` NULL | |
| `codigo_postal` | `nvarchar(10)` NULL | |
| `direccion` | `nvarchar(500)` NULL | |
| `web` | `nvarchar(255)` NULL | |
| `telefono_principal` | `nvarchar(20)` NULL | |
| `id_phonecode_principal` | `int` NULL | FK lógica a `phone_code`. |
| `telefono_secundario` | `nvarchar(20)` NULL | Texto libre, sin código de país. |
| `whatsapp_principal` | `nvarchar(20)` NULL | |
| `id_whatsappcode_principal` | `int` NULL | FK lógica a `phone_code`. |
| `whatsapp_secundario` | `nvarchar(20)` NULL | Texto libre, sin código de país. |
| `email_principal` | `nvarchar(255)` NULL | |
| `email_secundario` | `nvarchar(255)` NULL | |
| `activo` | `bit` NOT NULL DEFAULT 1 | Toggle de negocio (badge Activo/Inactivo); independiente del borrado. |
| `status` | `bit` NOT NULL DEFAULT 1 | Soft-delete: `0` = eliminado, oculto de listas (mismo uso que en `productos`/`servicios`). |
| `created_at` | `datetime` | Se escribe con `buildDate(new Date())`, se lee con `CONVERT(varchar(19), …, 120)` (regla de fechas del proyecto). |

**Nueva interfaz `interfaces/supplier.ts`** (nombre de archivo y tipo en inglés; propiedades siguen espejeando las columnas de BD, en español, igual que `IPaciente`/`IProducto`):

```ts
export interface ISupplier {
  id_proveedor:              number;
  id_empresa:                number;
  nombre_corto:              string;
  nombre_legal:              string;
  rfc:                       string;
  codigo_postal:             string;
  direccion:                 string;
  web:                       string;
  telefono_principal:        string;
  id_phonecode_principal:    number | null;
  telefono_secundario:       string;
  whatsapp_principal:        string;
  id_whatsappcode_principal: number | null;
  whatsapp_secundario:       string;
  email_principal:           string;
  email_secundario:          string;
  activo:                    boolean;
  status:                    boolean;
  created_at:                Date | string;
}
```

## Plan de implementación

1. Agregar el `CREATE TABLE [CentroPodologico].[dbo].[proveedores]` (columnas de la sección "Modelo de datos") a `queries.txt` y ejecutarlo contra la base de datos.
2. Crear `interfaces/supplier.ts` con `ISupplier`.
3. Crear `app/dashboard/proveedores/actions.ts` (`"use server"`) con:
   - `getSuppliers(): Promise<ISupplier[]>` — filtra `id_empresa` y `status = 1`, cast de `created_at` con `CONVERT(varchar(19), …, 120)`.
   - `getSupplierById(id_proveedor: number): Promise<ISupplier | null>` — para la página de detalle.
   - `saveSupplier(form): Promise<{ ok: boolean; message?: string }>` — INSERT (`id_proveedor = MAX+1`, `status = 1`) o UPDATE según `id_proveedor === 0`, incluyendo `activo`; `revalidatePath("/dashboard/proveedores")` y `revalidatePath(/dashboard/proveedores/${id_proveedor})`.
   - `deleteSupplier(id_proveedor: number): Promise<{ ok: boolean; message?: string }>` — soft-delete (`status = 0`).
   - Reutiliza `getPhoneCodes` importado desde `app/dashboard/pacientes/actions.ts` (no duplicar la consulta a `phone_code`).
4. Crear `app/dashboard/proveedores/componentes/SupplierRow.tsx` (fila de tabla: nombre corto, RFC, teléfono principal, badge activo/inactivo, acciones ver/editar/eliminar) y `SupplierModal.tsx` (formulario de crear/editar, con selects de código de país para teléfono/whatsapp principal; el estado vacío para un proveedor nuevo inicializa `id_phonecode_principal` e `id_whatsappcode_principal` en `52`).
5. Crear `app/dashboard/proveedores/page.tsx` (client component, mismo patrón que `pacientes/page.tsx`/`productos/page.tsx`): fetch de `getSuppliers`/`getPhoneCodes`, buscador client-side por nombre corto/RFC, tabla con `SupplierRow`, botón "Nuevo Proveedor" que abre `SupplierModal`, confirmación antes de eliminar.
6. Crear `app/dashboard/proveedores/[id]/page.tsx` como Server Component: fetch de `getSupplierById` (redirige o muestra "no encontrado" si no existe), renderiza breadcrumb + tarjetas "Información General", "Contacto" y "Ubicación" (estructura de `supplier-detail.html`, sin "Productos Asociados" ni "Historial de Pedidos").
7. Crear `app/dashboard/proveedores/[id]/componentes/EditSupplierButton.tsx` (client component leaf): botón "Editar Datos" que abre `SupplierModal` (reutilizado de `../../componentes/SupplierModal.tsx`) precargado con los datos del proveedor, y refresca el detalle (`router.refresh()`) al guardar.
8. Aplicar la paleta y tipografía de `references/suppliers/DESIGN.md` vía Tailwind, con contraparte en modo oscuro (`dark:`) consistente con `ThemeContext`, en lista, modal y detalle.
9. Agregar "Proveedores" como hijo de "Inventario" en `app/dashboard/componentes/navConfig.tsx` (`href: "/dashboard/proveedores"`, ícono `Truck` de `lucide-react`, mismas reglas que "Productos": `excludeRoles: [5]`).
10. Verificar manualmente: crear un proveedor, verlo en la lista, abrir su detalle, editarlo desde el detalle y desde la lista, activar/desactivar, eliminarlo (soft-delete) y confirmar que desaparece de la lista, y revisar modo claro/oscuro.

## Criterios de aceptación

- [ ] Existe la tabla `[CentroPodologico].[dbo].[proveedores]` con las columnas definidas en el modelo de datos.
- [ ] "Proveedores" aparece como ítem dentro del grupo "Inventario" del sidebar, con las mismas reglas de rol que "Productos" (oculto para `id_role === 5`).
- [ ] `/dashboard/proveedores` muestra la lista de proveedores activos (`status = 1`) de la empresa del usuario autenticado, con nombre corto, RFC, teléfono principal y badge Activo/Inactivo.
- [ ] El buscador de texto filtra la lista por nombre corto o RFC en el cliente, sin recargar la página.
- [ ] El botón "Nuevo Proveedor" abre `SupplierModal` con el formulario completo; al guardar con solo "Nombre Corto" lleno, `saveSupplier` crea el proveedor correctamente.
- [ ] El formulario no permite guardar sin "Nombre Corto"; el resto de los campos son opcionales.
- [ ] El selector de código de país aparece únicamente en Teléfono Principal y WhatsApp Principal (con default `52`/México en proveedor nuevo); Teléfono/WhatsApp Secundario son campos de texto libre.
- [ ] El ícono de "ver" en la lista navega a `/dashboard/proveedores/[id]` y muestra los datos correctos del proveedor en las tarjetas Información General, Contacto y Ubicación.
- [ ] La página de detalle no muestra "Productos Asociados" ni "Ver Historial de Pedidos".
- [ ] El botón "Editar Datos" (`EditSupplierButton`) en el detalle abre `SupplierModal` precargado y, al guardar, el detalle refleja los cambios sin recarga manual.
- [ ] El ícono de "editar" en la lista abre el mismo `SupplierModal` y persiste los cambios vía `saveSupplier`.
- [ ] El toggle Activo/Inactivo se puede cambiar desde el modal y se refleja en el badge de la lista y del detalle.
- [ ] El ícono de "eliminar" en la lista llama a `deleteSupplier` (soft-delete, `status = 0`) tras confirmación, y el proveedor deja de aparecer en la lista y en resultados de búsqueda.
- [ ] La lista, el modal y el detalle se ven correctamente en modo claro y en modo oscuro, con la paleta de `references/suppliers/DESIGN.md`.
- [ ] No hay errores de TypeScript ni de build (`npm run build`) tras el cambio.

## Decisiones tomadas y descartadas

- **Excluir "Productos Asociados" e "Historial de Pedidos" del detalle:** ninguna de las dos tiene soporte en la BD hoy (falta `id_proveedor` en `productos`, no existen `purchase_orders`). Se descartó mostrarlas como placeholders visuales por violar la convención del proyecto de no dejar UI a medio implementar (mismo criterio usado en el spec del sidebar). Quedan diferidas a un spec futuro del sistema de inventario/compras descrito en `references/docs/Inventario.md`.
- **Proveedor compartido a nivel empresa, no por sucursal:** se decidió así porque un mismo proveedor típicamente surte a varias sucursales, y `Inventario.md` define la tabla `Proveedores` sin `id_sucursal`. Se descartó el patrón "por sucursal" de `productos` porque duplicaría proveedores innecesariamente entre sucursales de la misma empresa.
- **Paleta de `DESIGN.md` con soporte dark mode agregado, en vez de la paleta zinc actual del proyecto:** se decidió adoptar los tokens de `references/suppliers/DESIGN.md` para esta sección (por instrucción explícita), complementándolos con una contraparte oscura vía `dark:` (no definida en el mockup original) para mantener consistencia con `ThemeContext`, que ya aplica en el resto del dashboard.
- **Mismo acceso por rol que "Productos" (`excludeRoles: [5]`):** se descartó restringir a solo administradores (como "Usuarios") porque proveedores es parte del flujo de inventario, al que ya tienen acceso los mismos roles que ven "Productos".
- **Dos estados independientes, `activo` y `status`:** `activo` es un toggle de negocio visible (badge Activo/Inactivo) editable por el usuario; `status` es el soft-delete técnico (mismo mecanismo que `productos`/`servicios`). Se descartó fusionarlos en un solo campo porque el mockup y `Inventario.md` distinguen explícitamente "desactivar temporalmente" de "eliminar".
- **Código de país solo en Teléfono/WhatsApp principal, con default 52 (México):** se descartó agregarlo también a los campos secundarios porque `Inventario.md` solo define `id_phonecode_principal`/`id_whatsappcode_principal`, sin equivalentes para los números secundarios. Al crear un proveedor nuevo, ambos campos inician en `52`, igual que el patrón ya usado en `pacientes/page.tsx` (`id_phone_code: 52` en el objeto `EMPTY`); el usuario puede cambiarlo si el proveedor es de otro país.
- **Sin paginación real ni botón "Filtros" funcional:** se mantiene consistencia con el resto de listas del proyecto (pacientes, productos), que no tienen paginación server-side; se descartó introducir un patrón nuevo solo para esta sección.
- **Nombres de código en inglés (`SupplierRow`, `SupplierModal`, `ISupplier`, `getSuppliers`, `saveSupplier`, `deleteSupplier`), con la carpeta de ruta (`app/dashboard/proveedores/`) y las columnas de BD en español:** aplica la convención de nombres de `CLAUDE.md` a este feature nuevo, aunque features existentes (`ProductoFila`, `PacienteFila`, etc.) no se renombran retroactivamente — eso queda fuera de alcance de este spec.

## Riesgos identificados

- **Tabla `proveedores` sin migración versionada:** al no existir herramienta de migraciones, el `CREATE TABLE` se ejecuta manualmente contra la BD (paso 1 del plan). Si se olvida ejecutar antes de desplegar el código, las server actions fallarán en producción; se mitiga documentándolo explícitamente como primer paso obligatorio.
- **Inconsistencia de convención de nombres dentro del mismo feature:** los archivos de interfaz y componentes usan inglés (`supplier.ts`, `SupplierRow.tsx`) mientras que la carpeta de ruta y las props que mirrorean columnas de BD siguen en español (`nombre_corto`, `rfc`). Existe riesgo de que un desarrollador nuevo encuentre la mezcla confusa al no estar aún aplicada en el resto del proyecto; se acepta porque es la única forma de cumplir la regla de `CLAUDE.md` sin romper el patrón arquitectónico de interfaces-como-DTO ya establecido.
- **Deuda de alcance visible al usuario:** el botón "Ver Historial de Pedidos" y la sección "Productos Asociados" del mockup original no aparecerán en esta versión, lo que puede generar la expectativa de que "falta algo" respecto al diseño de referencia. Se acepta porque ambas dependen de features no construidas (`purchase_orders`, `id_proveedor` en `productos`) y quedan explícitamente diferidas, no perdidas.
