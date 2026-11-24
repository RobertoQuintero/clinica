# Centro Podológico — Admin

Aplicación de administración (Next.js, App Router) para una clínica podológica: pacientes, tratamientos, citas, ventas, inventario, empleados, nómina y facturación, sobre SQL Server. La UI y los identificadores están mayormente en español.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **SQL Server** vía `mssql`, sin ORM (SQL crudo)
- **Auth** con JWT (`jose`) en cookie `auth_token`
- **Tailwind CSS 4**
- **Google Calendar API** (`googleapis`) para sincronizar citas por sucursal
- **Cloudinary** para carga de imágenes
- **Facturapi** para facturación electrónica y CFDI de nómina
- **FullCalendar** para el calendario de citas, **Recharts** para gráficas, **jsPDF** para reportes
- **Checadores biométricos ZKTeco** (protocolo ADMS/iClock) para asistencia de empleados

## Requisitos previos

- Node.js 20+
- Acceso a una instancia de SQL Server con la base `CentroPodologico`
- Credenciales de Google Calendar, Cloudinary y Facturapi para sus respectivas integraciones

## Configuración

Crea un archivo `.env.local` en la raíz con las siguientes variables:

```bash
# Base de datos (SQL Server)
DB_HOST=
DB_NAME=CentroPodologico
DB_USERNAME=
DB_PASSWORD=

# Auth
JWT_SECRET_SEED=

# Google Calendar (una cuenta de servicio con acceso a los calendarios de cada sucursal)
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_CALENDAR_ID=
GOOGLE_EXTRA_CALENDAR_IDS=   # opcional, IDs separados por coma

# Cloudinary (leído automáticamente por el SDK)
CLOUDINARY_URL=

# Facturación y CFDI
FACTURAPI_USER_KEY=
BILLING_ENCRYPTION_KEY=

# Solo para datos demo y capturas del manual
ALLOW_DEMO_SEED=
DEMO_USER_PASSWORD=
MANUAL_CAPTURE_BASE_URL=
```

Consulta `.env.template` como punto de partida. Las variables de las integraciones se necesitan para las funciones correspondientes. La empresa demo requiere configuración y confirmación explícitas; consulta [Sucursal Demo](docs/sucursal-demo.md).

No hay herramienta de migraciones: los cambios de esquema se aplican directamente contra la base de datos. `queries.txt` en la raíz contiene SQL ad hoc usado durante el desarrollo.

## Comandos

```bash
npm install
npm run dev      # servidor de desarrollo (localhost:3000)
npm run build    # build de producción
npm run start    # levanta el build de producción
npm run lint     # eslint
npm run seed:demo       # crea datos de demostración
npm run capture:manual  # captura imágenes del manual con Playwright
```

Hay pruebas con `node:test` en `tests/` para nómina y cargas. No existe un script `npm test` configurado; la prueba de integración de SDI requiere SQL Server y datos adecuados. Consulta los archivos de prueba antes de ejecutarlos.

## Arquitectura

### Capa de datos

`database/connection.ts` expone un singleton `db` con `query(sql)` y `queryParams(sql, params)`. Siempre se prefiere `queryParams` para cualquier entrada de usuario: mapea valores de JS a parámetros SQL tipados (`sql.Bit`, `sql.Int`, `sql.DateTime2`, o `sql.NVarChar(sql.MAX)` por defecto), que es la única protección contra inyección SQL en el proyecto. Todas las tablas viven bajo `[CentroPodologico].[dbo]`.

### Mutaciones vía Server Actions

La aplicación usa principalmente Server Actions (`"use server"`) para lectura y escritura, organizadas por módulo y, cuando corresponde, por pantalla. `app/api/` también contiene rutas para la carga de archivos, el protocolo ADMS/iClock, catálogos y descargas de facturación, y descargas de CFDI de nómina. Estas rutas comprueban su propia autorización cuando corresponde; `proxy.ts` no cubre `/api/*`.

`POST /api/upload` verifica el JWT y el usuario activo en base de datos antes de aceptar archivos. Admite únicamente las carpetas enumeradas en la ruta, con `clinica/consultas` como predeterminada, y limita el cuerpo a 5 MiB (5 242 880 bytes). Valida el tipo declarado y la firma del contenido; recetas y egresos conservan su límite de 1 MiB en el formulario. Cada carga recibe un identificador generado por el servidor y Cloudinary no sobrescribe archivos existentes. Al reemplazar una imagen de producto se guarda la nueva URL; el archivo anterior no se elimina.

Las actions suelen devolver una unión discriminada `ActionResult<T> = { ok: true; data: T } | { ok: false; message: string }` (ver `app/actions/auth.ts`).

### Auth y autorización

