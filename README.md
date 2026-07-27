# Centro Podológico — Admin

Aplicación de administración (Next.js, App Router) para una clínica podológica: pacientes, tratamientos, citas, ventas, productos, sucursales y usuarios, sobre SQL Server. La UI y los identificadores están mayormente en español.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **SQL Server** vía `mssql`, sin ORM (SQL crudo)
- **Auth** con JWT (`jose`) en cookie `auth_token`
- **Tailwind CSS 4**
- **Google Calendar API** (`googleapis`) para sincronizar citas por sucursal
- **Cloudinary** para carga de imágenes
- **FullCalendar** para el calendario de citas, **Recharts** para gráficas, **jsPDF** para reportes

## Requisitos previos

- Node.js 20+
- Acceso a una instancia de SQL Server con la base `CentroPodologico`
- Credenciales de una cuenta de servicio de Google (para Calendar) y de Cloudinary (para uploads)

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
```

No hay herramienta de migraciones: los cambios de esquema se aplican directamente contra la base de datos. `queries.txt` en la raíz contiene SQL ad hoc usado durante el desarrollo.

## Comandos

```bash
npm install
npm run dev      # servidor de desarrollo (localhost:3000)
npm run build    # build de producción
npm run start    # levanta el build de producción
npm run lint     # eslint
```

No hay suite de pruebas configurada en este repositorio.

## Arquitectura

### Capa de datos

`database/connection.ts` expone un singleton `db` con `query(sql)` y `queryParams(sql, params)`. Siempre se prefiere `queryParams` para cualquier entrada de usuario: mapea valores de JS a parámetros SQL tipados (`sql.Bit`, `sql.Int`, `sql.DateTime2`, o `sql.NVarChar(sql.MAX)` por defecto), que es la única protección contra inyección SQL en el proyecto. Todas las tablas viven bajo `[CentroPodologico].[dbo]`.

### Mutaciones vía Server Actions

Casi toda la lectura/escritura de datos ocurre a través de Server Actions (`"use server"`), un archivo `actions.ts` por feature: `app/dashboard/<feature>/actions.ts` (citas, enlaces, pacientes, productos, servicios, sucursales, tratamientos, usuarios, ventas) más `app/dashboard/actions.ts` y `app/actions/auth.ts`. `app/api/` solo tiene una ruta REST real (`app/api/upload`, para subir archivos/imágenes a Cloudinary); las nuevas features de CRUD deben seguir el patrón de server actions, no agregar endpoints REST.

Las actions suelen devolver una unión discriminada `ActionResult<T> = { ok: true; data: T } | { ok: false; message: string }` (ver `app/actions/auth.ts`).

### Auth y autorización

Autenticación basada en JWT (`jose`), guardada en la cookie `auth_token`. El payload (`IAuthUser` en `interfaces/auth.ts`) incluye `id_role`, `status` (estado de aprobación), `id_sucursal`, `id_empresa` y `sucursales_string` (IDs de sucursales a las que el usuario tiene acceso, separados por coma).

`proxy.ts` (usado como middleware de Next.js) verifica el JWT y hace redirects a nivel de ruta:

- No autenticado → `/login`; autenticado pero pendiente de aprobación (`status` false) → `/pending`.
- `id_role === 5` solo puede acceder a `/dashboard/tratamientos`.
- `/dashboard/usuarios` solo es accesible para `id_role` 1 y 4.

Rutas nuevas con restricción por rol deben extender `proxy.ts` en lugar de filtrarse solo del lado del cliente.

`contexts/AuthContext.tsx` envuelve el estado del cliente sobre las server actions de `app/actions/auth.ts` (`loginAction`, `logoutAction`, `registerAction`, `getMeAction`). `lib/rateLimiter.ts` implementa bloqueo por IP/email para login y registro.

### Contexto multi-sucursal

`contexts/SucursalContext.tsx` mantiene la sucursal seleccionada (`id_sucursal`) del lado del cliente, sembrada con un valor inicial y persistida vía `setSelectedSucursal` (`app/dashboard/sucursales/actions.ts`). Si un usuario solo tiene acceso a una sucursal (`sucursales_string` con una sola entrada), esa sucursal queda forzada. Cada sucursal tiene su propio Google Calendar vinculado (columna `link_calendar`) para agendar citas.

### Integración con Google Calendar

`lib/googleCalendar.ts` se autentica como cuenta de servicio de Google (JWT firmado con `jose`, con conversión PKCS#1→PKCS#8 necesaria por Node/OpenSSL 3), sin usar el cliente JWT de `google-auth-library` para evitar `ERR_OSSL_UNSUPPORTED`. Los eventos llevan `extendedProperties.private` con metadata propia de la app (p. ej. `id_sucursal`).

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
  api/upload/              # única ruta REST (subida a Cloudinary)
  dashboard/
    <feature>/              # citas, enlaces, pacientes, productos, servicios,
      page.tsx              # sucursales, tratamientos, usuarios, ventas
      actions.ts
      componentes/
  login/ register/ pending/
contexts/                  # AuthContext, SucursalContext, ThemeContext
database/connection.ts     # singleton db (query / queryParams)
interfaces/                 # tipos TS por entidad de dominio (paciente.ts, cita.ts, ...)
lib/                        # integraciones server-side (Google Calendar, rate limiter)
utils/                       # helpers puros (fechas, ids aleatorios)
proxy.ts                    # middleware de Next.js (auth + autorización por rol)
queries.txt                  # SQL ad hoc de desarrollo
```

El alias de path `@/*` apunta a la raíz del repo (ver `tsconfig.json`).



### Google Calendar integration

- `lib/googleCalendar.ts` authenticates as a Google service account (JWT signed with `jose`, PKCS#1→PKCS#8 conversion needed because of Node/OpenSSL 3) — no `google-auth-library` JWT client is used, to avoid `ERR_OSSL_UNSUPPORTED`.
- Calendar events carry `extendedProperties.private` for app-specific metadata (e.g. `id_sucursal`).
- Env vars: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID` (primary/default), `GOOGLE_EXTRA_CALENDAR_IDS` (comma-separated, queried in parallel and de-duplicated by event ID).

