# SPEC 102 — Control de acceso vigente y sucursal validada en Nómina

> **Estado:** Implementado
> **Depende de:** 52 (periodos), 98 (CFDI ordinario) y 99 (cancelación de CFDI).
> **Modifica base de datos:** No.
> **Fecha:** 2026-11-24
> **Objetivo:** Cerrar A1 y A2 validando los permisos actuales del usuario y la sucursal autorizada en las acciones y descargas de Nómina.

## Alcance

**Entra:**

- Consultar en cada llamada a Nómina el usuario actual en `dbo.users`, usando la identidad del JWT verificado.
- Denegar el acceso si el usuario no existe, está desactivado, fue eliminado o su rol actual no es 1 o 4.
- Obtener empresa y sucursal principal de la base de datos.
- Validar que `sel_sucursal` identifica una sucursal con `status = 1` de la empresa actual del usuario.
- Si la cookie falta o es inválida, usar la sucursal principal únicamente si cumple las mismas condiciones; de lo contrario, denegar el acceso.
- Conservar para los roles 1 y 4 el acceso a cualquier sucursal válida de su empresa, sin restringirlos por `sucursales_string`.
- Aplicar la validación del usuario vigente a las descargas XML, PDF y acuse de CFDI, conservando su comprobación de pertenencia a la empresa.
- Denegar la operación si falla la consulta de autorización.
- Incorporar pruebas de regresión para A1 y A2, actualizar `docs/nomina.md` y registrar la atención de ambos hallazgos en la auditoría.

**No entra:**

- Cambiar la duración de siete días del JWT, el login o introducir versiones de sesión.
- Extender la corrección a otros módulos o cambiar globalmente los permisos de facturación.
- Atender los demás hallazgos de la auditoría.
- Modificar cálculos, estados de periodos, procesos de timbrado o cancelación, ni el esquema de datos.
- Rediseñar pantallas o actualizar capturas del manual.

## Modelo de datos

Esta spec no introduce tablas ni columnas. Reutiliza:

- `dbo.users`: `id_user`, `id_role`, `status`, `deleted_at`, `id_empresa` e `id_sucursal`.
- `dbo.sucursales`: `id_sucursal`, `id_empresa` y `status`.

El JWT verificado aporta únicamente `id_user` para consultar la autorización vigente. Los permisos, la empresa y la sucursal principal se obtienen de la base de datos en cada llamada, sin caché entre solicitudes.

Se conserva el contrato de `IPayrollSession` en `lib/payroll/access.ts`:

```ts
interface IPayrollSession {
  id_sucursal: number;
  id_user: number;
  id_empresa: number;
}
```

Sus valores procederán del usuario vigente y de la sucursal validada. La cookie `sel_sucursal` se tratará como una selección que debe comprobarse.

Las descargas conservarán la autorización por empresa del recibo; no exigirán que este pertenezca a la sucursal seleccionada.

## Plan de implementación

1. **Validar el usuario vigente en `lib/payroll/access.ts`.** Extraer una función compartida por acciones y descargas que verifique el JWT, valide `id_user` y consulte `dbo.users` con `queryParams`. Rechazar usuarios inexistentes, desactivados, eliminados o sin rol 1/4. Usar la empresa y sucursal principal actuales; ante un fallo de consulta, denegar el acceso.
2. **Validar la sucursal en `assertPayrollAccess()`.** Aceptar `sel_sucursal` únicamente como un entero positivo y comprobar su empresa y `status = 1`. Si falta o es inválida, comprobar la sucursal principal con las mismas reglas. Conservar `ActionResult<IPayrollSession>` y corregir el comentario que presenta la cookie como un dato confiable.
3. **Proteger las descargas con la validación compartida del usuario.** Modificar `app/api/nomina/cfdi/[id]/xml/route.ts`, `app/api/nomina/cfdi/[id]/pdf/route.ts` y `app/api/nomina/cfdi/[id]/acuse/route.ts`. Sustituir `requireBillingAccess()` por la validación vigente de Nómina. Mantener el filtro por empresa del recibo y permitir su descarga sin depender de la sucursal seleccionada. No modificar `lib/auth/session.ts`.
4. **Agregar pruebas en `tests/payroll-access.test.ts`.** Cubrir JWT inválido, cambios de permisos con el mismo token, selección de otra empresa, sucursales inválidas, respaldo válido e inválido y errores de base de datos. Comprobar también que las tres descargas rechazan usuarios revocados antes de llamar al proveedor.
5. **Actualizar la documentación.** Describir el control vigente en `docs/nomina.md` y registrar en `audits/2026-11-16-auditoria-nomina.md` la corrección y la evidencia obtenida para A1 y A2, conservando el hallazgo original y señalando cualquier verificación pendiente.

## Criterios de aceptación

- [x] Cada llamada valida el usuario en base de datos; un JWT vigente no conserva permisos revocados.
- [x] Usuarios inexistentes, inactivos, eliminados o sin rol 1/4 quedan bloqueados.
- [x] Solo se aceptan sucursales con `status = 1` de la empresa actual.
- [x] Una cookie ausente o inválida usa la sucursal principal validada; sin respaldo válido, se deniega el acceso.
- [x] XML, PDF y acuse validan al usuario vigente y la empresa del recibo, sin depender de la sucursal seleccionada.
- [x] Un fallo de consulta deniega la operación antes de acceder a datos de Nómina o al proveedor.
- [x] Pasan las pruebas de regresión, TypeScript y lint de los archivos modificados.
- [x] La documentación y la auditoría registran la corrección y su evidencia.

## Decisiones tomadas y descartadas

- **Sí:** consultar permisos en cada llamada, sin caché entre solicitudes.
- **Sí:** conservar acceso de roles 1/4 a todas las sucursales válidas de su empresa.
- **Sí:** usar la sucursal principal validada como respaldo.
- **Sí:** compartir la validación del usuario entre acciones y descargas.
- **No:** cambiar el JWT de siete días ni introducir versiones de sesión.
- **No:** extender el cambio a otros módulos ni atender otros hallazgos.

## Riesgos identificados

- **Base de datos no disponible:** se bloquea el acceso; no se usan permisos antiguos como respaldo.
- **Cambios durante una operación:** la validación al inicio no cancela operaciones ya autorizadas y en curso.
- **Mayor carga de consultas:** consultar por clave primaria y evitar validaciones duplicadas dentro de una misma operación.

## Qué no incluye esta spec

Otros módulos y hallazgos, cambios al JWT, cálculos, procesos de CFDI, esquema de datos y rediseño de pantallas.