Autenticación basada en JWT (`jose`), guardada en la cookie `auth_token`. El payload (`IAuthUser` en `interfaces/auth.ts`) incluye `id_role`, `status` (estado de aprobación), `id_sucursal`, `id_empresa` y `sucursales_string` (IDs de sucursales a las que el usuario tiene acceso, separados por coma).

`proxy.ts` (usado como middleware de Next.js) verifica el JWT y hace redirects a nivel de ruta:

- No autenticado → `/login`; autenticado pero pendiente de aprobación (`status` false) → `/pending`.
- `id_role === 5` solo puede acceder a `/dashboard/tratamientos`.
- `id_role === 6` está limitado al módulo de inventario; el rol 2 tiene acceso restringido dentro de ese módulo.
- Usuarios, empleados, facturación y nómina están restringidos a los roles 1 y 4. Ayuda aplica los permisos del manual correspondiente.

Las restricciones de interfaz y de ruta deben complementarse con autorización del lado del servidor en cada operación. Nómina, por ejemplo, consulta el usuario y sus permisos vigentes en la base de datos; ver [Nómina](docs/nomina.md).

`contexts/AuthContext.tsx` envuelve el estado del cliente sobre las server actions de `app/actions/auth.ts` (`loginAction`, `logoutAction`, `registerAction`, `getMeAction`). `lib/rateLimiter.ts` implementa bloqueo por IP/email para login y registro.

### Contexto multi-sucursal

`contexts/SucursalContext.tsx` mantiene la sucursal seleccionada (`id_sucursal`) del lado del cliente, sembrada con un valor inicial y persistida vía `setSelectedSucursal` (`app/dashboard/sucursales/actions.ts`). Si un usuario solo tiene acceso a una sucursal (`sucursales_string` con una sola entrada), esa sucursal queda forzada. Cada sucursal tiene su propio Google Calendar vinculado (columna `link_calendar`) para agendar citas.

### Integración con Google Calendar

