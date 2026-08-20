# 25 — Módulo de Empleados (RH): alta, listado y expediente

## Header

- **Estado:** Aprobado
- **Depende de:** Ninguno. Consume los catálogos ya existentes en el esquema `RH`
  (`RH.departamentos`, `RH.puestos`, `RH.turnos`) y las tablas existentes
  `dbo.sucursales` / `dbo.empresas`. No modifica specs previos.
- **Fecha:** 2026-08-19
- **Objetivo:** Crear el módulo `/dashboard/empleados` con alta y edición del expediente
  completo del empleado (datos generales, personales y laborales + fotografía), listado
  filtrable de la plantilla, y pantalla de detalle con la pestaña "Información General",
  respaldado por una nueva tabla `RH.empleados`.

## Alcance

**Incluye:**

### Base de datos

- Nueva tabla **`[CentroPodologico].[RH].[empleados]`** (DDL completo en la sección "Modelo de datos"),
  con `id_empleado INT IDENTITY` como PK y `codigo_empleado` como identificador visible.
- La tabla se crea manualmente contra la BD (no hay herramienta de migraciones) y el DDL queda
  documentado en `queries.txt`, junto al bloque `------------ RECURSOS HUMANOS(EMPLEADOS)----------------------`
  que ya contiene los catálogos.
- No se modifican `RH.departamentos`, `RH.puestos` ni `RH.turnos`: se consumen tal como están.

### Navegación y permisos

- Se habilita el ítem **"Empleados"** que ya existe en `app/dashboard/componentes/navConfig.tsx`
  (hoy con `disabled: true`): se le quita `disabled`, se le agrega `href: "/dashboard/empleados"`
  y conserva `excludeRoles: [2, 3, 5]` → visible solo para `id_role` **1 y 4**.
- Se agrega guarda de ruta en `proxy.ts`: `/dashboard/empleados` (y sus subrutas) solo accesible
  para `id_role` 1 y 4; cualquier otro rol es redirigido, mismo criterio que `/dashboard/usuarios`.

### Listado — `/dashboard/empleados`

- Tabla con columnas: **Empleado** (nombre completo + código), **WhatsApp**, **Puesto / Departamento**,
  **Sucursal**, **Ingreso**, **Estado**, **Acciones** (ver expediente / editar).
- Trae los empleados de **todas las sucursales a las que el usuario tiene acceso**
  (`sucursales_string` del JWT), no de la sucursal activa de `SucursalContext`.
- Dos tarjetas de resumen: **Total de Empleados** y **Empleados Activos**.
- Filtros, todos aplicados **en cliente** sobre el conjunto ya cargado:
  búsqueda por nombre o `codigo_empleado`, `<select>` de departamento, `<select>` de sucursal
  ("Todas las sucursales" por defecto), `<select>` de estatus (Todos / Activos / Inactivos).
- Sin paginación: se listan todos los empleados de la empresa.
- Indicador visual de estatus: chip **verde** para Activo, **rojo** para Inactivo; las filas
  inactivas se atenúan (`opacity`), como en `employees-list.html`.

### Alta y edición — modal único

- Un solo componente modal en modo **crear** / **editar** (patrón `SupplierModal.tsx`),
  abierto desde el botón "Nuevo Empleado" del listado y desde "Editar" en el detalle.
- Captura el **expediente base completo**, en tres secciones:
  - **Datos generales:** fotografía, nombre(s), apellido paterno, apellido materno, fecha de ingreso,
    sucursal, supervisor, WhatsApp, correo, RFC, CURP, NSS. El campo "ID Empleado" se muestra
    **deshabilitado** (placeholder en alta, valor real en edición).
  - **Datos personales:** fecha de nacimiento, género, estado civil, dirección, teléfono personal,
    contacto de emergencia (nombre) y WhatsApp de emergencia.
  - **Información laboral:** departamento, puesto, turno, días laborales, horario, salario diario,
    salario quincenal, salario mensual, tipo de salario, comisión, cuenta bancaria.
- El `<select>` de **Puesto** se filtra por el departamento seleccionado (`RH.puestos.id_department`);
  cambiar de departamento limpia el puesto elegido.
- **Campos obligatorios:** nombre, departamento, puesto, sucursal y fecha de ingreso. El resto opcional
  (los apellidos incluidos).
- `codigo_empleado` se genera **automáticamente en el server action** al insertar; nunca es editable.

### Fotografía

- Subida vía el endpoint existente `app/api/upload` (Cloudinary, ya acepta imágenes);
  la URL resultante se guarda en `RH.empleados.foto_url`.
- No se muestra en el listado (solo texto), y sí en el encabezado del expediente.
- Si el empleado no tiene foto, se muestra un placeholder con iniciales.

### Detalle / expediente — `/dashboard/empleados/[id]`

- Encabezado con fotografía, nombre completo, puesto, chip de estatus, y la rejilla de datos
  principales (ID empleado, teléfono, fecha de ingreso, correo, sucursal, RFC, CURP, NSS, supervisor).
- Acciones: **Editar** (abre el modal en modo edición) y **Activar / Desactivar**.
- **Una sola pestaña: "Información General"**, con las dos secciones de solo lectura
  "Datos Personales" e "Información Laboral".
- **Edad** y **antigüedad** calculadas al vuelo desde `fecha_nacimiento` y `fecha_ingreso`;
  nunca se almacenan.

### Estatus

- "Desactivar" pone `activo = 0`; "Activar" lo regresa a 1. Nunca borra el registro
  (ni físico ni lógico): `status` permanece en 1 desde la UI.

**No incluye (para specs futuras):**

- Las otras seis pestañas del expediente: **Nómina y Salario, Asistencia, Agenda Laboral,
  Documentos, Incidencias, Productividad, Inventario Asignado**. No se renderiza ni siquiera
  la barra de pestañas con placeholders — solo existe "Información General".
