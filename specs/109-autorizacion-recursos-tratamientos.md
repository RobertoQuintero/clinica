# SPEC 109 — Autorización por recurso en tratamientos

> **Estado:** Implementado
> **Depende de:** SPEC 108.
> **Fecha:** 2026-11-27
> **Objetivo:** Proteger las acciones de Tratamientos mediante autorización vigente por empresa, sucursal, especialista y operación.

## Alcance

**Entra:**

- Proteger las acciones exportadas de Tratamientos mediante el rol, la empresa y las sucursales vigentes del usuario consultados en servidor.
- Limitar el acceso a las sucursales enumeradas en `users.sucursales_string`; denegar el acceso cuando la asignación esté vacía o no incluya la sucursal.
- Vincular cada tratamiento con la empresa y sucursal de su consulta inicial. Resolver el tratamiento padre antes de autorizar sus pagos, egresos, recetas, consultas y archivos.
- Limitar al médico externo, rol 5, a sus propios tratamientos. Permitirle consultar egresos y comprobantes, incluidos sus importes, sin modificarlos ni adjuntar archivos. Restringirle los pagos del paciente.
- Aplicar en servidor las restricciones de operación por rol que ya establece la interfaz.
- Derivar paciente, empresa y sucursal de la consulta inicial al crear una consulta de tratamiento; validar que el podólogo elegido pertenezca a la empresa y tenga asignada la sucursal.
- Mostrar consultas existentes en otra sucursal únicamente si el usuario tiene asignada también esa sucursal.
- Agregar pruebas de autorización y registrar en la auditoría la cobertura y sus límites.

**No entra:**

- Corregir los demás hallazgos de la auditoría, incluidos los relativos a facturación, importes, transiciones clínicas, concurrencia y privacidad de archivos.
- Cambiar el inicio de sesión, el JWT, `proxy.ts` o las acciones de otros módulos.
- Introducir sucursales globales para administradores o modificar la forma de asignarlas.
- Rediseñar las pantallas; solo se ajustarán los controles necesarios para reflejar las reglas confirmadas.

## Modelo de datos

Esta spec no introduce tablas ni columnas. Amplía el contexto de sesión privado en `app/dashboard/tratamientos/actions.ts` con los datos vigentes de `dbo.users`:

```ts
interface ITreatmentSession {
  id_user: number;
  id_empresa: number;
  id_role: number;
  sucursales: number[];
}
```

- `sucursales` se obtiene de `users.sucursales_string` en cada llamada. Solo se admiten identificadores enteros positivos válidos; una lista vacía no concede acceso a ninguna sucursal.
- `dbo.Tratamiento_onicomicosis.id_consulta` enlaza el tratamiento con su consulta inicial en `dbo.consultas`. Esta aporta `id_paciente`, `id_empresa` e `id_sucursal`; `id_especialista` procede del tratamiento.
- Los pagos, egresos, recetas y archivos se autorizan a través de su tratamiento padre. Para los archivos de consulta, también se comprueba la sucursal de la consulta correspondiente.
- Al crear una consulta se usan el paciente, la empresa y la sucursal de la consulta inicial. El podólogo elegido debe ser un usuario vigente de esa empresa con la sucursal asignada.
- Las consultas históricas vinculadas al tratamiento se filtran por sus propias sucursales además de exigir acceso al tratamiento.

## Plan de implementación

