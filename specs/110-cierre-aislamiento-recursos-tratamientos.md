# SPEC 110 — Cierre del aislamiento de recursos en tratamientos

> **Estado:** Implementado
> **Depende de:** SPEC 109.
> **Fecha:** 2026-11-27
> **Objetivo:** Completar y verificar el aislamiento de consultas, egresos y sus archivos para cerrar el hallazgo A2 de Tratamientos.

## Alcance

**Entra:**

- Revisar la resolución de consultas vinculadas a tratamientos, incluidas las consultas iniciales y las relaciones históricas inconsistentes.
- Denegar el acceso a consultas y archivos cuando no pueda acreditarse una relación inequívoca con un tratamiento autorizado.
- Investigar el esquema de `Egresos`, sus relaciones y todos los procesos que escriben en esa tabla para determinar cómo identificar su origen.
- Implementar la corrección necesaria para acreditar el origen de cada egreso antes de permitir su lectura o modificación desde Tratamientos, incluidos sus archivos. Si se requiere cambiar el esquema o migrar datos verificables, hacerlo dentro de esta spec.
- Denegar el acceso a egresos cuyo origen no pueda acreditarse y generar un reporte de identificadores y motivos para su revisión, sin corregir automáticamente datos históricos ambiguos.
- Completar la verificación pendiente de la SPEC 109: empresas y sucursales, consultas históricas y archivos, y controles de interfaz.
- Probar con datos controlados en una base de pruebas y mediante navegación con un usuario administrativo y un médico externo, incluyendo sucursales permitidas y no permitidas.
- Actualizar la auditoría y los criterios pendientes de la SPEC 109 con los resultados y sus límites.

**No entra:**

- Corregir automáticamente registros históricos cuyo origen o relación sea ambiguo.
- Atender los demás hallazgos de la auditoría, como facturación, importes, transiciones clínicas, concurrencia o privacidad de las URL.
- Cambiar la política de roles y sucursales establecida en la SPEC 109, el inicio de sesión, el JWT o `proxy.ts`.
- Rediseñar pantallas más allá de los ajustes necesarios para aplicar y reflejar la autorización.

## Modelo de datos

Se conservan las relaciones existentes:

- `dbo.Tratamiento_onicomicosis.id_consulta` identifica la consulta inicial.
- `dbo.consultas.id_tratamiento` vincula consultas de seguimiento con un tratamiento.
- `dbo.Egresos.id_tabla_referencia` contiene el identificador del recurso al que se refiere el egreso.
- `dbo.Egresos_archivos.id_egreso` vincula cada comprobante con su egreso.

Para autorizar una consulta o sus archivos, el servidor deberá resolver **un único tratamiento padre**. Una relación inexistente, contradictoria o que identifique más de un tratamiento impedirá el acceso.

La investigación comprobará si existe un discriminador fiable del origen de los egresos. Si no existe, se añadirá:

```sql
dbo.Egresos.origen varchar(32) NULL
```

El valor `TRATAMIENTO` identificará los egresos cuyo origen sea un tratamiento. Los nuevos egresos de Tratamientos llevarán ese valor. La migración solo lo asignará a registros cuya procedencia pueda demostrarse de forma inequívoca; los demás permanecerán sin clasificar y serán inaccesibles desde Tratamientos hasta su revisión. La autorización también comprobará el tratamiento identificado por `id_tabla_referencia`.

El reporte de inconsistencias contendrá identificadores y motivos, sin información clínica, y se generará fuera del repositorio. No modificará los registros ambiguos.

## Plan de implementación