- **Expediente documental** (INE, comprobante de domicilio, constancia fiscal, contrato,
  firmas de recibido de equipo/instrumental). La única carga de archivo en este spec es la fotografía.
- **CRUD de los catálogos** `RH.departamentos`, `RH.puestos` y `RH.turnos`: se leen, no se administran
  desde la UI. Alta/edición de departamentos y puestos merece su propio spec.
- **Vínculo empleado ↔ usuario del sistema** (`dbo.usuarios`): son entidades separadas en este spec.
- **Cálculo automático entre salarios** (diario ↔ quincenal ↔ mensual) y cualquier lógica de nómina.
- **Estructuración de horario y días laborales** (catálogo de días, rangos horarios, agenda):
  aquí son texto libre.
- **Validación de formato ni unicidad de RFC / CURP / NSS**: solo se almacenan.
- **Paginación, exportación a Excel y borrado de empleados.**
- **Multi-empresa cruzada:** todo se filtra por el `id_empresa` del usuario autenticado.

## Modelo de datos

### Tabla nueva: `[CentroPodologico].[RH].[empleados]`

Se crea manualmente contra la BD (no hay migraciones) y el DDL se documenta en `queries.txt`,
bajo el bloque `------------ RECURSOS HUMANOS(EMPLEADOS)----------------------`.

Los tipos de las FK **coinciden exactamente** con las PK de los catálogos ya creados:
`departamentos.id_department` es `INT`, `puestos.id_puesto` es `SMALLINT`,
`turnos.id_turno` es `TINYINT`.

```sql
USE [CentroPodologico]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [RH].[empleados](
    [id_empleado]         [int] IDENTITY(1,1) NOT NULL,
    [codigo_empleado]     [varchar](20)  NOT NULL,   -- EMP-2026-001, generado en el server action
    [id_empresa]          [int]          NOT NULL,
    [id_sucursal]         [int]          NOT NULL,

    -- Datos generales
    [nombre]              [varchar](100) NOT NULL,
    [apellido_paterno]    [varchar](100) NULL,
    [apellido_materno]    [varchar](100) NULL,
    [foto_url]            [varchar](500) NULL,
    [fecha_ingreso]       [date]         NOT NULL,
    [id_supervisor]       [int]          NULL,        -- FK autoreferencial a RH.empleados
    [whatsapp]            [varchar](25)  NULL,
    [email]               [varchar](150) NULL,
    [rfc]                 [varchar](13)  NULL,
    [curp]                [varchar](18)  NULL,
    [nss]                 [varchar](15)  NULL,

    -- Datos personales
    [fecha_nacimiento]    [date]         NULL,
    [genero]              [varchar](20)  NULL,        -- 'femenino' | 'masculino' | 'otro'
    [estado_civil]        [varchar](20)  NULL,        -- 'soltero' | 'casado' | 'divorciado' | 'viudo'
    [direccion]           [varchar](500) NULL,
    [telefono]            [varchar](25)  NULL,
    [contacto_emergencia] [varchar](150) NULL,
    [whatsapp_emergencia] [varchar](25)  NULL,

    -- Información laboral
    [id_department]       [int]          NOT NULL,
    [id_puesto]           [smallint]     NOT NULL,
    [id_turno]            [tinyint]      NULL,
    [dias_laborales]      [varchar](100) NULL,        -- texto libre: "Lunes a Sábado"
    [horario]             [varchar](50)  NULL,        -- texto libre: "09:00 - 18:00"
    [salario_diario]      [decimal](12,2) NULL,
    [salario_quincenal]   [decimal](12,2) NULL,
    [salario_mensual]     [decimal](12,2) NULL,
    [tipo_salario]        [varchar](20)  NULL,        -- 'fijo' | 'comision' | 'mixto'
    [comision]            [decimal](5,2) NULL,        -- porcentaje, ej. 10.00
    [cuenta_bancaria]     [varchar](100) NULL,

    -- Control
    [activo]              [bit]          NOT NULL CONSTRAINT [DF_empleados_activo] DEFAULT (1),
    [status]              [bit]          NOT NULL CONSTRAINT [DF_empleados_status] DEFAULT (1),
    [created_at]          [datetime2](0) NULL,
    [updated_at]          [datetime2](0) NULL,

 CONSTRAINT [PK_empleados] PRIMARY KEY CLUSTERED ([id_empleado] ASC),
 CONSTRAINT [UQ_empleados_codigo] UNIQUE ([codigo_empleado]),
 CONSTRAINT [FK_empleados_departamento] FOREIGN KEY ([id_department])
     REFERENCES [RH].[departamentos] ([id_department]),
 CONSTRAINT [FK_empleados_puesto] FOREIGN KEY ([id_puesto])
     REFERENCES [RH].[puestos] ([id_puesto]),
 CONSTRAINT [FK_empleados_turno] FOREIGN KEY ([id_turno])
     REFERENCES [RH].[turnos] ([id_turno]),
 CONSTRAINT [FK_empleados_supervisor] FOREIGN KEY ([id_supervisor])
     REFERENCES [RH].[empleados] ([id_empleado])
) ON [PRIMARY]
GO
CREATE INDEX [IX_empleados_empresa_sucursal]
    ON [RH].[empleados] ([id_empresa], [id_sucursal]) INCLUDE ([activo], [status])
GO
CREATE INDEX [IX_empleados_apellido]
    ON [RH].[empleados] ([apellido_paterno], [apellido_materno], [nombre])
GO
```

Notas de diseño de la tabla:

- **El nombre va partido en tres columnas** (`nombre`, `apellido_paterno`, `apellido_materno`),
  espejeando `dbo.pacientes`. El `nombre_completo` que consume la UI se arma en el server action.
- **`activo` vs `status`:** `activo` es el estatus de negocio (Activo/Inactivo, el chip verde/rojo);
  `status` es el borrado lógico del patrón del repo, que desde la UI siempre queda en 1.