`lib/googleCalendar.ts` se autentica como cuenta de servicio de Google (JWT firmado con `jose`, con conversión PKCS#1→PKCS#8 necesaria por Node/OpenSSL 3), sin usar el cliente JWT de `google-auth-library` para evitar `ERR_OSSL_UNSUPPORTED`. Los eventos llevan `extendedProperties.private` con metadata propia de la app (p. ej. `id_sucursal`).

### RH — Empleados

`app/dashboard/empleados/` administra el alta, listado y detalle de empleados (tabla `RH.empleados`, catálogos en `interfaces/rh_catalogs.ts` — departamento, puesto, turno). El detalle (`empleados/[id]/`) usa un layout con tabs para:

- **Documentos** (`[id]/documentos/`): carga y gestión de documentos del empleado (Cloudinary).
- **Asistencia** (`[id]/asistencia/`): checadas del empleado, alimentadas por los checadores biométricos (ver abajo).
- También incluye gestión de horarios, vacaciones y bajas. Los detalles están en [RH y empleados](docs/rh-empleados.md).

### Asistencias biométricas (checadores ZKTeco)

Los checadores biométricos ZKTeco de cada sucursal empujan checadas por el protocolo **ADMS/iClock** contra `app/api/asistencias/iclock/*` (`cdata` para handshake/envío de registros, `getrequest` para polling). Es una excepción intencional a "no agregar endpoints REST": el dispositivo habla un protocolo fijo por HTTP plano, no encaja en Server Actions.

- `lib/zktecoAdms.ts` parsea el body `ATTLOG` que manda el dispositivo, resuelve el checador por número de serie (`resolveChecadorBySN`, contra `RH.checadores`) y guarda las checadas (`saveAttendanceRecords`). Un SN no dado de alta o inactivo se rechaza con `403`.
- `app/dashboard/sucursales/componentes/SucursalCheckadoresModal.tsx` administra qué checadores (`IChecador`, `interfaces/checador.ts`) están activos por sucursal.
- `interfaces/asistencia.ts` / `interfaces/employee.ts` definen las checadas y el empleado; el server action de sucursales resuelve el identificador de empleado ligado a cada checador.

### Inventario

Módulo de inventario multi-sucursal, con lógica compartida en `lib/inventory/` (`stock.ts`, `consultationConsumption.ts`):

- **Productos** (`app/dashboard/productos/`) y **proveedores** (`proveedores/`, `interfaces/supplier.ts`, `supplier_product.ts`).
- **Pedidos** (`pedidos/`, `interfaces/purchase_order.ts`, `purchase_order_template.ts`): órdenes de compra a proveedores.
- **Recepciones** (`recepciones/`, `interfaces/purchase_reception.ts`): recepción de mercancía contra un pedido, actualiza stock.
- **Movimientos** (`movimientos/`, `interfaces/movement.ts`, `kardex.ts`): kardex de entradas/salidas de stock por sucursal.
- **Conteos** (`conteos/`, `interfaces/stock_count.ts`): conteos físicos de inventario para conciliar contra el stock del sistema.

### Nómina, facturación y ayuda

- **Nómina** (`app/dashboard/nomina/`, `lib/payroll/`): periodos, cálculo y aprobación, incidencias, comisiones, bonos, parámetros fiscales, PTU y CFDI. Consulta las reglas y limitaciones en [Nómina](docs/nomina.md).
- **Facturación** (`app/dashboard/facturacion/`, `lib/billing/`): organizaciones, clientes, productos y facturas mediante Facturapi. Consulta [Facturación](docs/facturacion.md) para la configuración y el alcance por empresa.
- **Ayuda** (`app/dashboard/ayuda/`): manual de usuario en Markdown, actualmente con contenido de nómina en `content/manual/nomina/`. Consulta [Manual de usuario](docs/manual-usuario.md).

También hay documentación específica para [inventario](docs/inventario.md), [Google Calendar](docs/google-calendar.md) y [asistencias biométricas](docs/asistencias-biometricas.md).

### Manejo de fechas/horas (crítico, específico de mssql)

`mssql` convierte los objetos `Date` de JS a UTC al serializar, lo que corrompe las horas locales de esta clínica (zona horaria Ciudad de México). **Todos los valores de fecha/hora deben viajar como strings planos, nunca como objetos `Date`**, de punta a punta. Los helpers están en `utils/date_helpper.ts`:

| Helper | Propósito |
|---|---|
| `toDBString(val)` | string de formulario/DB → string seguro para SQL Server `"YYYY-MM-DD HH:mm:ss"` (o `null`) |
| `toDateTimeLocal(val)` | string de DB/ISO → valor para `<input type="datetime-local">` `"YYYY-MM-DDTHH:mm"` |
| `addZeroToday(date)` | `Date` local → `"YYYY-MM-DD"` (usa `America/Mexico_City`, no UTC) |
| `buildDate(date)` | `Date` local → `"YYYY-MM-DD HH:mm:ss"` (usa `America/Mexico_City`, no UTC) |

Reglas al tocar código con campos `fecha*`/`created_at`/fechas en general:

1. **SELECT**: castear columnas de fecha con `CONVERT(varchar(19), [col], 120)` (datetime) o `CONVERT(varchar(10), [col], 120)` (solo fecha) para que mssql nunca devuelva un `Date` de JS.
2. **Server action / escritura**: pasar los campos por `toDBString(String(val ?? ""))`, nunca `new Date(val)`.
3. **Inputs de formulario**: bindear valores `datetime-local` con `toDateTimeLocal(...)`; valores `date` con `String(val ?? "").slice(0, 10)`.
4. **Display/formato**: nunca llamar `new Date(dbValue)` directamente sobre un string crudo de la DB; normalizar primero (reemplazar `" "` por `"T"`, o agregar `"T00:00:00"` si es solo fecha) para que el navegador lo parsee como hora local, no UTC.
5. **Timestamps nuevos**: usar `buildDate(new Date())`, no `new Date().toISOString()`. Para fechas por defecto usar `addZeroToday(new Date())`, no `.toISOString().slice(0, 10)` (incorrecto cerca de medianoche por el offset UTC).

## Estructura de directorios

```
app/
  actions/auth.ts         # server actions de autenticación
  api/
    upload/                 # subida a Cloudinary
    asistencias/iclock/     # webhook ADMS para checadores biométricos ZKTeco
    facturacion/ nomina/    # catálogos y descargas de documentos fiscales
  dashboard/
    <feature>/              # módulos clínicos, inventario, RH, nómina y facturación
      page.tsx              # pantalla principal del módulo
      actions.ts            # server actions, también en subrutas cuando aplica
      componentes/          # componentes de interfaz
  login/ register/ pending/
contexts/                  # AuthContext, SucursalContext, ThemeContext
database/connection.ts     # singleton db (query / queryParams)
interfaces/                 # tipos TS por entidad de dominio (paciente.ts, cita.ts, employee.ts, ...)
lib/                        # lógica de dominio e integraciones server-side
content/manual/             # contenido Markdown de la ayuda integrada
docs/                       # documentación técnica por módulo
scripts/                    # datos demo y capturas del manual
tests/                      # pruebas de nómina y cargas
utils/                       # helpers puros (fechas, ids aleatorios)
proxy.ts                    # middleware de Next.js (auth + autorización por rol)
queries.txt                  # SQL ad hoc de desarrollo
```

El alias de path `@/*` apunta a la raíz del repo (ver `tsconfig.json`).

