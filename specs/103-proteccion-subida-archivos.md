# SPEC 103 — Protección de la subida de archivos

> **Estado:** Implementada
> **Depende de:** 41 (imágenes de productos) y 102 (validación de usuario vigente).
> **Modifica base de datos:** No.
> **Fecha:** 2026-11-24
> **Objetivo:** Proteger las subidas de archivos mediante validación de sesión vigente, carpetas permitidas, tamaño máximo e identificadores generados por el servidor.

## Alcance

**Entra:**

- Exigir un usuario vigente en base de datos para usar `POST /api/upload` y denegar la subida si no se puede validar.
- Permitir únicamente las carpetas utilizadas por los flujos actuales y conservar `clinica/consultas` como carpeta predeterminada.
- Limitar cada archivo enviado al servidor a 5 MiB y rechazarlo antes de enviarlo a Cloudinary si supera el límite.
- Generar en el servidor un identificador aleatorio para cada archivo e ignorar los parámetros `name` y `overwrite` enviados por el cliente.
- Adaptar la subida de imágenes de Productos para que cada carga obtenga una URL nueva; al guardar el producto se conserva la URL seleccionada.
- Agregar validación y mensajes de tamaño en los formularios que hoy no los tienen, manteniendo los límites más estrictos ya existentes.
- Probar las validaciones y los flujos afectados, y registrar la atención de C1 en la auditoría.

**No entra:**

- Autorizar cada carpeta según el módulo, rol o empresa del usuario.
- Eliminar archivos anteriores o sin referencia en Cloudinary.
- Modificar las URLs ya guardadas ni migrar archivos existentes.
- Atender los hallazgos C2 y C3 u otros hallazgos de la auditoría.
- Cambiar el esquema de la base de datos.

## Modelo de datos

Esta spec no introduce tablas ni columnas. Las URL de los archivos seguirán guardándose en los campos existentes.

`/api/upload` admitirá únicamente estas carpetas exactas:

```text
clinica/consultas
clinica/facturas
clinica/egresos
clinica/recetas
clinica/empleados
clinica/empleados/documentos
clinica/empleados/faltas
clinica/empleados/retardos
clinica/productos
```

Si no se envía `folder`, se usará `clinica/consultas`. El servidor generará un identificador aleatorio independiente por subida y configurará Cloudinary para no sobrescribir archivos existentes.

El límite general será de **5 242 880 bytes** por archivo enviado. Se conservarán los límites de 1 MiB que ya aplican en recetas y egresos.

## Plan de implementación

1. **Proteger la ruta de subida.** En `app/api/upload/route.ts`, verificar el JWT y consultar el usuario vigente en `dbo.users` antes de procesar el archivo. Rechazar usuarios inexistentes, desactivados o eliminados y denegar la operación si falla la consulta.
2. **Validar carpeta y tamaño.** Aplicar la lista exacta de carpetas aprobada. Limitar la lectura del cuerpo a 5 242 880 bytes, incluso si falta o es incorrecto `Content-Length`, y conservar las comprobaciones existentes de tipo declarado y contenido.
3. **Generar identificadores seguros.** Crear un identificador aleatorio en el servidor para cada subida, ignorar `name` y `overwrite`, y configurar Cloudinary para no sobrescribir archivos.
4. **Adaptar los formularios.** Actualizar los flujos que llaman a `/api/upload` para retirar los parámetros que ya no se usan y mostrar el error de tamaño cuando corresponda. En Productos, usar la nueva URL de cada subida y conservar la URL seleccionada al guardar.
5. **Verificar la protección.** Agregar pruebas de regresión para autenticación, usuario revocado, error de base de datos, carpetas, límite de tamaño, tipos de archivo e intentos de sobrescritura. Comprobar también los flujos de subida afectados.
6. **Actualizar la documentación.** Registrar en `audits/2026-11-16-auditoria-nomina.md` la corrección de C1 y la evidencia obtenida, señalando cualquier verificación pendiente. Actualizar la documentación técnica y el manual si los mensajes o instrucciones de las pantallas cambian.

## Criterios de aceptación

- [ ] Solo usuarios vigentes en base de datos pueden subir archivos; si falla la consulta, se deniega la subida.
- [ ] Solo se aceptan las carpetas aprobadas.
- [ ] Se rechazan archivos de más de 5 MiB, aunque falte o sea incorrecto `Content-Length`.
- [ ] El servidor genera el identificador y no permite sobrescribir archivos mediante parámetros del cliente.
- [ ] Los formularios afectados muestran un error de tamaño y Productos guarda la nueva URL.
- [ ] Se conservan las validaciones de tipo y los límites más estrictos existentes.
- [ ] Pasan las pruebas de regresión y las comprobaciones correspondientes.
- [ ] La auditoría y la documentación afectada reflejan el cambio.

## Decisiones tomadas y descartadas

- **Sí:** validar al usuario en base de datos en cada subida.
- **Sí:** limitar las carpetas y generar identificadores en el servidor.
- **Sí:** aplicar 5 MiB como máximo general y conservar límites menores.
- **Sí:** crear una URL nueva al cambiar la imagen de un producto.
- **No:** sobrescribir o eliminar archivos existentes.
- **No:** añadir permisos por módulo o empresa en esta spec.

## Riesgos identificados

- **Base de datos no disponible:** se rechazan las subidas.
- **Archivos sin referencia:** las imágenes reemplazadas permanecen en Cloudinary.
- **Archivos mayores de 5 MiB:** los flujos que antes los admitían ahora los rechazarán.

## Qué no incluye esta spec

Permisos por módulo o empresa, eliminación o migración de archivos, cambios de esquema y otros hallazgos de la auditoría.