- **`fecha_ingreso` y `fecha_nacimiento` son `date`**, no `datetime`: no tienen componente horario.
- **No hay FK a `sucursales`/`empresas`** porque el resto del repo tampoco las declara;
  el filtrado se hace por `WHERE` en cada consulta.

### Generación de `codigo_empleado`

Se calcula en el server action de alta, dentro de la misma operación de inserción:

- Formato: `EMP-{YYYY}-{NNN}`, donde `YYYY` es el año de `fecha_ingreso` y `NNN` un consecutivo
  de 3 dígitos con ceros a la izquierda.
- El consecutivo es **por año y por empresa**: `MAX` del sufijo numérico de los códigos existentes
  con el mismo prefijo `EMP-{YYYY}-` e `id_empresa`, más 1.
- Si el consecutivo rebasa 999, el código simplemente crece a 4 dígitos (`EMP-2026-1000`);
  `varchar(20)` da margen de sobra.

### Interfaces TypeScript

Archivo nuevo `interfaces/employee.ts`. Los nombres de tipo van en **inglés** conforme a `CLAUDE.md`,
aunque los nombres de campo espejean las columnas de la BD (en español), igual que `ISupplier`
espejea columnas en español.

```ts
/** Fila de RH.empleados tal como la devuelven los server actions. */
export interface IEmployee {
  id_empleado:         number;
  codigo_empleado:     string;
  id_empresa:          number;
  id_sucursal:         number;

  nombre:              string;
  apellido_paterno:    string | null;
  apellido_materno:    string | null;
  foto_url:            string | null;
  fecha_ingreso:       string;          // "YYYY-MM-DD" — nunca Date
  id_supervisor:       number | null;
  whatsapp:            string | null;
  email:               string | null;
  rfc:                 string | null;
  curp:                string | null;
  nss:                 string | null;

  fecha_nacimiento:    string | null;   // "YYYY-MM-DD" — nunca Date
  genero:              string | null;
  estado_civil:        string | null;
  direccion:           string | null;
  telefono:            string | null;
  contacto_emergencia: string | null;
  whatsapp_emergencia: string | null;

  id_department:       number;
  id_puesto:           number;
  id_turno:            number | null;
  dias_laborales:      string | null;
  horario:             string | null;
  salario_diario:      number | null;
  salario_quincenal:   number | null;
  salario_mensual:     number | null;
  tipo_salario:        string | null;
  comision:            number | null;
  cuenta_bancaria:     string | null;

  activo:              boolean;
  status:              boolean;
  created_at:          string | null;   // "YYYY-MM-DD HH:mm:ss"
  updated_at:          string | null;
}

/** Fila del listado: IEmployee + nombres resueltos por JOIN + nombre concatenado. */
export interface IEmployeeListItem extends IEmployee {
  /** nombre + apellido_paterno + apellido_materno, con un solo espacio entre partes no vacías. */
  nombre_completo:     string;
  nombre_departamento: string;
  nombre_puesto:       string;
  nombre_sucursal:     string;
}

/** Expediente del detalle: agrega el nombre del supervisor y del turno. */
export interface IEmployeeRecord extends IEmployeeListItem {
  nombre_supervisor:   string | null;   // concatenación de las tres columnas del supervisor
  nombre_turno:        string | null;
}

/** Payload del modal de alta/edición. Sin campos derivados ni generados. */
export type EmployeeFormInput = Omit<
  IEmployee,
  "id_empleado" | "codigo_empleado" | "id_empresa" | "activo" | "status" | "created_at" | "updated_at"
>;
```

Archivo nuevo `interfaces/rh_catalogs.ts` para los tres catálogos ya existentes en BD:

```ts
export interface IDepartment {
  id_department: number;
  name:          string;
  id_empresa:    number | null;
  status:        boolean;
  activo:        boolean;
  description:   string | null;
}

export interface IPosition {
  id_puesto:     number;
  id_department: number | null;
  name:          string;
  status:        boolean;
  activo:        boolean;
  description:   string | null;
}

export interface IShift {
  id_turno:      number;
  description:   string;
  status:        boolean;
}
```

### Manejo de fechas (reglas de `CLAUDE.md`)

- **SELECT:** `CONVERT(varchar(10), [fecha_ingreso], 120)` y `CONVERT(varchar(10), [fecha_nacimiento], 120)`;
  `CONVERT(varchar(19), [created_at], 120)` y `CONVERT(varchar(19), [updated_at], 120)`.
- **Escritura:** las fechas del formulario pasan por `toDBString(String(val ?? ""))`; nunca `new Date(val)`.
  `created_at` / `updated_at` se llenan con `buildDate(new Date())`.
- **Inputs:** los `<input type="date">` se bindean con `String(val ?? "").slice(0, 10)`.
- **Edad y antigüedad:** se calculan a partir del string normalizado
  (`"YYYY-MM-DD"` + `"T00:00:00"`), nunca con `new Date(dbValue)` sobre el string crudo.

## Plan de implementación

### 1. Base de datos

Ejecutar manualmente contra `CentroPodologico` el `CREATE TABLE [RH].[empleados]` de la sección
"Modelo de datos", junto con sus dos índices. Agregar el mismo DDL a `queries.txt`, debajo del bloque
de `RH.turnos`, bajo el separador `-------------------- TABLA EMPLEADOS---------------------`.

*Verificación:* `SELECT TOP 1 * FROM [RH].[empleados]` responde sin error y
`sp_help '[RH].[empleados]'` lista las cuatro FK y la constraint `UQ_empleados_codigo`.

### 2. Interfaces

Crear `interfaces/employee.ts` (`IEmployee`, `IEmployeeListItem`, `IEmployeeRecord`,
`EmployeeFormInput`) e `interfaces/rh_catalogs.ts` (`IDepartment`, `IPosition`, `IShift`),
con el contenido de la sección anterior.

