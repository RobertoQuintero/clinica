# SPEC 108 — Autenticación vigente en acciones de tratamientos

> **Estado:** Implementado
> **Depende de:** SPEC 107.
> **Fecha:** 2026-11-27
> **Objetivo:** Exigir una sesión válida y un usuario vigente antes de ejecutar cualquier acción exportada de Tratamientos.

La comprobación incluirá usuario existente, activo y no eliminado, consultado en base de datos en cada llamada.

## Alcance

**Entra:**

- Proteger las 27 acciones exportadas de `app/dashboard/tratamientos/actions.ts`, incluidos listado, búsqueda y catálogos.
- Verificar firma y vencimiento del JWT y validar su `id_user`.
- Consultar `dbo.users` en cada llamada y rechazar usuarios inexistentes, inactivos o eliminados, sin caché entre solicitudes.
- Obtener del registro vigente la identidad y empresa utilizadas actualmente por las acciones.
- Denegar el acceso ante errores de autenticación o de su consulta, antes de ejecutar SQL de negocio o consumir inventario.
- Conservar los contratos actuales: las lecturas rechazan la llamada y las escrituras devuelven `{ ok: false, message }`, salvo las escrituras con `Promise<void>`, que rechazan la llamada como se precisa en el plan.
- Agregar pruebas de regresión y registrar en la auditoría la atención de A1 y de la parte de A3 cubierta por estas acciones, conservando los hallazgos originales.

**No entra:**

- Resolver A2: aislamiento por empresa, sucursal y especialista, validación de relaciones y permisos por operación.
- Introducir restricciones adicionales por rol.
- Modificar el login, la duración del JWT, `proxy.ts` u otros módulos.
- Corregir los demás hallazgos, cambiar el esquema de datos o rediseñar pantallas.

## Modelo de datos

Esta spec no introduce tablas ni columnas. Reutiliza `dbo.users`:

- `id_user`: identidad del usuario.
- `status` y `deleted_at`: comprobación de vigencia.
- `id_empresa`: empresa actual para los filtros que ya existen.

El helper privado `getActiveUser()` de `app/dashboard/tratamientos/actions.ts` devolverá únicamente:

```ts
interface ITreatmentSession {
  id_user: number;
  id_empresa: number;
}
```

El JWT verificado aportará solo `id_user`, que deberá ser un entero positivo seguro. El helper consultará mediante `queryParams` un usuario con `status = 1` y `deleted_at IS NULL`; ambos campos devueltos procederán de ese registro.

No habrá caché entre llamadas ni cambios en los parámetros y respuestas públicos de las acciones. Los datos de recursos recibidos del formulario seguirán pendientes de la validación de A2.

## Plan de implementación

1. **Actualizar el helper privado de sesión.** En `app/dashboard/tratamientos/actions.ts`, adaptar `getActiveUser()` al contrato `ITreatmentSession`: verificar el JWT, validar `id_user` y consultar el usuario vigente con `queryParams`. Rechazar si falta, está inactivo/eliminado o falla la consulta.
2. **Proteger lecturas y catálogos.** Invocar el helper antes de cualquier SQL de negocio en cada lectura exportada. Mantener los filtros existentes y utilizar la empresa actual de la base de datos en listado y búsqueda.
3. **Proteger todas las escrituras.** Validar la sesión antes de consultar, modificar datos o consumir inventario. Reutilizar el usuario obtenido para los campos que ya se derivan de sesión, evitando consultas de autenticación duplicadas dentro de la misma llamada.
4. **Agregar pruebas de regresión.** Crear `tests/treatment-access.test.ts`, siguiendo el patrón existente de Nómina. Cubrir las 27 acciones con cookie ausente, JWT inválido/vencido, identidad inválida, usuario inexistente/inactivo/eliminado y fallo de consulta. Comprobar que no se ejecuta SQL de negocio ni consumo de inventario tras un rechazo, y que una sesión válida conserva los contratos actuales.
5. **Registrar la evidencia.** Actualizar `audits/2026-11-27-auditoria-tratamientos.md` conservando los hallazgos originales y documentando la atención de A1, la cobertura parcial de A3 y las verificaciones realizadas.

**Precisión sobre los contratos:** `markTratamientoRevisado` y `updateTratamientoStage` actualmente devuelven `Promise<void>`; al fallar la autenticación rechazarán la llamada. Las escrituras que ya devuelven `{ ok, message }` conservarán ese formato.

## Criterios de aceptación

- [x] Las 27 acciones verifican JWT y usuario vigente antes del SQL de negocio.
- [x] Sesiones ausentes/inválidas y usuarios inexistentes/inactivos/eliminados quedan bloqueados.
- [x] Un fallo de autenticación impide escrituras y consumo de inventario.
- [x] Cada llamada consulta al usuario sin caché y utiliza su identidad y empresa actuales donde corresponde.
- [x] Se conservan los contratos de respuesta y rechazo existentes.
- [x] Pasan las pruebas de regresión, TypeScript y lint de los archivos modificados.
- [x] La auditoría registra la evidencia y el alcance pendiente de A2/A3.

## Decisiones tomadas y descartadas

- **Sí:** validar al usuario en base de datos en cada llamada; el JWT no acredita su vigencia.
- **Sí:** mantener un helper privado de Tratamientos y conservar los contratos públicos.
- **Sí:** proteger también catálogos y comprobar rechazos mediante pruebas directas.
- **No:** agregar permisos por rol ni aislamiento de recursos; corresponden a A2.
- **No:** cambiar JWT, login o helpers de otros módulos.

## Riesgos identificados

- **Base de datos no disponible:** se deniega el acceso.
- **Revocación durante una operación:** la validación inicial no cancela operaciones ya autorizadas.
- **Acceso a recursos ajenos con sesión válida:** permanece pendiente de A2.
- **Mayor carga SQL:** consultar por clave primaria una vez por llamada.

## Qué no incluye esta spec

Aislamiento y permisos de A2, restricciones adicionales por rol, cambios al login o JWT, otros módulos y hallazgos, cambios de esquema y rediseño de pantallas.