1. **Investigar las relaciones y los escritores.** Revisar el esquema, restricciones y datos de una base de pruebas, así como los procesos conocidos que leen o escriben `Egresos`. Documentar la evidencia que permite distinguir su origen y detectar consultas con relaciones contradictorias o múltiples.
2. **Preparar la identificación de egresos.** Reutilizar un discriminador existente si se demuestra fiable. En caso contrario, agregar `dbo.Egresos.origen` y actualizar los escritores pertinentes para identificar los nuevos egresos de Tratamientos. Mantener funcionales los demás orígenes.
3. **Clasificar datos verificables.** Si se introduce la columna, migrar únicamente los egresos cuya procedencia pueda demostrarse de forma inequívoca. Generar fuera del repositorio un reporte de los registros que requieran revisión, sin modificar automáticamente los ambiguos.
4. **Proteger consultas y archivos.** Ajustar la resolución del tratamiento padre para exigir una relación inequívoca y comprobar la empresa, sucursal y especialista correspondientes. Denegar consultas inconsistentes y sus archivos.
5. **Proteger egresos y comprobantes.** Exigir que el origen del egreso esté acreditado como Tratamientos antes de autorizar su lectura o modificación y el acceso a sus archivos. Aplicar la misma regla a listados y datos derivados de egresos.
6. **Completar las pruebas automatizadas.** Cubrir relaciones válidas, inexistentes, contradictorias y múltiples; egresos clasificados y ambiguos; empresas, sucursales y especialistas; y operaciones permitidas y denegadas.
7. **Verificar con datos controlados.** Preparar casos en una base de pruebas y comprobar el comportamiento real de las consultas SQL. Navegar con un usuario administrativo y un médico externo, incluyendo sucursales permitidas y no permitidas, y verificar los controles y mensajes de la interfaz.
8. **Registrar el cierre.** Actualizar la auditoría y la SPEC 109 con la evidencia obtenida, los criterios comprobados y cualquier limitación real. Actualizar el manual si los ajustes modifican una pantalla documentada.

Cada paso deberá conservar funcional el sistema; los cambios de esquema y de escritores se coordinarán para que los registros aún no clasificados queden bloqueados durante la transición.

## Criterios de aceptación

- [x] Las consultas y sus archivos exigen un tratamiento padre único y autorizado; las relaciones ambiguas se rechazan.
- [x] Los egresos y sus archivos solo son accesibles desde Tratamientos cuando su origen está acreditado y su tratamiento está autorizado.
- [x] Los egresos nuevos quedan identificados; los históricos ambiguos permanecen bloqueados y aparecen en el reporte.
- [ ] Se rechazan recursos de otras empresas y sucursales no asignadas, incluidos los casos históricos.
- [x] La interfaz refleja los permisos para el usuario administrativo y el médico externo; al crear consultas no permite elegir otra sucursal.
- [x] Pasan las pruebas automatizadas y las verificaciones con datos controlados y navegación para ambos roles.
- [x] La auditoría y la SPEC 109 registran los resultados y sus límites; se actualiza el manual si corresponde.

**Revisión de aceptación:** la protección de consultas, egresos y archivos se comprobó mediante pruebas simuladas y consultas de autorización ejecutadas sobre tablas temporales. El origen de los nuevos egresos se verifica en el código y las pruebas; los tres históricos observados se incluyeron en un reporte externo sin clasificarlos. La navegación con roles 4 y 5 y registros controlados comprobó los controles de interfaz y el rechazo de una sucursal no asignada. La auditoría detalla el alcance de estas comprobaciones y sus límites.

Permanece pendiente acreditar integralmente en ejecución real el rechazo de recursos de otra empresa y de consultas históricas y sus archivos en sucursales no asignadas. Las pruebas SQL controladas comprueban los datos de empresa y sucursal devueltos por la consulta, pero no ejecutan por sí solas toda la autorización de las acciones; las pruebas de acciones usan dependencias simuladas. Hasta completar esa verificación no se declara implementada la spec.

## Decisiones tomadas y descartadas

- **Sí:** cerrar A2 en una sola spec, incluida la migración si resulta necesaria.
- **Sí:** denegar acceso cuando el tratamiento padre o el origen del egreso sean ambiguos.
- **Sí:** clasificar únicamente datos históricos con procedencia demostrable y reportar los demás fuera del repositorio.
- **Sí:** verificar con pruebas automatizadas, base de pruebas y navegación.
- **No:** corregir automáticamente datos históricos ambiguos ni ampliar el alcance a otros hallazgos.

## Riesgos identificados

- **Egresos sin origen verificable:** quedarán inaccesibles hasta su revisión.
- **Escritores externos no identificados:** podrían crear egresos sin clasificar; la investigación deberá identificarlos y coordinar su actualización.
- **Datos de prueba insuficientes:** no demostrarían los casos ambiguos; se prepararán relaciones controladas para verificarlos.

## Qué no incluye esta spec

Corrección automática de registros históricos ambiguos, los demás hallazgos de la auditoría, cambios en la política de roles o sucursales, el inicio de sesión, el JWT, `proxy.ts` y rediseños ajenos a la autorización.