*Verificación:* `npm run build` compila. El sistema sigue funcionando igual (solo se agregaron tipos).

### 3. Server actions — `app/dashboard/empleados/actions.ts`

Archivo nuevo con `"use server"`, siguiendo el patrón de `app/dashboard/proveedores/actions.ts`
(helper local `getActiveUser()` que lee la cookie `auth_token` y verifica el JWT con `jose`).

- `getEmployees(): Promise<IEmployeeListItem[]>` — todos los empleados con `status = 1` de las
  sucursales del usuario. Filtra por `id_empresa` y por `id_sucursal IN (...)` a partir de
  `sucursales_string` del JWT (parseado a enteros y validado — nunca interpolado crudo en el SQL;
  se arma la lista de parámetros `@suc0, @suc1, …` y se pasan por `queryParams`).
  `JOIN` a `RH.departamentos`, `RH.puestos` y `dbo.sucursales` para los nombres.
  Fechas vía `CONVERT(varchar(10), …, 120)`. Arma `nombre_completo` en JS (trim + un solo espacio,
  sin dobles espacios cuando falta un apellido), mismo criterio que `exportPacientesSucursal()`
  del spec 24. Orden: `activo DESC, apellido_paterno ASC, apellido_materno ASC, nombre ASC`.
- `getEmployeeById(id_empleado): Promise<IEmployeeRecord | null>` — mismo `SELECT` + `LEFT JOIN`
  a `RH.turnos` y `LEFT JOIN` autoreferencial a `RH.empleados` para `nombre_supervisor`
  (concatenación de sus tres columnas de nombre).
  Valida que el registro pertenezca al `id_empresa` del usuario y a una de sus sucursales;
  si no, devuelve `null`.
- `getEmployeeCatalogs()` — devuelve `{ departments, positions, shifts, sucursales, supervisors }`
  en una sola llamada para poblar los `<select>` del modal. `supervisors` es la lista mínima
  (`id_empleado`, `nombre_completo`) de empleados activos de la empresa.
- `createEmployee(input: EmployeeFormInput): Promise<ActionResult<number>>` —
  valida obligatorios (nombre, departamento, puesto, sucursal, fecha de ingreso), genera
  `codigo_empleado` según la regla `EMP-{YYYY}-{NNN}`, inserta con `created_at = buildDate(new Date())`,
  devuelve el `id_empleado` nuevo vía `SCOPE_IDENTITY()`. `revalidatePath("/dashboard/empleados")`.
- `updateEmployee(id_empleado, input): Promise<ActionResult<null>>` — mismas validaciones,
  no toca `codigo_empleado` ni `activo`, escribe `updated_at = buildDate(new Date())`.
  Revalida listado y detalle.
- `setEmployeeActive(id_empleado, activo: boolean): Promise<ActionResult<null>>` —
  `UPDATE ... SET activo = @activo, updated_at = @updated_at`. Nunca toca `status`.

Todas las escrituras usan `db.queryParams`; las fechas pasan por `toDBString(String(val ?? ""))`.
Todas devuelven el discriminado `ActionResult<T>` del repo.

*Verificación:* invocar los actions desde una página temporal o `node` devuelve datos correctos;
un empleado de otra empresa/sucursal no aparece en `getEmployees()` ni se resuelve en `getEmployeeById()`.

### 4. Navegación y guarda de ruta

- `app/dashboard/componentes/navConfig.tsx`: al ítem "Empleados" quitarle `disabled: true` y
  agregarle `href: "/dashboard/empleados"`. Se conserva `excludeRoles: [2, 3, 5]`.
- `proxy.ts`: agregar la regla que redirige a `/dashboard` cualquier acceso a
  `/dashboard/empleados` (y subrutas) cuando `id_role` no sea 1 ni 4, con el mismo estilo
  que la regla existente de `/dashboard/usuarios`.

*Verificación:* con rol 1 o 4 el ítem aparece en el sidebar y la ruta carga; con rol 2, 3 o 5
el ítem no se renderiza y navegar a la URL a mano redirige.

### 5. Listado — `app/dashboard/empleados/page.tsx` + componentes

- `page.tsx` como **Server Component**: llama `getEmployees()` y `getEmployeeCatalogs()` y pasa
  los datos a un componente cliente de filtros/tabla. El client boundary queda en las hojas,
  no en la página.
- `componentes/EmployeesTable.tsx` (`"use client"`): mantiene el estado de los cuatro filtros
  (búsqueda, departamento, sucursal, estatus), filtra en memoria con `useMemo`, y renderiza la tabla.
  `key` = `id_empleado`. La búsqueda aplica sobre `nombre_completo` **y** sobre `codigo_empleado`,
  para que "López María" y "María López" encuentren al mismo empleado.
- `componentes/EmployeeRow.tsx`: una fila; nombre completo + `codigo_empleado`, WhatsApp,
  puesto/departamento, sucursal, fecha de ingreso formateada, chip de estatus, acciones (link al
  expediente + abrir modal de edición). Fila atenuada cuando `activo` es `false`.
- `componentes/EmployeeStatusBadge.tsx`: chip verde/rojo reutilizable — lo consumen la fila y el
  encabezado del expediente. (Antes de crearlo, revisar `OrderStatusBadge.tsx` por si se puede reutilizar.)
- `componentes/EmployeeSummaryCards.tsx`: las dos tarjetas (Total / Activos), calculadas del
  mismo arreglo — sin consulta extra.

Diseño con el sistema visual actual del dashboard (Tailwind del proyecto, modo claro/oscuro,
iconos `lucide-react`), **no** con el `tailwind.config` de los HTML de referencia, que solo aportan
estructura y jerarquía. Se aplica la skill `frontend-design` y los tokens de paleta y tipografía
de `references/DESIGN.md`, con contraparte `dark:` consistente con `ThemeContext`, siguiendo el
mismo criterio que Movimientos/Recepciones/Conteo Físico.