1. **Preparar el contexto de autorización.** Ampliar `getActiveUser()` en `app/dashboard/tratamientos/actions.ts` para obtener el rol y las sucursales vigentes junto con la identidad y empresa. Validar la lista de sucursales y denegar cuando no permita acreditar el acceso.
2. **Aislar listado y búsqueda.** Comprobar la sucursal solicitada contra las asignaciones vigentes y la empresa. Para el rol 5, derivar siempre el especialista de la sesión, independientemente de los filtros enviados por el cliente.
3. **Proteger tratamientos y recursos hijos.** Resolver el tratamiento mediante su consulta inicial y comprobar empresa, sucursal y especialista antes de leer o modificar sus datos. Aplicar el mismo control a pagos, egresos, recetas, consultas y archivos, resolviendo primero su recurso padre.
4. **Aplicar permisos por operación.** Inventariar las restricciones actuales de la interfaz y exigirlas también en servidor. Permitir al rol 5 leer los egresos y comprobantes de sus tratamientos, pero impedirle modificarlos, subir archivos o avanzar su etapa; denegarle los pagos del paciente.
5. **Restringir las consultas.** Filtrar las consultas históricas y sus archivos por la sucursal de cada consulta. Al crear una consulta, derivar paciente, empresa y sucursal de la consulta inicial y validar al podólogo. Ajustar el formulario para retirar la selección de sucursal.
6. **Ajustar la interfaz.** Ocultar o deshabilitar los controles que el rol 5 ya no podrá usar en egresos y conservar la visualización de sus datos y comprobantes. Mostrar errores de autorización sin dejar indicadores de carga permanentes.
7. **Agregar pruebas de regresión.** Ampliar las pruebas de acceso con una matriz de empresas, sucursales, especialistas, roles y operaciones. Comprobar rechazos por IDs cruzados, filtros omitidos o manipulados y relaciones inválidas, así como los casos autorizados.
8. **Registrar la evidencia.** Actualizar `audits/2026-11-27-auditoria-tratamientos.md` con lo atendido, las verificaciones realizadas y las limitaciones que permanezcan. Actualizar el manual correspondiente si existe una página afectada por los cambios de interfaz.

Cada paso conservará funcionales las acciones ya protegidas por la SPEC 108 y sus contratos de respuesta.

## Criterios de aceptación

- [x] Cada acción usa el rol, empresa y sucursales vigentes del usuario.
- [ ] Se rechazan recursos de otra empresa o sucursal no asignada.
- [x] El rol 5 accede solo a sus tratamientos, aunque manipule u omita filtros.
- [x] El rol 5 puede consultar egresos y comprobantes, pero no modificarlos ni acceder a pagos del paciente.
- [x] El servidor exige los permisos por operación establecidos en la interfaz.
- [ ] Las consultas históricas y sus archivos requieren acceso a su sucursal.
- [x] Las nuevas consultas usan paciente, empresa y sucursal de origen y validan al podólogo.
- [x] La interfaz refleja los permisos y no permite elegir otra sucursal al crear consultas.
- [x] Pasan las pruebas de acceso, TypeScript y lint de los archivos modificados.
- [x] La auditoría y el manual afectado, si existe, reflejan los cambios.

**Seguimiento de verificación — SPEC 110:** con roles 4 y 5 se comprobó en navegación la visibilidad de controles, egresos y comprobantes clasificados, la ausencia de pagos y controles de modificación para el médico externo y la ausencia de un selector de sucursal al crear consultas. Con registros controlados también se comprobó el rechazo del médico ante una sucursal no asignada y su acceso a otra asignada. La matriz de otras empresas y el acceso directo a consultas históricas y sus archivos no se verificaron integralmente en ejecución real, por lo que esos criterios permanecen pendientes. Las pruebas simuladas y las consultas SQL sobre tablas temporales aportan cobertura adicional, con los límites detallados en la auditoría.

## Decisiones tomadas y descartadas

- **Sí:** consultar rol y sucursales vigentes en cada llamada; el cliente no determina el acceso.
- **Sí:** permitir al médico externo consultar sus egresos y comprobantes, sin modificarlos.
- **Sí:** usar la sucursal de origen para nuevas consultas y filtrar las históricas por su propia sucursal.
- **No:** conceder acceso implícito por `id_sucursal` o por rol administrador.
- **No:** corregir los demás hallazgos de la auditoría en esta spec.

## Riesgos identificados

- **Asignaciones incompletas:** usuarios sin sucursales válidas perderán acceso hasta corregir su asignación.
- **Datos históricos inconsistentes:** recursos sin una relación verificable con su tratamiento quedarán inaccesibles.
- **Revocación durante una operación:** el control inicial no cancela operaciones ya autorizadas.

## Qué no incluye esta spec

Los demás hallazgos de la auditoría, cambios al inicio de sesión, JWT u otros módulos, nuevas reglas de asignación de sucursales y rediseño de pantallas.
