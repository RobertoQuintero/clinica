# SPEC 110 — Investigación de relaciones y egresos

Investigación de solo lectura sobre la base configurada para pruebas y el código disponible, el 27 de noviembre de 2026. Los conteos describen únicamente esa base y ese momento.

## Egresos

- `dbo.Egresos` tiene clave primaria en `id_egreso`. `id_tabla_referencia` e `id_egreso_tipo` admiten NULL; no aparece una columna que identifique la tabla de origen ni una clave foránea en la tabla. `Egresos_archivos` tiene clave primaria propia, pero no una clave foránea declarada para `id_egreso`.
- Se observaron tres egresos, todos con un identificador de referencia coincidente con un tratamiento y un único tipo distinto. La coincidencia numérica y el tipo observado no demuestran procedencia: otra tabla puede usar el mismo identificador y no se encontró una regla que reserve el tipo para tratamientos. No existe evidencia suficiente para clasificar automáticamente estos registros.
- La búsqueda en el código disponible identificó un único INSERT en `app/dashboard/tratamientos/actions.ts`, en `createEgreso`; en ese mismo archivo se actualizan y eliminan lógicamente egresos, se listan y se consultan o registran sus archivos. `authorizeExpense` interpreta la referencia como tratamiento sin verificar su origen. `getTratamientos` también deriva el estado de pago del último egreso por coincidencia de referencia.
- La búsqueda de módulos SQL visibles cuya definición contiene `egresos` no devolvió resultados. Esto no demuestra que no existan aplicaciones, procesos externos, SQL dinámico o módulos ocultos por permisos. Deben identificarse y coordinarse por separado antes de confiar en que todos los escritores proporcionan un origen.

## Consultas

- La consulta inicial se relaciona mediante `Tratamiento_onicomicosis.id_consulta`; los seguimientos mediante `consultas.id_tratamiento`. Ninguna de estas relaciones tiene una clave foránea declarada en las tablas inspeccionadas, y no se observó una restricción de unicidad declarada para la consulta inicial.
- En la muestra no se encontraron seguimientos con tratamiento inexistente, consultas iniciales que apunten a otro tratamiento, consultas iniciales compartidas por varios tratamientos ni tratamientos sin consulta inicial. Estos conteos no prueban el comportamiento ante datos inconsistentes.
- `authorizeConsultation` combina ambas relaciones con `OR` y usa solo la primera fila. Si una consulta inicial apunta a otro tratamiento o es inicial de varios, puede obtener más de un padre y no rechaza expresamente la ambigüedad. Los listados de consultas también requieren revisión al aplicar la regla de padre único.

## Consecuencia para los pasos siguientes

No se acreditó un discriminador existente fiable. Conforme a la SPEC 110, corresponde preparar `Egresos.origen`, identificar los nuevos egresos de Tratamientos y mantener bloqueados los registros no clasificados durante la transición. La clasificación histórica requiere evidencia adicional verificable; coincidir con un ID de tratamiento no basta. La inspección de restricciones refleja los objetos visibles a la sesión y no sustituye un inventario de sistemas externos.