*Verificación:* la pantalla lista los empleados sembrados, los cuatro filtros se combinan
correctamente, y los contadores coinciden con lo filtrado/total según lo definido.

### 6. Modal de alta y edición — `componentes/EmployeeModal.tsx`

Componente cliente único con prop `employee?: IEmployeeRecord` (ausente = modo crear).
Tres secciones (Datos generales / Datos personales / Información laboral) siguiendo `form.html`,
con **Nombre(s)**, **Apellido paterno** y **Apellido materno** como campos separados.

- `<select>` de puesto derivado del departamento elegido con `useMemo` sobre `positions`;
  cambiar departamento resetea `id_puesto`.
- "ID Empleado" deshabilitado: placeholder `EMP-{año}-XXX` en alta, `codigo_empleado` real en edición.
- Foto: input de archivo que sube a `POST /api/upload` y guarda la URL devuelta en el estado del
  formulario; preview inmediato; en edición, muestra la foto actual con opción de reemplazarla.
- Validación en cliente de los cinco obligatorios antes de enviar; el server action revalida igual.
- Al guardar llama `createEmployee` / `updateEmployee`, ramifica sobre `result.ok`, muestra el
  mensaje de error si falla y cierra + refresca (`router.refresh()`) si tiene éxito.
- `<input type="date">` bindeados con `String(val ?? "").slice(0, 10)`.

Diseño con la paleta y tipografía de `references/DESIGN.md` (modo claro/oscuro vía `dark:`),
igual que el listado del paso 5.

*Verificación:* alta completa genera `codigo_empleado` correcto y aparece en el listado;
edición persiste todos los campos; subir foto guarda la URL de Cloudinary.

### 7. Expediente — `app/dashboard/empleados/[id]/page.tsx`

- Server Component: `getEmployeeById(Number(params.id))`; si devuelve `null`, `notFound()`.
- `componentes/EmployeeHeader.tsx`: foto (o placeholder con iniciales), nombre completo, puesto,
  chip de estatus, rejilla de datos principales, y botones **Editar** y **Activar/Desactivar**
  (estos dos en un componente cliente pequeño, `EmployeeActions.tsx`, que llama `setEmployeeActive`
  con confirmación vía el `ConfirmModal.tsx` existente).
- `componentes/EmployeeGeneralInfo.tsx`: las dos secciones de solo lectura, Datos Personales
  e Información Laboral, en la rejilla etiqueta/valor de `employee-detail.html`.
  Sin barra de pestañas. Mismos tokens de `references/DESIGN.md` que listado y modal.
- `utils/employee_helpers.ts` (o el archivo de utils que corresponda): funciones
  `calculateAge(birthDateString)` y `calculateSeniority(hireDateString)` que normalizan el string
  antes de construir la fecha, conforme a las reglas de `CLAUDE.md`.

*Verificación:* el expediente muestra todos los campos capturados, edad y antigüedad correctas
(incluida la validación en un cumpleaños del día de hoy y en uno de mañana), Desactivar cambia
el chip a rojo sin perder datos, y Editar abre el modal precargado.

### 8. Verificación manual completa

- Alta de un empleado con solo los campos obligatorios: guarda bien, los opcionales quedan vacíos.
- Alta de un empleado con todos los campos: todo persiste y se ve en el expediente.
- Alta de un empleado sin apellido materno: `nombre_completo` no queda con doble espacio ni
  espacio final, ni en el listado ni en el expediente.
- Dos altas en el mismo año: `EMP-2026-001` y `EMP-2026-002`. Una con `fecha_ingreso` de otro año:
  reinicia el consecutivo de ese año.
- Filtros: cada uno por separado y combinados; búsqueda por nombre parcial, por apellido y por código.
- Empleado inactivo: fila atenuada, chip rojo, y aparece/desaparece según el filtro de estatus.
- Usuario con acceso a una sola sucursal: solo ve a los empleados de esa sucursal.
- Rol 2, 3 o 5: sin ítem en el sidebar y redirigido al entrar por URL.
- Modo claro y oscuro en listado, modal y expediente.
- Responsive: la tabla scrollea horizontalmente en móvil; el modal es usable en pantalla chica.

### 9. `npm run build` sin errores de TypeScript ni de lint.

## Criterios de aceptación

### Base de datos y tipos

- [ ] Existe la tabla `[CentroPodologico].[RH].[empleados]` con todas las columnas, defaults,
      la constraint única `UQ_empleados_codigo` y las cuatro FK (departamento, puesto, turno,
      supervisor autoreferencial).
- [ ] El DDL quedó documentado en `queries.txt` junto a los catálogos de RH.
- [ ] Existen `interfaces/employee.ts` e `interfaces/rh_catalogs.ts`, y `npm run build` compila.

### Navegación y permisos

- [ ] El ítem "Empleados" del sidebar ya no está `disabled` y navega a `/dashboard/empleados`.
- [ ] Un usuario con `id_role` 1 o 4 ve el ítem y puede entrar al módulo.
- [ ] Un usuario con `id_role` 2, 3 o 5 no ve el ítem, y entrar a `/dashboard/empleados`
      o `/dashboard/empleados/{id}` escribiendo la URL lo redirige por `proxy.ts`.

### Listado

- [ ] `/dashboard/empleados` lista los empleados con `status = 1` de **todas** las sucursales
      del usuario (`sucursales_string`), no solo la sucursal activa de `SucursalContext`.
- [ ] Un usuario con acceso a una sola sucursal ve únicamente empleados de esa sucursal.
- [ ] Ningún empleado de otra `id_empresa` aparece en el listado.
- [ ] Las columnas son Empleado (nombre completo + código), WhatsApp, Puesto/Departamento,
      Sucursal, Ingreso, Estado y Acciones.
- [ ] Las tarjetas "Total de Empleados" y "Empleados Activos" muestran los conteos correctos.
- [ ] La búsqueda encuentra por nombre parcial en cualquier orden (nombre o apellido) y por
      `codigo_empleado`.
- [ ] Los filtros de departamento, sucursal y estatus funcionan por separado y combinados
      con la búsqueda.
- [ ] Los empleados inactivos se muestran con chip rojo y fila atenuada; los activos con chip verde.
- [ ] `page.tsx` del listado es Server Component; el `"use client"` vive solo en los componentes
      de filtros/tabla/acciones.

### Alta

- [ ] El botón "Nuevo Empleado" abre el modal con las tres secciones (Datos generales,
      Datos personales, Información laboral).
- [ ] El formulario rechaza el guardado si falta nombre, departamento, puesto, sucursal
      o fecha de ingreso, e indica cuál falta.
- [ ] Un alta con solo los obligatorios se guarda correctamente y los campos opcionales
      quedan vacíos (no en `"undefined"` ni `"null"` como texto).
- [ ] El `<select>` de Puesto solo muestra los puestos del departamento seleccionado, y cambiar
      de departamento limpia el puesto elegido.
- [ ] El campo "ID Empleado" está deshabilitado y nunca es editable.
- [ ] `codigo_empleado` se genera automáticamente con formato `EMP-{año de ingreso}-{NNN}`;
      dos altas del mismo año producen `-001` y `-002`, y un alta con fecha de ingreso de otro
      año arranca su propio consecutivo.
- [ ] `nombre_completo` no tiene dobles espacios ni espacio final cuando falta algún apellido.
- [ ] Subir una fotografía la envía a `POST /api/upload` y guarda la URL de Cloudinary
      en `foto_url`; el preview se ve antes de guardar.
- [ ] El empleado recién creado aparece en el listado sin recargar manualmente la página.

### Edición

- [ ] "Editar" (desde el listado y desde el expediente) abre el mismo modal precargado con
      todos los valores actuales, incluida la foto.
- [ ] Guardar la edición persiste todos los campos y no altera `codigo_empleado` ni `activo`.
- [ ] `updated_at` se actualiza con `buildDate(new Date())`.

### Expediente

- [ ] `/dashboard/empleados/{id}` muestra encabezado con foto (o placeholder con iniciales),
      nombre completo, puesto, chip de estatus y la rejilla de datos principales
      (ID empleado, teléfono, fecha de ingreso, correo, sucursal, RFC, CURP, NSS, supervisor).
- [ ] Se renderiza **únicamente** la información de "Información General" (Datos Personales +
      Información Laboral). No existe barra de pestañas ni secciones vacías de Nómina,
      Asistencia, Documentos, Incidencias, Productividad o Inventario.
- [ ] La edad se calcula desde `fecha_nacimiento` y es correcta el mismo día del cumpleaños
      y el día anterior.
- [ ] La antigüedad se calcula desde `fecha_ingreso` y se muestra en años y meses.
- [ ] Ni la edad ni la antigüedad se almacenan en la base de datos.
- [ ] "Desactivar" pide confirmación, pone `activo = 0` y el expediente pasa a chip rojo,
      conservando todos los datos; "Activar" lo revierte.
- [ ] `status` sigue en 1 después de desactivar (no hay borrado desde la UI).
- [ ] Entrar a `/dashboard/empleados/{id}` de un empleado de otra empresa o de una sucursal
      sin acceso devuelve 404, no el expediente.

### Fechas y convenciones

- [ ] Ningún `SELECT` devuelve objetos `Date`: las fechas se leen con
      `CONVERT(varchar(10), …, 120)` y los timestamps con `CONVERT(varchar(19), …, 120)`.
- [ ] Ninguna escritura usa `new Date(valor)`; las fechas del formulario pasan por `toDBString`
      y los timestamps nuevos por `buildDate(new Date())`.
- [ ] Los `<input type="date">` se bindean con `String(val ?? "").slice(0, 10)` y muestran
      la fecha correcta (sin corrimiento de un día).
- [ ] Todas las consultas usan `db.queryParams`; la lista de sucursales entra como parámetros
      `@suc0, @suc1, …`, nunca interpolada en el SQL.
- [ ] Los nombres de funciones, variables, componentes, hooks y tipos nuevos están en inglés
      y son descriptivos (el texto de UI sigue en español).
- [ ] Listado, modal y expediente se ven correctamente en modo claro y oscuro, y son usables
      en pantalla móvil (tabla con scroll horizontal).
- [ ] La paleta de colores y tipografía visualmente se corresponden con `references/DESIGN.md`
      (Inter, tokens de color y radios), no con el `tailwind.config` embebido en los HTML de referencia.
- [ ] `npm run build` sin errores de TypeScript ni de lint.

## Decisiones tomadas y descartadas

- **PK `id_empleado IDENTITY` + `codigo_empleado` visible, en vez de una sola columna.**
  El HTML de referencia muestra un identificador legible ("EMP-2024-015") que el personal de RH
  usa para referirse a la persona. Usarlo como PK ataría las FK a un formato de negocio que puede
  cambiar (y que depende del año de ingreso, un dato editable). Se separan: entero autoincremental
  para las relaciones, código legible con constraint única para la gente.

- **Consecutivo del código por año y por empresa (`EMP-{YYYY}-{NNN}`), no global.**
  Un consecutivo global obligaría a mirar la BD para saber cuándo entró alguien; con el año en
  el código, la antigüedad relativa se lee de un vistazo. El riesgo (colisión si dos altas del
  mismo año ocurren simultáneamente) es despreciable en una clínica donde las altas las captura
  una sola persona de RH, y la constraint `UQ_empleados_codigo` lo convertiría en un error visible
  en vez de en datos corruptos.

- **Nombre partido en `nombre` / `apellido_paterno` / `apellido_materno`.**
  Decisión revisada durante la definición: la propuesta inicial era un campo único, siguiendo el
  `form.html`. Se cambió para espejear `dbo.pacientes`, la otra entidad de personas del sistema:
  mantiene simetría entre módulos, permite ordenar el directorio por apellido (que es como se
  busca a un empleado en papel) y evita tener que parsear el nombre después si algún reporte
  lo necesita separado. El costo es un input extra en el formulario y concatenar en el server action.

- **Listado transversal a todas las sucursales del usuario, no atado a `SucursalContext`.**
  El resto del dashboard (pacientes, citas, ventas) es operativo y vive dentro de una sucursal;
  RH es administrativo y necesita ver la plantilla completa. Atarlo al contexto obligaría a cambiar
  de sucursal para encontrar a alguien cuya sucursal no se recuerda. Se conserva el aislamiento
  real donde importa: `sucursales_string` del JWT sigue siendo el límite duro, e `id_empresa`
  filtra siempre.

- **Filtrado del listado en cliente, sin paginación ni consultas por filtro.**
  Una clínica maneja decenas de empleados, no miles: traer todo una vez y filtrar en memoria da
  respuesta instantánea a los cuatro filtros combinados sin round-trips. Se descartó paginar
  (complejidad sin beneficio a esta escala) y se descartó filtrar en servidor (cada cambio de
  `<select>` sería una consulta). Si la plantilla creciera a miles, la salida natural es mover
  filtros y paginación al server action — fuera de este spec.

- **Un solo modal para alta y edición, no dos componentes.**
  Los campos son idénticos; duplicar el formulario garantiza que un campo agregado después quede
  solo en uno de los dos. Es el patrón que ya sigue `SupplierModal.tsx`.

- **Se incluye la edición aunque el pedido original fuera "creación, listado y detalle".**
  Sin ella, cualquier error de captura (un RFC mal escrito, un salario equivocado) obligaría a
  corregir con SQL manual contra producción. El botón "Editar" ya está en el HTML de referencia
  y el costo marginal es cero: el modal ya existe.

- **Solo la pestaña "Información General"; ni siquiera se renderiza la barra de pestañas.**
  Se descartó mostrar las seis pestañas restantes deshabilitadas o con "Próximamente": una pestaña
  que no hace nada es una promesa incumplida en pantalla y genera preguntas del usuario final.
  Cuando cada módulo (Nómina, Asistencia, Documentos, Incidencias, Productividad, Inventario)
  tenga su spec, la barra aparece con contenido real.

- **La fotografía sí entra; el resto del expediente documental no.**
  La foto es parte del alta (identifica visualmente en el expediente) y reutiliza `app/api/upload`,
  que ya acepta imágenes, con cero infraestructura nueva. Los PDFs oficiales (INE, constancia fiscal,
  contrato, firmas de recibido) implican tipos de documento, versionado, reemplazo y control de acceso
  a datos sensibles: eso es un spec propio, no un anexo de este.

- **Sin vínculo `empleado ↔ usuario del sistema`.**
  Se descartó una columna `id_user`. No todos los empleados tienen cuenta (auxiliares, socios) ni
  todas las cuentas son empleados, y ligarlos arrastraría el módulo de usuarios/roles/aprobación
  al alcance. Cuando exista una necesidad concreta (que el podólogo vea su propia productividad),
  se agrega la columna en su spec.

- **`id_supervisor` como FK autoreferencial, no texto libre.**
  Un `<select>` de empleados activos evita nombres mal escritos y desincronizados cuando el
  supervisor cambia de nombre o se da de baja, y deja la puerta abierta a consultas de jerarquía
  ("todos los que reportan a X") sin migrar datos después.

- **`activo` (estatus de negocio) y `status` (borrado lógico) como columnas separadas.**
  Es el patrón que ya usan las tablas del repo. La UI solo mueve `activo`; no se expone borrado
  de ningún tipo, porque la regla §7 de `employees.md` exige conservar el histórico del empleado
  aunque deje la empresa.

- **Los tres salarios se capturan a mano, sin cálculo automático entre ellos.**
  Derivar quincenal y mensual desde el diario parece obvio, pero implica decidir si el mes tiene
  30 días, si se pagan séptimos, si el mixto calcula sobre la base o sobre el total: son reglas
  de nómina reales, con consecuencias legales. Este spec almacena lo que RH ya tiene definido;
  el cálculo pertenece al módulo de Nómina.

- **`horario` y `dias_laborales` como texto libre.**
  Estructurarlos (catálogo de días, rangos horarios, excepciones) solo tiene sentido cuando exista
  la Agenda Laboral que los consuma para algo — cruzarlos con citas, calcular asistencia. Modelarlos
  ahora sería adivinar el esquema que ese módulo necesitará; migrar texto libre a estructura después
  es trabajo acotado y con datos reales a la vista.

- **RFC, CURP y NSS opcionales, sin validación de formato ni unicidad.**
  Validar RFC/CURP mexicanos correctamente (homoclave, dígito verificador, entidad, palabras
  inconvenientes) es un problema propio y con falsos negativos caros: bloquear un alta legítima
  porque el validador no reconoce un caso es peor que almacenar un dato mal escrito y corregirlo.
  Forzar unicidad rompería el alta de empleados cuyo expediente aún está incompleto —el escenario
  normal el primer día.

- **Edad y antigüedad calculadas al vuelo, nunca almacenadas.**
  Un campo `edad` en la BD nace desactualizado al día siguiente y obligaría a un job de
  recalculo. Se derivan de `fecha_nacimiento` y `fecha_ingreso` en el render.

- **Los HTML de referencia aportan estructura, no estilos.**
  Traen su propio `tailwind.config` con una paleta y tipografía distintas a las del dashboard.
  Se toma de ellos la jerarquía de información, el orden de las secciones y las columnas de la
  tabla; el aspecto visual sale del sistema de diseño actual de la app (modo claro/oscuro,
  `lucide-react`), aplicando la paleta y tipografía de `references/DESIGN.md` con contraparte
  `dark:`, el mismo criterio ya usado en Movimientos, Recepciones y Conteo Físico, para que
  el módulo no se sienta pegado con cinta.

- **Tipos e interfaces en inglés (`IEmployee`, `IEmployeeRecord`), con campos en español.**
  `CLAUDE.md` exige nombres de código en inglés; los nombres de campo espejean columnas reales
  de la BD (que están en español) y renombrarlos obligaría a mapear en cada consulta. Es el
  mismo criterio de `ISupplier`.

- **Nada de esto toca `RH.departamentos`, `RH.puestos` ni `RH.turnos`.**
  Ya están creados y sembrados. Administrarlos desde la UI es un CRUD de catálogos con su propia
  pantalla y sus propias reglas (¿qué pasa con los empleados de un departamento desactivado?),
  y no bloquea este módulo: los datos sembrados alcanzan para operar.

## Riesgos identificados

| Riesgo | Mitigación / nota |
|---|---|
| **Colisión de `codigo_empleado` en altas concurrentes.** El consecutivo se calcula con un `MAX` previo al `INSERT`; dos altas simultáneas del mismo año podrían leer el mismo máximo. | En la práctica las altas las captura una sola persona de RH, así que la ventana es teórica. La constraint `UQ_empleados_codigo` garantiza que el segundo `INSERT` falle con error visible en vez de duplicar el código; el server action devuelve `{ ok: false }` y el usuario reintenta. Si algún día RH captura en paralelo, la salida es envolver cálculo e inserción en una transacción con `UPDLOCK`. |
| **Datos sensibles en el expediente** (RFC, CURP, NSS, cuenta bancaria, salarios) expuestos a más gente de la prevista. | El acceso queda restringido a `id_role` 1 y 4 en dos capas: el sidebar no renderiza el ítem, y `proxy.ts` bloquea la ruta y sus subrutas. Aun así, el control es de módulo completo, no por campo: un rol 4 ve la cuenta bancaria de todos. Si se necesita granularidad (que Contabilidad vea salarios pero no CURP, como sugiere §13 de `employees.md`), es un spec de permisos propio. |
| **`sucursales_string` inyectado en el `IN (...)`.** Es el único punto donde una lista de longitud variable entra al SQL, y viene del JWT. | Se parsea a enteros, se descartan valores no numéricos y se arma la lista como parámetros `@suc0, @suc1, …` pasados por `db.queryParams` — nunca interpolación de string. Caso borde a cubrir: `sucursales_string` vacío o malformado debe producir una lista vacía (cero resultados), no un `IN ()` que rompa la consulta. |
| **Corrimiento de fechas por UTC** en `fecha_ingreso` y `fecha_nacimiento` — el problema recurrente de este repo con `mssql`. | Se aplican las cuatro reglas de `CLAUDE.md`: `CONVERT(varchar(10), …, 120)` al leer, `toDBString` al escribir, `.slice(0, 10)` al bindear inputs, y normalización del string antes de construir cualquier `Date` para calcular edad/antigüedad. El caso de prueba explícito es un cumpleaños "hoy" y otro "mañana". |
| **Cálculo de antigüedad y edad mal redondeado.** Restar años sin comparar mes y día produce un año de más durante los meses previos al cumpleaños/aniversario. | Los helpers `calculateAge` y `calculateSeniority` comparan mes y día, no solo el año. El criterio de aceptación lo verifica el mismo día del cumpleaños y el día anterior. |
| **La tabla se crea a mano y el DDL puede divergir del spec.** No hay migraciones; si alguien ejecuta una versión editada del `CREATE TABLE`, los server actions fallan en runtime, no en compilación. | El DDL queda copiado en `queries.txt` como fuente de verdad, y el paso 1 del plan incluye verificar con `sp_help` que las FK y la constraint única existan antes de seguir. |
| **`id_supervisor` apuntando a un empleado inactivo o creando ciclos.** El `<select>` solo ofrece activos, pero un supervisor puede desactivarse después, y nada impide que A supervise a B y B a A. | Se acepta: el expediente sigue mostrando el nombre del supervisor aunque esté inactivo (es información histórica válida) y no hay ninguna consulta recursiva en este spec que un ciclo pueda colgar. Si más adelante se agrega un organigrama, ahí toca validar la aciclicidad. |
| **Foto subida a Cloudinary que queda huérfana.** Si el usuario sube una foto y cancela el modal, o la reemplaza en una edición, el archivo anterior permanece en Cloudinary sin referencia. | Se acepta en este spec: son imágenes pequeñas y de bajo volumen. La limpieza de huérfanos (borrado en Cloudinary al reemplazar/cancelar) aplica igual al resto de la app y merece resolverse de forma transversal, no solo aquí. |
| **El expediente muestra campos vacíos cuando el alta se hizo solo con obligatorios.** Un empleado recién creado puede verse como una rejilla llena de guiones. | Se renderiza un placeholder consistente (`—`) en lugar de campos en blanco o `null`, para que la ausencia de dato se lea como "no capturado" y no como un error de la pantalla. |

## Lo que **no** entra en este spec

- Las pestañas Nómina y Salario, Asistencia, Agenda Laboral, Documentos, Incidencias,
  Productividad e Inventario Asignado.
- El expediente documental (PDFs de INE, comprobante de domicilio, constancia fiscal, contrato,
  firmas de recibido). Solo entra la fotografía.
- CRUD de los catálogos `RH.departamentos`, `RH.puestos` y `RH.turnos`.
- Vínculo entre empleado y usuario del sistema.
- Cálculo automático entre salarios y cualquier lógica de nómina.
- Estructuración de horario y días laborales.
- Validación de formato o unicidad de RFC / CURP / NSS.
- Paginación, exportación a Excel y borrado de empleados.
- Permisos granulares por campo dentro del expediente.
